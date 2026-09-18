import { angleTo, clamp, dist, dist2, moveToward, type Point } from '../core/math';
import { findPath, hasLineOfWalk, nearestWalkable } from '../core/pathfinding';
import { Rng } from '../core/rng';
import { SPELL_BY_ID } from '../data/heroes';
import { ITEM_BY_ID, RECOMMENDED_BUILDS } from '../data/items';
import {
  BLUE_SHOP,
  BLUE_SPAWN,
  CAMPS,
  inBrush,
  isWalkable,
  laneFor,
  RED_SHOP,
  RED_SPAWN,
  STRUCTURES,
  WORLD_SIZE,
  type LaneId
} from '../data/map';
import type { DamageType, ItemDef, SkillDef } from '../data/types';
import type { BotLevel, TeamSide } from '../../lib/types';
import { Unit } from './unit';
import { emptyStats, type Announcement, type Effect, type FloatingText, type KillFeedEntry, type Particle, type Projectile, type ScoreEntry, type Status, type StatusKind, type Team, type WardMarker, type Zone } from './types';
import { executeSkill, skillCooldown, skillManaCost, skillRankIndex } from './skills';
import { createAiState, runAi } from './ai';

export interface HeroPick {
  heroId: string;
  skinId: string;
  name: string;
  isBot: boolean;
  spells: [string, string];
}

export interface MatchConfig {
  playerTeam: TeamSide;
  difficulty: BotLevel;
  blue: HeroPick[];
  red: HeroPick[];
  seed?: number;
}

const XP_PER_LEVEL = (level: number) => 280 + (level - 1) * 130;
const MAX_LEVEL = 18;
const WAVE_INTERVAL = 30;
const FIRST_WAVE = 22;
const PASSIVE_GOLD_START = 90;
const PASSIVE_GOLD_RATE = 2.6;
const TOWER_RANGE = 860;

const DIFFICULTY_TUNING: Record<BotLevel, { reaction: number; aggression: number; accuracy: number; awareness: number; skillUse: number; statMul: number; goldMul: number }> = {
  easy: { reaction: 0.85, aggression: 0.42, accuracy: 0.52, awareness: 1100, skillUse: 0.35, statMul: 0.86, goldMul: 0.82 },
  medium: { reaction: 0.42, aggression: 0.66, accuracy: 0.75, awareness: 1700, skillUse: 0.68, statMul: 1.0, goldMul: 1.0 },
  hard: { reaction: 0.16, aggression: 0.88, accuracy: 0.94, awareness: 2400, skillUse: 0.95, statMul: 1.12, goldMul: 1.22 }
};

export class World {
  time = 0;
  running = true;
  finished = false;
  winner: TeamSide | null = null;
  surrendered = false;

  units: Unit[] = [];
  unitsById = new Map<number, Unit>();
  heroes: Unit[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  wards: WardMarker[] = [];
  particles: Particle[] = [];
  effects: Effect[] = [];
  floaters: FloatingText[] = [];
  killFeed: KillFeedEntry[] = [];
  announcements: Announcement[] = [];

  player!: Unit;
  playerTeam: TeamSide = 'blue';
  difficulty: BotLevel = 'medium';
  rng: Rng;

  kills: Record<TeamSide, number> = { blue: 0, red: 0 };
  towerKills: Record<TeamSide, number> = { blue: 0, red: 0 };
  teamGold: Record<TeamSide, number> = { blue: 0, red: 0 };
  drakeStacks: Record<TeamSide, number> = { blue: 0, red: 0 };
  inhibitorDown: Record<TeamSide, number> = { blue: 0, red: 0 };

  private nextWaveAt = FIRST_WAVE;
  private nextProjectileId = 1;
  private nextZoneId = 1;
  private campRespawn = new Map<string, number>();
  private visibleToPlayer = new Set<number>();
  private visionSources: Array<{ x: number; y: number; r: number; team: Team; inBrush: boolean }> = [];
  private grid = new Map<number, Unit[]>();
  private cellSize = 420;
  private lastPassiveGold = 0;
  private shakeAmount = 0;
  private config: MatchConfig;
  private pendingRemoval: Unit[] = [];
  private nextVisionAt = 0;
  private scheduled: Array<{ at: number; run: () => void }> = [];

  constructor(config: MatchConfig) {
    this.config = config;
    this.rng = new Rng(config.seed ?? (Date.now() >>> 0));
    this.playerTeam = config.playerTeam;
    this.difficulty = config.difficulty;
    Unit.reset();
    this.buildStructures();
    this.buildHeroes(config);
    this.spawnAllCamps();
    this.announce('Welcome to the Rift', 'Minions spawn in 20 seconds', 'neutral', 4);
  }

  private buildStructures() {
    for (const spec of STRUCTURES) {
      const u = new Unit();
      u.kind = spec.kind;
      u.team = spec.team;
      u.structureId = spec.id;
      u.x = spec.pos.x;
      u.y = spec.pos.y;
      u.name = spec.kind === 'nexus' ? 'Nexus Core' : spec.kind === 'inhibitor' ? 'Inhibitor' : 'Turret';
      u.base = emptyStats();
      if (spec.kind === 'tower') {
        const hp = spec.tierIndex === 1 ? 2900 : spec.tierIndex === 2 ? 3300 : spec.tierIndex === 3 ? 3700 : 2500;
        u.base.hp = hp;
        u.base.ad = 150 + spec.tierIndex * 12;
        u.base.armor = 28;
        u.base.mr = 28;
        u.base.attackSpeed = 0.9;
        u.base.attackRange = TOWER_RANGE;
        u.radius = 78;
        u.visionRadius = 1300;
      } else if (spec.kind === 'inhibitor') {
        u.base.hp = 3400;
        u.base.armor = 20;
        u.base.mr = 20;
        u.radius = 86;
        u.visionRadius = 1100;
      } else {
        u.base.hp = 4200;
        u.base.armor = 25;
        u.base.mr = 25;
        u.radius = 130;
        u.visionRadius = 1600;
      }
      u.markDirty();
      u.hp = u.maxHp;
      u.laneIndex = spec.tierIndex;
      u.lane = spec.lane === 'base' ? 'mid' : spec.lane;
      this.addUnit(u);
    }
  }

  private buildHeroes(config: MatchConfig) {
    const lanes: Array<'top' | 'jungle' | 'mid' | 'bot' | 'support'> = ['top', 'jungle', 'mid', 'bot', 'support'];
    const make = (picks: HeroPick[], team: TeamSide, slotBase: number) => {
      picks.forEach((pick, i) => {
        const u = Unit.createHero(pick.heroId, pick.skinId, team, slotBase + i, pick.name);
        u.spells = [
          { id: pick.spells[0], cooldownUntil: 0 },
          { id: pick.spells[1], cooldownUntil: 0 }
        ];
        u.lane = lanes[i % lanes.length];
        const spawn = team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
        const spread = (i - 2) * 120;
        u.x = spawn.x + spread;
        u.y = spawn.y + (team === 'blue' ? -spread * 0.3 : spread * 0.3);
        u.isPlayer = !pick.isBot;
        if (pick.isBot) {
          const tuning = DIFFICULTY_TUNING[config.difficulty];
          u.ai = createAiState(config.difficulty, u.hero!.role, u.lane, tuning);
          u.base.hp *= tuning.statMul;
          u.base.ad *= tuning.statMul;
          u.markDirty();
          u.hp = u.maxHp;
          this.autoLevelSkill(u);
        } else {
          this.player = u;
        }
        u.spawnAnim = 1;
        this.addUnit(u);
        this.heroes.push(u);
      });
    };
    make(config.blue, 'blue', 0);
    make(config.red, 'red', 5);
    if (!this.player) this.player = this.heroes[0];
  }

  private addUnit(u: Unit) {
    this.units.push(u);
    this.unitsById.set(u.id, u);
  }

  unit(id: number): Unit | undefined {
    return this.unitsById.get(id);
  }

  update(dt: number) {
    if (this.finished) return;
    this.time += dt;

    this.rebuildGrid();
    this.runScheduled();
    this.updateStatuses(dt);
    this.updateSpawning();
    this.updateCamps();
    this.updateHeroes(dt);
    this.updateMinions(dt);
    this.updateMonsters(dt);
    this.updateStructures(dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateWards();
    this.updateRegen(dt);
    if (this.time >= this.nextVisionAt) {
      this.nextVisionAt = this.time + 0.1;
      this.computeVision();
    }
    this.updateVisuals(dt);
    this.purgeRemoved();
    this.checkVictory();
  }

  schedule(delay: number, run: () => void) {
    this.scheduled.push({ at: this.time + delay, run });
  }

  private runScheduled() {
    if (this.scheduled.length === 0) return;
    const due = this.scheduled.filter((s) => s.at <= this.time);
    if (due.length === 0) return;
    this.scheduled = this.scheduled.filter((s) => s.at > this.time);
    for (const s of due) s.run();
  }

  private purgeRemoved() {
    if (this.pendingRemoval.length === 0) return;
    for (const u of this.pendingRemoval) this.unitsById.delete(u.id);
    const doomed = new Set(this.pendingRemoval.map((u) => u.id));
    this.units = this.units.filter((u) => !doomed.has(u.id));
    this.pendingRemoval.length = 0;
  }

  private rebuildGrid() {
    this.grid.clear();
    for (const u of this.units) {
      if (!u.alive) continue;
      const key = this.cellKey(u.x, u.y);
      const list = this.grid.get(key);
      if (list) list.push(u);
      else this.grid.set(key, [u]);
    }
  }

  private cellKey(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return cy * 4096 + cx;
  }

  nearbyUnits(x: number, y: number, radius: number): Unit[] {
    const out: Unit[] = [];
    const cells = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let gy = cy - cells; gy <= cy + cells; gy++) {
      for (let gx = cx - cells; gx <= cx + cells; gx++) {
        const list = this.grid.get(gy * 4096 + gx);
        if (!list) continue;
        for (const u of list) out.push(u);
      }
    }
    return out;
  }

  enemiesInRadius(team: Team, x: number, y: number, radius: number, includeStructures = true): Unit[] {
    const r2 = radius * radius;
    return this.nearbyUnits(x, y, radius).filter(
      (u) =>
        u.alive &&
        this.isEnemy(team, u.team) &&
        (includeStructures || (u.kind !== 'tower' && u.kind !== 'inhibitor' && u.kind !== 'nexus')) &&
        dist2(x, y, u.x, u.y) <= r2 + u.radius * u.radius
    );
  }

  alliesInRadius(team: Team, x: number, y: number, radius: number, heroesOnly = false): Unit[] {
    const r2 = radius * radius;
    return this.nearbyUnits(x, y, radius).filter(
      (u) => u.alive && u.team === team && (!heroesOnly || u.kind === 'hero') && dist2(x, y, u.x, u.y) <= r2
    );
  }

  isEnemy(a: Team, b: Team): boolean {
    if (a === b) return false;
    if (a === 'neutral' || b === 'neutral') return true;
    return true;
  }

  private updateStatuses(dt: number) {
    for (const u of this.units) {
      if (u.statuses.length === 0) continue;
      const ticking = u.statuses.filter((s) => (s.kind === 'burn' || s.kind === 'poison') && this.time >= s.tickAt);
      for (const s of ticking) {
        s.tickAt = this.time + 0.5;
        const src = this.unit(s.sourceId);
        this.dealDamage(src ?? null, u, s.amount * 0.5, s.kind === 'burn' ? 'magic' : 'physical', { silentSource: true, skill: s.label });
      }
      const before = u.statuses.length;
      u.statuses = u.statuses.filter((s) => this.time < s.until);
      if (u.statuses.length !== before) u.markDirty();
    }
  }

  private updateSpawning() {
    if (this.time < this.nextWaveAt) return;
    this.nextWaveAt += WAVE_INTERVAL;
    const waveNumber = Math.floor((this.time - FIRST_WAVE) / WAVE_INTERVAL) + 1;
    for (const lane of ['top', 'mid', 'bot'] as LaneId[]) {
      this.spawnWave('blue', lane, waveNumber);
      this.spawnWave('red', lane, waveNumber);
    }
  }

  private spawnWave(team: TeamSide, lane: LaneId, waveNumber: number) {
    const path = laneFor(team, lane);
    const origin = team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
    const scale = 1 + Math.floor(this.time / 90) * 0.13;
    const superMinion = this.inhibitorDown[team === 'blue' ? 'red' : 'blue'] > 0;
    const composition: Array<'melee' | 'ranged' | 'siege' | 'super'> = ['melee', 'melee', 'melee', 'ranged', 'ranged', 'ranged'];
    if (waveNumber % 3 === 0) composition.push('siege');
    if (superMinion) composition.push('super');

    composition.forEach((type, i) => {
      const u = new Unit();
      u.kind = 'minion';
      u.team = team;
      u.lane = lane;
      u.name = type === 'super' ? 'Super Minion' : type === 'siege' ? 'Siege Minion' : type === 'ranged' ? 'Caster Minion' : 'Melee Minion';
      u.base = emptyStats();
      const offsetAngle = (i / composition.length) * Math.PI * 2;
      u.x = origin.x + Math.cos(offsetAngle) * 180;
      u.y = origin.y + Math.sin(offsetAngle) * 180;
      u.waypoints = path.map((p) => ({ x: p.x, y: p.y }));
      u.waypointIndex = 0;
      if (type === 'melee') {
        u.base.hp = 490 * scale;
        u.base.ad = 13 * scale;
        u.base.armor = 10 + scale * 4;
        u.base.mr = 8;
        u.base.attackRange = 130;
        u.base.moveSpeed = 340;
        u.radius = 24;
        u.goldShare = 21;
      } else if (type === 'ranged') {
        u.base.hp = 320 * scale;
        u.base.ad = 25 * scale;
        u.base.armor = 4;
        u.base.mr = 8;
        u.base.attackRange = 520;
        u.base.moveSpeed = 340;
        u.radius = 22;
        u.goldShare = 15;
      } else if (type === 'siege') {
        u.base.hp = 900 * scale;
        u.base.ad = 42 * scale;
        u.base.armor = 16;
        u.base.mr = 16;
        u.base.attackRange = 320;
        u.base.moveSpeed = 330;
        u.radius = 30;
        u.goldShare = 60;
      } else {
        u.base.hp = 1600 * scale;
        u.base.ad = 90 * scale;
        u.base.armor = 40;
        u.base.mr = 40;
        u.base.attackRange = 170;
        u.base.moveSpeed = 350;
        u.radius = 32;
        u.goldShare = 72;
      }
      u.base.attackSpeed = 0.85;
      u.markDirty();
      u.hp = u.maxHp;
      u.visionRadius = 900;
      this.addUnit(u);
    });
  }

  private spawnAllCamps() {
    for (const camp of CAMPS) {
      if (camp.kind === 'ancient') {
        this.campRespawn.set(camp.id, 420);
        continue;
      }
      if (camp.kind === 'drake') {
        this.campRespawn.set(camp.id, 240);
        continue;
      }
      this.spawnCamp(camp.id);
    }
  }

  private updateCamps() {
    for (const [id, at] of this.campRespawn) {
      if (this.time >= at) {
        this.campRespawn.delete(id);
        this.spawnCamp(id);
      }
    }
  }

  private spawnCamp(id: string) {
    const spec = CAMPS.find((c) => c.id === id);
    if (!spec) return;
    for (let i = 0; i < spec.count; i++) {
      const u = new Unit();
      u.kind = 'monster';
      u.team = 'neutral';
      u.campId = id;
      u.base = emptyStats();
      const angle = (i / spec.count) * Math.PI * 2;
      const spread = spec.count > 1 ? 90 : 0;
      u.x = spec.pos.x + Math.cos(angle) * spread;
      u.y = spec.pos.y + Math.sin(angle) * spread;
      const scale = 1 + this.time / 600;
      switch (spec.kind) {
        case 'gromp':
          u.name = 'Grumble Toad';
          u.base.hp = 1400 * scale;
          u.base.ad = 60 * scale;
          u.radius = 42;
          u.goldShare = 85;
          break;
        case 'wolves':
          u.name = i === 0 ? 'Alpha Pup' : 'Pup';
          u.base.hp = (i === 0 ? 1100 : 480) * scale;
          u.base.ad = (i === 0 ? 48 : 22) * scale;
          u.radius = i === 0 ? 38 : 28;
          u.goldShare = i === 0 ? 55 : 22;
          break;
        case 'raptors':
          u.name = i === 0 ? 'Crested Raptor' : 'Raptor';
          u.base.hp = (i === 0 ? 900 : 260) * scale;
          u.base.ad = (i === 0 ? 40 : 18) * scale;
          u.radius = i === 0 ? 34 : 24;
          u.goldShare = i === 0 ? 45 : 12;
          break;
        case 'buff_blue':
          u.name = 'Azure Sentinel';
          u.base.hp = 1900 * scale;
          u.base.ad = 70 * scale;
          u.radius = 48;
          u.goldShare = 110;
          break;
        case 'buff_red':
          u.name = 'Crimson Sentinel';
          u.base.hp = 1900 * scale;
          u.base.ad = 75 * scale;
          u.radius = 48;
          u.goldShare = 110;
          break;
        case 'krug':
          u.name = i === 0 ? 'Ancient Boulder' : 'Boulder';
          u.base.hp = (i === 0 ? 1500 : 500) * scale;
          u.base.ad = (i === 0 ? 55 : 25) * scale;
          u.radius = i === 0 ? 44 : 30;
          u.goldShare = i === 0 ? 70 : 20;
          break;
        case 'scuttle':
          u.name = 'River Scuttler';
          u.base.hp = 800 * scale;
          u.base.ad = 0;
          u.radius = 36;
          u.goldShare = 45;
          break;
        case 'drake':
          u.name = 'Rift Drake';
          u.base.hp = 4200 * scale;
          u.base.ad = 130 * scale;
          u.radius = 90;
          u.goldShare = 275;
          break;
        case 'ancient':
          u.name = 'Ancient Beast';
          u.base.hp = 9500 * scale;
          u.base.ad = 210 * scale;
          u.radius = 120;
          u.goldShare = 420;
          break;
        default:
          break;
      }
      u.base.armor = 22;
      u.base.mr = 22;
      u.base.attackSpeed = 0.7;
      u.base.attackRange = spec.kind === 'drake' || spec.kind === 'ancient' ? 320 : 170;
      u.base.moveSpeed = 320;
      u.markDirty();
      u.hp = u.maxHp;
      u.visionRadius = 700;
      u.waypoints = [{ x: spec.pos.x, y: spec.pos.y }];
      this.addUnit(u);
    }
  }

  private updateHeroes(dt: number) {
    for (const u of this.heroes) {
      if (!u.alive) {
        if (this.time >= u.respawnAt) this.respawnHero(u);
        continue;
      }
      u.animTime += dt;
      u.attackAnim = Math.max(0, u.attackAnim - dt * 3.4);
      u.castAnim = Math.max(0, u.castAnim - dt * 2.6);
      u.hurtAnim = Math.max(0, u.hurtAnim - dt * 3.6);
      u.spawnAnim = Math.max(0, u.spawnAnim - dt * 1.4);

      if (u.channel) {
        if (u.disabled && u.channel.interruptible) {
          u.channel = null;
          u.recallProgress = 0;
        } else {
          u.channel.remaining -= dt;
          u.recallProgress = u.channel.skillId === 'recall' ? 1 - u.channel.remaining / u.channel.total : 0;
          if (u.channel.remaining <= 0) {
            const done = u.channel.onComplete;
            u.channel = null;
            u.recallProgress = 0;
            done();
          }
          continue;
        }
      }

      if (u.ai && !u.isPlayer) runAi(this, u, dt);
      this.updateDash(u, dt);
      this.updateMovement(u, dt);
      this.updateAutoAttack(u, dt);
      this.applyPassives(u, dt);
    }
  }

  private respawnHero(u: Unit) {
    u.alive = true;
    const spawn = u.team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
    u.x = spawn.x + this.rng.range(-110, 110);
    u.y = spawn.y + this.rng.range(-110, 110);
    u.hp = u.maxHp;
    u.mp = u.maxMp;
    u.statuses.length = 0;
    u.path.length = 0;
    u.moveTarget = null;
    u.targetId = 0;
    u.dash = null;
    u.spawnAnim = 1;
    u.markDirty();
    if (u.ai) {
      u.ai.goal = 'lane';
      u.ai.waypointIndex = 0;
    }
  }

  private updateMinions(dt: number) {
    for (const u of this.units) {
      if (u.kind !== 'minion' || !u.alive) continue;
      u.animTime += dt;
      u.attackAnim = Math.max(0, u.attackAnim - dt * 3.4);

      const target = this.pickMinionTarget(u);
      if (target) {
        u.targetId = target.id;
        const range = u.stats().attackRange + target.radius;
        if (dist(u.x, u.y, target.x, target.y) <= range) {
          u.moveTarget = null;
          u.path.length = 0;
          this.tryAttack(u, target, dt);
        } else {
          this.steerTo(u, { x: target.x, y: target.y }, dt);
        }
      } else {
        u.targetId = 0;
        const wp = u.waypoints[u.waypointIndex];
        if (wp) {
          if (dist(u.x, u.y, wp.x, wp.y) < 260) u.waypointIndex = Math.min(u.waypointIndex + 1, u.waypoints.length - 1);
          this.steerTo(u, wp, dt);
        }
      }
    }
  }

  private pickMinionTarget(u: Unit): Unit | null {
    const aggroRange = 620;
    let best: Unit | null = null;
    let bestScore = Infinity;
    for (const e of this.nearbyUnits(u.x, u.y, aggroRange)) {
      if (!e.alive || !this.isEnemy(u.team, e.team)) continue;
      if (e.kind === 'monster' || e.kind === 'ward') continue;
      if (e.hidden) continue;
      if ((e.kind === 'tower' || e.kind === 'inhibitor' || e.kind === 'nexus') && !this.structureTargetable(e)) continue;
      const d = dist(u.x, u.y, e.x, e.y);
      if (d > aggroRange) continue;
      const priority = e.kind === 'minion' ? 0 : e.kind === 'hero' ? 1 : 2;
      const score = priority * 10000 + d;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private updateMonsters(dt: number) {
    for (const u of this.units) {
      if (u.kind !== 'monster' || !u.alive) continue;
      u.animTime += dt;
      u.attackAnim = Math.max(0, u.attackAnim - dt * 3.4);
      const home = u.waypoints[0];
      const target = this.unit(u.targetId);
      const leashed = home ? dist(u.x, u.y, home.x, home.y) > 900 : false;

      if (leashed || !target || !target.alive || (home && dist(target.x, target.y, home.x, home.y) > 1100)) {
        u.targetId = 0;
        if (home && dist(u.x, u.y, home.x, home.y) > 40) {
          this.steerTo(u, home, dt);
          if (leashed) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.35 * dt);
        }
        if (!u.targetId) {
          const near = this.enemiesInRadius(u.team, u.x, u.y, 420, false).filter((e) => e.kind === 'hero' || e.kind === 'minion');
          if (near.length > 0) u.targetId = near[0].id;
        }
        continue;
      }

      const range = u.stats().attackRange + target.radius;
      if (dist(u.x, u.y, target.x, target.y) <= range) {
        this.tryAttack(u, target, dt);
      } else {
        this.steerTo(u, { x: target.x, y: target.y }, dt);
      }
    }
  }

  private updateStructures(dt: number) {
    for (const u of this.units) {
      if (u.kind !== 'tower' || !u.alive) continue;
      let target: Unit | null = this.unit(u.targetId) ?? null;
      const inRange = (t: Unit | null) => Boolean(t && t.alive && dist(u.x, u.y, t.x, t.y) <= TOWER_RANGE + t.radius && !t.hidden);

      if (!inRange(target)) {
        target = null;
        const candidates = this.enemiesInRadius(u.team, u.x, u.y, TOWER_RANGE, false).filter((e) => e.kind === 'minion' || e.kind === 'hero');
        const minions = candidates.filter((c) => c.kind === 'minion');
        const heroAggro = candidates.find(
          (c) => c.kind === 'hero' && c.lastCombatAt > this.time - 1.2 && this.alliesInRadius(u.team, c.x, c.y, 900, true).length > 0
        );
        target = heroAggro ?? minions[0] ?? candidates[0] ?? null;
        u.targetId = target ? target.id : 0;
        u.passiveState.rampUp = 0;
      }

      if (target) {
        u.passiveState.rampUp = Math.min(3, (u.passiveState.rampUp ?? 0) + dt * 0.35);
        this.tryAttack(u, target, dt, 1 + (u.passiveState.rampUp ?? 0) * 0.28);
      }
    }
  }

  private updateDash(u: Unit, dt: number) {
    if (!u.dash) return;
    const d = u.dash;
    d.elapsed += dt;
    const t = clamp(d.elapsed / d.duration, 0, 1);
    const nx = d.fromX + (d.toX - d.fromX) * t;
    const ny = d.fromY + (d.toY - d.fromY) * t;
    u.facing = angleTo(d.fromX, d.fromY, d.toX, d.toY);
    u.x = nx;
    u.y = ny;
    if (d.damage > 0 && d.radius > 0) {
      for (const e of this.enemiesInRadius(u.team, u.x, u.y, d.radius, false)) {
        if (d.hitIds.has(e.id)) continue;
        d.hitIds.add(e.id);
        this.dealDamage(u, e, d.damage, d.damageType, { skill: d.skillId });
      }
    }
    this.spawnParticles(u.x, u.y, 2, u.skin?.trail ?? '#ffffff', 'trail');
    if (t >= 1) u.dash = null;
  }

  private updateMovement(u: Unit, dt: number) {
    if (u.dash || u.rooted) return;
    if (u.moveTarget) {
      const speed = u.stats().moveSpeed;
      let goal = u.path.length > 0 ? u.path[0] : u.moveTarget;
      if (dist(u.x, u.y, goal.x, goal.y) < 42) {
        if (u.path.length > 0) {
          u.path.shift();
          goal = u.path.length > 0 ? u.path[0] : u.moveTarget;
        } else {
          u.moveTarget = null;
          return;
        }
      }
      const step = moveToward({ x: u.x, y: u.y }, goal, speed * dt);
      this.moveUnit(u, step.x, step.y);
      u.facing = angleTo(u.x, u.y, goal.x, goal.y);
    }
  }

  private moveUnit(u: Unit, nx: number, ny: number) {
    if (isWalkable(nx, ny)) {
      u.x = nx;
      u.y = ny;
    } else if (isWalkable(nx, u.y)) {
      u.x = nx;
    } else if (isWalkable(u.x, ny)) {
      u.y = ny;
    }
    u.x = clamp(u.x, 40, WORLD_SIZE - 40);
    u.y = clamp(u.y, 40, WORLD_SIZE - 40);

    for (const other of this.nearbyUnits(u.x, u.y, 140)) {
      if (other === u || !other.alive) continue;
      if (other.kind === 'ward') continue;
      const minDist = u.radius + other.radius;
      const d = dist(u.x, u.y, other.x, other.y);
      if (d < minDist && d > 0.001) {
        const push = (minDist - d) * (other.kind === 'tower' || other.kind === 'nexus' || other.kind === 'inhibitor' ? 1 : 0.5);
        const ax = (u.x - other.x) / d;
        const ay = (u.y - other.y) / d;
        const tx = u.x + ax * push;
        const ty = u.y + ay * push;
        if (isWalkable(tx, ty)) {
          u.x = tx;
          u.y = ty;
        }
      }
    }
  }

  steerTo(u: Unit, goal: Point, dt: number) {
    if (u.rooted || u.dash) return;
    const speed = u.stats().moveSpeed;
    if (hasLineOfWalk(u.x, u.y, goal.x, goal.y)) {
      const step = moveToward({ x: u.x, y: u.y }, goal, speed * dt);
      this.moveUnit(u, step.x, step.y);
      u.facing = angleTo(u.x, u.y, goal.x, goal.y);
      return;
    }
    const stale = u.path.length === 0 || dist(u.path[u.path.length - 1].x, u.path[u.path.length - 1].y, goal.x, goal.y) > 400;
    if (stale && this.time >= u.pathAt) {
      u.pathAt = this.time + 0.45;
      u.path = findPath({ x: u.x, y: u.y }, goal);
    }
    if (u.path.length > 0) {
      const next = u.path[0];
      if (dist(u.x, u.y, next.x, next.y) < 60) u.path.shift();
      const step = moveToward({ x: u.x, y: u.y }, next, speed * dt);
      this.moveUnit(u, step.x, step.y);
      u.facing = angleTo(u.x, u.y, next.x, next.y);
    }
  }

  private updateAutoAttack(u: Unit, dt: number) {
    const target = this.unit(u.targetId);
    if (!target || !target.alive || !this.isEnemy(u.team, target.team)) {
      if (u.attackMove && u.attackMovePoint) {
        const found = this.acquireTarget(u, u.stats().attackRange + 260);
        if (found) u.targetId = found.id;
      }
      return;
    }
    const range = u.stats().attackRange + target.radius + u.radius * 0.4;
    const d = dist(u.x, u.y, target.x, target.y);
    if (d <= range) {
      u.moveTarget = null;
      u.path.length = 0;
      this.tryAttack(u, target, dt);
    } else if (!u.holdPosition) {
      this.steerTo(u, { x: target.x, y: target.y }, dt);
    }
  }

  acquireTarget(u: Unit, radius: number): Unit | null {
    const candidates = this.enemiesInRadius(u.team, u.x, u.y, radius).filter(
      (e) =>
        !e.hidden &&
        e.kind !== 'ward' &&
        ((e.kind !== 'tower' && e.kind !== 'inhibitor' && e.kind !== 'nexus') || this.structureTargetable(e))
    );
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const pa = a.kind === 'hero' ? 0 : a.kind === 'minion' || a.kind === 'monster' ? 1 : 2;
      const pb = b.kind === 'hero' ? 0 : b.kind === 'minion' || b.kind === 'monster' ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return dist2(u.x, u.y, a.x, a.y) - dist2(u.x, u.y, b.x, b.y);
    });
    return candidates[0];
  }

  tryAttack(u: Unit, target: Unit, dt: number, multiplier = 1) {
    if (u.disabled || u.dash) return;
    u.facing = angleTo(u.x, u.y, target.x, target.y);
    if (this.time < u.attackReadyAt) return;
    const stats = u.stats();
    u.attackReadyAt = this.time + 1 / Math.max(0.15, stats.attackSpeed);
    u.attackAnim = 1;
    u.lastCombatAt = this.time;

    const isRanged = stats.attackRange > 280;
    const blinded = u.has('blind');
    const crit = !blinded && this.rng.chance(clamp(stats.critChance, 0, 1));
    let damage = stats.ad * multiplier * (blinded ? 0.15 : 1);
    if (crit) damage *= u.items.includes('infinity_claw') ? 2.1 : 1.75;

    if (isRanged) {
      this.spawnProjectile({
        owner: u,
        target,
        damage,
        damageType: 'physical',
        speed: u.kind === 'tower' ? 2200 : 1800,
        color: u.skin?.spellColor ?? '#ffe680',
        vfx: u.kind === 'tower' ? 'towerbolt' : 'basic',
        crit,
        basic: true
      });
    } else {
      this.dealDamage(u, target, damage, 'physical', { crit, basic: true, skill: 'attack' });
      this.addEffect('melee_hit', target.x, target.y, u.x, u.y, 40, u.skin?.spellColor ?? '#ffffff', 0.18);
    }
  }

  private applyPassives(u: Unit, dt: number) {
    if (!u.hero) return;
    const p = u.skills[0];
    if (!p) return;
    switch (u.heroId) {
      case 'bruno': {
        const missing = 1 - u.hpPercent;
        const bonus = missing * (14 + u.level * 2.2);
        if (Math.abs((u.passiveState.armorBonus ?? 0) - bonus) > 1) {
          u.base.armor = u.hero.stats.armor + u.hero.stats.armorPerLevel * (u.level - 1) + bonus;
          u.base.mr = u.hero.stats.mr + u.hero.stats.mrPerLevel * (u.level - 1) + bonus * 0.6;
          u.passiveState.armorBonus = bonus;
          u.markDirty();
        }
        break;
      }
      case 'shelly': {
        const still = u.moveTarget === null && !u.dash;
        const want = still ? 0.18 : 0;
        if ((u.passiveState.dr ?? 0) !== want) {
          u.statuses = u.statuses.filter((s) => s.label !== 'shellguard');
          if (want > 0) this.applyStatus(u, 'damageReduction', 0.4, want, u.id, 'shellguard');
          u.passiveState.dr = want;
        }
        break;
      }
      case 'koi': {
        if (this.time - u.lastCombatAt > 6) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.045 * dt);
        break;
      }
      case 'vex': {
        const prey = this.enemiesInRadius(u.team, u.x, u.y, 900, false).find((e) => e.kind === 'hero' && e.hpPercent < 0.5);
        const want = prey ? 0.22 : 0;
        if ((u.passiveState.scent ?? 0) !== want) {
          u.statuses = u.statuses.filter((s) => s.label !== 'bloodscent');
          if (want > 0) this.applyStatus(u, 'haste', 0.5, want, u.id, 'bloodscent');
          u.passiveState.scent = want;
        }
        break;
      }
      case 'nimbus': {
        u.passiveState.healTick = (u.passiveState.healTick ?? 0) + dt;
        if (u.passiveState.healTick >= 1) {
          u.passiveState.healTick = 0;
          const amount = p.def.healBase[0] + u.stats().ap * p.def.healApRatio;
          for (const ally of this.alliesInRadius(u.team, u.x, u.y, p.def.radius, true)) this.healUnit(u, ally, amount);
        }
        break;
      }
      case 'tank': {
        if (this.time - (u.passiveState.snoreAt ?? -99) > 9) {
          u.passiveState.snoreAt = this.time;
          this.applyStatus(u, 'shield', 5, p.def.shieldBase[Math.min(4, u.level - 1)] + u.level * 8, u.id, 'snorearmor');
        }
        break;
      }
      default:
        break;
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.homingTargetId) {
        const t = this.unit(p.homingTargetId);
        if (t && t.alive) {
          const a = angleTo(p.x, p.y, t.x, t.y);
          p.dirX = Math.cos(a);
          p.dirY = Math.sin(a);
        }
      }
      const step = p.speed * dt;
      p.x += p.dirX * step;
      p.y += p.dirY * step;
      p.traveled += step;

      if (p.vfx !== 'basic' && p.vfx !== 'towerbolt') this.spawnParticles(p.x, p.y, 1, p.color, 'trail');

      const owner = this.unit(p.ownerId);
      const hits = this.enemiesInRadius(p.team, p.x, p.y, p.radius, p.vfx !== 'basic');
      let consumed = false;
      for (const target of hits) {
        if (p.hitIds.has(target.id)) continue;
        if (p.homingTargetId && target.id !== p.homingTargetId && p.onHitBasicAttack) continue;
        if (target.kind === 'ward') continue;
        p.hitIds.add(target.id);
        this.dealDamage(owner ?? null, target, p.damage, p.damageType, {
          crit: p.critical,
          basic: p.onHitBasicAttack,
          skill: p.skill?.id ?? 'attack',
          skillDef: p.skill
        });
        if (p.skill && owner) this.applySkillStatus(owner, target, p.skill);
        this.addEffect('impact', p.x, p.y, 0, 0, p.radius * 1.2, p.color, 0.25);
        this.spawnParticles(p.x, p.y, 8, p.color, 'spark');
        if (!p.piercing || p.hitIds.size >= p.maxTargets) {
          consumed = true;
          break;
        }
      }

      if (consumed || p.traveled >= p.range) {
        if (p.skill && p.skill.radius > 0 && p.skill.shape === 'projectile' && owner) {
          this.explode(owner, p.x, p.y, p.skill, p.damage);
        }
        this.projectiles.splice(i, 1);
      }
    }
  }

  explode(owner: Unit, x: number, y: number, skill: SkillDef, damage: number) {
    this.addEffect('explosion', x, y, 0, 0, skill.radius, skill.color, 0.35);
    this.spawnParticles(x, y, 18, skill.color, 'spark');
    for (const target of this.enemiesInRadius(owner.team, x, y, skill.radius, false)) {
      this.dealDamage(owner, target, damage * 0.6, skill.damageType, { skill: skill.id, skillDef: skill });
      this.applySkillStatus(owner, target, skill);
    }
  }

  private updateZones(dt: number) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.rise = Math.min(1, z.rise + dt * 4);
      if (this.time >= z.expiresAt) {
        this.zones.splice(i, 1);
        continue;
      }
      const carrier = z.follow ? this.unit(z.ownerId) : null;
      if (carrier && carrier.alive) {
        z.x = carrier.x;
        z.y = carrier.y;
      }
      if (this.time < z.tickAt) continue;
      z.tickAt = this.time + z.tickInterval;
      const owner = this.unit(z.ownerId);
      if (z.friendly || z.allyBuff) {
        for (const ally of this.alliesInRadius(z.team, z.x, z.y, z.radius, true)) {
          if (z.heal > 0 && owner) this.healUnit(owner, ally, z.heal);
          if (z.allyBuff) this.applyStatus(ally, z.allyBuff.kind, z.allyBuff.duration, z.allyBuff.amount, z.ownerId, 'zonebuff');
        }
      }
      if (z.damage > 0 || z.slow > 0) {
        for (const target of this.enemiesInRadius(z.team, z.x, z.y, z.radius, false)) {
          if (z.damage > 0) this.dealDamage(owner ?? null, target, z.damage, z.damageType, { skill: z.skill?.id ?? 'zone', skillDef: z.skill });
          if (z.slow > 0) this.applyStatus(target, 'slow', z.tickInterval * 1.6, z.slow, z.ownerId, 'zone');
        }
      }
    }
  }

  private updateWards() {
    for (let i = this.wards.length - 1; i >= 0; i--) {
      if (this.time >= this.wards[i].expiresAt) this.wards.splice(i, 1);
    }
  }

  private updateRegen(dt: number) {
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.kind === 'hero' || u.kind === 'monster') {
        const s = u.stats();
        const combat = this.time - u.lastCombatAt < 5;
        const regenMul = combat ? 0.5 : 1;
        u.hp = Math.min(u.maxHp, u.hp + (s.hpRegen / 5) * regenMul * dt * 5);
        if (u.maxMp > 0) u.mp = Math.min(u.maxMp, u.mp + (s.mpRegen / 5) * dt * 5);
      }
    }
    if (this.time > PASSIVE_GOLD_START && this.time - this.lastPassiveGold >= 1) {
      this.lastPassiveGold = this.time;
      for (const h of this.heroes) {
        const mul = h.isPlayer ? 1 : DIFFICULTY_TUNING[this.difficulty].goldMul;
        const amount = PASSIVE_GOLD_RATE * mul;
        h.gold += amount;
        h.goldEarned += amount;
      }
    }
  }

  private computeVision() {
    this.visionSources.length = 0;
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.team === 'neutral') continue;
      this.visionSources.push({ x: u.x, y: u.y, r: u.visionRadius, team: u.team, inBrush: inBrush(u.x, u.y) });
    }
    for (const w of this.wards) this.visionSources.push({ x: w.x, y: w.y, r: w.radius, team: w.team, inBrush: inBrush(w.x, w.y) });

    this.visibleToPlayer.clear();
    const team = this.playerTeam;
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.team === team) {
        this.visibleToPlayer.add(u.id);
        continue;
      }
      if (u.kind === 'tower' || u.kind === 'nexus' || u.kind === 'inhibitor') {
        this.visibleToPlayer.add(u.id);
        continue;
      }
      const targetInBrush = inBrush(u.x, u.y);
      for (const src of this.visionSources) {
        if (src.team !== team) continue;
        const d = dist(src.x, src.y, u.x, u.y);
        if (d > src.r) continue;
        if (targetInBrush && d > 420 && !src.inBrush) continue;
        if (u.hidden && !u.has('revealed')) continue;
        this.visibleToPlayer.add(u.id);
        break;
      }
    }
  }

  visionSourcesFor(team: TeamSide) {
    return this.visionSources.filter((s) => s.team === team);
  }

  isVisible(u: Unit): boolean {
    return this.visibleToPlayer.has(u.id);
  }

  canSee(observerTeam: Team, target: Unit): boolean {
    if (target.team === observerTeam) return true;
    if (target.kind === 'tower' || target.kind === 'nexus' || target.kind === 'inhibitor') return true;
    if (target.hidden && !target.has('revealed')) return false;
    const targetInBrush = inBrush(target.x, target.y);
    for (const src of this.visionSources) {
      if (src.team !== observerTeam) continue;
      const d = dist(src.x, src.y, target.x, target.y);
      if (d > src.r) continue;
      if (targetInBrush && d > 420 && !src.inBrush) continue;
      return true;
    }
    return false;
  }

  private updateVisuals(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - p.fade * dt;
      p.vy *= 1 - p.fade * dt;
      p.rotation += p.spin * dt;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].life -= dt;
      if (this.effects[i].life <= 0) this.effects.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy += 40 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 9);
    if (this.killFeed.length > 8) this.killFeed.splice(0, this.killFeed.length - 8);
    this.announcements = this.announcements.filter((a) => this.time - a.at < a.duration);
  }

  get shake(): number {
    return this.shakeAmount;
  }

  addShake(amount: number) {
    this.shakeAmount = Math.min(28, this.shakeAmount + amount);
  }

  dealDamage(
    source: Unit | null,
    target: Unit,
    rawAmount: number,
    type: DamageType,
    opts: { crit?: boolean; basic?: boolean; skill?: string; silentSource?: boolean; skillDef?: SkillDef | null } = {}
  ) {
    if (!target.alive || rawAmount <= 0) return 0;
    if (target.has('invulnerable')) return 0;
    if ((target.kind === 'tower' || target.kind === 'inhibitor' || target.kind === 'nexus') && !this.structureTargetable(target)) return 0;

    const tStats = target.stats();
    let amount = rawAmount;

    if (source && source.kind === 'hero' && target.kind === 'monster' && source.items.some((i) => ITEM_BY_ID.get(i)?.passive === 'jungle_smite')) {
      amount *= 1.25;
    }
    if (source && (target.kind === 'tower' || target.kind === 'inhibitor' || target.kind === 'nexus')) {
      if (source.kind === 'hero' && source.items.includes('siege_catapult')) amount *= 1.6;
      if (source.kind === 'minion') amount *= 0.9;
    }

    if (type === 'physical') {
      const pen = source ? source.stats().armorPen : 0;
      const armor = Math.max(0, tStats.armor - pen);
      amount *= 100 / (100 + armor);
    } else if (type === 'magic') {
      const pen = source ? source.stats().magicPen : 0;
      const mr = Math.max(0, tStats.mr - pen);
      amount *= 100 / (100 + mr);
    }

    const dr = target.statusAmount('damageReduction');
    if (dr > 0) amount *= 1 - clamp(dr, 0, 0.8);

    if (source && source.kind === 'hero' && opts.skillDef && source.heroId === 'luna' && target.has('revealed')) amount *= 1.12;

    amount = Math.max(1, amount);

    let remaining = amount;
    for (const st of target.statuses) {
      if (st.kind !== 'shield' || st.amount <= 0) continue;
      const absorbed = Math.min(st.amount, remaining);
      st.amount -= absorbed;
      remaining -= absorbed;
      if (remaining <= 0) break;
    }
    target.statuses = target.statuses.filter((s) => s.kind !== 'shield' || s.amount > 0.5);

    target.hp -= remaining;
    target.damageTaken += amount;
    target.hurtAnim = 1;
    target.lastCombatAt = this.time;
    if (source) {
      source.lastCombatAt = this.time;
      source.damageDealt += amount;
      target.lastDamagedBy = source.id;
      if (source.kind === 'hero' && target.kind === 'hero') {
        target.assistCredit.set(source.id, this.time);
      }
      this.onDamageDealt(source, target, amount, type, opts);
    }

    if (target.kind === 'hero' && this.isVisible(target)) {
      this.addFloater(target.x, target.y - target.radius - 20, Math.round(amount).toString(), type === 'magic' ? '#a9c9ff' : type === 'true' ? '#ffffff' : '#ffd9a0', opts.crit ?? false);
    } else if (this.isVisible(target) && amount > 4) {
      this.addFloater(target.x, target.y - target.radius - 10, Math.round(amount).toString(), '#e6e6e6', false);
    }

    if (opts.crit) this.addShake(3);

    if (target.hp <= 0) this.killUnit(target, source);
    return amount;
  }

  private onDamageDealt(source: Unit, target: Unit, amount: number, type: DamageType, opts: { basic?: boolean; skillDef?: SkillDef | null }) {
    const stats = source.stats();
    if (opts.basic && stats.lifesteal > 0) this.healUnit(source, source, amount * stats.lifesteal, true);
    if (!opts.basic && opts.skillDef && stats.spellVamp > 0) this.healUnit(source, source, amount * stats.spellVamp, true);

    if (source.kind !== 'hero') return;

    for (const id of source.items) {
      const item = ITEM_BY_ID.get(id);
      if (!item) continue;
      switch (item.passive) {
        case 'burn_on_hit':
          if (item.id === 'emberheart_staff' && !opts.basic) this.applyStatus(target, 'burn', 3, 45, source.id, 'ember');
          break;
        case 'slow_on_hit':
          if (!opts.basic) this.applyStatus(target, 'slow', 1.5, 0.3, source.id, 'glacier');
          break;
        case 'reduce_healing':
          this.applyStatus(target, 'healcut', 3, 0.45, source.id, 'grievous');
          break;
        case 'shred_armor':
          if (opts.basic) {
            source.shredStacks = Math.min(5, source.shredStacks + 1);
            this.applyStatus(target, 'armorShred', 4, 0.06 * source.shredStacks, source.id, 'shred');
          }
          break;
        case 'thorns':
          break;
        default:
          break;
      }
    }

    if (opts.basic) {
      source.passiveState.hitCount = (source.passiveState.hitCount ?? 0) + 1;
      const count = source.passiveState.hitCount;
      if (source.items.includes('thunderfang') && count % 3 === 0) {
        const nearby = this.enemiesInRadius(source.team, target.x, target.y, 420, false).slice(0, 3);
        for (const e of nearby) {
          this.dealDamage(source, e, 60, 'magic', { skill: 'thunderfang' });
          this.addEffect('lightning', target.x, target.y, e.x, e.y, 12, '#8fe6ff', 0.2);
        }
      }
      if (source.items.includes('kraken_tooth') && count % 3 === 0) {
        this.dealDamage(source, target, target.hp * 0.12, 'true', { skill: 'kraken' });
      }
      if (source.items.includes('tempest_bow')) {
        for (const e of this.enemiesInRadius(source.team, target.x, target.y, 260, false)) {
          if (e.id === target.id) continue;
          this.dealDamage(source, e, amount * 0.4, 'physical', { skill: 'splash' });
        }
      }
      if (source.heroId === 'bolt') {
        const p = source.skills[0];
        if (count % 3 === 0) {
          const rank = Math.min(4, source.level - 1);
          this.dealDamage(source, target, p.def.baseDamage[Math.max(0, Math.min(4, rank))] + stats.ap * p.def.apRatio, 'magic', { skill: 'overcharge' });
          this.applyStatus(target, 'slow', 1, 0.2, source.id, 'overcharge');
          this.addEffect('arc', source.x, source.y, target.x, target.y, 10, '#8fe6ff', 0.22);
        }
      }
      if (source.heroId === 'rex' && target.hpPercent < 0.5) {
        const p = source.skills[0];
        const rank = Math.max(0, Math.min(4, source.level - 1));
        this.spawnProjectile({
          owner: source,
          target,
          damage: p.def.baseDamage[rank] + stats.ad * p.def.adRatio,
          damageType: 'physical',
          speed: 2000,
          color: '#7dffa8',
          vfx: 'feather',
          crit: false,
          basic: true
        });
      }
      if (source.heroId === 'quill') {
        const p = source.skills[0];
        const rank = Math.max(0, Math.min(4, source.level - 1));
        if (target.kind === 'hero' && dist(source.x, source.y, target.x, target.y) < 260) {
          this.dealDamage(source, target, p.def.baseDamage[rank], 'physical', { skill: 'barbs' });
        }
      }
    }

    if (target.kind === 'hero' && target.items.includes('thornmail_hide') && opts.basic && type === 'physical') {
      this.dealDamage(target, source, amount * 0.25, 'magic', { skill: 'thorns', silentSource: true });
      this.applyStatus(source, 'healcut', 3, 0.4, target.id, 'thorns');
    }
    if (target.kind === 'hero' && target.items.includes('aegis_of_dawn') && target.hpPercent < 0.3) {
      if (this.time - (target.passiveState.aegisAt ?? -999) > 90) {
        target.passiveState.aegisAt = this.time;
        this.applyStatus(target, 'shield', 4, 240 + target.maxHp * 0.15, target.id, 'aegis');
        this.addEffect('shieldburst', target.x, target.y, 0, 0, 160, '#a8e0ff', 0.5);
      }
    }
  }

  healUnit(source: Unit, target: Unit, amount: number, quiet = false): number {
    if (!target.alive || amount <= 0) return 0;
    const cut = target.statusAmount('healcut');
    let final = amount * (1 - clamp(cut, 0, 0.9));
    if (source.items.includes('lifebloom_censer')) final *= 1.2;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + final);
    const healed = target.hp - before;
    if (healed > 0) {
      if (source.kind === 'hero') source.healingDone += healed;
      if (!quiet && healed > 3 && this.isVisible(target)) {
        this.addFloater(target.x, target.y - target.radius - 26, `+${Math.round(healed)}`, '#7cffb0', false);
        this.spawnParticles(target.x, target.y, 5, '#7cffb0', 'glow');
      }
    }
    return healed;
  }

  applyStatus(target: Unit, kind: StatusKind, duration: number, amount: number, sourceId: number, label = '') {
    if (!target.alive) return;
    if (target.has('invulnerable') && kind !== 'shield' && kind !== 'haste') return;
    const cc: StatusKind[] = ['stun', 'root', 'silence', 'slow', 'fear', 'knockup'];
    let d = duration;
    if (cc.includes(kind)) {
      const ten = clamp(target.stats().tenacity, 0, 0.75);
      d *= 1 - ten;
      if (target.kind === 'nexus' || target.kind === 'tower' || target.kind === 'inhibitor') return;
    }
    const existing = target.statuses.find((s) => s.kind === kind && s.label === label && kind !== 'shield');
    if (existing) {
      existing.until = Math.max(existing.until, this.time + d);
      existing.amount = Math.max(existing.amount, amount);
    } else {
      const status: Status = { kind, until: this.time + d, amount, sourceId, tickAt: this.time, label };
      target.statuses.push(status);
    }
    target.markDirty();
  }

  applySkillStatus(source: Unit, target: Unit, skill: SkillDef) {
    const s = skill.status;
    if (!s) return;
    if (s.slow) this.applyStatus(target, 'slow', s.slow.duration, s.slow.amount, source.id, skill.id);
    if (s.stun) this.applyStatus(target, 'stun', s.stun, 1, source.id, skill.id);
    if (s.root) this.applyStatus(target, 'root', s.root, 1, source.id, skill.id);
    if (s.silence) this.applyStatus(target, 'silence', s.silence, 1, source.id, skill.id);
    if (s.blind) this.applyStatus(target, 'blind', s.blind, 1, source.id, skill.id);
    if (s.fear) this.applyStatus(target, 'fear', s.fear, 1, source.id, skill.id);
    if (s.mark) this.applyStatus(target, 'mark', s.mark, 1, source.id, skill.id);
    if (s.revealed) this.applyStatus(target, 'revealed', s.revealed, 1, source.id, skill.id);
    if (s.burn) this.applyStatus(target, 'burn', s.burn.duration, s.burn.dps, source.id, skill.id);
    if (s.poison) this.applyStatus(target, 'poison', s.poison.duration, s.poison.dps, source.id, skill.id);
    if (s.knockup) {
      this.applyStatus(target, 'knockup', s.knockup, 1, source.id, skill.id);
      this.addEffect('knockup', target.x, target.y, 0, 0, target.radius * 2, skill.color, s.knockup);
    }
    if (s.knockback) this.knockback(source, target, s.knockback);
    if (source.heroId === 'blaze') {
      const passive = source.skills[0].def;
      if (passive.status.burn) this.applyStatus(target, 'burn', passive.status.burn.duration, passive.status.burn.dps + source.level * 2, source.id, 'kindling');
    }
  }

  knockback(source: Unit, target: Unit, distance: number) {
    if (target.kind !== 'hero' && target.kind !== 'minion' && target.kind !== 'monster') return;
    const a = angleTo(source.x, source.y, target.x, target.y);
    const tx = target.x + Math.cos(a) * distance;
    const ty = target.y + Math.sin(a) * distance;
    const safe = nearestWalkable(tx, ty);
    target.dash = {
      fromX: target.x,
      fromY: target.y,
      toX: safe.x,
      toY: safe.y,
      elapsed: 0,
      duration: 0.22,
      skillId: 'knockback',
      hitIds: new Set(),
      radius: 0,
      damage: 0,
      damageType: 'physical'
    };
  }

  killUnit(victim: Unit, killer: Unit | null) {
    if (!victim.alive) return;
    victim.alive = false;
    victim.hp = 0;
    victim.deathAt = this.time;
    victim.statuses.length = 0;
    victim.path.length = 0;
    victim.moveTarget = null;
    victim.dash = null;
    victim.channel = null;
    victim.targetId = 0;

    this.spawnParticles(victim.x, victim.y, 22, victim.kind === 'hero' ? '#ffd9a0' : '#c9c9c9', 'shard');
    this.addEffect('death', victim.x, victim.y, 0, 0, victim.radius * 2.2, '#ffffff', 0.5);

    if (victim.kind === 'minion' || victim.kind === 'monster') {
      this.awardCreep(victim, killer);
      this.pendingRemoval.push(victim);
      if (victim.kind === 'monster' && victim.campId) {
        const spec = CAMPS.find((c) => c.id === victim.campId);
        const remaining = this.units.some((u) => u.alive && u.campId === victim.campId);
        if (spec && !remaining) {
          this.campRespawn.set(victim.campId, this.time + spec.respawn);
          if (spec.kind === 'drake' && killer) {
            const team = killer.team === 'neutral' ? this.playerTeam : (killer.team as TeamSide);
            this.drakeStacks[team]++;
            for (const h of this.heroes.filter((x) => x.team === team)) {
              h.bonusAd += 6;
              h.bonusAp += 9;
              h.markDirty();
            }
            this.announce('Rift Drake slain', `${team === 'blue' ? 'Blue' : 'Red'} team claims the drake`, team === this.playerTeam ? 'good' : 'bad', 4);
          }
          if (spec.kind === 'ancient' && killer) {
            const team = killer.team === 'neutral' ? this.playerTeam : (killer.team as TeamSide);
            for (const h of this.heroes.filter((x) => x.team === team && x.alive)) {
              this.applyStatus(h, 'buffAd', 150, 40, h.id, 'ancient');
              this.applyStatus(h, 'buffAp', 150, 55, h.id, 'ancient');
            }
            this.announce('Ancient Beast slain', 'Empowered minions march', team === this.playerTeam ? 'good' : 'bad', 5);
          }
        }
      }
      return;
    }

    if (victim.kind === 'tower' || victim.kind === 'inhibitor' || victim.kind === 'nexus') {
      this.onStructureDown(victim, killer);
      return;
    }

    if (victim.kind === 'hero') this.onHeroDeath(victim, killer);
  }

  private awardCreep(victim: Unit, killer: Unit | null) {
    const gold = victim.goldShare;
    const xp = victim.kind === 'monster' ? gold * 1.4 : victim.name.includes('Caster') ? 32 : victim.name.includes('Siege') ? 95 : 62;

    if (killer && killer.kind === 'hero') {
      killer.gold += gold;
      killer.goldEarned += gold;
      killer.cs += 1;
      if (killer.items.some((i) => ITEM_BY_ID.get(i)?.passive === 'gold_per_minion')) {
        killer.gold += 3;
        killer.goldEarned += 3;
      }
      if (this.isVisible(victim)) this.addFloater(victim.x, victim.y - 30, `+${Math.round(gold)}`, '#ffd24a', false);
    }

    const nearby = this.heroes.filter((h) => h.alive && dist(h.x, h.y, victim.x, victim.y) < 1250 && h.team !== 'neutral');
    for (const team of ['blue', 'red'] as TeamSide[]) {
      const share = nearby.filter((h) => h.team === team);
      if (share.length === 0) continue;
      const per = xp / share.length;
      for (const h of share) this.grantXp(h, per);
    }
  }

  grantXp(hero: Unit, amount: number) {
    if (hero.level >= MAX_LEVEL) return;
    hero.xp += amount;
    while (hero.level < MAX_LEVEL && hero.xp >= XP_PER_LEVEL(hero.level)) {
      hero.xp -= XP_PER_LEVEL(hero.level);
      hero.applyLevel(hero.level + 1);
      hero.skillPoints += 1;
      hero.hp = Math.min(hero.maxHp, hero.hp + hero.hero!.stats.hpPerLevel);
      hero.mp = Math.min(hero.maxMp, hero.mp + hero.hero!.stats.manaPerLevel);
      this.addEffect('levelup', hero.x, hero.y, 0, 0, 120, '#ffd24a', 0.9);
      this.spawnParticles(hero.x, hero.y, 16, '#ffd24a', 'glow');
      if (hero.ai) this.autoLevelSkill(hero);
    }
  }

  autoLevelSkill(hero: Unit) {
    while (hero.skillPoints > 0) {
      const order = ['Q', 'W', 'E'];
      const ultIndex = hero.skills.findIndex((s) => s.def.key === 'R');
      if (ultIndex >= 0 && this.canLevelSkill(hero, ultIndex)) {
        this.levelSkill(hero, ultIndex);
        continue;
      }
      let chosen = -1;
      let lowest = 99;
      for (const key of order) {
        const idx = hero.skills.findIndex((s) => s.def.key === key);
        if (idx < 0) continue;
        if (!this.canLevelSkill(hero, idx)) continue;
        if (hero.skills[idx].rank < lowest) {
          lowest = hero.skills[idx].rank;
          chosen = idx;
        }
      }
      if (chosen < 0) break;
      this.levelSkill(hero, chosen);
    }
  }

  canLevelSkill(hero: Unit, index: number): boolean {
    const s = hero.skills[index];
    if (!s || s.def.key === 'P') return false;
    if (hero.skillPoints <= 0) return false;
    if (s.def.key === 'R') {
      const maxRank = hero.level >= 16 ? 3 : hero.level >= 11 ? 2 : hero.level >= 6 ? 1 : 0;
      return s.rank < maxRank;
    }
    const maxRank = Math.min(5, Math.ceil(hero.level / 2) + 1);
    return s.rank < Math.min(5, maxRank);
  }

  levelSkill(hero: Unit, index: number) {
    if (!this.canLevelSkill(hero, index)) return;
    hero.skills[index].rank += 1;
    hero.skillPoints -= 1;
    this.addEffect('skillup', hero.x, hero.y, 0, 0, 90, '#7cd8ff', 0.6);
  }

  private onHeroDeath(victim: Unit, killer: Unit | null) {
    victim.deaths += 1;
    victim.killStreak = 0;
    const respawnTime = 6 + victim.level * 2.4 + (this.time > 900 ? 6 : 0);
    victim.respawnAt = this.time + respawnTime;

    const assisters = this.heroes.filter(
      (h) => h.id !== victim.id && h.team === (killer?.team ?? 'neutral') && victim.assistCredit.has(h.id) && this.time - (victim.assistCredit.get(h.id) ?? -99) < 10
    );
    victim.assistCredit.clear();

    if (killer && killer.kind === 'hero') {
      killer.kills += 1;
      killer.killStreak += 1;
      const streakBonus = clamp(victim.killStreak * 30, 0, 300);
      const gold = 300 + streakBonus;
      killer.gold += gold;
      killer.goldEarned += gold;
      this.kills[killer.team as TeamSide] += 1;
      this.grantXp(killer, 180 + victim.level * 14);
      this.addFloater(victim.x, victim.y - 60, `+${gold}`, '#ffd24a', true);

      if (this.time - killer.lastKillAt < 11) killer.multiKillCount += 1;
      else killer.multiKillCount = 1;
      killer.lastKillAt = this.time;
      killer.largestMultikill = Math.max(killer.largestMultikill, killer.multiKillCount);

      const names = ['', 'Takedown', 'Double Kill', 'Triple Kill', 'Quadra Kill', 'Penta Kill'];
      if (killer.multiKillCount >= 2) {
        this.announce(names[Math.min(5, killer.multiKillCount)], killer.name, killer.team === this.playerTeam ? 'good' : 'bad', 3);
        this.addShake(10);
      }
      if (killer.killStreak === 3) this.announce('Killing Spree', killer.name, killer.team === this.playerTeam ? 'good' : 'bad', 2.5);
      if (killer.killStreak === 5) this.announce('Unstoppable', killer.name, killer.team === this.playerTeam ? 'good' : 'bad', 3);
      if (killer.killStreak >= 7) this.announce('Legendary', killer.name, killer.team === this.playerTeam ? 'good' : 'bad', 3);

      if (killer.heroId === 'mochi') {
        const p = killer.skills[0].def;
        const rank = Math.max(0, Math.min(4, killer.level - 1));
        this.healUnit(killer, killer, p.healBase[rank] + killer.level * 12);
        const pounce = killer.skills.findIndex((s) => s.def.key === 'E');
        if (pounce >= 0) killer.skills[pounce].cooldownUntil = 0;
      }
      if (killer.items.includes('bloodmoon_edge')) {
        this.healUnit(killer, killer, killer.maxHp * 0.12);
        this.applyStatus(killer, 'haste', 4, 0.1, killer.id, 'bloodmoon');
      }
      if (killer.items.includes('soul_harvester') && killer.stackKills < 10) {
        killer.stackKills += 1;
        killer.bonusAp += 8;
        killer.markDirty();
      }
    } else {
      this.kills[victim.team === 'blue' ? 'red' : 'blue'] += 1;
    }

    for (const a of assisters) {
      a.assists += 1;
      const gold = 150;
      a.gold += gold;
      a.goldEarned += gold;
      this.grantXp(a, 110 + victim.level * 8);
    }

    this.killFeed.push({
      killer: killer?.name ?? 'The Rift',
      killerHero: killer?.heroId ?? '',
      victim: victim.name,
      victimHero: victim.heroId,
      killerTeam: killer?.team ?? 'neutral',
      assists: assisters.length,
      at: this.time,
      isTower: killer?.kind === 'tower'
    });

    this.addShake(8);
    this.addEffect('herodeath', victim.x, victim.y, 0, 0, 200, '#ff6a6a', 1);
  }

  private onStructureDown(victim: Unit, killer: Unit | null) {
    const enemyTeam: TeamSide = victim.team === 'blue' ? 'red' : 'blue';
    this.addShake(16);
    this.spawnParticles(victim.x, victim.y, 40, '#ffd9a0', 'shard');
    this.addEffect('structuredown', victim.x, victim.y, 0, 0, 320, '#ffb347', 1.2);

    if (victim.kind === 'tower') {
      this.towerKills[enemyTeam] += 1;
      if (killer && killer.kind === 'hero') {
        killer.turretsDestroyed += 1;
        killer.gold += 250;
        killer.goldEarned += 250;
      }
      for (const h of this.heroes.filter((x) => x.team === enemyTeam)) {
        h.gold += 110;
        h.goldEarned += 110;
      }
      this.announce('Turret destroyed', `${enemyTeam === this.playerTeam ? 'Your team' : 'Enemy team'} takes a turret`, enemyTeam === this.playerTeam ? 'good' : 'bad', 2.6);
      this.killFeed.push({
        killer: killer?.name ?? 'Minions',
        killerHero: killer?.heroId ?? '',
        victim: 'Turret',
        victimHero: '',
        killerTeam: enemyTeam,
        assists: 0,
        at: this.time,
        isTower: true
      });
    } else if (victim.kind === 'inhibitor') {
      this.inhibitorDown[victim.team === 'red' ? 'red' : 'blue'] += 1;
      this.announce('Inhibitor destroyed', 'Super minions incoming', enemyTeam === this.playerTeam ? 'good' : 'bad', 3.2);
    } else if (victim.kind === 'nexus') {
      this.finished = true;
      this.winner = enemyTeam;
      this.announce(enemyTeam === this.playerTeam ? 'VICTORY' : 'DEFEAT', 'The Nexus has fallen', enemyTeam === this.playerTeam ? 'epic' : 'bad', 12);
    }
  }

  private checkVictory() {
    if (this.finished) return;
    for (const team of ['blue', 'red'] as TeamSide[]) {
      const nexus = this.units.find((u) => u.kind === 'nexus' && u.team === team);
      if (!nexus || !nexus.alive) {
        this.finished = true;
        this.winner = team === 'blue' ? 'red' : 'blue';
        return;
      }
    }
  }

  structureTargetable(structure: Unit): boolean {
    if (structure.kind === 'tower') {
      if (structure.laneIndex === 5) {
        return this.inhibitorDown[structure.team === 'red' ? 'red' : 'blue'] > 0;
      }
      const lane = structure.lane;
      const same = this.units.filter(
        (u) => u.kind === 'tower' && u.team === structure.team && u.lane === lane && u.alive && u.laneIndex < 5
      );
      const ahead = same.filter((u) => u.laneIndex < structure.laneIndex);
      return ahead.length === 0;
    }
    if (structure.kind === 'inhibitor') {
      const t3 = this.units.find((u) => u.kind === 'tower' && u.team === structure.team && u.lane === structure.lane && u.laneIndex === 3);
      return !t3 || !t3.alive;
    }
    if (structure.kind === 'nexus') {
      const guards = this.units.filter((u) => u.kind === 'tower' && u.team === structure.team && u.laneIndex === 5);
      return guards.every((g) => !g.alive);
    }
    return true;
  }

  spawnProjectile(opts: {
    owner: Unit;
    target?: Unit | null;
    dir?: number;
    damage: number;
    damageType: DamageType;
    speed: number;
    color: string;
    vfx: string;
    crit?: boolean;
    basic?: boolean;
    skill?: SkillDef | null;
    range?: number;
    radius?: number;
    piercing?: boolean;
    maxTargets?: number;
    scale?: number;
  }) {
    const { owner } = opts;
    const angle = opts.target ? angleTo(owner.x, owner.y, opts.target.x, opts.target.y) : (opts.dir ?? owner.facing);
    const p: Projectile = {
      id: this.nextProjectileId++,
      ownerId: owner.id,
      team: owner.team,
      x: owner.x + Math.cos(angle) * owner.radius,
      y: owner.y + Math.sin(angle) * owner.radius,
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
      speed: opts.speed,
      radius: opts.radius ?? (opts.basic ? 26 : 44),
      range: opts.range ?? (opts.target ? dist(owner.x, owner.y, opts.target.x, opts.target.y) + 300 : 900),
      traveled: 0,
      damage: opts.damage,
      damageType: opts.damageType,
      skill: opts.skill ?? null,
      color: opts.color,
      vfx: opts.vfx,
      piercing: opts.piercing ?? false,
      maxTargets: opts.maxTargets ?? 1,
      hitIds: new Set(),
      homingTargetId: opts.basic && opts.target ? opts.target.id : 0,
      onHitBasicAttack: opts.basic ?? false,
      critical: opts.crit ?? false,
      scale: opts.scale ?? 1
    };
    this.projectiles.push(p);
  }

  spawnZone(opts: {
    owner: Unit;
    x: number;
    y: number;
    radius: number;
    duration: number;
    damage: number;
    damageType: DamageType;
    heal?: number;
    skill?: SkillDef | null;
    color: string;
    vfx: string;
    slow?: number;
    friendly?: boolean;
    tickInterval?: number;
    follow?: boolean;
    allyBuff?: Zone['allyBuff'];
  }) {
    const z: Zone = {
      id: this.nextZoneId++,
      ownerId: opts.owner.id,
      team: opts.owner.team,
      x: opts.x,
      y: opts.y,
      radius: opts.radius,
      expiresAt: this.time + opts.duration,
      tickAt: this.time + 0.1,
      tickInterval: opts.tickInterval ?? 0.5,
      damage: opts.damage,
      damageType: opts.damageType,
      heal: opts.heal ?? 0,
      skill: opts.skill ?? null,
      color: opts.color,
      vfx: opts.vfx,
      slow: opts.slow ?? 0,
      friendly: opts.friendly ?? false,
      createdAt: this.time,
      rise: 0,
      follow: opts.follow ?? false,
      allyBuff: opts.allyBuff ?? null
    };
    this.zones.push(z);
  }

  placeWard(owner: Unit, x: number, y: number, duration = 90) {
    const safe = nearestWalkable(x, y);
    this.wards.push({ id: this.nextZoneId++, team: owner.team, x: safe.x, y: safe.y, expiresAt: this.time + duration, radius: 950 });
    this.addEffect('ward', safe.x, safe.y, 0, 0, 60, '#ffe680', 0.6);
  }

  addEffect(kind: string, x: number, y: number, x2: number, y2: number, radius: number, color: string, life: number, angle = 0, width = 0, ownerId = 0) {
    this.effects.push({ kind, x, y, x2, y2, radius, angle, width, color, life, maxLife: life, ownerId });
  }

  addFloater(x: number, y: number, text: string, color: string, crit: boolean) {
    this.floaters.push({ x: x + this.rng.range(-14, 14), y, vy: -58, text, color, life: 1.05, maxLife: 1.05, size: crit ? 26 : 18, crit });
  }

  spawnParticles(x: number, y: number, count: number, color: string, kind: Particle['kind']) {
    if (this.particles.length > 1400) return;
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(40, 260);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: this.rng.range(0.25, 0.75),
        maxLife: 0.75,
        size: this.rng.range(2, 6),
        color,
        kind,
        spin: this.rng.range(-6, 6),
        rotation: this.rng.range(0, Math.PI * 2),
        gravity: kind === 'shard' ? 320 : kind === 'bubble' ? -60 : 0,
        fade: 2.4
      });
    }
  }

  announce(text: string, sub: string, tone: Announcement['tone'], duration: number) {
    this.announcements.push({ text, sub, at: this.time, duration, tone });
  }

  castSkill(unit: Unit, index: number, point: Point, targetId = 0): boolean {
    return executeSkill(this, unit, index, point, targetId);
  }

  castSpell(unit: Unit, index: number, point: Point): boolean {
    const slot = unit.spells[index];
    if (!slot || this.time < slot.cooldownUntil || !unit.alive) return false;
    const def = SPELL_BY_ID.get(slot.id);
    if (!def) return false;
    const stats = unit.stats();

    switch (slot.id) {
      case 'flash': {
        const a = angleTo(unit.x, unit.y, point.x, point.y);
        const d = Math.min(def.range, dist(unit.x, unit.y, point.x, point.y));
        const dest = nearestWalkable(unit.x + Math.cos(a) * d, unit.y + Math.sin(a) * d);
        this.addEffect('blink', unit.x, unit.y, dest.x, dest.y, 60, '#ffe680', 0.35);
        unit.x = dest.x;
        unit.y = dest.y;
        unit.path.length = 0;
        unit.moveTarget = null;
        break;
      }
      case 'ignite': {
        const target = this.enemiesInRadius(unit.team, point.x, point.y, 220, false).find((e) => e.kind === 'hero');
        if (!target) return false;
        this.applyStatus(target, 'burn', 5, 24 + unit.level * 5, unit.id, 'ignite');
        this.applyStatus(target, 'healcut', 5, 0.5, unit.id, 'ignite');
        this.applyStatus(target, 'revealed', 5, 1, unit.id, 'ignite');
        this.addEffect('ignite', target.x, target.y, 0, 0, 70, '#ff6a2c', 0.6);
        break;
      }
      case 'heal': {
        const amount = 120 + unit.level * 28;
        this.healUnit(unit, unit, amount);
        const ally = this.alliesInRadius(unit.team, unit.x, unit.y, def.range, true).filter((a) => a.id !== unit.id)[0];
        if (ally) {
          this.healUnit(unit, ally, amount);
          this.applyStatus(ally, 'haste', 2, 0.3, unit.id, 'heal');
        }
        this.applyStatus(unit, 'haste', 2, 0.3, unit.id, 'heal');
        break;
      }
      case 'sprint':
        this.applyStatus(unit, 'haste', 4, 0.45, unit.id, 'sprint');
        break;
      case 'barrier':
        this.applyStatus(unit, 'shield', 3, 160 + unit.level * 30, unit.id, 'barrier');
        this.addEffect('shieldburst', unit.x, unit.y, 0, 0, 120, '#ffd24a', 0.4);
        break;
      case 'smite': {
        const target = this.enemiesInRadius(unit.team, point.x, point.y, 260, false).find((e) => e.kind === 'monster' || e.kind === 'minion');
        if (!target) return false;
        this.dealDamage(unit, target, 600, 'true', { skill: 'smite' });
        break;
      }
      case 'cleanse':
        unit.statuses = unit.statuses.filter((s) => !['stun', 'root', 'silence', 'slow', 'fear', 'blind'].includes(s.kind));
        unit.markDirty();
        break;
      case 'teleport': {
        unit.channel = {
          skillId: 'teleport',
          remaining: 3,
          total: 3,
          interruptible: true,
          label: 'Recall Surge',
          onComplete: () => {
            const dest = nearestWalkable(point.x, point.y);
            unit.x = dest.x;
            unit.y = dest.y;
            this.addEffect('blink', unit.x, unit.y, dest.x, dest.y, 100, '#a06bff', 0.5);
          }
        };
        break;
      }
      default:
        return false;
    }

    slot.cooldownUntil = this.time + def.cooldown * (1 - clamp(stats.abilityHaste / (stats.abilityHaste + 100), 0, 0.5));
    unit.castAnim = 1;
    return true;
  }

  useItem(unit: Unit, slot: number, point: Point): boolean {
    const id = unit.items[slot];
    if (!id) return false;
    const item = ITEM_BY_ID.get(id);
    if (!item || item.active === 'none') return false;
    const key = `item_${slot}`;
    if (this.time < (unit.passiveState[key] ?? 0)) return false;
    unit.passiveState[key] = this.time + item.activeCooldown;

    switch (item.active) {
      case 'heal_burst':
        if (item.id === 'mana_treat') unit.mp = Math.min(unit.maxMp, unit.mp + 120);
        else if (item.id === 'health_treat') this.healUnit(unit, unit, 160);
        else for (const a of this.alliesInRadius(unit.team, unit.x, unit.y, 600, true)) this.healUnit(unit, a, 260);
        break;
      case 'stasis':
        this.applyStatus(unit, 'invulnerable', 2.5, 1, unit.id, 'stasis');
        this.applyStatus(unit, 'stun', 2.5, 1, unit.id, 'stasis');
        this.addEffect('stasis', unit.x, unit.y, 0, 0, 120, '#ffe680', 2.5);
        break;
      case 'cleanse':
        unit.statuses = unit.statuses.filter((s) => !['stun', 'root', 'silence', 'slow', 'fear', 'blind'].includes(s.kind));
        this.applyStatus(unit, 'haste', 2, 0.3, unit.id, 'quicksilver');
        unit.markDirty();
        break;
      case 'shield_ally': {
        const ally = this.alliesInRadius(unit.team, point.x, point.y, 400, true)[0] ?? unit;
        this.applyStatus(ally, 'shield', 3, 280, unit.id, 'mantle');
        this.addEffect('shieldburst', ally.x, ally.y, 0, 0, 120, '#7cffb0', 0.5);
        break;
      }
      case 'speed_boost':
        if (item.id === 'elixir_of_might') {
          this.applyStatus(unit, 'buffAd', 180, 30, unit.id, 'elixir');
          this.applyStatus(unit, 'buffAp', 180, 50, unit.id, 'elixir');
        } else {
          for (const a of this.alliesInRadius(unit.team, unit.x, unit.y, 700, true)) this.applyStatus(a, 'haste', 3, 0.4, unit.id, 'zephyr');
        }
        break;
      case 'ward':
        this.placeWard(unit, point.x, point.y, item.id === 'watcher_seed' ? 60 : 90);
        break;
      case 'smite': {
        const target = this.enemiesInRadius(unit.team, point.x, point.y, 300, false)[0];
        if (!target) return false;
        if (target.kind === 'hero') {
          this.dealDamage(unit, target, 240, 'true', { skill: 'smite' });
          this.applyStatus(target, 'stun', 0.8, 1, unit.id, 'smite');
        } else {
          this.dealDamage(unit, target, item.id === 'primal_tusk' ? 900 : 600, 'true', { skill: 'smite' });
        }
        break;
      }
      default:
        return false;
    }

    if (item.slot === 'consumable') {
      unit.items.splice(slot, 1);
      unit.markDirty();
    }
    return true;
  }

  canShop(unit: Unit): boolean {
    const shop = unit.team === 'blue' ? BLUE_SHOP : RED_SHOP;
    return unit.alive && dist(unit.x, unit.y, shop.x, shop.y) < 1250;
  }

  buyItem(unit: Unit, item: ItemDef): { ok: boolean; message: string } {
    if (!this.canShop(unit)) return { ok: false, message: 'Return to base to shop' };
    const consumables = unit.items.filter((i) => ITEM_BY_ID.get(i)?.slot === 'consumable').length;
    const nonConsumables = unit.items.length - consumables;
    if (item.slot !== 'consumable' && nonConsumables >= 6) return { ok: false, message: 'Inventory full' };
    if (unit.items.length >= 7) return { ok: false, message: 'Inventory full' };

    const owned = item.buildsFrom.filter((id) => unit.items.includes(id));
    const refund = owned.reduce((sum, id) => sum + (ITEM_BY_ID.get(id)?.cost ?? 0), 0);
    const price = Math.max(0, item.cost - refund);
    if (unit.gold < price) return { ok: false, message: 'Not enough gold' };

    unit.gold -= price;
    for (const id of owned) {
      const idx = unit.items.indexOf(id);
      if (idx >= 0) unit.items.splice(idx, 1);
    }
    unit.items.push(item.id);
    unit.markDirty();
    unit.hp = Math.min(unit.maxHp, unit.hp + (item.stats.hp ?? 0));
    return { ok: true, message: `${item.name} purchased` };
  }

  sellItem(unit: Unit, slot: number): boolean {
    if (!this.canShop(unit)) return false;
    const id = unit.items[slot];
    const item = ITEM_BY_ID.get(id);
    if (!item) return false;
    unit.gold += Math.floor(item.cost * 0.7);
    unit.items.splice(slot, 1);
    unit.markDirty();
    return true;
  }

  startRecall(unit: Unit) {
    if (!unit.alive || unit.channel) return;
    if (this.enemiesInRadius(unit.team, unit.x, unit.y, 900, false).some((e) => e.kind === 'hero')) {
      this.announce('Cannot recall', 'Enemies are nearby', 'bad', 1.6);
      return;
    }
    unit.moveTarget = null;
    unit.path.length = 0;
    unit.channel = {
      skillId: 'recall',
      remaining: 7,
      total: 7,
      interruptible: true,
      label: 'Recalling',
      onComplete: () => {
        const spawn = unit.team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
        unit.x = spawn.x;
        unit.y = spawn.y;
        unit.hp = unit.maxHp;
        unit.mp = unit.maxMp;
        this.addEffect('blink', unit.x, unit.y, unit.x, unit.y, 140, '#7cd8ff', 0.6);
      }
    };
  }

  botBuyItems(unit: Unit) {
    if (!unit.ai) return;
    const build = RECOMMENDED_BUILDS[unit.heroId] ?? [];
    while (unit.ai.buildIndex < build.length) {
      const item = ITEM_BY_ID.get(build[unit.ai.buildIndex]);
      if (!item) {
        unit.ai.buildIndex++;
        continue;
      }
      if (unit.items.length >= 6) return;
      const owned = item.buildsFrom.filter((id) => unit.items.includes(id));
      const refund = owned.reduce((sum, id) => sum + (ITEM_BY_ID.get(id)?.cost ?? 0), 0);
      const price = Math.max(0, item.cost - refund);
      if (unit.gold < price) return;
      unit.gold -= price;
      for (const id of owned) {
        const idx = unit.items.indexOf(id);
        if (idx >= 0) unit.items.splice(idx, 1);
      }
      unit.items.push(item.id);
      unit.markDirty();
      unit.ai.buildIndex++;
    }
  }

  score(): ScoreEntry[] {
    return this.heroes
      .map((h) => ({
        slot: h.slot,
        team: h.team as TeamSide,
        heroId: h.heroId,
        skinId: h.skinId,
        name: h.name,
        isBot: !h.isPlayer,
        botDifficulty: h.isPlayer ? null : this.difficulty,
        kills: h.kills,
        deaths: h.deaths,
        assists: h.assists,
        cs: h.cs,
        gold: Math.round(h.gold),
        goldEarned: Math.round(h.goldEarned),
        level: h.level,
        damageDealt: Math.round(h.damageDealt),
        damageTaken: Math.round(h.damageTaken),
        healingDone: Math.round(h.healingDone),
        turretsDestroyed: h.turretsDestroyed,
        largestMultikill: h.largestMultikill,
        items: [...h.items],
        unitId: h.id
      }))
      .sort((a, b) => a.slot - b.slot);
  }

  surrender() {
    if (this.finished) return;
    this.finished = true;
    this.surrendered = true;
    this.winner = this.playerTeam === 'blue' ? 'red' : 'blue';
    this.announce('DEFEAT', 'Your team surrendered', 'bad', 10);
  }

  skillCooldownRemaining(unit: Unit, index: number): number {
    const s = unit.skills[index];
    if (!s) return 0;
    return Math.max(0, s.cooldownUntil - this.time);
  }

  skillReady(unit: Unit, index: number): boolean {
    const s = unit.skills[index];
    if (!s || s.rank === 0 || s.def.key === 'P') return false;
    if (this.time < s.cooldownUntil) return false;
    return unit.mp >= skillManaCost(unit, s);
  }

  skillTotalCooldown(unit: Unit, index: number): number {
    const s = unit.skills[index];
    if (!s) return 1;
    return skillCooldown(unit, s);
  }

  spellCooldownRemaining(unit: Unit, index: number): number {
    const s = unit.spells[index];
    if (!s) return 0;
    return Math.max(0, s.cooldownUntil - this.time);
  }

  rankOf(unit: Unit, index: number): number {
    return skillRankIndex(unit.skills[index]);
  }
}

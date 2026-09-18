import type { Point } from '../core/math';
import { clamp } from '../core/math';
import { getHero, getSkin } from '../data/heroes';
import { ITEM_BY_ID } from '../data/items';
import type { HeroDef, SkinDef } from '../data/types';
import {
  emptyStats,
  type AiState,
  type Channel,
  type Dash,
  type SkillState,
  type SpellState,
  type Stats,
  type Status,
  type StatusKind,
  type Team,
  type UnitKind
} from './types';

let nextId = 1;

export class Unit {
  id = nextId++;
  kind: UnitKind = 'minion';
  team: Team = 'neutral';
  name = 'Unit';
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing = 0;
  radius = 26;
  hp = 100;
  mp = 0;
  alive = true;
  respawnAt = 0;
  deathAt = 0;
  level = 1;
  xp = 0;
  skillPoints = 0;
  gold = 500;
  goldEarned = 0;
  cs = 0;
  kills = 0;
  deaths = 0;
  assists = 0;
  turretsDestroyed = 0;
  damageDealt = 0;
  damageTaken = 0;
  healingDone = 0;
  largestMultikill = 0;
  killStreak = 0;
  multiKillCount = 0;
  lastKillAt = -99;
  base: Stats = emptyStats();
  statuses: Status[] = [];
  items: string[] = [];
  skills: SkillState[] = [];
  spells: SpellState[] = [];
  attackReadyAt = 0;
  windupUntil = 0;
  windupTargetId = 0;
  path: Point[] = [];
  pathAt = 0;
  moveTarget: Point | null = null;
  holdPosition = false;
  attackMove = false;
  attackMovePoint: Point | null = null;
  targetId = 0;
  dash: Dash | null = null;
  channel: Channel | null = null;
  heroId = '';
  skinId = '';
  hero: HeroDef | null = null;
  skin: SkinDef | null = null;
  ai: AiState | null = null;
  isPlayer = false;
  slot = -1;
  laneIndex = 0;
  lane: 'top' | 'mid' | 'bot' | 'jungle' | 'support' = 'mid';
  waypoints: Point[] = [];
  waypointIndex = 0;
  campId = '';
  structureId = '';
  visionRadius = 1200;
  animTime = 0;
  attackAnim = 0;
  castAnim = 0;
  hurtAnim = 0;
  spawnAnim = 0;
  recallProgress = 0;
  goldShare = 0;
  lastCombatAt = -99;
  lastDamagedBy = 0;
  assistCredit = new Map<number, number>();
  passiveState: Record<string, number> = {};
  bonusAd = 0;
  bonusAp = 0;
  shredStacks = 0;
  stackKills = 0;
  cachedStats: Stats = emptyStats();
  statsDirty = true;
  goldPerSecond = 0;
  scale = 1;

  static reset() {
    nextId = 1;
  }

  get maxHp(): number {
    return this.stats().hp;
  }

  get maxMp(): number {
    return this.stats().mp;
  }

  stats(): Stats {
    if (!this.statsDirty) return this.cachedStats;
    const s = emptyStats();
    const b = this.base;
    s.hp = b.hp;
    s.mp = b.mp;
    s.ad = b.ad + this.bonusAd;
    s.ap = b.ap + this.bonusAp;
    s.armor = b.armor;
    s.mr = b.mr;
    s.attackSpeed = b.attackSpeed;
    s.critChance = b.critChance;
    s.lifesteal = b.lifesteal;
    s.spellVamp = b.spellVamp;
    s.abilityHaste = b.abilityHaste;
    s.moveSpeed = b.moveSpeed;
    s.moveSpeedPct = b.moveSpeedPct;
    s.armorPen = b.armorPen;
    s.magicPen = b.magicPen;
    s.hpRegen = b.hpRegen;
    s.mpRegen = b.mpRegen;
    s.tenacity = b.tenacity;
    s.attackRange = b.attackRange;

    for (const id of this.items) {
      const item = ITEM_BY_ID.get(id);
      if (!item) continue;
      const st = item.stats;
      s.hp += st.hp ?? 0;
      s.mp += st.mana ?? 0;
      s.ad += st.ad ?? 0;
      s.ap += st.ap ?? 0;
      s.armor += st.armor ?? 0;
      s.mr += st.mr ?? 0;
      s.attackSpeed += st.attackSpeed ?? 0;
      s.critChance += st.critChance ?? 0;
      s.lifesteal += st.lifesteal ?? 0;
      s.spellVamp += st.spellVamp ?? 0;
      s.abilityHaste += st.abilityHaste ?? 0;
      s.moveSpeed += st.moveSpeed ?? 0;
      s.moveSpeedPct += st.moveSpeedPct ?? 0;
      s.armorPen += st.armorPen ?? 0;
      s.magicPen += st.magicPen ?? 0;
      s.hpRegen += st.hpRegen ?? 0;
      s.mpRegen += st.manaRegen ?? 0;
      s.tenacity += st.tenacity ?? 0;
      if (item.passive === 'mana_to_ad') s.ad += (b.hp + (st.hp ?? 0)) * 0.02;
    }

    let slow = 0;
    let haste = 0;
    let asBonus = 0;
    let shred = 0;
    let adBuff = 0;
    let apBuff = 0;
    for (const st of this.statuses) {
      switch (st.kind) {
        case 'slow':
          slow = Math.max(slow, st.amount);
          break;
        case 'haste':
          haste += st.amount;
          break;
        case 'attackSpeed':
          asBonus += st.amount;
          break;
        case 'armorShred':
          shred = Math.max(shred, st.amount);
          break;
        case 'buffAd':
          adBuff += st.amount;
          break;
        case 'buffAp':
          apBuff += st.amount;
          break;
        default:
          break;
      }
    }

    s.ad += adBuff;
    s.ap += apBuff;
    s.armor *= 1 - shred;
    s.attackSpeed *= 1 + asBonus;
    const tenacity = clamp(s.tenacity, 0, 0.75);
    const effectiveSlow = slow * (1 - tenacity * 0.5);
    s.moveSpeed = (s.moveSpeed + s.moveSpeed * s.moveSpeedPct + s.moveSpeed * haste) * (1 - effectiveSlow);
    s.moveSpeed = clamp(s.moveSpeed, 110, 900);
    s.attackSpeed = clamp(s.attackSpeed, 0.2, 2.6);

    this.cachedStats = s;
    this.statsDirty = false;
    return s;
  }

  markDirty() {
    this.statsDirty = true;
  }

  has(kind: StatusKind): boolean {
    return this.statuses.some((s) => s.kind === kind);
  }

  statusAmount(kind: StatusKind): number {
    let total = 0;
    for (const s of this.statuses) if (s.kind === kind) total += s.amount;
    return total;
  }

  get shieldAmount(): number {
    return this.statusAmount('shield');
  }

  get disabled(): boolean {
    return this.has('stun') || this.has('knockup') || this.has('fear');
  }

  get rooted(): boolean {
    return this.disabled || this.has('root');
  }

  get silenced(): boolean {
    return this.disabled || this.has('silence');
  }

  get hidden(): boolean {
    return this.has('stealth') && !this.has('revealed');
  }

  get hpPercent(): number {
    return clamp(this.hp / Math.max(1, this.maxHp), 0, 1);
  }

  get mpPercent(): number {
    return this.maxMp <= 0 ? 1 : clamp(this.mp / this.maxMp, 0, 1);
  }

  applyLevel(level: number) {
    if (!this.hero) return;
    const hs = this.hero.stats;
    const l = level - 1;
    this.level = level;
    this.base.hp = hs.hp + hs.hpPerLevel * l;
    this.base.mp = hs.mana + hs.manaPerLevel * l;
    this.base.ad = hs.ad + hs.adPerLevel * l;
    this.base.armor = hs.armor + hs.armorPerLevel * l;
    this.base.mr = hs.mr + hs.mrPerLevel * l;
    this.base.attackSpeed = hs.attackSpeed * (1 + hs.attackSpeedPerLevel * l);
    this.base.hpRegen = hs.hpRegen + l * 0.55;
    this.base.mpRegen = hs.manaRegen + l * 0.6;
    this.markDirty();
  }

  static createHero(heroId: string, skinId: string, team: Team, slot: number, name: string): Unit {
    const u = new Unit();
    const hero = getHero(heroId);
    u.kind = 'hero';
    u.team = team;
    u.name = name;
    u.heroId = heroId;
    u.skinId = skinId;
    u.hero = hero;
    u.skin = getSkin(heroId, skinId);
    u.slot = slot;
    u.lane = hero.lane;
    u.radius = hero.stats.radius;
    u.scale = hero.art.scale;
    u.base = emptyStats();
    u.base.attackRange = hero.stats.attackRange;
    u.base.moveSpeed = hero.stats.moveSpeed;
    u.base.critChance = hero.stats.critChance;
    u.base.ap = hero.stats.ap;
    u.applyLevel(1);
    u.hp = u.maxHp;
    u.mp = u.maxMp;
    u.skillPoints = 1;
    u.gold = 500;
    u.visionRadius = 1450;
    u.skills = hero.skills.map((def) => ({ def, rank: def.key === 'P' ? 1 : 0, cooldownUntil: 0, lastCast: -99 }));
    u.spells = [
      { id: 'flash', cooldownUntil: 0 },
      { id: 'ignite', cooldownUntil: 0 }
    ];
    u.items = [];
    return u;
  }
}

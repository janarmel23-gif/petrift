import { angleTo, clamp, dist, type Point } from '../core/math';
import { BLUE_SPAWN, CAMPS, laneFor, RED_SPAWN, type LaneId } from '../data/map';
import type { BotLevel } from '../../lib/types';
import type { AiState } from './types';
import type { Unit } from './unit';
import type { World } from './world';

interface Tuning {
  reaction: number;
  aggression: number;
  accuracy: number;
  awareness: number;
  skillUse: number;
}

export function createAiState(difficulty: BotLevel, role: string, lane: AiState['lane'], tuning: Tuning): AiState {
  return {
    difficulty,
    role,
    lane,
    goal: 'lane',
    nextThink: 0,
    reaction: tuning.reaction,
    aggression: tuning.aggression,
    accuracy: tuning.accuracy,
    awareness: tuning.awareness,
    skillUse: tuning.skillUse,
    retreatAt: difficulty === 'easy' ? 0.22 : difficulty === 'medium' ? 0.33 : 0.4,
    roamAt: 0,
    targetId: 0,
    waypointIndex: 0,
    recallUntil: 0,
    buildIndex: 0,
    lastSkillAt: -99
  };
}

const LANE_FOR_ROLE: Record<string, LaneId> = {
  top: 'top',
  mid: 'mid',
  bot: 'bot',
  support: 'bot',
  jungle: 'mid'
};

export function runAi(world: World, unit: Unit, dt: number) {
  const ai = unit.ai;
  if (!ai || !unit.alive) return;

  if (world.canShop(unit)) {
    world.botBuyItems(unit);
    if (unit.hp >= unit.maxHp * 0.95 && unit.mp >= unit.maxMp * 0.9) ai.goal = 'lane';
    else {
      unit.moveTarget = null;
      return;
    }
  }

  if (world.time >= ai.nextThink) {
    ai.nextThink = world.time + ai.reaction + world.rng.range(0, ai.reaction * 0.4);
    decide(world, unit, ai);
  }

  act(world, unit, ai, dt);
}

function visibleEnemies(world: World, unit: Unit, ai: AiState): Unit[] {
  return world
    .enemiesInRadius(unit.team, unit.x, unit.y, ai.awareness, false)
    .filter((e) => e.kind === 'hero' && e.alive && world.canSee(unit.team, e));
}

function decide(world: World, unit: Unit, ai: AiState) {
  const enemies = visibleEnemies(world, unit, ai);
  const alliesNear = world.alliesInRadius(unit.team, unit.x, unit.y, 1400, true).filter((a) => a.id !== unit.id).length;
  const lowHp = unit.hpPercent < ai.retreatAt;
  const veryLow = unit.hpPercent < ai.retreatAt * 0.55;
  const enemyTower = world.units.find(
    (u) => u.alive && u.kind === 'tower' && world.isEnemy(unit.team, u.team) && dist(u.x, u.y, unit.x, unit.y) < 900
  );

  if (veryLow && enemies.length > 0) {
    ai.goal = 'retreat';
    return;
  }
  if (lowHp && (enemies.length > alliesNear || unit.mp < unit.maxMp * 0.12)) {
    ai.goal = 'retreat';
    return;
  }
  if (unit.hpPercent < 0.35 && enemies.length === 0 && unit.gold > 900) {
    ai.goal = 'recall';
    return;
  }

  if (enemies.length > 0) {
    const target = pickTarget(world, unit, enemies);
    if (target) {
      const advantage = alliesNear + 1 - enemies.length;
      const targetLow = target.hpPercent < 0.45;
      const willFight = advantage >= 0 || targetLow || world.rng.chance(ai.aggression * 0.5);
      const towerRisk = enemyTower && !targetLow && ai.difficulty !== 'easy';
      if (willFight && !towerRisk) {
        ai.goal = 'fight';
        ai.targetId = target.id;
        return;
      }
    }
  }

  if (ai.role === 'jungle' || unit.lane === 'jungle') {
    const camp = findCamp(world, unit);
    if (camp) {
      ai.goal = 'jungle';
      ai.targetId = camp.id;
      return;
    }
  }

  const siege = findSiegeTarget(world, unit);
  if (siege) {
    ai.goal = 'objective';
    ai.targetId = siege.id;
    return;
  }

  const objective = findObjective(world, unit);
  if (objective && world.time > 600 && world.rng.chance(0.5)) {
    ai.goal = 'objective';
    ai.targetId = objective.id;
    return;
  }

  ai.goal = 'lane';
}

function findSiegeTarget(world: World, unit: Unit): Unit | null {
  const structures = world.units.filter(
    (u) =>
      u.alive &&
      (u.kind === 'tower' || u.kind === 'inhibitor' || u.kind === 'nexus') &&
      world.isEnemy(unit.team, u.team) &&
      world.structureTargetable(u)
  );
  let best: Unit | null = null;
  let bestScore = -Infinity;
  for (const s of structures) {
    const d = dist(unit.x, unit.y, s.x, s.y);
    if (d > 3400) continue;
    const support = world.alliesInRadius(unit.team, s.x, s.y, 1150).filter((u) => u.kind === 'minion').length;
    if (support < 2) continue;
    const score = support * 260 + (1 - s.hpPercent) * 700 - d * 0.35 + (s.kind === 'nexus' ? 2000 : s.kind === 'inhibitor' ? 900 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

function pickTarget(world: World, unit: Unit, enemies: Unit[]): Unit | null {
  if (enemies.length === 0) return null;
  const ai = unit.ai!;
  if (ai.difficulty === 'easy') {
    return enemies.reduce((a, b) => (dist(unit.x, unit.y, a.x, a.y) < dist(unit.x, unit.y, b.x, b.y) ? a : b));
  }
  let best: Unit | null = null;
  let bestScore = -Infinity;
  for (const e of enemies) {
    const d = dist(unit.x, unit.y, e.x, e.y);
    const squishy = e.hero ? (e.hero.role === 'Marksman' || e.hero.role === 'Mage' || e.hero.role === 'Support' ? 1 : 0) : 0;
    const score = (1 - e.hpPercent) * 220 + squishy * (ai.difficulty === 'hard' ? 140 : 60) - d * 0.12;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

function findCamp(world: World, unit: Unit): Unit | null {
  const side = unit.team;
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const u of world.units) {
    if (u.kind !== 'monster' || !u.alive) continue;
    const spec = CAMPS.find((c) => c.id === u.campId);
    if (!spec) continue;
    if (spec.kind === 'ancient' && unit.level < 12) continue;
    if (spec.side !== 'neutral' && spec.side !== side && unit.level < 8) continue;
    const d = dist(unit.x, unit.y, u.x, u.y);
    if (d < bestD && d < 4200) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

function findObjective(world: World, unit: Unit): Unit | null {
  const towers = world.units.filter(
    (u) => u.alive && (u.kind === 'tower' || u.kind === 'inhibitor' || u.kind === 'nexus') && world.isEnemy(unit.team, u.team) && world.structureTargetable(u)
  );
  if (towers.length === 0) return null;
  return towers.reduce((a, b) => (dist(unit.x, unit.y, a.x, a.y) < dist(unit.x, unit.y, b.x, b.y) ? a : b));
}

function act(world: World, unit: Unit, ai: AiState, dt: number) {
  switch (ai.goal) {
    case 'retreat':
      doRetreat(world, unit, ai, dt);
      break;
    case 'recall':
      doRecall(world, unit, ai);
      break;
    case 'fight':
      doFight(world, unit, ai, dt);
      break;
    case 'jungle':
      doJungle(world, unit, ai, dt);
      break;
    case 'objective':
      doObjective(world, unit, ai, dt);
      break;
    default:
      doLane(world, unit, ai, dt);
      break;
  }
}

function fountain(unit: Unit): Point {
  return unit.team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
}

function doRetreat(world: World, unit: Unit, ai: AiState, dt: number) {
  unit.targetId = 0;
  const home = fountain(unit);
  useDefensiveSkills(world, unit, ai);
  world.steerTo(unit, home, dt);
  if (dist(unit.x, unit.y, home.x, home.y) < 400 && unit.hpPercent > 0.9) ai.goal = 'lane';
}

function doRecall(world: World, unit: Unit, ai: AiState) {
  if (!unit.channel) world.startRecall(unit);
  if (!unit.channel) ai.goal = 'retreat';
}

function doFight(world: World, unit: Unit, ai: AiState, dt: number) {
  const target = world.unit(ai.targetId);
  if (!target || !target.alive || !world.canSee(unit.team, target)) {
    ai.goal = 'lane';
    return;
  }

  const stats = unit.stats();
  const d = dist(unit.x, unit.y, target.x, target.y);
  const preferred = stats.attackRange > 300 ? stats.attackRange * 0.82 : stats.attackRange * 0.7;

  useOffensiveSkills(world, unit, ai, target);
  useDefensiveSkills(world, unit, ai);
  useSummoners(world, unit, ai, target);

  unit.targetId = target.id;

  if (d > preferred + 60) {
    world.steerTo(unit, { x: target.x, y: target.y }, dt);
  } else if (stats.attackRange > 300 && d < preferred * 0.55 && ai.difficulty !== 'easy') {
    const away = angleTo(target.x, target.y, unit.x, unit.y);
    world.steerTo(unit, { x: unit.x + Math.cos(away) * 260, y: unit.y + Math.sin(away) * 260 }, dt);
  } else {
    unit.moveTarget = null;
    world.tryAttack(unit, target, dt);
  }
}

function doJungle(world: World, unit: Unit, ai: AiState, dt: number) {
  const camp = world.unit(ai.targetId);
  if (!camp || !camp.alive) {
    ai.goal = 'lane';
    return;
  }
  unit.targetId = camp.id;
  const range = unit.stats().attackRange + camp.radius;
  if (dist(unit.x, unit.y, camp.x, camp.y) > range) {
    world.steerTo(unit, { x: camp.x, y: camp.y }, dt);
  } else {
    unit.moveTarget = null;
    world.tryAttack(unit, camp, dt);
    if (world.rng.chance(ai.skillUse * dt * 4)) useOffensiveSkills(world, unit, ai, camp);
  }
}

function doObjective(world: World, unit: Unit, ai: AiState, dt: number) {
  const structure = world.unit(ai.targetId);
  if (!structure || !structure.alive) {
    ai.goal = 'lane';
    return;
  }
  const minionsNear = world.alliesInRadius(unit.team, structure.x, structure.y, 1150).filter((u) => u.kind === 'minion').length;
  const towerThreat = world.units.some(
    (u) => u.alive && u.kind === 'tower' && world.isEnemy(unit.team, u.team) && dist(u.x, u.y, unit.x, unit.y) < 950
  );
  if (structure.kind === 'tower' && minionsNear === 0 && towerThreat && ai.difficulty !== 'easy') {
    ai.goal = 'lane';
    return;
  }
  unit.targetId = structure.id;
  const range = unit.stats().attackRange + structure.radius;
  if (dist(unit.x, unit.y, structure.x, structure.y) > range) world.steerTo(unit, { x: structure.x, y: structure.y }, dt);
  else {
    unit.moveTarget = null;
    world.tryAttack(unit, structure, dt);
  }
}

function doLane(world: World, unit: Unit, ai: AiState, dt: number) {
  const lane = LANE_FOR_ROLE[unit.lane] ?? 'mid';
  const path = laneFor(unit.team === 'red' ? 'red' : 'blue', lane);

  const creeps = world
    .enemiesInRadius(unit.team, unit.x, unit.y, 780, false)
    .filter((e) => e.kind === 'minion' || e.kind === 'monster');

  if (creeps.length > 0) {
    const killable = creeps.find((c) => c.hp < unit.stats().ad * 1.15);
    const target = killable ?? creeps.reduce((a, b) => (a.hp < b.hp ? a : b));
    unit.targetId = target.id;
    const range = unit.stats().attackRange + target.radius;
    if (dist(unit.x, unit.y, target.x, target.y) > range) world.steerTo(unit, { x: target.x, y: target.y }, dt);
    else {
      unit.moveTarget = null;
      world.tryAttack(unit, target, dt);
      if (creeps.length >= 3 && world.rng.chance(ai.skillUse * dt * 2.2)) useOffensiveSkills(world, unit, ai, target);
    }
    return;
  }

  const enemyTower = world.units.find(
    (u) => u.alive && u.kind === 'tower' && world.isEnemy(unit.team, u.team) && u.lane === lane && world.structureTargetable(u)
  );
  const frontier = enemyTower ?? null;
  let goal: Point;
  if (frontier) {
    const allyMinions = world.alliesInRadius(unit.team, frontier.x, frontier.y, 1100).filter((u) => u.kind === 'minion').length;
    if (allyMinions > 0) {
      goal = { x: frontier.x, y: frontier.y };
      unit.targetId = frontier.id;
      if (dist(unit.x, unit.y, frontier.x, frontier.y) < unit.stats().attackRange + frontier.radius) {
        unit.moveTarget = null;
        world.tryAttack(unit, frontier, dt);
        return;
      }
    } else {
      const back = path[Math.max(0, Math.floor(path.length * 0.4))];
      goal = { x: back.x, y: back.y };
      unit.targetId = 0;
    }
  } else {
    const wp = path[Math.min(ai.waypointIndex, path.length - 1)];
    goal = { x: wp.x, y: wp.y };
    if (dist(unit.x, unit.y, wp.x, wp.y) < 340) ai.waypointIndex = Math.min(ai.waypointIndex + 1, path.length - 1);
  }
  world.steerTo(unit, goal, dt);
}

function aimAt(world: World, unit: Unit, ai: AiState, target: Unit, speed: number): Point {
  const d = dist(unit.x, unit.y, target.x, target.y);
  const travel = speed > 0 ? d / speed : 0;
  let px = target.x;
  let py = target.y;
  if (target.moveTarget) {
    const a = angleTo(target.x, target.y, target.moveTarget.x, target.moveTarget.y);
    const ms = target.stats().moveSpeed;
    px += Math.cos(a) * ms * travel;
    py += Math.sin(a) * ms * travel;
  }
  const error = (1 - ai.accuracy) * 420;
  px += world.rng.range(-error, error);
  py += world.rng.range(-error, error);
  return { x: px, y: py };
}

function useOffensiveSkills(world: World, unit: Unit, ai: AiState, target: Unit) {
  if (world.time - ai.lastSkillAt < 0.32) return;
  if (unit.silenced) return;

  const order = [4, 1, 3, 2];
  for (const index of order) {
    const state = unit.skills[index];
    if (!state || state.def.key === 'P') continue;
    if (!world.skillReady(unit, index)) continue;
    const def = state.def;
    if (def.targetsAllies && def.shape !== 'aura') continue;
    if (def.shape === 'self') continue;

    const d = dist(unit.x, unit.y, target.x, target.y);
    const effectiveRange = def.range > 0 ? def.range : def.radius;
    if (d > effectiveRange + target.radius) continue;
    if (!world.rng.chance(ai.skillUse)) continue;
    if (def.ultimate && target.kind === 'hero' && target.hpPercent > 0.75 && ai.difficulty === 'hard' && world.rng.chance(0.5)) continue;
    if (def.ultimate && target.kind !== 'hero' && ai.difficulty !== 'easy') continue;

    const aim = def.shape === 'targeted' || def.shape === 'circle' || def.shape === 'zone'
      ? { x: target.x, y: target.y }
      : aimAt(world, unit, ai, target, def.speed);

    if (world.castSkill(unit, index, aim, target.id)) {
      ai.lastSkillAt = world.time;
      return;
    }
  }
}

function useDefensiveSkills(world: World, unit: Unit, ai: AiState) {
  if (world.time - ai.lastSkillAt < 0.32) return;
  if (unit.silenced) return;
  const threatened = unit.hpPercent < 0.55 || unit.has('slow') || unit.has('stun');

  for (let index = 1; index < unit.skills.length; index++) {
    const state = unit.skills[index];
    if (!state || state.rank === 0) continue;
    if (!world.skillReady(unit, index)) continue;
    const def = state.def;

    const isEscape = def.shape === 'blink' || (def.shape === 'dash' && def.baseDamage[0] === 0);
    const isSelfBuff = def.shape === 'self';
    const isAllyHeal = def.targetsAllies && (def.healBase[0] > 0 || def.shieldBase[0] > 0);

    if (isAllyHeal) {
      const hurt = world
        .alliesInRadius(unit.team, unit.x, unit.y, def.range > 0 ? def.range : def.radius, true)
        .filter((a) => a.hpPercent < 0.62)
        .sort((a, b) => a.hpPercent - b.hpPercent)[0];
      if (hurt && world.rng.chance(ai.skillUse)) {
        if (world.castSkill(unit, index, { x: hurt.x, y: hurt.y }, hurt.id)) {
          ai.lastSkillAt = world.time;
          return;
        }
      }
      continue;
    }

    if (!threatened) continue;

    if (isEscape && ai.goal === 'retreat') {
      const home = fountain(unit);
      const a = angleTo(unit.x, unit.y, home.x, home.y);
      const p = { x: unit.x + Math.cos(a) * def.range, y: unit.y + Math.sin(a) * def.range };
      if (world.castSkill(unit, index, p)) {
        ai.lastSkillAt = world.time;
        return;
      }
    }

    if (isSelfBuff && world.rng.chance(ai.skillUse)) {
      if (world.castSkill(unit, index, { x: unit.x, y: unit.y })) {
        ai.lastSkillAt = world.time;
        return;
      }
    }
  }
}

function useSummoners(world: World, unit: Unit, ai: AiState, target: Unit) {
  if (ai.difficulty === 'easy') return;
  for (let i = 0; i < unit.spells.length; i++) {
    const slot = unit.spells[i];
    if (world.time < slot.cooldownUntil) continue;
    if (slot.id === 'ignite' && target.kind === 'hero' && target.hpPercent < 0.28 && dist(unit.x, unit.y, target.x, target.y) < 600) {
      world.castSpell(unit, i, { x: target.x, y: target.y });
      return;
    }
    if (slot.id === 'heal' && unit.hpPercent < 0.3) {
      world.castSpell(unit, i, { x: unit.x, y: unit.y });
      return;
    }
    if (slot.id === 'barrier' && unit.hpPercent < 0.25) {
      world.castSpell(unit, i, { x: unit.x, y: unit.y });
      return;
    }
    if (slot.id === 'cleanse' && (unit.has('stun') || unit.has('root'))) {
      world.castSpell(unit, i, { x: unit.x, y: unit.y });
      return;
    }
    if (slot.id === 'sprint' && (ai.goal === 'retreat' || unit.hpPercent < 0.35)) {
      world.castSpell(unit, i, { x: unit.x, y: unit.y });
      return;
    }
    if (slot.id === 'flash' && ai.difficulty === 'hard' && unit.hpPercent < 0.2 && ai.goal === 'retreat') {
      const home = fountain(unit);
      const a = angleTo(unit.x, unit.y, home.x, home.y);
      world.castSpell(unit, i, { x: unit.x + Math.cos(a) * 420, y: unit.y + Math.sin(a) * 420 });
      return;
    }
  }
}

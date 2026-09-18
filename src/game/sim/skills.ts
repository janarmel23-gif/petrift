import { angleTo, clamp, dist, pointInCone, pointToSegment, type Point } from '../core/math';
import { nearestWalkable } from '../core/pathfinding';
import type { SkillDef } from '../data/types';
import type { SkillState } from './types';
import type { Unit } from './unit';
import type { World } from './world';

function at(values: number[], rank: number): number {
  if (values.length === 0) return 0;
  return values[clamp(rank, 0, values.length - 1)];
}

export function skillRankIndex(state: SkillState | undefined): number {
  if (!state) return 0;
  return Math.max(0, state.rank - 1);
}

export function skillManaCost(unit: Unit, state: SkillState): number {
  return at(state.def.manaCost, skillRankIndex(state));
}

export function skillCooldown(unit: Unit, state: SkillState): number {
  const haste = unit.stats().abilityHaste;
  const base = at(state.def.cooldown, skillRankIndex(state));
  return base * (100 / (100 + haste));
}

function clampPoint(unit: Unit, point: Point, range: number): Point {
  if (range <= 0) return { x: unit.x, y: unit.y };
  const d = dist(unit.x, unit.y, point.x, point.y);
  if (d <= range) return { x: point.x, y: point.y };
  const a = angleTo(unit.x, unit.y, point.x, point.y);
  return { x: unit.x + Math.cos(a) * range, y: unit.y + Math.sin(a) * range };
}

export function executeSkill(world: World, unit: Unit, index: number, rawPoint: Point, targetId = 0): boolean {
  const state = unit.skills[index];
  if (!state || !unit.alive) return false;
  const def = state.def;
  if (def.key === 'P' || state.rank === 0) return false;
  if (unit.silenced || unit.dash || unit.channel) return false;
  if (world.time < state.cooldownUntil) return false;

  const rank = skillRankIndex(state);
  const cost = skillManaCost(unit, state);
  if (unit.mp < cost) return false;

  const stats = unit.stats();
  const point = clampPoint(unit, rawPoint, def.range);
  const angle = angleTo(unit.x, unit.y, point.x, point.y);

  const damage = at(def.baseDamage, rank) + stats.ad * def.adRatio + stats.ap * def.apRatio;
  const heal = at(def.healBase, rank) + stats.ap * def.healApRatio;
  const shield = at(def.shieldBase, rank) + stats.ap * def.shieldApRatio;

  let fired = true;

  switch (def.shape) {
    case 'projectile':
      world.spawnProjectile({
        owner: unit,
        dir: angle,
        damage,
        damageType: def.damageType,
        speed: def.speed,
        color: skillColor(unit, def),
        vfx: def.vfx,
        skill: def,
        range: def.range,
        radius: Math.max(40, def.width * 0.6),
        piercing: false,
        maxTargets: 1
      });
      break;

    case 'piercing':
      world.spawnProjectile({
        owner: unit,
        dir: angle,
        damage,
        damageType: def.damageType,
        speed: def.speed,
        color: skillColor(unit, def),
        vfx: def.vfx,
        skill: def,
        range: def.range,
        radius: Math.max(36, def.width * 0.5),
        piercing: true,
        maxTargets: def.maxTargets
      });
      break;

    case 'dash': {
      const dest = nearestWalkable(point.x, point.y);
      const travel = dist(unit.x, unit.y, dest.x, dest.y);
      unit.dash = {
        fromX: unit.x,
        fromY: unit.y,
        toX: dest.x,
        toY: dest.y,
        elapsed: 0,
        duration: Math.max(0.12, travel / Math.max(400, def.speed)),
        skillId: def.id,
        hitIds: new Set(),
        radius: def.radius,
        damage,
        damageType: def.damageType
      };
      unit.moveTarget = null;
      unit.path.length = 0;
      world.addEffect('dashline', unit.x, unit.y, dest.x, dest.y, def.radius, skillColor(unit, def), 0.4);
      if (def.duration > 0 && (def.id === 'blaze_flamedash' || def.id === 'quill_ballroll')) {
        world.spawnZone({
          owner: unit,
          x: (unit.x + dest.x) / 2,
          y: (unit.y + dest.y) / 2,
          radius: Math.max(def.radius, travel * 0.45),
          duration: def.duration,
          damage: damage * 0.2,
          damageType: def.damageType,
          skill: def,
          color: skillColor(unit, def),
          vfx: def.vfx,
          slow: def.status.slow?.amount ?? 0
        });
      }
      if (def.id === 'koi_currentslide') {
        const ally = world.alliesInRadius(unit.team, unit.x, unit.y, def.radius, true).find((a) => a.id !== unit.id);
        if (ally) {
          ally.dash = {
            fromX: ally.x,
            fromY: ally.y,
            toX: dest.x + 90,
            toY: dest.y + 90,
            elapsed: 0,
            duration: Math.max(0.14, travel / def.speed),
            skillId: def.id,
            hitIds: new Set(),
            radius: 0,
            damage: 0,
            damageType: 'magic'
          };
          world.applyStatus(ally, 'haste', 2, 0.3, unit.id, def.id);
        }
      }
      applySelfEffects(world, unit, def, heal, shield);
      break;
    }

    case 'blink': {
      const dest = nearestWalkable(point.x, point.y);
      world.addEffect('blink', unit.x, unit.y, dest.x, dest.y, 70, skillColor(unit, def), 0.35);
      world.spawnParticles(unit.x, unit.y, 14, skillColor(unit, def), 'smoke');
      unit.x = dest.x;
      unit.y = dest.y;
      unit.moveTarget = null;
      unit.path.length = 0;
      world.spawnParticles(dest.x, dest.y, 14, skillColor(unit, def), 'smoke');
      applySelfEffects(world, unit, def, heal, shield);
      break;
    }

    case 'circle': {
      const cx = def.range <= 0 ? unit.x : point.x;
      const cy = def.range <= 0 ? unit.y : point.y;
      world.addEffect('aoe', cx, cy, 0, 0, def.radius, skillColor(unit, def), Math.max(0.35, def.castTime + 0.25));
      world.spawnParticles(cx, cy, 20, skillColor(unit, def), 'spark');
      world.addShake(def.ultimate ? 10 : 4);
      const targets = world.enemiesInRadius(unit.team, cx, cy, def.radius, false).slice(0, def.maxTargets);
      for (const t of targets) {
        let dmg = damage;
        if (def.id === 'mochi_felinefury' && t.hpPercent < 0.3) dmg *= 1.6;
        world.dealDamage(unit, t, dmg, def.damageType, { skill: def.id, skillDef: def });
        world.applySkillStatus(unit, t, def);
      }
      if (def.id === 'koi_deluge') {
        for (const a of world.alliesInRadius(unit.team, cx, cy, def.radius, true)) world.healUnit(unit, a, heal);
      }
      if (def.duration > 0) {
        world.spawnZone({
          owner: unit,
          x: cx,
          y: cy,
          radius: def.radius,
          duration: def.duration,
          damage: damage * 0.22,
          damageType: def.damageType,
          skill: def,
          color: skillColor(unit, def),
          vfx: def.vfx,
          slow: def.status.slow?.amount ?? 0
        });
      }
      applySelfEffects(world, unit, def, heal, shield);
      break;
    }

    case 'cone': {
      const half = Math.atan2(def.width, Math.max(1, def.range)) + 0.32;
      world.addEffect('cone', unit.x, unit.y, point.x, point.y, def.range, skillColor(unit, def), 0.3, angle, half);
      unit.facing = angle;
      const targets = world
        .enemiesInRadius(unit.team, unit.x, unit.y, def.range + 60, false)
        .filter((t) => pointInCone(t.x, t.y, unit.x, unit.y, angle, def.range + t.radius, half))
        .slice(0, def.maxTargets);
      for (const t of targets) {
        world.dealDamage(unit, t, damage, def.damageType, { skill: def.id, skillDef: def });
        world.applySkillStatus(unit, t, def);
        world.spawnParticles(t.x, t.y, 8, skillColor(unit, def), 'spark');
      }
      applySelfEffects(world, unit, def, heal, shield);
      break;
    }

    case 'line': {
      const ex = unit.x + Math.cos(angle) * def.range;
      const ey = unit.y + Math.sin(angle) * def.range;
      world.addEffect('linehit', unit.x, unit.y, ex, ey, def.width * 0.5, skillColor(unit, def), 0.3, angle, def.width);
      const targets = world
        .enemiesInRadius(unit.team, (unit.x + ex) / 2, (unit.y + ey) / 2, def.range, false)
        .filter((t) => pointToSegment(t.x, t.y, unit.x, unit.y, ex, ey) <= def.width * 0.5 + t.radius)
        .slice(0, def.maxTargets);
      for (const t of targets) {
        world.dealDamage(unit, t, damage, def.damageType, { skill: def.id, skillDef: def });
        world.applySkillStatus(unit, t, def);
      }
      applySelfEffects(world, unit, def, heal, shield);
      break;
    }

    case 'self': {
      applySelfEffects(world, unit, def, heal, shield);
      world.addEffect('selfbuff', unit.x, unit.y, 0, 0, unit.radius * 3, skillColor(unit, def), 0.6);
      world.spawnParticles(unit.x, unit.y, 14, skillColor(unit, def), 'glow');
      if (def.id === 'bruno_bulwark') {
        for (const t of world.enemiesInRadius(unit.team, unit.x, unit.y, def.radius, false).slice(0, def.maxTargets)) {
          world.applyStatus(t, 'root', def.status.root ?? 1, 1, unit.id, def.id);
          t.targetId = unit.id;
        }
      }
      if (def.id === 'shelly_fortress') {
        world.applyStatus(unit, 'damageReduction', def.duration, 0.25, unit.id, def.id);
      }
      break;
    }

    case 'targeted': {
      let target = targetId ? world.unit(targetId) : null;
      if (!target || !target.alive || dist(unit.x, unit.y, target.x, target.y) > def.range + target.radius) {
        target = def.targetsAllies
          ? world.alliesInRadius(unit.team, point.x, point.y, 260, true)[0] ?? null
          : world.enemiesInRadius(unit.team, point.x, point.y, 260, false)[0] ?? null;
      }
      if (!target) {
        fired = false;
        break;
      }
      if (def.targetsAllies) {
        world.healUnit(unit, target, heal);
        if (shield > 0) world.applyStatus(target, 'shield', Math.max(2, def.duration), shield, unit.id, def.id);
        if (def.status.haste) world.applyStatus(target, 'haste', def.status.haste.duration, def.status.haste.amount, unit.id, def.id);
        world.addEffect('healbeam', unit.x, unit.y, target.x, target.y, 24, skillColor(unit, def), 0.5);
        world.spawnParticles(target.x, target.y, 12, skillColor(unit, def), 'glow');
      } else {
        let dmg = damage;
        if (def.id === 'vex_executioner') dmg += (target.maxHp - target.hp) * 0.28;
        world.dealDamage(unit, target, dmg, def.damageType, { skill: def.id, skillDef: def });
        world.applySkillStatus(unit, target, def);
        if (def.id === 'tank_chomp') world.healUnit(unit, unit, heal);
        world.addEffect('bolt', unit.x, unit.y, target.x, target.y, 26, skillColor(unit, def), 0.35);
      }
      break;
    }

    case 'aura': {
      world.addEffect('aoe', unit.x, unit.y, 0, 0, def.radius, skillColor(unit, def), 0.7);
      world.addShake(def.ultimate ? 9 : 3);
      if (def.targetsAllies) {
        for (const a of world.alliesInRadius(unit.team, unit.x, unit.y, def.radius, true)) {
          if (heal > 0) world.healUnit(unit, a, heal);
          if (shield > 0) world.applyStatus(a, 'shield', Math.max(3, def.duration), shield, unit.id, def.id);
          if (def.status.haste) world.applyStatus(a, 'haste', def.status.haste.duration, def.status.haste.amount, unit.id, def.id);
          if (def.id === 'tank_lastwall') world.applyStatus(a, 'damageReduction', def.duration, 0.2, unit.id, def.id);
        }
      }
      if (damage > 0) {
        for (const t of world.enemiesInRadius(unit.team, unit.x, unit.y, def.radius, false).slice(0, def.maxTargets)) {
          world.dealDamage(unit, t, damage, def.damageType, { skill: def.id, skillDef: def });
          world.applySkillStatus(unit, t, def);
        }
      }
      if (def.duration > 0 && (def.id === 'quill_ironstorm' || def.id === 'bruno_guardianroar' || def.id === 'tank_lastwall')) {
        world.spawnZone({
          owner: unit,
          x: unit.x,
          y: unit.y,
          radius: def.radius,
          duration: def.duration,
          damage: damage * 0.28,
          damageType: def.damageType,
          skill: def,
          color: skillColor(unit, def),
          vfx: def.vfx,
          slow: def.status.slow?.amount ?? 0,
          follow: def.id === 'quill_ironstorm'
        });
      }
      applySelfEffects(world, unit, def, 0, def.id === 'quill_ironstorm' ? shield : 0);
      break;
    }

    case 'zone': {
      world.spawnZone({
        owner: unit,
        x: point.x,
        y: point.y,
        radius: def.radius,
        duration: def.duration,
        damage: def.targetsAllies ? 0 : damage * 0.34,
        damageType: def.damageType,
        heal: def.targetsAllies ? heal : 0,
        skill: def,
        color: skillColor(unit, def),
        vfx: def.vfx,
        slow: def.status.slow?.amount ?? 0,
        friendly: def.targetsAllies,
        allyBuff: def.id === 'shelly_aegisdome' ? { kind: 'damageReduction', amount: 0.3, duration: 0.8 } : null
      });
      world.addEffect('zonecast', point.x, point.y, 0, 0, def.radius, skillColor(unit, def), 0.5);
      break;
    }

    default:
      fired = false;
      break;
  }

  if (!fired) return false;

  unit.mp -= cost;
  state.cooldownUntil = world.time + skillCooldown(unit, state);
  state.lastCast = world.time;
  unit.castAnim = 1;
  unit.lastCombatAt = world.time;
  if (def.shape !== 'self' && def.shape !== 'aura') unit.facing = angle;

  if (unit.items.includes('echo_conduit') && def.damageType !== 'true' && damage > 0) {
    const echoPoint = { x: point.x, y: point.y };
    world.schedule(1, () => {
      if (!unit.alive) return;
      for (const t of world.enemiesInRadius(unit.team, echoPoint.x, echoPoint.y, Math.max(160, def.radius), false)) {
        world.dealDamage(unit, t, damage * 0.4, def.damageType, { skill: `${def.id}_echo`, skillDef: def });
      }
      world.addEffect('aoe', echoPoint.x, echoPoint.y, 0, 0, Math.max(160, def.radius), '#8fd8ff', 0.3);
    });
  }

  if (unit.items.includes('lifebloom_censer')) {
    for (const a of world.alliesInRadius(unit.team, unit.x, unit.y, 700, true)) world.healUnit(unit, a, 30, true);
  }

  return true;
}

function applySelfEffects(world: World, unit: Unit, def: SkillDef, heal: number, shield: number) {
  if (heal > 0 && !def.targetsAllies) world.healUnit(unit, unit, heal);
  if (shield > 0) world.applyStatus(unit, 'shield', Math.max(2.5, def.duration), shield, unit.id, def.id);
  const s = def.status;
  if (s.haste) world.applyStatus(unit, 'haste', s.haste.duration, s.haste.amount, unit.id, def.id);
  if (s.attackSpeed) world.applyStatus(unit, 'attackSpeed', s.attackSpeed.duration, s.attackSpeed.amount, unit.id, def.id);
  if (s.stealth) world.applyStatus(unit, 'stealth', s.stealth, 1, unit.id, def.id);
  if (s.invulnerable) world.applyStatus(unit, 'invulnerable', s.invulnerable, 1, unit.id, def.id);
}

function skillColor(unit: Unit, def: SkillDef): string {
  return unit.skin?.spellColor ?? def.color;
}

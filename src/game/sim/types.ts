import type { Point } from '../core/math';
import type { BotLevel, TeamSide } from '../../lib/types';
import type { DamageType, SkillDef } from '../data/types';

export type Team = TeamSide | 'neutral';
export type UnitKind = 'hero' | 'minion' | 'monster' | 'tower' | 'inhibitor' | 'nexus' | 'ward';

export type StatusKind =
  | 'slow'
  | 'stun'
  | 'root'
  | 'silence'
  | 'burn'
  | 'poison'
  | 'haste'
  | 'attackSpeed'
  | 'shield'
  | 'stealth'
  | 'mark'
  | 'blind'
  | 'fear'
  | 'invulnerable'
  | 'revealed'
  | 'knockup'
  | 'healcut'
  | 'armorShred'
  | 'damageReduction'
  | 'buffAd'
  | 'buffAp';

export interface Status {
  kind: StatusKind;
  until: number;
  amount: number;
  sourceId: number;
  tickAt: number;
  label: string;
}

export interface Stats {
  hp: number;
  mp: number;
  ad: number;
  ap: number;
  armor: number;
  mr: number;
  attackSpeed: number;
  critChance: number;
  lifesteal: number;
  spellVamp: number;
  abilityHaste: number;
  moveSpeed: number;
  moveSpeedPct: number;
  armorPen: number;
  magicPen: number;
  hpRegen: number;
  mpRegen: number;
  tenacity: number;
  attackRange: number;
}

export function emptyStats(): Stats {
  return {
    hp: 0,
    mp: 0,
    ad: 0,
    ap: 0,
    armor: 0,
    mr: 0,
    attackSpeed: 0,
    critChance: 0,
    lifesteal: 0,
    spellVamp: 0,
    abilityHaste: 0,
    moveSpeed: 0,
    moveSpeedPct: 0,
    armorPen: 0,
    magicPen: 0,
    hpRegen: 0,
    mpRegen: 0,
    tenacity: 0,
    attackRange: 0
  };
}

export interface SkillState {
  def: SkillDef;
  rank: number;
  cooldownUntil: number;
  lastCast: number;
}

export interface SpellState {
  id: string;
  cooldownUntil: number;
}

export interface Dash {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  duration: number;
  skillId: string;
  hitIds: Set<number>;
  radius: number;
  damage: number;
  damageType: DamageType;
}

export interface Channel {
  skillId: string;
  remaining: number;
  total: number;
  onComplete: () => void;
  interruptible: boolean;
  label: string;
}

export interface AiState {
  difficulty: BotLevel;
  role: string;
  lane: 'top' | 'mid' | 'bot' | 'jungle' | 'support';
  goal: string;
  nextThink: number;
  reaction: number;
  aggression: number;
  accuracy: number;
  awareness: number;
  skillUse: number;
  retreatAt: number;
  roamAt: number;
  targetId: number;
  waypointIndex: number;
  recallUntil: number;
  buildIndex: number;
  lastSkillAt: number;
}

export interface Projectile {
  id: number;
  ownerId: number;
  team: Team;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  radius: number;
  range: number;
  traveled: number;
  damage: number;
  damageType: DamageType;
  skill: SkillDef | null;
  color: string;
  vfx: string;
  piercing: boolean;
  maxTargets: number;
  hitIds: Set<number>;
  homingTargetId: number;
  onHitBasicAttack: boolean;
  critical: boolean;
  scale: number;
}

export interface Zone {
  id: number;
  ownerId: number;
  team: Team;
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
  tickAt: number;
  tickInterval: number;
  damage: number;
  damageType: DamageType;
  heal: number;
  skill: SkillDef | null;
  color: string;
  vfx: string;
  slow: number;
  friendly: boolean;
  createdAt: number;
  rise: number;
  follow: boolean;
  allyBuff: { kind: StatusKind; amount: number; duration: number } | null;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  crit: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'spark' | 'smoke' | 'ring' | 'shard' | 'glow' | 'trail' | 'leaf' | 'bubble' | 'star';
  spin: number;
  rotation: number;
  gravity: number;
  fade: number;
}

export interface Effect {
  kind: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  radius: number;
  angle: number;
  width: number;
  color: string;
  life: number;
  maxLife: number;
  ownerId: number;
}

export interface KillFeedEntry {
  killer: string;
  killerHero: string;
  victim: string;
  victimHero: string;
  killerTeam: Team;
  assists: number;
  at: number;
  isTower: boolean;
}

export interface Announcement {
  text: string;
  sub: string;
  at: number;
  duration: number;
  tone: 'good' | 'bad' | 'neutral' | 'epic';
}

export interface ScoreEntry {
  slot: number;
  team: TeamSide;
  heroId: string;
  skinId: string;
  name: string;
  isBot: boolean;
  botDifficulty: BotLevel | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  goldEarned: number;
  level: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  turretsDestroyed: number;
  largestMultikill: number;
  items: string[];
  unitId: number;
}

export interface DamageEvent {
  sourceId: number;
  targetId: number;
  amount: number;
  type: DamageType;
  crit: boolean;
  fromSkill: string;
}

export interface WardMarker {
  id: number;
  team: Team;
  x: number;
  y: number;
  expiresAt: number;
  radius: number;
}

export type PendingCast =
  | { kind: 'none' }
  | { kind: 'skill'; index: number; targeting: boolean }
  | { kind: 'spell'; index: number; targeting: boolean }
  | { kind: 'item'; slot: number; targeting: boolean };

export interface PlayerCommand {
  type: 'move' | 'attackMove' | 'stop' | 'attackTarget' | 'castSkill' | 'castSpell' | 'useItem' | 'recall' | 'levelSkill';
  point?: Point;
  targetId?: number;
  index?: number;
}

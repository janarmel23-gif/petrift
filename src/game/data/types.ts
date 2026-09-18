export type Role = 'Marksman' | 'Assassin' | 'Tank' | 'Support' | 'Mage' | 'Fighter';
export type DamageType = 'physical' | 'magic' | 'true';
export type SkillKey = 'P' | 'Q' | 'W' | 'E' | 'R';

export type SkillShape =
  | 'projectile'
  | 'piercing'
  | 'dash'
  | 'blink'
  | 'circle'
  | 'cone'
  | 'line'
  | 'self'
  | 'targeted'
  | 'aura'
  | 'summon'
  | 'chain'
  | 'zone'
  | 'toggle';

export interface StatusPayload {
  slow?: { amount: number; duration: number };
  stun?: number;
  root?: number;
  silence?: number;
  knockup?: number;
  knockback?: number;
  burn?: { dps: number; duration: number };
  poison?: { dps: number; duration: number };
  mark?: number;
  fear?: number;
  blind?: number;
  heal?: number;
  shield?: { amount: number; duration: number };
  haste?: { amount: number; duration: number };
  attackSpeed?: { amount: number; duration: number };
  invulnerable?: number;
  stealth?: number;
  revealed?: number;
}

export interface SkillDef {
  key: SkillKey;
  id: string;
  name: string;
  shape: SkillShape;
  description: string;
  damageType: DamageType;
  baseDamage: number[];
  adRatio: number;
  apRatio: number;
  cooldown: number[];
  manaCost: number[];
  range: number;
  radius: number;
  width: number;
  speed: number;
  castTime: number;
  duration: number;
  charges: number;
  healBase: number[];
  healApRatio: number;
  shieldBase: number[];
  shieldApRatio: number;
  status: StatusPayload;
  vfx: string;
  color: string;
  targetsAllies: boolean;
  maxTargets: number;
  ultimate: boolean;
}

export interface HeroStats {
  hp: number;
  hpPerLevel: number;
  hpRegen: number;
  mana: number;
  manaPerLevel: number;
  manaRegen: number;
  ad: number;
  adPerLevel: number;
  ap: number;
  armor: number;
  armorPerLevel: number;
  mr: number;
  mrPerLevel: number;
  attackSpeed: number;
  attackSpeedPerLevel: number;
  attackRange: number;
  moveSpeed: number;
  critChance: number;
  radius: number;
}

export interface PetPalette {
  fur: string;
  furDark: string;
  belly: string;
  accent: string;
  eye: string;
  glow: string;
}

export interface PetArt {
  body: 'round' | 'long' | 'chunky' | 'slim' | 'shelled' | 'winged';
  ears: 'perk' | 'flop' | 'round' | 'tuft' | 'long' | 'feather' | 'none';
  tail: 'bushy' | 'curl' | 'long' | 'stub' | 'fan' | 'fin' | 'plume';
  legs: 'short' | 'normal' | 'tall';
  features: Array<'spikes' | 'shell' | 'wings' | 'beak' | 'whiskers' | 'gills' | 'horn' | 'mane' | 'goggles'>;
  weapon: 'none' | 'bow' | 'staff' | 'blade' | 'hammer' | 'shield' | 'orb' | 'wand' | 'cannon';
  scale: number;
  palette: PetPalette;
}

export type SkinRarity = 'default' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface SkinDef {
  id: string;
  name: string;
  rarity: SkinRarity;
  price: number;
  currency: 'coins' | 'gems';
  palette: PetPalette;
  weapon?: PetArt['weapon'];
  aura: string;
  trail: string;
  spellColor: string;
  extras: Array<'flames' | 'frost' | 'sparks' | 'petals' | 'void' | 'circuit' | 'stars' | 'bubbles' | 'leaves' | 'embers'>;
  blurb: string;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  species: string;
  role: Role;
  secondaryRole: Role;
  difficulty: 1 | 2 | 3;
  price: number;
  lore: string;
  lane: 'top' | 'mid' | 'bot' | 'jungle' | 'support';
  resource: 'mana' | 'energy' | 'fury';
  stats: HeroStats;
  art: PetArt;
  skills: SkillDef[];
  skins: SkinDef[];
  tips: string[];
}

export type ItemSlot = 'starter' | 'boots' | 'attack' | 'magic' | 'defense' | 'support' | 'legendary' | 'consumable' | 'jungle';

export interface ItemStats {
  ad?: number;
  ap?: number;
  hp?: number;
  mana?: number;
  armor?: number;
  mr?: number;
  attackSpeed?: number;
  critChance?: number;
  lifesteal?: number;
  spellVamp?: number;
  abilityHaste?: number;
  moveSpeed?: number;
  moveSpeedPct?: number;
  armorPen?: number;
  magicPen?: number;
  hpRegen?: number;
  manaRegen?: number;
  tenacity?: number;
}

export type ItemPassive =
  | 'none'
  | 'burn_on_hit'
  | 'slow_on_hit'
  | 'shred_armor'
  | 'execute_low_hp'
  | 'crit_amplify'
  | 'splash_damage'
  | 'heal_on_kill'
  | 'thorns'
  | 'shield_on_low'
  | 'spell_echo'
  | 'chain_lightning'
  | 'bonus_vs_towers'
  | 'stack_ap_on_kill'
  | 'stack_ad_on_kill'
  | 'life_on_spell'
  | 'move_out_of_combat'
  | 'mana_to_ad'
  | 'reduce_healing'
  | 'first_strike'
  | 'aura_armor'
  | 'aura_ap'
  | 'gold_per_minion'
  | 'vision_ward'
  | 'jungle_smite';

export type ItemActive = 'none' | 'heal_burst' | 'stasis' | 'cleanse' | 'shield_ally' | 'speed_boost' | 'blink_short' | 'silence_field' | 'ward' | 'smite';

export interface ItemDef {
  id: string;
  name: string;
  slot: ItemSlot;
  cost: number;
  totalCost: number;
  buildsFrom: string[];
  stats: ItemStats;
  passive: ItemPassive;
  passiveText: string;
  active: ItemActive;
  activeText: string;
  activeCooldown: number;
  tier: 1 | 2 | 3 | 4;
  icon: string;
  color: string;
  tags: string[];
  unique: boolean;
}

export interface SummonerSpellDef {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  range: number;
  icon: string;
  color: string;
}

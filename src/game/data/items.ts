import type { ItemActive, ItemDef, ItemPassive, ItemSlot, ItemStats } from './types';

interface ItemInput {
  id: string;
  name: string;
  slot: ItemSlot;
  cost: number;
  buildsFrom?: string[];
  stats: ItemStats;
  passive?: ItemPassive;
  passiveText?: string;
  active?: ItemActive;
  activeText?: string;
  activeCooldown?: number;
  tier: 1 | 2 | 3 | 4;
  icon: string;
  color: string;
  tags: string[];
  unique?: boolean;
}

const raw: ItemInput[] = [
  { id: 'kibble_pouch', name: 'Kibble Pouch', slot: 'starter', cost: 400, stats: { hp: 90, hpRegen: 3 }, passive: 'gold_per_minion', passiveText: 'Killing a minion grants 3 extra gold.', tier: 1, icon: 'pouch', color: '#c9a86a', tags: ['starter', 'sustain'] },
  { id: 'chew_ring', name: 'Chew Ring', slot: 'starter', cost: 400, stats: { ap: 14, manaRegen: 4 }, passive: 'gold_per_minion', passiveText: 'Killing a minion grants 3 extra gold.', tier: 1, icon: 'ring', color: '#8fb4ff', tags: ['starter', 'mana'] },
  { id: 'squeaky_bone', name: 'Squeaky Bone', slot: 'starter', cost: 400, stats: { ad: 10, hpRegen: 2 }, passive: 'gold_per_minion', passiveText: 'Killing a minion grants 3 extra gold.', tier: 1, icon: 'bone', color: '#e8dcc0', tags: ['starter', 'attack'] },
  { id: 'loyal_collar', name: 'Loyal Collar', slot: 'starter', cost: 400, stats: { hp: 60, armor: 8 }, passive: 'aura_armor', passiveText: 'Nearby allies gain 6 armor.', tier: 1, icon: 'collar', color: '#7cffb0', tags: ['starter', 'support'], unique: true },

  { id: 'sharp_claw', name: 'Sharpened Claw', slot: 'attack', cost: 450, stats: { ad: 15 }, tier: 1, icon: 'claw', color: '#ff8a5c', tags: ['attack'] },
  { id: 'swift_paws', name: 'Swift Paws', slot: 'attack', cost: 500, stats: { attackSpeed: 0.15 }, tier: 1, icon: 'paw', color: '#ffd24a', tags: ['attack', 'speed'] },
  { id: 'hunters_fang', name: 'Hunter Fang', slot: 'attack', cost: 700, stats: { ad: 12, lifesteal: 0.07 }, tier: 1, icon: 'fang', color: '#ff5c7a', tags: ['attack', 'sustain'] },
  { id: 'lucky_charm', name: 'Lucky Charm', slot: 'attack', cost: 600, stats: { critChance: 0.15 }, tier: 1, icon: 'clover', color: '#a8ff8a', tags: ['attack', 'crit'] },
  { id: 'amber_crystal', name: 'Amber Crystal', slot: 'magic', cost: 450, stats: { ap: 22 }, tier: 1, icon: 'crystal', color: '#c99bff', tags: ['magic'] },
  { id: 'glow_pearl', name: 'Glow Pearl', slot: 'magic', cost: 500, stats: { ap: 15, mana: 160 }, tier: 1, icon: 'pearl', color: '#8fd8ff', tags: ['magic', 'mana'] },
  { id: 'runed_acorn', name: 'Runed Acorn', slot: 'magic', cost: 650, stats: { ap: 18, abilityHaste: 10 }, tier: 1, icon: 'acorn', color: '#b08aff', tags: ['magic', 'haste'] },
  { id: 'hide_scrap', name: 'Hide Scrap', slot: 'defense', cost: 400, stats: { armor: 18 }, tier: 1, icon: 'plate', color: '#9fb4c9', tags: ['defense'] },
  { id: 'warded_cloth', name: 'Warded Cloth', slot: 'defense', cost: 400, stats: { mr: 20 }, tier: 1, icon: 'cloth', color: '#a8e0ff', tags: ['defense'] },
  { id: 'heartroot', name: 'Heartroot', slot: 'defense', cost: 550, stats: { hp: 180 }, tier: 1, icon: 'heart', color: '#ff6f9c', tags: ['defense', 'health'] },
  { id: 'iron_shell', name: 'Iron Shell Fragment', slot: 'defense', cost: 600, stats: { hp: 120, hpRegen: 6 }, tier: 1, icon: 'shell', color: '#6fe6c9', tags: ['defense', 'sustain'] },

  { id: 'trail_boots', name: 'Trail Boots', slot: 'boots', cost: 350, stats: { moveSpeed: 28 }, tier: 1, icon: 'boot', color: '#c9a86a', tags: ['boots'] },
  { id: 'sprinter_boots', name: 'Sprinter Treads', slot: 'boots', cost: 950, buildsFrom: ['trail_boots'], stats: { moveSpeed: 48 }, passive: 'move_out_of_combat', passiveText: 'Gain 25 extra movement speed while out of combat.', tier: 2, icon: 'boot-speed', color: '#7cffb0', tags: ['boots', 'speed'], unique: true },
  { id: 'berserk_boots', name: 'Berserker Treads', slot: 'boots', cost: 1000, buildsFrom: ['trail_boots', 'swift_paws'], stats: { moveSpeed: 40, attackSpeed: 0.2 }, tier: 2, icon: 'boot-attack', color: '#ffd24a', tags: ['boots', 'attack'], unique: true },
  { id: 'sorcerer_boots', name: 'Arcanist Treads', slot: 'boots', cost: 1000, buildsFrom: ['trail_boots'], stats: { moveSpeed: 40, magicPen: 16 }, tier: 2, icon: 'boot-magic', color: '#c99bff', tags: ['boots', 'magic'], unique: true },
  { id: 'warden_boots', name: 'Warden Treads', slot: 'boots', cost: 1000, buildsFrom: ['trail_boots', 'hide_scrap'], stats: { moveSpeed: 40, armor: 22, tenacity: 0.2 }, tier: 2, icon: 'boot-armor', color: '#9fb4c9', tags: ['boots', 'defense'], unique: true },
  { id: 'mercury_boots', name: 'Mercury Treads', slot: 'boots', cost: 1050, buildsFrom: ['trail_boots', 'warded_cloth'], stats: { moveSpeed: 40, mr: 26, tenacity: 0.3 }, tier: 2, icon: 'boot-mr', color: '#a8e0ff', tags: ['boots', 'defense'], unique: true },
  { id: 'cosmic_boots', name: 'Cosmic Treads', slot: 'boots', cost: 1100, buildsFrom: ['trail_boots', 'runed_acorn'], stats: { moveSpeed: 45, abilityHaste: 20 }, tier: 2, icon: 'boot-haste', color: '#b08aff', tags: ['boots', 'haste'], unique: true },

  { id: 'razor_edge', name: 'Razor Edge', slot: 'attack', cost: 1300, buildsFrom: ['sharp_claw', 'sharp_claw'], stats: { ad: 38 }, tier: 2, icon: 'blade', color: '#ff8a5c', tags: ['attack'] },
  { id: 'stalker_blade', name: 'Stalker Blade', slot: 'attack', cost: 1400, buildsFrom: ['sharp_claw', 'swift_paws'], stats: { ad: 25, attackSpeed: 0.2 }, tier: 2, icon: 'dagger', color: '#ffb07a', tags: ['attack'] },
  { id: 'vampire_fang', name: 'Vampiric Fang', slot: 'attack', cost: 1500, buildsFrom: ['hunters_fang'], stats: { ad: 30, lifesteal: 0.12 }, tier: 2, icon: 'fang-red', color: '#ff5c7a', tags: ['attack', 'sustain'] },
  { id: 'storm_core', name: 'Storm Core', slot: 'magic', cost: 1400, buildsFrom: ['amber_crystal', 'glow_pearl'], stats: { ap: 50, mana: 220 }, tier: 2, icon: 'orb', color: '#8fd8ff', tags: ['magic'] },
  { id: 'hex_prism', name: 'Hex Prism', slot: 'magic', cost: 1450, buildsFrom: ['amber_crystal', 'runed_acorn'], stats: { ap: 45, abilityHaste: 18 }, tier: 2, icon: 'prism', color: '#c99bff', tags: ['magic', 'haste'] },
  { id: 'bulwark_plate', name: 'Bulwark Plate', slot: 'defense', cost: 1300, buildsFrom: ['hide_scrap', 'heartroot'], stats: { armor: 35, hp: 200 }, tier: 2, icon: 'plate-big', color: '#9fb4c9', tags: ['defense'] },
  { id: 'spirit_veil', name: 'Spirit Veil', slot: 'defense', cost: 1350, buildsFrom: ['warded_cloth', 'heartroot'], stats: { mr: 38, hp: 200 }, tier: 2, icon: 'veil', color: '#a8e0ff', tags: ['defense'] },
  { id: 'giant_heart', name: 'Giant Heartroot', slot: 'defense', cost: 1400, buildsFrom: ['heartroot', 'iron_shell'], stats: { hp: 420, hpRegen: 10 }, tier: 2, icon: 'heart-big', color: '#ff6f9c', tags: ['defense', 'health'] },

  {
    id: 'thunderfang', name: 'Thunderfang', slot: 'legendary', cost: 3300, buildsFrom: ['razor_edge', 'stalker_blade'],
    stats: { ad: 65, attackSpeed: 0.25, critChance: 0.2 },
    passive: 'chain_lightning', passiveText: 'Every third attack chains lightning to 3 nearby enemies for 60 magic damage.',
    tier: 3, icon: 'thunder', color: '#8fe6ff', tags: ['attack', 'crit'], unique: true
  },
  {
    id: 'bloodmoon_edge', name: 'Bloodmoon Edge', slot: 'legendary', cost: 3200, buildsFrom: ['vampire_fang', 'razor_edge'],
    stats: { ad: 70, lifesteal: 0.18 },
    passive: 'heal_on_kill', passiveText: 'Takedowns restore 12% of maximum health and grant 30 movement speed for 4s.',
    tier: 3, icon: 'moonblade', color: '#ff4a5c', tags: ['attack', 'sustain'], unique: true
  },
  {
    id: 'stormpiercer', name: 'Stormpiercer', slot: 'legendary', cost: 3100, buildsFrom: ['razor_edge', 'sharp_claw'],
    stats: { ad: 60, armorPen: 28, abilityHaste: 15 },
    passive: 'shred_armor', passiveText: 'Attacks shred 6% of the target armor for 4s, stacking 5 times.',
    tier: 3, icon: 'pierce', color: '#ffd24a', tags: ['attack', 'penetration'], unique: true
  },
  {
    id: 'infinity_claw', name: 'Infinity Claw', slot: 'legendary', cost: 3600, buildsFrom: ['razor_edge', 'lucky_charm'],
    stats: { ad: 70, critChance: 0.25 },
    passive: 'crit_amplify', passiveText: 'Critical strikes deal an additional 35% damage.',
    tier: 3, icon: 'infinity', color: '#ffe680', tags: ['attack', 'crit'], unique: true
  },
  {
    id: 'tempest_bow', name: 'Tempest Bow', slot: 'legendary', cost: 3000, buildsFrom: ['stalker_blade', 'swift_paws'],
    stats: { ad: 45, attackSpeed: 0.45, moveSpeed: 25 },
    passive: 'splash_damage', passiveText: 'Attacks splash 40% damage to enemies behind the target.',
    tier: 3, icon: 'bow', color: '#7cffb0', tags: ['attack', 'speed'], unique: true
  },
  {
    id: 'kraken_tooth', name: 'Kraken Tooth', slot: 'legendary', cost: 3300, buildsFrom: ['stalker_blade', 'hunters_fang'],
    stats: { ad: 55, attackSpeed: 0.3, moveSpeed: 20 },
    passive: 'execute_low_hp', passiveText: 'Every third attack deals 12% of the target current health as true damage.',
    tier: 3, icon: 'kraken', color: '#5fd8ff', tags: ['attack', 'execute'], unique: true
  },
  {
    id: 'reapers_grin', name: 'Reaper Grin', slot: 'legendary', cost: 3100, buildsFrom: ['razor_edge', 'hide_scrap'],
    stats: { ad: 55, armor: 25, abilityHaste: 20 },
    passive: 'first_strike', passiveText: 'The first attack on a target deals 50 plus 15% bonus AD extra physical damage.',
    tier: 3, icon: 'scythe', color: '#c9f06a', tags: ['attack', 'bruiser'], unique: true
  },
  {
    id: 'muramasa_paw', name: 'Muramasa Paw', slot: 'legendary', cost: 3400, buildsFrom: ['razor_edge', 'giant_heart'],
    stats: { ad: 60, hp: 380, abilityHaste: 15 },
    passive: 'mana_to_ad', passiveText: 'Gain bonus attack damage equal to 2% of maximum health.',
    tier: 3, icon: 'katana', color: '#ff8a3c', tags: ['attack', 'bruiser'], unique: true
  },

  {
    id: 'sunfire_pendant', name: 'Sunfire Pendant', slot: 'legendary', cost: 3000, buildsFrom: ['bulwark_plate', 'iron_shell'],
    stats: { hp: 480, armor: 45 },
    passive: 'burn_on_hit', passiveText: 'Burns nearby enemies for 30 plus 1.5% bonus health magic damage each second.',
    tier: 3, icon: 'sunfire', color: '#ff8a3c', tags: ['defense', 'damage'], unique: true
  },
  {
    id: 'thornmail_hide', name: 'Thornmail Hide', slot: 'legendary', cost: 2900, buildsFrom: ['bulwark_plate', 'hide_scrap'],
    stats: { hp: 320, armor: 70 },
    passive: 'thorns', passiveText: 'Reflects 25% of physical damage taken and applies 40% healing reduction.',
    tier: 3, icon: 'thorn', color: '#a8d84a', tags: ['defense', 'anti-attack'], unique: true
  },
  {
    id: 'aegis_of_dawn', name: 'Aegis of Dawn', slot: 'legendary', cost: 2800, buildsFrom: ['spirit_veil', 'iron_shell'],
    stats: { hp: 420, mr: 60, hpRegen: 12 },
    passive: 'shield_on_low', passiveText: 'Falling below 30% health grants a shield for 240 plus 15% bonus health. 90s cooldown.',
    tier: 3, icon: 'aegis', color: '#a8e0ff', tags: ['defense'], unique: true
  },
  {
    id: 'titan_barkplate', name: 'Titan Barkplate', slot: 'legendary', cost: 3200, buildsFrom: ['giant_heart', 'bulwark_plate'],
    stats: { hp: 750, armor: 30, hpRegen: 16 },
    passive: 'none', passiveText: 'Grants 30 tenacity and 12% bonus size, because presence matters.',
    tier: 3, icon: 'titan', color: '#c9a86a', tags: ['defense', 'health'], unique: true
  },
  {
    id: 'guardian_mantle', name: 'Guardian Mantle', slot: 'legendary', cost: 2600, buildsFrom: ['spirit_veil', 'loyal_collar'],
    stats: { hp: 360, mr: 40, armor: 25, abilityHaste: 15 },
    passive: 'aura_armor', passiveText: 'Nearby allies gain 20 armor and 20 magic resist.',
    active: 'shield_ally', activeText: 'Shield a nearby ally for 280 health for 3s.', activeCooldown: 70,
    tier: 3, icon: 'mantle', color: '#7cffb0', tags: ['defense', 'support'], unique: true
  },
  {
    id: 'phantom_shroud', name: 'Phantom Shroud', slot: 'legendary', cost: 2700, buildsFrom: ['spirit_veil'],
    stats: { hp: 300, mr: 55, abilityHaste: 20 },
    active: 'cleanse', activeText: 'Remove all crowd control and gain 30% movement speed for 2s.', activeCooldown: 90,
    tier: 3, icon: 'shroud', color: '#b9d4ff', tags: ['defense', 'utility'], unique: true
  },

  {
    id: 'void_scepter', name: 'Void Scepter', slot: 'legendary', cost: 3200, buildsFrom: ['storm_core', 'amber_crystal'],
    stats: { ap: 110, magicPen: 22 },
    passive: 'none', passiveText: 'Grants 30% magic penetration against targets with bonus magic resist.',
    tier: 3, icon: 'scepter', color: '#b04cff', tags: ['magic', 'penetration'], unique: true
  },
  {
    id: 'echo_conduit', name: 'Echo Conduit', slot: 'legendary', cost: 3100, buildsFrom: ['hex_prism', 'glow_pearl'],
    stats: { ap: 95, mana: 400, abilityHaste: 25 },
    passive: 'spell_echo', passiveText: 'Abilities echo, dealing 40% of their damage again after 1s.',
    tier: 3, icon: 'echo', color: '#8fd8ff', tags: ['magic', 'haste'], unique: true
  },
  {
    id: 'emberheart_staff', name: 'Emberheart Staff', slot: 'legendary', cost: 3000, buildsFrom: ['storm_core', 'runed_acorn'],
    stats: { ap: 105, hp: 250 },
    passive: 'burn_on_hit', passiveText: 'Abilities set targets alight for 45 magic damage per second for 3s.',
    tier: 3, icon: 'ember', color: '#ff6a2c', tags: ['magic', 'burn'], unique: true
  },
  {
    id: 'glacier_orb', name: 'Glacier Orb', slot: 'legendary', cost: 2900, buildsFrom: ['storm_core', 'iron_shell'],
    stats: { ap: 85, hp: 320, mana: 300 },
    passive: 'slow_on_hit', passiveText: 'Damaging abilities slow the target by 30% for 1.5s.',
    tier: 3, icon: 'glacier', color: '#7fe6ff', tags: ['magic', 'control'], unique: true
  },
  {
    id: 'soul_harvester', name: 'Soul Harvester', slot: 'legendary', cost: 3200, buildsFrom: ['hex_prism', 'amber_crystal'],
    stats: { ap: 90, abilityHaste: 20, spellVamp: 0.12 },
    passive: 'stack_ap_on_kill', passiveText: 'Takedowns grant 8 permanent ability power, up to 80.',
    tier: 3, icon: 'soul', color: '#a06bff', tags: ['magic', 'snowball'], unique: true
  },
  {
    id: 'lifebloom_censer', name: 'Lifebloom Censer', slot: 'legendary', cost: 2800, buildsFrom: ['hex_prism', 'loyal_collar'],
    stats: { ap: 75, hp: 260, abilityHaste: 25, manaRegen: 12 },
    passive: 'life_on_spell', passiveText: 'Healing and shielding are 20% stronger, and abilities mend nearby allies for 30 health.',
    active: 'heal_burst', activeText: 'Restore 260 health to nearby allies.', activeCooldown: 80,
    tier: 3, icon: 'censer', color: '#7cffb0', tags: ['magic', 'support'], unique: true
  },
  {
    id: 'grievous_thorn', name: 'Grievous Thorn', slot: 'legendary', cost: 2600, buildsFrom: ['amber_crystal', 'hide_scrap'],
    stats: { ap: 60, armor: 30, abilityHaste: 15 },
    passive: 'reduce_healing', passiveText: 'Damage you deal cuts enemy healing by 45% for 3s.',
    tier: 3, icon: 'grievous', color: '#c9f06a', tags: ['magic', 'anti-heal'], unique: true
  },
  {
    id: 'siege_catapult', name: 'Siege Catapult', slot: 'legendary', cost: 2500, buildsFrom: ['razor_edge'],
    stats: { ad: 45, abilityHaste: 20, hp: 200 },
    passive: 'bonus_vs_towers', passiveText: 'Deals 60% bonus damage to turrets and 20% bonus damage to minions.',
    tier: 3, icon: 'catapult', color: '#c9a86a', tags: ['attack', 'siege'], unique: true
  },

  {
    id: 'stasis_locket', name: 'Stasis Locket', slot: 'legendary', cost: 2500, buildsFrom: ['warded_cloth', 'heartroot'],
    stats: { hp: 280, mr: 35, abilityHaste: 10 },
    active: 'stasis', activeText: 'Become invulnerable and untargetable for 2.5s but unable to act.', activeCooldown: 120,
    tier: 3, icon: 'locket', color: '#ffe680', tags: ['defense', 'utility'], unique: true
  },
  {
    id: 'quicksilver_charm', name: 'Quicksilver Charm', slot: 'legendary', cost: 2600, buildsFrom: ['warded_cloth', 'swift_paws'],
    stats: { ad: 30, mr: 40, attackSpeed: 0.2, tenacity: 0.3 },
    active: 'cleanse', activeText: 'Remove all crowd control affecting you.', activeCooldown: 90,
    tier: 3, icon: 'quicksilver', color: '#d7e6ff', tags: ['defense', 'utility'], unique: true
  },
  {
    id: 'zephyr_totem', name: 'Zephyr Totem', slot: 'support', cost: 2200, buildsFrom: ['loyal_collar', 'glow_pearl'],
    stats: { ap: 45, hp: 220, moveSpeedPct: 0.06, abilityHaste: 15 },
    passive: 'aura_ap', passiveText: 'Nearby allies gain 25 ability power and 20 attack damage.',
    active: 'speed_boost', activeText: 'Grant nearby allies 40% movement speed for 3s.', activeCooldown: 75,
    tier: 3, icon: 'totem', color: '#8fe6ff', tags: ['support'], unique: true
  },
  {
    id: 'sentinel_lantern', name: 'Sentinel Lantern', slot: 'support', cost: 1800, buildsFrom: ['loyal_collar'],
    stats: { hp: 200, armor: 20, mr: 20, hpRegen: 10 },
    passive: 'vision_ward', passiveText: 'Grants a large vision radius and reveals stealthed enemies nearby.',
    active: 'ward', activeText: 'Place a watcher that grants vision for 90s.', activeCooldown: 45,
    tier: 3, icon: 'lantern', color: '#ffe680', tags: ['support', 'vision'], unique: true
  },
  {
    id: 'beastcaller_horn', name: 'Beastcaller Horn', slot: 'jungle', cost: 1200, buildsFrom: ['squeaky_bone'],
    stats: { ad: 25, hpRegen: 8, moveSpeed: 20 },
    passive: 'jungle_smite', passiveText: 'Deal 25% bonus damage to jungle monsters and heal for 15% of it.',
    active: 'smite', activeText: 'Deal 600 true damage to a monster or minion.', activeCooldown: 80,
    tier: 2, icon: 'horn', color: '#a8d84a', tags: ['jungle'], unique: true
  },
  {
    id: 'primal_tusk', name: 'Primal Tusk', slot: 'jungle', cost: 2600, buildsFrom: ['beastcaller_horn', 'giant_heart'],
    stats: { ad: 45, hp: 420, abilityHaste: 15, moveSpeed: 25 },
    passive: 'jungle_smite', passiveText: 'Smite also stuns enemy heroes for 0.8s and deals 180 true damage.',
    active: 'smite', activeText: 'Deal 900 true damage to a monster, or 240 and a stun to a hero.', activeCooldown: 70,
    tier: 3, icon: 'tusk', color: '#ff8a3c', tags: ['jungle'], unique: true
  },

  { id: 'health_treat', name: 'Health Treat', slot: 'consumable', cost: 50, stats: {}, active: 'heal_burst', activeText: 'Restore 160 health over 8s.', activeCooldown: 1, tier: 1, icon: 'treat', color: '#ff6f9c', tags: ['consumable'] },
  { id: 'mana_treat', name: 'Mana Biscuit', slot: 'consumable', cost: 50, stats: {}, active: 'heal_burst', activeText: 'Restore 120 mana over 8s.', activeCooldown: 1, tier: 1, icon: 'biscuit', color: '#8fd8ff', tags: ['consumable'] },
  { id: 'watcher_seed', name: 'Watcher Seed', slot: 'consumable', cost: 75, stats: {}, active: 'ward', activeText: 'Plant a watcher granting vision for 60s.', activeCooldown: 1, tier: 1, icon: 'seed', color: '#c9f06a', tags: ['consumable', 'vision'] },
  { id: 'sprint_snack', name: 'Sprint Snack', slot: 'consumable', cost: 90, stats: {}, active: 'speed_boost', activeText: 'Gain 35% movement speed for 4s.', activeCooldown: 1, tier: 1, icon: 'snack', color: '#7cffb0', tags: ['consumable'] },
  { id: 'elixir_of_might', name: 'Elixir of Might', slot: 'consumable', cost: 350, stats: {}, active: 'speed_boost', activeText: 'Gain 30 attack damage and 50 ability power for 180s.', activeCooldown: 1, tier: 1, icon: 'elixir', color: '#ff8a3c', tags: ['consumable'] }
];

function totalCostOf(item: ItemInput, index: Map<string, ItemInput>): number {
  return item.cost;
}

const index = new Map(raw.map((r) => [r.id, r]));

export const ITEMS: ItemDef[] = raw.map((r) => ({
  id: r.id,
  name: r.name,
  slot: r.slot,
  cost: r.cost,
  totalCost: totalCostOf(r, index),
  buildsFrom: r.buildsFrom ?? [],
  stats: r.stats,
  passive: r.passive ?? 'none',
  passiveText: r.passiveText ?? '',
  active: r.active ?? 'none',
  activeText: r.activeText ?? '',
  activeCooldown: r.activeCooldown ?? 0,
  tier: r.tier,
  icon: r.icon,
  color: r.color,
  tags: r.tags,
  unique: r.unique ?? false
}));

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef | undefined {
  return ITEM_BY_ID.get(id);
}

export function itemsForSlot(slot: ItemSlot): ItemDef[] {
  return ITEMS.filter((i) => i.slot === slot);
}

export function componentCost(item: ItemDef): number {
  const parts = item.buildsFrom.map((id) => ITEM_BY_ID.get(id)).filter(Boolean) as ItemDef[];
  return item.cost - parts.reduce((sum, p) => sum + p.cost, 0);
}

export const RECOMMENDED_BUILDS: Record<string, string[]> = {
  bolt: ['squeaky_bone', 'berserk_boots', 'thunderfang', 'infinity_claw', 'bloodmoon_edge', 'tempest_bow', 'quicksilver_charm'],
  mochi: ['squeaky_bone', 'sprinter_boots', 'stormpiercer', 'bloodmoon_edge', 'muramasa_paw', 'reapers_grin', 'stasis_locket'],
  bruno: ['loyal_collar', 'warden_boots', 'sunfire_pendant', 'titan_barkplate', 'thornmail_hide', 'aegis_of_dawn', 'guardian_mantle'],
  nimbus: ['chew_ring', 'cosmic_boots', 'lifebloom_censer', 'zephyr_totem', 'echo_conduit', 'guardian_mantle', 'sentinel_lantern'],
  blaze: ['chew_ring', 'sorcerer_boots', 'emberheart_staff', 'void_scepter', 'echo_conduit', 'soul_harvester', 'glacier_orb'],
  rex: ['squeaky_bone', 'berserk_boots', 'kraken_tooth', 'infinity_claw', 'tempest_bow', 'bloodmoon_edge', 'phantom_shroud'],
  hammer: ['squeaky_bone', 'mercury_boots', 'primal_tusk', 'muramasa_paw', 'sunfire_pendant', 'titan_barkplate', 'reapers_grin'],
  shelly: ['loyal_collar', 'mercury_boots', 'guardian_mantle', 'aegis_of_dawn', 'thornmail_hide', 'titan_barkplate', 'sentinel_lantern'],
  vex: ['squeaky_bone', 'sprinter_boots', 'stormpiercer', 'bloodmoon_edge', 'infinity_claw', 'quicksilver_charm', 'reapers_grin'],
  luna: ['chew_ring', 'sorcerer_boots', 'void_scepter', 'echo_conduit', 'glacier_orb', 'soul_harvester', 'stasis_locket'],
  quill: ['squeaky_bone', 'warden_boots', 'sunfire_pendant', 'thornmail_hide', 'muramasa_paw', 'titan_barkplate', 'aegis_of_dawn'],
  koi: ['chew_ring', 'cosmic_boots', 'lifebloom_censer', 'zephyr_totem', 'glacier_orb', 'guardian_mantle', 'echo_conduit'],
  tank: ['loyal_collar', 'warden_boots', 'sunfire_pendant', 'titan_barkplate', 'aegis_of_dawn', 'thornmail_hide', 'guardian_mantle']
};

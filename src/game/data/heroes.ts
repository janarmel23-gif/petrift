import type { HeroDef, PetPalette, SkillDef, SkillKey, SkillShape, SkinDef, SkinRarity, SummonerSpellDef } from './types';

const skillDefaults: Omit<SkillDef, 'key' | 'id' | 'name' | 'shape' | 'description'> = {
  damageType: 'magic',
  baseDamage: [0, 0, 0, 0, 0],
  adRatio: 0,
  apRatio: 0,
  cooldown: [10, 9, 8, 7, 6],
  manaCost: [50, 55, 60, 65, 70],
  range: 700,
  radius: 0,
  width: 90,
  speed: 1500,
  castTime: 0.22,
  duration: 0,
  charges: 1,
  healBase: [0, 0, 0, 0, 0],
  healApRatio: 0,
  shieldBase: [0, 0, 0, 0, 0],
  shieldApRatio: 0,
  status: {},
  vfx: 'spark',
  color: '#7cd8ff',
  targetsAllies: false,
  maxTargets: 1,
  ultimate: false
};

function skill(key: SkillKey, id: string, name: string, shape: SkillShape, description: string, over: Partial<SkillDef> = {}): SkillDef {
  return { ...skillDefaults, key, id, name, shape, description, ultimate: key === 'R', ...over };
}

function skin(
  heroId: string,
  slug: string,
  name: string,
  rarity: SkinRarity,
  price: number,
  currency: 'coins' | 'gems',
  palette: PetPalette,
  over: Partial<SkinDef> = {}
): SkinDef {
  return {
    id: `${heroId}:${slug}`,
    name,
    rarity,
    price,
    currency,
    palette,
    aura: palette.glow,
    trail: palette.accent,
    spellColor: palette.glow,
    extras: [],
    blurb: '',
    ...over
  };
}

const pal = (fur: string, furDark: string, belly: string, accent: string, eye: string, glow: string): PetPalette => ({
  fur,
  furDark,
  belly,
  accent,
  eye,
  glow
});

export const HEROES: HeroDef[] = [
  {
    id: 'bolt',
    name: 'Bolt',
    title: 'the Static Sprinter',
    species: 'Corgi',
    role: 'Marksman',
    secondaryRole: 'Fighter',
    difficulty: 1,
    price: 0,
    lane: 'bot',
    resource: 'mana',
    lore: 'A courier corgi struck by a storm crystal. He has been outrunning thunder ever since, and winning.',
    stats: {
      hp: 610,
      hpPerLevel: 96,
      hpRegen: 3.6,
      mana: 320,
      manaPerLevel: 38,
      manaRegen: 7.2,
      ad: 62,
      adPerLevel: 3.1,
      ap: 0,
      armor: 26,
      armorPerLevel: 4.1,
      mr: 30,
      mrPerLevel: 1.3,
      attackSpeed: 0.68,
      attackSpeedPerLevel: 0.032,
      attackRange: 540,
      moveSpeed: 330,
      critChance: 0,
      radius: 30
    },
    art: {
      body: 'long',
      ears: 'perk',
      tail: 'stub',
      legs: 'short',
      features: ['whiskers'],
      weapon: 'bow',
      scale: 1,
      palette: pal('#e6a860', '#b97c38', '#fbf0da', '#7cd8ff', '#2a2118', '#8fe6ff')
    },
    skills: [
      skill('P', 'bolt_overcharge', 'Overcharge', 'self', 'Every third basic attack arcs lightning, dealing bonus magic damage and briefly slowing.', {
        baseDamage: [14, 22, 30, 38, 46],
        apRatio: 0.25,
        color: '#8fe6ff',
        vfx: 'arc'
      }),
      skill('Q', 'bolt_voltbolt', 'Volt Bolt', 'piercing', 'Fires a charged arrow that pierces every enemy in a line.', {
        damageType: 'physical',
        baseDamage: [55, 90, 125, 160, 195],
        adRatio: 0.85,
        cooldown: [8, 7.2, 6.4, 5.6, 4.8],
        manaCost: [45, 50, 55, 60, 65],
        range: 900,
        width: 70,
        speed: 1900,
        color: '#ffe680',
        vfx: 'arrow',
        maxTargets: 6
      }),
      skill('W', 'bolt_zoomies', 'Zoomies', 'self', 'Bolt sprints with a burst of movement and attack speed.', {
        cooldown: [16, 15, 14, 13, 12],
        manaCost: [40, 40, 40, 40, 40],
        duration: 4,
        castTime: 0,
        status: { haste: { amount: 0.4, duration: 4 }, attackSpeed: { amount: 0.45, duration: 4 } },
        color: '#7cffb0',
        vfx: 'speedlines'
      }),
      skill('E', 'bolt_staticleap', 'Static Leap', 'dash', 'Leaps forward and discharges static on landing, slowing everyone hit.', {
        damageType: 'magic',
        baseDamage: [60, 95, 130, 165, 200],
        apRatio: 0.5,
        adRatio: 0.3,
        cooldown: [14, 13, 12, 11, 10],
        manaCost: [60, 60, 60, 60, 60],
        range: 430,
        radius: 220,
        speed: 1350,
        status: { slow: { amount: 0.4, duration: 1.8 } },
        color: '#8fe6ff',
        vfx: 'shockwave'
      }),
      skill('R', 'bolt_thunderhowl', 'Thunder Howl', 'cone', 'A deafening howl blasts a cone of thunder, stunning and shredding everything in front of him.', {
        damageType: 'magic',
        baseDamage: [260, 400, 540],
        apRatio: 0.85,
        adRatio: 0.6,
        cooldown: [110, 95, 80],
        manaCost: [100, 100, 100],
        range: 780,
        width: 120,
        castTime: 0.4,
        status: { stun: 1.1, slow: { amount: 0.5, duration: 2 } },
        color: '#c9f0ff',
        vfx: 'thunder',
        maxTargets: 12
      })
    ],
    skins: [
      skin('bolt', 'default', 'Storm Courier', 'default', 0, 'coins', pal('#e6a860', '#b97c38', '#fbf0da', '#7cd8ff', '#2a2118', '#8fe6ff'), {
        blurb: 'The original lightning-touched courier.'
      }),
      skin('bolt', 'arcade', 'Arcade Bolt', 'rare', 3200, 'coins', pal('#ff77c8', '#b93f8f', '#ffe9fb', '#57f5ff', '#1b1030', '#57f5ff'), {
        extras: ['circuit', 'sparks'],
        blurb: 'Eight bits of pure zoomies.'
      }),
      skin('bolt', 'frostguard', 'Frostguard Bolt', 'epic', 6400, 'coins', pal('#cfe9ff', '#7ea8d4', '#ffffff', '#9ff3ff', '#123048', '#bff0ff'), {
        extras: ['frost', 'stars'],
        weapon: 'bow',
        blurb: 'Forged in the glacier kennels of the north.'
      }),
      skin('bolt', 'celestial', 'Celestial Herald', 'legendary', 425, 'gems', pal('#ffd98a', '#c99a3c', '#fff6e0', '#b98cff', '#2a1a40', '#d7b4ff'), {
        extras: ['stars', 'sparks'],
        weapon: 'cannon',
        blurb: 'He carries the mail of the heavens, and it is always urgent.'
      })
    ],
    tips: ['Land Volt Bolt through minion waves to poke the enemy carry.', 'Zoomies is a chase tool and an escape tool, do not waste it.']
  },

  {
    id: 'mochi',
    name: 'Mochi',
    title: 'the Velvet Shadow',
    species: 'Cat',
    role: 'Assassin',
    secondaryRole: 'Fighter',
    difficulty: 3,
    price: 0,
    lane: 'jungle',
    resource: 'energy',
    lore: 'She naps eighteen hours a day. The other six belong to whoever crossed her.',
    stats: {
      hp: 640,
      hpPerLevel: 102,
      hpRegen: 5.2,
      mana: 260,
      manaPerLevel: 26,
      manaRegen: 9,
      ad: 66,
      adPerLevel: 3.4,
      ap: 0,
      armor: 32,
      armorPerLevel: 4.3,
      mr: 32,
      mrPerLevel: 1.4,
      attackSpeed: 0.7,
      attackSpeedPerLevel: 0.031,
      attackRange: 155,
      moveSpeed: 345,
      critChance: 0,
      radius: 30
    },
    art: {
      body: 'slim',
      ears: 'perk',
      tail: 'long',
      legs: 'normal',
      features: ['whiskers'],
      weapon: 'blade',
      scale: 0.98,
      palette: pal('#8b6bb5', '#5b3f84', '#efe6ff', '#ff7ad9', '#ffd84d', '#c79bff')
    },
    skills: [
      skill('P', 'mochi_ninelives', 'Nine Lives', 'self', 'Takedowns restore health and instantly refresh Pounce.', {
        healBase: [40, 70, 100, 130, 160],
        color: '#ff7ad9',
        vfx: 'soul'
      }),
      skill('Q', 'mochi_clawflurry', 'Claw Flurry', 'cone', 'Three lightning-fast slashes in a cone that shred armor.', {
        damageType: 'physical',
        baseDamage: [70, 110, 150, 190, 230],
        adRatio: 0.95,
        cooldown: [7, 6.5, 6, 5.5, 5],
        manaCost: [40, 42, 44, 46, 48],
        range: 330,
        width: 150,
        castTime: 0.15,
        color: '#ff7ad9',
        vfx: 'slash',
        maxTargets: 6
      }),
      skill('W', 'mochi_shadowstep', 'Shadowstep', 'blink', 'Slips into the shadows, becoming briefly untargetable and gaining movement speed.', {
        cooldown: [18, 16.5, 15, 13.5, 12],
        manaCost: [50, 50, 50, 50, 50],
        range: 420,
        duration: 2.2,
        castTime: 0,
        status: { stealth: 2.2, haste: { amount: 0.35, duration: 2.2 } },
        color: '#a06bff',
        vfx: 'smoke'
      }),
      skill('E', 'mochi_pounce', 'Pounce', 'dash', 'Leaps at a target, slashing on arrival. Refunds on takedown.', {
        damageType: 'physical',
        baseDamage: [65, 105, 145, 185, 225],
        adRatio: 0.7,
        cooldown: [12, 11, 10, 9, 8],
        manaCost: [45, 45, 45, 45, 45],
        range: 560,
        radius: 150,
        speed: 1700,
        color: '#ffd84d',
        vfx: 'claw'
      }),
      skill('R', 'mochi_felinefury', 'Feline Fury', 'circle', 'A blur of nine strikes around her, executing enemies below a health threshold.', {
        damageType: 'physical',
        baseDamage: [220, 340, 460],
        adRatio: 1.35,
        cooldown: [100, 85, 70],
        manaCost: [80, 80, 80],
        range: 0,
        radius: 320,
        castTime: 0.5,
        duration: 1.2,
        status: { mark: 3 },
        color: '#ff4fa8',
        vfx: 'furyburst',
        maxTargets: 8
      })
    ],
    skins: [
      skin('mochi', 'default', 'Velvet Shadow', 'default', 0, 'coins', pal('#8b6bb5', '#5b3f84', '#efe6ff', '#ff7ad9', '#ffd84d', '#c79bff'), {
        blurb: 'Silk fur, silent paws.'
      }),
      skin('mochi', 'sakura', 'Sakura Mochi', 'rare', 3200, 'coins', pal('#ffd2e3', '#d98db0', '#fff6fa', '#ff6f9c', '#5a2a3a', '#ffa8c8'), {
        extras: ['petals'],
        blurb: 'Blossom season, and she is the storm inside it.'
      }),
      skin('mochi', 'voidclaw', 'Voidclaw', 'epic', 6400, 'coins', pal('#2f2350', '#150e2a', '#6c4fa8', '#b04cff', '#ff3d6e', '#b04cff'), {
        extras: ['void'],
        blurb: 'She napped in a rift once. It changed her.'
      }),
      skin('mochi', 'divine', 'Divine Ninetails', 'mythic', 725, 'gems', pal('#fff1c9', '#e0bd72', '#ffffff', '#ff9f4a', '#ff4d4d', '#ffca6a'), {
        extras: ['flames', 'stars'],
        weapon: 'blade',
        blurb: 'Nine lives, nine tails, one very bad mood.'
      })
    ],
    tips: ['Open with Pounce, then Claw Flurry while the target is inside your cone.', 'Shadowstep can dodge projectiles if you time the untargetable window.']
  },

  {
    id: 'bruno',
    name: 'Bruno',
    title: 'the Iron Jaw',
    species: 'Bulldog',
    role: 'Tank',
    secondaryRole: 'Fighter',
    difficulty: 1,
    price: 0,
    lane: 'top',
    resource: 'mana',
    lore: 'He has never lost a tug-of-war. The rope always loses first.',
    stats: {
      hp: 830,
      hpPerLevel: 128,
      hpRegen: 8.4,
      mana: 300,
      manaPerLevel: 42,
      manaRegen: 8,
      ad: 64,
      adPerLevel: 3.6,
      ap: 0,
      armor: 42,
      armorPerLevel: 5.2,
      mr: 36,
      mrPerLevel: 1.8,
      attackSpeed: 0.6,
      attackSpeedPerLevel: 0.022,
      attackRange: 170,
      moveSpeed: 325,
      critChance: 0,
      radius: 36
    },
    art: {
      body: 'chunky',
      ears: 'flop',
      tail: 'stub',
      legs: 'short',
      features: ['mane'],
      weapon: 'shield',
      scale: 1.18,
      palette: pal('#a9906f', '#6f5a3e', '#f0e3cb', '#ff9b3d', '#3a2a18', '#ffb35c')
    },
    skills: [
      skill('P', 'bruno_stubbornhide', 'Stubborn Hide', 'self', 'Gains armor and magic resist that scale with missing health.', {
        color: '#ffb35c',
        vfx: 'ironskin'
      }),
      skill('Q', 'bruno_bonecrusher', 'Bone Crusher', 'circle', 'Slams a bone club down, knocking enemies into the air.', {
        damageType: 'physical',
        baseDamage: [80, 125, 170, 215, 260],
        adRatio: 0.8,
        cooldown: [11, 10, 9, 8, 7],
        manaCost: [55, 58, 61, 64, 67],
        range: 300,
        radius: 250,
        castTime: 0.4,
        status: { knockup: 0.65, slow: { amount: 0.3, duration: 1.2 } },
        color: '#ffb35c',
        vfx: 'slam',
        maxTargets: 8
      }),
      skill('W', 'bruno_bulwark', 'Bulwark', 'self', 'Braces behind his shield, gaining a barrier and taunting nearby enemies.', {
        cooldown: [20, 19, 18, 17, 16],
        manaCost: [60, 60, 60, 60, 60],
        radius: 300,
        duration: 3,
        castTime: 0.1,
        shieldBase: [110, 180, 250, 320, 390],
        shieldApRatio: 0.7,
        status: { root: 0.9 },
        color: '#ffd9a0',
        vfx: 'bulwark',
        maxTargets: 6
      }),
      skill('E', 'bruno_rollingcharge', 'Rolling Charge', 'dash', 'Barrels forward, shoving enemies back and staggering them.', {
        damageType: 'physical',
        baseDamage: [70, 110, 150, 190, 230],
        adRatio: 0.6,
        cooldown: [16, 15, 14, 13, 12],
        manaCost: [70, 70, 70, 70, 70],
        range: 620,
        radius: 170,
        speed: 1250,
        status: { knockback: 220, slow: { amount: 0.35, duration: 1.4 } },
        color: '#ff9b3d',
        vfx: 'charge',
        maxTargets: 5
      }),
      skill('R', 'bruno_guardianroar', 'Guardian Roar', 'aura', 'Roars to shield every nearby ally and terrify enemies.', {
        damageType: 'magic',
        baseDamage: [140, 220, 300],
        apRatio: 0.5,
        cooldown: [120, 105, 90],
        manaCost: [100, 100, 100],
        radius: 620,
        duration: 5,
        castTime: 0.45,
        shieldBase: [200, 320, 440],
        shieldApRatio: 1,
        status: { slow: { amount: 0.4, duration: 2.5 }, fear: 1 },
        targetsAllies: true,
        color: '#ffcf80',
        vfx: 'roar',
        maxTargets: 10
      })
    ],
    skins: [
      skin('bruno', 'default', 'Iron Jaw', 'default', 0, 'coins', pal('#a9906f', '#6f5a3e', '#f0e3cb', '#ff9b3d', '#3a2a18', '#ffb35c'), {
        blurb: 'Stubborn since the day he was adopted.'
      }),
      skin('bruno', 'praetorian', 'Praetorian Bruno', 'rare', 3200, 'coins', pal('#c9ccd6', '#7b8090', '#eef1f7', '#d94b3a', '#2b2f38', '#ff8f6a'), {
        extras: ['sparks'],
        blurb: 'Standard-bearer of the kennel legion.'
      }),
      skin('bruno', 'magmahide', 'Magmahide', 'epic', 6400, 'coins', pal('#5c2f24', '#2e1612', '#ff7a35', '#ffbb3d', '#ffe066', '#ff8a2c'), {
        extras: ['flames', 'embers'],
        blurb: 'Sleeps in the caldera. Snores smoke.'
      }),
      skin('bruno', 'titanguard', 'Titanguard', 'legendary', 425, 'gems', pal('#3d6fa8', '#22405f', '#cbe6ff', '#6ff0d8', '#d8f6ff', '#6ff0d8'), {
        extras: ['circuit', 'frost'],
        weapon: 'shield',
        blurb: 'They built a wall. Then they gave it a wagging tail.'
      })
    ],
    tips: ['Bone Crusher then Rolling Charge locks a target for your team.', 'Bulwark is strongest when several enemies are in the taunt radius.']
  },

  {
    id: 'nimbus',
    name: 'Nimbus',
    title: 'the Cloudhopper',
    species: 'Rabbit',
    role: 'Support',
    secondaryRole: 'Mage',
    difficulty: 1,
    price: 0,
    lane: 'support',
    resource: 'mana',
    lore: 'She hops between clouds delivering good luck. Occasionally she delivers a carrot at terminal velocity.',
    stats: {
      hp: 570,
      hpPerLevel: 90,
      hpRegen: 4.4,
      mana: 420,
      manaPerLevel: 52,
      manaRegen: 11,
      ad: 51,
      adPerLevel: 2.6,
      ap: 0,
      armor: 24,
      armorPerLevel: 3.8,
      mr: 32,
      mrPerLevel: 1.4,
      attackSpeed: 0.62,
      attackSpeedPerLevel: 0.021,
      attackRange: 520,
      moveSpeed: 335,
      critChance: 0,
      radius: 28
    },
    art: {
      body: 'round',
      ears: 'long',
      tail: 'stub',
      legs: 'normal',
      features: ['whiskers'],
      weapon: 'wand',
      scale: 0.94,
      palette: pal('#f4f1ff', '#c8c2e4', '#ffffff', '#8fd9ff', '#ff8fb0', '#a8e6ff')
    },
    skills: [
      skill('P', 'nimbus_luckyfoot', 'Lucky Foot', 'aura', 'Nearby allies slowly regenerate health while Nimbus is close.', {
        healBase: [8, 14, 20, 26, 32],
        healApRatio: 0.08,
        radius: 520,
        targetsAllies: true,
        color: '#a8e6ff',
        vfx: 'clover'
      }),
      skill('Q', 'nimbus_carrottoss', 'Carrot Toss', 'projectile', 'Hurls an enchanted carrot that bursts on impact.', {
        baseDamage: [65, 105, 145, 185, 225],
        apRatio: 0.6,
        cooldown: [7, 6.5, 6, 5.5, 5],
        manaCost: [50, 55, 60, 65, 70],
        range: 850,
        radius: 140,
        speed: 1500,
        status: { slow: { amount: 0.25, duration: 1.2 } },
        color: '#ff9e4a',
        vfx: 'carrot'
      }),
      skill('W', 'nimbus_hopheal', 'Hop Heal', 'targeted', 'Blesses an ally, restoring health and granting a burst of speed.', {
        cooldown: [13, 12, 11, 10, 9],
        manaCost: [70, 75, 80, 85, 90],
        range: 700,
        healBase: [90, 140, 190, 240, 290],
        healApRatio: 0.65,
        duration: 2.5,
        status: { haste: { amount: 0.3, duration: 2.5 } },
        targetsAllies: true,
        color: '#7cffb0',
        vfx: 'bloom'
      }),
      skill('E', 'nimbus_burrowdash', 'Burrow Dash', 'blink', 'Burrows underground and pops out a short distance away.', {
        cooldown: [17, 16, 15, 14, 13],
        manaCost: [60, 60, 60, 60, 60],
        range: 480,
        castTime: 0.1,
        color: '#c9b08a',
        vfx: 'burrow'
      }),
      skill('R', 'nimbus_moonfall', 'Moonfall Blessing', 'aura', 'Calls down moonlight that heals and shields every nearby ally.', {
        cooldown: [130, 115, 100],
        manaCost: [100, 100, 100],
        radius: 780,
        duration: 4,
        castTime: 0.6,
        healBase: [220, 330, 440],
        healApRatio: 0.9,
        shieldBase: [140, 220, 300],
        shieldApRatio: 0.5,
        status: { haste: { amount: 0.25, duration: 4 } },
        targetsAllies: true,
        color: '#d7ecff',
        vfx: 'moonfall',
        maxTargets: 10
      })
    ],
    skins: [
      skin('nimbus', 'default', 'Cloudhopper', 'default', 0, 'coins', pal('#f4f1ff', '#c8c2e4', '#ffffff', '#8fd9ff', '#ff8fb0', '#a8e6ff'), {
        blurb: 'Soft landing, sharp carrot.'
      }),
      skin('nimbus', 'springtide', 'Springtide Nimbus', 'rare', 3200, 'coins', pal('#d9ffd2', '#96d18d', '#f6fff2', '#ff8fb0', '#4a7a3a', '#a9ff9a'), {
        extras: ['petals', 'leaves'],
        blurb: 'The first hop of every spring.'
      }),
      skin('nimbus', 'starweaver', 'Starweaver', 'epic', 6400, 'coins', pal('#2c2a55', '#151433', '#8b8ce0', '#ffe27a', '#fff6c9', '#b9a8ff'), {
        extras: ['stars'],
        blurb: 'She stitches constellations while you sleep.'
      }),
      skin('nimbus', 'lunarempress', 'Lunar Empress', 'legendary', 425, 'gems', pal('#fff4f8', '#d8bcd0', '#ffffff', '#ff4f8f', '#7a2a50', '#ffb0d4'), {
        extras: ['petals', 'stars'],
        weapon: 'staff',
        blurb: 'Bow to the fluffiest throne in the sky.'
      })
    ],
    tips: ['Hop Heal doubles as an engage tool, the speed boost gets carries out of danger.', 'Save Moonfall Blessing for a teamfight, not a single low ally.']
  },

  {
    id: 'blaze',
    name: 'Blaze',
    title: 'the Emberwisp',
    species: 'Fox',
    role: 'Mage',
    secondaryRole: 'Assassin',
    difficulty: 2,
    price: 5600,
    lane: 'mid',
    resource: 'mana',
    lore: 'A fox who stole an ember from the sun and has been very smug about it ever since.',
    stats: {
      hp: 560,
      hpPerLevel: 88,
      hpRegen: 3.8,
      mana: 460,
      manaPerLevel: 58,
      manaRegen: 12,
      ad: 54,
      adPerLevel: 2.8,
      ap: 0,
      armor: 22,
      armorPerLevel: 3.6,
      mr: 30,
      mrPerLevel: 1.3,
      attackSpeed: 0.63,
      attackSpeedPerLevel: 0.02,
      attackRange: 560,
      moveSpeed: 330,
      critChance: 0,
      radius: 29
    },
    art: {
      body: 'slim',
      ears: 'tuft',
      tail: 'bushy',
      legs: 'normal',
      features: ['whiskers'],
      weapon: 'staff',
      scale: 1,
      palette: pal('#ff8a3d', '#c24f1c', '#fff0dc', '#ffd24a', '#3a1a0c', '#ff9e2c')
    },
    skills: [
      skill('P', 'blaze_kindling', 'Kindling', 'self', 'Her abilities set targets alight, burning them for magic damage over time.', {
        status: { burn: { dps: 18, duration: 3 } },
        color: '#ff9e2c',
        vfx: 'ember'
      }),
      skill('Q', 'blaze_foxfire', 'Fox Fire', 'projectile', 'Launches a wisp of fire that detonates on the first enemy hit.', {
        baseDamage: [75, 120, 165, 210, 255],
        apRatio: 0.7,
        cooldown: [6, 5.5, 5, 4.5, 4],
        manaCost: [50, 55, 60, 65, 70],
        range: 880,
        radius: 170,
        speed: 1450,
        color: '#ff9e2c',
        vfx: 'fireball'
      }),
      skill('W', 'blaze_emberring', 'Ember Ring', 'zone', 'Scorches the ground, burning anything that stands in the ring.', {
        baseDamage: [60, 95, 130, 165, 200],
        apRatio: 0.45,
        cooldown: [14, 13, 12, 11, 10],
        manaCost: [70, 75, 80, 85, 90],
        range: 800,
        radius: 260,
        duration: 4,
        status: { burn: { dps: 30, duration: 1 }, slow: { amount: 0.2, duration: 0.6 } },
        color: '#ff6a2c',
        vfx: 'firezone',
        maxTargets: 8
      }),
      skill('E', 'blaze_flamedash', 'Flame Dash', 'dash', 'Streaks forward leaving a wall of flame behind her.', {
        baseDamage: [70, 110, 150, 190, 230],
        apRatio: 0.4,
        cooldown: [15, 14, 13, 12, 11],
        manaCost: [65, 65, 65, 65, 65],
        range: 480,
        radius: 150,
        speed: 1600,
        duration: 3,
        status: { burn: { dps: 24, duration: 2 } },
        color: '#ffd24a',
        vfx: 'firetrail'
      }),
      skill('R', 'blaze_inferno', 'Inferno Nine-Tails', 'circle', 'Nine tails of fire erupt, incinerating a huge area.', {
        baseDamage: [300, 460, 620],
        apRatio: 1.05,
        cooldown: [110, 95, 80],
        manaCost: [120, 120, 120],
        range: 820,
        radius: 420,
        castTime: 0.7,
        status: { burn: { dps: 60, duration: 3 }, slow: { amount: 0.35, duration: 2 } },
        color: '#ff4a1c',
        vfx: 'inferno',
        maxTargets: 12
      })
    ],
    skins: [
      skin('blaze', 'default', 'Emberwisp', 'default', 0, 'coins', pal('#ff8a3d', '#c24f1c', '#fff0dc', '#ffd24a', '#3a1a0c', '#ff9e2c'), {
        extras: ['embers'],
        blurb: 'One stolen ember, infinite confidence.'
      }),
      skin('blaze', 'frostfox', 'Frostfox', 'rare', 3200, 'coins', pal('#d6f2ff', '#8ab8d8', '#ffffff', '#5fd8ff', '#1c3c52', '#7fe6ff'), {
        extras: ['frost'],
        blurb: 'She stole from the moon instead. Colder. Still smug.'
      }),
      skin('blaze', 'neonkit', 'Neon Kitsune', 'epic', 6400, 'coins', pal('#ff3fa0', '#a3186a', '#ffd9f0', '#37f2ff', '#1a0a20', '#37f2ff'), {
        extras: ['circuit', 'sparks'],
        blurb: 'Downtown at 2am, nine tails of neon.'
      }),
      skin('blaze', 'solarqueen', 'Solar Queen', 'mythic', 725, 'gems', pal('#ffe08a', '#e0a63c', '#fffbee', '#ff5a2c', '#5a2a08', '#ffb347'), {
        extras: ['flames', 'embers', 'stars'],
        weapon: 'staff',
        blurb: 'She did not steal the sun. She was promoted.'
      })
    ],
    tips: ['Ember Ring into Fox Fire is the safest poke pattern.', 'Flame Dash leaves fire behind you, dash through a chasing enemy.']
  },

  {
    id: 'rex',
    name: 'Rex',
    title: 'the Sky Corsair',
    species: 'Parrot',
    role: 'Marksman',
    secondaryRole: 'Mage',
    difficulty: 2,
    price: 5600,
    lane: 'bot',
    resource: 'mana',
    lore: 'Pirate, poet, pest. He repeats your last words back at you right before he takes your treasure.',
    stats: {
      hp: 580,
      hpPerLevel: 92,
      hpRegen: 3.4,
      mana: 340,
      manaPerLevel: 40,
      manaRegen: 8,
      ad: 60,
      adPerLevel: 3.2,
      ap: 0,
      armor: 24,
      armorPerLevel: 3.9,
      mr: 30,
      mrPerLevel: 1.3,
      attackSpeed: 0.66,
      attackSpeedPerLevel: 0.034,
      attackRange: 580,
      moveSpeed: 330,
      critChance: 0,
      radius: 29
    },
    art: {
      body: 'winged',
      ears: 'feather',
      tail: 'plume',
      legs: 'tall',
      features: ['wings', 'beak'],
      weapon: 'cannon',
      scale: 1.02,
      palette: pal('#3ad46b', '#1c8f43', '#ffe27a', '#ff4d4d', '#f7f7f7', '#7dffa8')
    },
    skills: [
      skill('P', 'rex_feathervolley', 'Feather Volley', 'self', 'Basic attacks on wounded targets fire an extra homing feather.', {
        damageType: 'physical',
        baseDamage: [12, 20, 28, 36, 44],
        adRatio: 0.3,
        color: '#7dffa8',
        vfx: 'feather'
      }),
      skill('Q', 'rex_quillshot', 'Quill Shot', 'piercing', 'A razor quill that pierces and slows every target it passes through.', {
        damageType: 'physical',
        baseDamage: [60, 100, 140, 180, 220],
        adRatio: 0.9,
        cooldown: [9, 8.2, 7.4, 6.6, 5.8],
        manaCost: [50, 55, 60, 65, 70],
        range: 1000,
        width: 66,
        speed: 2100,
        status: { slow: { amount: 0.3, duration: 1.4 } },
        color: '#ffe27a',
        vfx: 'quill',
        maxTargets: 5
      }),
      skill('W', 'rex_squall', 'Squall', 'cone', 'A wingbeat squall that shoves enemies back and blinds them.', {
        baseDamage: [70, 115, 160, 205, 250],
        apRatio: 0.5,
        cooldown: [15, 14, 13, 12, 11],
        manaCost: [65, 70, 75, 80, 85],
        range: 520,
        width: 160,
        status: { knockback: 180, blind: 1.4, slow: { amount: 0.3, duration: 1.5 } },
        color: '#a8e6ff',
        vfx: 'wind',
        maxTargets: 6
      }),
      skill('E', 'rex_updraft', 'Updraft', 'blink', 'Rides a thermal to reposition and gains attack speed on landing.', {
        cooldown: [18, 17, 16, 15, 14],
        manaCost: [60, 60, 60, 60, 60],
        range: 500,
        duration: 3.5,
        castTime: 0.1,
        status: { attackSpeed: { amount: 0.5, duration: 3.5 } },
        color: '#d7f6ff',
        vfx: 'updraft'
      }),
      skill('R', 'rex_skybarrage', 'Sky Barrage', 'circle', 'Rains cannon-shot feathers across a distant area for several seconds.', {
        damageType: 'physical',
        baseDamage: [90, 140, 190],
        adRatio: 0.45,
        apRatio: 0.3,
        cooldown: [100, 88, 76],
        manaCost: [100, 100, 100],
        range: 2400,
        radius: 420,
        duration: 3.4,
        castTime: 0.6,
        status: { slow: { amount: 0.3, duration: 1 } },
        color: '#ffcf4a',
        vfx: 'barrage',
        maxTargets: 12
      })
    ],
    skins: [
      skin('rex', 'default', 'Sky Corsair', 'default', 0, 'coins', pal('#3ad46b', '#1c8f43', '#ffe27a', '#ff4d4d', '#f7f7f7', '#7dffa8'), {
        blurb: 'Squawk once for treasure, twice for trouble.'
      }),
      skin('rex', 'macawmarine', 'Macaw Marine', 'rare', 3200, 'coins', pal('#3d7fd6', '#1e4a8f', '#ffd9a0', '#ff8f3d', '#ffffff', '#7fc4ff'), {
        extras: ['sparks'],
        blurb: 'Enlisted. Still insubordinate.'
      }),
      skin('rex', 'thunderplume', 'Thunderplume', 'epic', 6400, 'coins', pal('#5a3fb5', '#2e1f6b', '#c9b4ff', '#ffe066', '#ffffff', '#c9a8ff'), {
        extras: ['sparks', 'stars'],
        blurb: 'He learned a new word: overload.'
      }),
      skin('rex', 'phoenixcorsair', 'Phoenix Corsair', 'legendary', 425, 'gems', pal('#ff6a2c', '#b8340c', '#ffe6b0', '#ffd24a', '#fff6e0', '#ff9a3c'), {
        extras: ['flames', 'embers'],
        weapon: 'cannon',
        blurb: 'Dies dramatically. Comes back louder.'
      })
    ],
    tips: ['Squall is a peel tool, knock assassins off your back line.', 'Sky Barrage has enormous range, use it to steal objectives.']
  },

  {
    id: 'hammer',
    name: 'Hammer',
    title: 'the Cheekstorm',
    species: 'Hamster',
    role: 'Fighter',
    secondaryRole: 'Tank',
    difficulty: 2,
    price: 5600,
    lane: 'jungle',
    resource: 'fury',
    lore: 'Small enough to fit in your pocket. Strong enough to throw your pocket.',
    stats: {
      hp: 720,
      hpPerLevel: 118,
      hpRegen: 7.6,
      mana: 280,
      manaPerLevel: 34,
      manaRegen: 8.4,
      ad: 68,
      adPerLevel: 3.8,
      ap: 0,
      armor: 36,
      armorPerLevel: 4.6,
      mr: 32,
      mrPerLevel: 1.5,
      attackSpeed: 0.64,
      attackSpeedPerLevel: 0.028,
      attackRange: 165,
      moveSpeed: 340,
      critChance: 0,
      radius: 30
    },
    art: {
      body: 'round',
      ears: 'round',
      tail: 'stub',
      legs: 'short',
      features: ['whiskers'],
      weapon: 'hammer',
      scale: 0.9,
      palette: pal('#e8c48a', '#b08a52', '#fff3dc', '#ff6a4a', '#2a1a10', '#ffb07a')
    },
    skills: [
      skill('P', 'hammer_pouchpower', 'Pouch Power', 'self', 'Stores damage taken in his cheeks, then adds it to his next ability.', {
        color: '#ffb07a',
        vfx: 'pouch'
      }),
      skill('Q', 'hammer_seedsmash', 'Seed Smash', 'line', 'Swings his hammer in a crushing arc that staggers on impact.', {
        damageType: 'physical',
        baseDamage: [80, 125, 170, 215, 260],
        adRatio: 1,
        cooldown: [8, 7.4, 6.8, 6.2, 5.6],
        manaCost: [45, 48, 51, 54, 57],
        range: 380,
        width: 200,
        castTime: 0.28,
        status: { slow: { amount: 0.3, duration: 1.2 } },
        color: '#ffb07a',
        vfx: 'hammerarc',
        maxTargets: 6
      }),
      skill('W', 'hammer_rollout', 'Roll Out', 'self', 'Curls into a ball, gaining speed and damage reduction.', {
        cooldown: [18, 17, 16, 15, 14],
        manaCost: [50, 50, 50, 50, 50],
        duration: 4,
        castTime: 0,
        shieldBase: [90, 150, 210, 270, 330],
        shieldApRatio: 0.4,
        status: { haste: { amount: 0.45, duration: 4 } },
        color: '#ffe0a8',
        vfx: 'rollball'
      }),
      skill('E', 'hammer_groundpound', 'Ground Pound', 'circle', 'Slams the earth, stunning everything around him.', {
        damageType: 'physical',
        baseDamage: [90, 140, 190, 240, 290],
        adRatio: 0.7,
        cooldown: [15, 14, 13, 12, 11],
        manaCost: [70, 70, 70, 70, 70],
        range: 0,
        radius: 300,
        castTime: 0.45,
        status: { stun: 0.9 },
        color: '#ffb07a',
        vfx: 'quake',
        maxTargets: 8
      }),
      skill('R', 'hammer_giantball', 'Giant Hamster Ball', 'dash', 'Rolls in a colossal ball, flattening and launching everyone in the path.', {
        damageType: 'physical',
        baseDamage: [240, 380, 520],
        adRatio: 1.2,
        cooldown: [105, 92, 79],
        manaCost: [100, 100, 100],
        range: 1100,
        radius: 240,
        speed: 1150,
        status: { knockup: 0.8, knockback: 260 },
        color: '#ff8a4a',
        vfx: 'giantball',
        maxTargets: 10
      })
    ],
    skins: [
      skin('hammer', 'default', 'Cheekstorm', 'default', 0, 'coins', pal('#e8c48a', '#b08a52', '#fff3dc', '#ff6a4a', '#2a1a10', '#ffb07a'), {
        blurb: 'The wheel spins him. He spins the world.'
      }),
      skin('hammer', 'forgemaster', 'Forgemaster', 'rare', 3200, 'coins', pal('#8a8f9c', '#4e525e', '#ffd9a0', '#ff5a2c', '#ffe066', '#ff8a3c'), {
        extras: ['embers', 'sparks'],
        blurb: 'Anvil sold separately.'
      }),
      skin('hammer', 'stormpaw', 'Stormpaw', 'epic', 6400, 'coins', pal('#5fa8d6', '#2c6490', '#e8f7ff', '#ffe066', '#fffbe0', '#8fd8ff'), {
        extras: ['sparks'],
        blurb: 'Tiny god of very localized weather.'
      }),
      skin('hammer', 'colossus', 'Colossus Core', 'legendary', 425, 'gems', pal('#2f3a52', '#1a2131', '#7fe0ff', '#ff3d6e', '#7fe0ff', '#57d8ff'), {
        extras: ['circuit'],
        weapon: 'hammer',
        blurb: 'They gave the mech a pilot. The pilot is a hamster.'
      })
    ],
    tips: ['Roll Out into Ground Pound is your engage.', 'Pouch Power rewards you for tanking damage before committing.']
  },

  {
    id: 'shelly',
    name: 'Shelly',
    title: 'the Tidewall',
    species: 'Turtle',
    role: 'Tank',
    secondaryRole: 'Support',
    difficulty: 1,
    price: 4800,
    lane: 'support',
    resource: 'mana',
    lore: 'She has outlived three empires by simply refusing to move out of the way.',
    stats: {
      hp: 860,
      hpPerLevel: 132,
      hpRegen: 9.2,
      mana: 340,
      manaPerLevel: 44,
      manaRegen: 9,
      ad: 58,
      adPerLevel: 3.2,
      ap: 0,
      armor: 46,
      armorPerLevel: 5.4,
      mr: 38,
      mrPerLevel: 1.9,
      attackSpeed: 0.56,
      attackSpeedPerLevel: 0.018,
      attackRange: 185,
      moveSpeed: 315,
      critChance: 0,
      radius: 38
    },
    art: {
      body: 'shelled',
      ears: 'none',
      tail: 'stub',
      legs: 'short',
      features: ['shell'],
      weapon: 'shield',
      scale: 1.14,
      palette: pal('#4fae7a', '#2b6b4a', '#d8f0c9', '#5fd8ff', '#2a3a2a', '#6fe6c9')
    },
    skills: [
      skill('P', 'shelly_shellguard', 'Shell Guard', 'self', 'Standing still hardens her shell, reducing incoming damage.', {
        color: '#6fe6c9',
        vfx: 'shellglint'
      }),
      skill('Q', 'shelly_tideslam', 'Tide Slam', 'cone', 'Sweeps a wave of water forward that chills and slows.', {
        baseDamage: [70, 110, 150, 190, 230],
        apRatio: 0.55,
        cooldown: [9, 8.4, 7.8, 7.2, 6.6],
        manaCost: [55, 60, 65, 70, 75],
        range: 460,
        width: 190,
        status: { slow: { amount: 0.4, duration: 1.8 } },
        color: '#5fd8ff',
        vfx: 'wave',
        maxTargets: 6
      }),
      skill('W', 'shelly_fortress', 'Shell Fortress', 'self', 'Retreats into her shell, gaining a barrier that reflects damage.', {
        cooldown: [20, 18.5, 17, 15.5, 14],
        manaCost: [70, 70, 70, 70, 70],
        duration: 3,
        shieldBase: [140, 220, 300, 380, 460],
        shieldApRatio: 0.8,
        color: '#a8ffe0',
        vfx: 'shellcurl'
      }),
      skill('E', 'shelly_wavepush', 'Wave Push', 'line', 'Blasts a torrent that shoves enemies back down the line.', {
        baseDamage: [80, 125, 170, 215, 260],
        apRatio: 0.6,
        cooldown: [16, 15, 14, 13, 12],
        manaCost: [70, 75, 80, 85, 90],
        range: 720,
        width: 150,
        speed: 1600,
        status: { knockback: 240, slow: { amount: 0.3, duration: 1.4 } },
        color: '#5fd8ff',
        vfx: 'torrent',
        maxTargets: 6
      }),
      skill('R', 'shelly_aegisdome', 'Aegis Dome', 'zone', 'Raises a dome of tidal force. Allies inside take less damage, enemies inside are slowed.', {
        baseDamage: [40, 70, 100],
        apRatio: 0.2,
        cooldown: [130, 115, 100],
        manaCost: [110, 110, 110],
        range: 600,
        radius: 480,
        duration: 6,
        castTime: 0.5,
        status: { slow: { amount: 0.45, duration: 1 } },
        targetsAllies: true,
        color: '#6fe6c9',
        vfx: 'dome',
        maxTargets: 12
      })
    ],
    skins: [
      skin('shelly', 'default', 'Tidewall', 'default', 0, 'coins', pal('#4fae7a', '#2b6b4a', '#d8f0c9', '#5fd8ff', '#2a3a2a', '#6fe6c9'), {
        blurb: 'Immovable, by choice.'
      }),
      skin('shelly', 'coralguard', 'Coralguard', 'rare', 3200, 'coins', pal('#ff8fa8', '#c2506a', '#ffe0e8', '#5fe0ff', '#3a1a28', '#ffa8c8'), {
        extras: ['bubbles'],
        blurb: 'A reef grew on her. She kept it.'
      }),
      skin('shelly', 'obsidian', 'Obsidian Bulwark', 'epic', 6400, 'coins', pal('#2a2f3a', '#14171f', '#5f6a80', '#ff6a2c', '#ffb07a', '#ff8a3c'), {
        extras: ['embers'],
        blurb: 'Volcanic glass, volcanic patience.'
      }),
      skin('shelly', 'worldturtle', 'World Turtle', 'mythic', 725, 'gems', pal('#3f6fa8', '#1f3d63', '#9fe0ff', '#ffd24a', '#fff6e0', '#8fd8ff'), {
        extras: ['stars', 'bubbles'],
        weapon: 'shield',
        blurb: 'The continents are just decoration.'
      })
    ],
    tips: ['Aegis Dome turns a losing fight, drop it on top of your carry.', 'Shell Guard rewards holding ground, do not kite backwards while tanking.']
  },

  {
    id: 'vex',
    name: 'Vex',
    title: 'the Whisper Fang',
    species: 'Ferret',
    role: 'Assassin',
    secondaryRole: 'Fighter',
    difficulty: 3,
    price: 6400,
    lane: 'jungle',
    resource: 'energy',
    lore: 'You will not hear her. You will only notice that the room got quieter.',
    stats: {
      hp: 600,
      hpPerLevel: 98,
      hpRegen: 5,
      mana: 250,
      manaPerLevel: 24,
      manaRegen: 10,
      ad: 69,
      adPerLevel: 3.6,
      ap: 0,
      armor: 30,
      armorPerLevel: 4.2,
      mr: 30,
      mrPerLevel: 1.3,
      attackSpeed: 0.72,
      attackSpeedPerLevel: 0.033,
      attackRange: 160,
      moveSpeed: 350,
      critChance: 0,
      radius: 28
    },
    art: {
      body: 'long',
      ears: 'round',
      tail: 'long',
      legs: 'short',
      features: ['whiskers'],
      weapon: 'blade',
      scale: 0.96,
      palette: pal('#d6cbb5', '#8f8168', '#fdf7ea', '#ff3d6e', '#ff3d6e', '#ff6f9c')
    },
    skills: [
      skill('P', 'vex_bloodscent', 'Bloodscent', 'self', 'Gains movement speed when moving toward wounded enemies.', {
        color: '#ff6f9c',
        vfx: 'scent'
      }),
      skill('Q', 'vex_riftslash', 'Rift Slash', 'cone', 'Two crossing slashes that cause targets to bleed.', {
        damageType: 'physical',
        baseDamage: [65, 105, 145, 185, 225],
        adRatio: 0.9,
        cooldown: [6, 5.6, 5.2, 4.8, 4.4],
        manaCost: [35, 38, 41, 44, 47],
        range: 340,
        width: 140,
        castTime: 0.14,
        status: { poison: { dps: 22, duration: 3 } },
        color: '#ff3d6e',
        vfx: 'crossslash',
        maxTargets: 5
      }),
      skill('W', 'vex_vanish', 'Vanish', 'self', 'Melts into the terrain, becoming invisible and much faster.', {
        cooldown: [22, 20, 18, 16, 14],
        manaCost: [45, 45, 45, 45, 45],
        duration: 3,
        castTime: 0,
        status: { stealth: 3, haste: { amount: 0.5, duration: 3 } },
        color: '#9b7fff',
        vfx: 'vanish'
      }),
      skill('E', 'vex_serpentdash', 'Serpent Dash', 'dash', 'Slides through enemies, cutting each one she passes.', {
        damageType: 'physical',
        baseDamage: [70, 115, 160, 205, 250],
        adRatio: 0.75,
        cooldown: [13, 12, 11, 10, 9],
        manaCost: [50, 50, 50, 50, 50],
        range: 620,
        radius: 130,
        speed: 1800,
        status: { slow: { amount: 0.25, duration: 1 } },
        color: '#ff6f9c',
        vfx: 'serpent',
        maxTargets: 5
      }),
      skill('R', 'vex_executioner', 'Executioner Coil', 'targeted', 'Binds a target in barbed wire and strikes for massive damage, scaling with their missing health.', {
        damageType: 'physical',
        baseDamage: [260, 400, 540],
        adRatio: 1.4,
        cooldown: [95, 80, 65],
        manaCost: [80, 80, 80],
        range: 620,
        castTime: 0.35,
        status: { root: 0.8, mark: 4 },
        color: '#ff1f56',
        vfx: 'coil'
      })
    ],
    skins: [
      skin('vex', 'default', 'Whisper Fang', 'default', 0, 'coins', pal('#d6cbb5', '#8f8168', '#fdf7ea', '#ff3d6e', '#ff3d6e', '#ff6f9c'), {
        blurb: 'Quiet. Then not.'
      }),
      skin('vex', 'midnight', 'Midnight Sable', 'rare', 3200, 'coins', pal('#3a3550', '#1c1930', '#7a6f9c', '#57f5ff', '#57f5ff', '#57f5ff'), {
        extras: ['stars'],
        blurb: 'The shadow that steals your keys.'
      }),
      skin('vex', 'bloodmoon', 'Bloodmoon Vex', 'epic', 6400, 'coins', pal('#52202c', '#2a0f16', '#c2374f', '#ffcf4a', '#ffcf4a', '#ff4a5c'), {
        extras: ['void', 'embers'],
        blurb: 'Ritual mask, ritual grudge.'
      }),
      skin('vex', 'quantum', 'Quantum Fang', 'legendary', 425, 'gems', pal('#d9f6ff', '#7fbcd6', '#ffffff', '#b04cff', '#b04cff', '#a06bff'), {
        extras: ['circuit', 'void'],
        weapon: 'blade',
        blurb: 'She is behind you and also was never there.'
      })
    ],
    tips: ['Vanish before the fight starts, not after you are caught.', 'Executioner Coil finishes targets below half health, hold it for the kill.']
  },

  {
    id: 'luna',
    name: 'Luna',
    title: 'the Moonquill',
    species: 'Owl',
    role: 'Mage',
    secondaryRole: 'Support',
    difficulty: 2,
    price: 6400,
    lane: 'mid',
    resource: 'mana',
    lore: 'She grades your decisions. She has not been impressed since the third age.',
    stats: {
      hp: 545,
      hpPerLevel: 86,
      hpRegen: 3.6,
      mana: 480,
      manaPerLevel: 60,
      manaRegen: 13,
      ad: 52,
      adPerLevel: 2.7,
      ap: 0,
      armor: 21,
      armorPerLevel: 3.5,
      mr: 32,
      mrPerLevel: 1.4,
      attackSpeed: 0.6,
      attackSpeedPerLevel: 0.019,
      attackRange: 600,
      moveSpeed: 325,
      critChance: 0,
      radius: 29
    },
    art: {
      body: 'winged',
      ears: 'tuft',
      tail: 'fan',
      legs: 'normal',
      features: ['wings', 'beak'],
      weapon: 'orb',
      scale: 1.04,
      palette: pal('#9fb4d6', '#5c6f92', '#f0f4ff', '#ffe27a', '#ffb347', '#b9d4ff')
    },
    skills: [
      skill('P', 'luna_nightvision', 'Night Vision', 'aura', 'Extended vision, and her abilities deal more damage to enemies she has revealed.', {
        radius: 300,
        color: '#b9d4ff',
        vfx: 'moonglow'
      }),
      skill('Q', 'luna_lunarbeam', 'Lunar Beam', 'piercing', 'A shaft of moonlight that pierces all enemies in a line.', {
        baseDamage: [80, 130, 180, 230, 280],
        apRatio: 0.75,
        cooldown: [8, 7.4, 6.8, 6.2, 5.6],
        manaCost: [55, 60, 65, 70, 75],
        range: 950,
        width: 90,
        speed: 2200,
        status: { revealed: 3 },
        color: '#d7e6ff',
        vfx: 'moonbeam',
        maxTargets: 6
      }),
      skill('W', 'luna_silencehoot', 'Silencing Hoot', 'circle', 'A resonant hoot that silences everyone in the area.', {
        baseDamage: [60, 100, 140, 180, 220],
        apRatio: 0.5,
        cooldown: [16, 15, 14, 13, 12],
        manaCost: [70, 75, 80, 85, 90],
        range: 780,
        radius: 260,
        status: { silence: 1.5, slow: { amount: 0.25, duration: 1.5 } },
        color: '#c9a8ff',
        vfx: 'sonic',
        maxTargets: 8
      }),
      skill('E', 'luna_featherglide', 'Feather Glide', 'blink', 'Glides on silent wings to a nearby position.', {
        cooldown: [16, 15, 14, 13, 12],
        manaCost: [60, 60, 60, 60, 60],
        range: 520,
        castTime: 0.1,
        shieldBase: [60, 100, 140, 180, 220],
        shieldApRatio: 0.3,
        color: '#e6f0ff',
        vfx: 'glide'
      }),
      skill('R', 'luna_eclipse', 'Eclipse', 'circle', 'Blots out the sun above a huge area, rooting and crushing everything beneath it.', {
        baseDamage: [320, 480, 640],
        apRatio: 1.1,
        cooldown: [120, 105, 90],
        manaCost: [120, 120, 120],
        range: 1100,
        radius: 460,
        castTime: 0.9,
        status: { root: 1.2, slow: { amount: 0.5, duration: 2.5 } },
        color: '#8f7fff',
        vfx: 'eclipse',
        maxTargets: 12
      })
    ],
    skins: [
      skin('luna', 'default', 'Moonquill', 'default', 0, 'coins', pal('#9fb4d6', '#5c6f92', '#f0f4ff', '#ffe27a', '#ffb347', '#b9d4ff'), {
        blurb: 'She has read every book. Twice.'
      }),
      skin('luna', 'scholar', 'Arcane Scholar', 'rare', 3200, 'coins', pal('#c9a87a', '#8a6f48', '#fff3dc', '#7cd8ff', '#ffd24a', '#a8e0ff'), {
        extras: ['stars'],
        blurb: 'Tenured, tired, terrifying.'
      }),
      skin('luna', 'snowveil', 'Snowveil Luna', 'epic', 6400, 'coins', pal('#f0f8ff', '#b4cbe0', '#ffffff', '#7fe6ff', '#9fd8ff', '#bff0ff'), {
        extras: ['frost', 'stars'],
        blurb: 'Silent flight over a silent field.'
      }),
      skin('luna', 'astral', 'Astral Archivist', 'legendary', 425, 'gems', pal('#2a2450', '#151233', '#8f7fff', '#ffe27a', '#fff6c9', '#b09bff'), {
        extras: ['stars', 'void'],
        weapon: 'orb',
        blurb: 'She catalogues dead stars for fun.'
      })
    ],
    tips: ['Silencing Hoot cancels enemy ultimates, watch their cast animation.', 'Eclipse has a long wind-up, cast it behind a stun.']
  },

  {
    id: 'quill',
    name: 'Quill',
    title: 'the Spike Warden',
    species: 'Hedgehog',
    role: 'Fighter',
    secondaryRole: 'Tank',
    difficulty: 1,
    price: 4800,
    lane: 'top',
    resource: 'mana',
    lore: 'Hug at your own risk. He has issued the warning. Repeatedly.',
    stats: {
      hp: 760,
      hpPerLevel: 120,
      hpRegen: 8,
      mana: 300,
      manaPerLevel: 38,
      manaRegen: 8.6,
      ad: 65,
      adPerLevel: 3.5,
      ap: 0,
      armor: 40,
      armorPerLevel: 4.9,
      mr: 34,
      mrPerLevel: 1.6,
      attackSpeed: 0.62,
      attackSpeedPerLevel: 0.025,
      attackRange: 170,
      moveSpeed: 330,
      critChance: 0,
      radius: 32
    },
    art: {
      body: 'round',
      ears: 'round',
      tail: 'stub',
      legs: 'short',
      features: ['spikes', 'whiskers'],
      weapon: 'none',
      scale: 1.04,
      palette: pal('#8c7a62', '#574a38', '#f0dfc4', '#a8d84a', '#2a2118', '#c9f06a')
    },
    skills: [
      skill('P', 'quill_barbedcoat', 'Barbed Coat', 'self', 'Attackers take physical damage back from his spines.', {
        damageType: 'physical',
        baseDamage: [12, 20, 28, 36, 44],
        color: '#c9f06a',
        vfx: 'barbs'
      }),
      skill('Q', 'quill_quillburst', 'Quill Burst', 'circle', 'Fires spines in every direction around him.', {
        damageType: 'physical',
        baseDamage: [70, 110, 150, 190, 230],
        adRatio: 0.8,
        cooldown: [8, 7.4, 6.8, 6.2, 5.6],
        manaCost: [50, 54, 58, 62, 66],
        range: 0,
        radius: 340,
        castTime: 0.25,
        color: '#c9f06a',
        vfx: 'quillburst',
        maxTargets: 8
      }),
      skill('W', 'quill_spikewall', 'Spike Wall', 'zone', 'Plants a field of spikes that slows and shreds anyone crossing it.', {
        damageType: 'physical',
        baseDamage: [40, 65, 90, 115, 140],
        adRatio: 0.3,
        cooldown: [17, 16, 15, 14, 13],
        manaCost: [65, 70, 75, 80, 85],
        range: 620,
        radius: 260,
        duration: 5,
        status: { slow: { amount: 0.45, duration: 1 } },
        color: '#a8d84a',
        vfx: 'spikefield',
        maxTargets: 8
      }),
      skill('E', 'quill_ballroll', 'Ball Roll', 'dash', 'Curls up and rolls through enemies, bowling them over.', {
        damageType: 'physical',
        baseDamage: [80, 125, 170, 215, 260],
        adRatio: 0.7,
        cooldown: [15, 14, 13, 12, 11],
        manaCost: [60, 60, 60, 60, 60],
        range: 620,
        radius: 160,
        speed: 1450,
        status: { knockback: 160, slow: { amount: 0.3, duration: 1.2 } },
        color: '#c9f06a',
        vfx: 'spikeroll',
        maxTargets: 6
      }),
      skill('R', 'quill_ironstorm', 'Iron Quill Storm', 'aura', 'Becomes a whirling storm of iron quills for several seconds.', {
        damageType: 'physical',
        baseDamage: [70, 110, 150],
        adRatio: 0.4,
        cooldown: [110, 95, 80],
        manaCost: [100, 100, 100],
        radius: 380,
        duration: 5,
        castTime: 0.3,
        status: { slow: { amount: 0.25, duration: 0.8 } },
        shieldBase: [180, 280, 380],
        shieldApRatio: 0.4,
        color: '#e0ff8a',
        vfx: 'quillstorm',
        maxTargets: 10
      })
    ],
    skins: [
      skin('quill', 'default', 'Spike Warden', 'default', 0, 'coins', pal('#8c7a62', '#574a38', '#f0dfc4', '#a8d84a', '#2a2118', '#c9f06a'), {
        blurb: 'The warning label walks.'
      }),
      skin('quill', 'thornwood', 'Thornwood Quill', 'rare', 3200, 'coins', pal('#5c7a3a', '#33481f', '#d9f0b0', '#ffcf4a', '#3a2a10', '#a8e06a'), {
        extras: ['leaves', 'petals'],
        blurb: 'Half hedgehog, half hedge.'
      }),
      skin('quill', 'ironbristle', 'Ironbristle', 'epic', 6400, 'coins', pal('#7a808c', '#464b57', '#c9d0dc', '#ff8a3c', '#ffd24a', '#ffa85c'), {
        extras: ['sparks', 'embers'],
        blurb: 'Every spine hand-forged, by him, badly.'
      }),
      skin('quill', 'voidspine', 'Voidspine', 'legendary', 425, 'gems', pal('#2a2040', '#140f24', '#6b4fa8', '#b04cff', '#ff3d6e', '#b04cff'), {
        extras: ['void'],
        blurb: 'The rift gave him more spikes. He did not need more spikes.'
      })
    ],
    tips: ['Spike Wall zones a choke point better than any dash.', 'Iron Quill Storm plus a bruiser build makes you unkillable in a brawl.']
  },

  {
    id: 'koi',
    name: 'Koi',
    title: 'the Tidecaller',
    species: 'Axolotl',
    role: 'Support',
    secondaryRole: 'Mage',
    difficulty: 2,
    price: 6400,
    lane: 'support',
    resource: 'mana',
    lore: 'She regrows anything. Limbs, gardens, hope, the occasional teammate.',
    stats: {
      hp: 590,
      hpPerLevel: 94,
      hpRegen: 9.5,
      mana: 440,
      manaPerLevel: 56,
      manaRegen: 12,
      ad: 52,
      adPerLevel: 2.7,
      ap: 0,
      armor: 25,
      armorPerLevel: 3.9,
      mr: 33,
      mrPerLevel: 1.5,
      attackSpeed: 0.6,
      attackSpeedPerLevel: 0.02,
      attackRange: 540,
      moveSpeed: 330,
      critChance: 0,
      radius: 30
    },
    art: {
      body: 'long',
      ears: 'none',
      tail: 'fin',
      legs: 'short',
      features: ['gills'],
      weapon: 'orb',
      scale: 1,
      palette: pal('#ffc2d6', '#d98fae', '#fff0f6', '#7fe6ff', '#2a2a3a', '#9ff0ff')
    },
    skills: [
      skill('P', 'koi_regrowth', 'Regrowth', 'self', 'Heals rapidly out of combat, and her abilities mend nearby allies.', {
        healBase: [15, 25, 35, 45, 55],
        healApRatio: 0.1,
        radius: 450,
        targetsAllies: true,
        color: '#9ff0ff',
        vfx: 'regrow'
      }),
      skill('Q', 'koi_bubblebolt', 'Bubble Bolt', 'projectile', 'Fires a dense bubble that bursts and chills the target.', {
        baseDamage: [70, 115, 160, 205, 250],
        apRatio: 0.65,
        cooldown: [7, 6.5, 6, 5.5, 5],
        manaCost: [50, 55, 60, 65, 70],
        range: 860,
        radius: 150,
        speed: 1400,
        status: { slow: { amount: 0.35, duration: 1.6 } },
        color: '#7fe6ff',
        vfx: 'bubble'
      }),
      skill('W', 'koi_healingspring', 'Healing Spring', 'zone', 'Opens a spring of restorative water that mends allies inside it.', {
        cooldown: [18, 17, 16, 15, 14],
        manaCost: [80, 85, 90, 95, 100],
        range: 700,
        radius: 280,
        duration: 5,
        healBase: [30, 48, 66, 84, 102],
        healApRatio: 0.18,
        targetsAllies: true,
        color: '#8fffd4',
        vfx: 'spring',
        maxTargets: 8
      }),
      skill('E', 'koi_currentslide', 'Current Slide', 'dash', 'Surfs a current forward, carrying the nearest ally with her.', {
        cooldown: [16, 15, 14, 13, 12],
        manaCost: [60, 60, 60, 60, 60],
        range: 520,
        radius: 160,
        speed: 1500,
        status: { haste: { amount: 0.3, duration: 2 } },
        targetsAllies: true,
        color: '#9ff0ff',
        vfx: 'current'
      }),
      skill('R', 'koi_deluge', 'Deluge', 'circle', 'A tidal surge erupts, launching enemies and washing allies with healing.', {
        baseDamage: [240, 380, 520],
        apRatio: 0.9,
        cooldown: [125, 110, 95],
        manaCost: [110, 110, 110],
        range: 800,
        radius: 440,
        castTime: 0.6,
        healBase: [180, 280, 380],
        healApRatio: 0.6,
        status: { knockup: 0.8, slow: { amount: 0.35, duration: 2 } },
        targetsAllies: true,
        color: '#5fd8ff',
        vfx: 'deluge',
        maxTargets: 12
      })
    ],
    skins: [
      skin('koi', 'default', 'Tidecaller', 'default', 0, 'coins', pal('#ffc2d6', '#d98fae', '#fff0f6', '#7fe6ff', '#2a2a3a', '#9ff0ff'), {
        extras: ['bubbles'],
        blurb: 'Perpetually smiling. Genuinely dangerous.'
      }),
      skin('koi', 'abyssal', 'Abyssal Koi', 'rare', 3200, 'coins', pal('#2a3f6b', '#152340', '#5f8fd6', '#7fffd4', '#ffd24a', '#7fffd4'), {
        extras: ['bubbles', 'void'],
        blurb: 'From where the light gives up.'
      }),
      skin('koi', 'lotus', 'Lotus Tidecaller', 'epic', 6400, 'coins', pal('#ffe8c2', '#d6b98f', '#fffaf0', '#ff8fb0', '#5a3a2a', '#ffc2a8'), {
        extras: ['petals', 'leaves'],
        blurb: 'Every pond needs a queen.'
      }),
      skin('koi', 'leviathan', 'Leviathan Ascendant', 'mythic', 725, 'gems', pal('#3f5fa8', '#1f2f63', '#9fd8ff', '#ffd24a', '#ffffff', '#8fd8ff'), {
        extras: ['bubbles', 'stars'],
        weapon: 'staff',
        blurb: 'She grew. She did not stop growing.'
      })
    ],
    tips: ['Healing Spring under your team during an objective fight wins it.', 'Current Slide drags an ally with you, use it to save a dying carry.']
  },

  {
    id: 'tank',
    name: 'Tank',
    title: 'the Iron Pup',
    species: 'Pug',
    role: 'Tank',
    secondaryRole: 'Fighter',
    difficulty: 1,
    price: 4800,
    lane: 'top',
    resource: 'mana',
    lore: 'Named optimistically by a child. He grew into it out of sheer spite.',
    stats: {
      hp: 800,
      hpPerLevel: 126,
      hpRegen: 8.8,
      mana: 290,
      manaPerLevel: 40,
      manaRegen: 8.2,
      ad: 62,
      adPerLevel: 3.4,
      ap: 0,
      armor: 44,
      armorPerLevel: 5.1,
      mr: 36,
      mrPerLevel: 1.7,
      attackSpeed: 0.58,
      attackSpeedPerLevel: 0.021,
      attackRange: 175,
      moveSpeed: 320,
      critChance: 0,
      radius: 35
    },
    art: {
      body: 'chunky',
      ears: 'flop',
      tail: 'curl',
      legs: 'short',
      features: ['whiskers', 'goggles'],
      weapon: 'hammer',
      scale: 1.12,
      palette: pal('#cbb08a', '#8a7048', '#f5ead6', '#57d8ff', '#2a2118', '#7fe0ff')
    },
    skills: [
      skill('P', 'tank_snorearmor', 'Snore Armor', 'self', 'Every few seconds he shrugs off a portion of the next hit he takes.', {
        shieldBase: [40, 70, 100, 130, 160],
        color: '#7fe0ff',
        vfx: 'snore'
      }),
      skill('Q', 'tank_headbutt', 'Headbutt', 'dash', 'A short, very committed headbutt that stuns.', {
        damageType: 'physical',
        baseDamage: [75, 120, 165, 210, 255],
        adRatio: 0.75,
        cooldown: [11, 10.2, 9.4, 8.6, 7.8],
        manaCost: [50, 54, 58, 62, 66],
        range: 400,
        radius: 150,
        speed: 1400,
        status: { stun: 0.7 },
        color: '#7fe0ff',
        vfx: 'headbutt'
      }),
      skill('W', 'tank_grudge', 'Grudge', 'self', 'Stacks resolve, gaining armor, magic resist and health regeneration.', {
        cooldown: [18, 17, 16, 15, 14],
        manaCost: [55, 55, 55, 55, 55],
        duration: 5,
        shieldBase: [100, 160, 220, 280, 340],
        shieldApRatio: 0.5,
        color: '#ffd24a',
        vfx: 'grudge'
      }),
      skill('E', 'tank_chomp', 'Chomp', 'targeted', 'Latches onto a target and refuses to let go.', {
        damageType: 'physical',
        baseDamage: [85, 135, 185, 235, 285],
        adRatio: 0.8,
        cooldown: [14, 13, 12, 11, 10],
        manaCost: [60, 60, 60, 60, 60],
        range: 300,
        status: { root: 1, slow: { amount: 0.4, duration: 1.5 } },
        healBase: [40, 65, 90, 115, 140],
        color: '#ff8a4a',
        vfx: 'chomp'
      }),
      skill('R', 'tank_lastwall', 'Last Wall', 'aura', 'Plants himself and becomes a living wall, absorbing damage for the team.', {
        damageType: 'magic',
        baseDamage: [120, 200, 280],
        apRatio: 0.4,
        cooldown: [120, 105, 90],
        manaCost: [100, 100, 100],
        radius: 600,
        duration: 5,
        castTime: 0.4,
        shieldBase: [260, 400, 540],
        shieldApRatio: 0.9,
        status: { slow: { amount: 0.4, duration: 2 } },
        targetsAllies: true,
        color: '#57d8ff',
        vfx: 'lastwall',
        maxTargets: 10
      })
    ],
    skins: [
      skin('tank', 'default', 'Iron Pup', 'default', 0, 'coins', pal('#cbb08a', '#8a7048', '#f5ead6', '#57d8ff', '#2a2118', '#7fe0ff'), {
        blurb: 'The name was a joke. It is not anymore.'
      }),
      skin('tank', 'roadwarden', 'Road Warden', 'rare', 3200, 'coins', pal('#8a6f52', '#54412c', '#e0cba8', '#ff6a2c', '#ffd24a', '#ff8a3c'), {
        extras: ['embers', 'sparks'],
        blurb: 'Dust, chrome and a very short temper.'
      }),
      skin('tank', 'frostkeep', 'Frostkeep Tank', 'epic', 6400, 'coins', pal('#d6e8f7', '#8fb0c9', '#ffffff', '#5fd8ff', '#1c3448', '#9fe6ff'), {
        extras: ['frost'],
        blurb: 'The gate that never opened.'
      }),
      skin('tank', 'mechapug', 'Mecha Pug', 'legendary', 425, 'gems', pal('#3a4155', '#20242f', '#7fe0ff', '#ff3d6e', '#7fe0ff', '#57d8ff'), {
        extras: ['circuit', 'sparks'],
        weapon: 'cannon',
        blurb: 'Fourteen tons of very good boy.'
      })
    ],
    tips: ['Chomp locks a fleeing target in place for your team.', 'Last Wall protects everyone near you, stand in the middle of the fight.']
  }
];

export const HERO_BY_ID = new Map(HEROES.map((h) => [h.id, h]));

export function getHero(id: string): HeroDef {
  const hero = HERO_BY_ID.get(id);
  if (!hero) throw new Error(`Unknown hero: ${id}`);
  return hero;
}

export function getSkin(heroId: string, skinId: string): SkinDef {
  const hero = getHero(heroId);
  return hero.skins.find((s) => s.id === skinId) ?? hero.skins[0];
}

export const ALL_SKINS: SkinDef[] = HEROES.flatMap((h) => h.skins);

export const SUMMONER_SPELLS: SummonerSpellDef[] = [
  { id: 'flash', name: 'Flash', description: 'Blink a short distance toward the cursor.', cooldown: 240, range: 420, icon: 'flash', color: '#ffe680' },
  { id: 'ignite', name: 'Ignite', description: 'Burn a target for true damage over time and cut their healing.', cooldown: 180, range: 600, icon: 'ignite', color: '#ff6a2c' },
  { id: 'heal', name: 'Heal', description: 'Restore health to you and the nearest ally and grant a speed burst.', cooldown: 210, range: 850, icon: 'heal', color: '#7cffb0' },
  { id: 'sprint', name: 'Sprint', description: 'Gain a large burst of movement speed that decays.', cooldown: 190, range: 0, icon: 'sprint', color: '#7cd8ff' },
  { id: 'barrier', name: 'Barrier', description: 'Shield yourself for a short duration.', cooldown: 180, range: 0, icon: 'barrier', color: '#ffd24a' },
  { id: 'smite', name: 'Smite', description: 'Deal heavy true damage to a monster or minion.', cooldown: 90, range: 500, icon: 'smite', color: '#c9f06a' },
  { id: 'cleanse', name: 'Cleanse', description: 'Remove all crowd control affecting you.', cooldown: 210, range: 0, icon: 'cleanse', color: '#b9d4ff' },
  { id: 'teleport', name: 'Recall Surge', description: 'Channel briefly, then blink a long distance toward an allied structure.', cooldown: 300, range: 4000, icon: 'teleport', color: '#a06bff' }
];

export const SPELL_BY_ID = new Map(SUMMONER_SPELLS.map((s) => [s.id, s]));

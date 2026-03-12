import type { ItemData } from './ItemConfig';

export const ITEMS: Record<string, ItemData> = {
    // ==========================================
    // SILVER ITEMS (Stat Boosts) — Organized by Category & Tier
    // ==========================================

    // --- ATTACK BOOST (3 tiers) ---
    'iron_weight': {
        id: 'iron_weight',
        name: 'Iron Weight',
        description: 'Increases Attack Damage by 10%',
        type: 'SILVER',
        rarity: 'COMMON',
        effects: [{ targetStat: 'attackDamage', value: 0.10, operation: 'ADD' }],
        iconColor: 0xaaaaaa
    },
    'battle_gauntlet': {
        id: 'battle_gauntlet',
        name: 'Battle Gauntlet',
        description: 'Increases Attack Damage by 25%',
        type: 'SILVER',
        rarity: 'UNCOMMON',
        effects: [{ targetStat: 'attackDamage', value: 0.25, operation: 'ADD' }],
        iconColor: 0xcc6600
    },
    'berserker_mark': {
        id: 'berserker_mark',
        name: "Berserker's Mark",
        description: 'Increases Attack Damage by 50%',
        type: 'SILVER',
        rarity: 'RARE',
        effects: [{ targetStat: 'attackDamage', value: 0.50, operation: 'ADD' }],
        iconColor: 0xff2200
    },

    // --- DEFENSE ARMOR (3 tiers) — NEW MECHANIC ---
    'wooden_shield': {
        id: 'wooden_shield',
        name: 'Wooden Shield',
        description: 'Absorbs 1 hit before breaking',
        type: 'SILVER',
        rarity: 'COMMON',
        effects: [{ targetStat: 'armor', value: 1, operation: 'ADD' }],
        armorHits: 1,
        iconColor: 0x885522
    },
    'iron_shield': {
        id: 'iron_shield',
        name: 'Iron Shield',
        description: 'Absorbs 2 hits before breaking',
        type: 'SILVER',
        rarity: 'UNCOMMON',
        effects: [{ targetStat: 'armor', value: 2, operation: 'ADD' }],
        armorHits: 2,
        iconColor: 0x888888
    },
    'diamond_shield': {
        id: 'diamond_shield',
        name: 'Diamond Shield',
        description: 'Absorbs 3 hits before breaking',
        type: 'SILVER',
        rarity: 'RARE',
        effects: [{ targetStat: 'armor', value: 3, operation: 'ADD' }],
        armorHits: 3,
        iconColor: 0x44ddff
    },

    // --- MOVEMENT SPEED (3 tiers) ---
    'winged_boots': {
        id: 'winged_boots',
        name: 'Winged Boots',
        description: 'Increases Move Speed and Attack Speed by 15%',
        type: 'SILVER',
        rarity: 'COMMON',
        effects: [
            { targetStat: 'moveSpeed', value: 0.15, operation: 'ADD' },
            { targetStat: 'attackSpeed', value: -0.15, operation: 'ADD' }
        ],
        iconColor: 0x00ffff
    },
    'mercury_sandals': {
        id: 'mercury_sandals',
        name: 'Mercury Sandals',
        description: 'Increases Move Speed and Attack Speed by 30%',
        type: 'SILVER',
        rarity: 'UNCOMMON',
        effects: [
            { targetStat: 'moveSpeed', value: 0.30, operation: 'ADD' },
            { targetStat: 'attackSpeed', value: -0.30, operation: 'ADD' }
        ],
        iconColor: 0x00ddff
    },
    'tempest_boots': {
        id: 'tempest_boots',
        name: 'Tempest Boots',
        description: 'Increases Move Speed and Attack Speed by 50%',
        type: 'SILVER',
        rarity: 'RARE',
        effects: [
            { targetStat: 'moveSpeed', value: 0.50, operation: 'ADD' },
            { targetStat: 'attackSpeed', value: -0.50, operation: 'ADD' }
        ],
        iconColor: 0x0088ff
    },

    // --- HEALTH UPGRADE (3 tiers) ---
    'heart_shard': {
        id: 'heart_shard',
        name: 'Heart Shard',
        description: 'Increases Max Health by 1',
        type: 'SILVER',
        rarity: 'COMMON',
        effects: [{ targetStat: 'health', value: 1, operation: 'ADD' }],
        iconColor: 0xff4444
    },
    'heart_container': {
        id: 'heart_container',
        name: 'Heart Container',
        description: 'Increases Max Health by 2',
        type: 'SILVER',
        rarity: 'UNCOMMON',
        effects: [{ targetStat: 'health', value: 2, operation: 'ADD' }],
        iconColor: 0xff0000
    },
    'heart_crystal': {
        id: 'heart_crystal',
        name: 'Heart Crystal',
        description: 'Increases Max Health by 3',
        type: 'SILVER',
        rarity: 'RARE',
        effects: [{ targetStat: 'health', value: 3, operation: 'ADD' }],
        iconColor: 0xff0000
    },

    // --- JUMP HEIGHT (3 tiers) ---
    'feather_anklet': {
        id: 'feather_anklet',
        name: 'Feather Anklet',
        description: 'Increases Jump Height by 10%',
        type: 'SILVER',
        rarity: 'COMMON',
        effects: [{ targetStat: 'jumpHeight', value: 0.10, operation: 'ADD' }],
        iconColor: 0xcccc00
    },
    'moon_stone': {
        id: 'moon_stone',
        name: 'Moon Stone',
        description: 'Increases Jump Height by 15%',
        type: 'SILVER',
        rarity: 'UNCOMMON',
        effects: [{ targetStat: 'jumpHeight', value: 0.15, operation: 'ADD' }],
        iconColor: 0xaaaa00
    },
    'sky_crystal': {
        id: 'sky_crystal',
        name: 'Sky Crystal',
        description: 'Increases Jump Height by 25%',
        type: 'SILVER',
        rarity: 'RARE',
        effects: [{ targetStat: 'jumpHeight', value: 0.25, operation: 'ADD' }],
        iconColor: 0xffff00
    },

    // --- ATTACK SPEED (2 tiers) ---
    'swift_blade': {
        id: 'swift_blade',
        name: 'Swift Blade',
        description: 'Increases Attack Speed by 15%',
        type: 'SILVER',
        rarity: 'COMMON',
        effects: [{ targetStat: 'attackSpeed', value: -0.15, operation: 'ADD' }], // Lower is faster
        iconColor: 0x0000ff
    },
    'chronos_edge': {
        id: 'chronos_edge',
        name: "Chrono's Edge",
        description: 'Increases Attack Speed by 30%',
        type: 'SILVER',
        rarity: 'RARE',
        effects: [{ targetStat: 'attackSpeed', value: -0.30, operation: 'ADD' }],
        iconColor: 0x2244ff
    },

    // GOLD ITEMS (Abilities)
    'hermes_feather': {
        id: 'hermes_feather',
        name: 'Hermes Feather',
        description: 'Grants Double Jump',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'double_jump',
        iconColor: 0xffd700,
        stackable: true,
        stackDescription: 'Triple Jump instead of Double Jump',
    },
    'vampiric_fang': {
        id: 'vampiric_fang',
        name: 'Vampiric Fang',
        description: 'Heal 1 HP on every 10th kill',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'vampirism',
        iconColor: 0xff0044
    },
    'phoenix_plume': {
        id: 'phoenix_plume',
        name: 'Phoenix Plume',
        description: 'Revive once per run with 1 HP',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'revive',
        iconColor: 0xff6600
    },
    'shadow_cloak': {
        id: 'shadow_cloak',
        name: 'Shadow Cloak',
        description: 'Dodge grants brief invisibility',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'shadow_dodge',
        iconColor: 0x440066
    },
    'titans_grip': {
        id: 'titans_grip',
        name: "Titan's Grip",
        description: 'Attacks have +50% knockback',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'mega_knockback',
        iconColor: 0x884400
    },
    'essence_magnet': {
        id: 'essence_magnet',
        name: 'Essence Magnet',
        description: '+25% essence from all sources',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'essence_boost',
        iconColor: 0xcc44ff
    },
    'wind_runner': {
        id: 'wind_runner',
        name: 'Wind Runner',
        description: 'Press Shift in midair to air dash',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'air_dash',
        iconColor: 0x88ccff,
        stackable: true,
        stackDescription: 'Air Dash cooldown reduced to 0.8s',
    },
    'spider_silk': {
        id: 'spider_silk',
        name: 'Spider Silk',
        description: 'Hold toward wall to climb upward',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'wall_climb',
        iconColor: 0xcccccc
    },
    'chain_hook': {
        id: 'chain_hook',
        name: 'Chain Hook',
        description: 'Press V to grapple to nearest platform',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'grappling_hook',
        iconColor: 0x886644
    },
    'life_spring': {
        id: 'life_spring',
        name: 'Life Spring',
        description: 'Regenerate 1 HP every 30 seconds out of combat',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'health_regen',
        iconColor: 0x44ff44,
        stackable: true,
        stackDescription: 'Regen timer reduced to 20s',
    },
    'phantom_step': {
        id: 'phantom_step',
        name: 'Phantom Step',
        description: 'Double i-frames and halved dodge cooldown',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'dodge_mastery',
        iconColor: 0x8844ff,
        stackable: true,
        stackDescription: 'Adds damaging afterimage trail on dodge',
    },
    'mirror_shield': {
        id: 'mirror_shield',
        name: 'Mirror Shield',
        description: 'Reflect 30% of damage back to attackers',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'damage_reflect',
        iconColor: 0x44ddff,
        stackable: true,
        stackDescription: '60% damage reflection instead of 30%',
    },
    'guardian_angel': {
        id: 'guardian_angel',
        name: 'Guardian Angel',
        description: '3s invincibility when health drops to 1 (once per run)',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'temp_shield',
        iconColor: 0xffdd44,
        stackable: true,
        stackDescription: 'Second activation after 5 minutes',
    },
    'cataclysm_orb': {
        id: 'cataclysm_orb',
        name: 'Cataclysm Orb',
        description: 'Press Q for massive explosion (500% damage, 60s cooldown)',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'cataclysm',
        iconColor: 0xff2200
    },
    'chrono_shard': {
        id: 'chrono_shard',
        name: 'Chrono Shard',
        description: 'Press E to slow time to 30% for 5 seconds (90s cooldown)',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'temporal_rift',
        iconColor: 0x22aaff,
        stackable: true,
        stackDescription: 'Time slow lasts 8s instead of 5s',
    },
    'divine_halo': {
        id: 'divine_halo',
        name: 'Divine Halo',
        description: 'Press R for 5 seconds of invincibility (120s cooldown)',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'divine_intervention',
        iconColor: 0xffffaa
    },
    'essence_crystal': {
        id: 'essence_crystal',
        name: 'Essence Crystal',
        description: 'Press F to convert essence into temporary power (+10% stats per 100 essence, 30s)',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'essence_burst',
        iconColor: 0xcc44ff
    },
    'counter_slash': {
        id: 'counter_slash',
        name: 'Counter Slash',
        description: 'Press G to enter counter stance (0.5s). If hit: negate damage and counter-attack',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'counter_stance',
        iconColor: 0xff8844
    },
    'ground_slam': {
        id: 'ground_slam',
        name: 'Ground Slam',
        description: 'Press T to slam the ground, creating a damaging shockwave',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'ground_slam',
        iconColor: 0x886633
    },
    'projectile_shot': {
        id: 'projectile_shot',
        name: 'Arcane Bolt',
        description: 'Press Y to fire a piercing projectile',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'projectile_shot',
        iconColor: 0x44aaff
    },
    'charged_devastation': {
        id: 'charged_devastation',
        name: 'Charged Devastation',
        description: 'Hold H to charge, release for up to 3x damage',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'charged_attack',
        iconColor: 0xff4400
    }
};

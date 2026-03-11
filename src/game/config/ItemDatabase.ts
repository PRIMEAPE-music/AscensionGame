import type { ItemData } from './ItemConfig';

export const ITEMS: Record<string, ItemData> = {
    // SILVER ITEMS (Stat Boosts)
    'iron_weight': {
        id: 'iron_weight',
        name: 'Iron Weight',
        description: 'Increases Attack Damage by 20%',
        type: 'SILVER',
        rarity: 'COMMON',
        effects: [{ targetStat: 'attackDamage', value: 0.12, operation: 'ADD' }], // Additive multiplier (e.g. +12% base)
        iconColor: 0xaaaaaa
    },
    'winged_boots': {
        id: 'winged_boots',
        name: 'Winged Boots',
        description: 'Increases Move Speed by 15%',
        type: 'SILVER',
        rarity: 'UNCOMMON',
        effects: [{ targetStat: 'moveSpeed', value: 0.15, operation: 'ADD' }],
        iconColor: 0x00ffff
    },
    'heart_container': {
        id: 'heart_container',
        name: 'Heart Container',
        description: 'Increases Max Health by 1',
        type: 'SILVER',
        rarity: 'RARE',
        effects: [{ targetStat: 'health', value: 3, operation: 'ADD' }], // Flat addition
        iconColor: 0xff0000
    },
    'swift_blade': {
        id: 'swift_blade',
        name: 'Swift Blade',
        description: 'Increases Attack Speed by 15%',
        type: 'SILVER',
        rarity: 'UNCOMMON',
        effects: [{ targetStat: 'attackSpeed', value: -0.15, operation: 'ADD' }], // Lower is faster
        iconColor: 0x0000ff
    },
    'moon_stone': {
        id: 'moon_stone',
        name: 'Moon Stone',
        description: 'Increases Jump Height by 15%',
        type: 'SILVER',
        rarity: 'RARE',
        effects: [{ targetStat: 'jumpHeight', value: 0.15, operation: 'ADD' }],
        iconColor: 0xaaaa00
    },

    // GOLD ITEMS (Abilities)
    'hermes_feather': {
        id: 'hermes_feather',
        name: 'Hermes Feather',
        description: 'Grants Double Jump',
        type: 'GOLD',
        rarity: 'LEGENDARY',
        abilityId: 'double_jump',
        iconColor: 0xffd700
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
        iconColor: 0x22aaff
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
    }
};

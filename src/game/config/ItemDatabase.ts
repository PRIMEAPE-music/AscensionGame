import type { ItemData } from './ItemConfig';

export const ITEMS: Record<string, ItemData> = {
    // SILVER ITEMS (Stat Boosts)
    'iron_weight': {
        id: 'iron_weight',
        name: 'Iron Weight',
        description: 'Increases Attack Damage by 20%',
        type: 'SILVER',
        rarity: 'COMMON',
        effects: [{ targetStat: 'attackDamage', value: 0.2, operation: 'ADD' }], // Additive multiplier (e.g. +20% base)
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
        effects: [{ targetStat: 'health', value: 1, operation: 'ADD' }], // Flat addition
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
    }
};

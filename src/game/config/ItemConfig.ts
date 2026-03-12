export type ItemType = 'SILVER' | 'GOLD' | 'CURSED';
export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY' | 'CURSED';
export type StatType = 'health' | 'moveSpeed' | 'jumpHeight' | 'attackDamage' | 'attackSpeed' | 'armor';
export type EffectOperation = 'ADD' | 'MULTIPLY';
export type ItemQuality = 'DAMAGED' | 'NORMAL' | 'PRISTINE';

export const QUALITY_MULTIPLIERS: Record<ItemQuality, number> = {
    DAMAGED: 0.7,
    NORMAL: 1.0,
    PRISTINE: 1.3,
};

export const QUALITY_COLORS: Record<ItemQuality, string> = {
    DAMAGED: '#888888',
    NORMAL: '#ffffff',
    PRISTINE: '#4488ff',
};

export const QUALITY_LABELS: Record<ItemQuality, string> = {
    DAMAGED: 'Damaged',
    NORMAL: 'Normal',
    PRISTINE: 'Pristine',
};

export interface ItemEffect {
    targetStat: StatType;
    value: number;
    operation: EffectOperation;
}

export interface ItemData {
    id: string;
    name: string;
    description: string;
    type: ItemType;
    rarity: ItemRarity;
    effects?: ItemEffect[]; // Silver items usually have effects
    abilityId?: string;     // Gold items unlock abilities
    iconColor: number;      // Placeholder for icon
    quality?: ItemQuality;  // Quality tier for silver items (defaults to NORMAL)
    armorHits?: number;     // For defense items: number of hits absorbed before breaking
    stackable?: boolean;    // Gold items: can equip same item twice if player owns duplicates
    stackDescription?: string; // Description of the enhanced stacking effect
    tags?: string[];         // Synergy tags for themed synergy sets (e.g., "fire", "defense", "speed")
    curseId?: string;        // Cursed items: identifier for the curse effect
    coopOnly?: boolean;      // If true, item only appears in item pools when co-op mode is active
}

/** Color used for cursed item rarity in UIs */
export const CURSED_RARITY_COLOR = '#9933cc';

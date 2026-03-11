export type ItemType = 'SILVER' | 'GOLD';
export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
export type StatType = 'health' | 'moveSpeed' | 'jumpHeight' | 'attackDamage' | 'attackSpeed';
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
}

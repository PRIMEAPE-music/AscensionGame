export type ItemType = 'SILVER' | 'GOLD';
export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
export type StatType = 'health' | 'moveSpeed' | 'jumpHeight' | 'attackDamage' | 'attackSpeed';
export type EffectOperation = 'ADD' | 'MULTIPLY';

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
}

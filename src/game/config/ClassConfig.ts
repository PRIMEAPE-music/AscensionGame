export const ClassType = {
    PALADIN: 'PALADIN',
    MONK: 'MONK',
    PRIEST: 'PRIEST'
} as const;
export type ClassType = typeof ClassType[keyof typeof ClassType];

export interface ClassStats {
    name: string;
    health: number;
    moveSpeed: number; // Multiplier
    jumpHeight: number; // Multiplier
    attackDamage: number; // Multiplier
    attackSpeed: number; // Multiplier (lower is faster cooldown)
    color: number; // Hex color for tint
}

export const CLASSES: Record<ClassType, ClassStats> = {
    [ClassType.PALADIN]: {
        name: 'Paladin',
        health: 4,
        moveSpeed: 0.85,
        jumpHeight: 0.9,
        attackDamage: 1.3,
        attackSpeed: 1.2, // Slower attacks
        color: 0x3333ff // Blue
    },
    [ClassType.MONK]: {
        name: 'Monk',
        health: 3,
        moveSpeed: 1.25,
        jumpHeight: 1.2,
        attackDamage: 0.7,
        attackSpeed: 0.6, // Faster attacks
        color: 0xffaa00 // Orange
    },
    [ClassType.PRIEST]: {
        name: 'Priest',
        health: 3,
        moveSpeed: 1.0,
        jumpHeight: 1.0,
        attackDamage: 0.9,
        attackSpeed: 1.0,
        color: 0xffffff // White
    }
};

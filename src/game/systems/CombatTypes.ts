import { ClassType } from '../config/ClassConfig';

export const AttackType = {
    LIGHT: 'LIGHT',
    HEAVY: 'HEAVY',
    SPECIAL: 'SPECIAL'
} as const;
export type AttackType = typeof AttackType[keyof typeof AttackType];

export const AttackDirection = {
    NEUTRAL: 'NEUTRAL',
    UP: 'UP',
    DOWN: 'DOWN'
} as const;
export type AttackDirection = typeof AttackDirection[keyof typeof AttackDirection];

export interface HitboxConfig {
    width: number;
    height: number;
    offsetX: number; // Relative to player center, assumes facing right
    offsetY: number;
    duration: number; // ms
}

export interface AttackDefinition {
    id: string;
    damageMultiplier: number; // Multiplier of base damage
    knockback: { x: number; y: number };
    hitstun: number; // ms
    startup: number; // ms before hitbox active
    recovery: number; // ms after hitbox ends before acting
    hitbox: HitboxConfig;
    animationKey?: string; // Placeholder for future animation
    color: number; // Debug color
}

export interface ComboNode {
    attack: AttackDefinition;
    next: {
        [key in AttackType]?: string; // Map input to next AttackDefinition ID
    };
}

export interface ClassCombatConfig {
    groundAttacks: {
        [key in AttackType]: {
            [key in AttackDirection]: string; // Maps to AttackDefinition ID
        }
    };
    airAttacks: {
        [key in AttackType]: {
            [key in AttackDirection]: string;
        }
    };
    attacks: Record<string, AttackDefinition>; // All available attacks by ID
    combos: Record<string, ComboNode>; // Combo trees starting from specific attacks
}

// Placeholder configurations for classes (can be moved to a config file later)
export const COMBAT_CONFIG: Record<ClassType, ClassCombatConfig> = {
    [ClassType.MONK]: {
        groundAttacks: {
            [AttackType.LIGHT]: {
                [AttackDirection.NEUTRAL]: 'monk_jab_1',
                [AttackDirection.UP]: 'monk_uppercut',
                [AttackDirection.DOWN]: 'monk_low_kick'
            },
            [AttackType.HEAVY]: {
                [AttackDirection.NEUTRAL]: 'monk_dash_punch',
                [AttackDirection.UP]: 'monk_high_kick',
                [AttackDirection.DOWN]: 'monk_sweep'
            },
            [AttackType.SPECIAL]: {
                [AttackDirection.NEUTRAL]: 'monk_blast',
                [AttackDirection.UP]: 'monk_rising_blast',
                [AttackDirection.DOWN]: 'monk_ground_slam'
            }
        },
        airAttacks: {
            [AttackType.LIGHT]: {
                [AttackDirection.NEUTRAL]: 'monk_air_kick',
                [AttackDirection.UP]: 'monk_air_up_kick',
                [AttackDirection.DOWN]: 'monk_dive_kick'
            },
            [AttackType.HEAVY]: {
                [AttackDirection.NEUTRAL]: 'monk_air_heavy',
                [AttackDirection.UP]: 'monk_air_up_heavy',
                [AttackDirection.DOWN]: 'monk_dive_bomb'
            },
            [AttackType.SPECIAL]: {
                [AttackDirection.NEUTRAL]: 'monk_air_blast',
                [AttackDirection.UP]: 'monk_air_rising',
                [AttackDirection.DOWN]: 'monk_meteor'
            }
        },
        attacks: {
            'monk_jab_1': {
                id: 'monk_jab_1',
                damageMultiplier: 0.8,
                knockback: { x: 100, y: -50 },
                hitstun: 200,
                startup: 50,
                recovery: 100,
                hitbox: { width: 40, height: 30, offsetX: 30, offsetY: 0, duration: 100 },
                color: 0xffff00
            },
            'monk_jab_2': {
                id: 'monk_jab_2',
                damageMultiplier: 0.9,
                knockback: { x: 150, y: -50 },
                hitstun: 250,
                startup: 50,
                recovery: 100,
                hitbox: { width: 40, height: 30, offsetX: 30, offsetY: 0, duration: 100 },
                color: 0xffaa00
            },
            'monk_jab_3': {
                id: 'monk_jab_3',
                damageMultiplier: 1.2,
                knockback: { x: 400, y: -200 },
                hitstun: 400,
                startup: 100,
                recovery: 300,
                hitbox: { width: 50, height: 40, offsetX: 40, offsetY: 0, duration: 150 },
                color: 0xff0000
            },
            // ... Add other attacks as needed, using defaults for now
            'monk_uppercut': {
                id: 'monk_uppercut',
                damageMultiplier: 1.0,
                knockback: { x: 50, y: -500 },
                hitstun: 400,
                startup: 100,
                recovery: 200,
                hitbox: { width: 30, height: 60, offsetX: 20, offsetY: -30, duration: 150 },
                color: 0x00ff00
            },
            'monk_low_kick': {
                id: 'monk_low_kick',
                damageMultiplier: 0.8,
                knockback: { x: 100, y: 0 },
                hitstun: 200,
                startup: 50,
                recovery: 100,
                hitbox: { width: 40, height: 20, offsetX: 30, offsetY: 20, duration: 100 },
                color: 0x0000ff
            },
            'monk_dash_punch': {
                id: 'monk_dash_punch',
                damageMultiplier: 1.1,
                knockback: { x: 300, y: -100 },
                hitstun: 300,
                startup: 150,
                recovery: 250,
                hitbox: { width: 60, height: 30, offsetX: 40, offsetY: 0, duration: 200 },
                color: 0xff00ff
            },
            // Defaults for others to prevent crashes
            'monk_high_kick': { id: 'monk_high_kick', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: -20, duration: 100 }, color: 0xcccccc },
            'monk_sweep': { id: 'monk_sweep', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: 20, duration: 100 }, color: 0xcccccc },
            'monk_blast': { id: 'monk_blast', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: 0, duration: 100 }, color: 0xcccccc },
            'monk_rising_blast': { id: 'monk_rising_blast', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: -20, duration: 100 }, color: 0xcccccc },
            'monk_ground_slam': { id: 'monk_ground_slam', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: 20, duration: 100 }, color: 0xcccccc },
            'monk_air_kick': { id: 'monk_air_kick', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: 0, duration: 100 }, color: 0xcccccc },
            'monk_air_up_kick': { id: 'monk_air_up_kick', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: -20, duration: 100 }, color: 0xcccccc },
            'monk_dive_kick': { id: 'monk_dive_kick', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: 20, duration: 100 }, color: 0xcccccc },
            'monk_air_heavy': { id: 'monk_air_heavy', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: 0, duration: 100 }, color: 0xcccccc },
            'monk_air_up_heavy': { id: 'monk_air_up_heavy', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: -20, duration: 100 }, color: 0xcccccc },
            'monk_dive_bomb': { id: 'monk_dive_bomb', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: 20, duration: 100 }, color: 0xcccccc },
            'monk_air_blast': { id: 'monk_air_blast', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: 0, duration: 100 }, color: 0xcccccc },
            'monk_air_rising': { id: 'monk_air_rising', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: -20, duration: 100 }, color: 0xcccccc },
            'monk_meteor': { id: 'monk_meteor', damageMultiplier: 1, knockback: { x: 100, y: -100 }, hitstun: 200, startup: 100, recovery: 200, hitbox: { width: 40, height: 40, offsetX: 30, offsetY: 20, duration: 100 }, color: 0xcccccc },

        },
        combos: {
            'monk_jab_1': {
                attack: { id: 'monk_jab_1' } as any, // Resolved at runtime or just use ID
                next: {
                    [AttackType.LIGHT]: 'monk_jab_2'
                }
            },
            'monk_jab_2': {
                attack: { id: 'monk_jab_2' } as any,
                next: {
                    [AttackType.LIGHT]: 'monk_jab_3'
                }
            }
        }
    },
    [ClassType.PALADIN]: { groundAttacks: {} as any, airAttacks: {} as any, attacks: {}, combos: {} }, // TODO
    [ClassType.PRIEST]: { groundAttacks: {} as any, airAttacks: {} as any, attacks: {}, combos: {} } // TODO
};

export type ComboButton = 'B' | 'X' | 'Y';

export interface ComboDefinition {
    id: string;
    name: string;
    sequence: ComboButton[]; // Button sequence
    aerial: boolean; // Whether this is an air combo
    damageMultiplier: number; // Bonus multiplier on final hit
    finisherEffect?: 'knockup' | 'knockback' | 'slam' | 'stun';
    finisherKnockback?: { x: number; y: number };
}

export const COMBO_DEFINITIONS: ComboDefinition[] = [
    // Ground combos
    {
        id: 'triple_strike',
        name: 'Triple Strike',
        sequence: ['B', 'B', 'B'],
        aerial: false,
        damageMultiplier: 1.3,
        finisherEffect: 'knockback',
        finisherKnockback: { x: 400, y: -100 },
    },
    {
        id: 'launcher_combo',
        name: 'Launcher',
        sequence: ['B', 'X', 'Y'],
        aerial: false,
        damageMultiplier: 1.2,
        finisherEffect: 'knockup',
        finisherKnockback: { x: 0, y: -500 },
    },
    {
        id: 'heavy_finisher',
        name: 'Heavy Finisher',
        sequence: ['X', 'X', 'B'],
        aerial: false,
        damageMultiplier: 1.4,
        finisherEffect: 'stun',
    },
    {
        id: 'sweep_combo',
        name: 'Sweep',
        sequence: ['Y', 'B', 'X'],
        aerial: false,
        damageMultiplier: 1.25,
        finisherEffect: 'knockback',
        finisherKnockback: { x: 300, y: 0 },
    },
    {
        id: 'rapid_strikes',
        name: 'Rapid Strikes',
        sequence: ['B', 'B', 'X'],
        aerial: false,
        damageMultiplier: 1.15,
    },
    // Aerial combos
    {
        id: 'air_triple',
        name: 'Air Rush',
        sequence: ['B', 'B', 'B'],
        aerial: true,
        damageMultiplier: 1.3,
        finisherEffect: 'slam',
        finisherKnockback: { x: 0, y: 400 },
    },
    {
        id: 'air_launcher',
        name: 'Sky Breaker',
        sequence: ['B', 'X', 'Y'],
        aerial: true,
        damageMultiplier: 1.35,
        finisherEffect: 'knockup',
        finisherKnockback: { x: 0, y: -600 },
    },
    {
        id: 'dive_combo',
        name: 'Meteor Strike',
        sequence: ['X', 'Y', 'B'],
        aerial: true,
        damageMultiplier: 1.5,
        finisherEffect: 'slam',
        finisherKnockback: { x: 0, y: 500 },
    },
];

export const COMBO_WINDOW = 500; // ms between inputs to maintain combo
export const COMBO_BUFFER = 150; // ms before attack ends where next input is buffered

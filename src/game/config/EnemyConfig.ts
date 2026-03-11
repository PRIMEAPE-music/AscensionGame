import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { ImpCrawler } from '../entities/ImpCrawler';
import { ShadowBat } from '../entities/ShadowBat';
import { DemonTurret } from '../entities/DemonTurret';
import { HellHound } from '../entities/HellHound';
import { VoidStalker } from '../entities/VoidStalker';
import { CursedKnight } from '../entities/CursedKnight';
import { FloatingEye } from '../entities/FloatingEye';
import { DemonSpawner } from '../entities/DemonSpawner';
import { RiftWeaver } from '../entities/RiftWeaver';
import { ArmorColossus } from '../entities/ArmorColossus';
import { PhaseDemon } from '../entities/PhaseDemon';
import { ChainDevil } from '../entities/ChainDevil';
import { SoulReaper } from '../entities/SoulReaper';
import { DemonGeneral } from '../entities/DemonGeneral';
import { TerrorMimic } from '../entities/TerrorMimic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnemyTier = 'basic' | 'intermediate' | 'advanced' | 'elite';

export interface EnemyDefinition {
    id: string;
    displayName: string;
    tier: EnemyTier;
    minAltitude: number;
    maxAltitude: number;
    weight: number;
    factory: (scene: Phaser.Scene, x: number, y: number, player: Player) => Enemy;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ENEMY_REGISTRY: Record<string, EnemyDefinition> = {
    crawler: {
        id: 'crawler',
        displayName: 'Imp Crawler',
        tier: 'basic',
        minAltitude: 0,
        maxAltitude: Infinity,
        weight: 3,
        factory: (scene, x, y, player) => new ImpCrawler(scene, x, y, player),
    },
    bat: {
        id: 'bat',
        displayName: 'Shadow Bat',
        tier: 'basic',
        minAltitude: 0,
        maxAltitude: Infinity,
        weight: 2,
        factory: (scene, x, y, player) => new ShadowBat(scene, x, y, player),
    },
    turret: {
        id: 'turret',
        displayName: 'Demon Turret',
        tier: 'basic',
        minAltitude: 0,
        maxAltitude: Infinity,
        weight: 1.5,
        factory: (scene, x, y, player) => new DemonTurret(scene, x, y, player),
    },
    hound: {
        id: 'hound',
        displayName: 'Hell Hound',
        tier: 'basic',
        minAltitude: 0,
        maxAltitude: Infinity,
        weight: 2,
        factory: (scene, x, y, player) => new HellHound(scene, x, y, player),
    },
    void_stalker: {
        id: 'void_stalker',
        displayName: 'Void Stalker',
        tier: 'intermediate',
        minAltitude: 1000,
        maxAltitude: Infinity,
        weight: 2.5,
        factory: (scene, x, y, player) => new VoidStalker(scene, x, y, player),
    },
    cursed_knight: {
        id: 'cursed_knight',
        displayName: 'Cursed Knight',
        tier: 'intermediate',
        minAltitude: 1000,
        maxAltitude: Infinity,
        weight: 2,
        factory: (scene, x, y, player) => new CursedKnight(scene, x, y, player),
    },
    floating_eye: {
        id: 'floating_eye',
        displayName: 'Floating Eye',
        tier: 'intermediate',
        minAltitude: 1000,
        maxAltitude: Infinity,
        weight: 2,
        factory: (scene, x, y, player) => new FloatingEye(scene, x, y, player),
    },
    demon_spawner: {
        id: 'demon_spawner',
        displayName: 'Demon Spawner',
        tier: 'intermediate',
        minAltitude: 1500,
        maxAltitude: Infinity,
        weight: 1.5,
        factory: (scene, x, y, player) => new DemonSpawner(scene, x, y, player),
    },
    rift_weaver: {
        id: 'rift_weaver',
        displayName: 'Rift Weaver',
        tier: 'advanced',
        minAltitude: 3000,
        maxAltitude: Infinity,
        weight: 2,
        factory: (scene, x, y, player) => new RiftWeaver(scene, x, y, player),
    },
    armor_colossus: {
        id: 'armor_colossus',
        displayName: 'Armor Colossus',
        tier: 'advanced',
        minAltitude: 3000,
        maxAltitude: Infinity,
        weight: 1.5,
        factory: (scene, x, y, player) => new ArmorColossus(scene, x, y, player),
    },
    phase_demon: {
        id: 'phase_demon',
        displayName: 'Phase Demon',
        tier: 'advanced',
        minAltitude: 3500,
        maxAltitude: Infinity,
        weight: 2,
        factory: (scene, x, y, player) => new PhaseDemon(scene, x, y, player),
    },
    chain_devil: {
        id: 'chain_devil',
        displayName: 'Chain Devil',
        tier: 'advanced',
        minAltitude: 4000,
        maxAltitude: Infinity,
        weight: 1.5,
        factory: (scene, x, y, player) => new ChainDevil(scene, x, y, player),
    },
    soul_reaper: {
        id: 'soul_reaper',
        displayName: 'Soul Reaper',
        tier: 'elite',
        minAltitude: 6000,
        maxAltitude: Infinity,
        weight: 2,
        factory: (scene, x, y, player) => new SoulReaper(scene, x, y, player),
    },
    demon_general: {
        id: 'demon_general',
        displayName: 'Demon General',
        tier: 'elite',
        minAltitude: 6000,
        maxAltitude: Infinity,
        weight: 1.5,
        factory: (scene, x, y, player) => new DemonGeneral(scene, x, y, player),
    },
    terror_mimic: {
        id: 'terror_mimic',
        displayName: 'Terror Mimic',
        tier: 'elite',
        minAltitude: 6500,
        maxAltitude: Infinity,
        weight: 1,
        factory: (scene, x, y, player) => new TerrorMimic(scene, x, y, player),
    },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns all enemy definitions that match the given tier and are eligible to
 * spawn at the specified altitude (altitude >= minAltitude && altitude <= maxAltitude).
 */
export function getEnemiesForAltitude(tier: EnemyTier, altitude: number): EnemyDefinition[] {
    return Object.values(ENEMY_REGISTRY).filter(
        (def) => def.tier === tier && altitude >= def.minAltitude && altitude <= def.maxAltitude,
    );
}

/**
 * Picks a single enemy definition from the provided list using weighted random
 * selection based on each definition's `weight` value. Returns `null` if the
 * list is empty.
 */
export function selectWeightedEnemy(enemies: EnemyDefinition[]): EnemyDefinition | null {
    if (enemies.length === 0) {
        return null;
    }

    const totalWeight = enemies.reduce((sum, def) => sum + def.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const def of enemies) {
        roll -= def.weight;
        if (roll <= 0) {
            return def;
        }
    }

    // Fallback (should not be reached due to floating-point, but just in case)
    return enemies[enemies.length - 1];
}

const STORAGE_KEY = 'ascension_run_save';

export interface RunSaveData {
    version: number;           // Save format version for compatibility
    timestamp: number;         // When saved
    classType: string;         // Selected class
    health: number;
    maxHealth: number;
    altitude: number;          // Player altitude in meters
    essence: number;
    elapsedTimeMs: number;     // Time played in this run
    kills: number;
    bossesDefeated: number;
    // Silver item slot count (dynamic)
    maxSilverItems?: number;
    // Inventory
    silverItems: Array<{
        id: string;
        quality?: string;
    }>;
    equippedGoldItems: string[];
    // Player abilities (from gold items)
    abilities: string[];
    // Active modifiers
    activeModifiers: string[];
    // Boss arena state
    nextBossAltitude: number;
    // Player position (approximate - will start on nearest platform)
    playerX: number;
    // Score/stats
    damageDealt: number;
    damageTaken: number;
    perfectDodges: number;
    itemsCollected: number;
    // Subclass specialization (chosen after boss #2)
    subclass?: string;
}

export const RunSaveManager = {
    load(): RunSaveData | null {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw) as RunSaveData;
            // Version check
            if (data.version !== 1) return null;
            // Basic validation
            if (typeof data.altitude !== 'number' || typeof data.classType !== 'string') return null;
            return data;
        } catch {
            return null;
        }
    },

    save(data: RunSaveData): void {
        try {
            data.version = 1;
            data.timestamp = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
            // localStorage may be unavailable; silently ignore
        }
    },

    clear(): void {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // silently ignore
        }
    },

    hasSave(): boolean {
        try {
            return localStorage.getItem(STORAGE_KEY) !== null;
        } catch {
            return false;
        }
    },

    getSaveInfo(): { classType: string; altitude: number; timestamp: number } | null {
        const data = this.load();
        if (!data) return null;
        return {
            classType: data.classType,
            altitude: data.altitude,
            timestamp: data.timestamp,
        };
    },
};

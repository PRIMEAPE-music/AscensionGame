const STORAGE_KEY = "ascension_stats";

export interface RunStats {
  altitude: number;
  timeMs: number;
  bossesDefeated: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  perfectDodges: number;
  perfectParries: number;
  itemsCollected: number;
  essenceEarned: number;
}

export interface LifetimeStats {
  totalAltitude: number;
  totalBossesDefeated: number;
  totalDeaths: number;
  highestAltitude: Record<string, number>;
  fastest5000m: number;
  totalPlayTime: number;
  totalRuns: number;
  favoriteClass: string;
  classRunCounts: Record<string, number>;
}

interface GoldItemCollection {
  unlockedGoldItems: string[];
  goldItemDuplicates: Record<string, number>;
}

interface StoredData {
  lifetime: LifetimeStats;
  goldItems: GoldItemCollection;
}

function defaultLifetime(): LifetimeStats {
  return {
    totalAltitude: 0,
    totalBossesDefeated: 0,
    totalDeaths: 0,
    highestAltitude: {},
    fastest5000m: 0,
    totalPlayTime: 0,
    totalRuns: 0,
    favoriteClass: "",
    classRunCounts: {},
  };
}

function defaultGoldItems(): GoldItemCollection {
  return {
    unlockedGoldItems: [],
    goldItemDuplicates: {},
  };
}

function defaultRunStats(): RunStats {
  return {
    altitude: 0,
    timeMs: 0,
    bossesDefeated: 0,
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    perfectDodges: 0,
    perfectParries: 0,
    itemsCollected: 0,
    essenceEarned: 0,
  };
}

let lifetime: LifetimeStats = defaultLifetime();
let goldItems: GoldItemCollection = defaultGoldItems();
let run: RunStats = defaultRunStats();
let runClassType: string = "";
let runStartTimestamp: number = 0;

export const PersistentStats = {
  /** Initialize/load from localStorage. Auto-initializes if no data exists. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: StoredData = JSON.parse(raw);
        lifetime = { ...defaultLifetime(), ...parsed.lifetime };
        goldItems = { ...defaultGoldItems(), ...parsed.goldItems };
      } else {
        lifetime = defaultLifetime();
        goldItems = defaultGoldItems();
      }
    } catch {
      lifetime = defaultLifetime();
      goldItems = defaultGoldItems();
    }
  },

  /** Save lifetime and gold item data to localStorage. */
  save(): void {
    try {
      const data: StoredData = { lifetime, goldItems };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable; silently ignore
    }
  },

  /** Start a new run — resets per-run stats. */
  startRun(classType: string): void {
    run = defaultRunStats();
    runClassType = classType;
    runStartTimestamp = Date.now();
  },

  /** End a run — merge per-run stats into lifetime, increment totalDeaths. */
  endRun(): void {
    run.timeMs = Date.now() - runStartTimestamp;

    // Merge into lifetime
    lifetime.totalAltitude += run.altitude;
    lifetime.totalBossesDefeated += run.bossesDefeated;
    lifetime.totalDeaths++;
    lifetime.totalPlayTime += run.timeMs;
    lifetime.totalRuns++;

    // Per-class highest altitude
    if (runClassType) {
      const prev = lifetime.highestAltitude[runClassType] || 0;
      if (run.altitude > prev) {
        lifetime.highestAltitude[runClassType] = run.altitude;
      }
    }

    // Fastest 5000m
    if (run.altitude >= 5000) {
      if (lifetime.fastest5000m === 0 || run.timeMs < lifetime.fastest5000m) {
        lifetime.fastest5000m = run.timeMs;
      }
    }

    // Class run counts and favorite class
    if (runClassType) {
      lifetime.classRunCounts[runClassType] =
        (lifetime.classRunCounts[runClassType] || 0) + 1;

      // Determine favorite class (most played)
      let maxRuns = 0;
      let favorite = "";
      for (const [cls, count] of Object.entries(lifetime.classRunCounts)) {
        if (count > maxRuns) {
          maxRuns = count;
          favorite = cls;
        }
      }
      lifetime.favoriteClass = favorite;
    }

    // Essence
    run.essenceEarned = run.essenceEarned; // already tracked incrementally
  },

  // ─── Per-Run Stat Tracking ─────────────────────────────────────────

  addKill(): void {
    run.kills++;
  },

  addBossDefeat(): void {
    run.bossesDefeated++;
  },

  addDamageDealt(amount: number): void {
    run.damageDealt += amount;
  },

  addDamageTaken(amount: number): void {
    run.damageTaken += amount;
  },

  addPerfectDodge(): void {
    run.perfectDodges++;
  },

  addPerfectParry(): void {
    run.perfectParries++;
  },

  addItemCollected(): void {
    run.itemsCollected++;
  },

  /** Update run altitude — only stores if higher than current run max. */
  setAltitude(alt: number): void {
    if (alt > run.altitude) {
      run.altitude = alt;
    }
  },

  setEssence(amount: number): void {
    run.essenceEarned = amount;
  },

  // ─── Gold Item Collection ──────────────────────────────────────────

  unlockGoldItem(itemId: string): void {
    if (!goldItems.unlockedGoldItems.includes(itemId)) {
      goldItems.unlockedGoldItems.push(itemId);
      goldItems.goldItemDuplicates[itemId] = 1;
    } else {
      goldItems.goldItemDuplicates[itemId] =
        (goldItems.goldItemDuplicates[itemId] || 1) + 1;
    }
  },

  getUnlockedGoldItems(): string[] {
    return [...goldItems.unlockedGoldItems];
  },

  getGoldItemCount(itemId: string): number {
    return goldItems.goldItemDuplicates[itemId] || 0;
  },

  // ─── Getters ───────────────────────────────────────────────────────

  getLifetimeStats(): LifetimeStats {
    return { ...lifetime };
  },

  getRunStats(): RunStats {
    return { ...run };
  },

  getHighestAltitude(classType?: string): number {
    if (classType) {
      return lifetime.highestAltitude[classType] || 0;
    }
    // Return overall highest across all classes
    let max = 0;
    for (const alt of Object.values(lifetime.highestAltitude)) {
      if (alt > max) max = alt;
    }
    return max;
  },
};

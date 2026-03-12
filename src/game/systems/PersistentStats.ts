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

export interface PerClassStats {
  runs: number;
  bestAltitude: number;
  totalKills: number;
  bestTime: number;
  bossesDefeated: number;
}

export interface RunHistoryEntry {
  date: string;
  class: string;
  altitude: number;
  time: number;
  kills: number;
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
  // New extended stats
  totalPlayTimeMs: number;
  perClassStats: Record<string, PerClassStats>;
  currentStreak: number;
  bestStreak: number;
  totalEssenceEarned: number;
  totalPortalsUsed: number;
  totalParries: number;
  totalPerfectDodges: number;
  totalKills: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  bestSingleRunKills: number;
  bestSingleRunTime: number;
  runHistory: RunHistoryEntry[];
}

interface GoldItemCollection {
  unlockedGoldItems: string[];
  goldItemDuplicates: Record<string, number>;
}

interface StoredData {
  lifetime: LifetimeStats;
  goldItems: GoldItemCollection;
}

function defaultPerClassStats(): PerClassStats {
  return {
    runs: 0,
    bestAltitude: 0,
    totalKills: 0,
    bestTime: 0,
    bossesDefeated: 0,
  };
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
    // New extended stats
    totalPlayTimeMs: 0,
    perClassStats: {},
    currentStreak: 0,
    bestStreak: 0,
    totalEssenceEarned: 0,
    totalPortalsUsed: 0,
    totalParries: 0,
    totalPerfectDodges: 0,
    totalKills: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    bestSingleRunKills: 0,
    bestSingleRunTime: 0,
    runHistory: [],
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
        // Ensure perClassStats and runHistory are properly initialized even from old saves
        if (!lifetime.perClassStats) lifetime.perClassStats = {};
        if (!lifetime.runHistory) lifetime.runHistory = [];
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
    lifetime.totalPlayTimeMs += run.timeMs;
    lifetime.totalRuns++;

    // Aggregate combat stats
    lifetime.totalKills += run.kills;
    lifetime.totalDamageDealt += run.damageDealt;
    lifetime.totalDamageTaken += run.damageTaken;
    lifetime.totalParries += run.perfectParries;
    lifetime.totalPerfectDodges += run.perfectDodges;
    lifetime.totalEssenceEarned += run.essenceEarned;

    // Best single-run records
    if (run.kills > lifetime.bestSingleRunKills) {
      lifetime.bestSingleRunKills = run.kills;
    }
    if (run.timeMs > 0 && (lifetime.bestSingleRunTime === 0 || run.timeMs > lifetime.bestSingleRunTime)) {
      lifetime.bestSingleRunTime = run.timeMs;
    }

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

    // Per-class detailed stats
    if (runClassType) {
      if (!lifetime.perClassStats[runClassType]) {
        lifetime.perClassStats[runClassType] = defaultPerClassStats();
      }
      const pcs = lifetime.perClassStats[runClassType];
      pcs.runs++;
      pcs.totalKills += run.kills;
      pcs.bossesDefeated += run.bossesDefeated;
      if (run.altitude > pcs.bestAltitude) {
        pcs.bestAltitude = run.altitude;
      }
      if (run.timeMs > 0 && (pcs.bestTime === 0 || run.timeMs > pcs.bestTime)) {
        pcs.bestTime = run.timeMs;
      }
    }

    // Streak tracking (altitude > 1000m counts as a good run)
    if (run.altitude > 1000) {
      lifetime.currentStreak++;
      if (lifetime.currentStreak > lifetime.bestStreak) {
        lifetime.bestStreak = lifetime.currentStreak;
      }
    } else {
      lifetime.currentStreak = 0;
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

    // Run history (keep last 20)
    const historyEntry: RunHistoryEntry = {
      date: new Date().toISOString(),
      class: runClassType,
      altitude: Math.floor(run.altitude),
      time: run.timeMs,
      kills: run.kills,
    };
    lifetime.runHistory.push(historyEntry);
    if (lifetime.runHistory.length > 20) {
      lifetime.runHistory = lifetime.runHistory.slice(-20);
    }

    // Essence
    run.essenceEarned = run.essenceEarned; // already tracked incrementally
  },

  /** Record a run ending with full data (alternative to endRun for external callers). */
  recordRunEnd(data: {
    classType: string;
    altitude: number;
    kills: number;
    bossesDefeated: number;
    timeMs: number;
    essence: number;
  }): void {
    // This is a convenience method that sets run data and calls endRun.
    // If endRun was already called (which it normally is from MainScene),
    // this should NOT be called as well to avoid double-counting.
    // Only use if endRun was not called.
    run.altitude = data.altitude;
    run.kills = data.kills;
    run.bossesDefeated = data.bossesDefeated;
    run.essenceEarned = data.essence;
    runClassType = data.classType;
    run.timeMs = data.timeMs;
    // Skip the timeMs calculation in endRun by setting runStartTimestamp
    runStartTimestamp = Date.now() - data.timeMs;
    PersistentStats.endRun();
  },

  /** Increment total play time (for periodic saves during gameplay). */
  addPlayTime(ms: number): void {
    lifetime.totalPlayTimeMs += ms;
    lifetime.totalPlayTime += ms;
  },

  /** Track a portal usage. */
  addPortalUsed(): void {
    lifetime.totalPortalsUsed++;
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
    return { ...lifetime, perClassStats: { ...lifetime.perClassStats }, runHistory: [...lifetime.runHistory] };
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

  getPerClassStats(classType: string): PerClassStats {
    return lifetime.perClassStats[classType]
      ? { ...lifetime.perClassStats[classType] }
      : defaultPerClassStats();
  },

  getRunHistory(): RunHistoryEntry[] {
    return [...lifetime.runHistory];
  },
};

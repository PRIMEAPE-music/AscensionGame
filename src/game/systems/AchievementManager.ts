// ─── Achievement System ──────────────────────────────────────────────────────
// Defines achievements and tracks unlock progress via localStorage.
// Self-contained types to avoid cross-dependency issues with PersistentStats
// during parallel development.

import { CosmeticManager } from "./CosmeticManager";

const STORAGE_KEY = "ascension_achievements";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Stats snapshot passed in at check time (mirrors PersistentStats shapes). */
export interface AchievementLifetimeStats {
  totalBossesDefeated: number;
  totalDeaths: number;
  highestAltitude: Record<string, number>; // per-class highest altitude
  totalRuns: number;
}

export interface AchievementRunStats {
  altitude: number;
  kills: number;
  bossesDefeated: number;
  essenceEarned: number;
}

export interface AchievementCheckStats {
  lifetime: AchievementLifetimeStats;
  run: AchievementRunStats;
  /** Currently selected class key (e.g. "PALADIN", "MONK", "PRIEST") */
  currentClass: string;
  /** Number of unique gold items collected (from PersistentStats gold items) */
  goldItemCount: number;
  /** Max combo reached this run */
  maxComboThisRun: number;
  /** Total kills across all runs (lifetime cumulative) */
  totalKills: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: AchievementCheckStats) => boolean;
  reward?: { type: "skin" | "theme"; id: string; name: string };
}

// ─── Achievement Definitions ─────────────────────────────────────────────────

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_boss",
    name: "Boss Slayer",
    description: "Defeat your first boss",
    icon: "\u{1F480}", // skull
    condition: (s) => s.run.bossesDefeated >= 1 || s.lifetime.totalBossesDefeated >= 1,
  },
  {
    id: "reach_5000m",
    name: "Cloud Walker",
    description: "Reach 5000m altitude",
    icon: "\u{2601}\u{FE0F}", // cloud
    condition: (s) => {
      const overallMax = Math.max(
        s.run.altitude,
        ...Object.values(s.lifetime.highestAltitude),
        0,
      );
      return overallMax >= 5000;
    },
  },
  {
    id: "reach_10000m",
    name: "Stratosphere",
    description: "Reach 10000m altitude",
    icon: "\u{2B50}", // star
    condition: (s) => {
      const overallMax = Math.max(
        s.run.altitude,
        ...Object.values(s.lifetime.highestAltitude),
        0,
      );
      return overallMax >= 10000;
    },
  },
  {
    id: "collect_10_gold",
    name: "Collector",
    description: "Collect 10 different gold items",
    icon: "\u{1F48E}", // gem
    condition: (s) => s.goldItemCount >= 10,
  },
  {
    id: "win_paladin",
    name: "Holy Warrior",
    description: "Reach 3000m as Paladin",
    icon: "\u{1F6E1}\u{FE0F}", // shield
    condition: (s) => {
      const paladinBest = s.lifetime.highestAltitude["PALADIN"] || 0;
      const currentRunPaladin =
        s.currentClass === "PALADIN" ? s.run.altitude : 0;
      return Math.max(paladinBest, currentRunPaladin) >= 3000;
    },
  },
  {
    id: "win_monk",
    name: "Enlightened",
    description: "Reach 3000m as Monk",
    icon: "\u{262F}\u{FE0F}", // yin-yang
    condition: (s) => {
      const monkBest = s.lifetime.highestAltitude["MONK"] || 0;
      const currentRunMonk = s.currentClass === "MONK" ? s.run.altitude : 0;
      return Math.max(monkBest, currentRunMonk) >= 3000;
    },
  },
  {
    id: "win_priest",
    name: "Divine Light",
    description: "Reach 3000m as Priest",
    icon: "\u{271D}\u{FE0F}", // cross
    condition: (s) => {
      const priestBest = s.lifetime.highestAltitude["PRIEST"] || 0;
      const currentRunPriest =
        s.currentClass === "PRIEST" ? s.run.altitude : 0;
      return Math.max(priestBest, currentRunPriest) >= 3000;
    },
  },
  {
    id: "defeat_100_bosses",
    name: "Boss Hunter",
    description: "Defeat 100 total bosses",
    icon: "\u{1F3C6}", // trophy
    condition: (s) =>
      s.lifetime.totalBossesDefeated + s.run.bossesDefeated >= 100,
  },
  {
    id: "perfect_boss",
    name: "Untouchable",
    description: "Defeat a boss without taking damage",
    icon: "\u{2728}", // sparkle
    // Checked via special boss-fight tracking, not generic stats.
    // The condition here acts as a fallback — the real trigger is endBossFight().
    condition: () => false, // Only unlocked via endBossFight()
  },
  {
    id: "chain_50_combo",
    name: "Combo Master",
    description: "Chain a 50-hit combo",
    icon: "\u{1F525}", // fire
    condition: (s) => s.maxComboThisRun >= 50,
  },
  {
    id: "total_1000_kills",
    name: "Genocider",
    description: "Kill 1000 total enemies",
    icon: "\u{2694}\u{FE0F}", // sword
    condition: (s) => s.totalKills + s.run.kills >= 1000,
  },
];

// ─── Internal State ──────────────────────────────────────────────────────────

interface StoredAchievements {
  unlocked: string[];
  /** Cumulative total kills across all runs (not tracked by PersistentStats) */
  totalKills: number;
  /** Highest combo ever reached */
  maxCombo: number;
}

let state: StoredAchievements = {
  unlocked: [],
  totalKills: 0,
  maxCombo: 0,
};

// Per-boss-fight tracking for "perfect boss"
let bossFightActive = false;
let bossFightDamageTaken = false;

// ─── Manager ─────────────────────────────────────────────────────────────────

export const AchievementManager = {
  /** Load achievement data from localStorage. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredAchievements>;
        state = {
          unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
          totalKills: typeof parsed.totalKills === "number" ? parsed.totalKills : 0,
          maxCombo: typeof parsed.maxCombo === "number" ? parsed.maxCombo : 0,
        };
      } else {
        state = { unlocked: [], totalKills: 0, maxCombo: 0 };
      }
    } catch {
      state = { unlocked: [], totalKills: 0, maxCombo: 0 };
    }
  },

  /** Save achievement data to localStorage. */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable; silently ignore
    }
  },

  /**
   * Check all achievements against current stats and unlock any newly met.
   * Returns array of newly unlocked achievement IDs.
   */
  checkAchievements(stats: AchievementCheckStats): string[] {
    const newlyUnlocked: string[] = [];

    // Update cumulative counters
    state.totalKills += stats.run.kills;
    if (stats.maxComboThisRun > state.maxCombo) {
      state.maxCombo = stats.maxComboThisRun;
    }

    // Build enriched stats that include our cumulative data
    const enrichedStats: AchievementCheckStats = {
      ...stats,
      totalKills: state.totalKills,
      maxComboThisRun: Math.max(stats.maxComboThisRun, state.maxCombo),
    };

    for (const achievement of ACHIEVEMENTS) {
      if (state.unlocked.includes(achievement.id)) continue;

      try {
        if (achievement.condition(enrichedStats)) {
          state.unlocked.push(achievement.id);
          newlyUnlocked.push(achievement.id);
        }
      } catch {
        // Skip achievements with condition errors
      }
    }

    if (newlyUnlocked.length > 0) {
      this.save();

      // Trigger cosmetic unlocks for each newly unlocked achievement
      for (const achievementId of newlyUnlocked) {
        CosmeticManager.checkAchievementUnlocks(achievementId);
      }
    }

    return newlyUnlocked;
  },

  /** Get array of unlocked achievement IDs. */
  getUnlocked(): string[] {
    return [...state.unlocked];
  },

  /** Check if a specific achievement is unlocked. */
  isUnlocked(id: string): boolean {
    return state.unlocked.includes(id);
  },

  /** Get all achievements with current unlock status. */
  getAll(): (Achievement & { unlocked: boolean })[] {
    return ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: state.unlocked.includes(a.id),
    }));
  },

  /** Get achievement definition by id (or undefined). */
  getById(id: string): Achievement | undefined {
    return ACHIEVEMENTS.find((a) => a.id === id);
  },

  // ─── Boss Fight Tracking (for "perfect_boss" achievement) ──────────────

  /** Call when a boss fight begins. */
  startBossFight(): void {
    bossFightActive = true;
    bossFightDamageTaken = false;
  },

  /** Call when the player takes damage during a boss fight. */
  recordBossDamage(): void {
    if (bossFightActive) {
      bossFightDamageTaken = true;
    }
  },

  /**
   * Call when a boss fight ends.
   * If the boss was defeated and no damage was taken, unlocks "perfect_boss".
   * Returns the achievement ID if newly unlocked, or null.
   */
  endBossFight(defeated: boolean): string | null {
    if (!bossFightActive) return null;
    bossFightActive = false;

    if (defeated && !bossFightDamageTaken) {
      if (!state.unlocked.includes("perfect_boss")) {
        state.unlocked.push("perfect_boss");
        this.save();
        CosmeticManager.checkAchievementUnlocks("perfect_boss");
        return "perfect_boss";
      }
    }

    bossFightDamageTaken = false;
    return null;
  },

  /** Get lifetime total kills (cumulative across sessions). */
  getTotalKills(): number {
    return state.totalKills;
  },

  /** Get highest combo ever achieved. */
  getMaxCombo(): number {
    return state.maxCombo;
  },
};

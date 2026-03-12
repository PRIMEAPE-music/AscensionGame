// ─── Achievement System ──────────────────────────────────────────────────────
// Defines achievements and tracks unlock progress via localStorage.
// Self-contained types to avoid cross-dependency issues with PersistentStats
// during parallel development.

import { CosmeticManager } from "./CosmeticManager";
import { EventBus } from "./EventBus";

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

export type AchievementCategory = "combat" | "exploration" | "collection" | "meta";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  condition: (stats: AchievementCheckStats) => boolean;
  /** Hint shown when locked (instead of full description) */
  hint?: string;
  /** For progress bar display: returns { current, target } or null if not applicable */
  progress?: (stats: AchievementCheckStats) => { current: number; target: number } | null;
  reward?: { type: "skin" | "theme"; id: string; name: string };
}

// ─── Achievement Definitions ─────────────────────────────────────────────────

const ACHIEVEMENTS: Achievement[] = [
  // ─── Combat Achievements ──────────────────────────────────────────────
  {
    id: "first_boss",
    name: "Boss Slayer",
    description: "Defeat your first boss",
    icon: "\u{1F480}", // skull
    category: "combat",
    condition: (s) => s.run.bossesDefeated >= 1 || s.lifetime.totalBossesDefeated >= 1,
    hint: "Show a boss who is in charge",
    progress: (s) => ({
      current: Math.min(1, s.run.bossesDefeated + s.lifetime.totalBossesDefeated),
      target: 1,
    }),
  },
  {
    id: "defeat_100_bosses",
    name: "Boss Hunter",
    description: "Defeat 100 total bosses",
    icon: "\u{1F3C6}", // trophy
    category: "combat",
    condition: (s) =>
      s.lifetime.totalBossesDefeated + s.run.bossesDefeated >= 100,
    hint: "Bosses fear your name",
    progress: (s) => ({
      current: Math.min(100, s.lifetime.totalBossesDefeated + s.run.bossesDefeated),
      target: 100,
    }),
  },
  {
    id: "perfect_boss",
    name: "Untouchable",
    description: "Defeat a boss without taking damage",
    icon: "\u{2728}", // sparkle
    category: "combat",
    // Checked via special boss-fight tracking, not generic stats.
    // The condition here acts as a fallback — the real trigger is endBossFight().
    condition: () => false, // Only unlocked via endBossFight()
    hint: "Flawless victory required",
  },
  {
    id: "chain_50_combo",
    name: "Combo Master",
    description: "Chain a 50-hit combo",
    icon: "\u{1F525}", // fire
    category: "combat",
    condition: (s) => s.maxComboThisRun >= 50,
    hint: "Keep the hits coming",
    progress: (s) => ({
      current: Math.min(50, s.maxComboThisRun),
      target: 50,
    }),
  },
  {
    id: "total_1000_kills",
    name: "Genocider",
    description: "Kill 1000 total enemies",
    icon: "\u{2694}\u{FE0F}", // sword
    category: "combat",
    condition: (s) => s.totalKills + s.run.kills >= 1000,
    hint: "A trail of destruction",
    progress: (s) => ({
      current: Math.min(1000, s.totalKills + s.run.kills),
      target: 1000,
    }),
  },
  {
    id: "combo_master_20",
    name: "Combo King",
    description: "Reach a 20-hit combo",
    icon: "\u{1F4A5}", // collision
    category: "combat",
    condition: (s) => s.maxComboThisRun >= 20,
    hint: "String together a relentless chain",
    progress: (s) => ({
      current: Math.min(20, s.maxComboThisRun),
      target: 20,
    }),
  },
  {
    id: "boss_rush",
    name: "Boss Rush",
    description: "Defeat 3 bosses in under 10 minutes",
    icon: "\u{23F1}\u{FE0F}", // stopwatch
    category: "combat",
    // Checked via run stats — 3 bosses defeated + run time from endBossFight tracking
    condition: () => false, // Only unlocked via endBossFight() time tracking
    hint: "Speed is of the essence against the big ones",
  },
  {
    id: "parry_king",
    name: "Parry King",
    description: "Successfully parry 50 times (lifetime)",
    icon: "\u{1F6E1}\u{FE0F}", // shield
    category: "combat",
    // Checked via stored parry counter
    condition: () => false, // Checked via parry tracking
    hint: "Turn their attacks against them",
  },
  {
    id: "one_hp_hero",
    name: "One HP Hero",
    description: "Defeat a boss with only 1 HP remaining",
    icon: "\u{1F49B}", // yellow heart
    category: "combat",
    // Checked via special boss-fight tracking
    condition: () => false, // Only unlocked via endBossFight()
    hint: "Live dangerously against a powerful foe",
  },

  // ─── Exploration Achievements ─────────────────────────────────────────
  {
    id: "reach_5000m",
    name: "Cloud Walker",
    description: "Reach 5,000m altitude",
    icon: "\u{2601}\u{FE0F}", // cloud
    category: "exploration",
    condition: (s) => {
      const overallMax = Math.max(
        s.run.altitude,
        ...Object.values(s.lifetime.highestAltitude),
        0,
      );
      return overallMax >= 5000;
    },
    hint: "Climb higher into the clouds",
    progress: (s) => ({
      current: Math.min(5000, Math.max(s.run.altitude, ...Object.values(s.lifetime.highestAltitude), 0)),
      target: 5000,
    }),
  },
  {
    id: "reach_10000m",
    name: "Stratosphere",
    description: "Reach 10,000m altitude",
    icon: "\u{2B50}", // star
    category: "exploration",
    condition: (s) => {
      const overallMax = Math.max(
        s.run.altitude,
        ...Object.values(s.lifetime.highestAltitude),
        0,
      );
      return overallMax >= 10000;
    },
    hint: "Push beyond all known limits",
    progress: (s) => ({
      current: Math.min(10000, Math.max(s.run.altitude, ...Object.values(s.lifetime.highestAltitude), 0)),
      target: 10000,
    }),
  },
  {
    id: "sky_explorer",
    name: "Sky Explorer",
    description: "Reach 10,000m altitude in a single run",
    icon: "\u{1F6F8}", // flying saucer
    category: "exploration",
    condition: (s) => s.run.altitude >= 10000,
    hint: "The sky is not the limit",
    progress: (s) => ({
      current: Math.min(10000, s.run.altitude),
      target: 10000,
    }),
  },
  {
    id: "portal_hopper",
    name: "Portal Hopper",
    description: "Use 10 portals in a single run",
    icon: "\u{1F300}", // cyclone
    category: "exploration",
    // Checked via stored portal counter (per-run)
    condition: () => false, // Tracked via portal-teleport events
    hint: "Step through the void... repeatedly",
  },
  {
    id: "speed_demon",
    name: "Speed Demon",
    description: "Reach maximum movement speed",
    icon: "\u{1F3CE}\u{FE0F}", // racing car
    category: "exploration",
    // Checked via speed-change events
    condition: () => false, // Tracked via speed-change events
    hint: "Push your speed to the absolute limit",
  },
  {
    id: "all_biomes",
    name: "World Traveler",
    description: "Visit all biome types in a single run",
    icon: "\u{1F30D}", // earth globe
    category: "exploration",
    // Checked via biome-change events (DEPTHS, CAVERNS, SPIRE, SUMMIT)
    condition: () => false, // Tracked via biome tracking
    hint: "See everything this world has to offer",
  },

  // ─── Collection Achievements ──────────────────────────────────────────
  {
    id: "collect_10_gold",
    name: "Collector",
    description: "Collect 10 different gold items",
    icon: "\u{1F48E}", // gem
    category: "collection",
    condition: (s) => s.goldItemCount >= 10,
    hint: "Gold items are worth seeking out",
    progress: (s) => ({
      current: Math.min(10, s.goldItemCount),
      target: 10,
    }),
  },
  {
    id: "full_inventory",
    name: "Pack Rat",
    description: "Fill all silver item slots simultaneously",
    icon: "\u{1F392}", // backpack
    category: "collection",
    // Checked via inventory-change events
    condition: () => false, // Tracked via inventory events
    hint: "No empty pockets allowed",
  },
  {
    id: "gold_collector",
    name: "Golden Hoarder",
    description: "Own every gold item",
    icon: "\u{1F451}", // crown
    category: "collection",
    // Checked via gold item count vs total gold items
    condition: (s) => s.goldItemCount >= 32, // 32 gold items in ItemDatabase
    hint: "Amass the complete golden collection",
    progress: (s) => ({
      current: Math.min(32, s.goldItemCount),
      target: 32,
    }),
  },
  {
    id: "pristine_run",
    name: "Quality Control",
    description: "Get 5 Pristine quality items in one run",
    icon: "\u{1F4A0}", // diamond shape
    category: "collection",
    // Checked via inventory tracking
    condition: () => false, // Tracked via inventory events
    hint: "Only the finest quality will do",
  },
  {
    id: "big_spender",
    name: "Big Spender",
    description: "Spend 500 essence in a single gambling session",
    icon: "\u{1F3B0}", // slot machine
    category: "collection",
    // Checked via gambling events
    condition: () => false, // Tracked via gambling events
    hint: "Fortune favors the bold... and the reckless",
  },

  // ─── Meta Achievements ────────────────────────────────────────────────
  {
    id: "win_paladin",
    name: "Holy Warrior",
    description: "Reach 3,000m as Paladin",
    icon: "\u{1F6E1}\u{FE0F}", // shield
    category: "meta",
    condition: (s) => {
      const paladinBest = s.lifetime.highestAltitude["PALADIN"] || 0;
      const currentRunPaladin =
        s.currentClass === "PALADIN" ? s.run.altitude : 0;
      return Math.max(paladinBest, currentRunPaladin) >= 3000;
    },
    hint: "The Paladin must prove worthy",
    progress: (s) => ({
      current: Math.min(3000, Math.max(s.lifetime.highestAltitude["PALADIN"] || 0, s.currentClass === "PALADIN" ? s.run.altitude : 0)),
      target: 3000,
    }),
  },
  {
    id: "win_monk",
    name: "Enlightened",
    description: "Reach 3,000m as Monk",
    icon: "\u{262F}\u{FE0F}", // yin-yang
    category: "meta",
    condition: (s) => {
      const monkBest = s.lifetime.highestAltitude["MONK"] || 0;
      const currentRunMonk = s.currentClass === "MONK" ? s.run.altitude : 0;
      return Math.max(monkBest, currentRunMonk) >= 3000;
    },
    hint: "The Monk seeks enlightenment through ascension",
    progress: (s) => ({
      current: Math.min(3000, Math.max(s.lifetime.highestAltitude["MONK"] || 0, s.currentClass === "MONK" ? s.run.altitude : 0)),
      target: 3000,
    }),
  },
  {
    id: "win_priest",
    name: "Divine Light",
    description: "Reach 3,000m as Priest",
    icon: "\u{271D}\u{FE0F}", // cross
    category: "meta",
    condition: (s) => {
      const priestBest = s.lifetime.highestAltitude["PRIEST"] || 0;
      const currentRunPriest =
        s.currentClass === "PRIEST" ? s.run.altitude : 0;
      return Math.max(priestBest, currentRunPriest) >= 3000;
    },
    hint: "The Priest must channel divine power",
    progress: (s) => ({
      current: Math.min(3000, Math.max(s.lifetime.highestAltitude["PRIEST"] || 0, s.currentClass === "PRIEST" ? s.run.altitude : 0)),
      target: 3000,
    }),
  },
  {
    id: "dedication",
    name: "Dedicated",
    description: "Play 100 total runs",
    icon: "\u{1F4AA}", // flexed biceps
    category: "meta",
    condition: (s) => s.lifetime.totalRuns >= 100,
    hint: "Persistence is key",
    progress: (s) => ({
      current: Math.min(100, s.lifetime.totalRuns),
      target: 100,
    }),
  },
  {
    id: "class_master",
    name: "Class Master",
    description: "Reach 5,000m with all 3 classes",
    icon: "\u{1F31F}", // glowing star
    category: "meta",
    condition: (s) => {
      const classes = ["PALADIN", "MONK", "PRIEST"];
      return classes.every((cls) => {
        const best = s.lifetime.highestAltitude[cls] || 0;
        const currentRun = s.currentClass === cls ? s.run.altitude : 0;
        return Math.max(best, currentRun) >= 5000;
      });
    },
    hint: "Master every path of ascension",
  },
  {
    id: "modifier_madness",
    name: "Modifier Madness",
    description: "Complete a run reaching 3,000m with 3+ modifiers active",
    icon: "\u{1F608}", // smiling face with horns
    category: "meta",
    // Checked via modifier count + altitude at end of run
    condition: () => false, // Tracked via modifier tracking
    hint: "Stack the odds against yourself... and still triumph",
  },
];

// ─── Internal State ──────────────────────────────────────────────────────────

interface StoredAchievements {
  unlocked: string[];
  /** Timestamps of when each achievement was unlocked (id -> ISO date string) */
  unlockDates: Record<string, string>;
  /** Cumulative total kills across all runs (not tracked by PersistentStats) */
  totalKills: number;
  /** Highest combo ever reached */
  maxCombo: number;
  /** Lifetime parry count */
  totalParries: number;
  /** Per-run tracking: portals used this run */
  portalsThisRun: number;
  /** Per-run tracking: biomes visited this run */
  biomesThisRun: string[];
  /** Per-run tracking: pristine items collected this run */
  pristineItemsThisRun: number;
  /** Per-run tracking: essence spent gambling this session */
  gamblingSpentThisSession: number;
  /** Per-run tracking: silver slots filled */
  silverSlotsFull: boolean;
  /** Per-run tracking: max speed reached */
  maxSpeedReached: boolean;
  /** Per-run tracking: boss rush — timestamps of boss defeats this run */
  bossDefeatTimestamps: number[];
  /** Per-run tracking: player HP when boss defeated */
  playerHpAtBossDefeat: number;
  /** Run start timestamp for boss rush timing */
  runStartTime: number;
  /** Per-run tracking: active modifier count */
  activeModifierCount: number;
  /** Daily challenge completions for streak tracking */
  dailyChallengeCompletions: string[];
}

const defaultState = (): StoredAchievements => ({
  unlocked: [],
  unlockDates: {},
  totalKills: 0,
  maxCombo: 0,
  totalParries: 0,
  portalsThisRun: 0,
  biomesThisRun: [],
  pristineItemsThisRun: 0,
  gamblingSpentThisSession: 0,
  silverSlotsFull: false,
  maxSpeedReached: false,
  bossDefeatTimestamps: [],
  playerHpAtBossDefeat: 0,
  runStartTime: 0,
  activeModifierCount: 0,
  dailyChallengeCompletions: [],
});

let state: StoredAchievements = defaultState();

// Per-boss-fight tracking for "perfect boss" and "one hp hero"
let bossFightActive = false;
let bossFightDamageTaken = false;
let currentPlayerHp = 0;

// Event listener cleanup functions
let eventCleanups: (() => void)[] = [];

// ─── Manager ─────────────────────────────────────────────────────────────────

export const AchievementManager = {
  /** Load achievement data from localStorage. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredAchievements>;
        state = {
          ...defaultState(),
          unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
          unlockDates: (typeof parsed.unlockDates === "object" && parsed.unlockDates) ? parsed.unlockDates : {},
          totalKills: typeof parsed.totalKills === "number" ? parsed.totalKills : 0,
          maxCombo: typeof parsed.maxCombo === "number" ? parsed.maxCombo : 0,
          totalParries: typeof parsed.totalParries === "number" ? parsed.totalParries : 0,
          dailyChallengeCompletions: Array.isArray(parsed.dailyChallengeCompletions) ? parsed.dailyChallengeCompletions : [],
        };
      } else {
        state = defaultState();
      }
    } catch {
      state = defaultState();
    }
  },

  /** Save achievement data to localStorage. */
  save(): void {
    try {
      // Only persist fields that matter across sessions
      const persistData = {
        unlocked: state.unlocked,
        unlockDates: state.unlockDates,
        totalKills: state.totalKills,
        maxCombo: state.maxCombo,
        totalParries: state.totalParries,
        dailyChallengeCompletions: state.dailyChallengeCompletions,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistData));
    } catch {
      // localStorage may be unavailable; silently ignore
    }
  },

  /** Set up event listeners for real-time achievement tracking during gameplay. */
  setupEventListeners(): void {
    // Clean up any existing listeners
    this.cleanupEventListeners();

    // Reset per-run tracking
    state.portalsThisRun = 0;
    state.biomesThisRun = [];
    state.pristineItemsThisRun = 0;
    state.gamblingSpentThisSession = 0;
    state.silverSlotsFull = false;
    state.maxSpeedReached = false;
    state.bossDefeatTimestamps = [];
    state.playerHpAtBossDefeat = 0;
    state.runStartTime = Date.now();
    state.activeModifierCount = 0;

    // Check active modifiers
    try {
      const mods = (window as any).__activeModifiers;
      if (Array.isArray(mods)) {
        state.activeModifierCount = mods.length;
      }
    } catch { /* ignore */ }

    // Track portal usage
    const unsubPortal = EventBus.on("portal-teleport", () => {
      state.portalsThisRun++;
      if (state.portalsThisRun >= 10) {
        this.tryUnlock("portal_hopper");
      }
    });
    eventCleanups.push(unsubPortal);

    // Track biome visits
    const unsubBiome = EventBus.on("biome-change", (data) => {
      if (!state.biomesThisRun.includes(data.biome)) {
        state.biomesThisRun.push(data.biome);
      }
      // Check all 4 biomes: DEPTHS, CAVERNS, SPIRE, SUMMIT
      const allBiomes = ["The Depths", "Infernal Caverns", "The Spire", "The Summit"];
      const visitedAll = allBiomes.every((b) => state.biomesThisRun.includes(b));
      if (visitedAll) {
        this.tryUnlock("all_biomes");
      }
    });
    eventCleanups.push(unsubBiome);

    // Track parries
    const unsubParry = EventBus.on("parry-success", () => {
      state.totalParries++;
      if (state.totalParries >= 50) {
        this.tryUnlock("parry_king");
      }
      this.save();
    });
    eventCleanups.push(unsubParry);

    // Track speed
    const unsubSpeed = EventBus.on("speed-change", (data) => {
      if (data.speed >= data.maxSpeed && data.maxSpeed > 0) {
        state.maxSpeedReached = true;
        this.tryUnlock("speed_demon");
      }
    });
    eventCleanups.push(unsubSpeed);

    // Track inventory for pack rat and pristine quality
    const unsubInventory = EventBus.on("inventory-change", (data) => {
      const silverItems = data.inventory.filter((i) => i.type === "SILVER");
      const maxSlots = data.maxSlots ?? 1;
      if (silverItems.length >= maxSlots && maxSlots > 0) {
        state.silverSlotsFull = true;
        this.tryUnlock("full_inventory");
      }

      // Count pristine items
      const pristineCount = data.inventory.filter((i) => i.quality === "PRISTINE").length;
      if (pristineCount > state.pristineItemsThisRun) {
        state.pristineItemsThisRun = pristineCount;
      }
      if (state.pristineItemsThisRun >= 5) {
        this.tryUnlock("pristine_run");
      }
    });
    eventCleanups.push(unsubInventory);

    // Track gambling spend
    const unsubGambling = EventBus.on("gambling-result", (data) => {
      state.gamblingSpentThisSession += data.bet;
      if (state.gamblingSpentThisSession >= 500) {
        this.tryUnlock("big_spender");
      }
    });
    eventCleanups.push(unsubGambling);

    // Reset gambling session total when gambling closes
    const unsubGamblingClose = EventBus.on("gambling-close", () => {
      state.gamblingSpentThisSession = 0;
    });
    eventCleanups.push(unsubGamblingClose);

    // Track player health for one-hp-hero
    const unsubHealth = EventBus.on("health-change", (data) => {
      currentPlayerHp = data.health;
    });
    eventCleanups.push(unsubHealth);

    // Track boss defeats for boss rush timing
    const unsubBossDefeated = EventBus.on("boss-defeated", () => {
      state.bossDefeatTimestamps.push(Date.now());
      state.playerHpAtBossDefeat = currentPlayerHp;

      // Check boss rush: 3 bosses defeated within 10 minutes of run start
      if (state.bossDefeatTimestamps.length >= 3) {
        const elapsed = Date.now() - state.runStartTime;
        if (elapsed <= 10 * 60 * 1000) {
          this.tryUnlock("boss_rush");
        }
      }
    });
    eventCleanups.push(unsubBossDefeated);
  },

  /** Remove all event listeners. */
  cleanupEventListeners(): void {
    for (const cleanup of eventCleanups) {
      cleanup();
    }
    eventCleanups = [];
  },

  /** Try to unlock a specific achievement by ID (for event-driven achievements). */
  tryUnlock(id: string): boolean {
    if (state.unlocked.includes(id)) return false;

    const achievement = ACHIEVEMENTS.find((a) => a.id === id);
    if (!achievement) return false;

    state.unlocked.push(id);
    state.unlockDates[id] = new Date().toISOString();
    this.save();
    CosmeticManager.checkAchievementUnlocks(id);

    // Emit event for popup notification
    EventBus.emit("achievement-unlocked", {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
    });

    return true;
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
          state.unlockDates[achievement.id] = new Date().toISOString();
          newlyUnlocked.push(achievement.id);
        }
      } catch {
        // Skip achievements with condition errors
      }
    }

    // Check modifier madness: 3+ modifiers and 3000m altitude
    if (
      state.activeModifierCount >= 3 &&
      stats.run.altitude >= 3000 &&
      !state.unlocked.includes("modifier_madness")
    ) {
      state.unlocked.push("modifier_madness");
      state.unlockDates["modifier_madness"] = new Date().toISOString();
      newlyUnlocked.push("modifier_madness");
    }

    if (newlyUnlocked.length > 0) {
      this.save();

      // Trigger cosmetic unlocks and event notifications for each newly unlocked achievement
      for (const achievementId of newlyUnlocked) {
        CosmeticManager.checkAchievementUnlocks(achievementId);

        const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
        if (achievement) {
          EventBus.emit("achievement-unlocked", {
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
          });
        }
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
  getAll(): (Achievement & { unlocked: boolean; unlockDate?: string })[] {
    return ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: state.unlocked.includes(a.id),
      unlockDate: state.unlockDates[a.id],
    }));
  },

  /** Get all achievements grouped by category. */
  getAllByCategory(): Record<AchievementCategory, (Achievement & { unlocked: boolean; unlockDate?: string })[]> {
    const all = this.getAll();
    return {
      combat: all.filter((a) => a.category === "combat"),
      exploration: all.filter((a) => a.category === "exploration"),
      collection: all.filter((a) => a.category === "collection"),
      meta: all.filter((a) => a.category === "meta"),
    };
  },

  /** Get total achievement count and unlocked count. */
  getCounts(): { total: number; unlocked: number } {
    return {
      total: ACHIEVEMENTS.length,
      unlocked: state.unlocked.length,
    };
  },

  /** Get achievement definition by id (or undefined). */
  getById(id: string): Achievement | undefined {
    return ACHIEVEMENTS.find((a) => a.id === id);
  },

  /** Get unlock date for a specific achievement. */
  getUnlockDate(id: string): string | undefined {
    return state.unlockDates[id];
  },

  /** Get progress data for an achievement given current stats. */
  getProgress(id: string, stats: AchievementCheckStats): { current: number; target: number } | null {
    const achievement = ACHIEVEMENTS.find((a) => a.id === id);
    if (!achievement?.progress) return null;

    // Enrich stats same as checkAchievements
    const enrichedStats: AchievementCheckStats = {
      ...stats,
      totalKills: state.totalKills,
      maxComboThisRun: Math.max(stats.maxComboThisRun, state.maxCombo),
    };

    try {
      return achievement.progress(enrichedStats);
    } catch {
      return null;
    }
  },

  /** Get lifetime parry count. */
  getTotalParries(): number {
    return state.totalParries;
  },

  // ─── Boss Fight Tracking (for "perfect_boss" and "one_hp_hero") ─────

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
   * If the boss was defeated with 1 HP, unlocks "one_hp_hero".
   * Returns array of achievement IDs if newly unlocked.
   */
  endBossFight(defeated: boolean): string[] {
    if (!bossFightActive) return [];
    bossFightActive = false;

    const unlocked: string[] = [];

    if (defeated) {
      // Perfect boss (no damage taken)
      if (!bossFightDamageTaken) {
        if (this.tryUnlock("perfect_boss")) {
          unlocked.push("perfect_boss");
        }
      }

      // One HP hero
      if (currentPlayerHp === 1) {
        if (this.tryUnlock("one_hp_hero")) {
          unlocked.push("one_hp_hero");
        }
      }
    }

    bossFightDamageTaken = false;
    return unlocked;
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

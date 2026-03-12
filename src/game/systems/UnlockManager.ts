// ─── Unlock Manager ─────────────────────────────────────────────────────────
// Maps achievements to unlockable game content (modes, features, items).
// Persists unlock state to localStorage independently from achievements,
// so unlocked content remains available even if achievement data is reset.

import { EventBus } from "./EventBus";

const STORAGE_KEY = "ascension_unlocks";

// ─── Feature Definitions ────────────────────────────────────────────────────

export interface UnlockableFeature {
  id: string;
  name: string;
  description: string;
  /** The achievement ID that unlocks this feature */
  achievementId: string;
  /** Category for grouping in UI */
  category: "mode" | "feature" | "item" | "subclass";
  /** Hint shown when locked */
  hint: string;
}

const UNLOCKABLE_FEATURES: UnlockableFeature[] = [
  // ─── Game Modes ──────────────────────────────────────────────────────
  {
    id: "training_room",
    name: "Training Room",
    description: "Practice combat moves and test builds without risk",
    achievementId: "first_blood",
    category: "mode",
    hint: "Defeat your first enemy to unlock",
  },
  {
    id: "boss_rush",
    name: "Boss Rush Mode",
    description: "Fight all bosses back-to-back with minimal breaks",
    achievementId: "boss_slayer",
    category: "mode",
    hint: "Defeat your first boss to unlock",
  },
  {
    id: "endless_mode",
    name: "Endless Mode",
    description: "No final boss — climb forever with scaling difficulty",
    achievementId: "ascended",
    category: "mode",
    hint: "Complete an ascension to unlock",
  },
  {
    id: "weekly_challenge",
    name: "Weekly Challenge",
    description: "Special weekly challenges with unique modifiers and leaderboards",
    achievementId: "champion",
    category: "mode",
    hint: "Defeat all 5 boss types to unlock",
  },

  // ─── Features ────────────────────────────────────────────────────────
  {
    id: "starting_item_choice",
    name: "Starting Item Choice",
    description: "Pick 1 of 3 items before each run begins",
    achievementId: "completionist",
    category: "feature",
    hint: "Collect 50 unique items across all runs to unlock",
  },
  {
    id: "glass_cannon_shop",
    name: "Glass Cannon",
    description: "Cursed item added to the shop pool: massive damage, 1 HP",
    achievementId: "untouchable",
    category: "item",
    hint: "Reach 500m without taking damage to unlock",
  },
  {
    id: "combo_trail",
    name: "Combo Trail Effect",
    description: "Cosmetic particle trail that activates during combos",
    achievementId: "combo_master",
    category: "feature",
    hint: "Reach a 50x combo to unlock",
  },

  // ─── Subclasses ──────────────────────────────────────────────────────
  {
    id: "subclass_paladin",
    name: "Paladin Subclass",
    description: "Unlock advanced Paladin specializations",
    achievementId: "paladin_5k",
    category: "subclass",
    hint: "Reach 5,000m altitude with Paladin to unlock",
  },
  {
    id: "subclass_monk",
    name: "Monk Subclass",
    description: "Unlock advanced Monk specializations",
    achievementId: "monk_5k",
    category: "subclass",
    hint: "Reach 5,000m altitude with Monk to unlock",
  },
  {
    id: "subclass_priest",
    name: "Priest Subclass",
    description: "Unlock advanced Priest specializations",
    achievementId: "priest_5k",
    category: "subclass",
    hint: "Reach 5,000m altitude with Priest to unlock",
  },
];

// ─── Internal State ─────────────────────────────────────────────────────────

interface StoredUnlocks {
  unlockedFeatures: string[];
  unlockDates: Record<string, string>;
}

let state: StoredUnlocks = {
  unlockedFeatures: [],
  unlockDates: {},
};

// ─── Manager ────────────────────────────────────────────────────────────────

export const UnlockManager = {
  /** Load unlock data from localStorage. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredUnlocks>;
        state = {
          unlockedFeatures: Array.isArray(parsed.unlockedFeatures) ? parsed.unlockedFeatures : [],
          unlockDates: (typeof parsed.unlockDates === "object" && parsed.unlockDates) ? parsed.unlockDates : {},
        };
      } else {
        state = { unlockedFeatures: [], unlockDates: {} };
      }
    } catch {
      state = { unlockedFeatures: [], unlockDates: {} };
    }
  },

  /** Save unlock data to localStorage. */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable; silently ignore
    }
  },

  /** Check if a specific feature is unlocked. */
  isUnlocked(featureId: string): boolean {
    return state.unlockedFeatures.includes(featureId);
  },

  /** Unlock a feature by its ID. Returns true if newly unlocked. */
  unlock(featureId: string): boolean {
    if (state.unlockedFeatures.includes(featureId)) return false;

    const feature = UNLOCKABLE_FEATURES.find((f) => f.id === featureId);
    if (!feature) return false;

    state.unlockedFeatures.push(featureId);
    state.unlockDates[featureId] = new Date().toISOString();
    this.save();

    // Emit feature-unlocked event for notification display
    EventBus.emit("feature-unlocked", {
      featureId: feature.id,
      featureName: feature.name,
    });

    return true;
  },

  /**
   * Called when an achievement is earned.
   * Checks if it unlocks any features and unlocks them.
   * Returns the feature ID if something was unlocked, or null.
   */
  checkUnlocks(achievementId: string): string | null {
    for (const feature of UNLOCKABLE_FEATURES) {
      if (feature.achievementId === achievementId && !state.unlockedFeatures.includes(feature.id)) {
        this.unlock(feature.id);
        return feature.id;
      }
    }
    return null;
  },

  /** Get all feature definitions with their unlock status. */
  getAll(): (UnlockableFeature & { unlocked: boolean; unlockDate?: string })[] {
    return UNLOCKABLE_FEATURES.map((f) => ({
      ...f,
      unlocked: state.unlockedFeatures.includes(f.id),
      unlockDate: state.unlockDates[f.id],
    }));
  },

  /** Get all features in a specific category. */
  getByCategory(category: UnlockableFeature["category"]): (UnlockableFeature & { unlocked: boolean })[] {
    return UNLOCKABLE_FEATURES
      .filter((f) => f.category === category)
      .map((f) => ({
        ...f,
        unlocked: state.unlockedFeatures.includes(f.id),
      }));
  },

  /** Get feature definition by ID. */
  getById(featureId: string): UnlockableFeature | undefined {
    return UNLOCKABLE_FEATURES.find((f) => f.id === featureId);
  },

  /** Get counts of unlocked vs total features. */
  getCounts(): { total: number; unlocked: number } {
    return {
      total: UNLOCKABLE_FEATURES.length,
      unlocked: state.unlockedFeatures.length,
    };
  },
};

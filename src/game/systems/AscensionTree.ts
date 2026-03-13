// ─── Ascension Tree ────────────────────────────────────────────────────────
// Permanent between-run upgrade tree. Players spend "meta essence" accumulated
// from completed runs to purchase upgrades organized into 5 branches.
// This is separate from AscensionManager (per-boss stat boosts during runs).

const STORAGE_KEY = "ascension_tree";

// ─── Types ─────────────────────────────────────────────────────────────────

export type TreeBranch = "combat" | "mobility" | "survival" | "economy" | "utility";

export interface TreeUpgrade {
  id: string;
  name: string;
  description: string;
  branch: TreeBranch;
  maxLevel: number;
  costPerLevel: number[];
  effect: (level: number) => string;
}

interface TreeState {
  availableEssence: number;
  upgrades: Record<string, number>;
  totalEssenceSpent: number;
}

// ─── Default State ─────────────────────────────────────────────────────────

function defaultState(): TreeState {
  return {
    availableEssence: 0,
    upgrades: {},
    totalEssenceSpent: 0,
  };
}

// ─── Upgrade Definitions ───────────────────────────────────────────────────

const UPGRADES: TreeUpgrade[] = [
  // ─── Combat Branch ─────────────────────────────────────────────────
  {
    id: "sharpened_edge",
    name: "Sharpened Edge",
    description: "Increases attack damage",
    branch: "combat",
    maxLevel: 5,
    costPerLevel: [100, 150, 200, 300, 400],
    effect: (level: number) => `+${level * 5}% attack damage`,
  },
  {
    id: "swift_strikes",
    name: "Swift Strikes",
    description: "Increases attack speed",
    branch: "combat",
    maxLevel: 5,
    costPerLevel: [100, 150, 200, 300, 400],
    effect: (level: number) => `+${level * 5}% attack speed`,
  },
  {
    id: "critical_eye",
    name: "Critical Eye",
    description: "Increases critical hit chance",
    branch: "combat",
    maxLevel: 5,
    costPerLevel: [150, 200, 300, 400, 500],
    effect: (level: number) => `+${level * 3}% crit chance`,
  },
  {
    id: "finishing_blow",
    name: "Finishing Blow",
    description: "Increases finishing threshold on low-health enemies",
    branch: "combat",
    maxLevel: 3,
    costPerLevel: [200, 350, 500],
    effect: (level: number) => `+${level * 5}% finishing threshold`,
  },
  {
    id: "combo_retention",
    name: "Combo Retention",
    description: "Extends the combo timer window",
    branch: "combat",
    maxLevel: 4,
    costPerLevel: [150, 250, 350, 500],
    effect: (level: number) => `+${(level * 0.5).toFixed(1)}s combo timer`,
  },

  // ─── Mobility Branch ───────────────────────────────────────────────
  {
    id: "fleet_foot",
    name: "Fleet Foot",
    description: "Increases movement speed",
    branch: "mobility",
    maxLevel: 5,
    costPerLevel: [100, 150, 200, 300, 400],
    effect: (level: number) => `+${level * 5}% move speed`,
  },
  {
    id: "higher_ground",
    name: "Higher Ground",
    description: "Increases jump height",
    branch: "mobility",
    maxLevel: 5,
    costPerLevel: [100, 150, 200, 300, 400],
    effect: (level: number) => `+${level * 5}% jump height`,
  },
  {
    id: "wall_mastery",
    name: "Wall Mastery",
    description: "Reduces wall slide speed for better wall control",
    branch: "mobility",
    maxLevel: 3,
    costPerLevel: [150, 250, 400],
    effect: (level: number) => `+${level * 10}% wall slide speed reduction`,
  },
  {
    id: "air_control",
    name: "Air Control",
    description: "Improves aerial maneuverability",
    branch: "mobility",
    maxLevel: 3,
    costPerLevel: [150, 250, 400],
    effect: (level: number) => `+${level * 10}% aerial maneuverability`,
  },
  {
    id: "quick_recovery",
    name: "Quick Recovery",
    description: "Reduces landing lag after jumps",
    branch: "mobility",
    maxLevel: 3,
    costPerLevel: [150, 250, 400],
    effect: (level: number) => `-${level * 10}% landing lag`,
  },

  // ─── Survival Branch ───────────────────────────────────────────────
  {
    id: "vitality",
    name: "Vitality",
    description: "Increases maximum hit points",
    branch: "survival",
    maxLevel: 3,
    costPerLevel: [200, 400, 700],
    effect: (level: number) => `+${level} max HP`,
  },
  {
    id: "thick_skin",
    name: "Thick Skin",
    description: "Flat damage reduction on all incoming hits",
    branch: "survival",
    maxLevel: 1,
    costPerLevel: [500],
    effect: (level: number) => level > 0 ? "+1 flat damage reduction" : "No effect",
  },
  {
    id: "second_wind",
    name: "Second Wind",
    description: "Heal when entering a new biome",
    branch: "survival",
    maxLevel: 3,
    costPerLevel: [250, 400, 600],
    effect: (level: number) => `Heal ${level} HP on biome change`,
  },
  {
    id: "death_defiance",
    name: "Death Defiance",
    description: "Survive a lethal hit with 1 HP once per run",
    branch: "survival",
    maxLevel: 1,
    costPerLevel: [750],
    effect: (level: number) => level > 0 ? "Survive lethal hit once per run" : "No effect",
  },

  // ─── Economy Branch ────────────────────────────────────────────────
  {
    id: "essence_attunement",
    name: "Essence Attunement",
    description: "Increases meta essence gained from runs",
    branch: "economy",
    maxLevel: 5,
    costPerLevel: [150, 200, 300, 400, 500],
    effect: (level: number) => `+${level * 10}% essence gain`,
  },
  {
    id: "bargain_hunter",
    name: "Bargain Hunter",
    description: "Reduces shop prices",
    branch: "economy",
    maxLevel: 4,
    costPerLevel: [200, 300, 450, 600],
    effect: (level: number) => `-${level * 5}% shop prices`,
  },
  {
    id: "lucky_find",
    name: "Lucky Find",
    description: "Improves quality of item drops",
    branch: "economy",
    maxLevel: 5,
    costPerLevel: [150, 200, 300, 400, 500],
    effect: (level: number) => `+${level * 5}% item quality`,
  },
  {
    id: "treasure_sense",
    name: "Treasure Sense",
    description: "Improves secret room reward quality",
    branch: "economy",
    maxLevel: 3,
    costPerLevel: [200, 350, 500],
    effect: (level: number) => `+${level * 10}% secret room reward quality`,
  },

  // ─── Utility Branch ────────────────────────────────────────────────
  {
    id: "prepared",
    name: "Prepared",
    description: "Start each run with bonus essence",
    branch: "utility",
    maxLevel: 4,
    costPerLevel: [100, 200, 300, 450],
    effect: (level: number) => `+${level * 25} starting essence`,
  },
  {
    id: "quick_start",
    name: "Quick Start",
    description: "Start each run with a random common item",
    branch: "utility",
    maxLevel: 1,
    costPerLevel: [300],
    effect: (level: number) => level > 0 ? "Start with random common item" : "No effect",
  },
  {
    id: "item_affinity",
    name: "Item Affinity",
    description: "Increases the potency of all item effects",
    branch: "utility",
    maxLevel: 5,
    costPerLevel: [150, 200, 300, 400, 500],
    effect: (level: number) => `+${level * 5}% item effect potency`,
  },
  {
    id: "cooldown_mastery",
    name: "Cooldown Mastery",
    description: "Reduces ability cooldowns",
    branch: "utility",
    maxLevel: 5,
    costPerLevel: [150, 200, 300, 400, 500],
    effect: (level: number) => `-${level * 5}% ability cooldowns`,
  },
];

// ─── Lookup Map ────────────────────────────────────────────────────────────

const UPGRADE_MAP = new Map<string, TreeUpgrade>();
for (const upgrade of UPGRADES) {
  UPGRADE_MAP.set(upgrade.id, upgrade);
}

// ─── Internal State ────────────────────────────────────────────────────────

let state: TreeState = defaultState();

// ─── Ascension Tree Singleton ──────────────────────────────────────────────

export const AscensionTree = {
  /** Load tree state from localStorage. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TreeState>;
        state = {
          availableEssence: typeof parsed.availableEssence === "number" ? parsed.availableEssence : 0,
          upgrades: (typeof parsed.upgrades === "object" && parsed.upgrades) ? parsed.upgrades : {},
          totalEssenceSpent: typeof parsed.totalEssenceSpent === "number" ? parsed.totalEssenceSpent : 0,
        };
      } else {
        state = defaultState();
      }
    } catch {
      state = defaultState();
    }
  },

  /** Save tree state to localStorage. */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable; silently ignore
    }
  },

  /** Get the current available meta essence. */
  getAvailableEssence(): number {
    return state.availableEssence;
  },

  /** Add meta essence (typically called at end of run). */
  addEssence(amount: number): void {
    state.availableEssence += amount;
    this.save();
  },

  /**
   * Purchase the next level of an upgrade.
   * Returns true if the purchase was successful, false otherwise.
   */
  purchaseUpgrade(upgradeId: string): boolean {
    const upgrade = UPGRADE_MAP.get(upgradeId);
    if (!upgrade) return false;

    const currentLevel = state.upgrades[upgradeId] ?? 0;
    if (currentLevel >= upgrade.maxLevel) return false;

    const cost = upgrade.costPerLevel[currentLevel];
    if (state.availableEssence < cost) return false;

    state.availableEssence -= cost;
    state.totalEssenceSpent += cost;
    state.upgrades[upgradeId] = currentLevel + 1;
    this.save();
    return true;
  },

  /** Get the current level of an upgrade (0 if not purchased). */
  getUpgradeLevel(upgradeId: string): number {
    return state.upgrades[upgradeId] ?? 0;
  },

  /** Get the cost of the next level for an upgrade. Returns -1 if maxed. */
  getUpgradeCost(upgradeId: string): number {
    const upgrade = UPGRADE_MAP.get(upgradeId);
    if (!upgrade) return -1;

    const currentLevel = state.upgrades[upgradeId] ?? 0;
    if (currentLevel >= upgrade.maxLevel) return -1;

    return upgrade.costPerLevel[currentLevel];
  },

  /** Get all upgrade definitions. */
  getAllUpgrades(): TreeUpgrade[] {
    return [...UPGRADES];
  },

  /** Get all upgrades in a specific branch. */
  getUpgradesByBranch(branch: string): TreeUpgrade[] {
    return UPGRADES.filter((u) => u.branch === branch);
  },

  /** Get the total meta essence spent across all upgrades. */
  getTotalEssenceSpent(): number {
    return state.totalEssenceSpent;
  },

  /** Get the total number of upgrade levels purchased across all branches. */
  getTreeLevel(): number {
    let total = 0;
    for (const level of Object.values(state.upgrades)) {
      total += level;
    }
    return total;
  },

  /** Refund all essence and reset all upgrades. */
  resetTree(): void {
    state.availableEssence += state.totalEssenceSpent;
    state.totalEssenceSpent = 0;
    state.upgrades = {};
    this.save();
  },

  // ─── Bonus Getters (used by Player.ts) ───────────────────────────────

  /** Attack damage multiplier. e.g., 1.15 for +15%. */
  getBonusAttackDamage(): number {
    return 1 + this.getUpgradeLevel("sharpened_edge") * 0.05;
  },

  /** Attack speed multiplier. e.g., 1.15 for +15%. */
  getBonusAttackSpeed(): number {
    return 1 + this.getUpgradeLevel("swift_strikes") * 0.05;
  },

  /** Move speed multiplier. e.g., 1.15 for +15%. */
  getBonusMoveSpeed(): number {
    return 1 + this.getUpgradeLevel("fleet_foot") * 0.05;
  },

  /** Jump height multiplier. e.g., 1.15 for +15%. */
  getBonusJumpHeight(): number {
    return 1 + this.getUpgradeLevel("higher_ground") * 0.05;
  },

  /** Flat bonus to max HP. */
  getBonusMaxHP(): number {
    return this.getUpgradeLevel("vitality");
  },

  /** Flat bonus to crit chance (as a decimal). e.g., 0.09 for +9%. */
  getBonusCritChance(): number {
    return this.getUpgradeLevel("critical_eye") * 0.03;
  },

  /** Extra finishing threshold percentage (as a decimal). e.g., 0.15 for +15%. */
  getBonusFinishingThreshold(): number {
    return this.getUpgradeLevel("finishing_blow") * 0.05;
  },

  /** Extra seconds added to the combo timer. */
  getBonusComboTimer(): number {
    return this.getUpgradeLevel("combo_retention") * 0.5;
  },

  /** Essence gain multiplier. e.g., 1.30 for +30%. */
  getBonusEssenceGain(): number {
    return 1 + this.getUpgradeLevel("essence_attunement") * 0.10;
  },

  /** Shop discount multiplier. e.g., 0.85 for 15% off. */
  getBonusShopDiscount(): number {
    return 1 - this.getUpgradeLevel("bargain_hunter") * 0.05;
  },

  /** Item quality multiplier. e.g., 1.15 for +15%. */
  getBonusItemQuality(): number {
    return 1 + this.getUpgradeLevel("lucky_find") * 0.05;
  },

  /** Flat amount of starting essence per run. */
  getBonusStartingEssence(): number {
    return this.getUpgradeLevel("prepared") * 25;
  },

  /** Cooldown reduction multiplier. e.g., 0.85 for 15% reduction. */
  getBonusCooldownReduction(): number {
    return 1 - this.getUpgradeLevel("cooldown_mastery") * 0.05;
  },

  /** Item effect potency multiplier. e.g., 1.15 for +15%. */
  getBonusItemPotency(): number {
    return 1 + this.getUpgradeLevel("item_affinity") * 0.05;
  },

  /** Whether the player has the Death Defiance upgrade. */
  hasDeathDefiance(): boolean {
    return this.getUpgradeLevel("death_defiance") > 0;
  },

  /** Whether the player has the Quick Start upgrade. */
  hasQuickStart(): boolean {
    return this.getUpgradeLevel("quick_start") > 0;
  },

  /** HP healed when entering a new biome. */
  getSecondWindHeal(): number {
    return this.getUpgradeLevel("second_wind");
  },
};

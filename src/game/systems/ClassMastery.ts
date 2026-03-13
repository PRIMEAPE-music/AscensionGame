// ─── Class Mastery System ───────────────────────────────────────────────────
// Tracks per-class XP and mastery levels across runs. Each class gains XP
// based on run performance and levels up to 20, unlocking stat bonuses
// and special rewards at milestone levels.

const STORAGE_KEY = "class_mastery";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MasteryReward {
  level: number;
  description: string;
  stat?: string;
  statType?: "multiply" | "add";
  value?: number;
  special?: string;
}

export interface ClassMasteryData {
  xp: number;
  level: number;
}

export interface MasteryBonuses {
  attackDamage: number;
  attackSpeed: number;
  moveSpeed: number;
  jumpHeight: number;
  maxHP: number;
  maxHPMultiplier: number;
  blockEffectiveness: number;
  healingEffectiveness: number;
  flowGain: number;
  flowDecay: number;
  sacredGroundCooldown: number;
  sacredGroundRadius: number;
  sacredGroundHealing: number;
  armorEffectiveness: number;
  shieldGuardSpeed: number;
  shieldGuardReduction: number;
  critFromFlow: number;
  startingFlow: number;
  startingHP: number;
  sacredGroundReady: boolean;
}

interface RunStats {
  altitude: number;
  kills: number;
  bossesDefeated: number;
  perfectParries: number;
  maxCombo: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_LEVEL = 20;

const LEVEL_THRESHOLDS: number[] = [
  100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000, 7000,
  9500, 12500, 16000, 20000, 25000, 31000, 38000, 46000, 56000, 70000,
];

// ─── Reward Definitions ─────────────────────────────────────────────────────

const PALADIN_REWARDS: MasteryReward[] = [
  { level: 2, description: "+2% max HP multiplier", stat: "maxHPMultiplier", statType: "multiply", value: 0.02 },
  { level: 4, description: "+3% block effectiveness", stat: "blockEffectiveness", statType: "multiply", value: 0.03 },
  { level: 6, description: "+3% attack damage", stat: "attackDamage", statType: "multiply", value: 0.03 },
  { level: 8, description: "+5% block effectiveness", stat: "blockEffectiveness", statType: "multiply", value: 0.05 },
  { level: 10, description: "Shield guard activates 15% faster", stat: "shieldGuardSpeed", statType: "multiply", value: -0.15, special: "shield_guard_faster" },
  { level: 12, description: "+3% max HP multiplier", stat: "maxHPMultiplier", statType: "multiply", value: 0.03 },
  { level: 14, description: "+5% attack damage", stat: "attackDamage", statType: "multiply", value: 0.05 },
  { level: 16, description: "+5% armor effectiveness", stat: "armorEffectiveness", statType: "multiply", value: 0.05 },
  { level: 18, description: "Shield guard damage reduction +10%", stat: "shieldGuardReduction", statType: "add", value: 0.10 },
  { level: 20, description: "+1 starting HP", stat: "startingHP", statType: "add", value: 1 },
];

const MONK_REWARDS: MasteryReward[] = [
  { level: 2, description: "+3% move speed", stat: "moveSpeed", statType: "multiply", value: 0.03 },
  { level: 4, description: "+3% attack speed", stat: "attackSpeed", statType: "multiply", value: 0.03 },
  { level: 6, description: "+5% flow meter gain", stat: "flowGain", statType: "multiply", value: 0.05 },
  { level: 8, description: "+5% move speed", stat: "moveSpeed", statType: "multiply", value: 0.05 },
  { level: 10, description: "+5% flow meter gain", stat: "flowGain", statType: "multiply", value: 0.05 },
  { level: 12, description: "+3% jump height", stat: "jumpHeight", statType: "multiply", value: 0.03 },
  { level: 14, description: "+5% attack speed", stat: "attackSpeed", statType: "multiply", value: 0.05 },
  { level: 16, description: "Flow decay reduced 15%", stat: "flowDecay", statType: "multiply", value: -0.15, special: "flow_decay_reduced" },
  { level: 18, description: "+5% crit from flow", stat: "critFromFlow", statType: "add", value: 0.05 },
  { level: 20, description: "Start with 20% flow", stat: "startingFlow", statType: "add", value: 20, special: "start_with_flow" },
];

const PRIEST_REWARDS: MasteryReward[] = [
  { level: 2, description: "+3% healing effectiveness", stat: "healingEffectiveness", statType: "multiply", value: 0.03 },
  { level: 4, description: "Sacred ground cooldown -5%", stat: "sacredGroundCooldown", statType: "multiply", value: -0.05 },
  { level: 6, description: "+3% attack damage", stat: "attackDamage", statType: "multiply", value: 0.03 },
  { level: 8, description: "+5% healing effectiveness", stat: "healingEffectiveness", statType: "multiply", value: 0.05 },
  { level: 10, description: "Sacred ground radius +10%", stat: "sacredGroundRadius", statType: "multiply", value: 0.10 },
  { level: 12, description: "+3% max HP multiplier", stat: "maxHPMultiplier", statType: "multiply", value: 0.03 },
  { level: 14, description: "Sacred ground cooldown -10%", stat: "sacredGroundCooldown", statType: "multiply", value: -0.10 },
  { level: 16, description: "+5% attack damage", stat: "attackDamage", statType: "multiply", value: 0.05 },
  { level: 18, description: "Sacred ground healing +15%", stat: "sacredGroundHealing", statType: "multiply", value: 0.15 },
  { level: 20, description: "Sacred ground starts ready at run start", special: "sacred_ground_ready" },
];

const CLASS_REWARDS: Record<string, MasteryReward[]> = {
  PALADIN: PALADIN_REWARDS,
  MONK: MONK_REWARDS,
  PRIEST: PRIEST_REWARDS,
};

// ─── State ──────────────────────────────────────────────────────────────────

const classData: Record<string, ClassMasteryData> = {};

function defaultClassData(): ClassMasteryData {
  return { xp: 0, level: 0 };
}

function ensureClassData(classType: string): ClassMasteryData {
  if (!classData[classType]) {
    classData[classType] = defaultClassData();
  }
  return classData[classType];
}

function defaultBonuses(): MasteryBonuses {
  return {
    attackDamage: 1,
    attackSpeed: 1,
    moveSpeed: 1,
    jumpHeight: 1,
    maxHP: 0,
    maxHPMultiplier: 1,
    blockEffectiveness: 1,
    healingEffectiveness: 1,
    flowGain: 1,
    flowDecay: 1,
    sacredGroundCooldown: 1,
    sacredGroundRadius: 1,
    sacredGroundHealing: 1,
    armorEffectiveness: 1,
    shieldGuardSpeed: 1,
    shieldGuardReduction: 0,
    critFromFlow: 0,
    startingFlow: 0,
    startingHP: 0,
    sacredGroundReady: false,
  };
}

/** Calculate the level for a given cumulative XP total. */
function levelFromXP(xp: number): number {
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp < LEVEL_THRESHOLDS[i]) {
      return i;
    }
  }
  return MAX_LEVEL;
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const ClassMastery = {
  /** Load mastery data from localStorage. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, ClassMasteryData> = JSON.parse(raw);
        // Clear existing data
        for (const key of Object.keys(classData)) {
          delete classData[key];
        }
        for (const [cls, data] of Object.entries(parsed)) {
          classData[cls] = { ...defaultClassData(), ...data };
        }
      }
    } catch {
      // Corrupt data — start fresh
    }
  },

  /** Save mastery data to localStorage. */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(classData));
    } catch {
      // localStorage may be unavailable; silently ignore
    }
  },

  /** Get the full mastery data for a class. */
  getClassData(classType: string): ClassMasteryData {
    const data = ensureClassData(classType);
    return { ...data };
  },

  /** Get the current mastery level for a class. */
  getLevel(classType: string): number {
    return ensureClassData(classType).level;
  },

  /** Get the current cumulative XP for a class. */
  getXP(classType: string): number {
    return ensureClassData(classType).xp;
  },

  /** Get the total XP needed to reach the next level. Returns 0 if already max level. */
  getXPForNextLevel(classType: string): number {
    const data = ensureClassData(classType);
    if (data.level >= MAX_LEVEL) return 0;
    return LEVEL_THRESHOLDS[data.level];
  },

  /** Get a progress breakdown for the current level bracket. */
  getXPProgress(classType: string): { current: number; needed: number; percent: number } {
    const data = ensureClassData(classType);
    if (data.level >= MAX_LEVEL) {
      return { current: 0, needed: 0, percent: 100 };
    }

    const thresholdForNext = LEVEL_THRESHOLDS[data.level];
    const thresholdForCurrent = data.level > 0 ? LEVEL_THRESHOLDS[data.level - 1] : 0;
    const xpInBracket = data.xp - thresholdForCurrent;
    const bracketSize = thresholdForNext - thresholdForCurrent;
    const percent = bracketSize > 0 ? Math.min(100, (xpInBracket / bracketSize) * 100) : 100;

    return {
      current: xpInBracket,
      needed: bracketSize,
      percent,
    };
  },

  /**
   * Add XP to a class and auto-level. Returns how many levels were gained
   * and the new level.
   */
  addXP(classType: string, amount: number): { levelsGained: number; newLevel: number } {
    const data = ensureClassData(classType);
    const oldLevel = data.level;
    data.xp += amount;
    data.level = levelFromXP(data.xp);
    return {
      levelsGained: data.level - oldLevel,
      newLevel: data.level,
    };
  },

  /** Calculate XP earned from a run's stats. */
  calculateRunXP(stats: RunStats): number {
    return (
      Math.floor(stats.altitude / 10) +
      stats.kills * 2 +
      stats.bossesDefeated * 50 +
      stats.perfectParries * 5 +
      Math.floor(stats.maxCombo / 5)
    );
  },

  /** Get all defined rewards for a class (regardless of current level). */
  getRewards(classType: string): MasteryReward[] {
    const rewards = CLASS_REWARDS[classType];
    if (!rewards) return [];
    return rewards.map((r) => ({ ...r }));
  },

  /** Get only rewards that have been unlocked (at or below current level). */
  getUnlockedRewards(classType: string): MasteryReward[] {
    const level = ensureClassData(classType).level;
    const rewards = CLASS_REWARDS[classType];
    if (!rewards) return [];
    return rewards.filter((r) => r.level <= level).map((r) => ({ ...r }));
  },

  /** Compute aggregated stat bonuses from all unlocked rewards for a class. */
  getBonuses(classType: string): MasteryBonuses {
    const bonuses = defaultBonuses();
    const unlocked = ClassMastery.getUnlockedRewards(classType);

    for (const reward of unlocked) {
      // Handle special flags
      if (reward.special === "sacred_ground_ready") {
        bonuses.sacredGroundReady = true;
        continue;
      }

      if (!reward.stat || reward.value === undefined) continue;

      const stat = reward.stat as keyof MasteryBonuses;
      const type = reward.statType;

      if (type === "multiply") {
        // Multiplicative bonuses accumulate additively on the multiplier
        // e.g., +3% and +5% = 1.0 + 0.03 + 0.05 = 1.08
        (bonuses[stat] as number) += reward.value;
      } else if (type === "add") {
        // Flat bonuses stack additively
        (bonuses[stat] as number) += reward.value;
      }
    }

    return bonuses;
  },
};

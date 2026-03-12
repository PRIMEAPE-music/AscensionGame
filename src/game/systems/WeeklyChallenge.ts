import { RUN_MODIFIERS } from '../config/RunModifiers';

/**
 * Weekly Challenge system.
 *
 * Uses the existing DailyChallenge infrastructure for storage/leaderboard,
 * but provides a distinct challenge configuration:
 * - 7-day rotating challenge
 * - 3 fixed modifiers (at least 1 "brutal": one_shot or glass_cannon)
 * - Fixed class
 * - 3x essence rewards
 * - Harder than daily
 */

// Brutal modifiers — at least 1 must be included
const BRUTAL_MODIFIERS = ['one_shot', 'glass_cannon'];
const ALL_MODIFIER_IDS = RUN_MODIFIERS.map(m => m.id);

// Simple seeded PRNG (same as DailyChallenge for consistency)
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export const WeeklyChallenge = {
  /**
   * Get the current weekly challenge configuration.
   * Uses the current date to determine the week number and generates
   * a deterministic challenge from that.
   */
  getCurrentChallenge(): { class: string; modifiers: string[]; seed: number; weekNumber: number } {
    const weekNumber = this._getWeekNumber();
    const seed = this._getSeedForWeek(weekNumber);
    const rng = seededRandom(seed);

    // Pick class
    const classes = ['PALADIN', 'MONK', 'PRIEST'];
    const classIdx = Math.floor(rng() * classes.length);
    const classType = classes[classIdx];

    // Pick 3 modifiers, ensuring at least 1 is brutal
    const modifiers: string[] = [];

    // First, pick 1 brutal modifier
    const brutalIdx = Math.floor(rng() * BRUTAL_MODIFIERS.length);
    modifiers.push(BRUTAL_MODIFIERS[brutalIdx]);

    // Then pick 2 more from the remaining pool (no duplicates)
    const remaining = ALL_MODIFIER_IDS.filter(id => !modifiers.includes(id));
    while (modifiers.length < 3 && remaining.length > 0) {
      const idx = Math.floor(rng() * remaining.length);
      modifiers.push(remaining[idx]);
      remaining.splice(idx, 1);
    }

    return {
      class: classType,
      modifiers,
      seed,
      weekNumber,
    };
  },

  /**
   * Get ISO week number for the current date (UTC).
   */
  _getWeekNumber(): number {
    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
    // ISO week: weeks start on Monday
    const weekNum = Math.ceil((dayOfYear + startOfYear.getUTCDay() + 1) / 7);
    // Include year to make it unique across years
    return now.getUTCFullYear() * 100 + weekNum;
  },

  /**
   * Generate a deterministic seed from a week number.
   */
  _getSeedForWeek(weekNumber: number): number {
    const str = `weekly_${weekNumber}`;
    let seed = 0;
    for (let i = 0; i < str.length; i++) {
      seed = ((seed << 7) - seed) + str.charCodeAt(i);
      seed |= 0;
    }
    return Math.abs(seed) + 2000000; // Offset from daily/weekly storage seeds
  },

  /**
   * Essence multiplier for weekly challenge (3x).
   */
  getEssenceMultiplier(): number {
    return 3;
  },

  /**
   * Get the Monday start date for the current week (for display).
   */
  getWeekStartDate(): string {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
    return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
  },

  /**
   * Get the remaining time in the current week.
   */
  getTimeRemaining(): string {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : (8 - day);
    const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
    const diff = nextMonday.getTime() - now.getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    return `${days}d ${hours}h`;
  },
};

const STORAGE_KEY = "ascension_leaderboards";

export interface LeaderboardEntry {
  score: number;
  classType: string;
  date: string;
  modifiers?: string[];
}

export interface RunData {
  altitude: number;
  timeMs: number;
  bossesDefeated: number;
  kills: number;
  highestCombo: number;
  classType: string;
  modifiers?: string[];
}

export interface NewRecordInfo {
  category: string;
  label: string;
  value: number;
  position: number; // 1-based rank
}

export const LEADERBOARD_CATEGORIES = [
  "highest_altitude",
  "fastest_5000m",
  "most_bosses",
  "longest_survival",
  "most_kills",
  "highest_combo",
] as const;

export type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number];

const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  highest_altitude: "Highest Altitude",
  fastest_5000m: "Fastest to 5000m",
  most_bosses: "Most Bosses Defeated",
  longest_survival: "Longest Survival",
  most_kills: "Most Kills",
  highest_combo: "Highest Combo",
};

const MAX_ENTRIES = 10;

interface StoredLeaderboards {
  boards: Record<string, LeaderboardEntry[]>;
  totalRuns: number;
}

function defaultData(): StoredLeaderboards {
  return {
    boards: {},
    totalRuns: 0,
  };
}

let data: StoredLeaderboards = defaultData();

/**
 * Returns true if `a` is a better score than `b` for the given category.
 * For fastest_5000m, lower is better. For everything else, higher is better.
 */
function isBetter(category: LeaderboardCategory, a: number, b: number): boolean {
  if (category === "fastest_5000m") {
    return a < b;
  }
  return a > b;
}

/**
 * Sorts entries for a category (best first).
 */
function sortEntries(category: LeaderboardCategory, entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (category === "fastest_5000m") {
      return a.score - b.score; // lower is better
    }
    return b.score - a.score; // higher is better
  });
}

/**
 * Get the rank (1-based) of a score within a category's leaderboard.
 * Returns -1 if not ranked (worse than all top 10 and board is full).
 */
function getRank(category: LeaderboardCategory, score: number, entries: LeaderboardEntry[]): number {
  for (let i = 0; i < entries.length; i++) {
    if (isBetter(category, score, entries[i].score)) {
      return i + 1;
    }
    if (score === entries[i].score) {
      return i + 1;
    }
  }
  if (entries.length < MAX_ENTRIES) {
    return entries.length + 1;
  }
  return -1;
}

export const LeaderboardManager = {
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: StoredLeaderboards = JSON.parse(raw);
        data = { ...defaultData(), ...parsed };
      } else {
        data = defaultData();
      }
    } catch {
      data = defaultData();
    }
  },

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable; silently ignore
    }
  },

  /**
   * Submit a completed run's data. Returns a list of categories where
   * new records (top 10 entries) were set.
   */
  submitRun(runData: RunData): NewRecordInfo[] {
    const newRecords: NewRecordInfo[] = [];
    const now = new Date().toISOString();
    const baseEntry: Omit<LeaderboardEntry, "score"> = {
      classType: runData.classType,
      date: now,
      modifiers: runData.modifiers,
    };

    // Increment total runs
    data.totalRuns++;

    // Highest Altitude
    {
      const cat: LeaderboardCategory = "highest_altitude";
      const entry: LeaderboardEntry = { ...baseEntry, score: Math.floor(runData.altitude) };
      const result = this._tryInsert(cat, entry);
      if (result >= 0) {
        newRecords.push({
          category: cat,
          label: CATEGORY_LABELS[cat],
          value: entry.score,
          position: result + 1,
        });
      }
    }

    // Fastest to 5000m (only if altitude >= 5000)
    if (runData.altitude >= 5000 && runData.timeMs > 0) {
      const cat: LeaderboardCategory = "fastest_5000m";
      const entry: LeaderboardEntry = { ...baseEntry, score: runData.timeMs };
      const result = this._tryInsert(cat, entry);
      if (result >= 0) {
        newRecords.push({
          category: cat,
          label: CATEGORY_LABELS[cat],
          value: entry.score,
          position: result + 1,
        });
      }
    }

    // Most Bosses Defeated
    if (runData.bossesDefeated > 0) {
      const cat: LeaderboardCategory = "most_bosses";
      const entry: LeaderboardEntry = { ...baseEntry, score: runData.bossesDefeated };
      const result = this._tryInsert(cat, entry);
      if (result >= 0) {
        newRecords.push({
          category: cat,
          label: CATEGORY_LABELS[cat],
          value: entry.score,
          position: result + 1,
        });
      }
    }

    // Longest Survival
    if (runData.timeMs > 0) {
      const cat: LeaderboardCategory = "longest_survival";
      const entry: LeaderboardEntry = { ...baseEntry, score: runData.timeMs };
      const result = this._tryInsert(cat, entry);
      if (result >= 0) {
        newRecords.push({
          category: cat,
          label: CATEGORY_LABELS[cat],
          value: entry.score,
          position: result + 1,
        });
      }
    }

    // Most Kills
    if (runData.kills > 0) {
      const cat: LeaderboardCategory = "most_kills";
      const entry: LeaderboardEntry = { ...baseEntry, score: runData.kills };
      const result = this._tryInsert(cat, entry);
      if (result >= 0) {
        newRecords.push({
          category: cat,
          label: CATEGORY_LABELS[cat],
          value: entry.score,
          position: result + 1,
        });
      }
    }

    // Highest Combo
    if (runData.highestCombo > 0) {
      const cat: LeaderboardCategory = "highest_combo";
      const entry: LeaderboardEntry = { ...baseEntry, score: runData.highestCombo };
      const result = this._tryInsert(cat, entry);
      if (result >= 0) {
        newRecords.push({
          category: cat,
          label: CATEGORY_LABELS[cat],
          value: entry.score,
          position: result + 1,
        });
      }
    }

    this.save();
    return newRecords;
  },

  /**
   * Try to insert an entry into a category's leaderboard.
   * Returns the 0-based index where it was inserted, or -1 if not inserted.
   */
  _tryInsert(category: LeaderboardCategory, entry: LeaderboardEntry): number {
    if (!data.boards[category]) {
      data.boards[category] = [];
    }
    const board = data.boards[category];

    // Find insertion position
    let insertAt = board.length;
    for (let i = 0; i < board.length; i++) {
      if (isBetter(category, entry.score, board[i].score)) {
        insertAt = i;
        break;
      }
    }

    // Check if it would make the top 10
    if (insertAt >= MAX_ENTRIES) {
      return -1;
    }

    // Insert and trim
    board.splice(insertAt, 0, entry);
    if (board.length > MAX_ENTRIES) {
      board.length = MAX_ENTRIES;
    }

    return insertAt;
  },

  /**
   * Get the leaderboard entries for a given category, optionally filtered by class.
   */
  getLeaderboard(category: string, classFilter?: string): LeaderboardEntry[] {
    const board = data.boards[category] || [];
    if (!classFilter || classFilter === "ALL") {
      return [...board];
    }
    // Filter by class, then re-sort and trim to top 10
    const filtered = board.filter((e) => e.classType === classFilter);
    return sortEntries(category as LeaderboardCategory, filtered).slice(0, MAX_ENTRIES);
  },

  /**
   * Get personal bests — the #1 entry per category.
   */
  getPersonalBests(): Record<string, LeaderboardEntry> {
    const bests: Record<string, LeaderboardEntry> = {};
    for (const cat of LEADERBOARD_CATEGORIES) {
      const board = data.boards[cat];
      if (board && board.length > 0) {
        bests[cat] = { ...board[0] };
      }
    }
    return bests;
  },

  /**
   * Get the rank (1-based) a given score would have in a category.
   * Returns -1 if it would not place in top 10.
   */
  getRankForScore(category: LeaderboardCategory, score: number): number {
    const board = data.boards[category] || [];
    return getRank(category, score, board);
  },

  /**
   * Get total number of runs tracked.
   */
  getTotalRuns(): number {
    return data.totalRuns;
  },

  /**
   * Get the category label for display.
   */
  getCategoryLabel(category: LeaderboardCategory): string {
    return CATEGORY_LABELS[category] || category;
  },

  /**
   * Clear all leaderboard data.
   */
  clearAll(): void {
    data = defaultData();
    this.save();
  },
};

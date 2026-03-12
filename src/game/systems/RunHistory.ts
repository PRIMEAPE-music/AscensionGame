/**
 * RunHistory — localStorage-based run history log.
 * Stores the last 20 completed runs with detailed stats.
 */

export interface RunRecord {
  id: string;
  date: string; // ISO date
  classType: string;
  subclass: string | null;
  altitude: number;
  timeMs: number;
  kills: number;
  bossesDefeated: number;
  itemsCollected: string[]; // item IDs
  causeOfDeath: string; // "enemy_damage", "fall", "hazard", "boss_[name]", "victory"
  essenceEarned: number;
  maxCombo: number;
  gameMode: string; // "standard", "daily", "endless", "boss_rush", "weekly"
}

const STORAGE_KEY = "ascension_run_history";
const MAX_RUNS = 20;

let _runs: RunRecord[] = [];

export const RunHistory = {
  /** Load run history from localStorage. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          _runs = parsed;
        } else {
          _runs = [];
        }
      } else {
        _runs = [];
      }
    } catch {
      _runs = [];
    }
  },

  /** Save run history to localStorage. */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_runs));
    } catch {
      // localStorage may be unavailable; silently ignore
    }
  },

  /** Add a new run record to the front of the list, capping at MAX_RUNS. */
  addRun(record: RunRecord): void {
    _runs.unshift(record);
    if (_runs.length > MAX_RUNS) {
      _runs = _runs.slice(0, MAX_RUNS);
    }
    this.save();
  },

  /** Get all run records (most recent first). */
  getRuns(): RunRecord[] {
    return [..._runs];
  },

  /** Clear all run history. */
  clear(): void {
    _runs = [];
    this.save();
  },

  /** Generate a unique ID for a run record. */
  generateId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  },

  /** Get the altitude tier color for a given altitude. */
  getAltitudeTierColor(altitude: number): string {
    if (altitude >= 5000) return "#ffd700"; // gold = ascension
    if (altitude >= 3000) return "#44ff44"; // green = good
    if (altitude >= 500) return "#ffaa00";  // yellow = mid
    return "#ff4444";                        // red = early death
  },

  /** Get the altitude tier label for a given altitude. */
  getAltitudeTierLabel(altitude: number): string {
    if (altitude >= 5000) return "Ascension";
    if (altitude >= 3000) return "Deep Run";
    if (altitude >= 500) return "Mid Run";
    return "Early Death";
  },
};

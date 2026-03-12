import { RUN_MODIFIERS } from '../config/RunModifiers';
import { EventBus } from './EventBus';

const ENDLESS_LEADERBOARD_KEY = 'ascension_endless_leaderboard';
const BOSS_THRESHOLD = 15;
const CORRUPTION_RATE = 2.0; // per second, fills in ~50 seconds
const CORRUPTION_MAX = 100;

// Negative corruption modifiers (subset of existing modifiers + custom effects)
const CORRUPTION_MODIFIERS = [
  'glass_cannon',
  'rising_darkness',
  'chaos_mode',
];

export interface EndlessLeaderboardEntry {
  date: string;
  classType: string;
  altitude: number;
  kills: number;
  bosses: number;
  timeMs: number;
}

export const EndlessLeaderboard = {
  entries: [] as EndlessLeaderboardEntry[],

  load(): void {
    try {
      const raw = localStorage.getItem(ENDLESS_LEADERBOARD_KEY);
      if (raw) {
        this.entries = JSON.parse(raw);
      }
    } catch {
      this.entries = [];
    }
  },

  save(): void {
    localStorage.setItem(ENDLESS_LEADERBOARD_KEY, JSON.stringify(this.entries));
  },

  submit(entry: EndlessLeaderboardEntry): boolean {
    this.entries.push(entry);
    this.entries.sort((a, b) => b.altitude - a.altitude);
    if (this.entries.length > 10) {
      this.entries = this.entries.slice(0, 10);
    }
    this.save();
    return this.entries.some(
      (e) => e.date === entry.date && e.altitude === entry.altitude && e.timeMs === entry.timeMs
    );
  },

  getEntries(): EndlessLeaderboardEntry[] {
    return [...this.entries];
  },

  getHighestAltitude(): number {
    if (this.entries.length === 0) return 0;
    return this.entries[0].altitude;
  },
};

export const EndlessManager = {
  _active: false,
  _corruptionMeter: 0,
  _bossesDefeatedPastThreshold: 0,
  _activeCorruptionModifier: null as string | null,
  _totalBossesDefeated: 0,

  activate(): void {
    this._active = true;
    this._corruptionMeter = 0;
    this._bossesDefeatedPastThreshold = 0;
    this._activeCorruptionModifier = null;
    this._totalBossesDefeated = 0;
    (window as any).__isEndlessMode = true;
    EndlessLeaderboard.load();
  },

  deactivate(): void {
    this._active = false;
    this._corruptionMeter = 0;
    this._bossesDefeatedPastThreshold = 0;
    this._activeCorruptionModifier = null;
    this._totalBossesDefeated = 0;
    delete (window as any).__isEndlessMode;
  },

  isActive(): boolean {
    return this._active;
  },

  /**
   * Track boss defeat for endless scaling.
   * Called when a boss is defeated.
   */
  onBossDefeated(bossNumber: number): void {
    this._totalBossesDefeated = bossNumber;
    if (bossNumber > BOSS_THRESHOLD) {
      this._bossesDefeatedPastThreshold = bossNumber - BOSS_THRESHOLD;
    }
    // Reset corruption on boss kill
    this.resetCorruption();
  },

  /**
   * Returns the number of 5-boss intervals past the threshold.
   * e.g., boss 20 = 1 interval, boss 25 = 2 intervals, etc.
   */
  _getScalingTiers(bossNumber: number): number {
    if (bossNumber <= BOSS_THRESHOLD) return 0;
    return Math.floor((bossNumber - BOSS_THRESHOLD) / 5);
  },

  /**
   * Boss HP multiplier: +25% every 5 bosses past #15
   */
  getBossHPMultiplier(bossNumber: number): number {
    if (!this._active) return 1;
    const tiers = this._getScalingTiers(bossNumber);
    return 1 + (tiers * 0.25);
  },

  /**
   * Enemy HP multiplier: +15% every 5 bosses past #15
   */
  getEnemyHPMultiplier(bossNumber: number): number {
    if (!this._active) return 1;
    const tiers = this._getScalingTiers(bossNumber);
    return 1 + (tiers * 0.15);
  },

  /**
   * Platform gap multiplier: +10% every 5 bosses past #15
   */
  getPlatformGapMultiplier(bossNumber: number): number {
    if (!this._active) return 1;
    const tiers = this._getScalingTiers(bossNumber);
    return 1 + (tiers * 0.10);
  },

  /**
   * Minimum affixes for enemies at high altitude in endless mode.
   * At 20000m+: enemies get 2-3 affixes.
   */
  getMinAffixes(altitude: number): number {
    if (!this._active) return 0;
    if (altitude >= 20000) {
      return 2; // 2-3 affixes (EliteManager will roll at least this many)
    }
    return 0;
  },

  /**
   * Update corruption meter. Called every frame with delta in ms.
   */
  updateCorruption(delta: number): void {
    if (!this._active) return;
    // Only accumulate corruption past the boss threshold
    if (this._totalBossesDefeated < BOSS_THRESHOLD) return;
    // Don't accumulate if a corruption modifier is already active
    if (this._activeCorruptionModifier) return;

    const deltaSeconds = delta / 1000;
    this._corruptionMeter = Math.min(CORRUPTION_MAX, this._corruptionMeter + CORRUPTION_RATE * deltaSeconds);

    // Emit corruption update for HUD
    EventBus.emit('corruption-update', { level: this._corruptionMeter });

    // When corruption fills up, activate a random negative modifier
    if (this._corruptionMeter >= CORRUPTION_MAX && !this._activeCorruptionModifier) {
      this._activateCorruptionModifier();
    }
  },

  getCorruption(): number {
    return this._corruptionMeter;
  },

  resetCorruption(): void {
    this._corruptionMeter = 0;
    this._activeCorruptionModifier = null;
    EventBus.emit('corruption-update', { level: 0 });
  },

  isCorruptionFull(): boolean {
    return this._corruptionMeter >= CORRUPTION_MAX;
  },

  getActiveCorruptionModifier(): string | null {
    return this._activeCorruptionModifier;
  },

  _activateCorruptionModifier(): void {
    // Pick a random corruption modifier
    const available = CORRUPTION_MODIFIERS.filter(id => {
      // Check that the modifier exists in the registry
      return RUN_MODIFIERS.some(m => m.id === id);
    });
    if (available.length === 0) return;

    const modId = available[Math.floor(Math.random() * available.length)];
    this._activeCorruptionModifier = modId;

    EventBus.emit('corruption-modifier', { modifierId: modId });
  },

  /**
   * Get the current boss number based on endless tracking.
   */
  getCurrentBossNumber(): number {
    return this._totalBossesDefeated;
  },

  /**
   * Submit an endless run to the leaderboard.
   */
  submitRun(altitude: number, kills: number, bosses: number, timeMs: number, classType: string): boolean {
    const now = new Date();
    const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    return EndlessLeaderboard.submit({
      date,
      classType,
      altitude,
      kills,
      bosses,
      timeMs,
    });
  },
};

import { EventBus } from "./EventBus";
import { GameSettings } from "./GameSettings";

/**
 * Singleton combo counter system.
 *
 * Tracks consecutive hits/kills and provides an essence multiplier.
 *
 * Multiplier tiers:
 *   1-4   hits  => 1.0x
 *   5-9   hits  => 1.5x
 *   10-19 hits  => 2.0x
 *   20-49 hits  => 2.5x
 *   50+   hits  => 3.0x
 *
 * Getting hit resets the combo.  A 3-second idle timer also resets it.
 */
export const ComboManager = {
  _count: 0,
  _multiplier: 1.0,
  _timer: 0,
  _maxCombo: 0,

  /** Base timeout in milliseconds before the combo resets from inactivity. */
  COMBO_TIMEOUT: 3000,

  // ------------------------------------------------------------------ public

  /** Add hits to the combo counter. Kills should pass a larger amount. */
  increment(amount: number = 1): void {
    this._count += amount;
    this._timer = this._getTimeout();
    this._recalcMultiplier();

    if (this._count > this._maxCombo) {
      this._maxCombo = this._count;
    }

    EventBus.emit("combo-update", {
      count: this._count,
      multiplier: this._multiplier,
      timer: this._timer,
    });
  },

  /** Reset the combo (e.g. when the player takes damage). */
  reset(): void {
    if (this._count >= 3) {
      EventBus.emit("combo-end", { finalCount: this._count });
    }
    this._count = 0;
    this._multiplier = 1.0;
    this._timer = 0;

    EventBus.emit("combo-update", {
      count: 0,
      multiplier: 1.0,
      timer: 0,
    });
  },

  /**
   * Tick the idle timer.  Call once per frame from the game update loop.
   * @param delta  Frame delta in milliseconds.
   */
  update(delta: number): void {
    if (this._count <= 0) return;

    this._timer -= delta;
    if (this._timer <= 0) {
      this.reset();
    }
  },

  /** Current essence multiplier based on combo count. */
  getMultiplier(): number {
    return this._multiplier;
  },

  /** Current combo hit count. */
  getCount(): number {
    return this._count;
  },

  /** Highest combo reached during this run. */
  getMaxCombo(): number {
    return this._maxCombo;
  },

  /** Call at the start of a new run to wipe all state. */
  resetRun(): void {
    this._count = 0;
    this._multiplier = 1.0;
    this._timer = 0;
    this._maxCombo = 0;
  },

  // ----------------------------------------------------------------- private

  _recalcMultiplier(): void {
    if (this._count >= 50) {
      this._multiplier = 3.0;
    } else if (this._count >= 20) {
      this._multiplier = 2.5;
    } else if (this._count >= 10) {
      this._multiplier = 2.0;
    } else if (this._count >= 5) {
      this._multiplier = 1.5;
    } else {
      this._multiplier = 1.0;
    }
  },

  _getTimeout(): number {
    const settings = GameSettings.get();
    if (settings.assistMode && settings.reducedComboTiming) {
      return this.COMBO_TIMEOUT * 1.5; // 50% more lenient
    }
    return this.COMBO_TIMEOUT;
  },
};

import { STYLE } from "../config/GameConfig";
import { EventBus } from "./EventBus";

export class StyleManager {
  private scene: Phaser.Scene;
  private meter: number = 0;
  private decayTimer: number = 0;
  private wallJumpChain: number = 0;
  private wallJumpTimer: number = 0;
  private lastTier: string = "D";

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(delta: number, playerSpeed: number): void {
    const frameScale = delta / 16.67;
    let gained = false;

    // Speed-based style gain
    if (playerSpeed > STYLE.SPEED_THRESHOLD) {
      this.meter += STYLE.SPEED_GAIN * frameScale;
      gained = true;
    }

    // Wall jump chain timeout
    if (this.wallJumpChain > 0) {
      this.wallJumpTimer += delta;
      if (this.wallJumpTimer > 2000) {
        this.wallJumpChain = 0;
        this.wallJumpTimer = 0;
      }
    }

    // Decay timer and meter decay
    if (gained) {
      this.decayTimer = 0;
    } else {
      this.decayTimer += delta;
      if (this.decayTimer > STYLE.DECAY_DELAY) {
        this.meter -= STYLE.DECAY_RATE * (delta / 1000);
      }
    }

    // Clamp
    const prevMeter = this.meter;
    this.meter = Math.max(0, Math.min(STYLE.MAX_METER, this.meter));

    // Emit if changed
    const currentTier = this.tier;
    if (this.meter !== prevMeter || currentTier !== this.lastTier) {
      this.lastTier = currentTier;
      EventBus.emit("style-change", {
        meter: this.meter,
        tier: currentTier,
        multiplier: this.multiplier,
      });
    }
  }

  addStyle(amount: number): void {
    const prevMeter = this.meter;
    this.meter = Math.min(STYLE.MAX_METER, Math.max(0, this.meter + amount));
    this.decayTimer = 0;

    const currentTier = this.tier;
    if (this.meter !== prevMeter || currentTier !== this.lastTier) {
      this.lastTier = currentTier;
      EventBus.emit("style-change", {
        meter: this.meter,
        tier: currentTier,
        multiplier: this.multiplier,
      });
    }
  }

  onAirborneKill(): void {
    this.addStyle(STYLE.AIRBORNE_KILL_BONUS);
  }

  onMultiKill(count: number): void {
    this.addStyle(STYLE.MULTI_KILL_BONUS * count);
  }

  onWallJump(): void {
    this.wallJumpChain++;
    this.wallJumpTimer = 0;
    this.addStyle(STYLE.WALL_JUMP_CHAIN_BONUS * this.wallJumpChain);
  }

  onSlopeLaunch(speed: number): void {
    this.addStyle(STYLE.SLOPE_LAUNCH_BONUS * (speed / 500));
  }

  get tier(): string {
    let tierIndex = 0;
    for (let i = STYLE.TIER_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.meter >= STYLE.TIER_THRESHOLDS[i]) {
        tierIndex = i;
        break;
      }
    }
    return STYLE.TIER_NAMES[tierIndex];
  }

  get value(): number {
    return this.meter;
  }

  get multiplier(): number {
    let tierIndex = 0;
    for (let i = STYLE.TIER_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.meter >= STYLE.TIER_THRESHOLDS[i]) {
        tierIndex = i;
        break;
      }
    }
    return STYLE.TIER_MULTIPLIERS[tierIndex];
  }
}

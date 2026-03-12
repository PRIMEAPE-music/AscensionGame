import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { Player } from './Player';
import { EventBus } from '../systems/EventBus';

/**
 * TrainingDummy — a stationary practice target for the Training Room.
 *
 * - High HP (9999), auto-resets when below 100
 * - Shows accumulated DPS text above itself
 * - Optional attack mode: swings at player every 2 seconds for parry practice
 * - Does NOT move, chase, or flee
 */
export class TrainingDummy extends Enemy {
  private dpsText: Phaser.GameObjects.Text;
  private labelText: Phaser.GameObjects.Text;
  private damageLog: { time: number; amount: number }[] = [];
  private readonly DPS_WINDOW = 5000; // 5 second rolling window
  public attackMode: boolean = false;
  private attackTimer: number = 0;
  private readonly ATTACK_INTERVAL = 2000; // 2 seconds between attacks
  private attackIndicator: Phaser.GameObjects.Rectangle | null = null;
  private attackWindup: boolean = false;
  private attackWindupTimer: number = 0;
  private readonly ATTACK_WINDUP = 600; // 600ms telegraph before attack lands

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player | Player[]) {
    super(scene, x, y, 'dude', player, 9999, 1, 0);

    this.enemyType = 'training_dummy';
    this.tier = 'basic';
    this.isElite = false;

    // Make it stationary
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(true);

    // Visual: gray tinted, slightly larger
    this.setScale(1.3);
    this.setTint(0x888888);

    // "DUMMY" label above
    this.labelText = scene.add.text(x, y - 50, 'DUMMY', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
      fontStyle: 'bold',
    });
    this.labelText.setOrigin(0.5);
    this.labelText.setDepth(100);

    // DPS display above the label
    this.dpsText = scene.add.text(x, y - 70, 'DPS: 0', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.dpsText.setOrigin(0.5);
    this.dpsText.setDepth(100);

    // Listen for attack mode toggle
    this._cleanupAttackToggle = EventBus.on('training-toggle-dummy-attack', (data) => {
      this.attackMode = data.enabled;
      this.attackTimer = 0;
      this.attackWindup = false;
      if (this.attackIndicator) {
        this.attackIndicator.destroy();
        this.attackIndicator = null;
      }
    });
  }

  private _cleanupAttackToggle: (() => void) | null = null;

  /**
   * Override takeDamage to log damage for DPS tracking.
   * Auto-reset HP when it gets low.
   */
  public takeDamage(amount: number, attackerX?: number): void {
    // Log damage for DPS calculation
    this.damageLog.push({ time: Date.now(), amount });

    // Let the base class handle the visual flash, but we override die behavior
    this.health -= amount;

    // Flash red on hit
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      if (this.active) {
        this.setTint(0x888888);
      }
    });

    // Auto-reset HP when low
    if (this.health < 100) {
      this.health = 9999;
      this.maxHealth = 9999;
    }

    // Calculate and emit DPS
    this.updateDPS();
  }

  /** Calculate rolling DPS and emit event. */
  private updateDPS(): void {
    const now = Date.now();
    // Remove entries older than the DPS window
    this.damageLog = this.damageLog.filter((e) => now - e.time <= this.DPS_WINDOW);

    if (this.damageLog.length === 0) {
      this.dpsText.setText('DPS: 0');
      EventBus.emit('training-dps-update', { dps: 0 });
      return;
    }

    const totalDamage = this.damageLog.reduce((sum, e) => sum + e.amount, 0);
    const timeSpan = Math.min(this.DPS_WINDOW, now - this.damageLog[0].time);
    const dps = timeSpan > 0 ? Math.round((totalDamage / timeSpan) * 1000) : totalDamage;

    this.dpsText.setText(`DPS: ${dps}`);
    EventBus.emit('training-dps-update', { dps });
  }

  /** Override die to prevent the dummy from actually dying. */
  protected die(): void {
    // Training dummy never dies — just reset
    this.health = 9999;
    this.maxHealth = 9999;
  }

  setAttackMode(enabled: boolean): void {
    this.attackMode = enabled;
    this.attackTimer = 0;
    this.attackWindup = false;
    if (this.attackIndicator) {
      this.attackIndicator.destroy();
      this.attackIndicator = null;
    }
  }

  update(time: number, delta: number): void {
    if (!this.active || !this.scene) return;

    // Keep stationary (counteract physics)
    this.setVelocityX(0);

    // Update label positions
    this.labelText.setPosition(this.x, this.y - 50);
    this.dpsText.setPosition(this.x, this.y - 70);

    // Periodically recalculate DPS to account for decay
    this.updateDPS();

    // Attack mode: swing at player every 2 seconds for parry practice
    if (this.attackMode && delta > 0) {
      this.attackTimer += delta;

      if (!this.attackWindup && this.attackTimer >= this.ATTACK_INTERVAL) {
        // Start windup telegraph
        this.attackWindup = true;
        this.attackWindupTimer = 0;
        this.attackTimer = 0;

        // Show telegraph indicator (red rectangle expanding from dummy)
        this.attackIndicator = this.scene.add.rectangle(
          this.x,
          this.y,
          120,
          60,
          0xff4444,
          0.3,
        );
        this.attackIndicator.setDepth(90);

        // Flash the dummy orange during windup
        this.setTint(0xff8800);
      }

      if (this.attackWindup) {
        this.attackWindupTimer += delta;

        // Pulse the indicator
        if (this.attackIndicator && this.attackIndicator.active) {
          const pulse = 0.3 + Math.sin(this.attackWindupTimer * 0.01) * 0.2;
          this.attackIndicator.setAlpha(pulse);
        }

        if (this.attackWindupTimer >= this.ATTACK_WINDUP) {
          // Execute attack — deal 1 damage to nearby players
          this.attackWindup = false;
          this.setTint(0xff0000);

          // Damage players within range (150px)
          const players = this.getPlayers();
          for (const p of players) {
            if (!p.active) continue;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
            if (dist <= 150) {
              p.takeDamage(1);
            }
          }

          // Clean up indicator
          if (this.attackIndicator) {
            this.attackIndicator.destroy();
            this.attackIndicator = null;
          }

          // Restore tint
          this.scene.time.delayedCall(200, () => {
            if (this.active) {
              this.setTint(0x888888);
            }
          });
        }
      }
    }
  }

  /** Clean up texts and event listeners. */
  destroy(fromScene?: boolean): void {
    if (this.dpsText) this.dpsText.destroy();
    if (this.labelText) this.labelText.destroy();
    if (this.attackIndicator) this.attackIndicator.destroy();
    if (this._cleanupAttackToggle) this._cleanupAttackToggle();
    super.destroy(fromScene);
  }
}

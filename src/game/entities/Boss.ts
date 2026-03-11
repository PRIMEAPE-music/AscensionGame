import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EventBus } from '../systems/EventBus';

export abstract class Boss extends Enemy {
  public bossNumber: number;
  public bossName: string;
  public phase: number = 1;
  public totalPhases: number = 3;
  protected phaseThresholds: number[] = [0.66, 0.33]; // health % to transition
  private isTransitioning: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    player: Player,
    bossNumber: number,
    bossName: string,
  ) {
    // Health scales: Boss 1 = 200, Boss 2 = 350, Boss 3 = 500, +150 per boss after
    const health = 200 + (bossNumber - 1) * 150;
    super(scene, x, y, 'dude', player, health, 1, 100);

    this.bossNumber = bossNumber;
    this.bossName = bossName;
    this.enemyType = 'boss';
    this.tier = 'elite';

    // Bosses are bigger
    this.setScale(1.5);

    // Emit spawn event
    EventBus.emit('boss-spawn', {
      name: bossName,
      maxHealth: health,
      bossNumber,
    });
  }

  // Override takeDamage for phase tracking
  public takeDamage(amount: number) {
    if (this.isDead || this.isTransitioning) return;

    super.takeDamage(amount);

    // Emit health change
    EventBus.emit('boss-health-change', {
      health: this.health,
      maxHealth: this.maxHealth,
      phase: this.phase,
    });

    // Check phase transitions
    this.checkPhaseTransition();
  }

  private checkPhaseTransition() {
    const healthPercent = this.health / this.maxHealth;
    const nextPhase = this.phase + 1;

    if (nextPhase <= this.totalPhases) {
      const threshold = this.phaseThresholds[this.phase - 1];
      if (healthPercent <= threshold) {
        this.transitionToPhase(nextPhase);
      }
    }
  }

  private transitionToPhase(newPhase: number) {
    this.isTransitioning = true;
    this.phase = newPhase;

    // Brief invulnerability during transition (1.5s)
    // Visual: flash white rapidly
    const bossTint = this.getBossTint();
    this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        if (!this.active) return;
        this.setTint(this.tintTopLeft === 0xffffff ? bossTint : 0xffffff);
      },
      repeat: 14, // 1.5 seconds of flashing
    });

    this.scene.time.delayedCall(1500, () => {
      if (!this.active) return;
      this.isTransitioning = false;
      this.setTint(this.getBossTint());
    });

    EventBus.emit('boss-phase-change', {
      phase: newPhase,
      totalPhases: this.totalPhases,
    });
    this.onPhaseChange(newPhase);
  }

  // Override in subclasses to handle phase-specific changes
  protected abstract onPhaseChange(phase: number): void;

  // Override in subclasses to return boss tint color
  protected abstract getBossTint(): number;

  protected die() {
    // Spawn rewards before destroying
    this.spawnRewards();
    super.die();
  }

  private spawnRewards() {
    // Every boss drops a silver item
    // Emit defeated event with reward info
    const rewards: string[] = ['silver_item'];
    if (this.bossNumber % 3 === 0) {
      rewards.push('gold_item');
    }
    // Actual item spawning will be handled by the system listening to this event
    EventBus.emit('boss-defeated', {
      bossNumber: this.bossNumber,
      altitude: 0, // will be filled by listener
      rewards,
    });
  }
}

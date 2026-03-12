import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { Player } from "./Player";

export class ShadowBat extends Enemy {
  private startY: number;
  private timeOffset: number;
  private isDiving: boolean = false;
  private isRecovering: boolean = false;
  private readonly SINE_AMPLITUDE = 50;
  private readonly SINE_SPEED = 0.003;
  private readonly DIVE_SPEED = 400;

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player | Player[]) {
    super(scene, x, y, "dude", player, 2, 1, 100); // 2 HP, 1 Dmg, 100 Speed
    this.enemyType = 'bat';
    this.tier = 'basic';
    this.defaultTint = 0x550055;
    this.setTint(0x550055); // Purple/Shadow tint
    this.setScale(0.7);
    this.startY = y;
    this.timeOffset = Math.random() * 1000;

    // Flying enemy - no gravity
    (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    // Use the base AI state machine
    this.useBaseAI = true;
    this.detectionRange = 300;
    this.attackRange = 100;
    this.desperateMode = false; // Flees when low
    this.fleeThreshold = 0.2;
  }

  protected onPatrol(_delta: number): void {
    // Sine wave movement (uses scene time via stateTimer workaround)
    // We access scene.time.now for the sine wave
    const time = this.scene.time.now;
    const wave = Math.sin((time + this.timeOffset) * this.SINE_SPEED);
    this.y = this.startY + wave * this.SINE_AMPLITUDE;

    // Face player
    if (this.player.x < this.x) {
      this.setFlipX(true);
    } else {
      this.setFlipX(false);
    }
    this.facingDirection = this.player.x > this.x ? 1 : -1;
  }

  protected onAlert(_delta: number, player: Phaser.GameObjects.Sprite): void {
    // Swoop toward player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.setVelocityX((dx / dist) * this.speed * 1.5);
      this.setVelocityY((dy / dist) * this.speed * 1.5);
    }
    this.setFlipX(player.x < this.x);
    this.facingDirection = player.x > this.x ? 1 : -1;
  }

  protected onAttack(_delta: number, player: Phaser.GameObjects.Sprite): void {
    // Dive bomb — same as existing dive behavior
    if (!this.isDiving) {
      this.startDive();
    } else if (this.isRecovering) {
      this.handleRecovery(_delta);
    } else {
      this.handleDive();
    }
  }

  protected onFlee(_delta: number, _player: Phaser.GameObjects.Sprite): void {
    // Fly upward and away from player
    const dx = _player.x - this.x;
    const dir = dx > 0 ? -1 : 1; // Move AWAY horizontally
    this.setVelocityX(this.speed * 1.5 * dir);
    this.setVelocityY(-this.speed * 1.5); // Fly upward
    this.setFlipX(dir < 0);
    this.facingDirection = dir;
  }

  private startDive() {
    this.isDiving = true;
    this.setVelocityY(0);

    // Telegraph: Pause briefly then dive
    this.isInAttackStartup = true;
    this.setTint(0xff00ff); // Flash brighter warning

    this.scene.time.delayedCall(500, () => {
      if (this.isDead || this.aiState === 'STUN') {
        this.isDiving = false;
        this.isInAttackStartup = false;
        return;
      }
      this.isInAttackStartup = false;
      // Dive towards player's current position
      this.scene.physics.moveToObject(this, this.player, this.DIVE_SPEED);
    });
  }

  private handleDive() {
    // Stop diving if we hit something or go too far
    if (this.body!.blocked.down || this.y > this.startY + 500) {
      this.startRecovery();
    }
  }

  private startRecovery() {
    this.isDiving = false;
    this.isRecovering = true;
    this.setVelocity(0, 0);
    this.restoreTint();

    // Return to start height slowly
    this.scene.physics.moveTo(this, this.x, this.startY, 100);
  }

  private handleRecovery(_delta: number) {
    // Check if back at start height
    if (Math.abs(this.y - this.startY) < 10) {
      this.isRecovering = false;
      this.isDiving = false;
      this.setVelocity(0, 0);
      this.y = this.startY; // Snap to grid
    }
  }

  protected die() {
    this.isDiving = false;
    this.isRecovering = false;
    super.die();
  }
}

import { Enemy } from "./Enemy";
import { Player } from "./Player";
import Phaser from "phaser";

export class HellHound extends Enemy {
  private direction: number = 1;
  private patrolTimer: number = 0;
  private recoveryTimer: number = 0;
  private lungeTimer: number = 0;
  private isLunging: boolean = false;
  private isInRecovery: boolean = false;

  private readonly DETECT_RANGE = 350;
  private readonly LUNGE_RANGE = 120;
  private readonly LUNGE_SPEED_X = 400;
  private readonly LUNGE_SPEED_Y = -250;
  private readonly RECOVERY_DURATION = 800;
  private readonly PATROL_TURN_INTERVAL = 1500;

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
    super(scene, x, y, "dude", player, 4, 1, 250); // 4 HP, 1 Dmg, 250 Speed
    this.enemyType = 'hound';
    this.tier = 'basic';
    this.defaultTint = 0xff4400;
    this.setTint(0xff4400); // Orange-red
    this.setScale(0.75);

    // Use the base AI state machine
    this.useBaseAI = true;
    this.detectionRange = this.DETECT_RANGE;
    this.attackRange = this.LUNGE_RANGE;
    this.desperateMode = true; // Gets faster when low health, never flees
    this.fleeThreshold = 0.2;
  }

  protected onPatrol(delta: number): void {
    this.setVelocityX(this.speed * 0.4 * this.direction);

    this.patrolTimer += delta;
    if (this.patrolTimer >= this.PATROL_TURN_INTERVAL) {
      this.direction *= -1;
      this.patrolTimer = 0;
    }
    this.setFlipX(this.direction < 0);
    this.facingDirection = this.direction;
  }

  protected onAlert(_delta: number, player: Phaser.GameObjects.Sprite): void {
    // Sprint toward player (existing chase behavior)
    const dx = player.x - this.x;
    this.direction = dx > 0 ? 1 : -1;

    // Desperate mode: run even faster
    const speedMult = (this.desperateMode && this.health <= this.maxHealth * this.fleeThreshold) ? 1.3 : 1.0;
    this.setVelocityX(this.speed * this.direction * speedMult);
    this.setFlipX(this.direction < 0);
    this.facingDirection = this.direction;
  }

  protected onAttack(delta: number, player: Phaser.GameObjects.Sprite): void {
    if (this.isInRecovery) {
      this.handleRecovery(delta);
      return;
    }

    if (this.isLunging) {
      this.handleLunge(delta);
      return;
    }

    // Start a new lunge attack
    this.startLunge(player);
  }

  private startLunge(player: Phaser.GameObjects.Sprite) {
    this.isLunging = true;
    this.lungeTimer = 0;

    // Brief telegraph flash — this is the attack startup (vulnerable to stun)
    this.isInAttackStartup = true;
    this.setTint(0xffaa00);

    // Desperate mode: shorter telegraph
    const telegraphDuration = (this.desperateMode && this.health <= this.maxHealth * this.fleeThreshold) ? 100 : 200;

    this.scene.time.delayedCall(telegraphDuration, () => {
      if (this.isDead || this.aiState === 'STUN') {
        this.isLunging = false;
        this.isInAttackStartup = false;
        return;
      }
      this.isInAttackStartup = false;

      const lungeDir = player.x > this.x ? 1 : -1;
      const lungeMult = (this.desperateMode && this.health <= this.maxHealth * this.fleeThreshold) ? 1.3 : 1.0;
      this.setVelocityX(this.LUNGE_SPEED_X * lungeDir * lungeMult);
      this.setVelocityY(this.LUNGE_SPEED_Y);
    });
  }

  private handleLunge(delta: number) {
    // Wait until landing (on ground)
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down) {
      this.isLunging = false;
      this.isInRecovery = true;
      this.recoveryTimer = 0;
      this.setVelocityX(0);
      this.restoreTint();
      return;
    }

    // Safety timeout: force recovery if stuck in lunge for over 3 seconds
    this.lungeTimer += delta;
    if (this.lungeTimer >= 3000) {
      this.isLunging = false;
      this.isInRecovery = true;
      this.recoveryTimer = 0;
      this.setVelocityX(0);
      this.setVelocityY(0);
      this.restoreTint();
    }
  }

  private handleRecovery(delta: number) {
    this.setVelocityX(0);
    this.recoveryTimer += delta;

    // Desperate mode: shorter recovery
    const recovDuration = (this.desperateMode && this.health <= this.maxHealth * this.fleeThreshold)
      ? this.RECOVERY_DURATION * 0.6
      : this.RECOVERY_DURATION;

    if (this.recoveryTimer >= recovDuration) {
      this.isInRecovery = false;
    }
  }
}

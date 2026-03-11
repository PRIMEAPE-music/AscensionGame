import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { Player } from "./Player";
import { COMBAT } from "../config/GameConfig";
import { EventBus } from "../systems/EventBus";

export class DemonTurret extends Enemy {
  private fireTimer: number = 0;
  private baseFiringInterval: number = 3000;
  private readonly PROJECTILE_SPEED = 250;
  private readonly PROJECTILE_LIFETIME = 3000;
  private projectiles: Phaser.Physics.Arcade.Group;
  private projectileCollider: Phaser.Physics.Arcade.Collider;

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
    super(scene, x, y, "dude", player, 5, 1, 0); // 5 HP, 1 Dmg, 0 Speed (stationary)
    this.enemyType = 'turret';
    this.tier = 'basic';
    this.defaultTint = 0x990000;
    this.setTint(0x990000); // Dark red
    this.setScale(0.9);

    // Stationary: no gravity, immovable
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    // Projectile group
    this.projectiles = scene.physics.add.group({
      allowGravity: false,
    });

    // Overlap projectiles with player for damage
    this.projectileCollider = scene.physics.add.overlap(
      player,
      this.projectiles,
      (_p: any, proj: any) => this.onProjectileHitPlayer(proj),
      undefined,
      this,
    );

    // Stagger first shot so turrets don't all fire at once
    this.fireTimer = Phaser.Math.Between(0, 1500);

    // Use the base AI state machine
    this.useBaseAI = true;
    this.aiState = 'IDLE'; // Stationary, starts idle
    this.detectionRange = 500;
    this.attackRange = 500; // Same as detection — fires as soon as it sees the player
    this.desperateMode = true; // Fires faster when low health
    this.fleeThreshold = 0.2;
  }

  protected onPatrol(_delta: number): void {
    // Stationary — just face the player slowly
    this.setFlipX(this.player.x < this.x);
    this.facingDirection = this.player.x > this.x ? 1 : -1;
  }

  protected onAlert(_delta: number, _player: Phaser.GameObjects.Sprite): void {
    // Track player — turret goes straight to attack since attackRange = detectionRange
    this.setFlipX(this.player.x < this.x);
    this.facingDirection = this.player.x > this.x ? 1 : -1;
  }

  protected onAttack(delta: number, _player: Phaser.GameObjects.Sprite): void {
    // Face the player
    this.setFlipX(this.player.x < this.x);
    this.facingDirection = this.player.x > this.x ? 1 : -1;

    // Desperate mode: fire 50% faster
    const fireInterval = (this.desperateMode && this.health <= this.maxHealth * this.fleeThreshold)
      ? this.baseFiringInterval * 0.5
      : this.baseFiringInterval;

    // Fire on interval
    this.fireTimer += delta;
    if (this.fireTimer >= fireInterval) {
      this.fireTimer = 0;
      this.fireProjectile();
    }
  }

  private fireProjectile() {
    // Brief attack startup for stun vulnerability
    this.isInAttackStartup = true;

    // Create a small rectangle projectile
    const proj = this.scene.add.rectangle(this.x, this.y, 10, 6, 0xff3300);
    this.scene.physics.add.existing(proj);
    this.projectiles.add(proj);

    const projBody = proj.body as Phaser.Physics.Arcade.Body;
    projBody.setAllowGravity(false);

    // Aim at player's current position
    this.scene.physics.moveToObject(proj, this.player, this.PROJECTILE_SPEED);

    // End attack startup after brief window
    this.scene.time.delayedCall(100, () => {
      this.isInAttackStartup = false;
    });

    // Despawn after lifetime
    this.scene.time.delayedCall(this.PROJECTILE_LIFETIME, () => {
      if (proj.active) {
        proj.destroy();
      }
    });
  }

  private onProjectileHitPlayer(proj: any) {
    if ((this.player as any).isInvincible) return;

    (this.player as any).takeDamage(this.damage);

    EventBus.emit("health-change", {
      health: (this.player as any).health,
      maxHealth: (this.player as any).maxHealth,
    });

    // Knockback player away from projectile
    const direction = (this.player as any).x > proj.x ? 1 : -1;
    (this.player as any).setVelocityX(COMBAT.KNOCKBACK_PLAYER.x * direction);
    (this.player as any).setVelocityY(COMBAT.KNOCKBACK_PLAYER.y);

    // Destroy projectile on hit
    proj.destroy();
  }

  protected die() {
    // Clean up projectiles and collider when turret dies
    this.projectileCollider.destroy();
    this.projectiles.clear(true, true);
    super.die();
  }
}

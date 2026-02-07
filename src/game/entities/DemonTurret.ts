import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { Player } from "./Player";
import { COMBAT } from "../config/GameConfig";
import { EventBus } from "../systems/EventBus";

export class DemonTurret extends Enemy {
  private fireTimer: number = 0;
  private readonly FIRE_INTERVAL = 3000;
  private readonly PROJECTILE_SPEED = 250;
  private readonly PROJECTILE_LIFETIME = 3000;
  private projectiles: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
    super(scene, x, y, "dude", player, 5, 1, 0); // 5 HP, 1 Dmg, 0 Speed (stationary)
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
    scene.physics.add.overlap(
      player,
      this.projectiles,
      (_p: any, proj: any) => this.onProjectileHitPlayer(proj),
      undefined,
      this,
    );

    // Stagger first shot so turrets don't all fire at once
    this.fireTimer = Phaser.Math.Between(0, 1500);
  }

  update(time: number, delta: number) {
    super.update(time, delta);
    if (this.isDead) return;

    // Face the player
    this.setFlipX(this.player.x < this.x);

    // Fire on interval
    this.fireTimer += delta;
    if (this.fireTimer >= this.FIRE_INTERVAL) {
      this.fireTimer = 0;
      this.fireProjectile();
    }
  }

  private fireProjectile() {
    // Create a small rectangle projectile
    const proj = this.scene.add.rectangle(this.x, this.y, 10, 6, 0xff3300);
    this.scene.physics.add.existing(proj);
    this.projectiles.add(proj);

    const projBody = proj.body as Phaser.Physics.Arcade.Body;
    projBody.setAllowGravity(false);

    // Aim at player's current position
    this.scene.physics.moveToObject(proj, this.player, this.PROJECTILE_SPEED);

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
    // Clean up projectiles when turret dies
    this.projectiles.clear(true, true);
    super.die();
  }
}

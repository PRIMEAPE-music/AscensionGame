import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { EventBus } from "./EventBus";

export class SacredGround {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Phaser.Physics.Arcade.Group;
  private circle: Phaser.GameObjects.Arc;
  private innerGlow: Phaser.GameObjects.Arc;
  private lifetime: number = 5000; // 5 seconds
  private elapsed: number = 0;
  private healTimer: number = 0;
  private hasHealed: boolean = false;
  private centerX: number;
  private centerY: number;
  private readonly RADIUS = 150;
  private readonly HEAL_THRESHOLD = 3000; // 3 seconds to heal
  private readonly ENEMY_DAMAGE_INTERVAL = 1000; // 1 second between damage ticks
  private enemyDamageTimer: number = 0;
  private destroyed: boolean = false;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    enemies: Phaser.Physics.Arcade.Group,
    x: number,
    y: number,
  ) {
    this.scene = scene;
    this.player = player;
    this.enemies = enemies;
    this.centerX = x;
    this.centerY = y;

    // Outer circle (golden/white glow)
    this.circle = scene.add.circle(x, y, this.RADIUS, 0xffdd44, 0.15);
    this.circle.setStrokeStyle(2, 0xffffaa, 0.6);
    this.circle.setDepth(0);

    // Inner glow
    this.innerGlow = scene.add.circle(x, y, this.RADIUS * 0.6, 0xffffff, 0.08);
    this.innerGlow.setDepth(0);

    // Entry pulse animation
    scene.tweens.add({
      targets: this.circle,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    scene.tweens.add({
      targets: this.innerGlow,
      alpha: 0.15,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private isPlayerInRange(): boolean {
    const dx = this.player.x - this.centerX;
    const dy = this.player.y - this.centerY;
    return Math.sqrt(dx * dx + dy * dy) <= this.RADIUS;
  }

  private isEnemyInRange(enemy: Enemy): boolean {
    const dx = enemy.x - this.centerX;
    const dy = enemy.y - this.centerY;
    return Math.sqrt(dx * dx + dy * dy) <= this.RADIUS;
  }

  update(delta: number): boolean {
    if (this.destroyed) return true;

    this.elapsed += delta;

    // Fade out as it expires
    const remaining = Math.max(0, this.lifetime - this.elapsed);
    const fadeRatio = remaining / this.lifetime;
    this.circle.setAlpha(0.15 * fadeRatio);
    this.innerGlow.setAlpha(0.08 * fadeRatio);

    // Heal player if they stay in range for HEAL_THRESHOLD ms (once per circle)
    if (!this.hasHealed && this.isPlayerInRange()) {
      this.healTimer += delta;
      if (this.healTimer >= this.HEAL_THRESHOLD) {
        this.hasHealed = true;
        if (this.player.health < this.player.maxHealth) {
          this.player.health = Math.min(
            this.player.health + 1,
            this.player.maxHealth,
          );
          EventBus.emit("health-change", {
            health: this.player.health,
            maxHealth: this.player.maxHealth,
          });

          // Heal visual feedback
          const healText = this.scene.add.text(
            this.player.x,
            this.player.y - 40,
            "+1 HP",
            {
              fontSize: "18px",
              color: "#44ff44",
              stroke: "#000",
              strokeThickness: 3,
            },
          );
          this.scene.tweens.add({
            targets: healText,
            y: this.player.y - 90,
            alpha: 0,
            duration: 1000,
            onComplete: () => healText.destroy(),
          });
        }
      }
    } else if (!this.isPlayerInRange()) {
      // Reset heal timer when player leaves
      this.healTimer = 0;
    }

    // Damage enemies in range (10% maxHealth per second)
    this.enemyDamageTimer += delta;
    if (this.enemyDamageTimer >= this.ENEMY_DAMAGE_INTERVAL) {
      this.enemyDamageTimer -= this.ENEMY_DAMAGE_INTERVAL;

      this.enemies.children.each((child: Phaser.GameObjects.GameObject) => {
        if (!(child instanceof Enemy)) return true;
        if (!child.active) return true;

        if (this.isEnemyInRange(child)) {
          const damage = Math.max(1, Math.floor(child.maxHealth * 0.1));
          child.takeDamage(damage);

          // Check if enemy was killed
          if (!child.active) {
            EventBus.emit("enemy-killed", {
              enemyType: child.enemyType,
              x: child.x,
              y: child.y,
            });
          }
        }
        return true;
      });
    }

    // Self-destruct after lifetime
    if (this.elapsed >= this.lifetime) {
      this.destroy();
      return true; // Signal removal
    }

    return false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.tweens.killTweensOf(this.circle);
    this.scene.tweens.killTweensOf(this.innerGlow);
    this.circle.destroy();
    this.innerGlow.destroy();
  }
}

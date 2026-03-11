import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { ItemDrop } from "../entities/ItemDrop";
import { COMBAT } from "../config/GameConfig";
import { EventBus } from "./EventBus";
import { COMBAT_CONFIG } from "./CombatTypes";
import { DamageNumberManager } from "./DamageNumberManager";

export class CombatManager {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Phaser.Physics.Arcade.Group;
  private damageNumbers: DamageNumberManager | null = null;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    enemies: Phaser.Physics.Arcade.Group,
  ) {
    this.scene = scene;
    this.player = player;
    this.enemies = enemies;
  }

  setDamageNumberManager(manager: DamageNumberManager): void {
    this.damageNumbers = manager;
  }

  update(): void {
    if (!this.player.isAttacking || !this.player.attackHitbox) return;

    this.scene.physics.overlap(
      this.player.attackHitbox,
      this.enemies,
      (_hitbox: any, enemy: any) => this.handleAttackHit(enemy),
      undefined,
      this,
    );
  }

  private handleAttackHit(enemy: any): void {
    if (this.player.hitEnemies.has(enemy)) return;
    this.player.hitEnemies.add(enemy);

    if (!(enemy instanceof Enemy)) return;

    const classConfig = COMBAT_CONFIG[this.player.classType];
    const attackDef =
      this.player.currentAttackId && classConfig
        ? classConfig.attacks[this.player.currentAttackId]
        : null;

    const damage = this.calculateDamage(attackDef?.damageMultiplier ?? 1);

    // Check if the enemy is blocking from the front
    if (enemy.isBlocking) {
      const attackFromRight = this.player.x > enemy.x;
      const enemyFacingRight = enemy.facingDirection > 0;
      // Block succeeds if attack comes from the direction the enemy is facing
      if ((attackFromRight && enemyFacingRight) || (!attackFromRight && !enemyFacingRight)) {
        // Blocked — small knockback to player, no damage to enemy
        const blockDir = this.player.x > enemy.x ? 1 : -1;
        this.player.setVelocityX(COMBAT.KNOCKBACK_PLAYER.x * 0.5 * blockDir);
        return;
      }
    }

    // Capture position and type before takeDamage (which may destroy the enemy)
    const enemyX = enemy.x;
    const enemyY = enemy.y;
    const enemyType = enemy.enemyType;

    enemy.takeDamage(damage);

    // Hit feedback: damage numbers, screen shake, hit-stop
    const isHeavy = (attackDef?.damageMultiplier ?? 1) >= 1.5;
    this.damageNumbers?.show(enemyX, enemyY, damage, isHeavy);

    // Screen shake
    const shakeIntensity = isHeavy ? 0.005 : 0.002;
    const shakeDuration = isHeavy ? 80 : 50;
    this.scene.cameras.main.shake(shakeDuration, shakeIntensity);

    // Hit-stop (brief time scale dip)
    this.scene.time.timeScale = 0.1;
    this.scene.time.delayedCall(40, () => {
      this.scene.time.timeScale = 1;
    });

    // Enemy may have been destroyed by takeDamage — check before accessing
    if (!enemy.active) {
      EventBus.emit("enemy-killed", {
        enemyType,
        x: enemyX,
        y: enemyY,
      });
      return;
    }

    // Knockback (only if enemy survived)
    const direction = enemyX > this.player.x ? 1 : -1;
    const kb = attackDef?.knockback ?? COMBAT.KNOCKBACK_ENEMY;
    enemy.setVelocityX(kb.x * direction);
    enemy.setVelocityY(kb.y);

    // Hit flash feedback
    this.scene.time.delayedCall(COMBAT.HIT_FLASH_DURATION, () => {
      if (enemy.active) enemy.clearTint();
    });
  }

  handleContactDamage(_player: any, enemy: any): void {
    if (!(enemy instanceof Enemy)) return;
    if (this.player.isDodgeActive) return;
    if (this.player.isInvincible) return;

    this.player.takeDamage(1);

    EventBus.emit("health-change", {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
    });

    // Knockback player away from enemy
    const direction = this.player.x > enemy.x ? 1 : -1;
    this.player.setVelocityX(COMBAT.KNOCKBACK_PLAYER.x * direction);
    this.player.setVelocityY(COMBAT.KNOCKBACK_PLAYER.y);
  }

  handleItemCollision(_player: any, item: any): void {
    if (item instanceof ItemDrop) {
      this.player.collectItem(item.itemData);
      item.destroy();
    }
  }

  private calculateDamage(multiplier: number): number {
    const baseDamage = COMBAT.BASE_DAMAGE;
    const classMult = this.player.classStats.attackDamage;
    const itemMod = this.player.statModifiers.get("attackDamage") ?? 0;
    const dodgeBuff = this.player.perfectDodgeBuff ? 1.5 : 1;
    return Math.round(baseDamage * multiplier * classMult * (1 + itemMod) * dodgeBuff);
  }
}

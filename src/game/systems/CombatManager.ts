import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { ItemDrop } from "../entities/ItemDrop";
import { COMBAT } from "../config/GameConfig";
import { EventBus } from "./EventBus";
import { COMBAT_CONFIG } from "./CombatTypes";

export class CombatManager {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    enemies: Phaser.Physics.Arcade.Group,
  ) {
    this.scene = scene;
    this.player = player;
    this.enemies = enemies;
  }

  update(): void {
    if (this.player.isAttacking && this.player.attackHitbox) {
      this.scene.physics.overlap(
        this.player.attackHitbox,
        this.enemies,
        (_hitbox: any, enemy: any) => this.handleAttackHit(enemy),
        undefined,
        this,
      );
    }
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

    // Capture position before takeDamage (which may destroy the enemy)
    const enemyX = enemy.x;
    const enemyY = enemy.y;

    enemy.takeDamage(damage);

    // Enemy may have been destroyed by takeDamage — check before accessing
    if (!enemy.active) {
      EventBus.emit("enemy-killed", {
        enemyType: "unknown",
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

    // Hit-stop feedback
    this.scene.time.delayedCall(COMBAT.HIT_FLASH_DURATION, () => {
      if (enemy.active) enemy.clearTint();
    });
  }

  handleContactDamage(_player: any, enemy: any): void {
    if (!(enemy instanceof Enemy)) return;
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
    return Math.round(baseDamage * multiplier * classMult * (1 + itemMod));
  }
}

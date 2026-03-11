import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { ItemDrop } from "../entities/ItemDrop";
import { COMBAT } from "../config/GameConfig";
import { EventBus } from "./EventBus";
import { COMBAT_CONFIG } from "./CombatTypes";
import { DamageNumberManager } from "./DamageNumberManager";
import { PersistentStats } from "./PersistentStats";

export class CombatManager {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Phaser.Physics.Arcade.Group;
  private damageNumbers: DamageNumberManager | null = null;

  // Combo tracking
  private comboCount: number = 0;
  private comboTimer: number = 0;
  private readonly COMBO_TIMEOUT = 3000; // 3 seconds to chain next hit

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

  update(delta: number): void {
    // Combo timeout
    if (this.comboCount > 0) {
      this.comboTimer -= delta;
    }
    if (this.comboTimer <= 0 && this.comboCount > 0) {
      // Combo ended — award style points based on length
      if (this.comboCount >= 3) {
        EventBus.emit("combo-end", { finalCount: this.comboCount });
      }
      this.comboCount = 0;
      EventBus.emit("combo-update", { count: 0, multiplier: 1.0, timer: 0 });
    }

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

    // Apply combo multiplier to damage
    const comboMultiplier = 1.0 + Math.min(0.3, this.comboCount * 0.1);
    const damage = this.calculateDamage((attackDef?.damageMultiplier ?? 1) * comboMultiplier);

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
    PersistentStats.addDamageDealt(damage);

    // Increment combo
    this.comboCount++;
    this.comboTimer = this.COMBO_TIMEOUT;
    const newComboMultiplier = 1.0 + Math.min(0.3, this.comboCount * 0.1);
    EventBus.emit("combo-update", {
      count: this.comboCount,
      multiplier: newComboMultiplier,
      timer: this.comboTimer,
    });

    // Monk flow state: increment flow on successful hit
    this.player.onSuccessfulHit();

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

    this.player.takeDamage(1, enemy.x);

    // Reset combo on taking damage
    this.comboCount = 0;
    this.comboTimer = 0;
    EventBus.emit("combo-update", { count: 0, multiplier: 1.0, timer: 0 });

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

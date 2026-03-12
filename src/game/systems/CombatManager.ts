import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { ItemDrop } from "../entities/ItemDrop";
import { COMBAT } from "../config/GameConfig";
import { ITEMS } from "../config/ItemDatabase";
import type { ItemData } from "../config/ItemConfig";
import { EventBus } from "./EventBus";
import { COMBAT_CONFIG } from "./CombatTypes";
import { DamageNumberManager } from "./DamageNumberManager";
import { ParticleManager } from "./ParticleManager";
import { PersistentStats } from "./PersistentStats";
import { GameSettings } from "./GameSettings";
import { ComboManager } from "./ComboManager";
import { CoopManager } from "./CoopManager";

export class CombatManager {
  private scene: Phaser.Scene;
  private players: Player[];
  private enemies: Phaser.Physics.Arcade.Group;
  private damageNumbers: DamageNumberManager | null = null;
  private particleManager: ParticleManager | null = null;

  // Backwards-compat getter: primary player
  private get player(): Player {
    return this.players[0];
  }

  constructor(
    scene: Phaser.Scene,
    player: Player | Player[],
    enemies: Phaser.Physics.Arcade.Group,
  ) {
    this.scene = scene;
    this.players = Array.isArray(player) ? player : [player];
    this.enemies = enemies;
  }

  setDamageNumberManager(manager: DamageNumberManager): void {
    this.damageNumbers = manager;
  }

  setParticleManager(manager: ParticleManager): void {
    this.particleManager = manager;
  }

  update(delta: number): void {
    // Tick combo idle timer (handles timeout + events internally)
    ComboManager.update(delta);

    // Check attack hitboxes for all players
    for (const p of this.players) {
      if (!p.isAttacking || !p.attackHitbox) continue;

      this.scene.physics.overlap(
        p.attackHitbox,
        this.enemies,
        (_hitbox: any, enemy: any) => this.handleAttackHit(enemy, p),
        undefined,
        this,
      );
    }
  }

  private handleAttackHit(enemy: any, attackingPlayer: Player): void {
    if (attackingPlayer.hitEnemies.has(enemy)) return;

    // Piercing Attacks ability: don't add to hitEnemies, allowing attack to hit all enemies in range
    if (!attackingPlayer.abilities.has('piercing_attacks')) {
      attackingPlayer.hitEnemies.add(enemy);
    } else {
      // Still track to avoid hitting the same enemy twice per swing
      attackingPlayer.hitEnemies.add(enemy);
    }

    if (!(enemy instanceof Enemy)) return;

    const classConfig = COMBAT_CONFIG[attackingPlayer.classType];
    const attackDef =
      attackingPlayer.currentAttackId && classConfig
        ? classConfig.attacks[attackingPlayer.currentAttackId]
        : null;

    // Apply combo multiplier to damage
    const comboMultiplier = ComboManager.getMultiplier();
    let damage = this.calculateDamage((attackDef?.damageMultiplier ?? 1) * comboMultiplier, attackingPlayer);

    // Critical Strike ability: chance for 2x damage
    if (attackingPlayer.abilities.has('critical_strike')) {
      const critChance = attackingPlayer.stackedAbilities.has('critical_strike') ? 0.35 : 0.20;
      if (Math.random() < critChance) {
        damage = Math.round(damage * 2);
      }
    }

    // Berserker Rage ability: bonus damage when at low health
    if (attackingPlayer.abilities.has('berserker_rage') && attackingPlayer.health === 1) {
      const rageMult = attackingPlayer.stackedAbilities.has('berserker_rage') ? 2.0 : 1.5;
      damage = Math.round(damage * rageMult);
    }

    // Piercing Attacks stacked: +25% damage bonus
    if (attackingPlayer.stackedAbilities.has('piercing_attacks')) {
      damage = Math.round(damage * 1.25);
    }

    // Cursed: Berserker's Rage — +10% damage per missing HP
    if (attackingPlayer.curses.has('berserkers_rage')) {
      const missingHP = attackingPlayer.maxHealth - attackingPlayer.health;
      if (missingHP > 0) {
        damage = Math.round(damage * (1 + missingHP * 0.10));
      }
    }

    // Cursed: Chaos Orb — random bonus effect on each attack
    if (attackingPlayer.curses.has('chaos_orb')) {
      const chaosRoll = Math.random();
      if (chaosRoll < 0.25) {
        damage = Math.round(damage * 1.5); // 25%: +50% damage
      } else if (chaosRoll < 0.50) {
        damage = Math.round(damage * 2.0); // 25%: double damage
      }
      // 50%: no bonus
    }

    // Subclass: Crusader smite — 15% chance for 2x damage holy burst
    damage = Math.round(damage * attackingPlayer.getCrusaderSmiteDamageMultiplier());

    // Subclass: Iron Fist — consecutive hits deal +10% more (stacking)
    damage = Math.round(damage * attackingPlayer.getIronFistDamageMultiplier());

    // Subclass: Shadow Dancer — +30% crit chance from stealth
    const shadowCritBonus = attackingPlayer.getShadowDancerCritBonus();
    if (shadowCritBonus > 0 && Math.random() < shadowCritBonus) {
      damage = Math.round(damage * 2);
    }

    // Check if the enemy is blocking from the front
    if (enemy.isBlocking) {
      const attackFromRight = attackingPlayer.x > enemy.x;
      const enemyFacingRight = enemy.facingDirection > 0;
      // Block succeeds if attack comes from the direction the enemy is facing
      if ((attackFromRight && enemyFacingRight) || (!attackFromRight && !enemyFacingRight)) {
        // Blocked — small knockback to player, no damage to enemy
        const blockDir = attackingPlayer.x > enemy.x ? 1 : -1;
        attackingPlayer.setVelocityX(COMBAT.KNOCKBACK_PLAYER.x * 0.5 * blockDir);
        return;
      }
    }

    // Capture position and type before takeDamage (which may destroy the enemy)
    const enemyX = enemy.x;
    const enemyY = enemy.y;
    const enemyType = enemy.enemyType;
    const wasElite = enemy.isElite;
    const enemyAffixes = [...enemy.eliteAffixes];

    // Subclass: Inquisitor smite — instant kill enemies below 20% HP
    if (attackingPlayer.shouldInquisitorSmite(enemy.health, enemy.maxHealth)) {
      // Force damage to kill the enemy
      damage = enemy.health + 10;
      // Show "SMITE" text
      const smiteText = this.scene.add.text(enemyX, enemyY - 30, 'SMITE!', {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#ffffaa',
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold',
      });
      smiteText.setOrigin(0.5);
      smiteText.setDepth(101);
      this.scene.tweens.add({
        targets: smiteText,
        y: enemyY - 70,
        alpha: 0,
        scale: 1.3,
        duration: 600,
        ease: 'Power2',
        onComplete: () => smiteText.destroy(),
      });
    }

    // ── Finishing Move check ─────────────────────────────────────────────
    // If enemy is alive and below 15% max HP, trigger a finishing move
    const isFinishingMove =
      enemy.health > 0 && enemy.health <= enemy.maxHealth * 0.15;

    if (isFinishingMove) {
      this.executeFinishingMove(enemy, enemyX, enemyY, enemyType, attackingPlayer, wasElite, enemyAffixes);
      return;
    }

    // Pass attacker X position for SHIELDED affix directional check
    enemy.takeDamage(damage, attackingPlayer.x);
    PersistentStats.addDamageDealt(damage);

    // Cursed: Echo Strike — every attack hits twice (second hit at 75% damage)
    if (attackingPlayer.curses.has('echo_strike') && enemy.active) {
      const echoDamage = Math.max(1, Math.round(damage * 0.75));
      this.scene.time.delayedCall(100, () => {
        if (enemy.active) {
          enemy.takeDamage(echoDamage, attackingPlayer.x);
          PersistentStats.addDamageDealt(echoDamage);
          this.damageNumbers?.show(enemyX + 10, enemyY - 10, echoDamage, false);
        }
      });
    }

    // Increment combo (1 per hit)
    ComboManager.increment(1);

    // Monk flow state: increment flow on successful hit
    attackingPlayer.onSuccessfulHit();

    // Synergy: Arsenal — chain attack to a nearby enemy for 30% damage
    attackingPlayer.applyArsenalChain(enemyX, enemyY);

    // Hit feedback: damage numbers, screen shake, hit-stop
    const isHeavy = (attackDef?.damageMultiplier ?? 1) >= 1.5;
    this.damageNumbers?.show(enemyX, enemyY, damage, isHeavy);

    // Screen shake (respects intensity setting and flash reduction)
    const settings = GameSettings.get();
    const shakeLevel = settings.screenShakeIntensity;
    if (shakeLevel !== 'OFF') {
      const intensityMultiplier = shakeLevel === 'LOW' ? 0.4 : shakeLevel === 'MEDIUM' ? 1.0 : 1.5;
      const flashReduce = settings.flashReduction;
      const baseIntensity = (isHeavy ? 0.005 : 0.002) * (flashReduce ? 0.3 : 1);
      const baseDuration = (isHeavy ? 80 : 50) * (flashReduce ? 0.5 : 1);
      this.scene.cameras.main.shake(
        baseDuration * intensityMultiplier,
        baseIntensity * intensityMultiplier,
      );
    }

    // Hit-stop (brief time scale dip)
    this.scene.time.timeScale = 0.1;
    this.scene.time.delayedCall(40, () => {
      this.scene.time.timeScale = 1;
    });

    // Enemy may have been destroyed by takeDamage — check before accessing
    if (!enemy.active) {
      // Bonus combo for kills (+5)
      ComboManager.increment(5);
      EventBus.emit("enemy-killed", {
        enemyType,
        x: enemyX,
        y: enemyY,
        isElite: wasElite,
        affixes: enemyAffixes,
      });
      if (wasElite && enemyAffixes.length > 0) {
        EventBus.emit("elite-killed", { affixes: enemyAffixes });
      }
      return;
    }

    // Knockback (only if enemy survived — bosses are immune to prevent falling through platforms)
    if (enemy.enemyType !== 'boss') {
      const direction = enemyX > attackingPlayer.x ? 1 : -1;
      const kb = attackDef?.knockback ?? COMBAT.KNOCKBACK_ENEMY;
      const kbMult = attackingPlayer.abilities.has('mega_knockback') ? 1.5 : 1.0;
      enemy.setVelocityX(kb.x * direction * kbMult);
      enemy.setVelocityY(kb.y * kbMult);
    }

    // Hit flash feedback: white flash first, then red flash, then clear
    enemy.setTint(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (enemy.active) {
        enemy.setTint(0xff4444);
        this.scene.time.delayedCall(100, () => {
          if (enemy.active) {
            enemy.clearTint();
            // Re-apply elite tint if needed
            if (enemy.isElite) {
              // Affix elites use reddish-purple, legacy elites use silver
              const eliteTint = enemy.eliteAffixes.length > 0 ? 0xff4466 : 0xccccff;
              enemy.setTint(eliteTint);
            }
          }
        });
      }
    });

    // Hit impact particles
    if (this.particleManager) {
      this.particleManager.emitHitImpact(enemyX, enemyY, isHeavy);
    }

    // Knockback squash/stretch visual effect
    this.scene.tweens.add({
      targets: enemy,
      scaleX: 1.2,
      scaleY: 0.8,
      duration: 80,
      yoyo: true,
      ease: 'Power2',
    });
  }

  // ── Finishing Move ──────────────────────────────────────────────────────
  /**
   * Executes a finishing move on an enemy below 15% HP.
   * Instant kill with dissolve effect, particle burst, bonus combo,
   * brief invincibility, and bonus essence.
   */
  private executeFinishingMove(
    enemy: Enemy,
    enemyX: number,
    enemyY: number,
    enemyType: string,
    attackingPlayer: Player,
    wasElite: boolean = false,
    enemyAffixes: string[] = [],
  ): void {
    const remainingHP = enemy.health;
    PersistentStats.addDamageDealt(remainingHP);

    // Monk flow state: count the finishing blow as a successful hit
    attackingPlayer.onSuccessfulHit();

    // ── Kill the enemy immediately ──
    // We set health to 0 and call takeDamage(remaining) so Enemy.die() runs normally
    enemy.takeDamage(remainingHP);

    // ── Combo bonus: +5 for finishing move + 1 for the hit itself ──
    ComboManager.increment(1);
    ComboManager.increment(5);

    // ── Camera shake (finishing-move intensity) ──
    const settings = GameSettings.get();
    const shakeLevel = settings.screenShakeIntensity;
    if (shakeLevel !== 'OFF') {
      const intensityMult = shakeLevel === 'LOW' ? 0.4 : shakeLevel === 'MEDIUM' ? 1.0 : 1.5;
      const flashReduce = settings.flashReduction;
      const intensity = 0.005 * (flashReduce ? 0.3 : 1) * intensityMult;
      this.scene.cameras.main.shake(100 * intensityMult, intensity);
    }

    // ── Hit-stop (slightly longer for dramatic effect) ──
    this.scene.time.timeScale = 0.05;
    this.scene.time.delayedCall(60, () => {
      this.scene.time.timeScale = 1;
    });

    // ── Brief invincibility during the "animation" ──
    attackingPlayer.makeInvincible(200);

    // ── Dissolve effect: enemy fades + scales down rapidly ──
    // Create a ghost sprite at enemy position so the dissolve is visible
    // even after the enemy game object is destroyed
    this.spawnDissolveEffect(enemyX, enemyY);

    // ── Essence-colored particle burst flying toward player ──
    this.spawnFinishingParticles(enemyX, enemyY, attackingPlayer);

    // ── Damage number: show "FINISH" ──
    this.damageNumbers?.show(enemyX, enemyY - 10, remainingHP, true);

    // ── Emit events ──
    EventBus.emit("enemy-killed", {
      enemyType,
      x: enemyX,
      y: enemyY,
      finishingMove: true,
      isElite: wasElite,
      affixes: enemyAffixes,
    });

    if (wasElite && enemyAffixes.length > 0) {
      EventBus.emit("elite-killed", { affixes: enemyAffixes });
    }

    EventBus.emit("finishing-move", {
      x: enemyX,
      y: enemyY,
    });
  }

  /**
   * Spawns a dissolving ghost rectangle at the enemy position that
   * fades out and scales down over 200ms.
   */
  private spawnDissolveEffect(x: number, y: number): void {
    const ghost = this.scene.add.rectangle(x, y, 24, 24, 0xffffff);
    ghost.setAlpha(0.8);
    ghost.setDepth(3);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: 0.1,
      scaleY: 0.1,
      duration: 200,
      ease: 'Power2',
      onComplete: () => ghost.destroy(),
    });
  }

  /**
   * Spawns 10 gold/yellow particles at the enemy position that fly
   * toward the attacking player over 500ms and then self-destruct.
   */
  private spawnFinishingParticles(
    enemyX: number,
    enemyY: number,
    player: Player,
  ): void {
    const particleCount = 10;
    const colors = [0xffd700, 0xffcc00, 0xffaa00, 0xffe066];

    for (let i = 0; i < particleCount; i++) {
      const color = colors[i % colors.length];
      const size = 3 + Math.random() * 3;
      const particle = this.scene.add.rectangle(
        enemyX + (Math.random() - 0.5) * 30,
        enemyY + (Math.random() - 0.5) * 30,
        size,
        size,
        color,
      );
      particle.setAlpha(0.9);
      particle.setDepth(4);

      // Scatter outward briefly, then converge on the player
      const scatterX = enemyX + (Math.random() - 0.5) * 60;
      const scatterY = enemyY + (Math.random() - 0.5) * 60;
      const delay = i * 30;

      // Phase 1: scatter outward
      this.scene.tweens.add({
        targets: particle,
        x: scatterX,
        y: scatterY,
        duration: 120,
        delay,
        ease: 'Power1',
        onComplete: () => {
          // Phase 2: fly toward player
          this.scene.tweens.add({
            targets: particle,
            x: player.x,
            y: player.y,
            alpha: 0,
            scaleX: 0.3,
            scaleY: 0.3,
            duration: 380,
            ease: 'Power2',
            onComplete: () => particle.destroy(),
          });
        },
      });
    }
  }

  handleContactDamage(playerObj: any, enemy: any): void {
    if (!(enemy instanceof Enemy)) return;
    const p = playerObj as Player;
    if (p.isDodgeActive) return;
    if (p.isInvincible) return;

    const parried = p.takeDamage(1, enemy.x, enemy);

    // If parried, show parry damage number on the enemy and skip knockback/combo reset
    if (parried) {
      return;
    }

    // Notify the enemy it dealt damage (triggers VAMPIRIC heal, FREEZING slow, etc.)
    if (enemy.active) {
      enemy.onDealtDamageToPlayer(1, p);
    }

    // Damage Reflection ability: reflect 30% of damage back to the attacker
    if (p.abilities.has('damage_reflect') && enemy.active) {
      const reflectDamage = Math.max(1, Math.round(1 * 0.3));
      enemy.takeDamage(reflectDamage);
    }

    // Reset combo on taking damage
    ComboManager.reset();

    EventBus.emit("health-change", {
      health: p.health,
      maxHealth: p.maxHealth,
    });

    // Knockback player away from enemy
    const direction = p.x > enemy.x ? 1 : -1;
    p.setVelocityX(COMBAT.KNOCKBACK_PLAYER.x * direction);
    p.setVelocityY(COMBAT.KNOCKBACK_PLAYER.y);
  }

  handleItemCollision(playerObj: any, item: any): void {
    if (item instanceof ItemDrop) {
      const p = playerObj as Player;

      // Co-op item drafting: when co-op is active, trigger draft UI instead of direct pickup
      if (CoopManager.isActive() && this.players.length >= 2) {
        // Generate 3 items for the draft (the picked-up item + 2 more random ones)
        const draftItems: ItemData[] = [item.itemData];
        const allItems = Object.values(ITEMS) as ItemData[];
        const eligibleItems = allItems.filter(
          (i: ItemData) =>
            i.id !== item.itemData.id &&
            (i.type === 'SILVER' || i.type === 'GOLD') &&
            (!i.coopOnly || CoopManager.isActive())
        );
        // Pick 2 more random items
        const shuffled = [...eligibleItems].sort(() => Math.random() - 0.5);
        for (let idx = 0; idx < Math.min(2, shuffled.length); idx++) {
          draftItems.push(shuffled[idx]);
        }

        item.destroy();
        // Pause the scene and emit draft event
        this.scene.scene.pause();
        EventBus.emit("coop-item-draft", { items: draftItems });
        return;
      }

      p.collectItem(item.itemData);
      item.destroy();
    }
  }

  private calculateDamage(multiplier: number, attackingPlayer: Player): number {
    const baseDamage = COMBAT.BASE_DAMAGE;
    const classMult = attackingPlayer.classStats.attackDamage;
    const itemMod = attackingPlayer.statModifiers.get("attackDamage") ?? 0;
    const dodgeBuff = attackingPlayer.perfectDodgeBuff ? 1.5 : 1;
    // Battle Bond: +15% damage when both co-op players are within 200px of each other
    const battleBondMult = CoopManager.getBattleBondMultiplier(attackingPlayer);
    return Math.round(baseDamage * multiplier * classMult * (1 + itemMod) * dodgeBuff * battleBondMult);
  }
}

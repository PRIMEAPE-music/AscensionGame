import Phaser from "phaser";
import { ClassType, type ClassStats, CLASSES } from "../config/ClassConfig";
import type { ItemData, StatType } from "../config/ItemConfig";
import { PHYSICS, COMBAT } from "../config/GameConfig";
import { EventBus } from "../systems/EventBus";
import {
  AttackType,
  AttackDirection,
  type AttackDefinition,
  COMBAT_CONFIG,
} from "../systems/CombatTypes";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Combat Keys
  private attackBKey!: Phaser.Input.Keyboard.Key;
  private attackXKey!: Phaser.Input.Keyboard.Key;
  private attackYKey!: Phaser.Input.Keyboard.Key;

  // Combat State
  public isAttacking: boolean = false;
  public currentAttackId: string | null = null;
  private comboTimer: number = 0;
  private attackState: "IDLE" | "STARTUP" | "ACTIVE" | "RECOVERY" = "IDLE";
  private attackTimer: number = 0;

  private isWallSliding: boolean = false;
  public attackHitbox: Phaser.GameObjects.Rectangle | null = null;
  public hitEnemies: Set<any> = new Set();
  private isJumping: boolean = false;
  private jumpTimer: number = 0;
  private coyoteTimer: number = 0;
  private jumpBufferTimer: number = 0;
  private jumpJustPressed: boolean = false;

  // Double Jump State
  private canDoubleJump: boolean = false;
  private hasDoubleJumped: boolean = false;

  // Invincibility
  private invincibilityTimer: number = 0;
  private flashTimer: number = 0;

  // Stats & Inventory
  public health: number;
  public maxHealth: number;
  public classType: ClassType;
  public classStats: ClassStats;
  public inventory: ItemData[] = [];
  public abilities: Set<string> = new Set();
  public statModifiers: Map<StatType, number> = new Map();

  get isInvincible(): boolean {
    return this.invincibilityTimer > 0;
  }

  private get onGround(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.touching.down || body.blocked.down;
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    classType: ClassType = ClassType.MONK,
  ) {
    super(scene, x, y, "dude");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.classType = classType;
    this.classStats = CLASSES[classType];
    this.maxHealth = this.classStats.health;
    this.health = this.maxHealth;
    this.setTint(this.classStats.color);

    this.setCollideWorldBounds(false);
    // Scene already applies PHYSICS.GRAVITY globally — don't double it
    this.setBounce(0);

    this.initInput();
  }

  private initInput() {
    this.cursors = this.scene.input.keyboard!.createCursorKeys();
    this.attackBKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.Z,
    );
    this.attackXKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.X,
    );
    this.attackYKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.C,
    );
  }

  private getStat(
    stat: StatType,
    baseValue: number,
    classMultiplier: number,
  ): number {
    const modifier = this.statModifiers.get(stat) || 0;
    return baseValue * classMultiplier * (1 + modifier);
  }

  update(time: number, delta: number) {
    // Cache JustDown once per frame — Phaser consumes it on first read
    this.jumpJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.space!);

    this.updateTimers(delta);
    this.handleMovement();
    this.handleJumping(delta);
    this.handleWallInteraction();
    this.handleCombat(delta);
    this.updateInvincibility(delta);
  }

  private updateTimers(delta: number) {
    if (this.onGround) {
      this.coyoteTimer = PHYSICS.COYOTE_TIME;
    } else {
      this.coyoteTimer -= delta;
    }

    if (this.jumpJustPressed) {
      this.jumpBufferTimer = PHYSICS.JUMP_BUFFER;
    } else {
      this.jumpBufferTimer -= delta;
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.currentAttackId = null;
      }
    }
  }

  private updateInvincibility(delta: number) {
    if (this.invincibilityTimer <= 0) return;

    this.invincibilityTimer -= delta;
    this.flashTimer += delta;

    // Flash effect
    if (this.flashTimer >= COMBAT.INVINCIBILITY_FLASH_RATE) {
      this.flashTimer = 0;
      this.setAlpha(this.alpha < 1 ? 1 : 0.3);
    }

    if (this.invincibilityTimer <= 0) {
      this.invincibilityTimer = 0;
      this.setAlpha(1);
      this.setTint(this.classStats.color);
    }
  }

  private handleMovement() {
    if (this.isAttacking && this.onGround && this.attackState !== "RECOVERY") {
      this.setAccelerationX(0);
      this.setVelocityX(0);
      return;
    }

    const { left, right } = this.cursors;
    const onGround = this.onGround;

    this.setDragX(onGround ? PHYSICS.GROUND_DRAG : PHYSICS.AIR_DRAG);

    const moveSpeed = this.getStat(
      "moveSpeed",
      PHYSICS.MOVE_SPEED,
      this.classStats.moveSpeed,
    );

    if (left.isDown) {
      this.setAccelerationX(-PHYSICS.ACCELERATION);
      this.setFlipX(true);
    } else if (right.isDown) {
      this.setAccelerationX(PHYSICS.ACCELERATION);
      this.setFlipX(false);
    } else {
      this.setAccelerationX(0);
    }

    if (this.body!.velocity.x > moveSpeed) {
      this.setVelocityX(moveSpeed);
    } else if (this.body!.velocity.x < -moveSpeed) {
      this.setVelocityX(-moveSpeed);
    }
  }

  private handleJumping(delta: number) {
    const canJump = this.coyoteTimer > 0;
    const wantsToJump = this.jumpBufferTimer > 0;
    const jumpForce = this.getStat(
      "jumpHeight",
      PHYSICS.JUMP_FORCE,
      this.classStats.jumpHeight,
    );

    // Reset double jump when on ground
    if (this.onGround) {
      this.canDoubleJump = true;
      this.hasDoubleJumped = false;
    }

    // Initial Jump (coyote + buffer)
    if (wantsToJump && canJump) {
      this.setVelocityY(jumpForce);
      this.isJumping = true;
      this.jumpTimer = 0;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }
    // Double Jump
    else if (
      this.jumpJustPressed &&
      !canJump &&
      this.canDoubleJump &&
      !this.hasDoubleJumped &&
      this.abilities.has("double_jump")
    ) {
      this.setVelocityY(jumpForce * PHYSICS.DOUBLE_JUMP_MULTIPLIER);
      this.hasDoubleJumped = true;
      this.isJumping = true;
      this.jumpTimer = 0;

      const particle = this.scene.add.circle(
        this.x,
        this.y + 20,
        10,
        0xffd700,
        0.8,
      );
      this.scene.tweens.add({
        targets: particle,
        scale: 2,
        alpha: 0,
        duration: 300,
        onComplete: () => particle.destroy(),
      });
    }

    // Variable jump height (hold button)
    if (this.isJumping && this.cursors.space?.isDown) {
      this.jumpTimer += delta;
      if (this.jumpTimer < PHYSICS.JUMP_HOLD_DURATION) {
        this.setVelocityY(this.body!.velocity.y + PHYSICS.JUMP_HOLD_FORCE);
      }
    }

    if (
      !this.cursors.space?.isDown ||
      this.jumpTimer >= PHYSICS.JUMP_HOLD_DURATION
    ) {
      this.isJumping = false;
    }
  }

  private handleWallInteraction() {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onWall =
      body.blocked.left ||
      body.blocked.right ||
      body.touching.left ||
      body.touching.right;
    const onGround = body.touching.down || body.blocked.down;

    if (onWall && !onGround) {
      this.isWallSliding = true;

      if (this.body!.velocity.y > 0) {
        this.setVelocityY(PHYSICS.WALL_SLIDE_SPEED);
      }

      if (this.jumpJustPressed) {
        const jumpDir = body.blocked.left || body.touching.left ? 1 : -1;
        const jumpForceY = this.getStat(
          "jumpHeight",
          PHYSICS.WALL_JUMP.y,
          this.classStats.jumpHeight,
        );

        this.setVelocityX(PHYSICS.WALL_JUMP.x * jumpDir);
        this.setVelocityY(jumpForceY);

        this.isWallSliding = false;
        this.isJumping = true;
        this.jumpTimer = 0;
        this.hasDoubleJumped = false;
        this.canDoubleJump = true;
      }
    } else {
      this.isWallSliding = false;
    }
  }

  private handleCombat(delta: number) {
    if (this.isAttacking) {
      this.attackTimer += delta;

      if (this.attackTimer > COMBAT.ATTACK_STUCK_TIMEOUT) {
        this.endAttack();
        return;
      }

      const attackDef =
        COMBAT_CONFIG[this.classType].attacks[this.currentAttackId!];

      if (!attackDef) {
        this.isAttacking = false;
        return;
      }

      if (this.attackState === "STARTUP") {
        if (this.attackTimer >= attackDef.startup) {
          this.enterActiveState(attackDef);
        }
      } else if (this.attackState === "ACTIVE") {
        if (this.attackHitbox) {
          const facingRight = !this.flipX;
          const offsetX = facingRight
            ? attackDef.hitbox.offsetX
            : -attackDef.hitbox.offsetX;
          this.attackHitbox.setPosition(
            this.x + offsetX,
            this.y + attackDef.hitbox.offsetY,
          );
        }

        if (this.attackTimer >= attackDef.startup + attackDef.hitbox.duration) {
          this.enterRecoveryState(attackDef);
        }
      } else if (this.attackState === "RECOVERY") {
        if (
          this.attackTimer >=
          attackDef.startup + attackDef.hitbox.duration + attackDef.recovery
        ) {
          this.endAttack();
        }
      }
    }

    const canAttack = !this.isAttacking || this.attackState === "RECOVERY";

    if (canAttack && !this.isWallSliding) {
      if (Phaser.Input.Keyboard.JustDown(this.attackBKey)) {
        this.tryAttack(AttackType.LIGHT);
      } else if (Phaser.Input.Keyboard.JustDown(this.attackXKey)) {
        this.tryAttack(AttackType.HEAVY);
      } else if (Phaser.Input.Keyboard.JustDown(this.attackYKey)) {
        this.tryAttack(AttackType.SPECIAL);
      }
    }
  }

  private tryAttack(type: AttackType) {
    let direction: AttackDirection = AttackDirection.NEUTRAL;
    if (this.cursors.up.isDown) direction = AttackDirection.UP;
    else if (this.cursors.down.isDown) direction = AttackDirection.DOWN;

    const config = COMBAT_CONFIG[this.classType];
    const onGround = this.onGround;

    let nextAttackId: string | undefined;

    if (this.currentAttackId && this.comboTimer > 0) {
      const comboNode = config.combos[this.currentAttackId];
      if (comboNode && comboNode.next[type]) {
        nextAttackId = comboNode.next[type];
      }
    }

    if (!nextAttackId) {
      const map = onGround ? config.groundAttacks : config.airAttacks;
      nextAttackId = map[type][direction];
    }

    if (nextAttackId) {
      this.startAttack(nextAttackId);
    }
  }

  private startAttack(attackId: string) {
    this.cleanupHitbox();
    this.isAttacking = true;
    this.currentAttackId = attackId;
    this.attackState = "STARTUP";
    this.attackTimer = 0;
    this.hitEnemies.clear();

    if (this.onGround) {
      this.setVelocityX(0);
    }

    const def = COMBAT_CONFIG[this.classType].attacks[attackId];
    if (def) this.setTint(def.color);
  }

  private enterActiveState(def: AttackDefinition) {
    this.attackState = "ACTIVE";

    const facingRight = !this.flipX;
    const offsetX = facingRight ? def.hitbox.offsetX : -def.hitbox.offsetX;

    this.attackHitbox = this.scene.add.rectangle(
      this.x + offsetX,
      this.y + def.hitbox.offsetY,
      def.hitbox.width,
      def.hitbox.height,
      0xff0000,
      0.3,
    );
    this.scene.physics.add.existing(this.attackHitbox);
    (this.attackHitbox.body as Phaser.Physics.Arcade.Body).setAllowGravity(
      false,
    );
  }

  private enterRecoveryState(_def: AttackDefinition) {
    this.attackState = "RECOVERY";
    this.cleanupHitbox();
  }

  private cleanupHitbox() {
    if (this.attackHitbox) {
      this.attackHitbox.destroy();
      this.attackHitbox = null;
    }
  }

  private endAttack() {
    this.isAttacking = false;
    this.attackState = "IDLE";
    this.cleanupHitbox();
    this.setTint(this.classStats.color);
    this.comboTimer = COMBAT.COMBO_WINDOW;
  }

  public takeDamage(amount: number) {
    if (this.isInvincible) return;

    this.health -= amount;

    // Start invincibility
    this.invincibilityTimer = COMBAT.INVINCIBILITY_DURATION;
    this.flashTimer = 0;
    this.setTint(0xff0000);

    EventBus.emit("health-change", {
      health: this.health,
      maxHealth: this.maxHealth,
    });

    if (this.health <= 0) {
      this.scene.scene.restart();
    }
  }

  public collectItem(item: ItemData) {
    this.inventory.push(item);

    if (item.effects) {
      item.effects.forEach((effect) => {
        if (effect.targetStat === "health") {
          this.maxHealth += effect.value;
          this.health += effect.value;
        } else {
          const current = this.statModifiers.get(effect.targetStat) || 0;
          this.statModifiers.set(effect.targetStat, current + effect.value);
        }
      });
    }

    if (item.abilityId) {
      this.abilities.add(item.abilityId);
    }

    const text = this.scene.add.text(this.x, this.y - 50, `+ ${item.name}`, {
      fontSize: "16px",
      color: "#ffff00",
      stroke: "#000",
      strokeThickness: 3,
    });
    this.scene.tweens.add({
      targets: text,
      y: this.y - 100,
      alpha: 0,
      duration: 1000,
      onComplete: () => text.destroy(),
    });

    EventBus.emit("inventory-change", { inventory: this.inventory });
  }
}

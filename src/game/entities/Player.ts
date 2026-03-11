import Phaser from "phaser";
import { ClassType, type ClassStats, CLASSES } from "../config/ClassConfig";
import type { ItemData, StatType } from "../config/ItemConfig";
import { PHYSICS, COMBAT, PLATFORM_CONFIG } from "../config/GameConfig";
import { PlatformType } from "../config/PlatformTypes";
import type { SlopeCollisionResult } from "../systems/SlopeManager";
import { EventBus } from "../systems/EventBus";
import {
  AttackType,
  AttackDirection,
  type AttackDefinition,
  COMBAT_CONFIG,
} from "../systems/CombatTypes";
import { SPRITE_CONFIG } from "../config/AnimationConfig";
import { PersistentStats } from "../systems/PersistentStats";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private static VALID_PLATFORM_TYPES = new Set(Object.values(PlatformType));

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Combat Keys
  private attackBKey!: Phaser.Input.Keyboard.Key;
  private attackXKey!: Phaser.Input.Keyboard.Key;
  private attackYKey!: Phaser.Input.Keyboard.Key;
  private dodgeKey!: Phaser.Input.Keyboard.Key;

  // Combat State
  public isAttacking: boolean = false;
  public currentAttackId: string | null = null;
  private comboTimer: number = 0;
  private attackState: "IDLE" | "STARTUP" | "ACTIVE" | "RECOVERY" = "IDLE";
  private attackTimer: number = 0;

  // Dodge State
  private isDodging: boolean = false;
  private dodgeCooldown: number = 0;
  private dodgeTimer: number = 0;
  public perfectDodgeBuff: boolean = false;
  private perfectDodgeBuffTimer: number = 0;
  private lastDamageAttemptTime: number = 0;
  private dodgeStartTime: number = 0;

  private readonly DODGE_DURATION = 200;
  private readonly DODGE_COOLDOWN = 300;
  private readonly DODGE_SPEED = 400;
  private readonly PERFECT_DODGE_WINDOW = 150;
  private readonly PERFECT_DODGE_BUFF_DURATION = 2000;

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

  // Drop-Through State
  private isDropping: boolean = false;
  private dropTimer: number = 0;
  private readonly DROP_DURATION = 500; // 0.5s

  // Animation State
  private currentAnim: string = "";
  private wasAirborne: boolean = false;
  private isLanding: boolean = false;

  // Invincibility
  private invincibilityTimer: number = 0;
  private flashTimer: number = 0;

  // Platform Surface
  public onSlope: boolean = false;
  public slopeAngle: number = 0;
  public currentPlatformType: PlatformType = PlatformType.STANDARD;
  private wasOnSlope: boolean = false;
  private pendingLaunchVector: { x: number; y: number } | null = null;

  // Stats & Inventory
  public health: number;
  public maxHealth: number;
  public classType: ClassType;
  public classStats: ClassStats;
  public inventory: ItemData[] = [];
  public abilities: Set<string> = new Set();
  public statModifiers: Map<StatType, number> = new Map();

  // === Paladin: Shield Guard ===
  private standStillTimer: number = 0;
  public isShieldGuarding: boolean = false;
  private shieldGuardPulseTimer: number = 0;
  private readonly SHIELD_GUARD_THRESHOLD = 500; // ms standing still to activate
  private readonly SHIELD_GUARD_DAMAGE_REDUCTION = 0.5;

  // === Monk: Flow State ===
  public flowMeter: number = 0;
  private flowDecayTimer: number = 0;
  private readonly FLOW_MAX = 100;
  private readonly FLOW_HIT_GAIN = 8;
  private readonly FLOW_DECAY_RATE = 5; // per second
  private readonly FLOW_DECAY_DELAY = 500; // ms before decay starts after attacking
  private flowMoveSpeedMod: number = 0;
  private flowJumpHeightMod: number = 0;
  private flowAttackDamageMod: number = 0;

  // === Priest: Sacred Ground ===
  public sacredGroundCooldown: number = 0;
  private readonly SACRED_GROUND_COOLDOWN_TOTAL = 15000; // ms

  get isInvincible(): boolean {
    return this.invincibilityTimer > 0;
  }

  get isDodgeActive(): boolean {
    return this.dodgeTimer > 0;
  }

  get isDroppingSelf(): boolean {
    return this.isDropping;
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
    super(scene, x, y, "monk_idle");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.classType = classType;
    this.classStats = CLASSES[classType];
    this.maxHealth = this.classStats.health;
    this.health = this.maxHealth;

    // Set physics body to 32x48 centered within the larger sprite frame
    this.setSize(SPRITE_CONFIG.BODY_WIDTH, SPRITE_CONFIG.BODY_HEIGHT);
    this.setOffset(SPRITE_CONFIG.BODY_OFFSET_X, SPRITE_CONFIG.BODY_OFFSET_Y);

    this.setCollideWorldBounds(false);
    // Scene already applies PHYSICS.GRAVITY globally — don't double it
    this.setBounce(0);

    this.initInput();

    // Listen for land animation completion
    const classPrefix = this.classType.toLowerCase();
    this.on(`animationcomplete-${classPrefix}_land`, () => {
      this.isLanding = false;
    });
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
    this.dodgeKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
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
    this.handleDropThrough();
    this.handleJumping(delta);
    this.handleWallInteraction();
    this.handleCombat(delta);
    this.handleDodge(delta);
    this.updateInvincibility(delta);
    this.updateClassMechanics(delta);
    this.updateAnimation();
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

    // Drop-through timer
    if (this.dropTimer > 0) {
      this.dropTimer -= delta;
      if (this.dropTimer <= 0) {
        this.dropTimer = 0;
        this.isDropping = false;
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
      this.clearTint();
    }
  }

  private updateAnimation() {
    // Don't override animations during active attacks (no attack sprites yet)
    if (this.isAttacking) return;

    const airborne = !this.onGround && !this.onSlope;
    const vy = this.body!.velocity.y;
    const vx = this.body!.velocity.x;

    let anim = "monk_idle";

    if (this.isWallSliding) {
      anim = "monk_wall_slide";
    } else if (airborne && vy < 0) {
      anim = "monk_jump";
    } else if (airborne && vy >= 0) {
      anim = "monk_fall";
    } else if (this.wasAirborne && !airborne) {
      // Just landed
      anim = "monk_land";
      this.isLanding = true;
    } else if (this.isLanding) {
      // Still playing land animation — don't interrupt
      anim = "monk_land";
    } else if (Math.abs(vx) > 10) {
      anim = "monk_run";
    }

    this.wasAirborne = airborne;

    // Run sprite faces opposite direction from the other sprites, so invert flip
    if (anim === "monk_run") {
      this.setFlipX(!this.flipX);
    }

    // Only call play if animation changed (avoids restarting loops)
    if (this.currentAnim !== anim) {
      this.currentAnim = anim;
      this.play(anim, true);
    }
  }

  private handleMovement() {
    if (this.isAttacking && this.onGround && this.attackState !== "RECOVERY") {
      this.setAccelerationX(0);
      this.setVelocityX(0);
      return;
    }

    const { left, right } = this.cursors;
    const onGround = this.onGround || this.onSlope;
    const platType = this.currentPlatformType;

    // Platform-specific drag
    let drag = onGround ? PHYSICS.GROUND_DRAG : PHYSICS.AIR_DRAG;
    if (platType === PlatformType.ICE && onGround) {
      drag = PHYSICS.GROUND_DRAG * PLATFORM_CONFIG.ICE_FRICTION;
    }
    this.setDragX(drag);

    let moveSpeed = this.getStat(
      "moveSpeed",
      PHYSICS.MOVE_SPEED,
      this.classStats.moveSpeed,
    );

    // Platform speed modifiers
    if (platType === PlatformType.STICKY && onGround) {
      moveSpeed *= PLATFORM_CONFIG.STICKY_SPEED_MULT;
    }

    // Platform-specific acceleration
    let accel = PHYSICS.ACCELERATION;
    if (platType === PlatformType.ICE && onGround) {
      accel *= PLATFORM_CONFIG.ICE_ACCEL_MULT;
    }

    if (left.isDown) {
      this.setAccelerationX(-accel);
      this.setFlipX(true);
    } else if (right.isDown) {
      this.setAccelerationX(accel);
      this.setFlipX(false);
    } else {
      this.setAccelerationX(0);
    }

    // On ice, don't cap speed (let momentum carry)
    if (platType !== PlatformType.ICE) {
      if (this.body!.velocity.x > moveSpeed) {
        this.setVelocityX(moveSpeed);
      } else if (this.body!.velocity.x < -moveSpeed) {
        this.setVelocityX(-moveSpeed);
      }
    } else {
      // Soft cap for ice platforms to prevent unbounded velocity
      const ICE_SPEED_CAP = 800;
      if (this.body!.velocity.x > ICE_SPEED_CAP) {
        this.setVelocityX(ICE_SPEED_CAP);
      } else if (this.body!.velocity.x < -ICE_SPEED_CAP) {
        this.setVelocityX(-ICE_SPEED_CAP);
      }
    }
  }

  private handleDropThrough() {
    // Drop through platforms: Down + Space while on ground
    if (
      this.cursors.down.isDown &&
      this.jumpJustPressed &&
      (this.onGround || this.onSlope) &&
      !this.isDropping
    ) {
      this.isDropping = true;
      this.dropTimer = this.DROP_DURATION;
      this.setVelocityY(100); // Tiny downward push to start falling

      // Consume the jump input so it doesn't trigger a normal jump
      this.jumpBufferTimer = 0;
    }
  }

  private handleJumping(delta: number) {
    const canJump = this.coyoteTimer > 0 || this.onSlope;
    const wantsToJump = this.jumpBufferTimer > 0;
    let jumpForce = this.getStat(
      "jumpHeight",
      PHYSICS.JUMP_FORCE,
      this.classStats.jumpHeight,
    );

    // Platform jump modifiers
    if (
      this.currentPlatformType === PlatformType.BOUNCE &&
      (this.onGround || this.onSlope)
    ) {
      jumpForce = PLATFORM_CONFIG.BOUNCE_FORCE;
    } else if (
      this.currentPlatformType === PlatformType.STICKY &&
      (this.onGround || this.onSlope)
    ) {
      jumpForce *= PLATFORM_CONFIG.STICKY_JUMP_MULT;
    }

    // Reset double jump when on ground
    if (this.onGround || this.onSlope) {
      this.canDoubleJump = true;
      this.hasDoubleJumped = false;
    }

    // Initial Jump (coyote + buffer)
    if (wantsToJump && canJump) {
      this.setVelocityY(jumpForce);
      this.onSlope = false;
      this.wasOnSlope = false;
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
    if (this.isJumping && this.cursors.space?.isDown && !this.isWallSliding) {
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
        // Priest ground SPECIAL: Sacred Ground instead of normal attack
        if (
          this.classType === ClassType.PRIEST &&
          this.onGround &&
          this.trySacredGround()
        ) {
          // Sacred Ground created — MainScene handles spawning the zone
          // Emit event so MainScene can create the SacredGround object
          window.dispatchEvent(
            new CustomEvent("priest-sacred-ground", {
              detail: { x: this.x, y: this.y + 20 },
            }),
          );
          return;
        }
        this.tryAttack(AttackType.SPECIAL);
      }
    }
  }

  private handleDodge(delta: number) {
    // Decrement timers
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= delta;
    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= delta;

      // Dodge just expired
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.setAlpha(1);
      }
    }

    // Perfect dodge buff timer
    if (this.perfectDodgeBuffTimer > 0) {
      this.perfectDodgeBuffTimer -= delta;
      if (this.perfectDodgeBuffTimer <= 0) {
        this.perfectDodgeBuff = false;
      }
    }

    // Initiate dodge
    if (
      Phaser.Input.Keyboard.JustDown(this.dodgeKey) &&
      this.dodgeCooldown <= 0 &&
      this.dodgeTimer <= 0
    ) {
      this.isDodging = true;
      this.dodgeTimer = this.DODGE_DURATION;
      this.dodgeCooldown = this.DODGE_COOLDOWN;
      this.dodgeStartTime = this.scene.time.now;

      // Horizontal velocity burst based on input direction
      const { left, right } = this.cursors;
      let dodgeDir: number;
      if (left.isDown) {
        dodgeDir = -1;
      } else if (right.isDown) {
        dodgeDir = 1;
      } else {
        dodgeDir = this.flipX ? -1 : 1;
      }
      this.setVelocityX(this.DODGE_SPEED * dodgeDir);

      // Ghost effect
      this.setAlpha(0.4);

      // Set invincibility for dodge duration
      this.invincibilityTimer = this.DODGE_DURATION;
      this.flashTimer = 0;
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
    if (def) this.setTint(def.color); // attack flash tint
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
    this.clearTint();
    this.comboTimer = COMBAT.COMBO_WINDOW;
  }

  public takeDamage(amount: number, attackerX?: number) {
    // Record when enemies attempt to deal damage (used for perfect dodge check)
    this.lastDamageAttemptTime = this.scene.time.now;

    // Dodge i-frames — skip damage but check for perfect dodge
    if (this.dodgeTimer > 0) {
      const timeSinceDodgeStart = this.scene.time.now - this.dodgeStartTime;
      if (timeSinceDodgeStart <= this.PERFECT_DODGE_WINDOW) {
        // Perfect dodge! Grant buff
        this.perfectDodgeBuff = true;
        this.perfectDodgeBuffTimer = this.PERFECT_DODGE_BUFF_DURATION;
        PersistentStats.addPerfectDodge();
        // Brief white flash to indicate perfect dodge
        this.setTint(0xffffff);
        this.scene.time.delayedCall(100, () => {
          if (this.active) this.clearTint();
        });
      }
      return;
    }

    if (this.isInvincible) return;

    let finalAmount = amount;

    // Paladin Shield Guard: 50% damage reduction if attack comes from front
    if (
      this.classType === ClassType.PALADIN &&
      this.isShieldGuarding &&
      attackerX !== undefined
    ) {
      const facingRight = !this.flipX;
      const attackFromRight = attackerX > this.x;
      // Block succeeds if the attack comes from the direction the player is facing
      if (
        (facingRight && attackFromRight) ||
        (!facingRight && !attackFromRight)
      ) {
        finalAmount = Math.max(
          1,
          Math.round(amount * this.SHIELD_GUARD_DAMAGE_REDUCTION),
        );
        // Visual feedback for blocked hit
        this.setTint(0x6666ff);
        this.scene.time.delayedCall(150, () => {
          if (this.active && this.isShieldGuarding) this.setTint(0x4444ff);
        });
      }
    }

    // Monk: reset flow on taking damage
    if (this.classType === ClassType.MONK && this.flowMeter > 0) {
      this.flowMeter = 0;
      this.applyFlowBuffs();
      this.emitFlowChange();
    }

    this.health -= finalAmount;
    PersistentStats.addDamageTaken(finalAmount);

    // Start invincibility
    this.invincibilityTimer = COMBAT.INVINCIBILITY_DURATION;
    this.flashTimer = 0;
    this.setTint(0xff0000);

    EventBus.emit("health-change", {
      health: this.health,
      maxHealth: this.maxHealth,
    });

    if (this.health <= 0) {
      EventBus.emit("player-died");
      this.scene.scene.restart();
    }
  }

  // ─── Class-Specific Mechanics ────────────────────────────────────────

  private updateClassMechanics(delta: number): void {
    if (this.classType === ClassType.PALADIN) {
      this.updateShieldGuard(delta);
    } else if (this.classType === ClassType.MONK) {
      this.updateFlowState(delta);
    } else if (this.classType === ClassType.PRIEST) {
      this.updateSacredGroundCooldown(delta);
    }
  }

  // --- Paladin: Shield Guard ---

  private updateShieldGuard(delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.touching.down || body.blocked.down;
    const isStill =
      Math.abs(body.velocity.x) < 10 && Math.abs(body.velocity.y) < 10;

    if (onGround && isStill && !this.isAttacking && !this.isDodging) {
      this.standStillTimer += delta;

      if (
        this.standStillTimer >= this.SHIELD_GUARD_THRESHOLD &&
        !this.isShieldGuarding
      ) {
        this.isShieldGuarding = true;
        EventBus.emit("shield-guard-change", { active: true });
      }

      // Blue tint pulse while guarding
      if (this.isShieldGuarding) {
        this.shieldGuardPulseTimer += delta;
        const pulse =
          0.6 + 0.4 * Math.sin(this.shieldGuardPulseTimer * 0.005);
        this.setTint(0x4444ff);
        this.setAlpha(pulse);
      }
    } else {
      // Movement or jump breaks guard
      if (this.isShieldGuarding) {
        this.isShieldGuarding = false;
        this.shieldGuardPulseTimer = 0;
        this.clearTint();
        this.setAlpha(1);
        EventBus.emit("shield-guard-change", { active: false });
      }
      this.standStillTimer = 0;
    }
  }

  // --- Monk: Flow State ---

  private updateFlowState(delta: number): void {
    // Decay flow when not attacking
    if (!this.isAttacking) {
      this.flowDecayTimer += delta;
      if (this.flowDecayTimer >= this.FLOW_DECAY_DELAY) {
        const decay = (this.FLOW_DECAY_RATE * delta) / 1000;
        this.flowMeter = Math.max(0, this.flowMeter - decay);
        this.emitFlowChange();
      }
    } else {
      this.flowDecayTimer = 0;
    }

    this.applyFlowBuffs();
  }

  /** Called by CombatManager when Monk successfully hits an enemy. */
  public onSuccessfulHit(): void {
    if (this.classType !== ClassType.MONK) return;
    this.flowMeter = Math.min(this.FLOW_MAX, this.flowMeter + this.FLOW_HIT_GAIN);
    this.flowDecayTimer = 0;
    this.emitFlowChange();
  }

  private emitFlowChange(): void {
    EventBus.emit("flow-change", {
      flow: this.flowMeter,
      maxFlow: this.FLOW_MAX,
    });
  }

  private applyFlowBuffs(): void {
    // Remove previous flow modifiers
    this.removeFlowModifiers();

    let moveSpeedMod = 0;
    let jumpHeightMod = 0;
    let attackDamageMod = 0;

    if (this.flowMeter >= 100) {
      moveSpeedMod = 0.2;
      jumpHeightMod = 0.2;
      attackDamageMod = 0.5;
    } else if (this.flowMeter >= 75) {
      moveSpeedMod = 0.2;
      jumpHeightMod = 0.2;
    } else if (this.flowMeter >= 50) {
      jumpHeightMod = 0.1;
    } else if (this.flowMeter >= 25) {
      moveSpeedMod = 0.1;
    }

    // Apply new flow modifiers (additive to existing item modifiers)
    if (moveSpeedMod !== this.flowMoveSpeedMod) {
      const current = this.statModifiers.get("moveSpeed") || 0;
      this.statModifiers.set(
        "moveSpeed",
        current - this.flowMoveSpeedMod + moveSpeedMod,
      );
      this.flowMoveSpeedMod = moveSpeedMod;
    }

    if (jumpHeightMod !== this.flowJumpHeightMod) {
      const current = this.statModifiers.get("jumpHeight") || 0;
      this.statModifiers.set(
        "jumpHeight",
        current - this.flowJumpHeightMod + jumpHeightMod,
      );
      this.flowJumpHeightMod = jumpHeightMod;
    }

    if (attackDamageMod !== this.flowAttackDamageMod) {
      const current = this.statModifiers.get("attackDamage") || 0;
      this.statModifiers.set(
        "attackDamage",
        current - this.flowAttackDamageMod + attackDamageMod,
      );
      this.flowAttackDamageMod = attackDamageMod;
    }
  }

  private removeFlowModifiers(): void {
    // Only remove if there were flow modifiers applied
    // (handled in applyFlowBuffs by tracking individual values)
  }

  // --- Priest: Sacred Ground ---

  private updateSacredGroundCooldown(delta: number): void {
    if (this.sacredGroundCooldown > 0) {
      this.sacredGroundCooldown -= delta;
      if (this.sacredGroundCooldown < 0) this.sacredGroundCooldown = 0;
      EventBus.emit("sacred-ground-cooldown", {
        remaining: this.sacredGroundCooldown,
        total: this.SACRED_GROUND_COOLDOWN_TOTAL,
      });
    }
  }

  /**
   * Called when Priest uses SPECIAL attack on ground.
   * Returns true if Sacred Ground should be created instead of normal attack.
   */
  public trySacredGround(): boolean {
    if (this.classType !== ClassType.PRIEST) return false;
    if (this.sacredGroundCooldown > 0) return false;
    if (!this.onGround) return false;

    this.sacredGroundCooldown = this.SACRED_GROUND_COOLDOWN_TOTAL;
    EventBus.emit("sacred-ground-cooldown", {
      remaining: this.sacredGroundCooldown,
      total: this.SACRED_GROUND_COOLDOWN_TOTAL,
    });
    return true;
  }

  public handleSlopePhysics(result: SlopeCollisionResult): void {
    // Snap player to slope surface
    const targetY = result.surfaceY - this.height / 2;
    this.y = targetY;
    this.onSlope = true;
    this.slopeAngle = result.angle;
    this.wasOnSlope = true;

    // Prevent falling through — zero out downward velocity
    if (this.body!.velocity.y > 0) {
      this.setVelocityY(0);
    }

    // Apply slope speed modifier to horizontal velocity
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.velocity.x *= result.speedMod;

    // Store launch vector for when player leaves the slope
    this.pendingLaunchVector = result.launchVector ?? null;

    // Reduce gravity while on slope
    body.setAllowGravity(false);
  }

  /**
   * Clears slope state. Returns the launch speed if the player just
   * launched off a slope, or 0 if no launch occurred.
   */
  public clearSlopeState(): number {
    if (this.wasOnSlope && !this.onSlope) {
      // Just left a slope — re-enable gravity
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(true);
      this.wasOnSlope = false;

      // Apply stored launch vector
      if (this.pendingLaunchVector) {
        const lv = this.pendingLaunchVector;
        body.velocity.x += lv.x;
        body.velocity.y += lv.y;
        const launchSpeed = Math.sqrt(lv.x * lv.x + lv.y * lv.y);
        this.pendingLaunchVector = null;
        EventBus.emit("slope-launch", {
          speed: launchSpeed,
          angle: this.slopeAngle,
        });
        return launchSpeed;
      }
    }
    this.onSlope = false;
    return 0;
  }

  public detectPlatformType(platform: any): void {
    const type = platform?.getData?.("type");
    if (type && Player.VALID_PLATFORM_TYPES.has(type)) {
      this.currentPlatformType = type as PlatformType;
    } else {
      this.currentPlatformType = PlatformType.STANDARD;
    }
  }

  public collectItem(item: ItemData) {
    this.inventory.push(item);
    PersistentStats.addItemCollected();

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

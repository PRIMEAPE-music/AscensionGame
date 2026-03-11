import Phaser from "phaser";
import { ClassType, type ClassStats, CLASSES } from "../config/ClassConfig";
import type { ItemData, StatType } from "../config/ItemConfig";
import { QUALITY_MULTIPLIERS } from "../config/ItemConfig";
import { getSynergyMultiplier, calculateSynergies } from "../systems/ItemSynergy";
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
import { GameSettings } from "../systems/GameSettings";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private static VALID_PLATFORM_TYPES = new Set(Object.values(PlatformType));

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Combat Keys
  private attackBKey!: Phaser.Input.Keyboard.Key;
  private attackXKey!: Phaser.Input.Keyboard.Key;
  private attackYKey!: Phaser.Input.Keyboard.Key;
  private dodgeKey!: Phaser.Input.Keyboard.Key;

  // Ultimate/Combat Ability Keys
  private cataclysmKey!: Phaser.Input.Keyboard.Key;
  private temporalKey!: Phaser.Input.Keyboard.Key;
  private divineKey!: Phaser.Input.Keyboard.Key;
  private essenceBurstKey!: Phaser.Input.Keyboard.Key;

  // Gold Attack Ability Keys
  private counterKey!: Phaser.Input.Keyboard.Key;
  private groundSlamKey!: Phaser.Input.Keyboard.Key;
  private projectileKey!: Phaser.Input.Keyboard.Key;
  private chargeKey!: Phaser.Input.Keyboard.Key;

  // Combat State
  public isAttacking: boolean = false;
  public currentAttackId: string | null = null;
  private comboTimer: number = 0;
  private attackState: "IDLE" | "STARTUP" | "ACTIVE" | "RECOVERY" = "IDLE";
  private attackTimer: number = 0;

  // Perfect Parry State
  private attackStartTime: number = 0;
  private parryInvincibilityTimer: number = 0;
  private readonly PARRY_WINDOW: number = 150; // ms from attack start where parry is active
  private readonly PARRY_INVINCIBILITY_DURATION: number = 500; // 0.5s invincibility after parry
  private readonly PARRY_REFLECT_MULTIPLIER: number = 2.0; // 200% damage reflected back

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
  private dodgeJustPressed: boolean = false;
  private grappleJustPressed: boolean = false;

  // Double Jump State
  private canDoubleJump: boolean = false;
  private hasDoubleJumped: boolean = false;

  // Air Dash state
  private airDashCooldown: number = 0;
  private hasAirDashed: boolean = false;
  private isAirDashing: boolean = false;
  private airDashTimer: number = 0;
  private readonly AIR_DASH_SPEED = 600;
  private readonly AIR_DASH_DURATION = 150;
  private readonly AIR_DASH_COOLDOWN = 1500;

  // Wall Climb state
  private wallClimbStamina: number = 5000; // ms
  private readonly WALL_CLIMB_MAX_STAMINA = 5000;
  private readonly WALL_CLIMB_SPEED = 150;
  private isWallClimbing: boolean = false;

  // Grappling Hook state
  private grappleKey!: Phaser.Input.Keyboard.Key;
  private grappleCooldown: number = 0;
  private readonly GRAPPLE_RANGE = 500;
  private readonly GRAPPLE_COOLDOWN = 3000;
  private readonly GRAPPLE_PULL_SPEED = 800;

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
  private pendingItem: ItemData | null = null;
  private readonly MAX_SILVER_ITEMS = 3;

  // === Gold Ability State ===
  private healthRegenTimer: number = 0;
  private outOfCombatTimer: number = 0;
  private readonly HEALTH_REGEN_INTERVAL = 30000; // 30s
  private readonly OUT_OF_COMBAT_THRESHOLD = 5000; // 5s
  private vampirismKillCount: number = 0;
  private hasRevived: boolean = false;
  private tempShieldUsed: boolean = false;

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

  // === Gold Ultimate Abilities ===
  // Cataclysm
  private cataclysmCooldown: number = 0;
  private readonly CATACLYSM_COOLDOWN = 60000;
  private readonly CATACLYSM_RADIUS = 300;
  private readonly CATACLYSM_DAMAGE_MULT = 5.0;

  // Temporal Rift
  private temporalCooldown: number = 0;
  private readonly TEMPORAL_COOLDOWN = 90000;
  private readonly TEMPORAL_DURATION = 5000;
  private readonly TEMPORAL_SLOW = 0.3;

  // Divine Intervention
  private divineCooldown: number = 0;
  private readonly DIVINE_COOLDOWN = 120000;
  private readonly DIVINE_DURATION = 5000;

  // Essence Burst
  private essenceBurstActive: boolean = false;

  // === Gold Attack Ability State ===
  // Counter Slash
  private counterStanceActive: boolean = false;
  private counterStanceTimer: number = 0;
  private counterCooldown: number = 0;
  private readonly COUNTER_STANCE_DURATION = 500; // ms
  private readonly COUNTER_COOLDOWN = 4000; // ms

  // Ground Slam
  private groundSlamCooldown: number = 0;
  private readonly GROUND_SLAM_COOLDOWN = 5000;
  private readonly GROUND_SLAM_RADIUS = 150;
  private readonly GROUND_SLAM_DAMAGE_MULT = 1.2;
  private isGroundSlamming: boolean = false;

  // Projectile
  private projectileCooldown: number = 0;
  private readonly PROJECTILE_COOLDOWN = 2000;
  private readonly PROJECTILE_SPEED = 600;
  private readonly PROJECTILE_RANGE = 500;
  private readonly PROJECTILE_DAMAGE_MULT = 1.0;

  // Charged Attack
  private isCharging: boolean = false;
  private chargeTime: number = 0;
  private readonly MAX_CHARGE_TIME = 3000; // 3 seconds
  private chargeGlow: Phaser.GameObjects.Graphics | null = null;

  get isInvincible(): boolean {
    return this.invincibilityTimer > 0 || this.parryInvincibilityTimer > 0;
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
    // Accessibility: Extra Starting Health (+2 max health)
    const accessSettings = GameSettings.get();
    if (accessSettings.assistMode && accessSettings.extraStartingHealth) {
      this.maxHealth += 2;
    }
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
    this.grappleKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.V,
    );

    // Ultimate/Combat Ability Keys
    this.cataclysmKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.Q,
    );
    this.temporalKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.E,
    );
    this.divineKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.R,
    );
    this.essenceBurstKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.F,
    );

    // Gold Attack Ability Keys
    this.counterKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.G,
    );
    this.groundSlamKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.T,
    );
    this.projectileKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.Y,
    );
    this.chargeKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.H,
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
    this.dodgeJustPressed = Phaser.Input.Keyboard.JustDown(this.dodgeKey);
    this.grappleJustPressed = Phaser.Input.Keyboard.JustDown(this.grappleKey);

    this.updateTimers(delta);
    this.handleMovement();
    this.handleDropThrough();
    this.handleJumping(delta);
    this.handleWallInteraction();
    this.handleCombat(delta);
    this.handleDodge(delta);
    this.handleAirDash(delta);
    this.handleGrapple(delta);
    this.handleCataclysm();
    this.handleTemporalRift();
    this.handleDivineIntervention();
    this.handleEssenceBurst();
    this.handleCounterSlash();
    this.handleGroundSlam();
    this.handleProjectile();
    this.handleChargedAttack(delta);
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

    // Ultimate ability cooldowns
    if (this.cataclysmCooldown > 0) this.cataclysmCooldown -= delta;
    if (this.temporalCooldown > 0) this.temporalCooldown -= delta;
    if (this.divineCooldown > 0) this.divineCooldown -= delta;

    // Drop-through timer
    if (this.dropTimer > 0) {
      this.dropTimer -= delta;
      if (this.dropTimer <= 0) {
        this.dropTimer = 0;
        this.isDropping = false;
      }
    }

    // Air Dash timers
    if (this.airDashCooldown > 0) this.airDashCooldown -= delta;
    if (this.airDashTimer > 0) {
      this.airDashTimer -= delta;
      if (this.airDashTimer <= 0) {
        this.isAirDashing = false;
        (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
      }
    }

    // Grappling Hook cooldown
    if (this.grappleCooldown > 0) this.grappleCooldown -= delta;

    // Parry invincibility timer
    if (this.parryInvincibilityTimer > 0) {
      this.parryInvincibilityTimer -= delta;
      if (this.parryInvincibilityTimer <= 0) {
        this.parryInvincibilityTimer = 0;
      }
    }

    // Gold Attack Ability cooldowns
    if (this.counterCooldown > 0) this.counterCooldown -= delta;
    if (this.groundSlamCooldown > 0) this.groundSlamCooldown -= delta;
    if (this.projectileCooldown > 0) this.projectileCooldown -= delta;
    if (this.counterStanceTimer > 0) {
      this.counterStanceTimer -= delta;
      if (this.counterStanceTimer <= 0) {
        this.counterStanceActive = false;
        // Remove orange tint when stance expires
        if (this.active) this.clearTint();
      }
    }

    // Health Regen tracking (Gold ability: health_regen)
    if (this.abilities.has('health_regen')) {
      this.outOfCombatTimer += delta;
      if (this.outOfCombatTimer >= this.OUT_OF_COMBAT_THRESHOLD) {
        this.healthRegenTimer += delta;
        if (this.healthRegenTimer >= this.HEALTH_REGEN_INTERVAL) {
          this.healthRegenTimer = 0;
          if (this.health < this.maxHealth) {
            this.health++;
            EventBus.emit("health-change", { health: this.health, maxHealth: this.maxHealth });
          }
        }
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

    // Recharge wall climb stamina on ground
    if (onGround) {
      this.wallClimbStamina = this.WALL_CLIMB_MAX_STAMINA;
      this.isWallClimbing = false;
    }

    if (onWall && !onGround) {
      this.isWallSliding = true;

      // Wall Climb: if the player has the ability and is holding toward the wall
      const onLeftWall = body.blocked.left || body.touching.left;
      const onRightWall = body.blocked.right || body.touching.right;
      const holdingTowardWall =
        (onLeftWall && this.cursors.left.isDown) ||
        (onRightWall && this.cursors.right.isDown);

      if (
        this.abilities.has("wall_climb") &&
        holdingTowardWall &&
        this.wallClimbStamina > 0
      ) {
        // Climb up the wall
        this.setVelocityY(-this.WALL_CLIMB_SPEED);
        this.wallClimbStamina -= this.scene.game.loop.delta;
        this.isWallClimbing = true;

        if (this.wallClimbStamina <= 0) {
          this.wallClimbStamina = 0;
          this.isWallClimbing = false;
        }
      } else {
        this.isWallClimbing = false;
        // Normal wall slide
        if (this.body!.velocity.y > 0) {
          this.setVelocityY(PHYSICS.WALL_SLIDE_SPEED);
        }
      }

      if (this.jumpJustPressed) {
        const jumpDir = onLeftWall ? 1 : -1;
        const jumpForceY = this.getStat(
          "jumpHeight",
          PHYSICS.WALL_JUMP.y,
          this.classStats.jumpHeight,
        );

        this.setVelocityX(PHYSICS.WALL_JUMP.x * jumpDir);
        this.setVelocityY(jumpForceY);

        this.isWallSliding = false;
        this.isWallClimbing = false;
        this.isJumping = true;
        this.jumpTimer = 0;
        this.hasDoubleJumped = false;
        this.canDoubleJump = true;
      }
    } else {
      this.isWallSliding = false;
      this.isWallClimbing = false;
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
    // Dynamic dodge values (Dodge Mastery ability)
    const dodgeDuration = this.abilities.has('dodge_mastery') ? this.DODGE_DURATION * 2 : this.DODGE_DURATION;
    const dodgeCooldown = this.abilities.has('dodge_mastery') ? this.DODGE_COOLDOWN / 2 : this.DODGE_COOLDOWN;

    // Decrement timers
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= delta;
    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= delta;

      // Dodge just expired
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;

        // Shadow Dodge: grant 1s invisibility after dodge ends
        if (this.abilities.has('shadow_dodge')) {
          this.setAlpha(0.3);
          this.invincibilityTimer = Math.max(this.invincibilityTimer, 1000);
          this.scene.time.delayedCall(1000, () => {
            if (this.active && !this.isDodging) this.setAlpha(1);
          });
        } else {
          this.setAlpha(1);
        }
      }
    }

    // Perfect dodge buff timer
    if (this.perfectDodgeBuffTimer > 0) {
      this.perfectDodgeBuffTimer -= delta;
      if (this.perfectDodgeBuffTimer <= 0) {
        this.perfectDodgeBuff = false;
      }
    }

    // Initiate dodge (skip if in midair with air_dash — air dash handles SHIFT in air)
    if (
      this.dodgeJustPressed &&
      this.dodgeCooldown <= 0 &&
      this.dodgeTimer <= 0 &&
      !(
        !this.onGround &&
        !this.isWallSliding &&
        this.abilities.has("air_dash") &&
        !this.hasAirDashed &&
        this.airDashCooldown <= 0
      )
    ) {
      this.isDodging = true;
      this.dodgeTimer = dodgeDuration;
      this.dodgeCooldown = dodgeCooldown;
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
      this.invincibilityTimer = dodgeDuration;
      this.flashTimer = 0;
    }
  }

  private handleAirDash(delta: number) {
    // Reset air dash on landing
    if (this.onGround) {
      this.hasAirDashed = false;
    }

    // If currently air dashing, maintain the dash state
    if (this.isAirDashing) {
      return;
    }

    // Check if player can initiate air dash
    if (
      this.abilities.has("air_dash") &&
      !this.onGround &&
      !this.isWallSliding &&
      !this.isAirDashing &&
      !this.hasAirDashed &&
      this.airDashCooldown <= 0 &&
      this.dodgeJustPressed
    ) {
      this.isAirDashing = true;
      this.hasAirDashed = true;
      this.airDashTimer = this.AIR_DASH_DURATION;
      this.airDashCooldown = this.AIR_DASH_COOLDOWN;

      // Dash direction based on facing
      const dashDir = this.flipX ? -1 : 1;
      this.setVelocityX(this.AIR_DASH_SPEED * dashDir);
      this.setVelocityY(0);

      // Brief zero gravity during dash
      (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

      // Brief invincibility during air dash
      this.invincibilityTimer = this.AIR_DASH_DURATION;
      this.flashTimer = 0;

      // Visual: tint flash for trail effect
      this.setTint(0x88ccff);
      this.scene.time.delayedCall(this.AIR_DASH_DURATION, () => {
        if (this.active && !this.isInvincible) {
          this.clearTint();
        }
      });

      // Trail particle effect
      const trail = this.scene.add.circle(
        this.x,
        this.y,
        12,
        0x88ccff,
        0.6,
      );
      this.scene.tweens.add({
        targets: trail,
        scale: 2,
        alpha: 0,
        duration: 300,
        onComplete: () => trail.destroy(),
      });
    }
  }

  private handleGrapple(delta: number) {
    if (
      !this.abilities.has("grappling_hook") ||
      this.grappleCooldown > 0 ||
      !this.grappleJustPressed
    ) {
      return;
    }

    // Find nearest platform above the player within range
    const platforms = (this.scene as any).staticPlatforms;
    if (!platforms) return;

    let nearest: { x: number; y: number; dist: number } | null = null;
    platforms.children.each((p: any) => {
      if (p.y < this.y && p.y > this.y - this.GRAPPLE_RANGE) {
        const dx = p.x - this.x;
        const dy = p.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= this.GRAPPLE_RANGE && (!nearest || dist < nearest.dist)) {
          nearest = { x: p.x, y: p.y, dist };
        }
      }
      return true;
    });

    if (nearest) {
      const target = nearest as { x: number; y: number; dist: number };
      // Calculate direction toward the platform
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = target.dist;
      const nx = dx / dist;
      const ny = dy / dist;

      // Set velocity toward the target platform
      this.setVelocityX(nx * this.GRAPPLE_PULL_SPEED);
      this.setVelocityY(ny * this.GRAPPLE_PULL_SPEED);

      this.grappleCooldown = this.GRAPPLE_COOLDOWN;

      // Visual: draw a brief line from player to target
      const graphics = this.scene.add.graphics();
      graphics.lineStyle(2, 0x886644, 1);
      graphics.beginPath();
      graphics.moveTo(this.x, this.y);
      graphics.lineTo(target.x, target.y);
      graphics.strokePath();

      // Fade out the grapple line
      this.scene.tweens.add({
        targets: graphics,
        alpha: 0,
        duration: 300,
        onComplete: () => graphics.destroy(),
      });
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
    this.attackStartTime = this.scene.time.now;
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

  /**
   * Apply damage to the player.
   * @returns true if the damage was parried (caller should skip knockback/combo reset)
   */
  public takeDamage(amount: number, attackerX?: number, attackerRef?: any): boolean {
    // Record when enemies attempt to deal damage (used for perfect dodge check)
    this.lastDamageAttemptTime = this.scene.time.now;

    // Accessibility: Auto-Dodge — automatically trigger dodge when about to take damage
    const autoSettings = GameSettings.get();
    if (
      autoSettings.assistMode &&
      autoSettings.autoDodge &&
      this.dodgeTimer <= 0 &&
      this.dodgeCooldown <= 0 &&
      !this.isDodging
    ) {
      // Trigger a dodge automatically
      const dodgeDuration = this.abilities.has('dodge_mastery') ? this.DODGE_DURATION * 2 : this.DODGE_DURATION;
      const dodgeCooldown = this.abilities.has('dodge_mastery') ? this.DODGE_COOLDOWN / 2 : this.DODGE_COOLDOWN;
      this.isDodging = true;
      this.dodgeTimer = dodgeDuration;
      this.dodgeCooldown = dodgeCooldown;
      this.dodgeStartTime = this.scene.time.now;
      // Apply dodge velocity away from attacker
      const dodgeDir = attackerX !== undefined ? (this.x > attackerX ? 1 : -1) : (this.flipX ? -1 : 1);
      this.setVelocityX(this.DODGE_SPEED * dodgeDir);
      this.setAlpha(0.5);
    }

    // Dodge i-frames — skip damage but check for perfect dodge
    if (this.dodgeTimer > 0) {
      const timeSinceDodgeStart = this.scene.time.now - this.dodgeStartTime;
      if (timeSinceDodgeStart <= this.PERFECT_DODGE_WINDOW) {
        // Perfect dodge! Grant buff
        this.perfectDodgeBuff = true;
        this.perfectDodgeBuffTimer = this.PERFECT_DODGE_BUFF_DURATION;
        PersistentStats.addPerfectDodge();
        // Brief white flash to indicate perfect dodge (reduced if flash reduction enabled)
        if (!GameSettings.get().flashReduction) {
          this.setTint(0xffffff);
          this.scene.time.delayedCall(100, () => {
            if (this.active) this.clearTint();
          });
        }
      }
      return false;
    }

    // Perfect Parry check: if attacking within the parry window, reflect damage
    if (this.isAttacking && (this.attackState === "STARTUP" || this.attackState === "ACTIVE")) {
      const timeSinceAttackStart = this.scene.time.now - this.attackStartTime;
      if (timeSinceAttackStart <= this.PARRY_WINDOW) {
        this.performPerfectParry(amount, attackerRef);
        return true;
      }
    }

    if (this.isInvincible) return false;

    // Counter Slash: negate damage and counter-attack
    if (this.counterStanceActive) {
      this.counterStanceActive = false;
      this.counterStanceTimer = 0;
      this.counterCooldown = this.COUNTER_COOLDOWN;

      // Counter-attack: find nearest enemy and deal 1.5x base damage
      const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
      if (enemies) {
        const counterDamage = Math.round(COMBAT.BASE_DAMAGE * 1.5 * this.classStats.attackDamage);
        let nearestEnemy: any = null;
        let nearestDist = Infinity;

        enemies.children.each((enemy: any) => {
          if (!enemy.active) return true;
          const dx = enemy.x - this.x;
          const dy = enemy.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearestDist && dist <= 200) {
            nearestDist = dist;
            nearestEnemy = enemy;
          }
          return true;
        });

        if (nearestEnemy) {
          nearestEnemy.takeDamage(counterDamage);
        }
      }

      // Visual feedback: golden flash + screen shake
      this.setTint(0xffd700);
      this.scene.cameras.main.shake(200, 0.005);
      this.scene.time.delayedCall(300, () => {
        if (this.active) this.clearTint();
      });

      // Brief invincibility after counter
      this.invincibilityTimer = 500;
      this.flashTimer = 0;
      return false; // Negate the damage
    }

    // Cancel charged attack if hit while charging
    if (this.isCharging) {
      this.isCharging = false;
      this.chargeTime = 0;
      if (this.chargeGlow) {
        this.chargeGlow.destroy();
        this.chargeGlow = null;
      }
      this.clearTint();
    }

    // Reset out-of-combat timer (Health Regen ability)
    this.outOfCombatTimer = 0;
    this.healthRegenTimer = 0;

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

    // Revive ability: prevent death once per run
    if (this.health <= 0 && this.abilities.has('revive') && !this.hasRevived) {
      this.hasRevived = true;
      this.health = 1;
      this.invincibilityTimer = 3000; // 3s invincibility on revive
      this.flashTimer = 0;
      // Gold flash effect
      this.setTint(0xffd700);
      this.scene.time.delayedCall(500, () => {
        if (this.active) this.clearTint();
      });
      EventBus.emit("health-change", {
        health: this.health,
        maxHealth: this.maxHealth,
      });
      return false; // Don't die
    }

    // Temporary Shield ability: invincibility when health drops to 1 (once per run)
    if (this.health === 1 && this.abilities.has('temp_shield') && !this.tempShieldUsed) {
      this.tempShieldUsed = true;
      this.invincibilityTimer = 3000;
      this.flashTimer = 0;
      // Golden shield flash
      this.setTint(0xffdd44);
      this.scene.time.delayedCall(3000, () => {
        if (this.active) this.clearTint();
      });
    }

    // Start invincibility
    if (this.invincibilityTimer <= 0) {
      let iFrameDuration = COMBAT.INVINCIBILITY_DURATION;
      // Accessibility: Extra I-Frames — double invincibility duration
      const iframeSettings = GameSettings.get();
      if (iframeSettings.assistMode && iframeSettings.extraIFrames) {
        iFrameDuration *= 2;
      }
      this.invincibilityTimer = iFrameDuration;
      this.flashTimer = 0;
    }
    // Flash Reduction: skip red tint flash if enabled
    if (!GameSettings.get().flashReduction) {
      this.setTint(0xff0000);
    }

    EventBus.emit("health-change", {
      health: this.health,
      maxHealth: this.maxHealth,
    });

    if (this.health <= 0) {
      EventBus.emit("player-died");
      this.scene.scene.restart();
    }
    return false;
  }

  /**
   * Execute a perfect parry: negate damage, reflect it back to attacker,
   * grant brief invincibility, and show visual feedback.
   */
  private performPerfectParry(incomingDamage: number, attackerRef?: any): void {
    // Calculate reflected damage
    const baseDamage = COMBAT.BASE_DAMAGE;
    const classMult = this.classStats.attackDamage;
    const reflectedDamage = Math.max(1, Math.round(baseDamage * classMult * this.PARRY_REFLECT_MULTIPLIER));

    // Grant parry invincibility
    this.parryInvincibilityTimer = this.PARRY_INVINCIBILITY_DURATION;

    // Track stat
    PersistentStats.addPerfectParry();

    // Reflect damage back to attacker
    if (attackerRef && attackerRef.active && typeof attackerRef.takeDamage === 'function') {
      attackerRef.takeDamage(reflectedDamage);
      PersistentStats.addDamageDealt(reflectedDamage);

      // Show "PARRY!" and reflected damage number on the enemy
      if (attackerRef.x !== undefined && attackerRef.y !== undefined) {
        // "PARRY!" label on the player
        const parryLabel = this.scene.add.text(this.x, this.y - 40, 'PARRY!', {
          fontSize: '28px',
          fontFamily: 'monospace',
          color: '#ffd700',
          stroke: '#000000',
          strokeThickness: 4,
          fontStyle: 'bold',
        });
        parryLabel.setOrigin(0.5);
        parryLabel.setDepth(101);

        this.scene.tweens.add({
          targets: parryLabel,
          y: this.y - 100,
          alpha: 0,
          scale: 1.8,
          duration: 1000,
          ease: 'Power2',
          onComplete: () => parryLabel.destroy(),
        });

        // Reflected damage number on the enemy
        const dmgText = this.scene.add.text(attackerRef.x, attackerRef.y - 20, `${reflectedDamage}`, {
          fontSize: '22px',
          fontFamily: 'monospace',
          color: '#ff6600',
          stroke: '#000000',
          strokeThickness: 3,
          fontStyle: 'bold',
        });
        dmgText.setOrigin(0.5);
        dmgText.setDepth(101);

        const offsetX = Phaser.Math.Between(-15, 15);
        this.scene.tweens.add({
          targets: dmgText,
          x: attackerRef.x + offsetX,
          y: attackerRef.y - 70,
          alpha: 0,
          scale: 1.4,
          duration: 800,
          ease: 'Power2',
          onComplete: () => dmgText.destroy(),
        });
      }
    }

    // Visual feedback: gold flash on player
    this.setTint(0xffd700);
    this.scene.time.delayedCall(200, () => {
      if (this.active && this.parryInvincibilityTimer > 0) {
        // Maintain a subtle gold tint during parry invincibility
        this.setTint(0xffe680);
      } else if (this.active) {
        this.clearTint();
      }
    });

    // Clear parry tint when invincibility ends
    this.scene.time.delayedCall(this.PARRY_INVINCIBILITY_DURATION, () => {
      if (this.active && !this.isInvincible) {
        this.clearTint();
      }
    });

    // Screen shake (moderate)
    this.scene.cameras.main.shake(100, 0.006);

    // Hit-stop effect: brief time slow for impact feel
    this.scene.time.timeScale = 0.15;
    this.scene.time.delayedCall(60, () => {
      this.scene.time.timeScale = 1;
    });

    // Emit parry event for HUD
    EventBus.emit("parry-success", { reflectedDamage });
  }

  // ─── Gold Ultimate Abilities ────────────────────────────────────────

  private handleCataclysm(): void {
    if (!this.abilities.has('cataclysm')) return;
    if (this.cataclysmCooldown > 0) return;
    if (!Phaser.Input.Keyboard.JustDown(this.cataclysmKey)) return;

    this.cataclysmCooldown = this.CATACLYSM_COOLDOWN;

    // Damage all enemies in radius
    const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
    const damage = Math.round(COMBAT.BASE_DAMAGE * this.CATACLYSM_DAMAGE_MULT * this.classStats.attackDamage);

    enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.CATACLYSM_RADIUS) {
        enemy.takeDamage(damage);
      }
      return true;
    });

    // Visual: expanding circle
    const circle = this.scene.add.circle(this.x, this.y, 10, 0xff4400, 0.6);
    circle.setDepth(100);
    this.scene.tweens.add({
      targets: circle,
      radius: this.CATACLYSM_RADIUS,
      alpha: 0,
      duration: 500,
      onUpdate: () => {
        circle.setRadius(circle.radius);
      },
      onComplete: () => circle.destroy(),
    });

    // Screen shake
    this.scene.cameras.main.shake(500, 0.01);
  }

  private handleTemporalRift(): void {
    if (!this.abilities.has('temporal_rift')) return;
    if (this.temporalCooldown > 0) return;
    if (!Phaser.Input.Keyboard.JustDown(this.temporalKey)) return;

    this.temporalCooldown = this.TEMPORAL_COOLDOWN;

    // Slow time
    this.scene.time.timeScale = this.TEMPORAL_SLOW;
    this.scene.physics.world.timeScale = 1 / this.TEMPORAL_SLOW; // Inverse because physics timeScale works opposite

    // Blue overlay
    const overlay = this.scene.add.rectangle(
      this.scene.cameras.main.scrollX + this.scene.cameras.main.width / 2,
      this.scene.cameras.main.scrollY + this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width * 2,
      this.scene.cameras.main.height * 2,
      0x2244ff,
      0.15,
    );
    overlay.setScrollFactor(0);
    overlay.setDepth(150);

    // Restore after duration (delayedCall is affected by timeScale, so multiply by slow factor)
    this.scene.time.delayedCall(this.TEMPORAL_DURATION * this.TEMPORAL_SLOW, () => {
      this.scene.time.timeScale = 1;
      this.scene.physics.world.timeScale = 1;
      this.scene.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 300,
        onComplete: () => overlay.destroy(),
      });
    });
  }

  private handleDivineIntervention(): void {
    if (!this.abilities.has('divine_intervention')) return;
    if (this.divineCooldown > 0) return;
    if (!Phaser.Input.Keyboard.JustDown(this.divineKey)) return;

    this.divineCooldown = this.DIVINE_COOLDOWN;
    this.invincibilityTimer = this.DIVINE_DURATION;

    // Golden glow effect
    this.setTint(0xffd700);
    this.scene.time.delayedCall(this.DIVINE_DURATION, () => {
      this.clearTint();
    });

    // Camera flash
    this.scene.cameras.main.flash(300, 255, 215, 0);
  }

  private handleEssenceBurst(): void {
    if (!this.abilities.has('essence_burst')) return;
    if (this.essenceBurstActive) return;
    if (!Phaser.Input.Keyboard.JustDown(this.essenceBurstKey)) return;

    // Get current essence from MainScene
    const mainScene = this.scene as any;
    const essence = mainScene.essenceTotal || 0;
    if (essence < 100) return;

    // Calculate boost: 10% per 100 essence
    const boostPercent = Math.floor(essence / 100) * 0.10;
    const essenceSpent = Math.floor(essence / 100) * 100;

    // Deduct essence
    mainScene.essenceTotal -= essenceSpent;
    EventBus.emit("essence-change", { essence: mainScene.essenceTotal, gained: -essenceSpent });

    // Apply temporary stat boosts
    this.essenceBurstActive = true;
    const stats: Array<'moveSpeed' | 'jumpHeight' | 'attackDamage' | 'attackSpeed'> = ['moveSpeed', 'jumpHeight', 'attackDamage', 'attackSpeed'];
    for (const stat of stats) {
      const current = this.statModifiers.get(stat) || 0;
      this.statModifiers.set(stat, current + boostPercent);
    }

    // Purple glow
    this.setTint(0xcc44ff);

    // Remove after 30 seconds
    this.scene.time.delayedCall(30000, () => {
      for (const stat of stats) {
        const current = this.statModifiers.get(stat) || 0;
        this.statModifiers.set(stat, current - boostPercent);
      }
      this.essenceBurstActive = false;
      this.clearTint();
    });
  }

  // ─── Gold Attack Abilities ─────────────────────────────────────────

  private handleCounterSlash(): void {
    if (!this.abilities.has('counter_stance')) return;
    if (this.counterCooldown > 0) return;
    if (this.counterStanceActive) return;
    if (!Phaser.Input.Keyboard.JustDown(this.counterKey)) return;

    // Activate counter stance
    this.counterStanceActive = true;
    this.counterStanceTimer = this.COUNTER_STANCE_DURATION;

    // Visual: orange tint while in stance
    this.setTint(0xff8844);
  }

  private handleGroundSlam(): void {
    if (!this.abilities.has('ground_slam')) return;
    if (this.groundSlamCooldown > 0) return;
    if (!Phaser.Input.Keyboard.JustDown(this.groundSlamKey)) return;

    if (!this.onGround) {
      // Airborne: slam downward quickly
      this.isGroundSlamming = true;
      this.setVelocityY(800);
      this.setVelocityX(0);

      // Wait for landing then create shockwave
      const checkLanding = this.scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (this.onGround) {
            checkLanding.destroy();
            this.isGroundSlamming = false;
            this.createGroundSlamShockwave();
            this.groundSlamCooldown = this.GROUND_SLAM_COOLDOWN;
          }
        },
      });

      // Safety: destroy timer after 2s even if we never land
      this.scene.time.delayedCall(2000, () => {
        if (checkLanding.getRemaining() > 0) {
          checkLanding.destroy();
          this.isGroundSlamming = false;
        }
      });
    } else {
      // Grounded: immediate shockwave
      this.createGroundSlamShockwave();
      this.groundSlamCooldown = this.GROUND_SLAM_COOLDOWN;
    }
  }

  private createGroundSlamShockwave(): void {
    const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
    if (!enemies) return;

    const damage = Math.round(
      COMBAT.BASE_DAMAGE * this.GROUND_SLAM_DAMAGE_MULT * this.classStats.attackDamage,
    );

    enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.GROUND_SLAM_RADIUS) {
        enemy.takeDamage(damage);
        // Knockback upward for juggle
        if (enemy.body) {
          enemy.body.velocity.y = -400;
          enemy.body.velocity.x = dx > 0 ? 200 : -200;
        }
      }
      return true;
    });

    // Visual: expanding shockwave circle
    const circle = this.scene.add.circle(this.x, this.y + 20, 10, 0x886633, 0.5);
    circle.setDepth(100);
    this.scene.tweens.add({
      targets: circle,
      radius: this.GROUND_SLAM_RADIUS,
      alpha: 0,
      duration: 400,
      onUpdate: () => {
        circle.setRadius(circle.radius);
      },
      onComplete: () => circle.destroy(),
    });

    // Screen shake
    this.scene.cameras.main.shake(300, 0.008);
  }

  private handleProjectile(): void {
    if (!this.abilities.has('projectile_shot')) return;
    if (this.projectileCooldown > 0) return;
    if (!Phaser.Input.Keyboard.JustDown(this.projectileKey)) return;

    this.projectileCooldown = this.PROJECTILE_COOLDOWN;

    const facingRight = !this.flipX;
    const dirX = facingRight ? 1 : -1;
    const startX = this.x + dirX * 20;
    const startY = this.y;

    // Create projectile sprite
    const projectile = this.scene.add.rectangle(startX, startY, 16, 8, 0x44aaff, 0.9);
    projectile.setDepth(50);
    this.scene.physics.add.existing(projectile);
    const projBody = projectile.body as Phaser.Physics.Arcade.Body;
    projBody.setAllowGravity(false);
    projBody.setVelocityX(this.PROJECTILE_SPEED * dirX);

    const damage = Math.round(
      COMBAT.BASE_DAMAGE * this.PROJECTILE_DAMAGE_MULT * this.classStats.attackDamage,
    );

    let pierceCount = 0;
    const maxPierce = 1; // Pierce one enemy then continue, destroy after second hit
    const hitSet = new Set<any>();
    const originX = startX;

    // Check for enemy collision each frame
    const updateEvent = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!projectile.active) {
          updateEvent.destroy();
          return;
        }

        // Check distance traveled
        const traveled = Math.abs(projectile.x - originX);
        if (traveled >= this.PROJECTILE_RANGE) {
          projectile.destroy();
          updateEvent.destroy();
          return;
        }

        // Check enemy collisions
        const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
        if (!enemies) return;

        enemies.children.each((enemy: any) => {
          if (!enemy.active || hitSet.has(enemy)) return true;
          const dx = enemy.x - projectile.x;
          const dy = enemy.y - projectile.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= 30) {
            enemy.takeDamage(damage);
            hitSet.add(enemy);
            pierceCount++;
            if (pierceCount > maxPierce) {
              projectile.destroy();
              updateEvent.destroy();
            }
          }
          return true;
        });
      },
    });

    // Safety: destroy after 1 second
    this.scene.time.delayedCall(1000, () => {
      if (projectile.active) {
        projectile.destroy();
      }
      updateEvent.destroy();
    });

    // Add glow trail effect
    const trail = this.scene.add.rectangle(startX, startY, 12, 6, 0xaaddff, 0.6);
    trail.setDepth(49);
    this.scene.tweens.add({
      targets: trail,
      x: startX + dirX * 40,
      alpha: 0,
      duration: 200,
      onComplete: () => trail.destroy(),
    });
  }

  private handleChargedAttack(delta: number): void {
    if (!this.abilities.has('charged_attack')) return;

    if (this.chargeKey.isDown) {
      if (!this.isCharging) {
        // Start charging
        this.isCharging = true;
        this.chargeTime = 0;
      }

      // Accumulate charge
      this.chargeTime = Math.min(this.chargeTime + delta, this.MAX_CHARGE_TIME);

      // Slow player to 30% speed while charging
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.velocity.x *= 0.3;

      // Visual: progressive glow tint based on charge percentage
      const chargePercent = this.chargeTime / this.MAX_CHARGE_TIME;
      const r = Math.floor(255);
      const g = Math.floor(255 * chargePercent);
      const b = Math.floor(100 * chargePercent);
      this.setTint(Phaser.Display.Color.GetColor(r, g, b));

      // Create/update glow circle around player
      if (this.chargeGlow) {
        this.chargeGlow.destroy();
      }
      this.chargeGlow = this.scene.add.graphics();
      this.chargeGlow.setDepth(90);
      const glowRadius = 20 + chargePercent * 30;
      const glowAlpha = 0.1 + chargePercent * 0.3;
      this.chargeGlow.fillStyle(0xffaa00, glowAlpha);
      this.chargeGlow.fillCircle(this.x, this.y, glowRadius);
    } else if (this.isCharging) {
      // Release: execute charged attack
      const chargePercent = this.chargeTime / this.MAX_CHARGE_TIME;
      const multiplier = 1.0 + chargePercent * 2.0; // 1x to 3x damage

      const facingRight = !this.flipX;
      const hitboxOffsetX = facingRight ? 50 : -50;
      const hitboxWidth = 100;
      const hitboxHeight = 80;
      const isFullyCharged = this.chargeTime >= this.MAX_CHARGE_TIME * 0.93; // ~2.8s

      // If fully charged, use larger hitbox
      const effectiveWidth = isFullyCharged ? hitboxWidth * 1.5 : hitboxWidth;
      const effectiveHeight = isFullyCharged ? hitboxHeight * 1.5 : hitboxHeight;

      const damage = Math.round(
        COMBAT.BASE_DAMAGE * multiplier * this.classStats.attackDamage,
      );

      // Hit all enemies in the hitbox area
      const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
      if (enemies) {
        const hitX = this.x + hitboxOffsetX;
        const hitY = this.y;

        enemies.children.each((enemy: any) => {
          if (!enemy.active) return true;
          const dx = Math.abs(enemy.x - hitX);
          const dy = Math.abs(enemy.y - hitY);
          if (dx <= effectiveWidth / 2 && dy <= effectiveHeight / 2) {
            enemy.takeDamage(damage);
            // Knockback
            if (enemy.body) {
              enemy.body.velocity.x = facingRight ? 400 : -400;
              enemy.body.velocity.y = -200;
            }
          }
          return true;
        });
      }

      // Visual: attack slash effect
      const slashColor = isFullyCharged ? 0xff4400 : 0xffaa00;
      const slash = this.scene.add.rectangle(
        this.x + hitboxOffsetX,
        this.y,
        effectiveWidth,
        effectiveHeight,
        slashColor,
        0.5,
      );
      slash.setDepth(100);
      this.scene.tweens.add({
        targets: slash,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 300,
        onComplete: () => slash.destroy(),
      });

      // Full charge: screen shake + explosion
      if (isFullyCharged) {
        this.scene.cameras.main.shake(400, 0.012);
        this.scene.cameras.main.flash(200, 255, 100, 0);
      }

      // Reset charging state
      this.isCharging = false;
      this.chargeTime = 0;
      if (this.chargeGlow) {
        this.chargeGlow.destroy();
        this.chargeGlow = null;
      }
      this.clearTint();
    }

    // Update glow position if it exists
    if (this.chargeGlow && this.isCharging) {
      this.chargeGlow.clear();
      const chargePercent = this.chargeTime / this.MAX_CHARGE_TIME;
      const glowRadius = 20 + chargePercent * 30;
      const glowAlpha = 0.1 + chargePercent * 0.3;
      this.chargeGlow.fillStyle(0xffaa00, glowAlpha);
      this.chargeGlow.fillCircle(this.x, this.y, glowRadius);
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

  /** Called by CombatManager when player successfully hits an enemy. */
  public onSuccessfulHit(): void {
    // Reset out-of-combat timer (Health Regen ability)
    this.outOfCombatTimer = 0;
    this.healthRegenTimer = 0;

    // Monk flow state
    if (this.classType === ClassType.MONK) {
      this.flowMeter = Math.min(this.FLOW_MAX, this.flowMeter + this.FLOW_HIT_GAIN);
      this.flowDecayTimer = 0;
      this.emitFlowChange();
    }
  }

  /** Called by MainScene when an enemy is killed (Vampirism ability). */
  public onEnemyKilled(): void {
    if (this.abilities.has('vampirism')) {
      this.vampirismKillCount++;
      if (this.vampirismKillCount >= 10) {
        this.vampirismKillCount = 0;
        if (this.health < this.maxHealth) {
          this.health++;
          EventBus.emit("health-change", { health: this.health, maxHealth: this.maxHealth });
        }
      }
    }
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
    // Gold items always collected (they're abilities, no slot limit)
    if (item.type === 'GOLD') {
      this.applyItem(item);
      return;
    }

    // Silver items — check slot limit
    const silverItems = this.inventory.filter(i => i.type === 'SILVER');
    if (silverItems.length >= this.MAX_SILVER_ITEMS) {
      // Inventory full — store pending item and emit event to show replacement UI
      this.pendingItem = item;
      this.scene.scene.pause();
      EventBus.emit("item-replace-prompt", {
        newItem: item,
        currentItems: silverItems,
      });
      return;
    }

    // Normal collection (has room)
    this.applyItem(item);
  }

  private applyItem(item: ItemData) {
    this.inventory.push(item);
    PersistentStats.addItemCollected();

    if (item.abilityId) {
      this.abilities.add(item.abilityId);
    }

    // Recalculate all item stats (handles quality + synergy for all items)
    this.recalculateItemStats();

    const qualityLabel = item.quality && item.quality !== 'NORMAL'
      ? ` [${item.quality[0] + item.quality.slice(1).toLowerCase()}]`
      : '';
    const text = this.scene.add.text(this.x, this.y - 50, `+ ${item.name}${qualityLabel}`, {
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
    EventBus.emit("synergy-change", { synergies: calculateSynergies(this.inventory) });
  }

  public replaceItem(index: number, newItem: ItemData) {
    const oldItem = this.inventory[index];
    if (oldItem && oldItem.abilityId) {
      this.abilities.delete(oldItem.abilityId);
    }
    // Remove old item from inventory
    this.inventory.splice(index, 1);
    // Apply new item (recalculateItemStats is called inside applyItem)
    this.applyItem(newItem);
  }

  /**
   * Recalculates all item-based stat modifiers from scratch,
   * accounting for quality multipliers and synergy bonuses.
   * Preserves flow-state modifiers (Monk class).
   */
  public recalculateItemStats(): void {
    // Save flow modifiers so we can re-add them after clearing
    const savedFlowMoveSpeed = this.flowMoveSpeedMod;
    const savedFlowJumpHeight = this.flowJumpHeightMod;
    const savedFlowAttackDamage = this.flowAttackDamageMod;

    // Clear all stat modifiers
    this.statModifiers.clear();

    let bonusHealth = 0;

    for (const item of this.inventory) {
      if (item.type !== 'SILVER' || !item.effects) continue;
      const qualityMult = QUALITY_MULTIPLIERS[item.quality ?? 'NORMAL'];
      const synergyMult = getSynergyMultiplier(item, this.inventory);

      for (const effect of item.effects) {
        const scaledValue = effect.value * qualityMult * synergyMult;
        if (effect.targetStat === 'health') {
          bonusHealth += Math.round(scaledValue);
        } else {
          const current = this.statModifiers.get(effect.targetStat) || 0;
          this.statModifiers.set(effect.targetStat, current + scaledValue);
        }
      }
    }

    // Apply health bonus (recalculate from base)
    const baseHealth = this.classStats.health;
    const newMaxHealth = baseHealth + bonusHealth;
    const healthDiff = newMaxHealth - this.maxHealth;
    this.maxHealth = newMaxHealth;
    // If max health increased, grant the extra HP; if decreased, clamp
    if (healthDiff > 0) {
      this.health += healthDiff;
    } else {
      this.health = Math.min(this.health, this.maxHealth);
    }

    // Re-apply flow modifiers (Monk class mechanic)
    if (savedFlowMoveSpeed !== 0) {
      const current = this.statModifiers.get("moveSpeed") || 0;
      this.statModifiers.set("moveSpeed", current + savedFlowMoveSpeed);
    }
    if (savedFlowJumpHeight !== 0) {
      const current = this.statModifiers.get("jumpHeight") || 0;
      this.statModifiers.set("jumpHeight", current + savedFlowJumpHeight);
    }
    if (savedFlowAttackDamage !== 0) {
      const current = this.statModifiers.get("attackDamage") || 0;
      this.statModifiers.set("attackDamage", current + savedFlowAttackDamage);
    }

    EventBus.emit("health-change", {
      health: this.health,
      maxHealth: this.maxHealth,
    });
  }

  public handleReplaceDecision(replaceIndex: number) {
    if (!this.pendingItem) return;
    if (replaceIndex >= 0) {
      // Find the actual inventory index for the silver item at the given silver-index
      const silverIndices: number[] = [];
      this.inventory.forEach((item, idx) => {
        if (item.type === 'SILVER') silverIndices.push(idx);
      });
      const actualIndex = silverIndices[replaceIndex];
      if (actualIndex !== undefined) {
        this.replaceItem(actualIndex, this.pendingItem);
      }
    }
    this.pendingItem = null;
  }
}

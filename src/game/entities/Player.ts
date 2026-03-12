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
import {
  type ComboButton,
  type ComboDefinition,
  COMBO_DEFINITIONS,
  COMBO_WINDOW,
  COMBO_BUFFER,
} from "../systems/ComboDefinitions";
import { SPRITE_CONFIG } from "../config/AnimationConfig";
import { PersistentStats } from "../systems/PersistentStats";
import { GameSettings } from "../systems/GameSettings";
import { CosmeticManager } from "../systems/CosmeticManager";
import { GamepadManager } from "../systems/GamepadManager";
import { TouchControls } from "../systems/TouchControls";
import { KeyBindings } from "../systems/KeyBindings";
import { MouseManager } from "../systems/MouseManager";
import { CoopManager } from "../systems/CoopManager";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private static VALID_PLATFORM_TYPES = new Set(Object.values(PlatformType));

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private touchControls: TouchControls | null = null;

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

  // Combo String State
  private comboStringSequence: ComboButton[] = [];
  private comboStringTimer: number = 0;
  private comboBufferedInput: ComboButton | null = null;
  private currentComboString: ComboDefinition | null = null;
  private comboStringStep: number = 0;
  private comboStringMultiplier: number = 1.0;
  private pendingFinisher: ComboDefinition | null = null;

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

  // Toggle dodge state
  private toggleDodgeActive: boolean = false;
  private toggleDodgeTimeout: number = 0;
  private readonly TOGGLE_DODGE_MAX_DURATION = 500; // ms before auto-cancel

  // Input delay compensation
  private inputBuffer: Array<{ time: number; jump: boolean; dodge: boolean; grapple: boolean }> = [];
  private _delayedJump: boolean = false;
  private _delayedDodge: boolean = false;
  private _delayedGrapple: boolean = false;

  // Double Jump State (supports triple jump when stacked)
  private canDoubleJump: boolean = false;
  private hasDoubleJumped: boolean = false;
  private extraJumpsUsed: number = 0;

  // Air Dash state
  private airDashCooldown: number = 0;
  private hasAirDashed: boolean = false;
  private isAirDashing: boolean = false;
  private airDashTimer: number = 0;
  private readonly AIR_DASH_SPEED = 600;
  private readonly AIR_DASH_DURATION = 150;
  private readonly AIR_DASH_COOLDOWN = 1500;
  private readonly AIR_DASH_COOLDOWN_STACKED = 800;

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


  // Animation State
  private currentAnim: string = "";
  private wasAirborne: boolean = false;
  private isLanding: boolean = false;

  // Cosmetic tint (applied via CLASS_SKIN cosmetic)
  private defaultTint: number = 0xffffff;

  // Invincibility
  private invincibilityTimer: number = 0;
  private flashTimer: number = 0;

  // Platform Surface
  public onSlope: boolean = false;
  public slopeAngle: number = 0;
  public currentPlatformType: PlatformType = PlatformType.STANDARD;
  private wasOnSlope: boolean = false;
  private pendingLaunchVector: { x: number; y: number } | null = null;

  // Co-op player index (0 = solo/P1, 1 = P2)
  public playerIndex: number = 0;

  // Stats & Inventory
  public health: number;
  public maxHealth: number;
  public classType: ClassType;
  public classStats: ClassStats;
  public inventory: ItemData[] = [];
  public abilities: Set<string> = new Set();
  public statModifiers: Map<StatType, number> = new Map();
  private pendingItem: ItemData | null = null;
  private maxSilverItems: number = 1; // Start with 1 slot; gains +1 every 3rd boss

  // Armor (Defense Items)
  private armorHits: number = 0;
  private armorItems: Map<string, number> = new Map(); // itemId -> remaining hits

  // === Gold Ability State ===
  public stackedAbilities: Set<string> = new Set();
  private healthRegenTimer: number = 0;
  private outOfCombatTimer: number = 0;
  private readonly HEALTH_REGEN_INTERVAL = 30000; // 30s
  private readonly HEALTH_REGEN_INTERVAL_STACKED = 20000; // 20s when stacked
  private readonly OUT_OF_COMBAT_THRESHOLD = 5000; // 5s
  private vampirismKillCount: number = 0;
  private hasRevived: boolean = false;
  private tempShieldUsed: boolean = false;
  private tempShieldRechargeTimer: number = 0;
  private readonly TEMP_SHIELD_RECHARGE_TIME = 300000; // 5 minutes

  // Second Wind
  private secondWindUsed: number = 0; // How many times triggered this run

  // Thorns Aura
  private thornsAuraTimer: number = 0;
  private readonly THORNS_AURA_INTERVAL = 1000; // 1 second tick
  private readonly THORNS_AURA_RADIUS = 80; // melee range

  // Absorption Shield
  private absorptionShieldActive: boolean = false;
  private absorptionShieldTimer: number = 0;
  private readonly ABSORPTION_SHIELD_INTERVAL = 30000; // 30s
  private readonly ABSORPTION_SHIELD_INTERVAL_STACKED = 20000; // 20s when stacked

  // Magnet Pull
  private readonly MAGNET_PULL_RANGE = 200;
  private readonly MAGNET_PULL_RANGE_STACKED = 350;
  private readonly MAGNET_PULL_SPEED = 300;

  // Item Radar
  private itemRadarIndicators: Phaser.GameObjects.Graphics[] = [];
  private itemRadarTimer: number = 0;
  private readonly ITEM_RADAR_UPDATE_INTERVAL = 500; // Update indicators every 500ms
  private readonly ITEM_RADAR_RANGE = 800; // Detection range

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
  private readonly TEMPORAL_DURATION_STACKED = 8000;
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

  /** Trigger temporary invincibility (used for co-op respawn, etc.) */
  public makeInvincible(durationMs: number): void {
    this.invincibilityTimer = Math.max(this.invincibilityTimer, durationMs);
    this.flashTimer = 0;
    // Flash effect to show invincibility
    this.setAlpha(0.6);
  }

  get isDodgeActive(): boolean {
    return this.dodgeTimer > 0;
  }


  private get onGround(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.touching.down || body.blocked.down;
  }

  private restoreDefaultTint(): void {
    if (this.defaultTint !== 0xffffff) {
      this.setTint(this.defaultTint);
    } else {
      this.clearTint();
    }
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    classType: ClassType = ClassType.MONK,
    playerIndex: number = 0,
  ) {
    super(scene, x, y, "monk_idle");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.playerIndex = playerIndex;
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

    // Apply equipped class skin cosmetic tint
    const skinId = CosmeticManager.getEquipped('CLASS_SKIN');
    if (skinId) {
      const skinDef = CosmeticManager.getDefinition(skinId);
      // Only apply tint for non-default skins (defaults use the sprite's natural colors)
      if (skinDef && !skinId.endsWith('_default')) {
        this.setTint(skinDef.previewColor);
        this.defaultTint = skinDef.previewColor;
      }
    }

    // Visual differentiation for Player 2 in co-op
    if (this.playerIndex === 1) {
      this.setTint(0xaaddff); // Light blue tint for P2
      this.defaultTint = 0xaaddff;
    }
  }

  public setTouchControls(tc: TouchControls): void {
    this.touchControls = tc;
  }

  private initInput() {
    const bindings = KeyBindings.get();
    const kb = this.scene.input.keyboard!;

    // Build cursor keys from configurable bindings instead of createCursorKeys()
    this.cursors = {
      left: kb.addKey(bindings.moveLeft),
      right: kb.addKey(bindings.moveRight),
      up: kb.addKey(bindings.moveUp),
      down: kb.addKey(bindings.moveDown),
      space: kb.addKey(bindings.jump),
      shift: kb.addKey(bindings.dodge),
    } as Phaser.Types.Input.Keyboard.CursorKeys;

    this.attackBKey = kb.addKey(bindings.attackB);
    this.attackXKey = kb.addKey(bindings.attackX);
    this.attackYKey = kb.addKey(bindings.attackY);
    this.dodgeKey = kb.addKey(bindings.dodge);
    this.grappleKey = kb.addKey(bindings.grapple);

    // Ultimate/Combat Ability Keys
    this.cataclysmKey = kb.addKey(bindings.cataclysm);
    this.temporalKey = kb.addKey(bindings.temporalRift);
    this.divineKey = kb.addKey(bindings.divineIntervention);
    this.essenceBurstKey = kb.addKey(bindings.essenceBurst);

    // Gold Attack Ability Keys
    this.counterKey = kb.addKey(bindings.counterSlash);
    this.groundSlamKey = kb.addKey(bindings.groundSlam);
    this.projectileKey = kb.addKey(bindings.projectile);
    this.chargeKey = kb.addKey(bindings.chargedAttack);
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
    // Determine input source gating for co-op mode
    // Each player gets their own gamepad via GamepadManager.getStateForPlayer(playerIndex)
    // With 2 gamepads: P1 gets gamepad 0, P2 gets gamepad 1
    // With 1 gamepad: P2 gets it, P1 uses keyboard only
    // In solo: P1 gets everything (keyboard + first gamepad)
    const isCoopActive = CoopManager.isActive();
    const useKeyboard = this.playerIndex === 0; // P1 always has keyboard/touch/mouse
    const useGamepad = true; // Always — GamepadManager routes per playerIndex
    const useTouchMouse = this.playerIndex === 0; // Only P1

    // Gamepad state is polled once per frame in MainScene.update() before this call
    const gp = GamepadManager.getStateForPlayer(this.playerIndex);

    // Cache JustDown once per frame — Phaser consumes it on first read
    // OR with gamepad, touch, and mouse inputs so all input methods work simultaneously
    const tc = useTouchMouse ? this.touchControls : null;
    const rawJump = (useKeyboard ? Phaser.Input.Keyboard.JustDown(this.cursors.space!) : false)
      || (useGamepad ? gp.jumpJustPressed : false)
      || (tc?.isButtonJustPressed('A') ?? false);
    let rawDodge = (useKeyboard ? Phaser.Input.Keyboard.JustDown(this.dodgeKey) : false)
      || (useGamepad ? gp.dodgeJustPressed : false)
      || (tc?.isButtonJustPressed('X') ?? false)
      || (useTouchMouse && GameSettings.get().mouseAttackEnabled && MouseManager.isRightClicked());
    const rawGrapple = (useKeyboard ? Phaser.Input.Keyboard.JustDown(this.grappleKey) : false)
      || (useGamepad ? gp.grappleJustPressed : false);

    // Toggle dodge: pressing dodge toggles the dodge state on/off
    const settings = GameSettings.get();
    if (settings.toggleDodge) {
      if (rawDodge) {
        if (this.toggleDodgeActive) {
          this.toggleDodgeActive = false;
          rawDodge = false;
        } else if (this.dodgeTimer <= 0) {
          this.toggleDodgeActive = true;
          this.toggleDodgeTimeout = this.TOGGLE_DODGE_MAX_DURATION;
        }
      }
      if (this.toggleDodgeActive) {
        this.toggleDodgeTimeout -= delta;
        if (this.toggleDodgeTimeout <= 0 || this.dodgeTimer <= 0) {
          if (this.dodgeTimer <= 0) {
            this.toggleDodgeActive = false;
          }
        }
      }
    }

    // Input delay compensation
    const inputDelay = settings.inputDelay;
    if (inputDelay > 0) {
      this.inputBuffer.push({
        time: time,
        jump: rawJump,
        dodge: rawDodge,
        grapple: rawGrapple,
      });

      this._delayedJump = false;
      this._delayedDodge = false;
      this._delayedGrapple = false;

      const cutoff = time - inputDelay;
      while (this.inputBuffer.length > 0 && this.inputBuffer[0].time <= cutoff) {
        const input = this.inputBuffer.shift()!;
        if (input.jump) this._delayedJump = true;
        if (input.dodge) this._delayedDodge = true;
        if (input.grapple) this._delayedGrapple = true;
      }

      this.jumpJustPressed = this._delayedJump;
      this.dodgeJustPressed = this._delayedDodge;
      this.grappleJustPressed = this._delayedGrapple;

      if (this.inputBuffer.length > 60) {
        this.inputBuffer = this.inputBuffer.slice(-30);
      }
    } else {
      this.jumpJustPressed = rawJump;
      this.dodgeJustPressed = rawDodge;
      this.grappleJustPressed = rawGrapple;
    }

    this.updateTimers(delta);
    this.handleMovement();

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
    this.updateItemRadar(delta);
    this.updateAnimation();

    // Safety net: re-enable gravity if it's off and we're not in a state that needs it off
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body.allowGravity && !this.onSlope && !this.isAirDashing) {
      body.setAllowGravity(true);
    }
  }

  private updateTimers(delta: number) {
    // Use GameSettings values for coyote time and jump buffer (with PHYSICS as fallback)
    const accessSettings = GameSettings.get();
    const coyoteTime = accessSettings.coyoteTimeWindow ?? PHYSICS.COYOTE_TIME;
    const jumpBuffer = accessSettings.jumpBufferWindow ?? PHYSICS.JUMP_BUFFER;

    if (this.onGround) {
      this.coyoteTimer = coyoteTime;
    } else {
      this.coyoteTimer -= delta;
    }

    if (this.jumpJustPressed) {
      this.jumpBufferTimer = jumpBuffer;
    } else {
      this.jumpBufferTimer -= delta;
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.currentAttackId = null;
      }
    }

    // Combo string timer
    if (this.comboStringTimer > 0) {
      this.comboStringTimer -= delta;
      if (this.comboStringTimer <= 0) {
        this.comboStringSequence = [];
        this.currentComboString = null;
        this.comboStringStep = 0;
      }
    }

    // Ultimate ability cooldowns
    if (this.cataclysmCooldown > 0) this.cataclysmCooldown -= delta;
    if (this.temporalCooldown > 0) this.temporalCooldown -= delta;
    if (this.divineCooldown > 0) this.divineCooldown -= delta;


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
        if (this.active) this.restoreDefaultTint();
      }
    }

    // Health Regen tracking (Gold ability: health_regen)
    if (this.abilities.has('health_regen')) {
      this.outOfCombatTimer += delta;
      if (this.outOfCombatTimer >= this.OUT_OF_COMBAT_THRESHOLD) {
        this.healthRegenTimer += delta;
        const regenInterval = this.stackedAbilities.has('health_regen')
          ? this.HEALTH_REGEN_INTERVAL_STACKED
          : this.HEALTH_REGEN_INTERVAL;
        if (this.healthRegenTimer >= regenInterval) {
          this.healthRegenTimer = 0;
          if (this.health < this.maxHealth) {
            this.health++;
            EventBus.emit("health-change", { health: this.health, maxHealth: this.maxHealth });
          }
        }
      }
    }

    // Temp Shield recharge timer (stacked guardian_angel: second use after 5 min)
    if (this.tempShieldUsed && this.stackedAbilities.has('temp_shield') && this.tempShieldRechargeTimer > 0) {
      this.tempShieldRechargeTimer -= delta;
      if (this.tempShieldRechargeTimer <= 0) {
        this.tempShieldUsed = false; // Allow second activation
        this.tempShieldRechargeTimer = 0;
      }
    }

    // Thorns Aura: periodically damage nearby enemies
    if (this.abilities.has('thorns_aura')) {
      this.thornsAuraTimer += delta;
      if (this.thornsAuraTimer >= this.THORNS_AURA_INTERVAL) {
        this.thornsAuraTimer = 0;
        this.applyThornsAuraDamage();
      }
    }

    // Absorption Shield: regenerate shield over time
    if (this.abilities.has('absorption_shield')) {
      if (!this.absorptionShieldActive) {
        this.absorptionShieldTimer += delta;
        const rechargeTime = this.stackedAbilities.has('absorption_shield')
          ? this.ABSORPTION_SHIELD_INTERVAL_STACKED
          : this.ABSORPTION_SHIELD_INTERVAL;
        if (this.absorptionShieldTimer >= rechargeTime) {
          this.absorptionShieldActive = true;
          this.absorptionShieldTimer = 0;
          // Visual: brief cyan flash to indicate shield ready
          if (this.active) {
            this.setTint(0x4488cc);
            this.scene.time.delayedCall(300, () => {
              if (this.active && !this.isInvincible) this.restoreDefaultTint();
            });
          }
        }
      }
    }

    // Magnet Pull: attract nearby items toward the player
    if (this.abilities.has('magnet_pull')) {
      this.applyMagnetPull();
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
      this.restoreDefaultTint();
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
    const gpState = GamepadManager.getStateForPlayer(this.playerIndex);
    const isCoopMove = CoopManager.isActive();
    const useKeyboardMove = this.playerIndex === 0;
    const useGamepadMove = !isCoopMove || this.playerIndex === 1;
    const tcMove = useKeyboardMove ? this.touchControls?.getMovement() : null;
    const moveLeft = (useKeyboardMove && left.isDown) || (useGamepadMove && gpState.moveX < -0.2) || (tcMove != null && tcMove.x < -0.2);
    const moveRight = (useKeyboardMove && right.isDown) || (useGamepadMove && gpState.moveX > 0.2) || (tcMove != null && tcMove.x > 0.2);
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

    // Speed Demon ability: +30% move speed (stacked: +60%)
    if (this.abilities.has('speed_demon')) {
      moveSpeed *= this.stackedAbilities.has('speed_demon') ? 1.6 : 1.3;
    }

    // Platform speed modifiers
    if (platType === PlatformType.STICKY && onGround) {
      moveSpeed *= PLATFORM_CONFIG.STICKY_SPEED_MULT;
    }

    // Platform-specific acceleration
    let accel = PHYSICS.ACCELERATION;
    if (platType === PlatformType.ICE && onGround) {
      accel *= PLATFORM_CONFIG.ICE_ACCEL_MULT;
    }

    if (moveLeft) {
      this.setAccelerationX(-accel);
      this.setFlipX(true);
    } else if (moveRight) {
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
      this.extraJumpsUsed = 0;
    }

    // Initial Jump (coyote + buffer)
    if (wantsToJump && canJump) {
      // Running jump bonus: up to 15% extra height based on horizontal speed
      const hSpeed = Math.abs(this.body!.velocity.x);
      const maxSpeed = this.getStat("moveSpeed", PHYSICS.MOVE_SPEED, this.classStats.moveSpeed);
      const speedRatio = Math.min(hSpeed / maxSpeed, 1);
      const runningJumpForce = jumpForce * (1 + speedRatio * 0.15);

      this.setVelocityY(runningJumpForce);
      this.onSlope = false;
      this.wasOnSlope = false;
      this.isJumping = true;
      this.jumpTimer = 0;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }
    // Double Jump (Triple Jump when stacked)
    else if (
      this.jumpJustPressed &&
      !canJump &&
      this.canDoubleJump &&
      this.abilities.has("double_jump")
    ) {
      // Max extra jumps: 2 if stacked (triple jump), 1 otherwise (double jump)
      const maxExtraJumps = this.stackedAbilities.has("double_jump") ? 2 : 1;
      if (this.extraJumpsUsed < maxExtraJumps) {
        this.setVelocityY(jumpForce * PHYSICS.DOUBLE_JUMP_MULTIPLIER);
        this.extraJumpsUsed++;
        this.hasDoubleJumped = this.extraJumpsUsed >= maxExtraJumps;
        this.isJumping = true;
        this.jumpTimer = 0;

        const particle = this.scene.add.circle(
          this.x,
          this.y + 20,
          10,
          this.stackedAbilities.has("double_jump") ? 0xff8c00 : 0xffd700,
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
    }

    // Variable jump height (hold button): apply additional upward force while held
    const _gpJump = GamepadManager.getStateForPlayer(this.playerIndex);
    const isCoopJump = CoopManager.isActive();
    const useKeyboardJump = this.playerIndex === 0;
    const useGamepadJump = !isCoopJump || this.playerIndex === 1;
    const jumpHeld = (useKeyboardJump && (this.cursors.space?.isDown ?? false))
      || (useGamepadJump && _gpJump.jump)
      || (useKeyboardJump && (this.touchControls?.isButtonPressed('A') ?? false));
    if (this.isJumping && jumpHeld && !this.isWallSliding) {
      this.jumpTimer += delta;
      if (this.jumpTimer < PHYSICS.JUMP_HOLD_DURATION) {
        this.setVelocityY(this.body!.velocity.y + PHYSICS.JUMP_HOLD_FORCE);
      }
    }

    // Cut jump short on early release: halve upward velocity for a "short hop" feel
    if (this.isJumping && !jumpHeld) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      if (body.velocity.y < 0) {
        body.velocity.y *= 0.5;
      }
      this.isJumping = false;
    } else if (this.jumpTimer >= PHYSICS.JUMP_HOLD_DURATION) {
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
      const gpWall = GamepadManager.getStateForPlayer(this.playerIndex);
      const isCoopWall = CoopManager.isActive();
      const useKeyboardWall = this.playerIndex === 0;
      const useGamepadWall = !isCoopWall || this.playerIndex === 1;
      const tcWall = useKeyboardWall ? this.touchControls?.getMovement() : null;
      const holdingTowardWall =
        (onLeftWall && ((useKeyboardWall && this.cursors.left.isDown) || (useGamepadWall && gpWall.moveX < -0.2) || (tcWall != null && tcWall.x < -0.2))) ||
        (onRightWall && ((useKeyboardWall && this.cursors.right.isDown) || (useGamepadWall && gpWall.moveX > 0.2) || (tcWall != null && tcWall.x > 0.2)));

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
        this.extraJumpsUsed = 0;
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
        // Buffer input during RECOVERY within the buffer window before it ends
        const totalAttackTime = attackDef.startup + attackDef.hitbox.duration + attackDef.recovery;
        const timeUntilEnd = totalAttackTime - this.attackTimer;

        if (timeUntilEnd <= COMBO_BUFFER && !this.comboBufferedInput) {
          const gpBuf = GamepadManager.getStateForPlayer(this.playerIndex);
          const isCoopBuf = CoopManager.isActive();
          const useKeyboardBuf = this.playerIndex === 0;
          const useGamepadBuf = !isCoopBuf || this.playerIndex === 1;
          const tcBuf = useKeyboardBuf ? this.touchControls : null;
          if ((useKeyboardBuf && Phaser.Input.Keyboard.JustDown(this.attackBKey)) || (useGamepadBuf && gpBuf.attackBJustPressed) || (tcBuf?.isButtonJustPressed('B') ?? false)) {
            this.comboBufferedInput = 'B';
          } else if ((useKeyboardBuf && Phaser.Input.Keyboard.JustDown(this.attackXKey)) || (useGamepadBuf && gpBuf.attackXJustPressed)) {
            this.comboBufferedInput = 'X';
          } else if ((useKeyboardBuf && Phaser.Input.Keyboard.JustDown(this.attackYKey)) || (useGamepadBuf && gpBuf.attackYJustPressed) || (tcBuf?.isButtonJustPressed('Y') ?? false)) {
            this.comboBufferedInput = 'Y';
          }
        }

        if (this.attackTimer >= totalAttackTime) {
          this.endAttack();
        }
      }
    }

    const canAttack = !this.isAttacking || this.attackState === "RECOVERY";

    const gpCombat = GamepadManager.getStateForPlayer(this.playerIndex);
    const isCoopCombat = CoopManager.isActive();
    const useKeyboardCombat = this.playerIndex === 0;
    const useGamepadCombat = !isCoopCombat || this.playerIndex === 1;
    const tcCombat = useKeyboardCombat ? this.touchControls : null;
    const mouseAttack = useKeyboardCombat && GameSettings.get().mouseAttackEnabled;
    if (canAttack && !this.isWallSliding) {
      if ((useKeyboardCombat && Phaser.Input.Keyboard.JustDown(this.attackBKey)) || (useGamepadCombat && gpCombat.attackBJustPressed) || (tcCombat?.isButtonJustPressed('B') ?? false) || (mouseAttack && MouseManager.isLeftClicked())) {
        this.handleComboInput('B');
        this.tryAttack(AttackType.LIGHT);
      } else if ((useKeyboardCombat && Phaser.Input.Keyboard.JustDown(this.attackXKey)) || (useGamepadCombat && gpCombat.attackXJustPressed) || (mouseAttack && MouseManager.isMiddleClicked())) {
        this.handleComboInput('X');
        this.tryAttack(AttackType.HEAVY);
      } else if ((useKeyboardCombat && Phaser.Input.Keyboard.JustDown(this.attackYKey)) || (useGamepadCombat && gpCombat.attackYJustPressed) || (tcCombat?.isButtonJustPressed('Y') ?? false)) {
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
        this.handleComboInput('Y');
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

        // Stacked Dodge Mastery: spawn damaging afterimage trail
        if (this.stackedAbilities.has('dodge_mastery')) {
          this.spawnDodgeAfterimages();
        }

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
      const { left: dodgeLeft, right: dodgeRight } = this.cursors;
      const gpDodge = GamepadManager.getStateForPlayer(this.playerIndex);
      const isCoopDodge = CoopManager.isActive();
      const useKeyboardDodge = this.playerIndex === 0;
      const useGamepadDodge = !isCoopDodge || this.playerIndex === 1;
      let dodgeDir: number;
      if ((useKeyboardDodge && dodgeLeft.isDown) || (useGamepadDodge && gpDodge.moveX < -0.2)) {
        dodgeDir = -1;
      } else if ((useKeyboardDodge && dodgeRight.isDown) || (useGamepadDodge && gpDodge.moveX > 0.2)) {
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
      this.airDashCooldown = this.stackedAbilities.has('air_dash')
        ? this.AIR_DASH_COOLDOWN_STACKED
        : this.AIR_DASH_COOLDOWN;

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
          this.restoreDefaultTint();
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

  private spawnDodgeAfterimages(): void {
    // Spawn 3 afterimage damage zones along the dodge path
    const afterimageCount = 3;
    const spacing = 40; // pixels between afterimages
    const facingDir = this.flipX ? -1 : 1;
    const afterimageDamage = Math.max(1, Math.round(COMBAT.BASE_DAMAGE * 0.2 * this.classStats.attackDamage));

    for (let i = 0; i < afterimageCount; i++) {
      const offsetX = -facingDir * spacing * (i + 1); // Trail behind the dodge direction
      const ax = this.x + offsetX;
      const ay = this.y;

      // Create visual afterimage (semi-transparent rectangle representing player silhouette)
      const afterimage = this.scene.add.rectangle(
        ax, ay,
        this.width * 0.8, this.height * 0.9,
        0x8844ff, 0.5,
      );
      afterimage.setDepth(this.depth - 1);

      // Fade out over 0.5s
      this.scene.tweens.add({
        targets: afterimage,
        alpha: 0,
        duration: 500,
        onComplete: () => afterimage.destroy(),
      });

      // Check for enemy collisions in the afterimage area
      const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
      if (enemies) {
        const hitArea = new Phaser.Geom.Rectangle(
          ax - this.width * 0.4,
          ay - this.height * 0.45,
          this.width * 0.8,
          this.height * 0.9,
        );

        enemies.getChildren().forEach((enemy: any) => {
          if (
            enemy.active &&
            typeof enemy.takeDamage === "function" &&
            hitArea.contains(enemy.x, enemy.y)
          ) {
            enemy.takeDamage(afterimageDamage);
          }
        });
      }
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
    const gpAttack = GamepadManager.getStateForPlayer(this.playerIndex);
    const isCoopAttack = CoopManager.isActive();
    const useKeyboardAttack = this.playerIndex === 0;
    const useGamepadAttack = !isCoopAttack || this.playerIndex === 1;
    let direction: AttackDirection = AttackDirection.NEUTRAL;
    if ((useKeyboardAttack && this.cursors.up.isDown) || (useGamepadAttack && gpAttack.moveY < -0.5)) direction = AttackDirection.UP;
    else if ((useKeyboardAttack && this.cursors.down.isDown) || (useGamepadAttack && gpAttack.moveY > 0.5)) direction = AttackDirection.DOWN;

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
    this.restoreDefaultTint();
    this.comboTimer = COMBAT.COMBO_WINDOW;

    // Reset combo string damage multiplier after the attack ends
    if (this.comboStringMultiplier !== 1.0) {
      const current = this.statModifiers.get("attackDamage") || 0;
      this.statModifiers.set("attackDamage", current - (this.comboStringMultiplier - 1.0));
      this.comboStringMultiplier = 1.0;
    }
    this.pendingFinisher = null;

    // Process buffered input from combo string
    if (this.comboBufferedInput) {
      const buffered = this.comboBufferedInput;
      this.comboBufferedInput = null;
      this.handleComboInput(buffered);
      const attackType = buffered === 'B' ? AttackType.LIGHT
        : buffered === 'X' ? AttackType.HEAVY
        : AttackType.SPECIAL;
      this.tryAttack(attackType);
    }
  }

  private handleComboInput(button: ComboButton): void {
    // Add to sequence
    this.comboStringSequence.push(button);
    this.comboStringTimer = COMBO_WINDOW;

    // Check for matching combos
    const isAerial = !this.onGround;
    const matching = COMBO_DEFINITIONS.filter(combo => {
      if (combo.aerial !== isAerial) return false;
      // Check if current sequence matches the start of this combo
      if (this.comboStringSequence.length > combo.sequence.length) return false;
      for (let i = 0; i < this.comboStringSequence.length; i++) {
        if (this.comboStringSequence[i] !== combo.sequence[i]) return false;
      }
      return true;
    });

    if (matching.length === 0) {
      // No combos match — reset sequence to just this button, try to start fresh
      this.comboStringSequence = [button];
      this.currentComboString = null;
      this.comboStringStep = 0;

      // Re-check with the single-button sequence for a fresh combo start
      const freshMatch = COMBO_DEFINITIONS.filter(combo => {
        if (combo.aerial !== isAerial) return false;
        return combo.sequence[0] === button;
      });
      if (freshMatch.length > 0) {
        this.currentComboString = freshMatch[0];
        this.comboStringStep = 1;
      }
    } else {
      // Check if any combo is complete
      const complete = matching.find(c => c.sequence.length === this.comboStringSequence.length);
      if (complete) {
        this.executeComboFinisher(complete);
        this.comboStringSequence = [];
        this.currentComboString = null;
        this.comboStringStep = 0;
      } else {
        // Partial match — combo in progress
        this.currentComboString = matching[0]; // Best match
        this.comboStringStep = this.comboStringSequence.length;
      }
    }
  }

  private executeComboFinisher(combo: ComboDefinition): void {
    // Apply bonus damage multiplier to the current attack via statModifiers
    // This will be picked up by CombatManager.calculateDamage through attackDamage modifier
    this.comboStringMultiplier = combo.damageMultiplier;
    const current = this.statModifiers.get("attackDamage") || 0;
    this.statModifiers.set("attackDamage", current + (combo.damageMultiplier - 1.0));

    // Store pending finisher for knockback effect on hit
    if (combo.finisherEffect) {
      this.pendingFinisher = combo;
    }

    // Emit combo event for HUD
    EventBus.emit('combo-string', { name: combo.name, multiplier: combo.damageMultiplier });

    // Visual feedback: screen shake for heavy finishers
    if (combo.damageMultiplier >= 1.3) {
      const settings = GameSettings.get();
      const shakeLevel = settings.screenShakeIntensity;
      if (shakeLevel !== 'OFF') {
        const intensityMult = shakeLevel === 'LOW' ? 0.4 : shakeLevel === 'MEDIUM' ? 1.0 : 1.5;
        const flashReduce = settings.flashReduction;
        const baseIntensity = 0.004 * (flashReduce ? 0.3 : 1);
        this.scene.cameras.main.shake(
          100 * intensityMult,
          baseIntensity * intensityMult,
        );
      }
    }
  }

  private resetComboString(): void {
    this.comboStringSequence = [];
    this.comboStringTimer = 0;
    this.currentComboString = null;
    this.comboStringStep = 0;
    this.comboBufferedInput = null;
    // Clean up any active combo multiplier from statModifiers
    if (this.comboStringMultiplier !== 1.0) {
      const current = this.statModifiers.get("attackDamage") || 0;
      this.statModifiers.set("attackDamage", current - (this.comboStringMultiplier - 1.0));
      this.comboStringMultiplier = 1.0;
    }
    this.pendingFinisher = null;
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
            if (this.active) this.restoreDefaultTint();
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
        if (this.active) this.restoreDefaultTint();
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
      this.restoreDefaultTint();
    }

    // Absorption Shield: absorb 1 hit if shield is active (regenerates over time)
    if (this.absorptionShieldActive) {
      this.absorptionShieldActive = false;
      this.absorptionShieldTimer = 0;
      // Visual feedback: cyan flash for shield absorb
      if (!GameSettings.get().flashReduction) {
        this.setTint(0x4488cc);
        this.scene.time.delayedCall(200, () => {
          if (this.active) this.restoreDefaultTint();
        });
      }
      this.scene.cameras.main.shake(50, 0.003);
      EventBus.emit('health-change', { health: this.health, maxHealth: this.maxHealth });
      return false; // Damage absorbed by shield
    }

    // Armor absorb: check armor AFTER dodge/parry/invincibility/counter but BEFORE damage
    if (this.armorHits > 0) {
      // Find which armor item to decrement
      for (const [itemId, hits] of this.armorItems.entries()) {
        if (hits > 0) {
          const newHits = hits - 1;
          this.armorItems.set(itemId, newHits);
          this.armorHits--;
          if (newHits <= 0) {
            // Armor broken! Remove the item from inventory
            this.removeArmorItem(itemId);
          }
          break;
        }
      }
      // Visual feedback: blue flash for armor absorb
      if (!GameSettings.get().flashReduction) {
        this.setTint(0x4488ff);
        this.scene.time.delayedCall(200, () => {
          if (this.active) this.restoreDefaultTint();
        });
      }
      // Brief screen shake
      this.scene.cameras.main.shake(50, 0.003);
      // Update HUD
      EventBus.emit('health-change', { health: this.health, maxHealth: this.maxHealth });
      return false; // Damage absorbed
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

    // Reset combo string on taking damage
    this.resetComboString();

    // Stacked Damage Reflection: reflect additional 30% (total 60%) from Player side
    // Base 30% is handled by CombatManager; stacked adds another 30% here
    if (this.stackedAbilities.has('damage_reflect') && attackerRef && attackerRef.active && typeof attackerRef.takeDamage === 'function') {
      const extraReflect = Math.max(1, Math.round(amount * 0.3));
      attackerRef.takeDamage(extraReflect);
    }

    // Second Wind ability: heal to full HP once when dropping to 0 or below
    // (stacked: can trigger twice per run)
    if (this.health <= 0 && this.abilities.has('second_wind')) {
      const maxUses = this.stackedAbilities.has('second_wind') ? 2 : 1;
      if (this.secondWindUsed < maxUses) {
        this.secondWindUsed++;
        this.health = this.maxHealth;
        this.invincibilityTimer = 2000; // 2s invincibility on second wind
        this.flashTimer = 0;
        // Green flash effect
        this.setTint(0x44ff88);
        this.scene.time.delayedCall(500, () => {
          if (this.active) this.restoreDefaultTint();
        });
        EventBus.emit("health-change", {
          health: this.health,
          maxHealth: this.maxHealth,
        });
        return false; // Don't die
      }
    }

    // Revive ability: prevent death once per run (revive at 1 HP)
    if (this.health <= 0 && this.abilities.has('revive') && !this.hasRevived) {
      this.hasRevived = true;
      this.health = 1;
      this.invincibilityTimer = 3000; // 3s invincibility on revive
      this.flashTimer = 0;
      // Gold flash effect
      this.setTint(0xffd700);
      this.scene.time.delayedCall(500, () => {
        if (this.active) this.restoreDefaultTint();
      });
      EventBus.emit("health-change", {
        health: this.health,
        maxHealth: this.maxHealth,
      });
      return false; // Don't die
    }

    // Temporary Shield ability: invincibility when health drops to 1 (once per run, or twice if stacked)
    if (this.health === 1 && this.abilities.has('temp_shield') && !this.tempShieldUsed) {
      this.tempShieldUsed = true;
      this.invincibilityTimer = 3000;
      this.flashTimer = 0;
      // Golden shield flash
      this.setTint(0xffdd44);
      this.scene.time.delayedCall(3000, () => {
        if (this.active) this.restoreDefaultTint();
      });
      // Stacked: start recharge timer for second activation
      if (this.stackedAbilities.has('temp_shield')) {
        this.tempShieldRechargeTimer = this.TEMP_SHIELD_RECHARGE_TIME;
      }
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
      EventBus.emit("player-died", { playerIndex: this.playerIndex });
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
        this.restoreDefaultTint();
      }
    });

    // Clear parry tint when invincibility ends
    this.scene.time.delayedCall(this.PARRY_INVINCIBILITY_DURATION, () => {
      if (this.active && !this.isInvincible) {
        this.restoreDefaultTint();
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
    const _gpCataclysm = GamepadManager.getStateForPlayer(this.playerIndex);
    const _isCoopCataclysm = CoopManager.isActive();
    const _useKbCataclysm = this.playerIndex === 0;
    const _useGpCataclysm = !_isCoopCataclysm || this.playerIndex === 1;
    if (!(_useKbCataclysm && Phaser.Input.Keyboard.JustDown(this.cataclysmKey)) && !(_useGpCataclysm && _gpCataclysm.cataclysmJustPressed) && !(_useKbCataclysm && (this.touchControls?.wasSwipeDetected('up') ?? false))) return;

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
    const _gpTemporal = GamepadManager.getStateForPlayer(this.playerIndex);
    const _isCoopTemporal = CoopManager.isActive();
    const _useKbTemporal = this.playerIndex === 0;
    const _useGpTemporal = !_isCoopTemporal || this.playerIndex === 1;
    if (!(_useKbTemporal && Phaser.Input.Keyboard.JustDown(this.temporalKey)) && !(_useGpTemporal && _gpTemporal.temporalRiftJustPressed) && !(_useKbTemporal && (this.touchControls?.wasSwipeDetected('up') ?? false))) return;

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
    const temporalDuration = this.stackedAbilities.has('temporal_rift')
      ? this.TEMPORAL_DURATION_STACKED
      : this.TEMPORAL_DURATION;
    this.scene.time.delayedCall(temporalDuration * this.TEMPORAL_SLOW, () => {
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
    const _gpDivine = GamepadManager.getStateForPlayer(this.playerIndex);
    const _isCoopDivine = CoopManager.isActive();
    const _useKbDivine = this.playerIndex === 0;
    const _useGpDivine = !_isCoopDivine || this.playerIndex === 1;
    if (!(_useKbDivine && Phaser.Input.Keyboard.JustDown(this.divineKey)) && !(_useGpDivine && _gpDivine.divineInterventionJustPressed) && !(_useKbDivine && (this.touchControls?.wasSwipeDetected('up') ?? false))) return;

    this.divineCooldown = this.DIVINE_COOLDOWN;
    this.invincibilityTimer = this.DIVINE_DURATION;

    // Golden glow effect
    this.setTint(0xffd700);
    this.scene.time.delayedCall(this.DIVINE_DURATION, () => {
      this.restoreDefaultTint();
    });

    // Camera flash
    this.scene.cameras.main.flash(300, 255, 215, 0);
  }

  private handleEssenceBurst(): void {
    if (!this.abilities.has('essence_burst')) return;
    if (this.essenceBurstActive) return;
    const _gpEssence = GamepadManager.getStateForPlayer(this.playerIndex);
    const _isCoopEssence = CoopManager.isActive();
    const _useKbEssence = this.playerIndex === 0;
    const _useGpEssence = !_isCoopEssence || this.playerIndex === 1;
    if (!(_useKbEssence && Phaser.Input.Keyboard.JustDown(this.essenceBurstKey)) && !(_useGpEssence && _gpEssence.essenceBurstJustPressed) && !(_useKbEssence && (this.touchControls?.wasSwipeDetected('up') ?? false))) return;

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
      this.restoreDefaultTint();
    });
  }

  // ─── Gold Attack Abilities ─────────────────────────────────────────

  private handleCounterSlash(): void {
    if (!this.abilities.has('counter_stance')) return;
    if (this.counterCooldown > 0) return;
    if (this.counterStanceActive) return;
    const _gpCounter = GamepadManager.getStateForPlayer(this.playerIndex);
    const _isCoopCounter = CoopManager.isActive();
    const _useKbCounter = this.playerIndex === 0;
    const _useGpCounter = !_isCoopCounter || this.playerIndex === 1;
    if (!(_useKbCounter && Phaser.Input.Keyboard.JustDown(this.counterKey)) && !(_useGpCounter && _gpCounter.counterSlashJustPressed)) return;

    // Activate counter stance
    this.counterStanceActive = true;
    this.counterStanceTimer = this.COUNTER_STANCE_DURATION;

    // Visual: orange tint while in stance
    this.setTint(0xff8844);
  }

  private handleGroundSlam(): void {
    if (!this.abilities.has('ground_slam')) return;
    if (this.groundSlamCooldown > 0) return;
    const _gpGroundSlam = GamepadManager.getStateForPlayer(this.playerIndex);
    const _isCoopGroundSlam = CoopManager.isActive();
    const _useKbGroundSlam = this.playerIndex === 0;
    const _useGpGroundSlam = !_isCoopGroundSlam || this.playerIndex === 1;
    if (!(_useKbGroundSlam && Phaser.Input.Keyboard.JustDown(this.groundSlamKey)) && !(_useGpGroundSlam && _gpGroundSlam.groundSlamJustPressed)) return;

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
    const _gpProjectile = GamepadManager.getStateForPlayer(this.playerIndex);
    const _isCoopProjectile = CoopManager.isActive();
    const _useKbProjectile = this.playerIndex === 0;
    const _useGpProjectile = !_isCoopProjectile || this.playerIndex === 1;
    if (!(_useKbProjectile && Phaser.Input.Keyboard.JustDown(this.projectileKey)) && !(_useGpProjectile && _gpProjectile.groundSlamJustPressed)) return;

    this.projectileCooldown = this.PROJECTILE_COOLDOWN;

    // Determine projectile direction: use mouse aim if enabled, else use facing direction
    let dirX: number;
    let dirY: number;
    if (GameSettings.get().mouseAimEnabled) {
      const aim = MouseManager.getAimDirection();
      dirX = aim.x;
      dirY = aim.y;
    } else {
      const facingRight = !this.flipX;
      dirX = facingRight ? 1 : -1;
      dirY = 0;
    }

    const startX = this.x + dirX * 20;
    const startY = this.y + dirY * 20;

    // Create projectile sprite
    const projectile = this.scene.add.rectangle(startX, startY, 16, 8, 0x44aaff, 0.9);
    projectile.setDepth(50);
    this.scene.physics.add.existing(projectile);
    const projBody = projectile.body as Phaser.Physics.Arcade.Body;
    projBody.setAllowGravity(false);
    projBody.setVelocityX(this.PROJECTILE_SPEED * dirX);
    projBody.setVelocityY(this.PROJECTILE_SPEED * dirY);

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

    const _gpCharge = GamepadManager.getStateForPlayer(this.playerIndex);
    const _isCoopCharge = CoopManager.isActive();
    const _useKbCharge = this.playerIndex === 0;
    const _useGpCharge = !_isCoopCharge || this.playerIndex === 1;
    if ((_useKbCharge && this.chargeKey.isDown) || (_useGpCharge && _gpCharge.counterSlash)) {
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
      this.restoreDefaultTint();
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

  // ─── Gold Passive Ability Helpers ────────────────────────────────────

  private applyThornsAuraDamage(): void {
    const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
    if (!enemies) return;

    const damage = this.stackedAbilities.has('thorns_aura') ? 2 : 1;

    enemies.children.each((enemy: any) => {
      if (!enemy.active || typeof enemy.takeDamage !== 'function') return true;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.THORNS_AURA_RADIUS) {
        enemy.takeDamage(damage);
      }
      return true;
    });
  }

  private applyMagnetPull(): void {
    const items = (this.scene as any).items as Phaser.Physics.Arcade.Group;
    if (!items) return;

    const pullRange = this.stackedAbilities.has('magnet_pull')
      ? this.MAGNET_PULL_RANGE_STACKED
      : this.MAGNET_PULL_RANGE;

    items.children.each((item: any) => {
      if (!item.active) return true;
      const dx = this.x - item.x;
      const dy = this.y - item.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= pullRange && dist > 5) {
        // Move item toward player
        const nx = dx / dist;
        const ny = dy / dist;
        item.x += nx * this.MAGNET_PULL_SPEED * (this.scene.game.loop.delta / 1000);
        item.y += ny * this.MAGNET_PULL_SPEED * (this.scene.game.loop.delta / 1000);
      }
      return true;
    });
  }

  private updateItemRadar(delta: number): void {
    if (!this.abilities.has('item_radar')) {
      // Clean up any existing indicators
      if (this.itemRadarIndicators.length > 0) {
        this.itemRadarIndicators.forEach(g => g.destroy());
        this.itemRadarIndicators = [];
      }
      return;
    }

    this.itemRadarTimer += delta;
    if (this.itemRadarTimer < this.ITEM_RADAR_UPDATE_INTERVAL) return;
    this.itemRadarTimer = 0;

    // Destroy old indicators
    this.itemRadarIndicators.forEach(g => g.destroy());
    this.itemRadarIndicators = [];

    const items = (this.scene as any).items as Phaser.Physics.Arcade.Group;
    if (!items) return;

    const camera = this.scene.cameras.main;
    const camLeft = camera.scrollX;
    const camRight = camera.scrollX + camera.width;
    const camTop = camera.scrollY;
    const camBottom = camera.scrollY + camera.height;

    items.children.each((item: any) => {
      if (!item.active) return true;

      const dx = item.x - this.x;
      const dy = item.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only show indicators for off-screen items within detection range
      const isOnScreen = item.x >= camLeft && item.x <= camRight &&
                          item.y >= camTop && item.y <= camBottom;

      if (!isOnScreen && dist <= this.ITEM_RADAR_RANGE) {
        // Create a small arrow indicator at the edge of the screen pointing toward the item
        const angle = Math.atan2(dy, dx);
        const edgeX = Phaser.Math.Clamp(item.x, camLeft + 30, camRight - 30);
        const edgeY = Phaser.Math.Clamp(item.y, camTop + 30, camBottom - 30);

        const indicator = this.scene.add.graphics();
        indicator.setDepth(200);

        // Draw a small diamond/arrow indicator
        const size = 8;
        indicator.fillStyle(0xffaa00, 0.8);
        indicator.beginPath();
        indicator.moveTo(edgeX + Math.cos(angle) * size, edgeY + Math.sin(angle) * size);
        indicator.lineTo(edgeX + Math.cos(angle + 2.5) * size * 0.6, edgeY + Math.sin(angle + 2.5) * size * 0.6);
        indicator.lineTo(edgeX + Math.cos(angle - 2.5) * size * 0.6, edgeY + Math.sin(angle - 2.5) * size * 0.6);
        indicator.closePath();
        indicator.fillPath();

        // Add a pulsing glow
        indicator.fillStyle(0xffaa00, 0.3);
        indicator.fillCircle(edgeX, edgeY, 6);

        this.itemRadarIndicators.push(indicator);
      }
      return true;
    });
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
        this.restoreDefaultTint();
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

    // Apply combo string finisher knockback effect
    if (this.pendingFinisher && this.pendingFinisher.finisherKnockback) {
      const finisher = this.pendingFinisher;
      const kb = finisher.finisherKnockback;
      // Apply finisher knockback to all enemies hit by this attack
      this.hitEnemies.forEach((enemy: any) => {
        if (!enemy.active) return;
        // Determine direction for horizontal knockback
        const direction = enemy.x > this.x ? 1 : -1;
        // Override with finisher knockback (additive to whatever CombatManager did)
        if (kb.x !== 0) {
          enemy.setVelocityX(kb.x * direction);
        }
        if (kb.y !== 0) {
          enemy.setVelocityY(kb.y);
        }
      });
    }

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

    // Zero out vertical velocity when snapping to a slope — prevents both
    // falling through and carrying upward launch velocity from a prior slope
    if (this.body!.velocity.y !== 0) {
      this.setVelocityY(0);
    }

    // Cap horizontal speed based on slope direction instead of multiplying each frame.
    // This allows the player to walk uphill (just slower) rather than being forced off.
    const body = this.body as Phaser.Physics.Arcade.Body;
    const maxSpeed = PHYSICS.MOVE_SPEED * result.speedMod;
    if (Math.abs(body.velocity.x) > maxSpeed) {
      body.velocity.x = Math.sign(body.velocity.x) * maxSpeed;
    }

    // Disable gravity while on slope
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
      this.pendingLaunchVector = null;
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
    if (silverItems.length >= this.maxSilverItems) {
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
      if (this.abilities.has(item.abilityId)) {
        // Already have this ability — it's being stacked
        this.stackedAbilities.add(item.abilityId);
      } else {
        this.abilities.add(item.abilityId);
      }
    }

    // Armor items: track hits for absorption
    if (item.armorHits) {
      this.armorItems.set(item.id, item.armorHits);
      this.recalculateArmor();
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

    EventBus.emit("inventory-change", { inventory: this.inventory, maxSlots: this.maxSilverItems });
    EventBus.emit("synergy-change", { synergies: calculateSynergies(this.inventory) });
  }

  private removeArmorItem(itemId: string): void {
    this.armorItems.delete(itemId);
    // Remove from inventory array
    const idx = this.inventory.findIndex(item => item.id === itemId);
    if (idx !== -1) {
      this.inventory.splice(idx, 1);
      EventBus.emit('inventory-change', { inventory: [...this.inventory], maxSlots: this.maxSilverItems });
      EventBus.emit('synergy-change', { synergies: calculateSynergies(this.inventory) });
    }
    this.recalculateArmor();
  }

  private recalculateArmor(): void {
    this.armorHits = 0;
    for (const hits of this.armorItems.values()) {
      this.armorHits += hits;
    }
  }

  public replaceItem(index: number, newItem: ItemData) {
    const oldItem = this.inventory[index];
    if (oldItem && oldItem.abilityId) {
      this.abilities.delete(oldItem.abilityId);
    }
    // Clean up armor tracking if old item was an armor item
    if (oldItem && oldItem.armorHits) {
      this.armorItems.delete(oldItem.id);
      this.recalculateArmor();
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
        // Armor is handled separately via armorItems tracking
        if (effect.targetStat === 'armor') continue;
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

  public getMaxSilverItems(): number {
    return this.maxSilverItems;
  }

  public setMaxSilverItems(count: number): void {
    this.maxSilverItems = count;
    EventBus.emit('inventory-change', { inventory: [...this.inventory], maxSlots: this.maxSilverItems });
  }

  public addSilverItemSlot(): void {
    this.maxSilverItems++;
    EventBus.emit('inventory-change', { inventory: [...this.inventory], maxSlots: this.maxSilverItems });
  }
}

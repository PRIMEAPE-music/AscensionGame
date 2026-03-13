import Phaser from "phaser";
import { ClassType, type ClassStats, CLASSES } from "../config/ClassConfig";
import { SUBCLASSES } from "../config/SubclassConfig";
import type { SubclassDef } from "../config/SubclassConfig";
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
import { AscensionManager } from "../systems/AscensionManager";
import { AscensionTree } from "../systems/AscensionTree";
import { ClassMastery } from "../systems/ClassMastery";
import type { MasteryBonuses } from "../systems/ClassMastery";
import { GameSettings } from "../systems/GameSettings";
import { CosmeticManager } from "../systems/CosmeticManager";
import { GamepadManager } from "../systems/GamepadManager";
import { TouchControls } from "../systems/TouchControls";
import { KeyBindings } from "../systems/KeyBindings";
import { MouseManager } from "../systems/MouseManager";
import { CoopManager } from "../systems/CoopManager";
import { SynergyManager } from "../systems/SynergyManager";

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

  // Perfect Parry State (attack-based parry)
  private attackStartTime: number = 0;
  private parryInvincibilityTimer: number = 0;
  private readonly PARRY_WINDOW: number = 150; // ms from attack start where parry is active
  private readonly PARRY_INVINCIBILITY_DURATION: number = 500; // 0.5s invincibility after parry
  private readonly PARRY_REFLECT_MULTIPLIER: number = 2.0; // 200% damage reflected back

  // Dodge/Block Parry Window State
  private _parryWindowActive: boolean = false;
  private _parryWindowTimer: number = 0;
  private _parryWindowDuration: number = 150; // set based on class in constructor
  private _parryCooldown: number = 0; // prevent spam, 500ms cooldown
  private readonly _PARRY_COOLDOWN_DURATION: number = 500;
  private readonly _PARRY_STUN_DURATION: number = 1500; // 1.5s stun on attacker
  private readonly _PARRY_REFLECT_PERCENT: number = 0.5; // 50% damage reflected

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

  // Wall jump limit (max 2 consecutive wall jumps before landing)
  private consecutiveWallJumps: number = 0;
  private readonly MAX_WALL_JUMPS = 2;

  // Fall damage (applied on landing, not mid-air death plane)
  private fallStartY: number = 0;
  private isFalling: boolean = false;
  private readonly FALL_DAMAGE_THRESHOLD = 800; // pixels of fall before damage
  private readonly FALL_DAMAGE_PER_UNIT = 1; // 1 damage per threshold unit beyond threshold

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

  // Phoenix Feather (co-op)
  private phoenixFeatherUsed: boolean = false;

  // Battle Bond (co-op)
  private battleBondGlowActive: boolean = false;
  private battleBondCheckTimer: number = 0;

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

  // === Cursed Item State ===
  public curses: Set<string> = new Set(); // Active curse IDs
  private bloodBladeKillCount: number = 0;
  private chaosOrbTimer: number = 0;
  private readonly CHAOS_ORB_DAMAGE_INTERVAL = 60000; // 60 seconds
  private readonly GRAVITON_PULL_RANGE = 250;
  private readonly GRAVITON_PULL_SPEED = 120;
  public darkPactLastBiome: string = '';

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

  // === Themed Synergy Set State ===
  private infernoAuraTimer: number = 0;
  private readonly INFERNO_AURA_INTERVAL = 1000;  // 1s tick
  private readonly INFERNO_AURA_RADIUS = 100;     // px
  private fortressApplied: boolean = false;
  private lifelineRegenTimer: number = 0;
  private readonly LIFELINE_REGEN_INTERVAL = 20000; // 20s

  // === Priest: Sacred Ground ===
  public sacredGroundCooldown: number = 0;
  private readonly SACRED_GROUND_COOLDOWN_TOTAL = 15000; // ms

  // === Subclass System ===
  public subclass: string | null = null;
  private subclassDef: SubclassDef | null = null;
  private subclassAbilityCooldown: number = 0;
  private subclassAbilityKey!: Phaser.Input.Keyboard.Key;
  // Crusader: smite passive (15% chance 2x damage)
  // Templar: enhanced block (+50% block effectiveness, block heals 1 HP), divine shield
  private divineShieldActive: boolean = false;
  private divineShieldTimer: number = 0;
  private readonly DIVINE_SHIELD_DURATION = 3000; // 3s
  // Shadow Dancer: dodge invisibility, stealth crit bonus
  private shadowDancerInvisible: boolean = false;
  private shadowDancerInvisTimer: number = 0;
  // Iron Fist: consecutive hit tracker
  private ironFistConsecutiveHits: number = 0;
  private ironFistComboTimer: number = 0;
  private readonly IRON_FIST_COMBO_TIMEOUT = 2000; // 2s to keep combo alive
  // Oracle: sacred ground radius multiplier
  public oracleDoubleRadius: boolean = false;

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
    // Copy classStats so ascension boosts don't mutate the shared config
    this.classStats = { ...CLASSES[classType] };

    // Apply ascension boosts to class stats (per-boss stat choices)
    const ascensionBoosts = AscensionManager.getBoosts();
    this.classStats.attackDamage *= (1 + ascensionBoosts.attackDamage);
    this.classStats.moveSpeed *= (1 + ascensionBoosts.moveSpeed);
    this.classStats.jumpHeight *= (1 + ascensionBoosts.jumpHeight);
    // attackSpeed: lower = faster, so boost makes it smaller (faster)
    this.classStats.attackSpeed *= (1 - ascensionBoosts.attackSpeed);
    // maxHealth: each 0.02 increment adds +1 flat HP; bake into classStats.health
    const ascensionHealthBonus = Math.round(ascensionBoosts.maxHealth / 0.02);
    this.classStats.health += ascensionHealthBonus;

    // Apply Ascension Tree permanent upgrades (between-run purchases)
    this.classStats.attackDamage *= AscensionTree.getBonusAttackDamage();
    this.classStats.moveSpeed *= AscensionTree.getBonusMoveSpeed();
    this.classStats.jumpHeight *= AscensionTree.getBonusJumpHeight();
    // attackSpeed: lower = faster, tree returns 1.15 for +15% faster, so multiply by inverse
    const treeAtkSpd = AscensionTree.getBonusAttackSpeed();
    if (treeAtkSpd > 1) this.classStats.attackSpeed *= (2 - treeAtkSpd);
    this.classStats.health += AscensionTree.getBonusMaxHP();

    // Apply Class Mastery bonuses
    const mastery: MasteryBonuses = ClassMastery.getBonuses(classType);
    this.classStats.attackDamage *= mastery.attackDamage;
    this.classStats.moveSpeed *= mastery.moveSpeed;
    this.classStats.jumpHeight *= mastery.jumpHeight;
    if (mastery.attackSpeed > 1) {
      this.classStats.attackSpeed *= (1 - (mastery.attackSpeed - 1));
    }
    this.classStats.health += mastery.maxHP + mastery.startingHP;
    this.classStats.health = Math.round(this.classStats.health * mastery.maxHPMultiplier);

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

    // Set parry window duration based on class
    if (this.classType === ClassType.PALADIN) {
      this._parryWindowDuration = 200; // Most forgiving
    } else {
      this._parryWindowDuration = 150; // Monk and Priest
    }

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

    // Subclass Ability Key
    this.subclassAbilityKey = kb.addKey(bindings.subclassAbility);
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
    this.handleSubclassAbility();
    this.updateSubclassTimers(delta);
    this.updateInvincibility(delta);
    this.updateClassMechanics(delta);
    this.updateItemRadar(delta);
    this.updateBattleBondVisual(delta);
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

      // Fall damage on landing
      if (this.isFalling) {
        const fallDistance = this.y - this.fallStartY;
        if (fallDistance > this.FALL_DAMAGE_THRESHOLD) {
          const damageUnits = Math.floor((fallDistance - this.FALL_DAMAGE_THRESHOLD) / this.FALL_DAMAGE_THRESHOLD) + 1;
          const damage = damageUnits * this.FALL_DAMAGE_PER_UNIT;
          this.takeDamage(damage);
        }
        this.isFalling = false;
      }

      // Reset wall jump count on landing
      this.consecutiveWallJumps = 0;
    } else {
      this.coyoteTimer -= delta;

      // Track falling: start tracking when moving downward and not wall sliding
      const vy = (this.body as Phaser.Physics.Arcade.Body).velocity.y;
      if (vy > 0 && !this.isWallSliding && !this.isFalling) {
        // Start of a new fall
        this.isFalling = true;
        this.fallStartY = this.y;
      } else if (this.isWallSliding) {
        // Wall sliding cancels fall damage tracking
        this.isFalling = false;
      }
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

    // Dodge/Block parry window timer
    if (this._parryWindowTimer > 0) {
      this._parryWindowTimer -= delta;
      if (this._parryWindowTimer <= 0) {
        this._parryWindowActive = false;
        this._parryWindowTimer = 0;
      }
    }
    if (this._parryCooldown > 0) {
      this._parryCooldown -= delta;
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
          this.healPlayer(1);
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

    // === Themed Synergy Set Updates ===
    // Inferno: passive fire aura damage to nearby enemies
    if (SynergyManager.isActive('inferno')) {
      this.updateInfernoAura(delta);
    }
    // Lifeline: passive HP regen every 20 seconds (always, no out-of-combat requirement)
    if (SynergyManager.isActive('lifeline')) {
      this.updateLifelineRegen(delta);
    }

    // Magnet Pull: attract nearby items toward the player
    if (this.abilities.has('magnet_pull')) {
      this.applyMagnetPull();
    }

    // === Cursed Item Timers ===

    // Chaos Orb curse: take 1 damage every 60 seconds
    if (this.curses.has('chaos_orb')) {
      this.chaosOrbTimer += delta;
      if (this.chaosOrbTimer >= this.CHAOS_ORB_DAMAGE_INTERVAL) {
        this.chaosOrbTimer = 0;
        this.takeDamage(1);
        // Purple flash to indicate curse damage
        if (this.active) {
          this.setTint(0x9933cc);
          this.scene.time.delayedCall(200, () => {
            if (this.active) this.restoreDefaultTint();
          });
        }
      }
    }

    // Graviton Core curse: pull enemies toward player (benefit) + increased fall speed (curse)
    if (this.curses.has('graviton_core')) {
      this.applyGravitonPull();
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
      EventBus.emit("player-land", {});
    } else if (this.isLanding) {
      // Still playing land animation — don't interrupt
      anim = "monk_land";
    } else if (Math.abs(vx) > 10) {
      anim = "monk_run";
    }

    this.wasAirborne = airborne;

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
      EventBus.emit("player-jump", {});
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
        EventBus.emit("player-jump", {});

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

      if (this.jumpJustPressed && this.consecutiveWallJumps < this.MAX_WALL_JUMPS && !this.isWallJumpDisabled()) {
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
        this.consecutiveWallJumps++;
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
          EventBus.emit("priest-sacred-ground", { x: this.x, y: this.y + 20 });
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
        } else if (this.subclass === 'shadow_dancer') {
          // Shadow Dancer subclass: dodge grants 1s invisibility
          this.applyShadowDancerInvisibility();
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
      EventBus.emit("player-dodge", { perfect: false });

      // Activate parry window on dodge press (all classes use dodge key for parry)
      if (this._parryCooldown <= 0) {
        this._parryWindowActive = true;
        this._parryWindowTimer = this._parryWindowDuration;
      }

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

    EventBus.emit("player-attack", {});
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
      EventBus.emit("player-dodge", { perfect: false });
      // Apply dodge velocity away from attacker
      const dodgeDir = attackerX !== undefined ? (this.x > attackerX ? 1 : -1) : (this.flipX ? -1 : 1);
      this.setVelocityX(this.DODGE_SPEED * dodgeDir);
      this.setAlpha(0.5);
    }

    // Dodge/Block parry check — if parry window is active, negate damage and counter
    if (this._parryWindowActive && this._parryCooldown <= 0) {
      return this.tryParry(attackerRef, amount);
    }

    // Dodge i-frames — skip damage but check for perfect dodge
    if (this.dodgeTimer > 0) {
      const timeSinceDodgeStart = this.scene.time.now - this.dodgeStartTime;
      if (timeSinceDodgeStart <= this.PERFECT_DODGE_WINDOW) {
        // Perfect dodge! Grant buff
        this.perfectDodgeBuff = true;
        this.perfectDodgeBuffTimer = this.PERFECT_DODGE_BUFF_DURATION;
        PersistentStats.addPerfectDodge();
        EventBus.emit("player-dodge", { perfect: true });
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
      this.counterCooldown = this.COUNTER_COOLDOWN * this.getCooldownMultiplier();

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

    // Synergy: Shadow — 15% chance to dodge any attack entirely
    if (SynergyManager.isActive('shadow') && Math.random() < 0.15) {
      // Visual feedback: purple flash for shadow dodge
      if (!GameSettings.get().flashReduction) {
        this.setTint(0x8844cc);
        this.scene.time.delayedCall(200, () => {
          if (this.active) this.restoreDefaultTint();
        });
      }
      // Show "SHADOW" text
      const shadowText = this.scene.add.text(this.x, this.y - 40, 'SHADOW', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#8844cc',
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold',
      });
      shadowText.setOrigin(0.5);
      shadowText.setDepth(101);
      this.scene.tweens.add({
        targets: shadowText,
        y: this.y - 80,
        alpha: 0,
        duration: 800,
        ease: 'Power2',
        onComplete: () => shadowText.destroy(),
      });
      return false; // Attack entirely dodged
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
        // Templar: +50% block effectiveness (0.25 instead of 0.5), and heal 1 HP
        const blockReduction = this.getTemplarBlockReduction();
        finalAmount = Math.max(
          1,
          Math.round(amount * blockReduction),
        );
        // Visual feedback for blocked hit
        this.setTint(0x6666ff);
        this.scene.time.delayedCall(150, () => {
          if (this.active && this.isShieldGuarding) this.setTint(0x4444ff);
        });
        // Templar: blocking heals 1 HP
        this.onTemplarBlock();
      }
    }

    // Synergy: Fortress — reduce all incoming damage by 1 (min 1)
    if (SynergyManager.isActive('fortress') && finalAmount > 1) {
      finalAmount = Math.max(1, finalAmount - 1);
    }

    // Monk: reset flow on taking damage
    if (this.classType === ClassType.MONK && this.flowMeter > 0) {
      this.flowMeter = 0;
      this.applyFlowBuffs();
      this.emitFlowChange();
    }

    // Soul Link (co-op): if this damage would be lethal and partner has soul_link,
    // split the damage between both players
    let soulLinkHandled = false;
    if (this.health - finalAmount <= 0 && CoopManager.isActive()) {
      const partner = CoopManager.getPartner(this);
      if (partner && partner.active && partner.health > 0) {
        const eitherHasSoulLink = this.abilities.has('soul_link') || partner.abilities.has('soul_link');
        if (eitherHasSoulLink) {
          soulLinkHandled = true;
          const halfDamage = Math.ceil(finalAmount / 2);
          // Apply split damage to this player
          this.health -= halfDamage;
          PersistentStats.addDamageTaken(halfDamage);
          // Apply split damage to partner (bypass their defenses for the split portion)
          partner.health -= (finalAmount - halfDamage);
          EventBus.emit("health-change", {
            health: partner.health,
            maxHealth: partner.maxHealth,
            playerIndex: partner.playerIndex,
          });
          // Visual: red line connecting both players briefly
          const line = this.scene.add.graphics();
          line.setDepth(100);
          line.lineStyle(3, 0xff4488, 0.8);
          line.lineBetween(this.x, this.y, partner.x, partner.y);
          this.scene.tweens.add({
            targets: line,
            alpha: 0,
            duration: 500,
            onComplete: () => line.destroy(),
          });
          // Show "SOUL LINK" text
          const slText = this.scene.add.text(
            (this.x + partner.x) / 2,
            Math.min(this.y, partner.y) - 40,
            'SOUL LINK',
            {
              fontSize: '18px',
              fontFamily: 'monospace',
              color: '#ff4488',
              stroke: '#000000',
              strokeThickness: 3,
              fontStyle: 'bold',
            }
          );
          slText.setOrigin(0.5);
          slText.setDepth(101);
          this.scene.tweens.add({
            targets: slText,
            y: slText.y - 40,
            alpha: 0,
            duration: 800,
            ease: 'Power2',
            onComplete: () => slText.destroy(),
          });

          // Check if partner died from split
          if (partner.health <= 0) {
            EventBus.emit("player-died", { playerIndex: partner.playerIndex });
            partner.setVisible(false);
            partner.setActive(false);
            (partner.body as Phaser.Physics.Arcade.Body).enable = false;
          }

          // If this player survived the split, apply invincibility and return
          if (this.health > 0) {
            this.resetComboString();
            EventBus.emit("health-change", {
              health: this.health,
              maxHealth: this.maxHealth,
              playerIndex: this.playerIndex,
            });
            if (this.invincibilityTimer <= 0) {
              let iFrameDuration = COMBAT.INVINCIBILITY_DURATION;
              const iframeSettings = GameSettings.get();
              if (iframeSettings.assistMode && iframeSettings.extraIFrames) {
                iFrameDuration *= 2;
              }
              this.invincibilityTimer = iFrameDuration;
              this.flashTimer = 0;
            }
            if (!GameSettings.get().flashReduction) {
              this.setTint(0xff0000);
            }
            return false;
          }
          // If health <= 0 after soul link, fall through to death-prevention checks below
        }
      }
    }

    if (!soulLinkHandled) {
      this.health -= finalAmount;
      PersistentStats.addDamageTaken(finalAmount);
    }

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

    // Phoenix Feather (co-op): one-time auto-revive with full HP
    if (this.health <= 0 && this.abilities.has('phoenix_feather') && !this.phoenixFeatherUsed) {
      this.phoenixFeatherUsed = true;
      this.health = this.maxHealth;
      this.invincibilityTimer = 3000;
      this.flashTimer = 0;
      // Remove the ability (consumed on use)
      this.abilities.delete('phoenix_feather');
      // Golden burst effect
      this.setTint(0xff8800);
      this.scene.time.delayedCall(600, () => {
        if (this.active) this.restoreDefaultTint();
      });
      // "PHOENIX!" text
      const phoenixText = this.scene.add.text(this.x, this.y - 50, 'PHOENIX!', {
        fontSize: '24px',
        fontFamily: 'monospace',
        color: '#ff8800',
        stroke: '#000000',
        strokeThickness: 4,
        fontStyle: 'bold',
      });
      phoenixText.setOrigin(0.5);
      phoenixText.setDepth(101);
      this.scene.tweens.add({
        targets: phoenixText,
        y: this.y - 110,
        alpha: 0,
        scale: 1.5,
        duration: 1200,
        ease: 'Power2',
        onComplete: () => phoenixText.destroy(),
      });
      // Golden burst particles
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const particle = this.scene.add.rectangle(
          this.x, this.y, 4, 4, 0xff8800
        );
        particle.setDepth(100);
        this.scene.tweens.add({
          targets: particle,
          x: this.x + Math.cos(angle) * 60,
          y: this.y + Math.sin(angle) * 60,
          alpha: 0,
          duration: 500,
          ease: 'Power2',
          onComplete: () => particle.destroy(),
        });
      }
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
      // In co-op mode, don't restart — MainScene handles respawn.
      // Just hide/disable this player.
      if (CoopManager.isActive()) {
        this.setVisible(false);
        this.setActive(false);
        (this.body as Phaser.Physics.Arcade.Body).enable = false;
      } else {
        this.scene.scene.restart();
      }
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

  /**
   * Dodge/Block Parry: check if the parry window is active when damage is incoming.
   * If the window is active, negate damage, stun the attacker, reflect damage back,
   * and apply class-specific bonuses.
   * Returns true if the damage was parried.
   */
  public tryParry(attacker: any, damage: number): boolean {
    if (!this._parryWindowActive) return false;

    // Consume the parry window
    this._parryWindowActive = false;
    this._parryWindowTimer = 0;
    this._parryCooldown = this._PARRY_COOLDOWN_DURATION;

    // Stun the attacker
    if (attacker && attacker.active) {
      if (typeof attacker.enterStun === 'function') {
        attacker.enterStun(this._PARRY_STUN_DURATION);
      } else if (typeof attacker.stun === 'function') {
        attacker.stun(this._PARRY_STUN_DURATION);
      }
    }

    // Reflect 50% damage back to attacker
    const reflectedDamage = Math.max(1, Math.round(damage * this._PARRY_REFLECT_PERCENT * this.classStats.attackDamage));
    if (attacker && attacker.active && typeof attacker.takeDamage === 'function') {
      attacker.takeDamage(reflectedDamage);
      PersistentStats.addDamageDealt(reflectedDamage);
    }

    // Screen flash effect
    if (!GameSettings.get().flashReduction) {
      this.scene.cameras.main.flash(50, 255, 255, 255, true);
    }

    // Camera shake for feedback
    this.scene.cameras.main.shake(80, 0.005);

    // Hit-stop effect
    this.scene.time.timeScale = 0.15;
    this.scene.time.delayedCall(60, () => {
      this.scene.time.timeScale = 1;
    });

    // Visual feedback: white-gold flash on player
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) {
        this.setTint(0xffd700);
        this.scene.time.delayedCall(200, () => {
          if (this.active) this.restoreDefaultTint();
        });
      }
    });

    // "PARRY!" floating text
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

    // Class-specific bonuses
    if (this.classType === ClassType.MONK) {
      // Monk: grant +1 flow stack (FLOW_HIT_GAIN amount)
      this.flowMeter = Math.min(this.FLOW_MAX, this.flowMeter + this.FLOW_HIT_GAIN);
      this.flowDecayTimer = 0;
      this.applyFlowBuffs();
      this.emitFlowChange();
    } else if (this.classType === ClassType.PRIEST) {
      // Priest: heal 1 HP on successful parry
      if (this.health < this.maxHealth) {
        this.health = Math.min(this.health + 1, this.maxHealth);
        EventBus.emit("health-change", { health: this.health, maxHealth: this.maxHealth });
      }
    }

    // Brief invincibility after parry
    this.parryInvincibilityTimer = Math.max(this.parryInvincibilityTimer, 300);

    // Track stat
    PersistentStats.addPerfectParry();

    // Emit parry event for HUD
    EventBus.emit("parry-success", { reflectedDamage });

    return true;
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

    this.cataclysmCooldown = (SynergyManager.isActive('arcane')
      ? this.CATACLYSM_COOLDOWN * 0.7
      : this.CATACLYSM_COOLDOWN) * this.getCooldownMultiplier();

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

    this.temporalCooldown = (SynergyManager.isActive('arcane')
      ? this.TEMPORAL_COOLDOWN * 0.7
      : this.TEMPORAL_COOLDOWN) * this.getCooldownMultiplier();

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

    this.divineCooldown = (SynergyManager.isActive('arcane')
      ? this.DIVINE_COOLDOWN * 0.7
      : this.DIVINE_COOLDOWN) * this.getCooldownMultiplier();
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
            this.groundSlamCooldown = this.GROUND_SLAM_COOLDOWN * this.getCooldownMultiplier();
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
      this.groundSlamCooldown = this.GROUND_SLAM_COOLDOWN * this.getCooldownMultiplier();
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

    this.projectileCooldown = this.PROJECTILE_COOLDOWN * this.getCooldownMultiplier();

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

  /** Graviton Core: pull enemies toward the player */
  private applyGravitonPull(): void {
    const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
    if (!enemies) return;

    enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dx = this.x - enemy.x;
      const dy = this.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.GRAVITON_PULL_RANGE && dist > 10) {
        const nx = dx / dist;
        const ny = dy / dist;
        const dt = this.scene.game.loop.delta / 1000;
        enemy.x += nx * this.GRAVITON_PULL_SPEED * dt;
        enemy.y += ny * this.GRAVITON_PULL_SPEED * dt;
      }
      return true;
    });
  }

  private updateBattleBondVisual(delta: number): void {
    if (!CoopManager.isActive()) return;
    this.battleBondCheckTimer -= delta;
    if (this.battleBondCheckTimer > 0) return;
    this.battleBondCheckTimer = 500; // Check every 500ms

    const bondActive = CoopManager.getBattleBondMultiplier(this) > 1.0;
    if (bondActive && !this.battleBondGlowActive) {
      this.battleBondGlowActive = true;
      // Subtle orange-gold tint pulse to indicate bond is active
      if (!this.isInvincible && !this.isShieldGuarding) {
        this.setTint(0xffcc66);
        this.scene.time.delayedCall(200, () => {
          if (this.active && !this.isInvincible) this.restoreDefaultTint();
        });
      }
    } else if (!bondActive && this.battleBondGlowActive) {
      this.battleBondGlowActive = false;
    }
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

    // Iron Fist subclass: track consecutive hits
    this.onIronFistHit();
  }

  /** Called by MainScene when an enemy is killed (Vampirism ability + curse effects). */
  public onEnemyKilled(): void {
    if (this.abilities.has('vampirism')) {
      this.vampirismKillCount++;
      if (this.vampirismKillCount >= 10) {
        this.vampirismKillCount = 0;
        if (this.health < this.maxHealth) {
          this.healPlayer(1);
        }
      }
    }

    // Soul Siphon curse: kills heal 1 HP
    if (this.curses.has('soul_siphon')) {
      this.healPlayer(1);
    }

    // Blood Blade curse: lose 1 HP every 10 kills
    if (this.curses.has('blood_blade')) {
      this.bloodBladeKillCount++;
      if (this.bloodBladeKillCount >= 10) {
        this.bloodBladeKillCount = 0;
        this.takeDamage(1);
        // Purple flash for curse damage
        if (this.active) {
          this.setTint(0x9933cc);
          this.scene.time.delayedCall(200, () => {
            if (this.active) this.restoreDefaultTint();
          });
        }
      }
    }
  }

  /**
   * Heal the player, respecting curse caps (e.g., berserkers_rage caps healing at 50% max HP).
   */
  public healPlayer(amount: number): void {
    const healCap = this.curses.has('berserkers_rage')
      ? Math.floor(this.maxHealth * 0.5)
      : this.maxHealth;
    if (this.health < healCap) {
      this.health = Math.min(this.health + amount, healCap);
      EventBus.emit("health-change", { health: this.health, maxHealth: this.maxHealth });
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
      // Just left a slope — re-enable gravity and emit slope-launch event
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(true);

      const vx = body.velocity.x;
      const vy = body.velocity.y;
      const speed = Math.sqrt(vx * vx + vy * vy);

      if (speed > 0) {
        const angle = this.slopeAngle;
        EventBus.emit("slope-launch", { speed, angle });
      }

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

    // Cursed items always collected (like gold, no slot limit)
    if (item.type === 'CURSED') {
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
    EventBus.emit("item-pickup", {});

    if (item.abilityId) {
      if (this.abilities.has(item.abilityId)) {
        // Already have this ability — it's being stacked
        this.stackedAbilities.add(item.abilityId);
      } else {
        this.abilities.add(item.abilityId);
      }
    }

    // Cursed items: register curse effects on pickup
    if (item.type === 'CURSED' && item.curseId) {
      this.curses.add(item.curseId);
      this.applyCurseOnPickup(item.curseId);
    }

    // Shared Vigor (co-op): both players gain +2 max HP and heal by 2
    if (item.abilityId === 'shared_vigor' && CoopManager.isActive()) {
      const partner = CoopManager.getPartner(this);
      if (partner && partner.active) {
        partner.maxHealth += 2;
        partner.health = Math.min(partner.health + 2, partner.maxHealth);
        EventBus.emit("health-change", {
          health: partner.health,
          maxHealth: partner.maxHealth,
          playerIndex: partner.playerIndex,
        });
      }
      // Apply to self as well
      this.maxHealth += 2;
      this.health = Math.min(this.health + 2, this.maxHealth);
      EventBus.emit("health-change", {
        health: this.health,
        maxHealth: this.maxHealth,
        playerIndex: this.playerIndex,
      });
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
    const isCursed = item.type === 'CURSED';
    const pickupColor = isCursed ? '#9933cc' : '#ffff00';
    const text = this.scene.add.text(this.x, this.y - 50, `+ ${item.name}${qualityLabel}`, {
      fontSize: "16px",
      color: pickupColor,
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

    // Check themed synergy sets and apply effects for newly activated ones
    const newSynergies = SynergyManager.checkSynergies(this.inventory);
    for (const synergyId of newSynergies) {
      this.applySynergyEffects(synergyId);
    }
  }

  /**
   * Apply immediate curse effects that happen on pickup.
   */
  private applyCurseOnPickup(curseId: string): void {
    switch (curseId) {
      case 'glass_cannon':
        // Cap max HP at 3, clamp current health
        if (this.maxHealth > 3) {
          this.maxHealth = 3;
          this.health = Math.min(this.health, 3);
          EventBus.emit("health-change", { health: this.health, maxHealth: this.maxHealth });
        }
        break;

      case 'phantom_step':
        // Grant triple jump by adding double_jump and stacking it
        if (!this.abilities.has('double_jump')) {
          this.abilities.add('double_jump');
        }
        this.stackedAbilities.add('double_jump'); // Makes it triple jump
        break;

      case 'temporal_drain':
        // Reduce all cooldowns by 50% (applied via cooldown multiplier checked at usage sites)
        // The move speed penalty is handled via the effects array
        break;

      case 'graviton_core': {
        // Increase gravity/fall speed by 30% for this player
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setGravityY(body.gravity.y + (body.gravity.y > 0 ? body.gravity.y * 0.3 : 300));
        break;
      }

      default:
        // Other curses are handled via ongoing checks (blood_blade, chaos_orb, etc.)
        break;
    }
  }

  /**
   * Returns the cooldown multiplier accounting for Temporal Drain curse.
   * 1.0 = normal, 0.5 = 50% reduced cooldowns.
   */
  public getCooldownMultiplier(): number {
    return this.curses.has('temporal_drain') ? 0.5 : 1.0;
  }

  /**
   * Check if wall jumping is disabled by a curse.
   */
  public isWallJumpDisabled(): boolean {
    return this.curses.has('phantom_step');
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
      if ((item.type !== 'SILVER' && item.type !== 'CURSED') || !item.effects) continue;
      const qualityMult = item.type === 'CURSED' ? 1.0 : QUALITY_MULTIPLIERS[item.quality ?? 'NORMAL'];
      const synergyMult = item.type === 'CURSED' ? 1.0 : getSynergyMultiplier(item, this.inventory);

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
    let newMaxHealth = baseHealth + bonusHealth;

    // Glass Cannon curse: cap max HP at 3
    if (this.curses.has('glass_cannon')) {
      newMaxHealth = Math.min(newMaxHealth, 3);
    }

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

  // ══════════════════════════════════════════════════════════════════════
  //  THEMED SYNERGY SET EFFECTS
  // ══════════════════════════════════════════════════════════════════════

  private applySynergyEffects(synergyId: string): void {
    switch (synergyId) {
      case 'fortress': {
        if (!this.fortressApplied) {
          this.fortressApplied = true;
          const bonus = Math.max(1, Math.round(this.maxHealth * 0.25));
          this.maxHealth += bonus;
          this.health += bonus;
          EventBus.emit("health-change", { health: this.health, maxHealth: this.maxHealth });
        }
        break;
      }
      case 'tempest': {
        const currentSpeed = this.statModifiers.get('moveSpeed') || 0;
        this.statModifiers.set('moveSpeed', currentSpeed + 0.30);
        break;
      }
      case 'arsenal': {
        const currentAS = this.statModifiers.get('attackSpeed') || 0;
        this.statModifiers.set('attackSpeed', currentAS - 0.20);
        break;
      }
      default:
        break;
    }
  }

  private updateInfernoAura(delta: number): void {
    this.infernoAuraTimer += delta;
    if (this.infernoAuraTimer < this.INFERNO_AURA_INTERVAL) return;
    this.infernoAuraTimer = 0;

    const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
    if (!enemies) return;

    enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.INFERNO_AURA_RADIUS) {
        enemy.takeDamage(1);
        if (enemy.active) {
          enemy.setTint(0xff4400);
          this.scene.time.delayedCall(150, () => {
            if (enemy.active) enemy.clearTint();
          });
        }
      }
      return true;
    });
  }

  private updateLifelineRegen(delta: number): void {
    this.lifelineRegenTimer += delta;
    if (this.lifelineRegenTimer >= this.LIFELINE_REGEN_INTERVAL) {
      this.lifelineRegenTimer = 0;
      if (this.health < this.maxHealth) {
        this.health++;
        EventBus.emit("health-change", { health: this.health, maxHealth: this.maxHealth });
      }
    }
  }

  public applyArsenalChain(hitEnemyX: number, hitEnemyY: number): void {
    if (!SynergyManager.isActive('arsenal')) return;

    const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
    if (!enemies) return;

    const chainDamage = Math.max(1, Math.round(COMBAT.BASE_DAMAGE * this.classStats.attackDamage * 0.30));
    let nearestEnemy: any = null;
    let nearestDist = Infinity;

    enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dx = enemy.x - hitEnemyX;
      const dy = enemy.y - hitEnemyY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10 && dist < 150 && dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = enemy;
      }
      return true;
    });

    if (nearestEnemy) {
      nearestEnemy.takeDamage(chainDamage);
      const line = this.scene.add.graphics();
      line.lineStyle(2, 0xff6600, 0.8);
      line.lineBetween(hitEnemyX, hitEnemyY, nearestEnemy.x, nearestEnemy.y);
      line.setDepth(5);
      this.scene.time.delayedCall(150, () => line.destroy());
    }
  }

  // ─── Subclass System ──────────────────────────────────────────────────

  /**
   * Apply a subclass specialization to the player.
   * Sets stat bonuses, enables passive effects, and unlocks the subclass ability.
   */
  public applySubclass(subclassId: string): void {
    const def = SUBCLASSES[subclassId];
    if (!def) return;

    this.subclass = subclassId;
    this.subclassDef = def;
    this.subclassAbilityCooldown = 0;

    // Apply stat bonuses
    for (const [stat, bonus] of Object.entries(def.statBonuses)) {
      const current = this.statModifiers.get(stat as StatType) || 0;
      this.statModifiers.set(stat as StatType, current + bonus);
    }

    // Subclass-specific initialization
    if (subclassId === 'oracle') {
      this.oracleDoubleRadius = true;
    }

    // Visual feedback: golden glow
    this.setTint(0xffd700);
    this.scene.cameras.main.flash(500, 255, 215, 0, false, undefined, this);
    this.scene.time.delayedCall(800, () => {
      if (this.active) this.restoreDefaultTint();
    });

    // Show subclass name text
    const subText = this.scene.add.text(this.x, this.y - 60, def.name.toUpperCase(), {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    });
    subText.setOrigin(0.5);
    subText.setDepth(101);
    this.scene.tweens.add({
      targets: subText,
      y: this.y - 120,
      alpha: 0,
      scale: 1.5,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => subText.destroy(),
    });
  }

  /** Returns true if the player has a subclass assigned. */
  public hasSubclass(): boolean {
    return this.subclass !== null;
  }

  /**
   * Crusader passive: 15% chance to smite (2x damage burst).
   * Called by CombatManager when calculating damage.
   */
  public getCrusaderSmiteDamageMultiplier(): number {
    if (this.subclass !== 'crusader') return 1;
    if (Math.random() < 0.15) {
      // Show "SMITE!" text
      const smiteText = this.scene.add.text(this.x, this.y - 50, 'SMITE!', {
        fontSize: '22px',
        fontFamily: 'monospace',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold',
      });
      smiteText.setOrigin(0.5);
      smiteText.setDepth(101);
      this.scene.tweens.add({
        targets: smiteText,
        y: this.y - 100,
        alpha: 0,
        scale: 1.4,
        duration: 800,
        ease: 'Power2',
        onComplete: () => smiteText.destroy(),
      });
      // Golden flash
      if (!GameSettings.get().flashReduction) {
        this.setTint(0xffdd44);
        this.scene.time.delayedCall(150, () => {
          if (this.active) this.restoreDefaultTint();
        });
      }
      return 2.0;
    }
    return 1;
  }

  /**
   * Templar passive: enhanced block.
   * Returns adjusted damage reduction multiplier (lower = more reduction).
   */
  public getTemplarBlockReduction(): number {
    if (this.subclass !== 'templar') return this.SHIELD_GUARD_DAMAGE_REDUCTION;
    // +50% block effectiveness: original 0.5 reduction -> 0.25 (blocks 75% instead of 50%)
    return this.SHIELD_GUARD_DAMAGE_REDUCTION * 0.5;
  }

  /**
   * Templar passive: blocking heals 1 HP.
   * Called when a block successfully reduces damage.
   */
  public onTemplarBlock(): void {
    if (this.subclass !== 'templar') return;
    this.healPlayer(1);
    // Green flash for heal
    if (!GameSettings.get().flashReduction) {
      this.setTint(0x44ff88);
      this.scene.time.delayedCall(150, () => {
        if (this.active && this.isShieldGuarding) this.setTint(0x4444ff);
        else if (this.active) this.restoreDefaultTint();
      });
    }
  }

  /**
   * Shadow Dancer passive: dodge grants 1s invisibility.
   * Called after dodge ends.
   */
  public applyShadowDancerInvisibility(): void {
    if (this.subclass !== 'shadow_dancer') return;
    this.shadowDancerInvisible = true;
    this.shadowDancerInvisTimer = 1000;
    this.setAlpha(0.2);
    // While invisible, enemies should ignore (checked via isShadowDancerInvisible)
  }

  /** Whether Shadow Dancer invisibility is active. */
  public get isShadowDancerInvisible(): boolean {
    return this.shadowDancerInvisible;
  }

  /**
   * Shadow Dancer passive: +30% crit chance from stealth.
   * Returns additional crit chance if invisible.
   */
  public getShadowDancerCritBonus(): number {
    if (this.subclass !== 'shadow_dancer' || !this.shadowDancerInvisible) return 0;
    return 0.30;
  }

  /**
   * Iron Fist passive: consecutive hits deal +10% more (stacking).
   * Called on successful hit. Returns damage multiplier.
   */
  public getIronFistDamageMultiplier(): number {
    if (this.subclass !== 'iron_fist') return 1;
    return 1 + (this.ironFistConsecutiveHits * 0.10);
  }

  /** Iron Fist: increment consecutive hit counter. */
  public onIronFistHit(): void {
    if (this.subclass !== 'iron_fist') return;
    this.ironFistConsecutiveHits++;
    this.ironFistComboTimer = this.IRON_FIST_COMBO_TIMEOUT;

    // Show stacking indicator at high counts
    if (this.ironFistConsecutiveHits >= 5 && this.ironFistConsecutiveHits % 5 === 0) {
      const stackText = this.scene.add.text(this.x, this.y - 40,
        `x${this.ironFistConsecutiveHits} FIST!`, {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#ff8844',
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold',
      });
      stackText.setOrigin(0.5);
      stackText.setDepth(101);
      this.scene.tweens.add({
        targets: stackText,
        y: this.y - 80,
        alpha: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => stackText.destroy(),
      });
    }
  }

  /**
   * Inquisitor passive: smite enemies below 20% HP (instant kill).
   * Returns true if the enemy should be instantly killed.
   */
  public shouldInquisitorSmite(enemyHealth: number, enemyMaxHealth: number): boolean {
    if (this.subclass !== 'inquisitor') return false;
    return enemyHealth > 0 && enemyHealth <= enemyMaxHealth * 0.20;
  }

  /** Update subclass-related timers. */
  private updateSubclassTimers(delta: number): void {
    // Subclass ability cooldown
    if (this.subclassAbilityCooldown > 0) {
      this.subclassAbilityCooldown -= delta;
      if (this.subclassAbilityCooldown < 0) this.subclassAbilityCooldown = 0;
    }

    // Divine Shield timer (Templar)
    if (this.divineShieldActive) {
      this.divineShieldTimer -= delta;
      if (this.divineShieldTimer <= 0) {
        this.divineShieldActive = false;
        this.divineShieldTimer = 0;
        // Remove invincibility (natural expiry handled by invincibilityTimer)
        this.restoreDefaultTint();
        this.setAlpha(1);
      }
    }

    // Shadow Dancer invisibility timer
    if (this.shadowDancerInvisible) {
      this.shadowDancerInvisTimer -= delta;
      if (this.shadowDancerInvisTimer <= 0) {
        this.shadowDancerInvisible = false;
        this.shadowDancerInvisTimer = 0;
        if (!this.isDodging && !this.isInvincible) {
          this.setAlpha(1);
        }
      }
    }

    // Iron Fist combo timer (reset consecutive hits if not hitting)
    if (this.subclass === 'iron_fist' && this.ironFistConsecutiveHits > 0) {
      this.ironFistComboTimer -= delta;
      if (this.ironFistComboTimer <= 0) {
        this.ironFistConsecutiveHits = 0;
        this.ironFistComboTimer = 0;
      }
    }
  }

  /** Handle subclass ability activation (key press). */
  private handleSubclassAbility(): void {
    if (!this.subclass || !this.subclassDef) return;
    if (this.subclassAbilityCooldown > 0) return;

    const useKeyboard = this.playerIndex === 0;
    if (!useKeyboard) return; // Only P1 can use subclass ability via keyboard

    if (!Phaser.Input.Keyboard.JustDown(this.subclassAbilityKey)) return;

    switch (this.subclass) {
      case 'crusader':
        this.useHolyCharge();
        break;
      case 'templar':
        this.useDivineShield();
        break;
      case 'shadow_dancer':
        this.useShadowStep();
        break;
      case 'iron_fist':
        this.useQuakePunch();
        break;
      case 'oracle':
        this.useProphecy();
        break;
      case 'inquisitor':
        this.useJudgment();
        break;
    }
  }

  // --- Crusader: Holy Charge ---
  private useHolyCharge(): void {
    if (!this.subclassDef) return;
    this.subclassAbilityCooldown = this.subclassDef.abilityCooldown;
    EventBus.emit("subclass-ability-used", { subclassId: 'crusader' });

    const facingRight = !this.flipX;
    const dashSpeed = 800;
    const dashDuration = 300; // ms
    const dashDir = facingRight ? 1 : -1;

    // Make briefly invincible during charge
    this.invincibilityTimer = Math.max(this.invincibilityTimer, dashDuration);

    // Golden charge effect
    this.setTint(0xffd700);
    this.setVelocityX(dashSpeed * dashDir);
    this.setVelocityY(-100); // Slight upward to look like a charge

    // Create a damage trail
    const damage = Math.round(COMBAT.BASE_DAMAGE * this.classStats.attackDamage * 2.0);
    const hitEnemies = new Set<any>();

    // Repeatedly check for enemies during the dash
    const checkInterval = this.scene.time.addEvent({
      delay: 50,
      repeat: Math.floor(dashDuration / 50),
      callback: () => {
        const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
        if (!enemies) return;
        enemies.children.each((enemy: any) => {
          if (!enemy.active || hitEnemies.has(enemy)) return true;
          if (typeof enemy.takeDamage !== 'function') return true;
          const dx = enemy.x - this.x;
          const dy = enemy.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            hitEnemies.add(enemy);
            enemy.takeDamage(damage);
            // Impact effect
            const impactText = this.scene.add.text(enemy.x, enemy.y - 20, `${damage}`, {
              fontSize: '20px',
              fontFamily: 'monospace',
              color: '#ffd700',
              stroke: '#000000',
              strokeThickness: 3,
              fontStyle: 'bold',
            });
            impactText.setOrigin(0.5);
            impactText.setDepth(101);
            this.scene.tweens.add({
              targets: impactText,
              y: enemy.y - 60,
              alpha: 0,
              duration: 600,
              ease: 'Power2',
              onComplete: () => impactText.destroy(),
            });
          }
          return true;
        });
      },
    });

    // End charge
    this.scene.time.delayedCall(dashDuration, () => {
      checkInterval.destroy();
      if (this.active) {
        this.restoreDefaultTint();
        this.setVelocityX(0);
      }
    });

    // Trail particles
    const trail = this.scene.add.graphics();
    trail.fillStyle(0xffd700, 0.4);
    trail.fillCircle(this.x, this.y, 20);
    trail.setDepth(5);
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 400,
      onComplete: () => trail.destroy(),
    });
  }

  // --- Templar: Divine Shield ---
  private useDivineShield(): void {
    if (!this.subclassDef) return;
    this.subclassAbilityCooldown = this.subclassDef.abilityCooldown;
    EventBus.emit("subclass-ability-used", { subclassId: 'templar' });

    this.divineShieldActive = true;
    this.divineShieldTimer = this.DIVINE_SHIELD_DURATION;
    this.invincibilityTimer = Math.max(this.invincibilityTimer, this.DIVINE_SHIELD_DURATION);

    // Bright golden glow
    this.setTint(0xffffaa);
    this.setAlpha(0.9);

    // Show "DIVINE SHIELD" text
    const shieldText = this.scene.add.text(this.x, this.y - 60, 'DIVINE SHIELD', {
      fontSize: '22px',
      fontFamily: 'monospace',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    });
    shieldText.setOrigin(0.5);
    shieldText.setDepth(101);
    this.scene.tweens.add({
      targets: shieldText,
      y: this.y - 100,
      alpha: 0,
      scale: 1.3,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => shieldText.destroy(),
    });

    // Camera flash
    if (!GameSettings.get().flashReduction) {
      this.scene.cameras.main.flash(300, 255, 255, 200);
    }
  }

  // --- Shadow Dancer: Shadow Step ---
  private useShadowStep(): void {
    if (!this.subclassDef) return;
    this.subclassAbilityCooldown = this.subclassDef.abilityCooldown;
    EventBus.emit("subclass-ability-used", { subclassId: 'shadow_dancer' });

    // Find nearest enemy
    const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
    if (!enemies) return;

    let nearestEnemy: any = null;
    let nearestDist = Infinity;

    enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 400 && dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = enemy;
      }
      return true;
    });

    if (nearestEnemy) {
      // Teleport behind the enemy
      const behindOffset = nearestEnemy.x > this.x ? -50 : 50;
      const oldX = this.x;
      const oldY = this.y;

      this.setPosition(nearestEnemy.x + behindOffset, nearestEnemy.y);
      this.setVelocity(0, 0);

      // Become invisible briefly
      this.applyShadowDancerInvisibility();

      // Visual: purple trail from origin to destination
      const trail = this.scene.add.graphics();
      trail.lineStyle(3, 0x8844cc, 0.6);
      trail.lineBetween(oldX, oldY, this.x, this.y);
      trail.setDepth(5);
      this.scene.tweens.add({
        targets: trail,
        alpha: 0,
        duration: 400,
        onComplete: () => trail.destroy(),
      });

      // Show "SHADOW STEP" text
      const stepText = this.scene.add.text(this.x, this.y - 40, 'SHADOW STEP', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#8844cc',
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold',
      });
      stepText.setOrigin(0.5);
      stepText.setDepth(101);
      this.scene.tweens.add({
        targets: stepText,
        y: this.y - 80,
        alpha: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => stepText.destroy(),
      });
    } else {
      // No enemy nearby — still teleport forward a short distance
      const facingRight = !this.flipX;
      this.setPosition(this.x + (facingRight ? 150 : -150), this.y);
      this.applyShadowDancerInvisibility();
    }
  }

  // --- Iron Fist: Quake Punch ---
  private useQuakePunch(): void {
    if (!this.subclassDef) return;
    if (!this.onGround) return; // Must be grounded
    this.subclassAbilityCooldown = this.subclassDef.abilityCooldown;
    EventBus.emit("subclass-ability-used", { subclassId: 'iron_fist' });

    const stunRadius = 200;
    const damage = Math.round(COMBAT.BASE_DAMAGE * this.classStats.attackDamage * 2.5);

    // Screen shake
    this.scene.cameras.main.shake(400, 0.01);

    // Damage and stun all grounded enemies in range
    const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
    if (enemies) {
      enemies.children.each((enemy: any) => {
        if (!enemy.active || typeof enemy.takeDamage !== 'function') return true;
        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= stunRadius) {
          enemy.takeDamage(damage);
          // Stun: stop enemy movement briefly
          if (typeof enemy.setVelocity === 'function') {
            enemy.setVelocity(0, -200); // Knock up
          }
          if (typeof enemy.stun === 'function') {
            enemy.stun(2000); // 2s stun
          }
        }
        return true;
      });
    }

    // Visual: shockwave ring
    const ring = this.scene.add.graphics();
    ring.lineStyle(4, 0xff6600, 0.8);
    ring.strokeCircle(this.x, this.y + 20, 10);
    ring.setDepth(5);
    this.scene.tweens.add({
      targets: ring,
      scaleX: stunRadius / 10,
      scaleY: stunRadius / 10,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });

    // Show "QUAKE PUNCH" text
    const quakeText = this.scene.add.text(this.x, this.y - 50, 'QUAKE PUNCH', {
      fontSize: '22px',
      fontFamily: 'monospace',
      color: '#ff6600',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    });
    quakeText.setOrigin(0.5);
    quakeText.setDepth(101);
    this.scene.tweens.add({
      targets: quakeText,
      y: this.y - 100,
      alpha: 0,
      scale: 1.3,
      duration: 800,
      ease: 'Power2',
      onComplete: () => quakeText.destroy(),
    });
  }

  // --- Oracle: Prophecy ---
  private useProphecy(): void {
    if (!this.subclassDef) return;
    this.subclassAbilityCooldown = this.subclassDef.abilityCooldown;
    EventBus.emit("subclass-ability-used", { subclassId: 'oracle' });

    // Emit a custom event that the UI can listen to for showing item previews
    // For now, reveal hidden items nearby (boost item radar range briefly)
    const revealText = this.scene.add.text(this.x, this.y - 50, 'PROPHECY', {
      fontSize: '22px',
      fontFamily: 'monospace',
      color: '#cc88ff',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    });
    revealText.setOrigin(0.5);
    revealText.setDepth(101);
    this.scene.tweens.add({
      targets: revealText,
      y: this.y - 100,
      alpha: 0,
      scale: 1.3,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => revealText.destroy(),
    });

    // Visual: expanding purple ring
    const ring = this.scene.add.graphics();
    ring.lineStyle(3, 0xcc88ff, 0.6);
    ring.strokeCircle(this.x, this.y, 10);
    ring.setDepth(5);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 30,
      scaleY: 30,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });

    // Reveal all items on screen for 5 seconds
    // This is a simplified version — full implementation would show next 3 item choices
    // For now, expand item radar to entire screen
    const items = (this.scene as any).items as Phaser.Physics.Arcade.Group;
    if (items) {
      items.children.each((item: any) => {
        if (!item.active) return true;
        // Highlight items with a glow
        const glow = this.scene.add.graphics();
        glow.fillStyle(0xcc88ff, 0.3);
        glow.fillCircle(item.x, item.y, 20);
        glow.setDepth(4);
        this.scene.tweens.add({
          targets: glow,
          alpha: 0,
          duration: 5000,
          onComplete: () => glow.destroy(),
        });
        return true;
      });
    }

    // Camera flash
    if (!GameSettings.get().flashReduction) {
      this.scene.cameras.main.flash(300, 200, 140, 255);
    }
  }

  // --- Inquisitor: Judgment ---
  private useJudgment(): void {
    if (!this.subclassDef) return;
    this.subclassAbilityCooldown = this.subclassDef.abilityCooldown;
    EventBus.emit("subclass-ability-used", { subclassId: 'inquisitor' });

    const facingRight = !this.flipX;
    const beamLength = 600;
    const beamWidth = 40;
    const damage = Math.round(COMBAT.BASE_DAMAGE * this.classStats.attackDamage * 3.0);

    // Create beam visual
    const beamX = facingRight ? this.x + beamLength / 2 : this.x - beamLength / 2;
    const beam = this.scene.add.rectangle(
      beamX,
      this.y,
      beamLength,
      beamWidth,
      0xffffaa,
      0.6,
    );
    beam.setDepth(5);
    this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      scaleY: 0.1,
      duration: 400,
      ease: 'Power2',
      onComplete: () => beam.destroy(),
    });

    // Deal damage to all enemies in the beam path
    const enemies = (this.scene as any).enemies as Phaser.Physics.Arcade.Group;
    if (enemies) {
      enemies.children.each((enemy: any) => {
        if (!enemy.active || typeof enemy.takeDamage !== 'function') return true;
        const dx = enemy.x - this.x;
        const dy = Math.abs(enemy.y - this.y);
        // Check if enemy is in the beam's horizontal range and close enough vertically
        const inBeamH = facingRight ? (dx > 0 && dx < beamLength) : (dx < 0 && dx > -beamLength);
        if (inBeamH && dy < beamWidth) {
          enemy.takeDamage(damage);
          // Show damage number
          const dmgText = this.scene.add.text(enemy.x, enemy.y - 20, `${damage}`, {
            fontSize: '20px',
            fontFamily: 'monospace',
            color: '#ffffaa',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold',
          });
          dmgText.setOrigin(0.5);
          dmgText.setDepth(101);
          this.scene.tweens.add({
            targets: dmgText,
            y: enemy.y - 60,
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => dmgText.destroy(),
          });
        }
        return true;
      });
    }

    // Show "JUDGMENT" text
    const judgText = this.scene.add.text(this.x, this.y - 60, 'JUDGMENT', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#ffffaa',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    });
    judgText.setOrigin(0.5);
    judgText.setDepth(101);
    this.scene.tweens.add({
      targets: judgText,
      y: this.y - 110,
      alpha: 0,
      scale: 1.3,
      duration: 800,
      ease: 'Power2',
      onComplete: () => judgText.destroy(),
    });

    // Screen shake
    this.scene.cameras.main.shake(200, 0.005);
  }
}

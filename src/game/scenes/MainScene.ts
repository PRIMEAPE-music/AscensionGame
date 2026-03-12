import Phaser from "phaser";
import { Player } from "../entities/Player";
import { LevelGenerator } from "../systems/LevelGenerator";
import { SpawnManager } from "../systems/SpawnManager";
import { PortalPlatform } from "../entities/PortalPlatform";
import { WindCurrent } from "../entities/WindCurrent";
import { CombatManager } from "../systems/CombatManager";
import { SlopeManager } from "../systems/SlopeManager";
import { StyleManager } from "../systems/StyleManager";
import { BiomeRenderer } from "../systems/BiomeRenderer";
import { PlatformTextureManager } from "../systems/PlatformTextureManager";
import { BackgroundRenderer } from "../systems/BackgroundRenderer";
import { PlatformEffectsManager } from "../systems/PlatformEffectsManager";
import { ParticleManager } from "../systems/ParticleManager";
import { AtmosphereManager } from "../systems/AtmosphereManager";
import { BossArenaManager } from "../systems/BossArenaManager";
import { HazardManager } from "../systems/HazardManager";
import { EventBus } from "../systems/EventBus";
import { ClassType } from "../config/ClassConfig";
import { WORLD } from "../config/GameConfig";
import { PlatformType } from "../config/PlatformTypes";
import { SPRITE_CONFIG, ANIMATIONS } from "../config/AnimationConfig";
import { ENEMY_REGISTRY } from "../config/EnemyConfig";
import { DamageNumberManager } from "../systems/DamageNumberManager";
import { SacredGround } from "../systems/SacredGround";
import { RisingDarkness } from "../systems/RisingDarkness";
import { PersistentStats } from "../systems/PersistentStats";
import { ActiveModifiers } from "../config/RunModifiers";
import { ITEMS } from "../config/ItemDatabase";
import { GameSettings } from "../systems/GameSettings";
import { AudioManager } from "../systems/AudioManager";
import { RunSaveManager } from "../systems/RunSaveManager";
import type { RunSaveData } from "../systems/RunSaveManager";
import { GamepadManager } from "../systems/GamepadManager";
import { TouchControls } from "../systems/TouchControls";
import { MouseManager } from "../systems/MouseManager";
import { TutorialManager } from "../systems/TutorialManager";
import { ReplayManager } from "../systems/ReplayManager";
import { SoundCueManager } from "../systems/SoundCueManager";
import { AchievementManager } from "../systems/AchievementManager";

const ESSENCE_REWARDS: Record<string, number> = {
  basic: 5,
  intermediate: 15,
  advanced: 30,
  elite: 60,
};

export class MainScene extends Phaser.Scene {
  private player!: Player;
  private staticPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private movingPlatforms!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private items!: Phaser.Physics.Arcade.Group;
  private portals!: Phaser.Physics.Arcade.Group;
  private windCurrents!: Phaser.Physics.Arcade.StaticGroup;
  private levelGenerator!: LevelGenerator;
  private spawnManager!: SpawnManager;
  private combatManager!: CombatManager;
  private slopeManager!: SlopeManager;
  private styleManager!: StyleManager;
  private biomeRenderer!: BiomeRenderer;
  private platformTextureManager!: PlatformTextureManager;
  private backgroundRenderer!: BackgroundRenderer;
  private platformEffectsManager!: PlatformEffectsManager;
  private particleManager!: ParticleManager;
  private atmosphereManager!: AtmosphereManager;
  private bossArenaManager!: BossArenaManager;
  private hazardManager!: HazardManager;
  private risingDarkness!: RisingDarkness;
  private touchControls: TouchControls | null = null;
  private bossWarningEmitted: boolean = false;
  private lastSpeedEmitTime: number = 0;
  private progressUpdateTimer: number = 0;
  private leftWall!: Phaser.GameObjects.Rectangle;
  private rightWall!: Phaser.GameObjects.Rectangle;
  private highestY: number = WORLD.PLAYER_SPAWN.y;
  private ridingPlatform: Phaser.GameObjects.GameObject | null = null;
  private activeWindZones: Set<WindCurrent> = new Set();

  // Run tracking
  private killCount: number = 0;
  private bossesDefeated: number = 0;
  private essenceTotal: number = 0;
  private runStartTime: number = 0;

  // Save system
  private lastSaveAltitude: number = 0;

  // Play time tracking (for periodic save)
  private playTimeAccumulator: number = 0;
  private lastPlayTimeSave: number = 0;

  // Sacred Ground instances (Priest class mechanic)
  private sacredGrounds: SacredGround[] = [];
  private sacredGroundUnsubscribe: (() => void) | null = null;

  // EventBus listener cleanup functions (prevent leak across scene restarts)
  private _eventCleanups: (() => void)[] = [];

  // Boss fight tracking for AchievementManager
  private _inBossFight: boolean = false;

  constructor() {
    super({ key: "MainScene" });
  }

  preload() {
    const ground = this.make.graphics({ x: 0, y: 0 }, false);
    ground.fillStyle(0x00ff00);
    ground.fillRect(0, 0, 400, 32);
    ground.generateTexture("ground", 400, 32);

    const sky = this.make.graphics({ x: 0, y: 0 }, false);
    sky.fillStyle(0x000033);
    sky.fillRect(0, 0, 800, 600);
    sky.generateTexture("sky", 800, 600);

    // Load monk spritesheets
    for (const anim of ANIMATIONS) {
      this.load.spritesheet(
        anim.textureKey,
        `assets/sprites/${anim.textureKey}_sheet.png`,
        {
          frameWidth: SPRITE_CONFIG.FRAME_WIDTH,
          frameHeight: SPRITE_CONFIG.FRAME_HEIGHT,
        },
      );
    }
  }

  create() {
    // Groups
    this.staticPlatforms = this.physics.add.staticGroup();
    this.movingPlatforms = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });
    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.items = this.physics.add.group();
    this.portals = this.physics.add.group({ allowGravity: false });
    this.windCurrents = this.physics.add.staticGroup();

    // Systems (order matters: background layers first)
    this.biomeRenderer = new BiomeRenderer(this);
    this.backgroundRenderer = new BackgroundRenderer(this);
    this.biomeRenderer.hideVisuals(); // BackgroundRenderer replaces BiomeRenderer's visual layers
    this.atmosphereManager = new AtmosphereManager(this);
    this.slopeManager = new SlopeManager(this);
    this.styleManager = new StyleManager(this);

    // Walls
    this.leftWall = this.add.rectangle(
      -25,
      540,
      WORLD.WALL_WIDTH,
      2000,
      0x333333,
    );
    this.physics.add.existing(this.leftWall, true);
    this.rightWall = this.add.rectangle(
      WORLD.WIDTH + 25,
      540,
      WORLD.WALL_WIDTH,
      2000,
      0x333333,
    );
    this.physics.add.existing(this.rightWall, true);

    // Platform texture manager (procedural textures per biome)
    this.platformTextureManager = new PlatformTextureManager(this);
    this.platformEffectsManager = new PlatformEffectsManager(this);

    // Level generator (needs SlopeManager reference)
    this.levelGenerator = new LevelGenerator(
      this,
      this.staticPlatforms,
      this.movingPlatforms,
      this.slopeManager,
    );
    this.levelGenerator.setTextureManager(this.platformTextureManager);
    this.levelGenerator.setPlatformEffectsManager(this.platformEffectsManager);

    // Boss arena manager
    this.bossArenaManager = new BossArenaManager(this, this.staticPlatforms);
    this.levelGenerator.setBossArenaManager(this.bossArenaManager);

    this.levelGenerator.init();

    // Player (created early so HazardManager can reference it)
    const selectedClass: ClassType =
      (window as any).__selectedClass || ClassType.MONK;
    this.player = new Player(
      this,
      WORLD.PLAYER_SPAWN.x,
      WORLD.PLAYER_SPAWN.y,
      selectedClass,
    );
    this.highestY = WORLD.PLAYER_SPAWN.y;

    // Persistent stats — load from localStorage and start tracking this run
    PersistentStats.load();
    PersistentStats.startRun(selectedClass);

    // Apply pre-equipped gold items from the equip screen
    const equippedGoldItems: string[] = (window as any).__equippedGoldItems || [];
    for (const itemId of equippedGoldItems) {
      const itemData = ITEMS[itemId];
      if (itemData && itemData.type === 'GOLD') {
        this.player.collectItem(itemData);
      }
    }

    // Touch controls (create if on a touch device)
    const touchSettings = GameSettings.get();
    if (touchSettings.touchControlsEnabled && ("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
      this.touchControls = new TouchControls(this);
      this.player.setTouchControls(this.touchControls);
    }

    // Hazard manager (needs player and staticPlatforms)
    this.hazardManager = new HazardManager(this, this.player, this.staticPlatforms);

    // Rising Darkness system (optional difficulty modifier)
    this.risingDarkness = new RisingDarkness(this);
    if (ActiveModifiers.isActive('rising_darkness')) {
      this.risingDarkness.enable(WORLD.PLAYER_SPAWN.y);
    }

    // Apply silver item slot modifiers
    // Minimalist: cap at 1 slot (already starts at 1, so no change needed — addSilverItemSlot is blocked in boss-defeated handler)
    // Speed Demon: extra slot at start (+1, so player starts with 2) — but Minimalist overrides
    if (ActiveModifiers.isActive('speed_demon') && !ActiveModifiers.isActive('minimalist')) {
      this.player.addSilverItemSlot();
    }

    // Particle effects (needs player for state tracking)
    this.particleManager = new ParticleManager(this);

    // Systems
    this.spawnManager = new SpawnManager(
      this,
      this.enemies,
      this.items,
      this.player,
      this.staticPlatforms,
    );
    this.spawnManager.setPortalGroup(this.portals);
    this.spawnManager.setWindGroup(this.windCurrents);
    this.combatManager = new CombatManager(this, this.player, this.enemies);
    this.combatManager.setDamageNumberManager(new DamageNumberManager(this));
    this.combatManager.setParticleManager(this.particleManager);

    // Colliders
    this.physics.add.collider(
      this.player,
      this.staticPlatforms,
      this.handleStaticPlatformCollision,
      this.oneWayPlatformCheck,
      this,
    );
    this.physics.add.collider(
      this.player,
      this.movingPlatforms,
      (_player, platform) => {
        if (this.player.body!.touching.down || this.player.body!.blocked.down) {
          this.ridingPlatform = platform;
          this.player.detectPlatformType(platform);
        }
      },
      this.oneWayPlatformCheck,
      this,
    );
    this.physics.add.collider(this.enemies, this.staticPlatforms);
    this.physics.add.collider(this.enemies, this.movingPlatforms);
    this.physics.add.collider(this.items, this.staticPlatforms);
    this.physics.add.collider(this.items, this.movingPlatforms);
    this.physics.add.collider(this.player, this.leftWall);
    this.physics.add.collider(this.player, this.rightWall);

    // Combat overlaps (delegated to CombatManager)
    this.physics.add.overlap(
      this.player,
      this.enemies,
      (p, e) => this.combatManager.handleContactDamage(p, e),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.player,
      this.items,
      (p, i) => this.combatManager.handleItemCollision(p, i),
      undefined,
      this,
    );

    // Stalactite-player overlap (hazard system)
    this.physics.add.overlap(
      this.player,
      this.hazardManager.getStalactites(),
      (_p, s) => this.hazardManager.handleStalactitePlayerOverlap(_p, s),
      undefined,
      this,
    );

    // Portal platform overlap — teleport player when touching a portal
    this.physics.add.overlap(
      this.player,
      this.portals,
      (_p, portal) => this.handlePortalOverlap(portal as PortalPlatform),
      undefined,
      this,
    );

    // Wind current overlap — apply force to player when inside a wind zone
    this.physics.add.overlap(
      this.player,
      this.windCurrents,
      (_p, windZone) => this.handleWindOverlap(windZone as WindCurrent),
      undefined,
      this,
    );

    // Register sprite animations
    for (const anim of ANIMATIONS) {
      this.anims.create({
        key: anim.key,
        frames: this.anims.generateFrameNumbers(anim.textureKey, {
          start: 0,
          end: anim.frameCount - 1,
        }),
        frameRate: anim.frameRate,
        repeat: anim.repeat,
      });
    }

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.05, 0.05);
    this.cameras.main.setDeadzone(100, 100);
    // Bound camera to world edges: left=0, top=-Infinity (player ascends forever), right=WORLD.WIDTH, bottom=WORLD.HEIGHT
    this.cameras.main.setBounds(0, -Number.MAX_SAFE_INTEGER, WORLD.WIDTH, Number.MAX_SAFE_INTEGER + WORLD.HEIGHT);

    // Mouse manager (click-to-attack, mouse aim, camera lookahead)
    MouseManager.init(this);

    // Prevent Alt from triggering browser menu
    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.ALT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);

    // Auto-focus the game canvas for keyboard input
    this.game.canvas.focus();

    // Emit initial health
    EventBus.emit("health-change", {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
    });

    // Listen for boss defeats to spawn reward items
    this._eventCleanups.push(EventBus.on("boss-defeated", (data) => {
      // Spawn a silver item at the player's location
      this.spawnManager.spawnRandomItem(this.player.x, this.player.y - 50);
      // Every 3rd boss also drops a gold item
      if (data.bossNumber % 3 === 0) {
        this.spawnManager.spawnRandomItem(this.player.x + 60, this.player.y - 50);
      }

      // Track boss defeat and award essence
      this.bossesDefeated++;
      PersistentStats.addBossDefeat();
      let bossEssence = 50 * data.bossNumber;

      // Essence Boost ability: +25% essence
      if (this.player.abilities.has('essence_boost')) {
        bossEssence = Math.round(bossEssence * 1.25);
      }

      this.essenceTotal += bossEssence;
      EventBus.emit("essence-change", {
        essence: this.essenceTotal,
        gained: bossEssence,
      });

      // Every 3rd boss grants +1 silver item slot (unless Minimalist is active)
      if (data.bossNumber % 3 === 0 && !ActiveModifiers.isActive('minimalist')) {
        this.player.addSilverItemSlot();
      }
    }));

    // Track enemy kills and award essence
    this._eventCleanups.push(EventBus.on("enemy-killed", (data) => {
      this.killCount++;
      PersistentStats.addKill();

      // Tutorial: trigger first-kill hint
      if (this.killCount === 1) {
        TutorialManager.triggerEvent('first-kill');
      }

      // Vampirism ability: heal on every 10th kill
      this.player.onEnemyKilled();

      const def = ENEMY_REGISTRY[data.enemyType];
      const tier = def?.tier ?? "basic";
      let essenceReward = ESSENCE_REWARDS[tier] ?? 5;

      // Essence Boost ability: +25% essence
      if (this.player.abilities.has('essence_boost')) {
        essenceReward = Math.round(essenceReward * 1.25);
      }

      // Soul Collector ability: +15% bonus essence (stacked: +30%)
      if (this.player.abilities.has('soul_collector')) {
        const soulBonus = this.player.stackedAbilities.has('soul_collector') ? 0.30 : 0.15;
        essenceReward = Math.round(essenceReward * (1 + soulBonus));
      }

      this.essenceTotal += essenceReward;
      EventBus.emit("essence-change", {
        essence: this.essenceTotal,
        gained: essenceReward,
      });
    }));

    // Handle shop purchases
    this._eventCleanups.push(EventBus.on("shop-purchase", (data) => {
      switch (data.offeringId) {
        case "health_restore":
          if (this.player.health < this.player.maxHealth) {
            this.player.health = Math.min(this.player.health + 1, this.player.maxHealth);
            EventBus.emit("health-change", {
              health: this.player.health,
              maxHealth: this.player.maxHealth,
            });
          }
          break;
        case "random_item":
          this.spawnManager.spawnRandomItem(this.player.x, this.player.y - 40);
          break;
        case "damage_buff": {
          // Temporary +20% damage for 2 minutes
          const currentMod = this.player.statModifiers.get("attackDamage") || 0;
          this.player.statModifiers.set("attackDamage", currentMod + 0.2);
          this.time.delayedCall(120000, () => {
            const mod = this.player.statModifiers.get("attackDamage") || 0;
            this.player.statModifiers.set("attackDamage", mod - 0.2);
          });
          break;
        }
      }
      // Deduct essence
      this.essenceTotal -= data.cost;
      EventBus.emit("essence-change", {
        essence: this.essenceTotal,
        gained: -data.cost,
      });
    }));

    // Listen for Priest Sacred Ground creation
    this.sacredGroundUnsubscribe = EventBus.on("priest-sacred-ground", (data) => {
      const sg = new SacredGround(
        this,
        this.player,
        this.enemies,
        data.x,
        data.y,
      );
      this.sacredGrounds.push(sg);
    });

    // Award style points when a combo ends (3+ hits)
    EventBus.on("combo-end", (data) => {
      this.styleManager.onComboEnd(data.finalCount);
    });

    // Award style points when launching off a slope
    EventBus.on("slope-launch", (data) => {
      this.styleManager.onSlopeLaunch(data.speed);
    });

    // Handle gambling results
    this._eventCleanups.push(EventBus.on("gambling-result", (data) => {
      switch (data.rewardType) {
        case "health":
          if (this.player.health < this.player.maxHealth) {
            this.player.health = Math.min(this.player.health + 1, this.player.maxHealth);
            EventBus.emit("health-change", {
              health: this.player.health,
              maxHealth: this.player.maxHealth,
            });
          }
          break;
        case "item":
          this.spawnManager.spawnRandomItem(this.player.x, this.player.y - 40);
          break;
        case "gold_item":
          this.spawnManager.spawnRandomItem(this.player.x, this.player.y - 40);
          // Spawn a second item for gold tier
          this.spawnManager.spawnRandomItem(this.player.x + 60, this.player.y - 40);
          break;
      }
      // Deduct essence
      this.essenceTotal -= data.bet;
      EventBus.emit("essence-change", {
        essence: this.essenceTotal,
        gained: -data.bet,
      });
    }));

    // Handle gambling close — resume scene
    this._eventCleanups.push(EventBus.on("gambling-close", () => {
      this.scene.resume();
    }));

    // Handle item replacement decision
    this._eventCleanups.push(EventBus.on("item-replace-decision", (data) => {
      if (data.action === "take" && data.replaceIndex !== undefined) {
        this.player.handleReplaceDecision(data.replaceIndex);
      } else {
        this.player.handleReplaceDecision(-1); // -1 means leave
      }
    }));

    // Audio system — init, hook into game events, and start procedural music
    AudioManager.init();
    AudioManager.resume();
    AudioManager.startMusic();

    this._eventCleanups.push(EventBus.on("enemy-killed", () => AudioManager.playHitHeavy()));
    this._eventCleanups.push(EventBus.on("boss-warning", () => AudioManager.startBossMusic()));
    this._eventCleanups.push(EventBus.on("boss-defeated", () => AudioManager.playBossDefeat()));
    this._eventCleanups.push(EventBus.on("parry-success", () => AudioManager.playParry()));
    this._eventCleanups.push(EventBus.on("portal-teleport", () => {
      AudioManager.playPortalTeleport();
      PersistentStats.addPortalUsed();
    }));
    this._eventCleanups.push(EventBus.on("combo-update", () => AudioManager.playComboTick()));
    this._eventCleanups.push(EventBus.on("essence-change", (data) => {
      if (data.gained > 0) AudioManager.playEssencePickup();
    }));
    this._eventCleanups.push(EventBus.on("player-jump", () => AudioManager.playJump()));
    this._eventCleanups.push(EventBus.on("player-attack", () => AudioManager.playAttackSwing()));
    this._eventCleanups.push(EventBus.on("player-dodge", (data) => {
      if (data.perfect) {
        AudioManager.playPerfectDodge();
      } else {
        AudioManager.playDodge();
      }
    }));
    this._eventCleanups.push(EventBus.on("player-land", () => AudioManager.playLand()));
    this._eventCleanups.push(EventBus.on("item-pickup", () => AudioManager.playItemPickup()));

    // Initialize visual sound cue system (accessibility)
    SoundCueManager.init(this);

    // Music state: biome changes
    this._eventCleanups.push(EventBus.on("biome-change", (data) => AudioManager.setBiome(data.biome)));

    // Music state: boss fight
    this._eventCleanups.push(EventBus.on("boss-spawn", () => AudioManager.setBossState(true)));
    this._eventCleanups.push(EventBus.on("boss-defeated", () => AudioManager.setBossState(false)));

    // Boss arena visual effects
    this._eventCleanups.push(EventBus.on("boss-arena-start", (_data) => {
      // Darken ambient lighting during boss fight
      this.cameras.main.setBackgroundColor(0x000011);
    }));
    this._eventCleanups.push(EventBus.on("boss-arena-end", () => {
      // Restore ambient lighting after boss fight
      this.cameras.main.setBackgroundColor(0x000000);
    }));
    this._eventCleanups.push(EventBus.on("boss-enrage", () => {
      // Screen effect for boss entering enrage (phase 3)
      AudioManager.playHitHeavy();
    }));

    // AchievementManager: boss fight tracking
    let prevHealthForBoss = this.player.health;
    this._eventCleanups.push(EventBus.on("boss-arena-start", () => {
      this._inBossFight = true;
      prevHealthForBoss = this.player.health;
      AchievementManager.startBossFight();
    }));
    this._eventCleanups.push(EventBus.on("health-change", (data) => {
      // Record boss damage when player health decreases during a boss fight
      if (this._inBossFight && data.health < prevHealthForBoss) {
        AchievementManager.recordBossDamage();
      }
      prevHealthForBoss = data.health;
    }));
    this._eventCleanups.push(EventBus.on("boss-defeated", () => {
      if (this._inBossFight) {
        AchievementManager.endBossFight(true);
        this._inBossFight = false;
      }
    }));
    this._eventCleanups.push(EventBus.on("player-died", () => {
      if (this._inBossFight) {
        AchievementManager.endBossFight(false);
        this._inBossFight = false;
      }
    }));
    this._eventCleanups.push(EventBus.on("boss-arena-end", () => {
      if (this._inBossFight) {
        // Boss arena ended without a defeat event — boss was not killed
        AchievementManager.endBossFight(false);
        this._inBossFight = false;
      }
    }));

    // Music state: low health
    this._eventCleanups.push(EventBus.on("health-change", (data) => AudioManager.setLowHealth(data.health <= 1)));

    // Handle player death — emit death screen event with run stats
    this.runStartTime = Date.now();
    this._eventCleanups.push(EventBus.on("player-died", () => {
      AudioManager.stopMusic();
      AudioManager.playDeath();
      AudioManager.playDeathMusic();

      // Tutorial: mark first run as done
      TutorialManager.completeFirstRun();
      const altitude = Math.max(
        0,
        (WORLD.BASE_PLATFORM_Y - this.player.y) / WORLD.ALTITUDE_SCALE,
      );

      // Clear saved run on death
      RunSaveManager.clear();

      // Finalize persistent stats for this run and save to localStorage
      PersistentStats.setEssence(this.essenceTotal);
      PersistentStats.endRun();
      PersistentStats.save();

      EventBus.emit("show-death-screen", {
        altitude: Math.floor(altitude),
        kills: this.killCount,
        bossesDefeated: this.bossesDefeated,
        timeMs: Date.now() - this.runStartTime,
        essenceEarned: this.essenceTotal,
      });
    }));

    // Save after boss defeat
    this._eventCleanups.push(EventBus.on("boss-defeated", () => {
      // Delay slightly to let boss reward processing finish
      this.time.delayedCall(500, () => {
        RunSaveManager.save(this.buildSaveData());
      });
    }));

    // Check for resume data
    const resumeData = (window as any).__resumeData as RunSaveData | undefined;
    if (resumeData) {
      delete (window as any).__resumeData;
      this.resumeFromSave(resumeData);
    }
  }

  update(time: number, delta: number) {
    // Poll gamepad once per frame before any input consumers read it
    GamepadManager.update();

    // Update touch controls each frame
    if (this.touchControls) {
      this.touchControls.update();
    }

    // Update mouse manager (aim tracking, click detection)
    MouseManager.update(this.player.x, this.player.y);

    // Gamepad pause: simulate Escape keydown so App.tsx's existing handler catches it
    if (GamepadManager.state.pauseJustPressed) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    }

    // Carry player with moving platform
    if (this.ridingPlatform) {
      const plat = this.ridingPlatform as any;
      const prevX = plat.getData("prevX");
      if (prevX !== undefined && prevX !== null) {
        const dx = plat.x - prevX;
        if (dx !== 0) {
          this.player.x += dx;
        }
      }
    }
    this.ridingPlatform = null;

    // Store prevX for all moving platforms
    this.movingPlatforms.children.each((plat: any) => {
      plat.setData("prevX", plat.x);
      return true;
    });

    this.player.update(time, delta);
    this.levelGenerator.update(this.player.y);

    // Slope collision (after player update, before other systems)
    this.player.clearSlopeState();
    const slopeResult = this.slopeManager.update(this.player);
    if (slopeResult) {
      this.player.handleSlopePhysics(slopeResult);
    }

    // Track highest point reached
    if (this.player.y < this.highestY) {
      this.highestY = this.player.y;
    }

    // Calculate altitude
    const altitude = Math.max(
      0,
      (WORLD.BASE_PLATFORM_Y - this.player.y) / WORLD.ALTITUDE_SCALE,
    );
    PersistentStats.setAltitude(altitude);
    EventBus.emit("altitude-change", { altitude });

    // Replay recording — capture player state at fixed intervals
    ReplayManager.recordFrame(this.player, delta, altitude);

    // Tutorial hint checks
    const selectedClassType: string = (window as any).__selectedClass || 'MONK';
    TutorialManager.checkTriggers(altitude, Date.now() - this.runStartTime, selectedClassType);

    // Periodically save play time (every 30 seconds)
    this.playTimeAccumulator += delta;
    if (this.playTimeAccumulator - this.lastPlayTimeSave >= 30000) {
      const elapsed = this.playTimeAccumulator - this.lastPlayTimeSave;
      this.lastPlayTimeSave = this.playTimeAccumulator;
      PersistentStats.addPlayTime(elapsed);
      PersistentStats.save();
    }

    // Auto-save every 500m climbed
    if (altitude >= this.lastSaveAltitude + 500) {
      this.lastSaveAltitude = Math.floor(altitude / 500) * 500;
      RunSaveManager.save(this.buildSaveData());
    }

    // Boss arena system
    this.bossArenaManager.update(altitude, this.player.y);

    // Hazard system (stalactites, wind, portal effects)
    this.hazardManager.update(time, delta, altitude, this.cameras.main.scrollY);

    // Wind zone exit detection: clear zones the player has left
    this.updateWindZoneTracking();

    // Rising Darkness system
    this.risingDarkness.update(
      delta,
      this.player.y,
      (amount: number) => this.player.takeDamage(amount),
      this.enemies,
    );

    // Style tracking
    const vx = this.player.body!.velocity.x;
    const vy = this.player.body!.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    this.styleManager.update(delta, speed);

    // Emit speed for HUD (throttled to every 100ms)
    if (time - this.lastSpeedEmitTime >= 100) {
      this.lastSpeedEmitTime = time;
      const maxSpeed = 600;
      EventBus.emit('speed-change', { speed: Math.round(speed), maxSpeed });
    }

    // Throttled progress update for minimap/progress indicator (every 500ms)
    this.progressUpdateTimer += delta;
    if (this.progressUpdateTimer >= 500) {
      this.progressUpdateTimer = 0;
      EventBus.emit('progress-update', {
        altitude,
        nextBossAltitude: this.bossArenaManager.getNextBossAltitude(),
        biome: this.biomeRenderer.getCurrentBiomeInfo().biome,
      });
    }

    // Biome visuals
    this.biomeRenderer.update(altitude, this.cameras.main.scrollY);
    this.backgroundRenderer.update(this.player.y, this.cameras.main);
    this.atmosphereManager.update(time, altitude);
    this.platformEffectsManager.update(time, delta);
    this.particleManager.update(this.player, time, delta);

    // Systems — suppress normal spawning during boss fights
    if (!this.bossArenaManager.getIsBossFight()) {
      this.spawnManager.update(altitude, delta);
    }
    this.combatManager.update(delta);

    // Update music combat state based on nearby active enemies
    let nearbyEnemyCount = 0;
    this.enemies.children.each((e: any) => {
      if (e.active && Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 500) {
        nearbyEnemyCount++;
      }
      return true;
    });
    AudioManager.setCombatState(nearbyEnemyCount > 0);

    // Update visual sound cue indicators (accessibility)
    SoundCueManager.update(this.player.x, this.player.y, delta);

    // Accessibility: Slower Enemies — halve enemy attack speed by doubling their cooldowns
    const accessSettings = GameSettings.get();
    if (accessSettings.assistMode && accessSettings.slowerEnemies) {
      this.enemies.children.each((enemy: any) => {
        if (enemy.active) {
          // Double attack cooldowns to make enemies attack 50% slower
          if (enemy.attackCooldown !== undefined && !enemy._slowApplied) {
            enemy.attackCooldown *= 2;
            enemy._slowApplied = true;
          }
          // Also slow movement velocity during attack states
          if (enemy.state === 'ATTACKING' || enemy.state === 'CHARGING') {
            const body = enemy.body as Phaser.Physics.Arcade.Body | null;
            if (body) {
              body.velocity.x *= 0.5;
              body.velocity.y *= 0.5;
            }
          }
        }
        return true;
      });
    }

    // Update Sacred Ground instances (Priest mechanic)
    this.sacredGrounds = this.sacredGrounds.filter((sg) => !sg.update(delta));

    // Death plane (relative to highest reached point)
    if (this.player.y > this.highestY + WORLD.DEATH_PLANE_OFFSET) {
      this.player.setPosition(this.player.x, this.highestY);
      this.player.setVelocity(0, 0);
      this.player.takeDamage(1);
    }

    // Mouse camera lookahead: offset camera follow target toward mouse position
    if (GameSettings.get().mouseCameraLookahead) {
      const offset = MouseManager.getCameraOffset();
      this.cameras.main.setFollowOffset(-offset.x, -offset.y);
    } else {
      this.cameras.main.setFollowOffset(0, 0);
    }

    // Clear one-frame mouse click flags after all input consumers have read them
    MouseManager.lateUpdate();

    // Update wall positions to follow camera
    this.updateWalls();
  }

  public buildSaveData(): RunSaveData {
    const altitude = Math.max(
      0,
      (WORLD.BASE_PLATFORM_Y - this.player.y) / WORLD.ALTITUDE_SCALE,
    );
    return {
      version: 1,
      timestamp: Date.now(),
      classType: (window as any).__selectedClass || 'PALADIN',
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      altitude: Math.floor(altitude),
      essence: this.essenceTotal,
      elapsedTimeMs: Date.now() - this.runStartTime,
      kills: this.killCount,
      bossesDefeated: this.bossesDefeated,
      maxSilverItems: this.player.getMaxSilverItems(),
      silverItems: this.player.inventory
        .filter(item => item.type === 'SILVER')
        .map(item => ({
          id: item.id,
          quality: item.quality,
        })),
      equippedGoldItems: (window as any).__equippedGoldItems || [],
      abilities: [...this.player.abilities],
      activeModifiers: [...(ActiveModifiers.active || [])],
      nextBossAltitude: this.bossArenaManager.getNextBossAltitude(),
      playerX: this.player.x,
      damageDealt: PersistentStats.getRunStats().damageDealt,
      damageTaken: PersistentStats.getRunStats().damageTaken,
      perfectDodges: PersistentStats.getRunStats().perfectDodges,
      itemsCollected: PersistentStats.getRunStats().itemsCollected,
    };
  }

  private resumeFromSave(data: RunSaveData): void {
    // Set player position to saved altitude
    const targetY = WORLD.BASE_PLATFORM_Y - data.altitude * WORLD.ALTITUDE_SCALE;
    this.player.setPosition(data.playerX, targetY);
    this.player.health = data.health;
    this.player.maxHealth = data.maxHealth;

    // Restore essence
    this.essenceTotal = data.essence;
    EventBus.emit("essence-change", { essence: this.essenceTotal, gained: 0 });

    // Restore run counters
    this.killCount = data.kills;
    this.bossesDefeated = data.bossesDefeated;

    // Adjust run start time to account for previously elapsed time
    this.runStartTime = Date.now() - data.elapsedTimeMs;

    // Restore max silver item slots from save (set directly to avoid emitting extra events)
    if (data.maxSilverItems && data.maxSilverItems > 1) {
      this.player.setMaxSilverItems(data.maxSilverItems);
    }

    // Restore silver items from save
    for (const savedItem of data.silverItems) {
      const itemData = ITEMS[savedItem.id];
      if (itemData) {
        // Create a copy with saved quality
        const itemWithQuality = { ...itemData, quality: savedItem.quality ?? itemData.quality };
        this.player.collectItem(itemWithQuality);
      }
    }

    // Set boss arena manager to correct next boss altitude
    this.bossArenaManager.setNextBossAltitude(data.nextBossAltitude);
    this.bossArenaManager.setBossCount(data.bossesDefeated);

    // Update highest Y tracker so death plane works correctly
    this.highestY = targetY;

    // Emit initial state to HUD
    EventBus.emit("health-change", { health: data.health, maxHealth: data.maxHealth });
    EventBus.emit("altitude-change", { altitude: data.altitude });

    // Scroll camera to player
    this.cameras.main.scrollY = this.player.y - this.cameras.main.height / 2;

    // Clear the save (will re-save at next checkpoint)
    RunSaveManager.clear();
    this.lastSaveAltitude = data.altitude;
  }

  private updateWalls() {
    const camY = this.cameras.main.scrollY;
    const camHeight = this.cameras.main.height;

    this.leftWall.y = camY + camHeight / 2;
    this.rightWall.y = camY + camHeight / 2;

    const leftBody = this.leftWall.body as Phaser.Physics.Arcade.StaticBody;
    const rightBody = this.rightWall.body as Phaser.Physics.Arcade.StaticBody;
    if (leftBody) leftBody.updateFromGameObject();
    if (rightBody) rightBody.updateFromGameObject();
  }

  private handlePortalOverlap(portal: PortalPlatform): void {
    if (portal.cooldownTimer > 0) return;
    if (!portal.getLinkedPortal()) return;

    portal.teleportPlayer(this.player);

    // Update highest Y tracker so death plane doesn't punish the teleport
    if (this.player.y < this.highestY) {
      this.highestY = this.player.y;
    }
  }

  private handleWindOverlap(windZone: WindCurrent): void {
    if (!windZone.active || !windZone.isActive) return;

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    if (!playerBody) return;

    // Use a fixed delta estimate since overlap callbacks don't receive delta;
    // the actual frame delta is used via the tracking set approach in update.
    const delta = this.game.loop.delta;
    windZone.applyForce(playerBody, delta);

    // Track this zone as active for exit detection
    this.activeWindZones.add(windZone);
  }

  private updateWindZoneTracking(): void {
    // For each tracked wind zone, check if player is still overlapping.
    // If not, clear the zone's player-in-zone state.
    // We rely on the overlap callback re-adding it each frame if still inside.
    const toRemove: WindCurrent[] = [];

    for (const wind of this.activeWindZones) {
      if (!wind.active) {
        toRemove.push(wind);
        continue;
      }

      // Check if the player is still overlapping this wind zone
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      const windBody = wind.body as Phaser.Physics.Arcade.StaticBody;
      if (!playerBody || !windBody) {
        toRemove.push(wind);
        continue;
      }

      const overlapping = Phaser.Geom.Intersects.RectangleToRectangle(
        playerBody.getBounds(new Phaser.Geom.Rectangle()),
        windBody.getBounds(new Phaser.Geom.Rectangle()),
      );

      if (!overlapping) {
        wind.clearPlayerInZone();
        toRemove.push(wind);
      }
    }

    for (const wind of toRemove) {
      this.activeWindZones.delete(wind);
    }
  }

  shutdown(): void {
    // Clean up all EventBus listeners to prevent leaks across scene restarts
    this._eventCleanups.forEach(fn => fn());
    this._eventCleanups = [];

    AudioManager.stopMusic();
    SoundCueManager.destroy();
    MouseManager.destroy();
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.touchControls?.destroy();
    this.touchControls = null;
    this.backgroundRenderer?.destroy?.();
    this.biomeRenderer?.destroy?.();
    this.atmosphereManager?.destroy?.();
    this.particleManager?.destroy();
    this.platformEffectsManager?.destroy?.();
    this.hazardManager?.destroy?.();
    this.risingDarkness?.destroy?.();

    // Clean up portal platforms
    if (this.portals) {
      this.portals.clear(true, true);
    }

    // Clean up wind currents
    if (this.windCurrents) {
      this.windCurrents.children.each((child: any) => {
        const wind = child as WindCurrent;
        wind.destroy();
        return true;
      });
      this.windCurrents.clear(true, true);
    }
    this.activeWindZones.clear();

    // Clean up Sacred Ground instances and listener
    this.sacredGrounds.forEach((sg) => sg.destroy());
    this.sacredGrounds = [];
    if (this.sacredGroundUnsubscribe) {
      this.sacredGroundUnsubscribe();
      this.sacredGroundUnsubscribe = null;
    }
  }

  private oneWayPlatformCheck(_player: any, platform: any): boolean {
    const playerBody = _player.body as Phaser.Physics.Arcade.Body;
    const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody;

    // Only collide if the player's feet were at or above the platform top last frame
    const playerPrevBottom = playerBody.prev.y + playerBody.halfHeight;
    const platformTop = platformBody.y;
    return playerPrevBottom <= platformTop + 2;
  }

  private handleStaticPlatformCollision(_player: any, platform: any) {
    // Detect platform type for surface effects
    if (_player.body?.touching?.down) {
      this.player.detectPlatformType(platform);
    }

    // Shop platform detection
    if (
      platform.getData("type") === PlatformType.SHOP &&
      _player.body?.touching?.down &&
      !platform.getData("shopVisited")
    ) {
      // Tutorial: trigger near-shop hint
      TutorialManager.triggerEvent('near-shop');

      platform.setData("shopVisited", true);
      this.scene.pause();
      EventBus.emit("shop-open", {
        offerings: [
          { id: "health_restore", name: "Health Restore", description: "Restore 1 HP", cost: 30, icon: "\u2665" },
          { id: "random_item", name: "Random Item", description: "Random silver item", cost: 100, icon: "\u25C6" },
          { id: "damage_buff", name: "Demon Fury", description: "+20% damage for 2 min", cost: 75, icon: "\u2694" },
        ],
      });
    }

    // Gambling shrine detection
    if (
      platform.getData("type") === PlatformType.GAMBLING &&
      _player.body?.touching?.down &&
      !platform.getData("shrineVisited")
    ) {
      platform.setData("shrineVisited", true);
      this.scene.pause();
      EventBus.emit("gambling-open", { essence: this.essenceTotal });
    }

    // Bounce platforms auto-bounce on contact
    if (
      platform.getData("type") === PlatformType.BOUNCE &&
      _player.body?.touching?.down &&
      platform.body?.touching?.up
    ) {
      this.player.setVelocityY(-800);
      this.styleManager.addStyle(5);
      this.particleManager.emitBounceEffect(platform.x, platform.y);
    }

    // Breakable platform logic
    if (
      platform.getData("type") === PlatformType.BREAKABLE &&
      platform.body?.touching?.up &&
      _player.body?.touching?.down
    ) {
      if (!platform.getData("isBreaking")) {
        platform.setData("isBreaking", true);

        this.particleManager.emitCrumbleParticles(
          platform.x,
          platform.y,
          platform.displayWidth,
        );
        AudioManager.playBreakableCrumble();

        this.tweens.add({
          targets: platform,
          alpha: 0.5,
          duration: 500,
          onComplete: () => {
            platform.disableBody(true, true);

            this.time.delayedCall(8000, () => {
              if (platform.active) {
                platform.enableBody(false, platform.x, platform.y, true, true);
                platform.setAlpha(1);
                platform.setData("isBreaking", false);
              }
            });
          },
        });
      }
    }

    // Portal platform — teleport player upward on landing
    if (
      platform.getData("type") === PlatformType.PORTAL &&
      _player.body?.touching?.down &&
      !platform.getData("portalUsed")
    ) {
      platform.setData("portalUsed", true);

      const currentAltitude = Math.max(
        0,
        (WORLD.BASE_PLATFORM_Y - this.player.y) / WORLD.ALTITUDE_SCALE,
      );
      // Teleport 50-100m upward (in altitude units)
      const teleportAltitude = Phaser.Math.Between(50, 100);
      const teleportPixels = teleportAltitude * WORLD.ALTITUDE_SCALE;

      const toAltitude = currentAltitude + teleportAltitude;

      // Teleport player upward
      this.player.setPosition(this.player.x, this.player.y - teleportPixels);
      this.player.setVelocity(0, 0);

      // Update highest Y tracker so death plane doesn't punish the teleport
      if (this.player.y < this.highestY) {
        this.highestY = this.player.y;
      }

      // Camera shake wobble effect (2 seconds)
      this.cameras.main.shake(2000, 0.001);

      // Purple flash effect (reduced or skipped if flash reduction enabled)
      const portalFlashReduction = GameSettings.get().flashReduction;
      const flash = this.add.rectangle(
        this.player.x,
        this.player.y,
        WORLD.WIDTH * 2,
        this.cameras.main.height * 2,
        0x9933ff,
        portalFlashReduction ? 0.1 : 0.4,
      );
      flash.setScrollFactor(0);
      flash.setDepth(200);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: portalFlashReduction ? 200 : 500,
        onComplete: () => flash.destroy(),
      });

      // Dim portal platform to show it's used
      platform.setAlpha(0.4);

      EventBus.emit("portal-teleport", {
        fromAltitude: currentAltitude,
        toAltitude,
      });
    }
  }
}

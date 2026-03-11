import Phaser from "phaser";
import { Player } from "../entities/Player";
import { LevelGenerator } from "../systems/LevelGenerator";
import { SpawnManager } from "../systems/SpawnManager";
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
  private bossWarningEmitted: boolean = false;
  private leftWall!: Phaser.GameObjects.Rectangle;
  private rightWall!: Phaser.GameObjects.Rectangle;
  private highestY: number = WORLD.PLAYER_SPAWN.y;
  private ridingPlatform: Phaser.GameObjects.GameObject | null = null;

  // Run tracking
  private killCount: number = 0;
  private bossesDefeated: number = 0;
  private essenceTotal: number = 0;
  private runStartTime: number = 0;

  // Sacred Ground instances (Priest class mechanic)
  private sacredGrounds: SacredGround[] = [];
  private sacredGroundListener: ((e: Event) => void) | null = null;

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

    // Hazard manager (needs player and staticPlatforms)
    this.hazardManager = new HazardManager(this, this.player, this.staticPlatforms);

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
    this.combatManager = new CombatManager(this, this.player, this.enemies);
    this.combatManager.setDamageNumberManager(new DamageNumberManager(this));

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
    EventBus.on("boss-defeated", (data) => {
      // Spawn a silver item at the player's location
      this.spawnManager.spawnRandomItem(this.player.x, this.player.y - 50);
      // Every 3rd boss also drops a gold item
      if (data.bossNumber % 3 === 0) {
        this.spawnManager.spawnRandomItem(this.player.x + 60, this.player.y - 50);
      }

      // Track boss defeat and award essence
      this.bossesDefeated++;
      const bossEssence = 50 * data.bossNumber;
      this.essenceTotal += bossEssence;
      EventBus.emit("essence-change", {
        essence: this.essenceTotal,
        gained: bossEssence,
      });
    });

    // Track enemy kills and award essence
    EventBus.on("enemy-killed", (data) => {
      this.killCount++;
      const def = ENEMY_REGISTRY[data.enemyType];
      const tier = def?.tier ?? "basic";
      const essenceReward = ESSENCE_REWARDS[tier] ?? 5;
      this.essenceTotal += essenceReward;
      EventBus.emit("essence-change", {
        essence: this.essenceTotal,
        gained: essenceReward,
      });
    });

    // Handle shop purchases
    EventBus.on("shop-purchase", (data) => {
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
    });

    // Listen for Priest Sacred Ground creation
    this.sacredGroundListener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const sg = new SacredGround(
        this,
        this.player,
        this.enemies,
        detail.x,
        detail.y,
      );
      this.sacredGrounds.push(sg);
    };
    window.addEventListener(
      "priest-sacred-ground",
      this.sacredGroundListener,
    );

    // Handle player death — emit death screen event with run stats
    this.runStartTime = Date.now();
    EventBus.on("player-died", () => {
      const altitude = Math.max(
        0,
        (WORLD.BASE_PLATFORM_Y - this.player.y) / WORLD.ALTITUDE_SCALE,
      );
      EventBus.emit("show-death-screen", {
        altitude: Math.floor(altitude),
        kills: this.killCount,
        bossesDefeated: this.bossesDefeated,
        timeMs: Date.now() - this.runStartTime,
        essenceEarned: this.essenceTotal,
      });
    });
  }

  update(time: number, delta: number) {
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
    const slopeLaunchSpeed = this.player.clearSlopeState();
    if (slopeLaunchSpeed > 0) {
      this.styleManager.onSlopeLaunch(slopeLaunchSpeed);
    }
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
    EventBus.emit("altitude-change", { altitude });

    // Boss arena system
    this.bossArenaManager.update(altitude, this.player.y);

    // Hazard system (stalactites, wind, portal effects)
    this.hazardManager.update(time, delta, altitude, this.cameras.main.scrollY);

    // Style tracking
    const vx = this.player.body!.velocity.x;
    const vy = this.player.body!.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    this.styleManager.update(delta, speed);

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

    // Update Sacred Ground instances (Priest mechanic)
    this.sacredGrounds = this.sacredGrounds.filter((sg) => !sg.update(delta));

    // Death plane (relative to highest reached point)
    if (this.player.y > this.highestY + WORLD.DEATH_PLANE_OFFSET) {
      this.player.setPosition(this.player.x, this.highestY);
      this.player.setVelocity(0, 0);
      this.player.takeDamage(1);
    }

    // Update wall positions to follow camera
    this.updateWalls();
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

  shutdown(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.backgroundRenderer?.destroy?.();
    this.biomeRenderer?.destroy?.();
    this.atmosphereManager?.destroy?.();
    this.particleManager?.destroy();
    this.platformEffectsManager?.destroy?.();
    this.hazardManager?.destroy?.();

    // Clean up Sacred Ground instances and listener
    this.sacredGrounds.forEach((sg) => sg.destroy());
    this.sacredGrounds = [];
    if (this.sacredGroundListener) {
      window.removeEventListener(
        "priest-sacred-ground",
        this.sacredGroundListener,
      );
      this.sacredGroundListener = null;
    }
  }

  private oneWayPlatformCheck(_player: any, platform: any): boolean {
    const playerBody = _player.body as Phaser.Physics.Arcade.Body;
    const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody;

    // If player is dropping through, disable collision temporarily
    // Exception: don't allow drop-through during boss fights or on the base platform
    if (
      this.player.isDroppingSelf &&
      !this.bossArenaManager.getIsBossFight() &&
      platformBody.y < WORLD.BASE_PLATFORM_Y
    ) {
      return false;
    }

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

      // Purple flash effect
      const flash = this.add.rectangle(
        this.player.x,
        this.player.y,
        WORLD.WIDTH * 2,
        this.cameras.main.height * 2,
        0x9933ff,
        0.4,
      );
      flash.setScrollFactor(0);
      flash.setDepth(200);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 500,
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

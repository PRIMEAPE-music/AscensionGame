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
import { EventBus } from "../systems/EventBus";
import { ClassType } from "../config/ClassConfig";
import { WORLD } from "../config/GameConfig";
import { PlatformType } from "../config/PlatformTypes";
import { SPRITE_CONFIG, ANIMATIONS } from "../config/AnimationConfig";

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
  private leftWall!: Phaser.GameObjects.Rectangle;
  private rightWall!: Phaser.GameObjects.Rectangle;
  private highestY: number = WORLD.PLAYER_SPAWN.y;
  private ridingPlatform: Phaser.GameObjects.GameObject | null = null;

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
    this.levelGenerator.init();

    // Player
    const selectedClass: ClassType =
      (window as any).__selectedClass || ClassType.MONK;
    this.player = new Player(
      this,
      WORLD.PLAYER_SPAWN.x,
      WORLD.PLAYER_SPAWN.y,
      selectedClass,
    );
    this.highestY = WORLD.PLAYER_SPAWN.y;

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

    // Colliders
    this.physics.add.collider(
      this.player,
      this.staticPlatforms,
      this.handleStaticPlatformCollision,
      undefined,
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
      undefined,
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

    // Systems
    this.spawnManager.update(altitude, delta);
    this.combatManager.update();

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
  }

  private handleStaticPlatformCollision(_player: any, platform: any) {
    // Detect platform type for surface effects
    if (_player.body?.touching?.down) {
      this.player.detectPlatformType(platform);
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
  }
}

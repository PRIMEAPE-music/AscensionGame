import Phaser from "phaser";
import { Player } from "../entities/Player";
import { TrainingDummy } from "../entities/TrainingDummy";
import { CombatManager } from "../systems/CombatManager";
import { DamageNumberManager } from "../systems/DamageNumberManager";
import { EventBus } from "../systems/EventBus";
import { ClassType } from "../config/ClassConfig";
import { WORLD } from "../config/GameConfig";
import { SPRITE_CONFIG, ANIMATIONS } from "../config/AnimationConfig";
import { MagmaTyrant } from "../entities/bosses/MagmaTyrant";
import { VoidWingArchon } from "../entities/bosses/VoidWingArchon";
import { ChronoDemon } from "../entities/bosses/ChronoDemon";
import { LegionMaster } from "../entities/bosses/LegionMaster";
import { PlatformDevourer } from "../entities/bosses/PlatformDevourer";
import type { Boss } from "../entities/Boss";

/** Map of boss IDs to display names and factory functions. */
export const BOSS_REGISTRY: Record<
  string,
  { name: string; factory: (scene: Phaser.Scene, x: number, y: number, players: Player[], bossNumber: number) => Boss }
> = {
  MagmaTyrant: {
    name: "Magma Tyrant",
    factory: (scene, x, y, players, bossNumber) => new MagmaTyrant(scene, x, y, players, bossNumber),
  },
  VoidWingArchon: {
    name: "VoidWing Archon",
    factory: (scene, x, y, players, bossNumber) => new VoidWingArchon(scene, x, y, players, bossNumber),
  },
  ChronoDemon: {
    name: "Chrono Demon",
    factory: (scene, x, y, players, bossNumber) => new ChronoDemon(scene, x, y, players, bossNumber),
  },
  LegionMaster: {
    name: "Legion Master",
    factory: (scene, x, y, players, bossNumber) => new LegionMaster(scene, x, y, players, bossNumber),
  },
  PlatformDevourer: {
    name: "Platform Devourer",
    factory: (scene, x, y, players, bossNumber) => new PlatformDevourer(scene, x, y, players, bossNumber),
  },
};

export class TrainingScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private staticPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private combatManager!: CombatManager;
  private damageNumbers!: DamageNumberManager;
  private dummy: TrainingDummy | null = null;
  private currentBoss: Boss | null = null;
  private infiniteHP: boolean = false;
  private escKey!: Phaser.Input.Keyboard.Key;
  private arenaBackground!: Phaser.GameObjects.Rectangle;

  // Store event unsubscribe callbacks
  private eventCleanups: (() => void)[] = [];

  constructor() {
    super({ key: "TrainingScene" });
  }

  preload() {
    // Generate ground texture if not already cached
    if (!this.textures.exists("ground")) {
      const ground = this.make.graphics({ x: 0, y: 0 }, false);
      ground.fillStyle(0x00ff00);
      ground.fillRect(0, 0, 400, 32);
      ground.generateTexture("ground", 400, 32);
    }

    // Generate sky texture if not already cached
    if (!this.textures.exists("sky")) {
      const sky = this.make.graphics({ x: 0, y: 0 }, false);
      sky.fillStyle(0x000033);
      sky.fillRect(0, 0, 800, 600);
      sky.generateTexture("sky", 800, 600);
    }

    // Load monk spritesheets if not already loaded
    for (const anim of ANIMATIONS) {
      if (!this.textures.exists(anim.textureKey)) {
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
  }

  create() {
    // Dark arena background
    this.arenaBackground = this.add.rectangle(
      WORLD.WIDTH / 2,
      WORLD.HEIGHT / 2,
      WORLD.WIDTH,
      WORLD.HEIGHT,
      0x0a0a14,
    );
    this.arenaBackground.setScrollFactor(0);
    this.arenaBackground.setDepth(-10);

    // Add subtle grid pattern for arena feel
    const gridGraphics = this.add.graphics();
    gridGraphics.setDepth(-9);
    gridGraphics.lineStyle(1, 0x1a1a2a, 0.3);
    for (let x = 0; x < WORLD.WIDTH; x += 100) {
      gridGraphics.lineBetween(x, 0, x, WORLD.HEIGHT);
    }
    for (let y = 0; y < WORLD.HEIGHT; y += 100) {
      gridGraphics.lineBetween(0, y, WORLD.WIDTH, y);
    }

    // "TRAINING ROOM" title
    const titleText = this.add.text(WORLD.WIDTH / 2, 40, "TRAINING ROOM", {
      fontSize: "28px",
      fontFamily: "monospace",
      color: "#666688",
      stroke: "#000000",
      strokeThickness: 2,
      fontStyle: "bold",
    });
    titleText.setOrigin(0.5);
    titleText.setScrollFactor(0);
    titleText.setDepth(100);

    // Physics groups
    this.staticPlatforms = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group({ runChildUpdate: true });

    // ── Build Arena ──
    const PLAT_COLOR = 0x222233;
    const floorY = WORLD.HEIGHT - 60;

    // Full-width floor
    const floor = this.staticPlatforms.create(WORLD.WIDTH / 2, floorY, "ground");
    floor.setScale(WORLD.WIDTH / 400, 1).refreshBody();
    floor.setTint(PLAT_COLOR);
    floor.setData("type", "STANDARD");

    // Left wall
    const leftWall = this.add.rectangle(0, WORLD.HEIGHT / 2, 50, WORLD.HEIGHT, 0x222233, 1);
    this.physics.add.existing(leftWall, true);

    // Right wall
    const rightWall = this.add.rectangle(WORLD.WIDTH, WORLD.HEIGHT / 2, 50, WORLD.HEIGHT, 0x222233, 1);
    this.physics.add.existing(rightWall, true);

    // Left platform (higher)
    const leftPlat = this.staticPlatforms.create(WORLD.WIDTH * 0.2, floorY - 200, "ground");
    leftPlat.setScale(1.8, 1).refreshBody();
    leftPlat.setTint(PLAT_COLOR);
    leftPlat.setData("type", "STANDARD");

    // Right platform (higher)
    const rightPlat = this.staticPlatforms.create(WORLD.WIDTH * 0.8, floorY - 200, "ground");
    rightPlat.setScale(1.8, 1).refreshBody();
    rightPlat.setTint(PLAT_COLOR);
    rightPlat.setData("type", "STANDARD");

    // Center elevated platform
    const centerPlat = this.staticPlatforms.create(WORLD.WIDTH / 2, floorY - 380, "ground");
    centerPlat.setScale(2.0, 1).refreshBody();
    centerPlat.setTint(PLAT_COLOR);
    centerPlat.setData("type", "STANDARD");

    // ── Create Player ──
    const selectedClass: ClassType =
      (window as any).__trainingClass || ClassType.MONK;
    this.player = new Player(this, WORLD.WIDTH / 2, floorY - 80, selectedClass);
    this.player.setCollideWorldBounds(true);

    // ── Colliders ──
    this.physics.add.collider(this.player, this.staticPlatforms);
    this.physics.add.collider(this.player, leftWall);
    this.physics.add.collider(this.player, rightWall);
    this.physics.add.collider(this.enemies, this.staticPlatforms);

    // ── Create Training Dummy ──
    this.dummy = new TrainingDummy(
      this,
      WORLD.WIDTH / 2 + 200,
      floorY - 80,
      this.player,
    );
    this.enemies.add(this.dummy);

    // ── Combat Manager ──
    this.combatManager = new CombatManager(this, this.player, this.enemies);
    this.damageNumbers = new DamageNumberManager(this);
    this.combatManager.setDamageNumberManager(this.damageNumbers);

    // Player-enemy overlap for contact damage (uses CombatManager like MainScene)
    this.physics.add.overlap(
      this.player,
      this.enemies,
      (p, e) => this.combatManager.handleContactDamage(p, e),
      undefined,
      this,
    );

    // ── Camera ──
    this.cameras.main.setBackgroundColor(0x0a0a14);
    // Fixed camera — no scrolling needed for the arena
    this.cameras.main.setScroll(0, 0);

    // ── Input: ESC to exit ──
    if (this.input.keyboard) {
      this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    // ── Event Bus Listeners ──
    this.eventCleanups.push(
      EventBus.on("training-spawn-boss", (data) => {
        this.spawnBoss(data.bossId);
      }),
    );

    this.eventCleanups.push(
      EventBus.on("training-toggle-infinite-hp", (data) => {
        this.infiniteHP = data.enabled;
      }),
    );

    this.eventCleanups.push(
      EventBus.on("training-reset", () => {
        this.resetArena();
      }),
    );

    this.eventCleanups.push(
      EventBus.on("training-exit", () => {
        this.exitTraining();
      }),
    );

    // Emit initial health
    EventBus.emit("health-change", {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
    });
  }

  /** Spawn a boss by ID. Kills existing boss first. */
  private spawnBoss(bossId: string): void {
    // Clean up existing boss
    if (this.currentBoss && this.currentBoss.active) {
      this.currentBoss.destroy();
      this.currentBoss = null;
    }

    const entry = BOSS_REGISTRY[bossId];
    if (!entry) return;

    const floorY = WORLD.HEIGHT - 60;
    const spawnX = WORLD.WIDTH * 0.7;
    const spawnY = floorY - 100;

    const boss = entry.factory(this, spawnX, spawnY, [this.player], 1);

    // Special setup for certain bosses
    if (bossId === "LegionMaster") {
      (boss as LegionMaster).setEnemiesGroup(this.enemies);
    }
    if (bossId === "PlatformDevourer") {
      // Create a minimal arena object for PlatformDevourer
      (boss as PlatformDevourer).setArena({
        centerX: WORLD.WIDTH / 2,
        centerY: WORLD.HEIGHT / 2,
        width: WORLD.WIDTH,
        height: WORLD.HEIGHT,
        platforms: this.staticPlatforms,
        topBarrier: this.add.rectangle(0, 0, 1, 1, 0, 0),
        bottomBarrier: this.add.rectangle(0, 0, 1, 1, 0, 0),
        bossNumber: 1,
        isLocked: true,
      });
    }

    this.enemies.add(boss);
    this.currentBoss = boss;

    // Add collider for boss with platforms
    this.physics.add.collider(boss, this.staticPlatforms);
  }

  /** Reset the arena: kill boss, reset dummy. */
  private resetArena(): void {
    // Kill current boss
    if (this.currentBoss && this.currentBoss.active) {
      this.currentBoss.destroy();
      this.currentBoss = null;
    }

    // Clean up any stray enemies (minions from LegionMaster, etc.)
    this.enemies.getChildren().forEach((child: any) => {
      if (child !== this.dummy && child.active) {
        child.destroy();
      }
    });

    // Reset dummy
    if (this.dummy && this.dummy.active) {
      this.dummy.health = 9999;
      this.dummy.maxHealth = 9999;
    }

    // Reset player health
    if (this.player && this.player.active) {
      this.player.health = this.player.maxHealth;
      EventBus.emit("health-change", {
        health: this.player.health,
        maxHealth: this.player.maxHealth,
      });
    }
  }

  /** Exit the training room. */
  private exitTraining(): void {
    // Clean up event listeners
    for (const cleanup of this.eventCleanups) {
      cleanup();
    }
    this.eventCleanups.length = 0;

    // Emit exit event for React to handle
    window.dispatchEvent(new CustomEvent("training-scene-exit"));

    // Stop this scene
    this.scene.stop();
  }

  update(time: number, delta: number): void {
    if (!this.player || !this.player.active) return;

    // Update player
    this.player.update(time, delta);

    // Update combat manager (handles attack hitbox overlaps)
    this.combatManager.update(delta);

    // Infinite HP: instantly refill when damaged
    if (this.infiniteHP && this.player.health < this.player.maxHealth) {
      this.player.health = this.player.maxHealth;
      EventBus.emit("health-change", {
        health: this.player.health,
        maxHealth: this.player.maxHealth,
      });
    }

    // ESC key to exit
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.exitTraining();
    }

    // Check if boss died
    if (this.currentBoss && !this.currentBoss.active) {
      this.currentBoss = null;
    }
  }
}

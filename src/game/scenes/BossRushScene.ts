import Phaser from "phaser";
import { Player } from "../entities/Player";
import { CombatManager } from "../systems/CombatManager";
import { DamageNumberManager } from "../systems/DamageNumberManager";
import { ParticleManager } from "../systems/ParticleManager";
import { EventBus } from "../systems/EventBus";
import { ClassType } from "../config/ClassConfig";
import { WORLD } from "../config/GameConfig";
import { SPRITE_CONFIG, ANIMATIONS } from "../config/AnimationConfig";
import { MagmaTyrant } from "../entities/bosses/MagmaTyrant";
import { VoidWingArchon } from "../entities/bosses/VoidWingArchon";
import { ChronoDemon } from "../entities/bosses/ChronoDemon";
import { LegionMaster } from "../entities/bosses/LegionMaster";
import { PlatformDevourer } from "../entities/bosses/PlatformDevourer";
import { PersistentStats } from "../systems/PersistentStats";
import { MouseManager } from "../systems/MouseManager";
import { ComboManager } from "../systems/ComboManager";
import { ITEMS } from "../config/ItemDatabase";
import type { ItemData } from "../config/ItemConfig";
import type { Boss } from "../entities/Boss";
import type { BossArena } from "../systems/BossArenaManager";

type BossRushState = "PREP" | "FIGHTING" | "ITEM_SELECT" | "VICTORY" | "DEFEAT";

const BOSS_ORDER = [
  "MagmaTyrant",
  "VoidWingArchon",
  "ChronoDemon",
  "LegionMaster",
  "PlatformDevourer",
] as const;

const TOTAL_ROUNDS = 5;

/**
 * Boss Rush Mode: fight all 5 boss archetypes in sequence.
 * Flat arena, no platforming. Items between rounds.
 * Timer tracked for speedrun leaderboard.
 */
export class BossRushScene extends Phaser.Scene {
  private player!: Player;
  private staticPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private items!: Phaser.Physics.Arcade.Group;
  private combatManager!: CombatManager;
  private particleManager!: ParticleManager;

  private leftWall!: Phaser.GameObjects.Rectangle;
  private rightWall!: Phaser.GameObjects.Rectangle;

  private currentRound: number = 0;
  private state: BossRushState = "PREP";
  private currentBoss: Boss | null = null;
  private startTime: number = 0;
  private bossesDefeated: number = 0;

  // Arena geometry
  private arenaFloorY: number = 0;
  private arenaCenterY: number = 0;

  // Event cleanup
  private _eventCleanups: (() => void)[] = [];

  // Kill tracking for essence
  private killCount: number = 0;
  private essenceTotal: number = 0;

  constructor() {
    super({ key: "BossRushScene" });
  }

  preload() {
    // Generate ground texture if not already cached
    if (!this.textures.exists("ground")) {
      const ground = this.make.graphics({ x: 0, y: 0 }, false);
      ground.fillStyle(0x00ff00);
      ground.fillRect(0, 0, 400, 32);
      ground.generateTexture("ground", 400, 32);
    }

    // Load sprite sheets
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
    // Reset combo system
    ComboManager.resetRun();

    // Dark arena background
    this.cameras.main.setBackgroundColor(0x0a0a1a);

    // Physics groups
    this.staticPlatforms = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.items = this.physics.add.group();

    // Build the flat arena
    this.buildArena();

    // Create player at center of arena floor
    const selectedClass: ClassType =
      (window as any).__selectedClass || ClassType.MONK;
    const spawnX = WORLD.WIDTH / 2;
    const spawnY = this.arenaFloorY - 60;

    this.player = new Player(this, spawnX, spawnY, selectedClass, 0);

    // Override player health to 5 HP for Boss Rush
    this.player.maxHealth = 5;
    this.player.health = 5;

    // Apply pre-equipped gold items
    const equippedGoldItems: string[] =
      (window as any).__equippedGoldItems || [];
    for (const itemId of equippedGoldItems) {
      const itemData = ITEMS[itemId];
      if (itemData && itemData.type === "GOLD") {
        this.player.collectItem(itemData);
      }
    }

    // Particle effects
    this.particleManager = new ParticleManager(this);

    // Combat manager
    this.combatManager = new CombatManager(this, [this.player], this.enemies);
    this.combatManager.setDamageNumberManager(new DamageNumberManager(this));
    this.combatManager.setParticleManager(this.particleManager);

    // Register colliders
    this.physics.add.collider(
      this.player,
      this.staticPlatforms,
      this.handlePlatformCollision,
      this.oneWayPlatformCheck,
      this,
    );
    this.physics.add.collider(this.enemies, this.staticPlatforms);
    this.physics.add.collider(this.player, this.leftWall);
    this.physics.add.collider(this.player, this.rightWall);

    // Combat overlaps
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

    // Register sprite animations (if not already registered)
    for (const anim of ANIMATIONS) {
      if (!this.anims.exists(anim.key)) {
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
    }

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.05, 0.05);
    this.cameras.main.setDeadzone(100, 100);
    this.cameras.main.setBounds(
      0,
      -Number.MAX_SAFE_INTEGER,
      WORLD.WIDTH,
      Number.MAX_SAFE_INTEGER + WORLD.HEIGHT,
    );

    // Mouse manager
    MouseManager.init(this);

    // Prevent Alt from triggering browser menu
    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.ALT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);

    // Auto-focus canvas
    this.game.canvas.focus();

    // Emit initial health
    EventBus.emit("health-change", {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      playerIndex: 0,
    });

    // Listen for boss defeats
    this._eventCleanups.push(
      EventBus.on("boss-defeated", (data) => {
        this.bossesDefeated++;

        // Award essence for boss kill
        let bossEssence = 50 * (this.currentRound);
        if (this.player.abilities.has("essence_boost")) {
          bossEssence = Math.round(bossEssence * 1.25);
        }
        bossEssence = Math.round(bossEssence * ComboManager.getMultiplier());
        this.essenceTotal += bossEssence;
        EventBus.emit("essence-change", {
          essence: this.essenceTotal,
          gained: bossEssence,
        });

        // Handle round completion
        this.onBossDefeated();
      }),
    );

    // Listen for enemy kills (for combo tracking)
    this._eventCleanups.push(
      EventBus.on("enemy-killed", () => {
        this.killCount++;
      }),
    );

    // Listen for player death
    this._eventCleanups.push(
      EventBus.on("player-died", () => {
        this.onPlayerDied();
      }),
    );

    // Listen for item selection from UI
    this._eventCleanups.push(
      EventBus.on("boss-rush-item-chosen", (data) => {
        this.onItemChosen(data.item);
      }),
    );

    // Start timer and begin first round after a brief delay
    this.startTime = Date.now();
    this.state = "PREP";

    EventBus.emit("boss-rush-round", {
      round: 0,
      totalRounds: TOTAL_ROUNDS,
      bossName: BOSS_ORDER[0],
      state: "PREP",
    });

    // Short countdown, then start round 1
    this.time.delayedCall(1500, () => {
      this.startRound(1);
    });
  }

  update(_time: number, delta: number) {
    if (this.state === "DEFEAT" || this.state === "VICTORY") return;

    // Update player
    if (this.player && this.player.active) {
      this.player.update(delta);
    }

    // Update combat
    if (this.combatManager) {
      this.combatManager.update(delta);
    }

    // Check if boss has been defeated (active check)
    if (
      this.state === "FIGHTING" &&
      this.currentBoss &&
      !this.currentBoss.active
    ) {
      // Boss.die() already emits boss-defeated, which triggers onBossDefeated
      this.currentBoss = null;
    }

    // Emit timer update to UI
    if (this.state === "FIGHTING" || this.state === "PREP") {
      const elapsed = Date.now() - this.startTime;
      EventBus.emit("boss-rush-timer", { timeMs: elapsed });
    }

    // Check player death (fell off or 0 HP)
    if (this.player && this.player.active && this.player.health <= 0) {
      this.onPlayerDied();
    }
  }

  // ── Arena Construction ──────────────────────────────────────────────

  private buildArena() {
    const ARENA_PLAT_COLOR = 0x1a1a2e;
    const floorY = WORLD.HEIGHT - 100;
    this.arenaFloorY = floorY;
    this.arenaCenterY = WORLD.HEIGHT / 2;

    // Wide floor platform spanning the full width
    const floor = this.staticPlatforms.create(
      WORLD.WIDTH / 2,
      floorY,
      "ground",
    );
    floor.setScale(WORLD.WIDTH / 400, 1).refreshBody();
    floor.setTint(ARENA_PLAT_COLOR);
    floor.setData("type", "STANDARD");
    floor.setData("arenaPlat", true);

    // Left mid-height platform
    const leftPlatY = floorY - 250;
    const leftPlat = this.staticPlatforms.create(
      WORLD.WIDTH * 0.18,
      leftPlatY,
      "ground",
    );
    leftPlat.setScale(2.0, 1).refreshBody();
    leftPlat.setTint(ARENA_PLAT_COLOR);
    leftPlat.setData("type", "STANDARD");
    leftPlat.setData("arenaPlat", true);

    // Right mid-height platform
    const rightPlatY = floorY - 250;
    const rightPlat = this.staticPlatforms.create(
      WORLD.WIDTH * 0.82,
      rightPlatY,
      "ground",
    );
    rightPlat.setScale(2.0, 1).refreshBody();
    rightPlat.setTint(ARENA_PLAT_COLOR);
    rightPlat.setData("type", "STANDARD");
    rightPlat.setData("arenaPlat", true);

    // Boundary walls (left/right)
    this.leftWall = this.add.rectangle(
      -25,
      WORLD.HEIGHT / 2,
      WORLD.WALL_WIDTH,
      WORLD.HEIGHT * 2,
      0x333333,
    );
    this.physics.add.existing(this.leftWall, true);

    this.rightWall = this.add.rectangle(
      WORLD.WIDTH + 25,
      WORLD.HEIGHT / 2,
      WORLD.WALL_WIDTH,
      WORLD.HEIGHT * 2,
      0x333333,
    );
    this.physics.add.existing(this.rightWall, true);

    // Decorative arena border lines
    const borderGfx = this.add.graphics();
    borderGfx.lineStyle(2, 0x333366, 0.4);
    borderGfx.strokeRect(40, 40, WORLD.WIDTH - 80, WORLD.HEIGHT - 80);
    borderGfx.setScrollFactor(0);
    borderGfx.setDepth(0);
  }

  // ── Boss Spawning ───────────────────────────────────────────────────

  private startRound(round: number) {
    this.currentRound = round;
    this.state = "FIGHTING";

    const bossName = BOSS_ORDER[round - 1];

    EventBus.emit("boss-rush-round", {
      round,
      totalRounds: TOTAL_ROUNDS,
      bossName,
      state: "FIGHTING",
    });

    // Spawn boss after a brief telegraph
    this.time.delayedCall(500, () => {
      this.spawnBoss(round);
    });
  }

  private spawnBoss(round: number) {
    const bossIndex = round; // 1-5
    const spawnX = WORLD.WIDTH / 2;
    const spawnY = this.arenaFloorY - 100;
    const players = [this.player];

    // Build a fake arena object for PlatformDevourer
    const arena: BossArena = {
      centerX: WORLD.WIDTH / 2,
      centerY: this.arenaCenterY,
      width: WORLD.WIDTH,
      height: WORLD.HEIGHT,
      platforms: this.staticPlatforms,
      topBarrier: this.add.rectangle(0, 0, 1, 1, 0, 0) as any,
      bottomBarrier: this.add.rectangle(0, 0, 1, 1, 0, 0) as any,
      bossNumber: round,
      isLocked: true,
    };

    let boss: Boss;

    switch (bossIndex) {
      case 1:
        boss = new MagmaTyrant(this, spawnX, spawnY, players, round);
        break;
      case 2:
        boss = new VoidWingArchon(this, spawnX, spawnY, players, round);
        break;
      case 3:
        boss = new ChronoDemon(this, spawnX, spawnY, players, round);
        break;
      case 4: {
        const legion = new LegionMaster(
          this,
          spawnX,
          spawnY,
          players,
          round,
        );
        legion.setEnemiesGroup(this.enemies);
        boss = legion;
        break;
      }
      case 5: {
        const devourer = new PlatformDevourer(
          this,
          spawnX,
          spawnY,
          players,
          round,
        );
        devourer.setArena(arena);
        boss = devourer;
        break;
      }
      default:
        boss = new MagmaTyrant(this, spawnX, spawnY, players, round);
        break;
    }

    // Apply HP scaling: +20% per round beyond the first
    const hpMultiplier = 1 + 0.2 * (round - 1);
    boss.health = Math.ceil(boss.health * hpMultiplier);
    boss.maxHealth = Math.ceil(boss.maxHealth * hpMultiplier);

    this.enemies.add(boss);
    this.currentBoss = boss;
  }

  // ── Round Completion ────────────────────────────────────────────────

  private onBossDefeated() {
    if (this.state !== "FIGHTING") return;

    if (this.currentRound >= TOTAL_ROUNDS) {
      // All bosses defeated - victory!
      this.state = "VICTORY";
      const elapsed = Date.now() - this.startTime;

      // Calculate bonus essence based on time
      // Under 5 minutes: 500 bonus, 5-10 min: 300, 10-15 min: 150, 15+ min: 50
      let bonusEssence = 50;
      if (elapsed < 5 * 60 * 1000) bonusEssence = 500;
      else if (elapsed < 10 * 60 * 1000) bonusEssence = 300;
      else if (elapsed < 15 * 60 * 1000) bonusEssence = 150;

      this.essenceTotal += bonusEssence;

      // Record run stats to persistent stats
      const selectedClass: string = (window as any).__selectedClass || "MONK";
      PersistentStats.recordRunEnd({
        classType: selectedClass,
        altitude: 0,
        kills: this.killCount,
        bossesDefeated: this.bossesDefeated,
        timeMs: elapsed,
        essence: this.essenceTotal,
      });
      PersistentStats.save();

      EventBus.emit("boss-rush-victory", {
        timeMs: elapsed,
        essenceEarned: this.essenceTotal,
        bonusEssence,
      });
      return;
    }

    // More bosses to go - offer item selection
    this.state = "ITEM_SELECT";
    const offerings = this.generateItemOfferings();

    EventBus.emit("boss-rush-item-select", {
      round: this.currentRound,
      offerings,
    });

    // Pause the scene while player picks
    this.scene.pause();
  }

  private onItemChosen(item: ItemData) {
    // Give item to player
    this.player.collectItem(item);

    // Emit inventory update
    EventBus.emit("inventory-change", {
      inventory: (this.player as any).inventory || [],
    });

    // Resume and start next round
    this.scene.resume();

    this.time.delayedCall(500, () => {
      // Heal player 1 HP between rounds
      if (this.player.health < this.player.maxHealth) {
        this.player.health += 1;
        EventBus.emit("health-change", {
          health: this.player.health,
          maxHealth: this.player.maxHealth,
        });
      }

      this.startRound(this.currentRound + 1);
    });
  }

  private onPlayerDied() {
    if (this.state === "DEFEAT") return;
    this.state = "DEFEAT";

    const elapsed = Date.now() - this.startTime;

    EventBus.emit("boss-rush-defeat", {
      round: this.currentRound,
      timeMs: elapsed,
      bossName: BOSS_ORDER[this.currentRound - 1] || "Unknown",
    });
  }

  // ── Item Generation ─────────────────────────────────────────────────

  private generateItemOfferings(): ItemData[] {
    // Curated pool: mostly GOLD and higher-rarity SILVER items
    const allItems = Object.values(ITEMS);

    // Filter to GOLD items and RARE/UNCOMMON silver items (exclude co-op only items unless co-op active)
    const goldItems = allItems.filter((i) => i.type === "GOLD" && !i.coopOnly);
    const highSilverItems = allItems.filter(
      (i) =>
        i.type === "SILVER" &&
        (i.rarity === "RARE" || i.rarity === "UNCOMMON"),
    );

    // 60% chance each offering is gold, 40% high-tier silver
    const offerings: ItemData[] = [];
    const pool = [...goldItems, ...goldItems, ...highSilverItems]; // Weight gold 2x

    // Pick 3 unique items
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const seen = new Set<string>();

    for (const item of shuffled) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      offerings.push(item);
      if (offerings.length >= 3) break;
    }

    // Fallback if we somehow don't have 3
    while (offerings.length < 3) {
      const fallback = allItems[Math.floor(Math.random() * allItems.length)];
      if (!seen.has(fallback.id)) {
        seen.add(fallback.id);
        offerings.push(fallback);
      }
    }

    return offerings;
  }

  // ── Platform Collision Helpers ──────────────────────────────────────

  private oneWayPlatformCheck(_player: any, platform: any): boolean {
    const playerBody = _player.body as Phaser.Physics.Arcade.Body;
    const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody;
    const playerPrevBottom = playerBody.prev.y + playerBody.halfHeight;
    const platformTop = platformBody.y;
    return playerPrevBottom <= platformTop + 2;
  }

  private handlePlatformCollision(_player: any, platform: any) {
    const collidingPlayer = _player as Player;
    if (_player.body?.touching?.down) {
      collidingPlayer.detectPlatformType(platform);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  shutdown() {
    for (const cleanup of this._eventCleanups) {
      cleanup();
    }
    this._eventCleanups.length = 0;
  }

  destroy() {
    this.shutdown();
  }
}

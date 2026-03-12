import Phaser from "phaser";
import { WORLD } from "../config/GameConfig";
import { EventBus } from "./EventBus";
import type { Boss } from "../entities/Boss";
import type { Player } from "../entities/Player";
import { MagmaTyrant } from "../entities/bosses/MagmaTyrant";
import { VoidWingArchon } from "../entities/bosses/VoidWingArchon";
import { ChronoDemon } from "../entities/bosses/ChronoDemon";
import { LegionMaster } from "../entities/bosses/LegionMaster";
import { PlatformDevourer } from "../entities/bosses/PlatformDevourer";

export interface BossArena {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  platforms: Phaser.Physics.Arcade.StaticGroup;
  topBarrier: Phaser.GameObjects.Rectangle;
  bottomBarrier: Phaser.GameObjects.Rectangle;
  bossNumber: number;
  isLocked: boolean;
}

export class BossArenaManager {
  private scene: Phaser.Scene;
  private staticPlatforms: Phaser.Physics.Arcade.StaticGroup;

  private bossInterval: number = 1000;
  private nextBossAltitude: number = 1000;
  private currentArena: BossArena | null = null;
  private currentBoss: Boss | null = null;
  private isBossFight: boolean = false;
  private bossCount: number = 0;
  private warningEmitted: boolean = false;
  private arenaGenerated: boolean = false;

  constructor(
    scene: Phaser.Scene,
    staticPlatforms: Phaser.Physics.Arcade.StaticGroup,
  ) {
    this.scene = scene;
    this.staticPlatforms = staticPlatforms;
  }

  shouldSpawnArena(altitude: number): boolean {
    if (this.arenaGenerated || this.isBossFight) return false;
    // Trigger arena generation when altitude is within 50m below the boss altitude
    return altitude >= this.nextBossAltitude - 50;
  }

  getArenaWorldY(): number {
    return WORLD.BASE_PLATFORM_Y - this.nextBossAltitude * WORLD.ALTITUDE_SCALE;
  }

  generateArena(
    scene: Phaser.Scene,
    staticPlatforms: Phaser.Physics.Arcade.StaticGroup,
  ): BossArena {
    this.bossCount++;
    const centerY = this.getArenaWorldY();
    const arenaWidth = WORLD.WIDTH;
    const arenaHeight = 768;

    const topY = centerY - arenaHeight / 2;
    const bottomY = centerY + arenaHeight / 2;

    // Top barrier: full-width, initially invisible/disabled
    const topBarrier = scene.add.rectangle(
      WORLD.WIDTH / 2,
      topY,
      WORLD.WIDTH,
      20,
      0xff0000,
      0.0,
    );
    scene.physics.add.existing(topBarrier, true);
    const topBody = topBarrier.body as Phaser.Physics.Arcade.StaticBody;
    topBody.enable = false;

    // Bottom barrier: full-width, initially invisible/disabled
    const bottomBarrier = scene.add.rectangle(
      WORLD.WIDTH / 2,
      bottomY,
      WORLD.WIDTH,
      20,
      0xff0000,
      0.0,
    );
    scene.physics.add.existing(bottomBarrier, true);
    const bottomBody = bottomBarrier.body as Phaser.Physics.Arcade.StaticBody;
    bottomBody.enable = false;

    // Create arena platforms — 7 platforms spread across 768px height
    const makePlat = (x: number, y: number, scale: number) => {
      const p = staticPlatforms.create(x, y, "ground");
      p.setScale(scale, 1).refreshBody();
      p.setData("type", "STANDARD");
      p.setData("arenaPlat", true);
    };

    // 0. Full-width floor
    const floorPlat = staticPlatforms.create(WORLD.WIDTH / 2, bottomY - 16, "ground");
    floorPlat.setScale(WORLD.WIDTH / 400, 1).refreshBody();
    floorPlat.setData("type", "STANDARD");
    floorPlat.setData("arenaPlat", true);

    // 1-2. Lower left/right (25% up from bottom)
    const lowerY = centerY + arenaHeight * 0.25;
    makePlat(WORLD.WIDTH * 0.2, lowerY, 1.8);
    makePlat(WORLD.WIDTH * 0.8, lowerY, 1.8);

    // 3. Center platform (at center)
    makePlat(WORLD.WIDTH / 2, centerY, 2.5);

    // 4-5. Upper left/right (25% down from top)
    const upperY = centerY - arenaHeight * 0.25;
    makePlat(WORLD.WIDTH * 0.25, upperY, 1.5);
    makePlat(WORLD.WIDTH * 0.75, upperY, 1.5);

    // 6. Small top platform
    makePlat(WORLD.WIDTH / 2, topY + 60, 1.0);

    const arena: BossArena = {
      centerX: WORLD.WIDTH / 2,
      centerY,
      width: arenaWidth,
      height: arenaHeight,
      platforms: staticPlatforms,
      topBarrier,
      bottomBarrier,
      bossNumber: this.bossCount,
      isLocked: false,
    };

    this.currentArena = arena;
    this.arenaGenerated = true;

    return arena;
  }

  lockArena(scene: Phaser.Scene): void {
    if (!this.currentArena) return;

    const arena = this.currentArena;
    arena.isLocked = true;
    this.isBossFight = true;

    // Enable and show top barrier
    arena.topBarrier.setAlpha(0.3);
    const topBody = arena.topBarrier.body as Phaser.Physics.Arcade.StaticBody;
    topBody.enable = true;

    // Enable and show bottom barrier
    arena.bottomBarrier.setAlpha(0.3);
    const bottomBody = arena.bottomBarrier
      .body as Phaser.Physics.Arcade.StaticBody;
    bottomBody.enable = true;

    // Add player-barrier colliders
    const player = (scene as any).player;
    if (player) {
      scene.physics.add.collider(player, arena.topBarrier);
      scene.physics.add.collider(player, arena.bottomBarrier);
    }

    // Spawn the boss (Boss constructor emits boss-spawn event)
    const enemies = (scene as any).enemies as Phaser.Physics.Arcade.Group;
    if (player && enemies) {
      this.currentBoss = this.spawnBoss(scene, player, enemies);
    }
  }

  spawnBoss(
    scene: Phaser.Scene,
    player: Player,
    enemies: Phaser.Physics.Arcade.Group,
  ): Boss {
    const arena = this.currentArena!;
    const bossNumber = arena.bossNumber;

    // Cycle through 5 boss archetypes
    const bossIndex = ((bossNumber - 1) % 5) + 1;
    let boss: Boss;

    switch (bossIndex) {
      case 1:
        boss = new MagmaTyrant(scene, arena.centerX, arena.centerY, player, bossNumber);
        break;
      case 2:
        boss = new VoidWingArchon(scene, arena.centerX, arena.centerY, player, bossNumber);
        break;
      case 3:
        boss = new ChronoDemon(scene, arena.centerX, arena.centerY, player, bossNumber);
        break;
      case 4: {
        const legion = new LegionMaster(scene, arena.centerX, arena.centerY, player, bossNumber);
        legion.setEnemiesGroup(enemies);
        boss = legion;
        break;
      }
      case 5: {
        const devourer = new PlatformDevourer(scene, arena.centerX, arena.centerY, player, bossNumber);
        devourer.setArena(arena);
        boss = devourer;
        break;
      }
      default:
        boss = new MagmaTyrant(scene, arena.centerX, arena.centerY, player, bossNumber);
        break;
    }

    enemies.add(boss);
    return boss;
  }

  unlockArena(_scene: Phaser.Scene): void {
    if (!this.currentArena) return;

    const arena = this.currentArena;
    arena.isLocked = false;
    this.isBossFight = false;

    // Disable and hide barriers
    arena.topBarrier.setAlpha(0);
    const topBody = arena.topBarrier.body as Phaser.Physics.Arcade.StaticBody;
    topBody.enable = false;

    arena.bottomBarrier.setAlpha(0);
    const bottomBody = arena.bottomBarrier
      .body as Phaser.Physics.Arcade.StaticBody;
    bottomBody.enable = false;

    // Boss.die() already emits 'boss-defeated' — no duplicate emit here

    // Advance to next boss
    this.nextBossAltitude += this.bossInterval;
    this.currentArena = null;
    this.warningEmitted = false;
    this.arenaGenerated = false;
  }

  isInArena(playerY: number): boolean {
    if (!this.currentArena) return false;
    const arena = this.currentArena;
    const topY = arena.centerY - arena.height / 2;
    const bottomY = arena.centerY + arena.height / 2;
    return playerY >= topY && playerY <= bottomY;
  }

  update(altitude: number, playerY: number): void {
    // Emit boss warning continuously when player is within 300m
    if (
      !this.isBossFight &&
      altitude >= this.nextBossAltitude - 300 &&
      altitude < this.nextBossAltitude
    ) {
      EventBus.emit("boss-warning", {
        distance: this.nextBossAltitude - altitude,
      });
    }

    // Lock arena when player enters it
    if (
      this.currentArena &&
      !this.currentArena.isLocked &&
      this.isInArena(playerY)
    ) {
      this.lockArena(this.scene);
    }

    // Check if boss has been defeated → unlock arena
    if (this.isBossFight && this.currentBoss && !this.currentBoss.active) {
      this.currentBoss = null;
      this.unlockArena(this.scene);
    }
  }

  getNextBossAltitude(): number {
    return this.nextBossAltitude;
  }

  getIsBossFight(): boolean {
    return this.isBossFight;
  }

  getCurrentArena(): BossArena | null {
    return this.currentArena;
  }

  getArenaHeight(): number {
    return 768;
  }

  setNextBossAltitude(altitude: number): void {
    this.nextBossAltitude = altitude;
  }

  setBossCount(count: number): void {
    this.bossCount = count;
  }

  getCurrentBoss(): Boss | null {
    return this.currentBoss;
  }
}

import Phaser from "phaser";
import { BIOMES, PHYSICS, SLOPES, WORLD } from "../config/GameConfig";
import {
  PlatformType,
  PLATFORM_DEFS,
  BIOME_PLATFORM_WEIGHTS,
} from "../config/PlatformTypes";
import type { SlopeManager } from "./SlopeManager";
import type { PlatformTextureManager } from "./PlatformTextureManager";
import type { PlatformEffectsManager } from "./PlatformEffectsManager";
import type { BossArenaManager } from "./BossArenaManager";

interface DifficultyParams {
  minGap: number;
  maxGap: number;
  biomeKey: string;
}

// Side zones for tower-climb layout
const SIDE_ZONES = {
  left: { min: 120, max: 600 },
  right: { min: 1320, max: 1800 },
};

export class LevelGenerator {
  private scene: Phaser.Scene;
  private staticPlatforms: Phaser.Physics.Arcade.StaticGroup;
  private movingPlatforms: Phaser.Physics.Arcade.Group;
  private slopeManager: SlopeManager;
  private textureManager: PlatformTextureManager | null = null;
  private platformEffectsManager: PlatformEffectsManager | null = null;
  private bossArenaManager: BossArenaManager | null = null;
  private lastPlatformY: number;
  private lastPlatformX: number;

  // Shop platform spawning
  private lastShopAltitude: number = 0;
  private nextShopDist: number = 0;

  // Tower-climb state: alternates between side climbing and bridging
  private currentSide: "left" | "right" = "left";
  private phase: "side" | "bridge" = "side";
  private phaseProgress: number = 0;
  private phaseTarget: number = 3;

  constructor(
    scene: Phaser.Scene,
    staticPlatforms: Phaser.Physics.Arcade.StaticGroup,
    movingPlatforms: Phaser.Physics.Arcade.Group,
    slopeManager: SlopeManager,
  ) {
    this.scene = scene;
    this.staticPlatforms = staticPlatforms;
    this.movingPlatforms = movingPlatforms;
    this.slopeManager = slopeManager;
    this.lastPlatformY = WORLD.BASE_PLATFORM_Y;
    this.lastPlatformX = 960;
  }

  setTextureManager(textureManager: PlatformTextureManager) {
    this.textureManager = textureManager;
  }

  setPlatformEffectsManager(manager: PlatformEffectsManager) {
    this.platformEffectsManager = manager;
  }

  setBossArenaManager(manager: BossArenaManager) {
    this.bossArenaManager = manager;
  }

  private nextShopInterval(): number {
    return Phaser.Math.Between(300, 500);
  }

  init() {
    this.lastShopAltitude = 0;
    this.nextShopDist = this.nextShopInterval();

    // Wide starting platform
    this.createPlatform(960, WORLD.BASE_PLATFORM_Y, 10, PlatformType.STANDARD);
    // Guide player toward left wall to start the climb
    this.createPlatform(500, 830, 2, PlatformType.STANDARD);
    this.createPlatform(300, 650, 1.8, PlatformType.STANDARD);
    this.createPlatform(200, 470, 1.5, PlatformType.STANDARD);

    this.lastPlatformY = 470;
    this.lastPlatformX = 200;
    this.currentSide = "left";
    this.phase = "side";
    this.phaseProgress = 1;
    this.phaseTarget = Phaser.Math.Between(2, 4);
  }

  update(playerY: number) {
    const generationThreshold = playerY - WORLD.GENERATION_LOOKAHEAD;

    while (this.lastPlatformY > generationThreshold) {
      const altitude = Math.max(
        0,
        (WORLD.BASE_PLATFORM_Y - this.lastPlatformY) / WORLD.ALTITUDE_SCALE,
      );

      // Check if we should place a boss arena instead of normal platforms
      if (
        this.bossArenaManager &&
        this.bossArenaManager.shouldSpawnArena(altitude)
      ) {
        const arena = this.bossArenaManager.generateArena(
          this.scene,
          this.staticPlatforms,
        );
        // Skip normal generation for the arena's vertical range
        // Move generation position to above the arena
        this.lastPlatformY =
          arena.centerY - arena.height / 2 - 100;
        this.lastPlatformX = WORLD.WIDTH / 2;
        continue;
      }

      this.generateNextChunk(altitude);
    }

    this.cleanupPlatforms(this.staticPlatforms, playerY);
    this.cleanupPlatforms(this.movingPlatforms, playerY);
    this.slopeManager.cleanup(playerY, WORLD.PLATFORM_CLEANUP_BUFFER);
  }

  private cleanupPlatforms(
    group: Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup,
    playerY: number,
  ) {
    group.children.each((child: any) => {
      if (child.y > playerY + WORLD.PLATFORM_CLEANUP_BUFFER) {
        const shadowUpdateCallback = child.getData("shadowUpdateCallback");
        if (shadowUpdateCallback) {
          this.scene.events.off("update", shadowUpdateCallback);
        }
        const shadow = child.getData("shadow") as
          | Phaser.GameObjects.Rectangle
          | undefined;
        if (shadow) {
          shadow.destroy();
        }
        group.remove(child, true, true);
      }
      return true;
    });
  }

  private getBiomeKey(altitude: number): string {
    const entries = Object.entries(BIOMES);
    for (const [key, biome] of entries) {
      if (altitude < biome.maxAltitude) return key;
    }
    return "SUMMIT";
  }

  // Fix 2: Smooth difficulty curves via linear interpolation
  private getDifficultyParams(altitude: number): DifficultyParams {
    const biomeKey = this.getBiomeKey(altitude);

    // Lerp between anchor points: altitude 0 → 80/150, altitude 5000 → 150/300
    const t = Math.min(1, altitude / 5000);
    const minGap = Math.round(80 + t * 70);
    const maxGap = Math.round(150 + t * 150);

    return { minGap, maxGap, biomeKey };
  }

  private rollPlatformType(biomeKey: string): PlatformType {
    const weights = BIOME_PLATFORM_WEIGHTS[biomeKey];
    if (!weights) return PlatformType.STANDARD;

    const roll = Math.random();
    let cumulative = 0;

    cumulative += weights.standard;
    if (roll < cumulative) return PlatformType.STANDARD;

    cumulative += weights.moving;
    if (roll < cumulative) return PlatformType.MOVING;

    cumulative += weights.breakable;
    if (roll < cumulative) return PlatformType.BREAKABLE;

    cumulative += weights.ice;
    if (roll < cumulative) return PlatformType.ICE;

    cumulative += weights.sticky;
    if (roll < cumulative) return PlatformType.STICKY;

    cumulative += weights.bounce;
    if (roll < cumulative) return PlatformType.BOUNCE;

    cumulative += weights.slope;
    if (roll < cumulative) {
      return Math.random() > 0.5
        ? PlatformType.SLOPE_LEFT
        : PlatformType.SLOPE_RIGHT;
    }

    return PlatformType.STANDARD;
  }

  // Fix 1: Jump feasibility check accounting for double jump + hold force
  private isJumpFeasible(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): boolean {
    const gravity = PHYSICS.GRAVITY;
    const jumpForce = Math.abs(PHYSICS.JUMP_FORCE);
    const doubleJumpForce = jumpForce * PHYSICS.DOUBLE_JUMP_MULTIPLIER;
    const moveSpeed = PHYSICS.MOVE_SPEED;

    const singleHeight = (jumpForce * jumpForce) / (2 * gravity);
    const doubleHeight = (doubleJumpForce * doubleJumpForce) / (2 * gravity);
    const holdVelocity =
      Math.abs(PHYSICS.JUMP_HOLD_FORCE) * (PHYSICS.JUMP_HOLD_DURATION / 16.67);
    const holdBonus = (holdVelocity * holdVelocity) / (2 * gravity);
    const maxHeight = singleHeight + doubleHeight + holdBonus;

    const singleAirTime = (2 * jumpForce) / gravity;
    const doubleAirTime = (2 * doubleJumpForce) / gravity;
    const maxHorizontal = (singleAirTime + doubleAirTime) * moveSpeed;

    const dy = fromY - toY; // positive = target is above
    const dx = Math.abs(toX - fromX);

    // 85% safety margin — reject only clearly impossible jumps
    return dy <= maxHeight * 0.85 && dx <= maxHorizontal * 0.85;
  }

  // Fix 6: Progressive platform scale within multi-platform patterns
  private getPatternScale(index: number, total: number): number {
    if (total <= 1) return 1.5;
    const t = index / (total - 1);
    if (t <= 0.3) {
      return 1.5 + (t / 0.3) * 0.5; // 1.5 → 2.0
    } else if (t <= 0.7) {
      return 2.0 - ((t - 0.3) / 0.4) * 1.2; // 2.0 → 0.8
    } else {
      return 0.8 + ((t - 0.7) / 0.3) * 1.2; // 0.8 → 2.0
    }
  }

  // Run a special pattern for variety, then recover to the current side
  private runSpecialPattern(params: DifficultyParams) {
    const roll = Math.random();
    if (roll < 0.2) this.generateBounceChain(params);
    else if (roll < 0.4) this.generateSlopeRun(params);
    else if (roll < 0.55) this.generateHalfpipeSection(params);
    else if (roll < 0.7) this.generateLaunchSequence(params);
    else if (roll < 0.85) this.generateRollingHills(params);
    else this.generateWallJumpSection(params);

    // Place a recovery platform on the target side if we drifted away
    const zone = SIDE_ZONES[this.currentSide];
    if (this.lastPlatformX < zone.min || this.lastPlatformX > zone.max) {
      const y =
        this.lastPlatformY -
        Phaser.Math.Between(params.minGap, params.maxGap);
      const x = Phaser.Math.Between(zone.min, zone.max);
      this.lastPlatformY = this.createPlatform(
        x,
        y,
        1.5,
        PlatformType.STANDARD,
      );
      this.lastPlatformX = x;
    }
  }

  // Fix 8: Calculate where a player lands after launching off a slope
  private calculateSlopeLanding(
    exitX: number,
    exitY: number,
    slopeWidth: number,
    slopeHeight: number,
    direction: "left" | "right",
  ): { x: number; y: number } {
    const speed = PHYSICS.MOVE_SPEED * SLOPES.DOWNHILL_SPEED_MULT;
    const launchSpeed = speed * SLOPES.LAUNCH_FORCE_MULT;
    const slopeAngle = Math.atan2(slopeHeight, slopeWidth);

    const vx =
      launchSpeed * Math.cos(slopeAngle) * (direction === "left" ? -1 : 1);
    const vy = -launchSpeed * Math.sin(slopeAngle);

    // Projectile: t when y returns to exitY → t = -2*vy/g
    const airTime = Math.abs((2 * vy) / PHYSICS.GRAVITY);
    const landingX = exitX + vx * airTime;

    return {
      x: Phaser.Math.Clamp(Math.round(landingX), 100, WORLD.WIDTH - 100),
      y: exitY - Phaser.Math.Between(40, 80),
    };
  }

  // Remove existing platforms that overlap with a slope being placed
  private clearPlatformsInArea(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    margin: number = 20,
  ) {
    const left = minX - margin;
    const right = maxX + margin;
    const top = minY - margin;
    const bottom = maxY + margin;

    const removeOverlapping = (
      group: Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup,
    ) => {
      const toRemove: any[] = [];
      group.children.each((child: any) => {
        if (!child.active) return true;
        const hw = child.displayWidth / 2;
        const hh = child.displayHeight / 2;
        if (
          child.x + hw > left &&
          child.x - hw < right &&
          child.y + hh > top &&
          child.y - hh < bottom
        ) {
          toRemove.push(child);
        }
        return true;
      });
      for (const child of toRemove) {
        const shadowCb = child.getData("shadowUpdateCallback");
        if (shadowCb) this.scene.events.off("update", shadowCb);
        const shadow = child.getData("shadow");
        if (shadow) shadow.destroy();
        group.remove(child, true, true);
      }
    };

    removeOverlapping(this.staticPlatforms);
    removeOverlapping(this.movingPlatforms);
  }

  private generateNextChunk(altitude: number) {
    const params = this.getDifficultyParams(altitude);

    if (this.phase === "side") {
      this.generateSidePlatform(params);
      this.phaseProgress++;
      if (this.phaseProgress >= this.phaseTarget) {
        // Start bridge phase — cross to the other side
        this.phase = "bridge";
        this.phaseProgress = 0;
        this.phaseTarget = Phaser.Math.Between(1, 3);
      }
    } else {
      this.generateBridgePlatform(params);
      this.phaseProgress++;
      if (this.phaseProgress >= this.phaseTarget) {
        // Switch sides and start climbing again
        this.currentSide = this.currentSide === "left" ? "right" : "left";
        this.phase = "side";
        this.phaseProgress = 0;
        this.phaseTarget = Phaser.Math.Between(2, 5);

        // 20% chance to run a special pattern for variety
        if (Math.random() < 0.2) {
          this.runSpecialPattern(params);
        }
      }
    }

    // Shop platform check — spawn a golden shop platform at regular intervals
    // Don't spawn during boss arena zones
    const isInBossArena =
      this.bossArenaManager && this.bossArenaManager.shouldSpawnArena(altitude);
    if (!isInBossArena && altitude - this.lastShopAltitude >= this.nextShopDist) {
      const shopY = this.lastPlatformY - Phaser.Math.Between(params.minGap, params.maxGap);
      const shopX = Phaser.Math.Clamp(
        this.lastPlatformX + Phaser.Math.Between(-200, 200),
        300,
        WORLD.WIDTH - 300,
      );
      const shopScale = Phaser.Math.FloatBetween(2.0, 2.5);
      this.lastPlatformY = this.createPlatform(shopX, shopY, shopScale, PlatformType.SHOP);
      this.lastPlatformX = shopX;
      this.lastShopAltitude = altitude;
      this.nextShopDist = this.nextShopInterval();
    }
  }

  // Place a platform on the current side (hugging left or right wall)
  private generateSidePlatform(params: DifficultyParams) {
    const zone = SIDE_ZONES[this.currentSide];
    const yGap = Phaser.Math.Between(params.minGap, params.maxGap);
    let y = this.lastPlatformY - yGap;

    // Stay within the side zone with some horizontal variance
    let x = Phaser.Math.Clamp(
      this.lastPlatformX + Phaser.Math.Between(-150, 150),
      zone.min,
      zone.max,
    );

    if (!this.isJumpFeasible(this.lastPlatformX, this.lastPlatformY, x, y)) {
      x = Phaser.Math.Clamp(
        Math.round((this.lastPlatformX + x) / 2),
        zone.min,
        zone.max,
      );
      y = this.lastPlatformY - Math.round(yGap * 0.6);
    }

    const scale = Phaser.Math.FloatBetween(1.0, 2.0);
    const type = this.rollPlatformType(params.biomeKey);
    this.lastPlatformY = this.createPlatform(x, y, scale, type);
    this.lastPlatformX = x;
  }

  // Bridge platforms that step across the middle toward the opposite side
  private generateBridgePlatform(params: DifficultyParams) {
    const yGap = Phaser.Math.Between(
      params.minGap,
      Math.round((params.minGap + params.maxGap) * 0.6),
    );
    const y = this.lastPlatformY - yGap;

    // Lerp from current side edge toward opposite side edge
    const progress =
      this.phaseTarget <= 1
        ? 0.5
        : (this.phaseProgress + 1) / this.phaseTarget;
    const fromX = this.currentSide === "left" ? 550 : 1370;
    const toX = this.currentSide === "left" ? 1370 : 550;
    let x = Math.round(fromX + progress * (toX - fromX));
    x += Phaser.Math.Between(-80, 80);
    x = Phaser.Math.Clamp(x, 200, 1720);

    if (!this.isJumpFeasible(this.lastPlatformX, this.lastPlatformY, x, y)) {
      const dir = this.currentSide === "left" ? 1 : -1;
      x = Phaser.Math.Clamp(this.lastPlatformX + dir * 200, 200, 1720);
    }

    const scale = Phaser.Math.FloatBetween(0.8, 1.5);
    // Bridges are more likely to be moving platforms
    const type =
      Math.random() < 0.3
        ? PlatformType.MOVING
        : this.rollPlatformType(params.biomeKey);
    this.lastPlatformY = this.createPlatform(x, y, scale, type);
    this.lastPlatformX = x;
  }

  // Fix 4 & 6: Biome-weighted types + progressive scale
  private generateZigZagPattern(params: DifficultyParams) {
    const steps = Phaser.Math.Between(3, 5);
    const yGap = Phaser.Math.Between(params.minGap, params.maxGap);

    for (let i = 0; i < steps; i++) {
      const y = this.lastPlatformY - yGap;
      const isLeft = this.lastPlatformX < 960;
      let x = isLeft
        ? Phaser.Math.Between(1000, 1700)
        : Phaser.Math.Between(200, 900);

      // Fix 1: Clamp if infeasible
      if (!this.isJumpFeasible(this.lastPlatformX, this.lastPlatformY, x, y)) {
        x = Phaser.Math.Clamp(
          this.lastPlatformX + (isLeft ? 300 : -300),
          200,
          1700,
        );
      }

      const scale = this.getPatternScale(i, steps);
      const type = this.rollPlatformType(params.biomeKey);
      this.lastPlatformY = this.createPlatform(x, y, scale, type);
      this.lastPlatformX = x;
    }
  }

  // Fix 4 exception: Wall jumps keep STANDARD
  private generateWallJumpSection(params: DifficultyParams) {
    const steps = Phaser.Math.Between(3, 6);
    const yGap = Math.min(150, params.maxGap);
    const wallX = Math.random() > 0.5 ? 200 : 1720;

    for (let i = 0; i < steps; i++) {
      const y = this.lastPlatformY - yGap;
      const x = wallX + Phaser.Math.Between(-50, 50);

      this.lastPlatformY = this.createPlatform(x, y, 0.8, PlatformType.STANDARD);
      this.lastPlatformX = x;
    }
  }

  // Fix 8: Slope run with landing validation + platform clearing
  private generateSlopeRun(params: DifficultyParams) {
    const slopeCount = Phaser.Math.Between(2, 3);
    const slopeWidth = Phaser.Math.Between(200, 350);
    const slopeHeight = Phaser.Math.Between(60, 120);
    const biomeKey = params.biomeKey;
    const biomeDef = BIOMES[biomeKey as keyof typeof BIOMES];
    const tint = biomeDef?.platform ?? 0xffaa44;

    for (let i = 0; i < slopeCount; i++) {
      const yGap = Phaser.Math.Between(40, 80);
      const y = this.lastPlatformY - yGap;

      const minX = Math.max(100, this.lastPlatformX - 300);
      const maxX = Math.min(
        WORLD.WIDTH - 100 - slopeWidth,
        this.lastPlatformX + 300,
      );
      const x = Phaser.Math.Between(
        Math.min(minX, maxX),
        Math.max(minX, maxX),
      );

      // Clear any existing platforms in the slope area before placing
      this.clearPlatformsInArea(x, y - slopeHeight, x + slopeWidth, y);

      const direction: "left" | "right" = i % 2 === 0 ? "left" : "right";

      this.slopeManager.createSlope(
        x,
        y,
        slopeWidth,
        slopeHeight,
        direction,
        tint,
      );

      this.lastPlatformY = y - slopeHeight;
      this.lastPlatformX = x + slopeWidth / 2;
    }

    // Fix 8: Place safety platform at calculated landing point
    const lastDir: "left" | "right" =
      slopeCount % 2 === 0 ? "right" : "left";
    const landing = this.calculateSlopeLanding(
      this.lastPlatformX,
      this.lastPlatformY,
      slopeWidth,
      slopeHeight,
      lastDir,
    );
    this.lastPlatformY = this.createPlatform(
      landing.x,
      landing.y,
      1.5,
      PlatformType.STANDARD,
    );
    this.lastPlatformX = landing.x;
  }

  // Fix 4 exception: Bounce chain keeps BOUNCE; Fix 6: progressive scale
  private generateBounceChain(params: DifficultyParams) {
    const count = Phaser.Math.Between(2, 4);

    for (let i = 0; i < count; i++) {
      const yGap = Phaser.Math.Between(80, 140);
      let y = this.lastPlatformY - yGap;

      const minX = Math.max(100, this.lastPlatformX - 350);
      const maxX = Math.min(1820, this.lastPlatformX + 350);
      let x = Phaser.Math.Between(minX, maxX);

      // Fix 1: Validate feasibility
      if (!this.isJumpFeasible(this.lastPlatformX, this.lastPlatformY, x, y)) {
        y = this.lastPlatformY - Math.round(yGap / 2);
        x = Phaser.Math.Clamp(
          this.lastPlatformX + Phaser.Math.Between(-150, 150),
          100,
          1820,
        );
      }

      const scale = Math.max(0.5, this.getPatternScale(i, count) * 0.5);
      this.lastPlatformY = this.createPlatform(
        x,
        y,
        scale,
        PlatformType.BOUNCE,
      );
      this.lastPlatformX = x;
    }

    // Reward platform at top of bounce chain
    const rewardY = this.lastPlatformY - Phaser.Math.Between(200, 300);
    this.lastPlatformY = this.createPlatform(
      this.lastPlatformX,
      rewardY,
      2.0,
      PlatformType.STANDARD,
    );
  }

  private generateHalfpipeSection(params: DifficultyParams) {
    const biomeKey = params.biomeKey;
    const biomeDef = BIOMES[biomeKey as keyof typeof BIOMES];
    const tint = biomeDef?.platform ?? 0xffaa44;

    const width = Phaser.Math.Between(
      SLOPES.HALF_PIPE_WIDTH.min,
      SLOPES.HALF_PIPE_WIDTH.max,
    );
    const depth = Phaser.Math.Between(
      SLOPES.HALF_PIPE_DEPTH.min,
      SLOPES.HALF_PIPE_DEPTH.max,
    );

    const yGap = Phaser.Math.Between(params.minGap, params.maxGap);
    const y = this.lastPlatformY - yGap;

    const x = Math.max(
      100,
      Math.min(WORLD.WIDTH - 100 - width, this.lastPlatformX - width / 2),
    );

    // Clear platforms in the halfpipe area (bowl extends downward from y)
    this.clearPlatformsInArea(x, y, x + width, y + depth);

    this.slopeManager.createHalfPipe(x, y, width, depth, tint);

    this.lastPlatformY = y - depth;
    this.lastPlatformX = x + width / 2;

    const exitY = this.lastPlatformY - Phaser.Math.Between(80, 140);
    this.lastPlatformY = this.createPlatform(
      this.lastPlatformX,
      exitY,
      1.5,
      PlatformType.STANDARD,
    );
  }

  // Fix 8: Launch sequence with landing validation + platform clearing
  private generateLaunchSequence(params: DifficultyParams) {
    const biomeKey = params.biomeKey;
    const biomeDef = BIOMES[biomeKey as keyof typeof BIOMES];
    const tint = biomeDef?.platform ?? 0xffaa44;

    const rampCount = Phaser.Math.Between(2, 3);
    let lastWidth = 0;
    let lastHeight = 0;
    let lastDirection: "left" | "right" = "left";

    for (let i = 0; i < rampCount; i++) {
      const width = Phaser.Math.Between(
        SLOPES.QUARTER_PIPE_WIDTH.min,
        SLOPES.QUARTER_PIPE_WIDTH.max,
      );
      const height = Phaser.Math.Between(
        SLOPES.QUARTER_PIPE_HEIGHT.min,
        SLOPES.QUARTER_PIPE_HEIGHT.max,
      );

      const yGap = Phaser.Math.Between(40, 80);
      const y = this.lastPlatformY - yGap;

      const minX = Math.max(100, this.lastPlatformX - 300);
      const maxX = Math.min(
        WORLD.WIDTH - 100 - width,
        this.lastPlatformX + 300,
      );
      const x = Phaser.Math.Between(
        Math.min(minX, maxX),
        Math.max(minX, maxX),
      );

      // Clear platforms in the ramp area
      this.clearPlatformsInArea(x, y - height, x + width, y);

      const direction: "left" | "right" = i % 2 === 0 ? "left" : "right";
      this.slopeManager.createQuarterPipe(x, y, width, height, direction, tint);

      this.lastPlatformY = y - height;
      this.lastPlatformX = x + width / 2;
      lastWidth = width;
      lastHeight = height;
      lastDirection = direction;
    }

    // Fix 8: Place reward platform at calculated landing point
    const landing = this.calculateSlopeLanding(
      this.lastPlatformX,
      this.lastPlatformY,
      lastWidth,
      lastHeight,
      lastDirection,
    );
    this.lastPlatformY = this.createPlatform(
      landing.x,
      landing.y,
      2.0,
      PlatformType.STANDARD,
    );
    this.lastPlatformX = landing.x;
  }

  // Fix 4 & 6: Rolling hills uses biome types + pattern scale + platform clearing
  private generateRollingHills(params: DifficultyParams) {
    const biomeKey = params.biomeKey;
    const biomeDef = BIOMES[biomeKey as keyof typeof BIOMES];
    const tint = biomeDef?.platform ?? 0xffaa44;

    const hillCount = Phaser.Math.Between(2, 4);

    for (let i = 0; i < hillCount; i++) {
      const width = Phaser.Math.Between(
        SLOPES.HILL_WIDTH.min,
        SLOPES.HILL_WIDTH.max,
      );
      const height = Phaser.Math.Between(
        SLOPES.HILL_HEIGHT.min,
        SLOPES.HILL_HEIGHT.max,
      );

      const yGap = Phaser.Math.Between(20, 50);
      const y = this.lastPlatformY - yGap;

      const minX = Math.max(100, this.lastPlatformX - 250);
      const maxX = Math.min(
        WORLD.WIDTH - 100 - width,
        this.lastPlatformX + 250,
      );
      const x = Phaser.Math.Between(
        Math.min(minX, maxX),
        Math.max(minX, maxX),
      );

      // Clear platforms in the hill area before placing
      this.clearPlatformsInArea(x, y - height, x + width, y);

      this.slopeManager.createHill(x, y, width, height, tint);

      // Place landing platform ABOVE the hill peak (not inside the curve)
      const scale = Math.max(0.5, this.getPatternScale(i, hillCount) * 0.5);
      const type = this.rollPlatformType(params.biomeKey);
      this.createPlatform(x + width / 2, y - height - 10, scale, type);

      this.lastPlatformY = y - height;
      this.lastPlatformX = x + width / 2;
    }

    const safeY = this.lastPlatformY - Phaser.Math.Between(60, 100);
    this.lastPlatformY = this.createPlatform(
      this.lastPlatformX,
      safeY,
      1.5,
      PlatformType.STANDARD,
    );
  }

  // Returns actual y used (may differ from input if shifted to avoid slope overlap)
  private createPlatform(
    x: number,
    y: number,
    scale: number,
    type: PlatformType,
  ): number {
    // Slope types are handled by SlopeManager, not physics bodies
    if (type === PlatformType.SLOPE_LEFT || type === PlatformType.SLOPE_RIGHT) {
      const width = scale * 400;
      const height = 80;
      const direction = type === PlatformType.SLOPE_LEFT ? "left" : "right";
      const biomeKey = this.getBiomeKey(
        Math.max(0, (WORLD.BASE_PLATFORM_Y - y) / WORLD.ALTITUDE_SCALE),
      );
      const biomeDef = BIOMES[biomeKey as keyof typeof BIOMES];

      // Clear overlapping platforms before placing slope
      this.clearPlatformsInArea(
        x - width / 2,
        y - height,
        x + width / 2,
        y,
      );

      this.slopeManager.createSlope(
        x - width / 2,
        y,
        width,
        height,
        direction,
        biomeDef?.platform ?? 0xffaa44,
      );
      return y;
    }

    // Check slope overlap — shift platform above any conflicting slope
    const platformHalfW = (scale * 400) / 2;
    const clearY = this.slopeManager.findClearY(x, y, platformHalfW, 16);
    if (clearY !== null) {
      y = clearY;
    }

    const def = PLATFORM_DEFS[type];

    // Determine texture key: procedural if textureManager is available, else "ground"
    const scaledWidth = Math.round(scale * 400);
    const platformHeight = 32;
    let textureKey = "ground";
    let useProceduralTexture = false;

    if (this.textureManager) {
      const biomeKey = this.getBiomeKey(
        Math.max(0, (WORLD.BASE_PLATFORM_Y - y) / WORLD.ALTITUDE_SCALE),
      );
      textureKey = this.textureManager.generateTexture(
        biomeKey,
        type,
        scaledWidth,
        platformHeight,
      );
      useProceduralTexture = true;
    }

    if (type === PlatformType.MOVING) {
      const platform = this.movingPlatforms.create(x, y, textureKey);
      if (useProceduralTexture) {
        platform.setScale(scaledWidth / platform.width, 1);
      } else {
        platform.setScale(scale, 1);
      }
      platform.setImmovable(true);
      platform.body.allowGravity = false;
      platform.setData("type", PlatformType.MOVING);

      if (!useProceduralTexture) {
        platform.setTint(def.color);
      }

      // Drop shadow for moving platforms
      if (this.textureManager) {
        const shadow = this.textureManager.createDropShadow(
          this.scene,
          platform,
        );
        platform.setData("shadow", shadow);

        const shadowUpdateCallback = () => {
          if (platform.active && shadow.active) {
            shadow.setPosition(platform.x, platform.y + 4);
          }
        };
        this.scene.events.on("update", shadowUpdateCallback);
        platform.setData("shadowUpdateCallback", shadowUpdateCallback);
      }

      // Register for visual effects (glow/trail)
      if (this.platformEffectsManager) {
        this.platformEffectsManager.registerPlatform(
          platform,
          PlatformType.MOVING,
        );
      }

      const moveDist = 200;
      const targetX = x + moveDist > 1850 ? x - moveDist : x + moveDist;

      this.scene.tweens.add({
        targets: platform,
        x: targetX,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      const platform = this.staticPlatforms.create(x, y, textureKey);
      if (useProceduralTexture) {
        platform.setScale(scaledWidth / platform.width, 1).refreshBody();
      } else {
        platform.setScale(scale, 1).refreshBody();
      }
      platform.setData("type", type);

      if (!useProceduralTexture) {
        platform.setTint(def.color);
      }

      // Drop shadow for static platforms
      if (this.textureManager) {
        const shadow = this.textureManager.createDropShadow(
          this.scene,
          platform,
        );
        platform.setData("shadow", shadow);
      }

      // Register for visual effects (glow/shimmer)
      if (this.platformEffectsManager) {
        this.platformEffectsManager.registerPlatform(platform, type);
      }
    }

    return y;
  }
}

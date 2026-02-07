import Phaser from "phaser";
import { BIOMES, SLOPES, WORLD } from "../config/GameConfig";
import {
  PlatformType,
  PLATFORM_DEFS,
  BIOME_PLATFORM_WEIGHTS,
} from "../config/PlatformTypes";
import type { SlopeManager } from "./SlopeManager";

interface DifficultyParams {
  minGap: number;
  maxGap: number;
  biomeKey: string;
}

export class LevelGenerator {
  private scene: Phaser.Scene;
  private staticPlatforms: Phaser.Physics.Arcade.StaticGroup;
  private movingPlatforms: Phaser.Physics.Arcade.Group;
  private slopeManager: SlopeManager;
  private lastPlatformY: number;
  private lastPlatformX: number;

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

  init() {
    this.createPlatform(960, WORLD.BASE_PLATFORM_Y, 10, PlatformType.STANDARD);
    this.createPlatform(600, 800, 2, PlatformType.STANDARD);
    this.createPlatform(1400, 700, 2, PlatformType.MOVING);
    this.createPlatform(200, 500, 2, PlatformType.STANDARD);
    this.createPlatform(1000, 300, 2, PlatformType.BREAKABLE);

    this.lastPlatformY = 300;
    this.lastPlatformX = 1000;
  }

  update(playerY: number) {
    const generationThreshold = playerY - WORLD.GENERATION_LOOKAHEAD;

    while (this.lastPlatformY > generationThreshold) {
      const altitude = Math.max(
        0,
        (WORLD.BASE_PLATFORM_Y - this.lastPlatformY) / WORLD.ALTITUDE_SCALE,
      );
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

  private getDifficultyParams(altitude: number): DifficultyParams {
    const biomeKey = this.getBiomeKey(altitude);

    if (altitude < 500) {
      return { minGap: 80, maxGap: 150, biomeKey };
    } else if (altitude < 2000) {
      return { minGap: 100, maxGap: 200, biomeKey };
    } else if (altitude < 5000) {
      return { minGap: 130, maxGap: 260, biomeKey };
    } else {
      return { minGap: 150, maxGap: 300, biomeKey };
    }
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

  private generateNextChunk(altitude: number) {
    const params = this.getDifficultyParams(altitude);
    const patternRoll = Math.random();

    // Distribution: Standard 25%, Rolling Hills 15%, Halfpipe 12%, ZigZag 12%,
    // Launch Sequence 10%, Wall Jump 10%, Slope Run 8%, Bounce Chain 8%
    if (patternRoll < 0.12) {
      this.generateZigZagPattern(params);
    } else if (patternRoll < 0.22) {
      this.generateWallJumpSection(params);
    } else if (patternRoll < 0.3) {
      this.generateSlopeRun(params);
    } else if (patternRoll < 0.38) {
      this.generateBounceChain(params);
    } else if (patternRoll < 0.5) {
      this.generateHalfpipeSection(params);
    } else if (patternRoll < 0.6) {
      this.generateLaunchSequence(params);
    } else if (patternRoll < 0.75) {
      this.generateRollingHills(params);
    } else {
      this.generateStandardPlatform(params);
    }
  }

  private generateStandardPlatform(params: DifficultyParams) {
    const yGap = Phaser.Math.Between(params.minGap, params.maxGap);
    const y = this.lastPlatformY - yGap;

    const minX = Math.max(100, this.lastPlatformX - 400);
    const maxX = Math.min(1820, this.lastPlatformX + 400);
    const x = Phaser.Math.Between(minX, maxX);

    const scale = Phaser.Math.FloatBetween(0.8, 2.0);
    const type = this.rollPlatformType(params.biomeKey);

    this.createPlatform(x, y, scale, type);
    this.lastPlatformY = y;
    this.lastPlatformX = x;
  }

  private generateZigZagPattern(params: DifficultyParams) {
    const steps = Phaser.Math.Between(3, 5);
    const yGap = Phaser.Math.Between(params.minGap, params.maxGap);

    for (let i = 0; i < steps; i++) {
      const y = this.lastPlatformY - yGap;
      const isLeft = this.lastPlatformX < 960;
      const x = isLeft
        ? Phaser.Math.Between(1000, 1700)
        : Phaser.Math.Between(200, 900);

      this.createPlatform(x, y, 1.5, PlatformType.STANDARD);
      this.lastPlatformY = y;
      this.lastPlatformX = x;
    }
  }

  private generateWallJumpSection(params: DifficultyParams) {
    const steps = Phaser.Math.Between(3, 6);
    const yGap = Math.min(150, params.maxGap);
    const wallX = Math.random() > 0.5 ? 200 : 1720;

    for (let i = 0; i < steps; i++) {
      const y = this.lastPlatformY - yGap;
      const x = wallX + Phaser.Math.Between(-50, 50);

      this.createPlatform(x, y, 0.8, PlatformType.STANDARD);
      this.lastPlatformY = y;
      this.lastPlatformX = x;
    }
  }

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
      const x = Phaser.Math.Between(Math.min(minX, maxX), Math.max(minX, maxX));

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

    // Safety platform at the end of slope run
    const safeY = this.lastPlatformY - Phaser.Math.Between(60, 100);
    this.createPlatform(this.lastPlatformX, safeY, 1.5, PlatformType.STANDARD);
    this.lastPlatformY = safeY;
  }

  private generateBounceChain(params: DifficultyParams) {
    const count = Phaser.Math.Between(2, 4);

    for (let i = 0; i < count; i++) {
      const yGap = Phaser.Math.Between(80, 140);
      const y = this.lastPlatformY - yGap;

      const minX = Math.max(100, this.lastPlatformX - 350);
      const maxX = Math.min(1820, this.lastPlatformX + 350);
      const x = Phaser.Math.Between(minX, maxX);

      this.createPlatform(x, y, 0.6, PlatformType.BOUNCE);
      this.lastPlatformY = y;
      this.lastPlatformX = x;
    }

    // Reward platform at top of bounce chain
    const rewardY = this.lastPlatformY - Phaser.Math.Between(200, 300);
    this.createPlatform(
      this.lastPlatformX,
      rewardY,
      2.0,
      PlatformType.STANDARD,
    );
    this.lastPlatformY = rewardY;
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

    // Center the halfpipe near the last X position, clamped to world bounds
    const x = Math.max(
      100,
      Math.min(WORLD.WIDTH - 100 - width, this.lastPlatformX - width / 2),
    );

    // Halfpipe opens at y, bowl extends downward by depth
    this.slopeManager.createHalfPipe(x, y, width, depth, tint);

    this.lastPlatformY = y - depth;
    this.lastPlatformX = x + width / 2;

    // Exit platform above the halfpipe opening
    const exitY = this.lastPlatformY - Phaser.Math.Between(80, 140);
    this.createPlatform(this.lastPlatformX, exitY, 1.5, PlatformType.STANDARD);
    this.lastPlatformY = exitY;
  }

  private generateLaunchSequence(params: DifficultyParams) {
    const biomeKey = params.biomeKey;
    const biomeDef = BIOMES[biomeKey as keyof typeof BIOMES];
    const tint = biomeDef?.platform ?? 0xffaa44;

    const rampCount = Phaser.Math.Between(2, 3);

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
      const x = Phaser.Math.Between(Math.min(minX, maxX), Math.max(minX, maxX));

      // Alternate directions so player zigzags upward
      const direction: "left" | "right" = i % 2 === 0 ? "left" : "right";
      this.slopeManager.createQuarterPipe(x, y, width, height, direction, tint);

      this.lastPlatformY = y - height;
      this.lastPlatformX = x + width / 2;
    }

    // Reward platform at the top of the launch sequence
    const rewardY = this.lastPlatformY - Phaser.Math.Between(80, 140);
    this.createPlatform(
      this.lastPlatformX,
      rewardY,
      2.0,
      PlatformType.STANDARD,
    );
    this.lastPlatformY = rewardY;
  }

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

      // Small Y gaps between hills for smooth flowing terrain
      const yGap = Phaser.Math.Between(20, 50);
      const y = this.lastPlatformY - yGap;

      const minX = Math.max(100, this.lastPlatformX - 250);
      const maxX = Math.min(
        WORLD.WIDTH - 100 - width,
        this.lastPlatformX + 250,
      );
      const x = Phaser.Math.Between(Math.min(minX, maxX), Math.max(minX, maxX));

      this.slopeManager.createHill(x, y, width, height, tint);

      // Platform on top of each hill peak for landing
      this.createPlatform(
        x + width / 2,
        y - height + 10,
        0.6,
        PlatformType.STANDARD,
      );

      this.lastPlatformY = y - height;
      this.lastPlatformX = x + width / 2;
    }

    // Safety platform after the hills
    const safeY = this.lastPlatformY - Phaser.Math.Between(60, 100);
    this.createPlatform(this.lastPlatformX, safeY, 1.5, PlatformType.STANDARD);
    this.lastPlatformY = safeY;
  }

  private createPlatform(
    x: number,
    y: number,
    scale: number,
    type: PlatformType,
  ) {
    // Slope types are handled by SlopeManager, not physics bodies
    if (type === PlatformType.SLOPE_LEFT || type === PlatformType.SLOPE_RIGHT) {
      const width = scale * 400;
      const height = 80;
      const direction = type === PlatformType.SLOPE_LEFT ? "left" : "right";
      const biomeKey = this.getBiomeKey(
        Math.max(0, (WORLD.BASE_PLATFORM_Y - y) / WORLD.ALTITUDE_SCALE),
      );
      const biomeDef = BIOMES[biomeKey as keyof typeof BIOMES];
      this.slopeManager.createSlope(
        x - width / 2,
        y,
        width,
        height,
        direction,
        biomeDef?.platform ?? 0xffaa44,
      );
      return;
    }

    const def = PLATFORM_DEFS[type];

    if (type === PlatformType.MOVING) {
      const platform = this.movingPlatforms.create(x, y, "ground");
      platform.setScale(scale, 1);
      platform.setImmovable(true);
      platform.body.allowGravity = false;
      platform.setData("type", PlatformType.MOVING);
      platform.setTint(def.color);

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
      const platform = this.staticPlatforms.create(x, y, "ground");
      platform.setScale(scale, 1).refreshBody();
      platform.setData("type", type);
      platform.setTint(def.color);
    }
  }
}

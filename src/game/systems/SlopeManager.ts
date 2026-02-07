import Phaser from "phaser";
import { SLOPES } from "../config/GameConfig";

export interface SlopeData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angle: number;
  width: number;
  height: number;
  graphics: Phaser.GameObjects.Graphics;
}

export interface SlopeCollisionResult {
  surfaceY: number;
  angle: number;
  speedMod: number;
  slopeData: SlopeData;
  launchVector?: { x: number; y: number };
}

export class SlopeManager {
  private scene: Phaser.Scene;
  private slopes: SlopeData[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create a slope triangle.
   * direction='left' means the slope rises from left to right (low on left, high on right).
   * direction='right' means it rises from right to left (low on right, high on left).
   * x,y is the bottom-left corner of the bounding box.
   */
  createSlope(
    x: number,
    y: number,
    width: number,
    height: number,
    direction: "left" | "right",
    tint: number,
  ): SlopeData {
    const graphics = this.scene.add.graphics();
    graphics.setPosition(x, y - height);

    // Fill the triangle
    graphics.fillStyle(tint, 0.8);
    graphics.beginPath();

    if (direction === "left") {
      // Rises left-to-right: low-left corner, top-right corner, bottom-right corner
      graphics.moveTo(0, height);
      graphics.lineTo(width, 0);
      graphics.lineTo(width, height);
    } else {
      // Rises right-to-left: top-left corner, bottom-right corner, bottom-left corner
      graphics.moveTo(0, 0);
      graphics.lineTo(width, height);
      graphics.lineTo(0, height);
    }

    graphics.closePath();
    graphics.fillPath();

    // Stroke along the slope surface
    graphics.lineStyle(2, 0xffffff, 0.6);
    if (direction === "left") {
      graphics.lineBetween(0, height, width, 0);
    } else {
      graphics.lineBetween(0, 0, width, height);
    }

    // Slope line endpoints in world coordinates
    // x1,y1 = low end; x2,y2 = high end
    let x1: number, y1: number, x2: number, y2: number;

    if (direction === "left") {
      // Low on left, high on right
      x1 = x;
      y1 = y;
      x2 = x + width;
      y2 = y - height;
    } else {
      // Low on right, high on left
      x1 = x + width;
      y1 = y;
      x2 = x;
      y2 = y - height;
    }

    const angle = Math.atan2(y2 - y1, x2 - x1);

    const slopeData: SlopeData = {
      x1,
      y1,
      x2,
      y2,
      angle,
      width,
      height,
      graphics,
    };

    this.slopes.push(slopeData);
    return slopeData;
  }

  /**
   * Per-frame collision check. Returns result for the first slope the player is on, or null.
   */
  update(player: Phaser.Physics.Arcade.Sprite): SlopeCollisionResult | null {
    const playerX = player.x;
    const playerBottom = player.y + player.height / 2;
    const playerLeft = player.x - player.width / 2;
    const playerRight = player.x + player.width / 2;
    const velocityY = player.body?.velocity.y ?? 0;
    const velocityX = player.body?.velocity.x ?? 0;

    for (const slope of this.slopes) {
      // Determine the horizontal extent of the slope line (left to right in world space)
      const minX = Math.min(slope.x1, slope.x2);
      const maxX = Math.max(slope.x1, slope.x2);

      // Player center X must overlap the slope's horizontal range
      if (playerX < minX || playerX > maxX) {
        continue;
      }

      // Also require some body overlap (at least part of player sprite is over the slope)
      if (playerRight < minX || playerLeft > maxX) {
        continue;
      }

      // Interpolate the slope surface Y at the player's X position
      // Line from (x1,y1) to (x2,y2) — note these may not be left-to-right
      const t = (playerX - slope.x1) / (slope.x2 - slope.x1);
      const slopeY = slope.y1 + (slope.y2 - slope.y1) * t;

      // Check vertical proximity — player bottom near the slope surface
      const dist = playerBottom - slopeY;
      if (Math.abs(dist) > SLOPES.SNAP_TOLERANCE) {
        continue;
      }

      // Don't snap during strong upward movement (jumping through slope)
      if (velocityY < -50) {
        continue;
      }

      // Player is on this slope — compute speed modifier
      // Determine if the player is moving uphill or downhill.
      // The slope's "downhill" direction is from the high end (x2,y2) toward the low end (x1,y1).
      // downhill X direction: sign of (x1 - x2)
      const downhillDirX = Math.sign(slope.x1 - slope.x2);

      let speedMod: number;
      if (velocityX === 0) {
        speedMod = 1;
      } else if (Math.sign(velocityX) === downhillDirX) {
        speedMod = SLOPES.DOWNHILL_SPEED_MULT;
      } else {
        speedMod = SLOPES.UPHILL_SPEED_MULT;
      }

      // Compute launch vector for when player leaves the slope at speed
      let launchVector: { x: number; y: number } | undefined;
      const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      if (speed >= SLOPES.MIN_LAUNCH_SPEED) {
        // Launch along the slope's uphill normal direction
        const launchAngle = slope.angle - Math.PI / 2;
        launchVector = {
          x: Math.cos(launchAngle) * speed * SLOPES.LAUNCH_FORCE_MULT,
          y: Math.sin(launchAngle) * speed * SLOPES.LAUNCH_FORCE_MULT,
        };
      }

      return {
        surfaceY: slopeY,
        angle: slope.angle,
        speedMod,
        slopeData: slope,
        launchVector,
      };
    }

    return null;
  }

  /**
   * Remove slopes far below the player to free memory.
   */
  cleanup(playerY: number, buffer: number): void {
    for (let i = this.slopes.length - 1; i >= 0; i--) {
      const slope = this.slopes[i];
      // y1 is the low end (highest Y value = lowest on screen)
      if (slope.y1 > playerY + buffer) {
        slope.graphics.destroy();
        this.slopes.splice(i, 1);
      }
    }
  }
}

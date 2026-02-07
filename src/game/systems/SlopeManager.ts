import Phaser from "phaser";
import { SLOPES } from "../config/GameConfig";
import { CurveUtils, type CurvePoint } from "./CurveUtils";

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

export interface SlopeSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angle: number;
}

export interface CurvedSlopeData {
  segments: SlopeSegment[];
  graphics: Phaser.GameObjects.Graphics;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface SlopeCollisionResult {
  surfaceY: number;
  angle: number;
  speedMod: number;
  slopeData: SlopeData | CurvedSlopeData;
  launchVector?: { x: number; y: number };
}

export class SlopeManager {
  private scene: Phaser.Scene;
  private slopes: Array<SlopeData | CurvedSlopeData> = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private isCurvedSlope(
    slope: SlopeData | CurvedSlopeData,
  ): slope is CurvedSlopeData {
    return "segments" in slope;
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
      graphics.moveTo(0, height);
      graphics.lineTo(width, 0);
      graphics.lineTo(width, height);
    } else {
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
    let x1: number, y1: number, x2: number, y2: number;

    if (direction === "left") {
      x1 = x;
      y1 = y;
      x2 = x + width;
      y2 = y - height;
    } else {
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

  // ── Curved slope factories ──────────────────────────────────────────

  /**
   * Create a quarter-pipe ramp (90° arc from flat to steep).
   * direction='left' = ramp curves upward to the right.
   * direction='right' = ramp curves upward to the left.
   * x,y = bottom-left corner of bounding box.
   */
  createQuarterPipe(
    x: number,
    y: number,
    width: number,
    height: number,
    direction: "left" | "right",
    tint: number,
    segments: number = SLOPES.QUARTER_PIPE_SEGMENTS,
  ): CurvedSlopeData {
    // Fit a quarter-circle arc into the bounding box
    // For direction='left': arc center at top-left, sweeps from bottom to right
    // We use an elliptical approach: radius matches width and height independently
    let points: CurvePoint[];

    if (direction === "left") {
      // Arc center at (x, y - height). Arc goes from straight down (PI/2) to straight right (0)
      // But we need it to map to the bounding box, so use parametric arc with separate radii
      points = this.sampleEllipticalArc(
        x,
        y - height,
        width,
        height,
        Math.PI / 2,
        0,
        segments,
      );
    } else {
      // Arc center at (x + width, y - height). Arc goes from straight down (PI/2) to straight left (PI)
      points = this.sampleEllipticalArc(
        x + width,
        y - height,
        width,
        height,
        Math.PI / 2,
        Math.PI,
        segments,
      );
    }

    const slopeSegments = this.pointsToSegments(points);
    const bounds = this.computeBounds(points);
    const graphics = this.scene.add.graphics();
    this.drawCurvedSlope(graphics, points, y, tint);

    const curved: CurvedSlopeData = {
      segments: slopeSegments,
      graphics,
      bounds,
    };
    this.slopes.push(curved);
    return curved;
  }

  /**
   * Create a smooth hill (bezier arc from flat through peak back to flat).
   * x,y = bottom-left corner of bounding box.
   */
  createHill(
    x: number,
    y: number,
    width: number,
    height: number,
    tint: number,
    segments: number = SLOPES.HILL_SEGMENTS,
  ): CurvedSlopeData {
    // Quadratic bezier: start at bottom-left, control point above center, end at bottom-right
    const points = CurveUtils.sampleBezier(
      x,
      y,
      x + width / 2,
      y - height * 2, // control above — height*2 gives a nice rounded peak at ~height
      x + width,
      y,
      segments,
    );

    const slopeSegments = this.pointsToSegments(points);
    const bounds = this.computeBounds(points);
    const graphics = this.scene.add.graphics();
    this.drawCurvedSlope(graphics, points, y, tint);

    const curved: CurvedSlopeData = {
      segments: slopeSegments,
      graphics,
      bounds,
    };
    this.slopes.push(curved);
    return curved;
  }

  /**
   * Create a halfpipe (U-shape: left quarter-pipe + flat bottom + right quarter-pipe).
   * x,y = top-left corner of the opening. The bowl extends downward by depth.
   */
  createHalfPipe(
    x: number,
    y: number,
    width: number,
    depth: number,
    tint: number,
    segments: number = SLOPES.HALF_PIPE_SEGMENTS,
  ): CurvedSlopeData {
    const wallWidth = width * 0.3; // each curved wall takes 30% of total width
    const flatWidth = width - wallWidth * 2; // remaining 40% is flat bottom
    const halfSegs = Math.floor(segments / 2);

    // Left wall: arc from top-left opening down to bottom-left
    // Center at (x + wallWidth, y), radius = wallWidth (x) and depth (y)
    // Sweep from PI (left) to PI/2 (down)
    const leftPoints = this.sampleEllipticalArc(
      x + wallWidth,
      y,
      wallWidth,
      depth,
      Math.PI,
      Math.PI / 2,
      halfSegs,
    );

    // Flat bottom: from end of left wall to start of right wall
    const bottomLeft = leftPoints[leftPoints.length - 1];
    const bottomRightX = x + wallWidth + flatWidth;
    const flatBottom: CurvePoint = {
      x: bottomRightX,
      y: bottomLeft.y,
      angle: 0,
    };

    // Right wall: arc from bottom-right up to top-right opening
    // Center at (x + width - wallWidth, y), sweep from PI/2 (down) to 0 (right)
    const rightPoints = this.sampleEllipticalArc(
      x + width - wallWidth,
      y,
      wallWidth,
      depth,
      Math.PI / 2,
      0,
      halfSegs,
    );

    // Combine all points: left wall + flat bottom point + right wall
    const allPoints = [...leftPoints, flatBottom, ...rightPoints];
    const slopeSegments = this.pointsToSegments(allPoints);
    const bounds = this.computeBounds(allPoints);
    const graphics = this.scene.add.graphics();

    // For halfpipe, baseline is at the opening (y) — fill down to the curve
    this.drawCurvedSlope(graphics, allPoints, y, tint);

    const curved: CurvedSlopeData = {
      segments: slopeSegments,
      graphics,
      bounds,
    };
    this.slopes.push(curved);
    return curved;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /**
   * Sample an elliptical arc (allows different x and y radii).
   */
  private sampleEllipticalArc(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    startAngle: number,
    endAngle: number,
    segments: number,
  ): CurvePoint[] {
    const points: CurvePoint[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const theta = startAngle + (endAngle - startAngle) * t;
      const x = cx + rx * Math.cos(theta);
      const y = cy + ry * Math.sin(theta);
      // Tangent of elliptical arc: d/dθ (rx*cos(θ), ry*sin(θ)) = (-rx*sin(θ), ry*cos(θ))
      const dir = Math.sign(endAngle - startAngle);
      const dx = -rx * Math.sin(theta) * dir;
      const dy = ry * Math.cos(theta) * dir;
      const angle = Math.atan2(dy, dx);
      points.push({ x, y, angle });
    }
    return points;
  }

  private pointsToSegments(points: CurvePoint[]): SlopeSegment[] {
    const segments: SlopeSegment[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      segments.push({
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      });
    }
    return segments;
  }

  private computeBounds(points: CurvePoint[]): CurvedSlopeData["bounds"] {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY };
  }

  /**
   * Draw a curved slope: filled polygon from surface points down to baselineY, plus surface stroke.
   */
  private drawCurvedSlope(
    graphics: Phaser.GameObjects.Graphics,
    points: CurvePoint[],
    baselineY: number,
    tint: number,
  ): void {
    if (points.length < 2) return;

    // Filled polygon: surface curve + close to baseline
    graphics.fillStyle(tint, 0.8);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    // Close down to baseline and back
    graphics.lineTo(points[points.length - 1].x, baselineY);
    graphics.lineTo(points[0].x, baselineY);
    graphics.closePath();
    graphics.fillPath();

    // Stroke along surface only
    graphics.lineStyle(2, 0xffffff, 0.6);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.strokePath();
  }

  // ── Collision ───────────────────────────────────────────────────────

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
      if (this.isCurvedSlope(slope)) {
        const result = this.checkCurvedSlopeCollision(
          slope,
          playerX,
          playerBottom,
          playerLeft,
          playerRight,
          velocityX,
          velocityY,
        );
        if (result) return result;
      } else {
        const result = this.checkStraightSlopeCollision(
          slope,
          playerX,
          playerBottom,
          playerLeft,
          playerRight,
          velocityX,
          velocityY,
        );
        if (result) return result;
      }
    }

    return null;
  }

  private checkStraightSlopeCollision(
    slope: SlopeData,
    playerX: number,
    playerBottom: number,
    playerLeft: number,
    playerRight: number,
    velocityX: number,
    velocityY: number,
  ): SlopeCollisionResult | null {
    const minX = Math.min(slope.x1, slope.x2);
    const maxX = Math.max(slope.x1, slope.x2);

    if (playerX < minX || playerX > maxX) return null;
    if (playerRight < minX || playerLeft > maxX) return null;

    const t = (playerX - slope.x1) / (slope.x2 - slope.x1);
    const slopeY = slope.y1 + (slope.y2 - slope.y1) * t;
    const dist = playerBottom - slopeY;

    if (Math.abs(dist) > SLOPES.SNAP_TOLERANCE) return null;
    if (velocityY < -50) return null;

    const downhillDirX = Math.sign(slope.x1 - slope.x2);
    let speedMod: number;
    if (velocityX === 0) {
      speedMod = 1;
    } else if (Math.sign(velocityX) === downhillDirX) {
      speedMod = SLOPES.DOWNHILL_SPEED_MULT;
    } else {
      speedMod = SLOPES.UPHILL_SPEED_MULT;
    }

    let launchVector: { x: number; y: number } | undefined;
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    if (speed >= SLOPES.MIN_LAUNCH_SPEED) {
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

  private checkCurvedSlopeCollision(
    slope: CurvedSlopeData,
    playerX: number,
    playerBottom: number,
    playerLeft: number,
    playerRight: number,
    velocityX: number,
    velocityY: number,
  ): SlopeCollisionResult | null {
    // Fast bounds reject
    if (playerX < slope.bounds.minX || playerX > slope.bounds.maxX) return null;
    if (playerRight < slope.bounds.minX || playerLeft > slope.bounds.maxX)
      return null;

    // Don't snap during strong upward movement
    if (velocityY < -50) return null;

    // Find the segment the player is over and the closest surface Y
    let bestDist = Infinity;
    let bestSurfaceY = 0;
    let bestSegment: SlopeSegment | null = null;

    for (let i = 0; i < slope.segments.length; i++) {
      const seg = slope.segments[i];
      const segMinX = Math.min(seg.x1, seg.x2);
      const segMaxX = Math.max(seg.x1, seg.x2);

      // Player center X must be within this segment's horizontal range
      if (playerX < segMinX || playerX > segMaxX) continue;

      // Interpolate surface Y on this segment
      const dx = seg.x2 - seg.x1;
      if (Math.abs(dx) < 0.001) continue; // skip vertical segments
      const t = (playerX - seg.x1) / dx;
      const surfaceY = seg.y1 + (seg.y2 - seg.y1) * t;
      const dist = Math.abs(playerBottom - surfaceY);

      if (dist < bestDist) {
        bestDist = dist;
        bestSurfaceY = surfaceY;
        bestSegment = seg;
      }
    }

    if (!bestSegment || bestDist > SLOPES.SNAP_TOLERANCE) return null;

    // Speed modifier based on LOCAL segment angle
    // Downhill = moving toward the low end (highest Y value)
    const dy = bestSegment.y2 - bestSegment.y1;
    const downhillDirX =
      Math.abs(dy) < 0.001
        ? 0
        : dy > 0
          ? Math.sign(bestSegment.x2 - bestSegment.x1)
          : Math.sign(bestSegment.x1 - bestSegment.x2);

    let speedMod: number;
    if (velocityX === 0 || downhillDirX === 0) {
      speedMod = 1;
    } else if (Math.sign(velocityX) === downhillDirX) {
      speedMod = SLOPES.DOWNHILL_SPEED_MULT;
    } else {
      speedMod = SLOPES.UPHILL_SPEED_MULT;
    }

    // Launch vector: use the exit segment's tangent (last or first segment depending on direction)
    let launchVector: { x: number; y: number } | undefined;
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    if (speed >= SLOPES.MIN_LAUNCH_SPEED) {
      // Use the current segment's tangent for launch direction
      const launchAngle = bestSegment.angle - Math.PI / 2;
      launchVector = {
        x: Math.cos(launchAngle) * speed * SLOPES.LAUNCH_FORCE_MULT,
        y: Math.sin(launchAngle) * speed * SLOPES.LAUNCH_FORCE_MULT,
      };
    }

    return {
      surfaceY: bestSurfaceY,
      angle: bestSegment.angle,
      speedMod,
      slopeData: slope,
      launchVector,
    };
  }

  /**
   * Remove slopes far below the player to free memory.
   */
  cleanup(playerY: number, buffer: number): void {
    for (let i = this.slopes.length - 1; i >= 0; i--) {
      const slope = this.slopes[i];
      const lowestY = this.isCurvedSlope(slope) ? slope.bounds.maxY : slope.y1;

      if (lowestY > playerY + buffer) {
        slope.graphics.destroy();
        this.slopes.splice(i, 1);
      }
    }
  }
}

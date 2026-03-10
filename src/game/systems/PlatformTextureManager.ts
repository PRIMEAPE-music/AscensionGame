import Phaser from "phaser";
import { PlatformType, PLATFORM_DEFS } from "../config/PlatformTypes";

/** Biome base colors for procedural platform textures */
const BIOME_COLORS: Record<string, number> = {
  DEPTHS: 0x334455,
  CAVERNS: 0x553333,
  SPIRE: 0x335533,
  SUMMIT: 0x555577,
};

/** Darker variants for crack lines per biome */
const BIOME_CRACK_COLORS: Record<string, number> = {
  DEPTHS: 0x1a2233,
  CAVERNS: 0x331a1a,
  SPIRE: 0x1a331a,
  SUMMIT: 0x33334a,
};

/** Moss/lichen accent colors per biome */
const BIOME_MOSS_COLORS: Record<string, number> = {
  DEPTHS: 0x445566,
  CAVERNS: 0x664444,
  SPIRE: 0x44aa44,
  SUMMIT: 0x7777aa,
};

const MAX_CACHE_SIZE = 30;
const SIZE_BUCKET = 100;

export class PlatformTextureManager {
  private scene: Phaser.Scene;
  private textureCache: Map<string, string> = new Map();
  private cacheOrder: string[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Generate a procedural platform texture for the given biome and platform type.
   * Returns a Phaser texture key. Uses bucketed caching to maximize reuse.
   */
  generateTexture(
    biomeKey: string,
    platformType: string,
    width: number,
    height: number,
  ): string {
    // Bucket the width to nearest SIZE_BUCKET pixels for cache reuse
    const bucketedWidth = Math.max(
      SIZE_BUCKET,
      Math.round(width / SIZE_BUCKET) * SIZE_BUCKET,
    );

    const cacheKey = `plat_${biomeKey}_${platformType}_${bucketedWidth}x${height}`;

    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    // Evict oldest entry if cache is full
    if (this.textureCache.size >= MAX_CACHE_SIZE) {
      const oldest = this.cacheOrder.shift();
      if (oldest) {
        this.textureCache.delete(oldest);
        // Remove the texture from Phaser's texture manager to free memory
        if (this.scene.textures.exists(oldest)) {
          this.scene.textures.remove(oldest);
        }
      }
    }

    this.drawTexture(cacheKey, biomeKey, platformType, bucketedWidth, height);
    this.textureCache.set(cacheKey, cacheKey);
    this.cacheOrder.push(cacheKey);

    return cacheKey;
  }

  /**
   * Create a drop shadow rectangle beneath a platform sprite.
   * Depth is set to -0.5 so it renders between background and platforms.
   */
  createDropShadow(
    scene: Phaser.Scene,
    platform: Phaser.GameObjects.Sprite,
  ): Phaser.GameObjects.Rectangle {
    const w = platform.displayWidth;
    const h = platform.displayHeight;

    const shadow = scene.add.rectangle(
      platform.x,
      platform.y + 4,
      w,
      h,
      0x000000,
      0.25,
    );
    shadow.setDepth(-0.5);
    shadow.setOrigin(0.5, 0.5);

    return shadow;
  }

  // ----------------------------------------------------------------
  //  Private drawing helpers
  // ----------------------------------------------------------------

  private drawTexture(
    key: string,
    biomeKey: string,
    platformType: string,
    width: number,
    height: number,
  ): void {
    const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);

    const baseColor = BIOME_COLORS[biomeKey] ?? 0x444444;
    const crackColor = BIOME_CRACK_COLORS[biomeKey] ?? 0x222222;
    const mossColor = BIOME_MOSS_COLORS[biomeKey] ?? 0x448844;

    // 1. Base fill
    gfx.fillStyle(baseColor, 1);
    gfx.fillRect(0, 0, width, height);

    // 2. Random crack lines
    this.drawCracks(gfx, crackColor, width, height);

    // 3. Moss / lichen patches
    this.drawMossPatches(gfx, mossColor, width, height);

    // 4. Stone grain (subtle horizontal noise)
    this.drawStoneGrain(gfx, baseColor, width, height);

    // 5. Platform-type accent overlay
    this.drawTypeAccent(gfx, platformType, width, height);

    // 6. Top-lit edge highlight
    gfx.fillStyle(0xffffff, 0.4);
    gfx.fillRect(0, 0, width, 2);
    gfx.fillStyle(0xffffff, 0.2);
    gfx.fillRect(0, 2, width, 1);

    // 7. Darker bottom edge shadow
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillRect(0, height - 2, width, 2);
    gfx.fillStyle(0x000000, 0.15);
    gfx.fillRect(0, height - 3, width, 1);

    gfx.generateTexture(key, width, height);
    gfx.destroy();
  }

  private drawCracks(
    gfx: Phaser.GameObjects.Graphics,
    color: number,
    width: number,
    height: number,
  ): void {
    const crackCount = Math.floor(width / 60) + 2;
    gfx.lineStyle(1, color, 0.6);

    for (let i = 0; i < crackCount; i++) {
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      const endX = startX + (Math.random() - 0.5) * 60;
      const endY = startY + (Math.random() - 0.5) * height;

      gfx.beginPath();
      gfx.moveTo(startX, startY);
      // Jagged crack with a mid-point offset
      const midX = (startX + endX) / 2 + (Math.random() - 0.5) * 20;
      const midY = (startY + endY) / 2 + (Math.random() - 0.5) * 10;
      gfx.lineTo(midX, midY);
      gfx.lineTo(endX, endY);
      gfx.strokePath();
    }
  }

  private drawMossPatches(
    gfx: Phaser.GameObjects.Graphics,
    color: number,
    width: number,
    height: number,
  ): void {
    const patchCount = Math.floor(width / 80) + 1;

    for (let i = 0; i < patchCount; i++) {
      const px = Math.random() * width;
      const py = Math.random() * height;
      const radius = 2 + Math.random() * 4;
      const alpha = 0.15 + Math.random() * 0.2;

      gfx.fillStyle(color, alpha);
      gfx.fillCircle(px, py, radius);
    }
  }

  private drawStoneGrain(
    gfx: Phaser.GameObjects.Graphics,
    baseColor: number,
    width: number,
    height: number,
  ): void {
    // Subtle horizontal lines with slight brightness variation
    const lineCount = Math.floor(height / 4);

    for (let i = 0; i < lineCount; i++) {
      const y = 4 + i * 4 + Math.random() * 2;
      if (y >= height - 3) continue; // Avoid stomping bottom edge

      const brighten = Math.random() > 0.5;
      const alpha = 0.04 + Math.random() * 0.08;

      gfx.fillStyle(brighten ? 0xffffff : 0x000000, alpha);
      gfx.fillRect(0, y, width, 1);
    }
  }

  /**
   * Overlay a subtle accent tint from the platform type's defined color.
   * This keeps special platform types (ice, bounce, etc.) visually distinct
   * while the biome texture dominates.
   */
  private drawTypeAccent(
    gfx: Phaser.GameObjects.Graphics,
    platformType: string,
    width: number,
    height: number,
  ): void {
    const pType = platformType as PlatformType;
    const def = PLATFORM_DEFS[pType];
    if (!def) return;

    // Standard platforms don't need an accent — the biome texture is enough
    if (pType === PlatformType.STANDARD) return;

    const accentColor = def.color;

    // Semi-transparent overlay across the surface
    gfx.fillStyle(accentColor, 0.15);
    gfx.fillRect(0, 0, width, height);

    // Brighter accent strip along the top edge for readability
    gfx.fillStyle(accentColor, 0.35);
    gfx.fillRect(0, 0, width, 3);
  }
}

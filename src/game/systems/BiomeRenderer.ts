import Phaser from "phaser";
import { BIOMES, WORLD } from "../config/GameConfig";
import { EventBus } from "./EventBus";

interface BiomeInfo {
  name: string;
  key: string;
  platformTint: number;
  bgColor: number;
  maxAltitude: number;
  minAltitude: number;
}

const BIOME_ENTRIES = Object.entries(BIOMES) as [
  keyof typeof BIOMES,
  (typeof BIOMES)[keyof typeof BIOMES],
][];

function buildBiomeList(): BiomeInfo[] {
  let prevMax = 0;
  return BIOME_ENTRIES.map(([key, biome]) => {
    const info: BiomeInfo = {
      name: biome.name,
      key,
      platformTint: biome.platform,
      bgColor: biome.bg,
      maxAltitude: biome.maxAltitude,
      minAltitude: prevMax,
    };
    prevMax = biome.maxAltitude;
    return info;
  });
}

const BIOME_LIST = buildBiomeList();

export class BiomeRenderer {
  private scene: Phaser.Scene;
  private currentBiomeName: string = "DEPTHS";
  private bgLayer: Phaser.GameObjects.Rectangle;
  private midLayer: Phaser.GameObjects.Rectangle;
  private farLayer: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const w = WORLD.WIDTH * 2;
    const h = WORLD.HEIGHT * 3;
    const initialColor = BIOMES.DEPTHS.bg;

    this.farLayer = scene.add
      .rectangle(0, 0, w, h, initialColor)
      .setScrollFactor(0.05)
      .setDepth(-3)
      .setOrigin(0.5, 0.5);

    this.midLayer = scene.add
      .rectangle(0, 0, w, h, initialColor)
      .setScrollFactor(0.1)
      .setDepth(-2)
      .setAlpha(0.3)
      .setOrigin(0.5, 0.5);

    this.bgLayer = scene.add
      .rectangle(0, 0, w, h, initialColor)
      .setScrollFactor(0.2)
      .setDepth(-1)
      .setAlpha(0.2)
      .setOrigin(0.5, 0.5);
  }

  update(altitude: number, cameraY: number): void {
    const biome = this.getBiomeAt(altitude);

    if (biome.key !== this.currentBiomeName) {
      this.currentBiomeName = biome.key;
      EventBus.emit("biome-change", { biome: biome.name });
    }

    // Find current biome index for transition blending
    const idx = BIOME_LIST.findIndex((b) => b.key === biome.key);
    const current = BIOME_LIST[idx];
    const next = BIOME_LIST[Math.min(idx + 1, BIOME_LIST.length - 1)];

    // Calculate transition factor within the current biome range
    const range = current.maxAltitude - current.minAltitude;
    const t =
      isFinite(range) && range > 0
        ? Math.max(0, Math.min(1, (altitude - current.minAltitude) / range))
        : 0;

    const blended = this.lerpColor(current.bgColor, next.bgColor, t);

    this.farLayer.setFillStyle(blended);
    this.midLayer.setFillStyle(this.lightenColor(blended, 0.15));
    this.bgLayer.setFillStyle(this.darkenColor(blended, 0.1));

    // Keep layers centered on camera
    const cam = this.scene.cameras.main;
    const cx = cam.scrollX + cam.width * 0.5;
    const cy = cam.scrollY + cam.height * 0.5;

    this.farLayer.setPosition(cx, cy);
    this.midLayer.setPosition(cx, cy);
    this.bgLayer.setPosition(cx, cy);
  }

  getBiomeAt(altitude: number): BiomeInfo {
    for (const biome of BIOME_LIST) {
      if (altitude < biome.maxAltitude) {
        return biome;
      }
    }
    // Fallback to SUMMIT (maxAltitude is Infinity, so this is unreachable in practice)
    return BIOME_LIST[BIOME_LIST.length - 1];
  }

  private lerpColor(from: number, to: number, t: number): number {
    const clamped = Math.max(0, Math.min(1, t));

    const fromR = (from >> 16) & 0xff;
    const fromG = (from >> 8) & 0xff;
    const fromB = from & 0xff;

    const toR = (to >> 16) & 0xff;
    const toG = (to >> 8) & 0xff;
    const toB = to & 0xff;

    const r = Math.round(fromR + (toR - fromR) * clamped);
    const g = Math.round(fromG + (toG - fromG) * clamped);
    const b = Math.round(fromB + (toB - fromB) * clamped);

    return (r << 16) | (g << 8) | b;
  }

  private lightenColor(color: number, amount: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + Math.round(255 * amount));
    const g = Math.min(255, ((color >> 8) & 0xff) + Math.round(255 * amount));
    const b = Math.min(255, (color & 0xff) + Math.round(255 * amount));
    return (r << 16) | (g << 8) | b;
  }

  private darkenColor(color: number, amount: number): number {
    const r = Math.max(0, ((color >> 16) & 0xff) - Math.round(255 * amount));
    const g = Math.max(0, ((color >> 8) & 0xff) - Math.round(255 * amount));
    const b = Math.max(0, (color & 0xff) - Math.round(255 * amount));
    return (r << 16) | (g << 8) | b;
  }
}

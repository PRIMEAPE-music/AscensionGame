import Phaser from "phaser";
import { BIOMES, WORLD } from "../config/GameConfig";

interface BiomeInfo {
  key: string;
  maxAltitude: number;
  minAltitude: number;
  fogColor: number;
}

interface FogLayer {
  rect: Phaser.GameObjects.Rectangle;
  driftSpeed: number;
  driftAmplitude: number;
  baseAlpha: number;
}

/** Biome-specific fog colors */
const FOG_COLORS: Record<string, number> = {
  DEPTHS: 0x1a2244,
  CAVERNS: 0x442211,
  SPIRE: 0x224422,
  SUMMIT: 0xaabbcc,
};

const BIOME_ENTRIES = Object.entries(BIOMES) as [
  keyof typeof BIOMES,
  (typeof BIOMES)[keyof typeof BIOMES],
][];

function buildBiomeList(): BiomeInfo[] {
  let prevMax = 0;
  return BIOME_ENTRIES.map(([key, biome]) => {
    const info: BiomeInfo = {
      key,
      maxAltitude: biome.maxAltitude,
      minAltitude: prevMax,
      fogColor: FOG_COLORS[key] ?? 0x222222,
    };
    prevMax = biome.maxAltitude;
    return info;
  });
}

const BIOME_LIST = buildBiomeList();

export class AtmosphereManager {
  private scene: Phaser.Scene;
  private vignetteImage: Phaser.GameObjects.Image;
  private fogLayers: FogLayer[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // --- Vignette overlay (depth 1000) ---
    const canvas = document.createElement("canvas");
    canvas.width = WORLD.WIDTH;
    canvas.height = WORLD.HEIGHT;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 300, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, WORLD.WIDTH / 2);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.7, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    scene.textures.addCanvas("vignette", canvas);

    this.vignetteImage = scene.add
      .image(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, "vignette")
      .setScrollFactor(0)
      .setDepth(1000);

    // --- Fog / haze layers (depth 999) ---
    const fogConfigs = [
      { driftSpeed: 0.0003, driftAmplitude: 100, baseAlpha: 0.04 },
      { driftSpeed: 0.0005, driftAmplitude: 60, baseAlpha: 0.06 },
      { driftSpeed: 0.0008, driftAmplitude: 80, baseAlpha: 0.03 },
    ];

    for (const cfg of fogConfigs) {
      const rect = scene.add
        .rectangle(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 2400, 1200, FOG_COLORS.DEPTHS)
        .setScrollFactor(0)
        .setDepth(999)
        .setAlpha(cfg.baseAlpha);

      this.fogLayers.push({
        rect,
        driftSpeed: cfg.driftSpeed,
        driftAmplitude: cfg.driftAmplitude,
        baseAlpha: cfg.baseAlpha,
      });
    }
  }

  update(time: number, altitude: number): void {
    // Determine current and next biome for color blending
    const biome = this.getBiomeAt(altitude);
    const idx = BIOME_LIST.findIndex((b) => b.key === biome.key);
    if (idx === -1) return;
    const current = BIOME_LIST[idx];
    const next = BIOME_LIST[Math.min(idx + 1, BIOME_LIST.length - 1)];

    // Transition factor within the current biome range
    const range = current.maxAltitude - current.minAltitude;
    const t =
      isFinite(range) && range > 0
        ? Math.max(0, Math.min(1, (altitude - current.minAltitude) / range))
        : 0;

    const blendedFogColor = this.lerpColor(
      current.fogColor,
      next.fogColor,
      t,
    );

    // Update each fog layer
    for (const layer of this.fogLayers) {
      // Drift horizontally via sine wave
      layer.rect.x = WORLD.WIDTH / 2 + Math.sin(time * layer.driftSpeed) * layer.driftAmplitude;

      // Subtle alpha oscillation
      layer.rect.setAlpha(
        layer.baseAlpha + Math.sin(time * 0.001) * 0.01,
      );

      // Update fog color based on biome blend
      layer.rect.setFillStyle(blendedFogColor);
    }
  }

  setVignetteAlpha(alpha: number): void {
    this.vignetteImage.setAlpha(alpha);
  }

  destroy(): void {
    this.vignetteImage.destroy();
    for (const layer of this.fogLayers) {
      layer.rect.destroy();
    }
    this.fogLayers = [];
  }

  private getBiomeAt(altitude: number): BiomeInfo {
    for (const biome of BIOME_LIST) {
      if (altitude < biome.maxAltitude) {
        return biome;
      }
    }
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
}

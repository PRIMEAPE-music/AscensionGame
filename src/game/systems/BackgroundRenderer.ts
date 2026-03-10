import Phaser from "phaser";
import { BIOMES, WORLD } from "../config/GameConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BiomeGradient {
  topColor: number;
  bottomColor: number;
}

interface BiomeVisualConfig {
  gradient: BiomeGradient;
  sceneryType: "trees" | "mountains" | "rocky-trees" | "snowy-mountains";
  sceneryTint: number;
  sceneryAlpha: number;
  particleConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
}

interface BiomeRange {
  key: string;
  minAltitude: number;
  maxAltitude: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREEN_W = WORLD.WIDTH;
const SCREEN_H = WORLD.HEIGHT;
const GRADIENT_STRIPS = 24;
const MAX_PARTICLES = 200;

const BIOME_ENTRIES = Object.entries(BIOMES) as [
  keyof typeof BIOMES,
  (typeof BIOMES)[keyof typeof BIOMES],
][];

function buildBiomeRanges(): BiomeRange[] {
  let prevMax = 0;
  return BIOME_ENTRIES.map(([key, biome]) => {
    const range: BiomeRange = {
      key,
      minAltitude: prevMax,
      maxAltitude: biome.maxAltitude,
    };
    prevMax = biome.maxAltitude;
    return range;
  });
}

const BIOME_RANGES = buildBiomeRanges();

const BIOME_VISUALS: Record<string, BiomeVisualConfig> = {
  DEPTHS: {
    gradient: { topColor: 0x182848, bottomColor: 0x0c1428 },
    sceneryType: "trees",
    sceneryTint: 0x0a1520,
    sceneryAlpha: 0.6,
    particleConfig: {
      speed: { min: 15, max: 60 },
      angle: { min: -100, max: -80 },
      alpha: { min: 0.15, max: 0.5 },
      scale: { min: 0.3, max: 1.4 },
      lifespan: { min: 18000, max: 28000 },
      tint: [0xaabbcc, 0x8899bb, 0x6688aa],
      frequency: 300,
      maxParticles: MAX_PARTICLES,
      gravityY: -8,
      accelerationX: { min: -6, max: 6 },
    },
  },
  CAVERNS: {
    gradient: { topColor: 0x481818, bottomColor: 0x280c08 },
    sceneryType: "rocky-trees",
    sceneryTint: 0x1a0a08,
    sceneryAlpha: 0.6,
    particleConfig: {
      speed: { min: 20, max: 80 },
      angle: { min: -100, max: -80 },
      alpha: { min: 0.2, max: 0.7 },
      scale: { min: 0.2, max: 1.2 },
      lifespan: { min: 15000, max: 25000 },
      tint: [0xff6600, 0xff4400, 0xffaa22, 0xff8811],
      frequency: 250,
      maxParticles: MAX_PARTICLES,
      gravityY: -15,
      accelerationX: { min: -8, max: 8 },
    },
  },
  SPIRE: {
    gradient: { topColor: 0x184818, bottomColor: 0x0c280c },
    sceneryType: "trees",
    sceneryTint: 0x0a1a0a,
    sceneryAlpha: 0.55,
    particleConfig: {
      speed: { min: 15, max: 55 },
      angle: { min: -105, max: -75 },
      alpha: { min: 0.15, max: 0.45 },
      scale: { min: 0.3, max: 1.3 },
      lifespan: { min: 18000, max: 28000 },
      tint: [0x88aa44, 0x66cc33, 0xaacc66],
      frequency: 300,
      maxParticles: MAX_PARTICLES,
      gravityY: -6,
      accelerationX: { min: -10, max: 10 },
    },
  },
  SUMMIT: {
    gradient: { topColor: 0x383858, bottomColor: 0x202038 },
    sceneryType: "snowy-mountains",
    sceneryTint: 0x1a1a2a,
    sceneryAlpha: 0.55,
    particleConfig: {
      speed: { min: 12, max: 45 },
      angle: { min: -105, max: -75 },
      alpha: { min: 0.2, max: 0.6 },
      scale: { min: 0.2, max: 1.0 },
      lifespan: { min: 20000, max: 30000 },
      tint: [0xffffff, 0xddeeff, 0xbbccee],
      frequency: 280,
      maxParticles: MAX_PARTICLES,
      gravityY: -5,
      accelerationX: { min: -6, max: 6 },
    },
  },
};

// ---------------------------------------------------------------------------
// BackgroundRenderer
// ---------------------------------------------------------------------------

export class BackgroundRenderer {
  private scene: Phaser.Scene;

  // --- Gradient (A) ---
  private gradientGfx: Phaser.GameObjects.Graphics;

  // --- Scenery silhouettes (B) ---
  private sceneryLayers: Record<string, Phaser.GameObjects.Graphics> = {};
  private currentSceneryBiome: string = "";

  // --- Particles (C) ---
  private particleTexKey = "__bg_particle";
  private emitters: Record<
    string,
    Phaser.GameObjects.Particles.ParticleEmitter
  > = {};
  private currentParticleBiome: string = "";

  // --- Cache ---
  private prevTopColor: number = -1;
  private prevBotColor: number = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.generateParticleTexture();

    // --- A: Gradient (screen-fixed, full-screen fill) ---
    this.gradientGfx = scene.add.graphics();
    this.gradientGfx.setScrollFactor(0).setDepth(-4);
    this.drawGradient(
      BIOME_VISUALS.DEPTHS.gradient.topColor,
      BIOME_VISUALS.DEPTHS.gradient.bottomColor,
    );

    // --- B: Scenery silhouettes (screen-fixed, bottom of screen) ---
    for (const key of Object.keys(BIOME_VISUALS)) {
      const gfx = scene.add.graphics();
      gfx.setScrollFactor(0).setDepth(-1.5);
      gfx.setVisible(false);
      this.drawScenery(gfx, key);
      this.sceneryLayers[key] = gfx;
    }
    this.currentSceneryBiome = "DEPTHS";
    this.sceneryLayers["DEPTHS"].setVisible(true);

    // --- C: Particles (world-space, spawn at camera bottom, float up) ---
    for (const key of Object.keys(BIOME_VISUALS)) {
      const config = BIOME_VISUALS[key].particleConfig;
      const emitter = scene.add.particles(0, 0, this.particleTexKey, {
        ...config,
        x: { min: 0, max: SCREEN_W },
        y: { min: 0, max: 40 },
        emitting: false,
      });
      emitter.setDepth(-0.5);
      this.emitters[key] = emitter;
    }
    this.currentParticleBiome = "DEPTHS";
    this.emitters["DEPTHS"].start();
  }

  // =========================================================================
  // Public API
  // =========================================================================

  update(playerY: number, camera: Phaser.Cameras.Scene2D.Camera): void {
    const altitude = Math.max(
      0,
      (WORLD.BASE_PLATFORM_Y - playerY) / WORLD.ALTITUDE_SCALE,
    );
    const { biomeKey, t } = this.getBiomeAndTransition(altitude);

    this.updateGradient(biomeKey, t);
    this.updateScenery(biomeKey);
    this.updateParticles(biomeKey, camera);
  }

  // =========================================================================
  // Biome calculation
  // =========================================================================

  private getBiomeAndTransition(altitude: number): {
    biomeKey: string;
    t: number;
  } {
    let idx = 0;
    for (let i = 0; i < BIOME_RANGES.length; i++) {
      if (altitude < BIOME_RANGES[i].maxAltitude) {
        idx = i;
        break;
      }
      if (i === BIOME_RANGES.length - 1) idx = i;
    }
    const current = BIOME_RANGES[idx];
    const range = current.maxAltitude - current.minAltitude;
    const t =
      isFinite(range) && range > 0
        ? Math.max(0, Math.min(1, (altitude - current.minAltitude) / range))
        : 0;
    return { biomeKey: current.key, t };
  }

  // =========================================================================
  // A: Gradient
  // =========================================================================

  private updateGradient(biomeKey: string, t: number): void {
    const cur = BIOME_VISUALS[biomeKey];
    const foundIdx = BIOME_RANGES.findIndex((b) => b.key === biomeKey);
    if (foundIdx === -1) return;
    const nextIdx = Math.min(
      foundIdx + 1,
      BIOME_RANGES.length - 1,
    );
    const nxt = BIOME_VISUALS[BIOME_RANGES[nextIdx].key];

    const top = this.lerpColor(cur.gradient.topColor, nxt.gradient.topColor, t);
    const bot = this.lerpColor(
      cur.gradient.bottomColor,
      nxt.gradient.bottomColor,
      t,
    );

    if (top !== this.prevTopColor || bot !== this.prevBotColor) {
      this.prevTopColor = top;
      this.prevBotColor = bot;
      this.drawGradient(top, bot);
    }
  }

  private drawGradient(topColor: number, botColor: number): void {
    this.gradientGfx.clear();
    const stripH = Math.ceil(SCREEN_H / GRADIENT_STRIPS);
    for (let i = 0; i < GRADIENT_STRIPS; i++) {
      const t = i / (GRADIENT_STRIPS - 1);
      const color = this.lerpColor(topColor, botColor, t);
      this.gradientGfx.fillStyle(color, 1);
      this.gradientGfx.fillRect(0, i * stripH, SCREEN_W, stripH + 1);
    }
  }

  // =========================================================================
  // B: Scenery silhouettes (trees & mountains)
  // =========================================================================

  private drawScenery(gfx: Phaser.GameObjects.Graphics, biomeKey: string): void {
    const vis = BIOME_VISUALS[biomeKey];
    gfx.clear();

    const seed = this.hashString(biomeKey);
    let rng = seed;
    const rand = (): number => {
      rng = ((rng * 16807) % 2147483647) || 1;
      return (rng & 0x7fffffff) / 0x7fffffff;
    };

    switch (vis.sceneryType) {
      case "trees":
        this.drawTrees(gfx, rand, vis.sceneryTint, vis.sceneryAlpha);
        break;
      case "rocky-trees":
        this.drawRockyTrees(gfx, rand, vis.sceneryTint, vis.sceneryAlpha);
        break;
      case "mountains":
        this.drawMountains(gfx, rand, vis.sceneryTint, vis.sceneryAlpha, false);
        break;
      case "snowy-mountains":
        this.drawMountains(gfx, rand, vis.sceneryTint, vis.sceneryAlpha, true);
        break;
    }
  }

  private drawTrees(
    gfx: Phaser.GameObjects.Graphics,
    rand: () => number,
    tint: number,
    alpha: number,
  ): void {
    const bottom = SCREEN_H;

    // Far tree layer (smaller, dimmer)
    gfx.fillStyle(tint, alpha * 0.5);
    let x = 0;
    while (x < SCREEN_W) {
      const trunkW = 4 + rand() * 6;
      const trunkH = 40 + rand() * 60;
      const canopyW = 25 + rand() * 35;
      const canopyH = 30 + rand() * 50;

      gfx.fillRect(x + canopyW / 2 - trunkW / 2, bottom - trunkH, trunkW, trunkH);
      const cb = bottom - trunkH;
      gfx.beginPath();
      gfx.moveTo(x, cb);
      gfx.lineTo(x + canopyW / 2, cb - canopyH);
      gfx.lineTo(x + canopyW, cb);
      gfx.closePath();
      gfx.fillPath();

      x += 40 + rand() * 50;
    }

    // Near tree layer (larger, more opaque)
    gfx.fillStyle(tint, alpha);
    x = 10 + rand() * 30;
    while (x < SCREEN_W) {
      const trunkW = 8 + rand() * 14;
      const trunkH = 80 + rand() * 140;
      const canopyW = 50 + rand() * 70;
      const canopyH = 60 + rand() * 90;

      // Trunk
      gfx.fillRect(x + canopyW / 2 - trunkW / 2, bottom - trunkH, trunkW, trunkH);

      // Layered canopy (2-3 triangles stacked)
      const layers = 2 + Math.floor(rand() * 2);
      for (let l = 0; l < layers; l++) {
        const layerBase = bottom - trunkH - l * (canopyH * 0.35);
        const layerW = canopyW * (1 - l * 0.2);
        const layerH = canopyH * (0.6 + l * 0.15);
        const cx = x + canopyW / 2;

        gfx.beginPath();
        gfx.moveTo(cx - layerW / 2, layerBase);
        gfx.lineTo(cx, layerBase - layerH);
        gfx.lineTo(cx + layerW / 2, layerBase);
        gfx.closePath();
        gfx.fillPath();
      }

      x += 70 + rand() * 100;
    }
  }

  private drawRockyTrees(
    gfx: Phaser.GameObjects.Graphics,
    rand: () => number,
    tint: number,
    alpha: number,
  ): void {
    const bottom = SCREEN_H;

    // Jagged rock formations in the back
    gfx.fillStyle(tint, alpha * 0.5);
    let x = 0;
    while (x < SCREEN_W) {
      const w = 30 + rand() * 60;
      const h = 60 + rand() * 180;
      gfx.beginPath();
      gfx.moveTo(x, bottom);
      gfx.lineTo(x + w * 0.4, bottom - h);
      gfx.lineTo(x + w * 0.6, bottom - h * 0.7);
      gfx.lineTo(x + w, bottom);
      gfx.closePath();
      gfx.fillPath();
      x += 50 + rand() * 60;
    }

    // Dead/spiky trees in front
    gfx.fillStyle(tint, alpha);
    x = 20 + rand() * 40;
    while (x < SCREEN_W) {
      const trunkW = 6 + rand() * 10;
      const trunkH = 100 + rand() * 160;

      // Bare trunk
      gfx.fillRect(x, bottom - trunkH, trunkW, trunkH);

      // Sparse branches (angled lines)
      const branchCount = 2 + Math.floor(rand() * 3);
      for (let b = 0; b < branchCount; b++) {
        const by = bottom - trunkH * (0.3 + rand() * 0.5);
        const bLen = 15 + rand() * 30;
        const bDir = rand() > 0.5 ? 1 : -1;
        gfx.fillRect(x + trunkW / 2, by, bLen * bDir, 3);
      }

      x += 80 + rand() * 120;
    }
  }

  private drawMountains(
    gfx: Phaser.GameObjects.Graphics,
    rand: () => number,
    tint: number,
    alpha: number,
    snowy: boolean,
  ): void {
    const bottom = SCREEN_H;

    // Far mountain range (shorter, dimmer)
    gfx.fillStyle(tint, alpha * 0.5);
    gfx.beginPath();
    gfx.moveTo(0, bottom);
    let x = 0;
    while (x < SCREEN_W) {
      const peakH = 100 + rand() * 200;
      const peakW = 80 + rand() * 120;
      gfx.lineTo(x + peakW / 2, bottom - peakH);
      gfx.lineTo(x + peakW, bottom - 20 - rand() * 40);
      x += peakW;
    }
    gfx.lineTo(SCREEN_W, bottom);
    gfx.closePath();
    gfx.fillPath();

    // Near mountain range (taller, more opaque)
    gfx.fillStyle(tint, alpha);
    gfx.beginPath();
    gfx.moveTo(0, bottom);
    x = 0;
    const peaks: { x: number; y: number }[] = [];
    while (x < SCREEN_W) {
      const peakH = 200 + rand() * 350;
      const peakW = 120 + rand() * 200;
      const peakX = x + peakW / 2;
      const peakY = bottom - peakH;
      gfx.lineTo(peakX, peakY);
      peaks.push({ x: peakX, y: peakY });
      const valleyH = 30 + rand() * 60;
      gfx.lineTo(x + peakW, bottom - valleyH);
      x += peakW;
    }
    gfx.lineTo(SCREEN_W, bottom);
    gfx.closePath();
    gfx.fillPath();

    // Snow caps on the taller peaks
    if (snowy) {
      gfx.fillStyle(0xffffff, 0.2);
      for (const peak of peaks) {
        const capW = 30 + rand() * 40;
        const capH = 20 + rand() * 30;
        gfx.beginPath();
        gfx.moveTo(peak.x - capW / 2, peak.y + capH);
        gfx.lineTo(peak.x, peak.y);
        gfx.lineTo(peak.x + capW / 2, peak.y + capH);
        gfx.closePath();
        gfx.fillPath();
      }
    }
  }

  private updateScenery(biomeKey: string): void {
    if (biomeKey !== this.currentSceneryBiome) {
      if (this.sceneryLayers[this.currentSceneryBiome]) {
        this.sceneryLayers[this.currentSceneryBiome].setVisible(false);
      }
      if (this.sceneryLayers[biomeKey]) {
        this.sceneryLayers[biomeKey].setVisible(true);
      }
      this.currentSceneryBiome = biomeKey;
    }
  }

  // =========================================================================
  // C: Particles
  // =========================================================================

  private generateParticleTexture(): void {
    if (this.scene.textures.exists(this.particleTexKey)) return;
    const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(4, 4, 4);
    gfx.generateTexture(this.particleTexKey, 8, 8);
    gfx.destroy();
  }

  private updateParticles(
    biomeKey: string,
    camera: Phaser.Cameras.Scene2D.Camera,
  ): void {
    if (biomeKey !== this.currentParticleBiome) {
      if (this.emitters[this.currentParticleBiome]) {
        this.emitters[this.currentParticleBiome].stop();
      }
      if (this.emitters[biomeKey]) {
        this.emitters[biomeKey].start();
      }
      this.currentParticleBiome = biomeKey;
    }

    // Keep emitter at bottom edge of camera in world space
    const activeEmitter = this.emitters[biomeKey];
    if (activeEmitter) {
      activeEmitter.setPosition(camera.scrollX, camera.scrollY + SCREEN_H);
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private lerpColor(from: number, to: number, t: number): number {
    const c = Math.max(0, Math.min(1, t));
    const r1 = (from >> 16) & 0xff, g1 = (from >> 8) & 0xff, b1 = from & 0xff;
    const r2 = (to >> 16) & 0xff, g2 = (to >> 8) & 0xff, b2 = to & 0xff;
    return (
      (Math.round(r1 + (r2 - r1) * c) << 16) |
      (Math.round(g1 + (g2 - g1) * c) << 8) |
      Math.round(b1 + (b2 - b1) * c)
    );
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
    }
    return hash || 1;
  }

  destroy(): void {
    this.gradientGfx?.destroy();
    Object.values(this.sceneryLayers).forEach(layer => layer?.destroy());
    this.sceneryLayers = {};
    Object.values(this.emitters).forEach(emitter => emitter?.destroy());
    this.emitters = {};
    if (this.scene.textures.exists(this.particleTexKey)) {
      this.scene.textures.remove(this.particleTexKey);
    }
  }
}

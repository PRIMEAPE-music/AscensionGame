import Phaser from "phaser";
import { PlatformType } from "../config/PlatformTypes";

interface PlatformEffect {
  platform: Phaser.GameObjects.Sprite;
  type: string;
  graphics: Phaser.GameObjects.Graphics;
  trailX?: number; // for MOVING platforms
}

const EFFECT_TYPES = new Set<string>([
  PlatformType.BOUNCE,
  PlatformType.ICE,
  PlatformType.MOVING,
]);

export class PlatformEffectsManager {
  private scene: Phaser.Scene;
  private effects: Map<Phaser.GameObjects.Sprite, PlatformEffect> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  registerPlatform(platform: Phaser.GameObjects.Sprite, type: string): void {
    if (!EFFECT_TYPES.has(type)) {
      return;
    }

    // Don't register duplicates
    if (this.effects.has(platform)) {
      return;
    }

    const graphics = this.scene.add.graphics();
    const effect: PlatformEffect = { platform, type, graphics };

    if (type === PlatformType.MOVING) {
      effect.trailX = platform.x;
    }

    this.effects.set(platform, effect);
  }

  update(time: number, _delta: number): void {
    const camera = this.scene.cameras.main;
    const camTop = camera.scrollY - 200;
    const camBottom = camera.scrollY + camera.height + 200;

    this.effects.forEach((effect, key) => {
      const { platform } = effect;

      // Auto-cleanup destroyed or inactive platforms
      if (!platform.active) {
        effect.graphics.destroy();
        this.effects.delete(key);
        return;
      }

      // Only update effects within camera view + buffer
      if (platform.y < camTop || platform.y > camBottom) {
        effect.graphics.setVisible(false);
        return;
      }

      effect.graphics.setVisible(true);

      switch (effect.type) {
        case PlatformType.BOUNCE:
          this.updateBounceEffect(effect, time);
          break;
        case PlatformType.ICE:
          this.updateIceEffect(effect, time);
          break;
        case PlatformType.MOVING:
          this.updateMovingEffect(effect, time);
          break;
      }
    });
  }

  cleanup(platform: Phaser.GameObjects.Sprite): void {
    const effect = this.effects.get(platform);
    if (effect) {
      effect.graphics.destroy();
      this.effects.delete(platform);
    }
  }

  cleanupBelow(y: number): void {
    this.effects.forEach((effect, key) => {
      if (effect.platform.y > y) {
        effect.graphics.destroy();
        this.effects.delete(key);
      }
    });
  }

  private updateBounceEffect(effect: PlatformEffect, time: number): void {
    const { platform, graphics } = effect;
    const margin = 4;

    const width = platform.displayWidth + margin * 2;
    const height = platform.displayHeight + margin * 2;

    const alpha = Math.sin(time * 0.003) * 0.3 + 0.2;

    graphics.clear();
    graphics.fillStyle(0xff88ff, alpha);
    graphics.fillRect(
      platform.x - width / 2,
      platform.y - height / 2,
      width,
      height,
    );

    graphics.setDepth(platform.depth - 0.1);
  }

  private updateIceEffect(effect: PlatformEffect, time: number): void {
    const { platform, graphics } = effect;

    // Lerp between light blue (0x88ccff) and white (0xffffff)
    const t = (Math.sin(time * 0.004) + 1) / 2; // normalize to 0-1

    const r = Math.round(0x88 + (0xff - 0x88) * t);
    const g = Math.round(0xcc + (0xff - 0xcc) * t);
    const b = 0xff; // both colors have 0xff blue
    const color = (r << 16) | (g << 8) | b;

    const lineWidth = Math.sin(time * 0.002) * 1 + 2; // range 1-3
    const alpha = Math.sin(time * 0.003) * 0.15 + 0.65; // range 0.5-0.8

    const halfW = platform.displayWidth / 2;
    const halfH = platform.displayHeight / 2;

    graphics.clear();
    graphics.lineStyle(lineWidth, color, alpha);
    graphics.strokeRect(
      platform.x - halfW,
      platform.y - halfH,
      platform.displayWidth,
      platform.displayHeight,
    );

    graphics.setDepth(platform.depth + 0.1);
  }

  private updateMovingEffect(effect: PlatformEffect, _time: number): void {
    const { platform, graphics } = effect;

    // Lerp the trail position toward the platform
    if (effect.trailX === undefined) {
      effect.trailX = platform.x;
    }
    effect.trailX += (platform.x - effect.trailX) * 0.1;

    const trailX = effect.trailX;
    const platX = platform.x;

    // Determine the left and right edges of the motion smear
    const leftX = Math.min(trailX, platX);
    const rightX = Math.max(trailX, platX);

    // Only draw if there is some distance between trail and platform
    const smearWidth = rightX - leftX;
    if (smearWidth < 1) {
      graphics.clear();
      return;
    }

    const halfH = platform.displayHeight / 2;
    const alpha = 0.15 + Math.min(smearWidth / 200, 1) * 0.1; // 0.15-0.25

    graphics.clear();
    graphics.fillStyle(0x00ffff, alpha);
    graphics.fillRect(
      leftX - platform.displayWidth / 2,
      platform.y - halfH,
      smearWidth + platform.displayWidth,
      platform.displayHeight,
    );

    graphics.setDepth(platform.depth - 0.1);
  }
}

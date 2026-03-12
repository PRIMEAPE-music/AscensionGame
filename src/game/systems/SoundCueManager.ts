import { EventBus } from "./EventBus";
import { GameSettings } from "./GameSettings";

/**
 * Visual sound indicator system for deaf/hard-of-hearing players.
 * When enabled, shows on-screen visual cues for important audio events:
 * - Enemy nearby (off-screen): directional arrow
 * - Boss warning: large pulsing "!" in center
 * - Item drop nearby: sparkle indicator
 * - Low health warning: red screen edge pulse
 * - Portal nearby: directional indicator
 */

interface SoundCue {
  id: string;
  type: "directional" | "center" | "edge";
  label: string;
  color: string;
  sourceX?: number;
  sourceY?: number;
  alpha: number;
  fadeDirection: "in" | "out";
  lifetime: number;
  maxLifetime: number;
}

export const SoundCueManager = {
  _enabled: false,
  _cues: [] as SoundCue[],
  _cleanups: [] as (() => void)[],
  _graphics: null as Phaser.GameObjects.Graphics | null,
  _texts: [] as Phaser.GameObjects.Text[],
  _scene: null as Phaser.Scene | null,
  _lowHealth: false,
  _lowHealthPulse: 0,

  init(scene: Phaser.Scene): void {
    this._scene = scene;
    this._enabled = GameSettings.get().visualSoundCues;

    if (!this._enabled) return;

    this._graphics = scene.add.graphics();
    this._graphics.setDepth(999);
    this._graphics.setScrollFactor(0);

    this._subscribe();
  },

  _subscribe(): void {
    // Enemy killed (indicates enemies are nearby and active)
    this._cleanups.push(
      EventBus.on("enemy-killed", (data) => {
        if (!this._enabled) return;
        this._addCue({
          id: `enemy-${Date.now()}`,
          type: "directional",
          label: "!",
          color: "#ff4444",
          sourceX: data.x,
          sourceY: data.y,
          alpha: 0,
          fadeDirection: "in",
          lifetime: 0,
          maxLifetime: 1500,
        });
      })
    );

    // Boss warning
    this._cleanups.push(
      EventBus.on("boss-warning", () => {
        if (!this._enabled) return;
        this._addCue({
          id: "boss-warning",
          type: "center",
          label: "! BOSS !",
          color: "#ff2222",
          alpha: 0,
          fadeDirection: "in",
          lifetime: 0,
          maxLifetime: 3000,
        });
      })
    );

    // Boss spawn
    this._cleanups.push(
      EventBus.on("boss-spawn", (data) => {
        if (!this._enabled) return;
        this._addCue({
          id: "boss-spawn",
          type: "center",
          label: `!! ${data.name} !!`,
          color: "#ff0000",
          alpha: 0,
          fadeDirection: "in",
          lifetime: 0,
          maxLifetime: 4000,
        });
      })
    );

    // Item pickup (indicates items were nearby)
    this._cleanups.push(
      EventBus.on("item-pickup", () => {
        if (!this._enabled) return;
        this._addCue({
          id: `item-${Date.now()}`,
          type: "center",
          label: "* Item *",
          color: "#44ddff",
          alpha: 0,
          fadeDirection: "in",
          lifetime: 0,
          maxLifetime: 1000,
        });
      })
    );

    // Low health warning
    this._cleanups.push(
      EventBus.on("health-change", (data) => {
        if (!this._enabled) return;
        this._lowHealth = data.health <= 1 && data.health > 0;
      })
    );

    // Portal teleport
    this._cleanups.push(
      EventBus.on("portal-teleport", () => {
        if (!this._enabled) return;
        this._addCue({
          id: `portal-${Date.now()}`,
          type: "center",
          label: "~ Portal ~",
          color: "#9933ff",
          alpha: 0,
          fadeDirection: "in",
          lifetime: 0,
          maxLifetime: 2000,
        });
      })
    );

    // Hazard warning (directional)
    this._cleanups.push(
      EventBus.on("hazard-warning", (data) => {
        if (!this._enabled) return;
        this._addCue({
          id: `hazard-${Date.now()}`,
          type: "directional",
          label: "!!",
          color: "#ffaa00",
          sourceX: data.x,
          sourceY: data.y,
          alpha: 0,
          fadeDirection: "in",
          lifetime: 0,
          maxLifetime: 2000,
        });
      })
    );

    // Parry success
    this._cleanups.push(
      EventBus.on("parry-success", () => {
        if (!this._enabled) return;
        this._addCue({
          id: `parry-${Date.now()}`,
          type: "center",
          label: "PARRY!",
          color: "#ffdd44",
          alpha: 0,
          fadeDirection: "in",
          lifetime: 0,
          maxLifetime: 800,
        });
      })
    );

    // Dodge events
    this._cleanups.push(
      EventBus.on("player-dodge", (data) => {
        if (!this._enabled) return;
        if (data.perfect) {
          this._addCue({
            id: `dodge-${Date.now()}`,
            type: "center",
            label: "PERFECT!",
            color: "#44ff88",
            alpha: 0,
            fadeDirection: "in",
            lifetime: 0,
            maxLifetime: 1000,
          });
        }
      })
    );
  },

  _addCue(cue: SoundCue): void {
    // Remove duplicate cues by id prefix (e.g., don't stack multiple boss warnings)
    const prefix = cue.id.replace(/-\d+$/, "");
    this._cues = this._cues.filter(
      (c) => !c.id.replace(/-\d+$/, "").startsWith(prefix) || c.fadeDirection === "out"
    );
    this._cues.push(cue);

    // Cap max cues
    if (this._cues.length > 8) {
      this._cues = this._cues.slice(-8);
    }
  },

  update(playerX: number, playerY: number, delta: number): void {
    if (!this._enabled || !this._graphics || !this._scene) return;

    this._graphics.clear();

    const cam = this._scene.cameras.main;
    const screenW = cam.width;
    const screenH = cam.height;

    // Low health edge pulse
    if (this._lowHealth) {
      this._lowHealthPulse += delta * 0.003;
      const pulseAlpha = 0.15 + Math.sin(this._lowHealthPulse) * 0.1;
      this._graphics.fillStyle(0xff0000, pulseAlpha);
      // Top edge
      this._graphics.fillRect(0, 0, screenW, 8);
      // Bottom edge
      this._graphics.fillRect(0, screenH - 8, screenW, 8);
      // Left edge
      this._graphics.fillRect(0, 0, 8, screenH);
      // Right edge
      this._graphics.fillRect(screenW - 8, 0, 8, screenH);
    } else {
      this._lowHealthPulse = 0;
    }

    // Clean up old text objects
    for (const text of this._texts) {
      text.destroy();
    }
    this._texts = [];

    // Update and render cues
    const activeCues: SoundCue[] = [];

    for (const cue of this._cues) {
      cue.lifetime += delta;

      // Fade in/out
      if (cue.fadeDirection === "in") {
        cue.alpha = Math.min(1, cue.alpha + delta * 0.004);
        if (cue.alpha >= 1) cue.fadeDirection = "out";
      }

      // Start fading out at 70% of lifetime
      if (cue.lifetime > cue.maxLifetime * 0.7) {
        cue.fadeDirection = "out";
        const fadeProgress =
          (cue.lifetime - cue.maxLifetime * 0.7) / (cue.maxLifetime * 0.3);
        cue.alpha = Math.max(0, 1 - fadeProgress);
      }

      if (cue.lifetime >= cue.maxLifetime) continue;

      activeCues.push(cue);

      if (cue.type === "center") {
        // Render centered text
        const pulse = 1 + Math.sin(cue.lifetime * 0.008) * 0.15;
        const fontSize = Math.round(24 * pulse);
        const text = this._scene!.add.text(screenW / 2, 80, cue.label, {
          fontSize: `${fontSize}px`,
          fontFamily: "monospace",
          color: cue.color,
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 3,
          align: "center",
        });
        text.setOrigin(0.5, 0.5);
        text.setAlpha(cue.alpha);
        text.setScrollFactor(0);
        text.setDepth(1000);
        this._texts.push(text);
      } else if (cue.type === "directional" && cue.sourceX !== undefined && cue.sourceY !== undefined) {
        // Calculate direction from player to source
        const dx = cue.sourceX - playerX;
        const dy = cue.sourceY - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 50) continue; // Too close, skip

        const angle = Math.atan2(dy, dx);

        // Position indicator at screen edge
        const margin = 40;
        const centerX = screenW / 2;
        const centerY = screenH / 2;

        // Calculate edge position
        const edgeX = centerX + Math.cos(angle) * (screenW / 2 - margin);
        const edgeY = centerY + Math.sin(angle) * (screenH / 2 - margin);

        // Clamp to screen bounds
        const x = Math.max(margin, Math.min(screenW - margin, edgeX));
        const y = Math.max(margin, Math.min(screenH - margin, edgeY));

        // Draw arrow
        const colorNum = parseInt(cue.color.replace("#", ""), 16);
        this._graphics.fillStyle(colorNum, cue.alpha);
        // Triangle pointing toward source
        const arrowSize = 12;
        this._graphics.fillTriangle(
          x + Math.cos(angle) * arrowSize,
          y + Math.sin(angle) * arrowSize,
          x + Math.cos(angle + 2.4) * arrowSize,
          y + Math.sin(angle + 2.4) * arrowSize,
          x + Math.cos(angle - 2.4) * arrowSize,
          y + Math.sin(angle - 2.4) * arrowSize
        );

        // Label near the arrow
        const text = this._scene!.add.text(x, y - 18, cue.label, {
          fontSize: "12px",
          fontFamily: "monospace",
          color: cue.color,
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 2,
          align: "center",
        });
        text.setOrigin(0.5, 0.5);
        text.setAlpha(cue.alpha);
        text.setScrollFactor(0);
        text.setDepth(1000);
        this._texts.push(text);
      }
    }

    this._cues = activeCues;
  },

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) {
      // Clear all cues and graphics
      this._cues = [];
      if (this._graphics) {
        this._graphics.clear();
      }
      for (const text of this._texts) {
        text.destroy();
      }
      this._texts = [];
      this._lowHealth = false;
    } else if (this._scene && !this._graphics) {
      this._graphics = this._scene.add.graphics();
      this._graphics.setDepth(999);
      this._graphics.setScrollFactor(0);
      this._subscribe();
    }
  },

  destroy(): void {
    for (const cleanup of this._cleanups) {
      cleanup();
    }
    this._cleanups = [];
    this._cues = [];
    if (this._graphics) {
      this._graphics.destroy();
      this._graphics = null;
    }
    for (const text of this._texts) {
      text.destroy();
    }
    this._texts = [];
    this._scene = null;
    this._lowHealth = false;
    this._lowHealthPulse = 0;
  },
};

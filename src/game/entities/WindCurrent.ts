import Phaser from "phaser";
import { EventBus } from "../systems/EventBus";

export type WindType = "updraft" | "downdraft" | "crosswind";

// Visual configuration per wind type
const WIND_VISUALS: Record<
  WindType,
  { color: number; particleColor: number; alpha: number }
> = {
  updraft: { color: 0x88ccff, particleColor: 0xaaddff, alpha: 0.05 },
  downdraft: { color: 0x555566, particleColor: 0x888899, alpha: 0.05 },
  crosswind: { color: 0xccccdd, particleColor: 0xddddee, alpha: 0.05 },
};

const PARTICLE_COUNT = 8;
const PARTICLE_SPEED = 120; // px/s base speed for particle streaks

export class WindCurrent extends Phaser.GameObjects.Rectangle {
  public windType: WindType;
  public strength: number;
  public direction: { x: number; y: number };
  public isPeriodic: boolean;
  public periodOn: number; // ms on duration
  public periodOff: number; // ms off duration

  private _isActive: boolean = true;
  private periodicTimer: number = 0;
  private particles: Phaser.GameObjects.Rectangle[] = [];
  private particlePositions: { x: number; y: number }[] = [];
  private zoneWidth: number;
  private zoneHeight: number;
  private playerInZone: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    windType: WindType,
    strength: number,
    isPeriodic: boolean = false,
  ) {
    const visual = WIND_VISUALS[windType];
    super(scene, x, y, width, height, visual.color, visual.alpha);

    this.windType = windType;
    this.strength = strength;
    this.zoneWidth = width;
    this.zoneHeight = height;
    this.isPeriodic = isPeriodic;
    this.periodOn = 2000;
    this.periodOff = 2000;

    // Set direction based on wind type
    switch (windType) {
      case "updraft":
        this.direction = { x: 0, y: -1 };
        break;
      case "downdraft":
        this.direction = { x: 0, y: 1 };
        break;
      case "crosswind":
        // Random left or right
        this.direction = { x: Math.random() > 0.5 ? 1 : -1, y: 0 };
        break;
    }

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    // Configure the static physics body to match the rectangle
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(width, height);
    body.setOffset(0, 0);

    this.setOrigin(0.5, 0.5);
    this.setDepth(10);

    // Create particle streaks
    this.createParticles();
  }

  /** Apply wind force to a player body. Called from overlap callback. */
  applyForce(
    playerBody: Phaser.Physics.Arcade.Body,
    delta: number,
  ): void {
    if (!this._isActive) return;

    const dt = delta / 1000;
    const forceX = this.direction.x * this.strength * dt;
    const forceY = this.direction.y * this.strength * dt;

    playerBody.velocity.x += forceX;
    playerBody.velocity.y += forceY;

    // Emit enter event once
    if (!this.playerInZone) {
      this.playerInZone = true;
      EventBus.emit("wind-zone-enter", {
        windType: this.windType,
        strength: this.strength,
      });
    }
  }

  /** Call when player leaves the zone (no overlap this frame). */
  clearPlayerInZone(): void {
    if (this.playerInZone) {
      this.playerInZone = false;
      EventBus.emit("wind-zone-exit", {});
    }
  }

  /** Whether the wind zone is currently active (for periodic zones). */
  get isActive(): boolean {
    return this._isActive;
  }

  update(delta: number): void {
    // Handle periodic on/off toggling
    if (this.isPeriodic) {
      this.periodicTimer += delta;
      const cycleDuration = this.periodOn + this.periodOff;
      const phase = this.periodicTimer % cycleDuration;
      const wasActive = this._isActive;
      this._isActive = phase < this.periodOn;

      // If toggling off while player is inside, emit exit
      if (wasActive && !this._isActive && this.playerInZone) {
        this.playerInZone = false;
        EventBus.emit("wind-zone-exit", {});
      }

      // Update visual alpha based on active state
      const visual = WIND_VISUALS[this.windType];
      this.setAlpha(this._isActive ? visual.alpha : visual.alpha * 0.2);

      // Hide particles when inactive
      for (const p of this.particles) {
        p.setVisible(this._isActive);
      }
    }

    // Animate particles
    if (this._isActive) {
      this.updateParticles(delta);
    }
  }

  // ─── Particle System ──────────────────────────────────────────────

  private createParticles(): void {
    const visual = WIND_VISUALS[this.windType];
    const halfW = this.zoneWidth / 2;
    const halfH = this.zoneHeight / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Random starting position within the zone
      const px = Phaser.Math.FloatBetween(-halfW, halfW);
      const py = Phaser.Math.FloatBetween(-halfH, halfH);

      // Create a small rectangle streak particle
      const streakLength =
        this.windType === "crosswind"
          ? Phaser.Math.Between(8, 20)
          : Phaser.Math.Between(4, 12);
      const streakWidth = this.windType === "crosswind" ? 2 : 2;

      const particle = this.scene.add.rectangle(
        this.x + px,
        this.y + py,
        this.windType === "crosswind" ? streakLength : streakWidth,
        this.windType === "crosswind" ? streakWidth : streakLength,
        visual.particleColor,
        Phaser.Math.FloatBetween(0.15, 0.4),
      );
      particle.setDepth(11);

      this.particles.push(particle);
      this.particlePositions.push({ x: px, y: py });
    }
  }

  private updateParticles(delta: number): void {
    const dt = delta / 1000;
    const halfW = this.zoneWidth / 2;
    const halfH = this.zoneHeight / 2;
    const speed = PARTICLE_SPEED + this.strength * 0.3;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;

      const pos = this.particlePositions[i];

      // Move particle in wind direction
      pos.x += this.direction.x * speed * dt;
      pos.y += this.direction.y * speed * dt;

      // Wrap around when particle exits zone bounds
      if (pos.x > halfW) pos.x = -halfW;
      if (pos.x < -halfW) pos.x = halfW;
      if (pos.y > halfH) pos.y = -halfH;
      if (pos.y < -halfH) pos.y = halfH;

      particle.setPosition(this.x + pos.x, this.y + pos.y);

      // Vary alpha for shimmer
      const shimmer =
        0.15 + 0.25 * Math.abs(Math.sin((pos.x + pos.y) * 0.02 + delta * 0.001));
      particle.setAlpha(shimmer);
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  destroy(fromScene?: boolean): void {
    for (const particle of this.particles) {
      particle.destroy();
    }
    this.particles = [];
    this.particlePositions = [];
    super.destroy(fromScene);
  }
}

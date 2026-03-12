import Phaser from "phaser";
import { EventBus } from "../systems/EventBus";
import { WORLD } from "../config/GameConfig";
import { GameSettings } from "../systems/GameSettings";
import type { Player } from "./Player";

const PORTAL_SIZE = 48;
const COOLDOWN_DURATION = 2000; // ms
const PARTICLE_COUNT = 12;

export type PortalType = "blue" | "orange";

let portalIdCounter = 0;

export class PortalPlatform extends Phaser.Physics.Arcade.Sprite {
  public portalId: string;
  public linkedPortalId: string;
  public portalType: PortalType;
  public cooldownTimer: number = 0;

  private linkedPortal: PortalPlatform | null = null;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private rotationTween: Phaser.Tweens.Tween | null = null;
  private innerGlow: Phaser.GameObjects.Arc | null = null;
  private outerRing: Phaser.GameObjects.Arc | null = null;
  private particles: Phaser.GameObjects.Arc[] = [];
  private particleAngles: number[] = [];
  private particleDistances: number[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    portalType: PortalType,
    portalId?: string,
    linkedPortalId?: string,
  ) {
    // Generate or use a simple texture for the portal
    const texKey = `portal_${portalType}_tex`;
    if (!scene.textures.exists(texKey)) {
      const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
      const color = portalType === "blue" ? 0x4488ff : 0xff8844;
      // Outer ring
      gfx.lineStyle(3, color, 0.8);
      gfx.strokeCircle(PORTAL_SIZE / 2, PORTAL_SIZE / 2, PORTAL_SIZE / 2 - 2);
      // Inner fill
      gfx.fillStyle(color, 0.3);
      gfx.fillCircle(PORTAL_SIZE / 2, PORTAL_SIZE / 2, PORTAL_SIZE / 2 - 6);
      // Center bright dot
      gfx.fillStyle(0xffffff, 0.6);
      gfx.fillCircle(PORTAL_SIZE / 2, PORTAL_SIZE / 2, 6);
      gfx.generateTexture(texKey, PORTAL_SIZE, PORTAL_SIZE);
      gfx.destroy();
    }

    super(scene, x, y, texKey);

    this.portalType = portalType;
    this.portalId = portalId ?? `portal_${portalIdCounter++}`;
    this.linkedPortalId = linkedPortalId ?? "";

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Configure physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setCircle(PORTAL_SIZE / 2);

    // Set depth so portals render above platforms but below UI
    this.setDepth(45);

    // Apply tint
    const tintColor = portalType === "blue" ? 0x4488ff : 0xff8844;
    this.setTint(tintColor);

    // Create visual effects
    this.createVisualEffects();
    this.startAnimations();
  }

  setLinkedPortal(portal: PortalPlatform): void {
    this.linkedPortal = portal;
    this.linkedPortalId = portal.portalId;
  }

  getLinkedPortal(): PortalPlatform | null {
    return this.linkedPortal;
  }

  teleportPlayer(player: Player): void {
    if (this.cooldownTimer > 0) return;
    if (!this.linkedPortal || !this.linkedPortal.active) return;

    // Put both portals on cooldown
    this.cooldownTimer = COOLDOWN_DURATION;
    this.linkedPortal.cooldownTimer = COOLDOWN_DURATION;

    // Calculate altitudes for the event
    const fromAltitude = Math.max(
      0,
      (WORLD.BASE_PLATFORM_Y - player.y) / WORLD.ALTITUDE_SCALE,
    );
    const toAltitude = Math.max(
      0,
      (WORLD.BASE_PLATFORM_Y - this.linkedPortal.y) / WORLD.ALTITUDE_SCALE,
    );

    // Teleport flash at entry point
    this.emitTeleportEffect(this.x, this.y, "entry");

    // Move player to exit portal position
    player.setPosition(this.linkedPortal.x, this.linkedPortal.y - 30);
    player.setVelocity(0, -100); // Small upward nudge so player doesn't fall through

    // Teleport flash at exit point
    this.emitTeleportEffect(this.linkedPortal.x, this.linkedPortal.y, "exit");

    // Camera shake
    this.scene.cameras.main.shake(1500, 0.001);

    // Emit teleport event
    EventBus.emit("portal-teleport", { fromAltitude, toAltitude });

    // Visual feedback: dim the entry portal briefly
    this.setAlpha(0.4);
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: COOLDOWN_DURATION,
      ease: "Sine.easeIn",
    });
  }

  update(delta: number): void {
    // Update cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - delta);
    }

    // Animate particles (orbit around the portal)
    this.updateParticles(delta);
  }

  // ─── Visual Effects ──────────────────────────────────────────────────

  private createVisualEffects(): void {
    const color = this.portalType === "blue" ? 0x4488ff : 0xff8844;

    // Outer rotating ring
    this.outerRing = this.scene.add.circle(this.x, this.y, PORTAL_SIZE / 2 + 4, color, 0.15);
    this.outerRing.setStrokeStyle(2, color, 0.5);
    this.outerRing.setDepth(44);

    // Inner glow
    this.innerGlow = this.scene.add.circle(this.x, this.y, PORTAL_SIZE / 4, 0xffffff, 0.2);
    this.innerGlow.setDepth(46);

    // Create orbiting particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const dist = PORTAL_SIZE / 2 + Phaser.Math.Between(2, 12);
      const px = this.x + Math.cos(angle) * dist;
      const py = this.y + Math.sin(angle) * dist;
      const size = Phaser.Math.Between(1, 3);

      const particle = this.scene.add.circle(px, py, size, color, Phaser.Math.FloatBetween(0.3, 0.8));
      particle.setDepth(47);
      this.particles.push(particle);
      this.particleAngles.push(angle);
      this.particleDistances.push(dist);
    }
  }

  private startAnimations(): void {
    // Scale pulsing (throb effect)
    this.pulseTween = this.scene.tweens.add({
      targets: this,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Inner glow pulsing
    if (this.innerGlow) {
      this.scene.tweens.add({
        targets: this.innerGlow,
        alpha: 0.5,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Outer ring rotation via manual angle tween
    if (this.outerRing) {
      this.rotationTween = this.scene.tweens.add({
        targets: this.outerRing,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private updateParticles(delta: number): void {
    const speed = this.portalType === "blue" ? 1.5 : -1.5; // blue: CCW pull-in, orange: CW push-out
    const dt = delta / 1000;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;

      // Rotate angle
      this.particleAngles[i] += speed * dt;

      // Oscillate distance for pull/push effect
      const baseDistance = this.particleDistances[i];
      const oscillation = Math.sin(this.particleAngles[i] * 3) * 4;
      const dist = baseDistance + oscillation;

      particle.x = this.x + Math.cos(this.particleAngles[i]) * dist;
      particle.y = this.y + Math.sin(this.particleAngles[i]) * dist;

      // Vary alpha for shimmer
      particle.setAlpha(0.3 + 0.5 * Math.abs(Math.sin(this.particleAngles[i] * 2)));
    }

    // Update glow/ring positions to follow portal
    if (this.outerRing) {
      this.outerRing.setPosition(this.x, this.y);
    }
    if (this.innerGlow) {
      this.innerGlow.setPosition(this.x, this.y);
    }
  }

  private emitTeleportEffect(x: number, y: number, type: "entry" | "exit"): void {
    const color = this.portalType === "blue" ? 0x4488ff : 0xff8844;
    const flashReduction = GameSettings.get().flashReduction;

    // Screen flash at teleport point
    const flash = this.scene.add.rectangle(
      x,
      y,
      WORLD.WIDTH * 2,
      this.scene.cameras.main.height * 2,
      color,
      flashReduction ? 0.08 : 0.3,
    );
    flash.setScrollFactor(0);
    flash.setDepth(200);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: flashReduction ? 150 : 400,
      onComplete: () => flash.destroy(),
    });

    // Particle burst
    const burstCount = 8;
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2;
      const speed = type === "entry" ? -80 : 120; // inward for entry, outward for exit
      const px = x + Math.cos(angle) * 10;
      const py = y + Math.sin(angle) * 10;

      const dot = this.scene.add.circle(px, py, 3, color, 0.9);
      dot.setDepth(201);

      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * (speed > 0 ? 60 : 5),
        y: y + Math.sin(angle) * (speed > 0 ? 60 : 5),
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 500,
        ease: "Quad.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  destroy(fromScene?: boolean): void {
    if (this.pulseTween) this.pulseTween.stop();
    if (this.rotationTween) this.rotationTween.stop();
    if (this.outerRing) this.outerRing.destroy();
    if (this.innerGlow) this.innerGlow.destroy();

    for (const particle of this.particles) {
      particle.destroy();
    }
    this.particles = [];
    this.particleAngles = [];
    this.particleDistances = [];

    super.destroy(fromScene);
  }
}

import Phaser from "phaser";
import { SPRITE_CONFIG } from "../config/AnimationConfig";

/**
 * Biome-specific dust tint colours, keyed by biome name.
 * Falls back to a neutral brown if the biome is unknown.
 */
const BIOME_DUST_TINTS: Record<string, number> = {
  DEPTHS: 0x556677, // cool slate
  CAVERNS: 0x8b5533, // warm rust
  SPIRE: 0x6b8b55, // mossy green
  SUMMIT: 0x9999bb, // pale violet-grey
};

const DEFAULT_DUST_TINT = 0x8b7355;

export class ParticleManager {
  private scene: Phaser.Scene;

  // Emitters (one per effect type)
  private landingEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private runningEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private jumpEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private crumbleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bounceEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  // State tracking
  private wasAirborne: boolean = false;
  private runTrailTimer: number = 0;

  /** Interval (ms) between running-trail particle bursts. */
  private static readonly RUN_TRAIL_INTERVAL = 100;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.init();
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  private init(): void {
    this.generateTextures();
    this.createEmitters();
  }

  /**
   * Generates tiny procedural textures used by every particle effect.
   * Each texture is a white shape so we can tint it at runtime.
   */
  private generateTextures(): void {
    // particle_circle — 4x4 filled circle
    if (!this.scene.textures.exists("particle_circle")) {
      const gCircle = this.scene.make.graphics({ x: 0, y: 0 }, false);
      gCircle.fillStyle(0xffffff);
      gCircle.fillCircle(2, 2, 2);
      gCircle.generateTexture("particle_circle", 4, 4);
      gCircle.destroy();
    }

    // particle_square — 4x4 filled square
    if (!this.scene.textures.exists("particle_square")) {
      const gSquare = this.scene.make.graphics({ x: 0, y: 0 }, false);
      gSquare.fillStyle(0xffffff);
      gSquare.fillRect(0, 0, 4, 4);
      gSquare.generateTexture("particle_square", 4, 4);
      gSquare.destroy();
    }

    // particle_shard — 6x3 filled rectangle (debris look)
    if (!this.scene.textures.exists("particle_shard")) {
      const gShard = this.scene.make.graphics({ x: 0, y: 0 }, false);
      gShard.fillStyle(0xffffff);
      gShard.fillRect(0, 0, 6, 3);
      gShard.generateTexture("particle_shard", 6, 3);
      gShard.destroy();
    }
  }

  /**
   * Creates one emitter per effect type. All start with `emitting: false` so
   * they only fire when explicitly triggered.
   */
  private createEmitters(): void {
    // Landing dust puff
    this.landingEmitter = this.scene.add.particles(0, 0, "particle_circle", {
      speed: { min: 30, max: 80 },
      angle: { min: -160, max: -20 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 400,
      gravityY: 200,
      tint: DEFAULT_DUST_TINT,
      emitting: false,
      maxParticles: 50,
    });
    this.landingEmitter.setDepth(2);

    // Running trail
    this.runningEmitter = this.scene.add.particles(0, 0, "particle_circle", {
      speed: { min: 5, max: 20 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.3, end: 0 },
      lifespan: 200,
      tint: DEFAULT_DUST_TINT,
      emitting: false,
      maxParticles: 30,
    });
    this.runningEmitter.setDepth(1);

    // Jump burst
    this.jumpEmitter = this.scene.add.particles(0, 0, "particle_circle", {
      speed: { min: 20, max: 60 },
      angle: { min: 60, max: 120 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 300,
      tint: 0xffdd88,
      emitting: false,
      maxParticles: 20,
    });
    this.jumpEmitter.setDepth(2);

    // Breakable platform crumble
    this.crumbleEmitter = this.scene.add.particles(0, 0, "particle_shard", {
      speed: { min: 40, max: 120 },
      angle: { min: -180, max: 0 },
      scale: { start: 1.0, end: 0.3 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 800, max: 1200 },
      gravityY: 300,
      tint: 0xff4444,
      rotate: { min: 0, max: 360 },
      emitting: false,
      maxParticles: 100,
    });
    this.crumbleEmitter.setDepth(2);

    // Bounce effect
    this.bounceEmitter = this.scene.add.particles(0, 0, "particle_circle", {
      speed: { min: 50, max: 100 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 350,
      tint: 0xff88ff,
      emitting: false,
      maxParticles: 40,
    });
    this.bounceEmitter.setDepth(2);
  }

  // ---------------------------------------------------------------------------
  // Public effect triggers
  // ---------------------------------------------------------------------------

  /**
   * Burst of dust particles when the player lands.
   * @param biomeKey Optional biome key (e.g. "DEPTHS") to tint particles.
   */
  emitLandingDust(x: number, y: number, biomeKey?: string): void {
    if (!this.landingEmitter) return;

    const tint = biomeKey
      ? BIOME_DUST_TINTS[biomeKey] ?? DEFAULT_DUST_TINT
      : DEFAULT_DUST_TINT;

    this.landingEmitter.setParticleTint(tint);
    const count = Phaser.Math.Between(8, 15);
    this.landingEmitter.explode(count, x, y);
  }

  /**
   * Small downward burst when the player jumps.
   */
  emitJumpBurst(x: number, y: number): void {
    if (!this.jumpEmitter) return;

    const count = Phaser.Math.Between(3, 5);
    this.jumpEmitter.explode(count, x, y);
  }

  /**
   * Shard explosion when a breakable platform crumbles.
   * Particles are spread across the platform width.
   */
  emitCrumbleParticles(x: number, y: number, width: number): void {
    if (!this.crumbleEmitter) return;

    const count = Phaser.Math.Between(15, 25);
    const halfWidth = width / 2;

    for (let i = 0; i < count; i++) {
      const offsetX = Phaser.Math.FloatBetween(-halfWidth, halfWidth);
      this.crumbleEmitter.explode(1, x + offsetX, y);
    }
  }

  /**
   * Radial ring burst when the player bounces off a bounce platform.
   */
  emitBounceEffect(x: number, y: number): void {
    if (!this.bounceEmitter) return;

    const count = Phaser.Math.Between(6, 10);
    this.bounceEmitter.explode(count, x, y);
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  /**
   * Call once per frame. Automatically emits landing dust and running trail
   * particles based on player state.
   */
  update(player: any, time: number, delta: number): void {
    if (!player || !player.body) return;

    const body = player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    const airborne = !onGround;

    // Half the physics-body height, used to position particles at the feet
    const halfBodyHeight = SPRITE_CONFIG.BODY_HEIGHT / 2;

    // --- Landing detection ---
    if (this.wasAirborne && onGround) {
      this.emitLandingDust(player.x, player.y + halfBodyHeight);
    }

    // --- Running trail ---
    if (onGround && Math.abs(body.velocity.x) > 10) {
      this.runTrailTimer += delta;

      if (this.runTrailTimer >= ParticleManager.RUN_TRAIL_INTERVAL) {
        this.runTrailTimer = 0;
        const count = Phaser.Math.Between(1, 2);
        this.runningEmitter.explode(
          count,
          player.x,
          player.y + halfBodyHeight,
        );
      }
    } else {
      // Reset timer when player stops or leaves ground
      this.runTrailTimer = 0;
    }

    this.wasAirborne = airborne;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.landingEmitter?.destroy();
    this.runningEmitter?.destroy();
    this.jumpEmitter?.destroy();
    this.crumbleEmitter?.destroy();
    this.bounceEmitter?.destroy();
  }
}

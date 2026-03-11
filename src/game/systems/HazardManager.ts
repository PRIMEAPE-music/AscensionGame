import Phaser from "phaser";
import { Player } from "../entities/Player";
import { WORLD } from "../config/GameConfig";
import { EventBus } from "./EventBus";

// Altitude thresholds for hazard activation
const STALACTITE_MIN_ALTITUDE = 2000;
const WIND_MIN_ALTITUDE = 4000;

// Stalactite config
const STALACTITE_MIN_INTERVAL = 20000; // ms
const STALACTITE_MAX_INTERVAL = 40000;
const STALACTITE_WARNING_DURATION = 1000; // 1 second warning
const STALACTITE_FALL_SPEED = 800;
const STALACTITE_DAMAGE = 2;
const STALACTITE_WIDTH = 20;
const STALACTITE_HEIGHT = 40;
const PLATFORM_DISABLE_DURATION = 10000; // 10 seconds

// Wind config
const WIND_FORCE = 150; // px/s
const WIND_PARTICLE_COUNT = 10;
const WIND_PARTICLE_SPEED = 120;

export class HazardManager {
  private scene: Phaser.Scene;
  private player: Player;
  private staticPlatforms: Phaser.Physics.Arcade.StaticGroup;

  // Stalactite system
  private stalactites: Phaser.Physics.Arcade.Group;
  private stalactiteTimer: number = 0;
  private nextStalactiteInterval: number;
  private warningIndicators: Phaser.GameObjects.Graphics[] = [];

  // Wind system
  private windParticles: Phaser.GameObjects.Arc[] = [];
  private windActive: boolean = false;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    staticPlatforms: Phaser.Physics.Arcade.StaticGroup,
  ) {
    this.scene = scene;
    this.player = player;
    this.staticPlatforms = staticPlatforms;

    this.stalactites = scene.physics.add.group({
      allowGravity: false,
    });

    this.nextStalactiteInterval = Phaser.Math.Between(
      STALACTITE_MIN_INTERVAL,
      STALACTITE_MAX_INTERVAL,
    );

    // Set up stalactite-platform overlap
    scene.physics.add.overlap(
      this.stalactites,
      staticPlatforms,
      this.handleStalactitePlatformOverlap,
      undefined,
      this,
    );
  }

  getStalactites(): Phaser.Physics.Arcade.Group {
    return this.stalactites;
  }

  update(
    time: number,
    delta: number,
    altitude: number,
    cameraScrollY: number,
  ): void {
    this.updateStalactites(time, delta, altitude, cameraScrollY);
    this.updateWind(delta, altitude, cameraScrollY);
    this.cleanupOffScreen(cameraScrollY);
  }

  // ─── Stalactite System ──────────────────────────────────────────────

  private updateStalactites(
    _time: number,
    delta: number,
    altitude: number,
    cameraScrollY: number,
  ): void {
    if (altitude < STALACTITE_MIN_ALTITUDE) return;

    this.stalactiteTimer += delta;

    if (this.stalactiteTimer >= this.nextStalactiteInterval) {
      this.stalactiteTimer = 0;
      this.nextStalactiteInterval = Phaser.Math.Between(
        STALACTITE_MIN_INTERVAL,
        STALACTITE_MAX_INTERVAL,
      );
      this.spawnStalactiteWarning(cameraScrollY);
    }

    // Update warning indicators (pulsing effect)
    for (const indicator of this.warningIndicators) {
      if (!indicator.active) continue;
      const elapsed = (indicator.getData("elapsed") as number) + delta;
      indicator.setData("elapsed", elapsed);

      // Pulsing alpha
      const pulse = 0.5 + 0.5 * Math.sin((elapsed / 150) * Math.PI);
      indicator.setAlpha(pulse);

      // After warning duration, spawn the actual stalactite
      if (elapsed >= STALACTITE_WARNING_DURATION) {
        const spawnX = indicator.getData("spawnX") as number;
        const spawnY = indicator.getData("spawnY") as number;
        this.spawnStalactite(spawnX, spawnY);
        indicator.destroy();
      }
    }

    // Remove destroyed indicators
    this.warningIndicators = this.warningIndicators.filter(
      (ind) => ind.active,
    );
  }

  private spawnStalactiteWarning(cameraScrollY: number): void {
    const camWidth = this.scene.cameras.main.width;
    const camLeft = this.scene.cameras.main.scrollX || 0;
    // Spawn within camera horizontal range with some padding
    const spawnX = camLeft + Phaser.Math.Between(100, camWidth - 100);
    const spawnY = cameraScrollY - 50; // Above camera view

    // Emit warning event for UI
    EventBus.emit("hazard-warning", {
      type: "stalactite",
      x: spawnX,
      y: cameraScrollY,
    });

    // Create pulsing warning indicator at top of screen
    const indicator = this.scene.add.graphics();
    indicator.setDepth(100);

    // Draw a red/orange downward arrow indicator
    indicator.fillStyle(0xff4400, 1);
    indicator.fillTriangle(
      spawnX - 8,
      cameraScrollY + 5,
      spawnX + 8,
      cameraScrollY + 5,
      spawnX,
      cameraScrollY + 20,
    );
    indicator.fillStyle(0xff6600, 0.6);
    indicator.fillCircle(spawnX, cameraScrollY + 8, 6);

    indicator.setData("spawnX", spawnX);
    indicator.setData("spawnY", spawnY);
    indicator.setData("elapsed", 0);

    this.warningIndicators.push(indicator);
  }

  private spawnStalactite(x: number, y: number): void {
    // Create a dark gray spike using graphics rendered to texture
    const texKey = "stalactite_tex";
    if (!this.scene.textures.exists(texKey)) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
      gfx.fillStyle(0x444455, 1);
      gfx.fillTriangle(
        STALACTITE_WIDTH / 2,
        0,
        0,
        STALACTITE_HEIGHT,
        STALACTITE_WIDTH,
        STALACTITE_HEIGHT,
      );
      // Add lighter highlight edge
      gfx.fillStyle(0x666688, 0.5);
      gfx.fillTriangle(
        STALACTITE_WIDTH / 2,
        0,
        STALACTITE_WIDTH / 2 - 3,
        STALACTITE_HEIGHT * 0.6,
        STALACTITE_WIDTH / 2 + 3,
        STALACTITE_HEIGHT * 0.6,
      );
      gfx.generateTexture(texKey, STALACTITE_WIDTH, STALACTITE_HEIGHT);
      gfx.destroy();
    }

    const stalactite = this.stalactites.create(
      x,
      y,
      texKey,
    ) as Phaser.Physics.Arcade.Sprite;
    stalactite.setData("type", "stalactite");
    stalactite.setDepth(50);

    const body = stalactite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityY(STALACTITE_FALL_SPEED);
    body.setSize(STALACTITE_WIDTH - 4, STALACTITE_HEIGHT - 4);
  }

  handleStalactitePlayerOverlap(
    _player: any,
    stalactite: any,
  ): void {
    if (!stalactite.active) return;
    this.player.takeDamage(STALACTITE_DAMAGE);

    // Destroy stalactite
    this.stalactites.remove(stalactite, true, true);
  }

  private handleStalactitePlatformOverlap(
    stalactiteObj: any,
    platformObj: any,
  ): void {
    const stalactite =
      stalactiteObj as Phaser.Physics.Arcade.Sprite;
    const platform = platformObj as Phaser.Physics.Arcade.Sprite;

    if (!stalactite.active || !platform.active) return;

    // Destroy the stalactite
    this.stalactites.remove(stalactite, true, true);

    // Temporarily disable the platform for 10 seconds
    platform.disableBody(true, true);

    this.scene.time.delayedCall(PLATFORM_DISABLE_DURATION, () => {
      if (platform.scene) {
        platform.enableBody(false, platform.x, platform.y, true, true);
      }
    });
  }

  // ─── Wind System ────────────────────────────────────────────────────

  private updateWind(
    delta: number,
    altitude: number,
    cameraScrollY: number,
  ): void {
    if (altitude < WIND_MIN_ALTITUDE) {
      // Clean up wind particles if we drop below threshold
      if (this.windActive) {
        this.destroyWindParticles();
        this.windActive = false;
      }
      return;
    }

    // Determine wind direction: changes every 500m of altitude
    const directionIndex = Math.floor(altitude / 500) % 2;
    const windDirection = directionIndex === 0 ? 1 : -1; // 1 = right, -1 = left

    // Apply wind force to player when airborne
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const isAirborne =
      !playerBody.touching.down && !playerBody.blocked.down;

    if (isAirborne) {
      const windPush = WIND_FORCE * windDirection * (delta / 1000);
      this.player.setVelocityX(playerBody.velocity.x + windPush);
    }

    // Initialize wind particles if not yet created
    if (!this.windActive) {
      this.createWindParticles(cameraScrollY, windDirection);
      this.windActive = true;
    }

    // Update wind particle positions
    const camHeight = this.scene.cameras.main.height;
    const camWidth = this.scene.cameras.main.width;

    for (const particle of this.windParticles) {
      if (!particle.active) continue;

      // Move particle in wind direction
      particle.x += windDirection * WIND_PARTICLE_SPEED * (delta / 1000);
      // Slight downward drift
      particle.y += 20 * (delta / 1000);

      // Recycle when off-screen horizontally or vertically
      const offLeft = particle.x < -20;
      const offRight = particle.x > WORLD.WIDTH + 20;
      const offBottom = particle.y > cameraScrollY + camHeight + 20;

      if (offLeft || offRight || offBottom) {
        // Reset to the opposite side
        if (windDirection > 0) {
          particle.x = Phaser.Math.Between(-20, 0);
        } else {
          particle.x = Phaser.Math.Between(WORLD.WIDTH, WORLD.WIDTH + 20);
        }
        particle.y = cameraScrollY + Phaser.Math.Between(0, camHeight);
        // Randomize alpha slightly for visual variation
        particle.setAlpha(Phaser.Math.FloatBetween(0.2, 0.6));
      }
    }
  }

  private createWindParticles(
    cameraScrollY: number,
    _windDirection: number,
  ): void {
    const camHeight = this.scene.cameras.main.height;

    for (let i = 0; i < WIND_PARTICLE_COUNT; i++) {
      const x = Phaser.Math.Between(0, WORLD.WIDTH);
      const y = cameraScrollY + Phaser.Math.Between(0, camHeight);

      const dot = this.scene.add.circle(
        x,
        y,
        Phaser.Math.Between(1, 3),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.6),
      );
      dot.setDepth(90);
      this.windParticles.push(dot);
    }
  }

  private destroyWindParticles(): void {
    for (const particle of this.windParticles) {
      particle.destroy();
    }
    this.windParticles = [];
  }

  // ─── Cleanup ────────────────────────────────────────────────────────

  private cleanupOffScreen(cameraScrollY: number): void {
    const camHeight = this.scene.cameras.main.height;
    const bottomEdge = cameraScrollY + camHeight + 100;

    // Clean up stalactites below camera
    this.stalactites.children.each((child: any) => {
      if (child.y > bottomEdge) {
        this.stalactites.remove(child, true, true);
      }
      return true;
    });

    // Clean up warning indicators that have somehow persisted
    for (const indicator of this.warningIndicators) {
      if (!indicator.active) continue;
      const spawnY = indicator.getData("spawnY") as number;
      if (spawnY > bottomEdge) {
        indicator.destroy();
      }
    }
    this.warningIndicators = this.warningIndicators.filter(
      (ind) => ind.active,
    );
  }

  destroy(): void {
    this.destroyWindParticles();
    for (const indicator of this.warningIndicators) {
      indicator.destroy();
    }
    this.warningIndicators = [];
    this.stalactites.clear(true, true);
  }
}

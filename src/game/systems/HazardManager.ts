import Phaser from "phaser";
import { Player } from "../entities/Player";
import { WORLD, BIOMES } from "../config/GameConfig";
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

// ─── Biome Hazard Configs ───────────────────────────────────────────────────

// Depths (0–500m)
const LAVA_GEYSER = {
  DAMAGE: 2,
  WARNING_DURATION: 3000,    // 3s warning glow
  ERUPTION_DURATION: 1000,   // 1s eruption
  COLUMN_WIDTH: 40,
  COLUMN_HEIGHT: 200,
  SPAWN_INTERVAL_MIN: 8000,
  SPAWN_INTERVAL_MAX: 15000,
  MAX_ACTIVE: 2,
} as const;

const POISON_POOL = {
  DAMAGE_PER_SEC: 1,
  WIDTH: 80,
  HEIGHT: 16,
  SPAWN_INTERVAL_MIN: 10000,
  SPAWN_INTERVAL_MAX: 20000,
  MAX_ACTIVE: 3,
  LIFETIME: 15000,           // pools last 15s
  BUBBLE_COUNT: 4,
} as const;

// Caverns (500–2000m)
const ICE_PATCH = {
  DURATION: 5000,            // 5s active
  COOLDOWN: 15000,           // 15s cooldown
  SPAWN_INTERVAL_MIN: 12000,
  SPAWN_INTERVAL_MAX: 20000,
  MAX_ACTIVE: 2,
} as const;

const CAVE_IN = {
  DAMAGE: 2,
  WARNING_DURATION: 2000,    // 2s dust warning
  ROCK_COUNT: 3,
  ROCK_SIZE: 30,
  FALL_SPEED: 600,
  SPAWN_INTERVAL_MIN: 10000,
  SPAWN_INTERVAL_MAX: 18000,
  MAX_ACTIVE: 1,
} as const;

// Spire (2000–5000m)
const LIGHTNING = {
  DAMAGE: 3,
  TELEGRAPH_DURATION: 1500,  // 1.5s telegraph
  STRIKE_DURATION: 300,
  RADIUS: 50,
  OFFSET_RANGE: 200,         // +/-200px from player
  SPAWN_INTERVAL_MIN: 6000,
  SPAWN_INTERVAL_MAX: 12000,
  MAX_ACTIVE: 2,
} as const;

const CRUMBLING_LEDGE = {
  STAND_THRESHOLD: 3000,     // 3s before crumble starts
  CRUMBLE_AMOUNT: 20,        // pixels to shrink per tick
  EDGE_ZONE: 40,             // pixels from platform edge
  CHECK_INTERVAL: 500,
} as const;

// Summit (5000m+)
const VOID_RIFT = {
  DAMAGE: 2,
  LIFECYCLE: 8000,           // 8s total
  PULL_FORCE: 120,           // px/s
  MAX_RADIUS: 60,
  SPAWN_INTERVAL_MIN: 10000,
  SPAWN_INTERVAL_MAX: 18000,
  MAX_ACTIVE: 2,
} as const;

const GRAVITY_FLUX = {
  DURATION: 2000,            // 2s reversed gravity
  COOLDOWN: 15000,
  ZONE_WIDTH: 200,
  ZONE_HEIGHT: 300,
  GRAVITY_FORCE: -2000,      // upward force
  PARTICLE_COUNT: 8,
  SPAWN_INTERVAL_MIN: 15000,
  SPAWN_INTERVAL_MAX: 25000,
  MAX_ACTIVE: 1,
} as const;

// ─── Helper: get current biome name from altitude ───────────────────────────
function getBiomeName(altitude: number): string {
  if (altitude < BIOMES.DEPTHS.maxAltitude) return "DEPTHS";
  if (altitude < BIOMES.CAVERNS.maxAltitude) return "CAVERNS";
  if (altitude < BIOMES.SPIRE.maxAltitude) return "SPIRE";
  return "SUMMIT";
}

// ─── Tracked hazard interfaces ──────────────────────────────────────────────

interface LavaGeyser {
  platformRef: Phaser.GameObjects.GameObject;
  warningGfx: Phaser.GameObjects.Graphics;
  columnSprite: Phaser.GameObjects.Rectangle | null;
  elapsed: number;
  state: "warning" | "erupting" | "done";
  x: number;
  y: number;
}

interface PoisonPool {
  gfx: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Zone;
  bubbles: Phaser.GameObjects.Arc[];
  elapsed: number;
  x: number;
  y: number;
  lastDamageTime: Map<Player, number>;
}

interface IcePatch {
  platformRef: Phaser.GameObjects.GameObject;
  overlay: Phaser.GameObjects.Graphics;
  elapsed: number;
  state: "active" | "cooldown";
  originalData: any;
}

interface CaveInWarning {
  dustParticles: Phaser.GameObjects.Arc[];
  elapsed: number;
  x: number;
  y: number;
}

interface CaveInRock {
  sprite: Phaser.Physics.Arcade.Sprite;
  landed: boolean;
}

interface LightningStrike {
  telegraph: Phaser.GameObjects.Graphics;
  elapsed: number;
  x: number;
  y: number;
  state: "telegraph" | "striking" | "done";
  strikeGfx: Phaser.GameObjects.Graphics | null;
}

interface CrumbleTracker {
  platform: Phaser.GameObjects.GameObject;
  timeOnEdge: number;
  side: "left" | "right" | null;
  originalWidth: number;
  shrunkLeft: number;
  shrunkRight: number;
}

interface VoidRift {
  gfx: Phaser.GameObjects.Graphics;
  elapsed: number;
  x: number;
  y: number;
  currentRadius: number;
}

interface GravityFluxZone {
  gfx: Phaser.GameObjects.Graphics;
  particles: Phaser.GameObjects.Arc[];
  elapsed: number;
  state: "active" | "cooldown";
  x: number;
  y: number;
  width: number;
  height: number;
}

export class HazardManager {
  private scene: Phaser.Scene;
  private players: Player[];
  private staticPlatforms: Phaser.Physics.Arcade.StaticGroup;

  // Backwards-compat getter: primary player
  private get player(): Player {
    return this.players[0];
  }

  // Stalactite system
  private stalactites: Phaser.Physics.Arcade.Group;
  private stalactiteTimer: number = 0;
  private nextStalactiteInterval: number;
  private warningIndicators: Phaser.GameObjects.Graphics[] = [];

  // Wind system
  private windParticles: Phaser.GameObjects.Arc[] = [];
  private windActive: boolean = false;

  // ─── Biome Hazard State ─────────────────────────────────────────────

  // Depths: Lava Geysers
  private lavaGeysers: LavaGeyser[] = [];
  private lavaGeyserTimer: number = 0;
  private nextLavaGeyserInterval: number = 0;

  // Depths: Poison Pools
  private poisonPools: PoisonPool[] = [];
  private poisonPoolTimer: number = 0;
  private nextPoisonPoolInterval: number = 0;
  private poisonPoolGroup: Phaser.Physics.Arcade.StaticGroup;

  // Caverns: Ice Patches
  private icePatches: IcePatch[] = [];
  private icePatchTimer: number = 0;
  private nextIcePatchInterval: number = 0;

  // Caverns: Cave-ins
  private caveInWarnings: CaveInWarning[] = [];
  private caveInRocks: CaveInRock[] = [];
  private caveInRockGroup: Phaser.Physics.Arcade.Group;
  private caveInTimer: number = 0;
  private nextCaveInInterval: number = 0;

  // Spire: Lightning Strikes
  private lightningStrikes: LightningStrike[] = [];
  private lightningTimer: number = 0;
  private nextLightningInterval: number = 0;

  // Spire: Crumbling Ledges
  private crumbleTrackers: Map<Phaser.GameObjects.GameObject, CrumbleTracker> = new Map();
  private crumbleCheckTimer: number = 0;

  // Summit: Void Rifts
  private voidRifts: VoidRift[] = [];
  private voidRiftTimer: number = 0;
  private nextVoidRiftInterval: number = 0;

  // Summit: Gravity Flux
  private gravityFluxZones: GravityFluxZone[] = [];
  private gravityFluxTimer: number = 0;
  private nextGravityFluxInterval: number = 0;

  constructor(
    scene: Phaser.Scene,
    player: Player | Player[],
    staticPlatforms: Phaser.Physics.Arcade.StaticGroup,
  ) {
    this.scene = scene;
    this.players = Array.isArray(player) ? player : [player];
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

    // Biome hazard groups
    this.poisonPoolGroup = scene.physics.add.staticGroup();

    this.caveInRockGroup = scene.physics.add.group({
      allowGravity: false,
    });

    // Cave-in rocks collide with platforms (land and become obstacles)
    scene.physics.add.collider(
      this.caveInRockGroup,
      staticPlatforms,
      this.handleCaveInRockLand,
      undefined,
      this,
    );

    // Randomize initial intervals
    this.nextLavaGeyserInterval = Phaser.Math.Between(LAVA_GEYSER.SPAWN_INTERVAL_MIN, LAVA_GEYSER.SPAWN_INTERVAL_MAX);
    this.nextPoisonPoolInterval = Phaser.Math.Between(POISON_POOL.SPAWN_INTERVAL_MIN, POISON_POOL.SPAWN_INTERVAL_MAX);
    this.nextIcePatchInterval = Phaser.Math.Between(ICE_PATCH.SPAWN_INTERVAL_MIN, ICE_PATCH.SPAWN_INTERVAL_MAX);
    this.nextCaveInInterval = Phaser.Math.Between(CAVE_IN.SPAWN_INTERVAL_MIN, CAVE_IN.SPAWN_INTERVAL_MAX);
    this.nextLightningInterval = Phaser.Math.Between(LIGHTNING.SPAWN_INTERVAL_MIN, LIGHTNING.SPAWN_INTERVAL_MAX);
    this.nextVoidRiftInterval = Phaser.Math.Between(VOID_RIFT.SPAWN_INTERVAL_MIN, VOID_RIFT.SPAWN_INTERVAL_MAX);
    this.nextGravityFluxInterval = Phaser.Math.Between(GRAVITY_FLUX.SPAWN_INTERVAL_MIN, GRAVITY_FLUX.SPAWN_INTERVAL_MAX);
  }

  getStalactites(): Phaser.Physics.Arcade.Group {
    return this.stalactites;
  }

  getCaveInRocks(): Phaser.Physics.Arcade.Group {
    return this.caveInRockGroup;
  }

  getPoisonPoolGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.poisonPoolGroup;
  }

  update(
    time: number,
    delta: number,
    altitude: number,
    cameraScrollY: number,
  ): void {
    this.updateStalactites(time, delta, altitude, cameraScrollY);
    this.updateWind(delta, altitude, cameraScrollY);

    // Biome-specific hazards
    const biome = getBiomeName(altitude);

    if (biome === "DEPTHS") {
      this.updateLavaGeysers(delta, altitude, cameraScrollY);
      this.updatePoisonPools(delta, altitude, cameraScrollY);
    } else if (biome === "CAVERNS") {
      this.updateIcePatches(delta, altitude, cameraScrollY);
      this.updateCaveIns(delta, altitude, cameraScrollY);
    } else if (biome === "SPIRE") {
      this.updateLightningStrikes(delta, altitude, cameraScrollY);
      this.updateCrumblingLedges(delta);
    } else if (biome === "SUMMIT") {
      this.updateVoidRifts(delta, altitude, cameraScrollY);
      this.updateGravityFlux(delta, altitude, cameraScrollY);
    }

    this.cleanupOffScreen(cameraScrollY);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EXISTING SYSTEMS (Stalactites + Wind) — unchanged
  // ═══════════════════════════════════════════════════════════════════════

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
    playerObj: any,
    stalactite: any,
  ): void {
    if (!stalactite.active) return;
    const p = playerObj as Player;
    p.takeDamage(STALACTITE_DAMAGE);

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

    // Apply wind force to all players when airborne
    for (const p of this.players) {
      const body = p.body as Phaser.Physics.Arcade.Body;
      const isAirborne = !body.touching.down && !body.blocked.down;
      if (isAirborne) {
        const windPush = WIND_FORCE * windDirection * (delta / 1000);
        p.setVelocityX(body.velocity.x + windPush);
      }
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

  // ═══════════════════════════════════════════════════════════════════════
  // DEPTHS BIOME HAZARDS (0–500m)
  // ═══════════════════════════════════════════════════════════════════════

  // ─── Lava Geysers ───────────────────────────────────────────────────

  private updateLavaGeysers(
    delta: number,
    _altitude: number,
    cameraScrollY: number,
  ): void {
    this.lavaGeyserTimer += delta;

    // Spawn new geysers
    const activeCount = this.lavaGeysers.filter(g => g.state !== "done").length;
    if (this.lavaGeyserTimer >= this.nextLavaGeyserInterval && activeCount < LAVA_GEYSER.MAX_ACTIVE) {
      this.lavaGeyserTimer = 0;
      this.nextLavaGeyserInterval = Phaser.Math.Between(LAVA_GEYSER.SPAWN_INTERVAL_MIN, LAVA_GEYSER.SPAWN_INTERVAL_MAX);
      this.spawnLavaGeyser(cameraScrollY);
    }

    // Update existing geysers
    for (const geyser of this.lavaGeysers) {
      if (geyser.state === "done") continue;
      geyser.elapsed += delta;

      if (geyser.state === "warning") {
        // Pulsing red/orange glow during warning phase
        const pulse = 0.3 + 0.5 * Math.sin((geyser.elapsed / 300) * Math.PI);
        geyser.warningGfx.setAlpha(pulse);

        // Intensify color as warning progresses
        const progress = geyser.elapsed / LAVA_GEYSER.WARNING_DURATION;
        geyser.warningGfx.clear();
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
          new Phaser.Display.Color(255, 100, 0),
          new Phaser.Display.Color(255, 0, 0),
          100,
          Math.floor(progress * 100),
        );
        geyser.warningGfx.fillStyle(
          Phaser.Display.Color.GetColor(color.r, color.g, color.b),
          0.6,
        );
        geyser.warningGfx.fillRect(
          geyser.x - LAVA_GEYSER.COLUMN_WIDTH / 2,
          geyser.y - 4,
          LAVA_GEYSER.COLUMN_WIDTH,
          8,
        );

        if (geyser.elapsed >= LAVA_GEYSER.WARNING_DURATION) {
          geyser.state = "erupting";
          geyser.elapsed = 0;
          this.eruptLavaGeyser(geyser);
        }
      } else if (geyser.state === "erupting") {
        if (geyser.elapsed >= LAVA_GEYSER.ERUPTION_DURATION) {
          this.cleanupLavaGeyser(geyser);
        } else if (geyser.columnSprite) {
          // Flicker effect during eruption
          const flicker = 0.7 + 0.3 * Math.sin((geyser.elapsed / 50) * Math.PI);
          geyser.columnSprite.setAlpha(flicker);
        }
      }
    }

    // Remove finished geysers
    this.lavaGeysers = this.lavaGeysers.filter(g => g.state !== "done");
  }

  private spawnLavaGeyser(cameraScrollY: number): void {
    // Find a visible platform to spawn on
    const platform = this.findVisiblePlatform(cameraScrollY);
    if (!platform) return;

    const platBody = platform.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
    const x = platBody.x + platBody.width / 2;
    const y = platBody.y;

    EventBus.emit("hazard-warning", { type: "lava_geyser", x, y });

    const warningGfx = this.scene.add.graphics();
    warningGfx.setDepth(45);
    warningGfx.fillStyle(0xff6600, 0.4);
    warningGfx.fillRect(
      x - LAVA_GEYSER.COLUMN_WIDTH / 2,
      y - 4,
      LAVA_GEYSER.COLUMN_WIDTH,
      8,
    );

    this.lavaGeysers.push({
      platformRef: platform,
      warningGfx,
      columnSprite: null,
      elapsed: 0,
      state: "warning",
      x,
      y,
    });
  }

  private eruptLavaGeyser(geyser: LavaGeyser): void {
    geyser.warningGfx.destroy();

    // Create eruption column — a red/orange rectangle shooting upward
    const column = this.scene.add.rectangle(
      geyser.x,
      geyser.y - LAVA_GEYSER.COLUMN_HEIGHT / 2,
      LAVA_GEYSER.COLUMN_WIDTH,
      LAVA_GEYSER.COLUMN_HEIGHT,
      0xff3300,
      0.85,
    );
    column.setDepth(48);
    geyser.columnSprite = column;

    // Animate eruption: scale up from 0
    column.setScale(1, 0);
    this.scene.tweens.add({
      targets: column,
      scaleY: 1,
      duration: 150,
      ease: "Quad.easeOut",
    });

    // Check player overlap manually each frame during eruption
    const eruptionCheck = this.scene.time.addEvent({
      delay: 100,
      repeat: Math.floor(LAVA_GEYSER.ERUPTION_DURATION / 100) - 1,
      callback: () => {
        if (!column.active) return;
        const colBounds = column.getBounds();
        for (const p of this.players) {
          if (!p.active) continue;
          const pBounds = p.getBounds();
          if (Phaser.Geom.Rectangle.Overlaps(colBounds, pBounds)) {
            p.takeDamage(LAVA_GEYSER.DAMAGE);
          }
        }
      },
    });

    // Store the timer for cleanup
    (column as any).__eruptionTimer = eruptionCheck;
  }

  private cleanupLavaGeyser(geyser: LavaGeyser): void {
    if (geyser.warningGfx.active) geyser.warningGfx.destroy();
    if (geyser.columnSprite) {
      const timer = (geyser.columnSprite as any).__eruptionTimer;
      if (timer) timer.remove(false);

      // Fade out
      this.scene.tweens.add({
        targets: geyser.columnSprite,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          geyser.columnSprite?.destroy();
        },
      });
    }
    geyser.state = "done";
  }

  // ─── Poison Pools ──────────────────────────────────────────────────

  private updatePoisonPools(
    delta: number,
    _altitude: number,
    cameraScrollY: number,
  ): void {
    this.poisonPoolTimer += delta;

    // Spawn new pools
    if (this.poisonPoolTimer >= this.nextPoisonPoolInterval && this.poisonPools.length < POISON_POOL.MAX_ACTIVE) {
      this.poisonPoolTimer = 0;
      this.nextPoisonPoolInterval = Phaser.Math.Between(POISON_POOL.SPAWN_INTERVAL_MIN, POISON_POOL.SPAWN_INTERVAL_MAX);
      this.spawnPoisonPool(cameraScrollY);
    }

    // Update existing pools
    for (const pool of this.poisonPools) {
      pool.elapsed += delta;

      // Bubble animation
      for (const bubble of pool.bubbles) {
        if (!bubble.active) continue;
        bubble.y -= 15 * (delta / 1000);
        bubble.setAlpha(bubble.alpha - 0.5 * (delta / 1000));

        if (bubble.alpha <= 0) {
          // Reset bubble
          bubble.setPosition(
            pool.x + Phaser.Math.Between(-POISON_POOL.WIDTH / 2, POISON_POOL.WIDTH / 2),
            pool.y,
          );
          bubble.setAlpha(Phaser.Math.FloatBetween(0.3, 0.8));
        }
      }

      // Damage players standing in pool (1 dmg/sec via timer)
      for (const p of this.players) {
        if (!p.active) continue;
        const pBounds = p.getBounds();
        const poolBounds = new Phaser.Geom.Rectangle(
          pool.x - POISON_POOL.WIDTH / 2,
          pool.y - POISON_POOL.HEIGHT / 2,
          POISON_POOL.WIDTH,
          POISON_POOL.HEIGHT,
        );

        if (Phaser.Geom.Rectangle.Overlaps(pBounds, poolBounds)) {
          const lastDmg = pool.lastDamageTime.get(p) || 0;
          if (pool.elapsed - lastDmg >= 1000) {
            p.takeDamage(POISON_POOL.DAMAGE_PER_SEC);
            pool.lastDamageTime.set(p, pool.elapsed);
          }
        }
      }

      // Remove expired pools
      if (pool.elapsed >= POISON_POOL.LIFETIME) {
        this.cleanupPoisonPool(pool);
      }
    }

    this.poisonPools = this.poisonPools.filter(p => p.gfx.active);
  }

  private spawnPoisonPool(cameraScrollY: number): void {
    const platform = this.findVisiblePlatform(cameraScrollY);
    if (!platform) return;

    const platBody = platform.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
    const x = platBody.x + platBody.width / 2;
    const y = platBody.y - 2;

    const gfx = this.scene.add.graphics();
    gfx.setDepth(44);
    gfx.fillStyle(0x33ff33, 0.5);
    gfx.fillRoundedRect(
      x - POISON_POOL.WIDTH / 2,
      y - POISON_POOL.HEIGHT / 2,
      POISON_POOL.WIDTH,
      POISON_POOL.HEIGHT,
      4,
    );
    // Darker border
    gfx.lineStyle(1, 0x00aa00, 0.7);
    gfx.strokeRoundedRect(
      x - POISON_POOL.WIDTH / 2,
      y - POISON_POOL.HEIGHT / 2,
      POISON_POOL.WIDTH,
      POISON_POOL.HEIGHT,
      4,
    );

    // Create zone for physics overlap detection
    const zone = this.scene.add.zone(x, y, POISON_POOL.WIDTH, POISON_POOL.HEIGHT);
    this.scene.physics.add.existing(zone, true);
    zone.setDepth(44);

    // Create bubbling particles
    const bubbles: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < POISON_POOL.BUBBLE_COUNT; i++) {
      const bx = x + Phaser.Math.Between(-POISON_POOL.WIDTH / 2, POISON_POOL.WIDTH / 2);
      const by = y - Phaser.Math.Between(0, 10);
      const bubble = this.scene.add.circle(bx, by, Phaser.Math.Between(2, 4), 0x66ff66, Phaser.Math.FloatBetween(0.3, 0.8));
      bubble.setDepth(45);
      bubbles.push(bubble);
    }

    this.poisonPools.push({
      gfx,
      zone,
      bubbles,
      elapsed: 0,
      x,
      y,
      lastDamageTime: new Map(),
    });
  }

  private cleanupPoisonPool(pool: PoisonPool): void {
    // Fade out
    this.scene.tweens.add({
      targets: pool.gfx,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        pool.gfx.destroy();
      },
    });
    pool.zone.destroy();
    for (const bubble of pool.bubbles) {
      bubble.destroy();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CAVERNS BIOME HAZARDS (500–2000m)
  // ═══════════════════════════════════════════════════════════════════════

  // ─── Ice Patches ────────────────────────────────────────────────────

  private updateIcePatches(
    delta: number,
    _altitude: number,
    cameraScrollY: number,
  ): void {
    this.icePatchTimer += delta;

    // Spawn new ice patches
    const activeCount = this.icePatches.filter(p => p.state === "active").length;
    if (this.icePatchTimer >= this.nextIcePatchInterval && activeCount < ICE_PATCH.MAX_ACTIVE) {
      this.icePatchTimer = 0;
      this.nextIcePatchInterval = Phaser.Math.Between(ICE_PATCH.SPAWN_INTERVAL_MIN, ICE_PATCH.SPAWN_INTERVAL_MAX);
      this.spawnIcePatch(cameraScrollY);
    }

    // Update existing ice patches
    for (const patch of this.icePatches) {
      patch.elapsed += delta;

      if (patch.state === "active") {
        // Blue shimmer visual
        const shimmer = 0.3 + 0.2 * Math.sin((patch.elapsed / 400) * Math.PI);
        patch.overlay.setAlpha(shimmer);

        // Apply ice physics: check if any player is on this platform
        for (const p of this.players) {
          if (!p.active) continue;
          const body = p.body as Phaser.Physics.Arcade.Body;
          const onGround = body.touching.down || body.blocked.down;
          if (onGround && this.isPlayerOnPlatform(p, patch.platformRef)) {
            // Mark player as on ice for this frame — reduce friction
            this.applyIcePhysics(p, delta);
          }
        }

        if (patch.elapsed >= ICE_PATCH.DURATION) {
          patch.state = "cooldown";
          patch.elapsed = 0;
          patch.overlay.setAlpha(0);
        }
      } else if (patch.state === "cooldown") {
        if (patch.elapsed >= ICE_PATCH.COOLDOWN) {
          // Reactivate
          patch.state = "active";
          patch.elapsed = 0;
        }
      }
    }
  }

  private spawnIcePatch(cameraScrollY: number): void {
    const platform = this.findVisiblePlatform(cameraScrollY);
    if (!platform) return;

    // Don't duplicate ice on same platform
    for (const existing of this.icePatches) {
      if (existing.platformRef === platform) return;
    }

    const platBody = platform.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
    const x = platBody.x;
    const y = platBody.y;
    const w = platBody.width;
    const h = platBody.height;

    const overlay = this.scene.add.graphics();
    overlay.setDepth(43);
    overlay.fillStyle(0x88ccff, 0.35);
    overlay.fillRect(x, y, w, h);
    overlay.lineStyle(1, 0xaaddff, 0.5);
    overlay.strokeRect(x, y, w, h);

    EventBus.emit("hazard-warning", { type: "ice_patch", x: x + w / 2, y });

    this.icePatches.push({
      platformRef: platform,
      overlay,
      elapsed: 0,
      state: "active",
      originalData: null,
    });
  }

  private applyIcePhysics(player: Player, delta: number): void {
    // Reduce deceleration to simulate ice — override drag for this frame
    const body = player.body as Phaser.Physics.Arcade.Body;
    // Reduce drag substantially to simulate sliding
    body.setDrag(50, 0);
  }

  // ─── Cave-Ins ──────────────────────────────────────────────────────

  private updateCaveIns(
    delta: number,
    _altitude: number,
    cameraScrollY: number,
  ): void {
    this.caveInTimer += delta;

    // Spawn new cave-in warnings
    const activeWarnings = this.caveInWarnings.length;
    const activeRocks = this.caveInRocks.filter(r => !r.landed).length;
    if (this.caveInTimer >= this.nextCaveInInterval && activeWarnings + activeRocks < CAVE_IN.MAX_ACTIVE) {
      this.caveInTimer = 0;
      this.nextCaveInInterval = Phaser.Math.Between(CAVE_IN.SPAWN_INTERVAL_MIN, CAVE_IN.SPAWN_INTERVAL_MAX);
      this.spawnCaveInWarning(cameraScrollY);
    }

    // Update warnings
    for (const warning of this.caveInWarnings) {
      warning.elapsed += delta;

      // Dust particles falling during warning
      for (const dust of warning.dustParticles) {
        if (!dust.active) continue;
        dust.y += 40 * (delta / 1000);
        dust.setAlpha(dust.alpha - 0.3 * (delta / 1000));
        if (dust.alpha <= 0.05) {
          // Reset dust particle
          dust.setPosition(
            warning.x + Phaser.Math.Between(-60, 60),
            warning.y - 20,
          );
          dust.setAlpha(Phaser.Math.FloatBetween(0.3, 0.7));
        }
      }

      // After warning duration, drop rocks
      if (warning.elapsed >= CAVE_IN.WARNING_DURATION) {
        this.dropCaveInRocks(warning);
        for (const dust of warning.dustParticles) {
          dust.destroy();
        }
      }
    }
    this.caveInWarnings = this.caveInWarnings.filter(w => w.elapsed < CAVE_IN.WARNING_DURATION);

    // Clean up landed rocks after 5 seconds
    for (const rock of this.caveInRocks) {
      if (rock.landed && rock.sprite.active) {
        const landedTime = rock.sprite.getData("landedTime") as number || 0;
        if (landedTime > 0 && Date.now() - landedTime > 5000) {
          this.caveInRockGroup.remove(rock.sprite, true, true);
        }
      }
    }
    this.caveInRocks = this.caveInRocks.filter(r => r.sprite.active);
  }

  private spawnCaveInWarning(cameraScrollY: number): void {
    // Spawn above the player with some horizontal offset
    const targetPlayer = this.players[Phaser.Math.Between(0, this.players.length - 1)];
    if (!targetPlayer.active) return;

    const x = targetPlayer.x + Phaser.Math.Between(-100, 100);
    const y = cameraScrollY + 10;

    EventBus.emit("hazard-warning", { type: "cave_in", x, y });

    // Create dust particles
    const dustParticles: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 8; i++) {
      const dx = x + Phaser.Math.Between(-60, 60);
      const dy = y + Phaser.Math.Between(-10, 10);
      const dust = this.scene.add.circle(dx, dy, Phaser.Math.Between(1, 3), 0x998877, Phaser.Math.FloatBetween(0.3, 0.7));
      dust.setDepth(95);
      dustParticles.push(dust);
    }

    this.caveInWarnings.push({
      dustParticles,
      elapsed: 0,
      x,
      y,
    });
  }

  private dropCaveInRocks(warning: CaveInWarning): void {
    const texKey = "cavein_rock_tex";
    if (!this.scene.textures.exists(texKey)) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
      gfx.fillStyle(0x665544, 1);
      gfx.fillRect(0, 0, CAVE_IN.ROCK_SIZE, CAVE_IN.ROCK_SIZE);
      gfx.fillStyle(0x776655, 0.5);
      gfx.fillRect(2, 2, CAVE_IN.ROCK_SIZE - 4, CAVE_IN.ROCK_SIZE / 2);
      gfx.generateTexture(texKey, CAVE_IN.ROCK_SIZE, CAVE_IN.ROCK_SIZE);
      gfx.destroy();
    }

    for (let i = 0; i < CAVE_IN.ROCK_COUNT; i++) {
      const rx = warning.x + Phaser.Math.Between(-40, 40);
      const ry = warning.y;

      const rock = this.caveInRockGroup.create(rx, ry, texKey) as Phaser.Physics.Arcade.Sprite;
      rock.setDepth(50);
      rock.setData("type", "cave_in_rock");
      rock.setData("landedTime", 0);

      const body = rock.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setVelocityY(CAVE_IN.FALL_SPEED);
      body.setSize(CAVE_IN.ROCK_SIZE - 4, CAVE_IN.ROCK_SIZE - 4);
      body.setBounce(0);

      this.caveInRocks.push({ sprite: rock, landed: false });
    }
  }

  handleCaveInRockPlayerOverlap(playerObj: any, rockObj: any): void {
    const rock = rockObj as Phaser.Physics.Arcade.Sprite;
    if (!rock.active) return;

    // Only damage if rock is still falling (not landed)
    const caveInRock = this.caveInRocks.find(r => r.sprite === rock);
    if (caveInRock && !caveInRock.landed) {
      const p = playerObj as Player;
      p.takeDamage(CAVE_IN.DAMAGE);
    }
  }

  private handleCaveInRockLand(rockObj: any, _platformObj: any): void {
    const rock = rockObj as Phaser.Physics.Arcade.Sprite;
    if (!rock.active) return;

    const caveInRock = this.caveInRocks.find(r => r.sprite === rock);
    if (caveInRock && !caveInRock.landed) {
      caveInRock.landed = true;
      const body = rock.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      body.setImmovable(true);
      rock.setData("landedTime", Date.now());
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SPIRE BIOME HAZARDS (2000–5000m)
  // ═══════════════════════════════════════════════════════════════════════

  // ─── Lightning Strikes ─────────────────────────────────────────────

  private updateLightningStrikes(
    delta: number,
    _altitude: number,
    cameraScrollY: number,
  ): void {
    this.lightningTimer += delta;

    // Spawn new lightning
    const activeCount = this.lightningStrikes.filter(s => s.state !== "done").length;
    if (this.lightningTimer >= this.nextLightningInterval && activeCount < LIGHTNING.MAX_ACTIVE) {
      this.lightningTimer = 0;
      this.nextLightningInterval = Phaser.Math.Between(LIGHTNING.SPAWN_INTERVAL_MIN, LIGHTNING.SPAWN_INTERVAL_MAX);
      this.spawnLightningStrike(cameraScrollY);
    }

    // Update existing strikes
    for (const strike of this.lightningStrikes) {
      if (strike.state === "done") continue;
      strike.elapsed += delta;

      if (strike.state === "telegraph") {
        // Pulsing yellow circle telegraph
        const pulse = 0.3 + 0.4 * Math.sin((strike.elapsed / 200) * Math.PI);
        strike.telegraph.setAlpha(pulse);

        // Intensify as it approaches strike time
        const progress = strike.elapsed / LIGHTNING.TELEGRAPH_DURATION;
        strike.telegraph.clear();
        strike.telegraph.fillStyle(0xffff00, 0.3 + progress * 0.4);
        strike.telegraph.fillCircle(strike.x, strike.y, LIGHTNING.RADIUS * (0.5 + progress * 0.5));
        strike.telegraph.lineStyle(2, 0xffff88, 0.5 + progress * 0.5);
        strike.telegraph.strokeCircle(strike.x, strike.y, LIGHTNING.RADIUS * (0.5 + progress * 0.5));

        if (strike.elapsed >= LIGHTNING.TELEGRAPH_DURATION) {
          strike.state = "striking";
          strike.elapsed = 0;
          this.executeLightningStrike(strike);
        }
      } else if (strike.state === "striking") {
        if (strike.elapsed >= LIGHTNING.STRIKE_DURATION) {
          this.cleanupLightningStrike(strike);
        }
      }
    }

    this.lightningStrikes = this.lightningStrikes.filter(s => s.state !== "done");
  }

  private spawnLightningStrike(cameraScrollY: number): void {
    // Target near a random player with offset so it's avoidable
    const targetPlayer = this.players[Phaser.Math.Between(0, this.players.length - 1)];
    if (!targetPlayer.active) return;

    const offsetX = Phaser.Math.Between(-LIGHTNING.OFFSET_RANGE, LIGHTNING.OFFSET_RANGE);
    const x = Phaser.Math.Clamp(targetPlayer.x + offsetX, 100, WORLD.WIDTH - 100);
    // Target the player's Y position (or closest platform level)
    const y = targetPlayer.y;

    EventBus.emit("hazard-warning", { type: "lightning", x, y });

    const telegraph = this.scene.add.graphics();
    telegraph.setDepth(95);
    telegraph.fillStyle(0xffff00, 0.3);
    telegraph.fillCircle(x, y, LIGHTNING.RADIUS * 0.5);
    telegraph.lineStyle(2, 0xffff88, 0.5);
    telegraph.strokeCircle(x, y, LIGHTNING.RADIUS * 0.5);

    this.lightningStrikes.push({
      telegraph,
      elapsed: 0,
      x,
      y,
      state: "telegraph",
      strikeGfx: null,
    });
  }

  private executeLightningStrike(strike: LightningStrike): void {
    strike.telegraph.destroy();

    // Create strike visual — white/yellow column from above to impact point
    const strikeGfx = this.scene.add.graphics();
    strikeGfx.setDepth(96);

    // Bolt column
    const boltTop = strike.y - 600;
    strikeGfx.fillStyle(0xffffff, 0.9);
    strikeGfx.fillRect(strike.x - 4, boltTop, 8, 600);
    strikeGfx.fillStyle(0xffff88, 0.6);
    strikeGfx.fillRect(strike.x - 8, boltTop, 16, 600);

    // Impact circle
    strikeGfx.fillStyle(0xffffff, 0.8);
    strikeGfx.fillCircle(strike.x, strike.y, LIGHTNING.RADIUS);
    strikeGfx.fillStyle(0xffff00, 0.4);
    strikeGfx.fillCircle(strike.x, strike.y, LIGHTNING.RADIUS * 1.5);

    strike.strikeGfx = strikeGfx;

    // Screen flash
    this.scene.cameras.main.flash(150, 255, 255, 200, false);

    // Damage check — any player in the strike radius
    for (const p of this.players) {
      if (!p.active) continue;
      const dist = Phaser.Math.Distance.Between(p.x, p.y, strike.x, strike.y);
      if (dist <= LIGHTNING.RADIUS + 20) {
        p.takeDamage(LIGHTNING.DAMAGE);
      }
    }
  }

  private cleanupLightningStrike(strike: LightningStrike): void {
    if (strike.telegraph.active) strike.telegraph.destroy();
    if (strike.strikeGfx) {
      this.scene.tweens.add({
        targets: strike.strikeGfx,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          strike.strikeGfx?.destroy();
        },
      });
    }
    strike.state = "done";
  }

  // ─── Crumbling Ledges ──────────────────────────────────────────────

  private updateCrumblingLedges(delta: number): void {
    this.crumbleCheckTimer += delta;
    if (this.crumbleCheckTimer < CRUMBLING_LEDGE.CHECK_INTERVAL) return;
    this.crumbleCheckTimer = 0;

    for (const p of this.players) {
      if (!p.active) continue;
      const body = p.body as Phaser.Physics.Arcade.Body;
      const onGround = body.touching.down || body.blocked.down;
      if (!onGround) continue;

      // Find which platform the player is standing on
      const platform = this.findPlatformUnderPlayer(p);
      if (!platform) continue;

      const platBody = platform.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
      const platLeft = platBody.x;
      const platRight = platBody.x + platBody.width;
      const playerX = p.x;

      // Check if player is on an edge
      const onLeftEdge = playerX - platLeft < CRUMBLING_LEDGE.EDGE_ZONE;
      const onRightEdge = platRight - playerX < CRUMBLING_LEDGE.EDGE_ZONE;

      if (!onLeftEdge && !onRightEdge) {
        // Player is in the center, reset any tracker for this platform
        this.crumbleTrackers.delete(platform);
        continue;
      }

      const side: "left" | "right" = onLeftEdge ? "left" : "right";

      let tracker = this.crumbleTrackers.get(platform);
      if (!tracker) {
        tracker = {
          platform,
          timeOnEdge: 0,
          side,
          originalWidth: platBody.width,
          shrunkLeft: 0,
          shrunkRight: 0,
        };
        this.crumbleTrackers.set(platform, tracker);
      }

      if (tracker.side === side) {
        tracker.timeOnEdge += CRUMBLING_LEDGE.CHECK_INTERVAL;
      } else {
        tracker.side = side;
        tracker.timeOnEdge = CRUMBLING_LEDGE.CHECK_INTERVAL;
      }

      // Start crumbling after threshold
      if (tracker.timeOnEdge >= CRUMBLING_LEDGE.STAND_THRESHOLD) {
        this.crumblePlatformEdge(platform, tracker, side);
        tracker.timeOnEdge = 0; // Reset for next crumble tick
      } else if (tracker.timeOnEdge >= CRUMBLING_LEDGE.STAND_THRESHOLD * 0.7) {
        // Shake warning
        this.shakePlatform(platform);
      }
    }
  }

  private crumblePlatformEdge(
    platform: Phaser.GameObjects.GameObject,
    tracker: CrumbleTracker,
    side: "left" | "right",
  ): void {
    const platSprite = platform as Phaser.Physics.Arcade.Sprite;
    const platBody = platform.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;

    const newWidth = Math.max(40, platBody.width - CRUMBLING_LEDGE.CRUMBLE_AMOUNT);
    if (newWidth <= 40) return; // Don't destroy entirely

    if (side === "left") {
      tracker.shrunkLeft += CRUMBLING_LEDGE.CRUMBLE_AMOUNT;
    } else {
      tracker.shrunkRight += CRUMBLING_LEDGE.CRUMBLE_AMOUNT;
    }

    // Spawn crumble debris particles
    const debrisX = side === "left" ? platBody.x : platBody.x + platBody.width;
    const debrisY = platBody.y + platBody.height / 2;
    for (let i = 0; i < 4; i++) {
      const debris = this.scene.add.rectangle(
        debrisX + Phaser.Math.Between(-10, 10),
        debrisY,
        Phaser.Math.Between(3, 8),
        Phaser.Math.Between(3, 8),
        0x553333,
        0.8,
      );
      debris.setDepth(46);
      this.scene.tweens.add({
        targets: debris,
        y: debrisY + Phaser.Math.Between(50, 150),
        x: debris.x + Phaser.Math.Between(-20, 20),
        alpha: 0,
        duration: Phaser.Math.Between(400, 800),
        onComplete: () => debris.destroy(),
      });
    }

    // Resize the platform body
    const shrinkOffset = side === "left" ? CRUMBLING_LEDGE.CRUMBLE_AMOUNT / 2 : -CRUMBLING_LEDGE.CRUMBLE_AMOUNT / 2;
    if (platBody instanceof Phaser.Physics.Arcade.StaticBody) {
      platBody.setSize(newWidth, platBody.height);
      platBody.setOffset(
        (platBody.offset?.x || 0) + (side === "left" ? CRUMBLING_LEDGE.CRUMBLE_AMOUNT : 0),
        platBody.offset?.y || 0,
      );
      // Adjust visual scale
      if (platSprite.setDisplaySize) {
        platSprite.setDisplaySize(newWidth, platSprite.displayHeight);
      }
    }
  }

  private shakePlatform(platform: Phaser.GameObjects.GameObject): void {
    const sprite = platform as Phaser.GameObjects.Sprite;
    if (!sprite.active || (sprite as any).__shaking) return;
    (sprite as any).__shaking = true;

    const origX = sprite.x;
    this.scene.tweens.add({
      targets: sprite,
      x: origX + 2,
      yoyo: true,
      repeat: 3,
      duration: 50,
      onComplete: () => {
        sprite.x = origX;
        (sprite as any).__shaking = false;
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMIT BIOME HAZARDS (5000m+)
  // ═══════════════════════════════════════════════════════════════════════

  // ─── Void Rifts ────────────────────────────────────────────────────

  private updateVoidRifts(
    delta: number,
    _altitude: number,
    cameraScrollY: number,
  ): void {
    this.voidRiftTimer += delta;

    // Spawn new rifts
    const activeCount = this.voidRifts.length;
    if (this.voidRiftTimer >= this.nextVoidRiftInterval && activeCount < VOID_RIFT.MAX_ACTIVE) {
      this.voidRiftTimer = 0;
      this.nextVoidRiftInterval = Phaser.Math.Between(VOID_RIFT.SPAWN_INTERVAL_MIN, VOID_RIFT.SPAWN_INTERVAL_MAX);
      this.spawnVoidRift(cameraScrollY);
    }

    // Update existing rifts
    for (const rift of this.voidRifts) {
      rift.elapsed += delta;
      const lifecycle = VOID_RIFT.LIFECYCLE;
      const halfLife = lifecycle / 2;

      // Calculate current radius based on lifecycle position
      // Grows for first half, shrinks for second half
      let radiusT: number;
      if (rift.elapsed < halfLife) {
        radiusT = rift.elapsed / halfLife;
      } else {
        radiusT = 1 - (rift.elapsed - halfLife) / halfLife;
      }
      rift.currentRadius = radiusT * VOID_RIFT.MAX_RADIUS;

      // Redraw rift
      rift.gfx.clear();
      if (rift.currentRadius > 2) {
        // Outer glow
        rift.gfx.fillStyle(0x440066, 0.3);
        rift.gfx.fillCircle(rift.x, rift.y, rift.currentRadius * 1.5);
        // Main rift
        rift.gfx.fillStyle(0x6600aa, 0.6);
        rift.gfx.fillCircle(rift.x, rift.y, rift.currentRadius);
        // Inner dark core
        rift.gfx.fillStyle(0x220033, 0.9);
        rift.gfx.fillCircle(rift.x, rift.y, rift.currentRadius * 0.5);
        // Swirling edge
        const swirl = Math.sin(rift.elapsed / 200) * 5;
        rift.gfx.lineStyle(2, 0x9933ff, 0.7);
        rift.gfx.strokeCircle(rift.x + swirl, rift.y, rift.currentRadius * 0.8);
      }

      // Pull players toward rift
      if (rift.currentRadius > 5) {
        for (const p of this.players) {
          if (!p.active) continue;
          const dist = Phaser.Math.Distance.Between(p.x, p.y, rift.x, rift.y);
          const pullRange = VOID_RIFT.MAX_RADIUS * 4;

          if (dist < pullRange && dist > 0) {
            const pullStrength = VOID_RIFT.PULL_FORCE * (1 - dist / pullRange) * (delta / 1000);
            const angle = Phaser.Math.Angle.Between(p.x, p.y, rift.x, rift.y);
            const pBody = p.body as Phaser.Physics.Arcade.Body;
            pBody.velocity.x += Math.cos(angle) * pullStrength;
            pBody.velocity.y += Math.sin(angle) * pullStrength;
          }

          // Damage on touching center
          if (dist < rift.currentRadius * 0.6) {
            p.takeDamage(VOID_RIFT.DAMAGE);
          }
        }
      }

      // Remove expired rifts
      if (rift.elapsed >= lifecycle) {
        rift.gfx.destroy();
      }
    }

    this.voidRifts = this.voidRifts.filter(r => r.gfx.active);
  }

  private spawnVoidRift(cameraScrollY: number): void {
    const camHeight = this.scene.cameras.main.height;
    const camWidth = this.scene.cameras.main.width;

    const x = Phaser.Math.Between(150, camWidth - 150);
    const y = cameraScrollY + Phaser.Math.Between(100, camHeight - 100);

    EventBus.emit("hazard-warning", { type: "void_rift", x, y });

    const gfx = this.scene.add.graphics();
    gfx.setDepth(92);

    this.voidRifts.push({
      gfx,
      elapsed: 0,
      x,
      y,
      currentRadius: 0,
    });
  }

  // ─── Gravity Flux ─────────────────────────────────────────────────

  private updateGravityFlux(
    delta: number,
    _altitude: number,
    cameraScrollY: number,
  ): void {
    this.gravityFluxTimer += delta;

    // Spawn new flux zones
    const activeCount = this.gravityFluxZones.filter(z => z.state === "active").length;
    if (this.gravityFluxTimer >= this.nextGravityFluxInterval && activeCount < GRAVITY_FLUX.MAX_ACTIVE) {
      this.gravityFluxTimer = 0;
      this.nextGravityFluxInterval = Phaser.Math.Between(GRAVITY_FLUX.SPAWN_INTERVAL_MIN, GRAVITY_FLUX.SPAWN_INTERVAL_MAX);
      this.spawnGravityFlux(cameraScrollY);
    }

    // Update existing zones
    for (const zone of this.gravityFluxZones) {
      zone.elapsed += delta;

      if (zone.state === "active") {
        // Upward-flowing particle effect
        for (const particle of zone.particles) {
          if (!particle.active) continue;
          particle.y -= 100 * (delta / 1000);
          particle.setAlpha(particle.alpha - 0.3 * (delta / 1000));

          if (particle.y < zone.y - zone.height / 2 || particle.alpha <= 0.05) {
            particle.setPosition(
              zone.x + Phaser.Math.Between(-zone.width / 2, zone.width / 2),
              zone.y + zone.height / 2,
            );
            particle.setAlpha(Phaser.Math.FloatBetween(0.3, 0.7));
          }
        }

        // Visual zone border
        const pulse = 0.2 + 0.15 * Math.sin((zone.elapsed / 300) * Math.PI);
        zone.gfx.clear();
        zone.gfx.fillStyle(0x8833ff, pulse);
        zone.gfx.fillRect(
          zone.x - zone.width / 2,
          zone.y - zone.height / 2,
          zone.width,
          zone.height,
        );
        zone.gfx.lineStyle(2, 0xaa55ff, pulse + 0.2);
        zone.gfx.strokeRect(
          zone.x - zone.width / 2,
          zone.y - zone.height / 2,
          zone.width,
          zone.height,
        );

        // Apply reversed gravity to players inside the zone
        const zoneBounds = new Phaser.Geom.Rectangle(
          zone.x - zone.width / 2,
          zone.y - zone.height / 2,
          zone.width,
          zone.height,
        );

        for (const p of this.players) {
          if (!p.active) continue;
          const pBounds = p.getBounds();
          if (Phaser.Geom.Rectangle.Overlaps(pBounds, zoneBounds)) {
            const pBody = p.body as Phaser.Physics.Arcade.Body;
            // Apply upward force to counter gravity and reverse it
            pBody.velocity.y += GRAVITY_FLUX.GRAVITY_FORCE * (delta / 1000);
          }
        }

        if (zone.elapsed >= GRAVITY_FLUX.DURATION) {
          zone.state = "cooldown";
          zone.elapsed = 0;
          zone.gfx.clear();
          for (const particle of zone.particles) {
            particle.setAlpha(0);
          }
        }
      } else if (zone.state === "cooldown") {
        if (zone.elapsed >= GRAVITY_FLUX.COOLDOWN) {
          // Reactivate at a new position
          this.cleanupGravityFlux(zone);
        }
      }
    }

    this.gravityFluxZones = this.gravityFluxZones.filter(z => z.gfx.active);
  }

  private spawnGravityFlux(cameraScrollY: number): void {
    const camHeight = this.scene.cameras.main.height;
    const camWidth = this.scene.cameras.main.width;

    const x = Phaser.Math.Between(200, camWidth - 200);
    const y = cameraScrollY + Phaser.Math.Between(150, camHeight - 150);

    EventBus.emit("hazard-warning", { type: "gravity_flux", x, y });

    const gfx = this.scene.add.graphics();
    gfx.setDepth(91);

    // Upward-flowing particles
    const particles: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < GRAVITY_FLUX.PARTICLE_COUNT; i++) {
      const px = x + Phaser.Math.Between(-GRAVITY_FLUX.ZONE_WIDTH / 2, GRAVITY_FLUX.ZONE_WIDTH / 2);
      const py = y + Phaser.Math.Between(-GRAVITY_FLUX.ZONE_HEIGHT / 2, GRAVITY_FLUX.ZONE_HEIGHT / 2);
      const particle = this.scene.add.circle(px, py, Phaser.Math.Between(2, 4), 0xaa66ff, Phaser.Math.FloatBetween(0.3, 0.7));
      particle.setDepth(92);
      particles.push(particle);
    }

    this.gravityFluxZones.push({
      gfx,
      particles,
      elapsed: 0,
      state: "active",
      x,
      y,
      width: GRAVITY_FLUX.ZONE_WIDTH,
      height: GRAVITY_FLUX.ZONE_HEIGHT,
    });
  }

  private cleanupGravityFlux(zone: GravityFluxZone): void {
    zone.gfx.destroy();
    for (const particle of zone.particles) {
      particle.destroy();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /** Find a random visible platform within camera bounds */
  private findVisiblePlatform(cameraScrollY: number): Phaser.GameObjects.GameObject | null {
    const camHeight = this.scene.cameras.main.height;
    const topEdge = cameraScrollY;
    const bottomEdge = cameraScrollY + camHeight;

    const visible: Phaser.GameObjects.GameObject[] = [];
    this.staticPlatforms.children.each((child: any) => {
      if (!child.active) return true;
      const body = child.body as Phaser.Physics.Arcade.StaticBody;
      if (body.y >= topEdge && body.y <= bottomEdge) {
        visible.push(child);
      }
      return true;
    });

    if (visible.length === 0) return null;
    return visible[Phaser.Math.Between(0, visible.length - 1)];
  }

  /** Check if a player is standing on a specific platform */
  private isPlayerOnPlatform(player: Player, platform: Phaser.GameObjects.GameObject): boolean {
    const pBody = player.body as Phaser.Physics.Arcade.Body;
    const platBody = platform.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;

    const playerBottom = pBody.y + pBody.height;
    const platTop = platBody.y;
    const onTop = Math.abs(playerBottom - platTop) < 10;
    const horizontalOverlap =
      pBody.x + pBody.width > platBody.x && pBody.x < platBody.x + platBody.width;

    return onTop && horizontalOverlap;
  }

  /** Find the platform a player is standing on */
  private findPlatformUnderPlayer(player: Player): Phaser.GameObjects.GameObject | null {
    let found: Phaser.GameObjects.GameObject | null = null;
    this.staticPlatforms.children.each((child: any) => {
      if (!child.active) return true;
      if (this.isPlayerOnPlatform(player, child)) {
        found = child;
        return false;
      }
      return true;
    });
    return found;
  }

  // ─── Cleanup ────────────────────────────────────────────────────────

  private cleanupOffScreen(cameraScrollY: number): void {
    const camHeight = this.scene.cameras.main.height;
    const bottomEdge = cameraScrollY + camHeight + 100;
    const topEdge = cameraScrollY - 200;

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

    // Clean up cave-in rocks that fall off screen
    this.caveInRockGroup.children.each((child: any) => {
      if (child.y > bottomEdge) {
        this.caveInRockGroup.remove(child, true, true);
      }
      return true;
    });
    this.caveInRocks = this.caveInRocks.filter(r => r.sprite.active);

    // Clean up biome hazard visuals that are far off screen
    // Poison pools
    for (const pool of this.poisonPools) {
      if (pool.y > bottomEdge || pool.y < topEdge) {
        this.cleanupPoisonPool(pool);
      }
    }
    this.poisonPools = this.poisonPools.filter(p => p.gfx.active);

    // Ice patches — remove ones whose platform scrolled off
    for (const patch of this.icePatches) {
      const platBody = patch.platformRef.body as Phaser.Physics.Arcade.StaticBody;
      if (platBody && (platBody.y > bottomEdge || platBody.y < topEdge)) {
        patch.overlay.destroy();
      }
    }
    this.icePatches = this.icePatches.filter(p => p.overlay.active);

    // Lava geysers off screen
    for (const geyser of this.lavaGeysers) {
      if (geyser.y > bottomEdge || geyser.y < topEdge) {
        this.cleanupLavaGeyser(geyser);
      }
    }
    this.lavaGeysers = this.lavaGeysers.filter(g => g.state !== "done");

    // Void rifts off screen
    for (const rift of this.voidRifts) {
      if (rift.y > bottomEdge || rift.y < topEdge) {
        rift.gfx.destroy();
      }
    }
    this.voidRifts = this.voidRifts.filter(r => r.gfx.active);

    // Gravity flux zones off screen
    for (const zone of this.gravityFluxZones) {
      if (zone.y > bottomEdge || zone.y < topEdge) {
        this.cleanupGravityFlux(zone);
      }
    }
    this.gravityFluxZones = this.gravityFluxZones.filter(z => z.gfx.active);
  }

  destroy(): void {
    this.destroyWindParticles();
    for (const indicator of this.warningIndicators) {
      indicator.destroy();
    }
    this.warningIndicators = [];
    this.stalactites.clear(true, true);

    // Clean up biome hazards
    for (const geyser of this.lavaGeysers) {
      if (geyser.warningGfx.active) geyser.warningGfx.destroy();
      if (geyser.columnSprite) {
        const timer = (geyser.columnSprite as any).__eruptionTimer;
        if (timer) timer.remove(false);
        geyser.columnSprite.destroy();
      }
    }
    this.lavaGeysers = [];

    for (const pool of this.poisonPools) {
      pool.gfx.destroy();
      pool.zone.destroy();
      for (const bubble of pool.bubbles) bubble.destroy();
    }
    this.poisonPools = [];

    for (const patch of this.icePatches) {
      patch.overlay.destroy();
    }
    this.icePatches = [];

    for (const warning of this.caveInWarnings) {
      for (const dust of warning.dustParticles) dust.destroy();
    }
    this.caveInWarnings = [];
    this.caveInRockGroup.clear(true, true);
    this.caveInRocks = [];

    for (const strike of this.lightningStrikes) {
      if (strike.telegraph.active) strike.telegraph.destroy();
      if (strike.strikeGfx?.active) strike.strikeGfx.destroy();
    }
    this.lightningStrikes = [];
    this.crumbleTrackers.clear();

    for (const rift of this.voidRifts) {
      rift.gfx.destroy();
    }
    this.voidRifts = [];

    for (const zone of this.gravityFluxZones) {
      zone.gfx.destroy();
      for (const particle of zone.particles) particle.destroy();
    }
    this.gravityFluxZones = [];
  }
}

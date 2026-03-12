import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { ItemDrop } from "../entities/ItemDrop";
import { PortalPlatform } from "../entities/PortalPlatform";
import { WindCurrent, type WindType } from "../entities/WindCurrent";
import { ITEMS } from "../config/ItemDatabase";
import { SPAWNING, WORLD } from "../config/GameConfig";
import type { ItemData, ItemQuality, ItemRarity } from "../config/ItemConfig";
import {
  ENEMY_REGISTRY,
  getEnemiesForAltitude,
  selectWeightedEnemy,
  type EnemyTier,
} from "../config/EnemyConfig";
import { EventBus } from "./EventBus";
import { CoopManager } from "./CoopManager";

// Wind current spawn configuration
const WIND_UPDRAFT_MIN_ALTITUDE = 300;
const WIND_CROSSWIND_MIN_ALTITUDE = 800;
const WIND_DOWNDRAFT_MIN_ALTITUDE = 1500;
const WIND_SPAWN_MIN_INTERVAL = 400; // meters between wind zones
const WIND_SPAWN_MAX_INTERVAL = 600;
const WIND_STRENGTH_MIN = 100;
const WIND_STRENGTH_MAX = 300;
const WIND_PERIODIC_CHANCE = 0.3; // 30% chance a wind zone is periodic

// Portal spawn configuration
const BLUE_PORTAL_MIN_ALTITUDE = 500;
const ORANGE_PORTAL_MIN_ALTITUDE = 2000;
const PORTAL_SPAWN_MIN_INTERVAL = 800;  // meters between portal pairs
const PORTAL_SPAWN_MAX_INTERVAL = 1200;

// Teleport offset ranges (in altitude meters)
const BLUE_TELEPORT_MIN = 200;
const BLUE_TELEPORT_MAX = 500;
const ORANGE_TELEPORT_MIN = 100;
const ORANGE_TELEPORT_MAX = 300;

export class SpawnManager {
  private scene: Phaser.Scene;
  private enemies: Phaser.Physics.Arcade.Group;
  private items: Phaser.Physics.Arcade.Group;
  private players: Player[];
  private spawnTimer: number = 0;

  // Backwards-compat getter: primary player
  private get player(): Player {
    return this.players[0];
  }
  private nextSpawnInterval: number;
  private staticPlatforms: Phaser.Physics.Arcade.StaticGroup;

  // Portal spawning state
  private portals: Phaser.Physics.Arcade.Group | null = null;
  private portalSpawnTimer: number = 0;
  private nextPortalSpawnInterval: number;
  private lastPortalSpawnAltitude: number = 0;

  // Wind current spawning state
  private windCurrents: Phaser.Physics.Arcade.StaticGroup | null = null;
  private lastWindSpawnAltitude: number = 0;
  private nextWindSpawnInterval: number;

  constructor(
    scene: Phaser.Scene,
    enemies: Phaser.Physics.Arcade.Group,
    items: Phaser.Physics.Arcade.Group,
    player: Player | Player[],
    staticPlatforms: Phaser.Physics.Arcade.StaticGroup,
  ) {
    this.scene = scene;
    this.enemies = enemies;
    this.items = items;
    this.players = Array.isArray(player) ? player : [player];
    this.staticPlatforms = staticPlatforms;
    this.nextSpawnInterval = this.getSpawnInterval(0);
    this.nextPortalSpawnInterval = Phaser.Math.Between(
      PORTAL_SPAWN_MIN_INTERVAL,
      PORTAL_SPAWN_MAX_INTERVAL,
    );
    this.nextWindSpawnInterval = Phaser.Math.Between(
      WIND_SPAWN_MIN_INTERVAL,
      WIND_SPAWN_MAX_INTERVAL,
    );
  }

  /** Set the portal physics group (created in MainScene). */
  setPortalGroup(group: Phaser.Physics.Arcade.Group): void {
    this.portals = group;
  }

  /** Get the portal physics group. */
  getPortalGroup(): Phaser.Physics.Arcade.Group | null {
    return this.portals;
  }

  /** Set the wind current static group (created in MainScene). */
  setWindGroup(group: Phaser.Physics.Arcade.StaticGroup): void {
    this.windCurrents = group;
  }

  /** Get the wind current static group. */
  getWindGroup(): Phaser.Physics.Arcade.StaticGroup | null {
    return this.windCurrents;
  }

  /** Update the players array (used by MainScene for co-op). */
  setPlayers(players: Player[]): void {
    this.players = players;
  }

  /** Returns the Y position of the highest (smallest Y) player, used for spawn/cleanup reference. */
  private getHighestPlayerY(): number {
    return Math.min(...this.players.map(p => p.y));
  }

  update(altitude: number, delta: number): void {
    this.spawnTimer += delta;

    if (this.spawnTimer >= this.nextSpawnInterval) {
      this.spawnTimer = 0;
      this.nextSpawnInterval = this.getSpawnInterval(altitude);

      const activeCount = this.enemies.countActive(true);
      if (activeCount < SPAWNING.MAX_ENEMIES_ON_SCREEN) {
        this.spawnEnemyNearPlayer(altitude);
      }
    }

    // Portal pair spawning (altitude-based)
    this.updatePortalSpawning(altitude);

    // Update all active portals (cooldown timers, particle animation)
    this.updatePortals(delta);

    // Wind current spawning (altitude-based)
    this.updateWindSpawning(altitude);

    // Update all active wind currents (periodic toggling, particles)
    this.updateWindCurrents(delta);

    this.cleanup(this.getHighestPlayerY());
  }

  private getSpawnInterval(altitude: number): number {
    // Spawn rate increases with altitude (shorter intervals)
    // Use a power curve (exponent 1.8) so spawns ramp up faster at higher altitudes
    const progress = Math.min(altitude / 10000, 1);
    const aggressiveProgress = Math.pow(progress, 1.8);
    const interval = Phaser.Math.Linear(
      SPAWNING.MAX_INTERVAL,
      SPAWNING.MIN_INTERVAL,
      aggressiveProgress,
    );
    // Add randomness (+-20%)
    return interval * Phaser.Math.FloatBetween(0.8, 1.2);
  }

  private getComposition(altitude: number): {
    basic: number;
    intermediate: number;
    advanced: number;
    elite: number;
  } {
    const tiers = Object.values(SPAWNING.COMPOSITION);
    for (const tier of tiers) {
      if (altitude < tier.maxAltitude) {
        return {
          basic: tier.basic,
          intermediate: tier.intermediate,
          advanced: tier.advanced,
          elite: tier.elite,
        };
      }
    }
    const last = tiers[tiers.length - 1];
    return {
      basic: last.basic,
      intermediate: last.intermediate,
      advanced: last.advanced,
      elite: last.elite,
    };
  }

  private selectEnemyType(altitude: number): { type: string; isElite: boolean } {
    const comp = this.getComposition(altitude);
    const roll = Math.random();

    // Determine which tier to pick from
    let tier: EnemyTier;
    if (roll < comp.basic) {
      tier = "basic";
    } else if (roll < comp.basic + comp.intermediate) {
      tier = "intermediate";
    } else if (roll < comp.basic + comp.intermediate + comp.advanced) {
      tier = "advanced";
    } else {
      tier = "elite";
    }

    const isElite = tier === "elite";

    // Get eligible enemies for this tier and altitude
    const eligible = getEnemiesForAltitude(tier, altitude);

    // Fallback: if no enemies for the selected tier, try basic
    if (eligible.length === 0) {
      const fallback = getEnemiesForAltitude("basic", altitude);
      const picked = selectWeightedEnemy(fallback);
      return { type: picked?.id ?? "crawler", isElite };
    }

    const picked = selectWeightedEnemy(eligible);
    return { type: picked?.id ?? "crawler", isElite };
  }

  private spawnEnemyNearPlayer(altitude: number): void {
    // Find a platform near the player to spawn on
    const camY = this.scene.cameras.main.scrollY;
    const camH = this.scene.cameras.main.height;
    const viewTop = camY;
    const viewBottom = camY + camH;

    let spawnX = 0;
    let spawnY = 0;
    let foundPlatform = false;

    // Try to find a visible platform away from player
    this.staticPlatforms.children.each((child: any) => {
      if (foundPlatform) return true;

      const plat = child as Phaser.Physics.Arcade.Sprite;
      if (plat.y < viewTop || plat.y > viewBottom) return true;

      // Check distance from all players; skip platform if too close to any player
      const tooClose = this.players.some(p =>
        Phaser.Math.Distance.Between(p.x, p.y, plat.x, plat.y) < SPAWNING.MIN_DISTANCE_FROM_PLAYER
      );
      if (tooClose) return true;

      spawnX = plat.x + Phaser.Math.Between(-50, 50);
      spawnY = plat.y - 40;
      foundPlatform = true;
      return true;
    });

    if (!foundPlatform) {
      // Fallback: spawn at screen edge
      spawnX =
        Math.random() > 0.5
          ? Phaser.Math.Between(100, 400)
          : Phaser.Math.Between(1500, 1800);
      spawnY = camY + Phaser.Math.Between(100, 400);
    }

    const { type, isElite } = this.selectEnemyType(altitude);
    if (isElite) {
      this.spawnEliteWithWarning(type, spawnX, spawnY, altitude);
    } else {
      this.spawnEnemy(spawnX, spawnY, type, false, altitude);
    }
  }

  private spawnEliteWithWarning(enemyType: string, x: number, y: number, altitude: number = 0): void {
    // Emit hazard-warning event for UI systems
    EventBus.emit('hazard-warning', { type: 'elite', x, y });

    // Create warning "!" indicator at the spawn location
    const warning = this.scene.add.text(x, y - 30, '!', {
      fontSize: '32px',
      color: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    warning.setDepth(100);

    // Silver/red pulsing circle behind the "!"
    const circle = this.scene.add.graphics();
    circle.setDepth(99);
    const drawCircle = (scale: number, alpha: number) => {
      circle.clear();
      circle.lineStyle(2, 0xccccff, alpha);
      circle.strokeCircle(x, y - 30, 24 * scale);
      circle.lineStyle(1, 0xff4444, alpha * 0.6);
      circle.strokeCircle(x, y - 30, 28 * scale);
    };
    drawCircle(1, 0.8);

    // Pulsing tween on the warning text
    this.scene.tweens.add({
      targets: warning,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 200,
      yoyo: true,
      repeat: 4,
    });

    // Pulsing circle animation via tween on a dummy object
    const pulseObj = { scale: 1, alpha: 0.8 };
    this.scene.tweens.add({
      targets: pulseObj,
      scale: 1.3,
      alpha: 0.4,
      duration: 200,
      yoyo: true,
      repeat: 4,
      onUpdate: () => drawCircle(pulseObj.scale, pulseObj.alpha),
    });

    // Spawn the actual elite enemy after a 1-second delay
    this.scene.time.delayedCall(1000, () => {
      warning.destroy();
      circle.destroy();
      this.spawnEnemy(x, y, enemyType, true, altitude);
    });
  }

  spawnEnemy(x: number, y: number, type: string = "crawler", elite: boolean = false, altitude: number = 0): Enemy {
    const def = ENEMY_REGISTRY[type];
    let enemy: Enemy;

    if (def) {
      enemy = def.factory(this.scene, x, y, this.players);
    } else {
      // Fallback to crawler if type not found
      enemy = ENEMY_REGISTRY["crawler"].factory(this.scene, x, y, this.players);
    }

    // Apply altitude-based stat scaling before elite modifiers
    if (altitude > 0) {
      enemy.applyAltitudeScaling(altitude);
    }

    if (elite) {
      enemy.applyElite();
    }

    // Apply co-op HP scaling
    if (CoopManager.isActive()) {
      const mult = CoopManager.getEnemyHPMultiplier();
      enemy.health = Math.ceil(enemy.health * mult);
      enemy.maxHealth = Math.ceil(enemy.maxHealth * mult);
    }

    this.enemies.add(enemy);
    return enemy;
  }

  private assignQuality(itemData: ItemData): ItemData {
    if (itemData.type !== 'SILVER') return itemData;

    // Lucky Dice ability: improve quality rolls (any player having the ability counts)
    const hasLuckyDice = this.players.some(p => p.abilities.has('lucky_dice'));
    const hasStackedLuckyDice = this.players.some(p => p.stackedAbilities.has('lucky_dice'));

    // Stacked Lucky Dice: always Pristine
    if (hasStackedLuckyDice) {
      return { ...itemData, quality: 'PRISTINE' as ItemQuality };
    }

    const roll = Math.random();
    let quality: ItemQuality;

    if (hasLuckyDice) {
      // Lucky Dice: 0% Damaged, 30% Normal, 70% Pristine
      if (roll < 0.3) quality = 'NORMAL';
      else quality = 'PRISTINE';
    } else {
      // Default: 20% Damaged, 50% Normal, 30% Pristine
      if (roll < 0.2) quality = 'DAMAGED';
      else if (roll < 0.7) quality = 'NORMAL';
      else quality = 'PRISTINE';
    }

    return { ...itemData, quality };
  }

  spawnItem(x: number, y: number, itemId: string): ItemDrop | null {
    const baseData = ITEMS[itemId];
    if (!baseData) return null;

    const itemData = this.assignQuality(baseData);
    const item = new ItemDrop(this.scene, x, y, itemData);
    this.items.add(item);
    return item;
  }

  spawnRandomItem(x: number, y: number, altitude?: number): ItemDrop | null {
    const alt = altitude ?? 0;
    const selectedItem = this.selectSilverItemByAltitude(alt);
    if (!selectedItem) return null;
    return this.spawnItem(x, y, selectedItem.id);
  }

  /**
   * Selects a silver item weighted by rarity based on current altitude.
   * At lower altitudes: favors COMMON (T1) items.
   * At higher altitudes: favors UNCOMMON/RARE (T2/T3) items.
   */
  private selectSilverItemByAltitude(altitude: number): ItemData | null {
    const silverItems = Object.values(ITEMS).filter(
      (i: ItemData) => i.type === "SILVER",
    );
    if (silverItems.length === 0) return null;

    // Determine rarity weights based on altitude
    let commonWeight: number, uncommonWeight: number, rareWeight: number;
    if (altitude > 6000) {
      commonWeight = 15; uncommonWeight = 35; rareWeight = 50;
    } else if (altitude > 3000) {
      commonWeight = 30; uncommonWeight = 40; rareWeight = 30;
    } else {
      commonWeight = 60; uncommonWeight = 30; rareWeight = 10;
    }

    const rarityWeights: Record<ItemRarity, number> = {
      'COMMON': commonWeight,
      'UNCOMMON': uncommonWeight,
      'RARE': rareWeight,
      'LEGENDARY': 0, // Silver items don't use LEGENDARY
    };

    // Build weighted pool
    const weightedPool: { item: ItemData; weight: number }[] = [];
    for (const item of silverItems) {
      const weight = rarityWeights[item.rarity] || 0;
      if (weight > 0) {
        weightedPool.push({ item, weight });
      }
    }

    if (weightedPool.length === 0) return null;

    // Weighted random selection
    const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of weightedPool) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.item;
      }
    }

    // Fallback to last item
    return weightedPool[weightedPool.length - 1].item;
  }

  // ─── Portal Spawning ──────────────────────────────────────────────────

  private updatePortalSpawning(altitude: number): void {
    if (!this.portals) return;

    // Determine if we should spawn a portal pair based on altitude thresholds
    const canSpawnBlue = altitude >= BLUE_PORTAL_MIN_ALTITUDE;
    const canSpawnOrange = altitude >= ORANGE_PORTAL_MIN_ALTITUDE;
    if (!canSpawnBlue) return;

    // Check if we've traveled enough altitude since last portal
    const altitudeSinceLastPortal = altitude - this.lastPortalSpawnAltitude;
    if (altitudeSinceLastPortal < this.nextPortalSpawnInterval) return;

    // Decide portal type: blue only below 2000m, weighted random above
    let portalType: "blue" | "orange";
    if (!canSpawnOrange) {
      portalType = "blue";
    } else {
      // 60% blue, 40% orange at higher altitudes
      portalType = Math.random() < 0.6 ? "blue" : "orange";
    }

    this.spawnPortalPair(portalType);

    this.lastPortalSpawnAltitude = altitude;
    this.nextPortalSpawnInterval = Phaser.Math.Between(
      PORTAL_SPAWN_MIN_INTERVAL,
      PORTAL_SPAWN_MAX_INTERVAL,
    );
  }

  private spawnPortalPair(portalType: "blue" | "orange"): void {
    if (!this.portals) return;

    // Place the entry portal near the player's current altitude
    const camY = this.scene.cameras.main.scrollY;
    const camH = this.scene.cameras.main.height;

    // Entry portal: spawn above the current camera view so the player encounters it naturally
    const entryX = Phaser.Math.Between(200, WORLD.WIDTH - 200);
    const entryY = camY - Phaser.Math.Between(100, 300);

    // Calculate exit offset based on portal type
    let exitOffsetY: number;
    if (portalType === "blue") {
      // Blue: exit is ABOVE entry (y decreases = higher altitude)
      const altitudeOffset = Phaser.Math.Between(BLUE_TELEPORT_MIN, BLUE_TELEPORT_MAX);
      exitOffsetY = -(altitudeOffset * WORLD.ALTITUDE_SCALE);
    } else {
      // Orange: exit is BELOW entry (y increases = lower altitude, for shortcuts down)
      const altitudeOffset = Phaser.Math.Between(ORANGE_TELEPORT_MIN, ORANGE_TELEPORT_MAX);
      exitOffsetY = altitudeOffset * WORLD.ALTITUDE_SCALE;
    }

    const exitX = Phaser.Math.Between(200, WORLD.WIDTH - 200);
    const exitY = entryY + exitOffsetY;

    // Create the portal pair
    const entryPortal = new PortalPlatform(this.scene, entryX, entryY, portalType);
    const exitPortal = new PortalPlatform(
      this.scene,
      exitX,
      exitY,
      portalType,
    );

    // Link them
    entryPortal.setLinkedPortal(exitPortal);
    exitPortal.setLinkedPortal(entryPortal);

    // Add to physics group
    this.portals.add(entryPortal);
    this.portals.add(exitPortal);
  }

  private updatePortals(delta: number): void {
    if (!this.portals) return;

    this.portals.children.each((child: any) => {
      const portal = child as PortalPlatform;
      if (portal.active && portal.update) {
        portal.update(delta);
      }
      return true;
    });
  }

  // ─── Wind Current Spawning ────────────────────────────────────────

  private updateWindSpawning(altitude: number): void {
    if (!this.windCurrents) return;

    // Need at least updraft altitude threshold
    if (altitude < WIND_UPDRAFT_MIN_ALTITUDE) return;

    // Check if we've traveled enough altitude since last wind spawn
    const altitudeSinceLastWind = altitude - this.lastWindSpawnAltitude;
    if (altitudeSinceLastWind < this.nextWindSpawnInterval) return;

    // Select wind type based on altitude and weighted distribution
    const windType = this.selectWindType(altitude);
    if (!windType) return;

    this.spawnWindCurrent(windType);

    this.lastWindSpawnAltitude = altitude;
    this.nextWindSpawnInterval = Phaser.Math.Between(
      WIND_SPAWN_MIN_INTERVAL,
      WIND_SPAWN_MAX_INTERVAL,
    );
  }

  private selectWindType(altitude: number): WindType | null {
    // Build weighted pool based on altitude thresholds
    // 50% updraft, 25% crosswind, 25% downdraft (when available)
    const pool: { type: WindType; weight: number }[] = [];

    if (altitude >= WIND_UPDRAFT_MIN_ALTITUDE) {
      pool.push({ type: "updraft", weight: 50 });
    }
    if (altitude >= WIND_CROSSWIND_MIN_ALTITUDE) {
      pool.push({ type: "crosswind", weight: 25 });
    }
    if (altitude >= WIND_DOWNDRAFT_MIN_ALTITUDE) {
      pool.push({ type: "downdraft", weight: 25 });
    }

    if (pool.length === 0) return null;

    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) return entry.type;
    }

    return pool[pool.length - 1].type;
  }

  private spawnWindCurrent(windType: WindType): void {
    if (!this.windCurrents) return;

    const camY = this.scene.cameras.main.scrollY;

    // Determine zone dimensions based on type
    let zoneWidth: number;
    let zoneHeight: number;
    switch (windType) {
      case "updraft":
        zoneWidth = Phaser.Math.Between(48, 96);
        zoneHeight = Phaser.Math.Between(192, 320);
        break;
      case "downdraft":
        zoneWidth = Phaser.Math.Between(48, 96);
        zoneHeight = Phaser.Math.Between(192, 320);
        break;
      case "crosswind":
        zoneWidth = Phaser.Math.Between(192, 320);
        zoneHeight = Phaser.Math.Between(96, 160);
        break;
    }

    // Spawn position: above camera view, random X
    const spawnX = Phaser.Math.Between(
      zoneWidth / 2 + 50,
      WORLD.WIDTH - zoneWidth / 2 - 50,
    );
    const spawnY = camY - Phaser.Math.Between(100, 400);

    // Random strength
    const strength = Phaser.Math.Between(WIND_STRENGTH_MIN, WIND_STRENGTH_MAX);

    // 30% chance periodic
    const isPeriodic = Math.random() < WIND_PERIODIC_CHANCE;

    const windCurrent = new WindCurrent(
      this.scene,
      spawnX,
      spawnY,
      zoneWidth,
      zoneHeight,
      windType,
      strength,
      isPeriodic,
    );

    this.windCurrents.add(windCurrent);
  }

  private updateWindCurrents(delta: number): void {
    if (!this.windCurrents) return;

    this.windCurrents.children.each((child: any) => {
      const wind = child as WindCurrent;
      if (wind.active && wind.update) {
        wind.update(delta);
      }
      return true;
    });
  }

  private cleanup(playerY: number): void {
    this.enemies.children.each((child: any) => {
      if (child.y > playerY + SPAWNING.CLEANUP_BUFFER) {
        this.enemies.remove(child, true, true);
      }
      return true;
    });

    this.items.children.each((child: any) => {
      if (child.y > playerY + SPAWNING.CLEANUP_BUFFER) {
        this.items.remove(child, true, true);
      }
      return true;
    });

    // Clean up portal platforms that are far below the camera
    if (this.portals) {
      this.portals.children.each((child: any) => {
        if (child.y > playerY + SPAWNING.CLEANUP_BUFFER) {
          this.portals!.remove(child, true, true);
        }
        return true;
      });
    }

    // Clean up wind currents that are far below the camera
    if (this.windCurrents) {
      this.windCurrents.children.each((child: any) => {
        if (child.y > playerY + SPAWNING.CLEANUP_BUFFER) {
          const wind = child as WindCurrent;
          wind.destroy();
        }
        return true;
      });
    }
  }
}

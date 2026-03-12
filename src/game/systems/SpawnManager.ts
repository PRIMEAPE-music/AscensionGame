import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { ItemDrop } from "../entities/ItemDrop";
import { ITEMS } from "../config/ItemDatabase";
import { SPAWNING } from "../config/GameConfig";
import type { ItemData, ItemQuality, ItemRarity } from "../config/ItemConfig";
import {
  ENEMY_REGISTRY,
  getEnemiesForAltitude,
  selectWeightedEnemy,
  type EnemyTier,
} from "../config/EnemyConfig";
import { EventBus } from "./EventBus";

export class SpawnManager {
  private scene: Phaser.Scene;
  private enemies: Phaser.Physics.Arcade.Group;
  private items: Phaser.Physics.Arcade.Group;
  private player: Player;
  private spawnTimer: number = 0;
  private nextSpawnInterval: number;
  private staticPlatforms: Phaser.Physics.Arcade.StaticGroup;

  constructor(
    scene: Phaser.Scene,
    enemies: Phaser.Physics.Arcade.Group,
    items: Phaser.Physics.Arcade.Group,
    player: Player,
    staticPlatforms: Phaser.Physics.Arcade.StaticGroup,
  ) {
    this.scene = scene;
    this.enemies = enemies;
    this.items = items;
    this.player = player;
    this.staticPlatforms = staticPlatforms;
    this.nextSpawnInterval = this.getSpawnInterval(0);
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

    this.cleanup(this.player.y);
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

      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        plat.x,
        plat.y,
      );
      if (dist < SPAWNING.MIN_DISTANCE_FROM_PLAYER) return true;

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
      enemy = def.factory(this.scene, x, y, this.player);
    } else {
      // Fallback to crawler if type not found
      enemy = ENEMY_REGISTRY["crawler"].factory(this.scene, x, y, this.player);
    }

    // Apply altitude-based stat scaling before elite modifiers
    if (altitude > 0) {
      enemy.applyAltitudeScaling(altitude);
    }

    if (elite) {
      enemy.applyElite();
    }

    this.enemies.add(enemy);
    return enemy;
  }

  private assignQuality(itemData: ItemData): ItemData {
    if (itemData.type !== 'SILVER') return itemData;
    const roll = Math.random();
    let quality: ItemQuality;
    if (roll < 0.2) quality = 'DAMAGED';
    else if (roll < 0.7) quality = 'NORMAL';
    else quality = 'PRISTINE';
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
  }
}

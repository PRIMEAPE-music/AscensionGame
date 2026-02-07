import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { ImpCrawler } from "../entities/ImpCrawler";
import { ShadowBat } from "../entities/ShadowBat";
import { ItemDrop } from "../entities/ItemDrop";
import { ITEMS } from "../config/ItemDatabase";
import { SPAWNING } from "../config/GameConfig";
import type { ItemData } from "../config/ItemConfig";

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
    const progress = Math.min(altitude / 10000, 1);
    const interval = Phaser.Math.Linear(
      SPAWNING.MAX_INTERVAL,
      SPAWNING.MIN_INTERVAL,
      progress,
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

  private selectEnemyType(altitude: number): string {
    const comp = this.getComposition(altitude);
    const roll = Math.random();

    if (roll < comp.basic) return "crawler";
    if (roll < comp.basic + comp.intermediate) return "bat";
    // Advanced and elite types will use bat for now until more enemies are implemented
    return "bat";
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

    const type = this.selectEnemyType(altitude);
    this.spawnEnemy(spawnX, spawnY, type);
  }

  spawnEnemy(x: number, y: number, type: string = "crawler"): Enemy {
    let enemy: Enemy;

    switch (type) {
      case "bat":
        enemy = new ShadowBat(this.scene, x, y, this.player);
        break;
      case "crawler":
      default:
        enemy = new ImpCrawler(this.scene, x, y, this.player);
        break;
    }

    this.enemies.add(enemy);
    return enemy;
  }

  spawnItem(x: number, y: number, itemId: string): ItemDrop | null {
    const itemData = ITEMS[itemId];
    if (!itemData) return null;

    const item = new ItemDrop(this.scene, x, y, itemData);
    this.items.add(item);
    return item;
  }

  spawnRandomItem(x: number, y: number): ItemDrop | null {
    const silverItems = Object.values(ITEMS).filter(
      (i: ItemData) => i.type === "SILVER",
    );
    if (silverItems.length === 0) return null;

    const item = silverItems[Math.floor(Math.random() * silverItems.length)];
    return this.spawnItem(x, y, item.id);
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

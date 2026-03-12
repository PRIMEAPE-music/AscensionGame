import Phaser from "phaser";
import { EventBus } from "./EventBus";
import { ITEMS } from "../config/ItemDatabase";
import { ENEMY_REGISTRY } from "../config/EnemyConfig";
import type { ItemData } from "../config/ItemConfig";

// Secret room types
export type SecretRoomType = "treasure" | "challenge" | "shrine" | "lore";

const SECRET_ROOM_TYPES: SecretRoomType[] = ["treasure", "challenge", "shrine", "lore"];

// Lore fragments about the Ascension world
const LORE_FRAGMENTS: Array<{ title: string; text: string }> = [
  {
    title: "The First Ascension",
    text: "Long before the tower pierced the heavens, there was only the Pit. The first climbers were not heroes -- they were desperate souls fleeing the darkness below. They carved handholds into the rock with bleeding fingers, ascending not for glory, but survival.",
  },
  {
    title: "The Architect's Regret",
    text: "The one who built the tower never intended it as a trial. It was meant to be a bridge between worlds, a stairway to reunion. But the demons twisted its purpose, filling each floor with horrors. The Architect's tears are said to still flow within the walls.",
  },
  {
    title: "Why They Climb",
    text: "Every climber has a reason. Some seek power. Some seek answers. Some seek those they lost. At the summit, they say, all truths are revealed and all debts are settled. But no one has ever returned from the top to confirm this.",
  },
  {
    title: "The Living Tower",
    text: "The walls breathe. The platforms shift. The tower is not mere stone and mortar -- it is alive. It watches each climber, learns their patterns, and reshapes itself to challenge them. Those who adapt, ascend. Those who don't become part of the walls.",
  },
  {
    title: "Essence of the Fallen",
    text: "The shimmering essence that falls from slain demons is not merely currency. It is the condensed memories of all who failed before. Each mote carries a fragment of knowledge, a whisper of technique. To collect essence is to inherit the wisdom of the dead.",
  },
  {
    title: "The Cracked Walls",
    text: "Not all secrets are hidden behind locked doors. The tower's walls crack under the weight of their own mysteries. Those who strike at weakness rather than strength discover that the most valuable treasures are found in places others overlook.",
  },
  {
    title: "Beyond the Summit",
    text: "The demons do not guard the tower by choice. They are prisoners too, bound to its floors by ancient chains of duty. Some say the true enemy waits beyond the summit, in a place where neither demon nor mortal was ever meant to tread.",
  },
  {
    title: "The Endless Climb",
    text: "There are those who reach the summit and choose to descend, only to climb again. Not from failure, but from purpose. Each ascent strengthens the climber, and each descent reveals paths unseen before. The journey, they learn, was always the destination.",
  },
];

// Shrine buff definitions
const SHRINE_BUFFS = [
  { id: "damage_boost", label: "+15% Damage", description: "Increases all damage dealt by 15% for the rest of this run." },
  { id: "speed_boost", label: "+15% Speed", description: "Increases movement speed by 15% for the rest of this run." },
  { id: "hp_boost", label: "+2 Max HP", description: "Permanently increases maximum health by 2 for this run." },
];

export const SecretRoomManager = {
  _roomsFound: 0,
  _activeChallengeTimer: null as Phaser.Time.TimerEvent | null,
  _activeChallengeEnemies: [] as Phaser.GameObjects.GameObject[],
  _challengeTimeRemaining: 0,
  _challengeUpdateCallback: null as (() => void) | null,

  reset(): void {
    this._roomsFound = 0;
    this._activeChallengeTimer = null;
    this._activeChallengeEnemies = [];
    this._challengeTimeRemaining = 0;
    this._challengeUpdateCallback = null;
  },

  /**
   * Pick a random secret room type.
   */
  pickRoomType(): SecretRoomType {
    return SECRET_ROOM_TYPES[Math.floor(Math.random() * SECRET_ROOM_TYPES.length)];
  },

  /**
   * Generate and activate a secret room when a cracked wall is broken.
   */
  generateRoom(
    type: SecretRoomType,
    scene: Phaser.Scene,
    x: number,
    y: number,
    spawnManager: any, // SpawnManager reference
    enemies: Phaser.Physics.Arcade.Group,
    player: any, // Player reference
  ): void {
    this._roomsFound++;

    // Emit the found event
    EventBus.emit("secret-room-found", { type, x, y });

    switch (type) {
      case "treasure":
        this.spawnTreasureRoom(scene, x, y, spawnManager);
        break;
      case "challenge":
        this.spawnChallengeRoom(scene, x, y, spawnManager, enemies, player);
        break;
      case "shrine":
        this.spawnShrineRoom(scene, x, y);
        break;
      case "lore":
        this.spawnLoreRoom(scene, x, y);
        break;
    }
  },

  /**
   * Treasure Room: Spawn 3 items guaranteed rare+ rarity.
   */
  spawnTreasureRoom(
    scene: Phaser.Scene,
    x: number,
    y: number,
    spawnManager: any,
  ): void {
    // Select 3 rare+ silver items
    const rareItems = Object.values(ITEMS).filter(
      (i: ItemData) => i.type === "SILVER" && (i.rarity === "RARE" || i.rarity === "UNCOMMON"),
    );

    if (rareItems.length === 0) return;

    // Visual: golden glow burst at the location
    this._spawnRoomRevealEffect(scene, x, y, 0xffd700);

    // Spawn 3 items spread out horizontally
    for (let i = 0; i < 3; i++) {
      const item = rareItems[Math.floor(Math.random() * rareItems.length)];
      const offsetX = (i - 1) * 60; // -60, 0, +60
      spawnManager.spawnItem(x + offsetX, y - 40, item.id);
    }

    // Floating "TREASURE!" text
    this._showRoomText(scene, x, y - 80, "TREASURE ROOM", 0xffd700);
  },

  /**
   * Challenge Room: Spawn 3-5 elite enemies with a 30s timer.
   */
  spawnChallengeRoom(
    scene: Phaser.Scene,
    x: number,
    y: number,
    spawnManager: any,
    enemies: Phaser.Physics.Arcade.Group,
    player: any,
  ): void {
    const enemyCount = Phaser.Math.Between(3, 5);
    const timeLimit = 30000; // 30 seconds

    // Visual: red glow burst
    this._spawnRoomRevealEffect(scene, x, y, 0xff4444);
    this._showRoomText(scene, x, y - 80, "CHALLENGE ROOM", 0xff4444);

    // Emit challenge start event (for HUD timer)
    EventBus.emit("secret-room-challenge-start", { enemyCount, timeLimit: timeLimit / 1000 });

    // Determine which enemy types are available at this altitude
    const altitude = Math.max(0, (1080 - y) / 1.0); // Rough altitude calc
    const availableTypes = Object.entries(ENEMY_REGISTRY)
      .filter(([_, def]) => def.minAltitude <= altitude && def.tier !== "elite")
      .map(([key]) => key);
    const fallbackTypes = ["crawler", "bat", "hound"];
    const typesToUse = availableTypes.length >= 2 ? availableTypes : fallbackTypes;

    // Track spawned enemies for this challenge
    const challengeEnemies: Phaser.GameObjects.GameObject[] = [];

    // Spawn enemies around the location
    for (let i = 0; i < enemyCount; i++) {
      const offsetX = Phaser.Math.Between(-150, 150);
      const offsetY = Phaser.Math.Between(-50, 50);
      const type = typesToUse[Math.floor(Math.random() * typesToUse.length)];
      const enemy = spawnManager.spawnEnemy(x + offsetX, y + offsetY, type, true, altitude);
      challengeEnemies.push(enemy);
    }

    this._activeChallengeEnemies = challengeEnemies;
    this._challengeTimeRemaining = timeLimit;

    // Timer countdown: check every 100ms
    const updateCallback = () => {
      this._challengeTimeRemaining -= 100;

      // Emit timer update every second
      if (this._challengeTimeRemaining % 1000 < 100) {
        EventBus.emit("secret-room-challenge-timer", {
          remaining: Math.max(0, Math.ceil(this._challengeTimeRemaining / 1000)),
        });
      }

      // Check if all enemies are dead
      const allDead = this._activeChallengeEnemies.every(
        (e: any) => !e.active,
      );

      if (allDead) {
        // Victory! Spawn a gold-tier reward
        this._completeChallengeRoom(scene, x, y, spawnManager, true);
        return;
      }

      if (this._challengeTimeRemaining <= 0) {
        // Time's up — despawn remaining enemies, no reward
        this._completeChallengeRoom(scene, x, y, spawnManager, false);
        return;
      }
    };

    this._challengeUpdateCallback = updateCallback;

    // Use a repeating timer event
    this._activeChallengeTimer = scene.time.addEvent({
      delay: 100,
      callback: updateCallback,
      callbackScope: this,
      loop: true,
    });
  },

  _completeChallengeRoom(
    scene: Phaser.Scene,
    x: number,
    y: number,
    spawnManager: any,
    success: boolean,
  ): void {
    // Stop the timer
    if (this._activeChallengeTimer) {
      this._activeChallengeTimer.remove(false);
      this._activeChallengeTimer = null;
    }
    this._challengeUpdateCallback = null;

    if (success) {
      // Spawn a gold/legendary reward — pick a rare item
      const rareItems = Object.values(ITEMS).filter(
        (i: ItemData) => i.type === "SILVER" && i.rarity === "RARE",
      );
      if (rareItems.length > 0) {
        const item = rareItems[Math.floor(Math.random() * rareItems.length)];
        spawnManager.spawnItem(x, y - 40, item.id);
        // Bonus: spawn a second rare item
        const item2 = rareItems[Math.floor(Math.random() * rareItems.length)];
        spawnManager.spawnItem(x + 50, y - 40, item2.id);
      }
      this._showRoomText(scene, x, y - 100, "CHALLENGE COMPLETE!", 0x44ff88);
    } else {
      // Despawn remaining enemies
      for (const e of this._activeChallengeEnemies) {
        if ((e as any).active) {
          // Fade out and destroy
          scene.tweens.add({
            targets: e,
            alpha: 0,
            duration: 300,
            onComplete: () => (e as any).destroy(),
          });
        }
      }
      this._showRoomText(scene, x, y - 100, "TIME'S UP!", 0xff4444);
    }

    this._activeChallengeEnemies = [];
    EventBus.emit("secret-room-challenge-complete", { success });
  },

  /**
   * Shrine Room: Show a React overlay with 3 buff choices.
   */
  spawnShrineRoom(scene: Phaser.Scene, x: number, y: number): void {
    // Visual: blue-white glow
    this._spawnRoomRevealEffect(scene, x, y, 0x88ccff);
    this._showRoomText(scene, x, y - 80, "SHRINE ROOM", 0x88ccff);

    // Create a glowing shrine visual at the location
    const shrine = scene.add.rectangle(x, y - 20, 50, 60, 0x4488cc);
    shrine.setAlpha(0.7);
    shrine.setDepth(2);

    // Pulsing glow
    scene.tweens.add({
      targets: shrine,
      alpha: 1,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Shuffle and pick 3 buffs (there are exactly 3, but shuffle for variety)
    const shuffled = [...SHRINE_BUFFS].sort(() => Math.random() - 0.5);

    // Pause the scene and show the UI overlay
    scene.scene.pause();
    EventBus.emit("secret-room-shrine-open", { buffs: shuffled });
  },

  /**
   * Apply a shrine buff to the player.
   */
  applyShrineChoice(buffId: string, player: any): void {
    switch (buffId) {
      case "damage_boost": {
        const current = player.statModifiers.get("attackDamage") || 0;
        player.statModifiers.set("attackDamage", current + 0.15);
        break;
      }
      case "speed_boost": {
        const current = player.statModifiers.get("moveSpeed") || 0;
        player.statModifiers.set("moveSpeed", current + 0.15);
        break;
      }
      case "hp_boost": {
        player.maxHealth += 2;
        player.health += 2;
        EventBus.emit("health-change", {
          health: player.health,
          maxHealth: player.maxHealth,
        });
        break;
      }
    }
  },

  /**
   * Lore Room: Show a lore text popup and award 50 essence.
   */
  spawnLoreRoom(scene: Phaser.Scene, x: number, y: number): void {
    // Visual: soft amber glow
    this._spawnRoomRevealEffect(scene, x, y, 0xccaa66);
    this._showRoomText(scene, x, y - 80, "LORE ROOM", 0xccaa66);

    // Pick a random lore fragment
    const lore = LORE_FRAGMENTS[Math.floor(Math.random() * LORE_FRAGMENTS.length)];

    // Pause scene and show lore overlay
    scene.scene.pause();
    EventBus.emit("secret-room-lore-open", { text: lore.text, title: lore.title });
  },

  /**
   * Visual: burst of particles at the reveal location.
   */
  _spawnRoomRevealEffect(
    scene: Phaser.Scene,
    x: number,
    y: number,
    color: number,
  ): void {
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      const size = 2 + Math.random() * 4;
      const particle = scene.add.rectangle(
        x + (Math.random() - 0.5) * 20,
        y + (Math.random() - 0.5) * 20,
        size,
        size,
        color,
      );
      particle.setAlpha(0.9);
      particle.setDepth(5);

      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 100;
      const targetX = x + Math.cos(angle) * dist;
      const targetY = y + Math.sin(angle) * dist;

      scene.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 600 + Math.random() * 400,
        ease: "Power2",
        onComplete: () => particle.destroy(),
      });
    }
  },

  /**
   * Show floating room type text above the location.
   */
  _showRoomText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    color: number,
  ): void {
    const colorStr = "#" + color.toString(16).padStart(6, "0");
    const label = scene.add.text(x, y, text, {
      fontSize: "22px",
      fontFamily: "monospace",
      color: colorStr,
      stroke: "#000000",
      strokeThickness: 4,
      fontStyle: "bold",
    });
    label.setOrigin(0.5);
    label.setDepth(6);

    scene.tweens.add({
      targets: label,
      y: y - 40,
      alpha: 0,
      duration: 2000,
      ease: "Power1",
      onComplete: () => label.destroy(),
    });
  },
};

import Phaser from "phaser";
import { NPC, type NPCType } from "../entities/NPC";
import { EventBus } from "./EventBus";
import { WORLD } from "../config/GameConfig";
import { SPAWNING } from "../config/GameConfig";

const NPC_TYPES: NPCType[] = ["wanderer", "blacksmith", "cursed_one", "seer"];

// Quest state for The Wanderer
interface WandererQuest {
  active: boolean;
  killTarget: number;
  killCount: number;
  timeLimit: number;
  timeRemaining: number;
  npcX: number;
  npcY: number;
  questNpcId: string;
}

export const NPCManager = {
  _activeNPCs: [] as NPC[],
  _scene: null as Phaser.Scene | null,
  _wandererQuest: null as WandererQuest | null,
  _killListener: null as (() => void) | null,

  init(scene: Phaser.Scene): void {
    this._scene = scene;
    this._activeNPCs = [];
    this._wandererQuest = null;
    this._killListener = null;
  },

  spawnNPC(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): NPC {
    // Randomly select NPC type
    const type = NPC_TYPES[Math.floor(Math.random() * NPC_TYPES.length)];
    const npc = new NPC(scene, x, y - 30, type);
    this._activeNPCs.push(npc);
    return npc;
  },

  /**
   * Called each frame from MainScene.update().
   * Manages wanderer quest timer countdown.
   */
  update(delta: number): void {
    if (this._wandererQuest && this._wandererQuest.active) {
      this._wandererQuest.timeRemaining -= delta;

      if (this._wandererQuest.timeRemaining <= 0) {
        // Quest failed
        this._wandererQuest.active = false;
        EventBus.emit("npc-quest-fail", {});
        this._cleanupQuestListener();
        this._wandererQuest = null;
      }
    }
  },

  /**
   * Start a wanderer kill quest.
   */
  startWandererQuest(npcX: number, npcY: number, npcId: string): void {
    const killTarget = 5;
    const timeLimit = 20000; // 20 seconds in ms

    this._wandererQuest = {
      active: true,
      killTarget,
      killCount: 0,
      timeLimit,
      timeRemaining: timeLimit,
      npcX,
      npcY,
      questNpcId: npcId,
    };

    // Listen for enemy kills
    this._killListener = EventBus.on("enemy-killed", () => {
      if (!this._wandererQuest || !this._wandererQuest.active) return;

      this._wandererQuest.killCount++;

      if (this._wandererQuest.killCount >= this._wandererQuest.killTarget) {
        // Quest complete!
        this._wandererQuest.active = false;
        EventBus.emit("npc-quest-complete", { reward: "random_item" });
        this._cleanupQuestListener();
        this._wandererQuest = null;
      }
    });

    EventBus.emit("npc-quest-start", {
      questType: "kill",
      killTarget,
      timeLimit,
    });
  },

  /**
   * Get the current quest state (for UI display).
   */
  getQuestState(): { active: boolean; killCount: number; killTarget: number; timeRemaining: number } | null {
    if (!this._wandererQuest) return null;
    return {
      active: this._wandererQuest.active,
      killCount: this._wandererQuest.killCount,
      killTarget: this._wandererQuest.killTarget,
      timeRemaining: this._wandererQuest.timeRemaining,
    };
  },

  _cleanupQuestListener(): void {
    if (this._killListener) {
      this._killListener();
      this._killListener = null;
    }
  },

  /**
   * Remove NPCs that have scrolled far below the player.
   */
  cleanup(playerY: number): void {
    const cleanupBuffer = 2000;
    this._activeNPCs = this._activeNPCs.filter((npc) => {
      if (npc.y > playerY + cleanupBuffer) {
        npc.cleanup();
        return false;
      }
      return true;
    });
  },

  reset(): void {
    for (const npc of this._activeNPCs) {
      npc.cleanup();
    }
    this._activeNPCs = [];
    this._cleanupQuestListener();
    this._wandererQuest = null;
    this._scene = null;
  },
};

import type { ItemData } from "../config/ItemConfig";

export interface ShopOffering {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string; // emoji or character for display
}

export interface GameEvents {
  "health-change": { health: number; maxHealth: number };
  "altitude-change": { altitude: number };
  "inventory-change": { inventory: ItemData[] };
  "enemy-killed": { enemyType: string; x: number; y: number };
  "player-died": void;
  "boss-warning": { distance: number };
  "boss-spawn": { name: string; maxHealth: number; bossNumber: number };
  "boss-health-change": { health: number; maxHealth: number; phase: number };
  "boss-phase-change": { phase: number; totalPhases: number };
  "boss-defeated": { bossNumber: number; altitude: number; rewards: string[] };
  "style-change": { meter: number; tier: string; multiplier: number };
  "biome-change": { biome: string };
  "slope-launch": { speed: number; angle: number };
  "essence-change": { essence: number; gained: number };
  "show-death-screen": {
    altitude: number;
    kills: number;
    bossesDefeated: number;
    timeMs: number;
    essenceEarned: number;
  };
  "shop-open": { offerings: ShopOffering[] };
  "shop-close": {};
  "shop-purchase": { offeringId: string; cost: number };
  "flow-change": { flow: number; maxFlow: number };
  "shield-guard-change": { active: boolean };
  "sacred-ground-cooldown": { remaining: number; total: number };
}

export const EventBus = {
  emit<K extends keyof GameEvents>(
    ...args: GameEvents[K] extends void ? [event: K] : [event: K, data: GameEvents[K]]
  ): void {
    const [event, data] = args as [K, GameEvents[K]?];
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  },

  on<K extends keyof GameEvents>(
    event: K,
    handler: (data: GameEvents[K]) => void,
  ): () => void {
    const wrapped = (e: Event) => handler((e as CustomEvent).detail);
    window.addEventListener(event, wrapped);
    return () => window.removeEventListener(event, wrapped);
  },

  off(event: keyof GameEvents, handler: EventListener): void {
    window.removeEventListener(event, handler);
  },
};

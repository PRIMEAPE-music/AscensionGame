import type { ItemData } from "../config/ItemConfig";

export interface GameEvents {
  "health-change": { health: number; maxHealth: number };
  "altitude-change": { altitude: number };
  "inventory-change": { inventory: ItemData[] };
  "enemy-killed": { enemyType: string; x: number; y: number };
  "player-died": { altitude: number; kills: number };
  "boss-warning": { distance: number };
}

export const EventBus = {
  emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
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

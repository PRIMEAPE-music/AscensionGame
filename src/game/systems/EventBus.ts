import type { ItemData } from "../config/ItemConfig";

export interface ShopOffering {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string; // emoji or character for display
}

export interface GameEvents {
  "health-change": { health: number; maxHealth: number; playerIndex?: number };
  "altitude-change": { altitude: number };
  "inventory-change": { inventory: ItemData[]; maxSlots?: number };
  "enemy-killed": { enemyType: string; x: number; y: number; finishingMove?: boolean; isElite?: boolean; affixes?: string[] };
  "elite-killed": { affixes: string[] };
  "player-died": { playerIndex?: number };
  "coop-respawn": { playerIndex: number; timeRemaining: number };
  "boss-warning": { distance: number };
  "boss-spawn": { name: string; maxHealth: number; bossNumber: number };
  "boss-health-change": { health: number; maxHealth: number; phase: number };
  "boss-phase-change": { phase: number; totalPhases: number };
  "boss-defeated": { bossNumber: number; altitude: number; rewards: string[] };
  "boss-arena-start": { bossNumber: number };
  "boss-arena-end": {};
  "boss-enrage": {};
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
  "combo-update": { count: number; multiplier: number; timer: number };
  "combo-end": { finalCount: number };
  "hazard-warning": { type: string; x: number; y: number };
  "portal-teleport": { fromAltitude: number; toAltitude: number };
  "flow-change": { flow: number; maxFlow: number };
  "shield-guard-change": { active: boolean };
  "priest-sacred-ground": { x: number; y: number };
  "sacred-ground-cooldown": { remaining: number; total: number };
  "gambling-open": { essence: number };
  "gambling-close": {};
  "gambling-result": { bet: number; reward: string; rewardType: "nothing" | "item" | "health" | "gold_item" | "cursed_item" };
  "item-replace-prompt": { newItem: ItemData; currentItems: ItemData[] };
  "item-replace-decision": { action: "take" | "leave"; replaceIndex?: number };
  "parry-success": { reflectedDamage: number };
  "speed-change": { speed: number; maxSpeed: number };
  "player-jump": {};
  "player-attack": {};
  "player-dodge": { perfect: boolean };
  "player-land": {};
  "item-pickup": {};
  "combo-string": { name: string; multiplier: number };
  "progress-update": {
    altitude: number;
    nextBossAltitude: number;
    biome: string;
  };
  "wind-zone-enter": { windType: string; strength: number };
  "synergy-change": { synergies: Array<{ rarity: string; count: number; bonus: number }> };
  "synergy-activated": { synergyId: string; name: string; description: string; color: number };
  "wind-zone-exit": {};
  "finishing-move": { x: number; y: number };
  "achievement-unlocked": {
    id: string;
    name: string;
    description: string;
    icon: string;
  };
  "ascension-offer": { bossNumber: number };
  "ascension-chosen": { stat: string };
  "subclass-offer": { classType: string };
  "subclass-chosen": { subclassId: string };
  "subclass-ability-used": { subclassId: string };
  "feature-unlocked": { featureId: string; featureName: string };
  "corruption-update": { level: number };
  "corruption-modifier": { modifierId: string };

  // Boss Rush events
  "boss-rush-round": { round: number; totalRounds: number; bossName: string; state: string };
  "boss-rush-timer": { timeMs: number };
  "boss-rush-item-select": { round: number; offerings: import("../config/ItemConfig").ItemData[] };
  "boss-rush-item-chosen": { item: import("../config/ItemConfig").ItemData };
  "boss-rush-victory": { timeMs: number; essenceEarned: number; bonusEssence: number };
  "boss-rush-defeat": { round: number; timeMs: number; bossName: string };

  // Training Room events
  "training-spawn-boss": { bossId: string };
  "training-toggle-infinite-hp": { enabled: boolean };
  "training-toggle-dummy-attack": { enabled: boolean };
  "training-reset": {};
  "training-exit": {};
  "training-dps-update": { dps: number };

  // Secret Room events
  "secret-room-found": { type: string; x: number; y: number };
  "secret-room-shrine-open": { buffs: Array<{ id: string; label: string; description: string }> };
  "secret-room-shrine-choose": { buffId: string };
  "secret-room-shrine-close": {};
  "secret-room-challenge-start": { enemyCount: number; timeLimit: number };
  "secret-room-challenge-timer": { remaining: number };
  "secret-room-challenge-complete": { success: boolean };
  "secret-room-lore-open": { text: string; title: string };
  "secret-room-lore-close": {};

  // NPC encounter events
  "npc-interact": {
    npcType: string;
    npcId: string;
    inventory: import("../config/ItemConfig").ItemData[];
    essence: number;
    nextBossNumber: number;
  };
  "npc-dismiss": {};
  "npc-quest-start": { questType: string; killTarget: number; timeLimit: number };
  "npc-quest-complete": { reward: string };
  "npc-quest-fail": {};
  "npc-blacksmith-upgrade": { itemIndex: number; cost: number };
  "npc-cursed-purchase": { itemId: string; cost: number };
  "npc-seer-reveal": {};

  // Co-op item draft events
  "coop-item-draft": { items: import("../config/ItemConfig").ItemData[] };
  "coop-draft-p1-pick": { itemId: string };
  "coop-draft-p2-pick": { itemId: string };
  "coop-draft-complete": { p1Item: string; p2Item: string };
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

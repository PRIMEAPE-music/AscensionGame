import { ITEMS } from "../config/ItemDatabase";
import type { ItemData } from "../config/ItemConfig";
import { EventBus } from "./EventBus";

// ─── Synergy Definitions ─────────────────────────────────────────────────────

export interface SynergyDef {
  id: string;
  name: string;
  description: string;
  requiredCount: number;
  tags: string[];   // items with ANY of these tags count toward this synergy
  color: number;    // theme color (hex)
}

export const SYNERGY_DEFS: SynergyDef[] = [
  {
    id: 'inferno',
    name: 'Inferno',
    description: 'Fire aura deals 1 damage/sec to nearby enemies',
    requiredCount: 3,
    tags: ['fire', 'damage'],
    color: 0xff4400,
  },
  {
    id: 'fortress',
    name: 'Fortress',
    description: '+25% max HP, take -1 damage from all sources (min 1)',
    requiredCount: 3,
    tags: ['defense', 'shield', 'armor'],
    color: 0x4488ff,
  },
  {
    id: 'tempest',
    name: 'Tempest',
    description: '+30% move speed, attacks generate wind shockwaves',
    requiredCount: 3,
    tags: ['speed', 'mobility', 'jump'],
    color: 0x88ddff,
  },
  {
    id: 'lifeline',
    name: 'Lifeline',
    description: 'Passive regen: heal 1 HP every 20 seconds',
    requiredCount: 3,
    tags: ['heal', 'regen', 'health'],
    color: 0x44ff44,
  },
  {
    id: 'arsenal',
    name: 'Arsenal',
    description: '+20% attack speed, attacks chain to a nearby enemy for 30% damage',
    requiredCount: 3,
    tags: ['attack', 'weapon', 'crit'],
    color: 0xff6600,
  },
  {
    id: 'shadow',
    name: 'Shadow',
    description: '15% chance to dodge any attack entirely',
    requiredCount: 3,
    tags: ['dodge', 'stealth', 'evasion'],
    color: 0x8844cc,
  },
  {
    id: 'arcane',
    name: 'Arcane',
    description: 'Ultimate ability cooldowns reduced 30%',
    requiredCount: 3,
    tags: ['cooldown', 'ability', 'ultimate'],
    color: 0x44aaff,
  },
  {
    id: 'avarice',
    name: 'Avarice',
    description: '+50% essence from all sources, shops 20% cheaper',
    requiredCount: 3,
    tags: ['essence', 'gold', 'luck'],
    color: 0xffcc00,
  },
];

// ─── Item → Tags mapping ─────────────────────────────────────────────────────

/** Pre-built map: itemId -> tags[] (populated from ItemDatabase) */
const _itemTags: Map<string, string[]> = new Map();

function ensureItemTags(): void {
  if (_itemTags.size > 0) return;
  for (const [id, item] of Object.entries(ITEMS)) {
    if (item.tags && item.tags.length > 0) {
      _itemTags.set(id, item.tags);
    }
  }
}

// ─── SynergyManager singleton ────────────────────────────────────────────────

export const SynergyManager = {
  _activeSynergies: new Set<string>(),

  /** Initialize item tag mappings (call once at game start). */
  init(): void {
    ensureItemTags();
    this._activeSynergies.clear();
  },

  /**
   * Count how many UNIQUE items the player has that match a synergy's tags.
   * Both Silver and Gold items count.
   * Each item is counted at most once per synergy even if it has multiple matching tags.
   */
  _countMatchingItems(inventory: ItemData[], synergy: SynergyDef): number {
    let count = 0;
    for (const item of inventory) {
      const tags = item.tags ?? _itemTags.get(item.id) ?? [];
      if (tags.some(t => synergy.tags.includes(t))) {
        count++;
      }
    }
    return count;
  },

  /**
   * Check all synergies against the player's current inventory.
   * Returns array of synergy IDs that are NEWLY activated this call.
   */
  checkSynergies(inventory: ItemData[]): string[] {
    ensureItemTags();
    const newlyActivated: string[] = [];

    for (const def of SYNERGY_DEFS) {
      const matchCount = this._countMatchingItems(inventory, def);
      const wasActive = this._activeSynergies.has(def.id);

      if (matchCount >= def.requiredCount && !wasActive) {
        this._activeSynergies.add(def.id);
        newlyActivated.push(def.id);

        // Emit activation event for HUD notification
        EventBus.emit("synergy-activated", {
          synergyId: def.id,
          name: def.name,
          description: def.description,
          color: def.color,
        });
      } else if (matchCount < def.requiredCount && wasActive) {
        // Synergy lost (item was replaced)
        this._activeSynergies.delete(def.id);
      }
    }

    return newlyActivated;
  },

  /** Whether a specific synergy is currently active. */
  isActive(synergyId: string): boolean {
    return this._activeSynergies.has(synergyId);
  },

  /** Get all currently active synergy IDs. */
  getActiveSynergies(): string[] {
    return [...this._activeSynergies];
  },

  /** Get the SynergyDef for a given ID. */
  getDef(synergyId: string): SynergyDef | undefined {
    return SYNERGY_DEFS.find(d => d.id === synergyId);
  },

  /** Reset all synergy state (call on run start / player death). */
  reset(): void {
    this._activeSynergies.clear();
  },
};

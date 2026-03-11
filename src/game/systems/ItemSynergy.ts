import type { ItemData } from "../config/ItemConfig";

export interface SynergyBonus {
  rarity: string;
  count: number;
  bonus: number; // percentage as decimal, e.g., 0.10 for +10%
}

/**
 * Calculate synergy bonuses based on inventory composition.
 * - 2 same-rarity items: +10% to those items' effects
 * - 3 same-rarity items: +25% to those items' effects
 * - 4+ same-rarity items: +50% to those items' effects
 */
export function calculateSynergies(inventory: ItemData[]): SynergyBonus[] {
  const silverItems = inventory.filter(i => i.type === 'SILVER');
  const rarityCounts: Record<string, number> = {};

  for (const item of silverItems) {
    rarityCounts[item.rarity] = (rarityCounts[item.rarity] || 0) + 1;
  }

  const bonuses: SynergyBonus[] = [];
  for (const [rarity, count] of Object.entries(rarityCounts)) {
    let bonus = 0;
    if (count >= 4) bonus = 0.50;
    else if (count >= 3) bonus = 0.25;
    else if (count >= 2) bonus = 0.10;

    if (bonus > 0) {
      bonuses.push({ rarity, count, bonus });
    }
  }

  return bonuses;
}

/**
 * Get the synergy multiplier for a specific item based on current inventory.
 */
export function getSynergyMultiplier(item: ItemData, inventory: ItemData[]): number {
  const synergies = calculateSynergies(inventory);
  const match = synergies.find(s => s.rarity === item.rarity);
  return match ? 1 + match.bonus : 1;
}

import { ITEMS } from "../config/ItemDatabase";

const STORAGE_KEY = "ascension_gold_items";

interface GoldItemData {
  unlockedItems: string[];
  equippedItems: string[];
}

export const GoldItemCollection = {
  unlockedItems: [] as string[],
  equippedItems: [] as string[], // max 2 equipped per run

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: GoldItemData = JSON.parse(raw);
        this.unlockedItems = data.unlockedItems ?? [];
        this.equippedItems = data.equippedItems ?? [];
      }
    } catch {
      this.unlockedItems = [];
      this.equippedItems = [];
    }
  },

  save(): void {
    const data: GoldItemData = {
      unlockedItems: this.unlockedItems,
      equippedItems: this.equippedItems,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  unlockItem(itemId: string): void {
    this.unlockedItems.push(itemId);
    this.save();
  },

  getUnlocked(): string[] {
    // Return unique item IDs
    return [...new Set(this.unlockedItems)];
  },

  equip(itemId: string): boolean {
    if (this.equippedItems.length >= 2) return false;
    if (!this.isUnlocked(itemId)) return false;

    // Check if already equipped — only allow if item is stackable
    if (this.isEquipped(itemId)) {
      const itemData = ITEMS[itemId];
      if (!itemData?.stackable) return false;
      // Can't equip more than owned copies
      const ownedCount = this.unlockedItems.filter(id => id === itemId).length;
      const equippedCount = this.equippedItems.filter(id => id === itemId).length;
      if (equippedCount >= ownedCount) return false;
    }

    this.equippedItems.push(itemId);
    this.save();
    return true;
  },

  unequip(itemId: string): void {
    // Remove only one instance (important for stacked items)
    const idx = this.equippedItems.indexOf(itemId);
    if (idx !== -1) {
      this.equippedItems.splice(idx, 1);
    }
    this.save();
  },

  getEquipped(): string[] {
    return [...this.equippedItems];
  },

  clearEquipped(): void {
    this.equippedItems = [];
    this.save();
  },

  isUnlocked(itemId: string): boolean {
    return this.unlockedItems.includes(itemId);
  },

  isEquipped(itemId: string): boolean {
    return this.equippedItems.includes(itemId);
  },

  getOwnedCount(itemId: string): number {
    return this.unlockedItems.filter(id => id === itemId).length;
  },

  getEquippedCount(itemId: string): number {
    return this.equippedItems.filter(id => id === itemId).length;
  },
};

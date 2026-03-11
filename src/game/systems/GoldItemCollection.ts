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
    if (this.isEquipped(itemId)) return false;
    this.equippedItems.push(itemId);
    this.save();
    return true;
  },

  unequip(itemId: string): void {
    this.equippedItems = this.equippedItems.filter((id) => id !== itemId);
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
};

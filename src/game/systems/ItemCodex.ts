/**
 * ItemCodex — tracks which items the player has discovered across all runs.
 * Persisted in localStorage.
 */

import { ITEMS } from "../config/ItemDatabase";

const STORAGE_KEY = "ascension_item_codex";

let _discovered: Set<string> = new Set();

export const ItemCodex = {
  /** Load discovered items from localStorage. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          _discovered = new Set(parsed);
        } else {
          _discovered = new Set();
        }
      } else {
        _discovered = new Set();
      }
    } catch {
      _discovered = new Set();
    }
  },

  /** Save discovered items to localStorage. */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([..._discovered]));
    } catch {
      // localStorage may be unavailable; silently ignore
    }
  },

  /** Mark an item as discovered. */
  discover(itemId: string): void {
    if (!_discovered.has(itemId)) {
      _discovered.add(itemId);
      this.save();
    }
  },

  /** Discover multiple items at once. */
  discoverMany(itemIds: string[]): void {
    let changed = false;
    for (const id of itemIds) {
      if (!_discovered.has(id)) {
        _discovered.add(id);
        changed = true;
      }
    }
    if (changed) {
      this.save();
    }
  },

  /** Check if an item has been discovered. */
  isDiscovered(itemId: string): boolean {
    return _discovered.has(itemId);
  },

  /** Get count of discovered items. */
  getDiscoveredCount(): number {
    return _discovered.size;
  },

  /** Get total count of all items in the database. */
  getTotalCount(): number {
    return Object.keys(ITEMS).length;
  },

  /** Get all discovered item IDs. */
  getDiscoveredItems(): string[] {
    return [..._discovered];
  },

  /** Clear all discovered items. */
  clear(): void {
    _discovered = new Set();
    this.save();
  },
};

// ─── Cosmetic Unlock System ──────────────────────────────────────────────────
// Tracks cosmetic unlocks and equipped cosmetics via localStorage.
// Cosmetics are unlocked by achievements and equipped per-category.
// Actual visual application is handled elsewhere; this is pure data management.

const STORAGE_KEY = "ascension_cosmetics";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CosmeticCategory = "CLASS_SKIN" | "ATTACK_EFFECT" | "PLATFORM_THEME" | "UI_THEME";

export interface CosmeticDefinition {
  id: string;
  name: string;
  description: string;
  category: CosmeticCategory;
  /** Which achievement unlocks this cosmetic (undefined = always unlocked) */
  achievementId?: string;
  /** Color hex for preview display */
  previewColor: number;
  /** For class skins, which class it applies to */
  class?: string;
}

export interface EquippedCosmetics {
  classSkin: string;
  attackEffect: string;
  platformTheme: string;
  uiTheme: string;
}

export interface CosmeticData {
  unlockedCosmetics: string[];
  equippedCosmetics: EquippedCosmetics;
}

// ─── Category key mapping ────────────────────────────────────────────────────

const CATEGORY_TO_EQUIP_KEY: Record<CosmeticCategory, keyof EquippedCosmetics> = {
  CLASS_SKIN: "classSkin",
  ATTACK_EFFECT: "attackEffect",
  PLATFORM_THEME: "platformTheme",
  UI_THEME: "uiTheme",
};

// ─── Cosmetic Definitions ────────────────────────────────────────────────────

const COSMETIC_DEFINITIONS: CosmeticDefinition[] = [
  // ── Class Skins ──────────────────────────────────────────────────────────
  {
    id: "paladin_default",
    name: "Paladin Standard",
    description: "The default Paladin appearance.",
    category: "CLASS_SKIN",
    previewColor: 0xc0c0c0,
    class: "PALADIN",
  },
  {
    id: "paladin_crimson",
    name: "Crimson Paladin",
    description: "A blood-red recolor forged in battle.",
    category: "CLASS_SKIN",
    achievementId: "first_boss",
    previewColor: 0xcc2222,
    class: "PALADIN",
  },
  {
    id: "paladin_golden",
    name: "Golden Paladin",
    description: "Resplendent golden armor for a true champion.",
    category: "CLASS_SKIN",
    achievementId: "defeat_100_bosses",
    previewColor: 0xffd700,
    class: "PALADIN",
  },
  {
    id: "monk_default",
    name: "Monk Standard",
    description: "The default Monk appearance.",
    category: "CLASS_SKIN",
    previewColor: 0x88aa44,
    class: "MONK",
  },
  {
    id: "monk_shadow",
    name: "Shadow Monk",
    description: "A dark purple aura from mastering the flow of combat.",
    category: "CLASS_SKIN",
    achievementId: "chain_50_combo",
    previewColor: 0x8833cc,
    class: "MONK",
  },
  {
    id: "monk_ember",
    name: "Ember Monk",
    description: "Blazing orange robes from ascending beyond the clouds.",
    category: "CLASS_SKIN",
    achievementId: "reach_5000m",
    previewColor: 0xff6622,
    class: "MONK",
  },
  {
    id: "priest_default",
    name: "Priest Standard",
    description: "The default Priest appearance.",
    category: "CLASS_SKIN",
    previewColor: 0x8888dd,
    class: "PRIEST",
  },
  {
    id: "priest_void",
    name: "Void Priest",
    description: "Dark blue vestments touched by the stratosphere.",
    category: "CLASS_SKIN",
    achievementId: "reach_10000m",
    previewColor: 0x2244aa,
    class: "PRIEST",
  },
  {
    id: "priest_divine",
    name: "Divine Priest",
    description: "Brilliant white robes of perfect purity.",
    category: "CLASS_SKIN",
    achievementId: "perfect_boss",
    previewColor: 0xeeeeff,
    class: "PRIEST",
  },

  // ── Attack Effects ───────────────────────────────────────────────────────
  {
    id: "default_attack",
    name: "Standard",
    description: "Default attack visual effects.",
    category: "ATTACK_EFFECT",
    previewColor: 0xffffff,
  },
  {
    id: "flame_trail",
    name: "Flame Trail",
    description: "Red and orange hit particles trail behind each strike.",
    category: "ATTACK_EFFECT",
    achievementId: "collect_10_gold",
    previewColor: 0xff4400,
  },
  {
    id: "ice_shards",
    name: "Ice Shards",
    description: "Blue and cyan crystalline hit particles.",
    category: "ATTACK_EFFECT",
    achievementId: "reach_5000m",
    previewColor: 0x44ccff,
  },
  {
    id: "void_burst",
    name: "Void Burst",
    description: "Purple void energy erupts on each hit.",
    category: "ATTACK_EFFECT",
    achievementId: "total_1000_kills",
    previewColor: 0xaa44ff,
  },

  // ── Platform Themes ──────────────────────────────────────────────────────
  {
    id: "default_platforms",
    name: "Standard",
    description: "Default platform appearance.",
    category: "PLATFORM_THEME",
    previewColor: 0x888888,
  },
  {
    id: "crystal",
    name: "Crystal",
    description: "Gleaming crystalline blue platforms.",
    category: "PLATFORM_THEME",
    achievementId: "defeat_100_bosses",
    previewColor: 0x44aadd,
  },
  {
    id: "neon",
    name: "Neon",
    description: "Glowing neon-lit platforms.",
    category: "PLATFORM_THEME",
    achievementId: "reach_10000m",
    previewColor: 0x44ff88,
  },

  // ── UI Themes ────────────────────────────────────────────────────────────
  {
    id: "default_ui",
    name: "Standard Gold",
    description: "The default gold accent HUD theme.",
    category: "UI_THEME",
    previewColor: 0xe0d0a0,
  },
  {
    id: "crimson",
    name: "Crimson",
    description: "Red accent theme with a fiery edge.",
    category: "UI_THEME",
    achievementId: "first_boss",
    previewColor: 0xdd3333,
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool blue-teal accent theme.",
    category: "UI_THEME",
    achievementId: "reach_5000m",
    previewColor: 0x33aacc,
  },
  {
    id: "void",
    name: "Void",
    description: "Purple accent theme from the abyss.",
    category: "UI_THEME",
    achievementId: "reach_10000m",
    previewColor: 0x9944dd,
  },
];

// ─── Default equip IDs ───────────────────────────────────────────────────────

const DEFAULT_EQUIPPED: EquippedCosmetics = {
  classSkin: "paladin_default",
  attackEffect: "default_attack",
  platformTheme: "default_platforms",
  uiTheme: "default_ui",
};

// Items that are always unlocked (no achievementId)
const ALWAYS_UNLOCKED = COSMETIC_DEFINITIONS
  .filter((d) => !d.achievementId)
  .map((d) => d.id);

// ─── Internal State ──────────────────────────────────────────────────────────

let data: CosmeticData = {
  unlockedCosmetics: [...ALWAYS_UNLOCKED],
  equippedCosmetics: { ...DEFAULT_EQUIPPED },
};

// ─── Manager ─────────────────────────────────────────────────────────────────

export const CosmeticManager = {
  /** Load cosmetic data from localStorage. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CosmeticData>;
        const unlocked = Array.isArray(parsed.unlockedCosmetics)
          ? parsed.unlockedCosmetics
          : [];
        // Ensure always-unlocked items are present
        const combined = new Set([...ALWAYS_UNLOCKED, ...unlocked]);
        data = {
          unlockedCosmetics: [...combined],
          equippedCosmetics: {
            ...DEFAULT_EQUIPPED,
            ...(parsed.equippedCosmetics || {}),
          },
        };
      } else {
        data = {
          unlockedCosmetics: [...ALWAYS_UNLOCKED],
          equippedCosmetics: { ...DEFAULT_EQUIPPED },
        };
      }
    } catch {
      data = {
        unlockedCosmetics: [...ALWAYS_UNLOCKED],
        equippedCosmetics: { ...DEFAULT_EQUIPPED },
      };
    }
  },

  /** Save cosmetic data to localStorage. */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable; silently ignore
    }
  },

  /** Unlock a cosmetic by ID. Returns true if it was newly unlocked. */
  unlock(cosmeticId: string): boolean {
    if (data.unlockedCosmetics.includes(cosmeticId)) return false;
    const def = COSMETIC_DEFINITIONS.find((d) => d.id === cosmeticId);
    if (!def) return false;
    data.unlockedCosmetics.push(cosmeticId);
    this.save();
    return true;
  },

  /** Check if a cosmetic is unlocked. */
  isUnlocked(cosmeticId: string): boolean {
    return data.unlockedCosmetics.includes(cosmeticId);
  },

  /** Equip a cosmetic in its category. */
  equip(category: CosmeticCategory, cosmeticId: string): boolean {
    if (!this.isUnlocked(cosmeticId)) return false;
    const def = COSMETIC_DEFINITIONS.find((d) => d.id === cosmeticId);
    if (!def || def.category !== category) return false;

    const key = CATEGORY_TO_EQUIP_KEY[category];
    data.equippedCosmetics[key] = cosmeticId;
    this.save();
    return true;
  },

  /** Get the currently equipped cosmetic ID for a category. */
  getEquipped(category: CosmeticCategory): string {
    const key = CATEGORY_TO_EQUIP_KEY[category];
    return data.equippedCosmetics[key];
  },

  /** Get all equipped cosmetics. */
  getAllEquipped(): EquippedCosmetics {
    return { ...data.equippedCosmetics };
  },

  /** Get a cosmetic definition by ID. */
  getDefinition(id: string): CosmeticDefinition | undefined {
    return COSMETIC_DEFINITIONS.find((d) => d.id === id);
  },

  /** Get all cosmetic definitions in a category. */
  getByCategory(category: CosmeticCategory): CosmeticDefinition[] {
    return COSMETIC_DEFINITIONS.filter((d) => d.category === category);
  },

  /** Get all cosmetic definitions. */
  getAllDefinitions(): CosmeticDefinition[] {
    return [...COSMETIC_DEFINITIONS];
  },

  /** Get all unlocked cosmetic IDs. */
  getUnlocked(): string[] {
    return [...data.unlockedCosmetics];
  },

  /**
   * Check if an achievement unlock triggers any cosmetic unlocks.
   * Returns array of newly unlocked cosmetic IDs.
   */
  checkAchievementUnlocks(achievementId: string): string[] {
    const newlyUnlocked: string[] = [];

    for (const def of COSMETIC_DEFINITIONS) {
      if (def.achievementId === achievementId && !this.isUnlocked(def.id)) {
        data.unlockedCosmetics.push(def.id);
        newlyUnlocked.push(def.id);
      }
    }

    if (newlyUnlocked.length > 0) {
      this.save();
    }

    return newlyUnlocked;
  },
};

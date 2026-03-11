export interface RunModifier {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  effects: ModifierEffect[];
  reward: string; // description of reward
}

export interface ModifierEffect {
  type:
    | "health_override"
    | "damage_mult"
    | "timer"
    | "item_slots"
    | "enemy_elite"
    | "one_hit"
    | "essence_mult"
    | "item_quality";
  value: number | string | boolean;
}

export const RUN_MODIFIERS: RunModifier[] = [
  {
    id: "glass_cannon",
    name: "Glass Cannon",
    description: "Start with 1 HP instead of base. +100% damage dealt.",
    icon: "\u{1F4A5}",
    effects: [
      { type: "health_override", value: 1 },
      { type: "damage_mult", value: 2.0 },
    ],
    reward: "2x essence gain",
  },
  {
    id: "speed_demon",
    name: "Speed Demon",
    description: "Reach 5000m in 15 minutes or die.",
    icon: "\u26A1",
    effects: [
      { type: "timer", value: 900000 }, // 15 min in ms
    ],
    reward: "Extra silver item slot at start",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Can only equip 1 silver item.",
    icon: "\u{1F3AF}",
    effects: [{ type: "item_slots", value: 1 }],
    reward: "All silver items are highest quality",
  },
  {
    id: "one_shot",
    name: "One Shot",
    description: "Everything dies in one hit. Including you.",
    icon: "\u2620\uFE0F",
    effects: [
      { type: "one_hit", value: true },
      { type: "health_override", value: 1 },
    ],
    reward: "3x essence gain",
  },
  {
    id: "chaos_mode",
    name: "Chaos Mode",
    description:
      "All enemies spawn as Elite variants. Random hazards always active.",
    icon: "\u{1F300}",
    effects: [{ type: "enemy_elite", value: true }],
    reward: "Guaranteed gold item every boss",
  },
];

// Active modifiers for current run (stored globally)
export const ActiveModifiers = {
  active: [] as string[],

  setModifiers(ids: string[]): void {
    this.active = [...ids];
    (window as any).__activeModifiers = this.active;
  },

  isActive(id: string): boolean {
    return this.active.includes(id);
  },

  getEffect(type: string): any {
    for (const modId of this.active) {
      const mod = RUN_MODIFIERS.find((m) => m.id === modId);
      if (mod) {
        const effect = mod.effects.find((e) => e.type === type);
        if (effect) return effect.value;
      }
    }
    return null;
  },

  clear(): void {
    this.active = [];
    (window as any).__activeModifiers = [];
  },

  getEssenceMultiplier(): number {
    let mult = 1;
    if (this.isActive("glass_cannon")) mult *= 2;
    if (this.isActive("one_shot")) mult *= 3;
    return mult;
  },
};

export interface KeyBindingMap {
  moveLeft: string;
  moveRight: string;
  moveUp: string;
  moveDown: string;
  jump: string;
  attackB: string;
  attackX: string;
  attackY: string;
  dodge: string;
  grapple: string;
  cataclysm: string;
  temporalRift: string;
  divineIntervention: string;
  essenceBurst: string;
  counterSlash: string;
  groundSlam: string;
  projectile: string;
  chargedAttack: string;
  subclassAbility: string;
  pause: string;
}

const DEFAULT_BINDINGS: KeyBindingMap = {
  moveLeft: 'LEFT',
  moveRight: 'RIGHT',
  moveUp: 'UP',
  moveDown: 'DOWN',
  jump: 'SPACE',
  attackB: 'Z',
  attackX: 'X',
  attackY: 'C',
  dodge: 'SHIFT',
  grapple: 'V',
  cataclysm: 'Q',
  temporalRift: 'E',
  divineIntervention: 'R',
  essenceBurst: 'F',
  counterSlash: 'G',
  groundSlam: 'T',
  projectile: 'Y',
  chargedAttack: 'H',
  subclassAbility: 'N',
  pause: 'ESC',
};

export const ACTION_LABELS: Record<keyof KeyBindingMap, string> = {
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  moveUp: 'Move Up / Climb',
  moveDown: 'Move Down / Drop',
  jump: 'Jump',
  attackB: 'Attack B',
  attackX: 'Attack X',
  attackY: 'Attack Y',
  dodge: 'Dodge / Air Dash',
  grapple: 'Grappling Hook',
  cataclysm: 'Cataclysm',
  temporalRift: 'Temporal Rift',
  divineIntervention: 'Divine Intervention',
  essenceBurst: 'Essence Burst',
  counterSlash: 'Counter Slash',
  groundSlam: 'Ground Slam',
  projectile: 'Projectile',
  chargedAttack: 'Charged Attack',
  subclassAbility: 'Subclass Ability',
  pause: 'Pause',
};

/** Groups for UI display */
export const ACTION_GROUPS: { label: string; actions: (keyof KeyBindingMap)[] }[] = [
  {
    label: 'Movement',
    actions: ['moveLeft', 'moveRight', 'moveUp', 'moveDown', 'jump'],
  },
  {
    label: 'Combat',
    actions: ['attackB', 'attackX', 'attackY', 'dodge', 'grapple'],
  },
  {
    label: 'Abilities',
    actions: ['cataclysm', 'temporalRift', 'divineIntervention', 'essenceBurst', 'counterSlash', 'groundSlam', 'projectile', 'chargedAttack', 'subclassAbility'],
  },
  {
    label: 'System',
    actions: ['pause'],
  },
];

const STORAGE_KEY = 'ascension_keybindings';

export const KeyBindings = {
  bindings: { ...DEFAULT_BINDINGS } as KeyBindingMap,

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<KeyBindingMap>;
        // Merge with defaults so new actions always have a binding
        this.bindings = { ...DEFAULT_BINDINGS, ...parsed };
      }
    } catch {
      // Corrupt data — fall back to defaults
      this.bindings = { ...DEFAULT_BINDINGS };
    }
  },

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bindings));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  },

  get(): KeyBindingMap {
    return this.bindings;
  },

  set(action: keyof KeyBindingMap, key: string): void {
    this.bindings[action] = key;
    this.save();
  },

  resetToDefaults(): void {
    this.bindings = { ...DEFAULT_BINDINGS };
    this.save();
  },

  getDefault(action: keyof KeyBindingMap): string {
    return DEFAULT_BINDINGS[action];
  },

  /** Find an action that is already bound to the given key (excluding a specific action) */
  findConflict(key: string, excludeAction: keyof KeyBindingMap): keyof KeyBindingMap | null {
    for (const [action, bound] of Object.entries(this.bindings)) {
      if (action !== excludeAction && bound === key) {
        return action as keyof KeyBindingMap;
      }
    }
    return null;
  },
};

// Auto-load on import
KeyBindings.load();

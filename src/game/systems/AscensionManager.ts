const STORAGE_KEY = "ascension_boosts";

export interface AscensionBoosts {
  attackDamage: number;
  moveSpeed: number;
  jumpHeight: number;
  attackSpeed: number;
  maxHealth: number;
}

const DEFAULTS: AscensionBoosts = {
  attackDamage: 0,
  moveSpeed: 0,
  jumpHeight: 0,
  attackSpeed: 0,
  maxHealth: 0,
};

export const AscensionManager = {
  _data: { ...DEFAULTS } as AscensionBoosts,

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AscensionBoosts>;
        this._data = {
          attackDamage: parsed.attackDamage ?? 0,
          moveSpeed: parsed.moveSpeed ?? 0,
          jumpHeight: parsed.jumpHeight ?? 0,
          attackSpeed: parsed.attackSpeed ?? 0,
          maxHealth: parsed.maxHealth ?? 0,
        };
      } else {
        this._data = { ...DEFAULTS };
      }
    } catch {
      this._data = { ...DEFAULTS };
    }
  },

  save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
  },

  getBoosts(): AscensionBoosts {
    return { ...this._data };
  },

  addBoost(stat: keyof AscensionBoosts): void {
    this._data[stat] += 0.02;
    this.save();
  },

  getBoostForStat(stat: keyof AscensionBoosts): number {
    return this._data[stat];
  },

  getAscensionCount(): number {
    return Object.values(this._data).reduce(
      (sum, v) => sum + Math.round(v / 0.02),
      0,
    );
  },
};

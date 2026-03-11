const STORAGE_KEY = "ascension_settings";

export interface GameSettingsData {
  screenShake: boolean;
  damageNumbers: boolean;
  particleEffects: "LOW" | "MEDIUM" | "HIGH";
}

const DEFAULTS: GameSettingsData = {
  screenShake: true,
  damageNumbers: true,
  particleEffects: "HIGH",
};

export const GameSettings = {
  _data: { ...DEFAULTS } as GameSettingsData,

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameSettingsData>;
        this._data = {
          screenShake: parsed.screenShake ?? DEFAULTS.screenShake,
          damageNumbers: parsed.damageNumbers ?? DEFAULTS.damageNumbers,
          particleEffects: parsed.particleEffects ?? DEFAULTS.particleEffects,
        };
      }
    } catch {
      this._data = { ...DEFAULTS };
    }
  },

  save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
  },

  get(): GameSettingsData {
    return { ...this._data };
  },

  set(partial: Partial<GameSettingsData>): void {
    this._data = { ...this._data, ...partial };
    this.save();
  },

  getScreenShake(): boolean {
    return this._data.screenShake;
  },

  getDamageNumbers(): boolean {
    return this._data.damageNumbers;
  },

  getParticleEffects(): "LOW" | "MEDIUM" | "HIGH" {
    return this._data.particleEffects;
  },
};

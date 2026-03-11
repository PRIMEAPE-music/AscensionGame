const STORAGE_KEY = "ascension_settings";

export interface GameSettingsData {
  screenShake: boolean;
  damageNumbers: boolean;
  particleEffects: "LOW" | "MEDIUM" | "HIGH";
  // Accessibility — Assist Mode
  assistMode: boolean;
  extraIFrames: boolean;
  slowerEnemies: boolean;
  extraStartingHealth: boolean;
  autoDodge: boolean;
  reducedComboTiming: boolean;
  // Accessibility — Visual
  highContrast: boolean;
  flashReduction: boolean;
  damageNumberSize: "SMALL" | "MEDIUM" | "LARGE";
}

const DEFAULTS: GameSettingsData = {
  screenShake: true,
  damageNumbers: true,
  particleEffects: "HIGH",
  // Accessibility — Assist Mode
  assistMode: false,
  extraIFrames: false,
  slowerEnemies: false,
  extraStartingHealth: false,
  autoDodge: false,
  reducedComboTiming: false,
  // Accessibility — Visual
  highContrast: false,
  flashReduction: false,
  damageNumberSize: "MEDIUM",
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
          assistMode: parsed.assistMode ?? DEFAULTS.assistMode,
          extraIFrames: parsed.extraIFrames ?? DEFAULTS.extraIFrames,
          slowerEnemies: parsed.slowerEnemies ?? DEFAULTS.slowerEnemies,
          extraStartingHealth: parsed.extraStartingHealth ?? DEFAULTS.extraStartingHealth,
          autoDodge: parsed.autoDodge ?? DEFAULTS.autoDodge,
          reducedComboTiming: parsed.reducedComboTiming ?? DEFAULTS.reducedComboTiming,
          highContrast: parsed.highContrast ?? DEFAULTS.highContrast,
          flashReduction: parsed.flashReduction ?? DEFAULTS.flashReduction,
          damageNumberSize: parsed.damageNumberSize ?? DEFAULTS.damageNumberSize,
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

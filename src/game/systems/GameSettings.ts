const STORAGE_KEY = "ascension_settings";

export interface GameSettingsData {
  screenShakeIntensity: "OFF" | "LOW" | "MEDIUM" | "HIGH";
  damageNumbers: boolean;
  particleEffects: "LOW" | "MEDIUM" | "HIGH";
  fullscreen: boolean;
  graphicsQuality: "LOW" | "MEDIUM" | "HIGH";
  showFPS: boolean;
  showSpeedMeter: boolean;
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
  colorblindMode: "NONE" | "DEUTERANOPIA" | "PROTANOPIA" | "TRITANOPIA";
  enemyOutlines: boolean;
  largerUI: boolean;
  // Mouse Controls
  mouseAttackEnabled: boolean;
  mouseAimEnabled: boolean;
  mouseCameraLookahead: boolean;
}

const DEFAULTS: GameSettingsData = {
  screenShakeIntensity: "MEDIUM",
  damageNumbers: true,
  particleEffects: "HIGH",
  fullscreen: false,
  graphicsQuality: "HIGH",
  showFPS: false,
  showSpeedMeter: true,
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
  colorblindMode: "NONE",
  enemyOutlines: false,
  largerUI: false,
  // Mouse Controls
  mouseAttackEnabled: false,
  mouseAimEnabled: false,
  mouseCameraLookahead: false,
};

export const GameSettings = {
  _data: { ...DEFAULTS } as GameSettingsData,

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        // Backward compatibility: migrate old boolean screenShake to screenShakeIntensity
        let screenShakeIntensity: GameSettingsData["screenShakeIntensity"] = DEFAULTS.screenShakeIntensity;
        if (parsed.screenShakeIntensity !== undefined) {
          screenShakeIntensity = parsed.screenShakeIntensity as GameSettingsData["screenShakeIntensity"];
        } else if (parsed.screenShake !== undefined) {
          // Old boolean format: true -> MEDIUM, false -> OFF
          screenShakeIntensity = parsed.screenShake ? "MEDIUM" : "OFF";
        }

        this._data = {
          screenShakeIntensity,
          damageNumbers: (parsed.damageNumbers as boolean) ?? DEFAULTS.damageNumbers,
          particleEffects: (parsed.particleEffects as GameSettingsData["particleEffects"]) ?? DEFAULTS.particleEffects,
          fullscreen: (parsed.fullscreen as boolean) ?? DEFAULTS.fullscreen,
          graphicsQuality: (parsed.graphicsQuality as GameSettingsData["graphicsQuality"]) ?? DEFAULTS.graphicsQuality,
          showFPS: (parsed.showFPS as boolean) ?? DEFAULTS.showFPS,
          showSpeedMeter: (parsed.showSpeedMeter as boolean) ?? DEFAULTS.showSpeedMeter,
          assistMode: (parsed.assistMode as boolean) ?? DEFAULTS.assistMode,
          extraIFrames: (parsed.extraIFrames as boolean) ?? DEFAULTS.extraIFrames,
          slowerEnemies: (parsed.slowerEnemies as boolean) ?? DEFAULTS.slowerEnemies,
          extraStartingHealth: (parsed.extraStartingHealth as boolean) ?? DEFAULTS.extraStartingHealth,
          autoDodge: (parsed.autoDodge as boolean) ?? DEFAULTS.autoDodge,
          reducedComboTiming: (parsed.reducedComboTiming as boolean) ?? DEFAULTS.reducedComboTiming,
          highContrast: (parsed.highContrast as boolean) ?? DEFAULTS.highContrast,
          flashReduction: (parsed.flashReduction as boolean) ?? DEFAULTS.flashReduction,
          damageNumberSize: (parsed.damageNumberSize as GameSettingsData["damageNumberSize"]) ?? DEFAULTS.damageNumberSize,
          colorblindMode: (parsed.colorblindMode as GameSettingsData["colorblindMode"]) ?? DEFAULTS.colorblindMode,
          enemyOutlines: (parsed.enemyOutlines as boolean) ?? DEFAULTS.enemyOutlines,
          largerUI: (parsed.largerUI as boolean) ?? DEFAULTS.largerUI,
          mouseAttackEnabled: (parsed.mouseAttackEnabled as boolean) ?? DEFAULTS.mouseAttackEnabled,
          mouseAimEnabled: (parsed.mouseAimEnabled as boolean) ?? DEFAULTS.mouseAimEnabled,
          mouseCameraLookahead: (parsed.mouseCameraLookahead as boolean) ?? DEFAULTS.mouseCameraLookahead,
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

  getScreenShakeIntensity(): "OFF" | "LOW" | "MEDIUM" | "HIGH" {
    return this._data.screenShakeIntensity;
  },

  getDamageNumbers(): boolean {
    return this._data.damageNumbers;
  },

  getParticleEffects(): "LOW" | "MEDIUM" | "HIGH" {
    return this._data.particleEffects;
  },
};

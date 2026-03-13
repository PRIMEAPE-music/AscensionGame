import React, { useState, useEffect, useCallback, useReducer } from "react";
import { GameSettings } from "../systems/GameSettings";
import type { GameSettingsData } from "../systems/GameSettings";
import { ColorblindFilter } from "../systems/ColorblindFilter";
import type { ColorblindMode } from "../systems/ColorblindFilter";
import { AudioManager } from "../systems/AudioManager";
import { GamepadManager } from "../systems/GamepadManager";
import { TutorialManager } from "../systems/TutorialManager";
import { KeyBindings, ACTION_LABELS, ACTION_GROUPS } from "../systems/KeyBindings";
import type { KeyBindingMap } from "../systems/KeyBindings";

interface SettingsScreenProps {
  onBack: () => void;
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "bold",
  color: "#e0d0a0",
  textTransform: "uppercase",
  letterSpacing: "3px",
  marginBottom: "16px",
  paddingBottom: "8px",
  borderBottom: "1px solid rgba(224, 208, 160, 0.15)",
};

/** Convert browser KeyboardEvent.code / .key to Phaser-compatible key string */
function convertToPhaserKey(code: string, key: string): string {
  const codeMap: Record<string, string> = {
    'Space': 'SPACE',
    'ShiftLeft': 'SHIFT', 'ShiftRight': 'SHIFT',
    'ControlLeft': 'CTRL', 'ControlRight': 'CTRL',
    'AltLeft': 'ALT', 'AltRight': 'ALT',
    'ArrowLeft': 'LEFT', 'ArrowRight': 'RIGHT',
    'ArrowUp': 'UP', 'ArrowDown': 'DOWN',
    'Escape': 'ESC',
    'Enter': 'ENTER',
    'Tab': 'TAB',
    'Backspace': 'BACKSPACE',
    'Delete': 'DELETE',
    'CapsLock': 'CAPS_LOCK',
  };
  if (codeMap[code]) return codeMap[code];
  // Letter keys: code is "KeyA", "KeyB" etc.
  if (code.startsWith('Key')) return code.slice(3);
  // Digit keys: code is "Digit0" etc.
  if (code.startsWith('Digit')) return code.slice(5);
  // Numpad
  if (code.startsWith('Numpad')) return 'NUMPAD_' + code.slice(6).toUpperCase();
  // F-keys
  if (/^F\d+$/.test(code)) return code;
  // Single character keys (punctuation etc.)
  if (key.length === 1) return key.toUpperCase();
  return code;
}

/** Format a Phaser key string for display */
function displayKeyName(phaserKey: string): string {
  const displayMap: Record<string, string> = {
    'LEFT': '\u2190 Left',
    'RIGHT': '\u2192 Right',
    'UP': '\u2191 Up',
    'DOWN': '\u2193 Down',
    'SPACE': 'Space',
    'SHIFT': 'Shift',
    'CTRL': 'Ctrl',
    'ALT': 'Alt',
    'ESC': 'Esc',
    'ENTER': 'Enter',
    'TAB': 'Tab',
    'BACKSPACE': 'Backspace',
    'DELETE': 'Delete',
    'CAPS_LOCK': 'Caps Lock',
  };
  if (displayMap[phaserKey]) return displayMap[phaserKey];
  return phaserKey;
}

const GAMEPAD_CONTROLS: { key: string; action: string }[] = [
  { key: "Left Stick / D-Pad", action: "Movement" },
  { key: "A", action: "Jump" },
  { key: "B", action: "Attack B" },
  { key: "X", action: "Attack X" },
  { key: "Y", action: "Attack Y" },
  { key: "LB", action: "Dodge / Air Dash" },
  { key: "RB", action: "Grappling Hook" },
  { key: "LT", action: "Counter Slash / Charged Attack" },
  { key: "RT", action: "Ground Slam / Projectile" },
  { key: "LB + B", action: "Cataclysm" },
  { key: "LB + X", action: "Temporal Rift" },
  { key: "LB + Y", action: "Divine Intervention" },
  { key: "LB + A", action: "Essence Burst" },
  { key: "Start", action: "Pause" },
];

const PARTICLE_OPTIONS: GameSettingsData["particleEffects"][] = [
  "LOW",
  "MEDIUM",
  "HIGH",
];

const SCREEN_SHAKE_OPTIONS: GameSettingsData["screenShakeIntensity"][] = [
  "OFF",
  "LOW",
  "MEDIUM",
  "HIGH",
];

const GRAPHICS_QUALITY_OPTIONS: GameSettingsData["graphicsQuality"][] = [
  "LOW",
  "MEDIUM",
  "HIGH",
];

const DAMAGE_NUMBER_SIZE_OPTIONS: GameSettingsData["damageNumberSize"][] = [
  "SMALL",
  "MEDIUM",
  "LARGE",
];

const COLORBLIND_MODE_OPTIONS: GameSettingsData["colorblindMode"][] = [
  "NONE",
  "DEUTERANOPIA",
  "PROTANOPIA",
  "TRITANOPIA",
];

const COLORBLIND_MODE_LABELS: Record<GameSettingsData["colorblindMode"], string> = {
  NONE: "None",
  DEUTERANOPIA: "Deuteranopia",
  PROTANOPIA: "Protanopia",
  TRITANOPIA: "Tritanopia",
};

const COLORBLIND_MODE_DESCRIPTIONS: Record<GameSettingsData["colorblindMode"], string> = {
  NONE: "No color correction",
  DEUTERANOPIA: "Red-green (most common)",
  PROTANOPIA: "Red-green",
  TRITANOPIA: "Blue-yellow",
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const [settings, setSettings] = useState<GameSettingsData>(GameSettings.get());
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [backHover, setBackHover] = useState(false);
  const [hoveredToggle, setHoveredToggle] = useState<string | null>(null);
  const [audioSettings, setAudioSettings] = useState(() => {
    AudioManager.init();
    return { ...AudioManager.settings };
  });
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [resetTutorialHover, setResetTutorialHover] = useState(false);
  const [tutorialResetDone, setTutorialResetDone] = useState(false);
  const [listeningAction, setListeningAction] = useState<keyof KeyBindingMap | null>(null);
  const [resetBindingsHover, setResetBindingsHover] = useState(false);
  const [bindingsResetDone, setBindingsResetDone] = useState(false);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    GameSettings.load();
    setSettings(GameSettings.get());
    AudioManager.init();
    setAudioSettings({ ...AudioManager.settings });
    KeyBindings.load();
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
    GameSettings.set({ fullscreen: !document.fullscreenElement });
    setSettings(GameSettings.get());
  };

  useEffect(() => {
    const interval = setInterval(() => {
      GamepadManager.update();
      setGamepadConnected(GamepadManager.isConnected());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Key rebinding listener
  useEffect(() => {
    if (!listeningAction) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setListeningAction(null);
        return;
      }
      const phaserKey = convertToPhaserKey(e.code, e.key);
      // Check for conflicts and swap if needed
      const conflict = KeyBindings.findConflict(phaserKey, listeningAction);
      if (conflict) {
        // Swap: give the conflicting action our old key
        const oldKey = KeyBindings.get()[listeningAction];
        KeyBindings.set(conflict, oldKey);
      }
      KeyBindings.set(listeningAction, phaserKey);
      setListeningAction(null);
      forceUpdate();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [listeningAction]);

  const handleVolumeChange = useCallback((category: 'master' | 'music' | 'sfx' | 'ui', value: number) => {
    AudioManager.init();
    AudioManager.resume();
    AudioManager.setVolume(category, value);
    setAudioSettings({ ...AudioManager.settings });
    // Play a test sound so the user can hear the current volume
    if (category === 'ui') {
      AudioManager.playMenuClick();
    } else if (category === 'sfx') {
      AudioManager.playMenuClick();
    }
  }, []);

  const updateSetting = (partial: Partial<GameSettingsData>) => {
    GameSettings.set(partial);
    setSettings(GameSettings.get());
    // Notify App.tsx when colorblind mode changes so it can update the canvas filter
    if (partial.colorblindMode !== undefined) {
      window.dispatchEvent(new CustomEvent('colorblind-mode-change'));
    }
    // Apply mono audio change immediately
    if (partial.monoAudio !== undefined) {
      AudioManager.setMonoMode(partial.monoAudio);
    }
  };

  const renderToggle = (
    label: string,
    id: string,
    value: boolean,
    onChange: (val: boolean) => void,
  ) => {
    const isHovered = hoveredToggle === id;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: isHovered
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          border: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.06)"}`,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={() => setHoveredToggle(id)}
        onMouseLeave={() => setHoveredToggle(null)}
        onClick={() => onChange(!value)}
      >
        <span
          style={{
            fontSize: "15px",
            color: "rgba(200, 200, 220, 0.85)",
            letterSpacing: "1px",
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: "52px",
            height: "28px",
            borderRadius: "14px",
            background: value
              ? "rgba(224, 208, 160, 0.35)"
              : "rgba(255, 255, 255, 0.08)",
            border: `1px solid ${value ? "rgba(224, 208, 160, 0.5)" : "rgba(255, 255, 255, 0.15)"}`,
            position: "relative",
            transition: "all 0.25s ease",
          }}
        >
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: value ? "#e0d0a0" : "rgba(200, 200, 220, 0.4)",
              position: "absolute",
              top: "2px",
              left: value ? "27px" : "2px",
              transition: "all 0.25s ease",
              boxShadow: value
                ? "0 0 8px rgba(224, 208, 160, 0.4)"
                : "none",
            }}
          />
        </div>
      </div>
    );
  };

  const renderOptionSelector = (
    label: string,
    rowId: string,
    options: string[],
    currentValue: string,
    onSelect: (value: string) => void,
    description?: string,
  ) => {
    const isHovered = hoveredToggle === rowId;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: isHovered
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          border: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.06)"}`,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={() => setHoveredToggle(rowId)}
        onMouseLeave={() => setHoveredToggle(null)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span
            style={{
              fontSize: "15px",
              color: "rgba(200, 200, 220, 0.85)",
              letterSpacing: "1px",
            }}
          >
            {label}
          </span>
          {description && (
            <span
              style={{
                fontSize: "11px",
                color: "rgba(200, 200, 220, 0.45)",
                letterSpacing: "0.5px",
              }}
            >
              {description}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {options.map((opt) => {
            const isActive = currentValue === opt;
            const isOptHovered = hoveredToggle === `${rowId}-${opt}`;
            return (
              <button
                key={opt}
                onMouseEnter={() => setHoveredToggle(`${rowId}-${opt}`)}
                onMouseLeave={() => setHoveredToggle(null)}
                onClick={() => onSelect(opt)}
                style={{
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  border: `1px solid ${isActive ? "rgba(224, 208, 160, 0.5)" : isOptHovered ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.1)"}`,
                  borderRadius: "4px",
                  background: isActive
                    ? "rgba(224, 208, 160, 0.2)"
                    : isOptHovered
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(255, 255, 255, 0.03)",
                  color: isActive
                    ? "#e0d0a0"
                    : isOptHovered
                      ? "#fff"
                      : "rgba(200, 200, 220, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderParticleSelector = () => {
    const isHovered = hoveredToggle === "particles-row";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: isHovered
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          border: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.06)"}`,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={() => setHoveredToggle("particles-row")}
        onMouseLeave={() => setHoveredToggle(null)}
      >
        <span
          style={{
            fontSize: "15px",
            color: "rgba(200, 200, 220, 0.85)",
            letterSpacing: "1px",
          }}
        >
          Particle Effects
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          {PARTICLE_OPTIONS.map((opt) => {
            const isActive = settings.particleEffects === opt;
            const isOptHovered = hoveredToggle === `particle-${opt}`;
            return (
              <button
                key={opt}
                onMouseEnter={() => setHoveredToggle(`particle-${opt}`)}
                onMouseLeave={() => setHoveredToggle(null)}
                onClick={() =>
                  updateSetting({ particleEffects: opt })
                }
                style={{
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  border: `1px solid ${isActive ? "rgba(224, 208, 160, 0.5)" : isOptHovered ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.1)"}`,
                  borderRadius: "4px",
                  background: isActive
                    ? "rgba(224, 208, 160, 0.2)"
                    : isOptHovered
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(255, 255, 255, 0.03)",
                  color: isActive
                    ? "#e0d0a0"
                    : isOptHovered
                      ? "#fff"
                      : "rgba(200, 200, 220, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderToggleWithDescription = (
    label: string,
    description: string,
    id: string,
    value: boolean,
    onChange: (val: boolean) => void,
    disabled?: boolean,
  ) => {
    const isHovered = hoveredToggle === id && !disabled;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: isHovered
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          border: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.06)"}`,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          opacity: disabled ? 0.4 : 1,
        }}
        onMouseEnter={() => !disabled && setHoveredToggle(id)}
        onMouseLeave={() => setHoveredToggle(null)}
        onClick={() => !disabled && onChange(!value)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span
            style={{
              fontSize: "15px",
              color: disabled ? "rgba(200, 200, 220, 0.4)" : "rgba(200, 200, 220, 0.85)",
              letterSpacing: "1px",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: "11px",
              color: disabled ? "rgba(200, 200, 220, 0.25)" : "rgba(200, 200, 220, 0.45)",
              letterSpacing: "0.5px",
            }}
          >
            {description}
          </span>
        </div>
        <div
          style={{
            width: "52px",
            height: "28px",
            borderRadius: "14px",
            background: value && !disabled
              ? "rgba(68, 136, 204, 0.35)"
              : "rgba(255, 255, 255, 0.08)",
            border: `1px solid ${value && !disabled ? "rgba(68, 136, 204, 0.5)" : "rgba(255, 255, 255, 0.15)"}`,
            position: "relative",
            transition: "all 0.25s ease",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: value && !disabled ? "#4488cc" : "rgba(200, 200, 220, 0.4)",
              position: "absolute",
              top: "2px",
              left: value ? "27px" : "2px",
              transition: "all 0.25s ease",
              boxShadow: value && !disabled
                ? "0 0 8px rgba(68, 136, 204, 0.4)"
                : "none",
            }}
          />
        </div>
      </div>
    );
  };

  const renderVolumeSlider = (
    label: string,
    id: string,
    category: 'master' | 'music' | 'sfx' | 'ui',
    value: number,
  ) => {
    const isHovered = hoveredToggle === id;
    const pct = Math.round(value * 100);
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: isHovered
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          border: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.06)"}`,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={() => setHoveredToggle(id)}
        onMouseLeave={() => setHoveredToggle(null)}
      >
        <span
          style={{
            fontSize: "15px",
            color: "rgba(200, 200, 220, 0.85)",
            letterSpacing: "1px",
            minWidth: "120px",
          }}
        >
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, justifyContent: "flex-end" }}>
          <input
            type="range"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => handleVolumeChange(category, parseInt(e.target.value) / 100)}
            style={{
              width: "180px",
              height: "6px",
              cursor: "pointer",
              accentColor: "#e0d0a0",
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "3px",
              outline: "none",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              color: "#e0d0a0",
              minWidth: "40px",
              textAlign: "right",
              letterSpacing: "1px",
            }}
          >
            {pct}%
          </span>
        </div>
      </div>
    );
  };

  const renderAccessibilitySlider = (
    label: string,
    description: string,
    id: string,
    value: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    onChange: (val: number) => void,
  ) => {
    const isHovered = hoveredToggle === id;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: isHovered
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          border: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.06)"}`,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={() => setHoveredToggle(id)}
        onMouseLeave={() => setHoveredToggle(null)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: "160px" }}>
          <span
            style={{
              fontSize: "15px",
              color: "rgba(200, 200, 220, 0.85)",
              letterSpacing: "1px",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: "11px",
              color: "rgba(200, 200, 220, 0.45)",
              letterSpacing: "0.5px",
            }}
          >
            {description}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, justifyContent: "flex-end" }}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            style={{
              width: "160px",
              height: "6px",
              cursor: "pointer",
              accentColor: "#4488cc",
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "3px",
              outline: "none",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              color: "#4488cc",
              minWidth: "55px",
              textAlign: "right",
              letterSpacing: "1px",
            }}
          >
            {value}{unit}
          </span>
        </div>
      </div>
    );
  };

  const renderDamageNumberSizeSelector = () => {
    const isHovered = hoveredToggle === "dmg-size-row";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: isHovered
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          border: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.06)"}`,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={() => setHoveredToggle("dmg-size-row")}
        onMouseLeave={() => setHoveredToggle(null)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span
            style={{
              fontSize: "15px",
              color: "rgba(200, 200, 220, 0.85)",
              letterSpacing: "1px",
            }}
          >
            Damage Number Size
          </span>
          <span
            style={{
              fontSize: "11px",
              color: "rgba(200, 200, 220, 0.45)",
              letterSpacing: "0.5px",
            }}
          >
            Adjust the size of floating damage numbers
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {DAMAGE_NUMBER_SIZE_OPTIONS.map((opt) => {
            const isActive = settings.damageNumberSize === opt;
            const isOptHovered = hoveredToggle === `dmg-size-${opt}`;
            return (
              <button
                key={opt}
                onMouseEnter={() => setHoveredToggle(`dmg-size-${opt}`)}
                onMouseLeave={() => setHoveredToggle(null)}
                onClick={() => updateSetting({ damageNumberSize: opt })}
                style={{
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  border: `1px solid ${isActive ? "rgba(68, 136, 204, 0.5)" : isOptHovered ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.1)"}`,
                  borderRadius: "4px",
                  background: isActive
                    ? "rgba(68, 136, 204, 0.2)"
                    : isOptHovered
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(255, 255, 255, 0.03)",
                  color: isActive
                    ? "#4488cc"
                    : isOptHovered
                      ? "#fff"
                      : "rgba(200, 200, 220, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a12",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "monospace",
        color: "white",
        zIndex: 100,
        overflowY: "auto",
      }}
    >
      {/* Fixed Back Button */}
      <button
        onClick={onBack}
        onMouseEnter={() => setBackHover(true)}
        onMouseLeave={() => setBackHover(false)}
        style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          padding: "10px 22px",
          fontSize: "14px",
          fontFamily: "monospace",
          fontWeight: "bold",
          letterSpacing: "2px",
          textTransform: "uppercase",
          background: backHover
            ? "rgba(255, 255, 255, 0.12)"
            : "rgba(10, 10, 18, 0.85)",
          color: backHover ? "#fff" : "rgba(200, 200, 220, 0.7)",
          border: `1px solid ${backHover ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.12)"}`,
          borderRadius: "6px",
          cursor: "pointer",
          transition: "all 0.2s ease",
          outline: "none",
          zIndex: 200,
          backdropFilter: "blur(8px)",
        }}
      >
        BACK
      </button>

      {/* Header */}
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          padding: "40px 40px 0",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: "48px",
            fontWeight: "bold",
            letterSpacing: "4px",
            textTransform: "uppercase",
            color: "#e0d0a0",
            textShadow: "0 0 20px rgba(224, 208, 160, 0.3)",
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          Settings
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#666",
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          Customize your experience
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          padding: "0 40px 40px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "36px",
        }}
      >
        {/* Audio Settings */}
        <div>
          <div style={sectionTitleStyle}>Audio</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {renderVolumeSlider("Master Volume", "vol-master", "master", audioSettings.masterVolume)}
            {renderVolumeSlider("Music Volume", "vol-music", "music", audioSettings.musicVolume)}
            {renderVolumeSlider("SFX Volume", "vol-sfx", "sfx", audioSettings.sfxVolume)}
            {renderVolumeSlider("UI Sounds", "vol-ui", "ui", audioSettings.uiVolume)}
          </div>
        </div>

        {/* Display Settings */}
        <div>
          <div style={sectionTitleStyle}>Display</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {renderToggle("Fullscreen", "fullscreen", isFullscreen, () =>
              toggleFullscreen(),
            )}
            {renderOptionSelector(
              "Screen Shake",
              "screenShake",
              SCREEN_SHAKE_OPTIONS as unknown as string[],
              settings.screenShakeIntensity,
              (val) => updateSetting({ screenShakeIntensity: val as GameSettingsData["screenShakeIntensity"] }),
            )}
            {renderOptionSelector(
              "Graphics Quality",
              "graphicsQuality",
              GRAPHICS_QUALITY_OPTIONS as unknown as string[],
              settings.graphicsQuality,
              (val) => updateSetting({ graphicsQuality: val as GameSettingsData["graphicsQuality"] }),
              "Adjusts particle density and visual effects",
            )}
            {renderToggle(
              "Damage Numbers",
              "damageNumbers",
              settings.damageNumbers,
              (val) => updateSetting({ damageNumbers: val }),
            )}
            {renderParticleSelector()}
            {renderToggle("Show FPS", "showFPS", settings.showFPS, (val) =>
              updateSetting({ showFPS: val }),
            )}
            {renderToggle("Show Speed Meter", "showSpeedMeter", settings.showSpeedMeter, (val) =>
              updateSetting({ showSpeedMeter: val }),
            )}
          </div>
        </div>

        {/* Accessibility Settings */}
        <div
          style={{
            background: "rgba(68, 136, 204, 0.04)",
            border: "1px solid rgba(68, 136, 204, 0.15)",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div
            style={{
              ...sectionTitleStyle,
              color: "#4488cc",
              borderBottom: "1px solid rgba(68, 136, 204, 0.15)",
            }}
          >
            Accessibility
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {/* Assist Mode master toggle */}
            {renderToggleWithDescription(
              "Assist Mode",
              "Enable gameplay assists (does not affect achievements)",
              "assistMode",
              settings.assistMode,
              (val) => updateSetting({ assistMode: val }),
            )}

            {/* Assist sub-options */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                paddingLeft: "16px",
                borderLeft: `2px solid ${settings.assistMode ? "rgba(68, 136, 204, 0.3)" : "rgba(255, 255, 255, 0.06)"}`,
                marginLeft: "4px",
                transition: "border-color 0.2s ease",
              }}
            >
              {renderToggleWithDescription(
                "Extra I-Frames",
                "Doubles invincibility duration after taking damage",
                "extraIFrames",
                settings.extraIFrames,
                (val) => updateSetting({ extraIFrames: val }),
                !settings.assistMode,
              )}
              {renderToggleWithDescription(
                "Slower Enemies",
                "Enemy attacks are 50% slower",
                "slowerEnemies",
                settings.slowerEnemies,
                (val) => updateSetting({ slowerEnemies: val }),
                !settings.assistMode,
              )}
              {renderToggleWithDescription(
                "Extra Starting Health",
                "Start with +2 max health",
                "extraStartingHealth",
                settings.extraStartingHealth,
                (val) => updateSetting({ extraStartingHealth: val }),
                !settings.assistMode,
              )}
              {renderToggleWithDescription(
                "Auto-Dodge",
                "Automatically triggers perfect dodge timing",
                "autoDodge",
                settings.autoDodge,
                (val) => updateSetting({ autoDodge: val }),
                !settings.assistMode,
              )}
              {renderToggleWithDescription(
                "Easier Combos",
                "More lenient combo timing windows",
                "reducedComboTiming",
                settings.reducedComboTiming,
                (val) => updateSetting({ reducedComboTiming: val }),
                !settings.assistMode,
              )}
            </div>

            {/* Divider between assist and visual */}
            <div
              style={{
                height: "1px",
                background: "rgba(68, 136, 204, 0.1)",
                margin: "6px 0",
              }}
            />

            {/* Visual Accessibility (always available) */}
            {renderToggleWithDescription(
              "High Contrast",
              "Brighter colors and entity outlines",
              "highContrast",
              settings.highContrast,
              (val) => updateSetting({ highContrast: val }),
            )}
            {renderToggleWithDescription(
              "Flash Reduction",
              "Reduces screen flash intensity",
              "flashReduction",
              settings.flashReduction,
              (val) => updateSetting({ flashReduction: val }),
            )}
            {renderDamageNumberSizeSelector()}

            {/* Divider before colorblind options */}
            <div
              style={{
                height: "1px",
                background: "rgba(68, 136, 204, 0.1)",
                margin: "6px 0",
              }}
            />

            {/* Colorblind Mode dropdown-style selector */}
            {(() => {
              const rowId = "colorblind-mode";
              const isHovered = hoveredToggle === rowId;
              const currentMode = settings.colorblindMode || "NONE";
              return (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 20px",
                      background: isHovered
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      border: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.06)"}`,
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={() => setHoveredToggle(rowId)}
                    onMouseLeave={() => setHoveredToggle(null)}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span
                        style={{
                          fontSize: "15px",
                          color: "rgba(200, 200, 220, 0.85)",
                          letterSpacing: "1px",
                        }}
                      >
                        Colorblind Mode
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "rgba(200, 200, 220, 0.45)",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Apply color correction filter to the game
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {COLORBLIND_MODE_OPTIONS.map((opt) => {
                        const isActive = currentMode === opt;
                        const optId = `colorblind-${opt}`;
                        const isOptHovered = hoveredToggle === optId;
                        return (
                          <button
                            key={opt}
                            onMouseEnter={() => setHoveredToggle(optId)}
                            onMouseLeave={() => setHoveredToggle(null)}
                            onClick={() => updateSetting({ colorblindMode: opt })}
                            title={COLORBLIND_MODE_DESCRIPTIONS[opt]}
                            style={{
                              padding: "6px 12px",
                              fontSize: "11px",
                              fontFamily: "monospace",
                              fontWeight: "bold",
                              letterSpacing: "0.5px",
                              border: `1px solid ${isActive ? "rgba(68, 136, 204, 0.5)" : isOptHovered ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.1)"}`,
                              borderRadius: "4px",
                              background: isActive
                                ? "rgba(68, 136, 204, 0.2)"
                                : isOptHovered
                                  ? "rgba(255, 255, 255, 0.08)"
                                  : "rgba(255, 255, 255, 0.03)",
                              color: isActive
                                ? "#4488cc"
                                : isOptHovered
                                  ? "#fff"
                                  : "rgba(200, 200, 220, 0.5)",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              outline: "none",
                            }}
                          >
                            {COLORBLIND_MODE_LABELS[opt]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color swatch preview strip */}
                  {currentMode !== "NONE" && (() => {
                    const swatches = ColorblindFilter.getPreviewSwatches(currentMode as ColorblindMode);
                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 20px",
                          marginTop: "6px",
                          background: "rgba(255, 255, 255, 0.02)",
                          borderRadius: "6px",
                          border: "1px solid rgba(68, 136, 204, 0.1)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            color: "rgba(200, 200, 220, 0.45)",
                            letterSpacing: "0.5px",
                            marginRight: "4px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Adjusted palette:
                        </span>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {swatches.map((swatch) => (
                            <div
                              key={swatch.label}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "2px",
                              }}
                            >
                              <div
                                style={{
                                  width: "24px",
                                  height: "16px",
                                  borderRadius: "3px",
                                  background: swatch.hex,
                                  border: "1px solid rgba(255, 255, 255, 0.15)",
                                }}
                              />
                              <span
                                style={{
                                  fontSize: "8px",
                                  color: "rgba(200, 200, 220, 0.35)",
                                  letterSpacing: "0.3px",
                                }}
                              >
                                {swatch.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Enemy Outlines toggle */}
            {renderToggleWithDescription(
              "Enemy Outlines",
              "Adds visible outlines to enemies for better visibility",
              "enemyOutlines",
              settings.enemyOutlines,
              (val) => updateSetting({ enemyOutlines: val }),
            )}

            {/* Larger UI toggle */}
            {renderToggleWithDescription(
              "Larger UI",
              "Scales HUD elements to 120% for readability",
              "largerUI",
              settings.largerUI,
              (val) => updateSetting({ largerUI: val }),
            )}

            {/* Divider before audio & input accessibility */}
            <div
              style={{
                height: "1px",
                background: "rgba(68, 136, 204, 0.1)",
                margin: "6px 0",
              }}
            />

            {/* Audio Accessibility */}
            {renderToggleWithDescription(
              "Mono Audio",
              "Merge stereo channels to mono (useful for single-ear listening)",
              "monoAudio",
              settings.monoAudio,
              (val) => updateSetting({ monoAudio: val }),
            )}
            {renderToggleWithDescription(
              "Visual Sound Cues",
              "Show on-screen indicators for important sounds (for deaf/HoH players)",
              "visualSoundCues",
              settings.visualSoundCues,
              (val) => updateSetting({ visualSoundCues: val }),
            )}

            {/* Divider before input accessibility */}
            <div
              style={{
                height: "1px",
                background: "rgba(68, 136, 204, 0.1)",
                margin: "6px 0",
              }}
            />

            {/* Input Accessibility */}
            {renderToggleWithDescription(
              "Toggle Dodge",
              "Press dodge to activate instead of hold (press again to cancel)",
              "toggleDodge",
              settings.toggleDodge,
              (val) => updateSetting({ toggleDodge: val }),
            )}
            {renderToggleWithDescription(
              "Toggle Block",
              "Press block to activate instead of hold",
              "toggleBlock",
              settings.toggleBlock,
              (val) => updateSetting({ toggleBlock: val }),
            )}

            {/* Timing Window Sliders */}
            {renderAccessibilitySlider(
              "Jump Buffer",
              "Time window to buffer jump input before landing",
              "jumpBufferWindow",
              settings.jumpBufferWindow,
              50,
              300,
              25,
              "ms",
              (val) => updateSetting({ jumpBufferWindow: val }),
            )}
            {renderAccessibilitySlider(
              "Coyote Time",
              "Grace period to jump after walking off an edge",
              "coyoteTimeWindow",
              settings.coyoteTimeWindow,
              50,
              300,
              25,
              "ms",
              (val) => updateSetting({ coyoteTimeWindow: val }),
            )}
            {renderAccessibilitySlider(
              "Input Delay",
              "Compensate for input lag by buffering inputs",
              "inputDelay",
              settings.inputDelay,
              0,
              200,
              10,
              "ms",
              (val) => updateSetting({ inputDelay: val }),
            )}
          </div>
        </div>

        {/* Tutorial */}
        <div>
          <div style={sectionTitleStyle}>Tutorial</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              background: "rgba(255, 255, 255, 0.03)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "15px",
                  color: "rgba(200, 200, 220, 0.85)",
                  letterSpacing: "1px",
                }}
              >
                Reset Tutorial
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(200, 200, 220, 0.45)",
                  letterSpacing: "0.5px",
                }}
              >
                Show all tutorial hints again on next run
              </span>
            </div>
            <button
              onClick={() => {
                TutorialManager.reset();
                setTutorialResetDone(true);
                setTimeout(() => setTutorialResetDone(false), 2000);
              }}
              onMouseEnter={() => setResetTutorialHover(true)}
              onMouseLeave={() => setResetTutorialHover(false)}
              style={{
                padding: "6px 18px",
                fontSize: "12px",
                fontFamily: "monospace",
                fontWeight: "bold",
                letterSpacing: "1px",
                textTransform: "uppercase",
                border: `1px solid ${tutorialResetDone ? "rgba(80, 200, 80, 0.5)" : resetTutorialHover ? "rgba(224, 208, 160, 0.5)" : "rgba(224, 208, 160, 0.2)"}`,
                borderRadius: "4px",
                background: tutorialResetDone
                  ? "rgba(80, 200, 80, 0.15)"
                  : resetTutorialHover
                    ? "rgba(224, 208, 160, 0.15)"
                    : "rgba(224, 208, 160, 0.05)",
                color: tutorialResetDone ? "#50c850" : "#e0d0a0",
                cursor: "pointer",
                transition: "all 0.2s ease",
                outline: "none",
                minWidth: "80px",
              }}
            >
              {tutorialResetDone ? "Done!" : "Reset"}
            </button>
          </div>
        </div>

        {/* Keyboard Controls — Interactive Rebinding */}
        <div>
          <div style={sectionTitleStyle}>Keyboard Controls</div>
          <p
            style={{
              fontSize: "12px",
              color: "rgba(200, 200, 220, 0.45)",
              marginBottom: "14px",
              letterSpacing: "0.5px",
            }}
          >
            Click a key to rebind it. Press ESC to cancel. Changes take effect on next run.
          </p>
          {ACTION_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: "16px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "bold",
                  color: "rgba(224, 208, 160, 0.6)",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                  paddingLeft: "4px",
                }}
              >
                {group.label}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {group.actions.map((action) => {
                  const currentKey = KeyBindings.get()[action];
                  const isListening = listeningAction === action;
                  const isDefault = currentKey === KeyBindings.getDefault(action);
                  const isHovered = hoveredToggle === `kb-${action}`;
                  return (
                    <div
                      key={action}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 20px",
                        background: isListening
                          ? "rgba(224, 208, 160, 0.06)"
                          : isHovered
                            ? "rgba(255, 255, 255, 0.04)"
                            : "rgba(255, 255, 255, 0.02)",
                        borderRadius: "4px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={() => setHoveredToggle(`kb-${action}`)}
                      onMouseLeave={() => setHoveredToggle(null)}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          color: "rgba(200, 200, 220, 0.7)",
                          letterSpacing: "1px",
                        }}
                      >
                        {ACTION_LABELS[action]}
                      </span>
                      <button
                        onClick={() => setListeningAction(isListening ? null : action)}
                        style={{
                          fontSize: "13px",
                          fontWeight: "bold",
                          fontFamily: "monospace",
                          color: isListening
                            ? "#fff"
                            : isDefault
                              ? "#e0d0a0"
                              : "#88ccff",
                          padding: "3px 12px",
                          background: isListening
                            ? "rgba(224, 208, 160, 0.2)"
                            : "rgba(224, 208, 160, 0.08)",
                          border: `1px solid ${
                            isListening
                              ? "rgba(224, 208, 160, 0.6)"
                              : isDefault
                                ? "rgba(224, 208, 160, 0.15)"
                                : "rgba(136, 204, 255, 0.3)"
                          }`,
                          borderRadius: "4px",
                          letterSpacing: "1px",
                          minWidth: "100px",
                          textAlign: "center",
                          cursor: "pointer",
                          outline: "none",
                          transition: "all 0.2s ease",
                          animation: isListening ? "pulse-border 1s ease-in-out infinite" : "none",
                        }}
                      >
                        {isListening ? "Press key..." : displayKeyName(currentKey)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Reset to Defaults */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              background: "rgba(255, 255, 255, 0.03)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              marginTop: "4px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "15px",
                  color: "rgba(200, 200, 220, 0.85)",
                  letterSpacing: "1px",
                }}
              >
                Reset Key Bindings
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(200, 200, 220, 0.45)",
                  letterSpacing: "0.5px",
                }}
              >
                Restore all keys to their default values
              </span>
            </div>
            <button
              onClick={() => {
                KeyBindings.resetToDefaults();
                setBindingsResetDone(true);
                forceUpdate();
                setTimeout(() => setBindingsResetDone(false), 2000);
              }}
              onMouseEnter={() => setResetBindingsHover(true)}
              onMouseLeave={() => setResetBindingsHover(false)}
              style={{
                padding: "6px 18px",
                fontSize: "12px",
                fontFamily: "monospace",
                fontWeight: "bold",
                letterSpacing: "1px",
                textTransform: "uppercase",
                border: `1px solid ${bindingsResetDone ? "rgba(80, 200, 80, 0.5)" : resetBindingsHover ? "rgba(224, 208, 160, 0.5)" : "rgba(224, 208, 160, 0.2)"}`,
                borderRadius: "4px",
                background: bindingsResetDone
                  ? "rgba(80, 200, 80, 0.15)"
                  : resetBindingsHover
                    ? "rgba(224, 208, 160, 0.15)"
                    : "rgba(224, 208, 160, 0.05)",
                color: bindingsResetDone ? "#50c850" : "#e0d0a0",
                cursor: "pointer",
                transition: "all 0.2s ease",
                outline: "none",
                minWidth: "80px",
              }}
            >
              {bindingsResetDone ? "Done!" : "Reset"}
            </button>
          </div>
          {/* CSS animation for pulsing border */}
          <style>{`
            @keyframes pulse-border {
              0%, 100% { border-color: rgba(224, 208, 160, 0.3); }
              50% { border-color: rgba(224, 208, 160, 0.8); }
            }
          `}</style>
        </div>

        {/* Gamepad Controls */}
        <div>
          <div style={sectionTitleStyle}>Gamepad Controls</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 20px",
              marginBottom: "10px",
              background: gamepadConnected
                ? "rgba(80, 200, 80, 0.08)"
                : "rgba(255, 255, 255, 0.02)",
              borderRadius: "6px",
              border: `1px solid ${gamepadConnected ? "rgba(80, 200, 80, 0.25)" : "rgba(255, 255, 255, 0.06)"}`,
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: gamepadConnected ? "#50c850" : "rgba(200, 200, 220, 0.3)",
                boxShadow: gamepadConnected ? "0 0 8px rgba(80, 200, 80, 0.5)" : "none",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "14px",
                color: gamepadConnected ? "#50c850" : "rgba(200, 200, 220, 0.5)",
                letterSpacing: "1px",
                fontWeight: "bold",
              }}
            >
              {gamepadConnected ? "Gamepad: Connected" : "Gamepad: Not Detected"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {GAMEPAD_CONTROLS.map(({ key, action }) => (
              <div
                key={`gp-${key}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 20px",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "4px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "rgba(200, 200, 220, 0.7)",
                    letterSpacing: "1px",
                  }}
                >
                  {action}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    color: "#88bbee",
                    padding: "3px 12px",
                    background: "rgba(136, 187, 238, 0.08)",
                    border: "1px solid rgba(136, 187, 238, 0.15)",
                    borderRadius: "4px",
                    letterSpacing: "1px",
                    minWidth: "80px",
                    textAlign: "center",
                  }}
                >
                  {key}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mouse Controls */}
        <div>
          <div style={sectionTitleStyle}>Mouse Controls</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {renderToggleWithDescription(
              "Click to Attack",
              "Left click = attack, Right click = dodge",
              "mouseAttackEnabled",
              settings.mouseAttackEnabled,
              (val) => updateSetting({ mouseAttackEnabled: val }),
            )}
            {renderToggleWithDescription(
              "Mouse Aim",
              "Aim projectile abilities with mouse cursor",
              "mouseAimEnabled",
              settings.mouseAimEnabled,
              (val) => updateSetting({ mouseAimEnabled: val }),
            )}
            {renderToggleWithDescription(
              "Camera Lookahead",
              "Camera shifts toward mouse position",
              "mouseCameraLookahead",
              settings.mouseCameraLookahead,
              (val) => updateSetting({ mouseCameraLookahead: val }),
            )}
          </div>
        </div>
      </div>

      {/* Back button */}
      <div
        style={{
          padding: "30px 0 40px",
        }}
      >
        <button
          onClick={onBack}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            padding: "14px 48px",
            fontSize: "18px",
            fontFamily: "monospace",
            fontWeight: "bold",
            letterSpacing: "2px",
            textTransform: "uppercase",
            background: backHover
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(255, 255, 255, 0.06)",
            color: backHover ? "#fff" : "rgba(200, 200, 220, 0.7)",
            border: `1px solid ${backHover ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.1)"}`,
            borderRadius: "6px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            outline: "none",
            transform: backHover ? "scale(1.03)" : "scale(1)",
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default SettingsScreen;

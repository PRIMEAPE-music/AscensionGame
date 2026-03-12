import React, { useState, useEffect, useCallback } from "react";
import { GameSettings } from "../systems/GameSettings";
import type { GameSettingsData } from "../systems/GameSettings";
import { AudioManager } from "../systems/AudioManager";
import { GamepadManager } from "../systems/GamepadManager";
import { TutorialManager } from "../systems/TutorialManager";

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

const CONTROLS: { key: string; action: string }[] = [
  { key: "Arrow Keys", action: "Movement" },
  { key: "SPACE", action: "Jump" },
  { key: "Z", action: "Attack B" },
  { key: "X", action: "Attack X" },
  { key: "C", action: "Attack Y" },
  { key: "SHIFT", action: "Dodge / Air Dash" },
  { key: "V", action: "Grappling Hook" },
  { key: "Q", action: "Cataclysm" },
  { key: "E", action: "Temporal Rift" },
  { key: "R", action: "Divine Intervention" },
  { key: "F", action: "Essence Burst" },
  { key: "ESC", action: "Pause" },
];

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

  useEffect(() => {
    GameSettings.load();
    setSettings(GameSettings.get());
    AudioManager.init();
    setAudioSettings({ ...AudioManager.settings });
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

        {/* Controls Reference */}
        <div>
          <div style={sectionTitleStyle}>Keyboard Controls</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {CONTROLS.map(({ key, action }) => (
              <div
                key={key}
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
                    color: "#e0d0a0",
                    padding: "3px 12px",
                    background: "rgba(224, 208, 160, 0.08)",
                    border: "1px solid rgba(224, 208, 160, 0.15)",
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

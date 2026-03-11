import React, { useState, useEffect } from "react";
import { GameSettings } from "../systems/GameSettings";
import type { GameSettingsData } from "../systems/GameSettings";

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

const PARTICLE_OPTIONS: GameSettingsData["particleEffects"][] = [
  "LOW",
  "MEDIUM",
  "HIGH",
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const [settings, setSettings] = useState<GameSettingsData>(GameSettings.get());
  const [backHover, setBackHover] = useState(false);
  const [hoveredToggle, setHoveredToggle] = useState<string | null>(null);

  useEffect(() => {
    GameSettings.load();
    setSettings(GameSettings.get());
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
            {renderToggle("Screen Shake", "screenShake", settings.screenShake, (val) =>
              updateSetting({ screenShake: val }),
            )}
            {renderToggle(
              "Damage Numbers",
              "damageNumbers",
              settings.damageNumbers,
              (val) => updateSetting({ damageNumbers: val }),
            )}
            {renderParticleSelector()}
          </div>
        </div>

        {/* Controls Reference */}
        <div>
          <div style={sectionTitleStyle}>Controls</div>
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

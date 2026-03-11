import React, { useState, useEffect } from "react";
import { PersistentStats } from "../systems/PersistentStats";
import { DailyChallenge } from "../systems/DailyChallenge";
import { RUN_MODIFIERS } from "../config/RunModifiers";
import { CLASSES } from "../config/ClassConfig";
import type { ClassType } from "../config/ClassConfig";

interface MainMenuProps {
  onStartRun: () => void;
  onCollection: () => void;
  onStatistics: () => void;
  onSettings: () => void;
  onCosmetics: () => void;
  onDailyChallenge: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const menuButtonStyle: React.CSSProperties = {
  width: "320px",
  padding: "18px 36px",
  fontSize: "22px",
  fontFamily: "monospace",
  fontWeight: "bold",
  letterSpacing: "3px",
  textTransform: "uppercase",
  border: "1px solid rgba(224, 208, 160, 0.25)",
  borderRadius: "6px",
  cursor: "pointer",
  transition: "all 0.25s ease",
  outline: "none",
  background: "rgba(224, 208, 160, 0.06)",
  color: "#e0d0a0",
  textAlign: "center" as const,
};

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartRun,
  onCollection,
  onStatistics,
  onSettings,
  onCosmetics,
  onDailyChallenge,
}) => {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [titleVisible, setTitleVisible] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);

  // Lifetime stats summary
  const [totalRuns, setTotalRuns] = useState(0);
  const [highestAlt, setHighestAlt] = useState(0);
  const [totalPlayTime, setTotalPlayTime] = useState(0);

  useEffect(() => {
    const titleTimer = setTimeout(() => setTitleVisible(true), 100);
    const buttonsTimer = setTimeout(() => setButtonsVisible(true), 500);
    const statsTimer = setTimeout(() => setStatsVisible(true), 900);

    try {
      const stats = PersistentStats.getLifetimeStats();
      setTotalRuns(stats.totalRuns);
      setTotalPlayTime(stats.totalPlayTime);
      // Get overall highest altitude across all classes
      let maxAlt = 0;
      for (const alt of Object.values(stats.highestAltitude)) {
        if (alt > maxAlt) maxAlt = alt;
      }
      setHighestAlt(maxAlt);
    } catch {
      // Stats not loaded yet
    }

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(buttonsTimer);
      clearTimeout(statsTimer);
    };
  }, []);

  // Daily challenge preview info
  const dailyChallenge = DailyChallenge.getCurrentChallenge();
  const dailyPreview = dailyChallenge
    ? (() => {
        const cls = CLASSES[dailyChallenge.class as ClassType];
        const className = cls ? cls.name : dailyChallenge.class;
        const modName = dailyChallenge.modifiers.length > 0
          ? (RUN_MODIFIERS.find((m) => m.id === dailyChallenge.modifiers[0])?.name ?? dailyChallenge.modifiers[0])
          : "";
        return `Today: ${className}${modName ? ` + ${modName}` : ""}`;
      })()
    : "";

  const getButtonStyle = (id: string): React.CSSProperties => {
    const isHovered = hoveredButton === id;
    if (id === "start") {
      return {
        ...menuButtonStyle,
        background: isHovered
          ? "rgba(224, 208, 160, 0.2)"
          : "rgba(224, 208, 160, 0.08)",
        borderColor: isHovered
          ? "rgba(224, 208, 160, 0.6)"
          : "rgba(224, 208, 160, 0.3)",
        transform: isHovered ? "scale(1.04)" : "scale(1)",
        boxShadow: isHovered
          ? "0 0 30px rgba(224, 208, 160, 0.2), inset 0 0 20px rgba(224, 208, 160, 0.05)"
          : "none",
        color: isHovered ? "#ffd700" : "#e0d0a0",
      };
    }
    if (id === "daily") {
      return {
        ...menuButtonStyle,
        background: isHovered
          ? "rgba(240, 160, 48, 0.2)"
          : "rgba(240, 160, 48, 0.08)",
        borderColor: isHovered
          ? "rgba(240, 160, 48, 0.5)"
          : "rgba(240, 160, 48, 0.25)",
        transform: isHovered ? "scale(1.04)" : "scale(1)",
        boxShadow: isHovered
          ? "0 0 25px rgba(240, 160, 48, 0.2), inset 0 0 15px rgba(240, 160, 48, 0.05)"
          : "0 0 8px rgba(240, 160, 48, 0.08)",
        color: isHovered ? "#ffd080" : "#f0a030",
      };
    }
    return {
      ...menuButtonStyle,
      fontSize: "18px",
      padding: "14px 36px",
      background: isHovered
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(255, 255, 255, 0.03)",
      borderColor: isHovered
        ? "rgba(255, 255, 255, 0.25)"
        : "rgba(255, 255, 255, 0.1)",
      color: isHovered ? "#fff" : "rgba(200, 200, 220, 0.7)",
      transform: isHovered ? "scale(1.03)" : "scale(1)",
      boxShadow: isHovered
        ? "0 0 20px rgba(255, 255, 255, 0.08)"
        : "none",
    };
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
        justifyContent: "center",
        fontFamily: "monospace",
        color: "white",
        zIndex: 100,
        overflow: "hidden",
      }}
    >
      {/* Animated background */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(224, 208, 160, 0.04) 0%, transparent 60%), " +
            "radial-gradient(ellipse at 20% 80%, rgba(204, 68, 255, 0.03) 0%, transparent 50%), " +
            "radial-gradient(ellipse at 80% 70%, rgba(255, 215, 0, 0.02) 0%, transparent 50%)",
          animation: "menuBgPulse 8s ease-in-out infinite alternate",
          pointerEvents: "none",
        }}
      />

      {/* CSS animation keyframes */}
      <style>{`
        @keyframes menuBgPulse {
          0% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.7; transform: scale(1.02); }
        }
        @keyframes titleGlow {
          0% { text-shadow: 0 0 30px rgba(255, 215, 0, 0.3), 0 0 60px rgba(255, 215, 0, 0.15), 0 0 90px rgba(255, 215, 0, 0.05); }
          50% { text-shadow: 0 0 40px rgba(255, 215, 0, 0.5), 0 0 80px rgba(255, 215, 0, 0.25), 0 0 120px rgba(255, 215, 0, 0.1); }
          100% { text-shadow: 0 0 30px rgba(255, 215, 0, 0.3), 0 0 60px rgba(255, 215, 0, 0.15), 0 0 90px rgba(255, 215, 0, 0.05); }
        }
      `}</style>

      {/* Title */}
      <div
        style={{
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? "translateY(0)" : "translateY(-20px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
          textAlign: "center",
          marginBottom: "60px",
        }}
      >
        <h1
          style={{
            fontSize: "96px",
            fontWeight: "bold",
            letterSpacing: "16px",
            textTransform: "uppercase",
            color: "#ffd700",
            animation: "titleGlow 4s ease-in-out infinite",
            margin: 0,
            lineHeight: 1,
          }}
        >
          Ascension
        </h1>
        <p
          style={{
            fontSize: "18px",
            color: "rgba(224, 208, 160, 0.5)",
            letterSpacing: "6px",
            textTransform: "uppercase",
            marginTop: "12px",
          }}
        >
          Roguelike Platformer
        </p>
      </div>

      {/* Menu buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          alignItems: "center",
          opacity: buttonsVisible ? 1 : 0,
          transform: buttonsVisible ? "translateY(0)" : "translateY(15px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        <button
          style={getButtonStyle("start")}
          onMouseEnter={() => setHoveredButton("start")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={onStartRun}
        >
          Start Run
        </button>
        <button
          style={getButtonStyle("daily")}
          onMouseEnter={() => setHoveredButton("daily")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={onDailyChallenge}
        >
          <div>Daily Challenge</div>
          {dailyPreview && (
            <div
              style={{
                fontSize: "11px",
                fontWeight: "normal",
                letterSpacing: "1px",
                marginTop: "4px",
                opacity: 0.7,
              }}
            >
              {dailyPreview}
            </div>
          )}
        </button>
        <button
          style={getButtonStyle("collection")}
          onMouseEnter={() => setHoveredButton("collection")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={onCollection}
        >
          Collection
        </button>
        <button
          style={getButtonStyle("cosmetics")}
          onMouseEnter={() => setHoveredButton("cosmetics")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={onCosmetics}
        >
          Cosmetics
        </button>
        <button
          style={getButtonStyle("statistics")}
          onMouseEnter={() => setHoveredButton("statistics")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={onStatistics}
        >
          Statistics
        </button>
        <button
          style={getButtonStyle("settings")}
          onMouseEnter={() => setHoveredButton("settings")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={onSettings}
        >
          Settings
        </button>
      </div>

      {/* Lifetime stats summary at bottom */}
      {totalRuns > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            gap: "48px",
            opacity: statsVisible ? 1 : 0,
            transform: statsVisible ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(200, 200, 220, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: "4px",
              }}
            >
              Total Runs
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "rgba(224, 208, 160, 0.6)",
              }}
            >
              {totalRuns}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(200, 200, 220, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: "4px",
              }}
            >
              Highest Altitude
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "rgba(224, 208, 160, 0.6)",
              }}
            >
              {highestAlt}m
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(200, 200, 220, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: "4px",
              }}
            >
              Play Time
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "rgba(224, 208, 160, 0.6)",
              }}
            >
              {formatTime(totalPlayTime)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainMenu;

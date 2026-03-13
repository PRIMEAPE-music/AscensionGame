import React, { useState, useEffect } from "react";
import { PersistentStats } from "../systems/PersistentStats";
import { DailyChallenge } from "../systems/DailyChallenge";
import { RUN_MODIFIERS } from "../config/RunModifiers";
import { CLASSES } from "../config/ClassConfig";
import type { ClassType } from "../config/ClassConfig";
import { UnlockManager } from "../systems/UnlockManager";

interface MainMenuProps {
  onStartRun: () => void;
  onResumeRun?: () => void;
  hasSavedRun?: boolean;
  savedRunInfo?: { classType: string; altitude: number; timestamp: number };
  onSettings: () => void;
  onExtras: () => void;
  onDailyChallenge: () => void;
  onCoopStart?: () => void;
  onOnlineCoopStart?: () => void;
  onTrainingRoom?: () => void;
  onBossRush?: () => void;
  onEndlessMode?: () => void;
  onWeeklyChallenge?: () => void;
  onAscensionTree?: () => void;
  onClassMastery?: () => void;
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

const modePanelButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 24px",
  fontSize: "18px",
  fontFamily: "monospace",
  fontWeight: "bold",
  letterSpacing: "2px",
  textTransform: "uppercase",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "6px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  outline: "none",
  background: "rgba(255, 255, 255, 0.04)",
  color: "rgba(200, 200, 220, 0.8)",
  textAlign: "center" as const,
};

const lockedModeStyle: React.CSSProperties = {
  ...modePanelButtonStyle,
  cursor: "default",
  background: "rgba(60, 60, 80, 0.1)",
  borderColor: "rgba(100, 100, 120, 0.15)",
  color: "rgba(120, 120, 140, 0.5)",
};

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartRun,
  onResumeRun,
  hasSavedRun,
  savedRunInfo,
  onSettings,
  onExtras,
  onDailyChallenge,
  onCoopStart,
  onOnlineCoopStart,
  onTrainingRoom,
  onBossRush,
  onEndlessMode,
  onWeeklyChallenge,
  onAscensionTree,
  onClassMastery,
}) => {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [titleVisible, setTitleVisible] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [showModePanel, setShowModePanel] = useState(false);

  // Lifetime stats summary
  const [totalRuns, setTotalRuns] = useState(0);
  const [highestAlt, setHighestAlt] = useState(0);
  const [totalPlayTime, setTotalPlayTime] = useState(0);

  // Unlock states
  const [trainingUnlocked, setTrainingUnlocked] = useState(false);
  const [bossRushUnlocked, setBossRushUnlocked] = useState(false);
  const [endlessUnlocked, setEndlessUnlocked] = useState(false);
  const [weeklyUnlocked, setWeeklyUnlocked] = useState(false);

  useEffect(() => {
    const titleTimer = setTimeout(() => setTitleVisible(true), 100);
    const buttonsTimer = setTimeout(() => setButtonsVisible(true), 500);
    const statsTimer = setTimeout(() => setStatsVisible(true), 900);

    try {
      const stats = PersistentStats.getLifetimeStats();
      setTotalRuns(stats.totalRuns);
      setTotalPlayTime(stats.totalPlayTime);
      let maxAlt = 0;
      for (const alt of Object.values(stats.highestAltitude)) {
        if (alt > maxAlt) maxAlt = alt;
      }
      setHighestAlt(maxAlt);
    } catch {
      // Stats not loaded yet
    }

    setTrainingUnlocked(UnlockManager.isUnlocked("training_room"));
    setBossRushUnlocked(UnlockManager.isUnlocked("boss_rush"));
    setEndlessUnlocked(UnlockManager.isUnlocked("endless_mode"));
    setWeeklyUnlocked(UnlockManager.isUnlocked("weekly_challenge"));

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
        return `${className}${modName ? ` + ${modName}` : ""}`;
      })()
    : "";

  const getButtonStyle = (id: string): React.CSSProperties => {
    const isHovered = hoveredButton === id;
    if (id === "resume") {
      return {
        ...menuButtonStyle,
        background: isHovered
          ? "rgba(100, 200, 100, 0.25)"
          : "rgba(100, 200, 100, 0.1)",
        borderColor: isHovered
          ? "rgba(100, 255, 100, 0.6)"
          : "rgba(100, 200, 100, 0.35)",
        transform: isHovered ? "scale(1.04)" : "scale(1)",
        boxShadow: isHovered
          ? "0 0 30px rgba(100, 255, 100, 0.2), inset 0 0 20px rgba(100, 255, 100, 0.05)"
          : "0 0 15px rgba(100, 200, 100, 0.1)",
        color: isHovered ? "#80ff80" : "#90d090",
      };
    }
    if (id === "start") {
      return {
        ...menuButtonStyle,
        background: isHovered || showModePanel
          ? "rgba(224, 208, 160, 0.2)"
          : "rgba(224, 208, 160, 0.08)",
        borderColor: isHovered || showModePanel
          ? "rgba(224, 208, 160, 0.6)"
          : "rgba(224, 208, 160, 0.3)",
        transform: isHovered ? "scale(1.04)" : "scale(1)",
        boxShadow: isHovered || showModePanel
          ? "0 0 30px rgba(224, 208, 160, 0.2), inset 0 0 20px rgba(224, 208, 160, 0.05)"
          : "none",
        color: isHovered || showModePanel ? "#ffd700" : "#e0d0a0",
      };
    }
    if (id === "tree") {
      return {
        ...menuButtonStyle,
        background: isHovered
          ? "rgba(255, 180, 50, 0.2)"
          : "rgba(255, 180, 50, 0.08)",
        borderColor: isHovered
          ? "rgba(255, 200, 80, 0.5)"
          : "rgba(255, 180, 50, 0.25)",
        transform: isHovered ? "scale(1.04)" : "scale(1)",
        boxShadow: isHovered
          ? "0 0 25px rgba(255, 200, 80, 0.2), inset 0 0 15px rgba(255, 200, 80, 0.05)"
          : "0 0 8px rgba(255, 180, 50, 0.08)",
        color: isHovered ? "#ffe080" : "#d4a840",
      };
    }
    if (id === "mastery") {
      return {
        ...menuButtonStyle,
        background: isHovered
          ? "rgba(100, 220, 180, 0.2)"
          : "rgba(100, 220, 180, 0.08)",
        borderColor: isHovered
          ? "rgba(100, 255, 200, 0.5)"
          : "rgba(100, 220, 180, 0.25)",
        transform: isHovered ? "scale(1.04)" : "scale(1)",
        boxShadow: isHovered
          ? "0 0 25px rgba(100, 255, 200, 0.2), inset 0 0 15px rgba(100, 255, 200, 0.05)"
          : "0 0 8px rgba(100, 220, 180, 0.08)",
        color: isHovered ? "#80ffc0" : "#60c090",
      };
    }
    // Bottom buttons (Settings, Extras)
    return {
      ...menuButtonStyle,
      width: "152px",
      fontSize: "16px",
      padding: "14px 20px",
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

  const getModePanelButtonStyle = (id: string): React.CSSProperties => {
    const isHovered = hoveredButton === id;
    if (id === "mode_newrun") {
      return {
        ...modePanelButtonStyle,
        background: isHovered ? "rgba(224, 208, 160, 0.15)" : "rgba(224, 208, 160, 0.05)",
        borderColor: isHovered ? "rgba(224, 208, 160, 0.4)" : "rgba(224, 208, 160, 0.15)",
        color: isHovered ? "#ffd700" : "#e0d0a0",
        boxShadow: isHovered ? "0 0 15px rgba(224, 208, 160, 0.1)" : "none",
      };
    }
    if (id === "mode_coop" || id === "mode_online") {
      return {
        ...modePanelButtonStyle,
        background: isHovered ? "rgba(100, 180, 255, 0.15)" : "rgba(100, 180, 255, 0.05)",
        borderColor: isHovered ? "rgba(100, 180, 255, 0.4)" : "rgba(100, 180, 255, 0.15)",
        color: isHovered ? "#aaddff" : "#70b0e0",
        boxShadow: isHovered ? "0 0 15px rgba(100, 180, 255, 0.1)" : "none",
      };
    }
    if (id === "mode_challenge") {
      return {
        ...modePanelButtonStyle,
        background: isHovered ? "rgba(240, 160, 48, 0.15)" : "rgba(240, 160, 48, 0.05)",
        borderColor: isHovered ? "rgba(240, 160, 48, 0.4)" : "rgba(240, 160, 48, 0.15)",
        color: isHovered ? "#ffd080" : "#f0a030",
        boxShadow: isHovered ? "0 0 15px rgba(240, 160, 48, 0.1)" : "none",
      };
    }
    // Unlockable mode buttons
    return {
      ...modePanelButtonStyle,
      background: isHovered ? "rgba(180, 120, 255, 0.15)" : "rgba(180, 120, 255, 0.04)",
      borderColor: isHovered ? "rgba(180, 120, 255, 0.4)" : "rgba(180, 120, 255, 0.15)",
      color: isHovered ? "#d4a0ff" : "rgba(180, 150, 220, 0.8)",
      boxShadow: isHovered ? "0 0 15px rgba(180, 120, 255, 0.1)" : "none",
    };
  };

  const renderLockedMode = (hint: string) => (
    <div
      style={{
        ...lockedModeStyle,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
      }}
      title={hint}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "12px", opacity: 0.5 }}>&#x1F512;</span>
        <span>???</span>
      </div>
      <div style={{ fontSize: "10px", fontWeight: "normal", letterSpacing: "1px", opacity: 0.4, textTransform: "none" }}>
        {hint}
      </div>
    </div>
  );

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
        @keyframes sunPulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
          50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
        }
        @keyframes modePanelSlide {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Title with Sun */}
      <div
        style={{
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? "translateY(0)" : "translateY(-20px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
          textAlign: "center",
          marginBottom: "60px",
          position: "relative",
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "360px", marginBottom: "10px" }}>
          {/* Sun outer glow */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "420px",
              height: "420px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255, 225, 100, 0.35) 0%, rgba(255, 215, 0, 0.15) 40%, rgba(255, 180, 0, 0.06) 60%, transparent 75%)",
            }}
          />
          {/* Sun core */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "180px",
              height: "180px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.97) 25%, rgba(255, 250, 240, 0.9) 45%, rgba(255, 235, 130, 0.85) 60%, rgba(255, 215, 0, 0.95) 75%, rgba(255, 200, 0, 0.8) 85%, rgba(255, 180, 0, 0.3) 95%, transparent 100%)",
              boxShadow: "0 0 20px rgba(255, 215, 0, 0.9), 0 0 40px rgba(255, 200, 0, 0.7), 0 0 90px rgba(255, 215, 0, 0.5), 0 0 180px rgba(255, 200, 0, 0.25), 0 0 300px rgba(255, 180, 0, 0.1)",
              border: "3px solid rgba(255, 215, 0, 0.8)",
              animation: "sunPulse 4s ease-in-out infinite",
            }}
          />
        </div>
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

      {/* Main content area: buttons + mode panel */}
      <div
        style={{
          display: "flex",
          gap: "40px",
          alignItems: "flex-start",
          opacity: buttonsVisible ? 1 : 0,
          transform: buttonsVisible ? "translateY(0)" : "translateY(15px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        {/* Left column: main menu buttons */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            alignItems: "center",
          }}
        >
          {/* Resume Run (above Start Run, only if saved) */}
          {hasSavedRun && onResumeRun && (
            <button
              style={getButtonStyle("resume")}
              onMouseEnter={() => setHoveredButton("resume")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={onResumeRun}
            >
              <div>Resume Run</div>
              {savedRunInfo && (
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "normal",
                    letterSpacing: "1px",
                    marginTop: "4px",
                    opacity: 0.7,
                  }}
                >
                  {savedRunInfo.classType} at {Math.floor(savedRunInfo.altitude)}m
                </div>
              )}
            </button>
          )}

          {/* Start Run (toggles mode panel) */}
          <button
            style={getButtonStyle("start")}
            onMouseEnter={() => setHoveredButton("start")}
            onMouseLeave={() => setHoveredButton(null)}
            onClick={() => setShowModePanel(!showModePanel)}
          >
            Start Run
          </button>

          {/* Upgrades */}
          {onAscensionTree && (
            <button
              style={getButtonStyle("tree")}
              onMouseEnter={() => setHoveredButton("tree")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={onAscensionTree}
            >
              Upgrades
            </button>
          )}

          {/* Mastery */}
          {onClassMastery && (
            <button
              style={getButtonStyle("mastery")}
              onMouseEnter={() => setHoveredButton("mastery")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={onClassMastery}
            >
              Mastery
            </button>
          )}

          {/* Bottom row: Settings | Extras */}
          <div style={{ display: "flex", gap: "14px", marginTop: "4px" }}>
            <button
              style={getButtonStyle("settings")}
              onMouseEnter={() => setHoveredButton("settings")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={onSettings}
            >
              Settings
            </button>
            <button
              style={getButtonStyle("extras")}
              onMouseEnter={() => setHoveredButton("extras")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={onExtras}
            >
              Extras
            </button>
          </div>
        </div>

        {/* Right panel: game mode selection (appears when Start Run clicked) */}
        {showModePanel && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              width: "280px",
              padding: "20px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              animation: "modePanelSlide 0.25s ease-out",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "rgba(224, 208, 160, 0.5)",
                textAlign: "center",
                marginBottom: "4px",
              }}
            >
              Select Mode
            </div>

            {/* New Run (solo) */}
            <button
              style={getModePanelButtonStyle("mode_newrun")}
              onMouseEnter={() => setHoveredButton("mode_newrun")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={onStartRun}
            >
              New Run
            </button>

            {/* Multiplayer */}
            {(onCoopStart || onOnlineCoopStart) && (
              <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                {onCoopStart && (
                  <button
                    style={{ ...getModePanelButtonStyle("mode_coop"), flex: 1 }}
                    onMouseEnter={() => setHoveredButton("mode_coop")}
                    onMouseLeave={() => setHoveredButton(null)}
                    onClick={onCoopStart}
                  >
                    <div>Local</div>
                    <div style={{ fontSize: "9px", fontWeight: "normal", letterSpacing: "1px", marginTop: "2px", opacity: 0.5 }}>
                      Split Screen
                    </div>
                  </button>
                )}
                {onOnlineCoopStart && (
                  <button
                    style={{ ...getModePanelButtonStyle("mode_online"), flex: 1 }}
                    onMouseEnter={() => setHoveredButton("mode_online")}
                    onMouseLeave={() => setHoveredButton(null)}
                    onClick={onOnlineCoopStart}
                  >
                    <div>Online</div>
                    <div style={{ fontSize: "9px", fontWeight: "normal", letterSpacing: "1px", marginTop: "2px", opacity: 0.5 }}>
                      P2P Co-Op
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* Challenge */}
            <button
              style={getModePanelButtonStyle("mode_challenge")}
              onMouseEnter={() => setHoveredButton("mode_challenge")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={onDailyChallenge}
            >
              <div>Challenge</div>
              {dailyPreview && (
                <div style={{ fontSize: "10px", fontWeight: "normal", letterSpacing: "1px", marginTop: "3px", opacity: 0.6 }}>
                  {dailyPreview}
                </div>
              )}
            </button>

            {/* Divider */}
            <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.06)", margin: "4px 0" }} />

            {/* Training Room */}
            {trainingUnlocked ? (
              <button
                style={getModePanelButtonStyle("mode_training")}
                onMouseEnter={() => setHoveredButton("mode_training")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={onTrainingRoom}
              >
                Training Room
              </button>
            ) : (
              renderLockedMode("Kill your first enemy")
            )}

            {/* Boss Rush */}
            {bossRushUnlocked ? (
              <button
                style={getModePanelButtonStyle("mode_bossrush")}
                onMouseEnter={() => setHoveredButton("mode_bossrush")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={onBossRush}
              >
                Boss Rush
              </button>
            ) : (
              renderLockedMode("Defeat your first boss")
            )}

            {/* Endless Mode */}
            {endlessUnlocked ? (
              <button
                style={getModePanelButtonStyle("mode_endless")}
                onMouseEnter={() => setHoveredButton("mode_endless")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={onEndlessMode}
              >
                Endless Mode
              </button>
            ) : (
              renderLockedMode("Complete an ascension")
            )}

            {/* Weekly Challenge */}
            {weeklyUnlocked ? (
              <button
                style={getModePanelButtonStyle("mode_weekly")}
                onMouseEnter={() => setHoveredButton("mode_weekly")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={onWeeklyChallenge}
              >
                Weekly Challenge
              </button>
            ) : (
              renderLockedMode("Defeat all 5 boss types")
            )}
          </div>
        )}
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
            <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "4px" }}>
              Total Runs
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "rgba(224, 208, 160, 0.6)" }}>
              {totalRuns}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "4px" }}>
              Highest Altitude
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "rgba(224, 208, 160, 0.6)" }}>
              {highestAlt}m
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.4)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "4px" }}>
              Play Time
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "rgba(224, 208, 160, 0.6)" }}>
              {formatTime(totalPlayTime)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainMenu;

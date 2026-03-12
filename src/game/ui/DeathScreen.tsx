import React, { useState, useEffect, useMemo } from "react";
import { CosmeticManager } from "../systems/CosmeticManager";
import { DailyChallenge, WEEKLY_RULES } from "../systems/DailyChallenge";
import { RUN_MODIFIERS, ActiveModifiers } from "../config/RunModifiers";
import { LeaderboardManager, type NewRecordInfo } from "../systems/LeaderboardManager";

interface DeathScreenProps {
  altitude: number;
  kills: number;
  bossesDefeated: number;
  timeMs: number;
  essenceEarned: number;
  onRetry: () => void;
  onMainMenu: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.85)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "monospace",
  color: "white",
  zIndex: 100,
};

const titleStyle: React.CSSProperties = {
  fontSize: "72px",
  fontWeight: "bold",
  color: "#ff2222",
  textShadow:
    "0 0 30px rgba(255, 34, 34, 0.8), 0 0 60px rgba(255, 34, 34, 0.4), 0 0 90px rgba(255, 34, 34, 0.2)",
  letterSpacing: "12px",
  textTransform: "uppercase",
  marginBottom: "40px",
};

const statsContainerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px 48px",
  marginBottom: "48px",
  padding: "24px 40px",
  background: "rgba(20, 0, 0, 0.5)",
  border: "1px solid rgba(255, 34, 34, 0.2)",
  borderRadius: "12px",
  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(200, 200, 220, 0.6)",
  textTransform: "uppercase",
  letterSpacing: "2px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: "bold",
  color: "#fff",
  textShadow: "0 0 8px rgba(255, 255, 255, 0.2)",
};

const essenceValueStyle: React.CSSProperties = {
  ...statValueStyle,
  color: "#cc44ff",
  textShadow: "0 0 12px rgba(204, 68, 255, 0.4)",
};

const buttonContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "24px",
};

const baseButtonStyle: React.CSSProperties = {
  padding: "14px 36px",
  fontSize: "18px",
  fontFamily: "monospace",
  fontWeight: "bold",
  letterSpacing: "2px",
  textTransform: "uppercase",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "8px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  outline: "none",
};

const retryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  background: "rgba(255, 34, 34, 0.3)",
  color: "#ff4444",
  borderColor: "rgba(255, 34, 34, 0.4)",
};

const menuButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  background: "rgba(255, 255, 255, 0.08)",
  color: "rgba(200, 200, 220, 0.8)",
  borderColor: "rgba(255, 255, 255, 0.12)",
};

interface StatRowProps {
  label: string;
  value: string;
  delay: number;
  isEssence?: boolean;
  themeColor?: string;
}

const StatRow: React.FC<StatRowProps> = ({ label, value, delay, isEssence, themeColor }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      <div style={themeColor ? { ...statLabelStyle, color: themeColor, opacity: 0.7 } : statLabelStyle}>{label}</div>
      <div style={isEssence ? essenceValueStyle : statValueStyle}>{value}</div>
    </div>
  );
};

export const DeathScreen: React.FC<DeathScreenProps> = ({
  altitude,
  kills,
  bossesDefeated,
  timeMs,
  essenceEarned,
  onRetry,
  onMainMenu,
}) => {
  // Cosmetic UI theme accent color
  const themeColor = useMemo(() => {
    const themeId = CosmeticManager.getEquipped('UI_THEME');
    if (!themeId || themeId === 'default_ui') return '#e0d0a0';
    const themeDef = CosmeticManager.getDefinition(themeId);
    if (!themeDef) return '#e0d0a0';
    const hex = themeDef.previewColor.toString(16).padStart(6, '0');
    return `#${hex}`;
  }, []);

  const [titleVisible, setTitleVisible] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const [retryHover, setRetryHover] = useState(false);
  const [menuHover, setMenuHover] = useState(false);

  // Capture daily challenge state at mount time (before cleanup)
  const [isDailyChallenge] = useState(() => !!(window as any).__isDailyChallenge);
  const [isNewBest] = useState(() => !!(window as any).__dailyChallengeNewBest);
  const [challengeInfo] = useState(() => {
    if (!(window as any).__isDailyChallenge) return null;
    const challenge = DailyChallenge.getCurrentChallenge();
    if (!challenge) return null;
    const modNames = challenge.modifiers.map((id) => {
      const mod = RUN_MODIFIERS.find((m) => m.id === id);
      return mod ? mod.name : id;
    });
    return { seed: challenge.seed, modifiers: modNames };
  });

  // Capture weekly challenge state at mount time (before cleanup)
  const [isWeeklyChallenge] = useState(() => !!(window as any).__isWeeklyChallenge);
  const [isWeeklyNewBest] = useState(() => !!(window as any).__weeklyChallengeNewBest);
  const [weeklyInfo] = useState(() => {
    if (!(window as any).__isWeeklyChallenge) return null;
    const weekly = DailyChallenge.getWeeklyChallenge();
    if (!weekly) return null;
    const modNames = weekly.modifiers.map((id) => {
      const mod = RUN_MODIFIERS.find((m) => m.id === id);
      return mod ? mod.name : id;
    });
    const rule = WEEKLY_RULES.find((r) => r.id === weekly.specialRule);
    const ruleName = rule ? rule.name : weekly.specialRule;
    return { seed: weekly.seed, modifiers: modNames, specialRuleName: ruleName };
  });

  // Submit run to leaderboard and track new records
  const [newRecords] = useState<NewRecordInfo[]>(() => {
    try {
      const classType = (window as any).__selectedClass || "UNKNOWN";
      const modifiers = ActiveModifiers.active ? [...ActiveModifiers.active] : [];
      // Use maxComboRef value stored on window by App.tsx combo tracking
      const highestCombo = (window as any).__maxComboThisRun || 0;
      return LeaderboardManager.submitRun({
        altitude,
        timeMs,
        bossesDefeated,
        kills,
        highestCombo,
        classType,
        modifiers,
      });
    } catch {
      return [];
    }
  });

  const altitudeRank = useMemo(() => {
    return LeaderboardManager.getRankForScore("highest_altitude", Math.floor(altitude));
  }, [altitude]);

  useEffect(() => {
    const titleTimer = setTimeout(() => setTitleVisible(true), 200);
    const buttonsTimer = setTimeout(() => setButtonsVisible(true), 1400);

    // Clean up daily/weekly challenge flags
    return () => {
      delete (window as any).__dailyChallengeNewBest;
      delete (window as any).__weeklyChallengeNewBest;
      clearTimeout(titleTimer);
      clearTimeout(buttonsTimer);
    };
  }, []);

  return (
    <div style={overlayStyle}>
      {/* Daily Challenge Header */}
      {isDailyChallenge && (
        <div
          style={{
            opacity: titleVisible ? 1 : 0,
            transition: "opacity 0.5s ease",
            textAlign: "center",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#f0a030",
              letterSpacing: "6px",
              textTransform: "uppercase",
              textShadow: "0 0 20px rgba(240, 160, 48, 0.5)",
            }}
          >
            Daily Challenge
          </div>
          {isNewBest && (
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#ffd700",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginTop: "6px",
                textShadow: "0 0 16px rgba(255, 215, 0, 0.6)",
              }}
            >
              New Personal Best!
            </div>
          )}
          {challengeInfo && (
            <div
              style={{
                fontSize: "11px",
                color: "rgba(240, 160, 48, 0.5)",
                marginTop: "6px",
                letterSpacing: "1px",
              }}
            >
              Seed #{challengeInfo.seed} | {challengeInfo.modifiers.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Weekly Challenge Header */}
      {isWeeklyChallenge && (
        <div
          style={{
            opacity: titleVisible ? 1 : 0,
            transition: "opacity 0.5s ease",
            textAlign: "center",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#e87020",
              letterSpacing: "6px",
              textTransform: "uppercase",
              textShadow: "0 0 20px rgba(232, 112, 32, 0.5)",
            }}
          >
            Weekly Challenge
          </div>
          {weeklyInfo && (
            <div
              style={{
                fontSize: "15px",
                fontWeight: "bold",
                color: "#e87020",
                letterSpacing: "2px",
                marginTop: "6px",
                textShadow: "0 0 12px rgba(232, 112, 32, 0.4)",
              }}
            >
              {weeklyInfo.specialRuleName}
            </div>
          )}
          {isWeeklyNewBest && (
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#ffd700",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginTop: "6px",
                textShadow: "0 0 16px rgba(255, 215, 0, 0.6)",
              }}
            >
              New Personal Best!
            </div>
          )}
          {weeklyInfo && (
            <div
              style={{
                fontSize: "11px",
                color: "rgba(232, 112, 32, 0.5)",
                marginTop: "6px",
                letterSpacing: "1px",
              }}
            >
              Seed #{weeklyInfo.seed} | {weeklyInfo.modifiers.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <div
        style={{
          ...titleStyle,
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? "scale(1)" : "scale(1.3)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        You Died
      </div>

      {/* Stats Grid */}
      <div style={{
        ...statsContainerStyle,
        borderColor: `${themeColor}33`,
      }}>
        <StatRow label="Altitude Reached" value={`${altitude}m`} delay={400} themeColor={themeColor} />
        <StatRow label="Time Survived" value={formatTime(timeMs)} delay={550} themeColor={themeColor} />
        <StatRow label="Enemies Killed" value={String(kills)} delay={700} themeColor={themeColor} />
        <StatRow label="Bosses Defeated" value={String(bossesDefeated)} delay={850} themeColor={themeColor} />
        <div
          style={{
            gridColumn: "1 / -1",
            textAlign: "center",
            marginTop: "8px",
          }}
        >
          <StatRow
            label="Essence Earned"
            value={`${essenceEarned}`}
            delay={1000}
            isEssence
            themeColor={themeColor}
          />
        </div>
      </div>

      {/* Leaderboard Records */}
      {(newRecords.length > 0 || altitudeRank > 0) && (
        <div
          style={{
            marginBottom: "20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            opacity: buttonsVisible ? 1 : 0,
            transform: buttonsVisible ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          {newRecords.map((record, i) => (
            <div
              key={record.category}
              style={{
                fontSize: "15px",
                fontWeight: "bold",
                color: "#ffd700",
                letterSpacing: "2px",
                textTransform: "uppercase",
                textShadow: "0 0 12px rgba(255, 215, 0, 0.5)",
                opacity: 0,
                animation: `fadeInRecord 0.5s ease ${1.2 + i * 0.15}s forwards`,
              }}
            >
              NEW RECORD: {record.label}!{record.position === 1 ? " #1" : ` #${record.position}`}
            </div>
          ))}
          {altitudeRank > 0 && altitudeRank <= 10 && !newRecords.some(r => r.category === "highest_altitude") && (
            <div
              style={{
                fontSize: "12px",
                color: "rgba(224, 208, 160, 0.5)",
                letterSpacing: "1px",
              }}
            >
              Altitude Rank: #{altitudeRank}
            </div>
          )}
          {altitudeRank > 0 && altitudeRank <= 10 && newRecords.some(r => r.category === "highest_altitude") && (
            <div
              style={{
                fontSize: "12px",
                color: "rgba(224, 208, 160, 0.5)",
                letterSpacing: "1px",
              }}
            >
              Altitude Leaderboard: #{altitudeRank}
            </div>
          )}
          <style>{`
            @keyframes fadeInRecord {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Buttons */}
      <div
        style={{
          ...buttonContainerStyle,
          opacity: buttonsVisible ? 1 : 0,
          transform: buttonsVisible ? "translateY(0)" : "translateY(15px)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        }}
      >
        <button
          style={{
            ...retryButtonStyle,
            background: retryHover
              ? "rgba(255, 34, 34, 0.5)"
              : "rgba(255, 34, 34, 0.3)",
            transform: retryHover ? "scale(1.05)" : "scale(1)",
            boxShadow: retryHover
              ? "0 0 20px rgba(255, 34, 34, 0.3)"
              : "none",
          }}
          onMouseEnter={() => setRetryHover(true)}
          onMouseLeave={() => setRetryHover(false)}
          onClick={onRetry}
        >
          Retry
        </button>
        <button
          style={{
            ...menuButtonStyle,
            background: menuHover
              ? "rgba(255, 255, 255, 0.15)"
              : "rgba(255, 255, 255, 0.08)",
            transform: menuHover ? "scale(1.05)" : "scale(1)",
          }}
          onMouseEnter={() => setMenuHover(true)}
          onMouseLeave={() => setMenuHover(false)}
          onClick={onMainMenu}
        >
          Main Menu
        </button>
      </div>
    </div>
  );
};

export default DeathScreen;

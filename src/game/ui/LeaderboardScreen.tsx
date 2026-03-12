import React, { useState, useEffect, useMemo } from "react";
import {
  LeaderboardManager,
  LEADERBOARD_CATEGORIES,
  type LeaderboardCategory,
  type LeaderboardEntry,
} from "../systems/LeaderboardManager";

interface LeaderboardScreenProps {
  onBack: () => void;
}

const CLASS_FILTERS = ["ALL", "PALADIN", "MONK", "PRIEST"] as const;
type ClassFilter = (typeof CLASS_FILTERS)[number];

const CLASS_DISPLAY_NAMES: Record<string, string> = {
  ALL: "All Classes",
  PALADIN: "Paladin",
  MONK: "Monk",
  PRIEST: "Priest",
};

const TAB_LABELS: Record<LeaderboardCategory, string> = {
  highest_altitude: "Altitude",
  fastest_5000m: "Speed",
  most_bosses: "Bosses",
  longest_survival: "Time",
  most_kills: "Kills",
  highest_combo: "Combo",
};

function formatScore(category: LeaderboardCategory, score: number): string {
  if (category === "highest_altitude") {
    return `${score}m`;
  }
  if (category === "fastest_5000m" || category === "longest_survival") {
    return formatTime(score);
  }
  return String(score);
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

const ACCENT = "#e0d0a0";
const GOLD = "#ffd700";
const BG_OVERLAY = "rgba(0, 0, 0, 0.85)";
const BG_DARK = "#0a0a12";

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<LeaderboardCategory>("highest_altitude");
  const [classFilter, setClassFilter] = useState<ClassFilter>("ALL");
  const [visible, setVisible] = useState(false);
  const [backHover, setBackHover] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [hoveredFilter, setHoveredFilter] = useState<string | null>(null);
  const [clearHover, setClearHover] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const entries = useMemo(() => {
    return LeaderboardManager.getLeaderboard(
      activeTab,
      classFilter === "ALL" ? undefined : classFilter
    );
  }, [activeTab, classFilter]);

  const personalBests = useMemo(() => {
    return LeaderboardManager.getPersonalBests();
  }, []);

  const totalRuns = useMemo(() => {
    return LeaderboardManager.getTotalRuns();
  }, []);

  const personalBest = personalBests[activeTab];

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    LeaderboardManager.clearAll();
    setConfirmClear(false);
    // Force re-render by toggling filter
    setClassFilter("ALL");
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: BG_DARK,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "monospace",
        color: "white",
        zIndex: 100,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: "32px 40px 0",
          boxSizing: "border-box",
        }}
      >
        <button
          style={{
            position: "absolute",
            left: "40px",
            top: "32px",
            padding: "10px 24px",
            fontSize: "14px",
            fontFamily: "monospace",
            fontWeight: "bold",
            letterSpacing: "2px",
            textTransform: "uppercase",
            border: `1px solid ${backHover ? "rgba(224, 208, 160, 0.4)" : "rgba(255, 255, 255, 0.12)"}`,
            borderRadius: "6px",
            cursor: "pointer",
            background: backHover ? "rgba(224, 208, 160, 0.1)" : "rgba(255, 255, 255, 0.05)",
            color: backHover ? ACCENT : "rgba(200, 200, 220, 0.7)",
            transition: "all 0.2s ease",
            outline: "none",
          }}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          onClick={onBack}
        >
          Back
        </button>
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: "42px",
              fontWeight: "bold",
              color: GOLD,
              letterSpacing: "8px",
              textTransform: "uppercase",
              margin: 0,
              textShadow: "0 0 20px rgba(255, 215, 0, 0.3)",
            }}
          >
            Leaderboards
          </h1>
          <div
            style={{
              fontSize: "12px",
              color: "rgba(200, 200, 220, 0.4)",
              letterSpacing: "2px",
              marginTop: "8px",
            }}
          >
            {totalRuns} Total Runs Recorded
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginTop: "28px",
          padding: "4px",
          background: "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        {LEADERBOARD_CATEGORIES.map((cat) => {
          const isActive = activeTab === cat;
          const isHovered = hoveredTab === cat;
          return (
            <button
              key={cat}
              style={{
                padding: "10px 20px",
                fontSize: "13px",
                fontFamily: "monospace",
                fontWeight: "bold",
                letterSpacing: "1px",
                textTransform: "uppercase",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                outline: "none",
                background: isActive
                  ? `rgba(255, 215, 0, 0.15)`
                  : isHovered
                    ? "rgba(255, 255, 255, 0.06)"
                    : "transparent",
                color: isActive ? GOLD : isHovered ? "#fff" : "rgba(200, 200, 220, 0.5)",
                borderBottom: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
              }}
              onMouseEnter={() => setHoveredTab(cat)}
              onMouseLeave={() => setHoveredTab(null)}
              onClick={() => setActiveTab(cat)}
            >
              {TAB_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* Class filter */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "16px",
        }}
      >
        {CLASS_FILTERS.map((cls) => {
          const isActive = classFilter === cls;
          const isHovered = hoveredFilter === cls;
          return (
            <button
              key={cls}
              style={{
                padding: "6px 16px",
                fontSize: "12px",
                fontFamily: "monospace",
                fontWeight: isActive ? "bold" : "normal",
                letterSpacing: "1px",
                border: `1px solid ${isActive ? "rgba(224, 208, 160, 0.3)" : "rgba(255, 255, 255, 0.08)"}`,
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                outline: "none",
                background: isActive
                  ? "rgba(224, 208, 160, 0.1)"
                  : isHovered
                    ? "rgba(255, 255, 255, 0.05)"
                    : "transparent",
                color: isActive ? ACCENT : isHovered ? "#ccc" : "rgba(200, 200, 220, 0.5)",
              }}
              onMouseEnter={() => setHoveredFilter(cls)}
              onMouseLeave={() => setHoveredFilter(null)}
              onClick={() => setClassFilter(cls)}
            >
              {CLASS_DISPLAY_NAMES[cls]}
            </button>
          );
        })}
      </div>

      {/* Personal best banner */}
      {personalBest && classFilter === "ALL" && (
        <div
          style={{
            marginTop: "20px",
            padding: "10px 32px",
            background: "rgba(255, 215, 0, 0.06)",
            border: "1px solid rgba(255, 215, 0, 0.15)",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "rgba(255, 215, 0, 0.6)",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            Personal Best
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: GOLD,
              textShadow: "0 0 8px rgba(255, 215, 0, 0.3)",
            }}
          >
            {formatScore(activeTab, personalBest.score)}
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "rgba(200, 200, 220, 0.4)",
            }}
          >
            ({personalBest.classType})
          </span>
        </div>
      )}

      {/* Leaderboard table */}
      <div
        style={{
          marginTop: "20px",
          width: "700px",
          maxHeight: "420px",
          overflowY: "auto",
          background: "rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "8px",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "50px 1fr 120px 120px 100px",
            padding: "12px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            position: "sticky",
            top: 0,
            background: "rgba(10, 10, 18, 0.95)",
            zIndex: 1,
          }}
        >
          <div style={headerCellStyle}>#</div>
          <div style={headerCellStyle}>Score</div>
          <div style={headerCellStyle}>Class</div>
          <div style={headerCellStyle}>Date</div>
          <div style={headerCellStyle}>Modifiers</div>
        </div>

        {/* Table rows */}
        {entries.length === 0 ? (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              color: "rgba(200, 200, 220, 0.3)",
              fontSize: "14px",
              letterSpacing: "1px",
            }}
          >
            No records yet. Complete a run to start tracking!
          </div>
        ) : (
          entries.map((entry, index) => {
            const isPersonalBest =
              personalBest &&
              classFilter === "ALL" &&
              entry.score === personalBest.score &&
              entry.classType === personalBest.classType &&
              entry.date === personalBest.date;
            const rank = index + 1;

            return (
              <div
                key={`${index}-${entry.date}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "50px 1fr 120px 120px 100px",
                  padding: "10px 20px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                  background: isPersonalBest
                    ? "rgba(255, 215, 0, 0.06)"
                    : index % 2 === 0
                      ? "transparent"
                      : "rgba(255, 255, 255, 0.01)",
                  transition: "background 0.15s ease",
                }}
              >
                {/* Rank */}
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    color:
                      rank === 1
                        ? GOLD
                        : rank === 2
                          ? "#c0c0c0"
                          : rank === 3
                            ? "#cd7f32"
                            : "rgba(200, 200, 220, 0.4)",
                    alignSelf: "center",
                  }}
                >
                  {rank}
                </div>

                {/* Score */}
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: isPersonalBest ? GOLD : "#fff",
                    alignSelf: "center",
                    textShadow: isPersonalBest
                      ? "0 0 8px rgba(255, 215, 0, 0.3)"
                      : "none",
                  }}
                >
                  {formatScore(activeTab, entry.score)}
                  {isPersonalBest && (
                    <span
                      style={{
                        fontSize: "10px",
                        marginLeft: "8px",
                        color: "rgba(255, 215, 0, 0.6)",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        fontWeight: "normal",
                      }}
                    >
                      BEST
                    </span>
                  )}
                </div>

                {/* Class */}
                <div
                  style={{
                    fontSize: "13px",
                    color: getClassColor(entry.classType),
                    alignSelf: "center",
                    textTransform: "capitalize",
                  }}
                >
                  {entry.classType.charAt(0) + entry.classType.slice(1).toLowerCase()}
                </div>

                {/* Date */}
                <div
                  style={{
                    fontSize: "12px",
                    color: "rgba(200, 200, 220, 0.4)",
                    alignSelf: "center",
                  }}
                >
                  {formatDate(entry.date)}
                </div>

                {/* Modifiers */}
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(200, 200, 220, 0.3)",
                    alignSelf: "center",
                  }}
                >
                  {entry.modifiers && entry.modifiers.length > 0
                    ? `${entry.modifiers.length} mod${entry.modifiers.length > 1 ? "s" : ""}`
                    : "-"}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Clear data button */}
      <div style={{ marginTop: "24px" }}>
        <button
          style={{
            padding: "8px 20px",
            fontSize: "11px",
            fontFamily: "monospace",
            letterSpacing: "1px",
            textTransform: "uppercase",
            border: `1px solid ${confirmClear ? "rgba(255, 50, 50, 0.4)" : "rgba(255, 255, 255, 0.08)"}`,
            borderRadius: "4px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            outline: "none",
            background: confirmClear
              ? "rgba(255, 50, 50, 0.15)"
              : clearHover
                ? "rgba(255, 50, 50, 0.08)"
                : "transparent",
            color: confirmClear
              ? "#ff4444"
              : clearHover
                ? "#ff6666"
                : "rgba(200, 200, 220, 0.3)",
          }}
          onMouseEnter={() => setClearHover(true)}
          onMouseLeave={() => {
            setClearHover(false);
            setConfirmClear(false);
          }}
          onClick={handleClear}
        >
          {confirmClear ? "Click again to confirm" : "Clear All Data"}
        </button>
      </div>
    </div>
  );
};

const headerCellStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "rgba(200, 200, 220, 0.4)",
  textTransform: "uppercase",
  letterSpacing: "2px",
  fontWeight: "bold",
};

function getClassColor(classType: string): string {
  switch (classType) {
    case "PALADIN":
      return "#6688ff";
    case "MONK":
      return "#66cc66";
    case "PRIEST":
      return "#ffcc44";
    default:
      return "rgba(200, 200, 220, 0.6)";
  }
}

export default LeaderboardScreen;

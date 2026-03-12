import React, { useState, useEffect } from "react";
import { RunHistory } from "../systems/RunHistory";
import type { RunRecord } from "../systems/RunHistory";
import { ITEMS } from "../config/ItemDatabase";

interface RunHistoryUIProps {
  onBack: () => void;
}

// ── Shared Styles ────────────────────────────────────────────────────

const CLASS_COLORS: Record<string, string> = {
  PALADIN: "#ffd700",
  MONK: "#44ff44",
  PRIEST: "#aa66ff",
};

const CLASS_ICONS: Record<string, string> = {
  PALADIN: "\u2694",
  MONK: "\u262F",
  PRIEST: "\u2721",
};

function getClassColor(cls: string): string {
  return CLASS_COLORS[cls.toUpperCase()] || "#aaa";
}

function getClassIcon(cls: string): string {
  return CLASS_ICONS[cls.toUpperCase()] || "?";
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
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "---";
  }
}

function formatCauseOfDeath(cause: string): string {
  if (cause === "victory") return "Ascended";
  if (cause.startsWith("boss_")) {
    const bossName = cause.replace("boss_", "").replace(/_/g, " ");
    return `Boss: ${bossName.charAt(0).toUpperCase() + bossName.slice(1)}`;
  }
  const labels: Record<string, string> = {
    enemy_damage: "Enemy Damage",
    fall: "Fell to Death",
    hazard: "Environmental Hazard",
    unknown: "Unknown",
  };
  return labels[cause] || cause.replace(/_/g, " ");
}

function formatGameMode(mode: string): string {
  const labels: Record<string, string> = {
    standard: "Standard",
    daily: "Daily Challenge",
    endless: "Endless",
    boss_rush: "Boss Rush",
    weekly: "Weekly Challenge",
  };
  return labels[mode] || mode;
}

const GAME_MODE_COLORS: Record<string, string> = {
  standard: "rgba(200, 200, 220, 0.5)",
  daily: "#f0a030",
  endless: "#cc44ff",
  boss_rush: "#ff4444",
  weekly: "#e87020",
};

// ── Run Detail Card ──────────────────────────────────────────────────

function RunDetailCard({ run, onCollapse }: { run: RunRecord; onCollapse: () => void }) {
  const tierColor = RunHistory.getAltitudeTierColor(run.altitude);
  const tierLabel = RunHistory.getAltitudeTierLabel(run.altitude);
  const classColor = getClassColor(run.classType);

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        borderRadius: "10px",
        border: `1px solid ${tierColor}30`,
        borderLeft: `4px solid ${tierColor}`,
        overflow: "hidden",
        animation: "fadeIn 0.2s ease",
      }}
    >
      {/* Header row */}
      <div
        onClick={onCollapse}
        style={{
          display: "grid",
          gridTemplateColumns: "120px 120px 1fr 100px 80px 40px",
          gap: "8px",
          padding: "14px 16px",
          alignItems: "center",
          cursor: "pointer",
          background: `linear-gradient(90deg, ${tierColor}08 0%, transparent 50%)`,
        }}
      >
        <span style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.5)" }}>
          {formatDate(run.date)}
        </span>
        <span style={{ color: classColor, fontWeight: "bold", fontSize: "13px" }}>
          {getClassIcon(run.classType)} {run.classType}
          {run.subclass && (
            <span style={{ fontSize: "10px", opacity: 0.6, marginLeft: "4px" }}>
              ({run.subclass})
            </span>
          )}
        </span>
        <span style={{ color: tierColor, fontWeight: "bold", fontSize: "15px" }}>
          {run.altitude}m
          <span style={{
            fontSize: "10px",
            marginLeft: "8px",
            opacity: 0.6,
            fontWeight: "normal",
            color: tierColor,
          }}>
            {tierLabel}
          </span>
        </span>
        <span style={{ fontSize: "13px", color: "rgba(200, 200, 220, 0.7)" }}>
          {formatTime(run.timeMs)}
        </span>
        <span style={{ fontSize: "13px", color: "rgba(200, 200, 220, 0.7)" }}>
          {run.kills} kills
        </span>
        <span style={{
          fontSize: "16px",
          color: "rgba(200, 200, 220, 0.4)",
          textAlign: "center",
          transform: "rotate(180deg)",
        }}>
          ^
        </span>
      </div>

      {/* Expanded details */}
      <div
        style={{
          padding: "0 20px 18px",
          borderTop: `1px solid ${tierColor}15`,
        }}
      >
        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "12px",
            marginTop: "14px",
          }}
        >
          <DetailStat label="Bosses Defeated" value={String(run.bossesDefeated)} color="#ff4444" />
          <DetailStat label="Max Combo" value={String(run.maxCombo)} color="#ffaa00" />
          <DetailStat label="Essence Earned" value={String(run.essenceEarned)} color="#cc44ff" />
          <DetailStat
            label="Game Mode"
            value={formatGameMode(run.gameMode)}
            color={GAME_MODE_COLORS[run.gameMode] || "#aaa"}
          />
        </div>

        {/* Cause of death */}
        <div style={{ marginTop: "14px" }}>
          <span style={{
            fontSize: "11px",
            color: "rgba(200, 200, 220, 0.4)",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}>
            Cause of Death
          </span>
          <div style={{
            fontSize: "14px",
            fontWeight: "bold",
            color: run.causeOfDeath === "victory" ? "#ffd700" : "#ff6644",
            marginTop: "4px",
          }}>
            {formatCauseOfDeath(run.causeOfDeath)}
          </div>
        </div>

        {/* Items collected */}
        {run.itemsCollected.length > 0 && (
          <div style={{ marginTop: "14px" }}>
            <span style={{
              fontSize: "11px",
              color: "rgba(200, 200, 220, 0.4)",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}>
              Items Collected ({run.itemsCollected.length})
            </span>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginTop: "8px",
            }}>
              {run.itemsCollected.map((itemId, i) => {
                const item = ITEMS[itemId];
                if (!item) return null;
                const hexColor = "#" + item.iconColor.toString(16).padStart(6, "0");
                const typeColors: Record<string, string> = {
                  SILVER: "rgba(192, 192, 192, 0.15)",
                  GOLD: "rgba(255, 215, 0, 0.15)",
                  CURSED: "rgba(153, 51, 204, 0.15)",
                };
                const borderColors: Record<string, string> = {
                  SILVER: "rgba(192, 192, 192, 0.3)",
                  GOLD: "rgba(255, 215, 0, 0.3)",
                  CURSED: "rgba(153, 51, 204, 0.3)",
                };
                return (
                  <div
                    key={`${itemId}-${i}`}
                    title={`${item.name}: ${item.description}`}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      background: typeColors[item.type] || "rgba(255,255,255,0.05)",
                      border: `1px solid ${borderColors[item.type] || "rgba(255,255,255,0.1)"}`,
                      borderRadius: "4px",
                      color: hexColor,
                    }}
                  >
                    {item.name}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{
        fontSize: "11px",
        color: "rgba(200, 200, 220, 0.4)",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: "16px",
        fontWeight: "bold",
        color,
        marginTop: "2px",
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Collapsed Run Row ────────────────────────────────────────────────

function RunRow({
  run,
  index,
  isBest,
  isExpanded,
  onToggle,
}: {
  run: RunRecord;
  index: number;
  isBest: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const tierColor = RunHistory.getAltitudeTierColor(run.altitude);
  const classColor = getClassColor(run.classType);
  const [hover, setHover] = useState(false);

  if (isExpanded) {
    return <RunDetailCard run={run} onCollapse={onToggle} />;
  }

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "120px 120px 1fr 100px 80px 40px",
        gap: "8px",
        padding: "12px 16px",
        background: hover
          ? "rgba(255, 255, 255, 0.04)"
          : isBest
            ? "rgba(255, 215, 0, 0.04)"
            : index % 2 === 0
              ? "rgba(255, 255, 255, 0.015)"
              : "transparent",
        borderLeft: `4px solid ${isBest ? "#ffd700" : tierColor}`,
        borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
        alignItems: "center",
        fontSize: "13px",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
    >
      <span style={{ color: "rgba(200, 200, 220, 0.5)", fontSize: "12px" }}>
        {formatDate(run.date)}
      </span>
      <span style={{ color: classColor, fontWeight: "bold" }}>
        {getClassIcon(run.classType)} {run.classType}
      </span>
      <span style={{
        color: isBest ? "#ffd700" : tierColor,
        fontWeight: isBest ? "bold" : "normal",
      }}>
        {run.altitude}m {isBest ? " (BEST)" : ""}
      </span>
      <span style={{ color: "rgba(200, 200, 220, 0.7)" }}>
        {formatTime(run.timeMs)}
      </span>
      <span style={{ color: "rgba(200, 200, 220, 0.7)" }}>
        {run.kills}
      </span>
      <span style={{
        fontSize: "14px",
        color: "rgba(200, 200, 220, 0.3)",
        textAlign: "center",
      }}>
        v
      </span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export const RunHistoryUI: React.FC<RunHistoryUIProps> = ({ onBack }) => {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [backHover, setBackHover] = useState(false);
  const [clearHover, setClearHover] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    RunHistory.load();
    setRuns(RunHistory.getRuns());
  }, []);

  // Find best run by altitude
  let bestIdx = -1;
  let bestAlt = -1;
  runs.forEach((run, i) => {
    if (run.altitude > bestAlt) {
      bestAlt = run.altitude;
      bestIdx = i;
    }
  });

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    RunHistory.clear();
    setRuns([]);
    setConfirmClear(false);
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
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          padding: "36px 40px 0",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: "44px",
            fontWeight: "bold",
            letterSpacing: "4px",
            textTransform: "uppercase",
            color: "#e0d0a0",
            textShadow: "0 0 20px rgba(224, 208, 160, 0.3)",
            marginBottom: "6px",
            textAlign: "center",
          }}
        >
          Run History
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "#555",
            textAlign: "center",
            marginBottom: "8px",
          }}
        >
          Your last {runs.length} {runs.length === 1 ? "run" : "runs"}
        </p>

        {/* Tier legend */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "20px",
            marginBottom: "24px",
            fontSize: "11px",
          }}
        >
          {[
            { label: "Early (<500m)", color: "#ff4444" },
            { label: "Mid (500-3000m)", color: "#ffaa00" },
            { label: "Good (3000-5000m)", color: "#44ff44" },
            { label: "Ascension (5000m+)", color: "#ffd700" },
          ].map((tier) => (
            <div
              key={tier.label}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  backgroundColor: tier.color,
                  boxShadow: `0 0 6px ${tier.color}60`,
                }}
              />
              <span style={{ color: "rgba(200, 200, 220, 0.5)", letterSpacing: "0.5px" }}>
                {tier.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Run List */}
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          padding: "0 40px",
          boxSizing: "border-box",
          flex: 1,
        }}
      >
        {runs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "rgba(200, 200, 220, 0.4)",
              fontSize: "14px",
              padding: "60px 0",
            }}
          >
            No run history yet. Complete a run to see it here!
          </div>
        ) : (
          <div
            style={{
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              overflow: "hidden",
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 120px 1fr 100px 80px 40px",
                gap: "8px",
                padding: "10px 16px",
                background: "rgba(255, 255, 255, 0.04)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: "11px",
                color: "rgba(200, 200, 220, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                position: "sticky",
                top: 0,
              }}
            >
              <span>Date</span>
              <span>Class</span>
              <span>Altitude</span>
              <span>Time</span>
              <span>Kills</span>
              <span></span>
            </div>

            {/* Run rows */}
            {runs.map((run, i) => (
              <RunRow
                key={run.id}
                run={run}
                index={i}
                isBest={i === bestIdx}
                isExpanded={expandedId === run.id}
                onToggle={() =>
                  setExpandedId(expandedId === run.id ? null : run.id)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          padding: "24px 0 36px",
        }}
      >
        {runs.length > 0 && (
          <button
            onClick={handleClear}
            onMouseEnter={() => setClearHover(true)}
            onMouseLeave={() => {
              setClearHover(false);
              setConfirmClear(false);
            }}
            style={{
              padding: "12px 32px",
              fontSize: "14px",
              fontFamily: "monospace",
              fontWeight: "bold",
              letterSpacing: "1px",
              textTransform: "uppercase",
              background: clearHover
                ? "rgba(255, 68, 68, 0.2)"
                : "rgba(255, 68, 68, 0.08)",
              color: clearHover ? "#ff6644" : "rgba(255, 100, 100, 0.6)",
              border: `1px solid ${clearHover ? "rgba(255, 68, 68, 0.4)" : "rgba(255, 68, 68, 0.15)"}`,
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              outline: "none",
            }}
          >
            {confirmClear ? "Confirm Clear" : "Clear History"}
          </button>
        )}
        <button
          onClick={onBack}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            padding: "12px 48px",
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

export default RunHistoryUI;

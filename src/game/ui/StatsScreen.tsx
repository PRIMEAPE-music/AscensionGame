import React, { useState, useEffect } from "react";
import { PersistentStats } from "../systems/PersistentStats";
import type { LifetimeStats, PerClassStats, RunHistoryEntry } from "../systems/PersistentStats";
import { AchievementManager } from "../systems/AchievementManager";
import type { Achievement, AchievementCategory, AchievementCheckStats } from "../systems/AchievementManager";

interface StatsScreenProps {
  onBack: () => void;
}

type TabId = "overview" | "classes" | "history" | "combat" | "achievements";

const CATEGORY_LABELS: Record<AchievementCategory, { name: string; color: string }> = {
  combat: { name: "Combat", color: "#ff4444" },
  exploration: { name: "Exploration", color: "#44aaff" },
  collection: { name: "Collection", color: "#ffaa44" },
  meta: { name: "Meta", color: "#aa44ff" },
};

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

function formatPlayTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "---";
  }
}

// ─── Shared Styles ──────────────────────────────────────────────────

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

const statLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "rgba(200, 200, 220, 0.5)",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "bold",
  color: "#fff",
  textShadow: "0 0 6px rgba(255, 255, 255, 0.15)",
};

const cardStyle: React.CSSProperties = {
  padding: "16px",
  background: "rgba(255, 255, 255, 0.03)",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.06)",
};

// ─── Stat Card Component ────────────────────────────────────────────

function StatCard({ label, value, valueColor, valueGlow }: {
  label: string;
  value: string | number;
  valueColor?: string;
  valueGlow?: string;
}) {
  return (
    <div style={cardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={{
        ...statValueStyle,
        color: valueColor || "#fff",
        textShadow: valueGlow ? `0 0 8px ${valueGlow}` : statValueStyle.textShadow,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Tab Components ─────────────────────────────────────────────────

function OverviewTab({ stats }: { stats: LifetimeStats }) {
  const overallHighest = Math.max(0, ...Object.values(stats.highestAltitude), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", animation: "fadeIn 0.3s ease" }}>
      {/* Primary Stats */}
      <div>
        <div style={sectionTitleStyle}>Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <StatCard label="Total Runs" value={stats.totalRuns} />
          <StatCard
            label="Total Play Time"
            value={formatPlayTime(stats.totalPlayTimeMs || stats.totalPlayTime)}
          />
          <StatCard
            label="Favorite Class"
            value={stats.favoriteClass || "---"}
            valueColor={getClassColor(stats.favoriteClass)}
            valueGlow={`${getClassColor(stats.favoriteClass)}50`}
          />
        </div>
      </div>

      {/* Records */}
      <div>
        <div style={sectionTitleStyle}>Records</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <div style={{
            ...cardStyle,
            background: "linear-gradient(135deg, rgba(255, 215, 0, 0.06) 0%, rgba(255, 215, 0, 0.02) 100%)",
            border: "1px solid rgba(255, 215, 0, 0.15)",
          }}>
            <div style={statLabelStyle}>Best Altitude</div>
            <div style={{
              ...statValueStyle,
              fontSize: "26px",
              color: "#ffd700",
              textShadow: "0 0 12px rgba(255, 215, 0, 0.3)",
            }}>
              {overallHighest}m
            </div>
          </div>
          <StatCard
            label="Fastest 5000m"
            value={stats.fastest5000m > 0 ? formatTime(stats.fastest5000m) : "---"}
            valueColor="#e0d0a0"
          />
          <StatCard
            label="Most Kills (Single Run)"
            value={stats.bestSingleRunKills || 0}
            valueColor="#ff6644"
          />
        </div>
      </div>

      {/* Streaks & Totals */}
      <div>
        <div style={sectionTitleStyle}>Streaks & Totals</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px" }}>
          <StatCard label="Current Streak" value={stats.currentStreak || 0} valueColor="#44ff44" />
          <StatCard label="Best Streak" value={stats.bestStreak || 0} valueColor="#44ff44" />
          <StatCard
            label="Total Essence"
            value={stats.totalEssenceEarned || 0}
            valueColor="#ffd700"
            valueGlow="rgba(255, 215, 0, 0.3)"
          />
          <StatCard
            label="Bosses Defeated"
            value={stats.totalBossesDefeated}
            valueColor="#ff4444"
          />
        </div>
      </div>

      {/* Averages */}
      {stats.totalRuns > 0 && (
        <div>
          <div style={sectionTitleStyle}>Averages</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            <StatCard
              label="Avg Altitude / Run"
              value={`${Math.floor(stats.totalAltitude / stats.totalRuns)}m`}
            />
            <StatCard
              label="Avg Kills / Run"
              value={Math.floor((stats.totalKills || 0) / stats.totalRuns)}
            />
            <StatCard
              label="Avg Run Time"
              value={formatTime(Math.floor((stats.totalPlayTimeMs || stats.totalPlayTime) / stats.totalRuns))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ClassesTab({ stats }: { stats: LifetimeStats }) {
  const classes = ["PALADIN", "MONK", "PRIEST"];

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={sectionTitleStyle}>Per-Class Breakdown</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
        {classes.map((cls) => {
          const pcs: PerClassStats = stats.perClassStats[cls] || {
            runs: 0,
            bestAltitude: 0,
            totalKills: 0,
            bestTime: 0,
            bossesDefeated: 0,
          };
          const color = getClassColor(cls);
          const icon = getClassIcon(cls);

          return (
            <div
              key={cls}
              style={{
                padding: "20px",
                background: `linear-gradient(135deg, ${color}10 0%, ${color}04 100%)`,
                borderRadius: "10px",
                border: `1px solid ${color}30`,
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {/* Class Header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                paddingBottom: "10px",
                borderBottom: `1px solid ${color}20`,
              }}>
                <span style={{
                  fontSize: "28px",
                  filter: `drop-shadow(0 0 6px ${color}60)`,
                }}>
                  {icon}
                </span>
                <span style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: color,
                  textTransform: "capitalize",
                  letterSpacing: "2px",
                  textShadow: `0 0 10px ${color}40`,
                }}>
                  {cls}
                </span>
              </div>

              {/* Stats */}
              {pcs.runs === 0 ? (
                <div style={{
                  color: "rgba(200, 200, 220, 0.3)",
                  fontSize: "13px",
                  textAlign: "center",
                  padding: "20px 0",
                }}>
                  No runs yet
                </div>
              ) : (
                <>
                  <ClassStatRow label="Runs Played" value={String(pcs.runs)} color={color} />
                  <ClassStatRow label="Best Altitude" value={`${pcs.bestAltitude}m`} color={color} />
                  <ClassStatRow label="Total Kills" value={String(pcs.totalKills)} color={color} />
                  <ClassStatRow label="Bosses Defeated" value={String(pcs.bossesDefeated)} color={color} />
                  <ClassStatRow
                    label="Longest Run"
                    value={pcs.bestTime > 0 ? formatTime(pcs.bestTime) : "---"}
                    color={color}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Class Distribution Bar */}
      {stats.totalRuns > 0 && (
        <div style={{ marginTop: "28px" }}>
          <div style={{
            fontSize: "13px",
            color: "rgba(200, 200, 220, 0.4)",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "10px",
          }}>
            Class Distribution
          </div>
          <div style={{
            display: "flex",
            height: "16px",
            borderRadius: "8px",
            overflow: "hidden",
            background: "rgba(255, 255, 255, 0.04)",
          }}>
            {classes.map((cls) => {
              const count = stats.classRunCounts[cls] || 0;
              const pct = stats.totalRuns > 0 ? (count / stats.totalRuns) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={cls}
                  style={{
                    width: `${pct}%`,
                    background: getClassColor(cls),
                    opacity: 0.7,
                    transition: "width 0.5s ease",
                  }}
                  title={`${cls}: ${count} runs (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "24px",
            marginTop: "8px",
          }}>
            {classes.map((cls) => {
              const count = stats.classRunCounts[cls] || 0;
              if (count === 0) return null;
              return (
                <span key={cls} style={{
                  fontSize: "12px",
                  color: getClassColor(cls),
                  opacity: 0.7,
                }}>
                  {cls}: {count}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ClassStatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "12px", color: "rgba(200, 200, 220, 0.45)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </span>
      <span style={{ fontSize: "16px", fontWeight: "bold", color, textShadow: `0 0 6px ${color}30` }}>
        {value}
      </span>
    </div>
  );
}

function HistoryTab({ stats }: { stats: LifetimeStats }) {
  const history = stats.runHistory || [];
  const sortedHistory = [...history].reverse(); // Most recent first

  // Find the best run by altitude
  let bestIdx = -1;
  let bestAlt = -1;
  sortedHistory.forEach((entry, i) => {
    if (entry.altitude > bestAlt) {
      bestAlt = entry.altitude;
      bestIdx = i;
    }
  });

  if (sortedHistory.length === 0) {
    return (
      <div style={{
        textAlign: "center",
        color: "rgba(200, 200, 220, 0.4)",
        fontSize: "14px",
        padding: "40px 0",
        animation: "fadeIn 0.3s ease",
      }}>
        No run history yet. Complete a run to see it here!
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={sectionTitleStyle}>Recent Runs</div>
      <div style={{
        maxHeight: "440px",
        overflowY: "auto",
        borderRadius: "8px",
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}>
        {/* Table Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "80px 100px 1fr 100px 80px",
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
        }}>
          <span>Date</span>
          <span>Class</span>
          <span>Altitude</span>
          <span>Time</span>
          <span>Kills</span>
        </div>

        {/* Table Rows */}
        {sortedHistory.map((entry, i) => {
          const isBest = i === bestIdx;
          const classColor = getClassColor(entry.class);

          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 100px 1fr 100px 80px",
                gap: "8px",
                padding: "10px 16px",
                background: isBest
                  ? "rgba(255, 215, 0, 0.06)"
                  : i % 2 === 0
                    ? "rgba(255, 255, 255, 0.015)"
                    : "transparent",
                borderLeft: isBest ? "3px solid #ffd700" : "3px solid transparent",
                borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                alignItems: "center",
                fontSize: "13px",
                transition: "background 0.15s ease",
              }}
            >
              <span style={{ color: "rgba(200, 200, 220, 0.5)" }}>
                {formatDate(entry.date)}
              </span>
              <span style={{
                color: classColor,
                fontWeight: "bold",
                textTransform: "capitalize",
              }}>
                {getClassIcon(entry.class)} {entry.class}
              </span>
              <span style={{
                color: isBest ? "#ffd700" : "#fff",
                fontWeight: isBest ? "bold" : "normal",
              }}>
                {entry.altitude}m {isBest ? " (BEST)" : ""}
              </span>
              <span style={{ color: "rgba(200, 200, 220, 0.7)" }}>
                {formatTime(entry.time)}
              </span>
              <span style={{ color: "rgba(200, 200, 220, 0.7)" }}>
                {entry.kills}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CombatTab({ stats }: { stats: LifetimeStats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", animation: "fadeIn 0.3s ease" }}>
      {/* Combat Totals */}
      <div>
        <div style={sectionTitleStyle}>Combat Totals</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <StatCard
            label="Total Kills"
            value={stats.totalKills || 0}
            valueColor="#ff6644"
          />
          <StatCard
            label="Total Parries"
            value={stats.totalParries || 0}
            valueColor="#44aaff"
          />
          <StatCard
            label="Perfect Dodges"
            value={stats.totalPerfectDodges || 0}
            valueColor="#44ff44"
          />
        </div>
      </div>

      {/* Damage Stats */}
      <div>
        <div style={sectionTitleStyle}>Damage</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{
            ...cardStyle,
            background: "linear-gradient(135deg, rgba(255, 68, 68, 0.06) 0%, rgba(255, 68, 68, 0.02) 100%)",
            border: "1px solid rgba(255, 68, 68, 0.15)",
          }}>
            <div style={statLabelStyle}>Total Damage Dealt</div>
            <div style={{
              ...statValueStyle,
              fontSize: "26px",
              color: "#ff6644",
              textShadow: "0 0 10px rgba(255, 68, 68, 0.3)",
            }}>
              {(stats.totalDamageDealt || 0).toLocaleString()}
            </div>
          </div>
          <div style={{
            ...cardStyle,
            background: "linear-gradient(135deg, rgba(255, 170, 0, 0.06) 0%, rgba(255, 170, 0, 0.02) 100%)",
            border: "1px solid rgba(255, 170, 0, 0.15)",
          }}>
            <div style={statLabelStyle}>Total Damage Taken</div>
            <div style={{
              ...statValueStyle,
              fontSize: "26px",
              color: "#ffaa00",
              textShadow: "0 0 10px rgba(255, 170, 0, 0.3)",
            }}>
              {(stats.totalDamageTaken || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Averages */}
      {stats.totalRuns > 0 && (
        <div>
          <div style={sectionTitleStyle}>Per-Run Averages</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px" }}>
            <StatCard
              label="Avg Kills / Run"
              value={Math.floor((stats.totalKills || 0) / stats.totalRuns)}
            />
            <StatCard
              label="Avg Altitude / Run"
              value={`${Math.floor(stats.totalAltitude / stats.totalRuns)}m`}
            />
            <StatCard
              label="Avg Dmg Dealt / Run"
              value={Math.floor((stats.totalDamageDealt || 0) / stats.totalRuns).toLocaleString()}
            />
            <StatCard
              label="Avg Dmg Taken / Run"
              value={Math.floor((stats.totalDamageTaken || 0) / stats.totalRuns).toLocaleString()}
            />
          </div>
        </div>
      )}

      {/* Misc Stats */}
      <div>
        <div style={sectionTitleStyle}>Exploration</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <StatCard
            label="Portals Used"
            value={stats.totalPortalsUsed || 0}
            valueColor="#9933ff"
            valueGlow="rgba(153, 51, 255, 0.3)"
          />
          <StatCard
            label="Total Deaths"
            value={stats.totalDeaths}
            valueColor="#ff4444"
          />
          <StatCard
            label="Total Altitude Climbed"
            value={`${(stats.totalAltitude || 0).toLocaleString()}m`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Stats Screen ──────────────────────────────────────────────

export const StatsScreen: React.FC<StatsScreenProps> = ({ onBack }) => {
  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [backHover, setBackHover] = useState(false);

  useEffect(() => {
    try {
      const loaded = PersistentStats.getLifetimeStats();
      setStats(loaded);
    } catch {
      // Stats not available
    }
  }, []);

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "classes", label: "Classes" },
    { id: "history", label: "History" },
    { id: "combat", label: "Combat" },
    { id: "achievements", label: "Achievements" },
  ];

  // Achievement data
  const achievementsByCategory = AchievementManager.getAllByCategory();
  const achievementCounts = AchievementManager.getCounts();

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
      {/* Inject fadeIn animation */}
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
          maxWidth: "960px",
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
          Statistics
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "#555",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          Your lifetime journey through the ascent
        </p>

        {/* Tabs */}
        {stats && stats.totalRuns > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "4px",
              marginBottom: "28px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              paddingBottom: "0",
            }}
          >
            {tabs.map((tab) => (
              <TabButton
                key={tab.id}
                label={tab.label}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>
        )}
      </div>

      {!stats || stats.totalRuns === 0 ? (
        <div
          style={{
            padding: "60px 40px",
            textAlign: "center",
            color: "#666",
            fontSize: "16px",
          }}
        >
          No runs completed yet. Start your first run to begin tracking
          statistics!
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            maxWidth: "960px",
            padding: "0 40px 20px",
            boxSizing: "border-box",
          }}
        >
          {activeTab === "overview" && <OverviewTab stats={stats} />}
          {activeTab === "classes" && <ClassesTab stats={stats} />}
          {activeTab === "history" && <HistoryTab stats={stats} />}
          {activeTab === "combat" && <CombatTab stats={stats} />}
          {activeTab === "achievements" && (
            <div>
              {/* Progress bar */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ ...statLabelStyle }}>Total Progress</span>
                  <span style={{ fontSize: "16px", fontWeight: "bold", color: "#ffd700" }}>
                    {achievementCounts.unlocked} / {achievementCounts.total}
                  </span>
                </div>
                <div style={{ width: "100%", height: "10px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "5px", overflow: "hidden" }}>
                  <div style={{
                    width: `${achievementCounts.total > 0 ? (achievementCounts.unlocked / achievementCounts.total) * 100 : 0}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #ffd700, #ffaa00)",
                    borderRadius: "5px",
                    transition: "width 0.5s ease",
                    boxShadow: "0 0 8px rgba(255,215,0,0.3)",
                  }} />
                </div>
              </div>

              {/* Achievement categories */}
              {(Object.entries(achievementsByCategory) as [AchievementCategory, (Achievement & { unlocked: boolean; unlockDate?: string })[]][]).map(([category, achievements]) => {
                const categoryInfo = CATEGORY_LABELS[category];
                const catUnlocked = achievements.filter(a => a.unlocked).length;
                return (
                  <div key={category} style={{ marginBottom: "24px" }}>
                    <div style={{ ...sectionTitleStyle, display: "flex", justifyContent: "space-between", borderBottomColor: `${categoryInfo.color}33` }}>
                      <span style={{ color: categoryInfo.color }}>{categoryInfo.name}</span>
                      <span style={{ fontSize: "13px", fontWeight: "normal", color: "rgba(200,200,220,0.4)" }}>{catUnlocked} / {achievements.length}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {achievements.map(a => (
                        <div key={a.id} style={{
                          padding: "12px 14px",
                          background: a.unlocked ? "rgba(255,215,0,0.04)" : "rgba(255,255,255,0.02)",
                          borderRadius: "8px",
                          border: a.unlocked ? "1px solid rgba(255,215,0,0.2)" : "1px solid rgba(255,255,255,0.06)",
                          opacity: a.unlocked ? 1 : 0.6,
                        }}>
                          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                            <span style={{ fontSize: "24px", filter: a.unlocked ? "none" : "grayscale(1) brightness(0.5)" }}>
                              {a.unlocked ? a.icon : "\u{1F512}"}
                            </span>
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: "bold", color: a.unlocked ? "#e0d0a0" : "#666" }}>{a.name}</div>
                              <div style={{ fontSize: "11px", color: a.unlocked ? "rgba(200,200,220,0.7)" : "rgba(200,200,220,0.35)", marginTop: "2px" }}>
                                {a.unlocked ? a.description : (a.hint || "???")}
                              </div>
                              {a.unlocked && a.unlockDate && (
                                <div style={{ fontSize: "10px", color: "rgba(255,215,0,0.4)", marginTop: "4px" }}>
                                  Unlocked {new Date(a.unlockDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Back button */}
      <div style={{ padding: "24px 0 36px" }}>
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

// ─── Tab Button Component ───────────────────────────────────────────

function TabButton({ label, active, onClick }: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "10px 24px",
        fontSize: "13px",
        fontFamily: "monospace",
        fontWeight: "bold",
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        background: active
          ? "rgba(224, 208, 160, 0.1)"
          : hover
            ? "rgba(255, 255, 255, 0.04)"
            : "transparent",
        color: active ? "#e0d0a0" : hover ? "rgba(200, 200, 220, 0.7)" : "rgba(200, 200, 220, 0.4)",
        border: "none",
        borderBottom: active ? "2px solid #e0d0a0" : "2px solid transparent",
        cursor: "pointer",
        transition: "all 0.2s ease",
        outline: "none",
      }}
    >
      {label}
    </button>
  );
}

export default StatsScreen;

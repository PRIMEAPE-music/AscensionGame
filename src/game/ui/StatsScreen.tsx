import React, { useState, useEffect } from "react";
import { PersistentStats } from "../systems/PersistentStats";
import type { LifetimeStats } from "../systems/PersistentStats";
import { AchievementManager } from "../systems/AchievementManager";
import type { Achievement, AchievementCategory, AchievementCheckStats } from "../systems/AchievementManager";

interface StatsScreenProps {
  onBack: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
}

const CATEGORY_LABELS: Record<AchievementCategory, { name: string; color: string }> = {
  combat: { name: "Combat", color: "#ff4444" },
  exploration: { name: "Exploration", color: "#44aaff" },
  collection: { name: "Collection", color: "#ffaa44" },
  meta: { name: "Meta", color: "#aa44ff" },
};

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

/** Single achievement card component */
const AchievementCard: React.FC<{
  achievement: Achievement & { unlocked: boolean; unlockDate?: string };
  progress: { current: number; target: number } | null;
}> = ({ achievement, progress }) => {
  const [hover, setHover] = useState(false);
  const isUnlocked = achievement.unlocked;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "14px",
        padding: "14px 16px",
        background: isUnlocked
          ? hover
            ? "rgba(255, 215, 0, 0.08)"
            : "rgba(255, 215, 0, 0.04)"
          : hover
            ? "rgba(255, 255, 255, 0.04)"
            : "rgba(255, 255, 255, 0.02)",
        borderRadius: "8px",
        border: isUnlocked
          ? "1px solid rgba(255, 215, 0, 0.2)"
          : "1px solid rgba(255, 255, 255, 0.06)",
        transition: "all 0.2s ease",
        opacity: isUnlocked ? 1 : 0.6,
        cursor: "default",
      }}
    >
      {/* Icon */}
      <div
        style={{
          fontSize: "28px",
          lineHeight: 1,
          minWidth: "36px",
          textAlign: "center",
          filter: isUnlocked
            ? "drop-shadow(0 0 4px rgba(255, 215, 0, 0.4))"
            : "grayscale(1) brightness(0.5)",
          marginTop: "2px",
        }}
      >
        {isUnlocked ? achievement.icon : "\u{1F512}"}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "15px",
            fontWeight: "bold",
            color: isUnlocked ? "#e0d0a0" : "#666",
            marginBottom: "2px",
          }}
        >
          {achievement.name}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: isUnlocked
              ? "rgba(200, 200, 220, 0.7)"
              : "rgba(200, 200, 220, 0.35)",
            lineHeight: 1.4,
          }}
        >
          {isUnlocked
            ? achievement.description
            : achievement.hint || "???"}
        </div>

        {/* Progress bar for numeric goals (only shown when locked) */}
        {!isUnlocked && progress && progress.target > 0 && (
          <div style={{ marginTop: "8px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                color: "rgba(200, 200, 220, 0.4)",
                marginBottom: "4px",
              }}
            >
              <span>Progress</span>
              <span>
                {progress.current} / {progress.target}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "6px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (progress.current / progress.target) * 100)}%`,
                  height: "100%",
                  background:
                    "linear-gradient(90deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.6) 100%)",
                  borderRadius: "3px",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Unlock date */}
        {isUnlocked && achievement.unlockDate && (
          <div
            style={{
              fontSize: "10px",
              color: "rgba(255, 215, 0, 0.4)",
              marginTop: "4px",
            }}
          >
            Unlocked {formatDate(achievement.unlockDate)}
          </div>
        )}
      </div>
    </div>
  );
};

export const StatsScreen: React.FC<StatsScreenProps> = ({ onBack }) => {
  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [backHover, setBackHover] = useState(false);
  const [activeTab, setActiveTab] = useState<"stats" | "achievements">(
    "stats",
  );

  useEffect(() => {
    try {
      const loaded = PersistentStats.getLifetimeStats();
      setStats(loaded);
    } catch {
      // Stats not available
    }
  }, []);

  // Get achievement data
  const achievementsByCategory = AchievementManager.getAllByCategory();
  const counts = AchievementManager.getCounts();

  // Build stats for progress display
  const buildCheckStats = (): AchievementCheckStats => {
    const lifetime = stats || {
      totalBossesDefeated: 0,
      totalDeaths: 0,
      highestAltitude: {} as Record<string, number>,
      totalRuns: 0,
    };
    const goldItemCount = PersistentStats.getUnlockedGoldItems().length;
    return {
      lifetime: {
        totalBossesDefeated: lifetime.totalBossesDefeated,
        totalDeaths: lifetime.totalDeaths,
        highestAltitude: lifetime.highestAltitude,
        totalRuns: lifetime.totalRuns,
      },
      run: { altitude: 0, kills: 0, bossesDefeated: 0, essenceEarned: 0 },
      currentClass: "",
      goldItemCount,
      maxComboThisRun: AchievementManager.getMaxCombo(),
      totalKills: AchievementManager.getTotalKills(),
    };
  };

  const checkStats = buildCheckStats();

  // Get overall highest altitude
  const overallHighest = stats
    ? Math.max(0, ...Object.values(stats.highestAltitude))
    : 0;

  // Class run counts sorted by count descending
  const classEntries = stats
    ? Object.entries(stats.classRunCounts).sort(([, a], [, b]) => b - a)
    : [];
  const maxClassRuns =
    classEntries.length > 0 ? classEntries[0][1] : 1;

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: "10px 24px",
    fontSize: "14px",
    fontFamily: "monospace",
    fontWeight: "bold",
    letterSpacing: "2px",
    textTransform: "uppercase",
    background: isActive
      ? "rgba(224, 208, 160, 0.12)"
      : "rgba(255, 255, 255, 0.03)",
    color: isActive ? "#e0d0a0" : "rgba(200, 200, 220, 0.4)",
    border: isActive
      ? "1px solid rgba(224, 208, 160, 0.3)"
      : "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    outline: "none",
  });

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
          maxWidth: "900px",
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
          {activeTab === "stats" ? "Statistics" : "Achievements"}
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#666",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          {activeTab === "stats"
            ? "Your lifetime journey through the ascent"
            : `${counts.unlocked} / ${counts.total} Unlocked`}
        </p>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          <button
            onClick={() => setActiveTab("stats")}
            style={tabStyle(activeTab === "stats")}
          >
            Stats
          </button>
          <button
            onClick={() => setActiveTab("achievements")}
            style={tabStyle(activeTab === "achievements")}
          >
            Achievements ({counts.unlocked}/{counts.total})
          </button>
        </div>
      </div>

      {/* Stats Tab */}
      {activeTab === "stats" && (
        <>
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
                maxWidth: "900px",
                padding: "0 40px 40px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "36px",
              }}
            >
              {/* Lifetime Stats Section */}
              <div>
                <div style={sectionTitleStyle}>Lifetime Stats</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      padding: "16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <div style={statLabelStyle}>Total Runs</div>
                    <div style={statValueStyle}>{stats.totalRuns}</div>
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <div style={statLabelStyle}>Total Deaths</div>
                    <div style={statValueStyle}>{stats.totalDeaths}</div>
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <div style={statLabelStyle}>Total Play Time</div>
                    <div style={statValueStyle}>{formatTime(stats.totalPlayTime)}</div>
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <div style={statLabelStyle}>Total Altitude</div>
                    <div style={statValueStyle}>{stats.totalAltitude}m</div>
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <div style={statLabelStyle}>Bosses Defeated</div>
                    <div style={statValueStyle}>{stats.totalBossesDefeated}</div>
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <div style={statLabelStyle}>Favorite Class</div>
                    <div
                      style={{
                        ...statValueStyle,
                        color: "#ffd700",
                        textShadow: "0 0 8px rgba(255, 215, 0, 0.3)",
                      }}
                    >
                      {stats.favoriteClass || "---"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Records Section */}
              <div>
                <div style={sectionTitleStyle}>Records</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      padding: "20px",
                      background:
                        "linear-gradient(135deg, rgba(255, 215, 0, 0.06) 0%, rgba(255, 215, 0, 0.02) 100%)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 215, 0, 0.15)",
                    }}
                  >
                    <div style={statLabelStyle}>Highest Altitude (Overall)</div>
                    <div
                      style={{
                        ...statValueStyle,
                        fontSize: "28px",
                        color: "#ffd700",
                        textShadow: "0 0 12px rgba(255, 215, 0, 0.3)",
                      }}
                    >
                      {overallHighest}m
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "20px",
                      background:
                        "linear-gradient(135deg, rgba(224, 208, 160, 0.06) 0%, rgba(224, 208, 160, 0.02) 100%)",
                      borderRadius: "8px",
                      border: "1px solid rgba(224, 208, 160, 0.15)",
                    }}
                  >
                    <div style={statLabelStyle}>Fastest 5000m</div>
                    <div
                      style={{
                        ...statValueStyle,
                        fontSize: "28px",
                        color: "#e0d0a0",
                        textShadow: "0 0 12px rgba(224, 208, 160, 0.3)",
                      }}
                    >
                      {stats.fastest5000m > 0 ? formatTime(stats.fastest5000m) : "---"}
                    </div>
                  </div>
                </div>

                {/* Per-class highest altitude */}
                {Object.keys(stats.highestAltitude).length > 0 && (
                  <div style={{ marginTop: "16px" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "rgba(200, 200, 220, 0.4)",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        marginBottom: "10px",
                      }}
                    >
                      Highest Altitude by Class
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {Object.entries(stats.highestAltitude)
                        .sort(([, a], [, b]) => b - a)
                        .map(([cls, alt]) => (
                          <div
                            key={cls}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "13px",
                                color: "#aaa",
                                width: "100px",
                                textAlign: "right",
                                textTransform: "capitalize",
                              }}
                            >
                              {cls}
                            </span>
                            <div
                              style={{
                                flex: 1,
                                height: "8px",
                                backgroundColor: "rgba(255, 255, 255, 0.06)",
                                borderRadius: "4px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${overallHighest > 0 ? (alt / overallHighest) * 100 : 0}%`,
                                  height: "100%",
                                  backgroundColor: "#e0d0a0",
                                  borderRadius: "4px",
                                  transition: "width 0.5s ease",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: "13px",
                                color: "#e0d0a0",
                                width: "60px",
                              }}
                            >
                              {alt}m
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Class Stats Section */}
              {classEntries.length > 0 && (
                <div>
                  <div style={sectionTitleStyle}>Class Stats</div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {classEntries.map(([cls, count]) => (
                      <div
                        key={cls}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "10px 16px",
                          background: "rgba(255, 255, 255, 0.02)",
                          borderRadius: "6px",
                          border: "1px solid rgba(255, 255, 255, 0.04)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#ccc",
                            width: "100px",
                            textAlign: "right",
                            fontWeight: "bold",
                            textTransform: "capitalize",
                          }}
                        >
                          {cls}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: "12px",
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                            borderRadius: "6px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${(count / maxClassRuns) * 100}%`,
                              height: "100%",
                              background:
                                "linear-gradient(90deg, rgba(204, 68, 255, 0.6) 0%, rgba(204, 68, 255, 0.3) 100%)",
                              borderRadius: "6px",
                              transition: "width 0.5s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#cc44ff",
                            width: "50px",
                            fontWeight: "bold",
                          }}
                        >
                          {count} {count === 1 ? "run" : "runs"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Achievements Tab */}
      {activeTab === "achievements" && (
        <div
          style={{
            width: "100%",
            maxWidth: "900px",
            padding: "0 40px 40px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "32px",
          }}
        >
          {/* Overall progress bar */}
          <div
            style={{
              padding: "16px 20px",
              background: "rgba(255, 215, 0, 0.04)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 215, 0, 0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "#e0d0a0",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                }}
              >
                Total Progress
              </span>
              <span
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#ffd700",
                }}
              >
                {counts.unlocked} / {counts.total}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "10px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderRadius: "5px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${counts.total > 0 ? (counts.unlocked / counts.total) * 100 : 0}%`,
                  height: "100%",
                  background:
                    "linear-gradient(90deg, #ffd700 0%, #ffaa00 100%)",
                  borderRadius: "5px",
                  transition: "width 0.5s ease",
                  boxShadow: "0 0 8px rgba(255, 215, 0, 0.3)",
                }}
              />
            </div>
          </div>

          {/* Achievement categories */}
          {(
            Object.entries(achievementsByCategory) as [
              AchievementCategory,
              (Achievement & { unlocked: boolean; unlockDate?: string })[],
            ][]
          ).map(([category, achievements]) => {
            const categoryInfo = CATEGORY_LABELS[category];
            const categoryUnlocked = achievements.filter(
              (a) => a.unlocked,
            ).length;

            return (
              <div key={category}>
                <div
                  style={{
                    ...sectionTitleStyle,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottomColor: `${categoryInfo.color}33`,
                  }}
                >
                  <span style={{ color: categoryInfo.color }}>
                    {categoryInfo.name}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "normal",
                      color: "rgba(200, 200, 220, 0.4)",
                      letterSpacing: "1px",
                    }}
                  >
                    {categoryUnlocked} / {achievements.length}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                  }}
                >
                  {achievements.map((achievement) => {
                    const progress = AchievementManager.getProgress(
                      achievement.id,
                      checkStats,
                    );
                    return (
                      <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                        progress={progress}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

export default StatsScreen;

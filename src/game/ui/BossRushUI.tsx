import React, { useState, useEffect, useCallback } from "react";
import { EventBus } from "../systems/EventBus";
import type { ItemData } from "../config/ItemConfig";

interface BossRushUIProps {
  onReturnToMenu: () => void;
}

// Rarity color map
const RARITY_COLORS: Record<string, string> = {
  COMMON: "#aaaaaa",
  UNCOMMON: "#44cc44",
  RARE: "#4488ff",
  LEGENDARY: "#ffd700",
  CURSED: "#9933cc",
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTimePrecise(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(2, "0")}`;
}

export const BossRushUI: React.FC<BossRushUIProps> = ({ onReturnToMenu }) => {
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(5);
  const [bossName, setBossName] = useState("");
  const [roundState, setRoundState] = useState<string>("PREP");
  const [timerMs, setTimerMs] = useState(0);
  const [itemOfferings, setItemOfferings] = useState<ItemData[]>([]);
  const [showItemSelect, setShowItemSelect] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);

  // Victory state
  const [victory, setVictory] = useState(false);
  const [victoryTime, setVictoryTime] = useState(0);
  const [essenceEarned, setEssenceEarned] = useState(0);
  const [bonusEssence, setBonusEssence] = useState(0);

  // Defeat state
  const [defeated, setDefeated] = useState(false);
  const [defeatRound, setDefeatRound] = useState(0);
  const [defeatBoss, setDefeatBoss] = useState("");
  const [defeatTime, setDefeatTime] = useState(0);

  useEffect(() => {
    const handleRound = (e: CustomEvent) => {
      const d = e.detail;
      setRound(d.round);
      setTotalRounds(d.totalRounds);
      setBossName(formatBossName(d.bossName));
      setRoundState(d.state);
    };

    const handleTimer = (e: CustomEvent) => {
      setTimerMs(e.detail.timeMs);
    };

    const handleItemSelect = (e: CustomEvent) => {
      setItemOfferings(e.detail.offerings);
      setShowItemSelect(true);
    };

    const handleVictory = (e: CustomEvent) => {
      const d = e.detail;
      setVictory(true);
      setVictoryTime(d.timeMs);
      setEssenceEarned(d.essenceEarned);
      setBonusEssence(d.bonusEssence);
    };

    const handleDefeat = (e: CustomEvent) => {
      const d = e.detail;
      setDefeated(true);
      setDefeatRound(d.round);
      setDefeatBoss(formatBossName(d.bossName));
      setDefeatTime(d.timeMs);
    };

    window.addEventListener("boss-rush-round", handleRound as EventListener);
    window.addEventListener("boss-rush-timer", handleTimer as EventListener);
    window.addEventListener(
      "boss-rush-item-select",
      handleItemSelect as EventListener,
    );
    window.addEventListener(
      "boss-rush-victory",
      handleVictory as EventListener,
    );
    window.addEventListener(
      "boss-rush-defeat",
      handleDefeat as EventListener,
    );

    return () => {
      window.removeEventListener(
        "boss-rush-round",
        handleRound as EventListener,
      );
      window.removeEventListener(
        "boss-rush-timer",
        handleTimer as EventListener,
      );
      window.removeEventListener(
        "boss-rush-item-select",
        handleItemSelect as EventListener,
      );
      window.removeEventListener(
        "boss-rush-victory",
        handleVictory as EventListener,
      );
      window.removeEventListener(
        "boss-rush-defeat",
        handleDefeat as EventListener,
      );
    };
  }, []);

  const handleItemPick = useCallback(
    (item: ItemData) => {
      setShowItemSelect(false);
      // Emit choice back to the scene
      window.dispatchEvent(
        new CustomEvent("boss-rush-item-chosen", { detail: { item } }),
      );
    },
    [],
  );

  // ── Victory Screen ──────────────────────────────────────────────────
  if (victory) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <h1
            style={{
              fontSize: "48px",
              color: "#ffd700",
              textTransform: "uppercase",
              letterSpacing: "6px",
              marginBottom: "8px",
              textShadow:
                "0 0 30px rgba(255, 215, 0, 0.5), 0 0 60px rgba(255, 215, 0, 0.3)",
            }}
          >
            BOSS RUSH COMPLETE!
          </h1>
          <div
            style={{
              fontSize: "14px",
              color: "rgba(224, 208, 160, 0.5)",
              letterSpacing: "4px",
              textTransform: "uppercase",
              marginBottom: "32px",
            }}
          >
            All 5 Bosses Defeated
          </div>

          <div style={statsRowStyle}>
            <div style={statBlockStyle}>
              <div style={statLabelStyle}>Total Time</div>
              <div style={{ ...statValueStyle, color: "#88ccff" }}>
                {formatTimePrecise(victoryTime)}
              </div>
            </div>
            <div style={statBlockStyle}>
              <div style={statLabelStyle}>Essence Earned</div>
              <div style={{ ...statValueStyle, color: "#cc44ff" }}>
                {essenceEarned}
              </div>
            </div>
            <div style={statBlockStyle}>
              <div style={statLabelStyle}>Time Bonus</div>
              <div style={{ ...statValueStyle, color: "#ffd700" }}>
                +{bonusEssence}
              </div>
            </div>
          </div>

          {/* Time rating */}
          <div
            style={{
              marginTop: "24px",
              fontSize: "18px",
              color: getTimeRatingColor(victoryTime),
              letterSpacing: "3px",
            }}
          >
            {getTimeRating(victoryTime)}
          </div>

          <button
            style={buttonStyle}
            onMouseEnter={(e) =>
              Object.assign(e.currentTarget.style, buttonHoverStyle)
            }
            onMouseLeave={(e) =>
              Object.assign(e.currentTarget.style, buttonBaseStyle)
            }
            onClick={onReturnToMenu}
          >
            Return to Menu
          </button>
        </div>
      </div>
    );
  }

  // ── Defeat Screen ───────────────────────────────────────────────────
  if (defeated) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <h1
            style={{
              fontSize: "42px",
              color: "#ff4444",
              textTransform: "uppercase",
              letterSpacing: "4px",
              marginBottom: "8px",
            }}
          >
            DEFEATED
          </h1>
          <div
            style={{
              fontSize: "16px",
              color: "rgba(255, 150, 150, 0.7)",
              marginBottom: "24px",
            }}
          >
            Slain by {defeatBoss} in Round {defeatRound}
          </div>

          <div style={statsRowStyle}>
            <div style={statBlockStyle}>
              <div style={statLabelStyle}>Rounds Survived</div>
              <div style={statValueStyle}>
                {defeatRound - 1}/{totalRounds}
              </div>
            </div>
            <div style={statBlockStyle}>
              <div style={statLabelStyle}>Time</div>
              <div style={statValueStyle}>{formatTime(defeatTime)}</div>
            </div>
          </div>

          <button
            style={buttonStyle}
            onMouseEnter={(e) =>
              Object.assign(e.currentTarget.style, buttonHoverStyle)
            }
            onMouseLeave={(e) =>
              Object.assign(e.currentTarget.style, buttonBaseStyle)
            }
            onClick={onReturnToMenu}
          >
            Return to Menu
          </button>
        </div>
      </div>
    );
  }

  // ── Item Selection Screen ───────────────────────────────────────────
  if (showItemSelect) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <h2
            style={{
              fontSize: "28px",
              color: "#ffd700",
              letterSpacing: "4px",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Choose a Reward
          </h2>
          <div
            style={{
              fontSize: "13px",
              color: "rgba(200, 200, 220, 0.5)",
              marginBottom: "24px",
              letterSpacing: "2px",
            }}
          >
            Round {round} Complete — Select 1 of 3 Items
          </div>

          <div
            style={{
              display: "flex",
              gap: "20px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {itemOfferings.map((item, idx) => {
              const isHovered = hoveredItem === idx;
              const rarityColor =
                RARITY_COLORS[item.rarity] || RARITY_COLORS.COMMON;
              return (
                <div
                  key={item.id}
                  style={{
                    width: "200px",
                    padding: "20px",
                    background: isHovered
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${isHovered ? rarityColor : "rgba(255, 255, 255, 0.1)"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    transform: isHovered ? "scale(1.05)" : "scale(1)",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: isHovered
                      ? `0 0 20px ${rarityColor}40`
                      : "none",
                  }}
                  onMouseEnter={() => setHoveredItem(idx)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={() => handleItemPick(item)}
                >
                  {/* Item icon (colored square) */}
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "8px",
                      background: `#${item.iconColor.toString(16).padStart(6, "0")}`,
                      border: `2px solid ${rarityColor}`,
                      boxShadow: `0 0 12px ${rarityColor}40`,
                    }}
                  />

                  {/* Item name */}
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "bold",
                      color: rarityColor,
                      letterSpacing: "1px",
                    }}
                  >
                    {item.name}
                  </div>

                  {/* Rarity */}
                  <div
                    style={{
                      fontSize: "11px",
                      color: rarityColor,
                      textTransform: "uppercase",
                      letterSpacing: "2px",
                      opacity: 0.7,
                    }}
                  >
                    {item.type === "GOLD" ? "GOLD" : item.rarity}
                  </div>

                  {/* Description */}
                  <div
                    style={{
                      fontSize: "12px",
                      color: "rgba(200, 200, 220, 0.7)",
                      lineHeight: "1.4",
                    }}
                  >
                    {item.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── In-Game HUD Overlay ─────────────────────────────────────────────
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        pointerEvents: "none",
        fontFamily: "monospace",
        zIndex: 10,
      }}
    >
      {/* Timer (top center) */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "28px",
          fontWeight: "bold",
          color: "#88ccff",
          letterSpacing: "3px",
          textShadow: "0 0 10px rgba(136, 204, 255, 0.3)",
        }}
      >
        {formatTime(timerMs)}
      </div>

      {/* Round indicator (top center, below timer) */}
      {round > 0 && (
        <div
          style={{
            position: "absolute",
            top: "48px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "16px",
            color: "rgba(224, 208, 160, 0.8)",
            letterSpacing: "4px",
            textTransform: "uppercase",
          }}
        >
          Round {round}/{totalRounds}
        </div>
      )}

      {/* Boss name (shown during FIGHTING) */}
      {roundState === "FIGHTING" && bossName && (
        <div
          style={{
            position: "absolute",
            top: "72px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "13px",
            color: "rgba(255, 100, 100, 0.7)",
            letterSpacing: "3px",
            textTransform: "uppercase",
          }}
        >
          {bossName}
        </div>
      )}

      {/* Round progress dots */}
      <div
        style={{
          position: "absolute",
          top: "96px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "8px",
        }}
      >
        {Array.from({ length: totalRounds }, (_, i) => {
          const roundNum = i + 1;
          const isComplete = roundNum < round || (roundNum === round && roundState !== "FIGHTING" && roundState !== "PREP");
          const isCurrent = roundNum === round;
          return (
            <div
              key={i}
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: isComplete
                  ? "#ffd700"
                  : isCurrent
                    ? "#ff4444"
                    : "rgba(255, 255, 255, 0.15)",
                border: isCurrent
                  ? "2px solid #ff6666"
                  : "1px solid rgba(255, 255, 255, 0.2)",
                transition: "all 0.3s ease",
              }}
            />
          );
        })}
      </div>

      {/* PREP countdown text */}
      {roundState === "PREP" && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "42px",
            fontWeight: "bold",
            color: "#ffd700",
            letterSpacing: "8px",
            textTransform: "uppercase",
            textShadow: "0 0 30px rgba(255, 215, 0, 0.4)",
            animation: "bossRushFadeIn 0.5s ease-out",
          }}
        >
          BOSS RUSH
        </div>
      )}

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes bossRushFadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(1.3); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
};

// ── Helper Functions ────────────────────────────────────────────────

function formatBossName(raw: string): string {
  // Convert PascalCase to spaced: "MagmaTyrant" -> "Magma Tyrant"
  return raw.replace(/([A-Z])/g, " $1").trim();
}

function getTimeRating(ms: number): string {
  if (ms < 3 * 60 * 1000) return "S RANK - LEGENDARY";
  if (ms < 5 * 60 * 1000) return "A RANK - EXCELLENT";
  if (ms < 8 * 60 * 1000) return "B RANK - GREAT";
  if (ms < 12 * 60 * 1000) return "C RANK - GOOD";
  return "D RANK - COMPLETE";
}

function getTimeRatingColor(ms: number): string {
  if (ms < 3 * 60 * 1000) return "#ffd700";
  if (ms < 5 * 60 * 1000) return "#ff8844";
  if (ms < 8 * 60 * 1000) return "#44aaff";
  if (ms < 12 * 60 * 1000) return "#44cc44";
  return "#aaaaaa";
}

// ── Styles ──────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  fontFamily: "monospace",
  color: "white",
  zIndex: 50,
};

const panelStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "48px 64px",
  background: "rgba(10, 10, 20, 0.95)",
  border: "1px solid rgba(224, 208, 160, 0.15)",
  borderRadius: "12px",
  maxWidth: "800px",
};

const statsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "48px",
  justifyContent: "center",
  marginTop: "16px",
};

const statBlockStyle: React.CSSProperties = {
  textAlign: "center",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "rgba(200, 200, 220, 0.4)",
  textTransform: "uppercase",
  letterSpacing: "2px",
  marginBottom: "4px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "rgba(224, 208, 160, 0.9)",
};

const buttonBaseStyle: React.CSSProperties = {
  background: "rgba(224, 208, 160, 0.08)",
  borderColor: "rgba(224, 208, 160, 0.3)",
  color: "#e0d0a0",
};

const buttonHoverStyle: React.CSSProperties = {
  background: "rgba(224, 208, 160, 0.2)",
  borderColor: "rgba(224, 208, 160, 0.6)",
  color: "#ffd700",
};

const buttonStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  marginTop: "32px",
  padding: "14px 40px",
  fontSize: "18px",
  fontFamily: "monospace",
  fontWeight: "bold",
  letterSpacing: "3px",
  textTransform: "uppercase",
  border: "1px solid rgba(224, 208, 160, 0.3)",
  borderRadius: "6px",
  cursor: "pointer",
  transition: "all 0.25s ease",
  outline: "none",
  pointerEvents: "auto",
};

export default BossRushUI;

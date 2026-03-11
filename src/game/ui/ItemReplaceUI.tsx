import React, { useState, useEffect, useCallback } from "react";
import type { ItemData } from "../config/ItemConfig";

interface ItemReplaceUIProps {
  newItem: ItemData;
  currentItems: ItemData[];
  onTake: (replaceIndex: number) => void;
  onLeave: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON: "#aaaaaa",
  UNCOMMON: "#00ff00",
  RARE: "#4444ff",
  LEGENDARY: "#ffd700",
};

const STAT_LABELS: Record<string, string> = {
  health: "Health",
  moveSpeed: "Move Speed",
  jumpHeight: "Jump Height",
  attackDamage: "Attack Damage",
  attackSpeed: "Attack Speed",
};

const TIMER_DURATION = 10;

const glassPanel: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.5)",
  border: "1px solid rgba(255, 204, 0, 0.25)",
  borderRadius: "12px",
  boxShadow:
    "0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 204, 0, 0.08)",
  padding: "20px",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  gap: "8px",
};

function formatEffect(effect: { targetStat: string; value: number; operation: string }): string {
  const label = STAT_LABELS[effect.targetStat] || effect.targetStat;
  if (effect.targetStat === "health") {
    return `${label} +${effect.value}`;
  }
  const pct = Math.round(effect.value * 100);
  return `${label} +${pct}%`;
}

function formatDiff(stat: string, diff: number): { text: string; color: string } {
  const label = STAT_LABELS[stat] || stat;
  if (stat === "health") {
    const sign = diff >= 0 ? "+" : "";
    return {
      text: `${label} ${sign}${diff}`,
      color: diff >= 0 ? "#00ff00" : "#ff4444",
    };
  }
  const pct = Math.round(diff * 100);
  const sign = pct >= 0 ? "+" : "";
  return {
    text: `${label} ${sign}${pct}%`,
    color: pct >= 0 ? "#00ff00" : "#ff4444",
  };
}

function computeNetChange(
  newItem: ItemData,
  oldItem: ItemData,
): { text: string; color: string }[] {
  const statDiffs = new Map<string, number>();

  // Add new item effects
  if (newItem.effects) {
    newItem.effects.forEach((e) => {
      const current = statDiffs.get(e.targetStat) || 0;
      statDiffs.set(e.targetStat, current + e.value);
    });
  }

  // Subtract old item effects
  if (oldItem.effects) {
    oldItem.effects.forEach((e) => {
      const current = statDiffs.get(e.targetStat) || 0;
      statDiffs.set(e.targetStat, current - e.value);
    });
  }

  const results: { text: string; color: string }[] = [];
  statDiffs.forEach((diff, stat) => {
    if (diff !== 0) {
      results.push(formatDiff(stat, diff));
    }
  });

  return results;
}

export const ItemReplaceUI: React.FC<ItemReplaceUIProps> = ({
  newItem,
  currentItems,
  onTake,
  onLeave,
}) => {
  const [timer, setTimer] = useState(TIMER_DURATION);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) {
      onLeave();
      return;
    }
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer, onLeave]);

  const handleReplace = useCallback(
    (index: number) => {
      onTake(index);
    },
    [onTake],
  );

  const newRarityColor = RARITY_COLORS[newItem.rarity] || "#aaaaaa";
  const timerColor = timer <= 3 ? "#ff4444" : timer <= 5 ? "#ffaa00" : "#ffffff";

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        fontFamily: "monospace",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: "42px",
          fontWeight: "bold",
          color: "#ffcc00",
          textShadow:
            "0 0 20px rgba(255, 204, 0, 0.6), 0 0 40px rgba(255, 204, 0, 0.3), 2px 2px 4px rgba(0, 0, 0, 0.9)",
          letterSpacing: "6px",
          marginBottom: "4px",
        }}
      >
        INVENTORY FULL
      </div>

      {/* Timer */}
      <div
        style={{
          fontSize: "18px",
          color: timerColor,
          textShadow: timer <= 3 ? "0 0 8px rgba(255, 68, 68, 0.6)" : "none",
          marginBottom: "20px",
          transition: "color 0.3s",
        }}
      >
        Auto-skip in {timer}s
      </div>

      {/* Main content area */}
      <div
        style={{
          display: "flex",
          gap: "32px",
          alignItems: "flex-start",
          justifyContent: "center",
          flexWrap: "wrap",
          maxWidth: "900px",
        }}
      >
        {/* Left panel: New Item */}
        <div
          style={{
            ...glassPanel,
            minWidth: "240px",
            maxWidth: "280px",
            borderColor: `${newRarityColor}44`,
          }}
        >
          <div
            style={{
              fontSize: "14px",
              color: "rgba(255, 255, 255, 0.5)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            New Item
          </div>

          {/* Item icon placeholder */}
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "8px",
              background: `${newRarityColor}22`,
              border: `2px solid ${newRarityColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              color: newRarityColor,
              boxShadow: `0 0 12px ${newRarityColor}44`,
            }}
          >
            &#9670;
          </div>

          {/* Name */}
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: newRarityColor,
              textShadow: `0 0 8px ${newRarityColor}66`,
              textAlign: "center",
            }}
          >
            {newItem.name}
          </div>

          {/* Rarity */}
          <div
            style={{
              fontSize: "12px",
              color: newRarityColor,
              letterSpacing: "1px",
              opacity: 0.8,
            }}
          >
            {newItem.rarity}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.6)",
              textAlign: "center",
              lineHeight: "1.4",
              minHeight: "36px",
            }}
          >
            {newItem.description}
          </div>

          {/* Effects */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              width: "100%",
            }}
          >
            {newItem.effects?.map((effect, i) => (
              <div
                key={i}
                style={{
                  fontSize: "14px",
                  color: "#00ff00",
                  textAlign: "center",
                }}
              >
                {formatEffect(effect)}
              </div>
            ))}
            {newItem.abilityId && (
              <div
                style={{
                  fontSize: "14px",
                  color: "#ffd700",
                  textAlign: "center",
                }}
              >
                Ability: {newItem.abilityId.replace(/_/g, " ")}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Current Items */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            minWidth: "280px",
            maxWidth: "360px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              color: "rgba(255, 255, 255, 0.5)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            Current Items - Pick one to replace
          </div>

          {currentItems.map((item, index) => {
            const rarityColor = RARITY_COLORS[item.rarity] || "#aaaaaa";
            const isHovered = hoveredIndex === index;
            const netChanges = isHovered ? computeNetChange(newItem, item) : [];

            return (
              <div
                key={item.id + "-" + index}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  ...glassPanel,
                  flexDirection: "row" as const,
                  alignItems: "center",
                  padding: "12px 16px",
                  gap: "12px",
                  cursor: "pointer",
                  borderColor: isHovered
                    ? "rgba(255, 204, 0, 0.6)"
                    : `${rarityColor}33`,
                  background: isHovered
                    ? "rgba(255, 204, 0, 0.08)"
                    : "rgba(0, 0, 0, 0.5)",
                  transform: isHovered ? "scale(1.02)" : "scale(1)",
                  transition:
                    "transform 0.15s ease-out, border-color 0.15s, background 0.15s",
                }}
                onClick={() => handleReplace(index)}
              >
                {/* Item icon */}
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "6px",
                    background: `${rarityColor}22`,
                    border: `2px solid ${rarityColor}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    color: rarityColor,
                    flexShrink: 0,
                  }}
                >
                  &#9670;
                </div>

                {/* Item info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "bold",
                      color: rarityColor,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "rgba(255, 255, 255, 0.5)",
                    }}
                  >
                    {item.effects?.map((e, i) => (
                      <span key={i}>
                        {i > 0 && ", "}
                        {formatEffect(e)}
                      </span>
                    ))}
                  </div>

                  {/* Net change on hover */}
                  {isHovered && netChanges.length > 0 && (
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "12px",
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      {netChanges.map((nc, i) => (
                        <span key={i} style={{ color: nc.color }}>
                          {nc.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Replace button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReplace(index);
                  }}
                  style={{
                    padding: "6px 16px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    letterSpacing: "1px",
                    border: "1px solid rgba(255, 204, 0, 0.5)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "#ffcc00",
                    background: isHovered
                      ? "rgba(255, 204, 0, 0.2)"
                      : "rgba(255, 204, 0, 0.1)",
                    textShadow: "0 0 8px rgba(255, 204, 0, 0.4)",
                    transition: "background 0.2s",
                    flexShrink: 0,
                    pointerEvents: "auto",
                  }}
                >
                  REPLACE
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leave It button */}
      <button
        onClick={onLeave}
        style={{
          marginTop: "24px",
          padding: "12px 48px",
          fontSize: "18px",
          fontWeight: "bold",
          fontFamily: "monospace",
          letterSpacing: "3px",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          borderRadius: "8px",
          cursor: "pointer",
          color: "rgba(255, 255, 255, 0.8)",
          background: "rgba(255, 255, 255, 0.08)",
          textShadow: "0 0 8px rgba(255, 255, 255, 0.3)",
          transition: "background 0.2s, border-color 0.2s",
          pointerEvents: "auto",
        }}
      >
        LEAVE IT
      </button>
    </div>
  );
};

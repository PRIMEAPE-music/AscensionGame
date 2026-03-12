import React, { useState, useEffect, useCallback, useRef } from "react";
import type { ItemData } from "../config/ItemConfig";
import { GamepadManager } from "../systems/GamepadManager";

interface CoopItemDraftProps {
  items: ItemData[];
  onComplete: (p1Item: string, p2Item: string) => void;
}

const TIMER_DURATION = 15;

const RARITY_COLORS: Record<string, string> = {
  COMMON: "#aaaaaa",
  UNCOMMON: "#00ff00",
  RARE: "#4444ff",
  LEGENDARY: "#ffd700",
  CURSED: "#9933cc",
};

const glassPanel: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.6)",
  border: "2px solid rgba(255, 204, 0, 0.3)",
  borderRadius: "12px",
  boxShadow:
    "0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 204, 0, 0.08)",
  padding: "20px",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  transition: "transform 0.15s ease-out, border-color 0.15s, background 0.15s",
  minWidth: "180px",
  maxWidth: "220px",
};

export const CoopItemDraft: React.FC<CoopItemDraftProps> = ({
  items,
  onComplete,
}) => {
  const [timer, setTimer] = useState(TIMER_DURATION);
  const [p1Pick, setP1Pick] = useState<number | null>(null);
  const [p2Pick, setP2Pick] = useState<number | null>(null);
  const [p2Cursor, setP2Cursor] = useState(0);
  const completedRef = useRef(false);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) {
      // Auto-assign: P1 gets first available, P2 gets second
      if (!completedRef.current) {
        completedRef.current = true;
        const p1 = p1Pick ?? 0;
        let p2 = p2Pick ?? (p1 === 0 ? 1 : 0);
        if (p2 === p1) p2 = p1 === 0 ? 1 : 0;
        onComplete(items[p1].id, items[p2].id);
      }
      return;
    }
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer, p1Pick, p2Pick, items, onComplete]);

  // Check if both players have picked
  useEffect(() => {
    if (p1Pick !== null && p2Pick !== null && !completedRef.current) {
      completedRef.current = true;
      onComplete(items[p1Pick].id, items[p2Pick].id);
    }
  }, [p1Pick, p2Pick, items, onComplete]);

  // P1 clicks with mouse
  const handleP1Click = useCallback(
    (index: number) => {
      if (p1Pick !== null) return;
      // If P2 already picked this one, P1 can't pick same
      if (p2Pick === index) return;
      setP1Pick(index);
    },
    [p1Pick, p2Pick],
  );

  // P2 gamepad navigation
  const prevMoveXRef = useRef(0);
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (p2Pick !== null) return;

      const gp = GamepadManager.getStateForPlayer(1);
      if (!gp || !gp.connected) return;

      // D-pad / stick left/right to move cursor (detect edge transition)
      const prevX = prevMoveXRef.current;
      const curX = gp.moveX;
      prevMoveXRef.current = curX;

      if (curX < -0.5 && prevX >= -0.5) {
        setP2Cursor((prev) => (prev - 1 + items.length) % items.length);
      }
      if (curX > 0.5 && prevX <= 0.5) {
        setP2Cursor((prev) => (prev + 1) % items.length);
      }

      // A/B button (attackB) to select
      if (gp.attackBJustPressed || gp.jumpJustPressed) {
        setP2Cursor((current) => {
          // Check if P1 already picked this
          if (p1Pick === current) return current;
          setP2Pick(current);
          return current;
        });
      }
    }, 50);

    return () => clearInterval(pollInterval);
  }, [p1Pick, p2Pick, items.length]);

  // Also allow P2 to use keyboard (arrow keys + Enter) as fallback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (p2Pick !== null) return;

      if (e.key === "ArrowLeft") {
        setP2Cursor((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === "ArrowRight") {
        setP2Cursor((prev) => (prev + 1) % items.length);
      } else if (e.key === "Enter") {
        setP2Cursor((current) => {
          if (p1Pick === current) return current;
          setP2Pick(current);
          return current;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [p1Pick, p2Pick, items.length]);

  const timerColor =
    timer <= 3 ? "#ff4444" : timer <= 5 ? "#ffaa00" : "#ffffff";

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
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
          fontSize: "36px",
          fontWeight: "bold",
          color: "#ffcc00",
          textShadow:
            "0 0 20px rgba(255, 204, 0, 0.6), 0 0 40px rgba(255, 204, 0, 0.3), 2px 2px 4px rgba(0, 0, 0, 0.9)",
          letterSpacing: "4px",
          marginBottom: "4px",
        }}
      >
        ITEM DRAFT
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: "14px",
          color: "rgba(255, 255, 255, 0.6)",
          marginBottom: "4px",
        }}
      >
        <span style={{ color: "#4488ff" }}>P1</span> click to pick
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <span style={{ color: "#ff4444" }}>P2</span> d-pad + A (or Arrow Keys
        + Enter)
      </div>

      {/* Timer */}
      <div
        style={{
          fontSize: "20px",
          color: timerColor,
          textShadow:
            timer <= 3 ? "0 0 8px rgba(255, 68, 68, 0.6)" : "none",
          marginBottom: "20px",
          transition: "color 0.3s",
        }}
      >
        {timer}s
      </div>

      {/* Items */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        {items.map((item, index) => {
          const rarityColor = RARITY_COLORS[item.rarity] || "#aaaaaa";
          const isP1Pick = p1Pick === index;
          const isP2Pick = p2Pick === index;
          const isP2Cursor = p2Pick === null && p2Cursor === index;
          const isP1Taken = p1Pick !== null && p1Pick === index;
          const isP2Taken = p2Pick !== null && p2Pick === index;
          const isTaken = isP1Taken || isP2Taken;

          let borderColor = `${rarityColor}44`;
          if (isP1Pick) borderColor = "#4488ff";
          else if (isP2Pick) borderColor = "#ff4444";
          else if (isP2Cursor) borderColor = "rgba(255, 68, 68, 0.5)";

          return (
            <div
              key={item.id}
              onClick={() => handleP1Click(index)}
              style={{
                ...glassPanel,
                borderColor,
                background: isTaken
                  ? "rgba(0, 0, 0, 0.3)"
                  : isP2Cursor
                    ? "rgba(255, 68, 68, 0.08)"
                    : "rgba(0, 0, 0, 0.6)",
                transform: isP2Cursor ? "scale(1.05)" : "scale(1)",
                opacity: isTaken && !isP1Pick && !isP2Pick ? 0.4 : 1,
                pointerEvents:
                  p1Pick !== null || isTaken ? "none" : "auto",
              }}
            >
              {/* Claimed badge */}
              {isP1Pick && (
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#4488ff",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                  }}
                >
                  P1 PICK
                </div>
              )}
              {isP2Pick && (
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#ff4444",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                  }}
                >
                  P2 PICK
                </div>
              )}

              {/* Item icon placeholder */}
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "8px",
                  background: `${rarityColor}22`,
                  border: `3px solid ${rarityColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  color: rarityColor,
                  boxShadow: `0 0 12px ${rarityColor}44`,
                }}
              >
                &#9670;
              </div>

              {/* Name */}
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: rarityColor,
                  textShadow: `0 0 8px ${rarityColor}66`,
                  textAlign: "center",
                }}
              >
                {item.name}
              </div>

              {/* Rarity */}
              <div
                style={{
                  fontSize: "11px",
                  color: rarityColor,
                  letterSpacing: "1px",
                  opacity: 0.8,
                }}
              >
                {item.rarity}
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(255, 255, 255, 0.6)",
                  textAlign: "center",
                  lineHeight: "1.4",
                  minHeight: "36px",
                }}
              >
                {item.description}
              </div>

              {/* Effects */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  width: "100%",
                }}
              >
                {item.effects?.map((effect, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "12px",
                      color: "#00ff00",
                      textAlign: "center",
                    }}
                  >
                    {effect.targetStat === "health"
                      ? `Health +${effect.value}`
                      : `${effect.targetStat} +${Math.round(effect.value * 100)}%`}
                  </div>
                ))}
                {item.abilityId && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#ffd700",
                      textAlign: "center",
                    }}
                  >
                    Ability: {item.abilityId.replace(/_/g, " ")}
                  </div>
                )}
              </div>

              {/* P2 cursor indicator */}
              {isP2Cursor && !isTaken && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#ff4444",
                    letterSpacing: "1px",
                    opacity: 0.7,
                    marginTop: "4px",
                  }}
                >
                  P2 &#9654;
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status text */}
      <div
        style={{
          marginTop: "20px",
          fontSize: "16px",
          color: "rgba(255, 255, 255, 0.7)",
          textAlign: "center",
        }}
      >
        {p1Pick !== null && p2Pick === null && (
          <span>
            <span style={{ color: "#4488ff" }}>P1</span> picked{" "}
            <span style={{ color: "#ffd700" }}>{items[p1Pick].name}</span> --
            Waiting for <span style={{ color: "#ff4444" }}>P2</span>...
          </span>
        )}
        {p1Pick === null && p2Pick !== null && (
          <span>
            <span style={{ color: "#ff4444" }}>P2</span> picked{" "}
            <span style={{ color: "#ffd700" }}>{items[p2Pick].name}</span> --
            Waiting for <span style={{ color: "#4488ff" }}>P1</span>...
          </span>
        )}
        {p1Pick === null && p2Pick === null && (
          <span>Both players choose an item. Same item cannot be picked twice.</span>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from "react";
import { EventBus } from "../systems/EventBus";

// ─── Shrine UI ─────────────────────────────────────────────────────────────

interface ShrineUIProps {
  buffs: Array<{ id: string; label: string; description: string }>;
  onClose: () => void;
}

export const SecretRoomShrineUI: React.FC<ShrineUIProps> = ({ buffs, onClose }) => {
  const [chosen, setChosen] = useState<string | null>(null);

  const handleChoose = useCallback(
    (buffId: string) => {
      if (chosen) return;
      setChosen(buffId);
      EventBus.emit("secret-room-shrine-choose", { buffId });

      // Auto-close after brief delay to show selection
      setTimeout(() => {
        EventBus.emit("secret-room-shrine-close", {});
        onClose();
      }, 800);
    },
    [chosen, onClose],
  );

  const buffColors: Record<string, string> = {
    damage_boost: "#ff6644",
    speed_boost: "#44ccff",
    hp_boost: "#44ff88",
  };

  const buffIcons: Record<string, string> = {
    damage_boost: "\u2694",
    speed_boost: "\u26A1",
    hp_boost: "\u2665",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(10, 20, 40, 0.85)",
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
          fontSize: "44px",
          fontWeight: "bold",
          color: "#88ccff",
          textShadow:
            "0 0 20px rgba(100, 180, 255, 0.6), 0 0 40px rgba(100, 180, 255, 0.3), 2px 2px 4px rgba(0, 0, 0, 0.9)",
          letterSpacing: "5px",
          marginBottom: "8px",
        }}
      >
        ANCIENT SHRINE
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "rgba(150, 200, 255, 0.6)",
          letterSpacing: "3px",
          marginBottom: "32px",
          textTransform: "uppercase",
        }}
      >
        Choose a permanent blessing for your ascent
      </div>

      {/* Buff Cards */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {buffs.map((buff) => {
          const isChosen = chosen === buff.id;
          const isDisabled = chosen !== null && !isChosen;
          const color = buffColors[buff.id] || "#ffffff";

          return (
            <div
              key={buff.id}
              onClick={() => !isDisabled && handleChoose(buff.id)}
              style={{
                background: isChosen
                  ? "rgba(100, 180, 255, 0.2)"
                  : "rgba(20, 40, 60, 0.55)",
                border: `2px solid ${isChosen ? color : "rgba(100, 180, 255, 0.3)"}`,
                borderRadius: "12px",
                boxShadow: isChosen
                  ? `0 0 30px ${color}66, inset 0 1px 0 rgba(100, 180, 255, 0.1)`
                  : "0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(100, 180, 255, 0.1)",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                gap: "14px",
                minWidth: "180px",
                maxWidth: "220px",
                cursor: isDisabled ? "default" : "pointer",
                opacity: isDisabled ? 0.4 : 1,
                transform: isChosen ? "scale(1.05)" : "scale(1)",
                transition:
                  "transform 0.2s ease-out, opacity 0.3s, box-shadow 0.2s, border-color 0.2s",
              }}
            >
              {/* Icon */}
              <div
                style={{
                  fontSize: "48px",
                  lineHeight: 1,
                  textShadow: `0 0 16px ${color}88`,
                }}
              >
                {buffIcons[buff.id] || "\u2726"}
              </div>

              {/* Label */}
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color,
                  textAlign: "center",
                  textShadow: `0 0 8px ${color}44`,
                }}
              >
                {buff.label}
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(180, 210, 255, 0.7)",
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                {buff.description}
              </div>

              {/* Choose button */}
              {!chosen && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChoose(buff.id);
                  }}
                  style={{
                    marginTop: "8px",
                    padding: "8px 28px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    letterSpacing: "2px",
                    border: `1px solid ${color}66`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    color,
                    background: `${color}18`,
                    textShadow: `0 0 6px ${color}44`,
                    transition: "background 0.2s",
                    pointerEvents: "auto",
                  }}
                >
                  CHOOSE
                </button>
              )}

              {isChosen && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    color,
                    letterSpacing: "3px",
                  }}
                >
                  CHOSEN!
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Lore UI ───────────────────────────────────────────────────────────────

interface LoreUIProps {
  title: string;
  text: string;
  onClose: () => void;
}

export const SecretRoomLoreUI: React.FC<LoreUIProps> = ({ title, text, onClose }) => {
  const handleClose = useCallback(() => {
    EventBus.emit("secret-room-lore-close", {});
    onClose();
  }, [onClose]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(15, 10, 5, 0.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        fontFamily: "monospace",
      }}
    >
      {/* Decorative top border */}
      <div
        style={{
          width: "200px",
          height: "2px",
          background:
            "linear-gradient(90deg, transparent, rgba(204, 170, 100, 0.6), transparent)",
          marginBottom: "24px",
        }}
      />

      {/* Title */}
      <div
        style={{
          fontSize: "36px",
          fontWeight: "bold",
          color: "#ccaa66",
          textShadow:
            "0 0 16px rgba(204, 170, 100, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.8)",
          letterSpacing: "4px",
          marginBottom: "12px",
        }}
      >
        {title}
      </div>

      {/* Lore text */}
      <div
        style={{
          maxWidth: "600px",
          fontSize: "16px",
          color: "rgba(220, 200, 170, 0.85)",
          textAlign: "center",
          lineHeight: 1.8,
          padding: "0 24px",
          marginBottom: "24px",
          fontStyle: "italic",
        }}
      >
        {text}
      </div>

      {/* Essence reward note */}
      <div
        style={{
          fontSize: "18px",
          color: "#cc88ff",
          textShadow: "0 0 8px rgba(204, 136, 255, 0.5)",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "20px" }}>&#9670;</span>
        <span>+50 Essence</span>
      </div>

      {/* Decorative bottom border */}
      <div
        style={{
          width: "200px",
          height: "2px",
          background:
            "linear-gradient(90deg, transparent, rgba(204, 170, 100, 0.6), transparent)",
          marginBottom: "24px",
        }}
      />

      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          padding: "12px 48px",
          fontSize: "18px",
          fontWeight: "bold",
          fontFamily: "monospace",
          letterSpacing: "3px",
          border: "1px solid rgba(204, 170, 100, 0.4)",
          borderRadius: "8px",
          cursor: "pointer",
          color: "#ccaa66",
          background: "rgba(204, 170, 100, 0.08)",
          textShadow: "0 0 8px rgba(204, 170, 100, 0.3)",
          transition: "background 0.2s, border-color 0.2s",
          pointerEvents: "auto",
        }}
      >
        CONTINUE
      </button>
    </div>
  );
};

// ─── Challenge Timer HUD ───────────────────────────────────────────────────

interface ChallengeTimerProps {
  remaining: number;
  enemyCount: number;
}

export const SecretRoomChallengeTimer: React.FC<ChallengeTimerProps> = ({
  remaining,
  enemyCount,
}) => {
  const isLow = remaining <= 10;

  return (
    <div
      style={{
        position: "absolute",
        top: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        fontFamily: "monospace",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: "bold",
          color: "#ff4444",
          letterSpacing: "3px",
          textShadow: "0 0 8px rgba(255, 68, 68, 0.5)",
        }}
      >
        CHALLENGE
      </div>
      <div
        style={{
          fontSize: "36px",
          fontWeight: "bold",
          color: isLow ? "#ff4444" : "#ffffff",
          textShadow: isLow
            ? "0 0 16px rgba(255, 68, 68, 0.8)"
            : "0 0 8px rgba(255, 255, 255, 0.3)",
          animation: isLow ? "challengePulse 0.5s ease-in-out infinite alternate" : undefined,
        }}
      >
        {remaining}s
      </div>
      <div
        style={{
          fontSize: "12px",
          color: "rgba(255, 150, 150, 0.7)",
          letterSpacing: "1px",
        }}
      >
        Defeat all enemies!
      </div>

      <style>
        {`
          @keyframes challengePulse {
            0% { transform: scale(1); }
            100% { transform: scale(1.1); }
          }
        `}
      </style>
    </div>
  );
};

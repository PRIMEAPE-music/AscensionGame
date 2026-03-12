import React, { useState, useEffect, useRef, useCallback } from "react";
import { EventBus } from "../systems/EventBus";

interface GamblingUIProps {
  essence: number;
  onClose: () => void;
}

type RewardType = "nothing" | "item" | "health" | "gold_item" | "cursed_item";

interface RollResult {
  rewardType: RewardType;
  reward: string;
}

function rollReward(tier: number): RollResult {
  const roll = Math.random();
  if (tier === 50) {
    if (roll < 0.70) return { rewardType: "nothing", reward: "Nothing" };
    if (roll < 0.93) return { rewardType: "item", reward: "Silver Item" };
    if (roll < 0.97) return { rewardType: "health", reward: "+1 Health" };
    return { rewardType: "cursed_item", reward: "Cursed Item..." };
  } else if (tier === 100) {
    if (roll < 0.40) return { rewardType: "nothing", reward: "Nothing" };
    if (roll < 0.80) return { rewardType: "item", reward: "Silver Item" };
    if (roll < 0.90) return { rewardType: "health", reward: "+1 Health" };
    if (roll < 0.95) return { rewardType: "cursed_item", reward: "Cursed Item..." };
    return { rewardType: "gold_item", reward: "Gold Item!" };
  } else {
    // 200
    if (roll < 0.20) return { rewardType: "nothing", reward: "Nothing" };
    if (roll < 0.62) return { rewardType: "item", reward: "Silver Item" };
    if (roll < 0.82) return { rewardType: "health", reward: "+1 Health" };
    if (roll < 0.90) return { rewardType: "cursed_item", reward: "Cursed Item..." };
    return { rewardType: "gold_item", reward: "Gold Item!" };
  }
}

const SPIN_TEXTS = [
  "The spirits whisper...",
  "Fortune turns...",
  "The shrine glows...",
  "Destiny stirs...",
  "The veil parts...",
];

const REWARD_COLORS: Record<RewardType, string> = {
  nothing: "#888888",
  item: "#4488ff",
  health: "#44ff88",
  gold_item: "#ffcc00",
  cursed_item: "#9933cc",
};

const REWARD_MESSAGES: Record<RewardType, string> = {
  nothing: "The shrine remains silent...",
  item: "A treasure materializes!",
  health: "Healing energy flows through you!",
  gold_item: "LEGENDARY ARTIFACT!",
  cursed_item: "A DARK POWER AWAKENS...",
};

const TIERS = [
  { cost: 50, label: "Small Offering", odds: "70% nothing / 23% item / 4% heal / 3% cursed" },
  { cost: 100, label: "Medium Offering", odds: "40% nothing / 40% item / 10% heal / 5% cursed / 5% gold" },
  { cost: 200, label: "Grand Offering", odds: "20% nothing / 50% item / 20% heal / 10% gold" },
];

const glassPanel: React.CSSProperties = {
  background: "rgba(20, 0, 40, 0.55)",
  border: "1px solid rgba(153, 51, 255, 0.3)",
  borderRadius: "12px",
  boxShadow:
    "0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(153, 51, 255, 0.1)",
  padding: "24px",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  gap: "12px",
  minWidth: "180px",
  transition: "transform 0.15s ease-out, box-shadow 0.15s ease-out",
};

export const GamblingUI: React.FC<GamblingUIProps> = ({ essence, onClose }) => {
  const [phase, setPhase] = useState<"choose" | "spinning" | "result">("choose");
  const [spinText, setSpinText] = useState("");
  const [result, setResult] = useState<RollResult | null>(null);
  const [currentBet, setCurrentBet] = useState(0);
  const [localEssence, setLocalEssence] = useState(essence);
  const spinIntervalRef = useRef<number | null>(null);

  // Sync essence from props
  useEffect(() => {
    setLocalEssence(essence);
  }, [essence]);

  const handleBet = useCallback((tier: number) => {
    if (localEssence < tier) return;

    setCurrentBet(tier);
    setPhase("spinning");

    // Spinning animation: cycle through texts rapidly
    let spinCount = 0;
    const maxSpins = 8;
    const spinDelay = 150;

    spinIntervalRef.current = window.setInterval(() => {
      setSpinText(SPIN_TEXTS[spinCount % SPIN_TEXTS.length]);
      spinCount++;

      if (spinCount >= maxSpins) {
        if (spinIntervalRef.current !== null) {
          clearInterval(spinIntervalRef.current);
          spinIntervalRef.current = null;
        }

        // Calculate result
        const rollResult = rollReward(tier);
        setResult(rollResult);
        setPhase("result");

        // Emit gambling result event
        EventBus.emit("gambling-result", {
          bet: tier,
          reward: rollResult.reward,
          rewardType: rollResult.rewardType,
        });

        // Update local essence
        setLocalEssence((prev) => prev - tier);
      }
    }, spinDelay);
  }, [localEssence]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current !== null) {
        clearInterval(spinIntervalRef.current);
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    EventBus.emit("gambling-close", {});
    onClose();
  }, [onClose]);

  const handlePlayAgain = useCallback(() => {
    setPhase("choose");
    setResult(null);
    setCurrentBet(0);
    setSpinText("");
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(10, 0, 20, 0.8)",
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
          fontSize: "48px",
          fontWeight: "bold",
          color: "#cc66ff",
          textShadow:
            "0 0 20px rgba(153, 51, 255, 0.6), 0 0 40px rgba(153, 51, 255, 0.3), 0 0 60px rgba(153, 51, 255, 0.15), 2px 2px 4px rgba(0, 0, 0, 0.9)",
          letterSpacing: "6px",
          marginBottom: "8px",
        }}
      >
        SHRINE OF FORTUNE
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: "14px",
          color: "rgba(200, 150, 255, 0.6)",
          letterSpacing: "4px",
          marginBottom: "16px",
          textTransform: "uppercase",
        }}
      >
        Risk your essence for fate's reward
      </div>

      {/* Essence display */}
      <div
        style={{
          fontSize: "20px",
          color: "#cc44ff",
          textShadow: "0 0 8px rgba(204, 68, 255, 0.5)",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "22px" }}>&#9670;</span>
        <span style={{ fontWeight: "bold" }}>{localEssence} Essence</span>
      </div>

      {/* Choose Phase: Show bet tiers */}
      {phase === "choose" && (
        <div
          style={{
            display: "flex",
            gap: "24px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {TIERS.map((tier) => {
            const canAfford = localEssence >= tier.cost;
            return (
              <div
                key={tier.cost}
                style={{
                  ...glassPanel,
                  opacity: canAfford ? 1 : 0.5,
                  cursor: canAfford ? "pointer" : "not-allowed",
                }}
                onClick={() => canAfford && handleBet(tier.cost)}
              >
                {/* Mystical icon */}
                <div
                  style={{
                    fontSize: "40px",
                    lineHeight: 1,
                    textShadow: "0 0 16px rgba(153, 51, 255, 0.5)",
                  }}
                >
                  {tier.cost === 50 ? "\u2727" : tier.cost === 100 ? "\u2726" : "\u2605"}
                </div>

                {/* Label */}
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#cc66ff",
                    textAlign: "center",
                  }}
                >
                  {tier.label}
                </div>

                {/* Cost */}
                <div
                  style={{
                    fontSize: "22px",
                    color: "#cc44ff",
                    textShadow: "0 0 6px rgba(204, 68, 255, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: "bold",
                  }}
                >
                  <span>&#9670;</span>
                  <span>{tier.cost}</span>
                </div>

                {/* Odds */}
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(200, 150, 255, 0.5)",
                    textAlign: "center",
                    lineHeight: 1.4,
                    maxWidth: "160px",
                  }}
                >
                  {tier.odds}
                </div>

                {/* Offer button */}
                <button
                  disabled={!canAfford}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canAfford) handleBet(tier.cost);
                  }}
                  style={{
                    padding: "8px 32px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    letterSpacing: "2px",
                    border: "1px solid",
                    borderColor: canAfford
                      ? "rgba(153, 51, 255, 0.5)"
                      : "rgba(100, 100, 100, 0.4)",
                    borderRadius: "6px",
                    cursor: canAfford ? "pointer" : "not-allowed",
                    color: canAfford ? "#cc66ff" : "#666",
                    background: canAfford
                      ? "rgba(153, 51, 255, 0.15)"
                      : "rgba(50, 50, 50, 0.4)",
                    textShadow: canAfford
                      ? "0 0 8px rgba(153, 51, 255, 0.4)"
                      : "none",
                    transition:
                      "background 0.2s, color 0.2s, border-color 0.2s",
                    pointerEvents: "auto",
                  }}
                >
                  OFFER
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Spinning Phase */}
      {phase === "spinning" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          {/* Spinning mystical orb */}
          <div
            style={{
              fontSize: "64px",
              animation: "gamblingPulse 0.5s ease-in-out infinite alternate",
              textShadow:
                "0 0 30px rgba(153, 51, 255, 0.8), 0 0 60px rgba(153, 51, 255, 0.4)",
            }}
          >
            &#10050;
          </div>

          {/* Spin text */}
          <div
            style={{
              fontSize: "24px",
              color: "#cc88ff",
              textShadow: "0 0 12px rgba(153, 51, 255, 0.5)",
              letterSpacing: "3px",
              minHeight: "36px",
              textAlign: "center",
            }}
          >
            {spinText}
          </div>

          {/* Bet amount */}
          <div
            style={{
              fontSize: "16px",
              color: "rgba(200, 150, 255, 0.5)",
            }}
          >
            Offering {currentBet} Essence...
          </div>
        </div>
      )}

      {/* Result Phase */}
      {phase === "result" && result && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          {/* Result icon */}
          <div
            style={{
              fontSize: "72px",
              textShadow:
                result.rewardType === "gold_item"
                  ? "0 0 30px rgba(255, 204, 0, 0.8), 0 0 60px rgba(255, 204, 0, 0.4), 0 0 90px rgba(255, 204, 0, 0.2)"
                  : result.rewardType === "health"
                    ? "0 0 30px rgba(68, 255, 136, 0.6)"
                    : result.rewardType === "cursed_item"
                      ? "0 0 30px rgba(153, 51, 204, 0.8), 0 0 60px rgba(153, 51, 204, 0.4)"
                      : result.rewardType === "item"
                        ? "0 0 30px rgba(68, 136, 255, 0.6)"
                        : "0 0 15px rgba(136, 136, 136, 0.3)",
              animation:
                result.rewardType === "gold_item"
                  ? "gamblingGlow 1s ease-in-out infinite alternate"
                  : undefined,
            }}
          >
            {result.rewardType === "nothing"
              ? "\u2620"
              : result.rewardType === "health"
                ? "\u2665"
                : result.rewardType === "gold_item"
                  ? "\u2605"
                  : result.rewardType === "cursed_item"
                    ? "\u2623"
                    : "\u25C6"}
          </div>

          {/* Result message */}
          <div
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: REWARD_COLORS[result.rewardType],
              textShadow: `0 0 16px ${REWARD_COLORS[result.rewardType]}66`,
              letterSpacing: "3px",
              textAlign: "center",
            }}
          >
            {REWARD_MESSAGES[result.rewardType]}
          </div>

          {/* Reward detail */}
          <div
            style={{
              fontSize: "18px",
              color: "rgba(200, 150, 255, 0.7)",
            }}
          >
            {result.reward}
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              marginTop: "16px",
            }}
          >
            {/* Play again button */}
            <button
              onClick={handlePlayAgain}
              disabled={localEssence < 50}
              style={{
                padding: "12px 36px",
                fontSize: "18px",
                fontWeight: "bold",
                fontFamily: "monospace",
                letterSpacing: "2px",
                border: "1px solid",
                borderColor:
                  localEssence >= 50
                    ? "rgba(153, 51, 255, 0.5)"
                    : "rgba(100, 100, 100, 0.4)",
                borderRadius: "8px",
                cursor: localEssence >= 50 ? "pointer" : "not-allowed",
                color: localEssence >= 50 ? "#cc66ff" : "#666",
                background:
                  localEssence >= 50
                    ? "rgba(153, 51, 255, 0.12)"
                    : "rgba(50, 50, 50, 0.4)",
                textShadow:
                  localEssence >= 50
                    ? "0 0 8px rgba(153, 51, 255, 0.4)"
                    : "none",
                transition: "background 0.2s, border-color 0.2s",
                pointerEvents: "auto",
              }}
            >
              TRY AGAIN
            </button>

            {/* Continue button */}
            <button
              onClick={handleClose}
              style={{
                padding: "12px 48px",
                fontSize: "18px",
                fontWeight: "bold",
                fontFamily: "monospace",
                letterSpacing: "3px",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                color: "white",
                background: "rgba(255, 255, 255, 0.08)",
                textShadow: "0 0 8px rgba(255, 255, 255, 0.3)",
                transition: "background 0.2s, border-color 0.2s",
                pointerEvents: "auto",
              }}
            >
              CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* Close button (always visible in choose phase) */}
      {phase === "choose" && (
        <button
          onClick={handleClose}
          style={{
            marginTop: "32px",
            padding: "12px 48px",
            fontSize: "20px",
            fontWeight: "bold",
            fontFamily: "monospace",
            letterSpacing: "3px",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            borderRadius: "8px",
            cursor: "pointer",
            color: "white",
            background: "rgba(255, 255, 255, 0.08)",
            textShadow: "0 0 8px rgba(255, 255, 255, 0.3)",
            transition: "background 0.2s, border-color 0.2s",
            pointerEvents: "auto",
          }}
        >
          LEAVE SHRINE
        </button>
      )}

      {/* CSS Animations */}
      <style>
        {`
          @keyframes gamblingPulse {
            0% {
              transform: scale(1) rotate(0deg);
              opacity: 0.7;
            }
            100% {
              transform: scale(1.2) rotate(15deg);
              opacity: 1;
            }
          }
          @keyframes gamblingGlow {
            0% {
              filter: brightness(1);
              transform: scale(1);
            }
            100% {
              filter: brightness(1.5);
              transform: scale(1.1);
            }
          }
        `}
      </style>
    </div>
  );
};

import React, { useState } from "react";
import { ClassMastery } from "../systems/ClassMastery";
import { CLASSES } from "../config/ClassConfig";
import type { ClassType } from "../config/ClassConfig";

// ─── Props ──────────────────────────────────────────────────────────────────

interface ClassMasteryUIProps {
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CLASS_ORDER: ClassType[] = ["PALADIN", "MONK", "PRIEST"];

/** Convert the numeric hex color from CLASSES config to a CSS hex string. */
function classColor(classType: ClassType): string {
  const num = CLASSES[classType].color;
  return `#${num.toString(16).padStart(6, "0")}`;
}

/** Format a number with commas: 1234 -> "1,234". */
function fmt(n: number): string {
  return n.toLocaleString();
}

// ─── Reward Row ─────────────────────────────────────────────────────────────

function RewardRow({
  level,
  description,
  unlocked,
  isNext,
  color,
}: {
  level: number;
  description: string;
  unlocked: boolean;
  isNext: boolean;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        background: isNext
          ? "rgba(255, 215, 0, 0.06)"
          : unlocked
            ? "rgba(255, 255, 255, 0.02)"
            : "transparent",
        borderRadius: "6px",
        border: isNext
          ? "1px solid rgba(255, 215, 0, 0.2)"
          : "1px solid rgba(255, 255, 255, 0.04)",
        opacity: unlocked || isNext ? 1 : 0.4,
        transition: "opacity 0.2s ease",
      }}
    >
      {/* Level badge */}
      <div
        style={{
          minWidth: "40px",
          textAlign: "center",
          fontSize: "14px",
          fontWeight: "bold",
          color: unlocked ? "#ffd700" : isNext ? "#ffd700" : "rgba(200, 200, 220, 0.4)",
          textShadow: unlocked ? "0 0 6px rgba(255, 215, 0, 0.3)" : "none",
        }}
      >
        Lv {level}
      </div>

      {/* Description */}
      <div
        style={{
          flex: 1,
          fontSize: "13px",
          color: unlocked
            ? "rgba(230, 230, 240, 0.9)"
            : isNext
              ? "rgba(230, 230, 240, 0.8)"
              : "rgba(200, 200, 220, 0.35)",
          lineHeight: "1.4",
        }}
      >
        {description}
      </div>

      {/* Status indicator */}
      <div style={{ minWidth: "52px", textAlign: "right" }}>
        {unlocked ? (
          <span
            style={{
              fontSize: "16px",
              color: "#44ff44",
              filter: "drop-shadow(0 0 4px rgba(68, 255, 68, 0.4))",
            }}
          >
            {"\u2713"}
          </span>
        ) : isNext ? (
          <span
            style={{
              fontSize: "10px",
              fontWeight: "bold",
              letterSpacing: "1.5px",
              color: "#ffd700",
              background: "rgba(255, 215, 0, 0.12)",
              padding: "3px 8px",
              borderRadius: "4px",
              border: "1px solid rgba(255, 215, 0, 0.25)",
            }}
          >
            NEXT
          </span>
        ) : (
          <span
            style={{
              fontSize: "14px",
              color: "rgba(200, 200, 220, 0.25)",
            }}
          >
            {"\uD83D\uDD12"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Class Panel ────────────────────────────────────────────────────────────

function ClassPanel({ classType }: { classType: ClassType }) {
  const config = CLASSES[classType];
  const color = classColor(classType);
  const level = ClassMastery.getLevel(classType);
  const progress = ClassMastery.getXPProgress(classType);
  const rewards = ClassMastery.getRewards(classType);
  const maxLevel = level >= 20;

  // Find the next reward milestone
  const nextRewardLevel = rewards.find((r) => r.level > level)?.level ?? null;

  return (
    <div
      style={{
        flex: "1 1 300px",
        minWidth: "280px",
        maxWidth: "380px",
        padding: "24px 20px",
        background: "rgba(255, 255, 255, 0.03)",
        borderRadius: "10px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        transition: "border-color 0.2s ease",
      }}
    >
      {/* Class name + level */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            color: color,
            letterSpacing: "3px",
            textTransform: "uppercase",
            textShadow: `0 0 12px ${color}40`,
          }}
        >
          {config.name}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "rgba(255, 215, 0, 0.08)",
            borderRadius: "8px",
            padding: "6px 14px",
            border: "1px solid rgba(255, 215, 0, 0.15)",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              color: "rgba(255, 215, 0, 0.6)",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Level
          </span>
          <span
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "#ffd700",
              lineHeight: "1",
              textShadow: "0 0 10px rgba(255, 215, 0, 0.3)",
            }}
          >
            {level}
          </span>
        </div>
      </div>

      {/* XP progress bar */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "rgba(200, 200, 220, 0.45)",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Experience
          </span>
          <span
            style={{
              fontSize: "13px",
              color: maxLevel ? "#ffd700" : "rgba(230, 230, 240, 0.7)",
              fontWeight: "bold",
            }}
          >
            {maxLevel ? "MAX" : `${fmt(progress.current)} / ${fmt(progress.needed)} XP`}
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: "12px",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress.percent}%`,
              height: "100%",
              background: color,
              opacity: 0.8,
              borderRadius: "6px",
              transition: "width 0.5s ease",
              boxShadow: `0 0 8px ${color}40`,
            }}
          />
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          background: "rgba(255, 255, 255, 0.06)",
        }}
      />

      {/* Milestone rewards list */}
      <div>
        <div
          style={{
            fontSize: "12px",
            color: "rgba(200, 200, 220, 0.45)",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            marginBottom: "12px",
          }}
        >
          Milestone Rewards
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            maxHeight: "340px",
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          {rewards.map((reward) => {
            const unlocked = reward.level <= level;
            const isNext = reward.level === nextRewardLevel;
            return (
              <RewardRow
                key={reward.level}
                level={reward.level}
                description={reward.description}
                unlocked={unlocked}
                isNext={isNext}
                color={color}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const ClassMasteryUI: React.FC<ClassMasteryUIProps> = ({ onClose }) => {
  const [closeHover, setCloseHover] = useState(false);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(10, 10, 18, 0.98)",
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
          maxWidth: "1200px",
          padding: "36px 40px 0",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: "44px",
            fontWeight: "bold",
            letterSpacing: "6px",
            textTransform: "uppercase",
            color: "#ffd700",
            textShadow: "0 0 20px rgba(255, 215, 0, 0.3)",
            marginBottom: "6px",
            textAlign: "center",
          }}
        >
          Class Mastery
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "rgba(200, 200, 220, 0.35)",
            textAlign: "center",
            marginBottom: "32px",
          }}
        >
          Permanent bonuses earned through dedication to each class
        </p>
      </div>

      {/* Class Panels */}
      <div
        style={{
          width: "100%",
          maxWidth: "1200px",
          padding: "0 40px",
          boxSizing: "border-box",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "20px",
          animation: "fadeIn 0.3s ease",
        }}
      >
        {CLASS_ORDER.map((cls) => (
          <ClassPanel key={cls} classType={cls} />
        ))}
      </div>

      {/* Close button */}
      <div style={{ padding: "32px 0 40px" }}>
        <button
          onClick={onClose}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          style={{
            padding: "14px 48px",
            fontSize: "18px",
            fontFamily: "monospace",
            fontWeight: "bold",
            letterSpacing: "2px",
            textTransform: "uppercase",
            background: closeHover
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(255, 255, 255, 0.06)",
            color: closeHover ? "#fff" : "rgba(200, 200, 220, 0.7)",
            border: `1px solid ${closeHover ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.1)"}`,
            borderRadius: "6px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            outline: "none",
            transform: closeHover ? "scale(1.03)" : "scale(1)",
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default ClassMasteryUI;

import React, { useState } from "react";
import { AscensionManager } from "../systems/AscensionManager";
import type { AscensionBoosts } from "../systems/AscensionManager";

interface AscensionScreenProps {
  bossNumber: number;
  onChosen: (stat: keyof AscensionBoosts) => void;
}

const STAT_LABELS: Record<keyof AscensionBoosts, string> = {
  attackDamage: "Attack Damage",
  moveSpeed: "Move Speed",
  jumpHeight: "Jump Height",
  attackSpeed: "Attack Speed",
  maxHealth: "Max Health",
};

const STAT_ORDER: Array<keyof AscensionBoosts> = [
  "attackDamage",
  "moveSpeed",
  "jumpHeight",
  "attackSpeed",
  "maxHealth",
];

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.88)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "monospace",
  color: "white",
  zIndex: 100,
};

const panelStyle: React.CSSProperties = {
  background: "rgba(10, 8, 20, 0.95)",
  border: "1px solid rgba(255, 200, 50, 0.3)",
  borderRadius: "16px",
  padding: "40px 56px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "32px",
  boxShadow:
    "0 0 60px rgba(255, 180, 30, 0.15), 0 4px 32px rgba(0, 0, 0, 0.7)",
  minWidth: "520px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "48px",
  fontWeight: "bold",
  color: "#ffd700",
  textShadow:
    "0 0 30px rgba(255, 215, 0, 0.7), 0 0 60px rgba(255, 180, 30, 0.4)",
  letterSpacing: "8px",
  textTransform: "uppercase",
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(200, 190, 160, 0.7)",
  letterSpacing: "3px",
  textTransform: "uppercase",
  marginTop: "-16px",
};

const statsListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  width: "100%",
};

function formatBoostDisplay(stat: keyof AscensionBoosts, current: number): string {
  if (stat === "maxHealth") {
    const currentBonusHp = Math.round(current / 0.02);
    return currentBonusHp > 0 ? `+${currentBonusHp} HP` : "No bonus yet";
  }
  if (current === 0) return "No bonus yet";
  return `+${Math.round(current * 100)}%`;
}

function formatNextDisplay(stat: keyof AscensionBoosts, current: number): string {
  if (stat === "maxHealth") {
    const nextBonusHp = Math.round((current + 0.02) / 0.02);
    return `+${nextBonusHp} HP`;
  }
  return `+${Math.round((current + 0.02) * 100)}%`;
}

interface StatOptionProps {
  stat: keyof AscensionBoosts;
  currentBoost: number;
  onSelect: () => void;
}

const StatOption: React.FC<StatOptionProps> = ({ stat, currentBoost, onSelect }) => {
  const [hovered, setHovered] = useState(false);

  const currentDisplay = formatBoostDisplay(stat, currentBoost);
  const nextDisplay = formatNextDisplay(stat, currentBoost);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px",
        background: hovered
          ? "rgba(255, 200, 50, 0.12)"
          : "rgba(255, 255, 255, 0.04)",
        border: hovered
          ? "1px solid rgba(255, 200, 50, 0.5)"
          : "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        transform: hovered ? "scale(1.02)" : "scale(1)",
        boxShadow: hovered
          ? "0 0 16px rgba(255, 200, 50, 0.15)"
          : "none",
      }}
    >
      {/* Stat name + current */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span
          style={{
            fontSize: "17px",
            fontWeight: "bold",
            color: hovered ? "#ffd700" : "#e8dfc0",
            letterSpacing: "1px",
            transition: "color 0.15s ease",
          }}
        >
          {STAT_LABELS[stat]}
        </span>
        <span
          style={{
            fontSize: "12px",
            color: "rgba(180, 170, 130, 0.6)",
            letterSpacing: "1px",
          }}
        >
          Current: {currentDisplay}
        </span>
      </div>

      {/* "+2%" badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: "rgba(160, 200, 255, 0.6)",
          }}
        >
          {currentBoost > 0 ? `${currentDisplay}` : ""} &rarr;{" "}
          <span
            style={{
              color: "#88ddaa",
              fontWeight: "bold",
            }}
          >
            {nextDisplay}
          </span>
        </span>
        <div
          style={{
            padding: "6px 14px",
            background: hovered
              ? "rgba(255, 200, 50, 0.25)"
              : "rgba(255, 200, 50, 0.1)",
            border: "1px solid rgba(255, 200, 50, 0.4)",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "bold",
            color: "#ffd700",
            letterSpacing: "1px",
            transition: "all 0.15s ease",
            minWidth: "48px",
            textAlign: "center",
          }}
        >
          +2%
        </div>
      </div>
    </div>
  );
};

export const AscensionScreen: React.FC<AscensionScreenProps> = ({
  bossNumber,
  onChosen,
}) => {
  const boosts = AscensionManager.getBoosts();

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <div style={titleStyle}>Ascension</div>
          <div style={subtitleStyle}>
            Boss #{bossNumber} Defeated &mdash; Choose a permanent upgrade
          </div>
        </div>

        {/* Stat options */}
        <div style={statsListStyle}>
          {STAT_ORDER.map((stat) => (
            <StatOption
              key={stat}
              stat={stat}
              currentBoost={boosts[stat]}
              onSelect={() => onChosen(stat)}
            />
          ))}
        </div>

        {/* Footer note */}
        <div
          style={{
            fontSize: "11px",
            color: "rgba(160, 150, 110, 0.5)",
            letterSpacing: "1px",
            textAlign: "center",
          }}
        >
          Permanent bonus &mdash; applies to all future runs
        </div>
      </div>
    </div>
  );
};

export default AscensionScreen;

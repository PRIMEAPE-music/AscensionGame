import React, { useState } from "react";
import { SUBCLASSES, CLASS_SUBCLASSES } from "../config/SubclassConfig";
import type { SubclassDef } from "../config/SubclassConfig";

interface SubclassSelectProps {
  classType: string;
  onSelect: (subclassId: string) => void;
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.92)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "monospace",
  color: "white",
  zIndex: 110,
  pointerEvents: "auto",
};

const panelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "32px",
  maxWidth: "900px",
  width: "90%",
};

const titleStyle: React.CSSProperties = {
  fontSize: "44px",
  fontWeight: "bold",
  color: "#ffd700",
  textShadow:
    "0 0 30px rgba(255, 215, 0, 0.7), 0 0 60px rgba(180, 100, 255, 0.4)",
  letterSpacing: "6px",
  textTransform: "uppercase",
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(200, 180, 255, 0.7)",
  letterSpacing: "3px",
  textTransform: "uppercase",
  marginTop: "-12px",
};

const cardsContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "32px",
  width: "100%",
  justifyContent: "center",
};

interface SubclassCardProps {
  subclass: SubclassDef;
  onSelect: () => void;
}

const SubclassCard: React.FC<SubclassCardProps> = ({ subclass, onSelect }) => {
  const [hovered, setHovered] = useState(false);

  const statBonusEntries = Object.entries(subclass.statBonuses);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        maxWidth: "400px",
        background: hovered
          ? "rgba(255, 200, 50, 0.08)"
          : "rgba(10, 8, 20, 0.95)",
        border: hovered
          ? "2px solid rgba(255, 200, 50, 0.6)"
          : "2px solid rgba(180, 140, 255, 0.2)",
        borderRadius: "16px",
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        transform: hovered ? "scale(1.03)" : "scale(1)",
        boxShadow: hovered
          ? "0 0 40px rgba(255, 200, 50, 0.2), 0 0 80px rgba(180, 100, 255, 0.1)"
          : "0 4px 32px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* Icon + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <span style={{ fontSize: "36px" }}>{subclass.icon}</span>
        <div>
          <div
            style={{
              fontSize: "26px",
              fontWeight: "bold",
              color: hovered ? "#ffd700" : "#e8dfc0",
              letterSpacing: "2px",
              transition: "color 0.15s ease",
            }}
          >
            {subclass.name}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "rgba(180, 140, 255, 0.6)",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            {subclass.className} Specialization
          </div>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: "13px",
          color: "rgba(200, 190, 170, 0.8)",
          lineHeight: "1.5",
        }}
      >
        {subclass.description}
      </div>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, rgba(180, 140, 255, 0.3), transparent)",
        }}
      />

      {/* Stat Bonuses */}
      {statBonusEntries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "rgba(150, 140, 120, 0.6)",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            Stat Bonuses
          </div>
          {statBonusEntries.map(([stat, value]) => (
            <div
              key={stat}
              style={{
                fontSize: "14px",
                color: "#88ddaa",
                fontWeight: "bold",
              }}
            >
              +{Math.round(value * 100)}% {formatStatName(stat)}
            </div>
          ))}
        </div>
      )}

      {/* Passive */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div
          style={{
            fontSize: "11px",
            color: "rgba(150, 140, 120, 0.6)",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          Passive Effect
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "rgba(220, 200, 160, 0.9)",
            lineHeight: "1.4",
          }}
        >
          {subclass.passiveDescription}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, rgba(255, 200, 50, 0.3), transparent)",
        }}
      />

      {/* Ability */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div
          style={{
            fontSize: "11px",
            color: "rgba(150, 140, 120, 0.6)",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          New Ability
        </div>
        <div
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: "#ffd700",
            letterSpacing: "1px",
          }}
        >
          {subclass.abilityName}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "rgba(220, 200, 160, 0.9)",
            lineHeight: "1.4",
          }}
        >
          {subclass.abilityDescription}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "rgba(150, 140, 120, 0.5)",
            marginTop: "2px",
          }}
        >
          Cooldown: {(subclass.abilityCooldown / 1000).toFixed(0)}s
        </div>
      </div>

      {/* Select button area */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "8px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "10px 32px",
            background: hovered
              ? "rgba(255, 200, 50, 0.2)"
              : "rgba(255, 200, 50, 0.08)",
            border: hovered
              ? "1px solid rgba(255, 200, 50, 0.5)"
              : "1px solid rgba(255, 200, 50, 0.2)",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "bold",
            color: hovered ? "#ffd700" : "rgba(200, 180, 100, 0.7)",
            letterSpacing: "3px",
            textTransform: "uppercase",
            transition: "all 0.15s ease",
          }}
        >
          Choose
        </div>
      </div>
    </div>
  );
};

function formatStatName(stat: string): string {
  switch (stat) {
    case "attackDamage":
      return "Attack Damage";
    case "moveSpeed":
      return "Move Speed";
    case "jumpHeight":
      return "Jump Height";
    case "attackSpeed":
      return "Attack Speed";
    case "maxHealth":
      return "Max Health";
    default:
      return stat;
  }
}

export const SubclassSelect: React.FC<SubclassSelectProps> = ({
  classType,
  onSelect,
}) => {
  const subclassPair = CLASS_SUBCLASSES[classType];
  if (!subclassPair) return null;

  const [leftId, rightId] = subclassPair;
  const leftSubclass = SUBCLASSES[leftId];
  const rightSubclass = SUBCLASSES[rightId];

  if (!leftSubclass || !rightSubclass) return null;

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <div style={titleStyle}>Specialization</div>
          <div style={subtitleStyle}>
            Choose your path forward
          </div>
        </div>

        {/* Cards */}
        <div style={cardsContainerStyle}>
          <SubclassCard
            subclass={leftSubclass}
            onSelect={() => onSelect(leftId)}
          />
          <SubclassCard
            subclass={rightSubclass}
            onSelect={() => onSelect(rightId)}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            fontSize: "11px",
            color: "rgba(160, 150, 110, 0.4)",
            letterSpacing: "1px",
            textAlign: "center",
          }}
        >
          This choice is permanent for the rest of the run
        </div>
      </div>
    </div>
  );
};

export default SubclassSelect;

import React, { useState } from "react";
import { ClassType, CLASSES } from "../config/ClassConfig";
import type { ClassType as ClassTypeT } from "../config/ClassConfig";

interface ClassSelectProps {
  onSelect: (classType: ClassTypeT) => void;
}

const CLASS_DESCRIPTIONS: Record<ClassTypeT, string> = {
  [ClassType.PALADIN]:
    "A holy warrior clad in divine armor. Slow but devastating, the Paladin trades agility for raw power and resilience.",
  [ClassType.MONK]:
    "A swift martial artist who strikes like lightning. Fragile but blindingly fast, the Monk dances through danger.",
  [ClassType.PRIEST]:
    "A balanced caster touched by celestial light. The Priest offers a well-rounded approach to the ascent.",
};

const STAT_LABELS: {
  key: string;
  label: string;
  format: (v: number) => string;
}[] = [
  { key: "health", label: "HP", format: (v) => `${v}` },
  {
    key: "moveSpeed",
    label: "Speed",
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "jumpHeight",
    label: "Jump",
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "attackDamage",
    label: "Attack",
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "attackSpeed",
    label: "Atk Speed",
    format: (v) => `${Math.round((1 / v) * 100)}%`,
  },
];

export const ClassSelect: React.FC<ClassSelectProps> = ({ onSelect }) => {
  const [selected, setSelected] = useState<ClassTypeT | null>(null);

  const classTypes = Object.keys(CLASSES) as ClassTypeT[];

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
        justifyContent: "center",
        fontFamily: "monospace",
        color: "white",
        zIndex: 100,
      }}
    >
      <h1
        style={{
          fontSize: "48px",
          fontWeight: "bold",
          marginBottom: "8px",
          letterSpacing: "4px",
          textTransform: "uppercase",
          color: "#e0d0a0",
          textShadow: "0 0 20px rgba(224, 208, 160, 0.3)",
        }}
      >
        Choose Your Class
      </h1>
      <p
        style={{
          fontSize: "16px",
          color: "#888",
          marginBottom: "40px",
        }}
      >
        Select a class to begin your ascent
      </p>

      <div
        style={{
          display: "flex",
          gap: "24px",
          marginBottom: "40px",
        }}
      >
        {classTypes.map((ct) => {
          const stats = CLASSES[ct];
          const isSelected = selected === ct;
          const color = "#" + stats.color.toString(16).padStart(6, "0");

          return (
            <div
              key={ct}
              onClick={() => setSelected(ct)}
              style={{
                width: "260px",
                padding: "24px",
                backgroundColor: isSelected
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.03)",
                border: `2px solid ${isSelected ? color : "#333"}`,
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: isSelected ? `0 0 20px ${color}40` : "none",
                pointerEvents: "auto",
              }}
            >
              {/* Class icon placeholder */}
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: color,
                  borderRadius: "4px",
                  margin: "0 auto 16px",
                  boxShadow: `0 0 10px ${color}60`,
                }}
              />

              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  textAlign: "center",
                  marginBottom: "8px",
                  color: isSelected ? color : "#ddd",
                }}
              >
                {stats.name}
              </h2>

              <p
                style={{
                  fontSize: "12px",
                  color: "#999",
                  textAlign: "center",
                  lineHeight: "1.4",
                  marginBottom: "16px",
                  minHeight: "50px",
                }}
              >
                {CLASS_DESCRIPTIONS[ct]}
              </p>

              {/* Stats */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {STAT_LABELS.map(({ key, label, format }) => {
                  const value = (stats as any)[key] as number;
                  const barWidth =
                    key === "health"
                      ? (value / 5) * 100
                      : key === "attackSpeed"
                        ? (1 / value / 2) * 100
                        : (value / 1.5) * 100;

                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#aaa",
                          width: "70px",
                          textAlign: "right",
                        }}
                      >
                        {label}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          backgroundColor: "#222",
                          borderRadius: "3px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, barWidth)}%`,
                            height: "100%",
                            backgroundColor: isSelected ? color : "#555",
                            transition: "all 0.2s",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#aaa",
                          width: "40px",
                        }}
                      >
                        {format(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => {
          if (selected) onSelect(selected);
        }}
        disabled={!selected}
        style={{
          padding: "14px 48px",
          fontSize: "20px",
          fontFamily: "monospace",
          fontWeight: "bold",
          letterSpacing: "2px",
          textTransform: "uppercase",
          backgroundColor: selected ? "#e0d0a0" : "#333",
          color: selected ? "#0a0a12" : "#666",
          border: "none",
          borderRadius: "4px",
          cursor: selected ? "pointer" : "default",
          transition: "all 0.2s",
          pointerEvents: "auto",
          boxShadow: selected ? "0 0 20px rgba(224, 208, 160, 0.3)" : "none",
        }}
      >
        Start Run
      </button>
    </div>
  );
};

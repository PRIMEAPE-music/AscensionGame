import React, { useState } from "react";
import { RUN_MODIFIERS } from "../config/RunModifiers";

interface RunModifierSelectProps {
  onConfirm: (selectedModifiers: string[]) => void;
}

export const RunModifierSelect: React.FC<RunModifierSelectProps> = ({
  onConfirm,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleModifier = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
        Run Modifiers
      </h1>
      <p
        style={{
          fontSize: "16px",
          color: "#888",
          marginBottom: "40px",
        }}
      >
        Select difficulty modifiers for bonus rewards
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          justifyContent: "center",
          marginBottom: "40px",
          maxWidth: "900px",
        }}
      >
        {RUN_MODIFIERS.map((mod) => {
          const isSelected = selected.has(mod.id);

          return (
            <div
              key={mod.id}
              onClick={() => toggleModifier(mod.id)}
              style={{
                width: "240px",
                padding: "20px",
                backgroundColor: isSelected
                  ? "rgba(224, 208, 160, 0.08)"
                  : "rgba(255, 255, 255, 0.03)",
                border: `2px solid ${isSelected ? "#e0d0a0" : "#333"}`,
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: isSelected
                  ? "0 0 20px rgba(224, 208, 160, 0.25)"
                  : "none",
                pointerEvents: "auto",
              }}
            >
              <div
                style={{
                  fontSize: "36px",
                  textAlign: "center",
                  marginBottom: "12px",
                }}
              >
                {mod.icon}
              </div>

              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  textAlign: "center",
                  marginBottom: "8px",
                  color: isSelected ? "#e0d0a0" : "#ddd",
                }}
              >
                {mod.name}
              </h2>

              <p
                style={{
                  fontSize: "12px",
                  color: "#999",
                  textAlign: "center",
                  lineHeight: "1.5",
                  marginBottom: "14px",
                  minHeight: "36px",
                }}
              >
                {mod.description}
              </p>

              <div
                style={{
                  fontSize: "11px",
                  color: isSelected ? "#a0d0a0" : "#6a6a6a",
                  textAlign: "center",
                  padding: "6px 8px",
                  backgroundColor: isSelected
                    ? "rgba(160, 208, 160, 0.08)"
                    : "rgba(255, 255, 255, 0.02)",
                  borderRadius: "4px",
                  border: `1px solid ${isSelected ? "rgba(160, 208, 160, 0.2)" : "transparent"}`,
                  transition: "all 0.2s ease",
                }}
              >
                Reward: {mod.reward}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <button
          onClick={() => onConfirm(Array.from(selected))}
          style={{
            padding: "14px 48px",
            fontSize: "20px",
            fontFamily: "monospace",
            fontWeight: "bold",
            letterSpacing: "2px",
            textTransform: "uppercase",
            backgroundColor:
              selected.size > 0 ? "#e0d0a0" : "rgba(224, 208, 160, 0.7)",
            color: "#0a0a12",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            transition: "all 0.2s",
            pointerEvents: "auto",
            boxShadow:
              selected.size > 0
                ? "0 0 20px rgba(224, 208, 160, 0.3)"
                : "none",
          }}
        >
          {selected.size > 0
            ? `Start Run (${selected.size} modifier${selected.size > 1 ? "s" : ""})`
            : "Start Run"}
        </button>

        <span
          onClick={() => onConfirm([])}
          style={{
            fontSize: "14px",
            color: "#666",
            cursor: "pointer",
            transition: "color 0.2s",
            pointerEvents: "auto",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#999")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
        >
          Skip — start without modifiers
        </span>
      </div>
    </div>
  );
};

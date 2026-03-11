import React from "react";

interface BossHealthBarProps {
  bossName: string;
  health: number;
  maxHealth: number;
  phase: number;
}

const PHASE_COLORS: Record<number, string> = {
  1: "#cc2222",
  2: "#dd8822",
  3: "#ddcc22",
};

export const BossHealthBar: React.FC<BossHealthBarProps> = ({
  bossName,
  health,
  maxHealth,
  phase,
}) => {
  const healthPercentage = Math.max(0, (health / maxHealth) * 100);
  const barColor = PHASE_COLORS[phase] || PHASE_COLORS[1];

  return (
    <div
      style={{
        position: "absolute",
        top: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "60%",
        maxWidth: "800px",
        zIndex: 15,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      {/* Boss Name */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "20px",
          fontWeight: "bold",
          color: "#ff4444",
          textShadow:
            "0 0 10px rgba(255, 68, 68, 0.6), 1px 1px 3px rgba(0, 0, 0, 0.9)",
          letterSpacing: "3px",
          textTransform: "uppercase",
        }}
      >
        {bossName}
      </div>

      {/* Health Bar Container */}
      <div
        style={{
          width: "100%",
          height: "24px",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "4px",
          overflow: "hidden",
          position: "relative",
          boxShadow:
            "0 2px 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* Health Fill */}
        <div
          style={{
            width: `${healthPercentage}%`,
            height: "100%",
            background: `linear-gradient(to bottom, ${barColor}, ${barColor}88)`,
            transition: "width 0.3s ease-out",
            boxShadow: `0 0 12px ${barColor}66, inset 0 1px 2px rgba(255, 255, 255, 0.2)`,
            position: "relative",
          }}
        >
          {/* Specular highlight on fill */}
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: "4px",
              right: "4px",
              height: "4px",
              background:
                "linear-gradient(to right, rgba(255,255,255,0.05), rgba(255,255,255,0.2), rgba(255,255,255,0.05))",
              borderRadius: "2px",
            }}
          />
        </div>

        {/* Phase divider at 66% */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "66.66%",
            width: "2px",
            height: "100%",
            backgroundColor: "rgba(255, 255, 255, 0.25)",
            zIndex: 1,
          }}
        />

        {/* Phase divider at 33% */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "33.33%",
            width: "2px",
            height: "100%",
            backgroundColor: "rgba(255, 255, 255, 0.25)",
            zIndex: 1,
          }}
        />
      </div>
    </div>
  );
};

export default BossHealthBar;

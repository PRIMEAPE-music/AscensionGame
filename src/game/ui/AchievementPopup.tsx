import React, { useState, useEffect } from "react";

export interface AchievementPopupProps {
  achievement: { name: string; description: string; icon: string } | null;
  onDone: () => void;
}

const DISPLAY_DURATION = 3000; // ms before auto-dismiss
const ANIMATION_DURATION = 400; // ms for slide in/out

export const AchievementPopup: React.FC<AchievementPopupProps> = ({
  achievement,
  onDone,
}) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!achievement) return;

    // Slide in
    const showTimer = setTimeout(() => setVisible(true), 50);

    // Start exit animation
    const exitTimer = setTimeout(() => {
      setExiting(true);
      setVisible(false);
    }, DISPLAY_DURATION);

    // Call onDone after exit animation completes
    const doneTimer = setTimeout(() => {
      setExiting(false);
      onDone();
    }, DISPLAY_DURATION + ANIMATION_DURATION);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [achievement, onDone]);

  if (!achievement) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: visible && !exiting ? "20px" : "-120px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        transition: `top ${ANIMATION_DURATION}ms ease-out`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "16px 28px",
          background: "rgba(10, 10, 18, 0.95)",
          border: "2px solid #ffd700",
          borderRadius: "12px",
          boxShadow:
            "0 0 20px rgba(255, 215, 0, 0.3), 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          fontFamily: "monospace",
          whiteSpace: "nowrap",
        }}
      >
        {/* Icon */}
        <div
          style={{
            fontSize: "36px",
            lineHeight: 1,
            filter: "drop-shadow(0 0 6px rgba(255, 215, 0, 0.5))",
          }}
        >
          {achievement.icon}
        </div>

        {/* Text */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              color: "#ffd700",
              textTransform: "uppercase",
              letterSpacing: "3px",
            }}
          >
            Achievement Unlocked
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "#e0d0a0",
              textShadow: "0 0 8px rgba(224, 208, 160, 0.3)",
            }}
          >
            {achievement.name}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "rgba(200, 200, 220, 0.7)",
            }}
          >
            {achievement.description}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AchievementPopup;

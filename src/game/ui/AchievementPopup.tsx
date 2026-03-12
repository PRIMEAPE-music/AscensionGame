import React, { useState, useEffect, useCallback, useRef } from "react";
import { EventBus } from "../systems/EventBus";

export interface AchievementPopupProps {
  /** Legacy prop: directly pass an achievement to show */
  achievement?: { name: string; description: string; icon: string } | null;
  /** Legacy prop: called when the current achievement display finishes */
  onDone?: () => void;
}

interface QueuedAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const DISPLAY_DURATION = 4000; // ms before auto-dismiss
const ANIMATION_DURATION = 500; // ms for slide in/out
const STAGGER_OFFSET = 80; // px between stacked notifications

// Shimmer keyframes as a style string injected once
const SHIMMER_STYLE_ID = "achievement-shimmer-keyframes";

function ensureShimmerStyle() {
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes achievement-shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes achievement-glow-pulse {
      0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.3), 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05); }
      50% { box-shadow: 0 0 35px rgba(255, 215, 0, 0.5), 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1); }
    }
  `;
  document.head.appendChild(style);
}

/** A single toast notification for one achievement. */
const AchievementToast: React.FC<{
  achievement: QueuedAchievement;
  index: number;
  onDone: (id: string) => void;
}> = ({ achievement, index, onDone }) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    ensureShimmerStyle();

    // Slide in
    const showTimer = setTimeout(() => setVisible(true), 50);

    // Start exit animation
    const exitTimer = setTimeout(() => {
      setExiting(true);
      setVisible(false);
    }, DISPLAY_DURATION);

    // Call onDone after exit animation completes
    const doneTimer = setTimeout(() => {
      onDone(achievement.id);
    }, DISPLAY_DURATION + ANIMATION_DURATION);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [achievement.id, onDone]);

  const topOffset = 20 + index * STAGGER_OFFSET;

  return (
    <div
      style={{
        position: "absolute",
        top: visible && !exiting ? `${topOffset}px` : "-120px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200 + index,
        transition: `top ${ANIMATION_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "16px 28px",
          background:
            "linear-gradient(135deg, rgba(10, 10, 18, 0.97) 0%, rgba(30, 25, 10, 0.97) 100%)",
          border: "2px solid #ffd700",
          borderRadius: "12px",
          borderImage:
            "linear-gradient(90deg, #ffd700, #fff5cc, #ffd700) 1",
          boxShadow:
            "0 0 20px rgba(255, 215, 0, 0.3), 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          animation: "achievement-glow-pulse 2s ease-in-out infinite",
          fontFamily: "monospace",
          whiteSpace: "nowrap",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Shimmer overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.08) 45%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 215, 0, 0.08) 55%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "achievement-shimmer 3s linear infinite",
            pointerEvents: "none",
            borderRadius: "10px",
          }}
        />

        {/* Icon */}
        <div
          style={{
            fontSize: "36px",
            lineHeight: 1,
            filter: "drop-shadow(0 0 8px rgba(255, 215, 0, 0.6))",
            position: "relative",
            zIndex: 1,
          }}
        >
          {achievement.icon}
        </div>

        {/* Text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              color: "#ffd700",
              textTransform: "uppercase",
              letterSpacing: "3px",
              textShadow: "0 0 10px rgba(255, 215, 0, 0.5)",
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

/**
 * Achievement popup manager.
 * Listens for "achievement-unlocked" events from the EventBus and also
 * accepts the legacy `achievement` prop for backwards compatibility.
 * Can stack multiple notifications simultaneously.
 */
export const AchievementPopup: React.FC<AchievementPopupProps> = ({
  achievement: legacyAchievement,
  onDone: legacyOnDone,
}) => {
  const [activeToasts, setActiveToasts] = useState<QueuedAchievement[]>([]);
  const nextIdRef = useRef(0);

  // Listen for EventBus achievement-unlocked events
  useEffect(() => {
    const unsub = EventBus.on("achievement-unlocked", (data) => {
      const toast: QueuedAchievement = {
        id: `${data.id}-${nextIdRef.current++}`,
        name: data.name,
        description: data.description,
        icon: data.icon,
      };
      setActiveToasts((prev) => [...prev, toast]);
    });
    return unsub;
  }, []);

  // Handle legacy prop-based achievement display
  useEffect(() => {
    if (!legacyAchievement) return;

    const toast: QueuedAchievement = {
      id: `legacy-${nextIdRef.current++}`,
      name: legacyAchievement.name,
      description: legacyAchievement.description,
      icon: legacyAchievement.icon,
    };
    setActiveToasts((prev) => [...prev, toast]);
  }, [legacyAchievement]);

  const handleToastDone = useCallback(
    (id: string) => {
      setActiveToasts((prev) => prev.filter((t) => t.id !== id));
      // Call legacy onDone if it was a legacy-triggered toast
      if (id.startsWith("legacy-") && legacyOnDone) {
        legacyOnDone();
      }
    },
    [legacyOnDone],
  );

  if (activeToasts.length === 0) return null;

  return (
    <>
      {activeToasts.map((toast, index) => (
        <AchievementToast
          key={toast.id}
          achievement={toast}
          index={index}
          onDone={handleToastDone}
        />
      ))}
    </>
  );
};

export default AchievementPopup;

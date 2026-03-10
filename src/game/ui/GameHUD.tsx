import React from "react";
import { InventoryUI } from "./InventoryUI";
import type { ItemData } from "../config/ItemConfig";

interface GameHUDProps {
  health: number;
  maxHealth: number;
  altitude: number;
  inventory: ItemData[];
  className?: string;
  styleMeter: number;
  styleTier: string;
}

const TIER_COLORS: Record<string, string> = {
  D: "#666",
  C: "#4488ff",
  B: "#44ff44",
  A: "#ffcc00",
  S: "#ff4444",
};

const glassStyle: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.25)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
};

// Bubble config: x%, size, duration, delay
const BUBBLES = [
  { left: "12%", size: 5, duration: 3.2, delay: 0 },
  { left: "30%", size: 4, duration: 3.8, delay: 0.8 },
  { left: "52%", size: 6, duration: 3.0, delay: 1.6 },
  { left: "70%", size: 3, duration: 4.2, delay: 0.4 },
  { left: "85%", size: 5, duration: 3.5, delay: 2.0 },
  { left: "20%", size: 3, duration: 4.0, delay: 2.8 },
  { left: "42%", size: 4, duration: 3.6, delay: 1.2 },
  { left: "65%", size: 5, duration: 3.3, delay: 3.2 },
  { left: "90%", size: 3, duration: 4.4, delay: 0.6 },
  { left: "8%", size: 4, duration: 3.9, delay: 2.4 },
];

export const GameHUD: React.FC<GameHUDProps> = ({
  health,
  maxHealth,
  altitude,
  inventory,
  className = "Monk",
  styleMeter,
  styleTier,
}) => {
  const healthPercentage = (health / maxHealth) * 100;
  const tierColor = TIER_COLORS[styleTier] || "#666";

  return (
    <>
      {/* Top Bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          padding: "10px 16px",
          pointerEvents: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          fontFamily: "monospace",
          color: "white",
          textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
          zIndex: 10,
        }}
      >
        {/* Left: Health */}
        <div
          style={{
            ...glassStyle,
            padding: "12px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            minWidth: "240px",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: "bold", letterSpacing: "1px" }}>
            HP: {health} / {maxHealth}
          </div>

          {/* Health Bar */}
          <div
            style={{
              width: "210px",
              height: "22px",
              backgroundColor: "rgba(20, 0, 0, 0.6)",
              border: "1px solid rgba(180, 40, 40, 0.5)",
              borderRadius: "6px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Blood red gradient fill */}
            <div
              style={{
                width: `${healthPercentage}%`,
                height: "100%",
                background: "linear-gradient(to right, #4a0000, #8b0000, #cc1a1a, #e63939)",
                transition: "width 0.3s ease-in-out",
                position: "relative",
                borderRadius: "5px",
                boxShadow: "inset 0 1px 2px rgba(255,150,150,0.3), inset 0 -2px 4px rgba(0,0,0,0.4)",
              }}
            >
              {/* Specular highlight */}
              <div
                style={{
                  position: "absolute",
                  top: "2px",
                  left: "4px",
                  right: "4px",
                  height: "5px",
                  background: "linear-gradient(to right, rgba(255,180,180,0.05), rgba(255,180,180,0.25), rgba(255,180,180,0.05))",
                  borderRadius: "3px",
                }}
              />
              {/* Bubbles */}
              {BUBBLES.map((b, i) => (
                <div
                  key={i}
                  className="health-bubble"
                  style={{
                    left: b.left,
                    bottom: 0,
                    width: `${b.size}px`,
                    height: `${b.size}px`,
                    animationDuration: `${b.duration}s`,
                    animationDelay: `${b.delay}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ fontSize: "13px", color: "rgba(200, 200, 220, 0.7)" }}>
            {className}
          </div>
        </div>

        {/* Right: Altitude + Style */}
        <div
          style={{
            ...glassStyle,
            padding: "12px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignItems: "flex-end",
            minWidth: "200px",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: "bold", letterSpacing: "1px" }}>
            {Math.floor(altitude)}m
          </div>

          {/* Style Meter */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: tierColor,
                minWidth: "24px",
                textAlign: "center",
              }}
            >
              {styleTier}
            </div>
            <div
              style={{
                width: "110px",
                height: "14px",
                backgroundColor: "rgba(0,0,0,0.4)",
                border: `1px solid ${tierColor}44`,
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${styleMeter}%`,
                  height: "100%",
                  backgroundColor: tierColor,
                  transition: "width 0.15s ease-out, background-color 0.3s",
                  boxShadow: `0 0 8px ${tierColor}66`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          padding: "10px 16px",
          pointerEvents: "none",
          display: "flex",
          justifyContent: "center",
          fontFamily: "monospace",
          color: "white",
          textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
          zIndex: 10,
        }}
      >
        <div
          style={{
            ...glassStyle,
            padding: "8px 18px",
            pointerEvents: "auto",
          }}
        >
          <InventoryUI items={inventory} />
        </div>
      </div>
    </>
  );
};

export default GameHUD;

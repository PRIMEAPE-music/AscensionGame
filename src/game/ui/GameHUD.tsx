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
  const healthColor = healthPercentage > 30 ? "#4caf50" : "#f44336";
  const tierColor = TIER_COLORS[styleTier] || "#666";

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        padding: "20px",
        pointerEvents: "none",
        display: "flex",
        justifyContent: "space-between",
        fontFamily: "monospace",
        color: "white",
        textShadow: "2px 2px 0 #000",
      }}
    >
      {/* Health Section */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <div style={{ fontSize: "24px", fontWeight: "bold" }}>
          HP: {health} / {maxHealth}
        </div>
        <div
          style={{
            width: "200px",
            height: "20px",
            backgroundColor: "#333",
            border: "2px solid #fff",
            borderRadius: "4px",
          }}
        >
          <div
            style={{
              width: `${healthPercentage}%`,
              height: "100%",
              backgroundColor: healthColor,
              transition: "width 0.2s ease-in-out, background-color 0.2s",
            }}
          />
        </div>
        <div style={{ fontSize: "18px", color: "#aaa" }}>
          Class: {className}
        </div>
        <InventoryUI items={inventory} />
      </div>

      {/* Right Side: Altitude + Style */}
      <div
        style={{
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: "bold" }}>
          ALTITUDE: {Math.floor(altitude)}m
        </div>

        {/* Style Meter */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: tierColor,
              minWidth: "30px",
              textAlign: "center",
            }}
          >
            {styleTier}
          </div>
          <div
            style={{
              width: "120px",
              height: "16px",
              backgroundColor: "#222",
              border: `2px solid ${tierColor}`,
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${styleMeter}%`,
                height: "100%",
                backgroundColor: tierColor,
                transition: "width 0.15s ease-out, background-color 0.3s",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameHUD;

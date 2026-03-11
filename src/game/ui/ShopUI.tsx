import React, { useState } from "react";
import type { ShopOffering } from "../systems/EventBus";

interface ShopUIProps {
  offerings: ShopOffering[];
  essence: number;
  onPurchase: (offering: ShopOffering) => void;
  onClose: () => void;
}

const glassPanel: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.45)",
  border: "1px solid rgba(255, 204, 0, 0.25)",
  borderRadius: "12px",
  boxShadow:
    "0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 204, 0, 0.08)",
  padding: "24px",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  gap: "12px",
  minWidth: "200px",
  transition: "transform 0.15s ease-out, box-shadow 0.15s ease-out",
};

export const ShopUI: React.FC<ShopUIProps> = ({
  offerings,
  essence,
  onPurchase,
  onClose,
}) => {
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);

  const handleBuy = (offering: ShopOffering) => {
    if (essence < offering.cost) return;
    if (purchasedIds.has(offering.id)) return;

    onPurchase(offering);
    setPurchasedIds((prev) => new Set(prev).add(offering.id));
    setFlashId(offering.id);
    setTimeout(() => setFlashId(null), 400);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        fontFamily: "monospace",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: "48px",
          fontWeight: "bold",
          color: "#ffcc00",
          textShadow:
            "0 0 20px rgba(255, 204, 0, 0.6), 0 0 40px rgba(255, 204, 0, 0.3), 2px 2px 4px rgba(0, 0, 0, 0.9)",
          letterSpacing: "8px",
          marginBottom: "12px",
        }}
      >
        DEMON SHOP
      </div>

      {/* Essence display */}
      <div
        style={{
          fontSize: "20px",
          color: "#cc44ff",
          textShadow: "0 0 8px rgba(204, 68, 255, 0.5)",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "22px" }}>&#9670;</span>
        <span style={{ fontWeight: "bold" }}>{essence} Essence</span>
      </div>

      {/* Offerings grid */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {offerings.map((offering) => {
          const canAfford = essence >= offering.cost;
          const wasPurchased = purchasedIds.has(offering.id);
          const isFlashing = flashId === offering.id;

          return (
            <div
              key={offering.id}
              style={{
                ...glassPanel,
                transform: isFlashing ? "scale(1.08)" : "scale(1)",
                boxShadow: isFlashing
                  ? "0 0 30px rgba(255, 204, 0, 0.6), inset 0 1px 0 rgba(255, 204, 0, 0.15)"
                  : glassPanel.boxShadow,
                opacity: wasPurchased ? 0.5 : 1,
              }}
            >
              {/* Icon */}
              <div
                style={{
                  fontSize: "48px",
                  lineHeight: 1,
                  textShadow: "0 0 12px rgba(255, 204, 0, 0.4)",
                }}
              >
                {offering.icon}
              </div>

              {/* Name */}
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#ffcc00",
                  textAlign: "center",
                }}
              >
                {offering.name}
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: "14px",
                  color: "rgba(255, 255, 255, 0.7)",
                  textAlign: "center",
                  minHeight: "36px",
                }}
              >
                {offering.description}
              </div>

              {/* Cost */}
              <div
                style={{
                  fontSize: "16px",
                  color: "#cc44ff",
                  textShadow: "0 0 6px rgba(204, 68, 255, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>&#9670;</span>
                <span style={{ fontWeight: "bold" }}>{offering.cost}</span>
              </div>

              {/* Buy button */}
              <button
                onClick={() => handleBuy(offering)}
                disabled={!canAfford || wasPurchased}
                style={{
                  padding: "8px 32px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  fontFamily: "monospace",
                  letterSpacing: "2px",
                  border: "1px solid",
                  borderColor:
                    wasPurchased
                      ? "rgba(100, 100, 100, 0.4)"
                      : canAfford
                        ? "rgba(255, 204, 0, 0.5)"
                        : "rgba(100, 100, 100, 0.4)",
                  borderRadius: "6px",
                  cursor:
                    canAfford && !wasPurchased ? "pointer" : "not-allowed",
                  color:
                    wasPurchased
                      ? "#666"
                      : canAfford
                        ? "#ffcc00"
                        : "#666",
                  background:
                    wasPurchased
                      ? "rgba(50, 50, 50, 0.4)"
                      : canAfford
                        ? "rgba(255, 204, 0, 0.12)"
                        : "rgba(50, 50, 50, 0.4)",
                  textShadow:
                    canAfford && !wasPurchased
                      ? "0 0 8px rgba(255, 204, 0, 0.4)"
                      : "none",
                  transition:
                    "background 0.2s, color 0.2s, border-color 0.2s",
                  pointerEvents: "auto",
                }}
              >
                {wasPurchased ? "SOLD" : "BUY"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Continue button */}
      <button
        onClick={onClose}
        style={{
          marginTop: "32px",
          padding: "12px 48px",
          fontSize: "20px",
          fontWeight: "bold",
          fontFamily: "monospace",
          letterSpacing: "3px",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          borderRadius: "8px",
          cursor: "pointer",
          color: "white",
          background: "rgba(255, 255, 255, 0.08)",
          textShadow: "0 0 8px rgba(255, 255, 255, 0.3)",
          transition: "background 0.2s, border-color 0.2s",
          pointerEvents: "auto",
        }}
      >
        CONTINUE
      </button>
    </div>
  );
};

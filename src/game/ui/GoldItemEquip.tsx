import React, { useState, useEffect } from "react";
import { GoldItemCollection } from "../systems/GoldItemCollection";
import { ITEMS } from "../config/ItemDatabase";

interface GoldItemEquipProps {
  onConfirm: (equippedItemIds: string[]) => void;
}

export const GoldItemEquip: React.FC<GoldItemEquipProps> = ({ onConfirm }) => {
  const [equipped, setEquipped] = useState<string[]>([]);
  const [unlocked, setUnlocked] = useState<string[]>([]);

  useEffect(() => {
    GoldItemCollection.load();
    setUnlocked(GoldItemCollection.getUnlocked());
    setEquipped(GoldItemCollection.getEquipped());
  }, []);

  const handleToggle = (itemId: string) => {
    const equippedCount = equipped.filter(id => id === itemId).length;

    if (equippedCount > 0) {
      // Already equipped at least once — check if we should stack or unequip
      const item = ITEMS[itemId];
      const ownedCount = GoldItemCollection.getOwnedCount(itemId);

      if (
        item?.stackable &&
        ownedCount >= 2 &&
        equippedCount === 1 &&
        equipped.length < 2
      ) {
        // Equip second copy (stack)
        GoldItemCollection.equip(itemId);
        setEquipped(GoldItemCollection.getEquipped());
      } else {
        // Unequip one copy
        GoldItemCollection.unequip(itemId);
        setEquipped(GoldItemCollection.getEquipped());
      }
    } else {
      if (equipped.length >= 2) return;
      GoldItemCollection.equip(itemId);
      setEquipped(GoldItemCollection.getEquipped());
    }
  };

  const handleConfirm = () => {
    onConfirm(equipped);
  };

  const isEmpty = unlocked.length === 0;

  // Check if both equipped slots have the same item (stacked)
  const isStacked = equipped.length === 2 && equipped[0] === equipped[1];
  const stackedItem = isStacked ? ITEMS[equipped[0]] : null;

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
          marginBottom: "4px",
          letterSpacing: "4px",
          textTransform: "uppercase",
          color: "#ffd700",
          textShadow: "0 0 20px rgba(255, 215, 0, 0.3)",
        }}
      >
        Equip Gold Items
      </h1>
      <p
        style={{
          fontSize: "16px",
          color: "#aaa",
          marginBottom: isStacked ? "12px" : "40px",
        }}
      >
        (Choose up to 2)
      </p>

      {/* Stacked effect banner */}
      {isStacked && stackedItem && (
        <div
          style={{
            padding: "10px 24px",
            marginBottom: "24px",
            backgroundColor: "rgba(255, 140, 0, 0.12)",
            border: "1px solid #ff8c00",
            borderRadius: "6px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              color: "#ff8c00",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            STACKED
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "#ffbb44",
              marginLeft: "10px",
            }}
          >
            {stackedItem.stackDescription}
          </span>
        </div>
      )}

      {isEmpty ? (
        <div
          style={{
            padding: "40px 60px",
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid #333",
            borderRadius: "8px",
            textAlign: "center",
            maxWidth: "500px",
            marginBottom: "40px",
          }}
        >
          <p
            style={{
              fontSize: "16px",
              color: "#888",
              lineHeight: "1.6",
            }}
          >
            No gold items unlocked yet. Defeat every 3rd boss to earn gold
            items!
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            maxWidth: "900px",
            width: "100%",
            padding: "0 40px",
            marginBottom: "40px",
            boxSizing: "border-box",
          }}
        >
          {unlocked.map((itemId) => {
            const item = ITEMS[itemId];
            if (!item) return null;
            const equippedCount = equipped.filter(id => id === itemId).length;
            const isEquipped = equippedCount > 0;
            const ownedCount = GoldItemCollection.getOwnedCount(itemId);
            const canStack = item.stackable && ownedCount >= 2;
            const isDoubleEquipped = equippedCount === 2;
            const hexColor =
              "#" + item.iconColor.toString(16).padStart(6, "0");

            // Determine if clickable
            const canClick = isEquipped || equipped.length < 2;

            return (
              <div
                key={itemId}
                onClick={() => handleToggle(itemId)}
                style={{
                  padding: "20px",
                  position: "relative",
                  backgroundColor: isEquipped
                    ? isDoubleEquipped
                      ? "rgba(255, 140, 0, 0.10)"
                      : "rgba(255, 215, 0, 0.08)"
                    : "rgba(255,255,255,0.03)",
                  border: `2px solid ${isDoubleEquipped ? "#ff8c00" : isEquipped ? "#ffd700" : "#444"}`,
                  borderRadius: "8px",
                  cursor: canClick ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                  boxShadow: isDoubleEquipped
                    ? "0 0 24px rgba(255, 140, 0, 0.35), inset 0 0 15px rgba(255, 140, 0, 0.08)"
                    : isEquipped
                      ? "0 0 20px rgba(255, 215, 0, 0.25), inset 0 0 15px rgba(255, 215, 0, 0.05)"
                      : "none",
                  opacity:
                    !isEquipped && equipped.length >= 2 ? 0.5 : 1,
                  pointerEvents: "auto",
                }}
              >
                {/* Stackable badge */}
                {canStack && (
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      fontSize: "9px",
                      fontWeight: "bold",
                      color: "#ff8c00",
                      backgroundColor: "rgba(255, 140, 0, 0.15)",
                      border: "1px solid rgba(255, 140, 0, 0.3)",
                      borderRadius: "3px",
                      padding: "2px 5px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    STACKABLE
                  </div>
                )}

                {/* Owned count badge for stackable items with 2+ copies */}
                {canStack && (
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      left: "6px",
                      fontSize: "9px",
                      color: "#aaa",
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderRadius: "3px",
                      padding: "2px 5px",
                    }}
                  >
                    x{ownedCount}
                  </div>
                )}

                {/* Color swatch icon */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    backgroundColor: hexColor,
                    borderRadius: "4px",
                    margin: "0 auto 12px",
                    boxShadow: isEquipped
                      ? `0 0 12px ${hexColor}`
                      : `0 0 6px ${hexColor}60`,
                  }}
                />

                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    textAlign: "center",
                    marginBottom: "6px",
                    color: isDoubleEquipped ? "#ff8c00" : isEquipped ? "#ffd700" : "#ddd",
                  }}
                >
                  {item.name}
                </h3>

                <p
                  style={{
                    fontSize: "12px",
                    color: "#999",
                    textAlign: "center",
                    lineHeight: "1.4",
                    marginBottom: "8px",
                  }}
                >
                  {item.description}
                </p>

                {isDoubleEquipped && item.stackDescription && (
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#ff8c00",
                      textAlign: "center",
                      lineHeight: "1.4",
                      marginBottom: "6px",
                      fontStyle: "italic",
                    }}
                  >
                    {item.stackDescription}
                  </p>
                )}

                {isEquipped && (
                  <p
                    style={{
                      fontSize: "11px",
                      color: isDoubleEquipped ? "#ff8c00" : "#ffd700",
                      textAlign: "center",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {isDoubleEquipped ? "Stacked" : "Equipped"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={handleConfirm}
        style={{
          padding: "14px 48px",
          fontSize: "20px",
          fontFamily: "monospace",
          fontWeight: "bold",
          letterSpacing: "2px",
          textTransform: "uppercase",
          backgroundColor: "#ffd700",
          color: "#0a0a12",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          transition: "all 0.2s",
          pointerEvents: "auto",
          boxShadow: "0 0 20px rgba(255, 215, 0, 0.3)",
        }}
      >
        Confirm
      </button>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { GoldItemCollection } from "../systems/GoldItemCollection";
import { ITEMS } from "../config/ItemDatabase";
import type { ItemData } from "../config/ItemConfig";

interface CollectionGalleryProps {
  onBack: () => void;
}

export const CollectionGallery: React.FC<CollectionGalleryProps> = ({
  onBack,
}) => {
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [backHover, setBackHover] = useState(false);

  // All gold items from the database
  const allGoldItems: ItemData[] = Object.values(ITEMS).filter(
    (item) => item.type === "GOLD",
  );

  useEffect(() => {
    try {
      GoldItemCollection.load();
      setUnlockedIds(GoldItemCollection.getUnlocked());
    } catch {
      // Collection not available
    }
  }, []);

  const unlockedCount = unlockedIds.length;
  const totalCount = allGoldItems.length;

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
        fontFamily: "monospace",
        color: "white",
        zIndex: 100,
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          padding: "40px 40px 0",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: "48px",
            fontWeight: "bold",
            letterSpacing: "4px",
            textTransform: "uppercase",
            color: "#ffd700",
            textShadow: "0 0 20px rgba(255, 215, 0, 0.3)",
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          Collection
        </h1>
        <p
          style={{
            fontSize: "16px",
            color: "#888",
            textAlign: "center",
            marginBottom: "12px",
          }}
        >
          Gold items discovered on your ascent
        </p>

        {/* Progress counter */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "32px",
          }}
        >
          <span
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#ffd700",
            }}
          >
            {unlockedCount}
          </span>
          <span
            style={{
              fontSize: "16px",
              color: "#666",
            }}
          >
            {" "}
            / {totalCount} Unlocked
          </span>
          {/* Progress bar */}
          <div
            style={{
              width: "200px",
              height: "4px",
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              borderRadius: "2px",
              overflow: "hidden",
              margin: "8px auto 0",
            }}
          >
            <div
              style={{
                width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%`,
                height: "100%",
                backgroundColor: "#ffd700",
                borderRadius: "2px",
                transition: "width 0.5s ease",
                boxShadow: "0 0 8px rgba(255, 215, 0, 0.4)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Item Grid */}
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          padding: "0 40px",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        {allGoldItems.map((item) => {
          const isUnlocked = unlockedIds.includes(item.id);
          const hexColor =
            "#" + item.iconColor.toString(16).padStart(6, "0");

          return (
            <ItemCard
              key={item.id}
              item={item}
              isUnlocked={isUnlocked}
              hexColor={hexColor}
            />
          );
        })}
      </div>

      {/* Back button */}
      <div
        style={{
          padding: "10px 0 40px",
        }}
      >
        <button
          onClick={onBack}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            padding: "14px 48px",
            fontSize: "18px",
            fontFamily: "monospace",
            fontWeight: "bold",
            letterSpacing: "2px",
            textTransform: "uppercase",
            background: backHover
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(255, 255, 255, 0.06)",
            color: backHover ? "#fff" : "rgba(200, 200, 220, 0.7)",
            border: `1px solid ${backHover ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.1)"}`,
            borderRadius: "6px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            outline: "none",
            transform: backHover ? "scale(1.03)" : "scale(1)",
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
};

// Individual item card component
interface ItemCardProps {
  item: ItemData;
  isUnlocked: boolean;
  hexColor: string;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, isUnlocked, hexColor }) => {
  const [isHovered, setIsHovered] = useState(false);

  if (!isUnlocked) {
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          padding: "24px 20px",
          backgroundColor: isHovered
            ? "rgba(255, 255, 255, 0.04)"
            : "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "8px",
          transition: "all 0.2s ease",
          textAlign: "center",
        }}
      >
        {/* Locked icon placeholder */}
        <div
          style={{
            width: "48px",
            height: "48px",
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            borderRadius: "6px",
            margin: "0 auto 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            color: "rgba(255, 255, 255, 0.15)",
          }}
        >
          ?
        </div>

        <h3
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: "rgba(255, 255, 255, 0.2)",
            marginBottom: "8px",
          }}
        >
          ???
        </h3>

        <p
          style={{
            fontSize: "11px",
            color: "rgba(255, 255, 255, 0.15)",
            lineHeight: "1.4",
            fontStyle: "italic",
          }}
        >
          Dropped by every 3rd boss
        </p>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: "24px 20px",
        backgroundColor: isHovered
          ? "rgba(255, 215, 0, 0.08)"
          : "rgba(255, 215, 0, 0.03)",
        border: `1px solid ${isHovered ? "rgba(255, 215, 0, 0.3)" : "rgba(255, 215, 0, 0.1)"}`,
        borderRadius: "8px",
        transition: "all 0.2s ease",
        textAlign: "center",
        boxShadow: isHovered
          ? "0 0 20px rgba(255, 215, 0, 0.1)"
          : "none",
      }}
    >
      {/* Item icon */}
      <div
        style={{
          width: "48px",
          height: "48px",
          backgroundColor: hexColor,
          borderRadius: "6px",
          margin: "0 auto 14px",
          boxShadow: isHovered
            ? `0 0 16px ${hexColor}80`
            : `0 0 8px ${hexColor}40`,
          transition: "box-shadow 0.2s ease",
        }}
      />

      <h3
        style={{
          fontSize: "16px",
          fontWeight: "bold",
          color: "#ffd700",
          marginBottom: "8px",
        }}
      >
        {item.name}
      </h3>

      <p
        style={{
          fontSize: "12px",
          color: "#aaa",
          lineHeight: "1.5",
          marginBottom: item.abilityId ? "8px" : "0",
        }}
      >
        {item.description}
      </p>

      {item.abilityId && (
        <p
          style={{
            fontSize: "11px",
            color: "rgba(204, 68, 255, 0.7)",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Ability: {item.abilityId.replace(/_/g, " ")}
        </p>
      )}
    </div>
  );
};

export default CollectionGallery;

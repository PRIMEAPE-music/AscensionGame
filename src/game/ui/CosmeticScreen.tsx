import React, { useState, useEffect, useCallback } from "react";
import {
  CosmeticManager,
  type CosmeticCategory,
  type CosmeticDefinition,
} from "../systems/CosmeticManager";
import { AchievementManager } from "../systems/AchievementManager";

interface CosmeticScreenProps {
  onBack: () => void;
}

// ─── Category Tab Config ─────────────────────────────────────────────────────

interface CategoryTab {
  key: CosmeticCategory;
  label: string;
}

const CATEGORY_TABS: CategoryTab[] = [
  { key: "CLASS_SKIN", label: "Class Skins" },
  { key: "ATTACK_EFFECT", label: "Attack Effects" },
  { key: "PLATFORM_THEME", label: "Platform Themes" },
  { key: "UI_THEME", label: "UI Themes" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function colorToHex(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}

function getAchievementName(achievementId: string): string {
  const achievement = AchievementManager.getById(achievementId);
  return achievement ? achievement.name : achievementId;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const CosmeticScreen: React.FC<CosmeticScreenProps> = ({ onBack }) => {
  const [activeCategory, setActiveCategory] = useState<CosmeticCategory>("CLASS_SKIN");
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [equippedMap, setEquippedMap] = useState<Record<string, string>>({});
  const [backHover, setBackHover] = useState(false);

  // Load state from CosmeticManager
  const refreshState = useCallback(() => {
    setUnlockedIds(CosmeticManager.getUnlocked());
    const equipped: Record<string, string> = {};
    for (const tab of CATEGORY_TABS) {
      equipped[tab.key] = CosmeticManager.getEquipped(tab.key);
    }
    setEquippedMap(equipped);
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const items = CosmeticManager.getByCategory(activeCategory);
  const totalCount = CosmeticManager.getAllDefinitions().length;
  const unlockedCount = unlockedIds.length;

  const handleEquip = useCallback(
    (def: CosmeticDefinition) => {
      if (!CosmeticManager.isUnlocked(def.id)) return;
      CosmeticManager.equip(def.category, def.id);
      refreshState();
    },
    [refreshState],
  );

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
          maxWidth: "1100px",
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
          Cosmetics
        </h1>
        <p
          style={{
            fontSize: "16px",
            color: "#888",
            textAlign: "center",
            marginBottom: "12px",
          }}
        >
          Unlock and equip visual customizations
        </p>

        {/* Progress counter */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <span
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#ffd700",
            }}
          >
            {unlockedCount}
          </span>
          <span style={{ fontSize: "16px", color: "#666" }}>
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

        {/* Category tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "32px",
            flexWrap: "wrap",
          }}
        >
          {CATEGORY_TABS.map((tab) => (
            <TabButton
              key={tab.key}
              label={tab.label}
              isActive={activeCategory === tab.key}
              onClick={() => setActiveCategory(tab.key)}
            />
          ))}
        </div>
      </div>

      {/* Item Grid */}
      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          padding: "0 40px",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        {items.map((def) => {
          const isUnlocked = unlockedIds.includes(def.id);
          const isEquipped = equippedMap[def.category] === def.id;
          return (
            <CosmeticCard
              key={def.id}
              definition={def}
              isUnlocked={isUnlocked}
              isEquipped={isEquipped}
              onEquip={() => handleEquip(def)}
            />
          );
        })}
      </div>

      {/* Back button */}
      <div style={{ padding: "10px 0 40px" }}>
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

// ─── Tab Button ──────────────────────────────────────────────────────────────

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: "10px 24px",
        fontSize: "14px",
        fontFamily: "monospace",
        fontWeight: "bold",
        letterSpacing: "1px",
        textTransform: "uppercase",
        background: isActive
          ? "rgba(255, 215, 0, 0.15)"
          : isHovered
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(255, 255, 255, 0.03)",
        color: isActive ? "#ffd700" : isHovered ? "#ddd" : "rgba(200, 200, 220, 0.6)",
        border: `1px solid ${
          isActive
            ? "rgba(255, 215, 0, 0.4)"
            : isHovered
              ? "rgba(255, 255, 255, 0.2)"
              : "rgba(255, 255, 255, 0.08)"
        }`,
        borderRadius: "6px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        outline: "none",
        boxShadow: isActive ? "0 0 12px rgba(255, 215, 0, 0.15)" : "none",
      }}
    >
      {label}
    </button>
  );
};

// ─── Cosmetic Card ───────────────────────────────────────────────────────────

interface CosmeticCardProps {
  definition: CosmeticDefinition;
  isUnlocked: boolean;
  isEquipped: boolean;
  onEquip: () => void;
}

const CosmeticCard: React.FC<CosmeticCardProps> = ({
  definition,
  isUnlocked,
  isEquipped,
  onEquip,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hexColor = colorToHex(definition.previewColor);

  // ── Locked card ──────────────────────────────────────────────────────────
  if (!isUnlocked) {
    const achievementName = definition.achievementId
      ? getAchievementName(definition.achievementId)
      : "Unknown";

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
          cursor: "default",
        }}
      >
        {/* Locked color swatch */}
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
            color: "rgba(255, 255, 255, 0.2)",
          }}
        >
          {"\uD83D\uDD12"}
        </div>

        <h3
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: "rgba(255, 255, 255, 0.25)",
            marginBottom: "8px",
          }}
        >
          {definition.name}
        </h3>

        <p
          style={{
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.15)",
            lineHeight: "1.4",
            marginBottom: "10px",
          }}
        >
          {definition.description}
        </p>

        <p
          style={{
            fontSize: "11px",
            color: "rgba(255, 215, 0, 0.4)",
            lineHeight: "1.4",
            fontStyle: "italic",
          }}
        >
          Unlock: {achievementName}
        </p>
      </div>
    );
  }

  // ── Unlocked card ────────────────────────────────────────────────────────
  const borderColor = isEquipped
    ? "rgba(255, 215, 0, 0.6)"
    : isHovered
      ? "rgba(255, 215, 0, 0.3)"
      : "rgba(255, 215, 0, 0.1)";

  const bgColor = isEquipped
    ? "rgba(255, 215, 0, 0.1)"
    : isHovered
      ? "rgba(255, 215, 0, 0.06)"
      : "rgba(255, 215, 0, 0.02)";

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onEquip}
      style={{
        padding: "24px 20px",
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "8px",
        transition: "all 0.2s ease",
        textAlign: "center",
        cursor: isEquipped ? "default" : "pointer",
        boxShadow: isEquipped
          ? "0 0 20px rgba(255, 215, 0, 0.15), inset 0 0 15px rgba(255, 215, 0, 0.05)"
          : isHovered
            ? "0 0 16px rgba(255, 215, 0, 0.08)"
            : "none",
        position: "relative",
      }}
    >
      {/* Equipped badge */}
      {isEquipped && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            padding: "2px 8px",
            fontSize: "10px",
            fontWeight: "bold",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "#ffd700",
            backgroundColor: "rgba(255, 215, 0, 0.15)",
            border: "1px solid rgba(255, 215, 0, 0.3)",
            borderRadius: "4px",
          }}
        >
          Equipped
        </div>
      )}

      {/* Color swatch */}
      <div
        style={{
          width: "48px",
          height: "48px",
          backgroundColor: hexColor,
          borderRadius: "6px",
          margin: "0 auto 14px",
          boxShadow: isHovered || isEquipped
            ? `0 0 16px ${hexColor}80`
            : `0 0 8px ${hexColor}40`,
          transition: "box-shadow 0.2s ease",
        }}
      />

      <h3
        style={{
          fontSize: "16px",
          fontWeight: "bold",
          color: isEquipped ? "#ffd700" : "#e0d0a0",
          marginBottom: "8px",
        }}
      >
        {definition.name}
      </h3>

      <p
        style={{
          fontSize: "12px",
          color: "#aaa",
          lineHeight: "1.5",
          marginBottom: definition.class ? "8px" : "0",
        }}
      >
        {definition.description}
      </p>

      {definition.class && (
        <p
          style={{
            fontSize: "11px",
            color: "rgba(204, 68, 255, 0.7)",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          {definition.class}
        </p>
      )}
    </div>
  );
};

export default CosmeticScreen;

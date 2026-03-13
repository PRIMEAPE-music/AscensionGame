import React, { useState, useEffect } from "react";
import { AscensionTree } from "../systems/AscensionTree";
import type { TreeBranch, TreeUpgrade } from "../systems/AscensionTree";

// ─── Props ───────────────────────────────────────────────────────────────────

interface AscensionTreeUIProps {
  onClose: () => void;
}

// ─── Branch Config ───────────────────────────────────────────────────────────

const BRANCHES: { id: TreeBranch; label: string; color: string }[] = [
  { id: "combat", label: "Combat", color: "#ff4444" },
  { id: "mobility", label: "Mobility", color: "#44ddff" },
  { id: "survival", label: "Survival", color: "#44ff88" },
  { id: "economy", label: "Economy", color: "#ffd700" },
  { id: "utility", label: "Utility", color: "#bb88ff" },
];

// ─── Shared Styles ───────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(10, 10, 18, 0.98)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  fontFamily: "monospace",
  color: "#e0d0a0",
  zIndex: 100,
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  padding: "28px 32px 0 32px",
  boxSizing: "border-box",
};

const titleStyle: React.CSSProperties = {
  fontSize: "48px",
  fontWeight: "bold",
  color: "#ffd700",
  textShadow:
    "0 0 20px rgba(255, 215, 0, 0.6), 0 0 40px rgba(255, 215, 0, 0.3), 2px 2px 4px rgba(0, 0, 0, 0.9)",
  letterSpacing: "8px",
  textTransform: "uppercase",
};

const essenceDisplayStyle: React.CSSProperties = {
  position: "absolute",
  right: "32px",
  top: "32px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "22px",
  color: "#ffd700",
  textShadow: "0 0 10px rgba(255, 215, 0, 0.5)",
  background: "rgba(255, 215, 0, 0.08)",
  border: "1px solid rgba(255, 215, 0, 0.25)",
  borderRadius: "8px",
  padding: "8px 18px",
};

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: "4px",
  marginTop: "24px",
  padding: "0 32px",
};

const cardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "16px",
  padding: "24px 32px",
  width: "100%",
  maxWidth: "1200px",
  boxSizing: "border-box",
  overflowY: "auto",
  flex: 1,
};

const footerStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "32px",
  padding: "16px 32px 24px 32px",
  boxSizing: "border-box",
  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
};

const footerStatStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(200, 200, 220, 0.6)",
  letterSpacing: "1px",
  textTransform: "uppercase",
};

const footerStatValueStyle: React.CSSProperties = {
  color: "#e0d0a0",
  fontWeight: "bold",
};

// ─── Component ───────────────────────────────────────────────────────────────

export const AscensionTreeUI: React.FC<AscensionTreeUIProps> = ({ onClose }) => {
  const [activeBranch, setActiveBranch] = useState<TreeBranch>("combat");
  const [essence, setEssence] = useState(AscensionTree.getAvailableEssence());
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({});
  const [flashId, setFlashId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hoverTab, setHoverTab] = useState<TreeBranch | null>(null);
  const [hoverCard, setHoverCard] = useState<string | null>(null);
  const [hoverClose, setHoverClose] = useState(false);
  const [hoverReset, setHoverReset] = useState(false);

  // Refresh all state from AscensionTree
  const refreshState = () => {
    setEssence(AscensionTree.getAvailableEssence());
    const allUpgrades = AscensionTree.getAllUpgrades();
    const levels: Record<string, number> = {};
    for (const u of allUpgrades) {
      levels[u.id] = AscensionTree.getUpgradeLevel(u.id);
    }
    setUpgradeLevels(levels);
  };

  useEffect(() => {
    refreshState();
  }, []);

  const handlePurchase = (upgradeId: string) => {
    const success = AscensionTree.purchaseUpgrade(upgradeId);
    if (success) {
      refreshState();
      setFlashId(upgradeId);
      setTimeout(() => setFlashId(null), 400);
    }
  };

  const handleReset = () => {
    AscensionTree.resetTree();
    refreshState();
    setShowResetConfirm(false);
  };

  const branchUpgrades = AscensionTree.getUpgradesByBranch(activeBranch);
  const activeBranchConfig = BRANCHES.find((b) => b.id === activeBranch)!;
  const treeLevel = AscensionTree.getTreeLevel();
  const totalSpent = AscensionTree.getTotalEssenceSpent();

  return (
    <div style={overlayStyle}>
      {/* Header */}
      <div style={headerStyle}>
        {/* Close Button */}
        <button
          onClick={onClose}
          onMouseEnter={() => setHoverClose(true)}
          onMouseLeave={() => setHoverClose(false)}
          style={{
            position: "absolute",
            left: "32px",
            top: "32px",
            padding: "8px 24px",
            fontSize: "16px",
            fontWeight: "bold",
            fontFamily: "monospace",
            letterSpacing: "2px",
            textTransform: "uppercase",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "6px",
            cursor: "pointer",
            color: hoverClose ? "#fff" : "rgba(200, 200, 220, 0.8)",
            background: hoverClose
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(255, 255, 255, 0.06)",
            transition: "all 0.2s ease",
            outline: "none",
          }}
        >
          BACK
        </button>

        {/* Title */}
        <div style={titleStyle}>ASCENSION TREE</div>

        {/* Essence Counter */}
        <div style={essenceDisplayStyle}>
          <span style={{ fontSize: "18px" }}>&#9670;</span>
          <span style={{ fontWeight: "bold" }}>{essence}</span>
          <span style={{ fontSize: "14px", opacity: 0.7 }}>Essence</span>
        </div>
      </div>

      {/* Branch Tabs */}
      <div style={tabBarStyle}>
        {BRANCHES.map((branch) => {
          const isActive = activeBranch === branch.id;
          const isHovered = hoverTab === branch.id;

          return (
            <button
              key={branch.id}
              onClick={() => setActiveBranch(branch.id)}
              onMouseEnter={() => setHoverTab(branch.id)}
              onMouseLeave={() => setHoverTab(null)}
              style={{
                padding: "10px 24px",
                fontSize: "15px",
                fontWeight: "bold",
                fontFamily: "monospace",
                letterSpacing: "2px",
                textTransform: "uppercase",
                cursor: "pointer",
                outline: "none",
                border: "none",
                borderBottom: isActive
                  ? `3px solid ${branch.color}`
                  : "3px solid transparent",
                color: isActive
                  ? branch.color
                  : isHovered
                    ? "rgba(255, 255, 255, 0.8)"
                    : "rgba(200, 200, 220, 0.5)",
                background: isActive
                  ? `rgba(${hexToRgb(branch.color)}, 0.08)`
                  : isHovered
                    ? "rgba(255, 255, 255, 0.04)"
                    : "transparent",
                borderRadius: "6px 6px 0 0",
                transition: "all 0.2s ease",
                textShadow: isActive
                  ? `0 0 10px ${branch.color}40`
                  : "none",
              }}
            >
              {branch.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div
        style={{
          width: "calc(100% - 64px)",
          height: "1px",
          background: `linear-gradient(to right, transparent, ${activeBranchConfig.color}40, transparent)`,
        }}
      />

      {/* Upgrade Cards Grid */}
      <div style={cardGridStyle}>
        {branchUpgrades.map((upgrade) => (
          <UpgradeCard
            key={upgrade.id}
            upgrade={upgrade}
            currentLevel={upgradeLevels[upgrade.id] ?? 0}
            essence={essence}
            branchColor={activeBranchConfig.color}
            isFlashing={flashId === upgrade.id}
            isHovered={hoverCard === upgrade.id}
            onHoverEnter={() => setHoverCard(upgrade.id)}
            onHoverLeave={() => setHoverCard(null)}
            onPurchase={() => handlePurchase(upgrade.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <div style={footerStatStyle}>
          Tree Level:{" "}
          <span style={footerStatValueStyle}>{treeLevel}</span>
        </div>

        <div
          style={{
            width: "1px",
            height: "20px",
            background: "rgba(255, 255, 255, 0.1)",
          }}
        />

        <div style={footerStatStyle}>
          Total Spent:{" "}
          <span style={footerStatValueStyle}>{totalSpent}</span>
        </div>

        <div
          style={{
            width: "1px",
            height: "20px",
            background: "rgba(255, 255, 255, 0.1)",
          }}
        />

        {/* Reset Button */}
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            onMouseEnter={() => setHoverReset(true)}
            onMouseLeave={() => setHoverReset(false)}
            style={{
              padding: "6px 20px",
              fontSize: "13px",
              fontWeight: "bold",
              fontFamily: "monospace",
              letterSpacing: "1px",
              textTransform: "uppercase",
              border: "1px solid rgba(255, 68, 68, 0.3)",
              borderRadius: "4px",
              cursor: "pointer",
              color: hoverReset ? "#ff4444" : "rgba(255, 68, 68, 0.6)",
              background: hoverReset
                ? "rgba(255, 68, 68, 0.12)"
                : "rgba(255, 68, 68, 0.04)",
              transition: "all 0.2s ease",
              outline: "none",
            }}
          >
            RESET TREE
          </button>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                color: "#ff4444",
                letterSpacing: "1px",
              }}
            >
              Refund all essence?
            </span>
            <button
              onClick={handleReset}
              style={{
                padding: "6px 16px",
                fontSize: "13px",
                fontWeight: "bold",
                fontFamily: "monospace",
                letterSpacing: "1px",
                border: "1px solid rgba(255, 68, 68, 0.5)",
                borderRadius: "4px",
                cursor: "pointer",
                color: "#ff4444",
                background: "rgba(255, 68, 68, 0.15)",
                outline: "none",
              }}
            >
              CONFIRM
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              style={{
                padding: "6px 16px",
                fontSize: "13px",
                fontWeight: "bold",
                fontFamily: "monospace",
                letterSpacing: "1px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "4px",
                cursor: "pointer",
                color: "rgba(200, 200, 220, 0.6)",
                background: "rgba(255, 255, 255, 0.04)",
                outline: "none",
              }}
            >
              CANCEL
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Upgrade Card Sub-Component ──────────────────────────────────────────────

interface UpgradeCardProps {
  upgrade: TreeUpgrade;
  currentLevel: number;
  essence: number;
  branchColor: string;
  isFlashing: boolean;
  isHovered: boolean;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onPurchase: () => void;
}

const UpgradeCard: React.FC<UpgradeCardProps> = ({
  upgrade,
  currentLevel,
  essence,
  branchColor,
  isFlashing,
  isHovered,
  onHoverEnter,
  onHoverLeave,
  onPurchase,
}) => {
  const isMaxed = currentLevel >= upgrade.maxLevel;
  const nextCost = isMaxed ? -1 : upgrade.costPerLevel[currentLevel];
  const canAfford = !isMaxed && essence >= nextCost;

  // Determine border color based on state
  let borderColor: string;
  if (isFlashing) {
    borderColor = "#ffd700";
  } else if (isMaxed) {
    borderColor = "rgba(68, 255, 136, 0.3)";
  } else if (canAfford) {
    borderColor = `${branchColor}60`;
  } else {
    borderColor = "rgba(255, 255, 255, 0.08)";
  }

  return (
    <div
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      style={{
        background: isFlashing
          ? "rgba(255, 215, 0, 0.1)"
          : "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${borderColor}`,
        borderRadius: "8px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        transition: "all 0.2s ease, transform 0.15s ease-out",
        transform: isFlashing
          ? "scale(1.03)"
          : isHovered
            ? "translateY(-2px)"
            : "translateY(0)",
        boxShadow: isFlashing
          ? "0 0 24px rgba(255, 215, 0, 0.3), inset 0 0 12px rgba(255, 215, 0, 0.05)"
          : isHovered
            ? "0 4px 20px rgba(0, 0, 0, 0.4)"
            : "0 2px 8px rgba(0, 0, 0, 0.2)",
      }}
    >
      {/* Top row: Name + Level */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: "#e0d0a0",
            letterSpacing: "1px",
          }}
        >
          {upgrade.name}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: isMaxed ? "#44ff88" : "rgba(200, 200, 220, 0.6)",
            fontWeight: "bold",
            letterSpacing: "1px",
          }}
        >
          Lv {currentLevel} / {upgrade.maxLevel}
        </div>
      </div>

      {/* Level pips */}
      <div style={{ display: "flex", gap: "5px" }}>
        {Array.from({ length: upgrade.maxLevel }, (_, i) => {
          const isFilled = i < currentLevel;
          return (
            <div
              key={i}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                border: `1px solid ${
                  isFilled ? branchColor : "rgba(200, 200, 220, 0.25)"
                }`,
                background: isFilled ? branchColor : "transparent",
                boxShadow: isFilled ? `0 0 6px ${branchColor}60` : "none",
                transition: "all 0.2s ease",
              }}
            />
          );
        })}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: "13px",
          color: "rgba(200, 200, 220, 0.6)",
          lineHeight: "1.4",
          minHeight: "18px",
        }}
      >
        {upgrade.description}
      </div>

      {/* Effect at current level */}
      <div
        style={{
          fontSize: "14px",
          color: branchColor,
          fontWeight: "bold",
          textShadow: `0 0 8px ${branchColor}30`,
        }}
      >
        {currentLevel > 0 ? upgrade.effect(currentLevel) : upgrade.effect(1)}
        {currentLevel === 0 && (
          <span
            style={{
              fontSize: "11px",
              color: "rgba(200, 200, 220, 0.4)",
              fontWeight: "normal",
              marginLeft: "6px",
            }}
          >
            (at Lv 1)
          </span>
        )}
      </div>

      {/* Cost + Button Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "4px",
        }}
      >
        {/* Cost */}
        <div
          style={{
            fontSize: "14px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: isMaxed
              ? "#44ff88"
              : canAfford
                ? "#ffd700"
                : "#ff4444",
            textShadow: isMaxed
              ? "0 0 6px rgba(68, 255, 136, 0.4)"
              : canAfford
                ? "0 0 6px rgba(255, 215, 0, 0.4)"
                : "none",
          }}
        >
          {isMaxed ? (
            <>
              <span style={{ fontSize: "14px" }}>&#10003;</span>
              <span>MAXED</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: "12px" }}>&#9670;</span>
              <span>{nextCost}</span>
            </>
          )}
        </div>

        {/* Purchase Button */}
        {!isMaxed && (
          <button
            onClick={onPurchase}
            disabled={!canAfford}
            style={{
              padding: "6px 18px",
              fontSize: "13px",
              fontWeight: "bold",
              fontFamily: "monospace",
              letterSpacing: "1px",
              textTransform: "uppercase",
              border: "1px solid",
              borderColor: canAfford
                ? "rgba(255, 215, 0, 0.5)"
                : "rgba(100, 100, 100, 0.3)",
              borderRadius: "4px",
              cursor: canAfford ? "pointer" : "not-allowed",
              color: canAfford ? "#ffd700" : "#555",
              background: canAfford
                ? "rgba(255, 215, 0, 0.1)"
                : "rgba(50, 50, 50, 0.3)",
              textShadow: canAfford
                ? "0 0 8px rgba(255, 215, 0, 0.4)"
                : "none",
              transition: "all 0.2s ease",
              outline: "none",
              pointerEvents: "auto",
            }}
          >
            UPGRADE
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Convert a hex color like "#ff4444" to an "r, g, b" string for use in rgba(). */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export default AscensionTreeUI;

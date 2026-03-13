import React, { useState } from "react";
import { CollectionGallery } from "./CollectionGallery";
import { LeaderboardScreen } from "./LeaderboardScreen";
import { CosmeticScreen } from "./CosmeticScreen";
import { StatsScreen } from "./StatsScreen";
import { ReplayScreen } from "./ReplayScreen";
import { RunHistoryUI } from "./RunHistoryUI";
import { ItemCodexUI } from "./ItemCodexUI";

// ── Types ───────────────────────────────────────────────────────────────

type TabId =
  | "collection"
  | "leaderboards"
  | "cosmetics"
  | "statistics"
  | "replays"
  | "run_history"
  | "item_codex";

interface ExtrasScreenProps {
  onClose: () => void;
  onWatchReplay?: (replayIndex: number) => void;
}

// ── Tab Configuration ───────────────────────────────────────────────────

interface TabDef {
  id: TabId;
  label: string;
  /** If this is a sub-view, which main tab is its parent? */
  parent?: TabId;
}

const TABS: TabDef[] = [
  { id: "collection", label: "Collection" },
  { id: "leaderboards", label: "Leaderboards" },
  { id: "cosmetics", label: "Cosmetics" },
  { id: "statistics", label: "Statistics" },
  { id: "replays", label: "Replays" },
];

const SUB_VIEWS: TabDef[] = [
  { id: "run_history", label: "Run History", parent: "statistics" },
  { id: "item_codex", label: "Item Codex", parent: "collection" },
];

/** Returns the parent tab for a sub-view, or the tab itself if it's a main tab. */
function getHighlightedTab(activeTab: TabId): TabId {
  const sub = SUB_VIEWS.find((s) => s.id === activeTab);
  return sub ? sub.parent! : activeTab;
}

/** Returns a display label for the current sub-view, or null if on a main tab. */
function getSubViewLabel(activeTab: TabId): string | null {
  const sub = SUB_VIEWS.find((s) => s.id === activeTab);
  return sub ? sub.label : null;
}

// ── Component ───────────────────────────────────────────────────────────

export const ExtrasScreen: React.FC<ExtrasScreenProps> = ({
  onClose,
  onWatchReplay,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>("collection");
  const [backHover, setBackHover] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<TabId | null>(null);

  const highlightedTab = getHighlightedTab(activeTab);
  const subViewLabel = getSubViewLabel(activeTab);

  // ── Render Content ──────────────────────────────────────────────────

  const renderContent = () => {
    switch (activeTab) {
      case "collection":
        return (
          <CollectionGallery
            onBack={onClose}
            onItemCodex={() => setActiveTab("item_codex")}
          />
        );
      case "leaderboards":
        return <LeaderboardScreen onBack={onClose} />;
      case "cosmetics":
        return <CosmeticScreen onBack={onClose} />;
      case "statistics":
        return (
          <StatsScreen
            onBack={onClose}
            onRunHistory={() => setActiveTab("run_history")}
          />
        );
      case "replays":
        return (
          <ReplayScreen
            onBack={onClose}
            onWatch={(replayIndex: number) =>
              onWatchReplay?.(replayIndex)
            }
          />
        );
      case "run_history":
        return (
          <RunHistoryUI onBack={() => setActiveTab("statistics")} />
        );
      case "item_codex":
        return (
          <ItemCodexUI onBack={() => setActiveTab("collection")} />
        );
      default:
        return null;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

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
        fontFamily: "monospace",
        color: "white",
        zIndex: 100,
      }}
    >
      {/* ── Tab Bar ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "56px",
          minHeight: "56px",
          background: "rgba(10, 10, 18, 0.95)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "0 16px",
          gap: "4px",
          userSelect: "none",
        }}
      >
        {/* Back Button */}
        <button
          onClick={onClose}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            padding: "8px 20px",
            fontSize: "14px",
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
            marginRight: "12px",
          }}
        >
          BACK
        </button>

        {/* Separator */}
        <div
          style={{
            width: "1px",
            height: "28px",
            background: "rgba(255, 255, 255, 0.1)",
            marginRight: "8px",
          }}
        />

        {/* Tab Buttons */}
        {TABS.map((tab) => {
          const isActive = highlightedTab === tab.id;
          const isHovered = hoveredTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                position: "relative",
                padding: "8px 16px",
                fontSize: "14px",
                fontFamily: "monospace",
                fontWeight: "bold",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                background: "transparent",
                color: isActive
                  ? "#fff"
                  : isHovered
                    ? "rgba(200, 200, 220, 0.8)"
                    : "rgba(200, 200, 220, 0.5)",
                border: "none",
                borderRadius: "4px 4px 0 0",
                cursor: "pointer",
                transition: "all 0.2s ease",
                outline: "none",
              }}
            >
              {tab.label}
              {/* Gold underline for active tab */}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "-1px",
                    left: "4px",
                    right: "4px",
                    height: "2px",
                    background: "#ffd700",
                    borderRadius: "1px",
                  }}
                />
              )}
            </button>
          );
        })}

        {/* Breadcrumb for sub-views */}
        {subViewLabel && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "8px",
              gap: "8px",
            }}
          >
            <span
              style={{
                color: "rgba(200, 200, 220, 0.3)",
                fontSize: "14px",
              }}
            >
              /
            </span>
            <span
              style={{
                color: "#ffd700",
                fontSize: "14px",
                fontWeight: "bold",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
              }}
            >
              {subViewLabel}
            </span>
          </div>
        )}
      </div>

      {/* ── Content Area ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {renderContent()}
      </div>
    </div>
  );
};

export default ExtrasScreen;

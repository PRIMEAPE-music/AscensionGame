import React, { useState, useEffect, useMemo } from "react";
import { ItemCodex } from "../systems/ItemCodex";
import { ITEMS } from "../config/ItemDatabase";
import type { ItemData, ItemType, ItemRarity } from "../config/ItemConfig";
import { SYNERGY_DEFS } from "../systems/SynergyManager";
import type { SynergyDef } from "../systems/SynergyManager";

interface ItemCodexUIProps {
  onBack: () => void;
}

// ── Types & Constants ────────────────────────────────────────────────

type FilterType = "all" | "silver" | "gold" | "cursed";
type SynergyFilter = string | null; // synergy tag or null for none

const RARITY_COLORS: Record<string, string> = {
  COMMON: "#aaaaaa",
  UNCOMMON: "#44aaff",
  RARE: "#ff6644",
  LEGENDARY: "#ffd700",
  CURSED: "#9933cc",
};

const TYPE_COLORS: Record<string, string> = {
  SILVER: "#c0c0c0",
  GOLD: "#ffd700",
  CURSED: "#9933cc",
};

const TYPE_LABELS: Record<string, string> = {
  SILVER: "Silver",
  GOLD: "Gold",
  CURSED: "Cursed",
};

const RARITY_LABELS: Record<string, string> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  LEGENDARY: "Legendary",
  CURSED: "Cursed",
};

// ── Filter Button ────────────────────────────────────────────────────

function FilterButton({
  label,
  active,
  color,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  count?: number;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "8px 16px",
        fontSize: "12px",
        fontFamily: "monospace",
        fontWeight: "bold",
        letterSpacing: "1px",
        textTransform: "uppercase",
        background: active
          ? `${color}20`
          : hover
            ? "rgba(255, 255, 255, 0.04)"
            : "transparent",
        color: active ? color : hover ? "rgba(200, 200, 220, 0.7)" : "rgba(200, 200, 220, 0.4)",
        border: active ? `1px solid ${color}50` : "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "4px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        outline: "none",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{ fontSize: "10px", opacity: 0.6 }}>({count})</span>
      )}
    </button>
  );
}

// ── Item Detail Modal ────────────────────────────────────────────────

function ItemDetailModal({
  item,
  onClose,
}: {
  item: ItemData;
  onClose: () => void;
}) {
  const hexColor = "#" + item.iconColor.toString(16).padStart(6, "0");
  const typeColor = TYPE_COLORS[item.type] || "#fff";
  const rarityColor = RARITY_COLORS[item.rarity] || "#aaa";

  // Find synergy sets this item belongs to
  const itemSynergies: SynergyDef[] = useMemo(() => {
    if (!item.tags || item.tags.length === 0) return [];
    return SYNERGY_DEFS.filter((def) =>
      def.tags.some((tag) => item.tags!.includes(tag))
    );
  }, [item]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "420px",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#12121e",
          borderRadius: "12px",
          border: `1px solid ${typeColor}30`,
          boxShadow: `0 0 40px ${typeColor}15, 0 8px 32px rgba(0,0,0,0.6)`,
          padding: "32px",
          fontFamily: "monospace",
          color: "white",
        }}
      >
        {/* Item icon */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              backgroundColor: hexColor,
              borderRadius: "8px",
              margin: "0 auto",
              boxShadow: `0 0 20px ${hexColor}60`,
            }}
          />
        </div>

        {/* Name */}
        <h2
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: typeColor,
            textAlign: "center",
            marginBottom: "4px",
            textShadow: `0 0 12px ${typeColor}40`,
          }}
        >
          {item.name}
        </h2>

        {/* Type & Rarity */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              color: typeColor,
              textTransform: "uppercase",
              letterSpacing: "2px",
              padding: "3px 10px",
              background: `${typeColor}15`,
              borderRadius: "3px",
              border: `1px solid ${typeColor}30`,
            }}
          >
            {TYPE_LABELS[item.type] || item.type}
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              color: rarityColor,
              textTransform: "uppercase",
              letterSpacing: "2px",
              padding: "3px 10px",
              background: `${rarityColor}15`,
              borderRadius: "3px",
              border: `1px solid ${rarityColor}30`,
            }}
          >
            {RARITY_LABELS[item.rarity] || item.rarity}
          </span>
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: "14px",
            color: "rgba(200, 200, 220, 0.8)",
            lineHeight: "1.6",
            textAlign: "center",
            marginBottom: "20px",
            padding: "14px",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "6px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          {item.description}
        </div>

        {/* Stack description */}
        {item.stackable && item.stackDescription && (
          <div
            style={{
              fontSize: "12px",
              color: "#cc44ff",
              textAlign: "center",
              marginBottom: "16px",
              padding: "10px",
              background: "rgba(204, 68, 255, 0.06)",
              borderRadius: "6px",
              border: "1px solid rgba(204, 68, 255, 0.15)",
            }}
          >
            <span style={{ fontWeight: "bold", letterSpacing: "1px", textTransform: "uppercase", fontSize: "10px" }}>
              Stacked Effect
            </span>
            <br />
            {item.stackDescription}
          </div>
        )}

        {/* Effects */}
        {item.effects && item.effects.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(200, 200, 220, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "8px",
              }}
            >
              Effects
            </div>
            {item.effects.map((effect, i) => (
              <div
                key={i}
                style={{
                  fontSize: "13px",
                  color: "rgba(200, 200, 220, 0.7)",
                  padding: "6px 10px",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "4px",
                  marginBottom: "4px",
                }}
              >
                {effect.targetStat}: {effect.value > 0 ? "+" : ""}
                {effect.operation === "MULTIPLY"
                  ? `${(effect.value * 100).toFixed(0)}%`
                  : effect.value.toString()}
                {effect.operation === "ADD" && effect.targetStat !== "health" && effect.targetStat !== "armor"
                  ? ` (${(effect.value * 100).toFixed(0)}%)`
                  : ""}
              </div>
            ))}
          </div>
        )}

        {/* Ability */}
        {item.abilityId && (
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(200, 200, 220, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "6px",
              }}
            >
              Ability
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "#cc44ff",
                padding: "6px 10px",
                background: "rgba(204, 68, 255, 0.06)",
                borderRadius: "4px",
              }}
            >
              {item.abilityId.replace(/_/g, " ")}
            </div>
          </div>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(200, 200, 220, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "8px",
              }}
            >
              Tags
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "11px",
                    padding: "3px 8px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "3px",
                    color: "rgba(200, 200, 220, 0.6)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Synergy Sets */}
        {itemSynergies.length > 0 && (
          <div>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(200, 200, 220, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "8px",
              }}
            >
              Synergy Sets
            </div>
            {itemSynergies.map((syn) => {
              const synColor = "#" + syn.color.toString(16).padStart(6, "0");
              return (
                <div
                  key={syn.id}
                  style={{
                    padding: "8px 12px",
                    background: `${synColor}10`,
                    border: `1px solid ${synColor}25`,
                    borderRadius: "6px",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: synColor }}>
                    {syn.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(200, 200, 220, 0.5)", marginTop: "2px" }}>
                    {syn.description}
                  </div>
                  <div style={{ fontSize: "10px", color: "rgba(200, 200, 220, 0.3)", marginTop: "4px" }}>
                    Requires {syn.requiredCount} matching items
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Close button */}
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 32px",
              fontSize: "14px",
              fontFamily: "monospace",
              fontWeight: "bold",
              letterSpacing: "1px",
              textTransform: "uppercase",
              background: "rgba(255, 255, 255, 0.06)",
              color: "rgba(200, 200, 220, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              outline: "none",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Codex Item Card ──────────────────────────────────────────────────

function CodexItemCard({
  item,
  isDiscovered,
  onClick,
}: {
  item: ItemData;
  isDiscovered: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const hexColor = "#" + item.iconColor.toString(16).padStart(6, "0");
  const typeColor = TYPE_COLORS[item.type] || "#aaa";
  const rarityColor = RARITY_COLORS[item.rarity] || "#aaa";

  if (!isDiscovered) {
    return (
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          padding: "16px 14px",
          backgroundColor: hover
            ? "rgba(255, 255, 255, 0.04)"
            : "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "8px",
          transition: "all 0.2s ease",
          textAlign: "center",
          minHeight: "110px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            borderRadius: "6px",
            margin: "0 auto 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            color: "rgba(255, 255, 255, 0.15)",
          }}
        >
          ?
        </div>
        <h3
          style={{
            fontSize: "14px",
            fontWeight: "bold",
            color: "rgba(255, 255, 255, 0.2)",
            marginBottom: "4px",
          }}
        >
          ???
        </h3>
        <p
          style={{
            fontSize: "10px",
            color: "rgba(255, 255, 255, 0.12)",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Undiscovered
        </p>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "16px 14px",
        backgroundColor: hover
          ? `${typeColor}12`
          : `${typeColor}06`,
        border: `1px solid ${hover ? `${typeColor}40` : `${typeColor}18`}`,
        borderRadius: "8px",
        transition: "all 0.2s ease",
        textAlign: "center",
        cursor: "pointer",
        minHeight: "110px",
        boxShadow: hover ? `0 0 16px ${typeColor}10` : "none",
      }}
    >
      {/* Item icon */}
      <div
        style={{
          width: "40px",
          height: "40px",
          backgroundColor: hexColor,
          borderRadius: "6px",
          margin: "0 auto 10px",
          boxShadow: hover ? `0 0 12px ${hexColor}60` : `0 0 6px ${hexColor}30`,
          transition: "box-shadow 0.2s ease",
        }}
      />

      {/* Name */}
      <h3
        style={{
          fontSize: "13px",
          fontWeight: "bold",
          color: typeColor,
          marginBottom: "4px",
          lineHeight: "1.3",
        }}
      >
        {item.name}
      </h3>

      {/* Rarity badge */}
      <div
        style={{
          fontSize: "9px",
          fontWeight: "bold",
          color: rarityColor,
          textTransform: "uppercase",
          letterSpacing: "1px",
          marginBottom: "6px",
        }}
      >
        {RARITY_LABELS[item.rarity] || item.rarity}
      </div>

      {/* Description preview */}
      <p
        style={{
          fontSize: "10px",
          color: "rgba(200, 200, 220, 0.5)",
          lineHeight: "1.4",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as any,
        }}
      >
        {item.description}
      </p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export const ItemCodexUI: React.FC<ItemCodexUIProps> = ({ onBack }) => {
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>("all");
  const [synergyFilter, setSynergyFilter] = useState<SynergyFilter>(null);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [backHover, setBackHover] = useState(false);

  // Load codex data
  useEffect(() => {
    ItemCodex.load();
    setDiscoveredIds(new Set(ItemCodex.getDiscoveredItems()));
  }, []);

  // All items from the database
  const allItems = useMemo(() => Object.values(ITEMS), []);

  // Unique synergy tags from all items
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of allItems) {
      if (item.tags) {
        for (const tag of item.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [allItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    let items = allItems;

    // Type filter
    if (filter !== "all") {
      const typeMap: Record<string, ItemType> = {
        silver: "SILVER",
        gold: "GOLD",
        cursed: "CURSED",
      };
      const targetType = typeMap[filter];
      if (targetType) {
        items = items.filter((item) => item.type === targetType);
      }
    }

    // Synergy tag filter
    if (synergyFilter) {
      items = items.filter(
        (item) => item.tags && item.tags.includes(synergyFilter)
      );
    }

    return items;
  }, [allItems, filter, synergyFilter]);

  // Counts for filter buttons
  const counts = useMemo(() => {
    return {
      all: allItems.length,
      silver: allItems.filter((i) => i.type === "SILVER").length,
      gold: allItems.filter((i) => i.type === "GOLD").length,
      cursed: allItems.filter((i) => i.type === "CURSED").length,
    };
  }, [allItems]);

  const discoveredCount = discoveredIds.size;
  const totalCount = allItems.length;
  const filteredDiscoveredCount = filteredItems.filter((i) =>
    discoveredIds.has(i.id)
  ).length;

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
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          padding: "36px 40px 0",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: "44px",
            fontWeight: "bold",
            letterSpacing: "4px",
            textTransform: "uppercase",
            color: "#e0d0a0",
            textShadow: "0 0 20px rgba(224, 208, 160, 0.3)",
            marginBottom: "6px",
            textAlign: "center",
          }}
        >
          Item Codex
        </h1>

        {/* Progress counter */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <span
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              color: "#ffd700",
            }}
          >
            {discoveredCount}
          </span>
          <span style={{ fontSize: "16px", color: "#666" }}>
            {" "}/ {totalCount} Discovered
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "300px",
            height: "6px",
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            borderRadius: "3px",
            overflow: "hidden",
            margin: "0 auto 24px",
          }}
        >
          <div
            style={{
              width: `${totalCount > 0 ? (discoveredCount / totalCount) * 100 : 0}%`,
              height: "100%",
              background: "linear-gradient(90deg, #ffd700, #ffaa00)",
              borderRadius: "3px",
              transition: "width 0.5s ease",
              boxShadow: "0 0 8px rgba(255, 215, 0, 0.4)",
            }}
          />
        </div>

        {/* Type Filters */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <FilterButton
            label="All"
            active={filter === "all"}
            color="#e0d0a0"
            count={counts.all}
            onClick={() => setFilter("all")}
          />
          <FilterButton
            label="Silver"
            active={filter === "silver"}
            color="#c0c0c0"
            count={counts.silver}
            onClick={() => setFilter("silver")}
          />
          <FilterButton
            label="Gold"
            active={filter === "gold"}
            color="#ffd700"
            count={counts.gold}
            onClick={() => setFilter("gold")}
          />
          <FilterButton
            label="Cursed"
            active={filter === "cursed"}
            color="#9933cc"
            count={counts.cursed}
            onClick={() => setFilter("cursed")}
          />
        </div>

        {/* Synergy Tag Filters */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "4px",
            marginBottom: "20px",
          }}
        >
          {synergyFilter && (
            <FilterButton
              label="Clear Tag"
              active={false}
              color="#ff6644"
              onClick={() => setSynergyFilter(null)}
            />
          )}
          {allTags.map((tag) => (
            <FilterButton
              key={tag}
              label={tag}
              active={synergyFilter === tag}
              color="#88aacc"
              onClick={() =>
                setSynergyFilter(synergyFilter === tag ? null : tag)
              }
            />
          ))}
        </div>

        {/* Filtered count info */}
        <div
          style={{
            textAlign: "center",
            fontSize: "12px",
            color: "rgba(200, 200, 220, 0.4)",
            marginBottom: "16px",
          }}
        >
          Showing {filteredItems.length} items ({filteredDiscoveredCount} discovered)
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
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "14px",
          marginBottom: "32px",
          animation: "fadeIn 0.3s ease",
        }}
      >
        {filteredItems.map((item) => (
          <CodexItemCard
            key={item.id}
            item={item}
            isDiscovered={discoveredIds.has(item.id)}
            onClick={() => {
              if (discoveredIds.has(item.id)) {
                setSelectedItem(item);
              }
            }}
          />
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div
          style={{
            textAlign: "center",
            color: "rgba(200, 200, 220, 0.4)",
            fontSize: "14px",
            padding: "40px 0",
          }}
        >
          No items match the current filters.
        </div>
      )}

      {/* Back button */}
      <div style={{ padding: "10px 0 36px" }}>
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

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export default ItemCodexUI;

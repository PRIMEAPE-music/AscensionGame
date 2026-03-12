import React, { useState, useEffect, useCallback } from "react";
import { EventBus } from "../systems/EventBus";
import { NPCManager } from "../systems/NPCManager";
import type { ItemData } from "../config/ItemConfig";

// ============================================================
// NPC Type Configuration
// ============================================================

const BOSS_NAMES: Record<number, string> = {
  1: "Magma Tyrant",
  2: "Void-Wing Archon",
  3: "Chrono Demon",
  4: "Legion Master",
  5: "Platform Devourer",
};

const BOSS_TIPS: Record<number, string> = {
  1: "Watch for the meteor shower pattern. Stay mobile and use platforms for cover!",
  2: "It teleports frequently. Keep your eyes on the void rifts and time your dodges.",
  3: "Time slows periodically. Use the slow-zones to reposition safely.",
  4: "It summons minions. Focus the master but don't ignore the adds!",
  5: "It destroys platforms beneath you. Keep moving upward and never stay still.",
};

const NPC_ACCENT_COLORS: Record<string, string> = {
  wanderer: "#44bbaa",
  blacksmith: "#dd8833",
  cursed_one: "#9933cc",
  seer: "#66aadd",
};

const NPC_TITLES: Record<string, string> = {
  wanderer: "THE WANDERER",
  blacksmith: "THE BLACKSMITH",
  cursed_one: "THE CURSED ONE",
  seer: "THE SEER",
};

const RARITY_COLORS: Record<string, string> = {
  COMMON: "#aaaaaa",
  UNCOMMON: "#4488ff",
  RARE: "#ffcc00",
  LEGENDARY: "#ff6600",
  CURSED: "#9933cc",
};

const UPGRADE_COSTS: Record<string, number> = {
  COMMON: 50,
  UNCOMMON: 100,
  RARE: 200,
};

const RARITY_ORDER = ["COMMON", "UNCOMMON", "RARE", "LEGENDARY"];

function getNextRarity(current: string): string | null {
  const idx = RARITY_ORDER.indexOf(current);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[idx + 1];
}

// ============================================================
// Shared Styles
// ============================================================

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  fontFamily: "monospace",
};

const glassPanel: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.5)",
  borderRadius: "12px",
  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
  padding: "24px",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  gap: "12px",
  minWidth: "280px",
  maxWidth: "500px",
};

function makeButton(
  color: string,
  disabled: boolean = false,
): React.CSSProperties {
  return {
    padding: "10px 24px",
    fontSize: "16px",
    fontFamily: "monospace",
    fontWeight: "bold",
    border: `2px solid ${disabled ? "#555" : color}`,
    borderRadius: "8px",
    background: disabled ? "rgba(40,40,40,0.6)" : "rgba(0,0,0,0.4)",
    color: disabled ? "#666" : color,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s ease-out",
  };
}

// ============================================================
// Sub-Components
// ============================================================

interface WandererUIProps {
  accent: string;
  onDismiss: () => void;
}

const WandererUI: React.FC<WandererUIProps> = ({ accent, onDismiss }) => {
  const [accepted, setAccepted] = useState(false);
  const [questState, setQuestState] = useState<{
    active: boolean;
    killCount: number;
    killTarget: number;
    timeRemaining: number;
  } | null>(null);
  const [result, setResult] = useState<"success" | "fail" | null>(null);

  useEffect(() => {
    const unsubComplete = EventBus.on("npc-quest-complete", () => {
      setResult("success");
    });
    const unsubFail = EventBus.on("npc-quest-fail", () => {
      setResult("fail");
    });
    return () => {
      unsubComplete();
      unsubFail();
    };
  }, []);

  // Poll quest state while active
  useEffect(() => {
    if (!accepted || result) return;
    const interval = setInterval(() => {
      const state = NPCManager.getQuestState();
      if (state) setQuestState(state);
    }, 100);
    return () => clearInterval(interval);
  }, [accepted, result]);

  const handleAccept = () => {
    setAccepted(true);
    // Dismiss overlay so player can fight. The quest runs in background.
    onDismiss();
  };

  if (result === "success") {
    return (
      <div style={overlayStyle}>
        <div style={{ ...glassPanel, border: `1px solid ${accent}40` }}>
          <div style={{ fontSize: "28px", color: "#44ff44", fontWeight: "bold" }}>QUEST COMPLETE!</div>
          <div style={{ color: "#ccc", fontSize: "14px", textAlign: "center" }}>
            The Wanderer nods approvingly. A reward materializes nearby.
          </div>
          <button style={makeButton("#44ff44")} onClick={onDismiss}>Continue</button>
        </div>
      </div>
    );
  }

  if (result === "fail") {
    return (
      <div style={overlayStyle}>
        <div style={{ ...glassPanel, border: `1px solid #ff444440` }}>
          <div style={{ fontSize: "28px", color: "#ff4444", fontWeight: "bold" }}>QUEST FAILED</div>
          <div style={{ color: "#ccc", fontSize: "14px", textAlign: "center" }}>
            "Better luck next time, traveler..."
          </div>
          <button style={makeButton("#888")} onClick={onDismiss}>Continue</button>
        </div>
      </div>
    );
  }

  // Show quest offer (before accepting)
  return (
    <div style={overlayStyle}>
      <div style={{ ...glassPanel, border: `1px solid ${accent}40` }}>
        <div style={{ fontSize: "14px", color: accent, letterSpacing: "3px" }}>
          {NPC_TITLES.wanderer}
        </div>
        <div style={{ fontSize: "16px", color: "#eee", textAlign: "center", lineHeight: "1.6" }}>
          "Prove your worth, traveler. Slay{" "}
          <span style={{ color: "#ffcc00", fontWeight: "bold" }}>5 enemies</span> within{" "}
          <span style={{ color: "#ff6644", fontWeight: "bold" }}>20 seconds</span> and I shall
          reward you handsomely."
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button style={makeButton(accent)} onClick={handleAccept}>Accept Quest</button>
          <button style={makeButton("#888")} onClick={onDismiss}>Decline</button>
        </div>
      </div>
    </div>
  );
};

// ─── Blacksmith ─────────────────────────────────────────────────

interface BlacksmithUIProps {
  accent: string;
  inventory: ItemData[];
  essence: number;
  onDismiss: () => void;
}

const BlacksmithUI: React.FC<BlacksmithUIProps> = ({
  accent,
  inventory,
  essence,
  onDismiss,
}) => {
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [localEssence, setLocalEssence] = useState(essence);
  const [upgradedIndices, setUpgradedIndices] = useState<Set<number>>(new Set());

  const silverItems = inventory
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.type === "SILVER");

  const handleUpgrade = (itemIdx: number, item: ItemData) => {
    const cost = UPGRADE_COSTS[item.rarity] ?? 0;
    if (cost === 0 || localEssence < cost) return;
    if (upgradedIndices.has(itemIdx)) return;

    const nextRarity = getNextRarity(item.rarity);
    if (!nextRarity) return;

    EventBus.emit("npc-blacksmith-upgrade", { itemIndex: itemIdx, cost });
    setLocalEssence((prev) => prev - cost);
    setUpgradedIndices((prev) => new Set(prev).add(itemIdx));
    setFlashIdx(itemIdx);
    setTimeout(() => setFlashIdx(null), 600);
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...glassPanel, border: `1px solid ${accent}40`, minWidth: "350px" }}>
        <div style={{ fontSize: "14px", color: accent, letterSpacing: "3px" }}>
          {NPC_TITLES.blacksmith}
        </div>
        <div style={{ fontSize: "14px", color: "#ccc", textAlign: "center" }}>
          "Let me enhance your equipment, traveler."
        </div>
        <div style={{ fontSize: "16px", color: "#ffcc00" }}>
          Essence: {localEssence}
        </div>

        {silverItems.length === 0 ? (
          <div style={{ color: "#888", fontSize: "14px" }}>No silver items to upgrade.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
            {silverItems.map(({ item, idx }) => {
              const nextRarity = getNextRarity(item.rarity);
              const cost = UPGRADE_COSTS[item.rarity] ?? 0;
              const canUpgrade = nextRarity && localEssence >= cost && !upgradedIndices.has(idx);
              const isMaxed = !nextRarity;
              const wasUpgraded = upgradedIndices.has(idx);

              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: flashIdx === idx
                      ? "rgba(255, 200, 50, 0.2)"
                      : "rgba(255,255,255,0.05)",
                    borderRadius: "6px",
                    border: `1px solid ${RARITY_COLORS[item.rarity]}40`,
                    transition: "background 0.3s",
                  }}
                >
                  <div>
                    <div style={{ color: RARITY_COLORS[item.rarity], fontWeight: "bold", fontSize: "14px" }}>
                      {item.name}
                    </div>
                    <div style={{ color: "#888", fontSize: "11px" }}>
                      {item.rarity}{wasUpgraded ? " (Upgraded!)" : ""}
                    </div>
                  </div>
                  {isMaxed ? (
                    <span style={{ color: "#ffcc00", fontSize: "12px" }}>Max tier!</span>
                  ) : wasUpgraded ? (
                    <span style={{ color: "#44ff44", fontSize: "12px" }}>Done</span>
                  ) : (
                    <button
                      style={makeButton(accent, !canUpgrade)}
                      onClick={() => canUpgrade && handleUpgrade(idx, item)}
                    >
                      Upgrade ({cost} ess)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button style={{ ...makeButton("#888"), marginTop: "8px" }} onClick={onDismiss}>
          Leave
        </button>
      </div>
    </div>
  );
};

// ─── Cursed One ─────────────────────────────────────────────────

interface CursedOneUIProps {
  accent: string;
  cursedItems: ItemData[];
  essence: number;
  onDismiss: () => void;
}

const CursedOneUI: React.FC<CursedOneUIProps> = ({
  accent,
  cursedItems,
  essence,
  onDismiss,
}) => {
  const [localEssence, setLocalEssence] = useState(essence);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());

  // 50% discount on cursed items — base cost 150
  const baseCost = 75;

  const handlePurchase = (item: ItemData) => {
    if (localEssence < baseCost || purchasedIds.has(item.id)) return;
    EventBus.emit("npc-cursed-purchase", { itemId: item.id, cost: baseCost });
    setLocalEssence((prev) => prev - baseCost);
    setPurchasedIds((prev) => new Set(prev).add(item.id));
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...glassPanel, border: `1px solid ${accent}40`, minWidth: "350px" }}>
        <div style={{ fontSize: "14px", color: accent, letterSpacing: "3px" }}>
          {NPC_TITLES.cursed_one}
        </div>
        <div style={{ fontSize: "14px", color: "#cc88ff", textAlign: "center", fontStyle: "italic" }}>
          "These artifacts carry great power... and a terrible price."
        </div>
        <div style={{ fontSize: "16px", color: "#ffcc00" }}>
          Essence: {localEssence}
        </div>
        <div style={{ fontSize: "12px", color: "#44ff88" }}>
          50% discount applied
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
          {cursedItems.map((item) => {
            const bought = purchasedIds.has(item.id);
            const canBuy = localEssence >= baseCost && !bought;

            return (
              <div
                key={item.id}
                style={{
                  padding: "10px 12px",
                  background: "rgba(60, 0, 80, 0.3)",
                  borderRadius: "6px",
                  border: `1px solid ${accent}40`,
                }}
              >
                <div style={{ color: accent, fontWeight: "bold", fontSize: "14px" }}>
                  {item.name}
                </div>
                <div style={{ color: "#ccc", fontSize: "12px", margin: "4px 0" }}>
                  {item.description}
                </div>
                <div style={{ color: "#ff4444", fontSize: "11px", fontStyle: "italic" }}>
                  CURSED - Cannot be removed once equipped
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                  <span style={{ color: "#888", fontSize: "12px", textDecoration: "line-through" }}>
                    150 ess
                  </span>
                  <span style={{ color: "#ffcc00", fontSize: "14px", fontWeight: "bold" }}>
                    {baseCost} ess
                  </span>
                  {bought ? (
                    <span style={{ color: "#44ff44", fontSize: "12px" }}>Purchased</span>
                  ) : (
                    <button
                      style={makeButton(accent, !canBuy)}
                      onClick={() => canBuy && handlePurchase(item)}
                    >
                      Buy
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button style={{ ...makeButton("#888"), marginTop: "8px" }} onClick={onDismiss}>
          Pass
        </button>
      </div>
    </div>
  );
};

// ─── Seer ─────────────────────────────────────────────────

interface SeerUIProps {
  accent: string;
  nextBossNumber: number;
  onDismiss: () => void;
}

const SeerUI: React.FC<SeerUIProps> = ({ accent, nextBossNumber, onDismiss }) => {
  const bossIndex = ((nextBossNumber - 1) % 5) + 1;
  const bossName = BOSS_NAMES[bossIndex] || "Unknown Entity";
  const bossTip = BOSS_TIPS[bossIndex] || "Stay vigilant, traveler.";

  return (
    <div style={overlayStyle}>
      <div style={{ ...glassPanel, border: `1px solid ${accent}40`, minWidth: "350px" }}>
        <div style={{ fontSize: "14px", color: accent, letterSpacing: "3px" }}>
          {NPC_TITLES.seer}
        </div>
        <div style={{ fontSize: "14px", color: "#aaccee", textAlign: "center", fontStyle: "italic" }}>
          "I can see what awaits you above..."
        </div>

        <div style={{
          padding: "16px",
          background: "rgba(40, 60, 100, 0.3)",
          borderRadius: "8px",
          border: `1px solid ${accent}30`,
          width: "100%",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
            NEXT BOSS (#{nextBossNumber})
          </div>
          <div style={{ fontSize: "24px", color: "#ff6644", fontWeight: "bold", marginBottom: "8px" }}>
            {bossName}
          </div>
          <div style={{
            fontSize: "13px",
            color: "#ffcc00",
            lineHeight: "1.5",
            fontStyle: "italic",
          }}>
            Tip: {bossTip}
          </div>
        </div>

        <button style={{ ...makeButton(accent), marginTop: "8px" }} onClick={() => {
          EventBus.emit("npc-seer-reveal", {});
          onDismiss();
        }}>
          "Thank you, Seer."
        </button>
      </div>
    </div>
  );
};

// ============================================================
// Main NPC UI Component
// ============================================================

export interface NPCInteractionData {
  npcType: string;
  npcId: string;
  inventory: ItemData[];
  essence: number;
  nextBossNumber: number;
  cursedItems?: ItemData[];
}

interface NPCUIProps {
  data: NPCInteractionData;
  onDismiss: () => void;
}

export const NPCUI: React.FC<NPCUIProps> = ({ data, onDismiss }) => {
  const accent = NPC_ACCENT_COLORS[data.npcType] || "#ffffff";

  switch (data.npcType) {
    case "wanderer":
      return <WandererUI accent={accent} onDismiss={onDismiss} />;
    case "blacksmith":
      return (
        <BlacksmithUI
          accent={accent}
          inventory={data.inventory}
          essence={data.essence}
          onDismiss={onDismiss}
        />
      );
    case "cursed_one":
      return (
        <CursedOneUI
          accent={accent}
          cursedItems={data.cursedItems || []}
          essence={data.essence}
          onDismiss={onDismiss}
        />
      );
    case "seer":
      return (
        <SeerUI
          accent={accent}
          nextBossNumber={data.nextBossNumber}
          onDismiss={onDismiss}
        />
      );
    default:
      return null;
  }
};

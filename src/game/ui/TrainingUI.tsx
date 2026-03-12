import React, { useState, useEffect, useCallback } from "react";
import { EventBus } from "../systems/EventBus";
import { PersistentStats } from "../systems/PersistentStats";
import { BOSS_REGISTRY } from "../scenes/TrainingScene";

interface TrainingUIProps {
  onExit: () => void;
}

/**
 * React overlay for the Training Room.
 * Provides controls for spawning bosses, toggling infinite HP,
 * toggling dummy attack mode, resetting the arena, and exiting.
 */
export const TrainingUI: React.FC<TrainingUIProps> = ({ onExit }) => {
  const [infiniteHP, setInfiniteHP] = useState(false);
  const [dummyAttack, setDummyAttack] = useState(false);
  const [currentDPS, setCurrentDPS] = useState(0);
  const [selectedBoss, setSelectedBoss] = useState<string>("");
  const [availableBosses, setAvailableBosses] = useState<{ id: string; name: string }[]>([]);

  // Determine which bosses the player has encountered
  useEffect(() => {
    const stats = PersistentStats.getLifetimeStats();
    const totalBossesDefeated = stats.totalBossesDefeated;
    const bossList: { id: string; name: string }[] = [];

    // Boss encounter logic:
    // The game cycles through 5 bosses in order. If you've defeated N bosses total,
    // you've seen bosses 1 through min(N+1, 5) (you've seen the next one even if you didn't beat it).
    // For simplicity: unlock all 5 if any boss defeated, otherwise show just the first one
    // if player has reached boss altitude (1000m).
    const highestAlt = PersistentStats.getHighestAltitude();

    if (totalBossesDefeated >= 5 || highestAlt >= 5000) {
      // Player has likely seen all 5 boss types
      for (const [id, entry] of Object.entries(BOSS_REGISTRY)) {
        bossList.push({ id, name: entry.name });
      }
    } else if (totalBossesDefeated >= 1) {
      // Unlock bosses based on how many defeated (cycle order)
      const bossKeys = Object.keys(BOSS_REGISTRY);
      const seen = Math.min(totalBossesDefeated + 1, 5);
      for (let i = 0; i < seen; i++) {
        const id = bossKeys[i];
        bossList.push({ id, name: BOSS_REGISTRY[id].name });
      }
    } else if (highestAlt >= 900) {
      // Player has at least reached near a boss — show the first one
      const firstKey = Object.keys(BOSS_REGISTRY)[0];
      bossList.push({ id: firstKey, name: BOSS_REGISTRY[firstKey].name });
    }
    // If no bosses encountered at all, leave the list empty

    setAvailableBosses(bossList);
    if (bossList.length > 0) {
      setSelectedBoss(bossList[0].id);
    }
  }, []);

  // Listen for DPS updates
  useEffect(() => {
    const unsub = EventBus.on("training-dps-update", (data) => {
      setCurrentDPS(data.dps);
    });
    return unsub;
  }, []);

  const handleToggleInfiniteHP = useCallback(() => {
    const newVal = !infiniteHP;
    setInfiniteHP(newVal);
    EventBus.emit("training-toggle-infinite-hp", { enabled: newVal });
  }, [infiniteHP]);

  const handleToggleDummyAttack = useCallback(() => {
    const newVal = !dummyAttack;
    setDummyAttack(newVal);
    EventBus.emit("training-toggle-dummy-attack", { enabled: newVal });
  }, [dummyAttack]);

  const handleSpawnBoss = useCallback(() => {
    if (selectedBoss) {
      EventBus.emit("training-spawn-boss", { bossId: selectedBoss });
    }
  }, [selectedBoss]);

  const handleReset = useCallback(() => {
    EventBus.emit("training-reset", {});
  }, []);

  const handleExit = useCallback(() => {
    EventBus.emit("training-exit", {});
    onExit();
  }, [onExit]);

  const panelStyle: React.CSSProperties = {
    position: "absolute",
    top: "80px",
    right: "20px",
    width: "280px",
    background: "rgba(10, 10, 20, 0.92)",
    border: "1px solid rgba(100, 100, 140, 0.3)",
    borderRadius: "8px",
    padding: "20px",
    fontFamily: "monospace",
    color: "#c0c0d0",
    zIndex: 50,
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "2px",
    color: "rgba(160, 160, 200, 0.6)",
    marginBottom: "8px",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "10px 16px",
    fontSize: "14px",
    fontFamily: "monospace",
    fontWeight: "bold",
    border: "1px solid rgba(100, 100, 140, 0.3)",
    borderRadius: "4px",
    cursor: "pointer",
    background: "rgba(60, 60, 80, 0.4)",
    color: "#c0c0d0",
    transition: "all 0.15s ease",
    width: "100%",
  };

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    ...buttonStyle,
    background: active ? "rgba(80, 200, 80, 0.2)" : "rgba(60, 60, 80, 0.4)",
    borderColor: active ? "rgba(80, 200, 80, 0.5)" : "rgba(100, 100, 140, 0.3)",
    color: active ? "#80ff80" : "#c0c0d0",
  });

  const selectStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "13px",
    fontFamily: "monospace",
    background: "rgba(30, 30, 50, 0.9)",
    border: "1px solid rgba(100, 100, 140, 0.3)",
    borderRadius: "4px",
    color: "#c0c0d0",
    width: "100%",
    cursor: "pointer",
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "#8080aa",
          }}
        >
          Controls
        </div>
      </div>

      {/* DPS Display */}
      <div
        style={{
          textAlign: "center",
          padding: "12px",
          background: "rgba(255, 204, 0, 0.08)",
          borderRadius: "4px",
          border: "1px solid rgba(255, 204, 0, 0.15)",
        }}
      >
        <div style={{ fontSize: "11px", color: "rgba(255, 204, 0, 0.6)", letterSpacing: "2px", textTransform: "uppercase" }}>
          DPS (5s Rolling)
        </div>
        <div style={{ fontSize: "28px", fontWeight: "bold", color: "#ffcc00", marginTop: "4px" }}>
          {currentDPS}
        </div>
      </div>

      {/* Boss Spawn */}
      <div>
        <div style={sectionTitleStyle}>Spawn Boss</div>
        {availableBosses.length > 0 ? (
          <>
            <select
              style={selectStyle}
              value={selectedBoss}
              onChange={(e) => setSelectedBoss(e.target.value)}
            >
              {availableBosses.map((boss) => (
                <option key={boss.id} value={boss.id}>
                  {boss.name}
                </option>
              ))}
            </select>
            <button
              style={{ ...buttonStyle, marginTop: "8px", background: "rgba(180, 80, 80, 0.3)", borderColor: "rgba(180, 80, 80, 0.4)" }}
              onClick={handleSpawnBoss}
              onMouseOver={(e) => {
                (e.target as HTMLElement).style.background = "rgba(180, 80, 80, 0.5)";
              }}
              onMouseOut={(e) => {
                (e.target as HTMLElement).style.background = "rgba(180, 80, 80, 0.3)";
              }}
            >
              Spawn Boss
            </button>
          </>
        ) : (
          <div style={{ fontSize: "12px", color: "rgba(120, 120, 140, 0.5)", fontStyle: "italic" }}>
            No bosses encountered yet. Reach 1000m in a run to unlock!
          </div>
        )}
      </div>

      {/* Toggles */}
      <div>
        <div style={sectionTitleStyle}>Options</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            style={toggleStyle(infiniteHP)}
            onClick={handleToggleInfiniteHP}
            onMouseOver={(e) => {
              if (!infiniteHP) (e.target as HTMLElement).style.background = "rgba(60, 60, 80, 0.6)";
            }}
            onMouseOut={(e) => {
              if (!infiniteHP) (e.target as HTMLElement).style.background = "rgba(60, 60, 80, 0.4)";
            }}
          >
            {infiniteHP ? "[ON]" : "[OFF]"} Infinite HP
          </button>
          <button
            style={toggleStyle(dummyAttack)}
            onClick={handleToggleDummyAttack}
            onMouseOver={(e) => {
              if (!dummyAttack) (e.target as HTMLElement).style.background = "rgba(60, 60, 80, 0.6)";
            }}
            onMouseOut={(e) => {
              if (!dummyAttack) (e.target as HTMLElement).style.background = "rgba(60, 60, 80, 0.4)";
            }}
          >
            {dummyAttack ? "[ON]" : "[OFF]"} Dummy Attack (Parry Practice)
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <button
          style={buttonStyle}
          onClick={handleReset}
          onMouseOver={(e) => {
            (e.target as HTMLElement).style.background = "rgba(60, 60, 80, 0.6)";
          }}
          onMouseOut={(e) => {
            (e.target as HTMLElement).style.background = "rgba(60, 60, 80, 0.4)";
          }}
        >
          Reset Arena
        </button>
        <button
          style={{
            ...buttonStyle,
            background: "rgba(180, 60, 60, 0.3)",
            borderColor: "rgba(180, 60, 60, 0.4)",
            color: "#ff8888",
          }}
          onClick={handleExit}
          onMouseOver={(e) => {
            (e.target as HTMLElement).style.background = "rgba(180, 60, 60, 0.5)";
          }}
          onMouseOut={(e) => {
            (e.target as HTMLElement).style.background = "rgba(180, 60, 60, 0.3)";
          }}
        >
          Exit (ESC)
        </button>
      </div>

      {/* Tip */}
      <div
        style={{
          fontSize: "10px",
          color: "rgba(120, 120, 140, 0.4)",
          textAlign: "center",
          lineHeight: "1.4",
        }}
      >
        No essence or progression rewards in Training Room.
        <br />
        Press ESC to return to menu.
      </div>
    </div>
  );
};

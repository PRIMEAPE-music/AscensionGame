import React, { useState, useEffect, useRef, useMemo } from "react";
import { InventoryUI } from "./InventoryUI";
import { BossHealthBar } from "./BossHealthBar";
import { EventBus } from "../systems/EventBus";
import type { ItemData } from "../config/ItemConfig";
import type { SynergyBonus } from "../systems/ItemSynergy";
import { CosmeticManager } from "../systems/CosmeticManager";
import { GameSettings } from "../systems/GameSettings";

interface GameHUDProps {
  health: number;
  maxHealth: number;
  altitude: number;
  inventory: ItemData[];
  className?: string;
  styleMeter: number;
  styleTier: string;
  essence: number;
  comboCount: number;
  comboMultiplier: number;
  flowMeter: number;
  flowMaxFlow: number;
  isShieldGuarding: boolean;
  sacredGroundCooldown: { remaining: number; total: number };
  player2Health?: number;
  player2MaxHealth?: number;
  player2ClassName?: string;
}

function getSpeedColor(speed: number, maxSpeed: number): string {
  const ratio = speed / maxSpeed;
  if (ratio < 0.3) return '#4488ff'; // Blue (slow)
  if (ratio < 0.6) return '#ffcc00'; // Yellow (normal)
  return '#ff4444'; // Red (fast)
}

const TIER_COLORS: Record<string, string> = {
  D: "#666",
  C: "#4488ff",
  B: "#44ff44",
  A: "#ffcc00",
  S: "#ff4444",
};

const glassStyle: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.25)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
};

const glassStyleHighContrast: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.55)",
  border: "2px solid rgba(255, 255, 255, 0.4)",
  borderRadius: "12px",
  boxShadow: "0 2px 16px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
};

// Bubble config: x%, size, duration, delay
const BUBBLES = [
  { left: "12%", size: 5, duration: 3.2, delay: 0 },
  { left: "30%", size: 4, duration: 3.8, delay: 0.8 },
  { left: "52%", size: 6, duration: 3.0, delay: 1.6 },
  { left: "70%", size: 3, duration: 4.2, delay: 0.4 },
  { left: "85%", size: 5, duration: 3.5, delay: 2.0 },
  { left: "20%", size: 3, duration: 4.0, delay: 2.8 },
  { left: "42%", size: 4, duration: 3.6, delay: 1.2 },
  { left: "65%", size: 5, duration: 3.3, delay: 3.2 },
  { left: "90%", size: 3, duration: 4.4, delay: 0.6 },
  { left: "8%", size: 4, duration: 3.9, delay: 2.4 },
];

function getBiomeColor(biome: string): string {
  const colors: Record<string, string> = {
    DEPTHS: '#4466aa',
    CAVERNS: '#ff6633',
    SPIRE: '#44cc44',
    SUMMIT: '#8888cc',
  };
  return colors[biome] || '#888';
}

function formatBiomeName(biome: string): string {
  const names: Record<string, string> = {
    DEPTHS: 'The Depths',
    CAVERNS: 'Infernal Caverns',
    SPIRE: 'The Spire',
    SUMMIT: 'The Summit',
  };
  return names[biome] || biome.replace(/_/g, ' ');
}

export const GameHUD: React.FC<GameHUDProps> = ({
  health,
  maxHealth,
  altitude,
  inventory,
  className = "Monk",
  styleMeter,
  styleTier,
  essence,
  comboCount,
  comboMultiplier,
  flowMeter,
  flowMaxFlow,
  isShieldGuarding,
  sacredGroundCooldown,
  player2Health,
  player2MaxHealth,
  player2ClassName,
}) => {
  // Cosmetic UI theme accent color
  const themeColor = useMemo(() => {
    const themeId = CosmeticManager.getEquipped('UI_THEME');
    if (!themeId || themeId === 'default_ui') return '#e0d0a0';
    const themeDef = CosmeticManager.getDefinition(themeId);
    if (!themeDef) return '#e0d0a0';
    const hex = themeDef.previewColor.toString(16).padStart(6, '0');
    return `#${hex}`;
  }, []);

  const highContrast = GameSettings.get().highContrast;
  const activeGlassStyle = highContrast ? glassStyleHighContrast : glassStyle;
  const hcTextShadow = highContrast
    ? "1px 1px 2px rgba(0,0,0,1), -1px -1px 2px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.8)"
    : "1px 1px 3px rgba(0,0,0,0.8)";

  const healthPercentage = (health / maxHealth) * 100;
  const tierColor = TIER_COLORS[styleTier] || "#666";

  // Combo color tiers: white (1-4), yellow (5-9), orange (10-19), red (20-49), purple (50+)
  const comboColor =
    comboCount >= 50
      ? "#cc44ff"
      : comboCount >= 20
        ? "#ff4444"
        : comboCount >= 10
          ? "#ff8800"
          : comboCount >= 5
            ? "#ffcc00"
            : "#ffffff";

  // Boss fight state
  const [bossActive, setBossActive] = useState(false);
  const [bossName, setBossName] = useState("");
  const [bossHealth, setBossHealth] = useState(0);
  const [bossMaxHealth, setBossMaxHealth] = useState(0);
  const [bossPhase, setBossPhase] = useState(1);
  const [showWarning, setShowWarning] = useState(false);
  const [warningOpacity, setWarningOpacity] = useState(1);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showWarningFiredRef = useRef(false);

  // Boss distance indicator
  const [bossDistance, setBossDistance] = useState<number | null>(null);

  // Speed meter
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(600);

  // Silver item max slots (dynamic)
  const [maxSlots, setMaxSlots] = useState(1);

  // Synergy bonuses
  const [synergies, setSynergies] = useState<SynergyBonus[]>([]);

  // Active themed synergy set badges (persists in bottom bar)
  const [activeThemedSynergies, setActiveThemedSynergies] = useState<
    Array<{ name: string; color: string }>
  >([]);

  // Themed synergy set activation notification
  const [synergyNotification, setSynergyNotification] = useState<{
    name: string;
    description: string;
    color: string;
  } | null>(null);
  const [synergyNotifOpacity, setSynergyNotifOpacity] = useState(1);
  const synergyNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const synergyFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Combo string name display
  const [comboName, setComboName] = useState<string | null>(null);
  const comboNameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Finishing move flash
  const [showFinish, setShowFinish] = useState(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parry flash display
  const [showParryFlash, setShowParryFlash] = useState(false);
  const [parryFlashOpacity, setParryFlashOpacity] = useState(1);
  const parryFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parryFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Progress indicator state
  const [progressData, setProgressData] = useState<{
    altitude: number;
    nextBossAltitude: number;
    biome: string;
  } | null>(null);

  // Corruption meter (Endless Mode)
  const [corruption, setCorruption] = useState(0);
  const [corruptionModifier, setCorruptionModifier] = useState<string | null>(null);
  const isEndlessMode = !!(window as any).__isEndlessMode;

  // Essence flash animation
  const [essenceFlash, setEssenceFlash] = useState(false);
  const prevEssenceRef = useRef(essence);
  useEffect(() => {
    if (essence !== prevEssenceRef.current && essence > 0) {
      setEssenceFlash(true);
      const timer = setTimeout(() => setEssenceFlash(false), 400);
      prevEssenceRef.current = essence;
      return () => clearTimeout(timer);
    }
    prevEssenceRef.current = essence;
  }, [essence]);

  useEffect(() => {
    const unsubSpawn = EventBus.on("boss-spawn", (data) => {
      setBossActive(true);
      setBossName(data.name);
      setBossHealth(data.maxHealth);
      setBossMaxHealth(data.maxHealth);
      setBossPhase(1);
      setBossDistance(null); // Hide distance when fight starts
    });

    const unsubHealth = EventBus.on("boss-health-change", (data) => {
      setBossHealth(data.health);
      setBossMaxHealth(data.maxHealth);
      setBossPhase(data.phase);
    });

    const unsubDefeated = EventBus.on("boss-defeated", () => {
      setBossActive(false);
      setBossName("");
      setBossHealth(0);
      setBossMaxHealth(0);
      setBossPhase(1);
      setBossDistance(null);
      showWarningFiredRef.current = false;
    });

    const unsubDied = EventBus.on("player-died", () => {
      setBossActive(false);
      setBossName("");
      setBossHealth(0);
      setBossMaxHealth(0);
      setBossPhase(1);
      setShowWarning(false);
      setBossDistance(null);
      showWarningFiredRef.current = false;
    });

    const unsubSynergy = EventBus.on("synergy-change", (data) => {
      setSynergies(data.synergies || []);
    });

    const unsubWarning = EventBus.on("boss-warning", () => {
      // Show the big "BOSS APPROACHING" warning once (when first entering range)
      if (!showWarningFiredRef.current) {
        showWarningFiredRef.current = true;
        setShowWarning(true);
        setWarningOpacity(1);
        // Start fade after 2 seconds
        fadeTimerRef.current = setTimeout(() => {
          setWarningOpacity(0);
        }, 2000);
        // Remove warning after 3 seconds total
        warningTimerRef.current = setTimeout(() => {
          setShowWarning(false);
        }, 3000);
      }
    });

    const unsubSpeed = EventBus.on("speed-change", (data) => {
      setSpeed(data.speed);
      setMaxSpeed(data.maxSpeed);
    });

    const unsubInventory = EventBus.on("inventory-change", (data) => {
      if (data.maxSlots !== undefined) {
        setMaxSlots(data.maxSlots);
      }
    });

    const unsubComboString = EventBus.on("combo-string", (data) => {
      setComboName(`${data.name} x${data.multiplier}`);
      if (comboNameTimerRef.current) clearTimeout(comboNameTimerRef.current);
      comboNameTimerRef.current = setTimeout(() => setComboName(null), 1500);
    });

    const unsubProgress = EventBus.on("progress-update", (data) => {
      setProgressData(data);
      // Calculate boss distance from progress data (throttled to every 500ms)
      const dist = data.nextBossAltitude - data.altitude;
      if (dist > 0 && dist <= 300) {
        setBossDistance(Math.floor(dist));
      }
    });

    const unsubFinish = EventBus.on("finishing-move", () => {
      setShowFinish(true);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      finishTimerRef.current = setTimeout(() => setShowFinish(false), 500);
    });

    const unsubParry = EventBus.on("parry-success", () => {
      setShowParryFlash(true);
      setParryFlashOpacity(1);
      // Start fade after 200ms
      if (parryFadeTimerRef.current) clearTimeout(parryFadeTimerRef.current);
      parryFadeTimerRef.current = setTimeout(() => {
        setParryFlashOpacity(0);
      }, 200);
      // Remove after 700ms total (200ms solid + 500ms fade)
      if (parryFlashTimerRef.current) clearTimeout(parryFlashTimerRef.current);
      parryFlashTimerRef.current = setTimeout(() => {
        setShowParryFlash(false);
      }, 700);
    });

    const unsubCorruption = EventBus.on("corruption-update", (data) => {
      setCorruption(data.level);
    });

    const unsubCorruptionMod = EventBus.on("corruption-modifier", (data) => {
      setCorruptionModifier(data.modifierId);
      // Auto-clear notification after 3 seconds
      setTimeout(() => setCorruptionModifier(null), 3000);
    });

    const unsubSynergyActivated = EventBus.on("synergy-activated", (data) => {
      const hex = (data.color ?? 0xffffff).toString(16).padStart(6, '0');
      const colorStr = `#${hex}`;

      // Add to persistent list of active themed synergies
      setActiveThemedSynergies(prev => {
        // Avoid duplicates
        if (prev.some(s => s.name === data.name)) return prev;
        return [...prev, { name: data.name, color: colorStr }];
      });

      // Show temporary notification
      setSynergyNotification({
        name: data.name,
        description: data.description,
        color: colorStr,
      });
      setSynergyNotifOpacity(1);
      // Start fade after 2 seconds
      if (synergyFadeTimerRef.current) clearTimeout(synergyFadeTimerRef.current);
      synergyFadeTimerRef.current = setTimeout(() => {
        setSynergyNotifOpacity(0);
      }, 2000);
      // Remove after 3 seconds total
      if (synergyNotifTimerRef.current) clearTimeout(synergyNotifTimerRef.current);
      synergyNotifTimerRef.current = setTimeout(() => {
        setSynergyNotification(null);
      }, 3000);
    });

    return () => {
      unsubSpawn();
      unsubHealth();
      unsubDefeated();
      unsubDied();
      unsubWarning();
      unsubSynergy();
      unsubSpeed();
      unsubInventory();
      unsubComboString();
      unsubProgress();
      unsubFinish();
      unsubParry();
      unsubCorruption();
      unsubCorruptionMod();
      unsubSynergyActivated();
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (comboNameTimerRef.current) clearTimeout(comboNameTimerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      if (parryFlashTimerRef.current) clearTimeout(parryFlashTimerRef.current);
      if (parryFadeTimerRef.current) clearTimeout(parryFadeTimerRef.current);
      if (synergyNotifTimerRef.current) clearTimeout(synergyNotifTimerRef.current);
      if (synergyFadeTimerRef.current) clearTimeout(synergyFadeTimerRef.current);
    };
  }, []);

  // Progress bar calculations
  const bossInterval = 1000;
  const progressAltitude = progressData?.altitude ?? altitude;
  const nextBossAlt = progressData?.nextBossAltitude ?? bossInterval;
  const currentBiome = progressData?.biome ?? 'DEPTHS';
  const prevBossAlt = nextBossAlt - bossInterval;
  const currentInInterval = progressAltitude - prevBossAlt;
  const playerProgressPercent = Math.max(0, Math.min(100, (currentInInterval / bossInterval) * 100));
  const bossProgressPercent = 100; // Boss is always at the top
  const progressDistanceToBoss = Math.max(0, Math.round(nextBossAlt - progressAltitude));

  return (
    <>
      {/* Boss Health Bar */}
      {bossActive && (
        <BossHealthBar
          bossName={bossName}
          health={bossHealth}
          maxHealth={bossMaxHealth}
          phase={bossPhase}
        />
      )}

      {/* Boss Warning Text */}
      {showWarning && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontFamily: "monospace",
            fontSize: "48px",
            fontWeight: "bold",
            color: "#ff2222",
            textShadow:
              "0 0 20px rgba(255, 34, 34, 0.8), 0 0 40px rgba(255, 34, 34, 0.4), 2px 2px 4px rgba(0, 0, 0, 0.9)",
            letterSpacing: "6px",
            textTransform: "uppercase",
            zIndex: 20,
            pointerEvents: "none",
            opacity: warningOpacity,
            transition: "opacity 1s ease-out",
          }}
        >
          BOSS APPROACHING
        </div>
      )}

      {/* Finishing Move Flash */}
      {showFinish && (
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontFamily: "monospace",
            fontSize: "56px",
            fontWeight: "bold",
            color: "#ffd700",
            textShadow:
              "0 0 20px rgba(255, 215, 0, 0.9), 0 0 40px rgba(255, 170, 0, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.9)",
            letterSpacing: "8px",
            textTransform: "uppercase",
            zIndex: 25,
            pointerEvents: "none",
            animation: "hud-pulse 0.3s ease-out",
          }}
        >
          FINISH!
        </div>
      )}

      {/* Parry Flash */}
      {showParryFlash && (
        <div
          style={{
            position: "absolute",
            top: "35%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontFamily: "monospace",
            fontSize: "42px",
            fontWeight: "bold",
            color: "#ffd700",
            textShadow:
              "0 0 16px rgba(255, 215, 0, 0.9), 0 0 32px rgba(255, 255, 255, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.9)",
            letterSpacing: "6px",
            textTransform: "uppercase",
            zIndex: 25,
            pointerEvents: "none",
            opacity: parryFlashOpacity,
            transition: "opacity 0.5s ease-out",
          }}
        >
          PARRY!
        </div>
      )}

      {/* Themed Synergy Set Activation Notification */}
      {synergyNotification && (
        <div
          style={{
            position: "absolute",
            top: "22%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            pointerEvents: "none",
            zIndex: 30,
            opacity: synergyNotifOpacity,
            transition: "opacity 1s ease-out",
          }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "42px",
              fontWeight: "bold",
              color: synergyNotification.color,
              textShadow:
                `0 0 20px ${synergyNotification.color}, 0 0 40px ${synergyNotification.color}88, 2px 2px 4px rgba(0, 0, 0, 0.9)`,
              letterSpacing: "8px",
              textTransform: "uppercase",
              animation: "hud-pulse 0.4s ease-out",
            }}
          >
            {synergyNotification.name}
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "14px",
              fontWeight: "bold",
              color: "rgba(255, 255, 255, 0.85)",
              textShadow: "1px 1px 3px rgba(0, 0, 0, 0.9)",
              letterSpacing: "1px",
              textAlign: "center",
              maxWidth: "400px",
            }}
          >
            SYNERGY ACTIVE: {synergyNotification.description}
          </div>
        </div>
      )}

      {/* P2 Health Panel (co-op) */}
      {player2Health !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
            pointerEvents: 'none',
            zIndex: 10,
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontSize: 11, color: '#aaddff', letterSpacing: 2 }}>
            P2 {player2ClassName}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: player2MaxHealth ?? 0 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: i < (player2Health ?? 0) ? '#ff4466' : 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Corruption Meter (Endless Mode) */}
      {isEndlessMode && corruption > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'none',
            zIndex: 15,
            fontFamily: 'monospace',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: corruption >= 80 ? '#cc44ff' : '#9944cc',
              letterSpacing: '2px',
              textShadow: corruption >= 80
                ? '0 0 10px rgba(204, 68, 255, 0.8)'
                : '0 0 4px rgba(153, 68, 204, 0.4)',
              animation: corruption >= 90 ? 'hud-pulse 0.8s ease-in-out infinite' : 'none',
            }}
          >
            CORRUPTION: {Math.floor(corruption)}%
          </div>
          <div
            style={{
              width: '180px',
              height: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: `1px solid ${corruption >= 80 ? 'rgba(204, 68, 255, 0.6)' : 'rgba(153, 68, 204, 0.3)'}`,
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${corruption}%`,
                height: '100%',
                background: corruption >= 80
                  ? 'linear-gradient(to right, #7722aa, #cc44ff, #ff44ff)'
                  : 'linear-gradient(to right, #442266, #7722aa, #9944cc)',
                transition: 'width 0.3s ease-out',
                borderRadius: '3px',
                boxShadow: corruption >= 80
                  ? '0 0 8px rgba(204, 68, 255, 0.6)'
                  : 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Corruption Modifier Activation Flash */}
      {corruptionModifier && (
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontFamily: 'monospace',
            fontSize: '36px',
            fontWeight: 'bold',
            color: '#cc44ff',
            textShadow: '0 0 20px rgba(204, 68, 255, 0.9), 0 0 40px rgba(153, 68, 204, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.9)',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            zIndex: 25,
            pointerEvents: 'none',
            animation: 'hud-pulse 0.4s ease-out',
          }}
        >
          CORRUPTED!
        </div>
      )}

      {/* Inventory Row — sits above the bottom bar */}
      <div
        style={{
          position: "absolute",
          bottom: 52,
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3px",
          fontFamily: "monospace",
          zIndex: 10,
        }}
      >
        <InventoryUI items={inventory} maxSlots={maxSlots} />
        {synergies.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {synergies.map((s, i) => (
              <div
                key={i}
                style={{
                  fontSize: "10px",
                  fontWeight: "bold",
                  color: themeColor,
                  textShadow: `0 0 6px ${themeColor}66`,
                  letterSpacing: "0.5px",
                }}
              >
                {s.count}x {s.rarity} +{Math.round(s.bonus * 100)}%
              </div>
            ))}
          </div>
        )}
        {activeThemedSynergies.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {activeThemedSynergies.map((s, i) => (
              <div
                key={i}
                style={{
                  fontSize: "9px",
                  fontWeight: "bold",
                  color: s.color,
                  textShadow: `0 0 8px ${s.color}88`,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  padding: "1px 5px",
                  border: `1px solid ${s.color}44`,
                  borderRadius: "3px",
                  background: `${s.color}11`,
                }}
              >
                {s.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════ BOTTOM BAR ═══════════ */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "46px",
          background: "rgba(0, 0, 0, 0.55)",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          color: "white",
          textShadow: hcTextShadow,
          pointerEvents: "none",
          zIndex: 10,
          padding: "0 16px",
        }}
      >
        {/* Left section: Essence + Class ability */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: "1 1 0", justifyContent: "flex-start" }}>
          {/* Essence */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transform: essenceFlash ? "scale(1.15)" : "scale(1)",
              transition: "transform 0.2s ease-out",
            }}
          >
            <span
              style={{
                fontSize: "14px",
                color: "#cc44ff",
                textShadow: essenceFlash
                  ? "0 0 12px rgba(204, 68, 255, 0.8)"
                  : "0 0 6px rgba(204, 68, 255, 0.4)",
                transition: "text-shadow 0.2s ease-out",
              }}
            >
              &#9670;
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: essenceFlash ? "#dd66ff" : "#cc44ff",
                transition: "color 0.2s ease-out",
              }}
            >
              {essence}
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" }} />

          {/* Monk Flow Meter */}
          {className === "Monk" && flowMaxFlow > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div
                style={{
                  fontSize: "10px",
                  color:
                    flowMeter >= 100
                      ? "#ff4444"
                      : flowMeter >= 75
                        ? "#ffaa00"
                        : flowMeter >= 50
                          ? "#ffcc44"
                          : "#888",
                  fontWeight: "bold",
                  letterSpacing: "1px",
                }}
              >
                FLOW
              </div>
              <div
                style={{
                  width: "80px",
                  height: "8px",
                  backgroundColor: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255, 170, 0, 0.3)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(flowMeter / flowMaxFlow) * 100}%`,
                    height: "100%",
                    background:
                      flowMeter >= 100
                        ? "linear-gradient(to right, #ff4444, #ffaa00, #ff4444)"
                        : flowMeter >= 75
                          ? "linear-gradient(to right, #ff8800, #ffaa00)"
                          : flowMeter >= 50
                            ? "linear-gradient(to right, #cc8800, #ffcc44)"
                            : "linear-gradient(to right, #886600, #ffaa00)",
                    transition: "width 0.15s ease-out",
                    boxShadow:
                      flowMeter >= 75
                        ? "0 0 6px rgba(255, 170, 0, 0.6)"
                        : "none",
                    borderRadius: "2px",
                  }}
                />
              </div>
            </div>
          )}

          {/* Paladin Shield Guard */}
          {className === "Paladin" && isShieldGuarding && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                animation: "hud-pulse 1.2s ease-in-out infinite",
              }}
            >
              <span style={{ fontSize: "14px", color: "#4488ff", textShadow: "0 0 8px rgba(68, 136, 255, 0.8)" }}>
                &#9711;
              </span>
              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#4488ff", letterSpacing: "1px" }}>
                SHIELD
              </span>
            </div>
          )}

          {/* Priest Sacred Ground Cooldown */}
          {className === "Priest" && sacredGroundCooldown.remaining > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ fontSize: "10px", color: "#ffdd88", fontWeight: "bold", letterSpacing: "1px" }}>
                HOLY
              </div>
              <div
                style={{
                  width: "80px",
                  height: "8px",
                  backgroundColor: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255, 221, 136, 0.3)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${((sacredGroundCooldown.total - sacredGroundCooldown.remaining) / sacredGroundCooldown.total) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(to right, #886600, #ffdd88)",
                    transition: "width 0.15s ease-out",
                    borderRadius: "2px",
                  }}
                />
              </div>
              <span style={{ fontSize: "10px", color: "#aaa" }}>
                {Math.ceil(sacredGroundCooldown.remaining / 1000)}s
              </span>
            </div>
          )}
        </div>

        {/* Center section: HP (left) + Speed (right) */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px", flexShrink: 0 }}>
          {/* HP */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ fontSize: "11px", color: themeColor, fontWeight: "bold", letterSpacing: "1px" }}>
              {className}
            </div>
            <div
              style={{
                width: "140px",
                height: "16px",
                backgroundColor: "rgba(20, 0, 0, 0.6)",
                border: "1px solid rgba(180, 40, 40, 0.5)",
                borderRadius: "4px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: `${healthPercentage}%`,
                  height: "100%",
                  background: "linear-gradient(to right, #4a0000, #8b0000, #cc1a1a, #e63939)",
                  transition: "width 0.3s ease-in-out",
                  borderRadius: "3px",
                  boxShadow: "inset 0 1px 2px rgba(255,150,150,0.3), inset 0 -2px 4px rgba(0,0,0,0.4)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "1px",
                    left: "3px",
                    right: "3px",
                    height: "4px",
                    background: "linear-gradient(to right, rgba(255,180,180,0.05), rgba(255,180,180,0.25), rgba(255,180,180,0.05))",
                    borderRadius: "2px",
                  }}
                />
                {BUBBLES.slice(0, 5).map((b, i) => (
                  <div
                    key={i}
                    className="health-bubble"
                    style={{
                      left: b.left,
                      bottom: 0,
                      width: `${b.size}px`,
                      height: `${b.size}px`,
                      animationDuration: `${b.duration}s`,
                      animationDelay: `${b.delay}s`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: themeColor, minWidth: "60px" }}>
              {health}/{maxHealth}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "28px", background: "rgba(255,255,255,0.12)" }} />

          {/* Speed */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ fontSize: "10px", color: "#888", fontWeight: "bold", letterSpacing: "1px" }}>
              SPD
            </div>
            <div
              style={{
                width: "80px",
                height: "8px",
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (speed / maxSpeed) * 100)}%`,
                  height: "100%",
                  background: getSpeedColor(speed, maxSpeed),
                  transition: "width 0.1s, background 0.1s",
                  borderRadius: "3px",
                }}
              />
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "bold",
                color: getSpeedColor(speed, maxSpeed),
                minWidth: "36px",
                textAlign: "right",
              }}
            >
              {speed}
            </div>
          </div>
        </div>

        {/* Right section: Style + Altitude/Biome */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: "1 1 0", justifyContent: "flex-end" }}>
          {/* Style Meter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: tierColor,
                lineHeight: 1,
              }}
            >
              {styleTier}
            </div>
            <div
              style={{
                width: "70px",
                height: "8px",
                backgroundColor: "rgba(0,0,0,0.5)",
                border: `1px solid ${tierColor}44`,
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
                  boxShadow: `0 0 6px ${tierColor}66`,
                  borderRadius: "2px",
                }}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" }} />

          {/* Altitude + Biome */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold", color: themeColor }}>
                {Math.floor(altitude)}m
              </span>
              {progressDistanceToBoss <= 300 && !bossActive && (
                <span style={{
                  fontSize: "10px",
                  fontWeight: "bold",
                  color: "#ff4444",
                  textShadow: "0 0 6px rgba(255, 68, 68, 0.5)",
                  animation: "hud-pulse 1.2s ease-in-out infinite",
                }}>
                  BOSS {progressDistanceToBoss}m
                </span>
              )}
            </div>
            <div style={{
              fontSize: "9px",
              color: getBiomeColor(currentBiome),
              opacity: 0.7,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
            }}>
              {formatBiomeName(currentBiome)}
            </div>
          </div>
        </div>
      </div>

      {/* Combo Meter */}
      {comboCount > 0 && (
        <div
          style={{
            position: "absolute",
            right: "40px",
            top: "50%",
            transform: "translateY(-50%)",
            textAlign: "center",
            fontFamily: "monospace",
            pointerEvents: "none",
            zIndex: 15,
            animation: "combo-pulse 0.15s ease-out",
          }}
          key={`combo-${comboCount}`}
        >
          <div
            style={{
              fontSize: `${Math.min(72, 36 + comboCount * 2)}px`,
              fontWeight: "bold",
              color: comboColor,
              textShadow: `0 0 20px ${comboColor}, 0 0 40px ${comboColor}44`,
            }}
          >
            {comboCount}
          </div>
          <div
            style={{
              fontSize: "14px",
              color: "#aaa",
              letterSpacing: "2px",
            }}
          >
            COMBO
          </div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: comboColor,
              opacity: 0.9,
              textShadow: `0 0 10px ${comboColor}88`,
              marginTop: "2px",
            }}
          >
            {comboMultiplier.toFixed(1)}x
          </div>
          {comboMultiplier > 1.0 && (
            <div
              style={{
                fontSize: "11px",
                color: comboColor,
                opacity: 0.6,
                letterSpacing: "1px",
                marginTop: "2px",
              }}
            >
              ESSENCE BONUS
            </div>
          )}
        </div>
      )}

      {/* Combo String Name */}
      {comboName && (
        <div
          style={{
            position: "absolute",
            right: 50,
            top: "40%",
            color: "#ffd700",
            fontSize: "18px",
            fontWeight: "bold",
            fontFamily: "monospace",
            textShadow: "0 0 8px #ffa500, 0 0 16px rgba(255, 165, 0, 0.4)",
            pointerEvents: "none",
            zIndex: 15,
            letterSpacing: "1px",
          }}
        >
          {comboName}
        </div>
      )}

      {/* Vertical Progress Bar — right edge */}
      {!bossActive && (
        <div style={{
          position: 'absolute',
          right: 10,
          top: '30%',
          height: '200px',
          width: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          fontFamily: 'monospace',
          zIndex: 10,
        }}>
          {/* Boss altitude label */}
          <div style={{
            fontSize: '9px',
            color: '#ff6666',
            marginBottom: '2px',
            whiteSpace: 'nowrap',
          }}>
            {Math.floor(nextBossAlt)}m
          </div>

          {/* Bar background */}
          <div style={{
            width: '4px',
            height: '100%',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '2px',
            position: 'relative',
          }}>
            {/* Boss marker at top */}
            <div style={{
              position: 'absolute',
              bottom: `${bossProgressPercent}%`,
              left: '-6px',
              width: '16px',
              height: '3px',
              background: '#ff4444',
              borderRadius: '1px',
              boxShadow: '0 0 4px #ff4444',
              transform: 'translateY(50%)',
            }} />

            {/* Player position marker */}
            <div style={{
              position: 'absolute',
              bottom: `${playerProgressPercent}%`,
              left: '-4px',
              width: '12px',
              height: '4px',
              background: '#44ff44',
              borderRadius: '2px',
              boxShadow: '0 0 4px #44ff44',
              transform: 'translateY(50%)',
            }} />
          </div>

          {/* Distance to boss label */}
          <div style={{
            fontSize: '10px',
            color: progressDistanceToBoss <= 300 ? '#ff4444' : '#ff6666',
            marginTop: '4px',
            whiteSpace: 'nowrap',
            fontWeight: progressDistanceToBoss <= 300 ? 'bold' : 'normal',
            textShadow: progressDistanceToBoss <= 300 ? '0 0 6px rgba(255, 68, 68, 0.6)' : 'none',
          }}>
            {progressDistanceToBoss}m
          </div>
        </div>
      )}
    </>
  );
};

export default GameHUD;

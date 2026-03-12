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

  const healthPercentage = (health / maxHealth) * 100;
  const tierColor = TIER_COLORS[styleTier] || "#666";

  // Combo color progression
  const comboColor =
    comboCount >= 10
      ? "#ff4444"
      : comboCount >= 6
        ? "#ff8800"
        : comboCount >= 3
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

  // Combo string name display
  const [comboName, setComboName] = useState<string | null>(null);
  const comboNameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Progress indicator state
  const [progressData, setProgressData] = useState<{
    altitude: number;
    nextBossAltitude: number;
    biome: string;
  } | null>(null);

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

    const unsubWarning = EventBus.on("boss-warning", (data) => {
      // Update distance indicator continuously
      setBossDistance(Math.floor(data.distance));

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
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (comboNameTimerRef.current) clearTimeout(comboNameTimerRef.current);
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

      {/* Top Bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          padding: "10px 16px",
          pointerEvents: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          fontFamily: "monospace",
          color: "white",
          textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
          zIndex: 10,
        }}
      >
        {/* Left: Health */}
        <div
          style={{
            ...glassStyle,
            padding: "12px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            minWidth: "240px",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: "bold", letterSpacing: "1px", color: themeColor }}>
            HP: {health} / {maxHealth}
          </div>

          {/* Health Bar */}
          <div
            style={{
              width: "210px",
              height: "22px",
              backgroundColor: "rgba(20, 0, 0, 0.6)",
              border: "1px solid rgba(180, 40, 40, 0.5)",
              borderRadius: "6px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Blood red gradient fill */}
            <div
              style={{
                width: `${healthPercentage}%`,
                height: "100%",
                background: "linear-gradient(to right, #4a0000, #8b0000, #cc1a1a, #e63939)",
                transition: "width 0.3s ease-in-out",
                position: "relative",
                borderRadius: "5px",
                boxShadow: "inset 0 1px 2px rgba(255,150,150,0.3), inset 0 -2px 4px rgba(0,0,0,0.4)",
              }}
            >
              {/* Specular highlight */}
              <div
                style={{
                  position: "absolute",
                  top: "2px",
                  left: "4px",
                  right: "4px",
                  height: "5px",
                  background: "linear-gradient(to right, rgba(255,180,180,0.05), rgba(255,180,180,0.25), rgba(255,180,180,0.05))",
                  borderRadius: "3px",
                }}
              />
              {/* Bubbles */}
              {BUBBLES.map((b, i) => (
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

          <div style={{ fontSize: "13px", color: themeColor, opacity: 0.85 }}>
            {className}
          </div>
        </div>

        {/* Right: Altitude + Style + Boss Distance */}
        <div
          style={{
            ...glassStyle,
            padding: "12px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignItems: "flex-end",
            minWidth: "200px",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: "bold", letterSpacing: "1px", color: themeColor }}>
            {Math.floor(altitude)}m
            {progressDistanceToBoss <= 300 && !bossActive && (
              <span style={{ color: '#ff4444', fontSize: '12px' }}>
                {' '}| BOSS IN {progressDistanceToBoss}m
              </span>
            )}
          </div>

          {/* Biome Indicator */}
          <div style={{
            fontSize: '10px',
            color: getBiomeColor(currentBiome),
            opacity: 0.7,
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}>
            {formatBiomeName(currentBiome)}
          </div>

          {/* Boss Distance Indicator */}
          {bossDistance !== null && (
            <div
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "#ff2222",
                letterSpacing: "1px",
                textShadow: "0 0 8px rgba(255, 34, 34, 0.6)",
                animation: "hud-pulse 1.2s ease-in-out infinite",
              }}
            >
              BOSS IN {bossDistance}m
            </div>
          )}

          {/* Style Meter */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: tierColor,
                minWidth: "24px",
                textAlign: "center",
              }}
            >
              {styleTier}
            </div>
            <div
              style={{
                width: "110px",
                height: "14px",
                backgroundColor: "rgba(0,0,0,0.4)",
                border: `1px solid ${tierColor}44`,
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${styleMeter}%`,
                  height: "100%",
                  backgroundColor: tierColor,
                  transition: "width 0.15s ease-out, background-color 0.3s",
                  boxShadow: `0 0 8px ${tierColor}66`,
                }}
              />
            </div>
          </div>

          {/* Essence Counter */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "2px",
              transform: essenceFlash ? "scale(1.15)" : "scale(1)",
              transition: "transform 0.2s ease-out",
            }}
          >
            <span
              style={{
                fontSize: "16px",
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
                fontSize: "16px",
                fontWeight: "bold",
                color: essenceFlash ? "#dd66ff" : "#cc44ff",
                transition: "color 0.2s ease-out",
              }}
            >
              {essence}
            </span>
          </div>

          {/* Monk Flow Meter */}
          {className === "Monk" && flowMaxFlow > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color:
                    flowMeter >= 100
                      ? "#ff4444"
                      : flowMeter >= 75
                        ? "#ffaa00"
                        : flowMeter >= 50
                          ? "#ffcc44"
                          : flowMeter >= 25
                            ? "#ffdd88"
                            : "#888",
                  fontWeight: "bold",
                  minWidth: "36px",
                  textAlign: "right",
                }}
              >
                FLOW
              </div>
              <div
                style={{
                  width: "110px",
                  height: "10px",
                  backgroundColor: "rgba(0,0,0,0.4)",
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
                        ? "0 0 8px rgba(255, 170, 0, 0.6)"
                        : "none",
                  }}
                />
              </div>
            </div>
          )}

          {/* Paladin Shield Guard Indicator */}
          {className === "Paladin" && isShieldGuarding && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "4px",
                animation: "hud-pulse 1.2s ease-in-out infinite",
              }}
            >
              <span
                style={{
                  fontSize: "18px",
                  color: "#4488ff",
                  textShadow: "0 0 10px rgba(68, 136, 255, 0.8)",
                }}
              >
                &#9711;
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#4488ff",
                  letterSpacing: "1px",
                }}
              >
                SHIELD
              </span>
            </div>
          )}

          {/* Priest Sacred Ground Cooldown */}
          {className === "Priest" && sacredGroundCooldown.remaining > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#ffdd88",
                  fontWeight: "bold",
                  minWidth: "36px",
                  textAlign: "right",
                }}
              >
                HOLY
              </div>
              <div
                style={{
                  width: "110px",
                  height: "10px",
                  backgroundColor: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255, 221, 136, 0.3)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${((sacredGroundCooldown.total - sacredGroundCooldown.remaining) / sacredGroundCooldown.total) * 100}%`,
                    height: "100%",
                    background:
                      "linear-gradient(to right, #886600, #ffdd88)",
                    transition: "width 0.15s ease-out",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "#aaa",
                }}
              >
                {Math.ceil(sacredGroundCooldown.remaining / 1000)}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          padding: "10px 16px",
          pointerEvents: "none",
          display: "flex",
          justifyContent: "center",
          fontFamily: "monospace",
          color: "white",
          textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
          zIndex: 10,
        }}
      >
        <div
          style={{
            ...glassStyle,
            padding: "8px 18px",
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
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
                    fontSize: "11px",
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
          }}
        >
          <div
            style={{
              fontSize: `${Math.min(72, 36 + comboCount * 4)}px`,
              fontWeight: "bold",
              color: comboColor,
              textShadow: `0 0 20px ${comboColor}`,
            }}
          >
            {comboCount}
          </div>
          <div
            style={{
              fontSize: "20px",
              color: comboColor,
              opacity: 0.8,
            }}
          >
            {comboMultiplier.toFixed(1)}x
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

      {/* Speed Meter */}
      {GameSettings.get().showSpeedMeter && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          pointerEvents: 'none',
          fontFamily: 'monospace',
          zIndex: 10,
        }}>
          <div style={{ fontSize: '11px', color: '#888' }}>SPEED</div>
          <div style={{
            width: '60px',
            height: '8px',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, (speed / maxSpeed) * 100)}%`,
              height: '100%',
              background: getSpeedColor(speed, maxSpeed),
              transition: 'width 0.1s, background 0.1s',
              borderRadius: '4px',
            }} />
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: getSpeedColor(speed, maxSpeed),
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
          }}>
            {speed}
          </div>
        </div>
      )}
    </>
  );
};

export default GameHUD;

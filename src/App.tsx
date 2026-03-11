import { useState, useEffect, useRef, useCallback } from "react";
import Phaser from "phaser";
import { MainScene } from "./game/scenes/MainScene";
import GameHUD from "./game/ui/GameHUD";
import { ClassSelect } from "./game/ui/ClassSelect";
import { PauseMenu } from "./game/ui/PauseMenu";
import { DeathScreen } from "./game/ui/DeathScreen";
import { ShopUI } from "./game/ui/ShopUI";
import { GamblingUI } from "./game/ui/GamblingUI";
import { ItemReplaceUI } from "./game/ui/ItemReplaceUI";
import { CLASSES } from "./game/config/ClassConfig";
import type { ClassType } from "./game/config/ClassConfig";
import type { ItemData } from "./game/config/ItemConfig";
import { ActiveModifiers } from "./game/config/RunModifiers";
import { EventBus } from "./game/systems/EventBus";
import type { ShopOffering } from "./game/systems/EventBus";
import { RunModifierSelect } from "./game/ui/RunModifierSelect";
import { AchievementManager } from "./game/systems/AchievementManager";
import { AchievementPopup } from "./game/ui/AchievementPopup";
import { PersistentStats } from "./game/systems/PersistentStats";
import "./App.css";

type GameState = "CLASS_SELECT" | "MODIFIERS" | "PLAYING" | "DEATH";

interface DeathStats {
  altitude: number;
  kills: number;
  bossesDefeated: number;
  timeMs: number;
  essenceEarned: number;
}

function App() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [gameState, setGameState] = useState<GameState>("CLASS_SELECT");
  const [selectedClass, setSelectedClass] = useState<ClassType | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [health, setHealth] = useState(3);
  const [maxHealth, setMaxHealth] = useState(3);
  const [altitude, setAltitude] = useState(0);
  const [inventory, setInventory] = useState<ItemData[]>([]);
  const [styleMeter, setStyleMeter] = useState(0);
  const [styleTier, setStyleTier] = useState("D");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [essence, setEssence] = useState(0);
  const [deathStats, setDeathStats] = useState<DeathStats | null>(null);
  const [comboCount, setComboCount] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1.0);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopOfferings, setShopOfferings] = useState<ShopOffering[]>([]);
  const [flowMeter, setFlowMeter] = useState(0);
  const [flowMaxFlow, setFlowMaxFlow] = useState(100);
  const [isShieldGuarding, setIsShieldGuarding] = useState(false);
  const [sacredGroundCooldown, setSacredGroundCooldown] = useState<{
    remaining: number;
    total: number;
  }>({ remaining: 0, total: 15000 });
  const [gamblingOpen, setGamblingOpen] = useState(false);
  const [gamblingEssence, setGamblingEssence] = useState(0);
  const [achievementPopup, setAchievementPopup] = useState<{
    name: string;
    description: string;
    icon: string;
  } | null>(null);
  const [achievementQueue, setAchievementQueue] = useState<
    { name: string; description: string; icon: string }[]
  >([]);
  const maxComboRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const elapsedTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  // Load achievement data on mount
  useEffect(() => {
    AchievementManager.load();
  }, []);

  // Process achievement popup queue — show next when current is dismissed
  useEffect(() => {
    if (achievementPopup === null && achievementQueue.length > 0) {
      const [next, ...rest] = achievementQueue;
      setAchievementPopup(next);
      setAchievementQueue(rest);
    }
  }, [achievementPopup, achievementQueue]);

  const handleClassSelect = useCallback((classType: ClassType) => {
    setSelectedClass(classType);
    (window as any).__selectedClass = classType;
    setGameState("MODIFIERS");
  }, []);

  const handleModifiersConfirm = useCallback((modifierIds: string[]) => {
    ActiveModifiers.setModifiers(modifierIds);
    setGameState("PLAYING");
    startTimeRef.current = Date.now();
    elapsedTimeRef.current = 0;
  }, []);

  const togglePause = useCallback(() => {
    if (gameState !== "PLAYING") return;

    setIsPaused((prev) => {
      const next = !prev;
      const scene = gameRef.current?.scene.getScene("MainScene");
      if (scene) {
        if (next) {
          pausedAtRef.current = Date.now();
          elapsedTimeRef.current = pausedAtRef.current - startTimeRef.current;
          scene.scene.pause();
        } else {
          // Adjust start time to account for pause duration
          const pauseDuration = Date.now() - pausedAtRef.current;
          startTimeRef.current += pauseDuration;
          scene.scene.resume();
        }
      }
      return next;
    });
  }, [gameState]);

  const handleResume = useCallback(() => {
    togglePause();
  }, [togglePause]);

  const handleRestart = useCallback(() => {
    setIsPaused(false);
    setHealth(3);
    setMaxHealth(3);
    setAltitude(0);
    setInventory([]);
    setStyleMeter(0);
    setStyleTier("D");
    setEssence(0);
    setComboCount(0);
    setComboMultiplier(1.0);
    setDeathStats(null);
    setShopOpen(false);
    setShopOfferings([]);
    setFlowMeter(0);
    setFlowMaxFlow(100);
    setIsShieldGuarding(false);
    setSacredGroundCooldown({ remaining: 0, total: 15000 });
    setGamblingOpen(false);
    setGamblingEssence(0);
    ActiveModifiers.clear();
    gameRef.current?.destroy(true);
    gameRef.current = null;
    setGameState("CLASS_SELECT");
    setSelectedClass(null);
  }, []);

  const handleQuit = useCallback(() => {
    setIsPaused(false);
    gameRef.current?.destroy(true);
    gameRef.current = null;
    setHealth(3);
    setMaxHealth(3);
    setAltitude(0);
    setInventory([]);
    setStyleMeter(0);
    setStyleTier("D");
    setEssence(0);
    setComboCount(0);
    setComboMultiplier(1.0);
    setDeathStats(null);
    setShopOpen(false);
    setShopOfferings([]);
    setFlowMeter(0);
    setFlowMaxFlow(100);
    setIsShieldGuarding(false);
    setSacredGroundCooldown({ remaining: 0, total: 15000 });
    setGamblingOpen(false);
    setGamblingEssence(0);
    ActiveModifiers.clear();
    setGameState("CLASS_SELECT");
    setSelectedClass(null);
  }, []);

  // Retry from death screen - restart with the same class
  const handleDeathRetry = useCallback(() => {
    setDeathStats(null);
    setEssence(0);
    setHealth(3);
    setMaxHealth(3);
    setAltitude(0);
    setInventory([]);
    setStyleMeter(0);
    setStyleTier("D");
    setComboCount(0);
    setComboMultiplier(1.0);
    setShopOpen(false);
    setShopOfferings([]);
    setFlowMeter(0);
    setFlowMaxFlow(100);
    setIsShieldGuarding(false);
    setSacredGroundCooldown({ remaining: 0, total: 15000 });
    setGamblingOpen(false);
    setGamblingEssence(0);
    ActiveModifiers.clear();
    gameRef.current?.destroy(true);
    gameRef.current = null;
    setGameState("PLAYING"); // Triggers game recreation with same class
  }, []);

  // Shop purchase handler
  const handleShopPurchase = useCallback(
    (offering: ShopOffering) => {
      if (essence < offering.cost) return;
      setEssence((prev) => prev - offering.cost);
      EventBus.emit("shop-purchase", {
        offeringId: offering.id,
        cost: offering.cost,
      });
    },
    [essence],
  );

  // Shop close handler
  const handleShopClose = useCallback(() => {
    setShopOpen(false);
    const scene = gameRef.current?.scene.getScene("MainScene");
    if (scene) scene.scene.resume();
  }, []);

  // Gambling close handler
  const handleGamblingClose = useCallback(() => {
    setGamblingOpen(false);
  }, []);

  // Escape key handler
  useEffect(() => {
    if (gameState !== "PLAYING") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPaused((prev) => {
          const next = !prev;
          const scene = gameRef.current?.scene.getScene("MainScene");
          if (scene) {
            if (next) {
              pausedAtRef.current = Date.now();
              elapsedTimeRef.current = pausedAtRef.current - startTimeRef.current;
              scene.scene.pause();
            } else {
              const pauseDuration = Date.now() - pausedAtRef.current;
              startTimeRef.current += pauseDuration;
              scene.scene.resume();
            }
          }
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState]);

  // Elapsed time tracking
  useEffect(() => {
    if (gameState !== "PLAYING" || isPaused) return;
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, isPaused]);

  // Player died event handler — now handled via show-death-screen
  // Keep listening to reset HUD state when scene restarts in background
  useEffect(() => {
    const unsubscribe = EventBus.on("player-died", () => {
      // Scene restarts automatically in Player.ts, but we show the death screen overlay
      // Don't reset state here — the death screen or retry handler will do that
    });
    return unsubscribe;
  }, []);

  // Counter incremented each time we need to create a new Phaser game
  const [gameSessionId, setGameSessionId] = useState(0);

  // Trigger new game session when entering PLAYING without an active game
  useEffect(() => {
    if (gameState === "PLAYING" && !gameRef.current) {
      setGameSessionId((prev) => prev + 1);
    }
  }, [gameState]);

  // Phaser game creation — keyed on gameSessionId so it persists through DEATH
  useEffect(() => {
    if (gameSessionId === 0) return;
    if (gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1920,
      height: 1080,
      parent: "phaser-game",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 1000 },
          debug: false,
        },
      },
      scene: [MainScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    gameRef.current = new Phaser.Game(config);

    // Event Listeners
    const handleHealthChange = (e: CustomEvent) => {
      setHealth(e.detail.health);
      if (e.detail.maxHealth) setMaxHealth(e.detail.maxHealth);
    };

    const handleAltitudeChange = (e: CustomEvent) => {
      setAltitude(e.detail.altitude);
    };

    const handleInventoryChange = (e: CustomEvent) => {
      setInventory(e.detail.inventory);
    };

    const handleStyleChange = (e: CustomEvent) => {
      setStyleMeter(e.detail.meter);
      setStyleTier(e.detail.tier);
    };

    window.addEventListener(
      "health-change",
      handleHealthChange as EventListener,
    );
    window.addEventListener(
      "altitude-change",
      handleAltitudeChange as EventListener,
    );
    window.addEventListener(
      "inventory-change",
      handleInventoryChange as EventListener,
    );
    window.addEventListener("style-change", handleStyleChange as EventListener);

    const handleComboUpdate = (e: CustomEvent) => {
      setComboCount(e.detail.count);
      setComboMultiplier(e.detail.multiplier);
    };

    const handleEssenceChange = (e: CustomEvent) => {
      setEssence(e.detail.essence);
    };

    const handleDeathScreen = (e: CustomEvent) => {
      setDeathStats(e.detail);
      setGameState("DEATH");
    };

    const handleShopOpen = (e: CustomEvent) => {
      setShopOfferings(e.detail.offerings);
      setShopOpen(true);
    };

    const handleGamblingOpen = (e: CustomEvent) => {
      setGamblingEssence(e.detail.essence);
      setGamblingOpen(true);
    };

    window.addEventListener(
      "combo-update",
      handleComboUpdate as EventListener,
    );
    window.addEventListener(
      "essence-change",
      handleEssenceChange as EventListener,
    );
    window.addEventListener(
      "show-death-screen",
      handleDeathScreen as EventListener,
    );
    window.addEventListener(
      "shop-open",
      handleShopOpen as EventListener,
    );
    window.addEventListener(
      "gambling-open",
      handleGamblingOpen as EventListener,
    );

    // Class mechanic event listeners
    const handleFlowChange = (e: CustomEvent) => {
      setFlowMeter(e.detail.flow);
      setFlowMaxFlow(e.detail.maxFlow);
    };

    const handleShieldGuardChange = (e: CustomEvent) => {
      setIsShieldGuarding(e.detail.active);
    };

    const handleSacredGroundCooldown = (e: CustomEvent) => {
      setSacredGroundCooldown({
        remaining: e.detail.remaining,
        total: e.detail.total,
      });
    };

    window.addEventListener(
      "flow-change",
      handleFlowChange as EventListener,
    );
    window.addEventListener(
      "shield-guard-change",
      handleShieldGuardChange as EventListener,
    );
    window.addEventListener(
      "sacred-ground-cooldown",
      handleSacredGroundCooldown as EventListener,
    );

    return () => {
      window.removeEventListener(
        "health-change",
        handleHealthChange as EventListener,
      );
      window.removeEventListener(
        "altitude-change",
        handleAltitudeChange as EventListener,
      );
      window.removeEventListener(
        "inventory-change",
        handleInventoryChange as EventListener,
      );
      window.removeEventListener(
        "style-change",
        handleStyleChange as EventListener,
      );
      window.removeEventListener(
        "combo-update",
        handleComboUpdate as EventListener,
      );
      window.removeEventListener(
        "essence-change",
        handleEssenceChange as EventListener,
      );
      window.removeEventListener(
        "show-death-screen",
        handleDeathScreen as EventListener,
      );
      window.removeEventListener(
        "shop-open",
        handleShopOpen as EventListener,
      );
      window.removeEventListener(
        "flow-change",
        handleFlowChange as EventListener,
      );
      window.removeEventListener(
        "shield-guard-change",
        handleShieldGuardChange as EventListener,
      );
      window.removeEventListener(
        "sacred-ground-cooldown",
        handleSacredGroundCooldown as EventListener,
      );
      window.removeEventListener(
        "gambling-open",
        handleGamblingOpen as EventListener,
      );
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [gameSessionId]);

  return (
    <div
      className="App"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {gameState === "CLASS_SELECT" && (
        <ClassSelect onSelect={handleClassSelect} />
      )}
      {gameState === "MODIFIERS" && (
        <RunModifierSelect onConfirm={handleModifiersConfirm} />
      )}
      {(gameState === "PLAYING" || gameState === "DEATH") && (
        <>
          <div id="phaser-game" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />
          {gameState === "PLAYING" && (
            <>
              <GameHUD
                health={health}
                maxHealth={maxHealth}
                altitude={altitude}
                inventory={inventory}
                className={selectedClass ? CLASSES[selectedClass].name : undefined}
                styleMeter={styleMeter}
                styleTier={styleTier}
                essence={essence}
                comboCount={comboCount}
                comboMultiplier={comboMultiplier}
                flowMeter={flowMeter}
                flowMaxFlow={flowMaxFlow}
                isShieldGuarding={isShieldGuarding}
                sacredGroundCooldown={sacredGroundCooldown}
              />
              {isPaused && (
                <PauseMenu
                  altitude={altitude}
                  elapsedTime={elapsedTime}
                  itemCount={inventory.length}
                  onResume={handleResume}
                  onRestart={handleRestart}
                  onQuit={handleQuit}
                />
              )}
              {shopOpen && (
                <ShopUI
                  offerings={shopOfferings}
                  essence={essence}
                  onPurchase={handleShopPurchase}
                  onClose={handleShopClose}
                />
              )}
              {gamblingOpen && (
                <GamblingUI
                  essence={essence}
                  onClose={handleGamblingClose}
                />
              )}
            </>
          )}
          {gameState === "DEATH" && deathStats && (
            <DeathScreen
              {...deathStats}
              onRetry={handleDeathRetry}
              onMainMenu={handleQuit}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;

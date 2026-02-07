import { useState, useEffect, useRef, useCallback } from "react";
import Phaser from "phaser";
import { MainScene } from "./game/scenes/MainScene";
import GameHUD from "./game/ui/GameHUD";
import { ClassSelect } from "./game/ui/ClassSelect";
import { PauseMenu } from "./game/ui/PauseMenu";
import { CLASSES } from "./game/config/ClassConfig";
import type { ClassType } from "./game/config/ClassConfig";
import type { ItemData } from "./game/config/ItemConfig";
import "./App.css";

type GameState = "CLASS_SELECT" | "PLAYING";

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
  const startTimeRef = useRef<number>(0);
  const elapsedTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  const handleClassSelect = useCallback((classType: ClassType) => {
    setSelectedClass(classType);
    (window as any).__selectedClass = classType;
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
    setGameState("CLASS_SELECT");
    setSelectedClass(null);
  }, []);

  // Escape key handler
  useEffect(() => {
    if (gameState !== "PLAYING") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        togglePause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, togglePause]);

  // Phaser game creation
  useEffect(() => {
    if (gameState !== "PLAYING") return;
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
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [gameState]);

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
      {gameState === "PLAYING" && (
        <>
          <div id="phaser-game" style={{ width: "100%", height: "100%" }} />
          <GameHUD
            health={health}
            maxHealth={maxHealth}
            altitude={altitude}
            inventory={inventory}
            className={selectedClass ? CLASSES[selectedClass].name : undefined}
            styleMeter={styleMeter}
            styleTier={styleTier}
          />
          {isPaused && (
            <PauseMenu
              altitude={altitude}
              elapsedTime={elapsedTimeRef.current}
              itemCount={inventory.length}
              onResume={handleResume}
              onRestart={handleRestart}
              onQuit={handleQuit}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;

import { useState, useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { MainScene } from './game/scenes/MainScene'
import GameHUD from './game/ui/GameHUD'
import type { ItemData } from './game/config/ItemConfig'
import './App.css'

function App() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [health, setHealth] = useState(5);
  const [maxHealth, setMaxHealth] = useState(5);
  const [altitude, setAltitude] = useState(0);
  const [inventory, setInventory] = useState<ItemData[]>([]);

  useEffect(() => {
    if (gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1920,
      height: 1080,
      parent: 'phaser-game',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 1000 },
          debug: false
        }
      },
      scene: [MainScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
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

    window.addEventListener('health-change', handleHealthChange as EventListener);
    window.addEventListener('altitude-change', handleAltitudeChange as EventListener);
    window.addEventListener('inventory-change', handleInventoryChange as EventListener);

    return () => {
      window.removeEventListener('health-change', handleHealthChange as EventListener);
      window.removeEventListener('altitude-change', handleAltitudeChange as EventListener);
      window.removeEventListener('inventory-change', handleInventoryChange as EventListener);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="App" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div id="phaser-game" style={{ width: '100%', height: '100%' }} />
      <GameHUD health={health} maxHealth={maxHealth} altitude={altitude} inventory={inventory} />
    </div>
  )
}

export default App;

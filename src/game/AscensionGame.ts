import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';

export const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    parent: 'game-container',
    backgroundColor: '#1a1a1a',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 1000 },
            debug: true // Enable debug for now
        }
    },
    scene: [MainScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

export const createGame = () => {
    return new Phaser.Game(config);
};

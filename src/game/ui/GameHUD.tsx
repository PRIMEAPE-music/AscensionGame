import React from 'react';
import { InventoryUI } from './InventoryUI';
import type { ItemData } from '../config/ItemConfig';

interface GameHUDProps {
    health: number;
    maxHealth: number;
    altitude: number;
    inventory: ItemData[];
    className?: string;
}

export const GameHUD: React.FC<GameHUDProps> = ({ health, maxHealth, altitude, inventory, className = 'Monk' }) => {
    const healthPercentage = (health / maxHealth) * 100;
    const healthColor = healthPercentage > 30 ? '#4caf50' : '#f44336';

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            padding: '20px',
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'monospace',
            color: 'white',
            textShadow: '2px 2px 0 #000'
        }}>
            {/* Health Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>HP: {health} / {maxHealth}</div>
                <div style={{
                    width: '200px',
                    height: '20px',
                    backgroundColor: '#333',
                    border: '2px solid #fff',
                    borderRadius: '4px'
                }}>
                    <div style={{
                        width: `${healthPercentage}%`,
                        height: '100%',
                        backgroundColor: healthColor,
                        transition: 'width 0.2s ease-in-out, background-color 0.2s'
                    }} />
                </div>
                <div style={{ fontSize: '18px', color: '#aaa' }}>Class: {className}</div>
                <InventoryUI items={inventory} />
            </div>

            {/* Altitude Section */}
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>ALTITUDE: {Math.floor(altitude)}m</div>
            </div>
        </div>
    );
};

export default GameHUD;

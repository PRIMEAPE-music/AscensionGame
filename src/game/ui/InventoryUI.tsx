import React from 'react';
import type { ItemData } from '../config/ItemConfig';

interface InventoryUIProps {
    items: ItemData[];
}

export const InventoryUI: React.FC<InventoryUIProps> = ({ items }) => {
    return (
        <div style={{
            display: 'flex',
            gap: '10px',
            padding: '5px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
            marginTop: '10px',
            minHeight: '40px',
            alignItems: 'center'
        }}>
            {items.map((item, index) => (
                <div key={`${item.id}-${index}`} title={item.name + '\n' + item.description} style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: '#' + item.iconColor.toString(16).padStart(6, '0'),
                    border: `2px solid ${item.type === 'GOLD' ? '#ffd700' : '#c0c0c0'}`,
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'help',
                    boxShadow: '0 0 5px rgba(0,0,0,0.5)'
                }}>
                    {item.name[0]}
                </div>
            ))}
            {items.length === 0 && <span style={{ color: '#aaa', fontSize: '12px', padding: '0 5px' }}>Inventory</span>}
        </div>
    );
};

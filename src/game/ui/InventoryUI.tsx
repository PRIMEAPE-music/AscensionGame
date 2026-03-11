import React from 'react';
import type { ItemData } from '../config/ItemConfig';
import { QUALITY_COLORS, QUALITY_LABELS } from '../config/ItemConfig';

interface InventoryUIProps {
    items: ItemData[];
}

function getItemBorderColor(item: ItemData): string {
    if (item.type === 'GOLD') return '#ffd700';
    if (item.quality) return QUALITY_COLORS[item.quality];
    return '#ffffff'; // default NORMAL
}

function getItemTooltip(item: ItemData): string {
    const qualityLabel = item.quality && item.quality !== 'NORMAL'
        ? ` [${QUALITY_LABELS[item.quality]}]`
        : '';
    return `${item.name}${qualityLabel}\n${item.description}`;
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
            {items.map((item) => {
                const borderColor = getItemBorderColor(item);
                return (
                    <div key={item.id} title={getItemTooltip(item)} style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: '#' + item.iconColor.toString(16).padStart(6, '0'),
                        border: `2px solid ${borderColor}`,
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'help',
                        boxShadow: `0 0 5px ${borderColor}44`
                    }}>
                        {item.name[0]}
                    </div>
                );
            })}
            {items.length === 0 && <span style={{ color: '#aaa', fontSize: '12px', padding: '0 5px' }}>Inventory</span>}
        </div>
    );
};

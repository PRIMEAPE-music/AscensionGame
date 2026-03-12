import React from 'react';
import type { ItemData } from '../config/ItemConfig';
import { QUALITY_COLORS, QUALITY_LABELS } from '../config/ItemConfig';

interface InventoryUIProps {
    items: ItemData[];
    maxSlots?: number;
}

function getItemBorderColor(item: ItemData): string {
    if (item.type === 'CURSED') return '#9933cc';
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

export const InventoryUI: React.FC<InventoryUIProps> = ({ items, maxSlots = 1 }) => {
    // Separate items by type for slot display
    const silverItems = items.filter(i => i.type === 'SILVER');
    const goldItems = items.filter(i => i.type === 'GOLD');
    const cursedItems = items.filter(i => i.type === 'CURSED');
    const emptySlotCount = Math.max(0, maxSlots - silverItems.length);

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
            {/* Gold items (no slot limit) */}
            {goldItems.map((item) => {
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
            {/* Cursed items (no slot limit, purple border) */}
            {cursedItems.map((item) => {
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
                        boxShadow: `0 0 8px ${borderColor}88, inset 0 0 4px rgba(0,0,0,0.5)`
                    }}>
                        {item.name[0]}
                    </div>
                );
            })}
            {/* Divider between gold/cursed and silver if both present */}
            {(goldItems.length > 0 || cursedItems.length > 0) && (silverItems.length > 0 || emptySlotCount > 0) && (
                <div style={{
                    width: '1px',
                    height: '24px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }} />
            )}
            {/* Silver items (filled slots) */}
            {silverItems.map((item) => {
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
            {/* Empty silver item slots */}
            {Array.from({ length: emptySlotCount }).map((_, i) => (
                <div key={`empty-${i}`} title="Empty silver item slot" style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: 'transparent',
                    border: '2px dashed rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.15)',
                    fontSize: '14px',
                    fontWeight: 'bold',
                }}>
                    +
                </div>
            ))}
            {items.length === 0 && emptySlotCount === 0 && <span style={{ color: '#aaa', fontSize: '12px', padding: '0 5px' }}>Inventory</span>}
        </div>
    );
};

// components/inventory/InventoryGridItem.tsx

import React from 'react';
import { Item, getItemRarityColor } from '../../types';
import { Icon } from '../Icon';
import { getSlotSynonym, getSlotBackgroundImageUrl } from '../../utils/slotUtils';

interface InventoryGridItemProps {
    item: Item;
    onClick: () => void;
    onLongPress?: () => void;
    isSelected?: boolean;
    isSelectionMode?: boolean;
}

export const InventoryGridItem: React.FC<InventoryGridItemProps> = ({ 
    item, 
    onClick, 
    onLongPress, 
    isSelected, 
    isSelectionMode 
}) => {
    const rarityColorClass = getItemRarityColor(item.rarity);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const handleTouchStart = () => {
        if (!onLongPress || isSelectionMode) return;
        timerRef.current = setTimeout(() => {
            onLongPress();
        }, 600);
    };

    const handleTouchEnd = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const slotLabel = React.useMemo(() => {
        if (!item.bodySlotTag) return '';
        return getSlotSynonym(item.bodySlotTag, item.tags || []);
    }, [item.bodySlotTag, item.tags]);

    const bgUrl = getSlotBackgroundImageUrl(item.bodySlotTag, item.tags || []);
    const bgStyle = bgUrl ? {
        backgroundImage: `linear-gradient(rgba(18, 18, 18, 0.8), rgba(18, 18, 18, 0.8)), url('${bgUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    } : {};

    return (
        <button
            onClick={onClick}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={`
                relative w-full aspect-square bg-brand-bg border border-brand-primary/30 rounded-lg flex flex-col items-center justify-center p-2
                transition-all duration-200 active:scale-95 hover:bg-brand-surface group
                ${isSelected ? 'ring-2 ring-brand-accent bg-brand-accent/5' : ''}
                ${isSelectionMode && !isSelected ? 'opacity-60' : ''}
            `}
            style={bgStyle}
            title={`${item.name}${slotLabel ? ` (${slotLabel})` : ''}`}
        >
            {/* Selection Checkmark - Top Right */}
            {isSelectionMode && (
                <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors z-20 ${isSelected ? 'bg-brand-accent border-brand-accent' : 'border-brand-primary bg-brand-bg'}`}>
                    {isSelected && <Icon name="check" className="w-2.5 h-2.5 text-black" />}
                </div>
            )}

            {/* Label */}
            <div className="w-full px-1 overflow-hidden pointer-events-none text-center relative z-10">
                <p className={`text-body-tiny font-bold leading-tight line-clamp-3 overflow-hidden text-ellipsis transition-opacity ${rarityColorClass}`}>
                    {item.name}
                </p>
            </div>
            
            {/* Quantity Badge - Top-Left */}
            {item.quantity && item.quantity > 1 && (
                <div className="absolute top-1.5 left-1.5 bg-brand-surface border border-brand-primary px-1 rounded-md text-body-micro text-brand-accent tabular-nums z-20">
                    x{item.quantity}
                </div>
            )}

            {/* New Badge - Top-Right */}
            {item.isNew && !isSelectionMode && (
                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_5px_#3ecf8e] animate-pulse z-20" />
            )}
            
            {/* Immersive Slot Overlay (Low Opacity) */}
            {slotLabel && !isSelectionMode && (
                <div className="absolute bottom-1 w-full text-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <span className="text-body-micro text-brand-accent bg-brand-bg/80 px-1.5 py-0.5 rounded border border-brand-accent/20">
                        {slotLabel}
                    </span>
                </div>
            )}
        </button>
    );
};
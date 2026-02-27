// components/BodyPaperDoll.tsx

import React from 'react';
import { BodySlot, Item, BODY_SLOTS, WorldStyle, getItemRarityColor } from '../types';
import { Icon } from './Icon';
import { getSlotSynonym, getSlotBackgroundImageUrl } from '../utils/slotUtils';

interface BodyPaperDollProps {
    equippedItems: Item[];
    onSlotClick: (slot: BodySlot) => void;
    onItemClick: (item: Item) => void;
    selectionMode?: boolean;
    isShip?: boolean;
    isMount?: boolean;
    setting?: WorldStyle;
    validSlotTag?: BodySlot | string; 
}

const isSlotCompatible = (tag: string | undefined, slot: string): boolean => {
    if (!tag) return true; 
    
    const t = tag.toLowerCase().trim();
    const s = slot.toLowerCase().trim();

    if (t === s) return true; 

    const RING_SLOTS = ['ring 1', 'ring 2'];
    const ACC_SLOTS = ['accessory 1', 'accessory 2'];
    const HAND_SLOTS = ['main hand', 'off hand'];

    if (t === 'ring' && RING_SLOTS.includes(s)) return true;
    if (t === 'accessory' && ACC_SLOTS.includes(s)) return true;
    
    // Weapon slot logic: Light and Medium can go in either. Heavy is restricted to Main.
    if (t === 'heavy weapon') {
        return s === 'main hand';
    }
    
    // Updated to allow "Main Hand" and "Off Hand" tags to be compatible with both hand slots
    const weaponTags = ['hand', 'weapon', 'light weapon', 'medium weapon', 'main hand', 'off hand'];
    if (weaponTags.includes(t) && HAND_SLOTS.includes(s)) return true;

    if (RING_SLOTS.includes(t) && RING_SLOTS.includes(s)) return true;
    if (ACC_SLOTS.includes(t) && ACC_SLOTS.includes(s)) return true;

    return false;
};

const SlotBox: React.FC<{ 
    slot: BodySlot, 
    item?: Item, 
    onClick: () => void,
    onItemClick: () => void,
    selectionMode?: boolean,
    label: string,
    isCompatible?: boolean,
    isLocked?: boolean
}> = ({ slot, item, onClick, onItemClick, selectionMode, label, isCompatible = true, isLocked = false }) => {
    
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLocked) return;
        if (selectionMode) {
            if (isCompatible) onClick(); 
        } else if (item) {
            onItemClick();
        }
    };

    const rarityColorClass = item ? getItemRarityColor(item.rarity) : 'text-brand-text-muted';
    
    const baseStyle = item 
        ? 'bg-brand-bg border border-brand-primary/30 hover:bg-brand-surface cursor-pointer shadow-sm' 
        : 'bg-transparent border-2 border-dashed border-brand-primary/20 opacity-40 cursor-default';

    const selectionStyle = selectionMode && isCompatible && !isLocked
        ? 'ring-2 ring-brand-accent ring-inset bg-brand-accent/5 cursor-pointer animate-pulse border-transparent opacity-100' 
        : (selectionMode && (!isCompatible || isLocked))
            ? 'opacity-10 cursor-not-allowed grayscale'
            : '';
    
    const lockedStyle = isLocked ? 'bg-red-900/10 border-red-500/20 opacity-30 cursor-not-allowed' : '';

    const bgUrl = getSlotBackgroundImageUrl(slot, item?.tags || []);
    const bgStyle = (bgUrl && item) ? {
        backgroundImage: `linear-gradient(rgba(18, 18, 18, 0.8), rgba(18, 18, 18, 0.8)), url('${bgUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    } : {};

    return (
        <div 
            onClick={handleClick}
            className={`
                relative flex flex-col justify-center items-center p-2 rounded-lg
                transition-all duration-200 aspect-square text-center
                ${baseStyle} ${selectionStyle} ${lockedStyle}
            `}
            style={bgStyle}
        >
            <span className="absolute top-1.5 w-full px-1 text-body-micro opacity-40 truncate pointer-events-none z-20">
                {label}
            </span>
            
            {isLocked ? (
                <div className="flex flex-col items-center justify-center opacity-50 relative z-20">
                    <Icon name="close" className="w-5 h-5 text-red-500" />
                    <span className="text-body-micro mt-1 text-red-400">Locked</span>
                </div>
            ) : item ? (
                <div className="w-full flex flex-col items-center overflow-hidden relative z-10">
                    <div className="w-full px-1 overflow-hidden pointer-events-none text-center">
                        <p className={`text-body-tiny font-bold leading-tight line-clamp-3 overflow-hidden text-ellipsis ${rarityColorClass}`}>
                            {item.name}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="mt-2 relative z-20">
                    <div className="w-6 h-6 rounded-full border-2 border-dashed border-current flex items-center justify-center opacity-20" />
                </div>
            )}
        </div>
    );
};

export const BodyPaperDoll: React.FC<BodyPaperDollProps> = ({ 
    equippedItems, 
    onSlotClick, 
    onItemClick, 
    selectionMode, 
    isShip, 
    isMount,
    setting = 'fantasy', 
    validSlotTag 
}) => {
    
    const getItemInSlot = (slot: BodySlot) => equippedItems.find(i => i.equippedSlot === slot);
    const mainHandItem = getItemInSlot('Main Hand');
    const isOffHandLocked = mainHandItem?.tags?.includes('heavy weapon');

    const getSlotLabel = (slot: BodySlot): string => {
        const tags = [];
        if (isShip) tags.push('ship');
        if (isMount) tags.push('mount');
        
        return getSlotSynonym(slot, tags);
    };

    const renderSlot = (slotName: string) => {
        const slot = slotName as BodySlot;
        const item = getItemInSlot(slot);
        const label = getSlotLabel(slot);
        const isCompatible = isSlotCompatible(validSlotTag as string | undefined, slot);
        const isLocked = slot === 'Off Hand' && isOffHandLocked;
        
        return (
            <SlotBox 
                key={slot} 
                slot={slot} 
                label={label}
                item={item} 
                onClick={() => onSlotClick(slot)} 
                onItemClick={() => item && onItemClick(item)}
                selectionMode={selectionMode}
                isCompatible={isCompatible}
                isLocked={isLocked}
            />
        );
    };

    return (
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
            {renderSlot('Neck')}
            {renderSlot('Head')}
            {renderSlot('Shoulders')}
            {renderSlot('Gloves')}
            {renderSlot('Body')}
            {renderSlot('Bracers')}
            {renderSlot('Ring 1')}
            {renderSlot('Vest')}
            {renderSlot('Ring 2')}
            {renderSlot('Main Hand')}
            {renderSlot('Waist')}
            {renderSlot('Off Hand')}
            {renderSlot('Accessory 1')}
            {renderSlot('Legs')}
            {renderSlot('Accessory 2')}
            <div className="col-start-2">
                {renderSlot('Feet')}
            </div>
        </div>
    );
};
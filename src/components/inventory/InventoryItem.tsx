
import React from 'react';
import { Item, type Inventory, PlayerCharacter, Companion, getItemRarityColor } from '../../types';
import Accordion from '../Accordion';
import { ItemDetailView } from './ItemDetailView';

interface InventoryItemProps { 
    item: Item;
    ownerId: string;
    character: PlayerCharacter | Companion;
    fromList: keyof Inventory;
    isOpen: boolean;
    onToggle: () => void;
    primaryCurrencyItemId?: string;
    onEquipRequest?: () => void;
    onUnequipRequest?: () => void;
}

export const InventoryItem: React.FC<InventoryItemProps> = (props) => {
    const title = (
        <div className="flex justify-between items-center w-full">
            <div className="flex items-center min-w-0 gap-2">
                <span className={`text-[10px] flex-shrink-0 ${getItemRarityColor(props.item.rarity)}`}>⬤</span>
                <span className="text-body-base font-bold text-brand-text truncate tracking-tight">{props.item.getDisplayName()}</span>
                {props.item.isNew && (
                  <span className="bg-brand-accent text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm flex-shrink-0 animate-bounce">New</span>
                )}
            </div>
            {props.item.price && props.item.price > 0 && !props.item.tags?.includes('currency') && (
                 <span className="font-black text-brand-accent flex items-center gap-1 text-body-sm ml-2 flex-shrink-0 tabular-nums">
                    <span>💰</span>
                    <span>{props.item.price}</span>
                </span>
            )}
        </div>
    );

    return (
        <div className="mb-2">
            <Accordion title={title} isOpen={props.isOpen} onToggle={props.onToggle}>
                <ItemDetailView {...props} />
            </Accordion>
        </div>
    );
};

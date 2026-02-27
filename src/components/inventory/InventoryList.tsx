
import React from 'react';
import { Item, type Inventory, PlayerCharacter, Companion } from '../../types';
import { InventoryItem } from './InventoryItem';

interface InventoryListProps {
    title: string;
    description: string;
    items: Item[];
    listName: keyof Inventory;
    ownerId: string;
    character: PlayerCharacter | Companion;
    openItemId: string | null;
    onToggle: (itemId: string) => void;
    primaryCurrencyItemId?: string;
    onEquipRequest?: (itemId: string) => void;
    onUnequipRequest?: (itemId: string) => void;
}

export const InventoryList: React.FC<InventoryListProps> = ({ 
    title, 
    description, 
    items, 
    listName, 
    ownerId, 
    character, 
    openItemId, 
    onToggle, 
    primaryCurrencyItemId, 
    onEquipRequest, 
    onUnequipRequest 
}) => (
    <div className="mb-12">
        <h3 className="text-brand-text mb-1 text-center tracking-tight">{title}</h3>
        <p className="text-body-sm text-brand-text-muted mb-6 pb-2 border-b border-brand-primary/10 text-center italic font-medium">{description}</p>
        {items.length > 0 ? (
            <div className="space-y-1">
                {items.map(item => 
                    <InventoryItem 
                        key={item.id} 
                        item={item} 
                        ownerId={ownerId}
                        character={character}
                        fromList={listName} 
                        isOpen={openItemId === item.id}
                        onToggle={() => onToggle(item.id)}
                        primaryCurrencyItemId={primaryCurrencyItemId}
                        onEquipRequest={() => onEquipRequest && onEquipRequest(item.id)}
                        onUnequipRequest={() => onUnequipRequest && onUnequipRequest(item.id)}
                    />
                )}
            </div>
        ) : (
            <p className="text-body-sm text-brand-text-muted italic text-center py-4 opacity-40">This section is currently empty.</p>
        )}
    </div>
);

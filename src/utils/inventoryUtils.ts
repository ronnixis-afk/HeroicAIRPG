// utils/inventoryUtils.ts

import { GameData, Item, Inventory } from '../types';

/**
 * Consolidates all currency items from all companion inventories into the player's carried inventory.
 * If the player doesn't have a currency item, one is created.
 */
export const consolidateCurrencyToPlayer = (state: GameData): GameData => {
    let totalCurrencyToAdd = 0;
    const newState = { ...state };
    
    // 1. Extract and remove currency from companions
    const newCompanionInventories = { ...state.companionInventories };
    const companionIds = Object.keys(newCompanionInventories);
    
    companionIds.forEach(id => {
        const inv = newCompanionInventories[id];
        if (!inv) return;

        const currencyItems = inv.carried.filter(i => i.tags?.includes('currency'));
        if (currencyItems.length > 0) {
            currencyItems.forEach(item => {
                totalCurrencyToAdd += (item.quantity || 0);
            });
            // Remove currency from companion's carried inventory
            newCompanionInventories[id] = {
                ...inv,
                carried: inv.carried.filter(i => !i.tags?.includes('currency'))
            };
        }
    });

    newState.companionInventories = newCompanionInventories;

    // 2. Consolidate within player inventory (if they have multiple currency stacks)
    const playerCarried = [...newState.playerInventory.carried];
    const playerCurrencyStacks = playerCarried.filter(i => i.tags?.includes('currency'));
    
    if (playerCurrencyStacks.length > 1) {
        // Find the "primary" one (e.g. the first one found)
        const primaryIdx = playerCarried.findIndex(i => i.tags?.includes('currency'));
        const primaryItem = playerCarried[primaryIdx];
        
        let subtotal = 0;
        // Sum all and remove others
        newState.playerInventory.carried = playerCarried.filter((item, idx) => {
            if (item.tags?.includes('currency')) {
                if (idx === primaryIdx) return true;
                subtotal += (item.quantity || 0);
                return false;
            }
            return true;
        });
        
        // Update primary
        const updatedPlayerCarried = [...newState.playerInventory.carried];
        const newPrimaryIdx = updatedPlayerCarried.findIndex(i => i.id === primaryItem.id);
        updatedPlayerCarried[newPrimaryIdx] = new Item({
            ...primaryItem,
            quantity: (primaryItem.quantity || 0) + subtotal
        });
        newState.playerInventory.carried = updatedPlayerCarried;
    }

    // 3. Add any currency from companions to player
    if (totalCurrencyToAdd > 0) {
        const finalPlayerCarried = [...newState.playerInventory.carried];
        const currencyIdx = finalPlayerCarried.findIndex(i => i.tags?.includes('currency'));
        
        if (currencyIdx > -1) {
            const existing = finalPlayerCarried[currencyIdx];
            finalPlayerCarried[currencyIdx] = new Item({
                ...existing,
                quantity: (existing.quantity || 0) + totalCurrencyToAdd
            });
        } else {
            // If player somehow has NO currency item yet, create one
            // Match naming convention from SELL_ITEM in inventoryReducer.ts
            const currencyName = state.mapSettings?.style === 'sci-fi' ? 'Credits' : 'Gold Pieces';
            finalPlayerCarried.push(new Item({
                name: currencyName,
                quantity: totalCurrencyToAdd,
                tags: ['currency'],
                description: 'Standard currency.',
                details: '',
                id: `currency-${Date.now()}`
            }));
        }
        newState.playerInventory = {
            ...newState.playerInventory,
            carried: finalPlayerCarried
        };
    }

    return newState;
};

// hooks/useInventoryActions.ts

import React, { useCallback } from 'react';
import { GameData, Item, Inventory, StoreItem, BodySlot, GameAction, FORGE_GROUPS, PlayerCharacter, Companion, ActiveBuff } from '../types';
import { generateItemPrices, generateStoreCategoryInventory, identifyItems } from '../services/geminiService';
import { forgeRandomItem } from '../utils/itemMechanics';

const getShopRarityCounts = (level: number, totalCount: number = 10): Record<string, number> => {
    let distribution: Record<string, number>;
    if (level <= 2) distribution = { 'Common': 6, 'Uncommon': 3, 'Rare': 1 };
    else if (level <= 4) distribution = { 'Common': 4, 'Uncommon': 4, 'Rare': 2 };
    else if (level <= 6) distribution = { 'Uncommon': 6, 'Rare': 3, 'Very Rare': 1 };
    else if (level <= 8) distribution = { 'Uncommon': 4, 'Rare': 4, 'Very Rare': 2 };
    else if (level <= 10) distribution = { 'Rare': 6, 'Very Rare': 3, 'Legendary': 1 };
    else if (level <= 12) distribution = { 'Rare': 4, 'Very Rare': 4, 'Legendary': 2 };
    else if (level <= 14) distribution = { 'Very Rare': 6, 'Legendary': 3, 'Artifact': 1 };
    else distribution = { 'Very Rare': 4, 'Legendary': 4, 'Artifact': 2 };

    if (totalCount === 10) return distribution;

    const scaled: Record<string, number> = {};
    let currentSum = 0;
    const entries = Object.entries(distribution);
    
    entries.forEach(([rarity, count], idx) => {
        if (idx === entries.length - 1) {
            scaled[rarity] = totalCount - currentSum;
        } else {
            const val = Math.round((count / 10) * totalCount);
            scaled[rarity] = val;
            currentSum += val;
        }
    });

    return scaled;
};

export const useInventoryActions = (
    gameData: GameData | null, 
    dispatch: React.Dispatch<GameAction>
) => {

    const updateItem = useCallback(async (item: Item, ownerId: string) => {
        dispatch({ type: 'UPDATE_ITEM', payload: { item, ownerId } });
    }, [dispatch]);
    
    const dropItem = useCallback(async (itemId: string, list: keyof Inventory, ownerId: string, quantity: number) => {
        let itemName = 'Item';
        if (gameData) {
            const inv = ownerId === 'player' ? gameData.playerInventory : gameData.companionInventories[ownerId];
            if (inv && inv[list]) {
                const item = inv[list].find(i => i.id === itemId);
                if (item) itemName = item.name;
            }
        }
        
        dispatch({ type: 'DROP_ITEM', payload: { itemId, list, ownerId, quantity } });
        
        dispatch({ 
            type: 'ADD_MESSAGE', 
            payload: { 
                id: `sys-drop-${Date.now()}`, 
                sender: 'system', 
                content: `Dropped ${quantity}x ${itemName}.`, 
                type: 'neutral' 
            } 
        });
    }, [dispatch, gameData]);

    const splitItem = useCallback(async (itemId: string, list: keyof Inventory, ownerId: string, splitQuantity: number) => {
        let itemName = 'Item';
        if (gameData) {
            const inv = ownerId === 'player' ? gameData.playerInventory : gameData.companionInventories[ownerId];
            if (inv && inv[list]) {
                const item = inv[list].find(i => i.id === itemId);
                if (item) itemName = item.name;
            }
        }
        
        dispatch({ type: 'SPLIT_ITEM', payload: { itemId, list, ownerId, splitQuantity } });
        
        dispatch({ 
            type: 'ADD_MESSAGE', 
            payload: { 
                id: `sys-split-${Date.now()}`, 
                sender: 'system', 
                content: `Split stack of ${itemName}. Created new stack of ${splitQuantity}.`, 
                type: 'neutral' 
            } 
        });
    }, [dispatch, gameData]);

    const moveItem = useCallback((itemId: string, fromList: keyof Inventory, toList: keyof Inventory, ownerId: string) => {
        let itemName = 'Item';
        if (gameData) {
            const inv = ownerId === 'player' ? gameData.playerInventory : gameData.companionInventories[ownerId];
            if (inv && inv[fromList]) {
                const item = inv[fromList].find(i => i.id === itemId);
                if (item) itemName = item.name;
            }
        }

        dispatch({ type: 'MOVE_ITEM', payload: { itemId, fromList, toList, ownerId } });
        
        dispatch({ 
            type: 'ADD_MESSAGE', 
            payload: { 
                id: `sys-move-${Date.now()}`,
                sender: 'system', 
                content: `Moved ${itemName} to ${toList}.`, 
                type: 'neutral'
            }
        });
    }, [dispatch, gameData]);

    const equipItem = useCallback((itemId: string, slot: BodySlot, ownerId: string) => {
        dispatch({ type: 'EQUIP_ITEM', payload: { itemId, slot, ownerId } });
    }, [dispatch]);

    const unequipItem = useCallback((itemId: string, ownerId: string) => {
        dispatch({ type: 'UNEQUIP_ITEM', payload: { itemId, ownerId } });
    }, [dispatch]);

    const transferItem = useCallback((itemId: string, fromOwnerId: string, fromList: keyof Inventory, toOwnerId: string) => {
        let itemName = 'Item';
        let toName = 'Unknown';
        
        if (gameData) {
            const inv = fromOwnerId === 'player' ? gameData.playerInventory : gameData.companionInventories[fromOwnerId];
            if (inv && inv[fromList]) {
                const item = inv[fromList].find(i => i.id === itemId);
                if (item) itemName = item.name;
            }
            
            if (toOwnerId === 'player') {
                toName = 'Player';
            } else {
                const comp = gameData.companions.find(c => c.id === toOwnerId);
                if (comp) toName = comp.name;
            }
        }

        dispatch({ type: 'TRANSFER_ITEM', payload: { itemId, fromOwnerId, fromList, toOwnerId } });
        
        dispatch({ 
            type: 'ADD_MESSAGE', 
            payload: { 
                id: `sys-transfer-${Date.now()}`, 
                sender: 'system', 
                content: `Transferred ${itemName} to ${toName}.`, 
                type: 'neutral' 
            } 
        });
    }, [dispatch, gameData]);
    
    const useItem = useCallback(async (itemId: string, list: keyof Inventory, ownerId: string) => {
        let itemName = 'Item';
        let activatedBuffs: ActiveBuff[] = [];

        if (gameData) {
            const inv = ownerId === 'player' ? gameData.playerInventory : gameData.companionInventories[ownerId];
            if (inv && inv[list]) {
                const item = inv[list].find(i => i.id === itemId);
                if (item) {
                    itemName = item.name;

                    // Phase 5: Filter and process only 'Active' buffs
                    if (item.buffs) {
                        activatedBuffs = item.buffs
                            .filter(b => b.duration === 'Active')
                            .map(b => {
                                const { duration, ...rest } = b;
                                return {
                                    ...rest,
                                    duration: 10 // Standard activation duration
                                } as ActiveBuff;
                            });
                    }
                }
            }
        }

        // Logic Gate: Inject active modifiers into character state
        if (activatedBuffs.length > 0) {
            dispatch({ type: 'ADD_ACTIVE_BUFF', payload: { ownerId, buffs: activatedBuffs } });
        }

        dispatch({ type: 'USE_ITEM', payload: { itemId, list, ownerId } });
        
        const buffSuffix = activatedBuffs.length > 0 ? ` and gained ${activatedBuffs.length} active modifier${activatedBuffs.length > 1 ? 's' : ''}` : '';
        dispatch({ 
            type: 'ADD_MESSAGE', 
            payload: { 
                id: `sys-use-${Date.now()}`, 
                sender: 'system', 
                content: `Used ${itemName}${buffSuffix}.`, 
                type: 'neutral' 
            } 
        });
    }, [dispatch, gameData]);

    const consolidateCurrency = useCallback((itemIdToConsolidate: string, ownerId: string) => {
        dispatch({ type: 'CONSOLIDATE_CURRENCY', payload: { itemId: itemIdToConsolidate, ownerId } });
    }, [dispatch]);

    const fetchStoreCategory = useCallback(async (category: string, scale: string = 'Person', forceRefresh: boolean = false) => {
        if (!gameData) return;
        
        const cacheKey = `${scale}:${category}`;
        if (!forceRefresh && gameData.globalStoreInventory && gameData.globalStoreInventory[cacheKey] && gameData.globalStoreInventory[cacheKey].length > 0) return;

        try {
            const level = gameData.playerCharacter.level || 1;
            const skillConfig = gameData.skillConfiguration || 'Fantasy';
            
            const group = FORGE_GROUPS.find(g => g.id === category);
            const subtypes = group?.subtypes || [];
            
            const targetCount = Math.max(10, subtypes.length);
            const rarityDistributionMap = getShopRarityCounts(level, targetCount);
            const rarityPool: string[] = [];
            Object.entries(rarityDistributionMap).forEach(([rarity, count]) => {
                for (let i = 0; i < count; i++) rarityPool.push(rarity);
            });
            
            const blueprints: Item[] = [];
            for (let i = 0; i < targetCount; i++) {
                const rarity = rarityPool[i] || 'Common';
                let blueprint: Item;

                const forgeScaleOverride = scale;
                const departmentHint = category;

                if (subtypes.length > 0) {
                    const subtype = subtypes[i % subtypes.length];
                    blueprint = forgeRandomItem(subtype.label, rarity, skillConfig, subtype.slot, forgeScaleOverride, departmentHint);
                } else {
                    blueprint = forgeRandomItem(category, rarity, skillConfig, undefined, forgeScaleOverride, departmentHint);
                }
                blueprints.push(blueprint);
            }

            const finalItems = await generateStoreCategoryInventory(
                category, 
                blueprints,
                gameData.worldSummary || 'Standard RPG Setting',
                scale 
            );

            if (!finalItems || finalItems.length === 0) {
                throw new Error("AI_EMPTY");
            }

            const storeItems = finalItems.map((i: any) => new Item(i) as StoreItem);
            dispatch({ type: 'ADD_STORE_INVENTORY', payload: { category: cacheKey, items: storeItems } });
        } catch (error) {
            console.error(`Failed to fetch inventory for ${category}:`, error);
            throw error; 
        }
    }, [gameData, dispatch]);

    const buyItem = useCallback(async (item: StoreItem, quantity: number) => {
         const totalCost = (item.price || 0) * quantity;
         dispatch({ type: 'BUY_ITEM', payload: { item, quantity } });
         
         dispatch({ 
            type: 'ADD_MESSAGE', 
            payload: { 
                id: `sys-buy-${Date.now()}`, 
                sender: 'system', 
                content: `Bought ${quantity}x ${item.name} for ${totalCost} gold.`, 
                type: 'neutral' 
            } 
        });
    }, [dispatch]);

    const sellItem = useCallback(async (item: Item, sellPrice: number, quantity: number) => {
          const totalValue = sellPrice * quantity;
          dispatch({ type: 'SELL_ITEM', payload: { item, sellPrice, quantity } });
          
          dispatch({ 
            type: 'ADD_MESSAGE', 
            payload: { 
                id: `sys-sell-${Date.now()}`, 
                sender: 'system', 
                content: `Sold ${quantity}x ${item.name} for ${totalValue} gold.`, 
                type: 'neutral' 
            } 
        });
    }, [dispatch]);

    const identifyAndAppraiseItems = useCallback(async (): Promise<number> => {
         if(!gameData) return 0;
         
         const allCarried = gameData.playerInventory.carried;
         const allEquipped = gameData.playerInventory.equipped;
         const allStorage = gameData.playerInventory.storage;
         
         const unidentified = [...allCarried, ...allEquipped, ...allStorage].filter(i => 
             i.tags?.includes('unidentified') || 
             (i.name && i.name.toLowerCase().includes('unidentified'))
         );
         
         if (unidentified.length === 0) {
             dispatch({ 
                type: 'ADD_MESSAGE', 
                payload: { 
                    id: `sys-ident-none-${Date.now()}`, 
                    sender: 'system', 
                    content: `No unidentified items found in inventory.`, 
                    type: 'neutral' 
                } 
            });
             return 0;
         }
         
         const identifiedItems = await identifyItems(unidentified, gameData);
         
         identifiedItems.forEach(item => {
             dispatch({ type: 'UPDATE_ITEM', payload: { item, ownerId: 'player' } });
         });
         
         dispatch({ 
            type: 'ADD_MESSAGE', 
            payload: { 
                id: `sys-ident-${Date.now()}`, 
                sender: 'system', 
                content: `Identified ${identifiedItems.length} items.`, 
                type: 'positive' 
            } 
        });
        
        return identifiedItems.length;

    }, [gameData, dispatch]);

    const priceUnpricedItems = useCallback(async () => {
        if (!gameData) return;
        
        const allItems = [
            ...gameData.playerInventory.carried,
            ...gameData.playerInventory.equipped,
            ...gameData.playerInventory.storage,
            ...gameData.playerInventory.assets
        ];
        
        const unpriced = allItems.filter(i => (i.price === undefined || i.price === null) && !i.tags?.includes('currency'));
        
        if (unpriced.length > 0) {
            const updates = await generateItemPrices(unpriced);
            dispatch({ type: 'UPDATE_ITEM_PRICES', payload: updates });
        }
    }, [gameData, dispatch]);

    return {
        updateItem,
        dropItem,
        splitItem,
        moveItem,
        equipItem,
        unequipItem,
        transferItem,
        useItem,
        consolidateCurrency,
        fetchStoreCategory,
        buyItem,
        sellItem,
        identifyAndAppraiseItems,
        priceUnpricedItems
    };
};
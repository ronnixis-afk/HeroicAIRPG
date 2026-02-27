
import { GameData, Inventory, Item, GameAction } from '../types';

export const inventoryReducer = (state: GameData, action: GameAction): GameData => {
    switch (action.type) {
        case 'UPDATE_ITEM': {
            const { item, ownerId } = action.payload;
            const newState = { ...state };
            const updateList = (inv: Inventory): Inventory => {
                return {
                    ...inv,
                    carried: inv.carried.map(i => i.id === item.id ? item : i),
                    equipped: inv.equipped.map(i => i.id === item.id ? item : i),
                    storage: inv.storage.map(i => i.id === item.id ? item : i),
                    assets: inv.assets.map(i => i.id === item.id ? item : i),
                };
            };
            if (ownerId === 'player') {
                newState.playerCharacter = newState.playerCharacter; // Trigger react update
                newState.playerInventory = updateList(newState.playerInventory);
            } else if (newState.companionInventories[ownerId]) {
                newState.companionInventories = {
                    ...newState.companionInventories,
                    [ownerId]: updateList(newState.companionInventories[ownerId])
                };
            }
            return newState;
        }

        case 'MARK_ITEM_SEEN': {
            const { itemId, ownerId } = action.payload;
            const newState = { ...state };
            const mark = (inv: Inventory): Inventory => {
                const finder = (i: Item) => i.id === itemId ? new Item({ ...i, isNew: false }) : i;
                return {
                    ...inv,
                    carried: inv.carried.map(finder),
                    equipped: inv.equipped.map(finder),
                    storage: inv.storage.map(finder),
                    assets: inv.assets.map(finder),
                };
            };
            if (ownerId === 'player') {
                newState.playerInventory = mark(newState.playerInventory);
            } else if (newState.companionInventories[ownerId]) {
                newState.companionInventories = {
                    ...newState.companionInventories,
                    [ownerId]: mark(newState.companionInventories[ownerId])
                };
            }
            return newState;
        }

        case 'DROP_ITEM': {
            const { itemId, list, ownerId, quantity } = action.payload;
            const newState = { ...state };
            const processDrop = (inv: Inventory): Inventory => {
                const newList = [...inv[list]];
                const itemIndex = newList.findIndex(i => i.id === itemId);
                if (itemIndex > -1) {
                    const item = newList[itemIndex];
                    if ((item.quantity || 1) > quantity) {
                        newList[itemIndex] = new Item({ ...item, quantity: (item.quantity || 1) - quantity });
                    } else {
                        newList.splice(itemIndex, 1);
                    }
                }
                return { ...inv, [list]: newList };
            };
            if (ownerId === 'player') {
                newState.playerInventory = processDrop(newState.playerInventory);
            } else if (newState.companionInventories[ownerId]) {
                newState.companionInventories = {
                    ...newState.companionInventories,
                    [ownerId]: processDrop(newState.companionInventories[ownerId])
                };
            }
            return newState;
        }

        case 'SPLIT_ITEM': {
            const { itemId, list, ownerId, splitQuantity } = action.payload;
            const newState = { ...state };
            const processSplit = (inv: Inventory): Inventory => {
                const newList = [...inv[list]];
                const idx = newList.findIndex(i => i.id === itemId);
                if (idx > -1) {
                    const original = newList[idx];
                    const currentQty = original.quantity || 1;
                    if (currentQty > splitQuantity) {
                        // Original stack gets a unique stackId to distinguish it and prevent auto-merging
                        newList[idx] = new Item({ 
                            ...original, 
                            quantity: currentQty - splitQuantity,
                            stackId: original.stackId || `stack-${Date.now()}-1`
                        });
                        // New stack gets its own unique stackId and unique ID
                        const newItem = new Item({ 
                            ...original, 
                            id: `split-${Date.now()}-${Math.floor(Math.random() * 1000000)}`, 
                            quantity: splitQuantity, 
                            isNew: true,
                            stackId: `stack-${Date.now()}-2`
                        });
                        newList.push(newItem);
                    }
                }
                return { ...inv, [list]: newList };
            };
            if (ownerId === 'player') {
                newState.playerInventory = processSplit(newState.playerInventory);
            } else if (newState.companionInventories[ownerId]) {
                newState.companionInventories = {
                    ...newState.companionInventories,
                    [ownerId]: processSplit(newState.companionInventories[ownerId])
                };
            }
            return newState;
        }

        case 'MOVE_ITEM': {
            const { itemId, fromList, toList, ownerId } = action.payload;
            const newState = { ...state };
            const processMove = (inv: Inventory): Inventory => {
                const newFrom = [...inv[fromList]];
                const newTo = [...inv[toList]];
                const itemIndex = newFrom.findIndex(i => i.id === itemId);
                if (itemIndex > -1) {
                    const item = newFrom[itemIndex];
                    newFrom.splice(itemIndex, 1);
                    newTo.push(item);
                }
                return { ...inv, [fromList]: newFrom, [toList]: newTo };
            };
            if (ownerId === 'player') {
                newState.playerInventory = processMove(newState.playerInventory);
            } else if (newState.companionInventories[ownerId]) {
                newState.companionInventories = {
                    ...newState.companionInventories,
                    [ownerId]: processMove(newState.companionInventories[ownerId])
                };
            }
            return newState;
        }

        case 'EQUIP_ITEM': {
            const { itemId, slot, ownerId } = action.payload;
            const newState = { ...state };
            const processEquip = (inv: Inventory): Inventory => {
                let newCarried = [...inv.carried];
                let newEquipped = [...inv.equipped];
                
                const carriedIndex = newCarried.findIndex(i => i.id === itemId);
                const equippedIndex = newEquipped.findIndex(i => i.id === itemId);
                
                let item: Item;
                if (carriedIndex > -1) {
                    item = newCarried[carriedIndex];
                    newCarried.splice(carriedIndex, 1);
                    newEquipped.push(item);
                } else if (equippedIndex > -1) {
                    item = newEquipped[equippedIndex];
                } else {
                    return inv;
                }

                const isHeavy = item.tags?.includes('heavy weapon');

                // Check for existing items in slot or conflicting hand slots
                newEquipped = newEquipped.map(i => {
                    if (i.id === itemId) return i;

                    let shouldUnequip = false;
                    
                    // Direct slot match
                    if (i.equippedSlot === slot) shouldUnequip = true;

                    // Heavy weapon conflicts
                    if (isHeavy) {
                        if (i.equippedSlot === 'Main Hand' || i.equippedSlot === 'Off Hand') shouldUnequip = true;
                    } else if (slot === 'Main Hand' || slot === 'Off Hand') {
                        if (i.equippedSlot === 'Main Hand' && i.tags?.includes('heavy weapon')) shouldUnequip = true;
                    }

                    if (shouldUnequip) {
                        const unequipped = new Item({ ...i });
                        delete unequipped.equippedSlot;
                        newCarried.push(unequipped);
                        return null;
                    }
                    return i;
                }).filter((i): i is Item => i !== null);
                
                // Update the item's slot
                const finalEquipped = newEquipped.map(i => {
                    if (i.id === item.id) {
                        return new Item({ ...i, equippedSlot: isHeavy ? 'Main Hand' : slot });
                    }
                    return i;
                });

                return { ...inv, carried: newCarried, equipped: finalEquipped };
            };
            
            if (ownerId === 'player') {
                newState.playerInventory = processEquip(newState.playerInventory);
            } else if (newState.companionInventories[ownerId]) {
                newState.companionInventories = {
                    ...newState.companionInventories,
                    [ownerId]: processEquip(newState.companionInventories[ownerId])
                };
            }
            return newState;
        }

        case 'UNEQUIP_ITEM': {
            const { itemId, ownerId } = action.payload;
            const newState = { ...state };
            const processUnequip = (inv: Inventory): Inventory => {
                const newEquipped = [...inv.equipped];
                const newCarried = [...inv.carried];
                const index = newEquipped.findIndex(i => i.id === itemId);
                if (index > -1) {
                    const item = new Item({ ...newEquipped[index] });
                    delete item.equippedSlot;
                    newEquipped.splice(index, 1);
                    newCarried.push(item);
                }
                return { ...inv, equipped: newEquipped, carried: newCarried };
            };
            if (ownerId === 'player') {
                newState.playerInventory = processUnequip(newState.playerInventory);
            } else if (newState.companionInventories[ownerId]) {
                newState.companionInventories = {
                    ...newState.companionInventories,
                    [ownerId]: processUnequip(newState.companionInventories[ownerId])
                };
            }
            return newState;
        }

        case 'TRANSFER_ITEM': {
            const { itemId, fromOwnerId, fromList, toOwnerId } = action.payload;
            const newState = { ...state };
            let transferredItem: Item | undefined;
            
            if (fromOwnerId === 'player') {
                const newInv = { ...newState.playerInventory, [fromList]: [...newState.playerInventory[fromList]] };
                const idx = newInv[fromList].findIndex(i => i.id === itemId);
                if (idx > -1) {
                    transferredItem = new Item({ ...newInv[fromList][idx] });
                    delete transferredItem.equippedSlot;
                    newInv[fromList].splice(idx, 1);
                    newState.playerInventory = newInv;
                }
            } else if (newState.companionInventories[fromOwnerId]) {
                const newInv = { ...newState.companionInventories[fromOwnerId], [fromList]: [...newState.companionInventories[fromOwnerId][fromList]] };
                const idx = newInv[fromList].findIndex(i => i.id === itemId);
                if (idx > -1) {
                    transferredItem = new Item({ ...newInv[fromList][idx] });
                    delete transferredItem.equippedSlot;
                    newInv[fromList].splice(idx, 1);
                    newState.companionInventories = { ...newState.companionInventories, [fromOwnerId]: newInv };
                }
            }

            if (transferredItem) {
                if (toOwnerId === 'player') {
                    newState.playerInventory = {
                        ...newState.playerInventory,
                        carried: [...newState.playerInventory.carried, transferredItem]
                    };
                } else if (newState.companionInventories[toOwnerId]) {
                    newState.companionInventories = {
                        ...newState.companionInventories,
                        [toOwnerId]: {
                            ...newState.companionInventories[toOwnerId],
                            carried: [...newState.companionInventories[toOwnerId].carried, transferredItem]
                        }
                    };
                }
            }
            return newState;
        }

        case 'USE_ITEM': {
            const { itemId, list, ownerId } = action.payload;
            const newState = { ...state };
            const processUse = (inv: Inventory): Inventory => {
                const newList = [...inv[list]];
                const idx = newList.findIndex(i => i.id === itemId);
                if (idx > -1) {
                    const item = newList[idx];
                    if (item.usage?.type === 'charges' || item.usage?.type === 'per_short_rest' || item.usage?.type === 'per_long_rest') {
                        newList[idx] = new Item({
                            ...item,
                            usage: { ...item.usage, currentUses: Math.max(0, item.usage.currentUses - 1) }
                        });
                    } else if (item.quantity && item.quantity > 1) {
                        newList[idx] = new Item({ ...item, quantity: item.quantity - 1 });
                    } else if (item.quantity === 1 && !item.usage) {
                        newList.splice(idx, 1);
                    }
                }
                return { ...inv, [list]: newList };
            };
            if (ownerId === 'player') {
                newState.playerInventory = processUse(newState.playerInventory);
            } else if (newState.companionInventories[ownerId]) {
                newState.companionInventories = {
                    ...newState.companionInventories,
                    [ownerId]: processUse(newState.companionInventories[ownerId])
                };
            }
            return newState;
        }

        case 'CONSOLIDATE_CURRENCY': {
            const { itemId, ownerId } = action.payload;
            const newState = { ...state };
            const processConsolidate = (inv: Inventory): Inventory => {
                const newCarried = [...inv.carried];
                const primaryCurrencyIdx = newCarried.findIndex(i => i.tags?.includes('currency') && i.id !== itemId);
                const targetItemIndex = newCarried.findIndex(i => i.id === itemId);
                
                if (primaryCurrencyIdx > -1 && targetItemIndex > -1) {
                    const targetItem = newCarried[targetItemIndex];
                    const primaryCurrency = newCarried[primaryCurrencyIdx];
                    newCarried[primaryCurrencyIdx] = new Item({
                        ...primaryCurrency,
                        quantity: (primaryCurrency.quantity || 0) + (targetItem.quantity || 0)
                    });
                    newCarried.splice(targetItemIndex, 1);
                }
                return { ...inv, carried: newCarried };
            };
            if (ownerId === 'player') {
                newState.playerInventory = processConsolidate(newState.playerInventory);
            } else if (newState.companionInventories[ownerId]) {
                newState.companionInventories = {
                    ...newState.companionInventories,
                    [ownerId]: processConsolidate(newState.companionInventories[ownerId])
                };
            }
            return newState;
        }

        case 'ADD_STORE_INVENTORY':
            return {
                ...state,
                globalStoreInventory: {
                    ...state.globalStoreInventory,
                    [action.payload.category]: action.payload.items
                }
            };

        case 'BUY_ITEM': {
            const { item, quantity } = action.payload;
            const newState = { ...state };
            const totalCost = (item.price || 0) * quantity;
            
            const newCarried = [...newState.playerInventory.carried];
            const currencyIdx = newCarried.findIndex(i => i.tags?.includes('currency'));
            
            if (currencyIdx > -1 && (newCarried[currencyIdx].quantity || 0) >= totalCost) {
                newCarried[currencyIdx] = new Item({
                    ...newCarried[currencyIdx],
                    quantity: (newCarried[currencyIdx].quantity || 0) - totalCost
                });
                
                const boughtItem = new Item(item);
                boughtItem.quantity = quantity;
                boughtItem.isNew = true;
                boughtItem.id = `bought-${Date.now()}-${Math.random()}`;

                if (boughtItem.effect && !boughtItem.tags?.includes('mechanical')) {
                    if (!boughtItem.tags) boughtItem.tags = [];
                    boughtItem.tags = [...boughtItem.tags, 'mechanical'];
                }
                if (boughtItem.buffs && boughtItem.buffs.length > 0 && !boughtItem.tags?.includes('buff')) {
                     if (!boughtItem.tags) boughtItem.tags = [];
                     boughtItem.tags = [...boughtItem.tags, 'buff'];
                }

                newCarried.push(boughtItem);
                newState.playerInventory = { ...newState.playerInventory, carried: newCarried };
            }
            return newState;
        }

        case 'SELL_ITEM': {
            const { item, sellPrice, quantity } = action.payload;
            const newState = { ...state };
            const totalValue = sellPrice * quantity;
            
            let foundList: keyof Inventory | null = null;
            let idx = -1;
            
            for (const list of ['carried', 'equipped', 'storage', 'assets'] as (keyof Inventory)[]) {
                idx = newState.playerInventory[list].findIndex(i => i.id === item.id);
                if (idx > -1) {
                    foundList = list;
                    break;
                }
            }
            
            if (foundList) {
                const newList = [...newState.playerInventory[foundList]];
                const invItem = newList[idx];
                
                if ((invItem.quantity || 1) > quantity) {
                    newList[idx] = new Item({ ...invItem, quantity: (invItem.quantity || 1) - quantity });
                } else {
                    newList.splice(idx, 1);
                }
                
                newState.playerInventory = { ...newState.playerInventory, [foundList]: newList };
                
                const newCarried = foundList === 'carried' ? newList : [...newState.playerInventory.carried];
                const currencyIdx = newCarried.findIndex(i => i.tags?.includes('currency'));
                if (currencyIdx > -1) {
                    newCarried[currencyIdx] = new Item({
                        ...newCarried[currencyIdx],
                        quantity: (newCarried[currencyIdx].quantity || 0) + totalValue
                    });
                } else {
                    newCarried.push(new Item({
                        name: 'Gold Pieces',
                        quantity: totalValue,
                        tags: ['currency'],
                        description: 'Standard currency.',
                        details: '',
                        id: `currency-${Date.now()}`
                    }));
                }
                newState.playerInventory = { ...newState.playerInventory, carried: newCarried };
            }
            return newState;
        }

        case 'UPDATE_ITEM_PRICES': {
            const newState = { ...state };
            // This is a bulk update, so we need careful cloning
            const updatePrice = (inv: Inventory): Inventory => {
                const update = (list: Item[]) => list.map(item => {
                    const priceUpdate = action.payload.find(u => u.id === item.id);
                    return priceUpdate ? new Item({ ...item, price: priceUpdate.price }) : item;
                });
                return {
                    equipped: update(inv.equipped),
                    carried: update(inv.carried),
                    storage: update(inv.storage),
                    assets: update(inv.assets),
                };
            };
            newState.playerInventory = updatePrice(newState.playerInventory);
            return newState;
        }

        case 'TAKE_LOOT': {
            const newState = { ...state };
            const items = action.payload;
            const newCarried = [...newState.playerInventory.carried];
            
            items.forEach(item => {
                // REFINED MERGE LOGIC: Prevent auto-merging into split stacks. 
                // Only merge into existing stacks that have NO stackId (meaning they are the primary, un-split stack).
                const existingIdx = newCarried.findIndex(i => 
                    i.name && item.name && 
                    i.name.toLowerCase() === item.name.toLowerCase() && 
                    !i.stackId && // <--- CRITICAL PROTECTION
                    (item.tags?.includes('currency') || item.tags?.includes('consumable') || item.tags?.includes('ammunition') || item.tags?.includes('material'))
                );

                if (existingIdx > -1) {
                    const existing = newCarried[existingIdx];
                    newCarried[existingIdx] = new Item({
                        ...existing,
                        quantity: (existing.quantity || 1) + (item.quantity || 1),
                        isNew: true
                    });
                } else {
                    newCarried.push(new Item({ ...item, isNew: true }));
                }
            });
            newState.playerInventory = { ...newState.playerInventory, carried: newCarried };
            return newState;
        }

        default:
            return state;
    }
};

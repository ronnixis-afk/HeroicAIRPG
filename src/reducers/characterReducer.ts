// reducers/characterReducer.ts

import { GameData, PlayerCharacter, Companion, Inventory, GameAction, ChatMessage } from '../types';
import { getNextLevelXP, getXPForLevel } from '../utils/mechanics';

export const characterReducer = (state: GameData, action: GameAction): GameData => {
    switch (action.type) {
        case 'UPDATE_PLAYER': {
            // Ensure we maintain class instance for methods
            const pc = action.payload instanceof PlayerCharacter 
                ? action.payload 
                : new PlayerCharacter(action.payload);
            
            // Re-apply item-based bonuses that require inventory context
            pc.maxHeroicPoints = pc.getMaxHeroicPoints(state.playerInventory);
            
            return { 
                ...state, 
                playerCharacter: pc 
            };
        }
        
        case 'UPDATE_COMPANION': {
            let newSiteId = state.current_site_id;
            let newSiteName = state.current_site_name;
            const updatedCompanions = (state.companions ?? []).map(c => {
                if (c.id === action.payload.id) {
                    const companion = action.payload instanceof Companion
                        ? action.payload
                        : new Companion({
                            ...(action.payload as any),
                            relationship: Number((action.payload as any).relationship || 0)
                        });
                    
                    // Sync derived capacity
                    companion.maxHeroicPoints = companion.getMaxHeroicPoints(state.companionInventories[companion.id]);
                    
                    if (companion.isShip && companion.isInParty !== false && c.isInParty === false) {
                        newSiteId = `ship-${companion.id}`;
                        newSiteName = companion.name;
                    }
                    
                    return companion;
                }
                return c;
            });

            return {
                ...state,
                companions: updatedCompanions,
                current_site_id: newSiteId,
                current_site_name: newSiteName
            };
        }
        
        case 'ADD_COMPANION': {
            const newCompanionData = action.payload.companion;
            const newInventory = action.payload.inventory;
            
            const companionInstance = newCompanionData instanceof Companion
                ? newCompanionData
                : new Companion({
                    ...(newCompanionData as any),
                    relationship: Number((newCompanionData as any).relationship || 0),
                    activeBuffs: (newCompanionData as any).activeBuffs || []
                });

            // Sync derived capacity using the companion's specific starting inventory
            companionInstance.maxHeroicPoints = companionInstance.getMaxHeroicPoints(newInventory);

            const exists = (state.companions ?? []).some(c => c.id === companionInstance.id);
            
            if (exists) {
                return {
                    ...state,
                    companions: (state.companions ?? []).map(c => c.id === companionInstance.id ? companionInstance : c),
                    companionInventories: {
                        ...state.companionInventories,
                        [companionInstance.id]: newInventory
                    }
                };
            }

            return {
                ...state,
                companions: [...(state.companions ?? []), companionInstance],
                companionInventories: {
                    ...state.companionInventories,
                    [companionInstance.id]: newInventory
                }
            };
        }
        
        case 'DELETE_COMPANION':
            const newInventories = { ...state.companionInventories };
            delete newInventories[action.payload];
            return {
                ...state,
                companions: (state.companions ?? []).filter(c => c.id !== action.payload),
                companionInventories: newInventories
            };
            
        case 'USE_ABILITY': {
            const { abilityId, ownerId } = action.payload;
            const newState = { ...state };
            
            const decrementUsage = (abilities: any[]) => {
                return abilities.map(a => {
                    if (a.id === abilityId && a.usage && a.usage.type !== 'passive') {
                        return {
                            ...a,
                            usage: {
                                ...a.usage,
                                currentUses: Math.max(0, a.usage.currentUses - 1)
                            }
                        };
                    }
                    return a;
                });
            };

            if (ownerId === 'player' || ownerId === state.playerCharacter.id) {
                newState.playerCharacter = new PlayerCharacter({
                    ...state.playerCharacter,
                    abilities: decrementUsage(state.playerCharacter.abilities)
                });
                // Re-apply item context
                newState.playerCharacter.maxHeroicPoints = newState.playerCharacter.getMaxHeroicPoints(state.playerInventory);
            } else {
                newState.companions = state.companions.map(c => {
                    if (c.id === ownerId) {
                        const updated = new Companion({
                            ...c,
                            abilities: decrementUsage(c.abilities)
                        });
                        updated.maxHeroicPoints = updated.getMaxHeroicPoints(state.companionInventories[ownerId]);
                        return updated;
                    }
                    return c;
                });
            }
            return newState;
        }

        case 'ADD_ACTIVE_BUFF': {
            const { ownerId, buffs } = action.payload;
            const newState = { ...state };
            
            if (ownerId === 'player' || ownerId === state.playerCharacter.id) {
                const pc = new PlayerCharacter({
                    ...state.playerCharacter,
                    activeBuffs: [...(state.playerCharacter.activeBuffs || []), ...buffs]
                });
                pc.maxHeroicPoints = pc.getMaxHeroicPoints(state.playerInventory);
                newState.playerCharacter = pc;
            } else {
                newState.companions = state.companions.map(c => {
                    if (c.id === ownerId) {
                        const updated = new Companion({
                            ...c,
                            activeBuffs: [...(c.activeBuffs || []), ...buffs]
                        });
                        updated.maxHeroicPoints = updated.getMaxHeroicPoints(state.companionInventories[ownerId]);
                        return updated;
                    }
                    return c;
                });
            }
            return newState;
        }

        case 'USE_HEROIC_POINT': {
            const pc = new PlayerCharacter({
                ...state.playerCharacter,
                heroicPoints: Math.max(0, (state.playerCharacter.heroicPoints || 0) - 1)
            });
            // Maintenance: Ensure capacity is correct
            pc.maxHeroicPoints = pc.getMaxHeroicPoints(state.playerInventory);
            
            return {
                ...state,
                playerCharacter: pc
            };
        }

        case 'AWARD_XP': {
            const amount = action.payload.amount;
            const source = action.payload.source;
            
            const activeCompanions = (state.companions ?? []).filter(c => c.isInParty !== false);
            const partySize = 1 + activeCompanions.length; 
            const xpPerMember = Math.max(1, Math.floor(amount / partySize));

            // PC progression logic
            const pcData = { ...state.playerCharacter };
            const oldLevel = pcData.level;
            
            // Phase 2: Check heroic point capacity increase
            const oldMaxHeroic = state.playerCharacter.getMaxHeroicPoints(state.playerInventory);
            
            pcData.experiencePoints += xpPerMember;
            
            let currentLevel = pcData.level;
            let nextLevelXP = getNextLevelXP(currentLevel);
            while (nextLevelXP > 0 && pcData.experiencePoints >= nextLevelXP) {
                currentLevel += 1;
                nextLevelXP = getNextLevelXP(currentLevel);
            }
            
            pcData.level = currentLevel;
            let pcInstance = new PlayerCharacter(pcData);
            
            // Re-calculate max heroic points for the new level including item context
            const newMaxHeroic = pcInstance.getMaxHeroicPoints(state.playerInventory);
            pcInstance.maxHeroicPoints = newMaxHeroic;

            const updatedCompanions = (state.companions ?? []).map(c => {
                const cData = { ...c };
                const oldCompLevel = cData.level;
                
                if (cData.isInParty !== false) {
                    cData.experiencePoints += xpPerMember;
                }
                
                if (cData.level < pcInstance.level) {
                    cData.level = pcInstance.level;
                }
                
                let compLevel = cData.level;
                let compNextXP = getNextLevelXP(compLevel);
                while (compNextXP > 0 && cData.experiencePoints >= compNextXP) {
                    compLevel += 1;
                    compNextXP = getNextLevelXP(compLevel);
                }
                
                cData.level = compLevel;
                const compInstance = new Companion(cData);
                compInstance.maxHeroicPoints = compInstance.getMaxHeroicPoints(state.companionInventories[c.id]);
                return compInstance;
            });

            let msgContent = `Party gained ${amount.toLocaleString()} XP from ${source.toLowerCase()}.`;
            if (partySize > 1) {
                msgContent += ` That's ${xpPerMember.toLocaleString()} XP for each member.`;
            }

            if (pcInstance.level > oldLevel) {
                msgContent += `\n\nLevel up! You have reached Level ${pcInstance.level}. Check your features to assign new traits.`;
                
                // Milestone Rule: Grant bonus heroic point if capacity increased
                if (newMaxHeroic > oldMaxHeroic) {
                    pcInstance.heroicPoints = (pcInstance.heroicPoints || 0) + 1;
                    msgContent += `\n\nHeroic Moment: Your heroic point capacity has increased to ${newMaxHeroic}! You gained 1 bonus heroic point.`;
                }
            }
            
            const xpMsg: ChatMessage = {
                id: `sys-xp-${Date.now()}`,
                sender: 'system',
                content: msgContent,
                type: 'positive'
            };

            return {
                ...state,
                playerCharacter: pcInstance,
                companions: updatedCompanions,
                messages: [...state.messages, xpMsg]
            };
        }
        
        default:
            return state;
    }
};

import React, { useCallback } from 'react';
import { GameData, GameAction, Item, ChatMessage, CombatActor } from '../../types';
import { useUI } from '../../context/UIContext';
import { calculateLootDrops, LootDropPlan } from '../../utils/lootMechanics';
import { generateLoot, generateCombatConclusion } from '../../services/geminiService';
import { getEnemyXP } from '../../utils/mechanics';

export const useCombatLootHandler = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    weaveGrandDesign?: () => Promise<void>
) => {
    const { setLootState, setIsAiGenerating } = useUI();

    const concludeCombat = useCallback(() => {
        if (!gameData || !gameData.combatState) return;
        
        // Filter for hostiles that are actually defeated
        const defeatedHostiles = gameData.combatState.enemies.filter(e => !e.isAlly && (e.currentHitPoints || 0) <= 0); 
        
        if (defeatedHostiles.length > 0) {
            setLootState({ isOpen: true, isLoading: true, items: [], defeatedEnemies: defeatedHostiles });
            
            const worldStyle = gameData.mapSettings?.style || 'fantasy';
            const skillConfig = gameData.skillConfiguration || 'Fantasy';
            const pcLevel = gameData.playerCharacter.level || 1;
            const aiGeneratesLoot = gameData.combatConfiguration?.aiGeneratesLoot ?? true;
            
            const lootPlan = calculateLootDrops(defeatedHostiles, worldStyle, skillConfig, pcLevel);

            if (aiGeneratesLoot) {
               generateLoot(defeatedHostiles, gameData, lootPlan).then(items => {
                    const lootItems = items.map(i => new Item(i));
                    setLootState(ls => ({ ...ls, isLoading: false, items: lootItems }));
               });
            } else {
               const lootItems = lootPlan.slots.map(slot => {
                   const item = new Item(slot.blueprint);
                   item.name = `Unidentified Item`;
                   item.description = "A mysterious artifact of unknown power. Needs appraisal.";
                   if (!item.tags) item.tags = [];
                   item.tags.push('unidentified');
                   return item;
               });

               if (lootPlan.totalCurrency > 0) {
                   lootItems.push(new Item({
                       name: lootPlan.currencyName,
                       quantity: lootPlan.totalCurrency,
                       tags: ['currency'],
                       description: 'Looted funds.',
                       rarity: 'Common'
                   }));
               }

               setLootState(ls => ({ ...ls, isLoading: false, items: lootItems }));
            }

            const totalXP = defeatedHostiles.reduce((sum, enemy) => sum + getEnemyXP(enemy.challengeRating || 0), 0);
            if (totalXP > 0) {
                dispatch({ type: 'AWARD_XP', payload: { amount: totalXP, source: 'Combat Victory' } });
            }
        }
        
        dispatch({ type: 'END_COMBAT', payload: { lootItems: [] } }); 
    }, [gameData, dispatch, setLootState]);

    const takeAllLoot = useCallback(async (lootItems: Item[], defeatedNames?: string[], defeatedIds?: string[]) => {
        dispatch({ type: 'TAKE_LOOT', payload: lootItems });
        
        if (lootItems.length > 0) {
            const names = lootItems.map(i => `${i.quantity && i.quantity > 1 ? `${i.quantity}x ` : ''}${i.name}`).join(', ');
            dispatch({ 
                type: 'ADD_MESSAGE', 
                payload: { 
                    id: `sys-loot-${Date.now()}`, 
                    sender: 'system', 
                    content: `Looted: ${names}`, 
                    type: 'positive' 
                } 
            });
        }

        setLootState({ isOpen: false, isLoading: false, items: [], defeatedEnemies: [] });

        let triggerDestinyRealignment = false;
        const significantNames: string[] = [];

        if (defeatedIds && defeatedIds.length > 0) {
            defeatedIds.forEach(id => {
                const enemy = gameData?.combatState?.enemies.find(e => e.id === id);
                if (enemy) {
                    // Check if this is a "Significant Death"
                    // INDUSTRY STANDARD: Overarching narrative arcs (Grand Design) should shift on major mechanical milestones.
                    // Strictly triggering realignment on 'boss' type NPCs ensures the story reacts to major triumphs
                    // and avoids the computational expense of plot regeneration for minor named character deaths.
                    const isBoss = enemy.rank === 'boss';
                    
                    if (isBoss) {
                        triggerDestinyRealignment = true;
                        significantNames.push(enemy.name);
                    }
                }

                dispatch({ type: 'DELETE_COMBAT_ENEMY', payload: id });
                
                // --- BIDIRECTIONAL DEATH SYNC ---
                const registryNpcs = gameData?.npcs || [];
                const npc = registryNpcs.find(n => n.id === id);
                if (npc) {
                    const deathTime = gameData?.currentTime || 'Unknown Time';
                    const newMemory = { timestamp: deathTime, content: 'Died here.' };
                    const updatedMemories = [...(npc.memories || []), newMemory].slice(-20);
                    
                    dispatch({ 
                        type: 'UPDATE_NPC', 
                        payload: { 
                            ...npc, 
                            status: 'Dead', 
                            deathTimestamp: deathTime,
                            isBodyCleared: false,
                            memories: updatedMemories
                        } 
                    });

                    // Create Location Lore for the death
                    if (gameData?.currentLocale) {
                        dispatch({
                            type: 'ADD_KNOWLEDGE',
                            payload: [{
                                title: `Death of ${npc.name}`,
                                content: `The remains of ${npc.name} lie here, having fallen in battle.`,
                                coordinates: gameData.playerCoordinates,
                                tags: ['location', 'history', 'death'],
                                isNew: true,
                                visited: true
                            }]
                        });
                    }
                }
            });
        }

        if (gameData) {
            const names = defeatedNames && defeatedNames.length > 0 ? defeatedNames : ['the enemies'];
            const lastStoryLog = [...gameData.story].reverse().find(log => !log.id.includes('summary'));
            const preCombatContext = lastStoryLog ? lastStoryLog.content : "The party was exploring.";
            const preCombatLocation = lastStoryLog ? lastStoryLog.location : "Unknown Location";

            setIsAiGenerating(true);
            try {
                const res = await generateCombatConclusion(names, lootItems, preCombatContext, preCombatLocation, gameData);
                
                if (res.narrative && res.narrative.trim().length > 0) {
                    const aiMessage: ChatMessage = {
                        id: `ai-concl-${Date.now()}`,
                        sender: 'ai',
                        content: res.narrative,
                        location: res.location || preCombatLocation,
                    };

                    dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });
                    
                    dispatch({ 
                        type: 'ADD_STORY_LOG', 
                        payload: { 
                            id: `story-end-${Date.now()}`, 
                            timestamp: gameData.currentTime, 
                            location: res.location || preCombatLocation, 
                            content: res.narrative, 
                            summary: res.turnSummary || "Combat concluded.", 
                            isNew: true 
                        } 
                    });
                }
            } catch(e) { 
                console.error("Failed to generate combat conclusion", e);
            } finally {
                setIsAiGenerating(false);

                // DESTINY REALIGNMENT: If a boss died, update the Grand Design immediately
                // This is now triggered AFTER the narrative conclusion is logged to ensure Architect has the context
                if (triggerDestinyRealignment && weaveGrandDesign) {
                    dispatch({ 
                        type: 'ADD_MESSAGE', 
                        payload: { 
                            id: `sys-destiny-${Date.now()}`, 
                            sender: 'system', 
                            content: `**Threads of Fate Shift**: The fall of ${significantNames.join(', ')} has fundamentally altered the path forward. Realignment in progress...`, 
                            type: 'positive' 
                        } 
                    });
                    weaveGrandDesign();
                }
            }
        }
    }, [dispatch, setLootState, gameData, setIsAiGenerating, weaveGrandDesign]);

    return {
        concludeCombat,
        takeAllLoot
    };
};
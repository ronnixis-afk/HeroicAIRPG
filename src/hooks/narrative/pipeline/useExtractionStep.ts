
// hooks/narrative/pipeline/useExtractionStep.ts

import React, { useCallback } from 'react';
import { GameData, GameAction, AIUpdatePayload, NPC, StoryLog, InventoryUpdatePayload, NPCMemory, LoreEntry, AIResponse, MapZone } from '../../../types';
import { resolveLocaleCreation, generateZoneDetails, enrichItemDetails } from '../../../services/geminiService';
import { forgeSkins } from '../../../services/ItemGeneratorService';
import { formatRelationshipChange, calculateAlignmentRelationshipShift } from '../../../utils/npcUtils';
import { isLocaleMatch, parseHostility } from '../../../utils/mapUtils';
import { parseGameTime, addDuration, formatGameTime } from '../../../utils/timeUtils';

export const useExtractionStep = (
    dispatch: React.Dispatch<GameAction>,
    notifyInventoryChanges: (updates: any[]) => void,
    combatActions: any,
    uiSetters?: { setIsAuditing: (val: boolean) => void, setIsHousekeeping: (val: boolean) => void },
    npcActions?: any
) => {
    const processConsequences = useCallback(async (
        userContent: string,
        aiNarrative: string,
        gameData: GameData,
        aiMessageId: string,
        aiResponse: AIResponse,
        isExplicit: boolean = false,
        forcedCoordinates?: string,
        forcedLocale?: string,
        forcedSiteId?: string
    ) => {
        const registryNpcNames = (gameData.npcs ?? []).map(n => n.name ? String(n.name).toLowerCase().trim() : 'unknown');
        const companionNames = (gameData.companions ?? []).flatMap(c => {
            if (!c.name) return [];
            const names = [c.name.toLowerCase().trim()];
            // If it's a multi-word name, also exclude the first word (usually first name)
            const firstName = c.name.split(' ')[0].toLowerCase().trim();
            if (firstName && firstName !== names[0]) names.push(firstName);
            return names;
        });

        const playerFirstName = gameData.playerCharacter.name.split(' ')[0].toLowerCase().trim();
        const excludeList = [
            gameData.playerCharacter.name.toLowerCase().trim(),
            playerFirstName,
            ...companionNames,
            ...registryNpcNames
        ].filter((n): n is string => !!n);

        // --- PHASE 4 CONSOLIDATION: DIRECT SYNC ---
        // We no longer call the Auditor or Housekeeper. Everything is extracted from aiResponse.
        
        const finalUpdates: AIUpdatePayload = {
            ...(aiResponse.updates || {}),
            location_update: aiResponse.location_update,
            npc_resolution: aiResponse.npc_resolution,
            isAboard: aiResponse.is_aboard !== undefined ? aiResponse.is_aboard : gameData.isAboard
        };

        // --- SPATIAL SNAPPING & VALIDATION GATE (HARDENED) ---
        // SYSTEM TRUTH: We only allow the location to change if its a forced system-move (e.g. Travel or Investigation)
        let resolvedLocale: string | undefined = undefined;

        if (forcedCoordinates || forcedLocale) {
            // AUTHORIZED MOVEMENT: This branch is only taken during formal /travel or /exploration sequences
            const narratorLoc = aiResponse.location_update;
            const targetCoords = forcedCoordinates || gameData.playerCoordinates || "";
            const targetZone = (gameData.mapZones || []).find(z => z.coordinates === targetCoords);
            const anyShip = (gameData.companions || []).find(c => c.isShip);
            const isShipTravel = !!forcedCoordinates && forcedCoordinates !== gameData.playerCoordinates && anyShip?.isInParty;
            
            // Resolve Landing Site name
            const currentZoneName = targetZone?.name || (gameData.mapZones || []).find(z => z.coordinates === targetCoords)?.name || 'The Wilds';
            
            // PRIORITY: Forced Locale -> Ship -> Default Open Area
            const finalSiteName = forcedLocale || (isShipTravel && anyShip ? anyShip.name : `Open Area of ${currentZoneName}`);
            const finalSiteId = forcedSiteId || (isShipTravel && anyShip ? `ship-${anyShip.id}` : `open-area-${targetCoords}`);

            finalUpdates.location_update = {
                ...narratorLoc,
                coordinates: targetCoords,
                site_name: finalSiteName,
                site_id: finalSiteId,
                transition_type: forcedLocale ? 'poi_entry' : 'zone_change'
            };
            resolvedLocale = finalSiteName;
            finalUpdates.currentLocale = finalSiteName;
        } else {
            // CHAT ENFORCEMENT: No movement allowed during regular conversation.
            // We strip any location updates suggested by the AI or Auditor.
            finalUpdates.location_update = undefined; 
            finalUpdates.currentLocale = undefined; // Never emit currentLocale unless moving
        }

        // 2. Resolve Inventory Transitions (Directly from Narrator Command)
        if (aiResponse.items_to_generate && aiResponse.items_to_generate.length > 0) {
            const skillConfig = gameData.skillConfiguration || 'Fantasy';
            
            // Waterfall: Forge -> Enrich (Thematic Pass)
            const rawItems = aiResponse.items_to_generate.map(name => ({ name, quantity: 1 }));
            const forgedItems = forgeSkins(rawItems, skillConfig);
            const enrichedItems = await Promise.all(forgedItems.map(async (item) => {
                const enriched = await enrichItemDetails(item, gameData);
                return { ...item, ...enriched };
            }));

            const batch: InventoryUpdatePayload = {
                ownerId: 'player',
                list: 'carried',
                action: 'add',
                items: enrichedItems
            };

            finalUpdates.inventoryUpdates = [...(finalUpdates.inventoryUpdates || []), batch];

            enrichedItems.forEach((item: any) => {
                if (!item || !item.name) return;
                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `sys-inv-gain-${Date.now()}-${Math.random()}`,
                        sender: 'system',
                        content: `You acquired: **${item.name}**`,
                        type: 'positive'
                    }
                });
            });
        }


        // 3. Resolve Social Updates (NPCs)
        const updatedNpcIds = new Set<string>();
        const mergedNpcUpdates: (Partial<NPC> & { id: string })[] = [];

        // Resolve AI Resolution Updates (Discovery, Following, Leaves)
        if (aiResponse.npc_resolution?.length > 0) {
            aiResponse.npc_resolution.forEach(res => {
                const npc = gameData.npcs?.find(n => n.name && String(n.name).toLowerCase().trim() === String(res.name).toLowerCase().trim());
                if (npc) {
                    let finalUpd: Partial<NPC> & { id: string } = { id: npc.id };
                    if (res.isFollowing !== undefined) finalUpd.isFollowing = res.isFollowing;
                    if (res.action === 'leaves') {
                        finalUpd.isFollowing = false;
                        finalUpd.currentPOI = 'Departed';
                    }

                    // Narrator-driven death: if the AI signals a character died this turn
                    if (res.status === 'Dead') {
                        finalUpd.status = 'Dead';
                        finalUpd.isFollowing = false;
                    }

                    // Enforce following rule again just in case
                    if (npc.status === 'Dead') finalUpd.isFollowing = false;

                    const existingIdx = mergedNpcUpdates.findIndex(u => u.id === npc.id);
                    if (existingIdx > -1) {
                        mergedNpcUpdates[existingIdx] = { ...mergedNpcUpdates[existingIdx], ...finalUpd };
                    } else {
                        mergedNpcUpdates.push(finalUpd);
                        updatedNpcIds.add(npc.id);
                    }
                } else if (res.action === 'new') {
                    // Discovery: Narrative-driven character emergence with full enrichment from the Narrator
                    const id = `npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                    const isRemote = res.presenceMode === 'Remote';
                    dispatch({ 
                        type: 'ADD_NPC', 
                        payload: { 
                            name: res.name,
                            description: res.description,
                            race: res.race,
                            gender: res.gender,
                            id, 
                            isNew: true, 
                            status: res.status || 'Alive', 
                            relationship: 0, 
                            currentPOI: isRemote ? 'Remote Presence' : (resolvedLocale || gameData.current_site_name || 'Current'),
                            site_id: isRemote ? 'remote' : (forcedSiteId || gameData.current_site_id),
                            presenceMode: res.presenceMode || 'Physical'
                        } 
                    });
                }
            });
        }

        if (mergedNpcUpdates.length > 0) {
            finalUpdates.npcUpdates = mergedNpcUpdates;
        }

        // 4. Resolve Relationships mathematically & Add Memories
        const activeCompanionIds = new Set((gameData.companions || []).map(c => c.id));
        const currentLocale = resolvedLocale || gameData.currentLocale || "";

        let relChangeDisplay: string[] = [];

        // SKIP Alignment and Relationship check if this was an explicit UI action
        if (!isExplicit) {
            (gameData.npcs || []).forEach(n => {
                const npcUpdates = mergedNpcUpdates.find(u => u.id === n.id);
                const status = npcUpdates?.status || n.status;
                const npcPOI = npcUpdates?.currentPOI || n.currentPOI || "";

                const isAtLocale = isLocaleMatch(npcPOI, currentLocale) || npcPOI === 'Current' || npcPOI === 'With Party';
                const isActiveCompanion = n.companionId && activeCompanionIds.has(n.companionId);
                const isAlive = status !== 'Dead';
                const isSentient = n.isSentient !== false && !n.isShip;

                if ((isAtLocale || isActiveCompanion) && isAlive && isSentient) {
                    let changeAmount = 0;
                    let triggerCombat = false;

                    // Unconditionally drop relationship if in Combat and AI resolution considers them enemies
                    // (Note: To accurately identify engaged enemies in the future, we rely on combat turn order)
                    if (gameData.combatState?.isActive) {
                        const isEnemy = gameData.combatState.enemies?.some((e: any) => e.id === n.id);
                        if (isEnemy) {
                            changeAmount = -50 - (n.relationship || 0); // Force to -50 exactly, or subtract if already lower
                        }
                    }
                    // Or calculate relationship based on intent, if not immediately fighting them
                    else if (aiResponse.player_alignment_shift && aiResponse.player_alignment_shift !== 'Neutral') {
                        changeAmount = calculateAlignmentRelationshipShift(aiResponse.player_alignment_shift, n.moralAlignment);
                    }

                    if (changeAmount !== 0) {
                        const newRel = Math.max(-100, Math.min(100, Number(n.relationship || 0) + changeAmount));
                        dispatch({ type: 'UPDATE_NPC', payload: { ...n, relationship: newRel } });

                        if (newRel <= -50 && !gameData.combatState?.isActive) {
                            dispatch({
                                type: 'ADD_MESSAGE',
                                payload: {
                                    id: `sys-combat-trig-${Date.now()}-${n.id}`,
                                    sender: 'system',
                                    content: `**Combat Triggered!** Your relationship with ${n.name} has deteriorated past the breaking point. They are now hostile!`,
                                    type: 'negative'
                                }
                            });
                        }

                        if (!gameData.combatState?.isActive) {
                            relChangeDisplay.push(`${n.name} (${changeAmount > 0 ? '+' : ''}${changeAmount})`);
                        }
                    }
                }
            });

            // Announce the collective narrative alignment shift
            if (aiResponse.player_alignment_shift && aiResponse.player_alignment_shift !== 'Neutral') {
                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `sys-align-${Date.now()}`,
                        sender: 'system',
                        content: `**Alignment Shift**: *${aiResponse.player_alignment_shift}*`,
                        type: 'neutral'
                    }
                });
            }

            if (relChangeDisplay.length > 0) {
                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `sys-rel-${Date.now()}`,
                        sender: 'system',
                        content: `**Reactions**: ${relChangeDisplay.join(', ')}`,
                        type: 'neutral'
                    }
                });
            }
        }

        // NPC Memories: If we have turning summary, consider it as a broad memory for nearby NPCs
        if (!gameData.combatState?.isActive && aiResponse.turn_summary) {
            const resolvedLocale = finalUpdates.currentLocale || gameData.currentLocale || "";
            gameData.npcs?.forEach(n => {
                const isAtLocale = isLocaleMatch(n.currentPOI || "", resolvedLocale);
                if (isAtLocale && n.status !== 'Dead') {
                    const newMemory: NPCMemory = { timestamp: gameData.currentTime, content: aiResponse.turn_summary! };
                    const updatedMemories = [...(n.memories || []), newMemory].slice(-20);
                    dispatch({ type: 'UPDATE_NPC', payload: { ...n, memories: updatedMemories } });
                }
            });
        }

        // 4.5 POI Memory: Record event at current location
        // Note: For now, we skip automated POI memory without the Housekeeper, 
        // as the Narrator doesn't natively return structured memories yet.
        // We could extract the summary as a memory.
        if (!gameData.combatState?.isActive && aiResponse.turn_summary) {
            const poiId = gameData.current_site_id || '';
            if (poiId) {
                finalUpdates.poiMemories = [{ poiId, memory: aiResponse.turn_summary }];
            }
        }

        // 5. Resolve Auditor Result Metadata
        if (resolvedLocale) finalUpdates.currentLocale = resolvedLocale;
        if (forcedCoordinates) {
            finalUpdates.playerCoordinates = forcedCoordinates;
            if (finalUpdates.location_update) {
                finalUpdates.location_update.coordinates = forcedCoordinates;
            }
        } else if (finalUpdates.location_update?.coordinates) {
            finalUpdates.playerCoordinates = finalUpdates.location_update.coordinates;
        }
        if (aiResponse.time_passed_minutes && aiResponse.time_passed_minutes > 0) {
            const currentDate = parseGameTime(gameData.currentTime);
            if (currentDate) {
                const newDate = addDuration(currentDate, 0, aiResponse.time_passed_minutes);
                finalUpdates.currentTime = formatGameTime(newDate);
            }
        }

        // 6. Recruitment Logic (Narrator signaled)
        if (aiResponse.npc_resolution?.some(r => r.isFollowing && !gameData.companions?.some(c => c.name === r.name)) && npcActions) {
            aiResponse.npc_resolution.forEach(res => {
                if (res.isFollowing) {
                    const npc = gameData.npcs?.find(n => n.name === res.name);
                    if (npc && !npc.companionId) {
                        npcActions.inviteNpcToParty(npc, { skipNarrative: true });
                    }
                }
            });
        }

        // 7. Story Log Creation
        if (!gameData.combatState?.isActive && !aiResponse.combat_detected) {
            finalUpdates.storyUpdates = [{
                id: `log-${Date.now()}`,
                content: aiNarrative,
                summary: aiResponse.turn_summary || "Interaction deed.",
                isNew: true,
                originatingMessageId: aiMessageId
            }];
        }

        dispatch({ type: 'AI_UPDATE', payload: finalUpdates });

        return { engagementConfirmed: !!aiResponse.combat_detected };
    }, [dispatch, combatActions, notifyInventoryChanges]);


    return { processConsequences };
};

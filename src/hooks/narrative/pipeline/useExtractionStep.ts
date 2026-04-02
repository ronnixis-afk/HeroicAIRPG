
// hooks/narrative/pipeline/useExtractionStep.ts

import React, { useCallback } from 'react';
import { GameData, GameAction, AIUpdatePayload, NPC, StoryLog, InventoryUpdatePayload, NPCMemory, LoreEntry, AIResponse, MapZone, ExtractionScopeFlags } from '../../../types';
import { auditSystemState, performHousekeeping, resolveLocaleCreation, generateZoneDetails, enrichItemDetails, detectExtractionScope } from '../../../services/geminiService';
import { forgeSkins } from '../../../services/ItemGeneratorService';
import { formatRelationshipChange, calculateAlignmentRelationshipShift } from '../../../utils/npcUtils';
import { isLocaleMatch } from '../../../utils/mapUtils';
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

        // Step 0: Detection Gate (Relevance Optimization)
        const scope = await detectExtractionScope(userContent, aiNarrative);

        if (!scope.required) {
            if (uiSetters) {
                uiSetters.setIsAuditing(false);
                uiSetters.setIsHousekeeping(false);
            }
            return { engagementConfirmed: false };
        }

        // 1. Concurrent Audit & Housekeeping (Gated)
        const auditPromise = (scope.flags.spatialChange || scope.flags.socialChange || scope.flags.engagementChange || scope.flags.timeChange)
            ? auditSystemState(userContent, aiNarrative, gameData, excludeList, scope.flags)
            : Promise.resolve({
                currentLocale: gameData.currentLocale || '',
                timePassedMinutes: 0,
                newNPCs: [],
                npcUpdates: [],
                activeEngagement: false,
                missedRollRequests: [],
                turnSummary: "",
                inventoryUpdates: [],
                isAboard: undefined
            });

        const housekeepingPromise = (scope.flags.itemChange || scope.flags.alignmentChange || scope.flags.socialChange)
            ? performHousekeeping(userContent, aiNarrative, gameData, aiResponse.updates?.adventureBrief || (gameData.messages.slice(-1)[0]?.explicitAlignment), scope.flags)
            : Promise.resolve({
                inventoryUpdates: [],
                userAlignmentShift: "Neutral",
                npcMemories: [],
                recruitedNpcIds: [],
                poiMemory: undefined as { poiId: string, memory: string } | undefined
            });

        const [auditResult, housekeepingResult] = await Promise.all([auditPromise, housekeepingPromise]);

        const finalUpdates: AIUpdatePayload = {
            ...(aiResponse.updates || {}),
            location_update: aiResponse.location_update,
            npc_resolution: aiResponse.npc_resolution,
            adventureBrief: aiResponse.adventure_brief,
            isAboard: auditResult.isAboard !== undefined ? auditResult.isAboard : gameData.isAboard
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
                zone: currentZoneName,
                site_name: finalSiteName,
                site_id: finalSiteId,
                is_new_site: targetCoords !== gameData.playerCoordinates || !!forcedLocale,
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

        // 2. Resolve Inventory Transitions
        const allInventoryUpdates = [
            ...(housekeepingResult.inventoryUpdates || []),
            ...(auditResult.inventoryUpdates || [])
        ];

        if (allInventoryUpdates.length > 0) {
            const skillConfig = gameData.skillConfiguration || 'Fantasy';
            
            // Waterfall: Forge -> Enrich (Thematic Pass)
            const skinnedUpdates = await Promise.all(allInventoryUpdates.map(async batch => {
                if (batch.action === 'remove') return batch;
                
                const forgedItems = forgeSkins(batch.items, skillConfig);
                const enrichedItems = await Promise.all(forgedItems.map(async (item) => {
                    const enriched = await enrichItemDetails(item, gameData);
                    return { ...item, ...enriched };
                }));
                
                return { ...batch, items: enrichedItems };
            }));

            finalUpdates.inventoryUpdates = [...(finalUpdates.inventoryUpdates || []), ...skinnedUpdates];

            skinnedUpdates.forEach(batch => {
                if (!batch || !Array.isArray(batch.items)) return;
                const owner = batch.ownerId === 'player' ? 'You' : (gameData.companions.find(c => c.id === batch.ownerId)?.name || 'Companion');
                const action = batch.action || 'add';
                const isRemoval = action === 'remove';
                batch.items.forEach((item: any) => {
                    if (!item || !item.name) return;
                    dispatch({
                        type: 'ADD_MESSAGE',
                        payload: {
                            id: `sys-inv-${isRemoval ? 'loss' : 'gain'}-${Date.now()}-${Math.random()}`,
                            sender: 'system',
                            content: `${owner} ${isRemoval ? 'lost' : 'acquired'}: **${item.name}**`,
                            type: isRemoval ? 'neutral' : 'positive'
                        }
                    });
                });
            });
        }

        // 2.5 Resolve Recruitment (NEW)
        if (housekeepingResult.recruitedNpcIds?.length > 0 && npcActions) {
            housekeepingResult.recruitedNpcIds.forEach((id: string) => {
                const npc = gameData.npcs?.find(n => n.id === id);
                if (npc && !npc.companionId) {
                    // Logic Gate: Ensure recursion safety by checking if they are already companions
                    npcActions.inviteNpcToParty(npc, { skipNarrative: true });
                }
            });
        }

        // 3. Resolve Social Updates (NPCs)
        const updatedNpcIds = new Set<string>();
        const mergedNpcUpdates: (Partial<NPC> & { id: string })[] = [];

        // A. Auditor Updates (Status, POI)
        if (auditResult.npcUpdates?.length > 0) {
            auditResult.npcUpdates.forEach((upd: any) => {
                if (!upd.id) return;
                let finalUpd = { ...upd };
                if (finalUpd.status === 'Dead') {
                    finalUpd.isFollowing = false;
                    finalUpd.deathTimestamp = gameData.currentTime;
                }
                mergedNpcUpdates.push(finalUpd);
                updatedNpcIds.add(upd.id);
            });
        }

        // B. AI Resolution Updates (Following, Leaves)
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

                    // Enforce following rule again just in case
                    const currentStatus = (mergedNpcUpdates.find(u => u.id === npc.id)?.status) || npc.status;
                    if (currentStatus === 'Dead') finalUpd.isFollowing = false;

                    const existingIdx = mergedNpcUpdates.findIndex(u => u.id === npc.id);
                    if (existingIdx > -1) {
                        mergedNpcUpdates[existingIdx] = { ...mergedNpcUpdates[existingIdx], ...finalUpd };
                    } else {
                        mergedNpcUpdates.push(finalUpd);
                        updatedNpcIds.add(npc.id);
                    }
                }
            });
        }

        // C. New NPCs discovery
        if (auditResult.newNPCs?.length > 0) {
            auditResult.newNPCs.forEach((newNpc: any) => {
                const id = `npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                dispatch({ type: 'ADD_NPC', payload: { ...newNpc, id, isNew: true, status: 'Alive', relationship: 0, currentPOI: resolvedLocale || 'Current' } });
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
                    else if (housekeepingResult.userAlignmentShift && housekeepingResult.userAlignmentShift !== 'Neutral') {
                        changeAmount = calculateAlignmentRelationshipShift(housekeepingResult.userAlignmentShift, n.moralAlignment);
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
                            // Combat Initialization should theoretically be called here via a pipeline trigger, 
                            // but for now, the system message alerts the player.
                        }

                        if (!gameData.combatState?.isActive) {
                            relChangeDisplay.push(`${n.name} (${changeAmount > 0 ? '+' : ''}${changeAmount})`);
                        }
                    }
                }
            });

            // Announce the collective narrative alignment shift
            if (housekeepingResult.userAlignmentShift && housekeepingResult.userAlignmentShift !== 'Neutral') {
                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `sys-align-${Date.now()}`,
                        sender: 'system',
                        content: `**Alignment Shift**: *${housekeepingResult.userAlignmentShift}*`,
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

        if (!gameData.combatState?.isActive && housekeepingResult.npcMemories?.length > 0) {
            housekeepingResult.npcMemories.forEach(m => {
                const npc = gameData.npcs?.find(n => n.id === m.npcId || (n.name && String(n.name).toLowerCase().trim() === String(m.npcId).toLowerCase().trim()));
                if (npc) {
                    const newMemory: NPCMemory = { timestamp: gameData.currentTime, content: m.memory };
                    const updatedMemories = [...(npc.memories || []), newMemory].slice(-20);
                    dispatch({ type: 'UPDATE_NPC', payload: { ...npc, memories: updatedMemories } });
                }
            });
        }

        // 4.5 POI Memory: Record event at current location
        if (!gameData.combatState?.isActive && housekeepingResult.poiMemory?.memory) {
            const poiMem = housekeepingResult.poiMemory;
            // Resolve POI by site_id or by matching the current locale name in knowledge
            const poiId = poiMem.poiId || gameData.current_site_id || '';
            if (poiId) {
                finalUpdates.poiMemories = [{ poiId, memory: poiMem.memory }];
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
        if (auditResult.timePassedMinutes > 0) {
            const currentDate = parseGameTime(gameData.currentTime);
            if (currentDate) {
                const newDate = addDuration(currentDate, 0, auditResult.timePassedMinutes);
                finalUpdates.currentTime = formatGameTime(newDate);
            }
        }

        // 6. Missed Rolls Reconciliation
        if (auditResult.missedRollRequests && auditResult.missedRollRequests.length > 0) {
            const extraRes = combatActions.processDiceRolls(auditResult.missedRollRequests);
            dispatch({
                type: 'SET_MESSAGES',
                payload: (prev: any[]) => prev.map(m => m.id === aiMessageId ? { ...m, rolls: [...(m.rolls || []), ...extraRes.rolls] } : m)
            });
        }

        // 7. Story Log Creation
        // Engagement Logic Gate: If an attack happened, don't create a peaceful story log yet.
        const isEngaged = aiResponse.active_engagement || auditResult.activeEngagement;
        if (!gameData.combatState?.isActive && !isEngaged) {
            const logSummary = aiResponse.turnSummary || auditResult.turnSummary || "Interaction deed.";
            const truncatedSummary = logSummary.split(' ').slice(0, 10).join(' ');

            finalUpdates.storyUpdates = [{
                id: `log-${Date.now()}`,
                content: aiNarrative,
                summary: truncatedSummary,
                isNew: true,
                originatingMessageId: aiMessageId
            }];
        }

        dispatch({ type: 'AI_UPDATE', payload: finalUpdates });

        return { engagementConfirmed: isEngaged };
    }, [dispatch, combatActions, notifyInventoryChanges]);


    return { processConsequences };
};


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
    uiSetters?: { setIsAuditing: (val: boolean) => void, setIsHousekeeping: (val: boolean) => void }
) => {
    const processConsequences = useCallback(async (
        userContent: string,
        aiNarrative: string,
        gameData: GameData,
        aiMessageId: string,
        aiResponse: AIResponse,
        isExplicit: boolean = false,
        forcedCoordinates?: string
    ) => {
        const registryNpcNames = (gameData.npcs ?? []).map(n => n.name ? String(n.name).toLowerCase().trim() : 'unknown');
        const excludeList = [
            gameData.playerCharacter.name,
            ...(gameData.companions ?? []).map(c => c.name),
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
                turnSummary: ""
            });

        const housekeepingPromise = (scope.flags.itemChange || scope.flags.alignmentChange || scope.flags.socialChange)
            ? performHousekeeping(userContent, aiNarrative, gameData, aiResponse.updates?.adventureBrief || (gameData.messages.slice(-1)[0]?.explicitAlignment), scope.flags)
            : Promise.resolve({
                inventoryUpdates: [],
                userAlignmentShift: "Neutral",
                npcMemories: []
            });

        const [auditResult, housekeepingResult] = await Promise.all([auditPromise, housekeepingPromise]);

        const finalUpdates: AIUpdatePayload = {
            ...(aiResponse.updates || {}),
            location_update: aiResponse.location_update,
            npc_resolution: aiResponse.npc_resolution,
            adventureBrief: aiResponse.adventure_brief
        };

        // --- SPATIAL SNAPPING & VALIDATION GATE ---
        const narratorLoc = aiResponse.location_update;
        let resolvedLocale = gameData.currentLocale || '';

        if (narratorLoc) {
            const isShipDestination = (gameData.companions ?? []).some(c => c.isShip && c.name.toLowerCase().trim() === narratorLoc.site_name.toLowerCase().trim());

            // EVENT LANGUAGE FILTER: Prevent dramatic narrative events from creating fake POIs.
            const eventPatterns = /\b(death|dying|killed|slain|fallen|aftermath|battle|slaughter|massacre|murder|grave|corpse|remains|memorial|execution|ambush|tomb|victim|demise)\b/i;
            
            // NPC NAME PROTECTION: If the name contains any NPC that was JUST marked as dead.
            const deadNpcNames = (aiResponse.npc_resolution || [])
                .filter(res => res.isFollowing === false && /dead|killed|slain|dies/i.test(res.summary))
                .map(res => res.name.toLowerCase().trim());

            const isNpcDeathSite = deadNpcNames.some(name => narratorLoc.site_name.toLowerCase().includes(name));
            const isEventName = eventPatterns.test(narratorLoc.site_name) || isNpcDeathSite;

            if (narratorLoc.transition_type === 'zone_change' && !isEventName) {
                const destHint = narratorLoc.destination_zone_hint || narratorLoc.site_name;
                const destHintLower = destHint.toLowerCase().trim();

                // 1. Try to find the zone
                let targetZone = (gameData.mapZones || []).find(z => z.name.toLowerCase().includes(destHintLower) || destHintLower.includes(z.name.toLowerCase()));

                let newCoords = forcedCoordinates || gameData.playerCoordinates || '0-0';

                // If we have forced coordinates, and we found a zone, ensure the zone coordinates match the forced ones
                if (forcedCoordinates && targetZone && targetZone.coordinates !== forcedCoordinates) {
                    // Coordinates mismatch: Trust the forced ones (the user-confirmed travel target)
                    // If the zone exists elsewhere, we ignore it and treat this as a potentially new site or exploration
                    targetZone = (gameData.mapZones || []).find(z => z.coordinates === forcedCoordinates);
                }

                if (targetZone) {
                    newCoords = targetZone.coordinates;
                    finalUpdates.location_update = {
                        ...narratorLoc,
                        sector: newCoords,
                        zone: targetZone.name,
                        is_new_site: true,
                        transition_type: 'zone_change'
                    };
                } else {
                    // Generate new offset coordinate only if NOT forced
                    if (!forcedCoordinates) {
                        const p = newCoords.split('-');
                        let nx = parseInt(p[0]) || 0;
                        let ny = parseInt(p[1]) || 0;
                        nx += (Math.random() > 0.5 ? 1 : -1);
                        ny += (Math.random() > 0.5 ? 1 : -1);
                        newCoords = `${nx}-${ny}`;
                    }

                    try {
                        const existingZoneNames = (gameData.mapZones || []).map(z => z.name);
                        const details = await generateZoneDetails(newCoords, destHint, undefined, undefined, gameData.mapSettings, gameData.worldSummary, existingZoneNames);
                        const newZone: MapZone = {
                            id: `zone-${newCoords}-${Date.now()}`,
                            coordinates: newCoords,
                            name: details.name || destHint,
                            description: details.description,
                            hostility: typeof details.hostility === 'string' ? parseInt(details.hostility) || 0 : (details.hostility || 0),
                            visited: true,
                            tags: ['location'],
                            keywords: details.keywords || []
                        };
                        dispatch({ type: 'UPDATE_MAP_ZONE', payload: newZone });

                        finalUpdates.location_update = {
                            ...narratorLoc,
                            sector: newCoords,
                            zone: details.name || destHint,
                            site_name: narratorLoc.site_name || 'Open Area',
                            site_id: `open-area-${newCoords}`,
                            is_new_site: true,
                            transition_type: 'zone_change'
                        };
                    } catch (e) {
                        finalUpdates.location_update = {
                            ...narratorLoc,
                            sector: newCoords,
                            zone: destHint,
                            site_name: narratorLoc.site_name || 'Open Area',
                            site_id: `open-area-${newCoords}`,
                            is_new_site: true,
                            transition_type: 'zone_change'
                        };
                    }
                }
                resolvedLocale = finalUpdates.location_update.site_name || 'Open Area';
            } else if (narratorLoc.transition_type === 'staying' || isEventName) {
                // Snap back to current location — no physical movement occurred.
                const snapCoords = forcedCoordinates || gameData.playerCoordinates || '0-0';
                finalUpdates.location_update = {
                    ...narratorLoc,
                    sector: snapCoords,
                    zone: gameData.current_site_name || 'The Wilds',
                    site_name: gameData.current_site_name || 'Open Area',
                    site_id: gameData.current_site_id || `open-area-${snapCoords}`,
                    is_new_site: false,
                    transition_type: 'staying'
                };
                resolvedLocale = gameData.current_site_name || '';
            } else if (narratorLoc.transition_type === 'returning') {
                // Try to find the existing location in knowledge
                const lookupCoords = forcedCoordinates || gameData.playerCoordinates;
                const knownLocation = (gameData.knowledge || []).find(k => {
                    if (!k.tags?.includes('location') || k.coordinates !== lookupCoords) return false;

                    const kTitleParts = k.title.toLowerCase().trim().split(/\s+/);
                    const nTitleParts = narratorLoc.site_name.toLowerCase().trim().split(/\s+/);

                    // Simple similarity check: do they share significant words?
                    const sharedWords = kTitleParts.filter(word => nTitleParts.includes(word) && word.length > 3);

                    // Exact match or at least one significant shared word (like 'interrogation')
                    return k.title.toLowerCase().trim() === narratorLoc.site_name.toLowerCase().trim() || sharedWords.length > 0;
                });

                if (knownLocation) {
                    // Snap to the known POI
                    finalUpdates.location_update = {
                        ...narratorLoc,
                        sector: lookupCoords || '0-0',
                        zone: gameData.current_site_name || 'The Wilds',
                        site_name: knownLocation.title,
                        site_id: knownLocation.id,
                        is_new_site: false,
                        transition_type: 'returning'
                    };
                    resolvedLocale = knownLocation.title;
                } else {
                    // Fallback to exploring_new if we can't find it to prevent game breaking
                    narratorLoc.transition_type = 'exploring_new';
                }
            }

            // Note: Not an 'else if' because a failed 'returning' falls through to this block
            if ((narratorLoc.transition_type === 'exploring_new' || !narratorLoc.transition_type) && !isEventName) {
                try {
                    const existingPois = (gameData.knowledge || [])
                        .filter(k => k.coordinates === gameData.playerCoordinates && k.tags?.includes('location'))
                        .map(k => k.title);

                    const validationResult = await resolveLocaleCreation(narratorLoc.site_name, gameData, existingPois);
                    if (!validationResult.validation_passed) {
                        finalUpdates.location_update = {
                            ...narratorLoc,
                            sector: gameData.playerCoordinates || '0-0',
                            zone: gameData.current_site_name || 'The Wilds',
                            site_name: gameData.current_site_name || 'Open Area',
                            site_id: gameData.current_site_id || `open-area-${gameData.playerCoordinates}`,
                            is_new_site: false,
                            transition_type: 'staying'
                        };
                        resolvedLocale = gameData.current_site_name || '';
                    } else {
                        resolvedLocale = validationResult.name;
                        // Inject the validated details
                        finalUpdates.location_update = {
                            ...narratorLoc,
                            site_name: validationResult.name,
                            site_id: `poi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            is_new_site: validationResult.isNew,
                            transition_type: 'exploring_new'
                        };

                        if (validationResult.isNew && validationResult.isLiteralTransition && !isShipDestination) {
                            const newEntry: Omit<LoreEntry, 'id'> = {
                                title: validationResult.name,
                                content: validationResult.content,
                                coordinates: narratorLoc.sector || gameData.playerCoordinates,
                                tags: ['location'],
                                isNew: true,
                                visited: true
                            };
                            dispatch({ type: 'ADD_KNOWLEDGE', payload: [newEntry] });
                        }
                    }
                } catch (e) {
                    resolvedLocale = narratorLoc.site_name;
                }
            }

        } else {
            resolvedLocale = auditResult.currentLocale || gameData.currentLocale || '';
        }

        // 2. Resolve Inventory Transitions
        if (housekeepingResult.inventoryUpdates?.length > 0) {
            const skillConfig = gameData.skillConfiguration || 'Fantasy';
            
            // Waterfall: Forge -> Enrich (Thematic Pass)
            const skinnedUpdates = await Promise.all(housekeepingResult.inventoryUpdates.map(async batch => {
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


        // 5. Resolve Auditor Result Metadata
        if (resolvedLocale) finalUpdates.currentLocale = resolvedLocale;
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

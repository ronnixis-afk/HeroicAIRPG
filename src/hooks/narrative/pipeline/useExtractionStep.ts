
// hooks/narrative/pipeline/useExtractionStep.ts

import React, { useCallback } from 'react';
import { GameData, GameAction, AIUpdatePayload, NPC, StoryLog, InventoryUpdatePayload, NPCMemory, LoreEntry, AIResponse } from '../../../types';
import { auditSystemState, performHousekeeping, resolveLocaleCreation } from '../../../services/geminiService';
import { forgeSkins } from '../../../utils/itemMechanics';
import { formatRelationshipChange, calculateAlignmentRelationshipShift } from '../../../utils/npcUtils';
import { isLocaleMatch } from '../../../utils/mapUtils';
import { parseGameTime, addDuration, formatGameTime } from '../../../utils/timeUtils';

export const useExtractionStep = (
    dispatch: React.Dispatch<GameAction>,
    notifyInventoryChanges: (updates: any[]) => void,
    combatActions: any
) => {
    const processConsequences = useCallback(async (
        userContent: string,
        aiNarrative: string,
        gameData: GameData,
        aiMessageId: string,
        aiResponse: AIResponse
    ) => {
        const registryNpcNames = (gameData.npcs ?? []).map(n => n.name ? String(n.name).toLowerCase().trim() : 'unknown');
        const excludeList = [
            gameData.playerCharacter.name,
            ...(gameData.companions ?? []).map(c => c.name),
            ...registryNpcNames
        ].filter((n): n is string => !!n);

        // 1. Concurrent Audit & Housekeeping
        const [auditResult, housekeepingResult] = await Promise.all([
            auditSystemState(userContent, aiNarrative, gameData, excludeList),
            performHousekeeping(userContent, aiNarrative, gameData)
        ]);

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
            const isAttemptingMove = narratorLoc.site_id !== gameData.current_site_id;
            const isShipDestination = (gameData.companions ?? []).some(c => c.isShip && c.name.toLowerCase().trim() === narratorLoc.site_name.toLowerCase().trim());

            // EVENT LANGUAGE FILTER: Prevent dramatic narrative events from creating fake POIs.
            // The AI sometimes names the "location" after story events (e.g., "Death of Grimbold", "Aftermath of the Battle").
            const eventPatterns = /\b(death|dying|fallen|aftermath|battle|slaughter|massacre|murder|grave|corpse|remains|memorial|execution|ambush|tomb)\b/i;
            const isEventName = eventPatterns.test(narratorLoc.site_name);

            if (isAttemptingMove && isEventName) {
                // Snap back to current location — the player hasn't physically moved, something just happened here.
                finalUpdates.location_update = {
                    ...narratorLoc,
                    sector: gameData.playerCoordinates || '0-0',
                    zone: gameData.current_site_name || 'The Wilds',
                    site_name: gameData.current_site_name || 'Open Area',
                    site_id: gameData.current_site_id || 'open-area',
                    is_new_site: false
                };
                resolvedLocale = gameData.current_site_name || '';
            } else if (isAttemptingMove) {
                try {
                    const validationResult = await resolveLocaleCreation(narratorLoc.site_name, gameData);
                    if (!validationResult.validation_passed) {
                        finalUpdates.location_update = {
                            ...narratorLoc,
                            sector: gameData.playerCoordinates || '0-0',
                            zone: gameData.current_site_name || 'The Wilds',
                            site_name: gameData.current_site_name || 'Open Area',
                            site_id: gameData.current_site_id || 'open-area',
                            is_new_site: false
                        };
                        resolvedLocale = gameData.current_site_name || '';
                    } else {
                        resolvedLocale = validationResult.name;
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
            } else {
                resolvedLocale = narratorLoc.site_name;
            }
        } else {
            resolvedLocale = auditResult.currentLocale || gameData.currentLocale || '';
        }

        // 2. Resolve Inventory Transitions
        if (housekeepingResult.inventoryUpdates?.length > 0) {
            const skillConfig = gameData.skillConfiguration || 'Fantasy';
            const skinnedUpdates = housekeepingResult.inventoryUpdates.map(batch => {
                if (batch.action === 'remove') return batch;
                return { ...batch, items: forgeSkins(batch.items, skillConfig) };
            });
            finalUpdates.inventoryUpdates = [...(finalUpdates.inventoryUpdates || []), ...skinnedUpdates];

            skinnedUpdates.forEach(batch => {
                if (!batch || !Array.isArray(batch.items)) return;
                const owner = batch.ownerId === 'player' ? 'You' : (gameData.companions.find(c => c.id === batch.ownerId)?.name || 'Companion');
                const action = batch.action || 'add';
                const isRemoval = action === 'remove';
                batch.items.forEach((item: any) => {
                    if (!item) return;
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

        // 3. Resolve Relationships mathematically & Add Memories
        const activeCompanionIds = new Set((gameData.companions || []).map(c => c.id));
        const currentLocale = resolvedLocale || gameData.currentLocale || "";

        let relChangeDisplay: string[] = [];

        (gameData.npcs || []).forEach(n => {
            const npcPOI = n.currentPOI || "";
            const isAtLocale = isLocaleMatch(npcPOI, currentLocale) || npcPOI === 'Current' || npcPOI === 'With Party';
            const isActiveCompanion = n.companionId && activeCompanionIds.has(n.companionId);
            const isAlive = n.status !== 'Dead';
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
        if (relChangeDisplay.length > 0 && housekeepingResult.userAlignmentShift && housekeepingResult.userAlignmentShift !== 'Neutral') {
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `sys-align-${Date.now()}`,
                    sender: 'system',
                    content: `**Action Alignment Detected**: *${housekeepingResult.userAlignmentShift}*\n**Reactions**: ${relChangeDisplay.join(', ')}`,
                    type: 'neutral'
                }
            });
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

        // 4. Resolve Quest Progress
        if (housekeepingResult.objectives?.length > 0) {
            finalUpdates.objectives = [...(finalUpdates.objectives || []), ...housekeepingResult.objectives];
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

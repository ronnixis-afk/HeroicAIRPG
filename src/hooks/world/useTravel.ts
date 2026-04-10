
// hooks/world/useTravel.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, ChatMessage, ActorSuggestion, MapZone, DiceRollRequest, StoryLog, LoreEntry, InventoryUpdatePayload, AIUpdatePayload } from '../../types';
import { generateZoneDetails, generatePoisForZone, parseTravelIntent, verifyCombatRelevance, expandEncounterPlot, preloadAdjacentZones, resolveLocaleCreation } from '../../services/geminiService';
import { generateEncounterRoll, getUnifiedProceduralPrompt, getClearPlotPrompt, getSkillFailurePrompt, getSkillSuccessPrompt } from '../../utils/EncounterMechanics';
import { parseGameTime, addDuration, formatGameTime } from '../../utils/timeUtils';
import { getTravelSpeed, parseCoords, parseHostility, getPOITheme, ensureUniqueTitle, isLocaleMatch } from '../../utils/mapUtils';
import { useWorldSelectors } from './useWorldSelectors';
import { useUI } from '../../context/UIContext';

export const useTravel = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    initiateCombatSequence: (narrative: string, suggestions: ActorSuggestion[], source?: any) => Promise<void>,
    setIsAiGenerating: (isGenerating: boolean) => void,
    submitAutomatedEvent?: any // Injected from Narrative Manager
) => {
    const { getCombatSlots } = useWorldSelectors(gameData);
    const { setPendingTravelConfirmation } = useUI();

    const BOARDING_MESSAGES = {
        fantasy: (shipName: string, dest: string) => `You and your party gather your belongings and board the ${shipName}, your footsteps echoing on the wooden planks as the crew prepares the sails. With a final check of the rigging, you cast off, the vessel cutting a path through the swells toward ${dest}.`,
        modern: (shipName: string, dest: string) => `You and your party haul the gear onto the ${shipName} and secure the hatches. You take the helm, the engine rumbling to life with a steady thrum into the hull. You clear the harbor and set a course, the wake trailing behind us as you make for ${dest}.`,
        scifi: (shipName: string, dest: string) => `Airlock cycled. You and your party step into the pressurized cabin of the ${shipName} as the pre-flight sequence begins. The ion thrusters whine with increasing intensity before lifting you from the surface. With a smooth acceleration, you break orbit and align for the transit to ${dest}.`,
        magitech: (shipName: string, dest: string) => `You and your party ascend the shimmering gangplank of the ${shipName}, feeling the hum of the mana-crystals beneath your feet. The navigator strikes the resonance chord, and the vessel lifts on a cushion of aetheric currents. You glide into the ley-line stream, charting a luminous path toward ${dest}.`
    };

    const processArrival = useCallback(async (
        coordinates: string,
        locationName: string,
        history: ChatMessage[],
        travelMethod?: string,
        targetLocale?: string
    ) => {
        if (!gameData || !submitAutomatedEvent) return "";

        let zone = gameData.mapZones?.find(z => z.coordinates === coordinates);
        let localeEntry = targetLocale ? gameData.knowledge?.find(k => k.title === targetLocale && k.coordinates === coordinates) : null;

        let isDiscovery = false;
        let generatedDescription = "";
        let currentPois: any[] = [];

        const globalReservedNames = [
            ...(gameData.mapZones || []).map(z => z.name),
            ...(gameData.knowledge || []).map(k => k.title)
        ];

        setIsAiGenerating(true);

        try {
            // --- SYSTEM MANAGED ERROR CORRECTION ---
            if (zone && !zone.visited && zone.name === "Uncharted Wilds") {
                // Remove legacy knowledge associated with the uncharted fallback
                const legacyEntries = gameData.knowledge?.filter(k => k.coordinates === coordinates && k.title.includes("Uncharted Wilds")) || [];
                legacyEntries.forEach(k => {
                    dispatch({ type: 'DELETE_KNOWLEDGE', payload: k.id });
                });
                
                // Set zone to undefined to force a full regeneration, randomising population and open area
                zone = undefined;
            }

            // 1. Resolve Geography and Discovery Status
            if (!zone) {
                isDiscovery = true;

                const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
                const effectiveHint = directions.includes(locationName.toLowerCase()) ? "Uncharted Lands" : locationName;

                const details = await generateZoneDetails(coordinates, effectiveHint, "", gameData.mapSettings, gameData.worldSummary, globalReservedNames);
                generatedDescription = details.description;
                const newZone: MapZone = {
                    id: `zone-${coordinates}-${Date.now()}`,
                    coordinates,
                    name: details.name || effectiveHint,
                    description: details.description,
                    hostility: parseHostility(details.hostility),
                    populationLevel: details.populationLevel as any,
                    zoneFeatures: details.zoneFeatures,
                    visited: true,
                    tags: ['location'],
                    keywords: details.keywords || []
                };
                zone = newZone;
                // Generate POIs on-the-fly for the newly discovered zone
                const existingPoisAtCoords = gameData.knowledge?.filter(k => k.coordinates === coordinates && (k.tags?.includes('location') || k.tags?.includes('poi'))) || [];
                
                const localTakenNames = [...globalReservedNames];
                currentPois = await generatePoisForZone(newZone, gameData.worldSummary || "", gameData.mapSettings, localTakenNames);
                const knowledgeEntries: Omit<LoreEntry, 'id'>[] = currentPois.map(p => {
                    const tags = ['location', 'poi'];
                    if (p.isPopulationCenter) tags.push('population-center');
                    if (p.baseType) tags.push(p.baseType);
                    
                    // Smart Match for discovery too, in case some POIs were preloaded
                    const localMatch = existingPoisAtCoords.find(ep => isLocaleMatch(ep.title, p.title));
                    const uniqueTitle = localMatch 
                        ? localMatch.title 
                        : ensureUniqueTitle(p.title, localTakenNames, newZone.name);
                    
                    localTakenNames.push(uniqueTitle);

                    return {
                        title: uniqueTitle,
                        content: p.content,
                        coordinates: newZone.coordinates,
                        tags: tags,
                        isNew: !localMatch,
                        visited: uniqueTitle.toLowerCase().includes('open area')
                    };
                });

                // --- FINAL SYSTEM SYNC: Resolve Discovery Landing Site ---
                // Now that the zone name is officially generated, re-snap the system state to the official name.
                const finalizedArrivalSite = `Open Area of ${newZone.name}`;
                
                // Deduplicate before dispatching
                const filteredEntries = knowledgeEntries.filter(ke => !existingPoisAtCoords.some(ep => (ep.title || "").toLowerCase().trim() === (ke.title || "").toLowerCase().trim())).map(k => ({
                    ...k,
                    id: `know-disc-${Date.now()}-${Math.random()}`
                } as LoreEntry));

                dispatch({
                    type: 'AI_UPDATE',
                    payload: {
                        current_site_name: finalizedArrivalSite,
                        currentLocale: finalizedArrivalSite,
                        mapZones: [newZone],
                        knowledge: filteredEntries, // Added as knowledge
                        // Correction for discovery: Move traveling NPCs to the actual zone name landing site
                        npcUpdates: (gameData.npcs || [])
                            .filter(n => n.currentPOI && n.currentPOI.toLowerCase().includes('open area'))
                            .map(n => ({ id: n.id, currentPOI: finalizedArrivalSite }))
                    }
                });
                
                // Update our local reference for narration
                currentPois = knowledgeEntries;
                const openArea = filteredEntries.find(k => k.title.toLowerCase().includes('open area'));
                if (openArea) localeEntry = openArea;
            } else {
                // Return visit or Preloaded zone
                if (!zone.visited) {
                    isDiscovery = true;
                    generatedDescription = zone.description || "";
                    dispatch({ type: 'UPDATE_MAP_ZONE', payload: { ...zone, visited: true, isLoading: false } });
                }

                // CHECK FOR LAZY POIs: If knowledge only has "Open Area" (or just one other landmark), trigger generation
                const existingPoisAtCoords = gameData.knowledge?.filter(k => k.coordinates === coordinates && k.tags?.includes('location')) || [];
                // If we have fewer than 3 POIs, it's likely a skeleton zone (Open Area + Settlement) that needs its 3 landmarks.
                const hasDetailedPois = existingPoisAtCoords.length >= 3;

                if (!hasDetailedPois) {
                    dispatch({
                        type: 'ADD_MESSAGE',
                        payload: {
                            id: `sys-poi-gen-${Date.now()}`,
                            sender: 'system',
                            content: `Generating local landmarks for ${zone.name}...`,
                            type: 'neutral'
                        }
                    });

                    const localTakenNames = [...globalReservedNames];
                    currentPois = await generatePoisForZone(zone, gameData.worldSummary || "", gameData.mapSettings, localTakenNames);
                    const knowledgeEntries: LoreEntry[] = currentPois.map(p => {
                        const tags = ['location', 'poi'];
                        if (p.isPopulationCenter) tags.push('population-center');
                        if (p.baseType) tags.push(p.baseType);
                        
                        // Smart Match: If this landmark (or something very similar) already exists AT THESE COORDS, reuse its name.
                        // This prevents creating "Iron Forge 2" when we are just lazy-loading details for "Iron Forge".
                        const localMatch = existingPoisAtCoords.find(ep => isLocaleMatch(ep.title, p.title));
                        const uniqueTitle = localMatch 
                            ? localMatch.title 
                            : ensureUniqueTitle(p.title, localTakenNames, zone?.name);
                            
                        localTakenNames.push(uniqueTitle);

                        return {
                            id: localMatch?.id || `know-lazy-${Date.now()}-${Math.random()}`,
                            title: uniqueTitle,
                            content: p.content,
                            coordinates: zone?.coordinates || coordinates,
                            tags: tags,
                            isNew: !localMatch,
                            visited: uniqueTitle.toLowerCase().includes('open area')
                        };
                    });
                    
                    // Deduplicate "Open Area" before dispatching
                    const filteredEntries = knowledgeEntries.filter(ke => !existingPoisAtCoords.some(ep => ep.title === ke.title));
                    dispatch({ type: 'ADD_KNOWLEDGE', payload: filteredEntries });
                    
                    // Update our local reference for narration
                    currentPois = [...existingPoisAtCoords, ...filteredEntries];
                } else {
                    currentPois = existingPoisAtCoords;
                }
            }

            // 1.5 Final Locale Resolution:
            // Prefer the matching POI if one exists, otherwise default to the zone's "Open Area".
            const openAreaTitle = `Open Area of ${zone?.name}`;
            localeEntry = currentPois.find(p => p.title === locationName) ||
                          currentPois.find(p => p.title === openAreaTitle) || 
                          currentPois.find(p => (p.title || "").toLowerCase().includes('open area')) || 
                          null;

            const poisText = currentPois.map(p => `- ${p.title}: ${p.content}`).join('\n');

            const lastSiteName = gameData.current_site_name || 'your previous location';

            // 2. Resolve Mechanics (Truth)
            const rawHostility = zone ? parseHostility(zone.hostility) : 0;
            // +75 Discovery Bonus only applies to the first visit of a zone OR an unvisited POI.
            // If the specific target location is already visited, the bonus is suppressed.
            const discoveryBonus = (isDiscovery && !localeEntry?.visited) ? 75 : 0;
            const { roll, matrix } = generateEncounterRoll(`Arrival at ${locationName}`, rawHostility + discoveryBonus);

            let isHostileIntent = false;
            let generativeCombatInstruction = "";
            let preRolledSummary = "";
            let preRolledRolls = [roll];
            let newGmNotes: string | undefined = undefined;

            if (roll.outcome === 'Encounter' && matrix) {
                const skillToUse = 'Survival';
                const partyMembers = [gameData.playerCharacter, ...gameData.companions.filter(c => c.isInParty && !c.isShip)];
                const dc = 12 + Math.floor(gameData.playerCharacter.level / 2);

                const requests: DiceRollRequest[] = partyMembers.map(member => ({
                    rollerName: member.name,
                    rollType: 'Skill Check',
                    checkName: skillToUse,
                    dc
                }));

                const res = window.processDiceRollsCache?.(requests) || { rolls: [], summary: "" };
                const skillRoll = res.rolls[0]; // Primary result for legacy narration context if needed
                preRolledRolls.push(...res.rolls);
                preRolledSummary = res.summary;

                // Determine overall success based on group check outcome (ANY SUCCESS policy in diceRolls.ts)
                const isGroupSuccess = res.rolls.some(r => r.outcome?.includes('Success'));

                if (!isGroupSuccess) {
                    const verifier = await verifyCombatRelevance(skillToUse, locationName, "Arriving at a location.", gameData.worldSummary || "");
                    if (verifier.shouldTriggerCombat) {
                        isHostileIntent = true;
                        newGmNotes = await expandEncounterPlot(matrix, gameData.worldSummary || "", poisText);
                        generativeCombatInstruction = getUnifiedProceduralPrompt(matrix, isDiscovery);
                    } else {
                        generativeCombatInstruction = getSkillFailurePrompt(skillToUse, verifier.reason);
                    }
                } else {
                    generativeCombatInstruction = getSkillSuccessPrompt(skillToUse, matrix);
                }
            } else {
                // If the journey is safe, we use the standard AI pipeline but signal it's a safe arrival.
                // This ensures we get a dynamic description and the universal engagement hook in gmNotes.
                generativeCombatInstruction = "Safe Arrival. No hostiles or obstacles encountered during this stretch of the journey. The party arrives exactly as intended.";
            }

            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `sys-arr-enc-${Date.now()}`,
                    sender: 'system',
                    content: preRolledSummary || (roll.outcome === 'No Encounter' ? `Safe arrival at ${locationName}.` : `Danger Check resulted in an encounter.`),
                    rolls: preRolledRolls,
                    type: 'neutral'
                }
            });

            // 3. Delegate Narration to Master Pipeline
            const mechanicsResult = {
                diceRolls: preRolledRolls,
                mechanicsSummary: preRolledSummary,
                combatInstruction: generativeCombatInstruction,
                isHostileIntent,
                newGmNotes,
                targetCoordinates: coordinates
            };

            const usedShip = (travelMethod && /ship|boat|sail|vessel|scout|fly|airship/i.test(travelMethod)) 
                ? gameData.companions.find(c => c.isShip) 
                : null;

            const travelers = gameData.npcs.filter(n => n.willTravel).map(n => n.name).join(', ');
            const stayedBehind = gameData.npcs.filter(n => n.isFollowing && !n.willTravel).map(n => n.name).join(', ');

            const systemContext = `[SYSTEM] Player has arrived at: ${locationName} (Coordinates: ${coordinates}) ${travelMethod ? `via ${travelMethod}` : ''}.
            ${isDiscovery ? 'STATUS: Discovery / First-time arrival.' : 'STATUS: Return visit.'}
            Visual Base: "${generatedDescription || zone?.description || 'A mysterious location.'}"
            [AUTHORIZED FOLLOWERS]: ${travelers || 'None (only player party)'}.
            [STAYED BEHIND]: ${stayedBehind || 'None'}.
            [AVAILABLE POINTS OF INTEREST]:
            ${poisText || 'Generic wilderness.'}
            ${newGmNotes ? `[ENCOUNTER PLOT]: ${newGmNotes}` : ''}
            ${localeEntry ? `Focal Point Lore: ${localeEntry.content}` : ''}
            ${usedShip ? `[PRIMARY ENVIRONMENT]: The party is currently aboard the ${usedShip.name}.` : ''}
            NARRATIVE DIRECTIVE: The transition is complete. ${usedShip ? `Narrate the arrival while emphasizing the party is still aboard the ${usedShip.name} which is at rest within ${zone?.name || locationName}.` : `Narrate the arrival at ${zone?.name || locationName} (${coordinates}).`} IMPORTANT: Narrate the arrival for the player ${travelers ? `and following NPCs: ${travelers}` : 'only'}. If any NPCs [STAYED BEHIND], they are NOT present in this scene. Seamlessly weave the [AVAILABLE POINTS OF INTEREST] and [ENCOUNTER PLOT] into the description. Portray the "Open Area" (or ${usedShip ? usedShip.name : 'your landing site'}) as your immediate locale while framing other landmarks as distant features or nearby points of interest.`;

            const matchedPoi = (gameData.knowledge || []).find(k => 
                k.coordinates === coordinates && 
                k.tags?.includes('location') && 
                isLocaleMatch(k.title, locationName)
            );

            const resultNarration = await submitAutomatedEvent(
                `I have arrived at ${locationName}.`, 
                mechanicsResult, 
                systemContext,
                locationName,
                matchedPoi?.id
            );
            
            // --- FINAL TRUTH RE-SNAP ---
            // Re-assert our standardized landing site after the AI narrative.
            // This ensures that any generic 'location_update' accidentally returned during 
            // combat initiation doesn't overwrite our zone-aware landing site.
            dispatch({
                type: 'AI_UPDATE',
                payload: {
                    current_site_name: locationName,
                    current_site_id: matchedPoi?.id || "",
                    currentSubLocation: "", // Clear sub-location on inter-zone travel
                    currentLocale: locationName
                }
            });
            const dispatchZoneUpdate = (zone: MapZone) => dispatch({ type: 'UPDATE_MAP_ZONE', payload: zone });
            const dispatchKnowledgeUpdate = (knowledge: Omit<LoreEntry, 'id'>[]) => dispatch({ type: 'ADD_KNOWLEDGE', payload: knowledge });
            preloadAdjacentZones(coordinates, gameData.mapZones || [], gameData, dispatchZoneUpdate, dispatchKnowledgeUpdate, gameData.knowledge || [])
                .catch(e => console.error("Silent preloading failed:", e));

            return resultNarration;

        } catch (e) {
            console.error("Arrival failed", e);
            return "";
        } finally {
            setIsAiGenerating(false);
        }
    }, [gameData, dispatch, getCombatSlots, setIsAiGenerating, submitAutomatedEvent]);

    const initiateTravel = useCallback(async (destination: string, method: string, targetCoordinates?: string) => {
        if (!gameData) return "";

        const currentCoords = gameData.playerCoordinates;
        let travelTimeHours = 1;
        if (targetCoordinates && currentCoords) {
            const p1 = parseCoords(currentCoords);
            const p2 = parseCoords(targetCoordinates);
            if (p1 && p2) {
                const rawDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const speed = getTravelSpeed(method);
                travelTimeHours = Math.max(1, Math.round((rawDist * 24) / speed));
            }
        }

        const startDate = parseGameTime(gameData.currentTime);
        if (startDate) {
            const arrivalTimeStr = formatGameTime(addDuration(startDate, travelTimeHours));
            dispatch({ type: 'UPDATE_CURRENT_TIME', payload: arrivalTimeStr });
        }

        if (targetCoordinates) {
            // Auto-join ship companion if traveling via vessel
            const shipCompanion = gameData.companions.find(c => c.isShip);
            const isShipTravel = /ship|boat|sail|vessel|scout|fly|airship|pilot|command|transit/i.test(method) || 
                               (shipCompanion && method.toLowerCase().trim() === shipCompanion.name.toLowerCase().trim());
            
            const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
            const isCardinal = directions.includes(destination.toLowerCase());
            let finalTargetLocale: string | undefined = isCardinal ? undefined : destination;

            // --- THE ULTIMATE SYSTEM TRUTH: IMMEDIATE SYNC ---
            // Update all location and traveler metadata immediately before the AI response.
            const targetZone = gameData.mapZones?.find(z => z.coordinates === targetCoordinates);
            const zoneTitle = targetZone?.name || destination;
            
            // Resolve if we are 'landing' at a specific known POI
            const matchedLandmark = (gameData.knowledge || []).find(k => 
                k.coordinates === targetCoordinates && 
                k.tags?.includes('location') && 
                isLocaleMatch(k.title, finalTargetLocale || destination)
            );

            const arrivalSiteName = matchedLandmark ? matchedLandmark.title : `Open Area of ${zoneTitle}`;
            
            // FORCE SYSTEM TRUTH: Location name is the POI if matched, otherwise 'Open Area'.
            const systemSiteTruth = arrivalSiteName;

            dispatch({
                type: 'AI_UPDATE',
                payload: {
                    playerCoordinates: targetCoordinates,
                    current_site_name: arrivalSiteName,
                    current_site_id: matchedLandmark?.id || "",
                    currentLocale: systemSiteTruth, 
                    isAboard: isShipTravel ? true : false,
                    // Finalize NPC positions immediately
                    npcUpdates: gameData.npcs.map(n => {
                        if (n.willTravel) {
                            return { id: n.id, currentPOI: systemSiteTruth, willTravel: false };
                        }
                        // For those who stayed behind, just reset the willTravel flag so it doesn't linger
                        return { id: n.id, willTravel: false };
                    })
                }
            });

            dispatch({ type: 'MOVE_PLAYER_ON_MAP', payload: targetCoordinates });
            
            // --- ENFORCE LANDING SITE TRUTH ---
            // We pass the specific landing site (POI or Open Area) for system consistency.
            return await processArrival(targetCoordinates, arrivalSiteName, gameData.messages, method, finalTargetLocale || destination);
        }
        return "";
    }, [gameData, dispatch, processArrival]);

    const processUserInitiatedTravel = useCallback(async (userContent: string, preParsedIntent?: { destination: string, method: string }) => {
        if (!gameData) return "";
        
        // 1. Parse Intent (with available landmarks context)
        setIsAiGenerating(true);
        try {
            const intent = preParsedIntent || await parseTravelIntent(userContent, gameData.messages, gameData);
            if (intent && intent.destination) {
                const dest = intent.destination;
                const method = intent.method || "walking";
                let targetCoords: string | undefined = undefined;

                let isKnownZone = false;
                let matchedZoneName = dest;
                const normalizedDest = String(dest || "").toLowerCase().trim();

                // 2. Resolve Cardinal Directions
                const directionMap: Record<string, { dx: number, dy: number }> = {
                    'north': { dx: 0, dy: -1 }, 'south': { dx: 0, dy: 1 },
                    'east': { dx: 1, dy: 0 }, 'west': { dx: -1, dy: 0 },
                    'northeast': { dx: 1, dy: -1 }, 'northwest': { dx: -1, dy: -1 },
                    'southeast': { dx: 1, dy: 1 }, 'southwest': { dx: -1, dy: 1 }
                };

                const p = parseCoords(gameData.playerCoordinates || '');
                if (directionMap[normalizedDest] && p) {
                    const move = directionMap[normalizedDest];
                    const nx = p.x + move.dx, ny = p.y + move.dy;
                    targetCoords = `${nx}-${ny}`;
                }

                // 3. Resolve Named Destinations (if no direction matched)
                if (!targetCoords && normalizedDest.length > 2) {
                    // Try to match against known zones first
                    const matchedZone = gameData.mapZones?.find(z => {
                        const zName = (z.name || "").toLowerCase();
                        return zName.includes(normalizedDest) || normalizedDest.includes(zName);
                    });

                    if (matchedZone) {
                        targetCoords = matchedZone.coordinates;
                        matchedZoneName = matchedZone.name;
                        isKnownZone = true;
                    } else {
                        // Match against POIs using more robust isLocaleMatch
                        const matchedPoi = gameData.knowledge?.find(k => k.tags?.includes('location') && (
                            k.title.toLowerCase().includes(normalizedDest) || 
                            normalizedDest.includes(k.title.toLowerCase())
                        ));
                        
                        if (matchedPoi) {
                            targetCoords = matchedPoi.coordinates;
                            matchedZoneName = matchedPoi.title;
                            isKnownZone = true;
                        }
                    }
                }

                setIsAiGenerating(false);

                // 4. Execution or Feedback Logic
                if (targetCoords) {
                    // Check if we are already there
                    const isSameCoords = targetCoords === gameData.playerCoordinates;
                    const isSameSite = isLocaleMatch(gameData.current_site_name || "", matchedZoneName);

                    if (isSameCoords && isSameSite && isKnownZone) {
                        dispatch({
                            type: 'ADD_MESSAGE',
                            payload: {
                                id: `sys-travel-same-${Date.now()}`,
                                sender: 'system',
                                content: `You are already at or near ${matchedZoneName}.`,
                                type: 'neutral'
                            }
                        });
                        return `You are already at or near ${matchedZoneName}.`;
                    }

                    if (isKnownZone) {
                        // Interrupt and wait for user confirmation
                        setPendingTravelConfirmation({
                            destination: matchedZoneName,
                            targetCoords,
                            method
                        });
                    } else {
                        // Uncharted exploration
                        return await initiateTravel(dest, method, targetCoords);
                    }
                } else if (!directionMap[normalizedDest]) {
                    // Named destination provided but no Map POI matched.
                    // TRIGGER LOCALE AGENT: Check if this is a sub-location within the current POI.
                    setIsAiGenerating(true);
                    try {
                        const resolution = await resolveLocaleCreation(dest, gameData);
                        
                        if (resolution.validation_passed) {
                            // If it's a sub-location, or a valid new site in the same area
                            const matchedSite = (gameData.knowledge || []).find(k => 
                                k.coordinates === gameData.playerCoordinates && 
                                k.tags?.includes('location') && 
                                isLocaleMatch(k.title, resolution.name)
                            );

                            dispatch({
                                type: 'AI_UPDATE',
                                payload: {
                                    current_site_name: resolution.name,
                                    current_site_id: matchedSite?.id || "",
                                    currentSubLocation: resolution.sub_location,
                                    // If it's NOT a literal transition, we stay at the same coordinates
                                    playerCoordinates: resolution.isLiteralTransition ? undefined : gameData.playerCoordinates
                                }
                            });

                            dispatch({
                                type: 'ADD_MESSAGE',
                                payload: {
                                    id: `sys-subloc-${Date.now()}`,
                                    sender: 'ai',
                                    content: resolution.content,
                                    type: 'neutral'
                                }
                            });
                        } else {
                            // --- IMMERSIVE FAILURE HANDLER ---
                            dispatch({
                                type: 'ADD_MESSAGE',
                                payload: {
                                    id: `sys-loc-fail-${Date.now()}`,
                                    sender: 'ai',
                                    content: resolution.immersive_failure_message || `You find no sign of that location in this area.`,
                                    type: 'neutral'
                                }
                            });
                            return resolution.immersive_failure_message || "Location not found.";
                        }
                    } catch (e) {
                         dispatch({
                            type: 'ADD_MESSAGE',
                            payload: {
                                id: `sys-travel-error-${Date.now()}`,
                                sender: 'system',
                                content: `The spatial anchor failed to resolve that location.`,
                                type: 'neutral'
                            }
                        });
                    } finally {
                        setIsAiGenerating(false);
                    }
                }
            } else {
                setIsAiGenerating(false);
            }
        } catch (e) {
            console.error("Travel intent parsing failed", e);
            setIsAiGenerating(false);
            return "";
        }
        return "";
    }, [gameData, dispatch, initiateTravel, setIsAiGenerating, setPendingTravelConfirmation]);

    return { processArrival, initiateTravel, processUserInitiatedTravel };
};

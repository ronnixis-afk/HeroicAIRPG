
// hooks/world/useTravel.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, ChatMessage, ActorSuggestion, MapZone, DiceRollRequest, StoryLog, LoreEntry, InventoryUpdatePayload, AIUpdatePayload } from '../../types';
import { generateZoneDetails, generatePoisForZone, parseTravelIntent, verifyCombatRelevance, expandEncounterPlot, preloadAdjacentZones } from '../../services/geminiService';
import { generateEncounterRoll, getUnifiedProceduralPrompt, getClearPlotPrompt, getSkillFailurePrompt, getSkillSuccessPrompt } from '../../utils/EncounterMechanics';
import { parseGameTime, addDuration, formatGameTime } from '../../utils/timeUtils';
import { getTravelSpeed, parseCoords, parseHostility, getPOITheme } from '../../utils/mapUtils';
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
        if (!gameData || !submitAutomatedEvent) return;

        let zone = gameData.mapZones?.find(z => z.coordinates === coordinates);
        let localeEntry = targetLocale ? gameData.knowledge?.find(k => k.title === targetLocale && k.coordinates === coordinates) : null;

        let isDiscovery = false;
        let generatedDescription = "";
        let currentPois: any[] = [];

        setIsAiGenerating(true);

        try {
            // 1. Resolve Geography and Discovery Status
            if (!zone) {
                isDiscovery = true;

                const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
                const effectiveHint = directions.includes(locationName.toLowerCase()) ? "Uncharted Lands" : locationName;

                const details = await generateZoneDetails(coordinates, effectiveHint, "", gameData.mapSettings, gameData.worldSummary);
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
                dispatch({ type: 'UPDATE_MAP_ZONE', payload: newZone });

                // Generate POIs on-the-fly for the newly discovered zone
                currentPois = await generatePoisForZone(newZone, gameData.worldSummary || "", gameData.mapSettings);
                const knowledgeEntries: Omit<LoreEntry, 'id'>[] = currentPois.map(p => {
                    const tags = ['location'];
                    if (p.isPopulationCenter) tags.push('population-center');
                    if (p.baseType) tags.push(p.baseType);
                    
                    return {
                        title: p.title,
                        content: p.content,
                        coordinates: newZone.coordinates,
                        tags: tags,
                        isNew: true,
                        visited: p.title.toLowerCase().includes('open area')
                    };
                });
                dispatch({ type: 'ADD_KNOWLEDGE', payload: knowledgeEntries });

                // If no target locale was specified, land in the newly created "Open Area"
                if (!targetLocale) {
                    const openArea = knowledgeEntries.find(k => k.title.toLowerCase().includes('open area'));
                    if (openArea) {
                        localeEntry = openArea as LoreEntry;
                    }
                }
            } else {
                // Return visit or Preloaded zone
                if (!zone.visited) {
                    isDiscovery = true;
                    generatedDescription = zone.description || "";
                    dispatch({ type: 'UPDATE_MAP_ZONE', payload: { ...zone, visited: true, isLoading: false } });
                }

                // CHECK FOR LAZY POIs: If knowledge only has "Open Area", trigger generation
                const existingPoisAtCoords = gameData.knowledge?.filter(k => k.coordinates === coordinates && k.tags?.includes('location')) || [];
                const hasDetailedPois = existingPoisAtCoords.some(k => !k.title.toLowerCase().includes('open area'));

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

                    const allKnownNames = [
                        ...(gameData.mapZones || []).map(z => z.name),
                        ...(gameData.knowledge || []).map(k => k.title)
                    ];
                    currentPois = await generatePoisForZone(zone, gameData.worldSummary || "", gameData.mapSettings, allKnownNames);
                    const knowledgeEntries: LoreEntry[] = currentPois.map(p => {
                        const tags = ['location'];
                        if (p.isPopulationCenter) tags.push('population-center');
                        if (p.baseType) tags.push(p.baseType);
                        
                        return {
                            id: `know-lazy-${Date.now()}-${Math.random()}`,
                            title: p.title,
                            content: p.content,
                            coordinates: zone?.coordinates || coordinates,
                            tags: tags,
                            isNew: true,
                            visited: p.title.toLowerCase().includes('open area')
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

            const poisText = currentPois.map(p => `- ${p.title}: ${p.content}`).join('\n');

            const lastSiteName = gameData.current_site_name || 'your previous location';

            // 2. Resolve Mechanics (Truth)
            const rawHostility = zone ? parseHostility(zone.hostility) : 0;
            const discoveryBonus = isDiscovery ? 75 : 0;
            const { roll, matrix } = generateEncounterRoll(`Arrival at ${locationName}`, rawHostility + discoveryBonus);

            let isHostileIntent = false;
            let generativeCombatInstruction = "";
            let preRolledSummary = "";
            let preRolledRolls = [roll];
            let newGmNotes: string | undefined = undefined;

            if (roll.outcome === 'Encounter' && matrix) {
                const skillToUse = travelMethod ? 'Stealth' : 'Perception';
                const request: DiceRollRequest = {
                    rollerName: gameData.playerCharacter.name,
                    rollType: 'Skill Check',
                    checkName: skillToUse,
                    dc: 12 + Math.floor(gameData.playerCharacter.level / 2)
                };
                const res = window.processDiceRollsCache?.([request]) || { rolls: [], summary: "" };
                const skillRoll = res.rolls[0];
                preRolledRolls.push(skillRoll);
                preRolledSummary = res.summary;

                if (skillRoll.outcome === 'Fail' || skillRoll.outcome === 'Critical Fail') {
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
                // If the journey is safe, we skip the AI pipeline and provide an immediate flavorful summary
                const theme = getPOITheme(gameData.worldSummary || "");
                const anyShip = gameData.companions.find(c => c.isShip);
                const shipName = anyShip?.name || "your vessel";
                const m = (travelMethod || "walking").toLowerCase();

                let chosenMessage = "";
                if (m.includes('ship') || m.includes('boat') || m.includes('sail') || m.includes('vessel') || m.includes('scout') || m.includes('fly') || m.includes('airship')) {
                    const vesselMessages = {
                        fantasy: `With ${shipName} cutting through the elements, the party charts a legendary course from ${lastSiteName} to ${locationName}. The vessel arrives without incident, ready for the challenges that lie ahead.`,
                        modern: `With ${shipName} guiding the way, the party completes the transit from ${lastSiteName} to ${locationName}. The voyage was swift and secure, leading to a successful arrival.`,
                        scifi: `The ${shipName} tears through the vacuum, its engines humming with raw power as it concludes the jump from ${lastSiteName} to ${locationName}. The vessel performs a precise arrival sequence at its destination.`,
                        magitech: `The ${shipName} glides along the ley-line currents, navigating the shimmering boundary between ${lastSiteName} and ${locationName}. Its systems remain in perfect resonance as you achieve a successful arrival.`
                    };
                    chosenMessage = vesselMessages[theme as keyof typeof vesselMessages] || vesselMessages.fantasy;
                } else if (m.includes('portal') || m.includes('teleport')) {
                    const portalMessages = {
                        fantasy: `The shimmering boundary between dimensions folds as you step from ${lastSiteName}. In a heartbeat, the party emerges within ${locationName}, the transition absolute and undisturbed.`,
                        modern: `Synchronized transit confirmed. The party departs ${lastSiteName} and instantly recalibrates at ${locationName}. The arrival is silent, efficient, and secure.`,
                        scifi: `The quantum bridge collapses behind you as the party stabilizes at ${locationName}. The transit from ${lastSiteName} was instantaneous, leaving you ready for immediate action.`,
                        magitech: `The portal's harmonic resonance fades as you manifest within ${locationName}. The jump from ${lastSiteName} was smooth, and your party stands now at its destination.`
                    };
                    chosenMessage = portalMessages[theme as keyof typeof portalMessages] || portalMessages.fantasy;
                } else {
                    const trekkingMessages = {
                        fantasy: `Braving the untamed wilds between ${lastSiteName} and ${locationName}, the party finally crests the final ridge to see their destination. The trek was arduous but uneventful, and you stand now ready for adventure in ${locationName}.`,
                        modern: `The party concludes their journey from ${lastSiteName} to ${locationName}. The transit was quiet and secure, and you stand now at the threshold of ${locationName}, prepared for the next phase.`,
                        scifi: `Through focus and steady progress, the party completes the traverse across the sector from ${lastSiteName} to ${locationName}. No threats crossed your path, and you have successfully arrived at your target coordinates.`,
                        magitech: `With steady resolve, the party navigates the shifting energy fields between ${lastSiteName} and ${locationName}. The journey proved uneventful, allowing for a timely and secure arrival.`
                    };
                    chosenMessage = trekkingMessages[theme as keyof typeof trekkingMessages] || trekkingMessages.fantasy;
                }

                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `sys-arr-safe-${Date.now()}`,
                        sender: 'ai',
                        content: chosenMessage,
                        rolls: [roll],
                        type: 'neutral'
                    }
                });

                // Manual preloading of adjacent zones
                const dispatchZoneUpdate = (zone: MapZone) => dispatch({ type: 'UPDATE_MAP_ZONE', payload: zone });
                const dispatchKnowledgeUpdate = (knowledge: Omit<LoreEntry, 'id'>[]) => dispatch({ type: 'ADD_KNOWLEDGE', payload: knowledge });
                preloadAdjacentZones(coordinates, gameData.mapZones || [], gameData, dispatchZoneUpdate, dispatchKnowledgeUpdate, gameData.knowledge || [])
                    .catch(e => console.error("Silent preloading failed:", e));

                setIsAiGenerating(false);
                return;
            }

            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `sys-arr-enc-${Date.now()}`,
                    sender: 'system',
                    content: preRolledSummary || `Danger Check resulted in an encounter.`,
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

            const systemContext = `[SYSTEM] Player has arrived at: ${zone?.name || locationName} (Coordinates: ${coordinates}) ${travelMethod ? `via ${travelMethod}` : ''}.
            ${isDiscovery ? 'STATUS: Discovery / First-time arrival.' : 'STATUS: Return visit.'}
            Visual Base: "${generatedDescription || zone?.description || 'A mysterious location.'}"
            [AVAILABLE POINTS OF INTEREST]:
            ${poisText || 'Generic wilderness.'}
            ${newGmNotes ? `[ENCOUNTER PLOT]: ${newGmNotes}` : ''}
            ${localeEntry ? `Focal Point Lore: ${localeEntry.content}` : ''}
            ${usedShip ? `[PRIMARY ENVIRONMENT]: The party is currently aboard the ${usedShip.name}.` : ''}
            NARRATIVE DIRECTIVE: The transition is complete. ${usedShip ? `Narrate the arrival while emphasizing the party is still aboard the ${usedShip.name} which is at rest within ${zone?.name || locationName}.` : `Narrate the arrival at ${zone?.name || locationName} (${coordinates}).`} Seamlessly weave the [AVAILABLE POINTS OF INTEREST] and [ENCOUNTER PLOT] into the description. Portray the "Open Area" (or ${usedShip ? usedShip.name : 'your landing site'}) as your immediate locale while framing other landmarks as distant features or nearby points of interest.`;

            await submitAutomatedEvent(`I have arrived at ${locationName}.`, mechanicsResult, systemContext);

            // Trigger silent preloading
            const dispatchZoneUpdate = (zone: MapZone) => dispatch({ type: 'UPDATE_MAP_ZONE', payload: zone });
            const dispatchKnowledgeUpdate = (knowledge: Omit<LoreEntry, 'id'>[]) => dispatch({ type: 'ADD_KNOWLEDGE', payload: knowledge });
            preloadAdjacentZones(coordinates, gameData.mapZones || [], gameData, dispatchZoneUpdate, dispatchKnowledgeUpdate, gameData.knowledge || [])
                .catch(e => console.error("Silent preloading failed:", e));

        } catch (e) {
            console.error("Arrival failed", e);
        } finally {
            setIsAiGenerating(false);
        }
    }, [gameData, dispatch, getCombatSlots, setIsAiGenerating, submitAutomatedEvent]);

    const initiateTravel = useCallback(async (destination: string, method: string, targetCoordinates?: string) => {
        if (!gameData) return;

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
            const isShipTravel = /ship|boat|sail|vessel|scout|fly|airship|pilot|command|transit/i.test(method);
            const shipCompanion = gameData.companions.find(c => c.isShip);
            let finalTargetLocale = destination;

            if (isShipTravel && shipCompanion) {
                if (!shipCompanion.isInParty) {
                    dispatch({ 
                        type: 'AI_UPDATE', 
                        payload: { 
                            companions: [{ id: shipCompanion.id, isInParty: true }] 
                        } 
                    });
                }
                
                // Override target locale to the ship's name to force narrative snapping
                finalTargetLocale = shipCompanion.name;
            }

            dispatch({ type: 'MOVE_PLAYER_ON_MAP', payload: targetCoordinates });
            await processArrival(targetCoordinates, destination, gameData.messages, method, finalTargetLocale);
        }
    }, [gameData, dispatch, processArrival]);

    const processUserInitiatedTravel = useCallback(async (userContent: string, preParsedIntent?: { destination: string, method: string }) => {
        if (!gameData) return;
        
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
                    if (targetCoords === gameData.playerCoordinates && isKnownZone) {
                        dispatch({
                            type: 'ADD_MESSAGE',
                            payload: {
                                id: `sys-travel-same-${Date.now()}`,
                                sender: 'system',
                                content: `You are already at or near ${matchedZoneName}.`,
                                type: 'neutral'
                            }
                        });
                        return;
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
                        await initiateTravel(dest, method, targetCoords);
                    }
                } else if (!directionMap[normalizedDest]) {
                    // Named destination was provided but nothing matched
                    dispatch({
                        type: 'ADD_MESSAGE',
                        payload: {
                            id: `sys-travel-fail-${Date.now()}`,
                            sender: 'system',
                            content: `I couldn't locate "${dest}" on your map. Try traveling in a cardinal direction (e.g., "Go North") or referencing a discovered landmark by its exact name.`,
                            type: 'neutral'
                        }
                    });
                }
            } else {
                setIsAiGenerating(false);
            }
        } catch (e) {
            console.error("Travel intent parsing failed", e);
            setIsAiGenerating(false);
        }
    }, [gameData, dispatch, initiateTravel, setIsAiGenerating, setPendingTravelConfirmation]);

    return { processArrival, initiateTravel, processUserInitiatedTravel };
};

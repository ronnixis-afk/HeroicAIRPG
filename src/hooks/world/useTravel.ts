
// hooks/world/useTravel.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, ChatMessage, ActorSuggestion, MapZone, DiceRollRequest, StoryLog, InventoryUpdatePayload } from '../../types';
import { generateZoneDetails, parseTravelIntent, verifyCombatRelevance, expandEncounterPlot } from '../../services/geminiService';
import { generateEncounterRoll, getUnifiedProceduralPrompt, getClearPlotPrompt, getSkillFailurePrompt, getSkillSuccessPrompt } from '../../utils/EncounterMechanics';
import { parseGameTime, addDuration, formatGameTime } from '../../utils/timeUtils';
import { getTravelSpeed, parseCoords, parseHostility } from '../../utils/mapUtils';
import { useWorldSelectors } from './useWorldSelectors';

export const useTravel = (
    gameData: GameData | null, 
    dispatch: React.Dispatch<GameAction>,
    initiateCombatSequence: (narrative: string, suggestions: ActorSuggestion[], source?: any) => Promise<void>,
    setIsAiGenerating: (isGenerating: boolean) => void,
    submitAutomatedEvent?: any // Injected from Narrative Manager
) => {
    const { getCombatSlots } = useWorldSelectors(gameData);

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

        setIsAiGenerating(true);

        try {
            // 1. Resolve Geography and Discovery Status
            if (!zone) {
                isDiscovery = true;
                const sector = gameData.mapSectors?.find(s => s.coordinates.includes(coordinates));
                
                const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
                const effectiveHint = directions.includes(locationName.toLowerCase()) ? "Uncharted Lands" : locationName;

                const details = await generateZoneDetails(coordinates, effectiveHint, sector, "", gameData.mapSettings, gameData.worldSummary);
                generatedDescription = details.description;
                const newZone: MapZone = { 
                    id: `zone-${coordinates}-${Date.now()}`, 
                    coordinates, 
                    name: details.name || effectiveHint, 
                    description: details.description, 
                    hostility: parseHostility(details.hostility),
                    sectorId: sector?.id, 
                    visited: true, 
                    tags: ['location'], 
                    keywords: details.keywords || [] 
                };
                zone = newZone;
                dispatch({ type: 'UPDATE_MAP_ZONE', payload: newZone });
            } else if (!zone.visited) {
                isDiscovery = true;
                generatedDescription = zone.description || "";
                dispatch({ type: 'UPDATE_MAP_ZONE', payload: { ...zone, visited: true } });
            }

            if (localeEntry && !localeEntry.visited) {
                isDiscovery = true;
                dispatch({ type: 'UPDATE_KNOWLEDGE', payload: { ...localeEntry, visited: true } });
            }

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
                const res = (window as any).processDiceRollsCache?.([request]) || { rolls: [], summary: "" };
                const skillRoll = res.rolls[0];
                preRolledRolls.push(skillRoll);
                preRolledSummary = res.summary;

                if (skillRoll.outcome === 'Fail' || skillRoll.outcome === 'Critical Fail') {
                    const verifier = await verifyCombatRelevance(skillToUse, locationName, "Arriving at a location.", gameData.worldSummary || "");
                    if (verifier.shouldTriggerCombat) {
                        isHostileIntent = true;
                        newGmNotes = await expandEncounterPlot(matrix, gameData.worldSummary || "");
                        generativeCombatInstruction = getUnifiedProceduralPrompt(matrix, isDiscovery);
                    } else {
                        generativeCombatInstruction = getSkillFailurePrompt(skillToUse, verifier.reason);
                    }
                } else {
                    generativeCombatInstruction = getSkillSuccessPrompt(skillToUse, matrix);
                }
            } else {
                generativeCombatInstruction = getClearPlotPrompt();
            }

            dispatch({ 
                type: 'ADD_MESSAGE', 
                payload: { 
                    id: `sys-arr-enc-${Date.now()}`, 
                    sender: 'system', 
                    content: `Danger Check: ${roll.total} (Threshold 75)${preRolledSummary ? '\n' + preRolledSummary : ''}`, 
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
                newGmNotes
            };

            const systemContext = `[SYSTEM] Player arrived at: ${zone?.name || locationName} ${travelMethod ? `via ${travelMethod}` : ''}.
            ${isDiscovery ? 'STATUS: Discovery / First-time arrival.' : 'STATUS: Return visit.'}
            Visual Base: "${generatedDescription || zone?.description || 'A mysterious location.'}"
            ${localeEntry ? `Focal Point Lore: ${localeEntry.content}` : ''}`;

            await submitAutomatedEvent(`I have arrived at ${locationName}.`, mechanicsResult, systemContext);

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
             dispatch({ type: 'MOVE_PLAYER_ON_MAP', payload: targetCoordinates });
             await processArrival(targetCoordinates, destination, gameData.messages, method, destination);
        }
    }, [gameData, dispatch, processArrival]);

    const processUserInitiatedTravel = useCallback(async (userContent: string, preParsedIntent?: { destination: string, method: string }) => {
        if (!gameData) return;
        if (!preParsedIntent) {
            dispatch({ type: 'ADD_MESSAGE', payload: { id: `user-travel-trigger-${Date.now()}`, sender: 'user', mode: 'CHAR', content: userContent } });
        }
        
        setIsAiGenerating(true);
        try {
            const intent = preParsedIntent || await parseTravelIntent(userContent, gameData.messages);
            if (intent && intent.destination) {
                const dest = intent.destination;
                const method = intent.method || "walking";
                let targetCoords: string | undefined = undefined;
                
                const directionMap: Record<string, {dx: number, dy: number}> = { 
                    'north': {dx: 0, dy: -1}, 'south': {dx: 0, dy: 1}, 
                    'east': {dx: 1, dy: 0}, 'west': {dx: -1, dy: 0}, 
                    'northeast': {dx: 1, dy: -1}, 'northwest': {dx: -1, dy: -1}, 
                    'southeast': {dx: 1, dy: 1}, 'southwest': {dx: -1, dy: 1} 
                };
                
                const p = parseCoords(gameData.playerCoordinates || '');
                const normalizedDest = String(dest || "").toLowerCase().trim();

                if (directionMap[normalizedDest] && p) {
                    const move = directionMap[normalizedDest];
                    const nx = p.x + move.dx, ny = p.y + move.dy;
                    targetCoords = `${nx}-${ny}`;
                }

                if (!targetCoords) {
                    targetCoords = gameData.mapZones?.find(z => z.name?.toLowerCase().includes(normalizedDest))?.coordinates || 
                                   gameData.knowledge?.find(k => k.title?.toLowerCase().includes(normalizedDest))?.coordinates;
                }

                if (!targetCoords) targetCoords = gameData.playerCoordinates || '0-0';
                setIsAiGenerating(false);
                await initiateTravel(dest, method, targetCoords);
            } else {
                setIsAiGenerating(false);
            }
        } catch (e) { 
            console.error("Travel intent parsing failed", e); 
            setIsAiGenerating(false); 
        }
    }, [gameData, dispatch, initiateTravel, setIsAiGenerating]);

    return { processArrival, initiateTravel, processUserInitiatedTravel };
};

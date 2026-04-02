
// hooks/world/useTravel.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, ChatMessage, ActorSuggestion, MapZone, DiceRollRequest, StoryLog, LoreEntry, InventoryUpdatePayload, AIUpdatePayload } from '../../types';
import { generateZoneDetails, generatePoisForZone, parseTravelIntent, verifyCombatRelevance, expandEncounterPlot, preloadAdjacentZones, resolveLocaleCreation } from '../../services/geminiService';
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
        if (!gameData || !submitAutomatedEvent) return "";

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

                // If no target locale was specified, land in the newly created unique "Open Area"
                if (!targetLocale) {
                    const openArea = knowledgeEntries.find(k => (k.title || "").toLowerCase().includes('open area'));
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

            // 1.5 Final Locale Resolution: 
            // If targetLocale was specified, try to find it in the current set of POIs.
            // If it's a cardinal direction or not found, always fallback to "Open Area".
            const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
            const isCardinal = directions.includes((targetLocale || "").toLowerCase());
            
            if (targetLocale && !isCardinal) {
                const matchedPoi = currentPois.find(p => 
                    (p.title || "").toLowerCase() === targetLocale.toLowerCase() ||
                    (p.title || "").toLowerCase().includes(targetLocale.toLowerCase()) || 
                    targetLocale.toLowerCase().includes((p.title || "").toLowerCase())
                );
                if (matchedPoi) {
                    localeEntry = matchedPoi as LoreEntry;
                }
            }

            // Secondary fallback: If still no localeEntry, definitively use "Open Area"
            if (!localeEntry) {
                localeEntry = currentPois.find(p => (p.title || "").toLowerCase().includes('open area'));
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
                const followers = gameData.companions.filter(c => !c.isShip && c.isInParty);
                const hasParty = followers.length > 0;
                const pSubject = hasParty ? 'your party' : 'you';
                const pPossessive = hasParty ? "your party's" : 'your';
                const m = (travelMethod || "walking").toLowerCase();

                const variationIdx = Math.floor(Math.random() * 4);
                let chosenMessage = "";

                if (m.includes('ship') || m.includes('boat') || m.includes('sail') || m.includes('vessel') || m.includes('scout') || m.includes('fly') || m.includes('airship')) {
                    const vesselMessages = {
                        fantasy: [
                            `The ${shipName} cut smoothly through the waves from ${lastSiteName}, its sails catching a steady breeze that carried ${pSubject} to ${locationName} without incident.`,
                            `With the waves of the clear blue sea behind you since leaving ${lastSiteName}, the ${shipName} guided ${pSubject} into the bustling harbor of ${locationName}.`,
                            `The rhythmic creaking of the ${shipName}'s hull provided a steady backdrop as you traveled from ${lastSiteName}, arriving at the docks of ${locationName} under a clear sky.`,
                            `Salt spray and sea air followed ${pSubject} all the way from ${lastSiteName} until the shadow of ${locationName} finally loomed ahead, marking a safe voyage.`
                        ],
                        modern: [
                            `With the ${shipName} guiding the way from ${lastSiteName}, the engine hummed a steady rhythm throughout the secure and efficient transit to ${locationName}.`,
                            `The wake trailed behind the ${shipName} like a white ribbon since departing ${lastSiteName}, finally smoothing out as you pulled into the marina at ${locationName}.`,
                            `A gentle swell and a cooling breeze accompanied ${pSubject} from ${lastSiteName}, the ${shipName} ensuring a comfortable journey until ${locationName} appeared on the shoreline.`,
                            `Following the coastal lights from ${lastSiteName}, the ${shipName} cut a steady path through the water, delivering ${pSubject} safely to the pier at ${locationName}.`
                        ],
                        scifi: [
                            `The ${shipName} performed a flawless burn across the void from ${lastSiteName}, its systems remaining quiet and stable until the final approach sequence into ${locationName}.`,
                            `Atmospheric entry was nominal as the ${shipName} descended from the stars of ${lastSiteName}, touching down on the landing pad of ${locationName} with mechanical precision.`,
                            `After a brief transit through the cold vacuum since leaving ${lastSiteName}, the ${shipName} established a stable orbit over ${locationName}, signaling a successful jump.`,
                            `Navigational computers held a perfect course from ${lastSiteName}, guided by the ${shipName}'s primary drive until the neon lights of ${locationName} filled the viewports.`
                        ],
                        magitech: [
                            `Gliding along the shimmering ley-lines from ${lastSiteName}, the ${shipName} maintained perfect resonance as ${pSubject} traversed the aetheric currents safely to ${locationName}.`,
                            `The aether-sails of the ${shipName} caught the invisible winds of the weave since leaving ${lastSiteName}, carrying ${pSubject} on a breath of pure magic toward ${locationName}.`,
                            `Runes along the hull of the ${shipName} glowed with golden light during the transit from ${lastSiteName}, the arcane stabilization holding perfectly until you reached ${locationName}.`,
                            `Riding the currents of the world's soul, the ${shipName} bypassed the mundane miles between ${lastSiteName} and ${locationName} in a haze of shimmering enchantments.`
                        ]
                    };
                    chosenMessage = (vesselMessages[theme as keyof typeof vesselMessages] || vesselMessages.fantasy)[variationIdx];
                } else if (m.includes('portal') || m.includes('teleport')) {
                    const portalMessages = {
                        fantasy: [
                            `The arcane gateway held firm, the shimmering transition from ${lastSiteName} to ${locationName} occurring in a heartbeat of absolute silence.`,
                            `A flash of silver light and a moment of weightlessness marked the shift from ${lastSiteName}, with ${pSubject} stepping through the threshold into the air of ${locationName}.`,
                            `The fabric of reality rippled as the portal stabilized between ${lastSiteName} and ${locationName}, allowing for a seamless transition between distant lands.`,
                            `Whispers of ancient magic echoed in the void between gates as you left ${lastSiteName}, the world reformulating itself into the sights and sounds of ${locationName}.`
                        ],
                        modern: [
                            `The digital synchronization between ${lastSiteName} and ${locationName} was complete in an instant, ${pPossessive} atoms reassembling flawlessly at the target terminal.`,
                            `A brief hum of high-voltage machinery was the only sound of the jump from ${lastSiteName}, the experimental bridge closing safely behind ${pSubject} at ${locationName}.`,
                            `Data-streams encoded your arrival from ${lastSiteName} with total precision, the relay at ${locationName} hummed to silence as the transition finalized.`,
                            `The screen-flicker of reality passed in a blink since leaving ${lastSiteName}, the familiar hum of the laboratory at ${locationName} signaling a successful relocate.`
                        ],
                        scifi: [
                            `The quantum bridge between ${lastSiteName} and ${locationName} remained stable throughout the jump, the localized distortion fading as quickly as it appeared.`,
                            `Cellular reconstruction was successful after the high-speed transit from ${lastSiteName}, the terminal at ${locationName} confirming a perfect sync for ${pSubject}.`,
                            `The warp-gate hummed with a low-frequency vibration as you left ${lastSiteName}, the stars momentarily blurring before snapping into the familiar sky of ${locationName}.`,
                            `Sub-atomic stabilization held firm during the blink from ${lastSiteName}, landing ${pSubject} exactly on target within the relocation chamber of ${locationName}.`
                        ],
                        magitech: [
                            `The harmonic frequency of the portal remained in perfect tune, allowing for a seamless shift from ${lastSiteName} through the folds of the world to ${locationName}.`,
                            `Shimmering mana-mist swirled around ${pSubject} during the blink from ${lastSiteName}, finally clearing to reveal the enchanted surroundings of ${locationName}.`,
                            `The ritual circle at ${lastSiteName} held its charge perfectly, discharging ${pSubject} into the crystalline arrival bay of ${locationName} with a sharp chime.`,
                            `Navigating the ephemeral paths between worlds since departing ${lastSiteName}, you felt the pull of the destination anchor as ${locationName} manifested around you.`
                        ]
                    };
                    chosenMessage = (portalMessages[theme as keyof typeof portalMessages] || portalMessages.fantasy)[variationIdx];
                } else if (m.includes('transport') || m.includes('taxi') || m.includes('bus') || m.includes('public')) {
                    const transitMessages = {
                        fantasy: [
                            `The bumpy carriage ride from ${lastSiteName} was filled with the talk of other travelers, the horse-drawn coach delivering ${pSubject} safely to ${locationName}.`,
                            `Riding with a merchant caravan since leaving ${lastSiteName}, ${pSubject} enjoyed the relative safety and company of the group until reaching ${locationName}.`,
                            `The public ferry wove through the river currents from ${lastSiteName}, the steady rowing bringing ${pSubject} to the busy docks of ${locationName} by midday.`,
                            `Settling into the straw-lined wagon departing ${lastSiteName}, ${pSubject} watched the miles roll by until the familiar silhouette of ${locationName} appeared.`
                        ],
                        modern: [
                            `The city bus wove through the traffic from ${lastSiteName}, the rhythmic stopping and starting eventually bringing ${pSubject} to the terminal at ${locationName}.`,
                            `Catching a yellow cab from the outskirts of ${lastSiteName}, ${pSubject} watched the suburbs fade into the urban sprawl of ${locationName} during the quiet ride.`,
                            `The subway train rumbled through the dark tunnels since leaving ${lastSiteName}, the overhead lights flickering until the conductor announced the stop for ${locationName}.`,
                            `Snagging a seat on the commuter rail departing ${lastSiteName}, ${pSubject} relaxed as the train wove through the morning light toward the station at ${locationName}.`
                        ],
                        scifi: [
                            `The humming grav-taxi wove through the skyscrapers since leaving ${lastSiteName}, the neon lights blurring until you coasted into the landing pad of ${locationName}.`,
                            `Settling into the maglev shuttle from ${lastSiteName}, ${pSubject} felt the slight pull of acceleration as the craft shot toward the central hub of ${locationName}.`,
                            `The automated transport pod glided silently along the transit rail from ${lastSiteName}, the internal displays signaling arrival as ${locationName} came into view.`,
                            `Public transit drones wove through the orbital traffic since departing ${lastSiteName}, delivering ${pSubject} to the secure docking bay of ${locationName} on schedule.`
                        ],
                        magitech: [
                            `The rune-carved steam-train hissed as it left ${lastSiteName}, the iron wheels clattering rhythmically until the brass station of ${locationName} loomed ahead.`,
                            `Boarding an automated aether-tram in ${lastSiteName}, ${pSubject} watched the landscape blur through the enchanted glass until the magic-stop at ${locationName}.`,
                            `The public skyliner drifted on mana-currents from ${lastSiteName}, its ornate gondola providing a bird's-eye view of the world until arriving at ${locationName}.`,
                            `Riding a clockwork coach since leaving ${lastSiteName}, the intricate gears hummed a melodic tune that lasted until you reached the gates of ${locationName}.`
                        ]
                    };
                    chosenMessage = (transitMessages[theme as keyof typeof transitMessages] || transitMessages.fantasy)[variationIdx];
                } else {
                    const trekkingMessages = {
                        fantasy: [
                            `Braving the wilderness on foot since leaving ${lastSiteName}, ${pSubject} maintained a steady pace as the terrain toward ${locationName} proved manageable.`,
                            `Following the dusty road from ${lastSiteName}, ${pSubject} watched the sun cross the sky until the familiar gates of ${locationName} finally rose from the horizon.`,
                            `The crunch of gravel under ${pPossessive} boots was the only sound on the long walk from ${lastSiteName}, the journey to ${locationName} proving quiet and safe.`,
                            `Navigating the winding forest paths since leaving ${lastSiteName}, ${pSubject} skirted the edges of the wild until the welcoming smoke of ${locationName} appeared ahead.`
                        ],
                        modern: [
                            `The trek from ${lastSiteName} to ${locationName} was straightforward and quiet, with no unexpected obstacles or delays interrupting ${pPossessive} steady progress across the region.`,
                            `Pacing the concrete sidewalks since leaving ${lastSiteName}, ${pSubject} wove through the urban landscape until the signs for ${locationName} finally signaled the end.`,
                            `A brisk walk through the outskirts of ${lastSiteName} led ${pSubject} onto the long stretch towards ${locationName}, the miles passing quickly under a clear sky.`,
                            `Following the main highway on foot from ${lastSiteName}, ${pSubject} kept to the shoulder until the skyline of ${locationName} began to dominate the view.`
                        ],
                        scifi: [
                            `Through focus and steady movement since departing ${lastSiteName}, ${pSubject} successfully traversed the sector, arriving at ${locationName} undisturbed.`,
                            `Suit servos whirred rhythmically during the survey from ${lastSiteName}, the environmental seals holding perfectly as ${pSubject} reached the airlock of ${locationName}.`,
                            `After a long trek across the planetary surface from ${lastSiteName}, the landing lights of ${locationName} served as a beacon for the final miles of ${pPossessive} journey.`,
                            `Scanners remained clear of hostiles during the march from ${lastSiteName}, allowing ${pSubject} to reach the secure perimeter of ${locationName} without incident.`
                        ],
                        magitech: [
                            `Navigating the shifting energies of the wilds from ${lastSiteName} to ${locationName}, ${pSubject} were guided by a steady resolve that kept any potential threats at bay.`,
                            `Following the glowing trail of a leyline since departing ${lastSiteName}, ${pSubject} navigated the arcane-saturated wilds until ${locationName} finally appeared ahead.`,
                            `The air tingled with ambient magic during the walk from ${lastSiteName}, the path to ${locationName} remaining stable and clear of any mana-storms.`,
                            `With every step away from ${lastSiteName}, you felt the resonance change, finally reaching the harmonic balance that signaled your arrival at ${locationName}.`
                        ]
                    };
                    chosenMessage = (trekkingMessages[theme as keyof typeof trekkingMessages] || trekkingMessages.fantasy)[variationIdx];
                }

                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `sys-arr-safe-${Date.now()}`,
                        sender: 'ai',
                        content: chosenMessage,
                        rolls: [{
                            ...roll,
                            checkName: `Safe Arrival: ${locationName}`,
                            dc: 75,
                            outcome: 'No Encounter',
                            dieRoll: variationIdx + 1,
                            total: variationIdx + 1,
                            notes: `Variation ${variationIdx + 1}`
                        }],
                        type: 'neutral'
                    }
                });

                // Sequence Preloading AFTER narrative message is dispatched
                const dispatchZoneUpdate = (zone: MapZone) => dispatch({ type: 'UPDATE_MAP_ZONE', payload: zone });
                const dispatchKnowledgeUpdate = (knowledge: Omit<LoreEntry, 'id'>[]) => dispatch({ type: 'ADD_KNOWLEDGE', payload: knowledge });
                preloadAdjacentZones(coordinates, gameData.mapZones || [], gameData, dispatchZoneUpdate, dispatchKnowledgeUpdate, gameData.knowledge || [])
                    .catch(e => console.error("Silent preloading failed:", e));

                setIsAiGenerating(false);
                return chosenMessage;
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

            const resultNarration = await submitAutomatedEvent(`I have arrived at ${locationName}.`, mechanicsResult, systemContext);
            
            // Sequence Preloading AFTER AI narrative generation is finished
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

            if (isShipTravel && shipCompanion) {
                // Ensure ship is in party and party is marked as aboard
                // This triggers the automatic boarding narrative in systemReducer
                dispatch({ 
                    type: 'AI_UPDATE', 
                    payload: { 
                        isAboard: true,
                        companions: [{ id: shipCompanion.id, isInParty: true }] 
                    } 
                });
                
                // Override target locale to the ship's name to force narrative snapping
                finalTargetLocale = shipCompanion.name;
            }

            dispatch({ type: 'MOVE_PLAYER_ON_MAP', payload: targetCoordinates });
            return await processArrival(targetCoordinates, destination, gameData.messages, method, finalTargetLocale);
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
                            dispatch({
                                type: 'AI_UPDATE',
                                payload: {
                                    current_site_name: resolution.name,
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
                            // Immersive failure from AI reasoning
                            dispatch({
                                type: 'ADD_MESSAGE',
                                payload: {
                                    id: `sys-travel-fail-imm-${Date.now()}`,
                                    sender: 'ai',
                                    content: resolution.immersive_failure_message || `You search for ${dest}, but it is not here.`,
                                    type: 'neutral'
                                }
                            });
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

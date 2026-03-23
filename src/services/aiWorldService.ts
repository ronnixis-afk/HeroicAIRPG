// services/aiWorldService.ts

import { getAi, cleanJson } from './aiClient';
import { AI_MODELS, THINKING_BUDGETS } from '../config/aiConfig';
import { Type } from "@google/genai";
import { MapSettings, GameData, StoryLog, WorldPreview, MapZone, ChatMessage, LoreEntry } from '../types';
import { EncounterMatrixResult } from '../utils/EncounterMechanics';
import { parseCoords, isNameTooSimilar } from '../utils/mapUtils';
import { RACIAL_TRAIT_BLUEPRINTS } from '../constants/racialTraits';
import { Ability } from '../types';

/**
 * THE PLOT EXPANDER (Tactical Specialist)
 * Uses Gemini 3 Flash to expand raw system matrix rolls into 3 concise tactical sentences.
 */
export const expandEncounterPlot = async (matrix: EncounterMatrixResult, worldSummary: string, availablePoisText?: string): Promise<string> => {
    const poiSection = availablePoisText ? `\n[AVAILABLE LANDMARKS]\n${availablePoisText}\nWEAVE these landmarks into the tactical brief if appropriate.` : '';
    const prompt = `
    You are the "Tactical Plot Architect". Expand the following raw RPG encounter matrix results into a concise encounter brief.
    
    [WORLD SUMMARY]
    ${worldSummary}
    ${poiSection}

    [RAW MATRIX RESULTS]
    - ENCOUNTER TYPE: ${matrix.encounterType}
    - ENTITY TYPE: ${matrix.entityType}
    - CONDITION/TWIST: ${matrix.condition}

    [MANDATORY OUTPUT FORMAT]
    You MUST return a concise encounter brief that is NO MORE THAN 30 WORDS LONG.
    It should describe the encounter based on the matrix results and world context.

    [STRICT RULES]
    - DO NOT use the bracketed summary "${matrix.summary}".
    - DO NOT use numbers or game mechanics terminology.
    - Use evocative, atmospheric PLAIN TEXT only.
    - Return ONLY the brief.
    - MAXIMUM 30 WORDS.
    `;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: AI_MODELS.DEFAULT,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC }
            }
        });
        return response.text?.trim() || "A localized threat emerges from the environment. They seek to disrupt your progress through the area. A hidden danger complicates the immediate path.";
    } catch (e) {
        console.error("Plot expansion failed", e);
        return "An encounter begins. The environment turns hostile. You must react quickly.";
    }
};

/**
 * THE WORLD ARCHITECT (Strategic Specialist)
 * Upgraded to Gemini 3 Pro to handle complex thematic synthesis.
 * Uses a strict responseSchema to ensure the UI can parse the complex lore.
 */
export const generateWorldPreview = async (
    setting: string,
    themes: string[],
    numRaces: number,
    numFactions: number,
    name: string,
    context: string
): Promise<WorldPreview> => {
    const prompt = `You are a World-Building Architect. Create a cohesive TTRPG world preview.
    
    [INPUTS]
    Name: ${name}
    Setting: ${setting}
    Themes: ${themes.join(', ')}
    User Context: ${context}
    
    [INSTRUCTIONS]
    1. SUMMARY: Write exactly 2 paragraphs explaining the current state of the world.
    2. RACES: Generate EXACTLY ${numRaces + 1} major races. One MUST be 'Humans'.
       - Each race MUST have a unique 'description', 'appearance', and 'qualities'.
       - description: MAX 30 WORDS. Sentence Case.
       - appearance: MAX 15 WORDS. Sentence Case.
       - qualities: MAX 15 WORDS. Sentence Case. (e.g. "Translucent skin", "Can walk on water", "Floats", "Can see in the dark").
    3. FACTIONS: Generate EXACTLY ${numFactions} organizations.
    
    [CASING RULES]
    - Use Title Case for ALL names and titles.
    - Use Sentence Case for descriptions, goals, and other text blocks.
    - DO NOT use ALL CAPS or ALL UPPERCASE for any portion of the response.

    Ensure all elements are internally consistent. If a race belongs to a specific faction, mention it in their description.`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: AI_MODELS.DEFAULT,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC },
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: {
                            type: Type.STRING,
                            description: "A two-paragraph atmospheric summary of the world."
                        },
                        races: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING, description: "Cultural and historical overview (Max 30 words)." },
                                    appearance: { type: Type.STRING, description: "Physical characteristics (Max 15 words)." },
                                    qualities: { type: Type.STRING, description: "Unique descriptive traits (Max 15 words)." },
                                    faction: { type: Type.STRING, description: "The name of the primary faction they align with, if any." }
                                },
                                required: ["name", "description", "appearance", "qualities"]
                            }
                        },
                        factions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    goals: { type: Type.STRING, description: "What the organization wants to achieve (Max 20 words)." },
                                    relationships: { type: Type.STRING, description: "Current standing with other factions or the general public." },
                                    racialComposition: { type: Type.STRING, description: "The primary species making up this group." }
                                },
                                required: ["name", "goals", "relationships", "racialComposition"]
                            }
                        }
                    },
                    required: ["summary", "races", "factions"]
                }
            }
        });

        const rawData = JSON.parse(cleanJson(response.text || '{}')) || {};
        const rawRaces = Array.isArray(rawData.races) ? rawData.races : [];

        // Distribute racial traits
        const shuffledTraits = [...RACIAL_TRAIT_BLUEPRINTS].sort(() => 0.5 - Math.random());
        const racesWithTraits = rawRaces.map((race: any, index: number) => {
            const blueprint = shuffledTraits[index % shuffledTraits.length];
            const racialTrait: Ability = {
                ...blueprint,
                id: `racial-${race.name.toLowerCase()}-${Date.now()}`,
                name: `${race.name} Trait`
            } as Ability;
            return { ...race, racialTrait };
        });

        return {
            context: rawData.summary || "A mysterious world awaits.",
            races: racesWithTraits,
            factions: Array.isArray(rawData.factions) ? rawData.factions : []
        };
    } catch (e) {
        console.error("World Preview Generation Error:", e);
        return { context: "Failed to generate world preview.", races: [], factions: [] };
    }
};

/**
 * Generates additional lore based on a user prompt.
 */
export const generateAdditionalLore = async (prompt: string, existingLore: LoreEntry[]): Promise<LoreEntry> => {
    const ai = getAi();
    const input = `Create a new Lore Entry based on: "${prompt}".
    Existing lore context (last 5 entries): ${JSON.stringify(existingLore.slice(-5))}
    Return JSON: { "title": "string", "content": "string", "tags": ["string"], "keywords": ["string"] }`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: input,
        config: {
                thinkingConfig: { thinkingBudget: 512 }, responseMimeType: "application/json" }
    });
    const result = JSON.parse(cleanJson(response.text || '{}'));
    return {
        id: `lore-${Date.now()}`,
        isNew: true,
        ...result
    };
};

/**
 * Generates a global summary of the world based on lore.
 * High quality synthesis of history, factions, and races.
 */
export const generateGlobalWorldSummary = async (lore: LoreEntry[]): Promise<string> => {
    const ai = getAi();
    const input = `You are a Grand Master Lorekeeper. Based on the following established lore fragments, write a cohesive, atmospheric 2-paragraph world overview. 
    Focus on the current state of conflict, technology/magic level, and the overarching aesthetic.
    
    Lore Data: ${JSON.stringify(lore.slice(0, 20))}
    
    [STRICT RULE]
    - Return ONLY plain text. 
    - NO Markdown formatting.
    - MAXIMUM 200 WORDS.`;

    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: input,
        config: {
            thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC }
        }
    });
    return response.text?.trim() || "A vast and unexplored world.";
};

/**
 * Generates Points of Interest for a specific zone.
 */
export const generatePoisForZone = async (zone: MapZone, worldSummary: string, mapSettings?: MapSettings, existingNames: string[] = []): Promise<any[]> => {
    const ai = getAi();
    const hostilityDesc = typeof zone.hostility === 'number' ? `Threat level: ${zone.hostility} (negative is safe, positive is dangerous).` : '';
    const keywordsDesc = zone.keywords && zone.keywords.length > 0 ? `Zone attributes: ${zone.keywords.join(', ')}.` : '';
    
    // 1. Generate Population Center POI (or Barren Landmark)
    const popLevel = zone.populationLevel || 'Barren';
    const popPrompt = `Generate a specific, thematic Point of Interest that represents the Population Center (or a solitary landmark if barren) for the zone "${zone.name}" (${zone.description}).
    World: ${worldSummary}
    ${hostilityDesc}
    Population Scale: ${popLevel}. Make sure the scale of this POI matches this density.
    [STRICT CONSTRAINTS]
    - title: MAX 3 WORDS.
    - title: MUST NOT be identical OR SIMILAR to the zone name "${zone.name}". Choose distinct nouns/adjectives.
    - title: MUST be a distinct name for a settlement (if populated) or a wilderness landmark (if Barren).
    - content: MAX 30 WORDS.
    Return JSON: { "title": "string", "content": "string" }`;

    let popCenterPoi = { title: "Desolate Marker", content: "A mysterious standing stone in the middle of nowhere." };
    let popAttempts = 0;
    while (popAttempts <= 2) {
        const popRes = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: popPrompt + (popAttempts > 0 ? `\n\n[RETRY ATTEMPT ${popAttempts}] The previous title was too similar to existing locations: [${existingNames.join(', ')}]. Choose a DIFFERENT, DISTINCT name.` : ''),
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } }
        });
        const result = JSON.parse(cleanJson(popRes.text || '{}'));
        if (result.title) {
            popCenterPoi = result;
            if (!isNameTooSimilar(result.title, existingNames) && !isNameTooSimilar(result.title, [zone.name])) {
                break;
            }
        }
        popAttempts++;
    }

    // Update existing names to include the new pop center so we don't repeat it
    const updatedExistingNames = [...existingNames, popCenterPoi.title];

    // 2. Generate 3 generic POIs using the pop center as context
    const input = `Generate 3 specific POIs for the zone "${zone.name}" (${zone.description}).
    World: ${worldSummary}
    ${hostilityDesc}
    ${keywordsDesc}
    [MAIN CONTEXT]: The central landmark of this area is "${popCenterPoi.title}" - ${popCenterPoi.content}. The new POIs should thematically connect to or exist around this main feature.
    [STRICT CONSTRAINTS]
    - title: MAX 3 WORDS.
    - title: MUST NOT be identical OR SIMILAR to the zone name "${zone.name}" or the main landmark "${popCenterPoi.title}".
    - title: EACH POI MUST HAVE A UNIQUE AND DISTINCT NAME. Do not repeat words across titles.
    - content: MAX 30 WORDS.
    - Generate EXACTLY 3 POIs.
    Return JSON array: [{ "title": "string", "content": "string" }]`;

    const maxRetries = 2;
    let attempts = 0;
    let finalPois: any[] = [];

    while (attempts <= maxRetries) {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: input + (attempts > 0 ? `\n\n[RETRY ATTEMPT ${attempts}] Some generated titles were too similar to existing locations: [${updatedExistingNames.join(', ')}]. Choose DIFFERENT, DISTINCT nouns or adjectives.` : ''),
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } }
        });

        const result = JSON.parse(cleanJson(response.text || '[]'));
        const pois = Array.isArray(result) ? result : [];
        
        if (attempts === 0) finalPois = pois;

        const hasCollision = pois.some(p => {
            const title = p.title || "";
            return isNameTooSimilar(title, updatedExistingNames) || isNameTooSimilar(title, [zone.name]);
        });

        if (!hasCollision && pois.length > 0) {
            finalPois = pois;
            break;
        }
        attempts++;
    }

    // SYSTEM MANAGED: Always inject the "Open Area" as the 4th/primary POI
    const openArea = {
        title: "Open Area",
        content: `The immediate arrival area of ${zone.name}. ${zone.description || "A localized region in the world."}`
    };

    return [openArea, { ...popCenterPoi, isPopulationCenter: true }, ...finalPois];
};

/**
 * Generates detailed lore for a specific POI.
 */
export const generatePoiDetail = async (localeName: string, zoneName: string, zoneDesc: string, worldSummary: string): Promise<string> => {
    const ai = getAi();
    const input = `Describe the specific locale "${localeName}" inside the zone "${zoneName}" (${zoneDesc}).
    World context: ${worldSummary}
    [STRICT CONSTRAINTS]
    - Write an atmospheric description (MAX 30 WORDS).`;

    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: input,
        config: { thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC } }
    });
    return response.text || "A place of significance.";
};

import { getRandomZoneProperties } from '../constants/zoneProperties';

/**
 * Generates details for a zone during travel discovery.
 * Enforces strict brevity for the world state.
 */
export const generateZoneDetails = async (
    coords: string,
    nameHint: string,
    additionalContext?: string,
    mapSettings?: MapSettings,
    worldSummary?: string,
    existingNames: string[] = []
): Promise<{ name: string, description: string, hostility: number, keywords: string[] }> => {

    // Extract theme from worldSummary or mapSettings (usually derived from skillConfiguration)
    // The preload function could pass it, but analyzing worldSummary is a safe fallback.
    let currentTheme = 'Fantasy';
    const summaryLower = (worldSummary || '').toLowerCase();
    if (summaryLower.includes('sci-fi') || summaryLower.includes('spaceship') || summaryLower.includes('futuristic')) currentTheme = 'Sci-Fi';
    else if (summaryLower.includes('modern') || summaryLower.includes('cyberpunk') || summaryLower.includes('city')) currentTheme = 'Modern';
    else if (summaryLower.includes('magitech') || summaryLower.includes('clockwork')) currentTheme = 'Magitech';

    const randomProperties = getRandomZoneProperties(currentTheme);
    const propertiesContext = `
    [ZONE PROPERTIES]
    The zone has the following randomized localized properties based on the world's setting:
    ${randomProperties.map(p => `- ${p}`).join('\n')}
    Incorporate the essence of these properties into the generated zone's name, description, and atmosphere.
    `;

    const ai = getAi();
    const input = `Generate details for a new map zone at coordinates ${coords}.
    Name hint: ${nameHint}
    World context: ${worldSummary || ''}
    Additional context: ${additionalContext || ''}
    ${propertiesContext}
    
    [STRICT CONSTRAINTS]
    - name: MAX 3 WORDS.
    - description: MAX 30 WORDS.
    - keywords: You MUST return EXACTLY ${randomProperties.length} items.
    - keywords: Each item MUST use the format "Property Name: Chosen Variant" based on the provided [ZONE PROPERTIES].
    
    Return JSON: { "name": "string", "description": "string", "hostility": number, "keywords": ["string"] }`;


    const maxRetries = 2;
    let attempts = 0;
    let finalDetails = { name: "Uncharted Zone", description: "A mysterious area.", hostility: 0, keywords: [] };

    while (attempts <= maxRetries) {
        const response = await ai.models.generateContent({
            model: AI_MODELS.DEFAULT,
            contents: input + (attempts > 0 ? `\n\n[RETRY ATTEMPT ${attempts}] The previous name was too similar to existing locations. Choose a DIFFERENT, DISTINCT noun or adjective.` : ''),
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC } }
        });

        const details = JSON.parse(cleanJson(response.text || '{}'));
        if (details.name && !isNameTooSimilar(details.name, existingNames)) {
            finalDetails = details;
            break;
        }

        // If even the first attempt fails validation, we still save it as a fallback but keep trying
        if (attempts === 0) finalDetails = details;
        attempts++;
    }

    // Safety cap: Ensure we never exceed the rolled number of properties
    if (finalDetails.keywords && finalDetails.keywords.length > randomProperties.length) {
        finalDetails.keywords = finalDetails.keywords.slice(0, randomProperties.length);
    }

    return finalDetails as { name: string, description: string, hostility: number, keywords: string[] };
};

/**
 * Parses user travel intent from chat.
 */
export const parseTravelIntent = async (userContent: string, history: ChatMessage[]): Promise<{ destination: string, method: string }> => {
    const ai = getAi();
    const input = `Analyze the user's travel intent.
    Current message: "${userContent}"
    Recent history: ${JSON.stringify(history.slice(-3))}
    Return JSON: { "destination": "string", "method": "string" }`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: input,
        config: {
                thinkingConfig: { thinkingBudget: 512 }, responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{"destination":"","method":""}'));
};

/**
 * Silently preloads adjacent zones around the current coordinates
 */
export const preloadAdjacentZones = async (
    currentCoords: string,
    existingZones: MapZone[],
    gameData: GameData,
    dispatchZoneUpdate: (zone: MapZone) => void,
    dispatchKnowledgeUpdate?: (knowledge: Omit<LoreEntry, 'id'>[]) => void,
    existingPois: LoreEntry[] = []
): Promise<void> => {
    const p = parseCoords(currentCoords);
    if (!p) return;

    const directions = [
        { dx: 0, dy: -1 }, // north
        { dx: 0, dy: 1 },  // south
        { dx: 1, dy: 0 },  // east
        { dx: -1, dy: 0 }, // west
        { dx: 1, dy: -1 }, // northeast
        { dx: -1, dy: -1 },// northwest
        { dx: 1, dy: 1 },  // southeast
        { dx: -1, dy: 1 }  // southwest
    ];

    // Maintain a running list of all names to avoid generating duplicates
    const runningZoneNames = existingZones.map(z => z.name);
    const poiNames = existingPois.map(p => p.title);
    const allInhabitedNames = [...new Set([...runningZoneNames, ...poiNames])];

    for (const d of directions) {
        const targetX = p.x + d.dx;
        const targetY = p.y + d.dy;
        const targetCoords = `${targetX}-${targetY}`;

        const existing = existingZones.find(z => z.coordinates === targetCoords);
        if (!existing) {
            // Uncharted zone. Preload it.

            // Gather immediate neighbor names for context
            const neighborNames = existingZones
                .filter((z: MapZone) => {
                    const zp = parseCoords(z.coordinates);
                    if (!zp) return false;
                    return Math.abs(zp.x - targetX) <= 1 && Math.abs(zp.y - targetY) <= 1;
                })
                .map((z: MapZone) => z.name);

            const contextStr = neighborNames.length > 0
                ? `Adjacent to: ${neighborNames.join(', ')}.`
                : '';

            // D20 Pop Roll
            const popRoll = Math.floor(Math.random() * 20) + 1;
            let popLevel: 'Barren' | 'Settlement' | 'Town' | 'City' | 'Capital' = 'Barren';
            let features: string[] = [];

            if (popRoll >= 20) { popLevel = 'Capital'; features = ['Tavern', 'Market', 'Item Forge', 'Shipyard']; }
            else if (popRoll >= 18) { popLevel = 'City'; features = ['Tavern', 'Market', 'Shipyard']; }
            else if (popRoll >= 15) { popLevel = 'Town'; features = ['Tavern', 'Market']; }
            else if (popRoll >= 10) { popLevel = 'Settlement'; features = ['Tavern']; }
            else { popLevel = 'Barren'; features = []; }

            // Emit Shimmer UI Zone immediately
            const shimmerZone: MapZone = {
                id: `zone-${targetCoords}-loading`,
                coordinates: targetCoords,
                name: "...", // Placeholder
                hostility: 0,
                visited: false,
                isNew: false,
                isLoading: true
            };
            dispatchZoneUpdate(shimmerZone);

            // Fetch actual details sequentially
            try {
                // Determine uniqueness context
                const allNamesList = allInhabitedNames.join(', ');
                const validationContext = `
                CRITICAL UNIQUENESS VALIDATION:
                The new zone name MUST NOT match or be highly similar to ANY of these existing zones: [${allNamesList}].
                If there is too much similarity, choose a completely different noun or adjective.
                Additionally, the name must fit the thematic tone of the world summary: ${gameData.worldSummary || 'Fantasy'}.
                `;

                const completeContext = `${contextStr}\n${validationContext}\nThis zone has a population density equivalent to a ${popLevel}. Consider this scale when generating the description.`;

                const details = await generateZoneDetails(
                    targetCoords,
                    "Uncharted Lands",
                    completeContext,
                    gameData.mapSettings,
                    gameData.worldSummary,
                    allInhabitedNames
                );

                const newZone: MapZone = {
                    id: `zone-${targetCoords}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                    coordinates: targetCoords,
                    name: details.name || "Uncharted Lands",
                    description: details.description,
                    hostility: typeof details.hostility === 'number' ? details.hostility : 0,
                    populationLevel: popLevel,
                    zoneFeatures: features,
                    visited: false,
                    isNew: false,
                    isLoading: false,
                    tags: ['location'],
                    keywords: details.keywords || []
                };

                // Add to our running list so subsequent loops avoid duplicating this newly generated name
                if (newZone.name) allInhabitedNames.push(newZone.name);

                // Dispatch resolved zone
                dispatchZoneUpdate(newZone);

                // Generate and dispatch POIs for the preloaded zone
                if (dispatchKnowledgeUpdate) {
                    try {
                        const pois = await generatePoisForZone(newZone, gameData.worldSummary || "", gameData.mapSettings, allInhabitedNames);
                        const knowledgeEntries: Omit<LoreEntry, 'id'>[] = pois.map(p => ({
                            title: p.title,
                            content: p.content,
                            coordinates: newZone.coordinates,
                            tags: p.isPopulationCenter ? ['location', 'population-center'] : ['location'],
                            isNew: true,
                            visited: p.title.toLowerCase().includes('open area')
                        }));
                        dispatchKnowledgeUpdate(knowledgeEntries);
                        
                        // Add new POIs to our global list
                        knowledgeEntries.forEach(ke => {
                            if (!ke.title.toLowerCase().includes('open area')) {
                                allInhabitedNames.push(ke.title);
                            }
                        });
                    } catch (poiError) {
                        console.error("POI preloading failed for:", targetCoords, poiError);
                    }
                }
            } catch (e) {
                console.error("Silent sequential preload failed for:", targetCoords, e);
                // Optionally remove the shimmer if it fails, or leave it to be retried by the redundancy check
            }
        }
    }
};

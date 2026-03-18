// services/aiWorldService.ts

import { getAi, cleanJson } from './aiClient';
import { Type } from "@google/genai";
import { MapSettings, GameData, StoryLog, WorldPreview, MapSector, MapZone, ChatMessage, LoreEntry } from '../types';
import { EncounterMatrixResult } from '../utils/EncounterMechanics';
import { parseCoords, isNameTooSimilar } from '../utils/mapUtils';

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
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 4000 }
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
    3. FACTIONS: Generate EXACTLY ${numFactions} organizations.
    
    Ensure all elements are internally consistent. If a race belongs to a specific faction, mention it in their description.`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 4000 },
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
                                    description: { type: Type.STRING, description: "A one-sentence physical and cultural overview." },
                                    personality: { type: Type.STRING, description: "Common behavioral traits (Max 10 words)." },
                                    faction: { type: Type.STRING, description: "The name of the primary faction they align with, if any." }
                                },
                                required: ["name", "description", "personality"]
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
        return {
            context: rawData.summary || "A mysterious world awaits.",
            races: Array.isArray(rawData.races) ? rawData.races : [],
            factions: Array.isArray(rawData.factions) ? rawData.factions : []
        };
    } catch (e) {
        console.error("World Preview Generation Error:", e);
        return { context: "Failed to generate world preview.", races: [], factions: [] };
    }
};

/**
 * GENERATE WORLD SECTORS
 * Switched to gemini-flash-lite-latest for efficient macro-geography mapping.
 */
export const generateWorldSectors = async (lore: any[], settings: MapSettings): Promise<any[]> => {
    const prompt = `Generate 5-8 distinct geographical sectors based on this lore.
    Map Settings: ${JSON.stringify(settings)}
    Lore Context: ${JSON.stringify(lore.slice(0, 3))}
    
    [STRICT CONSTRAINTS]
    - name: MAX 3 WORDS.
    - description: MAX 30 WORDS.
    
    Return JSON array of objects: { name, description (plain text), color (hex), keywords[], centerX (0-26), centerY (0-26) }`;

    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }
        }
    });

    const data = JSON.parse(cleanJson(response.text || '[]')) || [];
    return Array.isArray(data) ? data : (data.sectors || []);
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
        model: 'gemini-3.1-flash-lite',
        contents: input,
        config: {
                thinkingConfig: { thinkingBudget: 4000 }, responseMimeType: "application/json" }
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
        model: 'gemini-3.1-flash-lite',
        contents: input,
        config: {
            thinkingConfig: { thinkingBudget: 4000 }
        }
    });
    return response.text?.trim() || "A vast and unexplored world.";
};

/**
 * Generates details for a new map sector.
 */
export const generateMapSectorDetails = async (gameData: GameData): Promise<Partial<MapSector>> => {
    const ai = getAi();
    const input = `Based on the world context, generate a new geographical sector.
    World Context: ${gameData.worldSummary || 'Standard RPG setting.'}
    [STRICT CONSTRAINTS]
    - name: MAX 3 WORDS.
    - description: MAX 30 WORDS.
    Return JSON: { "name": "string", "description": "string", "color": "hex string", "keywords": ["string"] }`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: input,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

/**
 * Generates a full map layout from existing lore.
 */
export const generateMapLayoutFromLore = async (lore: LoreEntry[], settings: MapSettings): Promise<any> => {
    const ai = getAi();
    const input = `Based on this lore, generate a complete map layout including sectors and major zones.
    Lore: ${JSON.stringify(lore.slice(0, 10))}
    Settings: ${JSON.stringify(settings)}
    Return JSON: { "sectors": [], "zones": [] }`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: input,
        config: {
                thinkingConfig: { thinkingBudget: 4000 }, responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

/**
 * Generates Points of Interest for a specific zone.
 */
export const generatePoisForZone = async (zone: MapZone, worldSummary: string, mapSettings?: MapSettings, existingNames: string[] = []): Promise<any[]> => {
    const ai = getAi();
    const hostilityDesc = typeof zone.hostility === 'number' ? `Threat level: ${zone.hostility} (negative is safe, positive is dangerous).` : '';
    const keywordsDesc = zone.keywords && zone.keywords.length > 0 ? `Zone attributes: ${zone.keywords.join(', ')}.` : '';
    const input = `Generate 4 specific POIs for the zone "${zone.name}" (${zone.description}).
    World: ${worldSummary}
    ${hostilityDesc}
    ${keywordsDesc}
    [STRICT CONSTRAINTS]
    - title: MAX 3 WORDS.
    - title: MUST NOT be identical OR SIMILAR to the zone name "${zone.name}". Choose distinct nouns/adjectives.
    - title: EACH POI MUST HAVE A UNIQUE AND DISTINCT NAME. Do not repeat words across titles.
    - One POI MUST be titled "Open Area", which serves as the generic entry point for visitors.
    - content: MAX 30 WORDS.
    - Generate EXACTLY 4 POIs.
    Return JSON array: [{ "title": "string", "content": "string" }]`;

    const maxRetries = 2;
    let attempts = 0;
    let finalPois: any[] = [];

    while (attempts <= maxRetries) {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: input + (attempts > 0 ? `\n\n[RETRY ATTEMPT ${attempts}] Some generated titles were too similar to existing locations: [${existingNames.join(', ')}]. Choose DIFFERENT, DISTINCT nouns or adjectives.` : ''),
            config: { responseMimeType: "application/json" }
        });

        const result = JSON.parse(cleanJson(response.text || '[]'));
        const pois = Array.isArray(result) ? result : [];
        
        // If it's the first attempt, we keep it as a fallback
        if (attempts === 0) finalPois = pois;

        // Validate uniqueness (excluding "Open Area")
        const hasCollision = pois.some(p => {
            const title = p.title || "";
            if (title.toLowerCase().includes("open area")) return false;
            return isNameTooSimilar(title, existingNames) || isNameTooSimilar(title, [zone.name]);
        });

        if (!hasCollision && pois.length > 0) {
            finalPois = pois;
            break;
        }
        attempts++;
    }

    return finalPois;
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
        model: 'gemini-3.1-flash-lite',
        contents: input,
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
    sector?: MapSector,
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
    Sector: ${sector?.name || 'The Wilds'}
    World context: ${worldSummary || ''}
    Additional context: ${additionalContext || ''}
    ${propertiesContext}
    
    [STRICT CONSTRAINTS]
    - name: MAX 3 WORDS.
    - description: MAX 30 WORDS.
    
    Return JSON: { "name": "string", "description": "string", "hostility": number, "keywords": ["string"] }`;


    const maxRetries = 2;
    let attempts = 0;
    let finalDetails = { name: "Uncharted Zone", description: "A mysterious area.", hostility: 0, keywords: [] };

    while (attempts <= maxRetries) {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: input + (attempts > 0 ? `\n\n[RETRY ATTEMPT ${attempts}] The previous name was too similar to existing locations. Choose a DIFFERENT, DISTINCT noun or adjective.` : ''),
            config: { responseMimeType: "application/json" }
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
        model: 'gemini-3.1-flash-lite',
        contents: input,
        config: {
                thinkingConfig: { thinkingBudget: 4000 }, responseMimeType: "application/json" }
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
            const sector = gameData.mapSectors?.find(s => s.coordinates.includes(targetCoords));

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

            // Emit Shimmer UI Zone immediately
            const shimmerZone: MapZone = {
                id: `zone-${targetCoords}-loading`,
                coordinates: targetCoords,
                name: "...", // Placeholder
                hostility: 0,
                sectorId: sector?.id,
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

                const completeContext = `${contextStr}\n${validationContext}`;

                const details = await generateZoneDetails(
                    targetCoords,
                    "Uncharted Lands",
                    sector,
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
                    sectorId: sector?.id,
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
                            tags: ['location'],
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

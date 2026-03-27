// services/aiWorldService.ts

import { getAi, cleanJson } from './aiClient';
import { AI_MODELS, THINKING_BUDGETS } from '../config/aiConfig';
import { Type } from "@google/genai";
import { MapSettings, GameData, StoryLog, WorldPreview, MapZone, ChatMessage, LoreEntry } from '../types';
import { EncounterMatrixResult } from '../utils/EncounterMechanics';
import { parseCoords, isNameTooSimilar, getPOITheme } from '../utils/mapUtils';
import { RACIAL_TRAIT_BLUEPRINTS } from '../constants/racialTraits';
import { POI_MATRIX } from '../constants';
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
            type: 'Tactical Brief',
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
            type: 'World Building',
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
    
    // 1. Generate Population Center POI (only if NOT barren)
    const popLevel = zone.populationLevel || 'Barren';
    let popCenterPoi: any = null;

    if (popLevel !== 'Barren') {
        const popPrompt = `Generate a specific, thematic Point of Interest that represents the Population Center for the zone "${zone.name}" (${zone.description}).
        World: ${worldSummary}
        ${hostilityDesc}
        Population Scale: ${popLevel}. Make sure the scale of this POI matches this density.
        [STRICT CONSTRAINTS]
        - title: MAX 3 WORDS.
        - title: MUST NOT be identical OR SIMILAR to the zone name "${zone.name}". Choose distinct nouns/adjectives.
        - title: MUST be a distinct name for a settlement.
        - content: MAX 30 WORDS.
        Return JSON: { "title": "string", "content": "string" }`;

        popCenterPoi = { title: "Local Settlement", content: "A small gathering of dwellings indicating civilization." };
        let popAttempts = 0;
        while (popAttempts <= 2) {
            try {
                const popRes = await ai.models.generateContent({
                    type: 'World Building',
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
            } catch (e) {
                console.error("Pop center generation failed", e);
            }
            popAttempts++;
        }
    }

    // Update existing names to include the new pop center so we don't repeat it
    const updatedExistingNames = popCenterPoi ? [...existingNames, popCenterPoi.title] : [...existingNames];

    // 2. Generate generic POIs using the pop center or zone as context
    // SYSTEM MANAGED: Roll 3d10 for the 3 surrounding landmarks using the POI_MATRIX
    const currentTheme = getPOITheme(worldSummary);
    const matrix = POI_MATRIX[currentTheme] || POI_MATRIX.fantasy;
    const rolledThemesData = [1, 2, 3].map(() => {
        const r1 = Math.floor(Math.random() * 10);
        const r2 = Math.floor(Math.random() * 10);
        const r3 = Math.floor(Math.random() * 10);
        return {
            baseType: matrix.baseTypes[r1],
            themeStr: `${matrix.baseTypes[r1]} | ${matrix.modifiers[r2]} | ${matrix.flavors[r3]}`
        };
    });

    const mainContext = popCenterPoi 
        ? `[MAIN CONTEXT]: The central landmark of this area is "${popCenterPoi.title}" - ${popCenterPoi.content}. The new POIs should thematically connect to or exist around this main feature.`
        : `[MAIN CONTEXT]: This is a barren wilderness area called "${zone.name}" (${zone.description}). The new POIs should be isolated landmarks, natural anomalies, or points of interest for travelers in the wilds.`;

    const input = `Generate EXACTLY 4 specific POIs for the zone "${zone.name}" (${zone.description}).
    World: ${worldSummary}
    ${hostilityDesc}
    ${keywordsDesc}
    ${mainContext}
    
    [SYSTEM DIRECTIVE: POI THEMES]
    You MUST generate the POIs following these specific rolled themes. Each theme should be the core concept of one POI. You are merely the descriptive engine; the core identity is determined by these system rolls.
    1. Theme: ${rolledThemesData[0].themeStr}
    2. Theme: ${rolledThemesData[1].themeStr}
    3. Theme: ${rolledThemesData[2].themeStr}

    [INSTRUCTIONS]
    1. Entry 1: [MANDATORY] Thematic Population Center landmark (matching the ${zone.populationLevel} scale). This is a UNIQUE SETTLEMENT and does NOT use a system-rolled theme.
    2. Entries 2-4: The 3 surrounding landmarks. Each MUST correspond to its numbered theme provided above (Themes 1-3).
    3. title: MAX 3 WORDS.
    4. title: MUST NOT be identical OR SIMILAR to the zone name "${zone.name}" or (if it exists) the main landmark "${popCenterPoi?.title || ''}".
    5. title: EACH POI MUST HAVE A UNIQUE AND DISTINCT NAME. Do not repeat words across titles.
    6. content: MAX 30 WORDS.
    
    Return JSON array: [{ "title": "string", "content": "string" }]`;

    const maxRetries = 2;
    let attempts = 0;
    let finalPois: any[] = [];

    while (attempts <= maxRetries) {
        const response = await ai.models.generateContent({
            type: 'World Building',
            model: 'gemini-3.1-flash-lite-preview',
            contents: input + (attempts > 0 ? `\n\n[RETRY ATTEMPT ${attempts}] Some generated titles were too similar to existing locations: [${updatedExistingNames.join(', ')}]. Choose DIFFERENT, DISTINCT nouns or adjectives.` : ''),
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } }
        });

        const data = JSON.parse(cleanJson(response.text || '[]'));
        let pois = Array.isArray(data) ? data : (data.pois || []);
        
        // Attach base types to each generated POI (Skipping pop center index 0)
        pois = pois.map((p: any, i: number) => {
            if (i > 0 && i - 1 < rolledThemesData.length) {
                return { ...p, baseType: rolledThemesData[i - 1]?.baseType };
            }
            return p;
        });

        if (attempts === 0) finalPois = pois;

        const hasCollision = pois.some((p: any) => {
            const title = p.title || "";
            return isNameTooSimilar(title, updatedExistingNames) || isNameTooSimilar(title, [zone.name]);
        });

        if (!hasCollision && pois.length === 4) { // Ensure exactly 4 POIs are returned
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

    const results = [openArea, ...finalPois];
    
    // The first generated POI (results[1]) is mapped to the Pop Center theme in the prompt.
    // We mark it as the population center if the zone isn't barren.
    if (zone.populationLevel !== 'Barren' && results.length > 1) {
        results[1].isPopulationCenter = true;
    }

    return results;
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
    const themeKey = getPOITheme(worldSummary || '');
    const currentTheme = themeKey === 'scifi' ? 'Sci-Fi' : 
                         themeKey === 'modern' ? 'Modern' : 
                         themeKey === 'magitech' ? 'Magitech' : 'Fantasy';

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
 * Generates details for multiple zones in a single batch call.
 * Optimized for preloading adjacent territories.
 */
export const generateBatchZoneDetails = async (
    zonesToGenerate: { coords: string, popLevel: string }[],
    worldSummary: string,
    existingNames: string[] = []
): Promise<any[]> => {
    const ai = getAi();
    const themeKey = getPOITheme(worldSummary);
    const currentTheme = themeKey === 'scifi' ? 'Sci-Fi' : 
                         themeKey === 'modern' ? 'Modern' : 
                         themeKey === 'magitech' ? 'Magitech' : 'Fantasy';

    const input = `Generate unique details for ${zonesToGenerate.length} new map zones.
    World context: ${worldSummary}
    
    [ZONES TO GENERATE]
    ${zonesToGenerate.map((z, i) => `${i + 1}. Coords: ${z.coords}, Population Density: ${z.popLevel}`).join('\n')}
    
    [STRICT CONSTRAINTS PER ZONE]
    - name: MAX 3 WORDS.
    - name: MUST NOT match or be highly similar to existing zones: [${existingNames.join(', ')}].
    - description: MAX 30 WORDS.
    - hostility: A number between -5 and 10.
    
    Return JSON array of objects: [{ "coordinates", "name", "description", "hostility" }]`;

    try {
        const response = await ai.models.generateContent({
            model: AI_MODELS.DEFAULT,
            contents: input,
            config: { 
                responseMimeType: "application/json"
            }
        });

        const data = JSON.parse(cleanJson(response.text || '[]'));
        return Array.isArray(data) ? data : (data.zones || []);
    } catch (e) {
        console.error("Batch zone generation failed", e);
        return zonesToGenerate.map(z => ({
            coordinates: z.coords,
            name: "Uncharted Wilds",
            description: "A mysterious region awaiting exploration.",
            hostility: 0
        }));
    }
};

import { getTravelDestinationsContext } from './aiContextService';

/**
 * Parses user travel intent from chat.
 */
export const parseTravelIntent = async (userContent: string, history: ChatMessage[], gameData?: GameData): Promise<{ destination: string, method: string }> => {
    const ai = getAi();
    
    // Enrich with context of known places to ensure the AI picks a canonical name if possible
    const destContext = gameData ? getTravelDestinationsContext(gameData) : '';
    
    const input = `Analyze the user's travel intent.
    [USER MESSAGE]
    "${userContent}"
    
    [HISTORY (RECENT)]
    ${JSON.stringify(history.slice(-3))}
    
    ${destContext}

    [INSTRUCTIONS]
    1. Identify the 'destination' and 'method' (e.g., walking, ship, etc.) from the message.
    2. If the user mentions a location that exists in the [DISCOVERED LOCATIONS] list above, use that exact canonical name as the 'destination'.
    3. If the user mentions a CARDINAL DIRECTION (north, south, east, west, etc.) ONLY, return that direction as the 'destination'.
    4. If it's a new uncharted location, return the user's name for it.
    
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
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 1, dy: -1 }, { dx: -1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }
    ];

    const missingNeighbors: { coords: string, popLevel: 'Barren' | 'Settlement' | 'Town' | 'City' | 'Capital', features: string[] }[] = [];
    const runningZoneNames = existingZones.map(z => z.name);
    const poiNames = existingPois.map(p => p.title);
    const allInhabitedNames = [...new Set([...runningZoneNames, ...poiNames])];

    for (const d of directions) {
        const targetCoords = `${p.x + d.dx}-${p.y + d.dy}`;
        const existing = existingZones.find(z => z.coordinates === targetCoords);
        if (!existing || existing.isLoading) {
            const popRoll = Math.floor(Math.random() * 20) + 1;
            let popLevel: 'Barren' | 'Settlement' | 'Town' | 'City' | 'Capital' = 'Barren';
            let features: string[] = [];
            if (popRoll >= 20) { popLevel = 'Capital'; features = ['Tavern', 'Market', 'Item Forge', 'Shipyard']; }
            else if (popRoll >= 18) { popLevel = 'City'; features = ['Tavern', 'Market', 'Shipyard']; }
            else if (popRoll >= 15) { popLevel = 'Town'; features = ['Tavern', 'Market']; }
            else if (popRoll >= 10) { popLevel = 'Settlement'; features = ['Tavern']; }
            
            missingNeighbors.push({ coords: targetCoords, popLevel, features });

            // Emit Shimmer UI
            dispatchZoneUpdate({
                id: `zone-${targetCoords}-loading`,
                coordinates: targetCoords,
                name: "...",
                visited: false,
                isNew: false,
                isLoading: true
            } as MapZone);
        }
    }

    if (missingNeighbors.length === 0) return;

    try {
        const batchDetails = await generateBatchZoneDetails(
            missingNeighbors.map(m => ({ coords: m.coords, popLevel: m.popLevel })),
            gameData.worldSummary || "",
            allInhabitedNames
        );

        const updatedCoords = new Set<string>();
        batchDetails.forEach(details => {
            const rawCoords = (details.coordinates || "").toString().trim();
            // Fuzzy match: Extract X-Y from potentially messy AI strings
            const match = rawCoords.match(/(-?\d+)-(-?\d+)/);
            const sanitizedCoords = match ? `${match[1]}-${match[2]}` : rawCoords;
            
            const config = missingNeighbors.find(m => m.coords === sanitizedCoords);
            if (!config) return;

            const newZone: MapZone = {
                id: `zone-${sanitizedCoords}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                coordinates: sanitizedCoords,
                name: details.name || "Uncharted Lands",
                description: details.description || "A mysterious area awaiting discovery.",
                hostility: typeof details.hostility === 'number' ? details.hostility : 0,
                populationLevel: config.popLevel,
                zoneFeatures: config.features,
                visited: false,
                isNew: false,
                isLoading: false,
                tags: ['location'],
                keywords: []
            };

            dispatchZoneUpdate(newZone);
            updatedCoords.add(sanitizedCoords);

            // Inject "Open Area" immediately so the zone is technically landing-ready
            if (dispatchKnowledgeUpdate) {
                const openArea: Omit<LoreEntry, 'id'> = {
                    title: "Open Area",
                    content: `The immediate arrival area of ${newZone.name}. ${newZone.description}`,
                    coordinates: newZone.coordinates,
                    tags: ['location'],
                    isNew: true,
                    visited: true
                };
                dispatchKnowledgeUpdate([openArea]);
            }
        });

        // Fallback for any missing entries in the batch
        missingNeighbors.forEach(m => {
            if (!updatedCoords.has(m.coords)) {
                dispatchZoneUpdate({
                    id: `zone-${m.coords}-fallback-${Date.now()}`,
                    coordinates: m.coords,
                    name: "Uncharted Wilds",
                    description: "A mysterious region awaiting exploration.",
                    hostility: 0,
                    populationLevel: m.popLevel,
                    zoneFeatures: m.features,
                    visited: false,
                    isNew: false,
                    isLoading: false,
                    tags: ['location'],
                    keywords: []
                } as MapZone);
            }
        });
    } catch (e) {
        console.error("Batch preload failed:", e);
    }
};

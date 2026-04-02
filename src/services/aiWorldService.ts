// services/aiWorldService.ts

import { getAi, cleanJson } from './aiClient';
import { AI_MODELS, THINKING_BUDGETS } from '../config/aiConfig';
import { Type } from "@google/genai";
import { MapSettings, GameData, StoryLog, WorldPreview, MapZone, ChatMessage, LoreEntry } from '../types';
import { EncounterMatrixResult } from '../utils/EncounterMechanics';
import { parseCoords, isNameTooSimilar, getPOITheme, normalizeCoords } from '../utils/mapUtils';
import { RACIAL_TRAIT_BLUEPRINTS } from '../constants/racialTraits';
import { LANGUAGE_TECHNIQUES, HUMAN_LANGUAGE_TECHNIQUE } from '../constants/languageTechniques';
import { POI_MATRIX } from '../constants';
import { Ability } from '../types';

/**
 * Roll for zone population and features.
 */
export const rollZonePopulation = (): { popLevel: 'Barren' | 'Settlement' | 'Town' | 'City' | 'Capital', features: string[] } => {
    const popRoll = Math.floor(Math.random() * 20) + 1;
    let popLevel: 'Barren' | 'Settlement' | 'Town' | 'City' | 'Capital' = 'Barren';
    let features: string[] = [];
    
    if (popRoll >= 20) { popLevel = 'Capital'; features = ['Tavern', 'Market', 'Item Forge', 'Shipyard']; }
    else if (popRoll >= 18) { popLevel = 'City'; features = ['Tavern', 'Market', 'Shipyard']; }
    else if (popRoll >= 15) { popLevel = 'Town'; features = ['Tavern', 'Market']; }
    else if (popRoll >= 10) { popLevel = 'Settlement'; features = ['Tavern']; }
    
    return { popLevel, features };
};

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
    context: string,
    raceNames?: string[],
    factionNames?: string[]
): Promise<WorldPreview> => {
    const requestedRacesText = raceNames && raceNames.filter(n => n.trim()).length > 0
        ? `Use these specific names for the major races if possible: [${raceNames.filter(n => n.trim()).join(', ')}]. If fewer names are provided than the target count of ${numRaces + 1}, generate additional thematic names.`
        : "";
    const requestedFactionsText = factionNames && factionNames.filter(n => n.trim()).length > 0
        ? `Use these specific names for the major factions if possible: [${factionNames.filter(n => n.trim()).join(', ')}]. If fewer names are provided than the target count of ${numFactions}, generate additional thematic names.`
        : "";

    const prompt = `You are a World-Building Architect. Create a cohesive TTRPG world preview.
    
    [INPUTS]
    Name: ${name}
    Setting: ${setting}
    Themes: ${themes.join(', ')}
    User Context: ${context}
    ${requestedRacesText}
    ${requestedFactionsText}
    
    [INSTRUCTIONS]
    1. SUMMARY: Write exactly 2 paragraphs explaining the current state of the world.
    2. RACES: Generate EXACTLY ${numRaces + 1} major races. One MUST be 'Humans'.
    3. FACTIONS: Generate EXACTLY ${numFactions} organizations.
    4. CUSTOM NAMES: If specific names were requested above, prioritize using them for the races and factions.
    
    [CASING RULES]
    - Use Title Case for ALL names and titles.
    - Use Sentence Case for descriptions, goals, and other text blocks.
    - DO NOT use ALL CAPS or ALL UPPERCASE for any portion of the response.
    - MAXIMUM 30 WORDS for descriptions.
    - MAXIMUM 15 WORDS for qualities.
    - MAXIMUM 20 WORDS for faction goals.`;

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

        // Distribute racial traits and assign language techniques
        const shuffledTraits = [...RACIAL_TRAIT_BLUEPRINTS].sort(() => 0.5 - Math.random());
        const shuffledLanguages = [...LANGUAGE_TECHNIQUES].sort(() => 0.5 - Math.random());
        let languageIndex = 0;

        const racesWithTraits = rawRaces.map((race: any, index: number) => {
            const blueprint = shuffledTraits[index % shuffledTraits.length];
            const racialTrait: Ability = {
                ...blueprint,
                id: `racial-${race.name.toLowerCase()}-${Date.now()}`,
                name: `${race.name} Trait`
            } as Ability;
            
            let languageConfig = HUMAN_LANGUAGE_TECHNIQUE;
            if (race.name.toLowerCase() !== 'humans' && race.name.toLowerCase() !== 'human') {
                languageConfig = shuffledLanguages[languageIndex % shuffledLanguages.length];
                languageIndex++;
            }

            return { ...race, racialTrait, languageConfig };
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
    
    // Combine foundational lore (first 15 entries) with recent developments (last 25 entries)
    // This provides the AI with both the world's origins and its current state.
    const foundationalLore = lore.slice(0, 15);
    const recentLore = lore.length > 15 ? lore.slice(-25) : [];
    const loreContext = [...foundationalLore, ...recentLore];
    
    const input = `You are a Grand Master Lorekeeper. Based on the following established lore fragments, provide a highly structured, concise, yet detailed Realm Overview.
    
    [LORE DATA]
    ${JSON.stringify(loreContext)}
    
    [OUTPUT STRUCTURE]
    You MUST follow this exact format with these specific headers:
    
    CURRENT STATE: (A concise paragraph on the world's immediate situation)
    THEMATIC PILLARS: (Bullet points for Conflict, Technology/Magic, and Aesthetic)
    KEY FACTIONS: (Brief mention of major organizations and their roles)
    RECENT DEVELOPMENTS: (Summary of the most significant recent events from lore)
    
    [STRICT RULES]
    - Return ONLY plain text. 
    - NO Markdown formatting (no asterisks, hash signs, etc.).
    - Use Title Case for headers.
    - MAXIMUM 150 WORDS.
    - Be atmospheric but precise.`;

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
    
    // 2. Generate generic POIs using the zone as context
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

    const input = `Generate specific POIs for the zone "${zone.name}" (${zone.description}).
    World: ${worldSummary}
    ${hostilityDesc}
    ${keywordsDesc}
    [CONTEXT]: This is a wilderness area called "${zone.name}". Provide 3 interesting landmarks for travelers.
    
    [SYSTEM DIRECTIVE: POI THEMES (MANDATORY)]
    You are the "Skinning Engine". The system has already decided THE CORE TYPES of these locations. You must generate a thematic title and description for each.
    - Landmark 1 must be a: ${rolledThemesData[0].themeStr}
    - Landmark 2 must be a: ${rolledThemesData[1].themeStr}
    - Landmark 3 must be a: ${rolledThemesData[2].themeStr}

    [INSTRUCTIONS]
    1. Generate EXACTLY 3 Landmark entries. 
    2. title: MAX 3 WORDS.
    3. title: MUST NOT be identical OR SIMILAR to the zone name "${zone.name}".
    4. content: MAX 30 WORDS.
    
    Return JSON array of 3 objects: [{ "title": "string", "content": "string" }]`;

    const maxRetries = 2;
    let attempts = 0;
    let finalPois: any[] = [];

    while (attempts <= maxRetries) {
        try {
            const response = await ai.models.generateContent({
                type: 'World Building',
                model: 'gemini-3.1-flash-lite-preview',
                contents: input + (attempts > 0 ? `\n\n[RETRY ATTEMPT ${attempts}] Some generated titles were too similar to existing locations: [${existingNames.join(', ')}]. Choose DIFFERENT, DISTINCT nouns or adjectives.` : ''),
                config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } }
            });

            const data = JSON.parse(cleanJson(response.text || '[]'));
            let pois = Array.isArray(data) ? data : (data.pois || []);
            
            // Attach base types to each generated POI
            pois = pois.map((p: any, i: number) => {
                if (i < rolledThemesData.length) {
                    return { ...p, baseType: rolledThemesData[i].baseType };
                }
                return p;
            });

            finalPois = pois.slice(0, 3); // Ensure only 3 landmarks

            const hasCollision = finalPois.some((p: any) => {
                const title = p.title || "";
                return isNameTooSimilar(title, existingNames) || isNameTooSimilar(title, [zone.name]);
            });

            if (!hasCollision && finalPois.length === 3) {
                break;
            }
        } catch (e) {
            console.error("POI generation attempt failed", e);
        }
        attempts++;
    }

    // SYSTEM MANAGED: Always inject the "Open Area" as the primary POI
    const openArea = {
        title: `Open Area of ${zone.name}`,
        content: `The immediate arrival area of ${zone.name}. ${zone.description || "A localized region in the world."}`,
        baseType: 'Arrival Site'
    };

    // Results: Open Area + 3 Landmarks (No Settlement here)
    return [openArea, ...finalPois];
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
): Promise<{ name: string, description: string, hostility: number, keywords: string[], populationLevel: string, zoneFeatures: string[] }> => {

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

    // ROLL Population and Features for the new zone
    const { popLevel, features } = rollZonePopulation();

    return { 
        ...finalDetails, 
        populationLevel: popLevel, 
        zoneFeatures: features 
    } as any;
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
        const targetCoords = normalizeCoords(`${p.x + d.dx}-${p.y + d.dy}`);
        const existing = existingZones.find(z => normalizeCoords(z.coordinates) === targetCoords);
        if (!existing || existing.isLoading) {
            const { popLevel, features } = rollZonePopulation();
            
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
        const ai = getAi();
        const batchDetails = await generateBatchZoneDetails(
            missingNeighbors.map(m => ({ coords: m.coords, popLevel: m.popLevel })),
            gameData.worldSummary || "",
            allInhabitedNames
        );

        const updatedCoords = new Set<string>();
        for (const details of batchDetails) {
            const rawCoords = (details.coordinates || "").toString().trim();
            // Fuzzy match: Extract X-Y from potentially messy AI strings
            const match = rawCoords.match(/(-?\d+)-(-?\d+)/);
            const sanitizedCoords = match ? `${match[1]}-${match[2]}` : rawCoords;
            
            const config = missingNeighbors.find(m => m.coords === sanitizedCoords);
            if (!config) continue;

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
                    title: `Open Area of ${newZone.name}`,
                    content: `The immediate arrival area of ${newZone.name}. ${newZone.description}`,
                    coordinates: newZone.coordinates,
                    tags: ['location'],
                    isNew: true,
                    visited: true
                };

                // Generate and inject a Population Center POI for non-Barren zones
                if (config.popLevel !== 'Barren') {
                    const popLevel = config.popLevel.toLowerCase();
                    try {
                        const popRes = await ai.models.generateContent({
                            type: 'World Building',
                            model: 'gemini-3.1-flash-lite-preview',
                            contents: `Generate a thematic name and brief description for a ${config.popLevel}-scale settlement that exists in the zone "${newZone.name}" (${newZone.description}).
                            World: ${gameData.worldSummary || ''}
                            [STRICT CONSTRAINTS]
                            - title: MAX 3 WORDS. Must be a DISTINCT settlement name, NOT similar to "${newZone.name}".
                            - content: MAX 20 WORDS.
                            Return JSON: { "title": "string", "content": "string" }`,
                            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } }
                        });
                        const popData = JSON.parse(cleanJson(popRes.text || '{}'));
                        if (popData.title) {
                            const popCenterPoi: Omit<LoreEntry, 'id'> = {
                                title: popData.title,
                                content: popData.content || `A ${config.popLevel.toLowerCase()} within ${newZone.name}.`,
                                coordinates: newZone.coordinates,
                                tags: ['location', 'population-center', popLevel],
                                isNew: true,
                                visited: false
                            };
                            dispatchKnowledgeUpdate([openArea, popCenterPoi]);
                        } else {
                            dispatchKnowledgeUpdate([openArea]);
                        }
                    } catch (popErr) {
                        console.error("Pop center preload generation failed for", newZone.name, popErr);
                        // Fallback: create a generic pop center
                        const fallbackPop: Omit<LoreEntry, 'id'> = {
                            title: `Local ${config.popLevel}`,
                            content: `A modest ${config.popLevel.toLowerCase()} within the region of ${newZone.name}.`,
                            coordinates: newZone.coordinates,
                            tags: ['location', 'population-center', popLevel],
                            isNew: true,
                            visited: false
                        };
                        dispatchKnowledgeUpdate([openArea, fallbackPop]);
                    }
                } else {
                    dispatchKnowledgeUpdate([openArea]);
                }
            }
        }

        // Fallback for any missing entries in the batch or failed generations
        missingNeighbors.forEach(m => {
            if (!updatedCoords.has(m.coords)) {
                const fallbackZone: MapZone = {
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
                };

                dispatchZoneUpdate(fallbackZone);

                if (dispatchKnowledgeUpdate) {
                    const openArea: Omit<LoreEntry, 'id'> = {
                        title: `Open Area of ${fallbackZone.name}`,
                        content: `The immediate arrival area of ${fallbackZone.name}. ${fallbackZone.description}`,
                        coordinates: fallbackZone.coordinates,
                        tags: ['location'],
                        isNew: true,
                        visited: true
                    };

                    if (m.popLevel !== 'Barren') {
                        const popLevelLabel = m.popLevel.toLowerCase();
                        const fallbackPop: Omit<LoreEntry, 'id'> = {
                            title: `Local ${m.popLevel}`,
                            content: `A modest ${popLevelLabel} within the region of ${fallbackZone.name}.`,
                            coordinates: fallbackZone.coordinates,
                            tags: ['location', 'population-center', popLevelLabel],
                            isNew: true,
                            visited: false
                        };
                        dispatchKnowledgeUpdate([openArea, fallbackPop]);
                    } else {
                        dispatchKnowledgeUpdate([openArea]);
                    }
                }
            }
        });
    } catch (e) {
        console.error("Batch preload failed:", e);
    }
};

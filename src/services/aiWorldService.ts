// services/aiWorldService.ts

import { getAi, cleanJson } from './aiClient';
import { Type } from "@google/genai";
import { MapSettings, GameData, StoryLog, WorldPreview, MapSector, MapZone, ChatMessage, LoreEntry } from '../types';
import { EncounterMatrixResult } from '../utils/EncounterMechanics';

/**
 * THE PLOT EXPANDER (Tactical Specialist)
 * Uses Gemini 3 Flash to expand raw system matrix rolls into 3 concise tactical sentences.
 */
export const expandEncounterPlot = async (matrix: EncounterMatrixResult, worldSummary: string): Promise<string> => {
    const prompt = `
    You are the "Tactical Plot Architect". Expand the following raw RPG encounter matrix results into a concise encounter brief.
    
    [WORLD SUMMARY]
    ${worldSummary}

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
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 0 }
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
            model: 'gemini-3-pro-preview',
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
        model: 'gemini-flash-lite-latest',
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
        model: 'gemini-3-flash-preview',
        contents: input,
        config: { responseMimeType: "application/json" }
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
        model: 'gemini-3-pro-preview',
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
        model: 'gemini-flash-lite-latest',
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
        model: 'gemini-3-pro-preview',
        contents: input,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

/**
 * Generates Points of Interest for a specific zone.
 */
export const generatePoisForZone = async (zone: MapZone, worldSummary: string, mapSettings?: MapSettings): Promise<any[]> => {
    const ai = getAi();
    const input = `Generate 3 specific POIs for the zone "${zone.name}" (${zone.description}).
    World: ${worldSummary}
    [STRICT CONSTRAINTS]
    - title: MAX 3 WORDS.
    - title: MUST NOT be identical to the zone name "${zone.name}".
    - content: MAX 30 WORDS.
    Return JSON array: [{ "title": "string", "content": "string" }]`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: input,
        config: { responseMimeType: "application/json" }
    });
    const result = JSON.parse(cleanJson(response.text || '[]'));
    return Array.isArray(result) ? result : [];
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
        model: 'gemini-flash-lite-latest',
        contents: input,
    });
    return response.text || "A place of significance.";
};

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
    worldSummary?: string
): Promise<{ name: string, description: string, hostility: number, keywords: string[] }> => {
    const ai = getAi();
    const input = `Generate details for a new map zone at coordinates ${coords}.
    Name hint: ${nameHint}
    Sector: ${sector?.name || 'The Wilds'}
    World context: ${worldSummary || ''}
    Additional context: ${additionalContext || ''}
    
    [STRICT CONSTRAINTS]
    - name: MAX 3 WORDS.
    - description: MAX 30 WORDS.
    
    Return JSON: { "name": "string", "description": "string", "hostility": number, "keywords": ["string"] }`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: input,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{"name":"Uncharted Zone","description":"A mysterious area.","hostility":0,"keywords":[]}'));
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
        model: 'gemini-3-flash-preview',
        contents: input,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{"destination":"","method":""}'));
};
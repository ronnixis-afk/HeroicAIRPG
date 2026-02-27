
// services/aiLocaleAgentService.ts

import { getAi, cleanJson } from './aiClient';
import { GameData, MapSector } from '../types';
import { parseCoords } from '../utils/mapUtils';

/**
 * THE LOCATION SPECIALIST (Locale Agent 3.0)
 * Dedicated to validating and fleshing out spatial transitions.
 * Implements a Validation Gate to ensure moves are physically possible.
 */
export const resolveLocaleCreation = async (
    requestedName: string,
    gameData: GameData
): Promise<{
    name: string;
    sub_location: string;
    content: string;
    isNew: boolean;
    isLiteralTransition: boolean;
    reasoning: string;
    validation_passed: boolean;
}> => {
    const currentCoords = gameData.playerCoordinates || '0-0';
    const currentZone = gameData.mapZones?.find(z => z.coordinates === currentCoords);
    const currentSector = gameData.mapSectors?.find(s => s.coordinates.includes(currentCoords));
    const currentZoneName = currentZone?.name || 'Unknown';
    
    const localPOIs = gameData.knowledge
        ?.filter(k => k.coordinates === currentCoords && k.tags?.includes('location'))
        .map(k => ({ title: k.title, content: k.content })) || [];

    const prompt = `
    You are the "Location Specialist AI & Validation Gate". 
    Determine if a requested spatial move is valid and resolve it into a Physical Container (Site) and Sub-Location (Spot).
    
    [REQUESTED DESTINATION]: "${requestedName}"
    [CURRENT ZONE]: "${currentZoneName}"
    [CURRENT SITE]: "${gameData.current_site_name || "Open Area"}"
    [CURRENT SPOT]: "${gameData.current_site_detail || "None"}"

    [VALIDATION RULES]
    1. MOVE FEASIBILITY: Is the [REQUESTED DESTINATION] physically reachable?
       - Moving between rooms in the same building is VALID.
       - Moving to a spot within the current room is VALID.
       - Moving between zones without a travel action is INVALID.

    [PHYSICALITY FILTER]
    1. SITE NAME: The building/area (e.g., "The Iron Forge"). Proper Noun. MAX 3 WORDS.
    2. SUB-LOCATION: The specific spot (e.g., "Anvil Area", "Main Desk"). MAX 3 WORDS.
    3. FORBIDDEN: Do not use "Hiding" or "Combat" as locations. Use physical spots.

    [OUTPUT JSON SCHEMA]
    {
      "name": "The Iron Forge",
      "sub_location": "Main Anvil",
      "content": "Atmospheric visual description (30 words max)",
      "isNew": boolean,
      "isLiteralTransition": boolean,
      "validation_passed": boolean,
      "reasoning": "string"
    }
    `;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        
        const result = JSON.parse(cleanJson(response.text || "{}"));
        return {
            name: result.name || requestedName,
            sub_location: result.sub_location || "Open Area",
            content: result.content || "A specific location within the region.",
            isNew: !!result.isNew,
            isLiteralTransition: !!result.isLiteralTransition,
            validation_passed: result.validation_passed !== undefined ? result.validation_passed : true,
            reasoning: result.reasoning || "Standard validation."
        };
    } catch (e) {
        console.error("Location Specialist failed:", e);
        return { 
            name: requestedName, 
            sub_location: "Open Area",
            content: "A newly discovered site in the region.", 
            isNew: true,
            isLiteralTransition: true,
            validation_passed: true,
            reasoning: "Fallback due to system error."
        };
    }
};

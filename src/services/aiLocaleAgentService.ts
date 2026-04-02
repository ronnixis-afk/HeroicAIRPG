
// services/aiLocaleAgentService.ts

import { getAi, cleanJson } from './aiClient';
import { AI_MODELS, THINKING_BUDGETS } from '../config/aiConfig';
import { GameData } from '../types';
import { parseCoords, isNameTooSimilar } from '../utils/mapUtils';

/**
 * THE LOCATION SPECIALIST (Locale Agent 3.0)
 * Dedicated to validating and fleshing out spatial transitions.
 * Implements a Validation Gate to ensure moves are physically possible.
 */
export const resolveLocaleCreation = async (
    requestedName: string,
    gameData: GameData,
    existingPois: string[] = []
): Promise<{
    name: string;
    sub_location: string;
    content: string;
    isNew: boolean;
    isLiteralTransition: boolean;
    reasoning: string;
    validation_passed: boolean;
    immersive_failure_message?: string;
}> => {
    const currentCoords = gameData.playerCoordinates || '0-0';
    const currentZone = gameData.mapZones?.find(z => z.coordinates === currentCoords);
    const currentZoneName = currentZone?.name || 'Unknown';

    const localPOIs = gameData.knowledge
        ?.filter(k => k.coordinates === currentCoords && k.tags?.includes('location'))
        .map(k => ({ title: k.title, content: k.content })) || [];

    const localPOIsText = localPOIs.map(p => `- ${p.title}: ${p.content}`).join('\n');
    
    const prompt = `
    You are the "Location Specialist AI & Validation Gate". 
    Determine if a requested spatial move is valid and resolve it into a Physical Container (Site) and Sub-Location (Spot).
    
    [REQUESTED DESTINATION]: "${requestedName}"
    [CURRENT ZONE]: "${currentZoneName}"
    [CURRENT SITE]: "${gameData.current_site_name || "Open Area"}"

    [EXISTING POIS IN THIS ZONE]:
    ${localPOIsText || "None (only uninhabited wilderness)"}

    [VALIDATION RULES]
    1. NO NEW LANDMARKS: You are FORBIDDEN from creating new Map POIs (Buildings, Cities, Major Landmarks) if they are not in the [EXISTING POIS IN THIS ZONE] list.
    2. SUB-LOCATION ONLY: If the user describes a spot (e.g. "by the tree", "at the bar"), resolve it as a 'sub_location' within the [CURRENT SITE]. Set 'isLiteralTransition' to false.
    3. MOVE FEASIBILITY: Is the [REQUESTED DESTINATION] physically reachable?
       - Moving between rooms in the same building is VALID (isLiteralTransition: false).
       - Moving between buildings (POIs) is ONLY VALID if both buildings are in the [EXISTING POIS] list.

    [OUTPUT CONSTRAINTS]
    - If the requested destination does not exist and isn't a sub-location, 'validation_passed' MUST be false.
    - If 'validation_passed' is false, provide an 'immersive_failure_message' (e.g. "Scanning the horizon, you see no signs of a blacksmith in this desolate forest.").

    [PHYSICALITY FILTER]
    1. SITE NAME: The building/area (e.g., "The Iron Forge"). MAX 3 WORDS.
    2. SUB-LOCATION: The specific spot (e.g., "Anvil Area", "Main Desk"). MAX 3 WORDS.

    [OUTPUT JSON SCHEMA]
    {
      "name": "The Iron Forge",
      "sub_location": "Main Anvil",
      "content": "Atmospheric visual description (30 words max)",
      "isNew": boolean,
      "isLiteralTransition": boolean,
      "validation_passed": boolean,
      "immersive_failure_message": "string (Immersive RPG prose explaining the absence)",
      "reasoning": "string"
    }
    `;


    try {
        const maxRetries = 2;
        let attempts = 0;
        let finalResult = {
            name: requestedName,
            sub_location: "Open Area",
            content: "A specific location within the region.",
            isNew: true,
            isLiteralTransition: true,
            validation_passed: true,
            immersive_failure_message: "",
            reasoning: "Standard validation."
        };

        while (attempts <= maxRetries) {
            const ai = getAi();
            const response = await ai.models.generateContent({
                model: AI_MODELS.DEFAULT,
                contents: prompt + (attempts > 0 ? `\n\n[RETRY ATTEMPT ${attempts}] The name "${finalResult.name}" is too similar to existing locations: [${existingPois.join(', ')}]. Choose a DIFFERENT, DISTINCT name.` : ''),
                config: {
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC }
                }
            });

            const result = JSON.parse(cleanJson(response.text || "{}"));
            const newResult = {
                name: result.name || requestedName,
                sub_location: result.sub_location || "Open Area",
                content: result.content || "A specific location within the region.",
                isNew: !!result.isNew,
                isLiteralTransition: !!result.isLiteralTransition,
                validation_passed: result.validation_passed !== undefined ? result.validation_passed : true,
                immersive_failure_message: result.immersive_failure_message || "",
                reasoning: result.reasoning || "Standard validation."
            };

            if (!newResult.isNew || !isNameTooSimilar(newResult.name, existingPois)) {
                finalResult = newResult;
                break;
            }

            if (attempts === 0) finalResult = newResult;
            attempts++;
        }

        return finalResult;
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

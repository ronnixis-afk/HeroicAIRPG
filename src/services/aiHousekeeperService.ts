// services/aiHousekeeperService.ts

import { getAi, cleanJson } from './aiClient';
import { ThinkingLevel } from '@google/genai';
import { GameData, AIUpdatePayload } from '../types';
import { isLocaleMatch } from '../utils/mapUtils';

/**
 * THE HOUSEKEEPER (Mechanical Specialist)
 * Reconciles inventory, social standing, quest progress, and NPC memories.
 * Optimized for logic and reliability using gemini-flash-lite-latest.
 */
export const performHousekeeping = async (
    userAction: string,
    narrativeResult: string,
    gameData: GameData
): Promise<{
    inventoryUpdates: any[];
    relationshipChanges: { npcId: string, change: number, reason: string }[];
    objectives: any[];
    npcMemories: { npcId: string, memory: string }[];
}> => {

    // Create a unified, deduplicated social registry for the Housekeeper
    const socialMap = new Map<string, any>();
    const currentLocale = gameData.currentLocale || "";
    const activeCompanionIds = new Set((gameData.companions || []).map(c => c.id));

    (gameData.npcs || []).forEach(n => {
        const npcPOI = n.currentPOI || "";
        const isAtLocale = isLocaleMatch(npcPOI, currentLocale) ||
            npcPOI === 'Current' ||
            npcPOI === 'With Party';

        const isActiveCompanion = n.companionId && activeCompanionIds.has(n.companionId);
        const isAlive = n.status !== 'Dead';
        const isSentient = n.isSentient !== false && !n.isShip;

        if ((isAtLocale || isActiveCompanion) && isAlive && isSentient) {
            socialMap.set(n.id, {
                id: n.id,
                name: n.name,
                type: isActiveCompanion ? 'Active Companion' : 'Local NPC',
                loves: n.loves,
                likes: n.likes,
                dislikes: n.dislikes,
                hates: n.hates,
                currentRel: n.relationship,
                isCompanion: !!n.companionId
            });
        }
    });

    const socialRegistry = Array.from(socialMap.values());

    const prompt = `
    You are the "Social & Mechanical Housekeeper". 
    Your task is to extract relationship shifts, inventory changes, and specific NPC memories from the narrative.
    
    [USER ACTION]
    "${userAction}"

    [GM NARRATIVE]
    "${narrativeResult}"
    
    [SOCIAL REGISTRY (COMPANIONS & OBSERVERS)]
    ${socialRegistry.length > 0 ? JSON.stringify(socialRegistry) : "No established characters are present."}

    [INVENTORY EXTRACTION RULES - STRICT POLICY]
    1. **ACQUISITION vs. PRESENCE**: ONLY add items if the narrative confirms a character HAS PHYSICALLY ACQUIRED it. 
       - DO NOT add items simply because they are mentioned as being in the room, on a shelf, or wielded by an enemy.
       - VALID VERBS: "picked up", "received", "looted", "grabbed", "was handed", "purchased", "stole".
       - INVALID MENTIONS: "You see a...", "The merchant shows you...", "The guard has a...", "A chest sits in the corner".
    2. **OWNER IDENTIFICATION**:
       - If the narrative says "You receive/take..." -> ownerId is "player".
       - If the narrative says "[Companion Name] takes..." -> ownerId is the specific ID from the SOCIAL REGISTRY.
       - DEFAULT: If it is unclear but the Player is the one acting, default to ownerId: "player".
    3. **QUANTITY**: If currency (Gold, Credits) is added, estimate a logical amount based on narrative context (e.g. "a few coins" = 5, "a heavy purse" = 50).

    [RELATIONSHIP AUDIT INSTRUCTIONS]
    1. **PREFERENCE CHECK**: Did the player's action directly engage with an NPC's "Loves", "Likes", "Dislikes", or "Hates"?
    2. **SCALING TIERS**: LIKED/DISLIKED (+/- 1-7), LOVED/HATED (+/- 8-10).
    3. **GATING**: ONLY provide updates for NPCs listed in the [SOCIAL REGISTRY].

    [NPC MEMORY INSTRUCTIONS]
    1. For each NPC the player interacted with, extract ONE concise memory (MAX 10 WORDS).

    [QUEST AUDIT INSTRUCTIONS]
    1. Did the narrative introduce a NEW mission, task, or overarching goal? If so, extract it into 'objectives' with a 'title' and 'content', and status 'active'.
    2. Did the narrative explicitly resolve (complete/fail) an existing quest? Extract it in 'objectives' with 'status' set to 'completed' or 'failed'.
    3. If there are no quest changes, leave 'objectives' empty.

    [OUTPUT JSON SCHEMA]
    {
      "inventoryUpdates": [
        { 
          "ownerId": "player OR companion-id", 
          "list": "carried|equipped|storage|assets", 
          "action": "add|remove",
          "items": [ { "name": "string", "quantity": number, "description": "flavor summary", "rarity": "string" } ] 
        }
      ],
      "relationshipChanges": [
        { "npcId": "string", "change": number, "reason": "string" }
      ],
      "npcMemories": [
        { "npcId": "string", "memory": "string" }
      ],
      "objectives": [
        { "title": "string", "content": "string", "status": "active|completed|failed" }
      ]
    }
    `;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const result = JSON.parse(cleanJson(response.text || "{}"));

        return {
            inventoryUpdates: result.inventoryUpdates || [],
            relationshipChanges: result.relationshipChanges || [],
            npcMemories: result.npcMemories || [],
            objectives: result.objectives || []
        };
    } catch (e) {
        console.error("Housekeeper failed:", e);
        return { inventoryUpdates: [], relationshipChanges: [], npcMemories: [], objectives: [] };
    }
};
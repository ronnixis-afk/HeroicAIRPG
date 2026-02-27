
// services/aiAuditorService.ts

import { getAi, cleanJson } from './aiClient';
import { ThinkingLevel } from '@google/genai';
import { GameData, NPC, DiceRollRequest } from '../types';

/**
 * THE SYSTEM AUDITOR (Spatial and Temporal Specialist)
 * Reconciles the AI's narrative with spatial presence, temporal progression, and character registration.
 */
export const auditSystemState = async (
    userAction: string,
    narrativeResult: string,
    gameData: GameData,
    excludeList: string[] = []
): Promise<{
    currentLocale: string;
    newNPCs: Partial<NPC>[];
    npcUpdates: Partial<NPC>[]; 
    activeEngagement: boolean;
    missedRollRequests: DiceRollRequest[];
    turnSummary: string;
    timePassedMinutes: number;
}> => {
    
    const knownNpcs = (gameData.npcs || []).map(n => ({ 
        id: n.id, 
        name: n.name, 
        currentPOI: n.currentPOI,
        isCompanion: !!n.companionId,
        status: n.status
    }));

    const currentZoneName = gameData.mapZones?.find(z => z.coordinates === gameData.playerCoordinates)?.name || 'Unknown';
    const isHidden = gameData.isPartyHidden;

    // 1. Extract Valid Ancestries from World Lore
    const availableRaces = (gameData.world || [])
        .filter(l => l.tags?.includes('race'))
        .map(l => l.title);
    
    const raceListStr = availableRaces.length > 0 
        ? availableRaces.join(', ') 
        : 'Human, Elf, Dwarf, Orc';

    const prompt = `
    You are the "System Auditor". Your job is to reconcile the narrative with the game's physical and social state.
    
    [Context]
    Current World Time: "${gameData.currentTime}"
    Current Zone Name: "${currentZoneName}"
    Current Zone Coords: "${gameData.playerCoordinates}"
    Current Site: "${gameData.current_site_name || 'Open Area'}"
    User Action: "${userAction}"
    Gm Narrative: "${narrativeResult}"
    Party Stealth Status: ${isHidden ? "Hidden (Enemies are unaware)" : "Visible (Enemies can see you)"}

    [Valid Ancestries]
    The only established races in this world are: ${raceListStr}.

    [Valid Genders]
    Male, Female, Non-binary, Unspecified.

    [Instructions]
    1. **Spatial Anchoring**: Did the narrative describe moving to a new building or room?
       - Identify the **Site Name** (e.g., "The Silver Spire"). Max 3 words.
       - Identify the **Sub-Location** (e.g., "Observatory Deck"). Max 3 words.
       - **Uniqueness Rule**: The site name must not be identical to the current zone name ("${currentZoneName}").

    2. **Social Reconciliation**: 
       - Update "currentPOI" for present npcs to match the new site.
       - Identify deaths: if an npc is killed in the narrative, set "status": "Dead".

    3. **Npc Discovery**: Identify new characters introduced. 
       - **Strict Ancestry Rule**: You must select the "race" field from the [Valid Ancestries] list.
       - **Essential Status Rule**: Set "is_essential" as true for unique named characters.

    4. **Engagement Check (Critical)**: Determine if the scene has escalated to active combat.
       - set "activeEngagement" to true only if:
         a) Hostiles have explicitly attacked the player.
         b) The player has explicitly attacked a target.
         c) Stealth was broken and hostiles are now charging/engaging.
       - set "activeEngagement" to false if:
         a) Enemies are present but unaware of the player.
         b) Enemies are present but only talking/threatening without attacking.
         c) Hostiles were defeated or have fled this turn.
         d) A theft or pickpocket attempt was explicitly narrated as an "unnoticed failure", "close call", or a "narrow miss" where the npc remains unaware of the player's attempt.

    [Output Json Schema]
    {
      "currentLocale": "string (Site Name)",
      "currentSubLocation": "string",
      "timePassedMinutes": number,
      "newNPCs": [ { "name", "description", "race", "gender", "is_essential" } ],
      "npcUpdates": [ { "id", "currentPOI", "status" } ],
      "activeEngagement": boolean,
      "turnSummary": "string (Max 10 words)",
      "missedRolls": []
    }
    `;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                responseMimeType: "application/json"
            }
        });
        
        const result = JSON.parse(cleanJson(response.text || "{}"));
        
        return {
            currentLocale: result.currentLocale || gameData.currentLocale || '',
            timePassedMinutes: Number(result.timePassedMinutes) || 0,
            newNPCs: result.newNPCs || [],
            npcUpdates: result.npcUpdates || [],
            activeEngagement: !!result.activeEngagement,
            missedRollRequests: result.missedRolls || [],
            turnSummary: result.turnSummary || ""
        };
    } catch (e) {
        console.error("Auditor failed:", e);
        return { 
            currentLocale: '', 
            timePassedMinutes: 0, 
            newNPCs: [], 
            npcUpdates: [],
            activeEngagement: false, 
            missedRollRequests: [], 
            turnSummary: ""
        };
    }
};

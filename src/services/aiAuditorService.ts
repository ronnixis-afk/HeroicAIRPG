
// services/aiAuditorService.ts

import { getAi, cleanJson } from './aiClient';
import { AI_MODELS, THINKING_BUDGETS } from '../config/aiConfig';
import { ThinkingLevel } from '@google/genai';
import { GameData, NPC, DiceRollRequest, ExtractionScope, ExtractionScopeFlags } from '../types';

/**
 * THE SYSTEM AUDITOR (Spatial and Temporal Specialist)
 * Reconciles the AI's narrative with spatial presence, temporal progression, and character registration.
 */
export const auditSystemState = async (
    userAction: string,
    narrativeResult: string,
    gameData: GameData,
    excludeList: string[] = [],
    flags?: ExtractionScopeFlags
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
    1. **Spatial Anchoring**: ${flags?.spatialChange ? `Did the narrative describe moving to a new building or room?
       - Identify the **Site Name** (e.g., "The Silver Spire"). Max 3 words.
       - Identify the **Sub-Location** (e.g., "Observatory Deck"). Max 3 words.
       - **Uniqueness Rule**: The site name must not be identical to the current zone name ("${currentZoneName}").
       - **EVENT PROTECTION**: Do NOT use narrative event names as site names (e.g., "Death of X", "Aftermath of Battle", "The Ambush"). Use physical container names only.` : "SKIP: No physical movement occurred."}

    2. **Social Reconciliation**: ${flags?.socialChange ? `
       - Update "currentPOI" for present npcs to match the new site.
       - Identify deaths: if an npc is killed in the narrative, set "status": "Dead".` : "SKIP: No social or status changes occurred."}

    3. **Npc Discovery**: ${flags?.socialChange ? `Identify new characters introduced. 
       - **Strict Ancestry Rule**: You must select the "race" field from the [Valid Ancestries] list.
       - **Essential Status Rule**: Set "is_essential" as true for unique named characters.` : "SKIP: No new characters were introduced."}

    4. **Engagement Check (Critical)**: ${flags?.engagementChange ? `Determine if the scene has escalated to active combat.
       - set "activeEngagement" to true only if:
         a) Hostiles have explicitly attacked the player.
         b) The player has explicitly attacked a target.
         c) Stealth was broken and hostiles are now charging/engaging.
       - set "activeEngagement" to false if:
         a) Enemies are present but unaware of the player.
         b) Enemies are present but only talking/threatening without attacking.
         c) Hostiles were defeated or have fled this turn.
         d) A theft or pickpocket attempt was explicitly narrated as an "unnoticed failure", "close call", or a "narrow miss" where the npc remains unaware of the player's attempt.` : "SKIP: No combat or engagement changes occurred."}

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
            model: AI_MODELS.DEFAULT,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC }, 
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

/**
 * THE RELEVANCE GATE (Step 0)
 * High-speed classification to determine if Phase 4 extraction is even needed.
 * Optimized for speed and low token usage using gemini-flash-lite.
 */
export const detectExtractionScope = async (
    userAction: string,
    aiNarrative: string
): Promise<ExtractionScope> => {
    const prompt = `
    Analyze the dialogue and narration to determine if any game state updates are required.
    
    [USER]: "${userAction}"
    [NARRATIVE]: "${aiNarrative}"

    [CLASSIFICATION RULES]
    - spatialChange: Player moved to a new building, room, or zone.
    - socialChange: New NPCs appeared, or existing NPCs died/changed status.
    - itemChange: Items were picked up, looted, lost, or consumed.
    - alignmentChange: Actions with moral weight (Good/Evil/Law/Chaos).
    - engagementChange: Combat started, ended, or aggressive intent was resolved.
    - timeChange: Significant time passed (minutes/hours).

    Return JSON: { "spatialChange": bool, "socialChange": bool, "itemChange": bool, "alignmentChange": bool, "engagementChange": bool, "timeChange": bool }
    `;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: AI_MODELS.DEFAULT,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC }
            }
        });

        const flags = JSON.parse(cleanJson(response.text || "{}"));
        const required = Object.values(flags).some(v => v === true);

        return {
            required,
            flags: {
                spatialChange: !!flags.spatialChange,
                socialChange: !!flags.socialChange,
                itemChange: !!flags.itemChange,
                alignmentChange: !!flags.alignmentChange,
                engagementChange: !!flags.engagementChange,
                timeChange: !!flags.timeChange
            }
        };
    } catch (e) {
        // Fallback: Default to true on error to ensure consistency
        return {
            required: true,
            flags: {
                spatialChange: true, socialChange: true, itemChange: true,
                alignmentChange: true, engagementChange: true, timeChange: true
            }
        };
    }
};

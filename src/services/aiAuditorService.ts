
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
    inventoryUpdates?: any[];
    isAboard?: boolean;
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
        .map(l => `${l.title} (Naming Style: ${l.languageConfig || 'English'})`);
    
    const raceListStr = availableRaces.length > 0 
        ? availableRaces.join(', ') 
        : 'Human, Elf, Dwarf, Orc';

    const prompt = `
    You are the "System Auditor". Your job is to reconcile the narrative with the game's physical and social state.
    
    [Context]
    Player Name: "${gameData.playerCharacter.name}" (Address as 'You')
    Current World Time: "${gameData.currentTime}"
    Current Zone Name: "${currentZoneName}"
    Current Zone Coords: "${gameData.playerCoordinates}"
    Current Site: "${gameData.current_site_name || 'Open Area'}"
    User Action: "${userAction}"
    Gm Narrative: "${narrativeResult}"
    Party Stealth Status: ${isHidden ? "Hidden (Enemies are unaware)" : "Visible (Enemies can see you)"}

    [MANDATORY SYSTEM TRUTH]
    You are NOT allowed to change the player's physical location (POI or Site Name). The spatial state is fixed and managed by the host system. Your role is restricted to extracting social, inventory, and engagement updates from the narrative.

    [MANDATORY NAME EXCLUSION LIST]
    ${excludeList.join(', ')} (DO NOT create new characters with these names)

    [Valid Ancestries]
    The only established races in this world are: ${raceListStr}.

    [Valid Genders]
    Male, Female, Non-binary, Unspecified.

    [Instructions]
    1. **Social Reconciliation**: ${flags?.socialChange ? `
       - Identify deaths: if an npc is killed in the narrative, set "status": "Dead".` : "SKIP: No social or status changes occurred."}

    2. **Npc Discovery**: ${flags?.socialChange ? `Identify new characters introduced. 
       - **Strict Ancestry Rule**: You must select the "race" field from the [Valid Ancestries] list.
       - **Essential Status Rule**: Set "is_essential" as true for unique named characters.
       - **Presence Rule**: Identify if the NPC is interacting Remotely (telepathy, intercom, vision, ghost) or is Physically present. Set "presenceMode" to 'Remote' or 'Physical' (default).
       - **NAME PROTECTION**: You MUST NOT extract any character whose name matches a name in the [MANDATORY NAME EXCLUSION LIST]. If a character in the narrative has one of these names, it is the player or an existing companion—ignore them for discovery.` : "SKIP: No new characters were introduced."}

    3. **Engagement Check (Critical)**: ${flags?.engagementChange ? `Determine if the scene has escalated to active combat.
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
      "timePassedMinutes": number,
      "newNPCs": [ { "name": "...", "description", "race", "gender", "is_essential", "presenceMode": "Physical | Remote" } ],
      "npcUpdates": [ { "id", "status", "presenceMode": "Physical | Remote" } ],
      "inventoryUpdates": [ 
        { 
          "ownerId": "player | CompanionID", 
          "list": "carried | equipped | storage | assets", 
          "action": "add | remove", 
          "items": [ { "name": "string", "quantity": number, "description": "string", "tags": ["string"], "rarity": "Common | Uncommon | Rare | etc" } ] 
        } 
      ],
      "activeEngagement": boolean,
      "timePassedMinutes": number,
      "isAboard": boolean,
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
        
        // --- SYSTEM-MANAGED VALIDATION (Code-side filtering) ---
        const normalizedExclusions = new Set(excludeList.map(name => name.toLowerCase().trim()));
        const filteredNewNPCs = (result.newNPCs || []).filter((newNpc: any) => {
            if (!newNpc.name) return false;
            const npcNameLower = newNpc.name.toLowerCase().trim();
            // Reject if name exactly matches or is a protected substring (to handle 'Nik' vs 'Nikolas')
            return !normalizedExclusions.has(npcNameLower);
        });

        return {
            currentLocale: gameData.currentLocale || '',
            timePassedMinutes: Number(result.timePassedMinutes) || 0,
            newNPCs: filteredNewNPCs,
            npcUpdates: result.npcUpdates || [],
            activeEngagement: !!result.activeEngagement,
            missedRollRequests: result.missedRolls || [],
            turnSummary: result.turnSummary || "",
            inventoryUpdates: result.inventoryUpdates || [],
            isAboard: result.isAboard
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
    - socialChange: New NPCs appeared, or existing NPCs died/changed status.
    - itemChange: Items were picked up, looted, lost, or consumed.
    - alignmentChange: Actions with moral weight (Good/Evil/Law/Chaos).
    - engagementChange: Combat started, ended, or aggressive intent was resolved.
    - timeChange: Significant time passed (minutes/hours).

    Return JSON: { "socialChange": bool, "itemChange": bool, "alignmentChange": bool, "engagementChange": bool, "timeChange": bool }
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
                spatialChange: false, // Permanently disabled for Auditor
                socialChange: !!flags.socialChange,
                itemChange: !!flags.itemChange,
                alignmentChange: !!flags.alignmentChange,
                engagementChange: !!flags.engagementChange,
                timeChange: !!flags.timeChange
            }
        };
    } catch (e) {
        // Fallback: Default to true on error to ensure consistency (except spatial)
        return {
            required: true,
            flags: {
                spatialChange: false, 
                socialChange: true, 
                itemChange: true,
                alignmentChange: true, 
                engagementChange: true, 
                timeChange: true
            }
        };
    }
};

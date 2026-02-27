
// services/aiSkillAssessorService.ts

import { getAi, cleanJson } from './aiClient';
import { ThinkingLevel } from '@google/genai';
import { DiceRollRequest } from '../types';
import { ContextKey } from './aiContextService';

export interface AssessmentResult {
    intentType: 'combat' | 'skill' | 'travel' | 'narrative';
    requests: DiceRollRequest[];
    travelData?: {
        destination: string;
        method: string;
    };
    requiredKeys: ContextKey[];
}

/**
 * THE MECHANICAL INTENT ASSESSOR
 * High-speed agent used to classify intent before the Narrator begins.
 * Upgraded to Gemini 3 Flash for improved reasoning on action preparation.
 */
export const assessSkillIntent = async (
    userAction: string,
    skillsContext: string,
    partyNames: string[],
    isCombatActive: boolean,
    lastAiMessage: string
): Promise<AssessmentResult> => {
    const prompt = `
    Analyze the User's action and classify their intent and data requirements.

    [USER ACTION]: "${userAction}"
    [ACTIVE PARTY]: ${partyNames.join(', ')}
    [COMBAT ACTIVE]: ${isCombatActive}
    [LAST AI MSG]: "${lastAiMessage.slice(0, 100)}..."
    
    ${skillsContext}

    [INTENT CLASSIFICATION RULES]
    1. "combat": User is initiating physical violence NOW. 
       - MUST contain aggressive verbs: attack, shoot, stab, charge, smash, blast.
       - DO NOT flag as "combat" if user is just DRAWING a weapon or PREPARING.
    2. "skill": User is attempting a risky or challenging non-combat action (climbing, lying, searching).
    3. "travel": User is expressing intent to move to a new location.
    4. "narrative": User is talking, observing, or preparing. No immediate mechanics needed.

    [DATA MODULE MENU]
    - "core_stats": HP, AC, Stats, Abilities, Skills. Needed for checks/saves.
    - "inventory": Items. Needed for combat, trading, using items.
    - "combat_state": Enemies, Allies, Turn Order. CRITICAL if in combat.
    - "location_details": Zone Description, Weather, POIs. Needed for movement/exploration.
    - "active_quests": Current Objectives. Needed for plot progression.
    - "recent_history": Last 10 messages. Needed for conversation continuity.
    - "world_lore": Historical facts, faction details. Needed for specific lore questions.
    - "social_registry": Known NPCs, relationships. Needed for social interactions.

    [OUTPUT JSON SCHEMA]
    { 
      "intentType": "combat" | "skill" | "travel" | "narrative",
      "requests": [
        { "rollerName": "Player", "rollType": "Skill Check", "checkName": "SkillName", "dc": number }
      ],
      "travelData": { "destination": "string", "method": "string" },
      "requiredKeys": ["core_stats", "recent_history", "active_quests", "social_registry", ...]
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
        
        const defaults: ContextKey[] = ['core_stats', 'recent_history', 'active_quests', 'social_registry'];
        if (isCombatActive) defaults.push('combat_state', 'inventory');

        const finalKeys = Array.isArray(result.requiredKeys) 
            ? Array.from(new Set([...defaults, ...result.requiredKeys])) as ContextKey[]
            : defaults;

        return {
            intentType: result.intentType || 'narrative',
            requests: Array.isArray(result.requests) ? result.requests : [],
            travelData: result.travelData,
            requiredKeys: finalKeys
        };
    } catch (e) {
        console.error("Skill Assessor failed:", e);
        return { 
            intentType: 'narrative', 
            requests: [], 
            requiredKeys: ['core_stats', 'recent_history', 'active_quests', 'social_registry'] 
        };
    }
};

/**
 * THE COMBAT RELEVANCE VERIFIER
 * Determines if a failed skill check should realistically lead to an ambush or fight.
 */
export const verifyCombatRelevance = async (
    failedSkill: string,
    currentLocale: string,
    sceneContext: string,
    worldSummary: string
): Promise<{ shouldTriggerCombat: boolean; reason: string }> => {
    const prompt = `
    You are the "Scene Realism Auditor". A player has FAILED a skill check. 
    Determine if this failure realistically leads to IMMEDIATE COMBAT/AMBUSH based on the current environment.

    [FAILED SKILL]: "${failedSkill}"
    [CURRENT LOCALE]: "${currentLocale}"
    [SCENE CONTEXT]: "${sceneContext}"
    [WORLD LORE]: "${worldSummary}"

    [LOGIC RULES]
    1. YES (Combat): If the skill was "Stealth" near hostiles, "Deception" during a high-stakes interrogation, or "Athletics" to hold a door against a horde.
    2. NO (Non-Combat): If the skill was "History" (you just don't know the fact), "Medicine" (you fail to treat a wound), or "Persuasion" with a friendly merchant (they just refuse to lower the price).
    3. NO (Non-Combat): If the failure leads to a different narrative setback like getting lost, losing time, or damaging an item.

    [OUTPUT JSON SCHEMA]
    { "shouldTriggerCombat": boolean, "reason": "1-sentence explanation" }
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
            shouldTriggerCombat: !!result.shouldTriggerCombat,
            reason: result.reason || "Determined by scene logic."
        };
    } catch (e) {
        return { shouldTriggerCombat: false, reason: "Default to peaceful setback on error." };
    }
};

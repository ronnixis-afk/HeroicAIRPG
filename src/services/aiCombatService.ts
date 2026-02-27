
// services/aiCombatService.ts

import { getAi, cleanJson } from './aiClient';
import { ActorSuggestion, GameData, ChatMessage, AffinityDefinition, CombatActor, Item, ActorAlignment } from '../types';
import { LootDropPlan } from '../utils/lootMechanics';

// Helper to strip markdown code blocks and extract JSON object
const extractJson = (text: string): string => {
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = clean.indexOf('[');
    const lastBrace = clean.lastIndexOf(']');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
    }
    return clean;
};

/**
 * DETERMINES COMBAT STANCE (The Extra Step)
 * Analyzes the scene to decide if bystanders or neutral NPCs engage or flee.
 */
export const resolveCombatAlignments = async (
    narrativeContext: string,
    candidates: { id: string, name: string, relationship: number }[],
    gameData: GameData
): Promise<Record<string, ActorAlignment>> => {
    if (candidates.length === 0) return {};

    const prompt = `
    You are the "Combat Stance Arbitrator". Determine the involvement of nearby characters in the upcoming battle.

    [SCENE CONTEXT]
    "${narrativeContext}"

    [CANDIDATE CHARACTERS]
    ${JSON.stringify(candidates)}

    [ALIGNMENT RULES]
    1. 'enemy': Actively participating in the attack against the player.
    2. 'ally': Actively defending the player or party.
    3. 'neutral': Fleeing, hiding, or remaining a non-combatant bystander. 

    [LOGIC]
    - NPCs with very high positive relationships (>30) should likely be 'ally'.
    - NPCs with very low negative relationships (<-30) should likely be 'enemy'.
    - For everyone else, use the [SCENE CONTEXT]. If the narrative implies a general riot, everyone is an 'enemy'. If it implies a surgical strike, bystanders are 'neutral'.

    Return JSON mapping ID to alignment:
    { "npc-id": "enemy|neutral|ally" }
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
        return JSON.parse(cleanJson(response.text || '{}'));
    } catch (e) {
        console.error("Alignment resolution failed", e);
        return {};
    }
};

export const generateCombatEncounterSuggestions = async (
    narrativeContext: string,
    partyLevel: number,
    hasShip: boolean,
    existingActors: any[],
    gameData: GameData,
    enemySlots?: { difficulty: string }[],
    excludeList: string[] = [] 
): Promise<ActorSuggestion[]> => {
    
    const slotsInstruction = enemySlots 
        ? `**SYSTEM OVERRIDE - MANDATORY ENEMY SPECS**:
           You MUST generate EXACTLY ${enemySlots.length} enemies matching these slots sequentially:
           ${enemySlots.map((s, i) => `${i+1}. Difficulty Preset: ${s.difficulty}`).join('\n')}`
        : 'Generate a reasonable number of enemies for a balanced fight.';

    const shipMandate = hasShip 
        ? `\n**MANDATORY SHIP RULE**: The player party currently utilizes a VEHICLE/SHIP. You MUST set 'isShip': true for at least ONE of the generated enemies (usually the highest difficulty one) to provide a fair engagement scale.`
        : '';

    const prompt = `Generate a balanced combat encounter based on the narrative context.
    
    [WORLD SUMMARY]
    ${gameData.worldSummary || 'No global summary available.'}

    Context: "${narrativeContext}"
    PartyLevel: ${partyLevel}
    Has Ship: ${hasShip}
    Existing Allies in Scene: ${JSON.stringify(existingActors)}
    
    ${slotsInstruction}${shipMandate}
    
    **NAME PROTECTION RULE (CRITICAL)**:
    - YOU ARE STRICTLY FORBIDDEN FROM USING ANY OF THE FOLLOWING NAMES: 
      [${excludeList.join(', ')}]

    **MANDATORY SELECTIONS**:
    1. **Template**: Choose one of: Agile, Brute, Tank, Brawler, Sniper, Grenadier, Caster, Healer, Controller, Skirmisher.
    2. **Difficulty**: Select one: Weak, Normal, Elite, Boss.
    3. **Alignment**: DEFAULT TO 'enemy' unless the narrative context clearly identifies them as allies.

    Return JSON array of objects:
    {
        "name": "UNIQUE NAME",
        "template": "...",
        "size": "...",
        "difficulty": "...",
        "alignment": "enemy",
        "isShip": boolean,
        "affinity": "...",
        "archetype": "...",
        "description": "..."
    }`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(response.text || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("Combat generation error", e);
        return [];
    }
};

/**
 * Enriches generic combatant details with names and affinities fitting the scene.
 */
export const enrichCombatantDetails = async (
    enemies: { name: string, description?: string }[],
    context: ChatMessage[],
    availableAffinities: Record<string, AffinityDefinition>,
    worldSummary: string = ''
): Promise<Record<string, { name: string, affinity: string, description: string, alignment: string }>> => {
    const enemyList = enemies.map((e, i) => `${i}: "${e.name}"`).join('\n');
    
    const prompt = `Review the recent chat context and world lore to provide unique, evocative, and setting-appropriate names for these ${enemies.length} combatants.
    
    [WORLD LORE]
    ${worldSummary}
    
    [COMBATANTS TO NAME]
    ${enemyList}
    
    [SCENE CONTEXT (Last 3 Turns)]
    ${JSON.stringify(context.slice(-3))}
    
    [AVAILABLE AFFINITIES]
    ${Object.keys(availableAffinities).join(', ')}
    
    **MANDATORY ENRICHMENT RULES**:
    1. **ALIGNMENT**: DEFAULT TO 'enemy' unless the narrative context clearly identifies them as allies.
    
    Return JSON mapping the INDEX to the new data: 
    { 
      "0": { "name": "Unique Name", "affinity": "AffinityName", "description": "Short description", "alignment": "enemy" }
    }`;

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
        return JSON.parse(cleanJson(response.text || '{}'));
    } catch (e) {
        console.error("Enrichment failed", e);
        return {};
    }
};

/**
 * Generates an immersive "Combat Start" narrative for manual triggers.
 */
export const generateCombatStartNarrative = async (
    enemyNames: string[],
    context: ChatMessage[],
    worldSummary: string
): Promise<{ narrative: string }> => {
    const prompt = `The player has manually started combat in a TTRPG. 
    Write a brief, immersive transition narrative (max 60 words) describing the enemies initiating hostilities or the moment of engagement.
    
    [WORLD SUMMARY]
    ${worldSummary}

    [ENEMIES PRESENT]
    ${enemyNames.join(', ')}

    [RECENT CHAT CONTEXT]
    ${JSON.stringify(context.slice(-3))}

    **STRICT RULE**: Return ONLY plain text. NO bolding (**), NO italics (*).

    Return JSON: { "narrative": "string" }`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJson(response.text || '{}'));
    } catch (e) {
        return { narrative: "Engagement begins. Draw your weapons!" };
    }
};

export const generateCombatConclusion = async (names: string[], loot: any[], context: string, location: string, gameData: GameData) => {
    const input = `Describe the end of combat in PLAIN TEXT. NO Markdown formatting allowed.
    
    [WORLD SUMMARY]
    ${gameData.worldSummary || 'No global summary available.'}

    Defeated: ${names.join(', ')}
    Loot: ${JSON.stringify(loot)}
    Context: ${context}
    
    Return JSON: { 
      "narrative": "string (plain text prose)", 
      "location": "string", 
      "turnSummary": "string (STRICT MAX 10 WORDS concise but detailed memory for the log)" 
    }`;
    
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
};

/**
 * System-Guided Loot Generation.
 * AI skins the system-generated mechanical blueprints.
 */
export const generateLoot = async (enemies: CombatActor[], gameData: GameData, lootPlan: LootDropPlan) => {
    const slotsInfo = lootPlan.slots.map((s, i) => {
        const bp = s.blueprint;
        const mods = bp.details || 'None';
        return `Slot ${i+1}: 
        - Mechanical Blueprint: ${mods}
        - Rarity: ${s.rarity}
        - Dropped By: ${s.enemySource}
        - Base Chassis: ${bp.name}`;
    }).join('\n\n');

    const currencyInfo = lootPlan.totalCurrency > 0 ? `- ${lootPlan.totalCurrency} ${lootPlan.currencyName}` : '';

    const input = `Generate flavorful skins for the following loot blueprints found after combat.
    
    [WORLD CONTEXT]
    Setting Summary: ${gameData.worldSummary || 'Standard RPG Setting'}
    Defeated Foes: ${enemies.map(e => e.name).join(', ')}

    [SYSTEM BLUEPRINTS]
    ${slotsInfo}
    ${currencyInfo}

    [INSTRUCTIONS]
    1. For each Slot, create a **Name** and a **Flavor Description** (MAX 20 WORDS) that fits the 'Dropped By' enemy and the 'Mechanical Blueprint' provided.
    2. **DO NOT CHANGE THE MECHANICS**. The Blueprint is absolute truth.
    3. If a blueprint mentions "Weapon", "Armor", etc., your flavor text must reflect that item type.
    4. If there is currency, add ONE item entry named "${lootPlan.currencyName}" with quantity ${lootPlan.totalCurrency} and tag "currency".
    
    Return JSON array: [{ name, description, rarity, tags, price, quantity, weaponStats, armorStats, buffs, effect, usage }]
    **IMPORTANT**: You MUST include ALL mechanical fields provided in the blueprint (weaponStats, buffs, etc.) in your JSON for each item.`;
    
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: input,
            config: { responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(extractJson(response.text || '[]'));
        
        if (Array.isArray(parsed)) {
            return parsed.map((aiItem, index) => {
                if (aiItem.tags?.includes('currency')) return aiItem;
                const blueprint = lootPlan.slots[index]?.blueprint;
                if (!blueprint) return aiItem;

                return {
                    ...blueprint, 
                    name: aiItem.name || blueprint.name,
                    description: aiItem.description || blueprint.description,
                    isNew: true
                };
            });
        }
        return [];
    } catch (e) {
        console.error("AI Loot Generation failed", e);
        const fallback: any[] = lootPlan.slots.map(s => ({
            ...s.blueprint,
            name: `${s.rarity} ${s.blueprint.name}`,
            isNew: true
        }));
        if (lootPlan.totalCurrency > 0) {
            fallback.push({ name: lootPlan.currencyName, quantity: lootPlan.totalCurrency, tags: ['currency'], description: 'Looted funds.', rarity: 'Common', isNew: true });
        }
        return fallback;
    }
};

/**
 * RE-ASSESSES COMBAT ENEMIES (The Safety Net)
 * Called when combat starts but no enemies are loaded.
 * Analyzes the last 3 messages to identify who the party is actually fighting.
 */
export const reassessCombatEnemies = async (
    gameData: GameData,
    context: ChatMessage[]
): Promise<ActorSuggestion[]> => {
    const prompt = `
    The game has entered COMBAT mode, but no enemies were loaded into the initiative tracker.
    Your job is to analyze the recent narrative and identify who the player is fighting.

    [WORLD SUMMARY]
    ${gameData.worldSummary || 'No global summary available.'}

    [RECENT CHAT CONTEXT (Last 3 Messages)]
    ${JSON.stringify(context.slice(-3))}

    [INSTRUCTIONS]
    1. Identify the primary antagonists or hostiles mentioned in the recent narrative.
    2. If specific named NPCs are mentioned, use their names.
    3. If generic groups are mentioned (e.g., "three guards", "a swarm of rats"), create appropriate entries.
    4. For each hostile, assign a Template (Agile, Brute, Tank, Brawler, Sniper, Grenadier, Caster, Healer, Controller, Skirmisher) and Difficulty (Weak, Normal, Elite, Boss).
    5. If the narrative implies a ship-to-ship battle, set 'isShip': true for the vessels.

    Return JSON array of ActorSuggestion objects:
    [
      {
        "name": "Unique Name",
        "template": "...",
        "difficulty": "...",
        "alignment": "enemy",
        "isShip": boolean,
        "description": "Brief description of their appearance/role"
      }
    ]
    
    If NO enemies can be identified from the context, return an empty array [].
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
        const parsed = JSON.parse(cleanJson(response.text || '[]'));
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("Combat re-assessment failed", e);
        return [];
    }
};

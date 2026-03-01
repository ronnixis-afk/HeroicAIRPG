
import { getAi, cleanJson } from './aiClient';
import { NPC, GameData } from '../types';

/**
 * Extracts full NPC profiles from narrative text.
 * Ensures every field is filled with concise but evocative detail.
 * Now handles generic units and group expansion (e.g. "two guards" -> Guard 1, Guard 2).
 */
export const extractNPCsFromNarrative = async (
    narrative: string,
    worldSummary: string,
    existingNpcNames: string[],
    currentLocation: string,
    currentLocale: string,
    availableRaces: string[]
): Promise<Partial<NPC>[]> => {

    if (!narrative || narrative.length < 30) return [];

    const raceListStr = availableRaces.length > 0
        ? availableRaces.join(', ')
        : 'Human, Elf, Dwarf, Orc';

    const prompt = `
    Analyze the following TTRPG narrative. 
    Identify any NEW characters introduced or mentioned in this specific scene.
    This includes both Named NPCs (e.g. "Tom") and Generic Units (e.g. "Guards", "Mercenaries", "Thugs").

    [NARRATIVE]
    "${narrative}"

    [WORLD CONTEXT]
    ${worldSummary}
    Current Location: ${currentLocation}
    Current Locale: ${currentLocale}

    [VALID ANCESTRIES]
    The only established races are: ${raceListStr}.

    [VALID GENDERS]
    Male, Female, Non-binary, Unspecified.

    [MANDATORY NAME EXCLUSION LIST]
    ${existingNpcNames.join(', ')}

    [INSTRUCTIONS]
    1. DO NOT extract or generate profiles for any names present in the EXCLUSION LIST.
    2. **STRICT ANCESTRY RULE**: You MUST select the "race" field from the [VALID ANCESTRIES] list. Use "Unknown" if unclear.
    3. **STRICT GENDER RULE**: You MUST select from the [VALID GENDERS] list.
    4. **LIFE STATUS RULE**: Determine if the character is "Alive", "Dead", or "Unknown" based on the narrative. If the user stumbles upon a corpse or witnesses a death, set "status": "Dead".
    5. **UNIT EXPANSION RULE**: If the narrative mentions a specific number of generic units (e.g. "two guards", "three thugs"), expand them into INDIVIDUAL objects with numbered names (e.g. "Guard 1").
    6. **ESSENTIAL STATUS RULE**: Determine if the NPC is "is_essential" (boolean). 
       - SET TRUE for unique named characters important to the plot, quest givers, or significant individuals.
       - SET FALSE for generic numbered units, bystanders, or minor background characters.
    7. Return a JSON array of objects. EVERY field must be filled.

    [MANDATORY JSON STRUCTURE]
    [
      {
        "name": "Full Name or Unit Name (e.g. Guard 1)",
        "description": "Max 30 words summary of role.",
        "appearance": "Max 30 words physical description.",
        "race": "STRICT MATCH FROM VALID ANCESTRIES",
        "gender": "STRICT MATCH FROM VALID GENDERS",
        "relationship": number (-10 to 10 for new acquaintances),
        "moralAlignment": { "lawChaos": number (-100 to 100), "goodEvil": number (-100 to 100) },
        "location": "${currentLocation}",
        "currentPOI": "Unknown | ${currentLocale}",
        "status": "Alive | Dead | Unknown",
        "is_essential": boolean,
        "size": "Small|Medium|Large|Huge|Gargantuan|Colossal",
        "template": "Agile|Brute|Tank|Brawler|Sniper|Grenadier|Caster|Healer|Controller|Skirmisher",
        "difficulty": "Weak|Normal|Elite|Boss",
        "affinity": "Thermal|Cryo|Voltaic|Reinforced|Phased|Caustic|Luminous|Entropic|Neural|Kinetic|None",
        "archetype": "Bipedal|Bestial|Aerial|Marine|Amphibian|Crawler|Hoverer|Sentry"
      }
    ]

    Return [] if no NEW characters are introduced.
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

        const cleaned = cleanJson(response.text || "[]");
        const result = JSON.parse(cleaned);

        if (Array.isArray(result)) {
            return result.filter(npc =>
                npc.name &&
                typeof npc.name === 'string' &&
                npc.name.trim().length > 0
            );
        }
        return [];
    } catch (e) {
        console.error("NPC Extraction Error:", e);
        return [];
    }
};

/**
 * Refines a specific NPC by filling in missing data points based on current context.
 */
export const refineNPCDetails = async (
    npc: NPC,
    gameData: GameData,
    availableRaces: string[]
): Promise<Partial<NPC>> => {
    const recentHistory = gameData.messages.slice(-3).map(m => `${m.sender}: ${m.content}`).join('\n');
    const worldSummary = gameData.worldSummary || "A mysterious realm.";
    const raceListStr = availableRaces.length > 0 ? availableRaces.join(', ') : 'Human, Elf, Dwarf, Orc';

    const prompt = `
    FAST NPC REFINEMENT: You are the Game Master. Complete the profile for "${npc.name}".
    
    [WORLD CONTEXT]
    ${worldSummary}

    [RECENT STORY]
    ${recentHistory}

    [VALID ANCESTRIES]
    ${raceListStr}

    [VALID GENDERS]
    Male, Female, Non-binary, Unspecified.

    [INSTRUCTIONS]
    Fill in every single field in the following JSON schema. 
    1. **STRICT ANCESTRY RULE**: The "race" field MUST be a value from [VALID ANCESTRIES]. If the character's race is not listed or is a special case, use "Unknown".
    2. **STRICT GENDER RULE**: The "gender" field MUST be from [VALID GENDERS].
    3. **LIFE STATUS**: Determine if they are currently "Alive", "Dead", or "Unknown" based on recent history.
    4. description/appearance: MUST be under 30 words.
    5. **is_essential**: Decide if this character is essential to the narrative (named plot-relevant hero/villain/contact) or non-essential (generic background unit).
    
    [MANDATORY ACTOR/COMBAT SPECS]
    Choose values that fit their narrative role.

    Return ONLY this JSON object:
    {
      "name": "${npc.name}",
      "description": "...",
      "appearance": "...",
      "race": "STRICT MATCH FROM VALID ANCESTRIES",
      "gender": "STRICT MATCH FROM VALID GENDERS",
      "status": "Alive | Dead | Unknown",
      "is_essential": boolean,
      "moralAlignment": { "lawChaos": -100, "goodEvil": 100 },
      "size": "Small|Medium|Large|Huge|Gargantuan|Colossal",
      "template": "Agile|Brute|Tank|Brawler|Sniper|Grenadier|Caster|Healer|Controller|Skirmisher",
      "difficulty": "Weak|Normal|Elite|Boss",
      "affinity": "Thermal|Cryo|Voltaic|Reinforced|Phased|Caustic|Luminous|Entropic|Neural|Kinetic|None",
      "archetype": "Bipedal|Bestial|Aerial|Marine|Amphibian|Crawler|Hoverer|Sentry"
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

        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        console.error("NPC Refinement Error:", e);
        return {};
    }
};

export const analyzeRelationshipUpdates = async (
    playerAction: string,
    narrative: string,
    npcs: NPC[]
): Promise<{ npcId: string, change: number, reason: string }[]> => {

    if (!npcs || npcs.length === 0) return [];
    if (!playerAction || !narrative) return [];

    const npcContext = npcs.map(n => ({
        id: n.id,
        name: n.name,
        moralAlignment: n.moralAlignment,
        status: n.status
    }));

    const prompt = `
    Analyze how NPCs react to the Player's Action.
    NOTE: Characters marked as "Dead" in the context cannot react.

    [PLAYER ACTION]
    "${playerAction}"

    [NARRATIVE OUTCOME]
    "${narrative}"

    [KNOWN NPCs]
    ${JSON.stringify(npcContext)}

    Return JSON array of changes (-10 to +10):
    [
        { "npcId": "string", "change": number, "reason": "string" }
    ]
    `;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        const result = JSON.parse(cleanJson(response.text || "[]"));

        if (Array.isArray(result)) {
            return result.filter(r => r.change !== 0 && typeof r.change === 'number');
        }
        return [];
    } catch (e) {
        console.error("Relationship Analysis Error:", e);
        return [];
    }
};

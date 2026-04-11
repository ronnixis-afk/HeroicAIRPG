// services/aiCharacterService.ts

import { getAi, cleanJson } from './aiClient';
import { AI_MODELS, THINKING_BUDGETS } from '../config/aiConfig';
import { GameData, PlayerCharacter, Companion, Ability, SKILL_NAMES, SKILL_DEFINITIONS, AbilityScoreName, LoreEntry } from '../types';
import { STORY_HOOKS } from '../constants/storyHooks';
import { POI_MATRIX } from '../constants';
import { getPOITheme } from '../utils/mapUtils';
import { ALIGNMENT_SYSTEM_PROMPT, GOOD_EVIL_ALIASES, LAW_CHAOS_ALIASES } from '../utils/npcUtils';


/**
 * Common helper to format world context for AI prompts.
 */
const getWorldContext = (gameData: GameData) => {
    const summary = gameData.worldSummary || "A mysterious world.";
    const setting = gameData.skillConfiguration || 'Fantasy';
    
    // IDENTITY PROTECTION: Filter out session-specific memories or chronicle logs from historical context.
    // This prevents the AI from picking up names of characters from previous sessions or current world events.
    const loreFilter = (l: LoreEntry) => {
        const forbiddenTags = ['chronicle', 'memory', 'npc', 'event', 'personal'];
        return !l.tags?.some((tag: string) => forbiddenTags.includes(tag.toLowerCase()));
    };

    const generalLore = (gameData.world || []).filter(loreFilter);
    const history = generalLore.slice(0, 10).map(l => `[${l.title}]: ${l.content}`).join('\n');
    const factions = (gameData.world || []).filter(l => l.tags?.includes('faction')).map(f => `- ${f.title}: ${f.content}`).join('\n');
    const races = (gameData.world || []).filter(l => l.tags?.includes('race')).map(r => `- ${r.title} (Naming Style: ${r.languageConfig || 'English'})`).join('\n');
    
    const mapConfig = gameData.mapSettings ? `[Map Scale]: Each ${gameData.mapSettings.zoneLabel} on the grid represents ${gameData.mapSettings.gridDistance} ${gameData.mapSettings.gridUnit}.` : "";
    const tone = `[Narration Tone]: ${gameData.narrationTone || 'Standard'}. ${gameData.isMature ? '(Mature Content Allowed)' : ''}`;
    const alignment = ALIGNMENT_SYSTEM_PROMPT;
    return `[Game Setting]\n${setting}\n\n[World Summary]\n${summary}\n\n[World History]\n${history}\n\n[Major Factions]\n${factions}\n\n[Established Races & Naming Styles]\n${races}\n\n[World Map]\n${mapConfig}\n\n[Tone]\n${tone}\n\n${alignment}`;
};


/**
 * Maps a user's natural language prompt and recent chat history to specific library traits and metadata.
 */
export const draftCompanionFromPrompt = async (
    gameData: GameData,
    userPrompt: string,
    availableTraits: { name: string, category: string, description: string }[]
): Promise<{
    name: string,
    gender: string,
    race: string,
    backgroundTraitNames: string[],
    generalTraitNames: string[],
    powerBlueprintName: string,
    level: number,
    personality: string,
    moralAlignment: { lawChaos: number, goodEvil: number }
}> => {
    const worldContext = getWorldContext(gameData);

    const recentHistory = gameData.messages.slice(-5).map(m => `${m.sender.toUpperCase()}: ${m.content}`).join('\n');

    const traitList = availableTraits.map(t => `- [${t.category.toUpperCase()}]: ${t.name} (${t.description})`).join('\n');

    const prompt = `
    You are an RPG Character Architect. Based on a user's request and the recent chat history, draft a new companion.
    
    [WORLD CONTEXT]
    ${worldContext}

    [RECENT CHAT HISTORY]
    ${recentHistory}

    [USER REQUEST]
    "${userPrompt}"

    [AVAILABLE TRAITS LIBRARY]
    ${traitList}

    [INSTRUCTIONS]
    1. Identify if the user is referring to a specific character from the chat (e.g. "Add the goblin from earlier").
    2. Name: If a character was named in chat, use that name. Otherwise, invent a thematic one. You MUST generate a FULL NAME (First Name + Last Name/Family Name) for the companion.
    3. Race & Gender: Match the chat context or prompt. Default to "Human" and "Unspecified" if unclear. You MUST use the [Established Races & Naming Styles] provided in World Context. Every name generated MUST be consistent with the character's gender (Male/Female).
    4. Trait Selection: Choose EXACTLY 2 'BACKGROUND' traits, 2 'GENERAL' traits, and 1 'COMBAT' trait from the library that best fit the character's vibe.
    5. Level: Determine a fitting level. If not specified, default to 1. Max level 20.
    7. moralAlignment: Pick numerical values (-100 to 100) for goodEvil and lawChaos based on the [ALIGNMENT SCALES].
    8. Return ONLY the JSON object.

    [OUTPUT JSON SCHEMA]
    {
        "name": "string",
        "gender": "string",
        "race": "string",
        "backgroundTraitNames": ["Trait 1", "Trait 2"],
        "generalTraitNames": ["Trait 1", "Trait 2"],
        "powerBlueprintName": "Trait Name",
        "level": number,
        "personality": "string",
        "moralAlignment": { "goodEvil": number, "lawChaos": number }
    }
    `;


    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: AI_MODELS.DEFAULT,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC }, responseMimeType: "application/json" }
        });

        const data = JSON.parse(cleanJson(response.text || "{}"));
        return {
            name: data.name || "New Companion",
            gender: data.gender || "Unspecified",
            race: data.race || "Human",
            backgroundTraitNames: Array.isArray(data.backgroundTraitNames) ? data.backgroundTraitNames : [],
            generalTraitNames: Array.isArray(data.generalTraitNames) ? data.generalTraitNames : [],
            powerBlueprintName: data.powerBlueprintName || (availableTraits.length > 0 ? availableTraits[0].name : ""),
            level: Number(data.level) || 1,
            personality: data.personality || "A mysterious traveler.",
            moralAlignment: data.moralAlignment || { goodEvil: 0, lawChaos: 0 }
        };

    } catch (e) {
        console.error("Companion drafting failed", e);
        throw e;
    }
};

/**
 * Batch generates names and descriptions for companion recruits.
 * Optimized for Gemini 3 Flash Lite for maximum speed.
 */
export const generateRecruitSkins = async (
    gameData: GameData,
    seeds: { race: string, gender: string, traits: string[] }[]
): Promise<{ 
    name: string, 
    description: string, 
    personality: string, 
    moralAlignment: { goodEvil: number, lawChaos: number },
    abilityScores: Record<AbilityScoreName, { score: number }>,
    savingThrows: AbilityScoreName[]
}[]> => {
    const worldContext = getWorldContext(gameData);


    const prompt = `
    You are a Master Storyteller and Tavern Recruiter. Provide thematic names, short descriptions, and quirky personalities for 6 potential companions.
    
    [World Lore]
    ${worldContext}

    [Mechanical Seeds]
    ${seeds.map((s, i) => `Recruit ${i + 1}: Race: ${s.race}, Gender: ${s.gender}, Traits: ${s.traits.join(', ')}`).join('\n')}

    [Instructions]
    1. For each Recruit, generate a unique name appropriate for their Race, Gender, and the specific [Established Races & Naming Styles] provided in World Context.
    2. FULL NAME & GENDER RULE: Every name generated MUST be a "First Name" and a "Last Name or Family Name" (minimum 2 words). The name MUST be consistent with the recruit's gender (Male/Female).
    3. description: Write a short backstory summary (Max 25 words).
    4. personality: Create a short list of QUIRKY, memorable habits or traits (MAX 15 WORDS TOTAL). 
    5. Use Title Case for names and Sentence Case for descriptions.
    6. NO ALL CAPS allowed for any text.
    7. moralAlignment: For EACH recruit, pick appropriate numerical values for goodEvil and lawChaos from the [ALIGNMENT SCALES] (-100 to 100).
    8. abilityScores: Use a "Standard Array" logic (16, 14, 14, 12, 10, 8) distributed to fit the recruit's race and traits.
    9. savingThrows: Pick exactly 2 Saving Throw proficiencies from [strength, dexterity, constitution, intelligence, wisdom, charisma].
    10. Return exactly 6 results in a JSON array.

    [Mandatory Json Structure]
    [
      { 
        "name": "string", 
        "description": "string", 
        "personality": "string",
        "moralAlignment": { "goodEvil": number, "lawChaos": number },
        "abilityScores": {
          "strength": { "score": number }, "dexterity": { "score": number }, "constitution": { "score": number },
          "intelligence": { "score": number }, "wisdom": { "score": number }, "charisma": { "score": number }
        },
        "savingThrows": ["ability_name", "ability_name"]
      },
      ...
    ]
    `;


    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 512 }
            }
        });

        let results = JSON.parse(cleanJson(response.text || "[]"));

        // Handle Gemini wrapping array in an object
        if (!Array.isArray(results) && results.recruits && Array.isArray(results.recruits)) {
            results = results.recruits;
        }

        if (Array.isArray(results) && results.length > 0) {
            return results;
        }

        throw new Error("Invalid or empty AI response structure");
    } catch (e) {
        console.error("Recruit skinning failed", e);
        // Robust fallback: Return basic names derived from seeds with neutral stats
        return seeds.map(s => ({
            name: `${s.race} Adventurer`,
            description: "A mysterious traveler seeking purpose in the uncharted lands.",
            personality: "Quiet, observant, and reliable.",
            moralAlignment: { goodEvil: 0, lawChaos: 0 },
            abilityScores: {
                strength: { score: 12 }, dexterity: { score: 12 }, constitution: { score: 12 },
                intelligence: { score: 10 }, wisdom: { score: 10 }, charisma: { score: 10 }
            },
            savingThrows: ['constitution', 'wisdom'] as AbilityScoreName[]
        }));

    }
};

/**
 * Weaves a cohesive hero background and appearance based on wizard selections.
 * Generates full mechanical stats (Ability Scores, Skills, Saves) and skins the chosen power.
 */
export const weaveHero = async (
    gameData: GameData,
    selections: {
        name: string,
        gender: string,
        race: string,
        backgroundTraits: string[],
        generalTraits: string[],
        powerBlueprint: Ability,
        customBackground?: string,
        abilityScores?: any,
        savingThrows?: AbilityScoreName[],
        guaranteedSkills?: string[],
        racialTrait?: Ability
    },

    isCompanion: boolean = false
): Promise<{
    profession: string,
    appearance: string,
    background: string,
    personality: string,
    keywords: string[],
    abilityScores: any,
    savingThrows: any,
    skills: any,
    skinnedAbility: Ability,
    moralAlignment: { lawChaos: number, goodEvil: number }
}> => {
    const worldContext = getWorldContext(gameData);

    const config = gameData.skillConfiguration || 'Fantasy';

    // Performance Update: Always prioritize gemini-3.1-flash-lite for companion recruitment to ensure snappy UI.


    const availableSkillsList = SKILL_NAMES.filter(s => {
        const def = SKILL_DEFINITIONS[s];
        return def.usedIn === 'All' || def.usedIn.includes(config);
    });

    const contextTerm = isCompanion ? "companion" : "player character";
    const possessiveTerm = isCompanion ? "their" : "your";

    const prompt = `
    You are a Master Storyteller and RPG Architect. Weave a cohesive character profile for a new ${contextTerm}.
    
    [World Lore]
    ${worldContext}

    [User Selections]
    Name: ${selections.name}
    Gender: ${selections.gender}
    Race: ${selections.race}
    ${selections.racialTrait ? `Racial Trait: ${selections.racialTrait.name} (${selections.racialTrait.description})` : ''}
    Background Seeds: ${selections.backgroundTraits.join(', ')}
    General Qualities: ${selections.generalTraits.join(', ')}
    Chosen Power Blueprint: ${selections.powerBlueprint.name} - ${selections.powerBlueprint.description}
    ${selections.customBackground ? `Custom Background Context: "${selections.customBackground}"` : ''}

    [Instructions]
    1. Name Consistency: You MUST generate a FULL NAME (First Name + Last Name or Family Name/Surname) that reflects the character's race, gender, and the [Established Races & Naming Styles] provided in World Lore. If a partial name was provided (e.g. "${selections.name}"), expand it into a full name that matches their gender.
    2. profession: Deduce a fitting class or profession name (Title Case).
    2. appearance: Describe ${possessiveTerm} unique physical appearance. Max 40 words.
    3. background: Synthesize a cohesive history explaining ${possessiveTerm} traits and origins. 
       ${selections.customBackground ? 'IMPORTANT: Incorporate the provided Custom Background Context into this narrative.' : ''} 
       Max 100 words.
    4. personality: Provide a list of QUIRKY, memorable habits or traits (MAX 15 WORDS TOTAL). 
    5. keywords: Provide 4-6 thematic keywords.
    ${selections.abilityScores ? '6. abilityScores: [OMIT THIS FIELD]' : '6. abilityScores: Use a "Standard Array" logic (16, 14, 14, 12, 10, 8) distributed to fit the profession.'}

    ${selections.abilityScores ? '7. skills: [OMIT THIS FIELD]' : `7. skills: You MUST allocate proficiency to at least 4 skills.
       ${selections.guaranteedSkills && selections.guaranteedSkills.length > 0 ? `- IMPORTANT: These skills are provided by the character's traits and MUST be marked as proficient: [${selections.guaranteedSkills.join(', ')}].` : ''}
       - Any skills mentioned in the "Background Seeds", "General Qualities", or "Custom Background Context" MUST also be marked as proficient.
       - Skills MUST be chosen from this list ONLY: [${availableSkillsList.join(', ')}].`}
    8. savingThrows: ${selections.savingThrows ? `Use these EXACT saving throw proficiencies: ${selections.savingThrows.join(', ')}` : "Choose exactly 2 Saving Throw proficiencies."}

    9. skinnedAbility: Transform the Power Blueprint into a unique thematic signature power for ${selections.name}. 
       - Rename it evocatively.
       - Rewrite the description to match the flavor.
       - IMPORTANT MECHANICAL RULE: If the Chosen Power Blueprint already has a specific "damageType" (e.g. ${selections.powerBlueprint.effect?.damageType || 'not specified'}) or "status" (e.g. ${selections.powerBlueprint.effect?.status || 'not specified'}), you MUST PRESERVE these exact mechanical values in your output. Do NOT randomize or change them.
    10. moralAlignment: Pick numerical values (-100 to 100) for goodEvil and lawChaos from the [ALIGNMENT SCALES] that match this character's background and personality.
    11. NO ALL CAPS.

    [Mandatory Json Structure]
    {
        "profession": "string",
        "appearance": "string",
        "background": "string",
        "personality": "string",
        "keywords": ["string"],
${selections.abilityScores ? '' : `        "abilityScores": {
            "strength": { "score": number }, "dexterity": { "score": number }, "constitution": { "score": number },
            "intelligence": { "score": number }, "wisdom": { "score": number }, "charisma": { "score": number }
        },`}
        "savingThrows": {
            "strength": { "proficient": boolean }, "dexterity": { "proficient": boolean }, "constitution": { "proficient": boolean },
            "intelligence": { "proficient": boolean }, "wisdom": { "proficient": boolean }, "charisma": { "proficient": boolean }
        },
${selections.abilityScores ? '' : `        "skills": {
            ${availableSkillsList.map(s => `"${s}": { "proficient": boolean }`).join(',\n            ')}
        },`}
        "skinnedAbility": {
            "name": "string",
            "description": "string"
        },
        "moralAlignment": { "goodEvil": number, "lawChaos": number }
    }
    `;


    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: AI_MODELS.DEFAULT,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC }, responseMimeType: "application/json" }
        });

        const result = JSON.parse(cleanJson(response.text || "{}"));
        
        const convertSavesToMap = (saves: AbilityScoreName[]) => ({
            strength: { proficient: saves.includes('strength') },
            dexterity: { proficient: saves.includes('dexterity') },
            constitution: { proficient: saves.includes('constitution') },
            intelligence: { proficient: saves.includes('intelligence') },
            wisdom: { proficient: saves.includes('wisdom') },
            charisma: { proficient: saves.includes('charisma') }
        });

        return {
            profession: result.profession || "Adventurer",
            appearance: result.appearance || "A determined explorer.",
            background: result.background || "A traveler with a mysterious past.",
            personality: result.personality || "Quiet, determined.",
            keywords: Array.isArray(result.keywords) ? result.keywords : ["brave", "adventurer"],
            abilityScores: selections.abilityScores || result.abilityScores || { strength: { score: 10 }, dexterity: { score: 10 }, constitution: { score: 10 }, intelligence: { score: 10 }, wisdom: { score: 10 }, charisma: { score: 10 } },
            savingThrows: selections.savingThrows ? convertSavesToMap(selections.savingThrows) : (result.savingThrows || { strength: { proficient: false }, dexterity: { proficient: false }, constitution: { proficient: false }, intelligence: { proficient: false }, wisdom: { proficient: false }, charisma: { proficient: false } }),
            skills: result.skills || {},
            skinnedAbility: {
                ...selections.powerBlueprint,
                name: result.skinnedAbility?.name || selections.powerBlueprint.name,
                description: result.skinnedAbility?.description || selections.powerBlueprint.description,
            },
            moralAlignment: result.moralAlignment || { goodEvil: 0, lawChaos: 0 }
        };

    } catch (e) {
        console.error("Hero weaving failed", e);
        return {
            profession: "Adventurer",
            appearance: "A determined explorer.",
            background: "A traveler with a mysterious past.",
            personality: "Quiet, observant.",
            keywords: ["brave", "adventurer"],
            abilityScores: { strength: { score: 12 }, dexterity: { score: 12 }, constitution: { score: 12 }, intelligence: { score: 10 }, wisdom: { score: 10 }, charisma: { score: 10 } },
            savingThrows: { strength: { proficient: true }, constitution: { proficient: true }, dexterity: { proficient: false }, intelligence: { proficient: false }, wisdom: { proficient: false }, charisma: { proficient: false } },
            skills: {},
            skinnedAbility: selections.powerBlueprint,
            moralAlignment: { goodEvil: 0, lawChaos: 0 }
        };

    }
};

export const generateCharacterDetails = async (world: any[], prompt: string, character: any) => {
    const input = `Create or refine a full Player Character sheet based on: "${prompt}".
    World Context: ${JSON.stringify(world.slice(0, 3))}
    Current Character State: ${JSON.stringify(character)}
    
    [Mechanical Balance Protocol]
    - Level 1-4: 1-2 Abilities. Max +1 to a specific skill or +1 AC in passive buffs.
    - Level 5-10: 2-3 Abilities. Active effects should use 1d8 to 2d8 dice.
    - Level 11+: 3-4 Abilities. High-impact mechanics allowed.
    - Active Effects (damage/heal) MUST have usage limits (per_short_rest or per_long_rest).

    Return a comprehensive JSON object representing the character.`;

    // Check window cache for faster setting as GameData may not be fully available to this service


    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: input,
        config: {
                thinkingConfig: { thinkingBudget: 512 }, responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

export const generateCompanionDetails = async (world: any[], prompt: string, companion: any, messages: any[]) => {
    const input = `Create or update a full companion character sheet based on: "${prompt}".
    World Context: ${JSON.stringify(world.slice(0, 3))}
    Chat History: ${JSON.stringify(messages.slice(-10))}
    Current Data: ${JSON.stringify(companion)}
    
    Return a comprehensive JSON object for the Companion.`;



    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: input,
        config: {
                thinkingConfig: { thinkingBudget: 512 }, responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};



/**
 * [DEPRECATED]: This logic has been consolidated into generateStartingScenario to ensure
 * all background-related POIs are anchored in the starting zone (0-0), reducing map bloat.
 */
export const generatePersonalDiscoveries = async (character: any, gameData: GameData) => {
    return []; // Return empty array to signal no additional zones are needed
};


/**
 * Generates the starting zone and its points of interest.
 */
const generateStartingPois = async (
    character: any,
    gameData: GameData,
    popLevel: string,
    rolledThemes: any[]
): Promise<{ name: string, description: string, hostility: number, knowledge: any[] }> => {
    const ai = getAi();
    const worldContext = getWorldContext(gameData);
    
    const prompt = `You are a World-Building Architect. Create the starting safe haven zone for ${character.name}.
    
[WORLD CONTEXT]
${worldContext}

[CHARACTER PROFILE]
Name: ${character.name}
Race: ${character.race}
Profession: ${character.profession}

[INSTRUCTIONS]
1. startingZone: Create a safe haven or starting area with unique points of interest. Ensure these descriptions remain focused on location and legend, and do NOT attribute them to another hero name from history.
   - Population Scale: ${popLevel}. This zone has a population density equivalent to a ${popLevel}.
   - You MUST generate exactly 4 'knowledge' entries (POIs).
     - Entry 1: [MANDATORY] Thematic Population Center landmark (matching the Town scale). This is a UNIQUE SETTLEMENT.
     - Entries 2-4: Surrounding Landmarks based on these rolled themes:
       1. ${rolledThemes[0].themeStr}
       2. ${rolledThemes[1].themeStr}
       3. ${rolledThemes[2].themeStr}
     - One of these entries (2-4) MUST also be thematically tied to ${character.name}'s past, origin, or background as a ${character.race} ${character.profession} — set "isBackgroundRelated": true on that entry.
   - **UNIQUENESS RULE**: The 'title' of each entry in 'knowledge' MUST NOT be the same as 'startingZone.name'.
   - **IDENTITY_LOCK**: The main character of this story is **${character.name}**. Do NOT invent any other protagonist names or aliases.
   
Return JSON: { "name": "string", "description": "string", "hostility": number, "knowledge": [{ "title": "string", "content": "string", "isBackgroundRelated": boolean, "isPopulationCenter": boolean }] }`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
        config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } }
    });
    
    const data = JSON.parse(cleanJson(response.text || '{}'));
    
    // Safety: ensure the first entry is marked as population center if the AI missed the flag
    if (data.knowledge && data.knowledge.length > 0) {
        data.knowledge[0].isPopulationCenter = true;
    }
    
    return data;
};

/**
 * Crafts the 3-paragraph starting narrative based on the pre-generated POIs.
 */
const generateStartingNarrative = async (
    character: any,
    gameData: GameData,
    selectedHook: string,
    companions: Companion[],
    startingZone: any,
    startPoi: any
): Promise<any> => {
    const ai = getAi();
    const worldContext = getWorldContext(gameData);
    const companionContext = companions.length > 0
        ? `\n[COMPANION PROFILES]\n${companions.map(c => `Name: ${c.name}, Race: ${c.race}, Level: ${c.level}, Profession: ${c.profession}, Background: ${c.background}`).join('\n')}`
        : '';

    const prompt = `You are a Master Storyteller. Synthesize an immersive opening for ${character.name}'s path.

[WORLD CONTEXT]
${worldContext}
    
[CHARACTER PROFILE]
Name: ${character.name}
Race: ${character.race}
Profession: ${character.profession}
Background: ${character.background}
${companionContext}

[STARTING LOCATION]
Zone: ${startingZone.name} (${startingZone.description})
Point of Interest (Current Arrival): ${startPoi.title} - ${startPoi.content}

[MANDATORY STORY HOOK]
You MUST base the catalyst of this adventure on the following scenario:
"${selectedHook}"

[INSTRUCTIONS]
1. Weave a three-part narrative introduction. You MUST address the player directly in the second-person point of view (e.g. "You walk", "Your past"):
   - narrativeLens: A colourful blend of ${character.name}'s background based on their race (${character.race}) and traits (${character.background}). Use evocative, sensory language.
   - narrativePath: Explain ${character.name}'s reason to survive and why they chose their life as a ${character.profession}. ${companions.length > 0 ? "IMPORTANT: Since one or more companions are accompanying the main character, you MUST weave the companions stories and their relationship with the main character into this narrative." : ""}
   - narrativeCatalyst: Immersive implementation of the Hook provided above, set at the location: ${startPoi.title}. This should be the longest part.
2. introSummary: A 2-sentence tactical plot brief.
3. startingObjective: A primary quest to guide the player immediately.
4. alignmentOptions: Add exactly 4 logical suggestions for the next action based on the intro narrative. Each button represents an alignment action. Max 5 words per label (1 Good, 1 Evil, 1 Lawful, 1 Chaotic).
5. intro_npcs: Generate 1-2 NPCs present at ${startPoi.title}.

[IDENTITY_LOCK]
- The protagonist's name is **${character.name}**. You MUST refer to them only as 'You' or '${character.name}'.
- NEVER invent new names, aliases, or titles for the protagonist.
- NEVER confuse ${character.name} with NPCs from the World History.
- If the World History mentions a "Hero" or "Legend", do NOT assume this is ${character.name} unless the [CHARACTER PROFILE] explicitly says so.
- Generated NPCs (intro_npcs) MUST have names distinct from ${character.name} and companions.
 
Return JSON: { "narrativeLens", "narrativePath", "narrativeCatalyst", "introSummary", "startingObjective": { "title", "content" }, "alignmentOptions": [{ "label", "alignment" }], "intro_npcs": [{ "name": "Full Name", "description": "1-2 sentence physical description", "race": "From established races", "gender": "Male|Female|Non-binary" }] }`;

    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: THINKING_BUDGETS.SCENARIO }
        }
    });

    return JSON.parse(cleanJson(response.text || '{}'));
};

export const generateStartingScenario = async (character: any, gameData: GameData, selectedHook: string, companions: Companion[] = []) => {
    // Starting location bypass: Always begin in a Town for a balanced early-game experience
    const popLevel: 'Barren' | 'Settlement' | 'Town' | 'City' | 'Capital' = 'Town';
    const features: string[] = ['Tavern', 'Market'];

    const currentTheme = getPOITheme(gameData.worldSummary || "");
    const matrix = POI_MATRIX[currentTheme] || POI_MATRIX.fantasy;
    
    // Roll 3 themes: all non-pop-center POIs get a system-rolled base type
    const rolledThemes = [1, 2, 3].map(() => {
        const r1 = Math.floor(Math.random() * 10);
        const r2 = Math.floor(Math.random() * 10);
        const r3 = Math.floor(Math.random() * 10);
        return {
            baseType: matrix.baseTypes[r1],
            themeStr: `${matrix.baseTypes[r1]} | ${matrix.modifiers[r2]} | ${matrix.flavors[r3]}`
        };
    });

    try {
        // STEP 1: Generate POIs first
        const poiData = await generateStartingPois(character, gameData, popLevel, rolledThemes);
        
        // STEP 2: Assign the party to the Population Center (with fallback to Open Area)
        // Note: generateStartingPois guarantees Entry 0 is the population center
        const startPoi = poiData.knowledge.find(k => k.isPopulationCenter) || poiData.knowledge[0];
        
        // STEP 3: Craft the 3-paragraph starting narrative
        const narrativeData = await generateStartingNarrative(character, gameData, selectedHook, companions, poiData, startPoi);

        const data = {
            ...narrativeData,
            startingZone: poiData
        };

        // Deterministic assembly of the 3 paragraphs to satisfy the 3-paragraph requirement 100% of the time.
        if (data.narrativeLens && data.narrativePath && data.narrativeCatalyst) {
            data.introNarrative = `${data.narrativeLens}\n\n${data.narrativePath}\n\n${data.narrativeCatalyst}`;
            delete data.narrativeLens;
            delete data.narrativePath;
            delete data.narrativeCatalyst;
        }

        if (data.startingZone) {
            const systemOpenArea = {
                title: "Open Area",
                content: `Open area of ${data.startingZone.name}. ${data.startingZone.description || "The beginning of your journey."}`,
                isBackgroundRelated: false
            };
            
            // Filter out any AI-generated "Open Area"
            const filteredKnowledge = (data.startingZone.knowledge || []).filter((k: any) => !k.title?.toLowerCase().includes("open area"));
            
            const poisWithTypes = filteredKnowledge.map((p: any, i: number) => {
                // Entry 0: Population Center (no rolled theme)
                // Entries 1-3: All use rolled themes from POI_MATRIX; background is woven into one by AI
                if (i >= 1 && i - 1 < rolledThemes.length) {
                    return { ...p, baseType: rolledThemes[i - 1]?.baseType, isBackgroundRelated: !!p.isBackgroundRelated };
                }
                return { ...p, isBackgroundRelated: !!p.isBackgroundRelated };
            });

            // Ensure we keep the starting information
            data.startingZone.knowledge = [systemOpenArea, ...poisWithTypes];
            data.startingZone.populationLevel = popLevel;
            data.startingZone.zoneFeatures = features;
            
            // Identify the actual starting entries for use in state synchronization
            const finalStartPoi = data.startingZone.knowledge.find((k: any) => k.title === startPoi.title) || data.startingZone.knowledge[0];
            data.selectedStartPoi = finalStartPoi;
            data.selectedStartPoiIndex = data.startingZone.knowledge.indexOf(finalStartPoi);
        }

        return data;
    } catch (e) {
        console.error("Starting scenario generation failed", e);
        // Fallback scenario to ensure game can start
        return {
            introNarrative: `The journey of ${character.name} begins in the heart of the world. After years of preparation as a ${character.race} ${character.profession}, the time has come to step into the unknown. A mysterious message has led you to this place, and your destiny awaits.`,
            introSummary: `${character.name} begins their journey in a safe haven, following a mysterious lead.`,
            startingObjective: {
                title: "The First Step",
                content: "Explore your surroundings and find your first contact."
            },
            startingZone: {
                name: "The Gateway",
                description: "A bustling safe haven where travelers gather before heading into the wilds.",
                hostility: 0,
                populationLevel: popLevel,
                zoneFeatures: features,
                knowledge: [
                    { title: "Open Area", content: "The arrival point of the journey.", isBackgroundRelated: false },
                    { title: "Local Population Center", content: "A place to gather rumors and rest.", isBackgroundRelated: false, isPopulationCenter: true }
                ]
            },
            selectedStartPoi: { title: "Local Population Center", content: "A place to gather rumors and rest.", isBackgroundRelated: false, isPopulationCenter: true },
            selectedStartPoiIndex: 1
        };
    }
};

export const skinAbilityFlavor = async (
    genericAbility: Ability,
    character: any,
    gameData: GameData
): Promise<{ name: string, description: string, damageType?: string }> => {
    const worldContext = getWorldContext(gameData);
    const charSummary = `Name: ${character.name}, Profession: ${character.profession}, Background: ${character.background}`;
    const prompt = `Skin a generic power to fit a character's theme.
    [Character Profile]
    ${charSummary}
    [Generic Ability]
    Name: ${genericAbility.name}
    Description: ${genericAbility.description}
    Return JSON: { "name", "description", "damageType" }`;
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: AI_MODELS.DEFAULT,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: THINKING_BUDGETS.SCENARIO }, responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        return { name: genericAbility.name, description: genericAbility.description };
    }
};

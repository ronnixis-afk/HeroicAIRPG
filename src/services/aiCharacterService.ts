// services/aiCharacterService.ts

import { getAi, cleanJson } from './aiClient';
import { GameData, PlayerCharacter, Companion, Ability, SKILL_NAMES, SKILL_DEFINITIONS } from '../types';

/**
 * Common helper to format world context for AI prompts.
 */
const getWorldContext = (gameData: GameData) => {
    const summary = gameData.worldSummary || "A mysterious world.";
    const history = (gameData.world || []).slice(0, 10).map(l => `[${l.title}]: ${l.content}`).join('\n');
    const factions = (gameData.world || []).filter(l => l.tags?.includes('faction')).map(f => `- ${f.title}: ${f.content}`).join('\n');
    const mapConfig = gameData.mapSettings ? `[Map Scale]: Each ${gameData.mapSettings.zoneLabel} on the grid represents ${gameData.mapSettings.gridDistance} ${gameData.mapSettings.gridUnit}.` : "";
    const tone = `[Narration Tone]: ${gameData.narrationTone || 'Standard'}. ${gameData.isMature ? '(Mature Content Allowed)' : ''}`;
    return `[World Summary]\n${summary}\n\n[World History]\n${history}\n\n[Major Factions]\n${factions}\n\n[World Map]\n${mapConfig}\n\n[Tone]\n${tone}`;
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
    combatAbilityName: string,
    level: number,
    personality: string
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
    2. Name: If a character was named in chat, use that name. Otherwise, invent a thematic one.
    3. Race & Gender: Match the chat context or prompt. Default to "Human" and "Unspecified" if unclear.
    4. Trait Selection: Choose EXACTLY 2 'BACKGROUND' traits, 2 'GENERAL' traits, and 1 'COMBAT' trait from the library that best fit the character's vibe.
    5. Level: Determine a fitting level. If not specified, default to 1. Max level 20.
    6. personality: Create a short list of QUIRKY, memorable habits or traits (MAX 15 WORDS TOTAL).
    7. Return ONLY the JSON object.

    [OUTPUT JSON SCHEMA]
    {
        "name": "string",
        "gender": "string",
        "race": "string",
        "backgroundTraitNames": ["Trait 1", "Trait 2"],
        "generalTraitNames": ["Trait 1", "Trait 2"],
        "combatAbilityName": "Trait Name",
        "level": number,
        "personality": "string"
    }
    `;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const data = JSON.parse(cleanJson(response.text || "{}"));
        return {
            name: data.name || "New Companion",
            gender: data.gender || "Unspecified",
            race: data.race || "Human",
            backgroundTraitNames: Array.isArray(data.backgroundTraitNames) ? data.backgroundTraitNames : [],
            generalTraitNames: Array.isArray(data.generalTraitNames) ? data.generalTraitNames : [],
            combatAbilityName: data.combatAbilityName || (availableTraits.length > 0 ? availableTraits[0].name : ""),
            level: Number(data.level) || 1,
            personality: data.personality || "A mysterious traveler."
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
): Promise<{ name: string, description: string, personality: string }[]> => {
    const worldContext = getWorldContext(gameData);
    
    const prompt = `
    You are a Master Storyteller and Tavern Recruiter. Provide thematic names, short descriptions, and quirky personalities for 6 potential companions.
    
    [World Lore]
    ${worldContext}

    [Mechanical Seeds]
    ${seeds.map((s, i) => `Recruit ${i+1}: Race: ${s.race}, Gender: ${s.gender}, Traits: ${s.traits.join(', ')}`).join('\n')}

    [Instructions]
    1. For each Recruit, generate a unique name appropriate for their Race and Gender.
    2. description: Write a short backstory summary (Max 25 words).
    3. personality: Create a short list of QUIRKY, memorable habits or traits (MAX 15 WORDS TOTAL). 
    4. Use Title Case for names and Sentence Case for descriptions.
    5. NO ALL CAPS allowed for any text.
    6. Return exactly 6 results in a JSON array.

    [Mandatory Json Structure]
    [
      { "name": "string", "description": "string", "personality": "string" },
      ...
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
        // Robust fallback: Return basic names derived from seeds
        return seeds.map(s => ({ 
            name: `${s.race} Adventurer`, 
            description: "A mysterious traveler seeking purpose in the uncharted lands.", 
            personality: "Quiet, observant, and reliable." 
        }));
    }
};

/**
 * Weaves a cohesive hero background and appearance based on wizard selections.
 * Generates full mechanical stats (Ability Scores, Skills, Saves) and skins the chosen combat ability.
 */
export const weaveHero = async (
    gameData: GameData,
    selections: {
        name: string,
        gender: string,
        race: string,
        backgroundTraits: string[],
        generalTraits: string[],
        combatAbility: Ability,
        customBackground?: string
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
    skinnedAbility: Ability
}> => {
    const worldContext = getWorldContext(gameData);
    const config = gameData.skillConfiguration || 'Fantasy';
    
    // Performance Update: Always prioritize gemini-3-flash-preview for companion recruitment to ensure snappy UI.
    const useFasterGm = gameData.combatConfiguration?.fasterGm === true || isCompanion;

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
    Background Seeds: ${selections.backgroundTraits.join(', ')}
    General Qualities: ${selections.generalTraits.join(', ')}
    Chosen Combat Blueprint: ${selections.combatAbility.name} - ${selections.combatAbility.description}
    ${selections.customBackground ? `Custom Background Context: "${selections.customBackground}"` : ''}

    [Instructions]
    1. profession: Deduce a fitting class or profession name (Title Case).
    2. appearance: Describe ${possessiveTerm} unique physical appearance. Max 40 words.
    3. background: Synthesize a cohesive history explaining ${possessiveTerm} traits and origins. 
       ${selections.customBackground ? 'IMPORTANT: Incorporate the provided Custom Background Context into this narrative.' : ''} 
       Max 100 words.
    4. personality: Provide a list of QUIRKY, memorable habits or traits (MAX 15 WORDS TOTAL). 
    5. keywords: Provide 4-6 thematic keywords.
    6. abilityScores: Use a "Standard Array" logic (15, 14, 13, 12, 10, 8) distributed to fit the profession.
    7. skills: You MUST allocate proficiency to at least 4 skills.
       - IMPORTANT: Any skills mentioned in the "Background Seeds", "General Qualities", or "Custom Background Context" MUST be marked as proficient.
       - Skills MUST be chosen from this list ONLY: [${availableSkillsList.join(', ')}].
    8. savingThrows: Choose exactly 2 Saving Throw proficiencies.
    9. skinnedAbility: Transform the Combat Blueprint into a unique thematic signature power for ${selections.name}. 
       - Rename it evocatively.
       - Rewrite the description to match the flavor.
    10. NO ALL CAPS.

    [Mandatory Json Structure]
    {
        "profession": "string",
        "appearance": "string",
        "background": "string",
        "personality": "string",
        "keywords": ["string"],
        "abilityScores": {
            "strength": { "score": number }, "dexterity": { "score": number }, "constitution": { "score": number },
            "intelligence": { "score": number }, "wisdom": { "score": number }, "charisma": { "score": number }
        },
        "savingThrows": {
            "strength": { "proficient": boolean }, "dexterity": { "proficient": boolean }, "constitution": { "proficient": boolean },
            "intelligence": { "proficient": boolean }, "wisdom": { "proficient": boolean }, "charisma": { "proficient": boolean }
        },
        "skills": {
            ${availableSkillsList.map(s => `"${s}": { "proficient": boolean }`).join(',\n            ')}
        },
        "skinnedAbility": {
            "name": "string",
            "description": "string"
        }
    }
    `;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: useFasterGm ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const result = JSON.parse(cleanJson(response.text || "{}"));
        
        return {
            profession: result.profession || "Adventurer",
            appearance: result.appearance || "A determined explorer.",
            background: result.background || "A traveler with a mysterious past.",
            personality: result.personality || "Quiet, determined.",
            keywords: Array.isArray(result.keywords) ? result.keywords : ["brave", "adventurer"],
            abilityScores: result.abilityScores || { strength: { score: 10 }, dexterity: { score: 10 }, constitution: { score: 10 }, intelligence: { score: 10 }, wisdom: { score: 10 }, charisma: { score: 10 } },
            savingThrows: result.savingThrows || { strength: { proficient: false }, dexterity: { proficient: false }, constitution: { proficient: false }, intelligence: { proficient: false }, wisdom: { proficient: false }, charisma: { proficient: false } },
            skills: result.skills || {},
            skinnedAbility: {
                ...selections.combatAbility,
                ...(result.skinnedAbility || {})
            }
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
            skinnedAbility: selections.combatAbility
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
    const isFaster = (window as any).gameDataCache?.combatConfiguration?.fasterGm === true;

    const ai = getAi();
    const response = await ai.models.generateContent({
        model: isFaster ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview',
        contents: input,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

export const generateCompanionDetails = async (world: any[], prompt: string, companion: any, messages: any[]) => {
    const input = `Create or update a full companion character sheet based on: "${prompt}".
    World Context: ${JSON.stringify(world.slice(0, 3))}
    Chat History: ${JSON.stringify(messages.slice(-10))}
    Current Data: ${JSON.stringify(companion)}
    
    Return a comprehensive JSON object for the Companion.`;

    const isFaster = (window as any).gameDataCache?.combatConfiguration?.fasterGm === true;

    const ai = getAi();
    const response = await ai.models.generateContent({
        model: isFaster ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview',
        contents: input,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

export const generateNemesis = async (prompt: string, gameData: GameData) => {
    const input = `Create a Nemesis based on: "${prompt}".
    World: ${gameData.gmSettings}
    Return JSON: { title, description, maxHeat (10-20) }`;
    
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

export const generatePersonalDiscoveries = async (character: any, gameData: GameData) => {
    const worldContext = getWorldContext(gameData);
    
    const prompt = `Establish 2 new geographical locations significant to ${character.name}'s past.
    These locations MUST be anchored immediately around the starting coordinates (0-0).
    
    [ALLOWED COORDINATES]
    Pick 2 unique coordinates from: (0,1), (0,-1), (1,0), (1,-1), (1,1), (-1,1), (-1,-1), (-1,0).
    Format them exactly as "X-Y" (e.g. "0-1", "1--1").
    
    [Character Info]
    Name: ${character.name}. Background: ${character.background}
    
    [MAP CONTEXT]
    ${worldContext}
    
    [INSTRUCTIONS]
    1. Provide 2 Zones.
    2. 'hostility' MUST be an INTEGER between -10 and 10 (as these are known home-territory or past locations).
    3. 'sectorId': If a sector exists that covers these coordinates, assign it. Otherwise assign to the sector containing (0-0).
    4. **UNIQUENESS RULE**: For each zone, the 'title' of its 'pois' MUST NOT be the same as the zone 'name'.
    
    Return JSON: { "zones": [ { "name", "description", "coordinates", "hostility", "sectorId", "pois": [ { "title", "content", "isBackgroundRelated" } ] } ] }`;
    
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const data = JSON.parse(cleanJson(response.text || '{}'));
        return Array.isArray(data.zones) ? data.zones : [];
    } catch (e) {
        console.error("Personal discoveries generation failed", e);
        return [];
    }
};

export const generateStartingScenario = async (character: any, gameData: GameData, hookIndex: number) => {
    const worldContext = getWorldContext(gameData);
    
    const prompt = `You are a Master Storyteller. Synthesize an immersive opening for ${character.name}'s path.

[WORLD CONTEXT]
${worldContext}
    
[CHARACTER PROFILE]
Name: ${character.name}
Level: ${character.level}
Race: ${character.race}
Profession: ${character.profession}
Background: ${character.background}

[MANDATORY STORY HOOK]
You MUST base the catalyst of this adventure on Hook #${hookIndex} from the library below:
1. Arriving at a prestigious summit to receive a reward, only for a local to warn it's a tracker for a rival group.
2. Signaling distress while finalizing a supply contract; a stranger offers double pay to ignore orders.
3. Surrounded by a strike team after purchasing a rare artifact from a major power's merchant.
4. Returning to a luxury suite to find a mysterious figure claiming your recent earnings were stolen from them.
5. Hired as a neutral mediator between warring factions, but discovering a hidden threat planted in the room.
6. Receiving an ornate, locked chest for "services yet to be rendered" while a terrified observer watches.
7. Witnessing a high-ranking official collapse, who hands you a keycard and a warning with their final breath.
8. Discovering a cache of elite gear marked with a major power's seal, intended for a high-stakes assassination.
9. Arriving with a letter of recommendation only to find the author was executed for treason this morning.
10. Approached at a gala by someone who knows your history and offers a reward for a high-stakes betrayal.
11. Waking on a luxury transport with no memory of a "completed heist" that authorities are currently investigating.
12. Receiving an inheritance from a deceased relative, but being met by a collector seeking a "blood tax."
13. Meeting a dying traveler clutching a map to a hidden stronghold who begs you to deliver a warning.
14. Summoned to inspect a strange phenomenon that begins reacting to your presence as a SENTIENT weapon.
15. A stranger pursued by a dominant power crashes through your window, offering a massive bribe for escort.
16. Winning a private auction for a legendary asset, only for a bystander to scream that the item is a fake.
17. Finding a glowing beacon in your gear that makes you the most wanted person in the sector.
18. Stopped by a blockade where an officer recognizes your gear as belonging to a hero who vanished decades ago.
19. Hired as a decoy for a shipment, only to discover your "decoy" cargo is the real, priceless objective.
20. Following a vision to a contact who claims your arrival was prophesied and your wealth is a "key."

[INSTRUCTIONS]
1. Weave a three-part narrative introduction:
   - narrativeLens: A colourful blend of ${character.name}'s background based on their race (${character.race}) and traits (${character.background}). Use evocative, sensory language.
   - narrativePath: Explain ${character.name}'s reason to survive and why they chose their life as a ${character.profession}.
   - narrativeCatalyst: Immersive implementation of the specific Hook provided above. This should be the longest part.
2. introSummary: A 2-sentence tactical plot brief.
3. startingObjective: A primary quest to guide the player immediately.
4. startingZone: Create a safe haven or starting area with unique points of interest.
   - **UNIQUENESS RULE**: The 'title' of each entry in 'knowledge' MUST NOT be the same as 'startingZone.name'.
    
Return JSON: { "narrativeLens", "narrativePath", "narrativeCatalyst", "introSummary", "startingObjective": { "title", "content" }, "startingZone": { "name", "description", "hostility", "knowledge": [{ "title", "content", "isBackgroundRelated" }] } }`;
    
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 4000 }
            }
        });
        
        const data = JSON.parse(cleanJson(response.text || '{}'));
        
        // Deterministic assembly of the 3 paragraphs to satisfy the 3-paragraph requirement 100% of the time.
        if (data.narrativeLens && data.narrativePath && data.narrativeCatalyst) {
            data.introNarrative = `${data.narrativeLens}\n\n${data.narrativePath}\n\n${data.narrativeCatalyst}`;
            delete data.narrativeLens;
            delete data.narrativePath;
            delete data.narrativeCatalyst;
        } else if (data.introNarrative && !data.introNarrative.includes('\n\n')) {
            // Fallback for unexpected model output format
            console.warn("AI failed to provide structured narrative parts; falling back to unstructured narrative.");
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
                knowledge: [
                    { title: "The Local Inn", content: "A place to gather rumors and rest.", isBackgroundRelated: false }
                ]
            }
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
    const prompt = `Skin a generic combat ability to fit a character's theme.
    [Character Profile]
    ${charSummary}
    [Generic Ability]
    Name: ${genericAbility.name}
    Description: ${genericAbility.description}
    Return JSON: { "name", "description", "damageType" }`;
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        return { name: genericAbility.name, description: genericAbility.description };
    }
};

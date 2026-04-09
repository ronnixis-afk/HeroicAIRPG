import { getAi, cleanJson } from './aiClient';
import { AI_MODELS, THINKING_BUDGETS } from '../config/aiConfig';
import { GameData, ChatMessage, ActorSuggestion, UsageStats, DiceRoll, LoreEntry, PlayerCharacter } from '../types';
import { Type, Modality } from "@google/genai";
import { buildSystemInstruction, ContextKey } from './aiContextService';
import { generateEmbedding } from './geminiService';
import { getTimePeriod } from '../utils/timeUtils';

// Mapping UI voices to Gemini Neural Voices
const VOICE_MAP: Record<string, string> = {
    "Classic Narrator (Male)": "Puck",
    "Mysterious Storyteller (Female)": "Kore",
    "Grizzled Veteran (Male)": "Fenrir",
    "Ethereal Oracle (Female)": "Zephyr",
};

const calculateUsageCost = (model: string, promptTokens: number, totalTokens: number): number => {
    const isPro = model.includes('pro');
    const isLite = model.includes('lite');
    const inputRate = isPro ? 1.25 / 1000000 : (isLite ? 0.035 / 1000000 : 0.075 / 1000000);
    const outputRate = isPro ? 5.00 / 1000000 : (isLite ? 0.15 / 1000000 : 0.30 / 1000000);
    const candidateTokens = totalTokens - promptTokens;
    return (promptTokens * inputRate) + (candidateTokens * outputRate);
};

export const generateNarrativeResponse = async (
    lastMessage: ChatMessage,
    gameData: GameData,
    nemesisContext?: string,
    systemGeneratedCombatants?: Partial<ActorSuggestion>[],
    modelOverride?: string,
    preRolledMechanics?: string,
    isHeroic: boolean = false,
    contextKeysOverride?: ContextKey[]
) => {
    const useSmartGm = gameData.combatConfiguration?.smarterGm !== false;

    const isHidden = gameData.isPartyHidden;

    const primaryModel = modelOverride || AI_MODELS.DEFAULT;

    let totalPromptTokens = 0;
    let totalCandidateTokens = 0;
    let totalCost = 0;

    const requiredKeys = contextKeysOverride || ['core_stats', 'inventory', 'combat_state', 'location_details', 'active_quests', 'recent_history', 'world_lore', 'social_registry'];

    // --- RAG EMBEDDING INJECTION ---
    // Generate a vector representation of the player's action for semantic search
    let userActionVector: number[] | undefined;
    if (lastMessage && lastMessage.content) {
        try {
            userActionVector = await generateEmbedding(lastMessage.content);
        } catch (e) {
            console.log("Vector generation failed before narrative context build (fallback to lexical)");
        }
    }

    const systemInstruction = buildSystemInstruction(gameData, lastMessage, requiredKeys, nemesisContext, systemGeneratedCombatants, isHeroic, userActionVector);

    const recentHistory = (gameData.messages ?? []).slice(-4).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));

    let promptContent = lastMessage.content;
    if (preRolledMechanics) {
        promptContent += `
### The Dice Truth (Unmodifiable)
${preRolledMechanics}

[CRITICAL INSTRUCTION - DICE OUTCOME PROTOCOL]:
- SUCCESS: Progress the situation narratively. The new scene should NOT be similar to the previous scene.
- FAILURE: The party is STUCK in the same scene as previously and must find another way.
- CRITICAL SUCCESS: Progress the situation significantly. The new scene must be THREE STEPS ahead of the previous one (skip the intermediate obstacles/build-up).
- CRITICAL FAILURE: The party regresses from the current situation or alerts hostiles nearby.

**Strict Narrative Invariants**: Make the dice results feel natural but absolute. Do not contradict them.`;
    }

    // STEALTH DOCTRINE
    if (isHidden) {
        promptContent += `\n\n[MANDATORY STEALTH DOCTRINE]: The party is currently HIDDEN. 
        - NPCs in the scene ARE UNAWARE of the party's presence.
        - You MUST NOT narrate an attack by hostiles unless you explicitly narrate them spotting the player (failed stealth).
        - If hostiles are present, focus on their routine behavior, conversation, or environmental presence.`;
    }

    const availableRaces = (gameData.world || []).filter(l => l.tags?.includes('race')).map(l => `${l.title} (Naming Style: ${l.languageConfig || 'English'})`);
    const raceListStr = availableRaces.length > 0 ? availableRaces.join(', ') : 'Human, Elf, Dwarf, Orc';

    if (systemGeneratedCombatants && systemGeneratedCombatants.length > 0) {
        promptContent += `\n\n[MANDATORY SYSTEM DIRECTIVE - POTENTIAL COMBAT]: 
        The world logic dictates potential hostiles are engaging. If the narrative confirms the start of battle, you MUST populate the 'suggestedActors' field and set 'combat_detected' to true.
        - ANCESTRY ENFORCEMENT & NAMING: Choose from [${raceListStr}]. You MUST apply the matching Naming Style whenever an NPC name is created for that race.
        - FULL NAME & GENDER RULE: You MUST generate a "First Name" and a "Last Name or Family Name" for every unique NPC (minimum 2 words). Generated names MUST be consistent with the NPC's assigned gender (Male/Female). Generic units (e.g. "Guard 1") are exempt.
        - NPC RESOLUTION: For every new character, you MUST also include them in 'npc_resolution' with action: 'new', a description, race, gender, and status.
        - Use unique names and match them to these mechanical slots:
        ${systemGeneratedCombatants.map((s, i) => `Slot ${i + 1}: [Difficulty: ${s.difficulty}, Template: ${s.template}]`).join('\n')}`;
    }

    const outputSchema = {
        type: Type.OBJECT,
        properties: {
            location_update: {
                type: Type.OBJECT,
                properties: {
                    coordinates: { type: Type.STRING },
                    site_name: { type: Type.STRING, description: "Physical location name ONLY (e.g. 'The Iron Forge'). NEVER use event names like 'Death of X' or 'Aftermath of Y'. If no move occurred, return the current site_name unchanged." },
                    site_id: { type: Type.STRING },
                    transition_type: { type: Type.STRING, description: "staying | returning | exploring_new | zone_change. 'staying' if no movement occurred. 'returning' if visiting a previously established POI. 'exploring_new' if moving to an entirely unestablished area in the current zone. 'zone_change' if moving across the world map to a new region/zone." },
                    destination_zone_hint: { type: Type.STRING, description: "Required ONLY if transition_type is 'zone_change'. Provide the name or a short description of the new zone being traveled to." }
                },
                required: ["coordinates", "site_name", "site_id", "transition_type"]
            },
            npc_resolution: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        action: { type: Type.STRING, description: "existing | new | leaves" },
                        description: { type: Type.STRING, description: "For 'new': A 1-2 sentence physical description. For 'existing'/'leaves': A brief note on what they did." },
                        isFollowing: { type: Type.BOOLEAN, description: "TRUE if travelling with the player. FALSE if staying behind or if DEAD. Dead NPCs MUST be FALSE." },
                        race: { type: Type.STRING, description: "Required for 'new' NPCs. Must be from the established ancestries list." },
                        gender: { type: Type.STRING, description: "Required for 'new' NPCs. Male | Female | Non-binary" },
                        status: { type: Type.STRING, description: "Alive | Dead. Set to 'Dead' if the NPC was killed in this turn." },
                        presenceMode: { type: Type.STRING, description: "Physical | Remote. Set to 'Remote' if the NPC is communicating via radio, psychic bond, or other remote means." }
                    },
                    required: ["name", "action", "description"]
                }
            },
            narration: {
                type: Type.OBJECT,
                properties: {
                    paragraph1: { 
                        type: Type.STRING, 
                        description: "Paragraph 1: Sensory & Atmospheric summary. Focus on the immediate environment and resulting mood. NO dialogue here." 
                    },
                    paragraph2: { type: Type.STRING, description: "Paragraph 2: Environmental Hook & Agency (2-3 POIs + status/threat hint)." },
                    dialogues: {
                        type: Type.ARRAY,
                        description: "Structured dialogue lines. Exactly 2-3 sentences per actor. DO NOT include player ('You') dialogue.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                actorName: { type: Type.STRING, description: "Name of the character speaking. Title Case." },
                                content: { type: Type.STRING, description: "The dialogue spoken by the actor. Sentence Case." },
                                isAlignmentReaction: { type: Type.BOOLEAN, description: "True if this dialogue is a direct reaction to the player's moral alignment choice." }
                            },
                            required: ["actorName", "content"]
                        }
                    }
                },
                required: ["paragraph1", "paragraph2"]
            },
            combat_detected: { type: Type.BOOLEAN, description: "Set to TRUE only if an attack actually happens in this turn. FALSE otherwise." },
            items_to_generate: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "List of item names to be procedurally generated and added to inventory (e.g. ['Rusted Key', 'Glowing Mushroom'])."
            },
            player_alignment_shift: { 
                type: Type.STRING, 
                enum: ["Good", "Evil", "Lawful", "Chaotic", "Neutral"],
                description: "The moral weight of the player's last action. Use 'Neutral' if no significant shift occurred."
            },
            time_passed_minutes: { type: Type.NUMBER, description: "Amount of game time passed during this action (e.g. 5, 15, 60)." },
            turn_summary: { type: Type.STRING, description: "A concise, 10-word summary of the turn's events for the story log." },
            is_aboard: { type: Type.BOOLEAN, description: "TRUE if the party is currently inside or has boarded a ship/vehicle." },
            suggestedActors: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        template: { type: Type.STRING },
                        difficulty: { type: Type.STRING },
                        isShip: { type: Type.BOOLEAN },
                        race: { type: Type.STRING }
                    },
                    required: ["name", "template", "difficulty"]
                }
            },
            alignmentOptions: {
                type: Type.ARRAY,
                description: "4 logical suggestions for the next action. Each button action MUST strongly represent an absolute moral alignment (Good, Evil, Lawful, Chaotic). Labels must be concise, punchy, and reflect 'maximum commitment' to that alignment.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        label: { type: Type.STRING, description: "Max 5 words. Use Title Case. Must be an action-oriented phrase representing the specified alignment at its most extreme/purest form." },
                        alignment: { type: Type.STRING, description: "Good | Evil | Lawful | Chaotic" }
                    },
                    required: ["label", "alignment"]
                }
            },
            updates: {
                type: Type.OBJECT,
                properties: {
                    gmNotes: { type: Type.STRING },
                    objectives: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                content: { type: Type.STRING },
                                status: { type: Type.STRING },
                                isTracked: { type: Type.BOOLEAN }
                            },
                            required: ["title", "content"]
                        }
                    }
                }
            }
        },
        required: ["location_update", "npc_resolution", "narration", "combat_detected", "alignmentOptions", "updates", "player_alignment_shift", "time_passed_minutes", "turn_summary"]
    };

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: primaryModel,
            contents: [
                ...recentHistory,
                { role: 'user', parts: [{ text: promptContent }] }
            ],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: outputSchema as any,
                thinkingConfig: { thinkingBudget: THINKING_BUDGETS.NARRATIVE }
            }
        });

        // Guard: Ensure the API returned a valid response object
        if (!response || typeof response.text !== 'string') {
            console.error("Narrator received empty or invalid response from API:", response);
            throw new Error("AI returned an empty response. The service may be temporarily unavailable.");
        }

        const usage = response.usageMetadata;
        if (usage) {
            totalPromptTokens += usage.promptTokenCount || 0;
            totalCandidateTokens += usage.candidatesTokenCount || 0;
            totalCost += calculateUsageCost(primaryModel, usage.promptTokenCount || 0, usage.totalTokenCount || 0);
        }

        const usageStats: UsageStats = {
            promptTokens: totalPromptTokens,
            candidatesTokens: totalCandidateTokens,
            totalTokens: totalPromptTokens + totalCandidateTokens,
            costUsd: totalCost
        };

        const parsedData = JSON.parse(cleanJson(response.text || "{}"));
        return { ...parsedData, usage: usageStats };
    } catch (e: any) {
        const errorMsg = e?.message || String(e);
        console.error("Failed to generate GM narrative response:", errorMsg, e);
        return {
            narration: {
                paragraph1: "The Game Master is gathering their thoughts...",
                paragraph2: "Wait for it..."
            },
            combat_detected: false,
            location_update: {
                coordinates: gameData.playerCoordinates || "0-0",
                site_name: gameData.current_site_name || "The Wilds",
                site_id: gameData.current_site_id || "the-wilds",
                transition_type: "staying"
            },
            npc_resolution: [],
            suggestedActors: [],
            player_alignment_shift: "Neutral",
            time_passed_minutes: 0,
            turn_summary: "System processing.",
            usage: undefined,
            _error: errorMsg
        };
    }
};

export const generateNarrativeRoundResponse = async (
    gameData: GameData,
    batchMechanicsSummary: string,
    playerActionFlavor?: string,
    sceneContext?: string,
    partyOverview?: string,
    isHeroic: boolean = false
) => {
    const isMature = gameData.isMature;
    const tone = gameData.narrationTone || "Cinematic";
    const gmDirectives = gameData.gmSettings || "Roleplay as a legendary storyteller.";


    const lastAiMsg = [...gameData.messages].reverse().find(m => m.sender === 'ai')?.content || "";
    const previously = lastAiMsg ? `\n[Previously]:\n${lastAiMsg}\n` : '';

    const heroicDirective = isHeroic ? `
[MANDATORY HEROIC MOMENT DIRECTIVE]
The player has expended a HEROIC POINT this round.
1. NARRATION: Their specific action MUST be described with cinematic, awe-inspiring, and legendary impact.
2. SUCCESS: They are performing at their absolute peak potential.
` : "";

    const period = getTimePeriod(gameData.currentTime);

    const systemInstruction = `
    You are a legendary TTRPG Storyteller and Action Director. 
    You are resolving a full round of combat in a single, breath-taking epic narration.
    [Style]: High-octane cinematic action. 
    [Tone]: ${tone}. ${isMature ? 'Brutal and visceral realism is encouraged.' : 'Focus on heroic feats.'}
    [WORLD TIME]: ${gameData.currentTime} | [PERIOD]: ${period}
    [THREAT DYNAMICS]:
    - DAYLIGHT (Dawn-Dusk): Organized forces (Guard, Soldier), social confrontations.
    - DARKNESS (Night/Midnight): Elevated lethality. Nocturnal monsters, undead, assassins. Visibility is LOW; favor surprise attacks and high-stakes descriptions.
    [GM Directives]: ${gmDirectives}
    ${heroicDirective}
    **Formatting Rules**: 
    1. Plain text only in paragraphs. NO bolding or italics in narration bodies.
    2. Write exactly two paragraphs (paragraph1 and paragraph2).
    3. NO dialogues in 'paragraph1'. Use the structured 'dialogues' array instead.
    4. **SYSTEM DIALOGUE PROTOCOL**: 
       - Each dialogue must be 2-3 sentences per actor. PLAIN TEXT ONLY: No Markdown (**, #, etc.) in 'narration' or 'dialogues'.
    5. NAME PROTECTION: DO NOT use the names of established NPCs for new random characters.
    6. PERSPECTIVE: Always address the player in the second person ('You'). The player character's name is ${gameData.playerCharacter.name}.

    ${previously}
    [Actor Logic]: ${partyOverview || 'Standard party.'}
    [Rules]:
    1. Write a cohesive narration summary split into paragraph1 and paragraph2.
    2. DO NOT use numbers. 
    3. Translate results (Hit, Miss, Defeated) into action descriptions.
    4. The Dice Truth: You are forbidden from changing any mechanical outcome provided.
    5. ALIGNMENT ACTIONS: Provide 4 logical next steps. Each MUST be an absolute representation of its alignment (Absolute Good, Absolute Evil, Absolute Lawful, Absolute Chaotic). Choose the most iconic and distinct action for each.
    
    [Output Schema (Json)]:
      "narration": {
          "paragraph1": "Atmospheric sensory summary. NO dialogue.",
          "paragraph2": "Environmental Hook & Agency (2-3 POIs + status/threat hint).",
          "dialogues": [
            { "actorName": "string", "content": "string", "isAlignmentReaction": boolean }
          ]
      },
      "location_update": { 
          "coordinates": "string", "site_name": "string", "site_id": "string" 
      },
      "npc_resolution": [],
      "alignmentOptions": [
          { "label": "string (Max 5 words, Title Case)", "alignment": "Good | Evil | Lawful | Chaotic" }
      ],
      "updates": {
          "gmNotes": "string",
          "objectives": []
      }
    }
    `;

    const prompt = `[Scene Context]: ${sceneContext || 'Standard combat arena.'}
[Player's Intended Action]: "${playerActionFlavor || 'A direct engagement.'}"

### The Dice Truth (Round Summary)
${batchMechanicsSummary}

[CRITICAL INSTRUCTION - DICE OUTCOME PROTOCOL]:
- SUCCESS: Progress the situation narratively. The new scene should NOT be similar to the previous scene.
- FAILURE: The party is STUCK in the same scene as previously and must find another way.
- CRITICAL SUCCESS: Progress the situation significantly. The new scene must be THREE STEPS ahead of the previous one (skip the intermediate obstacles/build-up).
- CRITICAL FAILURE: The party regresses from the current situation or alerts hostiles nearby.

**Strict Narrative Invariants**: Make the dice results feel natural but absolute. Do not contradict them.`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: AI_MODELS.DEFAULT,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC },
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });
        const parsed = JSON.parse(cleanJson(response.text || '{}'));
        return parsed;
    } catch (e) {
        return {
            location_update: {
                coordinates: gameData.playerCoordinates || "Unknown",
                site_name: gameData.current_site_name || "Unknown", site_id: gameData.current_site_id || "unknown"
            },
            npc_resolution: [],
            alignmentOptions: []
        };
    }
};

/**
 * Speech-to-Text Transcription via Gemini 3 Flash.
 */
export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Audio } },
                { text: "Transcribe the audio exactly as spoken. Return only the transcription text." }
            ]
        }
    });
    return response.text?.trim() || "";
};

/**
 * Refines a raw transcription to ensure setting-specific terms and names are correct.
 */
export const refineTranscription = async (transcript: string, history: any[], gameData: any): Promise<string> => {
    const ai = getAi();
    const context = `[WORLD]: ${gameData.worldSummary || 'Standard TTRPG world.'}\n[RECENT CHAT]: ${JSON.stringify((history || []).slice(-5))}`;
    const prompt = `You are a Transcription Auditor. Refine the following raw speech transcription to ensure it correctly identifies proper nouns (NPCs, Items, Locations) from the world context.\n\nRAW TRANSCRIPT: "${transcript}"\n\nCONTEXT:\n${context}\n\nReturn ONLY the corrected transcription text. No metadata.`;
    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: prompt
    });
    return response.text?.trim() || transcript;
};

/**
 * Weaves the high-level "Grand Design" — a structured, 4-sentence threat arc
 * that acts as the system's narrative compass. The threat clock attached to this
 * design is managed deterministically by the system (not the AI).
 */
export const generateGrandDesign = async (gameData: GameData): Promise<{
    secretConsequence: string;
    hiddenThreat: string;
    indirectSigns: string;
    threatDetails: string;
    threatClockMinutes: number;
}> => {
    const ai = getAi();

    // --- CONTEXT GATHERING ---
    const storyLogs = gameData.story || [];
    const recentSummaries = storyLogs.slice(-10).map(l => l.summary || l.content.slice(0, 120)).join('\n- ');
    const lastTwoFull = storyLogs.slice(-2).map(l => l.content).join('\n\n---\n\n');
    const activeQuests = (gameData.objectives || []).filter(o => o.status === 'active').map(o => `${o.title}: ${o.content}`).join('\n- ');
    const playerName = gameData.playerCharacter?.name || 'The Adventurer';
    const playerLevel = gameData.playerCharacter?.level || 1;
    const currentLocation = gameData.currentLocale || gameData.current_site_name || 'Unknown';

    const previousDesign = gameData.grandDesign
        ? `[PREVIOUS GRAND DESIGN]:\n1. Secret Consequence: ${gameData.grandDesign.secretConsequence}\n2. Hidden Threat: ${gameData.grandDesign.hiddenThreat}\n3. Indirect Signs: ${gameData.grandDesign.indirectSigns}\n4. Threat Details: ${gameData.grandDesign.threatDetails}\n[PREVIOUS THREAT CLOCK]: ${gameData.grandDesign.threatClockMinutes} minutes remaining`
        : '[PREVIOUS GRAND DESIGN]: None — this is the first arc.';

    const prompt = `You are the Master Architect — the unseen hand behind all fate and consequence in this world. Your role is to weave a hidden narrative threat arc that reacts to the party's recent choices.

[WORLD SUMMARY]: ${gameData.worldSummary || 'A dangerous world of adventure.'}
[GAME SETTING]: ${gameData.skillConfiguration || 'Fantasy'}
[PLAYER]: ${playerName} (Level ${playerLevel}) at ${currentLocation}
[ACTIVE QUESTS]:
- ${activeQuests || 'None active.'}

${previousDesign}

[CHRONICLE — Last 10 Memories]:
- ${recentSummaries || 'No memories recorded yet.'}

[CHRONICLE — Last 2 Full Logs]:
${lastTwoFull || 'No detailed logs available.'}

---

**YOUR TASK**: Analyze the party's recent actions, their current situation, and the previous Grand Design (if any). Then generate a NEW 4-sentence threat arc. Each sentence serves a specific narrative function:

1. **secretConsequence**: What hidden consequence has the party's recent actions caused? (e.g., "The party's slaying of the Dragon Priest has drawn the ire of the Draconic Cult.")
2. **hiddenThreat**: What is the current threat the party does NOT know about? This must NEVER be revealed directly to the player in narration. (e.g., "The Draconic Cult's War Council has declared a blood hunt.")
3. **indirectSigns**: What subtle, indirect signs will the party experience that hint at this threat? These ARE allowed to appear in narration. (e.g., "Strange claw marks appear on nearby trees, and locals whisper about robed figures seen at dusk.")
4. **threatDetails**: What specific force or entity is coming, and what will happen when it arrives? (e.g., "A Draconic Cult hunting party of 6 zealots and a Wyrm Rider has been dispatched.")

Also provide **threatClockMinutes**: An integer representing how many in-game minutes until the threat forcibly materializes. This should scale to the severity:
- Minor/Political threats: 2880-4320 minutes (2-3 days)
- Moderate hunting parties: 1440-2880 minutes (1-2 days)
- Imminent danger/assassination: 120-720 minutes (2-12 hours)

**RULES**:
- The threat MUST be organically connected to the party's recent actions and the world setting.
- If a previous Grand Design exists, evolve or escalate it — don't repeat the same threat unless it was unresolved.
- The threat must feel like a natural consequence, not random.
- Keep each sentence concise (1-2 sentences max).
- Scale threat severity and type to the player's level (Level ${playerLevel}).`;

    const outputSchema = {
        type: Type.OBJECT,
        properties: {
            secretConsequence: { type: Type.STRING, description: "Sentence 1: Hidden consequence of recent actions." },
            hiddenThreat: { type: Type.STRING, description: "Sentence 2: Current invisible threat. NEVER reveal to player." },
            indirectSigns: { type: Type.STRING, description: "Sentence 3: Subtle signs the narrator IS allowed to weave in." },
            threatDetails: { type: Type.STRING, description: "Sentence 4: Exact threat force and what happens when it arrives." },
            threatClockMinutes: { type: Type.NUMBER, description: "In-game minutes until forced confrontation (120-4320)." }
        },
        required: ["secretConsequence", "hiddenThreat", "indirectSigns", "threatDetails", "threatClockMinutes"]
    };

    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC },
            responseMimeType: "application/json",
            responseSchema: outputSchema as any
        }
    });

    const parsed = JSON.parse(cleanJson(response.text || "{}"));

    // Clamp the clock to sane bounds
    const clampedClock = Math.max(120, Math.min(4320, parsed.threatClockMinutes || 1440));

    return {
        secretConsequence: parsed.secretConsequence || "The threads of fate shift in response to recent deeds.",
        hiddenThreat: parsed.hiddenThreat || "An unknown force stirs in the shadows.",
        indirectSigns: parsed.indirectSigns || "A faint unease settles over the land.",
        threatDetails: parsed.threatDetails || "Something approaches from beyond the horizon.",
        threatClockMinutes: clampedClock
    };
};

/**
 * Creates a global summary of the entire adventure history.
 */
export const generateStorySummary = async (story: any[]): Promise<string> => {
    const ai = getAi();
    const prompt = `Synthesize the following chronicle of events into a concise history of the journey so far (Max 200 words).\n\nLOGS: ${JSON.stringify(story)}`;
    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
            config: { thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC } },
        contents: prompt
    });
    return response.text?.trim() || "";
};

/**
 * Summarizes a single day's logs into an atmospheric summary.
 */
export const summarizeDay = async (entries: any[], previousEntries: any[]): Promise<string> => {
    const ai = getAi();
    const prompt = `Summarize the day's deeds into a single evocative paragraph of narrative prose.\n\nPREVIOUS CONTEXT: ${JSON.stringify((previousEntries || []).slice(-2))}\n\nTODAY'S EVENTS: ${JSON.stringify(entries)}\n\nReturn only the summary text.`;
    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
            config: { thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC } },
        contents: prompt
    });
    return response.text?.trim() || "";
};

/**
 * Generates tactical GM notes for the current scene.
 */
export const generateGmNotes = async (gameData: any): Promise<string> => {
    const ai = getAi();
    const prompt = `Provide a 3-sentence tactical encounter brief for the current situation.\n\nLOCALE: ${gameData.currentLocale}\nCHRONICLE: ${JSON.stringify((gameData.story || []).slice(-3))}`;
    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
            config: { thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC } },
        contents: prompt
    });
    return response.text?.trim() || "";
};

/**
 * Suggests the next specific action for a tracked quest.
 */
export const generateObjectiveFollowUpAction = async (objective: any, history: any[]): Promise<string> => {
    const ai = getAi();
    const recentHistory = (history || []).slice(-3);
    const prompt = `The player is focused on the quest: "${objective.title}". 
    
    [QUEST DESCRIPTION]
    ${objective.description || 'No description available.'}

    [RECENT CHAT CONTEXT (Last 3 Messages)]
    ${JSON.stringify(recentHistory)}
    
    Suggest the immediate next first-person action (Max 15 words) they should take to advance towards completing this quest.`;

    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
            config: { thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC } },
        contents: prompt
    });
    return response.text?.trim() || "";
};

/**
 * Generates actionable suggestions for the player.
 */
export const generateActionSuggestions = async (gameData: any): Promise<string[]> => {
    const ai = getAi();
    const prompt = `Provide 4 short, evocative first-person actions the player might take in this situation.\n\nCONTEXT: ${JSON.stringify({ locale: gameData.currentLocale, activeQuest: gameData.objectives.find((o: any) => o.isTracked), recentHistory: (gameData.story || []).slice(-3) })}\n\nReturn ONLY a JSON array of strings.`;
    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: prompt,
        config: {
                thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC }, responseMimeType: "application/json" }
    });
    try {
        const parsed = JSON.parse(cleanJson(response.text || "[]"));
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

/**
 * Verifies if an objective has been completed based on narrative history.
 */
export const checkObjectiveCompletion = async (objective: any, history: any[], level: number): Promise<{ completed: boolean, reason: string }> => {
    const ai = getAi();
    const recentHistory = (history || []).slice(-3);
    const prompt = `Analyze if the objective "${objective.title}" is completed based on the following recent logs.
    
    [OBJECTIVE DETAILS]
    Title: ${objective.title}
    Description: ${objective.description || 'No description available.'}

    [RECENT CHAT CONTEXT (Last 3 Messages)]
    ${JSON.stringify(recentHistory)}
    
    Return JSON with "completed" (boolean) and "reason" (1-sentence justification). 
    Only mark as completed if the recent context explicitly shows the goal was achieved.`;

    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC }
        }
    });
    try {
        return JSON.parse(cleanJson(response.text || '{"completed":false,"reason":""}'));
    } catch (e) {
        return { completed: false, reason: "Analysis failed." };
    }
};

/**
 * Transforms text into high-fidelity neural speech.
 */
export const generateSpeech = async (text: string, voiceName: string, tone: string): Promise<string> => {
    const ai = getAi();
    const targetVoice = VOICE_MAP[voiceName] || "Puck";

    const response = await ai.models.generateContent({
        model: AI_MODELS.TTS,
        contents: [{ parts: [{ text: `Say this with a ${tone} tone: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: targetVoice },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || "";
};

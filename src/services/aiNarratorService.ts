import { getAi, cleanJson } from './aiClient';
import { AI_MODELS, THINKING_BUDGETS } from '../config/aiConfig';
import { GameData, ChatMessage, ActorSuggestion, UsageStats, DiceRoll, LoreEntry, PlayerCharacter } from '../types';
import { Type, Modality } from "@google/genai";
import { buildSystemInstruction, ContextKey } from './aiContextService';
import { generateEmbedding } from './geminiService';

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
        promptContent += `\n\n### The Dice Truth (Unmodifiable)\n${preRolledMechanics}\n\n**Strict Narrative Invariants**: Make the dice results feel natural but absolute. Do not contradict them.`;
    }

    // STEALTH DOCTRINE
    if (isHidden) {
        promptContent += `\n\n[MANDATORY STEALTH DOCTRINE]: The party is currently HIDDEN. 
        - NPCs in the scene ARE UNAWARE of the party's presence.
        - You MUST NOT narrate an attack by hostiles unless you explicitly narrate them spotting the player (failed stealth).
        - If hostiles are present, focus on their routine behavior, conversation, or environmental presence.`;
    }

    const availableRaces = (gameData.world || []).filter(l => l.tags?.includes('race')).map(l => l.title);
    const raceListStr = availableRaces.length > 0 ? availableRaces.join(', ') : 'Human, Elf, Dwarf, Orc';

    if (systemGeneratedCombatants && systemGeneratedCombatants.length > 0) {
        promptContent += `\n\n[MANDATORY SYSTEM DIRECTIVE - POTENTIAL COMBAT]: 
        The world logic dictates potential hostiles are engaging. If the narrative confirms the start of battle, you MUST populate the 'suggestedActors' field and set 'active_engagement' to true.
        - ANCESTRY ENFORCEMENT: Choose from [${raceListStr}].
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
                    zone: { type: Type.STRING },
                    site_name: { type: Type.STRING, description: "Physical location name ONLY (e.g. 'The Iron Forge'). NEVER use event names like 'Death of X' or 'Aftermath of Y'. If no move occurred, return the current site_name unchanged." },
                    site_id: { type: Type.STRING },
                    is_new_site: { type: Type.BOOLEAN, description: "TRUE only if transition_type is 'exploring_new' or 'zone_change'. FALSE otherwise." },
                    transition_type: { type: Type.STRING, description: "staying | returning | exploring_new | zone_change. 'staying' if no movement occurred. 'returning' if visiting a previously established POI. 'exploring_new' if moving to an entirely unestablished area in the current zone. 'zone_change' if moving across the world map to a new region/zone." },
                    destination_zone_hint: { type: Type.STRING, description: "Required ONLY if transition_type is 'zone_change'. Provide the name or a short description of the new zone being traveled to." }
                },
                required: ["coordinates", "zone", "site_name", "site_id", "is_new_site", "transition_type"]
            },
            npc_resolution: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        action: { type: Type.STRING, description: "existing | new | leaves" },
                        summary: { type: Type.STRING },
                        isFollowing: { type: Type.BOOLEAN, description: "TRUE if travelling with the player. FALSE if staying behind or if DEAD. Dead NPCs MUST be FALSE." }
                    },
                    required: ["name", "action", "summary"]
                }
            },
            narration: {
                type: Type.OBJECT,
                properties: {
                    paragraph1: { 
                        type: Type.STRING, 
                        description: "Paragraph 1: Strict structure. S1-2: Sensory/Mood block. [DOUBLE NEWLINE]. S3: Player ('You') Dialogue. S4-7: Companion/NPC Dialogue. All dialogue on individual lines in italics (*Name: dialogue*)." 
                    },
                    paragraph2: { type: Type.STRING, description: "Paragraph 2: Environmental Hook & Agency (2-3 POIs + status/threat hint)." },
                    characterReactions: {
                        type: Type.ARRAY,
                        description: "Internal metadata for character sentiment towards the player's action.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "First name of the character responding." },
                                sentiment: { type: Type.STRING, enum: ["like", "dislike", "neutral"], description: "Whether they approve or disapprove of the action based on their alignment." }
                            },
                            required: ["name", "sentiment"]
                        }
                    }
                },
                required: ["paragraph1", "paragraph2"]
            },
            turnSummary: { type: Type.STRING },
            adventure_brief: { type: Type.STRING },
            active_engagement: { type: Type.BOOLEAN, description: "Set to TRUE only if an attack actually happens in this turn." },
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
        required: ["location_update", "npc_resolution", "narration", "turnSummary", "adventure_brief", "active_engagement", "alignmentOptions", "updates"]
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
    } catch (e) {
        console.error("Failed to parse GM response:", e);
        return {
            narration: {
                paragraph1: "The Game Master is gathering their thoughts...",
                paragraph2: "Wait for it..."
            },
            turnSummary: "System error occurred.",
            adventure_brief: gameData.adventureBrief || "Continue investigation.",
            active_engagement: false,
            location_update: {
                coordinates: gameData.playerCoordinates || "0-0",
                zone: gameData.currentLocale || "The Wilds",
                site_name: gameData.current_site_name || "The Wilds",
                site_id: gameData.current_site_id || "the-wilds",
                is_new_site: false
            },
            npc_resolution: [],
            suggestedActors: [],
            usage: undefined
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

    const systemInstruction = `
    You are a legendary TTRPG Storyteller and Action Director. 
    You are resolving a full round of combat in a single, breath-taking epic narration.
    [Style]: High-octane cinematic action. 
    [Tone]: ${tone}. ${isMature ? 'Brutal and visceral realism is encouraged.' : 'Focus on heroic feats.'}
    [GM Directives]: ${gmDirectives}
    ${heroicDirective}
    **STRICT FORMATTING RULE**: Plain text only. NO bolding or italics. EXCEPTION: Character dialogue lines in Paragraph 1 MUST be italicized (*Name: dialogue*).
    **PROSE STRUCTURE**: You MUST write exactly two paragraphs. 
    - Paragraph 1: Structured Narrative. S1-2: Sensory block. DOUBLE NEWLINE. S3: Player direct speech (as 'You'). S4-7: Companion/NPC direct speech (each on a new line). Dialogue MUST be italicized (*Name: dialogue*).
    - Paragraph 2: Environmental Hook & Agency. Describe 2-3 POIs + status/threat hint.
    - [REACTION SCHEMA]: Populate 'characterReactions' for each speaking character. The sentiment ('like' or 'dislike') MUST NOT appear in the text, but the DIALOGUE in Paragraph 1 must reflect this sentiment through tone, content, and attitude.
    - PERSPECTIVE: Always address the player in the second person ('You'). The player character's name is ${gameData.playerCharacter.name}.

    ${previously}
    [Actor Logic]: ${partyOverview || 'Standard party.'}
    [Rules]:
    1. Write a cohesive narration summary split into paragraph1 and paragraph2.
    2. DO NOT use numbers. 
    3. Translate results (Hit, Miss, Defeated) into action descriptions.
    4. The Dice Truth: You are forbidden from changing any mechanical outcome provided.
    5. ALIGNMENT ACTIONS: Provide 4 logical next steps. Each MUST be an absolute representation of its alignment (Absolute Good, Absolute Evil, Absolute Lawful, Absolute Chaotic). Choose the most iconic and distinct action for each.
    
    [Output Schema (Json)]:
    {
      "narration": {
          "paragraph1": "string",
          "paragraph2": "string"
      },
      "turnSummary": "string",
      "adventure_brief": "string",
      "active_engagement": true,
      "location_update": { 
          "coordinates": "string", "zone": "string", "site_name": "string", "site_id": "string", "is_new_site": false 
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

    const prompt = `[Scene Context]: ${sceneContext || 'Standard combat arena.'}\n[Player's Intended Action]: "${playerActionFlavor || 'A direct engagement.'}"\n### The Dice Truth (Round Summary)\n${batchMechanicsSummary}`;

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
            narration: {
                paragraph1: "The fray erupts in a chaotic blur of steel and magic!",
                paragraph2: "Dust settles over the field of battle."
            },
            turnSummary: "Chaos of battle.",
            adventure_brief: gameData.adventureBrief || "Survive the encounter.",
            active_engagement: true,
            location_update: {
                coordinates: gameData.playerCoordinates || "Unknown", zone: gameData.currentLocale || "Unknown",
                site_name: gameData.current_site_name || "Unknown", site_id: gameData.current_site_id || "unknown",
                is_new_site: false
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
 * Weaves the high-level "Grand Design" narrative arc.
 */
export const generateGrandDesign = async (gameData: any): Promise<string> => {
    const ai = getAi();
    const prompt = `You are the Master Architect. Analyze the world lore, character goals, and recent history to weave an overarching narrative "Grand Design". This brief acts as a compass for long-term consistency.\n\nWORLD LORE: ${gameData.worldSummary}\nPLAYER HISTORY: ${JSON.stringify((gameData.story || []).slice(-10))}\n\nReturn a 2-paragraph strategic brief for the Game Master.`;
    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC } }
    });
    return response.text?.trim() || "";
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

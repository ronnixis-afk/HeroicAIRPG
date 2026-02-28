// services/aiNarratorService.ts

import { getAi, cleanJson } from './aiClient';
import { GameData, ChatMessage, ActorSuggestion, UsageStats, DiceRoll, LoreEntry, PlayerCharacter } from '../types';
import { Type, Modality } from "@google/genai";
import { buildSystemInstruction, ContextKey } from './aiContextService';

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
    const useFasterGm = gameData.combatConfiguration?.fasterGm === true;
    const isHidden = gameData.isPartyHidden;

    const primaryModel = modelOverride || (useFasterGm ? 'gemini-3-flash-preview' : (useSmartGm ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview'));

    let totalPromptTokens = 0;
    let totalCandidateTokens = 0;
    let totalCost = 0;

    const requiredKeys = contextKeysOverride || ['core_stats', 'inventory', 'combat_state', 'location_details', 'active_quests', 'recent_history', 'world_lore', 'social_registry'];

    const systemInstruction = buildSystemInstruction(gameData, lastMessage, requiredKeys, nemesisContext, systemGeneratedCombatants, isHeroic);

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
                    sector: { type: Type.STRING },
                    zone: { type: Type.STRING },
                    site_name: { type: Type.STRING, description: "Physical location name ONLY (e.g. 'The Iron Forge'). NEVER use event names like 'Death of X' or 'Aftermath of Y'. If no move occurred, return the current site_name unchanged." },
                    site_id: { type: Type.STRING },
                    narrative_detail: { type: Type.STRING },
                    is_new_site: { type: Type.BOOLEAN }
                },
                required: ["sector", "zone", "site_name", "site_id", "narrative_detail", "is_new_site"]
            },
            npc_resolution: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        action: { type: Type.STRING, description: "existing | new | leaves" },
                        summary: { type: Type.STRING }
                    },
                    required: ["name", "action", "summary"]
                }
            },
            narration: { type: Type.STRING },
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
                description: "4 logical suggestions for the next action based on the chat context. Each button action represents alignment actions. Max 5 words per label.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        label: { type: Type.STRING, description: "Max 5 words. Use Title Case." },
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
                responseSchema: outputSchema as any
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
            narration: "The Game Master is gathering their thoughts...",
            turnSummary: "System error occurred.",
            adventure_brief: gameData.adventureBrief || "Continue investigation.",
            active_engagement: false,
            location_update: {
                sector: gameData.playerCoordinates || "0-0",
                zone: gameData.currentLocale || "The Wilds",
                site_name: gameData.current_site_name || "The Wilds",
                site_id: gameData.current_site_id || "the-wilds",
                narrative_detail: "In a state of flux",
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
    const useFasterGm = gameData.combatConfiguration?.fasterGm === true;

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
    **STRICT FORMATTING RULE**: Plain text only. NO bolding or italics.
    ${previously}
    [Actor Logic]: ${partyOverview || 'Standard party.'}
    [Rules]:
    1. Write a cohesive narration summary.
    2. DO NOT use numbers. 
    3. Translate results (Hit, Miss, Defeated) into action descriptions.
    4. The Dice Truth: You are forbidden from changing any mechanical outcome provided.
    
    [Output Schema (Json)]:
    {
      "narration": "string",
      "turnSummary": "string",
      "adventure_brief": "string",
      "active_engagement": true,
      "location_update": { 
          "sector": "string", "zone": "string", "site_name": "string", "site_id": "string", "narrative_detail": "string", "is_new_site": false 
      },
      "npc_resolution": []
    }
    `;

    const prompt = `[Scene Context]: ${sceneContext || 'Standard combat arena.'}\n[Player's Intended Action]: "${playerActionFlavor || 'A direct engagement.'}"\n### The Dice Truth (Round Summary)\n${batchMechanicsSummary}`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: useFasterGm ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview',
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });
        const parsed = JSON.parse(cleanJson(response.text || '{}'));
        return parsed;
    } catch (e) {
        return {
            narration: "The fray erupts in a chaotic blur of steel and magic!",
            turnSummary: "Chaos of battle.",
            adventure_brief: gameData.adventureBrief || "Survive the encounter.",
            active_engagement: true,
            location_update: {
                sector: gameData.playerCoordinates || "Unknown", zone: gameData.currentLocale || "Unknown",
                site_name: gameData.current_site_name || "Unknown", site_id: gameData.current_site_id || "unknown",
                narrative_detail: "In the thick of battle", is_new_site: false
            },
            npc_resolution: []
        };
    }
};

/**
 * Speech-to-Text Transcription via Gemini 3 Flash.
 */
export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
        model: 'gemini-3-flash-preview',
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
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 2000 } }
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
        model: 'gemini-3-flash-preview',
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
        model: 'gemini-3-flash-preview',
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
        model: 'gemini-3-flash-preview',
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
        model: 'gemini-3-flash-preview',
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
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
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
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }
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
        model: "gemini-2.5-flash-preview-tts",
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

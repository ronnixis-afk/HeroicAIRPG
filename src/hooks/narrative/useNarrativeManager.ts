
// hooks/narrative/useNarrativeManager.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, ChatMessage, AIUpdatePayload, ActorSuggestion, InventoryUpdatePayload, StoryLog } from '../../types';
import { useUI } from '../../context/UIContext';
import { useWorldSelectors } from '../world/useWorldSelectors';
import { useCombatActions } from '../useCombatActions';
import {
    summarizeDay,
    generateStorySummary,
    generateObjectiveFollowUpAction,
    checkObjectiveCompletion,
    determineContextRequirements,
    generateEmbedding,
    ContextKey
} from '../../services/geminiService';

// Pipeline Components
import { useIntentStep } from './pipeline/useIntentStep';
import { useResolutionStep } from './pipeline/useResolutionStep';
import { useNarrationStep } from './pipeline/useNarrationStep';
import { useExtractionStep } from './pipeline/useExtractionStep';
// Fix: Import AssessmentResult to support hoisted variable typing
import { AssessmentResult } from '../../services/aiSkillAssessorService';

export const useNarrativeManager = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    deps: NarrativeDependencies
) => {
    const { combatActions, setIsAiGenerating, processUserInitiatedTravel, weaveGrandDesign } = deps;
    const {
        setIsAuditing,
        setIsAssessing,
        setIsHousekeeping,
        setPendingCombat,
        setIsHeroicModeActive,
        setIsLoading,
        setChatInput
    } = useUI();
    const { getCombatSlots } = useWorldSelectors(gameData);

    // Initialize Pipeline Steps
    const { assessIntent } = useIntentStep();
    const { resolveMechanics } = useResolutionStep(dispatch, combatActions);
    const { generateNarrative } = useNarrationStep();

    const notifyInventoryChanges = useCallback((inventoryUpdates: InventoryUpdatePayload[]) => {
        if (!gameData || !Array.isArray(inventoryUpdates)) return;
        inventoryUpdates.forEach(batch => {
            if (!batch || !Array.isArray(batch.items)) return;
            const owner = batch.ownerId === 'player' ? 'You' : (gameData.companions.find(c => c.id === batch.ownerId)?.name || 'Companion');
            const action = batch.action || 'add';
            const isRemoval = action === 'remove';
            batch.items.forEach(item => {
                if (!item) return;
                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `sys-inv-${isRemoval ? 'loss' : 'gain'}-${Date.now()}-${Math.random()}`,
                        sender: 'system',
                        content: `${owner} ${isRemoval ? 'lost' : 'acquired'}: **${item.name}**`,
                        type: isRemoval ? 'neutral' : 'positive'
                    }
                });
            });
        });
    }, [gameData, dispatch]);

    const { processConsequences } = useExtractionStep(dispatch, notifyInventoryChanges, combatActions);

    /**
     * UNIFIED PIPELINE RUNNER
     * Standardizes the execution of AI Agents: P1 (Librarian) -> P2 (Mechanics) -> P3 (Narrator) -> P4 (Auditor)
     */
    const executePipeline = useCallback(async (
        input: { userMessage: ChatMessage, mechanicsOverride?: any, systemInstruction?: string, isHeroic?: boolean }
    ) => {
        if (!gameData) return;
        const { userMessage, mechanicsOverride, systemInstruction, isHeroic = false } = input;

        try {
            const startTime = performance.now();
            const isCombat = !!gameData.combatState?.isActive;
            const lastAiMsg = (gameData.messages ?? []).filter(m => m.sender === 'ai').pop()?.content || "";

            // --- PHASE 1 & 2: INTENT & RESOLUTION (Math/Truth/Context) ---
            let resolution;
            let assessment: AssessmentResult | null = null;
            let requiredKeys: ContextKey[] = [];

            if (mechanicsOverride) {
                resolution = mechanicsOverride;
                // Default keys for automated events
                requiredKeys = ['core_stats', 'recent_history', 'active_quests', 'social_registry'];
                if (isCombat) requiredKeys.push('combat_state', 'inventory');
            } else {
                setIsAssessing(true);
                assessment = await assessIntent(userMessage, gameData);
                requiredKeys = assessment.requiredKeys;

                if (assessment.intentType === 'travel' && assessment.travelData && processUserInitiatedTravel) {
                    setIsAssessing(false);
                    await processUserInitiatedTravel(userMessage.content, assessment.travelData);
                    return;
                }
                resolution = await resolveMechanics(assessment, gameData, isHeroic);
                setIsAssessing(false);
            }

            // --- PHASE 3: NARRATION (Creative Prose) ---
            setIsAiGenerating(true);
            const combatSlots = resolution.isHostileIntent ? getCombatSlots() : undefined;

            const aiResponse = await generateNarrative(
                userMessage,
                gameData,
                resolution.mechanicsSummary,
                systemInstruction || resolution.combatInstruction,
                combatSlots,
                undefined, // intervention
                isHeroic,
                requiredKeys
            );

            // Inject the explicitly generated GM Notes from the resolution step
            if (resolution.newGmNotes) {
                aiResponse.updates = aiResponse.updates || {};
                aiResponse.updates.gmNotes = resolution.newGmNotes;
            }

            setIsAiGenerating(false);

            // Commit Narrator Result to Chat
            const aiMessage: ChatMessage = {
                id: `ai-${Date.now()}`,
                sender: 'ai',
                content: aiResponse.narration || "...",
                location: aiResponse.location_update?.site_name || gameData.currentLocale,
                rolls: resolution.diceRolls || [],
                alignmentOptions: Array.isArray(aiResponse.alignmentOptions) ? aiResponse.alignmentOptions : undefined,
                usage: { ...(aiResponse.usage || {}), latencyMs: performance.now() - startTime } as any
            };
            dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });

            // --- PHASE 4: EXTRACTION (Auditor/State Sync) - BACKGROUND ---
            // We trigger this without 'await' to allow the UI to unlock for the player
            setIsAuditing(true);
            setIsHousekeeping(true);
            processConsequences(
                userMessage.content,
                aiResponse.narration || "",
                gameData,
                aiMessage.id,
                aiResponse
            ).then(extraction => {
                // --- VERIFIED ENGAGEMENT TRIGGER ---
                // Only trigger consensus panel if the player explicitly chose to fight (Intent)
                // OR if the AI Auditor confirmed the player is actually being attacked in the narrative.
                const shouldForceCombat = (assessment?.intentType === 'combat' && resolution.isHostileIntent) || extraction.engagementConfirmed;

                if (shouldForceCombat) {
                    const finalSuggestions = Array.isArray(aiResponse.suggestedActors) ? aiResponse.suggestedActors : [];
                    combatActions.initiateCombatSequence(aiResponse.narration || '', finalSuggestions as ActorSuggestion[], 'Narrative');
                }
            }).catch(err => {
                console.error("Background state sync failed", err);
            }).finally(() => {
                setIsAuditing(false);
                setIsHousekeeping(false);
            });

        } catch (e) {
            console.error("Master Pipeline Failed", e);
        } finally {
            setIsAiGenerating(false);
            setIsAuditing(false);
            setIsAssessing(false);
            setIsHousekeeping(false);
        }
    }, [gameData, dispatch, assessIntent, resolveMechanics, generateNarrative, processConsequences, getCombatSlots, combatActions, processUserInitiatedTravel, setIsAiGenerating, setIsAssessing, setIsAuditing, setIsHousekeeping]);

    const submitUserMessage = useCallback(async (message: ChatMessage, isHeroic: boolean = false) => {
        if (!gameData) return;
        dispatch({ type: 'ADD_MESSAGE', payload: message });

        if (isHeroic) {
            dispatch({ type: 'USE_HEROIC_POINT' });
            setIsHeroicModeActive(false);
        }

        await executePipeline({ userMessage: message, isHeroic });
    }, [gameData, dispatch, executePipeline, setIsHeroicModeActive]);

    /**
     * Automated Event Entry Point (Travel, Wait, Rest, Exploration)
     */
    const submitAutomatedEvent = useCallback(async (
        intentText: string,
        mechanics: { diceRolls: any[], mechanicsSummary: string, combatInstruction: string, isHostileIntent: boolean, newGmNotes?: string },
        systemInstruction?: string
    ) => {
        if (!gameData) return;
        const msg: ChatMessage = { id: `auto-${Date.now()}`, sender: 'user', mode: 'CHAR', content: intentText };
        await executePipeline({ userMessage: msg, mechanicsOverride: mechanics, systemInstruction });
    }, [gameData, executePipeline]);

    const summarizeDayLog = useCallback(async (day: string, dayEntries: StoryLog[], previousDayEntries: StoryLog[]) => {
        setIsLoading(true);
        try {
            const summaryText = await summarizeDay(dayEntries, previousDayEntries);
            const removeIds = dayEntries.map(e => e.id);
            const content = `[Daily Summary: ${day}]\n${summaryText}`;
            const embedding = await generateEmbedding(`${summaryText} ${content}`) || undefined;
            const newLog: StoryLog = { id: `summary-${day}-${Date.now()}`, timestamp: dayEntries[0].timestamp, location: dayEntries[dayEntries.length - 1].location, content, summary: summaryText, isNew: false, embedding };
            dispatch({ type: 'COMPRESS_DAY_LOGS', payload: { removeIds, newLog } });
        } finally { setIsLoading(false); }
    }, [dispatch, setIsLoading]);

    const summarizePastStoryLogs = useCallback(async () => {
        if (!gameData) return;
        setIsLoading(true);
        try {
            const historySummary = await generateStorySummary(gameData.story);
            const content = `[Archive Summary]\n${historySummary}`;
            const embedding = await generateEmbedding(`${historySummary} ${content}`) || undefined;
            const newLog: StoryLog = { id: `archive-${Date.now()}`, timestamp: "Previous Adventures", location: "Various", content, summary: historySummary, isNew: false, embedding };
            const allIds = gameData.story.map(s => s.id);
            dispatch({ type: 'COMPRESS_DAY_LOGS', payload: { removeIds: allIds, newLog } });
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [gameData, dispatch, setIsLoading]);

    const generateObjectiveFollowUp = useCallback(async (objectiveId: string) => {
        if (!gameData) return;
        const objective = gameData.objectives.find(o => o.id === objectiveId);
        if (!objective) return;
        setIsAiGenerating(true);
        try {
            const checkResult = await checkObjectiveCompletion(objective, gameData.messages, gameData.playerCharacter.level);
            if (checkResult.completed) {
                dispatch({ type: 'UPDATE_OBJECTIVE', payload: { ...objective, status: 'completed' } });
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-obj-auto-${Date.now()}`, sender: 'system', content: `Objective completed: ${objective.title}`, type: 'positive' } });
                if (weaveGrandDesign) weaveGrandDesign();
            } else {
                const action = await generateObjectiveFollowUpAction(objective, gameData.messages.slice(-3));
                if (action) setChatInput(action);
            }
        } finally { setIsAiGenerating(false); }
    }, [gameData, dispatch, setChatInput, weaveGrandDesign, setIsAiGenerating]);

    const setMessages = useCallback((updater: (prevMessages: ChatMessage[]) => ChatMessage[]) => {
        dispatch({ type: 'SET_MESSAGES', payload: updater });
    }, [dispatch]);

    const applyAiUpdates = useCallback(async (updates: AIUpdatePayload, aiMessage?: ChatMessage) => {
        if (updates.inventoryUpdates) notifyInventoryChanges(updates.inventoryUpdates);

        // --- BACKGROUND INDEXER (RAG EMBEDDINGS) ---
        // Before hitting the synchronous reducer, we asynchronously fetch embeddings for any new Semantic entities
        const indexingTasks: Promise<void>[] = [];

        // 1. Index Knowledge (Lore)
        if (updates.knowledge && updates.knowledge.length > 0) {
            updates.knowledge.forEach(k => {
                const textToEmbed = `${k.title || ''} ${k.content || ''}`.trim();
                if (textToEmbed) {
                    indexingTasks.push(generateEmbedding(textToEmbed).then(vec => {
                        if (vec) k.embedding = vec;
                    }));
                }
            });
        }

        // 2. Index Objectives (Quests)
        if (updates.objectives && updates.objectives.length > 0) {
            updates.objectives.forEach(o => {
                const textToEmbed = `${o.title || ''} ${o.content || ''}`.trim();
                if (textToEmbed) {
                    indexingTasks.push(generateEmbedding(textToEmbed).then(vec => {
                        if (vec) o.embedding = vec;
                    }));
                }
            });
        }

        // 3. Index NPC Memories
        if (updates.npcMemories && updates.npcMemories.length > 0) {
            updates.npcMemories.forEach(m => {
                if (m.memory) {
                    indexingTasks.push(generateEmbedding(m.memory).then(vec => {
                        // Note: We mutate the actual object reference inside the payload
                        if (vec) (m as any).embedding = vec;
                    }));
                }
            });
        }

        // 4. Index Story Logs
        if (updates.storyUpdates && updates.storyUpdates.length > 0) {
            updates.storyUpdates.forEach(su => {
                const textToEmbed = `${su.summary || ''} ${su.content || ''}`.trim();
                if (textToEmbed) {
                    indexingTasks.push(generateEmbedding(textToEmbed).then(vec => {
                        if (vec) su.embedding = vec;
                    }));
                }
            });
        }

        // Wait for all embeddings to resolve (these are very fast API calls)
        if (indexingTasks.length > 0) {
            await Promise.allSettled(indexingTasks);
        }

        dispatch({ type: 'AI_UPDATE', payload: updates });
        if (aiMessage) dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });
    }, [dispatch, notifyInventoryChanges]);

    return {
        submitUserMessage,
        submitAutomatedEvent,
        setMessages,
        applyAiUpdates,
        summarizeDayLog,
        summarizePastStoryLogs,
        generateObjectiveFollowUp
    };
};

interface NarrativeDependencies {
    combatActions: ReturnType<typeof useCombatActions>;
    setIsAiGenerating: (isGenerating: boolean) => void;
    processUserInitiatedTravel?: (content: string, intent?: { destination: string, method: string }) => Promise<void>;
    weaveGrandDesign?: () => Promise<void>;
}

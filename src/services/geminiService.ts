// services/geminiService.ts

import {
    generateNarrativeResponse,
    transcribeAudio,
    refineTranscription,
    generateNarrativeRoundResponse,
    generateGrandDesign,
    generateStorySummary,
    summarizeDay,
    generateGmNotes,
    generateObjectiveFollowUpAction,
    generateActionSuggestions,
    checkObjectiveCompletion
} from './aiNarratorService';
/* Fix: Import determineContextRequirements from aiContextService to allow central re-export */
import { determineContextRequirements, getRelevantLore, getAdjacencyContext, getAvailableSkillsContext, ContextKey } from './aiContextService';
import { auditSystemState } from './aiAuditorService';
import { performHousekeeping } from './aiHousekeeperService';
import { assessSkillIntent, verifyCombatRelevance } from './aiSkillAssessorService';
import { resolveLocaleCreation } from './aiLocaleAgentService';
import { getEmbeddingAi } from './aiClient';

/**
 * Sends a text string to the secure Next.js backend to generate a semantic vector embedding.
 * Returns an array of floats representing the concept in high-dimensional space.
 */
export const generateEmbedding = async (text: string): Promise<number[] | undefined> => {
    if (!text || text.trim() === '') return undefined;

    try {
        const ai = getEmbeddingAi();
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: text
        });

        const embedding = response.embeddings?.[0]?.values;
        if (!embedding || !Array.isArray(embedding)) {
            console.error("Embedding API returned malformed data.");
            return undefined;
        }

        return embedding;
    } catch (e) {
        console.error("Failed to generate embedding array:", e);
        return undefined; // Fail silently so the game doesn't crash, we can backfill later
    }
};

// Re-export specific domain services
export * from './aiCharacterService';
export * from './aiCombatService';
export * from './aiItemService';
export * from './aiWorldService';
export * from './aiNPCService';
export { resolveLocaleCreation };

export { assessSkillIntent, verifyCombatRelevance };

// Re-export new services functions to maintain compatibility with consumers
export {
    transcribeAudio,
    refineTranscription,
    generateNarrativeResponse as generateResponse,
    generateNarrativeRoundResponse,
    generateGrandDesign,
    auditSystemState,
    performHousekeeping,
    generateStorySummary,
    summarizeDay,
    generateGmNotes,
    generateObjectiveFollowUpAction,
    generateActionSuggestions,
    checkObjectiveCompletion,
    /* Fix: Export determineContextRequirements to resolve dependency errors in narrative hooks */
    determineContextRequirements
};

export { getRelevantLore, getAdjacencyContext, getAvailableSkillsContext, type ContextKey };

// Placeholder for unused imports to satisfy type checking if needed by consumers
export const weaveNarrativeFromObjective = async () => { };
export const generateAdventureIntro = async () => { };
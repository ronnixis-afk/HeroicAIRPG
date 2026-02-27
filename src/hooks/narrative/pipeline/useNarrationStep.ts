
// hooks/narrative/pipeline/useNarrationStep.ts

import { useCallback } from 'react';
import { GameData, ChatMessage, ActorSuggestion, AIResponse } from '../../../types';
import { generateResponse } from '../../../services/geminiService';
import { ContextKey } from '../../../services/aiContextService';

export const useNarrationStep = () => {
    const generateNarrative = useCallback(async (
        userMessage: ChatMessage,
        gameData: GameData,
        mechanicsSummary: string,
        combatInstruction: string,
        combatSlots?: Partial<ActorSuggestion>[],
        nemesisContext?: string,
        isHeroic: boolean = false,
        requiredContextKeys?: ContextKey[]
    ): Promise<AIResponse> => {
        
        // Construct the Mechanical Invariant String (Phase 5: Dice Truth)
        const diceTruth = mechanicsSummary ? `The dice have spoken:\n${mechanicsSummary}` : "";
        
        const fullInstruction = diceTruth + "\n" + combatInstruction + 
            (combatSlots && combatSlots.length > 0 
                ? "\n[Narrative Reinforcement]: Some hostiles are already present. Narrate reinforcements emerging." 
                : "");

        return await generateResponse(
            userMessage, 
            { ...gameData, messages: [...gameData.messages, userMessage] }, 
            nemesisContext, 
            combatSlots, 
            undefined,
            fullInstruction,
            isHeroic,
            requiredContextKeys // P1 result passed to service
        );
    }, []);

    return { generateNarrative };
};

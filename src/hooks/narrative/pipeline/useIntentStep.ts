// hooks/narrative/pipeline/useIntentStep.ts

import { useCallback } from 'react';
import { GameData, ChatMessage } from '../../../types';
import { assessSkillIntent, getAvailableSkillsContext } from '../../../services/geminiService';
import { AssessmentResult } from '../../../services/aiSkillAssessorService';

export const useIntentStep = () => {
    const assessIntent = useCallback(async (
        message: ChatMessage,
        gameData: GameData
    ): Promise<AssessmentResult> => {
        const skillsContext = getAvailableSkillsContext(gameData);
        const partyNames = [
            gameData.playerCharacter.name,
            ...(gameData.companions ?? []).filter(c => c.isInParty !== false).map(c => c.name)
        ].filter(Boolean);

        const isCombat = !!gameData.combatState?.isActive;
        const lastAiMsg = (gameData.messages ?? []).filter(m => m.sender === 'ai').pop()?.content || "";

        return await assessSkillIntent(message.content, skillsContext, partyNames, isCombat, lastAiMsg);
    }, []);

    return { assessIntent };
};
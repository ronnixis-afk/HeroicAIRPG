
// hooks/world/useExploration.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, ChatMessage, ActorSuggestion, LoreEntry, StoryLog, InventoryUpdatePayload } from '../../types';
import { expandEncounterPlot } from '../../services/geminiService';
import { generateEncounterRoll, getUnifiedProceduralPrompt, getClearPlotPrompt } from '../../utils/EncounterMechanics';
import { useWorldSelectors } from './useWorldSelectors';
import { getDiscoveryXP } from '../../utils/mechanics';
import { parseHostility } from '../../utils/mapUtils';

export const useExploration = (
    gameData: GameData | null, 
    dispatch: React.Dispatch<GameAction>,
    initiateCombatSequence: (narrative: string, suggestions: ActorSuggestion[], source?: any) => Promise<void>,
    setIsAiGenerating: (isGenerating: boolean) => void,
    submitAutomatedEvent?: any
) => {
    const { getCurrentZoneHostility, getCombatSlots } = useWorldSelectors(gameData);

    const investigateDiscovery = useCallback(async (entry: LoreEntry, locationName: string) => {
        if (!gameData || !submitAutomatedEvent) return;

        const isRevisit = !!entry.visited;
        const baseHostility = getCurrentZoneHostility();
        const playerLevel = gameData.playerCharacter.level || 1;
        
        const guaranteeModifier = isRevisit ? 0 : 75;
        const { roll: rollResult, matrix } = generateEncounterRoll(`Discovery: ${entry.title}`, baseHostility + guaranteeModifier); 

        let isHostileIntent = rollResult.outcome === 'Encounter';
        let newGmNotes: string | undefined = undefined;
        let preRolledRolls = [rollResult];

        if (isHostileIntent && matrix) {
            newGmNotes = await expandEncounterPlot(matrix, gameData.worldSummary || "");
        }

        dispatch({ type: 'ADD_MESSAGE', payload: {
            id: `sys-inv-enc-${Date.now()}`,
            sender: 'system',
            content: `Encounter Check: ${rollResult.dieRoll} + ${rollResult.bonus} = ${rollResult.total} (${rollResult.outcome})${matrix ? `\n${matrix.summary}` : ''}`,
            type: 'neutral',
            rolls: [rollResult]
        }});

        const proceduralInstruction = matrix 
            ? getUnifiedProceduralPrompt(matrix, !isRevisit) 
            : getClearPlotPrompt();

        const mechanicsResult = {
            diceRolls: preRolledRolls,
            mechanicsSummary: "",
            combatInstruction: proceduralInstruction,
            isHostileIntent,
            newGmNotes
        };

        const systemContext = `[SYSTEM] Player is ${isRevisit ? 'REVISITING' : 'DISCOVERING'} "${entry.title}" in ${locationName}. LORE: ${entry.content}`;

        setIsAiGenerating(true);
        try {
            await submitAutomatedEvent(isRevisit ? `I return to ${entry.title}.` : `I investigate ${entry.title}.`, mechanicsResult, systemContext);
            
            if (!entry.visited) {
                dispatch({ type: 'UPDATE_KNOWLEDGE', payload: { ...entry, visited: true } });
                dispatch({ type: 'AWARD_XP', payload: { amount: getDiscoveryXP(playerLevel), source: `Discovered ${entry.title}` } });
            }
        } catch (e) {
            console.error("Investigation failed", e);
        } finally {
            setIsAiGenerating(false);
        }
    }, [gameData, dispatch, getCurrentZoneHostility, getCombatSlots, setIsAiGenerating, submitAutomatedEvent]);

    return {
        investigateDiscovery
    };
};

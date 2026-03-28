
// hooks/world/useTime.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, ChatMessage, ActorSuggestion, DiceRollRequest } from '../../types';
import { verifyCombatRelevance, expandEncounterPlot } from '../../services/geminiService';
import { generateEncounterRoll, getUnifiedProceduralPrompt, getClearPlotPrompt, getSkillFailurePrompt, getSkillSuccessPrompt } from '../../utils/EncounterMechanics';
import { parseGameTime, addDuration, formatGameTime } from '../../utils/timeUtils';
import { useWorldSelectors } from './useWorldSelectors';

export const useTime = (
    gameData: GameData | null, 
    dispatch: React.Dispatch<GameAction>,
    initiateCombatSequence: (narrative: string, suggestions: ActorSuggestion[], source?: any) => Promise<void>,
    setIsAiGenerating: (isGenerating: boolean) => void,
    submitAutomatedEvent?: any
) => {
    const { getCurrentZoneHostility, getCombatSlots } = useWorldSelectors(gameData);

    const initiateRest = useCallback(async (type: 'short' | 'long') => {
        if (!gameData || !submitAutomatedEvent) return;
        
        const duration = type === 'short' ? 1 : 8;
        const date = parseGameTime(gameData.currentTime);
        if (!date) return;
        
        const newDate = addDuration(date, duration);
        const newTime = formatGameTime(newDate);
        
        const hostility = getCurrentZoneHostility();
        const { roll, matrix } = generateEncounterRoll(`${type === 'short' ? 'Short' : 'Long'} Rest`, hostility);

        // Apply mechanical recovery
        let playerHeal = 0;
        const companionHeals: Record<string, number> = {};
        if (type === 'short') {
            const level = gameData.playerCharacter.level;
            for (let i = 0; i < level; i++) playerHeal += Math.floor(Math.random() * 8) + 1;
            gameData.companions.forEach(c => {
                let heal = 0;
                for (let i = 0; i < (c.level || 1); i++) heal += Math.floor(Math.random() * 8) + 1;
                companionHeals[c.id] = heal;
            });
        }

        const isSafe = roll.outcome !== 'Encounter';

        if (isSafe) {
            const genericMessage = type === 'short'
                ? "The party takes a brief respite to recover and perform routine maintenance. This pause allows you to restore focus and energy for the task ahead."
                : "The party secures their position and enters a period of extended rest and recuperation. You emerge fully restored and ready to continue.";

            // Log player intent and narrative response (Normal chat format)
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `rest-intent-${Date.now()}`,
                    sender: 'user',
                    content: `I take a ${type === 'short' ? 'Short' : 'Long'} Rest.`,
                    mode: 'CHAR'
                }
            });

            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `rest-narrative-${Date.now() + 1}`,
                    sender: 'ai',
                    content: genericMessage,
                    rolls: [roll],
                    type: 'neutral'
                }
            });

            // Apply mechanics (HP, Time, Abilities)
            dispatch({ type: 'REST', payload: { type, newTime, playerHeal, companionHeals } });
            setIsAiGenerating(false);
            return;
        }

        setIsAiGenerating(true);
        let isHostileIntent = false;
        let generativeCombatInstruction = "";
        let preRolledSummary = "";
        let preRolledRolls = [roll];
        let newGmNotes: string | undefined = undefined;

        if (roll.outcome === 'Encounter' && matrix) {
            const request: DiceRollRequest = {
                rollerName: gameData.playerCharacter.name,
                rollType: 'Skill Check',
                checkName: 'Perception',
                dc: 12 + Math.floor(gameData.playerCharacter.level / 2)
            };
            const res = window.processDiceRollsCache?.([request]) || { rolls: [], summary: "" };
            const skillRoll = res.rolls[0];
            preRolledRolls.push(skillRoll);
            preRolledSummary = res.summary;

            if (skillRoll.outcome === 'Fail' || skillRoll.outcome === 'Critical Fail') {
                const verifier = await verifyCombatRelevance('Perception', 'Campsite', "Resting in the wilds.", gameData.worldSummary || "");
                if (verifier.shouldTriggerCombat) {
                    isHostileIntent = true;
                    newGmNotes = await expandEncounterPlot(matrix, gameData.worldSummary || "");
                    generativeCombatInstruction = getUnifiedProceduralPrompt(matrix, false);
                } else {
                    generativeCombatInstruction = getSkillFailurePrompt('Perception', verifier.reason);
                }
            } else {
                generativeCombatInstruction = getSkillSuccessPrompt('Perception', matrix);
            }
        } else {
            generativeCombatInstruction = getClearPlotPrompt();
        }

        dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-rest-enc-${Date.now()}`, sender: 'system', content: `Danger Check: ${roll.total}${preRolledSummary ? '\n' + preRolledSummary : ''}`, rolls: preRolledRolls, type: 'neutral' } });

        dispatch({ type: 'REST', payload: { type, newTime, playerHeal, companionHeals } });

        const mechanicsResult = {
            diceRolls: preRolledRolls,
            mechanicsSummary: preRolledSummary,
            combatInstruction: generativeCombatInstruction,
            isHostileIntent,
            newGmNotes
        };

        const systemContext = `[SYSTEM] Player takes a ${type} rest. Narrative end time is ${newTime}.`;
        await submitAutomatedEvent(`I settle down for a ${type} rest.`, mechanicsResult, systemContext);
        
    }, [gameData, dispatch, initiateCombatSequence, getCurrentZoneHostility, getCombatSlots, setIsAiGenerating, submitAutomatedEvent]);

    const initiateWait = useCallback(async (hours: number) => {
        if (!gameData || !submitAutomatedEvent) return;
        
        const date = parseGameTime(gameData.currentTime);
        if (!date) return;
        
        const newDate = addDuration(date, hours);
        const newTime = formatGameTime(newDate);
        
        const hostility = getCurrentZoneHostility();
        const { roll, matrix } = generateEncounterRoll(`Wait (${hours}h)`, hostility);
        
        setIsAiGenerating(true);
        let isHostileIntent = false;
        let generativeCombatInstruction = "";
        let preRolledSummary = "";
        let preRolledRolls = [roll];
        let newGmNotes: string | undefined = undefined;

        if (roll.outcome === 'Encounter' && matrix) {
            const request: DiceRollRequest = {
                rollerName: gameData.playerCharacter.name,
                rollType: 'Skill Check',
                checkName: 'Perception',
                dc: 12 + Math.floor(gameData.playerCharacter.level / 2)
            };
            const res = window.processDiceRollsCache?.([request]) || { rolls: [], summary: "" };
            const skillRoll = res.rolls[0];
            preRolledRolls.push(skillRoll);
            preRolledSummary = res.summary;

            if (skillRoll.outcome === 'Fail' || skillRoll.outcome === 'Critical Fail') {
                const verifier = await verifyCombatRelevance('Perception', 'Wait Area', "Waiting in the area.", gameData.worldSummary || "");
                if (verifier.shouldTriggerCombat) {
                    isHostileIntent = true;
                    newGmNotes = await expandEncounterPlot(matrix, gameData.worldSummary || "");
                    generativeCombatInstruction = getUnifiedProceduralPrompt(matrix, false);
                } else {
                    generativeCombatInstruction = getSkillFailurePrompt('Perception', verifier.reason);
                }
            } else {
                generativeCombatInstruction = getSkillSuccessPrompt('Perception', matrix);
            }
        } else {
            generativeCombatInstruction = getClearPlotPrompt();
        }

        dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-wait-enc-${Date.now()}`, sender: 'system', content: `Danger Check: ${roll.total}${preRolledSummary ? '\n' + preRolledSummary : ''}`, rolls: preRolledRolls, type: 'neutral' } });

        dispatch({ type: 'WAIT', payload: { newTime } });

        const mechanicsResult = {
            diceRolls: preRolledRolls,
            mechanicsSummary: preRolledSummary,
            combatInstruction: generativeCombatInstruction,
            isHostileIntent,
            newGmNotes
        };

        const systemContext = `[SYSTEM] Player waits for ${hours} hour(s). Narrative end time is ${newTime}.`;
        await submitAutomatedEvent(`I wait for ${hours} hour(s).`, mechanicsResult, systemContext);

    }, [gameData, dispatch, initiateCombatSequence, getCurrentZoneHostility, getCombatSlots, setIsAiGenerating, submitAutomatedEvent]);

    return { initiateRest, initiateWait };
};

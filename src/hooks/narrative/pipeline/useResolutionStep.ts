// hooks/narrative/pipeline/useResolutionStep.ts

import React, { useCallback } from 'react';
import { GameData, DiceRollRequest, DiceRoll, GameAction, AIUpdatePayload } from '../../../types';
import { verifyCombatRelevance, expandEncounterPlot } from '../../../services/geminiService';
import { generateEncounterMatrix, getHazardPrompt, getSkillFailurePrompt, generateEncounterRoll, getClearPlotPrompt } from '../../../utils/EncounterMechanics';
import { AssessmentResult } from '../../../services/aiSkillAssessorService';
import { parseHostility } from '../../../utils/mapUtils';

export const useResolutionStep = (
    dispatch: React.Dispatch<GameAction>,
    combatActions: any
) => {
    const resolveMechanics = useCallback(async (
        assessment: AssessmentResult,
        gameData: GameData,
        isHeroic: boolean = false
    ): Promise<{
        diceRolls: DiceRoll[];
        mechanicsSummary: string;
        combatInstruction: string;
        isHostileIntent: boolean;
        newGmNotes?: string;
    }> => {
        let diceRolls: DiceRoll[] = [];
        let mechanicsSummary = "";
        let combatInstruction = "";
        let isHostileIntent = assessment.intentType === 'combat';
        let newGmNotes: string | undefined = undefined;

        // --- SYSTEM MANAGED VALIDATION: COMBAT PRESENCE GATE ---
        if (isHostileIntent) {
            const stagedHostiles = (gameData.combatState?.enemies || []).filter(e => !e.isAlly);

            // If the user intends to fight but no enemies are staged in the manager...
            if (stagedHostiles.length === 0) {
                const currentZone = gameData.mapZones?.find(z => z.coordinates === gameData.playerCoordinates);
                const hostility = currentZone ? parseHostility(currentZone.hostility) : 0;

                // Roll for a procedural ambush ("Spawning on Intent")
                const { roll, matrix } = generateEncounterRoll("Combat Readiness Audit", hostility);
                diceRolls.push(roll);

                if (roll.outcome === 'Encounter' && matrix) {
                    // AMBUSH TRIGGERED: Something WAS lurking. Expand the plot.
                    newGmNotes = await expandEncounterPlot(matrix, gameData.worldSummary || "");
                    combatInstruction = `\n[MANDATORY SYSTEM DIRECTIVE: PROCEDURAL AMBUSH]\nThe user attempted to initiate combat in a dangerous area. The audit has triggered a legitimate encounter.\n1. NARRATE the hostiles emerging or initiating a counter-attack.\n2. POPULATE 'suggestedActors' in your response.`;
                } else {
                    // NO FOES: The audit confirms the area is clear. 
                    // We cancel the mechanical combat phase and force a narrative fallback.
                    isHostileIntent = false;
                    combatInstruction = `\n[MANDATORY SYSTEM DIRECTIVE: GHOST COMBAT CANCELLED]\nThe user attempted combat, but the scene is empty and no ambush occurred.\n1. DO NOT initiate combat.\n2. NARRATE the character looking for a fight but finding no targets, or explain why there is nothing to attack in this locale.\n3. Return 'suggestedActors' as an empty array [].`;
                }
            }
        }

        // 1. Handle Skill/Ability Requests
        if (assessment.intentType === 'skill' && assessment.requests.length > 0) {
            // Inject heroic flag into requests
            const heroicRequests = assessment.requests.map(req => ({
                ...req,
                isHeroic: isHeroic
            }));

            // Pass the global heroic flag to processDiceRolls
            const res = combatActions.processDiceRolls(heroicRequests, { isHeroic: isHeroic });
            diceRolls = [...diceRolls, ...res.rolls];
            mechanicsSummary = res.summary;

            // Check for Critical Failures (Hazards)
            const hazardRoll = res.rolls.find((r: any) => r.notes?.includes('Hazard'));
            if (hazardRoll) {
                const totalDamage = res.rolls
                    .filter((r: any) => r.notes?.includes('Hazard') && r.hpChange)
                    .reduce((sum: number, r: any) => sum + (r.hpChange!.previousHp - r.hpChange!.newHp), 0);

                combatInstruction += getHazardPrompt((hazardRoll as any).hazardTier || 'Weak', (hazardRoll as any).hazardScope || 'Single', totalDamage);
            }

            // Check for Failure -> Combat Escalation
            const failedCheck = res.rolls.find((r: any) => r.outcome === 'Fail' || r.outcome === 'Critical Fail');
            if (failedCheck && !hazardRoll) {
                const verifier = await verifyCombatRelevance(
                    failedCheck.checkName,
                    gameData.currentLocale || "Open Area",
                    "User Action Attempted",
                    gameData.worldSummary || ""
                );

                if (verifier.shouldTriggerCombat) {
                    isHostileIntent = true;
                    const matrix = generateEncounterMatrix();

                    // NEW: Explicit Plot Expansion Step (Phase 1.5)
                    newGmNotes = await expandEncounterPlot(matrix, gameData.worldSummary || "");

                    combatInstruction = `\n[MANDATORY SYSTEM DIRECTIVE: COMBAT ENCOUNTER]\nThe failed check has triggered hostiles: ${verifier.reason}\n1. YOU MUST narrate the transition to combat.\n2. POPULATE 'suggestedActors' in your response.`;
                } else {
                    combatInstruction = getSkillFailurePrompt(failedCheck.checkName, verifier.reason);
                }
            }
        }

        return { diceRolls, mechanicsSummary, combatInstruction, isHostileIntent, newGmNotes };
    }, [dispatch, combatActions]);

    return { resolveMechanics };
};
// hooks/useCombatActions.ts

import React from 'react';
import { GameData, GameAction, ActorSuggestion, CombatActor } from '../types';
import { useUI, CombatTriggerSource } from '../context/UIContext';
import { useCombatState } from './combat/useCombatState';
import { useCombatResolution } from './combat/useCombatResolution';
import { useCombatGeneration } from './combat/useCombatGeneration';

type UIActions = ReturnType<typeof useUI>;

export const useCombatActions = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    ui: UIActions,
    weaveGrandDesign?: () => Promise<void>
) => {
    // 1. State Management (CRUD, Config)
    const stateActions = useCombatState(dispatch);

    // 2. Lifecycle Orchestrator (Actions, Turns, Resolution)
    const resolutionActions = useCombatResolution(gameData, dispatch, weaveGrandDesign);

    // 3. Procedural Generation (AI Spawning)
    const generationActions = useCombatGeneration(gameData, dispatch, ui);

    return {
        // From State Management
        startCombat: stateActions.startCombat,
        addCombatEnemy: stateActions.addCombatEnemy,
        updateCombatEnemy: stateActions.updateCombatEnemy,
        deleteCombatEnemy: stateActions.deleteCombatEnemy,
        duplicateCombatEnemy: stateActions.duplicateCombatEnemy,
        clearScene: stateActions.clearScene,
        updateTemplate: stateActions.updateTemplate,
        updateAffinity: stateActions.updateAffinity,
        updateSizeModifier: stateActions.updateSizeModifier,
        updateBaseScore: stateActions.updateBaseScore,
        updateArchetype: stateActions.updateArchetype,
        
        // From Resolution Orchestrator
        concludeCombat: resolutionActions.concludeCombat,
        takeAllLoot: resolutionActions.takeAllLoot,
        addToTurnOrder: resolutionActions.addToTurnOrder,
        removeFromTurnOrder: resolutionActions.removeFromTurnOrder,
        moveInTurnOrder: resolutionActions.moveInTurnOrder,
        removeActorFromTurnOrder: resolutionActions.removeFromTurnOrder, // Alias
        advanceTurn: resolutionActions.advanceTurn,
        processDiceRolls: resolutionActions.processDiceRolls,
        performPlayerAttack: resolutionActions.performPlayerAttack,
        performAutomatedPlayerTurn: resolutionActions.performAutomatedPlayerTurn,
        playNpcTurn: resolutionActions.playNpcTurn,
        performNarrativeRound: resolutionActions.performNarrativeRound,

        // From Spawning Engine
        addEnemyFromTemplate: generationActions.addEnemyFromTemplate,
        stageActors: generationActions.stageActors,
        initiateCombatSequence: generationActions.initiateCombatSequence,
        executeInitiationPipeline: generationActions.executeInitiationPipeline,
        processUserInitiatedCombat: generationActions.processUserInitiatedCombat
    };
};

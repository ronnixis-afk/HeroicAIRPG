// hooks/combat/useCombatResolution.ts

import React, { useEffect } from 'react';
import { GameData, GameAction } from '../../types';
import { useUI } from '../../context/UIContext';

// Sub-hooks (State/Lifecyle)
import { useCombatTurnOrder } from './useCombatTurnOrder';
import { useCombatDiceProcessor } from './useCombatDiceProcessor';
import { useCombatLootHandler } from './useCombatLootHandler';

// Sub-hooks (Action Logic - Refactored)
import { useManualActions } from './resolution/useManualActions';
import { useAutomatedActions } from './resolution/useAutomatedActions';
import { useNarrativeRound } from './resolution/useNarrativeRound';

export const useCombatResolution = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    weaveGrandDesign?: () => Promise<void>
) => {
    const { setIsAiGenerating, setLootState } = useUI();
    
    // Core Managers
    const { addToTurnOrder, removeFromTurnOrder, moveInTurnOrder, advanceTurn } = useCombatTurnOrder(dispatch);
    const { processDiceRolls } = useCombatDiceProcessor(gameData, dispatch);
    const { concludeCombat, takeAllLoot } = useCombatLootHandler(gameData, dispatch, weaveGrandDesign);

    // I agree: Caching the processor on the window allows the stateless World hooks (Travel/Time) 
    // to resolve "Danger Pipeline" checks without circular dependencies.
    useEffect(() => {
        (window as any).processDiceRollsCache = processDiceRolls;
    }, [processDiceRolls]);

    // Orchestrators (Refactored Sub-modules)
    const { performNarrativeRound } = useNarrativeRound(gameData, dispatch, processDiceRolls, setIsAiGenerating, setLootState);
    const { performPlayerAttack } = useManualActions(gameData, dispatch, processDiceRolls, setIsAiGenerating, performNarrativeRound);
    const { performAutomatedPlayerTurn, playNpcTurn } = useAutomatedActions(gameData, dispatch, processDiceRolls, setIsAiGenerating, performPlayerAttack, performNarrativeRound);

    return { 
        performPlayerAttack, 
        performAutomatedPlayerTurn, 
        playNpcTurn, 
        performNarrativeRound, 
        addToTurnOrder, 
        removeFromTurnOrder, 
        moveInTurnOrder, 
        advanceTurn, 
        processDiceRolls, 
        concludeCombat, 
        takeAllLoot 
    };
};

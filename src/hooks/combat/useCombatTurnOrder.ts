// hooks/combat/useCombatTurnOrder.ts

// FIX: Added React import to resolve missing namespace 'React' error
import React, { useCallback } from 'react';
import { GameAction } from '../../types';

export const useCombatTurnOrder = (dispatch: React.Dispatch<GameAction>) => {
    const addToTurnOrder = useCallback((actorId: string) => {
        dispatch({ type: 'ADD_TO_TURN_ORDER', payload: actorId });
    }, [dispatch]);

    const removeFromTurnOrder = useCallback((actorId: string) => {
        dispatch({ type: 'REMOVE_FROM_TURN_ORDER', payload: actorId });
    }, [dispatch]);

    const moveInTurnOrder = useCallback((actorId: string, direction: 'up' | 'down') => {
        dispatch({ type: 'MOVE_TURN_ORDER_ITEM', payload: { id: actorId, direction } });
    }, [dispatch]);
    
    const advanceTurn = useCallback(() => {
        dispatch({ type: 'ADVANCE_TURN' });
    }, [dispatch]);

    return {
        addToTurnOrder,
        removeFromTurnOrder,
        moveInTurnOrder,
        advanceTurn
    };
};

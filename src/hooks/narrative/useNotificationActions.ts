// hooks/narrative/useNotificationActions.ts

import React, { useCallback } from 'react';
import { GameAction, GameData } from '../../types';

/**
 * Centalized hook for managing "Seen" state of various game entities.
 * Clears the 'isNew' flag used for UI notifications.
 */
export const useNotificationActions = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>
) => {
    const markStoryLogAsSeen = useCallback((logId: string) => {
        if (!gameData) return;
        const log = gameData.story.find(l => l.id === logId);
        if (log && log.isNew) dispatch({ type: 'UPDATE_STORY_LOG', payload: { ...log, isNew: false } });
    }, [gameData, dispatch]);

    const markAllStoryLogsAsSeen = useCallback(() => { 
        dispatch({ type: 'MARK_ALL_STORY_SEEN' }); 
    }, [dispatch]);

    const markLoreAsSeen = useCallback((loreId: string) => {
        dispatch({ type: 'MARK_LORE_SEEN', payload: loreId });
    }, [dispatch]);

    const markKnowledgeAsSeen = useCallback((knowledgeId: string) => {
        dispatch({ type: 'MARK_KNOWLEDGE_SEEN', payload: knowledgeId });
    }, [dispatch]);

    const markObjectiveAsSeen = useCallback((objectiveId: string) => {
        dispatch({ type: 'MARK_OBJECTIVE_SEEN', payload: objectiveId });
    }, [dispatch]);

    const markNemesisAsSeen = useCallback((nemesisId: string) => {
        dispatch({ type: 'MARK_NEMESIS_SEEN', payload: nemesisId });
    }, [dispatch]);

    const markAllNpcsAsSeen = useCallback(() => { 
        dispatch({ type: 'MARK_ALL_NPCS_SEEN' }); 
    }, [dispatch]);

    const markAllPlotPointsAsSeen = useCallback(() => { 
        dispatch({ type: 'MARK_ALL_PLOT_POINTS_SEEN' }); 
    }, [dispatch]);

    const markAllMapZonesAsSeen = useCallback(() => { 
        dispatch({ type: 'MARK_ALL_MAP_ZONES_SEEN' }); 
    }, [dispatch]);

    const markInventoryItemAsSeen = useCallback((itemId: string, ownerId: string) => {
         dispatch({ type: 'MARK_ITEM_SEEN', payload: { itemId, ownerId } });
    }, [dispatch]);

    return {
        markStoryLogAsSeen,
        markAllStoryLogsAsSeen,
        markLoreAsSeen,
        markKnowledgeAsSeen,
        markObjectiveAsSeen,
        markNemesisAsSeen,
        markAllNpcsAsSeen,
        markAllPlotPointsAsSeen,
        markAllMapZonesAsSeen,
        markInventoryItemAsSeen
    };
};
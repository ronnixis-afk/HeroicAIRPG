// hooks/world/useLoreActions.ts

import React, { useCallback } from 'react';
import { GameAction, LoreEntry, PlotPoint } from '../../types';

export const useLoreActions = (dispatch: React.Dispatch<GameAction>) => {

    const updateWorldLore = useCallback(async (lore: LoreEntry) => {
        dispatch({ type: 'UPDATE_LORE', payload: lore });
    }, [dispatch]);

    const addWorldLore = useCallback((newLores: Omit<LoreEntry, 'id'>[]) => {
        dispatch({ type: 'ADD_LORE', payload: newLores });
    }, [dispatch]);

    const deleteWorldLore = useCallback((loreId: string) => {
        dispatch({ type: 'DELETE_LORE', payload: loreId });
    }, [dispatch]);

    const updateKnowledge = useCallback(async (knowledge: LoreEntry) => {
        dispatch({ type: 'UPDATE_KNOWLEDGE', payload: knowledge });
    }, [dispatch]);

    const addKnowledge = useCallback((newKnowledge: Omit<LoreEntry, 'id'>[]) => {
        dispatch({ type: 'ADD_KNOWLEDGE', payload: newKnowledge });
    }, [dispatch]);

    const deleteKnowledge = useCallback((knowledgeId: string) => {
        dispatch({ type: 'DELETE_KNOWLEDGE', payload: knowledgeId });
    }, [dispatch]);

    const updateObjective = useCallback(async (objective: LoreEntry) => {
        dispatch({ type: 'UPDATE_OBJECTIVE', payload: objective });
    }, [dispatch]);

    const deleteObjective = useCallback((objectiveId: string) => {
        dispatch({ type: 'DELETE_OBJECTIVE', payload: objectiveId });
    }, [dispatch]);

    const trackObjective = useCallback(async (objectiveId: string | null) => {
        dispatch({ type: 'TRACK_OBJECTIVE', payload: objectiveId });
    }, [dispatch]);

    const addPlotPoint = useCallback((point: PlotPoint) => {
        dispatch({ type: 'ADD_PLOT_POINT', payload: point });
    }, [dispatch]);

    const deletePlotPoint = useCallback((id: string) => {
        dispatch({ type: 'DELETE_PLOT_POINT', payload: id });
    }, [dispatch]);

    const updatePlotPoint = useCallback((point: PlotPoint) => {
        dispatch({ type: 'UPDATE_PLOT_POINT', payload: point });
    }, [dispatch]);

    return {
        updateWorldLore,
        addWorldLore,
        deleteWorldLore,
        updateKnowledge,
        addKnowledge,
        deleteKnowledge,
        updateObjective,
        deleteObjective,
        trackObjective,
        addPlotPoint,
        deletePlotPoint,
        updatePlotPoint
    };
};
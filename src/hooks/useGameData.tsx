
// hooks/useGameData.tsx

import React, { useReducer, useCallback, useEffect, useState } from 'react';
import { gameReducer } from '../reducers/game_reducer';
import { 
    GameData,
    GalleryMetadata, 
    GalleryEntry,
    StoryLog
} from '../types';
import { 
    generateNemesis,
    generateActionSuggestions,
    generateGrandDesign
} from '../services/geminiService';
import { useCharacterActions } from './useCharacterActions';
import { useInventoryActions } from './useInventoryActions';
import { useCombatActions } from './useCombatActions';
import { useWorldActions } from './useWorldActions';
import { usePersistence } from './persistence/usePersistence';
import { useLoreActions } from './world/useLoreActions';
import { useNpcActions } from './social/useNpcActions';
import { useNarrativeManager } from './narrative/useNarrativeManager';
import { useNotificationActions } from './narrative/useNotificationActions';
import { useSystemSettings } from './system/useSystemSettings';
import { useUI } from '../context/UIContext';
import { detectMentionedNpcs } from '../utils/npcUtils';
import { dbService } from '../services/dbService';
import { worldService } from '../services/worldService';
import { useEffectLocaleSync } from './world/useEffectLocaleSync';

export const useGameData = (worldId: string, ui: ReturnType<typeof useUI>) => {
    const [gameData, dispatch] = useReducer(gameReducer, null);
    const [gallery, setGallery] = useState<GalleryMetadata[]>([]);
    const [worldName, setWorldName] = useState<string>('Adventure');
    
    const { 
        setIsLoading, 
        setError, 
        setIsAiGenerating,
        isLoading,
        setActiveView
    } = ui;

    const { storageUsage, saveWorldProgress } = usePersistence(worldId, gameData, gallery, dispatch, setIsLoading, setError, isLoading);

    useEffect(() => {
        if (worldId) {
            dbService.getGalleryMetadata<GalleryMetadata>(worldId).then(setGallery);
            worldService.getWorldById(worldId).then(w => {
                if (w) setWorldName(w.name);
            });
        }
    }, [worldId]);

    useEffectLocaleSync(gameData, dispatch);

    const weaveGrandDesign = useCallback(async () => {
        if (!gameData) return;
        setIsAiGenerating(true);
        try {
            const design = await generateGrandDesign(gameData);
            const mentionedNpcIds = detectMentionedNpcs(design, gameData.npcs || [], 2);
            dispatch({ type: 'UPDATE_GRAND_DESIGN', payload: { design, connectedNpcIds: mentionedNpcIds } });
        } catch (e) {
            console.error("Grand Design failed", e);
        } finally {
            setIsAiGenerating(false);
        }
    }, [gameData, dispatch, setIsAiGenerating]);

    const characterActions = useCharacterActions(gameData, dispatch, ui, weaveGrandDesign);
    const inventoryActions = useInventoryActions(gameData, dispatch);
    const combatActions = useCombatActions(gameData, dispatch, ui, weaveGrandDesign);
    
    // Core Managers (Pre-declared for Hook dependencies)
    const systemSettings = useSystemSettings(gameData, dispatch);

    const { 
        submitUserMessage,
        submitAutomatedEvent,
        setMessages, 
        applyAiUpdates,
        summarizeDayLog,
        summarizePastStoryLogs,
        generateObjectiveFollowUp
    } = useNarrativeManager(gameData, dispatch, { 
        combatActions, 
        setIsAiGenerating, 
        processUserInitiatedTravel: (content: string, intent?: any) => worldActions.processUserInitiatedTravel(content, intent),
        weaveGrandDesign
    });

    // World Actions (Now depends on submitAutomatedEvent)
    const worldActions = useWorldActions(gameData, dispatch, combatActions.initiateCombatSequence, setIsAiGenerating, submitAutomatedEvent);
    const loreActions = useLoreActions(dispatch);
    const npcActions = useNpcActions(gameData, dispatch, ui, combatActions, characterActions.integrateCharacter);
    const notificationActions = useNotificationActions(gameData, dispatch);

    const attemptObjectiveTurnIn = useCallback(async (objectiveId: string) => {
        if (!gameData) return;
        const objective = gameData.objectives.find(o => o.id === objectiveId);
        if (!objective) return;
        setIsLoading(true);
        try {
            dispatch({ type: 'UPDATE_OBJECTIVE', payload: { ...objective, status: 'completed' } });
            dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-obj-comp-${Date.now()}`, sender: 'system', content: `Objective completed: ${objective.title}`, type: 'positive' } });
            weaveGrandDesign();
        } finally { 
            setIsLoading(false); 
        }
    }, [gameData, dispatch, setIsLoading, weaveGrandDesign]);

    const updateStoryLog = useCallback(async (log: StoryLog) => { 
        dispatch({ type: 'UPDATE_STORY_LOG', payload: log }); 
    }, [dispatch]);

    const removeStoryLogsByMessageIds = useCallback((messageIds: string[]) => { 
        dispatch({ type: 'REMOVE_STORY_LOGS_BY_MESSAGE', payload: messageIds }); 
    }, [dispatch]);

    const deleteStoryLog = useCallback((id: string) => { 
        dispatch({ type: 'DELETE_STORY_LOG', payload: id }); 
    }, [dispatch]);

    const weaveNarrative = useCallback(async () => {}, []);
    
    const generateAndAddNemesis = useCallback(async (prompt: string) => {
        if (!gameData) return;
        setIsLoading(true);
        try {
            const nemesis = await generateNemesis(prompt, gameData);
            dispatch({ type: 'ADD_NEMESIS', payload: { ...nemesis, id: `nem-${Date.now()}`, isNew: true } });
        } finally { 
            setIsLoading(false); 
        }
    }, [gameData, dispatch, setIsLoading]);

    const deleteNemesis = useCallback((nemesisId: string) => {
        dispatch({ type: 'DELETE_NEMESIS', payload: nemesisId });
    }, [dispatch]);

    const updateNemesis = useCallback(async (nemesis: any) => {
        dispatch({ type: 'UPDATE_NEMESIS', payload: nemesis });
    }, [dispatch]);

    const addGalleryEntry = useCallback(async (entry: Omit<GalleryEntry, 'worldId'>) => {
        if (!worldId) return;
        const fullEntry: GalleryEntry = { ...entry, worldId };
        await dbService.putGalleryEntry(fullEntry);
        const { imageUrl, ...metadata } = fullEntry;
        setGallery(prev => [...prev, metadata]);
    }, [worldId]);

    const deleteGalleryEntry = useCallback(async (id: string) => {
        await dbService.deleteGalleryEntry(id);
        setGallery(prev => prev.filter(e => e.id !== id));
    }, []);

    const fetchActionSuggestions = useCallback(async () => {
        if (!gameData) return [];
        return await generateActionSuggestions(gameData);
    }, [gameData]);

    return {
        gameData, 
        gallery, 
        worldName, 
        storageUsage, 
        ...characterActions, 
        ...inventoryActions, 
        ...combatActions, 
        ...worldActions, 
        ...loreActions, 
        ...npcActions, 
        ...notificationActions,
        ...systemSettings,
        useHeroicPoint: characterActions.useHeroicPoint,
        submitUserMessage,
        submitAutomatedEvent,
        setMessages, 
        applyAiUpdates, 
        attemptObjectiveTurnIn,
        generateObjectiveFollowUp, 
        updateStoryLog, 
        removeStoryLogsByMessageIds, 
        deleteStoryLog,
        summarizeDayLog, 
        summarizePastStoryLogs, 
        weaveNarrative,
        updateMapZoneAction: worldActions.updateMapZone, 
        movePlayerOnMapAction: worldActions.movePlayerOnMap,
        updateBaseScoreAction: combatActions.updateBaseScore,
        generateMapFromLoreAction: worldActions.generateMapFromLore,
        fetchActionSuggestions,
        saveWorldProgress, 
        integrateRefinedCharacter: characterActions.integrateRefinedCharacter, 
        integrateCharacter: characterActions.integrateCharacter,
        addGalleryEntry, 
        deleteGalleryEntry,
        weaveGrandDesign,
        generateAndAddNemesis, 
        deleteNemesis, 
        updateNemesis,
        dispatch
    };
};

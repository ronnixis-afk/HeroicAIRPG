// hooks/system/useSystemSettings.ts

import React, { useCallback } from 'react';
import { 
    GameAction, 
    GameData, 
    NarrationVoice, 
    NarrationTone, 
    ImageGenerationStyle, 
    Difficulty, 
    SkillConfiguration, 
    CombatConfiguration 
} from '../../types';
import { generateGmNotes } from '../../services/geminiService';
import { useUI } from '../../context/UIContext';

export const useSystemSettings = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>
) => {
    const { setIsLoading } = useUI();

    const updateGmSettings = useCallback(async (settings: string) => { 
        dispatch({ type: 'UPDATE_GM_SETTINGS', payload: settings }); 
    }, [dispatch]);

    const updateGmNotes = useCallback(async (notes: string) => { 
        dispatch({ type: 'UPDATE_GM_NOTES', payload: notes }); 
    }, [dispatch]);

    const regenerateGmNotes = useCallback(async () => {
        if (!gameData) return;
        setIsLoading(true);
        try {
            const notes = await generateGmNotes(gameData);
            dispatch({ type: 'UPDATE_GM_NOTES', payload: notes });
        } finally { 
            setIsLoading(false); 
        }
    }, [gameData, dispatch, setIsLoading]);

    const updateWorldSummary = useCallback((summary: string) => {
        dispatch({ type: 'UPDATE_WORLD_SUMMARY', payload: summary });
    }, [dispatch]);

    const updateNarrationVoice = useCallback((voiceName: NarrationVoice) => { 
        dispatch({ type: 'SET_NARRATION_VOICE', payload: voiceName }); 
    }, [dispatch]);

    const updateNarrationTone = useCallback((tone: NarrationTone) => { 
        dispatch({ type: 'SET_NARRATION_TONE', payload: tone }); 
    }, [dispatch]);

    const updateImageGenerationStyle = useCallback((style: ImageGenerationStyle) => { 
        dispatch({ type: 'SET_IMAGE_STYLE', payload: style }); 
    }, [dispatch]);

    const updateIsMature = useCallback((isMature: boolean) => { 
        dispatch({ type: 'SET_IS_MATURE', payload: isMature }); 
    }, [dispatch]);

    const updateIsHandsFree = useCallback((isHandsFree: boolean) => { 
        dispatch({ type: 'SET_HANDS_FREE', payload: isHandsFree }); 
    }, [dispatch]);

    const updateUseAiTts = useCallback((useAiTts: boolean) => { 
        dispatch({ type: 'SET_USE_AI_TTS', payload: useAiTts }); 
    }, [dispatch]);

    const updateCurrentTime = useCallback((time: string) => { 
        dispatch({ type: 'UPDATE_CURRENT_TIME', payload: time }); 
    }, [dispatch]);

    const updateDifficulty = useCallback((difficulty: Difficulty) => { 
        dispatch({ type: 'SET_DIFFICULTY', payload: difficulty }); 
    }, [dispatch]);

    const updateImageGenerationModel = useCallback((model: string) => { 
        dispatch({ type: 'SET_IMAGE_MODEL', payload: model }); 
    }, [dispatch]);

    const updateSkillConfiguration = useCallback((config: SkillConfiguration) => {
        dispatch({ type: 'SET_SKILL_CONFIGURATION', payload: config });
    }, [dispatch]);

    const updateCombatConfiguration = useCallback((config: CombatConfiguration) => {
        dispatch({ type: 'UPDATE_COMBAT_CONFIGURATION', payload: config });
    }, [dispatch]);

    const generateBriefFromContext = useCallback(async () => {
        // Placeholder for context-driven brief generation
        console.log("Brief generation triggered");
    }, []);

    const resetWorld = useCallback(() => {
        dispatch({ type: 'RESET_WORLD' });
    }, [dispatch]);

    const restartAdventure = useCallback(() => {
        dispatch({ type: 'RESTART_ADVENTURE' });
    }, [dispatch]);

    return {
        updateGmSettings,
        updateGmNotes,
        regenerateGmNotes,
        updateWorldSummary,
        updateNarrationVoice,
        updateNarrationTone,
        updateImageGenerationStyle,
        updateIsMature,
        updateIsHandsFree,
        updateUseAiTts,
        updateUseAiTtsAction: updateUseAiTts, // Alias
        updateCurrentTime,
        updateDifficulty,
        updateImageGenerationModel,
        updateImageGenerationStyleAction: updateImageGenerationStyle, // Alias
        updateSkillConfiguration,
        updateCombatConfiguration,
        generateBriefFromContext,
        resetWorld,
        restartAdventure
    };
};
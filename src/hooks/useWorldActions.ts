// hooks/useWorldActions.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, ActorSuggestion, MapZone, MapSettings, LoreEntry } from '../types';
import { useWorldSelectors } from './world/useWorldSelectors';
import { useTravel } from './world/useTravel';
import { useTime } from './world/useTime';
import { useExploration } from './world/useExploration';
import { generatePoisForZone, generatePoiDetail } from '../services/geminiService';
import { getDiscoveryXP } from '../utils/mechanics';
import { useUI } from '../context/UIContext';

export const useWorldActions = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    initiateCombatSequence: (narrative: string, suggestions: ActorSuggestion[], source?: any) => Promise<void>,
    setIsAiGenerating: (isGenerating: boolean) => void,
    submitAutomatedEvent?: any
) => {
    // This function can be passed into parallel background loaders to dispatch loading/resolved states individually
    const dispatchZoneUpdate = useCallback((zone: MapZone) => {
        dispatch({ type: 'UPDATE_MAP_ZONE', payload: zone });
    }, [dispatch]);

    const { setMapGenerationProgress } = useUI();

    // 1. Data Selectors
    const { getCurrentZoneHostility } = useWorldSelectors(gameData);

    // 2. Travel & Movement Logic
    const {
        initiateTravel,
        processUserInitiatedTravel,
        processArrival
    } = useTravel(gameData, dispatch, initiateCombatSequence, setIsAiGenerating, submitAutomatedEvent);

    // 3. Time & Resting Logic
    const {
        initiateRest,
        initiateWait
    } = useTime(gameData, dispatch, initiateCombatSequence, setIsAiGenerating, submitAutomatedEvent);

    // 4. Exploration & Investigation Logic
    const {
        investigateDiscovery
    } = useExploration(gameData, dispatch, initiateCombatSequence, setIsAiGenerating, submitAutomatedEvent);

    // --- Spatial Logic & Setters ---
    const updateMapZone = useCallback((zone: MapZone) => { dispatch({ type: 'UPDATE_MAP_ZONE', payload: zone }); }, [dispatch]);
    const movePlayerOnMap = useCallback((coordinates: string) => { dispatch({ type: 'MOVE_PLAYER_ON_MAP', payload: coordinates }); }, [dispatch]);
    const updateMapSettings = useCallback((settings: MapSettings) => { dispatch({ type: 'UPDATE_MAP_SETTINGS', payload: settings }); }, [dispatch]);

    const lazyLoadPois = useCallback(async (zone: MapZone) => {
        if (!gameData) return;
        try {
            const pois = await generatePoisForZone(zone, gameData.worldSummary || '', gameData.mapSettings);
            const slicedPois = Array.isArray(pois) ? pois.slice(0, 3) : [];
            const newKnowledge: Omit<LoreEntry, 'id'>[] = slicedPois.map(p => ({ title: p.title, content: p.content, coordinates: zone.coordinates, tags: p.isPopulationCenter ? ['location', 'population-center'] : ['location'], isNew: true, visited: false }));
            dispatch({ type: 'ADD_KNOWLEDGE', payload: newKnowledge });
        } catch (e) { console.error(e); }
    }, [gameData, dispatch]);

    const syncCurrentLocaleToPoi = useCallback(async (zone: MapZone, localeName: string) => {
        if (!gameData || !localeName || localeName === "Open Area" || localeName === "The Wilds") return;

        try {
            const detail = await generatePoiDetail(localeName, zone.name, zone.description || '', gameData.worldSummary || '');
            const newEntry: Omit<LoreEntry, 'id'> = {
                title: localeName,
                content: detail,
                coordinates: zone.coordinates,
                tags: ['location'],
                isNew: true,
                visited: true
            };
            dispatch({ type: 'ADD_KNOWLEDGE', payload: [newEntry] });
            dispatch({ type: 'AWARD_XP', payload: { amount: Math.floor(getDiscoveryXP(gameData.playerCharacter.level) / 2), source: `Explored ${localeName}` } });
        } catch (e) {
            console.error("Locale sync failed", e);
        }
    }, [gameData, dispatch]);

    return {
        // Simple Setters
        updateMapZone,
        movePlayerOnMap,
        updateMapSettings,

        // Core functionality
        getCurrentZoneHostility,
        initiateTravel,
        processUserInitiatedTravel,
        processArrival,
        initiateRest,
        initiateWait,
        investigateDiscovery,

        // Complex Generation
        lazyLoadPois,
        syncCurrentLocaleToPoi
    };
};
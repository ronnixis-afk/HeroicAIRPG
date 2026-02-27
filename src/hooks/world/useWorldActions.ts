// hooks/world/useWorldActions.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, ActorSuggestion, MapZone, MapSector, MapSettings, LoreEntry } from '../../types';
import { useWorldSelectors } from './useWorldSelectors';
import { useTravel } from './useTravel';
import { useTime } from './useTime';
import { useExploration } from './useExploration';
import { generateMapSectorDetails, generatePoisForZone, generatePoiDetail, generateMapLayoutFromLore } from '../../services/geminiService';
import { getDiscoveryXP } from '../../utils/mechanics';
import { useUI } from '../../context/UIContext';

export const useWorldActions = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    initiateCombatSequence: (narrative: string, suggestions: ActorSuggestion[], source?: any) => Promise<void>,
    setIsAiGenerating: (isGenerating: boolean) => void,
    /* Fix: Accept submitAutomatedEvent as the 5th argument to resolve argument count errors in useGameData.tsx */
    submitAutomatedEvent?: any
) => {
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
    const updateSector = useCallback((sector: MapSector) => { dispatch({ type: 'UPDATE_SECTOR', payload: sector }); }, [dispatch]);
    const deleteSector = useCallback((id: string) => { dispatch({ type: 'DELETE_SECTOR', payload: id }); }, [dispatch]);

    const generateAndAddSector = useCallback(async () => {
        if (!gameData) return;
        setMapGenerationProgress({ isActive: true, step: 'Generating sector...', progress: 50 });
        try {
            const sectorData = await generateMapSectorDetails(gameData);
            const newSector: MapSector = { id: `sector-${Date.now()}`, name: sectorData.name || 'Unknown Sector', description: sectorData.description || '', color: sectorData.color || '#cccccc', coordinates: [], keywords: sectorData.keywords || [] };
            dispatch({ type: 'ADD_SECTOR', payload: newSector });
        } finally { setMapGenerationProgress({ isActive: false, step: '', progress: 0 }); }
    }, [gameData, dispatch, setMapGenerationProgress]);

    const lazyLoadPois = useCallback(async (zone: MapZone) => {
        if (!gameData) return;
        try {
            const pois = await generatePoisForZone(zone, gameData.worldSummary || '', gameData.mapSettings);
            const slicedPois = Array.isArray(pois) ? pois.slice(0, 3) : [];
            const newKnowledge: Omit<LoreEntry, 'id'>[] = slicedPois.map(p => ({ title: p.title, content: p.content, coordinates: zone.coordinates, tags: ['location'], isNew: true, visited: false }));
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

    const generateMapFromLore = useCallback(async () => {
        if (!gameData) return;
        setMapGenerationProgress({ isActive: true, step: 'Analyzing lore...', progress: 30 });
        try {
            await generateMapLayoutFromLore(gameData.world, gameData.mapSettings!);
        } catch (e) {
            console.error("Map generation from lore failed", e);
        } finally {
            setMapGenerationProgress({ isActive: false, step: '', progress: 0 });
        }
    }, [gameData, setMapGenerationProgress]);

    return {
        // Simple Setters
        updateMapZone,
        movePlayerOnMap,
        updateMapSettings,
        updateSector,
        deleteSector,

        // Core functionality
        getCurrentZoneHostility,
        initiateTravel,
        processUserInitiatedTravel,
        processArrival,
        initiateRest,
        initiateWait,
        investigateDiscovery,

        // Complex Generation
        generateAndAddSector,
        lazyLoadPois,
        syncCurrentLocaleToPoi,
        generateMapFromLore
    };
};
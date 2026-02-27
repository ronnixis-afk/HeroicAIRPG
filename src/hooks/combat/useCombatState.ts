// hooks/combat/useCombatState.ts

import React, { useCallback } from 'react';
import { GameAction, CombatActor, EnemyTemplate, AffinityDefinition, CombatActorSize, ArchetypeName, GameData } from '../../types';
import { createDefaultCombatActor } from '../../utils/mechanics';
import { combatActorToNPC } from '../../utils/npcUtils';

export const useCombatState = (dispatch: React.Dispatch<GameAction>) => {

    const startCombat = useCallback(() => {
        dispatch({ type: 'START_COMBAT' });
    }, [dispatch]);

    const addCombatEnemy = useCallback((enemyData: Partial<CombatActor>, currentPOI?: string) => {
        const defaultEnemy = createDefaultCombatActor();
        const id = enemyData.id || `enemy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const newEnemy: CombatActor = {
            ...defaultEnemy,
            ...enemyData,
            id,
            abilityScores: enemyData.abilityScores ? { ...defaultEnemy.abilityScores, ...enemyData.abilityScores } : defaultEnemy.abilityScores,
            savingThrows: enemyData.savingThrows ? { ...defaultEnemy.savingThrows, ...enemyData.savingThrows } : defaultEnemy.savingThrows,
        };
        
        dispatch({ type: 'ADD_COMBAT_ENEMY', payload: newEnemy });

        // Bidirectional Sync: Register the actor in the Lore Registry (NPCs)
        // INDUSTRY STANDARD: currentPOI is allowed to be an empty string (Open Area/Wilds)
        dispatch({ type: 'ADD_NPC', payload: combatActorToNPC(newEnemy, currentPOI || "") });
    }, [dispatch]);

    const updateCombatEnemy = useCallback((enemy: CombatActor) => {
        dispatch({ type: 'UPDATE_COMBAT_ENEMY', payload: enemy });
    }, [dispatch]);

    const deleteCombatEnemy = useCallback((enemyId: string) => {
         dispatch({ type: 'DELETE_COMBAT_ENEMY', payload: enemyId });
    }, [dispatch]);

    const duplicateCombatEnemy = useCallback((enemyId: string) => {
        dispatch({ type: 'DUPLICATE_COMBAT_ENEMY', payload: enemyId });
    }, [dispatch]);

    const clearScene = useCallback(() => {
        dispatch({ type: 'CLEAR_SCENE' });
    }, [dispatch]);

    const updateTemplate = useCallback((key: string, template: EnemyTemplate) => {
        dispatch({ type: 'UPDATE_TEMPLATE', payload: { key, template } });
    }, [dispatch]);

    const updateAffinity = useCallback((key: string, affinity: AffinityDefinition) => {
        dispatch({ type: 'UPDATE_AFFINITY', payload: { key, affinity } });
    }, [dispatch]);

    const updateSizeModifier = useCallback((size: CombatActorSize, mods: { str: number; dex: number; con: number; ac: number }) => {
        dispatch({ type: 'UPDATE_SIZE_MODIFIER', payload: { size, mods } });
    }, [dispatch]);

    const updateBaseScore = useCallback((score: number) => {
        dispatch({ type: 'UPDATE_BASE_SCORE', payload: score });
    }, [dispatch]);

    const updateArchetype = useCallback((name: ArchetypeName, speeds: { ground: number; climb: number; swim: number; fly: number }) => {
        dispatch({ type: 'UPDATE_ARCHETYPE', payload: { name, speeds } });
    }, [dispatch]);

    return {
        startCombat,
        addCombatEnemy,
        updateCombatEnemy,
        deleteCombatEnemy,
        duplicateCombatEnemy,
        clearScene,
        updateTemplate,
        updateAffinity,
        updateSizeModifier,
        updateBaseScore,
        updateArchetype
    };
};
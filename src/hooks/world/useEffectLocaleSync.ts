// hooks/world/useEffectLocaleSync.ts

// Fix: Import React to resolve missing namespace 'React' error for React.Dispatch
import React, { useEffect, useRef } from 'react';
import { GameAction, GameData } from '../../types';
import { isLocaleMatch } from '../../utils/mapUtils';
import { npcToCombatActor } from '../../utils/npcUtils';

/**
 * Hardened effect logic to synchronize the mechanical scene actors with the narrative locale.
 * Automatically identifies NPCs present in the same room/building and stages them for potential combat.
 */
export const useEffectLocaleSync = (
    gameData: GameData | null,
    // Fix: Added React.Dispatch type to correctly type the dispatch function
    dispatch: React.Dispatch<GameAction>
) => {
    const lastSyncStateRef = useRef<string>(''); 
    const localeSyncIdsRef = useRef<string[]>([]);

    useEffect(() => {
        if (!gameData || gameData.combatState?.isActive) return;

        const currentLocale = gameData.currentLocale || ""; 
        const playerLevel = gameData.playerCharacter.level || 1;
        const baseScore = gameData.combatBaseScore ?? 8;
        const templates = gameData.templates;
        const partyNames = new Set(gameData.companions.map(c => c.name.toLowerCase().trim()));
        
        // 1. Identify NPCs at the current locale using semantic container matching
        const nearbyNPCs = (gameData.npcs || []).filter(npc => {
            const npcPOI = npc.currentPOI || "";
            // USE isLocaleMatch for hierarchical awareness (e.g. Bar -> Bar Table)
            const isAtLocale = isLocaleMatch(npcPOI, currentLocale);
            const inParty = npc.companionId || partyNames.has(npc.name?.toLowerCase().trim() || '');
            const isAlive = npc.status !== 'Dead';
            return isAtLocale && !inParty && !npc.isShip && isAlive;
        });

        // 2. Comparison Logic (Performance optimized string check)
        const syncTargetString = JSON.stringify(nearbyNPCs.map(n => ({ 
            id: n.id, 
            t: n.template, 
            d: n.difficulty,
            s: n.status,
            p: n.currentPOI
        })));
        
        if (syncTargetString !== lastSyncStateRef.current) {
            const newActors = nearbyNPCs.map(npc => npcToCombatActor(npc, playerLevel, baseScore, templates));
            const newSyncIds = newActors.map(a => a.id);

            dispatch({ 
                type: 'SYNC_SCENE_ACTORS', 
                payload: { 
                    newActors, 
                    removeStaleIds: localeSyncIdsRef.current.filter(id => !newSyncIds.includes(id)) 
                } 
            });

            lastSyncStateRef.current = syncTargetString;
            localeSyncIdsRef.current = newSyncIds;
        }
    }, [
        gameData?.currentLocale, 
        gameData?.npcs, 
        gameData?.combatBaseScore,
        gameData?.templates,
        gameData?.combatState?.isActive, 
        gameData?.playerCharacter.level,
        gameData?.messages.length 
    ]);
};
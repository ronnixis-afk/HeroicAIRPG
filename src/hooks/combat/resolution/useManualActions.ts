// hooks/combat/resolution/useManualActions.ts

import React, { useCallback } from 'react';
import { GameData, GameAction } from '../../../types/Game';
import { Item } from '../../../types/Items';
import { Ability, PlayerCharacter, Companion } from '../../../types/Characters';
import { RollMode } from '../../../types/Core';
import { ChatMessage, DiceRollRequest } from '../../../types/World';
import { generateResponse } from '../../../services/geminiService';
import { useUI } from '../../../context/UIContext';

export const useManualActions = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    processDiceRolls: any,
    setIsAiGenerating: (val: boolean) => void,
    performNarrativeRound: any
) => {
    const { isHeroicModeActive, setIsHeroicModeActive } = useUI();

    const performPlayerAttack = useCallback(async (source: Item | Ability, targetIds: string[], flavorText?: string, mode: RollMode = 'normal', sourceActorId?: string) => {
        // Phase 2: Capture and consume Heroic state immediately to anchor the async flow.
        // We spending the point here as the single source of authority for manual actions.
        const wasHeroic = isHeroicModeActive;
        
        if (wasHeroic) {
            dispatch({ type: 'USE_HEROIC_POINT' });
            setIsHeroicModeActive(false);
        }

        if (!gameData || targetIds.length === 0) return;
        
        if (gameData.combatConfiguration?.narrativeCombat) {
            // Future compatibility: Ensure narrative rounds can eventually receive the heroic intent
            return performNarrativeRound(source, targetIds, flavorText, mode, sourceActorId, wasHeroic);
        }
        
        let actorInstance = gameData.playerCharacter as PlayerCharacter | Companion;
        let actorInventory = gameData.playerInventory;
        const ownerId = sourceActorId || gameData.playerCharacter.id;

        if (sourceActorId && sourceActorId !== gameData.playerCharacter.id) {
            const companion = gameData.companions.find(c => c.id === sourceActorId);
            if (companion) {
                actorInstance = companion;
                actorInventory = gameData.companionInventories[companion.id];
            }
        }
        
        const enemies = gameData.combatState?.enemies || [];
        const allies = [gameData.playerCharacter, ...gameData.companions.filter(c => c.isInParty !== false)]; 
        const allPotentialTargets = [...enemies, ...allies];
        let validTargetIds = targetIds;
        
        const effect = 'effect' in source ? source.effect : undefined;
        const isHealingAction = effect && (effect.type === 'Heal' || !!effect.healDice);

        if (!isHealingAction) {
            validTargetIds = targetIds.filter(id => {
                const target = allPotentialTargets.find(t => t.id === id);
                return target && (target.currentHitPoints || 0) > 0;
            });
            if (validTargetIds.length === 0 && targetIds.length > 0) {
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-invalid-${Date.now()}`, sender: 'system', content: "Target(s) are already defeated.", type: 'neutral' } });
                return;
            }
        }

        const requests: DiceRollRequest[] = [];
        const isWeaponAttack = 'tags' in source && source.tags?.some(t => t.toLowerCase().includes('weapon'));
        
        // General Multi-Target Detection (AoE/Chain/Burst)
        const isMultiTargetAction = effect?.targetType === 'Multiple';

        if (isMultiTargetAction) {
            // Logic Gate: Single request for Area Effect. 
            // The dice engine (calculateDiceRolls) detects 'Multiple' and automatically expands one request to every valid target in the pool.
            requests.push({ 
                rollerName: actorInstance.name, 
                rollType: isHealingAction ? 'Healing Roll' : 'Attack Roll', 
                checkName: source.name, 
                targetName: actorInstance.name, // Placeholder, engine overrides based on pool
                mode, 
                abilityName: source.name,
                isHeroic: wasHeroic 
            });
        } else if (isWeaponAttack) {
            const target = allPotentialTargets.find(e => e.id === validTargetIds[0]);
            if (target) {
                requests.push({ 
                    rollerName: actorInstance.name, 
                    rollType: 'Attack Roll', 
                    checkName: source.name, 
                    targetName: target.name, 
                    mode,
                    isHeroic: wasHeroic
                });
            }
        } else {
            // Single target loop (for multi-strike weapons or single target spells)
            for (const targetId of validTargetIds) {
                const target = allPotentialTargets.find(e => e.id === targetId);
                if (!target) continue;
                const request: DiceRollRequest = { 
                    rollerName: actorInstance.name, 
                    rollType: isHealingAction ? 'Healing Roll' : 'Attack Roll', 
                    checkName: source.name, 
                    targetName: target.name, 
                    mode,
                    isHeroic: wasHeroic
                };
                if (!('weaponStats' in source) || !source.weaponStats) request.abilityName = source.name;
                requests.push(request);
            }
        }

        if (requests.length === 0) return;
        
        // Pass Heroic state to the processor for mechanical doubling
        const { rolls, summary } = processDiceRolls(requests, { isHeroic: wasHeroic });
        
        if ('id' in source && (source as Ability).usage && (source as Ability).usage?.type !== 'passive') {
            dispatch({ type: 'USE_ABILITY', payload: { abilityId: source.id, ownerId } });
        } else if ('tags' in source && source.tags?.some(t => t.toLowerCase().includes('consumable'))) {
            const listName = actorInventory.equipped.some(i => i.id === (source as Item).id) ? 'equipped' : 'carried';
            dispatch({ type: 'USE_ITEM', payload: { itemId: (source as Item).id, list: listName, ownerId } });
        }

        const aiNarrates = gameData.combatConfiguration?.aiNarratesTurns ?? true;
        if (aiNarrates) {
            const narrativeRequest: ChatMessage = {
                id: `sys-req-narrative-${Date.now()}`, sender: 'system', mode: 'OOC',
                content: `[SYSTEM] ${actorInstance.name} used action/ability: "${source.name}".\n${flavorText ? `[FLAVOR/DIALOGUE]: "${flavorText}"` : ''}\nMechanical Results:\n${summary}\n\nBased on these EXACT mechanical results, write a brief, exciting narrative of the action.`
            };
            setIsAiGenerating(true);
            try {
                // Phase 4 Update: Pass pre-rolled summary and wasHeroic flag for correct narrative weighting
                const aiRes = await generateResponse(
                    narrativeRequest, 
                    { ...gameData, messages: [...gameData.messages, narrativeRequest] }, 
                    undefined, 
                    undefined, 
                    'gemini-3-flash-preview',
                    summary,
                    wasHeroic
                );
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `ai-${Date.now()}`, sender: 'ai', content: aiRes.narration, combatInfo: { attackerName: actorInstance.name, nextCombatantName: 'Next' }, rolls: rolls } });
                dispatch({ type: 'ADVANCE_TURN' });
            } catch (e) {
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-atk-${Date.now()}`, sender: 'system', content: `${actorInstance.name} used ${source.name} (Narrative generation failed).`, rolls: rolls, type: 'neutral' } });
                dispatch({ type: 'ADVANCE_TURN' });
            } finally {
                setIsAiGenerating(false);
            }
        } else {
            const uniqueTargetNames = Array.from(new Set(targetIds.map(id => allPotentialTargets.find(t => t.id === id)?.name).filter(Boolean)));
            const verb = isWeaponAttack ? 'attacks with' : 'uses';
            const manualMessage: ChatMessage = { id: `ai-atk-manual-${Date.now()}`, sender: 'ai', content: `${actorInstance.name} ${verb} ${source.name} on ${uniqueTargetNames.join(', ')}.${flavorText ? `\n\n"${flavorText}"` : ''}`, rolls: rolls, combatInfo: { attackerName: actorInstance.name, nextCombatantName: 'Next' } };
            dispatch({ type: 'ADD_MESSAGE', payload: manualMessage });
            dispatch({ type: 'ADVANCE_TURN' });
        }
    }, [gameData, dispatch, processDiceRolls, setIsAiGenerating, performNarrativeRound, isHeroicModeActive, setIsHeroicModeActive]);

    return { performPlayerAttack };
};

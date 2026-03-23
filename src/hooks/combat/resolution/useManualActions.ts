// hooks/combat/resolution/useManualActions.ts

import React, { useCallback } from 'react';
import { GameData, GameAction } from '../../../types/Game';
import { Item } from '../../../types/Items';
import { Ability, PlayerCharacter, Companion } from '../../../types/Characters';
import { RollMode } from '../../../types/Core';
import { ChatMessage, DiceRollRequest } from '../../../types/World';
import { generateResponse } from '../../../services/geminiService';
import { useUI } from '../../../context/UIContext';
import { generateSystemNarration } from '../../../utils/resolution/NarrationGenerator';

export const useManualActions = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    processDiceRolls: any,
    setIsAiGenerating: (val: boolean) => void,
    performNarrativeRound: any
) => {
    const { isHeroicModeActive, setIsHeroicModeActive } = useUI();

    const performPlayerAttack = useCallback(async (source: Item | Ability, targetIds: string[], flavorText?: string, mode: RollMode = 'normal', sourceActorId?: string) => {
        if (!gameData) return;
        // Guard: Check if it's an ability with zero charges or insufficient stamina
        if (!('keywords' in source)) {
            const ability = source as Ability;
            const effect = ability.effect;
            const implicitCost = (effect && ['Heal', 'Damage', 'Status'].includes(effect.type)) ? 1 : 0;
            const cost = ability.staminaCost !== undefined ? ability.staminaCost : implicitCost;

            const currentStamina = sourceActorId && sourceActorId !== gameData.playerCharacter.id
                ? (gameData.companions.find(c => c.id === sourceActorId) as any)?.stamina || 0
                : (gameData.playerCharacter as any).stamina || 0;

            if (cost > 0 && currentStamina < cost) {
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-no-stam-${Date.now()}`, sender: 'system', content: `Not enough stamina to use ${source.name}!`, type: 'neutral' } });
                return;
            } else if (cost === 0 && ability.usage && ability.usage.type !== 'passive' && ability.usage.currentUses <= 0) {
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-no-charges-${Date.now()}`, sender: 'system', content: `${source.name} has no charges remaining! You must rest to recharge it.`, type: 'neutral' } });
                return;
            }
        } else {
            const item = source as Item;
            if (item.usage && item.usage.type !== 'passive' && item.usage.currentUses <= 0 && (!item.quantity || item.quantity <= 1)) {
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-no-charges-${Date.now()}`, sender: 'system', content: `${source.name} has no charges remaining!`, type: 'neutral' } });
                return;
            }
        }

        // Phase 2: Capture and consume Heroic state immediately to anchor the async flow.
        // We spending the point here as the single source of authority for manual actions.
        const wasHeroic = isHeroicModeActive;

        if (wasHeroic) {
            dispatch({ type: 'USE_HEROIC_POINT' });
            setIsHeroicModeActive(false);
        }

        if (targetIds.length === 0) return;

        if (gameData.combatConfiguration?.narrativeCombat) {
            // Future compatibility: Ensure narrative rounds can eventually receive the heroic intent
            return performNarrativeRound(source, targetIds, flavorText, mode, sourceActorId, wasHeroic);
        }

        let actorInstance = gameData.playerCharacter as PlayerCharacter | Companion;
        let actorInventory = gameData.playerInventory;
        let ownerId = sourceActorId || gameData.playerCharacter.id;

        // NORMALIZATION: If the owner is the player character, use the literal 'player' for inventory actions
        // This ensures the inventoryReducer correctly identifies the player's inventory.
        const effectiveOwnerId = (ownerId === gameData.playerCharacter.id) ? 'player' : ownerId;

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
        const isHealingAction = effect && effect.type === 'Heal';

        if (!isHealingAction) {
            validTargetIds = targetIds.filter(id => {
                const target = allPotentialTargets.find(t => t.id === id);
                // Exclude allies/neutrals from being valid attack targets by default unless they were explicitly passed
                // For now, just ensure they are alive.
                return target && (target.currentHitPoints || 0) > 0;
            });

            // AUTO-HOSTILITY: If player attacks an ally or neutral, they become an enemy.
            validTargetIds.forEach(id => {
                const target = allPotentialTargets.find(t => t.id === id);
                if (target && 'alignment' in target && (target.alignment === 'ally' || target.alignment === 'neutral')) {
                    dispatch({ type: 'UPDATE_COMBAT_ENEMY', payload: { ...target, alignment: 'enemy', isAlly: false } });
                }
            });

            if (validTargetIds.length === 0 && targetIds.length > 0) {
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-invalid-${Date.now()}`, sender: 'system', content: "Target(s) are already defeated.", type: 'neutral' } });
                return;
            }
        }

        const requests: DiceRollRequest[] = [];
        const isWeaponAttack = 'keywords' in source && source.tags?.some(t => t.toLowerCase().includes('weapon'));

        // General Multi-Target Detection (AoE/Chain/Burst)
        const isMultiTargetAction = effect?.targetType === 'Multiple';

        if (isMultiTargetAction) {
            requests.push({
                rollerName: actorInstance.name,
                rollType: isHealingAction ? 'Healing Roll' : 'Attack Roll',
                checkName: source.name,
                targetName: actorInstance.name, 
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

        const { rolls, summary } = processDiceRolls(requests, { isHeroic: wasHeroic });

        // --- USAGE DEDUCTION ---
        if ('keywords' in source) {
            // It's an ITEM
            const item = source as Item;
            const isConsumable = item.tags?.some(t => t.toLowerCase().includes('consumable'));
            const hasQuantity = (item.quantity || 0) > 0;
            const hasCharges = item.usage?.type === 'charges' || item.usage?.type === 'per_short_rest' || item.usage?.type === 'per_long_rest';

            if (isConsumable || hasQuantity || hasCharges) {
                const listName = actorInventory.equipped.some(i => i.id === item.id) ? 'equipped' : 'carried';
                dispatch({ 
                    type: 'USE_ITEM', 
                    payload: { itemId: item.id, list: listName, ownerId: effectiveOwnerId } 
                });
            }
        } else {
            // It's an ABILITY
            const ability = source as Ability;
            dispatch({ 
                type: 'USE_ABILITY', 
                payload: { abilityId: ability.id, ownerId: effectiveOwnerId } 
            });
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
                    'gemini-3.1-flash-lite-preview',
                    summary,
                    wasHeroic
                );
                const narrationText = aiRes.narration 
                    ? `${aiRes.narration.paragraph1}\n\n${aiRes.narration.paragraph2}`
                    : "The action unfolds...";

                dispatch({ 
                    type: 'ADD_MESSAGE', 
                    payload: { 
                        id: `ai-${Date.now()}`, 
                        sender: 'ai', 
                        content: narrationText, 
                        combatInfo: { attackerName: actorInstance.name, nextCombatantName: 'Next' }, 
                        rolls: rolls,
                        alignmentOptions: aiRes.alignmentOptions,
                        dialogues: aiRes.narration?.dialogues
                    } 
                });
                dispatch({ type: 'ADVANCE_TURN' });
            } catch (e) {
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-atk-${Date.now()}`, sender: 'system', content: `${actorInstance.name} used ${source.name} (Narrative generation failed).`, rolls: rolls, type: 'neutral' } });
                dispatch({ type: 'ADVANCE_TURN' });
            } finally {
                setIsAiGenerating(false);
            }
        } else {
            const uniqueTargetNames = Array.from(new Set(targetIds.map(id => allPotentialTargets.find(t => t.id === id)?.name).filter(Boolean)));

            // Improve: Use systematic narration for manual turns when AI is off
            const narrative = generateSystemNarration(
                actorInstance.name,
                source.name,
                !!isWeaponAttack,
                rolls,
                allPotentialTargets
            );

            const manualMessage: ChatMessage = {
                id: `ai-atk-manual-${Date.now()}`,
                sender: 'ai',
                content: `${narrative}${flavorText ? `\n\n"${flavorText}"` : ''}`,
                rolls: rolls,
                combatInfo: { attackerName: actorInstance.name, nextCombatantName: 'Next' }
            };
            dispatch({ type: 'ADD_MESSAGE', payload: manualMessage });
            dispatch({ type: 'ADVANCE_TURN' });
        }
    }, [gameData, dispatch, processDiceRolls, setIsAiGenerating, performNarrativeRound, isHeroicModeActive, setIsHeroicModeActive]);

    return { performPlayerAttack };
};

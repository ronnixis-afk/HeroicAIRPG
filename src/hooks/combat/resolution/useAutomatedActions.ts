
// src/hooks/combat/resolution/useAutomatedActions.ts

import React, { useCallback } from 'react';
import { GameData, GameAction } from '../../../types/Game';
import { Item } from '../../../types/Items';
import { ChatMessage, DiceRollRequest } from '../../../types/World';
import { PlayerCharacter, Companion } from '../../../types/Characters';
import { generateResponse } from '../../../services/geminiService';
import { canBeTargeted } from '../../../utils/resolution/StatusRules';
import { acquireTacticalTarget } from '../../../utils/resolution/TargetingLogic';

export const useAutomatedActions = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    processDiceRolls: any,
    setIsAiGenerating: (val: boolean) => void,
    performPlayerAttack: any,
    performNarrativeRound: any
) => {
    const performAutomatedPlayerTurn = useCallback(async () => {
        if (!gameData || !gameData.combatState) return;
        
        const player = gameData.playerCharacter;
        const loadout = player.combatLoadout;
        const inv = gameData.playerInventory;
        const combatStats = player.getCombatStats(inv);
        const maxAttacksFromSheet = combatStats.numberOfAttacks || 1;
        
        const isAvailable = (a: any) => !a.usage || a.usage.type === 'passive' || a.usage.currentUses > 0;
        const useSpecialChance = Math.random() < 0.30;
        let selectedAction: any = null;

        if (useSpecialChance) {
            const ability1 = loadout?.primaryAbilityId && loadout.primaryAbilityId !== 'basic_attack' 
                            ? (player.abilities.find(a => a.id === loadout.primaryAbilityId && isAvailable(a)) || 
                               inv?.equipped.find(i => i.id === loadout.primaryAbilityId && isAvailable(i))) : null;
            const ability2 = loadout?.secondaryAbilityId && loadout.secondaryAbilityId !== 'basic_attack'
                            ? (player.abilities.find(a => a.id === loadout.secondaryAbilityId && isAvailable(a)) || 
                               inv?.equipped.find(i => i.id === loadout.secondaryAbilityId && isAvailable(i))) : null;

            const validOptions = [];
            if (ability1) validOptions.push(ability1);
            if (ability2) validOptions.push(ability2);

            if (validOptions.length > 0) {
                selectedAction = validOptions.length === 2 ? (Math.random() < 0.5 ? validOptions[0] : validOptions[1]) : validOptions[0];
            }
        }

        if (!selectedAction) {
            const mainHand = inv.equipped.find(i => i.equippedSlot === 'Main Hand');
            const offHand = inv.equipped.find(i => i.equippedSlot === 'Off Hand');
            
            if (mainHand) selectedAction = mainHand;
            else if (offHand) selectedAction = offHand;
            else {
                selectedAction = new Item({
                    name: 'Unarmed Strike',
                    weaponStats: { ability: 'strength', damages: [{ dice: '1d3', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 },
                    tags: ['weapon']
                });
            }
        }

        if (!selectedAction) return;

        const isHeal = 'effect' in selectedAction && (selectedAction.effect?.type === 'Heal' || selectedAction.effect?.healDice);
        const enemies = gameData.combatState.enemies || [];
        const allies = [gameData.playerCharacter, ...gameData.companions.filter(c => c.isInParty !== false), ...enemies.filter(e => e.isAlly)];
        const allPotentialTargets = [...enemies, gameData.playerCharacter, ...gameData.companions];

        // Tactical Target Acquisition
        const target = acquireTacticalTarget(
            player,
            allPotentialTargets,
            !!isHeal,
            (id) => {
                if (id === player.id) return player.currentHitPoints;
                const char = allPotentialTargets.find(a => a.id === id);
                return char?.currentHitPoints || 0;
            },
            gameData
        );

        if (!target) return;

        const isPhysical = selectedAction.name === 'Unarmed Strike' || !!selectedAction.weaponStats;
        let targetIds: string[] = [target.id];
        
        if (isPhysical) {
            targetIds = Array(maxAttacksFromSheet).fill(target.id);
        }

        if (gameData.combatConfiguration?.narrativeCombat) {
            await performNarrativeRound(selectedAction, targetIds, "I'll handle this!", 'normal', player.id);
        } else {
            await performPlayerAttack(selectedAction, targetIds, "I've got this!", 'normal', player.id);
        }
    }, [gameData, performNarrativeRound, performPlayerAttack]);

    const playNpcTurn = useCallback(async (actorId: string) => {
        if (!gameData || !gameData.combatState) return;
        if (gameData.combatConfiguration?.narrativeCombat) { dispatch({ type: 'ADVANCE_TURN' }); return; }
        
        setIsAiGenerating(true);
        try {
            const actor = [gameData.playerCharacter, ...gameData.companions, ...gameData.combatState.enemies].find(a => a.id === actorId);
            if (!actor || (actor.currentHitPoints || 0) <= 0) { dispatch({ type: 'ADVANCE_TURN' }); return; }
            
            const incapacitatingEffects = ['Stunned', 'Paralyzed', 'Unconscious'];
            const activeIncapacitation = actor.statusEffects?.find(e => incapacitatingEffects.includes(e.name));
            if (activeIncapacitation) {
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-skip-${Date.now()}`, sender: 'system', content: `${actor.name} is ${activeIncapacitation.name} and cannot act.`, type: 'neutral' } });
                dispatch({ type: 'ADVANCE_TURN' });
                return;
            }

            let selectedAction: any = null;
            const isAvailable = (a: any) => !a.usage || a.usage.type === 'passive' || a.usage.currentUses > 0;
            const isAutomatedActor = gameData.companions.some(c => c.id === actorId) || actorId === gameData.playerCharacter.id;
            const useSpecialChance = Math.random() < 0.30;

            if (isAutomatedActor) {
                const automatedChar = actor as PlayerCharacter | Companion;
                const loadout = automatedChar.combatLoadout;
                const inv = actorId === gameData.playerCharacter.id ? gameData.playerInventory : gameData.companionInventories[actorId];
                
                const ability1 = loadout?.primaryAbilityId && loadout.primaryAbilityId !== 'basic_attack'
                                ? (automatedChar.abilities.find(a => a.id === loadout.primaryAbilityId && isAvailable(a)) || 
                                   inv?.equipped.find(i => i.id === loadout.primaryAbilityId && isAvailable(i))) : null;
                const ability2 = loadout?.secondaryAbilityId && loadout.secondaryAbilityId !== 'basic_attack'
                                ? (automatedChar.abilities.find(a => a.id === loadout.secondaryAbilityId && isAvailable(a)) || 
                                   inv?.equipped.find(i => i.id === loadout.secondaryAbilityId && isAvailable(i))) : null;

                if (useSpecialChance && (ability1 || ability2)) {
                    const validOptions = [];
                    if (ability1) validOptions.push(ability1);
                    if (ability2) validOptions.push(ability2);
                    selectedAction = validOptions.length === 2 ? (Math.random() < 0.5 ? validOptions[0] : validOptions[1]) : validOptions[0];
                } else {
                    selectedAction = { name: 'Attack', type: 'Attack' };
                }
            } else {
                // FIXED: Expanded filter to include NPC special abilities by checking for .type property
                const possibleAbilities = [...((actor as any).specialAbilities || []), ...((actor as any).abilities || [])]
                    .filter((a: any) => (a.effect || a.type || (a.tags && (a.tags.includes('offensive') || a.tags.includes('attack')))) && isAvailable(a));
                
                if (useSpecialChance && possibleAbilities.length > 0) {
                    selectedAction = possibleAbilities[Math.floor(Math.random() * possibleAbilities.length)];
                } else {
                    selectedAction = { name: 'Attack', type: 'Attack' };
                }
            }

            if (selectedAction?.id && selectedAction.usage && selectedAction.usage.type !== 'passive') {
                if ('weaponStats' in selectedAction) {
                     const inv = (gameData.companionInventories[actorId] || (actorId === gameData.playerCharacter.id ? gameData.playerInventory : null));
                     const listName = inv?.equipped.some(i => i.id === selectedAction.id) ? 'equipped' : 'carried';
                     dispatch({ type: 'USE_ITEM', payload: { itemId: selectedAction.id, list: listName, ownerId: actorId } });
                } else {
                     dispatch({ type: 'USE_ABILITY', payload: { abilityId: selectedAction.id, ownerId: actorId } });
                }
            }

            const isHeal = selectedAction.effect?.type === 'Heal' || selectedAction.effect?.healDice || selectedAction.type === 'Heal';
            const enemies = gameData.combatState.enemies || [];
            const allPotentialTargets = [...enemies, gameData.playerCharacter, ...gameData.companions];

            const target = acquireTacticalTarget(
                actor,
                allPotentialTargets,
                !!isHeal,
                (id) => {
                    if (id === gameData.playerCharacter.id) return gameData.playerCharacter.currentHitPoints;
                    const char = allPotentialTargets.find(a => a.id === id);
                    return char?.currentHitPoints || 0;
                },
                gameData
            );

            if (!target) { dispatch({ type: 'ADVANCE_TURN' }); return; }

            const requests: DiceRollRequest[] = [];
            const isPhysical = selectedAction.name === 'Attack' || 'weaponStats' in selectedAction || (!('effect' in selectedAction) && !('type' in selectedAction));
            let finalActionName = selectedAction.name;

            if (isPhysical) {
                const inv = gameData.companionInventories[actorId] || (actorId === gameData.playerCharacter.id ? gameData.playerInventory : null);
                const isPCorCompanion = actorId === gameData.playerCharacter.id || gameData.companions.some(c => c.id === actorId);
                const fallbackAttackName = isPCorCompanion ? "Unarmed Strike" : "Attack";
                
                let mainHandName = fallbackAttackName;
                if (inv && 'getCombatStats' in actor) {
                    const weapons = inv.equipped.filter(i => i.tags?.some(t => t.toLowerCase().includes('weapon')));
                    const mainHand = weapons.find(w => w.equippedSlot === 'Main Hand') || weapons[0];
                    if (mainHand) mainHandName = mainHand.name;
                }

                finalActionName = ('weaponStats' in selectedAction) ? selectedAction.name : mainHandName;
                requests.push({ rollerName: actor.name, rollType: 'Attack Roll', checkName: finalActionName, targetName: target.name });
            } else {
                // Determine if the action is the flat effect object or has an .effect property
                const effect = selectedAction.effect || selectedAction;
                const isHealEffect = effect?.type === 'Heal';
                const isMulti = effect?.targetType === 'Multiple';
                if (isHealEffect && isMulti) {
                    requests.push({ rollerName: actor.name, rollType: 'Healing Roll', checkName: selectedAction.name, abilityName: selectedAction.name, targetName: actor.name });
                } else if (isHealEffect) {
                    requests.push({ rollerName: actor.name, rollType: 'Healing Roll', checkName: selectedAction.name, abilityName: selectedAction.name, targetName: target.name });
                } else if (effect && effect.saveAbility) {
                    requests.push({ 
                        rollerName: target.name, 
                        rollType: 'Saving Throw', 
                        checkName: effect.saveAbility, 
                        abilityName: selectedAction.name, 
                        sourceName: actor.name, 
                        targetName: target.name,
                        dc: effect.dc || (isAutomatedActor ? (actor as any).getStandardAbilityDC() : 10)
                    });
                } else {
                    requests.push({ 
                        rollerName: target.name, 
                        rollType: 'Saving Throw', 
                        checkName: 'dexterity', 
                        abilityName: selectedAction.name, 
                        sourceName: actor.name, 
                        targetName: target.name 
                    });
                }
            }

            const { rolls } = processDiceRolls(requests);
            dispatch({ type: 'ADD_MESSAGE', payload: { id: `ai-${Date.now()}`, sender: 'ai', content: `${actor.name} uses ${finalActionName}.`, rolls } });
            dispatch({ type: 'ADVANCE_TURN' });

        } catch (e) { console.error(e); dispatch({ type: 'ADVANCE_TURN' }); } finally { setIsAiGenerating(false); }
    }, [gameData, dispatch, processDiceRolls, setIsAiGenerating]);

    return { performAutomatedPlayerTurn, playNpcTurn };
};

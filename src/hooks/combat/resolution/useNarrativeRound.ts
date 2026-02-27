// hooks/combat/resolution/useNarrativeRound.ts

import React, { useCallback } from 'react';
import { GameData, GameAction } from '../../../types/Game';
import { Item } from '../../../types/Items';
import { Ability, PlayerCharacter, Companion } from '../../../types/Characters';
import { RollMode, StatusEffect } from '../../../types/Core';
import { DiceRoll, DiceRollRequest } from '../../../types/World';
import { generateNarrativeRoundResponse, generateLoot } from '../../../services/geminiService';
import { canBeTargeted } from '../../../utils/resolution/StatusRules';

export const useNarrativeRound = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    processDiceRolls: any,
    setIsAiGenerating: (val: boolean) => void,
    setLootState: any
) => {
    const performNarrativeRound = useCallback(async (playerSource: Item | Ability, playerTargetIds: string[], playerFlavor?: string, rollMode: RollMode = 'normal', sourceActorId?: string, isHeroic: boolean = false) => {
        if (!gameData || !gameData.combatState || !Array.isArray(playerTargetIds)) return;

        setIsAiGenerating(true);
        const allRolls: DiceRoll[] = [];
        const mechanicalSummaries: string[] = [];
        const runningHp = new Map<string, number>();
        const runningStatuses = new Map<string, StatusEffect[]>();
        let finalVictory: any = undefined;

        const allActorsInScene = [gameData.playerCharacter, ...gameData.companions, ...gameData.combatState.enemies];
        allActorsInScene.forEach(a => {
            runningHp.set(a.id, a.currentHitPoints || 0);
            runningStatuses.set(a.id, a.statusEffects || []);
        });

        const mergeStatusUpdatesLocal = (updates: Record<string, StatusEffect[]>) => {
            if (!updates) return;
            Object.entries(updates).forEach(([key, val]) => {
                if (!Array.isArray(val)) return;
                const current = runningStatuses.get(key) || [];
                runningStatuses.set(key, [...current, ...val]);
            });
        };

        const incapacitatingEffects = ['Stunned', 'Paralyzed', 'Unconscious'];

        // 1. Resolve Active Actor Turn (Player or Controlled Companion)
        let actorInstance = gameData.playerCharacter as PlayerCharacter | Companion;
        let actorInventory = gameData.playerInventory;
        const ownerId = sourceActorId || gameData.playerCharacter.id;

        if (sourceActorId && sourceActorId !== gameData.playerCharacter.id) {
            const comp = gameData.companions.find(c => c.id === sourceActorId);
            if (comp) {
                actorInstance = comp;
                actorInventory = gameData.companionInventories[comp.id];
            }
        }

        const currentStatuses = runningStatuses.get(actorInstance.id) || [];
        const activeIncapacitation = currentStatuses.find(e => incapacitatingEffects.includes(e.name));

        if (!activeIncapacitation) {
            const playerRequests: DiceRollRequest[] = [];
            let finalTargetIds = [...playerTargetIds];
            const isHeal = 'effect' in playerSource && (playerSource.effect?.type === 'Heal' || playerSource.effect?.healDice);

            // Enhanced weapon identification supporting partial tags
            const isWeapon = ('weaponStats' in playerSource && !!playerSource.weaponStats) ||
                ('tags' in playerSource && playerSource.tags?.some(t => t.toLowerCase().includes('weapon')));

            if (actorInstance.isShip && !isHeal) {
                const enemyShips = gameData.combatState.enemies.filter(e => e.isShip && (runningHp.get(e.id) || 0) > 0);
                if (enemyShips.length > 0) {
                    const pickedShip = finalTargetIds.some(id => gameData.combatState?.enemies.find(e => e.id === id)?.isShip);
                    if (!pickedShip) finalTargetIds = [enemyShips[0].id];
                }
            }

            const targetActor = allActorsInScene.find(a => a.id === finalTargetIds[0]);

            if (targetActor) {
                if (isHeal) {
                    playerRequests.push({
                        rollerName: actorInstance.name,
                        rollType: 'Healing Roll',
                        checkName: playerSource.name,
                        targetName: targetActor.name,
                        mode: rollMode,
                        abilityName: playerSource.name,
                        isHeroic: isHeroic
                    });
                } else if (isWeapon) {
                    playerRequests.push({
                        rollerName: actorInstance.name,
                        rollType: 'Attack Roll',
                        checkName: playerSource.name,
                        targetName: targetActor.name,
                        mode: rollMode,
                        isHeroic: isHeroic
                    });
                } else {
                    // Damaging Ability: Request Attack Roll intent
                    playerRequests.push({
                        rollerName: actorInstance.name,
                        rollType: 'Attack Roll',
                        checkName: playerSource.name,
                        targetName: targetActor.name,
                        abilityName: playerSource.name,
                        mode: rollMode,
                        isHeroic: isHeroic
                    });
                }
            }

            if ('id' in playerSource && (playerSource as Ability).usage && (playerSource as Ability).usage?.type !== 'passive') {
                dispatch({ type: 'USE_ABILITY', payload: { abilityId: playerSource.id, ownerId } });
            } else if ('tags' in playerSource && playerSource.tags?.includes('consumable')) {
                const listName = actorInventory.equipped.some(i => i.id === (playerSource as Item).id) ? 'equipped' : 'carried';
                dispatch({ type: 'USE_ITEM', payload: { itemId: (playerSource as Item).id, list: listName, ownerId } });
            }

            if (playerRequests.length > 0) {
                const playerRes = processDiceRolls(playerRequests, { suppressLoot: true, isHeroic: isHeroic });
                if (playerRes && Array.isArray(playerRes.rolls)) {
                    allRolls.push(...playerRes.rolls);
                    mechanicalSummaries.push(`[${actorInstance.name.toUpperCase()} TURN]:\nAction: ${playerSource.name}\n${playerRes.summary}`);
                    if (playerRes.victoryData) finalVictory = playerRes.victoryData;
                    if (playerRes.statusUpdates) mergeStatusUpdatesLocal(playerRes.statusUpdates);

                    playerRes.rolls.forEach((r: DiceRoll) => {
                        if (r.hpChange && r.targetName) {
                            const t = allActorsInScene.find(a => a.name === r.targetName);
                            if (t) {
                                const delta = (r.hpChange.newHp || 0) - (r.hpChange.previousHp || 0);
                                runningHp.set(t.id, Math.max(0, (runningHp.get(t.id) || 0) + delta));
                            }
                        }
                    });
                }
            }
        }

        // 2. Resolve Others in Initiative Order
        if (!finalVictory) {
            const { turnOrder, currentTurnIndex } = gameData.combatState;
            if (Array.isArray(turnOrder) && turnOrder.length > 0) {
                let loopIndex = (currentTurnIndex + 1) % turnOrder.length;
                const stopId = turnOrder[currentTurnIndex];

                while (turnOrder[loopIndex] !== stopId) {
                    const actorId = turnOrder[loopIndex];
                    const actor = allActorsInScene.find(a => a.id === actorId);

                    if (actor && (runningHp.get(actorId) || 0) > 0) {
                        const currentActorStatuses = runningStatuses.get(actorId) || [];
                        const activeInc = currentActorStatuses.find(e => incapacitatingEffects.includes(e.name));

                        const isNpcHostile = gameData.combatState.enemies.some(e => e.id === actorId && !e.isAlly);
                        const isSurprised = isNpcHostile && gameData.combatState.round === 1 && gameData.isPartyHidden;

                        if (!activeInc && !isSurprised) {
                            const hostileTeam = gameData.combatState.enemies.filter(e => !e.isAlly);
                            const friendlyTeam = [gameData.playerCharacter, ...gameData.companions.filter(c => c.isInParty !== false), ...gameData.combatState.enemies.filter(e => e.isAlly)];
                            const opposingTeam = isNpcHostile ? friendlyTeam : hostileTeam;
                            const currentTeam = isNpcHostile ? hostileTeam : friendlyTeam;

                            let selectedAction: any = null;
                            const isAvailable = (a: any) => !a.usage || a.usage.type === 'passive' || a.usage.currentUses > 0;
                            const useSpecialChance = Math.random() < 0.30;
                            const isPCorCompanion = actorId === gameData.playerCharacter.id || gameData.companions.some(c => c.id === actorId);

                            if (isPCorCompanion && useSpecialChance) {
                                const automatedChar = actor as PlayerCharacter | Companion;
                                const loadout = automatedChar.combatLoadout;
                                const charInv = actorId === gameData.playerCharacter.id ? gameData.playerInventory : gameData.companionInventories[actorId];
                                const ability1 = loadout?.primaryAbilityId && loadout.primaryAbilityId !== 'basic_attack' ? (automatedChar.abilities.find(a => a.id === loadout.primaryAbilityId && isAvailable(a)) || charInv?.equipped.find(i => i.id === loadout.primaryAbilityId && isAvailable(i))) : null;
                                const ability2 = loadout?.secondaryAbilityId && loadout.secondaryAbilityId !== 'basic_attack' ? (automatedChar.abilities.find(a => a.id === loadout.secondaryAbilityId && isAvailable(a)) || charInv?.equipped.find(i => i.id === loadout.secondaryAbilityId && isAvailable(i))) : null;
                                if (ability1 || ability2) selectedAction = (ability1 && ability2) ? (Math.random() < 0.5 ? ability1 : ability2) : (ability1 || ability2);
                            }

                            if (!selectedAction) {
                                // Expanded filter to include NPC special abilities by checking for .type property
                                const possibleAbilities = [...((actor as any).specialAbilities || []), ...((actor as any).abilities || [])]
                                    .filter((a: any) => (a.effect || a.type || (a.tags && (a.tags.includes('offensive') || a.tags.includes('attack')))) && isAvailable(a));

                                if (useSpecialChance && possibleAbilities.length > 0) {
                                    selectedAction = possibleAbilities[Math.floor(Math.random() * possibleAbilities.length)];
                                } else {
                                    selectedAction = { name: 'Attack', type: 'Attack' };
                                }
                            }

                            const isHealAction = selectedAction.effect?.type === 'Heal' || selectedAction.effect?.healDice || selectedAction.type === 'Heal';
                            let finalTargetPool = (isHealAction ? currentTeam : opposingTeam).filter(t => canBeTargeted(t));

                            if (actor.isShip && !isHealAction) {
                                const enemyShips = finalTargetPool.filter(t => t.isShip);
                                if (enemyShips.length > 0) finalTargetPool = enemyShips;
                            }

                            const validTargets = finalTargetPool.filter(t => (runningHp.get(t.id) || 0) > 0).sort((a, b) => (runningHp.get(a.id) || 0) - (runningHp.get(b.id) || 0));

                            if (validTargets.length > 0) {
                                const target = validTargets[0];
                                const isWeaponAction = selectedAction.name === 'Attack' || 'weaponStats' in selectedAction;

                                const npcRequests = [];
                                if (isHealAction) {
                                    npcRequests.push({ rollerName: actor.name, rollType: 'Healing Roll', checkName: selectedAction.name, targetName: target.name });
                                } else if (isWeaponAction) {
                                    npcRequests.push({ rollerName: actor.name, rollType: 'Attack Roll', checkName: selectedAction.name, targetName: target.name });
                                } else {
                                    // Determine if the action is the flat effect object or has an .effect property
                                    const effect = selectedAction.effect || selectedAction;
                                    npcRequests.push({
                                        rollerName: actor.name,
                                        rollType: 'Attack Roll',
                                        checkName: selectedAction.name,
                                        targetName: target.name,
                                        abilityName: selectedAction.name
                                    });
                                }

                                const npcRes = processDiceRolls(npcRequests, { suppressLoot: true });
                                if (npcRes && Array.isArray(npcRes.rolls)) {
                                    allRolls.push(...npcRes.rolls);
                                    mechanicalSummaries.push(`[${actor.name.toUpperCase()} TURN]:\nAction: ${selectedAction.name}\n${npcRes.summary}`);
                                    if (npcRes.victoryData) finalVictory = npcRes.victoryData;
                                    if (npcRes.statusUpdates) mergeStatusUpdatesLocal(npcRes.statusUpdates);
                                    npcRes.rolls.forEach((r: DiceRoll) => {
                                        if (r.hpChange && r.targetName) {
                                            const t = allActorsInScene.find(a => a.name === r.targetName);
                                            if (t) {
                                                const delta = (r.hpChange.newHp || 0) - (r.hpChange.previousHp || 0);
                                                runningHp.set(t.id, Math.max(0, (runningHp.get(t.id) || 0) + delta));
                                            }
                                        }
                                    });
                                }
                            }
                        } else if (isSurprised) {
                            mechanicalSummaries.push(`[${actor.name.toUpperCase()} TURN]:\n**Surprised!** Caught off-guard and unable to react.`);
                        }
                    }
                    if (finalVictory) break;
                    loopIndex = (loopIndex + 1) % turnOrder.length;
                }
            }
        }

        try {
            const cinematicRes = await generateNarrativeRoundResponse(gameData, mechanicalSummaries.join('\n\n'), playerFlavor, "Context", "Overview", isHeroic);
            dispatch({ type: 'ADD_MESSAGE', payload: { id: `ai-round-${Date.now()}`, sender: 'ai', content: cinematicRes.narration, rolls: allRolls } });

            if (finalVictory) {
                const { defeatedEnemies, lootPlan, totalXP } = finalVictory;
                setLootState({ isOpen: true, isLoading: true, items: [], defeatedEnemies });
                const items = await generateLoot(defeatedEnemies, gameData, lootPlan);
                if (Array.isArray(items)) {
                    setLootState((ls: any) => ({ ...ls, isLoading: false, items: items.map((i: any) => new Item(i)) }));
                }
                if (totalXP > 0) dispatch({ type: 'AWARD_XP', payload: { amount: totalXP, source: 'Combat Victory' } });
            }

            dispatch({ type: 'ADVANCE_TURN' });

        } catch (e) {
            console.error("Narration failed", e);
        } finally {
            setIsAiGenerating(false);
        }
    }, [gameData, dispatch, processDiceRolls, setIsAiGenerating, setLootState]);

    return { performNarrativeRound };
};
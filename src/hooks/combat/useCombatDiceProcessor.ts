// hooks/combat/useCombatDiceProcessor.ts

import React, { useCallback } from 'react';
import { GameData, GameAction, DiceRollRequest, DiceRoll, Item, CombatActor, StatusEffect } from '../../types';
import { useUI } from '../../context/UIContext';
import { calculateDiceRolls, GroupCheckResult } from '../../utils/diceRolls';
import { getSkillCheckXP, getEnemyXP } from '../../utils/mechanics';
import { calculateLootDrops, LootDropPlan } from '../../utils/lootMechanics';
import { generateLoot } from '../../services/geminiService';

interface VictoryData {
    defeatedEnemies: CombatActor[];
    lootPlan: LootDropPlan;
    totalXP: number;
}

export const useCombatDiceProcessor = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>
) => {
    const { setLootState } = useUI();

    const processDiceRolls = useCallback((requests: DiceRollRequest[], options?: { suppressLoot?: boolean, isHeroic?: boolean }): { 
        rolls: DiceRoll[], 
        summary: string, 
        groupOutcomes: GroupCheckResult[], 
        victoryData?: VictoryData,
        statusUpdates?: Record<string, StatusEffect[]>
    } => {
        if (!gameData) return { rolls: [], summary: '', groupOutcomes: [] };
        
        // Phase 3: Propagate the heroic flag to the core calculation utility
        const { rolls, hpUpdates, statusUpdates, rollSummary, groupOutcomes } = calculateDiceRolls(gameData, requests, options?.isHeroic);

        let totalSkillXP = 0;
        
        // Award XP for Individual Checks
        rolls.forEach(roll => {
            const isPartOfGroup = groupOutcomes.some(g => g.checkName === roll.checkName && g.rollType === roll.rollType);
            if (!isPartOfGroup && (roll.rollType === 'Skill Check' || roll.rollType === 'Ability Check')) {
                if ((roll.outcome === 'Success' || roll.outcome === 'Critical Success') && roll.dc && roll.dc > 0) {
                    totalSkillXP += getSkillCheckXP(roll.dc);
                }
            }
        });

        // Award XP for Group Successes
        groupOutcomes.forEach(group => {
            const sampleRoll = rolls.find(r => r.checkName === group.checkName && r.rollType === group.rollType);
            const dc = sampleRoll?.dc || 0;
            if (group.isGroupSuccess && dc > 0) {
                totalSkillXP += getSkillCheckXP(dc);
            }
        });

        if (totalSkillXP > 0) {
            dispatch({ type: 'AWARD_XP', payload: { amount: totalSkillXP, source: 'Skill Challenge' } });
        }

        let victory: VictoryData | undefined = undefined;

        if (Object.keys(hpUpdates).length > 0) {
            dispatch({ type: 'APPLY_HP_UPDATES', payload: hpUpdates });
            
            if (gameData.combatState?.isActive) {
                const enemies = gameData.combatState.enemies;
                const currentTurnOrder = gameData.combatState.turnOrder;
                const hostilesInInitiative = enemies.filter(e => !e.isAlly && currentTurnOrder.includes(e.id));
                
                const survivingHostiles = hostilesInInitiative.filter(e => {
                    let hp = e.currentHitPoints || 0;
                    if (hpUpdates[e.id] !== undefined) {
                        const delta = hpUpdates[e.id];
                        hp = Math.max(0, hp + delta);
                    }
                    return hp > 0;
                });

                if (hostilesInInitiative.length > 0 && survivingHostiles.length === 0) {
                    const allDefeatedHostiles = hostilesInInitiative.filter(e => {
                        let hp = e.currentHitPoints || 0;
                        if (hpUpdates[e.id] !== undefined) {
                            const delta = hpUpdates[e.id];
                            hp = Math.max(0, hp + delta);
                        }
                        return hp <= 0;
                    });

                    if (allDefeatedHostiles.length > 0) {
                        const worldStyle = gameData.mapSettings?.style || 'fantasy';
                        const skillConfig = gameData.skillConfiguration || 'Fantasy';
                        const pcLevel = gameData.playerCharacter.level || 1;
                        const aiGeneratesLoot = gameData.combatConfiguration?.aiGeneratesLoot ?? true;
                        
                        const lootPlan = calculateLootDrops(allDefeatedHostiles, worldStyle, skillConfig, pcLevel);
                        const totalXP = allDefeatedHostiles.reduce((sum, enemy) => sum + getEnemyXP(enemy.challengeRating || 0), 0);

                        if (options?.suppressLoot) {
                            victory = { defeatedEnemies: allDefeatedHostiles, lootPlan, totalXP };
                        } else {
                            setLootState({ isOpen: true, isLoading: true, items: [], defeatedEnemies: allDefeatedHostiles });
                            if (aiGeneratesLoot) {
                                generateLoot(allDefeatedHostiles, gameData, lootPlan).then(items => {
                                    const lootItems = items.map(i => new Item(i));
                                    setLootState(ls => ({ ...ls, isLoading: false, items: lootItems }));
                                });
                            } else {
                                const lootItems = lootPlan.slots.map(slot => {
                                    const item = new Item(slot.blueprint);
                                    item.name = `Unidentified Item`;
                                    item.description = "A mysterious artifact of unknown power. Needs appraisal.";
                                    if (!item.tags) item.tags = [];
                                    item.tags.push('unidentified');
                                    return item;
                                });
                                if (lootPlan.totalCurrency > 0) {
                                    lootItems.push(new Item({ name: lootPlan.currencyName, quantity: lootPlan.totalCurrency, tags: ['currency'], description: 'Hard-earned funds.', rarity: 'Common' }));
                                }
                                setLootState(ls => ({ ...ls, isLoading: false, items: lootItems }));
                            }

                            if (totalXP > 0) {
                                dispatch({ type: 'AWARD_XP', payload: { amount: totalXP, source: 'Combat Victory' } });
                            }
                        }
                    }
                    dispatch({ type: 'END_COMBAT', payload: { lootItems: [] } });
                }
            }
        }

        if (statusUpdates && Object.keys(statusUpdates).length > 0) {
            dispatch({ type: 'APPLY_STATUS_UPDATES', payload: statusUpdates });
        }

        return { rolls, summary: rollSummary, groupOutcomes, victoryData: victory, statusUpdates };

    }, [gameData, dispatch, setLootState]);

    return { processDiceRolls };
};

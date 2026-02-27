
// reducers/combatReducer.ts

import { GameData, GameAction, PlayerCharacter, Companion, StatusEffect } from '../types';
import { DEFAULT_SIZE_MODIFIERS, DEFAULT_ARCHETYPE_DEFINITIONS } from '../utils/mechanics';

export const combatReducer = (state: GameData, action: GameAction): GameData => {
    switch (action.type) {
        case 'START_COMBAT': {
            const newState = { ...state };
            if (!newState.combatState) {
                newState.combatState = { isActive: true, enemies: [], round: 1, turnOrder: [], currentTurnIndex: 0 };
            } else {
                newState.combatState.isActive = true;
                newState.combatState.round = 1;
                newState.combatState.currentTurnIndex = 0;
            }

            const actors = [
                { id: newState.playerCharacter.id, dex: newState.playerCharacter.abilityScores.dexterity.score },
                ...newState.companions.filter(c => c.isInParty !== false).map(c => ({ id: c.id, dex: c.abilityScores.dexterity.score })),
                // Only include actors who are NOT neutral in the initiative loop
                ...newState.combatState.enemies
                    .filter(e => e.alignment !== 'neutral')
                    .map(e => ({ id: e.id, dex: e.abilityScores?.dexterity?.score || 10 }))
            ];

            const initiatives = actors.map(a => ({
                id: a.id,
                roll: Math.floor(Math.random() * 20) + 1 + Math.floor((a.dex - 10) / 2)
            }));

            initiatives.sort((a, b) => b.roll - a.roll);
            const turnOrder = initiatives.map(i => i.id);
            newState.combatState.turnOrder = turnOrder;

            if (newState.combatConfiguration?.narrativeCombat) {
                const playerIndex = turnOrder.indexOf(newState.playerCharacter.id);
                if (playerIndex > -1) {
                    newState.combatState.currentTurnIndex = playerIndex;
                }
            }

            return newState;
        }

        case 'ADD_COMBAT_ENEMY': {
            const newState = { ...state };
            if (!newState.combatState) {
                newState.combatState = { isActive: false, enemies: [], round: 0, turnOrder: [], currentTurnIndex: 0 };
            }
            newState.combatState.enemies.push(action.payload);
            return newState;
        }

        case 'UPDATE_COMBAT_ENEMY': {
            if (state.combatState) {
                return {
                    ...state,
                    combatState: {
                        ...state.combatState,
                        enemies: state.combatState.enemies.map(e => e.id === action.payload.id ? action.payload : e)
                    }
                };
            }
            return state;
        }

        case 'DELETE_COMBAT_ENEMY': {
            if (state.combatState) {
                return {
                    ...state,
                    combatState: {
                        ...state.combatState,
                        enemies: state.combatState.enemies.filter(e => e.id !== action.payload),
                        turnOrder: state.combatState.turnOrder.filter(id => id !== action.payload)
                    }
                };
            }
            return state;
        }

        case 'DUPLICATE_COMBAT_ENEMY': {
            if (state.combatState) {
                const original = state.combatState.enemies.find(e => e.id === action.payload);
                if (original) {
                    const copy = { ...original, id: `enemy-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, name: `${original.name} (Copy)` };
                    return {
                        ...state,
                        combatState: {
                            ...state.combatState,
                            enemies: [...state.combatState.enemies, copy]
                        }
                    };
                }
            }
            return state;
        }

        case 'SYNC_SCENE_ACTORS': {
            const { newActors, removeStaleIds } = action.payload;
            if (!state.combatState) {
                return {
                    ...state,
                    combatState: { isActive: false, enemies: newActors, round: 0, turnOrder: [], currentTurnIndex: 0 }
                };
            }

            // 1. Remove stale actors that are no longer in the locale
            let remainingEnemies = state.combatState.enemies.filter(e => !removeStaleIds.includes(e.id));

            // 2. Refresh or add current actors
            const finalEnemies = [...remainingEnemies];
            newActors.forEach(incomingActor => {
                const existingIndex = finalEnemies.findIndex(e => e.id === incomingActor.id);
                if (existingIndex > -1) {
                    // Update existing actor with potentially refined stats/blueprints
                    // preserving current damage taken and manually set properties like alignment
                    const existing = finalEnemies[existingIndex];
                    const hpDiff = (existing.maxHitPoints || 0) - (existing.currentHitPoints || 0);
                    finalEnemies[existingIndex] = {
                        ...incomingActor,
                        alignment: existing.alignment || incomingActor.alignment,
                        currentHitPoints: Math.max(0, (incomingActor.maxHitPoints || 0) - hpDiff)
                    };
                } else {
                    finalEnemies.push(incomingActor);
                }
            });

            return {
                ...state,
                combatState: {
                    ...state.combatState,
                    enemies: finalEnemies
                }
            };
        }

        case 'ADD_TO_TURN_ORDER': {
            if (state.combatState && !state.combatState.turnOrder.includes(action.payload)) {
                return {
                    ...state,
                    combatState: {
                        ...state.combatState,
                        turnOrder: [...state.combatState.turnOrder, action.payload]
                    }
                };
            }
            return state;
        }

        case 'REMOVE_FROM_TURN_ORDER': {
            if (state.combatState) {
                return {
                    ...state,
                    combatState: {
                        ...state.combatState,
                        turnOrder: state.combatState.turnOrder.filter(id => id !== action.payload)
                    }
                };
            }
            return state;
        }

        case 'MOVE_TURN_ORDER_ITEM': {
            if (state.combatState) {
                const { id, direction } = action.payload;
                const order = [...state.combatState.turnOrder];
                const index = order.indexOf(id);
                if (index > -1) {
                    const newIndex = direction === 'up' ? index - 1 : index + 1;
                    if (newIndex >= 0 && newIndex < order.length) {
                        [order[index], order[newIndex]] = [order[newIndex], order[index]];
                        return {
                            ...state,
                            combatState: {
                                ...state.combatState,
                                turnOrder: order
                            }
                        };
                    }
                }
            }
            return state;
        }

        case 'ADVANCE_TURN': {
            if (state.combatState) {
                const { turnOrder, currentTurnIndex } = state.combatState;
                if (turnOrder.length > 0) {
                    let newState = { ...state };

                    // Define local helper for status effect decay
                    const processStatusEffects = (actor: any) => {
                        if (!actor.statusEffects || actor.statusEffects.length === 0) return actor;
                        const updatedEffects = actor.statusEffects
                            .map((effect: any) => ({ ...effect, duration: effect.duration - 1 }))
                            .filter((effect: any) => effect.duration > 0);
                        return { ...actor, statusEffects: updatedEffects };
                    };

                    // Define local helper for active buffs decay
                    const processActiveBuffs = (actor: any) => {
                        if (!actor.activeBuffs || actor.activeBuffs.length === 0) return actor;
                        const updatedBuffs = actor.activeBuffs
                            .map((buff: any) => ({ ...buff, duration: buff.duration - 1 }))
                            .filter((buff: any) => buff.duration > 0);
                        return { ...actor, activeBuffs: updatedBuffs };
                    };

                    // --- NARRATIVE MODE: BATCH RESOLUTION ---
                    if (state.combatConfiguration?.narrativeCombat) {
                        // 1. Decay status and buffs for EVERYONE because a whole round has passed
                        const decayAll = (actor: any) => processActiveBuffs(processStatusEffects(actor));

                        newState.playerCharacter = new PlayerCharacter(decayAll(newState.playerCharacter));
                        newState.companions = newState.companions.map(c => new Companion(decayAll(c)));
                        newState.combatState!.enemies = newState.combatState!.enemies.map(e => decayAll(e));

                        // 2. Increment Round
                        const oldRound = newState.combatState!.round;
                        const newRound = oldRound + 1;
                        newState.combatState!.round = newRound;

                        // 3. Reset turn to Player
                        const playerIndex = turnOrder.indexOf(newState.playerCharacter.id);
                        newState.combatState!.currentTurnIndex = playerIndex > -1 ? playerIndex : 0;

                        // 4. Handle Surprise Round transition
                        if (oldRound === 1 && newState.isPartyHidden) {
                            newState.isPartyHidden = false;
                            const stripInvisible = (actor: any) => ({
                                ...actor,
                                statusEffects: (actor.statusEffects || []).filter((s: any) => s.name !== 'Invisible')
                            });
                            newState.playerCharacter = new PlayerCharacter(stripInvisible(newState.playerCharacter));
                            newState.companions = newState.companions.map(c => new Companion(stripInvisible(c)));
                        }

                        return newState;
                    }

                    // --- STANDARD MODE: TURN BY TURN ---
                    const currentActorId = turnOrder[currentTurnIndex];
                    if (currentActorId === newState.playerCharacter.id) {
                        newState.playerCharacter = new PlayerCharacter(processStatusEffects(newState.playerCharacter));
                    } else {
                        const compIndex = newState.companions.findIndex(c => c.id === currentActorId);
                        if (compIndex > -1) {
                            const updatedComp = new Companion(processStatusEffects(newState.companions[compIndex]));
                            const newComps = [...newState.companions];
                            newComps[compIndex] = updatedComp;
                            newState.companions = newComps;
                        } else if (newState.combatState) {
                            const enemyIndex = newState.combatState.enemies.findIndex(e => e.id === currentActorId);
                            if (enemyIndex > -1) {
                                const updatedEnemy = processStatusEffects(newState.combatState.enemies[enemyIndex]);
                                const newEnemies = [...newState.combatState.enemies];
                                newEnemies[enemyIndex] = updatedEnemy;
                                newState.combatState.enemies = newEnemies;
                            }
                        }
                    }

                    let nextIndex = currentTurnIndex;
                    let foundAlive = false;
                    let loopCount = 0;
                    let round = newState.combatState!.round;

                    while (!foundAlive && loopCount < turnOrder.length) {
                        nextIndex = nextIndex + 1;
                        if (nextIndex >= turnOrder.length) {
                            nextIndex = 0;
                            round += 1;
                        }
                        const actorId = turnOrder[nextIndex];
                        let hp = 0;
                        if (actorId === newState.playerCharacter.id) {
                            hp = newState.playerCharacter.currentHitPoints;
                        } else {
                            const comp = newState.companions.find(c => c.id === actorId);
                            if (comp) hp = comp.currentHitPoints;
                            else {
                                const enemy = newState.combatState!.enemies.find(e => e.id === actorId);
                                if (enemy) hp = enemy.currentHitPoints || 0;
                            }
                        }
                        if (hp > 0) foundAlive = true;
                        loopCount++;
                    }

                    // Global decay for activeBuffs when round increments
                    if (round > newState.combatState!.round) {
                        newState.playerCharacter = new PlayerCharacter(processActiveBuffs(newState.playerCharacter));
                        newState.companions = newState.companions.map(c => new Companion(processActiveBuffs(c)));
                        newState.combatState!.enemies = newState.combatState!.enemies.map(e => processActiveBuffs(e));
                    }

                    // --- SURPRISE ROUND RECONCILIATION ---
                    if (newState.combatState!.round === 1 && round === 2 && newState.isPartyHidden) {
                        newState.isPartyHidden = false;
                        const stripInvisible = (actor: any) => ({
                            ...actor,
                            statusEffects: (actor.statusEffects || []).filter((s: any) => s.name !== 'Invisible')
                        });
                        newState.playerCharacter = new PlayerCharacter(stripInvisible(newState.playerCharacter));
                        newState.companions = newState.companions.map(c => new Companion(stripInvisible(c)));
                    }

                    return {
                        ...newState,
                        combatState: { ...newState.combatState!, currentTurnIndex: nextIndex, round }
                    };
                }
            }
            return state;
        }

        case 'END_COMBAT':
            if (state.combatState) {
                return { ...state, combatState: { ...state.combatState, isActive: false } };
            }
            return state;

        case 'CLEAR_SCENE':
            return { ...state, combatState: { isActive: false, enemies: [], round: 0, turnOrder: [], currentTurnIndex: 0 } };

        case 'UPDATE_TEMPLATE':
            return { ...state, templates: { ...state.templates, [action.payload.key]: action.payload.template } };

        case 'UPDATE_SIZE_MODIFIER':
            return { ...state, sizeModifiers: { ...(state.sizeModifiers || DEFAULT_SIZE_MODIFIERS), [action.payload.size]: action.payload.mods } };

        case 'UPDATE_BASE_SCORE':
            return { ...state, combatBaseScore: action.payload };

        case 'UPDATE_AFFINITY':
            return { ...state, affinities: { ...state.affinities, [action.payload.key]: action.payload.affinity } };

        case 'UPDATE_ARCHETYPE':
            return { ...state, archetypes: { ...(state.archetypes || DEFAULT_ARCHETYPE_DEFINITIONS), [action.payload.name]: action.payload.speeds } };

        case 'APPLY_HP_UPDATES': {
            const newState = { ...state };
            const updates = action.payload;
            const hasVal = (id: string) => updates.hasOwnProperty(id);

            const calculateNewHP = (currentHP: number, maxHP: number, tempHP: number, delta: number) => {
                if (delta >= 0) {
                    return {
                        current: Math.max(0, Math.min(maxHP, currentHP + delta)),
                        temp: tempHP
                    };
                } else {
                    const damage = Math.abs(delta);
                    const absorbed = Math.min(tempHP, damage);
                    const remainder = damage - absorbed;
                    return {
                        current: Math.max(0, currentHP - remainder),
                        temp: tempHP - absorbed
                    };
                }
            };

            if (hasVal(newState.playerCharacter.id)) {
                const delta = updates[newState.playerCharacter.id] || 0;
                const { current, temp } = calculateNewHP(
                    newState.playerCharacter.currentHitPoints,
                    newState.playerCharacter.maxHitPoints,
                    newState.playerCharacter.temporaryHitPoints || 0,
                    delta
                );
                newState.playerCharacter = new PlayerCharacter({
                    ...newState.playerCharacter,
                    currentHitPoints: current,
                    temporaryHitPoints: temp
                });
            }

            newState.companions = newState.companions.map(c => {
                if (hasVal(c.id)) {
                    const delta = updates[c.id] || 0;
                    const { current, temp } = calculateNewHP(
                        c.currentHitPoints,
                        c.maxHitPoints,
                        c.temporaryHitPoints || 0,
                        delta
                    );
                    return new Companion({
                        ...c,
                        currentHitPoints: current,
                        temporaryHitPoints: temp
                    });
                }
                return c;
            });

            if (newState.combatState) {
                newState.combatState = {
                    ...newState.combatState,
                    enemies: newState.combatState.enemies.map(e => {
                        if (hasVal(e.id)) {
                            const delta = updates[e.id] || 0;
                            const { current, temp } = calculateNewHP(
                                e.currentHitPoints || 0,
                                e.maxHitPoints || 0,
                                // Fix: Correctly access temporaryHitPoints on CombatActor objects via explicit cast if needed or ensure interface match
                                (e as any).temporaryHitPoints || 0,
                                delta
                            );
                            return {
                                ...e,
                                currentHitPoints: current,
                                temporaryHitPoints: temp
                            };
                        }
                        return e;
                    })
                };
            }
            return newState;
        }

        case 'APPLY_STATUS_UPDATES': {
            const updates = action.payload;
            const getNewStatuses = (id: string): StatusEffect[] => updates[id] || [];
            const hasNewStatuses = (id: string): boolean => updates.hasOwnProperty(id);

            const mergeStatuses = (existing: StatusEffect[], incoming: StatusEffect[]): StatusEffect[] => {
                if (incoming.length === 0) return existing;
                const result = [...existing];
                incoming.forEach(newStatus => {
                    const idx = result.findIndex(s => s.name === newStatus.name);
                    if (idx > -1) {
                        // Keep the longest duration
                        result[idx] = { ...result[idx], duration: Math.max(result[idx].duration, newStatus.duration) };
                    } else {
                        result.push({ ...newStatus });
                    }
                });
                return result;
            };

            const updateActor = (actor: any) => {
                if (hasNewStatuses(actor.id)) {
                    const newStatuses = getNewStatuses(actor.id);
                    return { ...actor, statusEffects: mergeStatuses(actor.statusEffects || [], newStatuses) };
                }
                return actor;
            };

            const newState = { ...state };
            newState.playerCharacter = new PlayerCharacter(updateActor(newState.playerCharacter));
            newState.companions = newState.companions.map(c => new Companion(updateActor(c)));
            if (newState.combatState) {
                newState.combatState = {
                    ...newState.combatState,
                    enemies: newState.combatState.enemies.map(updateActor)
                };
            }
            return newState;
        }

        default:
            return state;
    }
};

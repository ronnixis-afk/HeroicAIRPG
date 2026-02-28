// reducers/systemReducer.ts

import { GameData, GameAction, Item, LoreEntry, MapZone, Inventory, NPC } from '../types';
import { PlayerCharacter, Companion } from '../types';
import { getNewDndCharacter } from '../services/mockSheetsService';
import { parseGameTime } from '../utils/timeUtils';

/**
 * Decrements the duration of active buffs on an actor based on time passed.
 * Removes buffs whose duration reaches zero.
 */
const decayActorBuffs = (actor: any, decayAmount: number) => {
    if (!actor || !actor.activeBuffs || actor.activeBuffs.length === 0 || decayAmount <= 0) return actor;
    const updatedBuffs = actor.activeBuffs
        .map((buff: any) => ({ ...buff, duration: Math.max(0, buff.duration - decayAmount) }))
        .filter((buff: any) => buff.duration > 0);
    return { ...actor, activeBuffs: updatedBuffs };
};

/**
 * Calculates the number of full hours passed between two game time strings.
 */
const getDecayFromTimeStrings = (oldTime: string, newTime: string): number => {
    const oldDate = parseGameTime(oldTime);
    const newDate = parseGameTime(newTime);
    if (!oldDate || !newDate) return 0;
    const diffMs = newDate.getTime() - oldDate.getTime();
    if (diffMs <= 0) return 0;
    // 1 hour (3600000 ms) narrative skip equals 1 round of duration decay
    return Math.floor(diffMs / 3600000);
};

/**
 * Decays corpses in the world based on time passed and location.
 */
const decayCorpses = (npcs: NPC[] | undefined, mapZones: MapZone[] | undefined, newTime: string): NPC[] => {
    if (!npcs) return [];
    return npcs.map(npc => {
        if (npc.status === 'Dead' && !npc.isBodyCleared && npc.deathTimestamp) {
            const hoursSinceDeath = getDecayFromTimeStrings(npc.deathTimestamp, newTime);
            if (hoursSinceDeath >= 24) {
                // Determine if secluded
                const z = mapZones?.find(mz => mz.name === npc.location);
                const zoneDesc = z?.description?.toLowerCase() || "";
                const isIsolatedEnv = zoneDesc.includes('space') || zoneDesc.includes('underground') ||
                    zoneDesc.includes('vault') || zoneDesc.includes('cave') ||
                    zoneDesc.includes('woods') || zoneDesc.includes('forest') ||
                    zoneDesc.includes('ruin') || zoneDesc.includes('secluded');

                if (!isIsolatedEnv) {
                    return { ...npc, isBodyCleared: true };
                }
            }
        }
        return npc;
    });
};

export const systemReducer = (state: GameData, action: GameAction): GameData => {
    switch (action.type) {
        case 'SET_GAME_DATA':
            return action.payload;

        case 'SET_NARRATION_VOICE':
            return { ...state, narrationVoice: action.payload };

        case 'SET_NARRATION_TONE':
            return { ...state, narrationTone: action.payload };

        case 'SET_IMAGE_STYLE':
            return { ...state, imageGenerationStyle: action.payload };

        case 'SET_IMAGE_MODEL':
            return { ...state, imageGenerationModel: action.payload };

        case 'SET_IS_MATURE':
            return { ...state, isMature: action.payload };

        case 'SET_HANDS_FREE':
            return { ...state, isHandsFree: action.payload };

        case 'SET_USE_AI_TTS':
            return { ...state, useAiTts: action.payload };

        case 'SET_DIFFICULTY':
            return { ...state, difficulty: action.payload };

        case 'UPDATE_COMBAT_CONFIGURATION':
            return { ...state, combatConfiguration: action.payload };

        case 'SET_SKILL_CONFIGURATION':
            return { ...state, skillConfiguration: action.payload };

        case 'UPDATE_CURRENT_TIME':
            return {
                ...state,
                currentTime: action.payload,
                npcs: decayCorpses(state.npcs, state.mapZones, action.payload)
            };

        case 'SET_PARTY_HIDDEN':
            return {
                ...state,
                isPartyHidden: action.payload.isHidden,
                partyStealthScore: action.payload.score ?? state.partyStealthScore
            };

        case 'REST': {
            const { type, newTime, playerHeal, companionHeals } = action.payload;
            const decay = type === 'short' ? 1 : 8;

            const playerInstance = new PlayerCharacter(state.playerCharacter);
            const newPlayerMaxTempHP = playerInstance.getMaxTemporaryHitPoints(state.playerInventory);

            // Sync current max heroic capacity including item context
            const currentMaxHeroic = playerInstance.getMaxHeroicPoints(state.playerInventory);

            const decayedPlayerBase = decayActorBuffs(state.playerCharacter, decay);

            const newPlayer = new PlayerCharacter({
                ...decayedPlayerBase,
                maxHeroicPoints: currentMaxHeroic,
                currentHitPoints: type === 'long'
                    ? state.playerCharacter.maxHitPoints
                    : Math.min(state.playerCharacter.maxHitPoints, (state.playerCharacter.currentHitPoints || 0) + playerHeal),
                temporaryHitPoints: newPlayerMaxTempHP,
                heroicPoints: type === 'long'
                    ? currentMaxHeroic
                    : Math.min(state.playerCharacter.heroicPoints || 0, currentMaxHeroic)
            });

            if (type === 'long') {
                newPlayer.abilities = newPlayer.abilities.map(a =>
                    a.usage ? { ...a, usage: { ...a.usage, currentUses: a.usage.maxUses } } : a
                );
            }

            const newCompanions = state.companions.map(c => {
                const heal = companionHeals[c.id] || 0;
                const compInventory = state.companionInventories[c.id] || { equipped: [], carried: [], storage: [], assets: [] };
                const compInstance = new Companion(c);
                const newCompMaxTempHP = compInstance.getMaxTemporaryHitPoints(compInventory);

                const decayedCompBase = decayActorBuffs(c, decay);

                const currentCompMaxHeroic = compInstance.getMaxHeroicPoints(compInventory);

                const updatedComp = new Companion({
                    ...decayedCompBase,
                    maxHeroicPoints: currentCompMaxHeroic,
                    currentHitPoints: type === 'long'
                        ? c.maxHitPoints
                        : Math.min(c.maxHitPoints, (c.currentHitPoints || 0) + heal),
                    temporaryHitPoints: newCompMaxTempHP
                });

                if (type === 'long') {
                    updatedComp.abilities = updatedComp.abilities.map(a =>
                        a.usage ? { ...a, usage: { ...a.usage, currentUses: a.usage.maxUses } } : a
                    );
                    updatedComp.heroicPoints = currentCompMaxHeroic;
                }
                return updatedComp;
            });

            const newState = {
                ...state,
                currentTime: newTime,
                playerCharacter: newPlayer,
                companions: newCompanions,
                npcs: decayCorpses(state.npcs, state.mapZones, newTime)
            };

            if (newState.combatState) {
                newState.combatState = {
                    ...newState.combatState,
                    enemies: newState.combatState.enemies.map(e => decayActorBuffs(e, decay))
                };
            }

            return newState;
        }

        case 'RESET_WORLD':
            return {
                ...state,
                playerCharacter: getNewDndCharacter(),
                playerInventory: { equipped: [], carried: [], storage: [], assets: [] },
                companions: [],
                companionInventories: {},
                story: [],
                gallery: [],
                messages: [{ id: `sys-reset-${Date.now()}`, sender: 'system', content: 'A new adventure begins in this world.', type: 'neutral' }],
                objectives: [],
                nemeses: [],
                plotPoints: [],
                knowledge: [],
                mapZones: [],
                combatState: null,
                gmNotes: "",
                playerCoordinates: '0-0',
                currentLocale: "",
                current_site_id: "",
                current_site_name: "",
                current_site_detail: "",
                currentTime: "Day 1, 08:00",
                skillConfiguration: 'Fantasy',
                isPartyHidden: false,
                partyStealthScore: 10
            };

        case 'RESTART_ADVENTURE':
            return {
                ...state,
                playerCharacter: new PlayerCharacter({ ...state.playerCharacter, activeBuffs: [] }),
                playerInventory: { equipped: [], carried: [], storage: [], assets: [] },
                companions: [],
                companionInventories: {},
                story: [],
                gallery: state.gallery || [],
                messages: [{ id: `sys-restart-${Date.now()}`, sender: 'system', content: 'Timeline reset...', type: 'neutral' }],
                objectives: [],
                nemeses: [],
                plotPoints: [],
                knowledge: [],
                npcs: [],
                mapZones: [],
                combatState: null,
                gmNotes: "",
                playerCoordinates: '0-0',
                currentLocale: "",
                current_site_id: "",
                current_site_name: "",
                current_site_detail: "",
                globalStoreInventory: {},
                isPartyHidden: false,
                partyStealthScore: 10
            };

        case 'COMPLETE_RESTART': {
            const restartPayload = action.payload;
            const pcData = restartPayload.playerCharacter ? new PlayerCharacter(restartPayload.playerCharacter) : state.playerCharacter;
            const playerInv = restartPayload.playerInventory || { equipped: [], carried: [], storage: [], assets: [] };

            // Recalculate max heroic points for the newly set character state
            pcData.maxHeroicPoints = pcData.getMaxHeroicPoints(playerInv);
            // Cap current points
            pcData.heroicPoints = Math.min(pcData.heroicPoints || 0, pcData.maxHeroicPoints);

            return {
                ...state,
                playerCharacter: pcData,
                world: state.world,
                mapSectors: state.mapSectors || [],
                mapSettings: state.mapSettings,
                gmSettings: state.gmSettings,
                playerInventory: playerInv,
                companions: (restartPayload.companions || []).map(c => {
                    const comp = new Companion(c);
                    const compInv = (restartPayload.companionInventories || {})[c.id] || { equipped: [], carried: [], storage: [], assets: [] };
                    comp.maxHeroicPoints = comp.getMaxHeroicPoints(compInv);
                    return comp;
                }),
                companionInventories: restartPayload.companionInventories || {},
                story: restartPayload.story || [],
                gallery: state.gallery || [],
                messages: restartPayload.messages || [],
                objectives: restartPayload.objectives || [],
                knowledge: restartPayload.knowledge || [],
                mapZones: restartPayload.mapZones || [],
                playerCoordinates: restartPayload.playerCoordinates || '0-0',
                currentLocale: restartPayload.currentLocale || "",
                current_site_id: restartPayload.current_site_id || "",
                current_site_name: restartPayload.current_site_name || "",
                current_site_detail: restartPayload.current_site_detail || "",
                currentTime: restartPayload.currentTime || state.currentTime,
                npcs: restartPayload.npcs || [],
                nemeses: [],
                plotPoints: [],
                combatState: null,
                gmNotes: restartPayload.gmNotes || "",
                isPartyHidden: false,
                partyStealthScore: 10
            };
        }

        case 'UPDATE_GM_SETTINGS':
            return { ...state, gmSettings: action.payload };

        case 'WAIT': {
            const decay = getDecayFromTimeStrings(state.currentTime, action.payload.newTime);
            const newState = {
                ...state,
                currentTime: action.payload.newTime,
                playerCharacter: new PlayerCharacter(decayActorBuffs(state.playerCharacter, decay)),
                companions: state.companions.map(c => new Companion(decayActorBuffs(c, decay))),
                npcs: decayCorpses(state.npcs, state.mapZones, action.payload.newTime)
            };

            if (newState.combatState) {
                newState.combatState = {
                    ...newState.combatState,
                    enemies: newState.combatState.enemies.map(e => decayActorBuffs(e, decay))
                };
            }

            return newState;
        }

        case 'AI_UPDATE': {
            const updates = action.payload;
            let newState = { ...state };

            if (!updates) return newState;

            // --- SPATIAL SNAPPING LOGIC ---
            if (updates.location_update) {
                const loc = updates.location_update;

                // Enforce Ship Location
                const partyShip = newState.companions.find(c => c.isShip && c.isInParty !== false);
                if (partyShip) {
                    loc.site_id = `ship-${partyShip.id}`;
                    loc.site_name = partyShip.name;
                }

                const siteIdChanged = loc.site_id !== state.current_site_id;

                // Update identity anchors
                newState.current_site_id = loc.site_id;
                newState.current_site_name = loc.site_name;
                newState.current_site_detail = loc.narrative_detail;
                newState.currentLocale = loc.site_name; // Legacy compatibility

                // Update coordinates if pattern matches
                if (loc.sector && /^-?\d+--?\d+$/.test(loc.sector)) {
                    newState.playerCoordinates = loc.sector;
                }

                // TRIGGER SITE TRANSITION: Clear non-allied scene actors when moving to a new physical container
                if (siteIdChanged && newState.combatState) {
                    newState.combatState = {
                        ...newState.combatState,
                        enemies: newState.combatState.enemies.filter(e => e.isAlly || e.alignment === 'ally')
                    };
                }
            }

            // --- TEMPORAL DECAY ---
            if (updates.currentTime && state.currentTime) {
                const decay = getDecayFromTimeStrings(state.currentTime, updates.currentTime);
                if (decay > 0) {
                    newState.playerCharacter = new PlayerCharacter(decayActorBuffs(newState.playerCharacter, decay));
                    newState.companions = newState.companions.map(c => new Companion(decayActorBuffs(c, decay)));
                    if (newState.combatState) {
                        newState.combatState = {
                            ...newState.combatState,
                            enemies: newState.combatState.enemies.map(e => decayActorBuffs(e, decay))
                        };
                    }
                    newState.npcs = decayCorpses(newState.npcs, newState.mapZones, updates.currentTime);
                }
                newState.currentTime = updates.currentTime;
            }

            if (updates.gmNotes !== undefined) newState.gmNotes = updates.gmNotes;
            if (updates.playerCoordinates) newState.playerCoordinates = updates.playerCoordinates;
            if (updates.currentLocale !== undefined) newState.currentLocale = updates.currentLocale;

            if (updates.playerCharacter) {
                const mergedData = { ...newState.playerCharacter, ...updates.playerCharacter };
                newState.playerCharacter = new PlayerCharacter(mergedData);
                // Maintenance: Force recalculation of capacity based on potential trait/level changes in the update
                newState.playerCharacter.maxHeroicPoints = newState.playerCharacter.getMaxHeroicPoints(state.playerInventory);
            }

            if (updates.companions) {
                updates.companions.forEach(cUpdate => {
                    if (!cUpdate || !cUpdate.id) return;
                    const cIdx = newState.companions.findIndex(c => c.id === cUpdate.id);
                    if (cIdx > -1) {
                        const mergedData = { ...newState.companions[cIdx], ...cUpdate };
                        const updatedComp = new Companion(mergedData);
                        updatedComp.maxHeroicPoints = updatedComp.getMaxHeroicPoints(state.companionInventories[cUpdate.id]);
                        const newComps = [...newState.companions];
                        newComps[cIdx] = updatedComp;
                        newState.companions = newComps;
                    }
                });
            }

            if (updates.npcUpdates && Array.isArray(updates.npcUpdates)) {
                newState.npcs = (newState.npcs || []).map(existing => {
                    const update = updates.npcUpdates!.find(u => u.id === existing.id);
                    if (update) {
                        return { ...existing, ...update };
                    }
                    return existing;
                });
            }

            if (updates.inventoryUpdates && Array.isArray(updates.inventoryUpdates)) {
                updates.inventoryUpdates.forEach(batch => {
                    if (!batch) return;
                    const listName = batch.list || 'carried';
                    const ownerId = batch.ownerId || 'player';
                    const action = batch.action || 'add';
                    let targetList: Item[] | undefined;

                    if (ownerId === 'player') {
                        if (!newState.playerInventory) {
                            newState.playerInventory = { equipped: [], carried: [], storage: [], assets: [] };
                        } else {
                            newState.playerInventory = { ...newState.playerInventory };
                        }

                        newState.playerInventory[listName] = [...(newState.playerInventory[listName] || [])];
                        targetList = newState.playerInventory[listName];
                    } else {
                        newState.companionInventories = { ...newState.companionInventories };

                        if (!newState.companionInventories[ownerId]) {
                            newState.companionInventories[ownerId] = { equipped: [], carried: [], storage: [], assets: [] };
                        } else {
                            newState.companionInventories[ownerId] = { ...newState.companionInventories[ownerId] };
                        }

                        newState.companionInventories[ownerId][listName] = [...(newState.companionInventories[ownerId][listName] || [])];
                        targetList = newState.companionInventories[ownerId][listName];
                    }

                    if (targetList && batch.items && Array.isArray(batch.items)) {
                        batch.items.forEach(itemData => {
                            if (!itemData || !itemData.name) return;
                            const searchName = itemData.name.toLowerCase().trim();

                            if (action === 'remove') {
                                const idx = targetList!.findIndex(i => i.name.toLowerCase().trim() === searchName);
                                if (idx > -1) {
                                    const existing = targetList![idx];
                                    const qtyToRemove = itemData.quantity || 1;
                                    if ((existing.quantity || 1) > qtyToRemove) {
                                        targetList![idx] = new Item({ ...existing, quantity: (existing.quantity || 1) - qtyToRemove });
                                    } else {
                                        targetList!.splice(idx, 1);
                                    }
                                }
                            } else {
                                const existingIdx = targetList!.findIndex(i =>
                                    i.name && itemData.name &&
                                    i.name.toLowerCase() === itemData.name.toLowerCase() &&
                                    !i.stackId
                                );

                                if (existingIdx > -1) {
                                    const existing = targetList![existingIdx];
                                    targetList![existingIdx] = new Item({
                                        ...existing,
                                        quantity: (existing.quantity || 1) + (itemData.quantity || 1)
                                    });
                                } else {
                                    const item = new Item(itemData);
                                    if (!item.id) item.id = `item-${Date.now()}-${Math.random()}`;
                                    item.isNew = true;
                                    targetList!.push(item);
                                }
                            }
                        });
                    }
                });

                // Final sync: Inventory changes can include Heroic Point modifiers. 
                // Always sync capacity after inventory updates.
                newState.playerCharacter.maxHeroicPoints = newState.playerCharacter.getMaxHeroicPoints(newState.playerInventory);
                newState.companions.forEach(c => {
                    c.maxHeroicPoints = c.getMaxHeroicPoints(newState.companionInventories[c.id]);
                });
            }

            if (updates.knowledge && Array.isArray(updates.knowledge)) {
                newState.knowledge = [...(newState.knowledge || [])];
                updates.knowledge.forEach(entry => {
                    if (!entry) return;
                    const existingIdx = newState.knowledge!.findIndex(k => k.id === entry.id || (entry.title && k.title && String(k.title).toLowerCase().trim() === String(entry.title).toLowerCase().trim()));
                    if (existingIdx > -1) {
                        newState.knowledge![existingIdx] = { ...newState.knowledge![existingIdx], ...entry };
                    } else {
                        newState.knowledge!.push({ ...entry, id: entry.id || `know-${Date.now()}-${Math.random()}`, isNew: true } as LoreEntry);
                    }
                });
            }

            if (updates.objectives && Array.isArray(updates.objectives)) {
                newState.objectives = [...(newState.objectives || [])];
                const hasNewTracked = updates.objectives.some(o => o.isTracked);

                if (hasNewTracked) {
                    newState.objectives = newState.objectives.map(o => ({ ...o, isTracked: false }));
                }

                updates.objectives.forEach(obj => {
                    if (!obj) return;
                    const isUpdate = !!obj.id && newState.objectives!.some(o => o.id === obj.id);
                    if (!isUpdate && (!obj.title || obj.title.trim().length < 3)) {
                        return;
                    }
                    let existingIdx = newState.objectives!.findIndex(o => o.id === obj.id);
                    if (existingIdx === -1 && obj.title) {
                        existingIdx = newState.objectives!.findIndex(o => o.title && String(o.title).toLowerCase().trim() === String(obj.title).toLowerCase().trim());
                    }

                    if (existingIdx > -1) {
                        const existing = newState.objectives![existingIdx];
                        newState.objectives![existingIdx] = {
                            ...existing,
                            status: obj.status ? (String(obj.status).toLowerCase() as any) : existing.status,
                            content: obj.content || existing.content,
                            nextStep: obj.nextStep || existing.nextStep,
                            coordinates: obj.coordinates || existing.coordinates,
                            isTracked: obj.isTracked !== undefined ? obj.isTracked : existing.isTracked,
                            milestones: obj.milestones && Array.isArray(obj.milestones) ? Array.from(new Set([...(existing.milestones || []), ...obj.milestones])) : existing.milestones
                        };
                    } else if (obj.title && obj.content) {
                        newState.objectives!.push({
                            ...obj,
                            id: obj.id || `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            isNew: true,
                            status: obj.status ? (String(obj.status).toLowerCase() as any) : 'active',
                            nextStep: obj.nextStep || 'Establish a path.',
                            milestones: obj.milestones || [],
                            updates: []
                        } as LoreEntry);
                    }
                });
            }

            if (updates.mapZones && Array.isArray(updates.mapZones)) {
                newState.mapZones = [...(newState.mapZones || [])];
                updates.mapZones.forEach(zone => {
                    if (!zone || !zone.coordinates) return;
                    const existingIdx = newState.mapZones!.findIndex(z => z.id === zone.id || z.coordinates === zone.coordinates);
                    if (existingIdx > -1) {
                        newState.mapZones![existingIdx] = { ...newState.mapZones![existingIdx], ...zone };
                    } else {
                        const sector = (newState.mapSectors || []).find(s => s.coordinates.includes(zone.coordinates as string));
                        newState.mapZones!.push({
                            ...zone,
                            id: zone.id || `zone-${zone.coordinates}-${Date.now()}`,
                            visited: zone.visited !== undefined ? zone.visited : false,
                            sectorId: sector?.id,
                            isNew: true
                        } as MapZone);
                    }
                });
            }

            return newState;
        }

        default:
            return state;
    }
};

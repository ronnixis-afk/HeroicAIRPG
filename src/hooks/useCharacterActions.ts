// hooks/useCharacterActions.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, LoreEntry, MapZone, Item, Inventory, PlayerCharacter, Companion, NPC, ChatMessage, SKILL_NAMES, calculateModifier } from '../types';
import {
    generatePersonalDiscoveries,
    generateStartingScenario,
    auditSystemState,
    performHousekeeping,
    skinItemsForCharacter
} from '../services/geminiService';
import { forgeSkins } from '../utils/itemMechanics';
import { getXPForLevel, getObjectiveCompleteXP, getDiscoveryXP, getHalfwayXP, calculateCharacterMaxHp } from '../utils/mechanics';
import { useUI } from '../context/UIContext';
import { companionToNPC } from '../utils/npcUtils';
import { ABILITY_SCORES, type AbilityScoreName, type SkillName } from '../types';

export const useCharacterActions = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    ui: ReturnType<typeof useUI>,
    weaveGrandDesign: () => Promise<void>
) => {
    const { setCreationProgress, setError, setActiveView } = ui;

    const updatePlayerCharacter = useCallback(async (character: PlayerCharacter) => {
        dispatch({ type: 'UPDATE_PLAYER', payload: character });
    }, [dispatch]);

    const updateCompanion = useCallback(async (companion: Companion) => {
        dispatch({ type: 'UPDATE_COMPANION', payload: companion });
    }, [dispatch]);

    const useHeroicPoint = useCallback(() => {
        dispatch({ type: 'USE_HEROIC_POINT' });
    }, [dispatch]);

    const addCompanion = useCallback((defaultLevel: number = 1): string => {
        const newId = `comp-${Date.now()}`;

        const defaultAbilityScores = ABILITY_SCORES.reduce((acc, score) => {
            acc[score] = { score: 10 };
            return acc;
        }, {} as Record<AbilityScoreName, { score: number }>);

        const defaultSavingThrows = ABILITY_SCORES.reduce((acc, score) => {
            acc[score] = { proficient: false };
            return acc;
        }, {} as Record<AbilityScoreName, { proficient: boolean }>);

        const defaultSkills = SKILL_NAMES.reduce((acc, skill) => {
            acc[skill] = { proficient: false };
            return acc;
        }, {} as Record<SkillName, { proficient: boolean }>);

        const newCompanion = new Companion({
            id: newId,
            name: 'New Companion',
            level: defaultLevel,
            experiencePoints: getHalfwayXP(defaultLevel),
            abilityScores: defaultAbilityScores,
            savingThrows: defaultSavingThrows,
            skills: defaultSkills,
            maxHitPoints: 10,
            currentHitPoints: 10,
            armorClass: 10,
            speed: 30,
            proficiencyBonus: 2,
            numberOfAttacks: 1,
            relationship: 0,
        });

        dispatch({
            type: 'ADD_COMPANION',
            payload: {
                companion: newCompanion,
                inventory: { equipped: [], carried: [], storage: [], assets: [] }
            }
        });

        dispatch({
            type: 'ADD_NPC',
            payload: companionToNPC(newCompanion)
        });

        return newId;
    }, [dispatch]);

    const deleteCompanion = useCallback((companionId: string) => {
        dispatch({ type: 'DELETE_COMPANION', payload: companionId });
        dispatch({ type: 'DELETE_NPC', payload: `npc-${companionId}` });
    }, [dispatch]);

    const integrateCharacter = useCallback(async (character: PlayerCharacter | Companion, isCompanion: boolean = false) => {
        if (!gameData) return;

        const isJoiningMidGame = isCompanion && gameData.story.length > 0;
        setCreationProgress({ isActive: true, step: isJoiningMidGame ? "Provisioning companion..." : "Initializing integration engine...", progress: 5 });

        // Health Scaling Reconciliation: Ensure new high-level characters start with full HP
        const conScore = character.abilityScores.constitution.score;
        let startingMaxHp: number;
        if (isCompanion && (character as Companion).isShip) {
            const conMod = calculateModifier(conScore);
            const hpPerLevel = Math.max(1, 20 + (2 * conMod));
            startingMaxHp = hpPerLevel * character.level;
        } else {
            startingMaxHp = calculateCharacterMaxHp(character.level, conScore);
        }

        // Set both current and max HP to the correctly scaled value before integration
        character.maxHitPoints = startingMaxHp;
        character.currentHitPoints = startingMaxHp;

        const knowledgeUpdates: LoreEntry[] = [];
        let mapZonesUpdate: MapZone[] = [...(gameData.mapZones || [])];

        try {
            if (!isCompanion) {
                setCreationProgress({ isActive: true, step: "Establishing world resonance...", progress: 15 });

                const personalZones = await generatePersonalDiscoveries(character, gameData);

                setCreationProgress({ isActive: true, step: "Anchoring origins...", progress: 45 });

                personalZones.forEach((pz: any, i: number) => {
                    if (!pz.coordinates) return;
                    const newZone: MapZone = {
                        id: `zone-personal-${Date.now()}-${i}`,
                        coordinates: pz.coordinates,
                        name: pz.name || "A Discovery",
                        description: pz.description || "A thematic location.",
                        hostility: pz.hostility || 0,
                        sectorId: pz.sectorId,
                        visited: true,
                        tags: ['location', 'origin'],
                        keywords: pz.keywords || []
                    };
                    const existingIdx = mapZonesUpdate.findIndex(z => z.coordinates === pz.coordinates);
                    if (existingIdx > -1) mapZonesUpdate[existingIdx] = newZone;
                    else mapZonesUpdate.push(newZone);

                    if (pz.pois) {
                        pz.pois.forEach((poi: any, j: number) => {
                            knowledgeUpdates.push({
                                id: `know-pers-${Date.now()}-${i}-${j}`,
                                title: poi.title,
                                content: poi.content,
                                coordinates: pz.coordinates,
                                visited: poi.isBackgroundRelated === true,
                                tags: poi.isBackgroundRelated ? ['location', 'background'] : ['location'],
                                isNew: true
                            } as LoreEntry);
                        });
                    }
                });
            }

            setCreationProgress({ isActive: true, step: "Calculating starting assets...", progress: 60 });

            let base = 100;
            let multiplier = 10;
            if (character.level >= 17) { base = 20000; multiplier = 250; }
            else if (character.level >= 11) { base = 5000; multiplier = 250; }
            else if (character.level >= 5) { base = 500; multiplier = 25; }
            const roll = Math.floor(Math.random() * 10) + 1;
            const total = base + (roll * multiplier);
            const style = gameData.mapSettings?.style || 'fantasy';
            const curName = style.includes('sci-fi') ? 'Credits' : 'Gold Pieces';
            const startingFunds = new Item({
                id: `start-funds-${Date.now()}`,
                name: curName, quantity: total, tags: ['currency'],
                description: 'Initial wealth.', rarity: 'Common', isNew: true
            });

            const blueprints = [
                new Item({
                    name: 'Primary Sidearm',
                    tags: ['Light Weapon', 'melee'],
                    weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 },
                    rarity: 'Common',
                    equippedSlot: 'Main Hand'
                }),
                new Item({
                    name: 'Standard Ranged Utility',
                    tags: ['Light Weapon', 'ranged'],
                    weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 },
                    rarity: 'Common'
                }),
                new Item({
                    name: 'Protective Layer',
                    tags: ['Light Armor'],
                    armorStats: { baseAC: 12, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                    rarity: 'Common',
                    equippedSlot: 'Body'
                })
            ];

            const skinnedEquipment = await skinItemsForCharacter(blueprints, character, gameData.worldSummary || '');

            const processedInventory: Inventory = {
                equipped: skinnedEquipment.filter(i => i.equippedSlot),
                carried: [startingFunds, ...skinnedEquipment.filter(i => !i.equippedSlot)],
                storage: [],
                assets: []
            };

            let scenario = null;
            const coords = '0-0';

            if (!isCompanion) {
                setCreationProgress({ isActive: true, step: "Weaving narrative scenario...", progress: 75 });

                const hookIndex = Math.floor(Math.random() * 20) + 1;
                scenario = await generateStartingScenario(character, gameData, hookIndex);

                const sector = gameData.mapSectors?.find(s => s.coordinates.includes(coords));
                const startingZone: MapZone = {
                    id: `zone-start-${Date.now()}`,
                    coordinates: coords,
                    name: scenario.startingZone.name,
                    description: scenario.startingZone.description,
                    hostility: scenario.startingZone.hostility,
                    sectorId: sector?.id,
                    visited: true,
                    tags: ['location', 'safe', 'start'],
                };
                const existingStartIdx = mapZonesUpdate.findIndex(z => z.coordinates === coords);
                if (existingStartIdx > -1) mapZonesUpdate[existingStartIdx] = startingZone;
                else mapZonesUpdate.push(startingZone);

                scenario.startingZone.knowledge.forEach((k: any, i: number) => {
                    knowledgeUpdates.push({
                        id: `know-start-${Date.now()}-${i}`,
                        title: k.title,
                        content: k.content,
                        coordinates: coords,
                        visited: k.isBackgroundRelated === true,
                        tags: k.isBackgroundRelated ? ['location', 'background'] : ['location'],
                        isNew: true
                    } as LoreEntry);
                });
            }

            setCreationProgress({ isActive: true, step: "Synthesizing final reality...", progress: 85 });

            if (isCompanion) {
                const companion = character as Companion;
                dispatch({ type: 'ADD_COMPANION', payload: { companion, inventory: processedInventory } });
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-join-${Date.now()}`, sender: 'system', content: `${companion.name} has joined the party. Starting funds: ${startingFunds.quantity} ${startingFunds.name}.`, type: 'positive' } });

                setCreationProgress({ isActive: true, step: "Integration complete!", progress: 100 });
                await new Promise(resolve => setTimeout(resolve, 800));
                setCreationProgress({ isActive: false, step: '', progress: 0 });
                setActiveView('chat');
            } else if (scenario) {
                setCreationProgress({ isActive: true, step: "Auditing initial timeline...", progress: 90 });

                const baselineData = {
                    ...gameData!,
                    playerCharacter: character as PlayerCharacter,
                    playerInventory: processedInventory,
                    playerCoordinates: coords,
                    currentLocale: scenario.startingZone.name
                };

                const [auditRes, houseRes] = await Promise.all([
                    auditSystemState("Arrival", scenario.introNarrative, baselineData, [character.name]),
                    performHousekeeping("Arrival", scenario.introNarrative, baselineData)
                ]);

                const introNpcs: NPC[] = (auditRes.newNPCs || []).map(n => ({
                    id: n.id || `npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    relationship: 0,
                    status: 'Alive',
                    isNew: true,
                    ...n,
                    currentPOI: auditRes.currentLocale || scenario.startingZone.name
                } as NPC));

                if (houseRes.inventoryUpdates) {
                    houseRes.inventoryUpdates.forEach(batch => {
                        if (batch.ownerId === 'player' && batch.action !== 'remove') {
                            const skillConf = gameData?.skillConfiguration || 'Fantasy';
                            const skinnedItems = forgeSkins(batch.items, skillConf);
                            processedInventory[batch.list as keyof Inventory].push(...skinnedItems.map(i => new Item(i)));
                        }
                    });
                }

                const restartPayload: Partial<GameData> = {
                    playerCharacter: character as PlayerCharacter,
                    playerInventory: processedInventory,
                    story: [{ id: `log-intro-${Date.now()}`, timestamp: gameData.currentTime, location: scenario.startingZone.name, content: scenario.introNarrative, summary: scenario.introSummary, isNew: true }],
                    messages: [
                        { id: `sys-restart-${Date.now()}`, sender: 'system', content: `Journey synchronized. Initial wealth: ${startingFunds.quantity} ${startingFunds.name}.`, type: 'neutral' },
                        { id: `ai-intro-${Date.now()}`, sender: 'ai', content: scenario.introNarrative, location: scenario.startingZone.name }
                    ],
                    objectives: [{ id: `obj-start-${Date.now()}`, title: scenario.startingObjective.title, content: scenario.startingObjective.content, status: 'active', isTracked: true, isNew: true, tags: ['quest', 'main'], updates: [] }],
                    knowledge: knowledgeUpdates,
                    mapZones: mapZonesUpdate,
                    playerCoordinates: coords,
                    currentLocale: auditRes.currentLocale || scenario.startingZone.name,
                    npcs: introNpcs,
                    gmNotes: `Origin: ${scenario.introSummary}`
                };

                dispatch({ type: 'ADD_PLOT_POINT', payload: { id: `bg-pp-${Date.now()}`, content: `[Origin] ${character.background || "An explorer with no past."}`, type: 'Background', isNew: true } });
                dispatch({ type: 'COMPLETE_RESTART', payload: restartPayload });

                setCreationProgress({ isActive: true, step: "Integration complete!", progress: 100 });
                await new Promise(resolve => setTimeout(resolve, 800));
                setCreationProgress({ isActive: false, step: '', progress: 0 });
                setActiveView('chat');

                setTimeout(() => {
                    weaveGrandDesign();
                }, 150);
            }

        } catch (e) {
            console.error("Integration failed", e);
            setError(e instanceof Error ? e : new Error("Character integration failed."));
            setCreationProgress({ isActive: false, step: '', progress: 0 });
            throw e; // Re-throw to prevent wizard from closing
        }
    }, [gameData, dispatch, setCreationProgress, setError, setActiveView, weaveGrandDesign]);

    const integrateRefinedCharacter = useCallback(async (character: PlayerCharacter) => {
        return integrateCharacter(character, false);
    }, [integrateCharacter]);

    return {
        updatePlayerCharacter,
        updateCompanion,
        useHeroicPoint,
        addCompanion,
        deleteCompanion,
        integrateCharacter,
        integrateRefinedCharacter
    };
};

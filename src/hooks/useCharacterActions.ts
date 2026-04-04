// hooks/useCharacterActions.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, LoreEntry, MapZone, Item, Inventory, PlayerCharacter, Companion, NPC, ChatMessage, SKILL_NAMES, calculateModifier, CharacterSnapshot, createSnapshot } from '../types';
import {
    generatePersonalDiscoveries,
    generateStartingScenario,
    skinItemsForCharacter,
    preloadAdjacentZones
} from '../services/geminiService';
import { weaveHero } from '../services/aiCharacterService';
import { getXPForLevel, getObjectiveCompleteXP, getDiscoveryXP, getHalfwayXP, calculateCharacterMaxHp } from '../utils/mechanics';
import { useUI } from '../context/UIContext';
import { ABILITY_SCORES, type AbilityScoreName, type SkillName } from '../types';
import { companionToNPC } from '../utils/npcUtils';

import { getSystemRandom, getFairSystemRandom } from '../utils/systemRandom';
import { STORY_HOOKS, SettingType } from '../constants/storyHooks';

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

    const integrateCharacter = useCallback(async (character: PlayerCharacter | Companion, isCompanion: boolean = false, deferGameStart: boolean = false) => {
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
        character.isInitialized = true;

        const knowledgeUpdates: LoreEntry[] = [];
        let mapZonesUpdate: MapZone[] = [...(gameData.mapZones || [])];

        try {
            if (!isCompanion) {
                setCreationProgress({ isActive: true, step: "Establishing world resonance...", progress: 15 });

            /* Removal: No longer generating additional personal zones outside 0-0. Consolidating background POI into starting scenario. */
            }

            setCreationProgress({ isActive: true, step: "Calculating starting assets...", progress: 60 });

            let base = 50;
            let multiplier = 15;
            if (character.level >= 17) { base = 20000; multiplier = 500; }
            else if (character.level >= 11) { base = 5000; multiplier = 250; }
            else if (character.level >= 5) { base = 500; multiplier = 25; }
            const roll = getSystemRandom(1, 10);
            const total = base + (roll * multiplier);
            const style = gameData.mapSettings?.style || 'fantasy';
            const curName = (style.includes('sci-fi') || style.includes('modern')) ? 'Credits' : 'Gold Pieces';
            const startingFunds = new Item({
                id: `start-funds-${Date.now()}`,
                name: curName, quantity: total, tags: ['currency'],
                description: 'Initial wealth.', rarity: 'Common', isNew: true
            });

            // Thematic starting blueprints based on world style
            let blueprints: Item[] = [];
            
            if (style.includes('modern')) {
                blueprints = [
                    new Item({
                        name: 'Combat Knife',
                        tags: ['Light Weapon', 'melee'],
                        weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Slashing' }], enhancementBonus: 0, critRange: 19 },
                        rarity: 'Common',
                        equippedSlot: 'Main Hand'
                    }),
                    new Item({
                        name: 'Tactical Handgun',
                        tags: ['Light Weapon', 'ranged'],
                        weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 },
                        rarity: 'Common'
                    }),
                    new Item({
                        name: 'Kevlar Vest',
                        tags: ['Light Armor'],
                        armorStats: { baseAC: 12, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                        rarity: 'Common',
                        equippedSlot: 'Body'
                    })
                ];
            } else if (style.includes('sci-fi') || style.includes('futuristic')) {
                blueprints = [
                    new Item({
                        name: 'Laser Blade',
                        tags: ['Light Weapon', 'melee'],
                        weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Fire' }], enhancementBonus: 0, critRange: 19 },
                        rarity: 'Common',
                        equippedSlot: 'Main Hand'
                    }),
                    new Item({
                        name: 'Ion Pistol',
                        tags: ['Light Weapon', 'ranged'],
                        weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Electric' }], enhancementBonus: 0, critRange: 20 },
                        rarity: 'Common'
                    }),
                    new Item({
                        name: 'Mesh Underlay',
                        tags: ['Light Armor'],
                        armorStats: { baseAC: 12, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                        rarity: 'Common',
                        equippedSlot: 'Body'
                    })
                ];
            } else if (style.includes('magitech')) {
                blueprints = [
                    new Item({
                        name: 'Rune Blade',
                        tags: ['Light Weapon', 'melee'],
                        weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Force' }], enhancementBonus: 0, critRange: 19 },
                        rarity: 'Common',
                        equippedSlot: 'Main Hand'
                    }),
                    new Item({
                        name: 'Aether Caster',
                        tags: ['Light Weapon', 'ranged'],
                        weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Radiant' }], enhancementBonus: 0, critRange: 20 },
                        rarity: 'Common'
                    }),
                    new Item({
                        name: 'Infused Vest',
                        tags: ['Light Armor'],
                        armorStats: { baseAC: 12, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                        rarity: 'Common',
                        equippedSlot: 'Body'
                    })
                ];
            } else if (style.includes('historical')) {
                blueprints = [
                    new Item({
                        name: 'Dagger',
                        tags: ['Light Weapon', 'melee'],
                        weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Piercing' }], enhancementBonus: 0, critRange: 19 },
                        rarity: 'Common',
                        equippedSlot: 'Main Hand'
                    }),
                    new Item({
                        name: 'Sling',
                        tags: ['Light Weapon', 'ranged'],
                        weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 },
                        rarity: 'Common'
                    }),
                    new Item({
                        name: 'Padded Jack',
                        tags: ['Light Armor'],
                        armorStats: { baseAC: 11, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                        rarity: 'Common',
                        equippedSlot: 'Body'
                    })
                ];
            } else {
                // Fantasy fallback
                blueprints = [
                    new Item({
                        name: 'Dagger',
                        tags: ['Light Weapon', 'melee'],
                        weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Piercing' }], enhancementBonus: 0, critRange: 19 },
                        rarity: 'Common',
                        equippedSlot: 'Main Hand'
                    }),
                    new Item({
                        name: 'Shortbow',
                        tags: ['Light Weapon', 'ranged'],
                        weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 },
                        rarity: 'Common'
                    }),
                    new Item({
                        name: 'Leather Armor',
                        tags: ['Light Armor'],
                        armorStats: { baseAC: 11, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                        rarity: 'Common',
                        equippedSlot: 'Body'
                    })
                ];
            }

            let skinnedEquipment = blueprints;
            if (!deferGameStart && !character.unwovenDetails) {
                skinnedEquipment = await skinItemsForCharacter(blueprints, character, gameData.worldSummary || '');
            }

            const processedInventory: Inventory = {
                equipped: skinnedEquipment.filter((i: Item) => i.equippedSlot),
                carried: [startingFunds, ...skinnedEquipment.filter((i: Item) => !i.equippedSlot)],
                storage: [],
                assets: []
            };

            let scenario = null;
            const coords = '0-0';

            if (!isCompanion && !deferGameStart) {
                setCreationProgress({ isActive: true, step: "Weaving narrative scenario...", progress: 75 });

                const setting = (gameData?.skillConfiguration as SettingType) || 'Fantasy';
                const hooks = STORY_HOOKS[setting] || STORY_HOOKS.Fantasy;
                const hookIndex = getFairSystemRandom(1, hooks.length, `starting_hook_${setting.toLowerCase()}`, 4);
                const selectedHook = hooks[hookIndex - 1];

                scenario = await generateStartingScenario(character, gameData, selectedHook);

                const startingZone: MapZone = {
                    id: `zone-start-${Date.now()}`,
                    coordinates: coords,
                    name: scenario.startingZone.name,
                    description: scenario.startingZone.description,
                    hostility: scenario.startingZone.hostility,
                    populationLevel: scenario.startingZone.populationLevel,
                    zoneFeatures: scenario.startingZone.zoneFeatures,
                    visited: true,
                    tags: ['location', 'safe', 'start'],
                };
                const existingStartIdx = mapZonesUpdate.findIndex(z => z.coordinates === coords);
                if (existingStartIdx > -1) mapZonesUpdate[existingStartIdx] = startingZone;
                else mapZonesUpdate.push(startingZone);

                scenario.startingZone.knowledge.forEach((k: any, i: number) => {
                    const isDuplicate = knowledgeUpdates.some(kn => kn.coordinates === coords && kn.title === k.title);
                    if (isDuplicate) return;

                    const tags = k.isBackgroundRelated ? ['location', 'background'] : ['location'];
                    if (k.isPopulationCenter) tags.push('population-center');
                    knowledgeUpdates.push({
                        id: `know-start-${Date.now()}-${i}`,
                        title: k.title,
                        content: k.content,
                        coordinates: coords,
                        visited: k.isBackgroundRelated === true,
                        tags: tags,
                        isNew: true
                    } as LoreEntry);
                });
            }

            setCreationProgress({ isActive: true, step: "Synthesizing final reality...", progress: 85 });

            if (isCompanion) {
                const companion = character as Companion;
                dispatch({ type: 'ADD_COMPANION', payload: { companion, inventory: processedInventory } });
                dispatch({ type: 'ADD_NPC', payload: companionToNPC(companion) });
                dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-join-${Date.now()}`, sender: 'system', content: `${companion.name} has joined the party. Starting funds: ${startingFunds.quantity} ${startingFunds.name}.`, type: 'positive' } });

                setCreationProgress({ isActive: true, step: "Integration complete!", progress: 100 });
                await new Promise(resolve => setTimeout(resolve, 800));
                setCreationProgress({ isActive: false, step: '', progress: 0 });
                
                if (isJoiningMidGame) {
                    setActiveView('chat');
                }
            } else if (deferGameStart) {
                // Pre-game party creation logic
                setCreationProgress({ isActive: true, step: "Saving character data...", progress: 95 });
                
                const preGamePayload: Partial<GameData> = {
                    playerCharacter: character as PlayerCharacter,
                    playerInventory: processedInventory,
                    knowledge: knowledgeUpdates,
                    mapZones: mapZonesUpdate
                };

                dispatch({ type: 'SET_PRE_GAME_STATE', payload: preGamePayload });

                setCreationProgress({ isActive: true, step: "Integration complete!", progress: 100 });
                await new Promise(resolve => setTimeout(resolve, 800));
                setCreationProgress({ isActive: false, step: '', progress: 0 });
                // Note: We do NOT transition to 'chat' here; we stay on the party creation screen.
            } else if (scenario) {
                setCreationProgress({ isActive: true, step: "Synthesizing initial timeline...", progress: 90 });

                const baselineData = {
                    ...gameData!,
                    playerCharacter: character as PlayerCharacter,
                    playerInventory: processedInventory,
                    playerCoordinates: coords,
                    currentLocale: scenario.startingZone.name
                };

                const openAreaTitle = scenario.startingZone.knowledge[0]?.title || scenario.startingZone.name;
                const openAreaId = `know-start-${Date.now()}-0`;

                // Extract NPCs directly from the scenario response (no Auditor AI call needed)
                const introNpcs: NPC[] = (scenario.intro_npcs || []).map((n: any) => ({
                    id: `npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    name: n.name,
                    description: n.description,
                    race: n.race,
                    gender: n.gender,
                    relationship: 0,
                    status: 'Alive',
                    isNew: true,
                    currentPOI: openAreaTitle,
                    site_id: openAreaId
                } as NPC));

                const restartPayload: Partial<GameData> = {
                    playerCharacter: character as PlayerCharacter,
                    playerInventory: processedInventory,
                    story: [{ id: `log-intro-${Date.now()}`, timestamp: gameData.currentTime, location: scenario.startingZone.name, content: scenario.introNarrative, summary: scenario.introSummary, isNew: true }],
                    messages: [
                        { id: `sys-restart-${Date.now()}`, sender: 'system', content: `Journey synchronized. Initial wealth: ${startingFunds.quantity} ${startingFunds.name}.`, type: 'neutral' },
                        { id: `ai-intro-${Date.now()}`, sender: 'ai', content: scenario.introNarrative, location: scenario.startingZone.name, alignmentOptions: Array.isArray(scenario.alignmentOptions) ? scenario.alignmentOptions : undefined }
                    ],
                    objectives: [{ id: `obj-start-${Date.now()}`, title: scenario.startingObjective.title, content: scenario.startingObjective.content, status: 'active', isTracked: true, isNew: true, tags: ['quest', 'main'], updates: [] }],
                    knowledge: knowledgeUpdates,
                    mapZones: mapZonesUpdate,
                    playerCoordinates: coords,
                    currentLocale: scenario.startingZone.name,
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

                    // Trigger initial preloading for the starting area neighborhood
                    const dispatchZoneUpdate = (zone: MapZone) => {
                        dispatch({ type: 'UPDATE_MAP_ZONE', payload: zone });
                    };
                    const dispatchKnowledgeUpdate = (knowledge: Omit<LoreEntry, 'id'>[]) => {
                        dispatch({ type: 'ADD_KNOWLEDGE', payload: knowledge });
                    };

                    preloadAdjacentZones(coords, mapZonesUpdate, gameData!, dispatchZoneUpdate, dispatchKnowledgeUpdate, gameData!.knowledge || [])
                        .catch(e => console.error("Initial preloading failed:", e));
                }, 150);
            }

        } catch (e) {
            console.error("Integration failed", e);
            setCreationProgress({ 
                isActive: true, 
                step: "The Weaver's Hand Trembles...", 
                progress: 85,
                errorString: "The Architect's ink has dried or a cosmic hiccup has occurred. The Loom of Fate requires a gentle nudge.",
                onRetry: () => integrateCharacter(character, isCompanion, deferGameStart)
            });
            setError(e instanceof Error ? e : new Error("Character integration failed."));
            throw e; // Re-throw to prevent wizard from closing
        }
    }, [gameData, dispatch, setCreationProgress, setError, setActiveView, weaveGrandDesign]);

    const startJourney = useCallback(async (hookIndex?: number) => {
        if (!gameData || !gameData.playerCharacter || (gameData.playerCharacter.name === 'Adventurer' && !gameData.playerCharacter.isInitialized)) return;
        
        setCreationProgress({ isActive: true, step: "Finalizing Party Data...", progress: 5 });
        try {
            // First pass: Weave any pending characters
            let playerUpdates: Partial<PlayerCharacter> = {};
            if (gameData.playerCharacter.unwovenDetails) {
                setCreationProgress({ isActive: true, step: "Forging Main Hero backstory...", progress: 10 });
                const wovenData = await weaveHero(gameData as any, gameData.playerCharacter.unwovenDetails, false);
                playerUpdates = {
                    profession: wovenData.profession,
                    appearance: wovenData.appearance,
                    background: wovenData.background,
                    keywords: wovenData.keywords,
                    alignment: wovenData.moralAlignment
                };
                const abilities = [...gameData.playerCharacter.abilities];
                const combatIdx = abilities.findIndex(a => a.id.startsWith('combat-'));
                if (combatIdx > -1) {
                    abilities[combatIdx] = { ...wovenData.skinnedAbility, id: abilities[combatIdx].id };
                    playerUpdates.abilities = abilities;
                }
                
                const tempPlayerCharacter = Object.assign(new PlayerCharacter(gameData.playerCharacter), playerUpdates);
                delete tempPlayerCharacter.unwovenDetails;
                delete gameData.playerCharacter.unwovenDetails;
            }
            const finalPlayerCharacter = Object.assign(new PlayerCharacter(gameData.playerCharacter), playerUpdates);

            const pendingCompanions = gameData.companions?.filter(c => c.unwovenDetails) || [];
            const finalCompanions = [...(gameData.companions || [])];
            
            for (let i = 0; i < pendingCompanions.length; i++) {
                const comp = pendingCompanions[i];
                setCreationProgress({ isActive: true, step: `Enrolling ${comp.name}...`, progress: 10 + Math.floor((i + 1) * 10 / Math.max(1, pendingCompanions.length)) });
                const wovenData = await weaveHero(gameData as any, comp.unwovenDetails, true);
                
                const compIdx = finalCompanions.findIndex(c => c.id === comp.id);
                if (compIdx > -1) {
                    const matchedComp = finalCompanions[compIdx];
                    matchedComp.profession = wovenData.profession;
                    matchedComp.appearance = wovenData.appearance;
                    matchedComp.background = wovenData.background;
                    matchedComp.personality = comp.unwovenDetails.personality || wovenData.personality || matchedComp.personality;
                    matchedComp.keywords = wovenData.keywords;
                    matchedComp.alignment = wovenData.moralAlignment;
                    
                    const combatIdx = matchedComp.abilities.findIndex(a => a.id.startsWith('combat-'));
                    if (combatIdx > -1) {
                        matchedComp.abilities[combatIdx] = { ...wovenData.skinnedAbility, id: matchedComp.abilities[combatIdx].id };
                    }
                    delete matchedComp.unwovenDetails;
                }
            }

            const setting = (gameData.skillConfiguration as SettingType) || 'Fantasy';
            const hooks = STORY_HOOKS[setting] || STORY_HOOKS.Fantasy;
            
            const finalHookIndex = hookIndex !== undefined 
                ? Math.min(Math.max(1, hookIndex), hooks.length) 
                : getFairSystemRandom(1, hooks.length, `starting_hook_${setting.toLowerCase()}`, 4);
                
            const selectedHook = hooks[finalHookIndex - 1];

            setCreationProgress({ isActive: true, step: "Weaving narrative scenario...", progress: 20 });
            const scenario = await generateStartingScenario(finalPlayerCharacter, gameData, selectedHook, finalCompanions);

            // Check if player's coordinates exist in the mapZones (from SET_PRE_GAME_STATE)
            // If not, we just use 0-0.
            const coords = '0-0';

            const startingZone: MapZone = {
                id: `zone-start-${Date.now()}`,
                coordinates: coords,
                name: scenario.startingZone.name,
                description: scenario.startingZone.description,
                hostility: scenario.startingZone.hostility,
                populationLevel: scenario.startingZone.populationLevel,
                zoneFeatures: scenario.startingZone.zoneFeatures,
                visited: true,
                tags: ['location', 'safe', 'start'],
            };
            
            let mapZonesUpdate = [...(gameData.mapZones || [])];
            const existingStartIdx = mapZonesUpdate.findIndex(z => z.coordinates === coords);
            if (existingStartIdx > -1) mapZonesUpdate[existingStartIdx] = startingZone;
            else mapZonesUpdate.push(startingZone);

            let knowledgeUpdates = [...(gameData.knowledge || [])];
            scenario.startingZone.knowledge.forEach((k: any, i: number) => {
                const isDuplicate = knowledgeUpdates.some(kn => kn.coordinates === coords && kn.title === k.title);
                if (isDuplicate) return;

                const tags = k.isBackgroundRelated ? ['location', 'background'] : ['location'];
                if (k.isPopulationCenter) tags.push('population-center');
                knowledgeUpdates.push({
                    id: `know-start-${Date.now()}-${i}`,
                    title: k.title,
                    content: k.content,
                    coordinates: coords,
                    visited: k.isBackgroundRelated === true,
                    tags: tags,
                    isNew: true
                } as LoreEntry);
            });

            setCreationProgress({ isActive: true, step: "Synthesizing initial timeline...", progress: 60 });

            const openAreaTitle = scenario.startingZone.knowledge[0]?.title || scenario.startingZone.name;
            const openAreaId = `know-start-${Date.now()}-0`;

            // Extract NPCs directly from the scenario response (no Auditor AI call needed)
            const introNpcs: NPC[] = (scenario.intro_npcs || []).map((n: any) => ({
                id: `npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: n.name,
                description: n.description,
                race: n.race,
                gender: n.gender,
                relationship: 0,
                status: 'Alive',
                isNew: true,
                currentPOI: openAreaTitle,
                site_id: openAreaId
            } as NPC));

            const startingFundsQty = gameData.playerInventory?.carried?.find(i => i.tags?.includes('currency'))?.quantity || 100;
            const startingFundsName = gameData.playerInventory?.carried?.find(i => i.tags?.includes('currency'))?.name || 'Gold Pieces';

            // SYSTEMIC HEAL: Ensure characters are fully healed upon beginning a new journey
            finalPlayerCharacter.currentHitPoints = finalPlayerCharacter.maxHitPoints;
            finalPlayerCharacter.stamina = finalPlayerCharacter.maxStamina;
            finalPlayerCharacter.heroicPoints = finalPlayerCharacter.maxHeroicPoints;
            finalPlayerCharacter.statusEffects = [];

            finalCompanions.forEach(c => {
                c.currentHitPoints = c.maxHitPoints;
                c.stamina = c.maxStamina;
                c.heroicPoints = c.maxHeroicPoints;
                c.statusEffects = [];
            });

            const restartPayload: Partial<GameData> = {
                playerCharacter: finalPlayerCharacter,
                playerInventory: gameData.playerInventory,
                companions: finalCompanions,
                companionInventories: gameData.companionInventories || {},
                story: [{ id: `log-intro-${Date.now()}`, timestamp: gameData.currentTime, location: scenario.startingZone.name, content: scenario.introNarrative, summary: scenario.introSummary, isNew: true }],
                messages: [
                    { id: `sys-restart-${Date.now()}`, sender: 'system', content: `Journey synchronized. Party assembled. Initial wealth: ${startingFundsQty} ${startingFundsName}.`, type: 'neutral' },
                    { id: `ai-intro-${Date.now()}`, sender: 'ai', content: scenario.introNarrative, location: scenario.startingZone.name, alignmentOptions: Array.isArray(scenario.alignmentOptions) ? scenario.alignmentOptions : undefined }
                ],
                objectives: [{ id: `obj-start-${Date.now()}`, title: scenario.startingObjective.title, content: scenario.startingObjective.content, status: 'active', isTracked: true, isNew: true, tags: ['quest', 'main'], updates: [] }],
                knowledge: knowledgeUpdates,
                mapZones: mapZonesUpdate,
                playerCoordinates: coords,
                currentLocale: scenario.startingZone.name,
                npcs: [...(gameData.npcs || []), ...introNpcs],
                gmNotes: `Origin: ${scenario.introSummary}`,
                startingPartySnapshot: {
                    player: createSnapshot(finalPlayerCharacter),
                    companions: finalCompanions.map(c => createSnapshot(c))
                }
            };

            dispatch({ type: 'COMPLETE_RESTART', payload: restartPayload });

            setCreationProgress({ isActive: true, step: "Journey begins!", progress: 100 });
            await new Promise(resolve => setTimeout(resolve, 800));
            setCreationProgress({ isActive: false, step: '', progress: 0 });
            setActiveView('chat');

            setTimeout(() => {
                weaveGrandDesign();

                const dispatchZoneUpdate = (zone: MapZone) => {
                    dispatch({ type: 'UPDATE_MAP_ZONE', payload: zone });
                };
                const dispatchKnowledgeUpdate = (knowledge: Omit<LoreEntry, 'id'>[]) => {
                    dispatch({ type: 'ADD_KNOWLEDGE', payload: knowledge });
                };

                preloadAdjacentZones(coords, mapZonesUpdate, gameData!, dispatchZoneUpdate, dispatchKnowledgeUpdate, gameData!.knowledge || [])
                    .catch(e => console.error("Initial preloading failed:", e));
            }, 150);

        } catch (e) {
            console.error("Start Journey failed", e);
            setCreationProgress({ 
                isActive: true, 
                step: "The Path Is Obscured...", 
                progress: 90,
                errorString: "The journey cannot begin while the stars are misaligned. A rogue thread has snagged the Loom of Fate.",
                onRetry: () => startJourney(hookIndex)
            });
            setError(e instanceof Error ? e : new Error("Failed to start journey."));
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
        integrateRefinedCharacter,
        startJourney
    };
};

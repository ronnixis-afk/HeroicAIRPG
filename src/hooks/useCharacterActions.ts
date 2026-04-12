// hooks/useCharacterActions.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, LoreEntry, MapZone, Item, Inventory, PlayerCharacter, Companion, NPC, ChatMessage, SKILL_NAMES, calculateModifier, CharacterSnapshot, createSnapshot } from '../types';
import {
    generatePersonalDiscoveries,
    generateStartingScenario,
    skinItemsForCharacter,
    preloadAdjacentZones
} from '../services/geminiService';
import { weaveHero, weaveBio, skinAbilities } from '../services/aiCharacterService';
import { getXPForLevel, getObjectiveCompleteXP, getDiscoveryXP, getHalfwayXP, calculateCharacterMaxHp } from '../utils/mechanics';
import { useUI } from '../context/UIContext';
import { ABILITY_SCORES, type AbilityScoreName, type SkillName } from '../types';
import { companionToNPC } from '../utils/npcUtils';
import { getStartingInventory } from '../utils/startingGearUtils';

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

            const style = gameData.mapSettings?.style || 'fantasy';
            const baselineInventory = getStartingInventory(style, character.level);
            
            // Extract blueprints (non-currency items) and starting funds
            const blueprints = [
                ...baselineInventory.equipped, 
                ...baselineInventory.carried.filter((i: Item) => !i.tags?.includes('currency'))
            ];
            const startingFunds = baselineInventory.carried.find((i: Item) => i.tags?.includes('currency'))!;

            let skinnedEquipment = blueprints;

            // --- Robust Skinning Logic ---
            if (!deferGameStart) {
                if (character.unwovenDetails) {
                    setCreationProgress({ isActive: true, step: "Weaving character theme...", progress: 65 });
                    
                    const pendingPowers = [
                        ...character.abilities.filter(a => a.id.startsWith('power-') || a.category === 'power'),
                        ...(character.powers || [])
                    ];

                    const wovenBio = await weaveBio(gameData as any, {
                        ...character.unwovenDetails,
                    }, isCompanion);

                    character.name = wovenBio.name || character.name;
                    character.profession = wovenBio.profession;
                    character.appearance = wovenBio.appearance;
                    character.background = wovenBio.background;
                    character.keywords = wovenBio.keywords;
                    
                    // Safely handle personality (mostly for companions)
                    const pDetails = character.unwovenDetails.personality || wovenBio.personality || '';
                    if (pDetails) {
                        character.personality = pDetails;
                    }

                    character.alignment = wovenBio.moralAlignment;
                    character.abilityScores = wovenBio.abilityScores;
                    character.savingThrows = wovenBio.savingThrows;

                    // --- NEW STEP: UNLOCKING POWERS ---
                    setCreationProgress({ isActive: true, step: "Unlocking Powers...", progress: 68 });
                    const skinnedAbilities = await skinAbilities(gameData as any, {
                        name: character.name,
                        race: character.race,
                        profession: character.profession,
                        background: character.background
                    }, pendingPowers);

                    const otherAbilities = character.abilities.filter(a => !a.id.startsWith('power-') && a.category !== 'power');
                    character.abilities = otherAbilities;
                    character.powers = skinnedAbilities;

                    setCreationProgress({ isActive: true, step: "Personalizing equipment...", progress: 70 });
                    skinnedEquipment = await skinItemsForCharacter(blueprints, character, gameData.worldSummary || '');
                    
                    delete character.unwovenDetails;
                } else {
                    // Legacy/Blueprint-only skinning
                    skinnedEquipment = await skinItemsForCharacter(blueprints, character, gameData.worldSummary || '');
                }
            }

            const processedInventory: Inventory = {
                equipped: skinnedEquipment.filter((i: Item) => i.equippedSlot),
                carried: [startingFunds, ...skinnedEquipment.filter((i: Item) => !i.equippedSlot)],
                storage: [],
                assets: []
            };

            let scenario: any = null;
            const coords = '0-0';

            if (!isCompanion && !deferGameStart) {
                setCreationProgress({ isActive: true, step: "Weaving narrative scenario...", progress: 75 });

                const setting = (gameData?.skillConfiguration as SettingType) || 'Fantasy';
                const hooks = STORY_HOOKS[setting] || STORY_HOOKS.Fantasy;
                const hookIndex = getFairSystemRandom(1, hooks.length, `starting_hook_${setting.toLowerCase()}`, 4);
                const selectedHook = hooks[hookIndex - 1];

                const startTimestamp = Date.now();
                scenario = await generateStartingScenario(character, gameData, selectedHook);

                const startingZone: MapZone = {
                    id: `zone-start-${startTimestamp}`,
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
                        id: `know-start-${startTimestamp}-${i}`,
                        title: k.title,
                        content: k.content,
                        coordinates: coords,
                        visited: k.isBackgroundRelated === true || k.title === scenario.selectedStartPoi.title,
                        tags: tags,
                        isNew: true
                    } as LoreEntry);
                });

                // Store selected starting point info for the transition block
                scenario.finalStartId = `know-start-${startTimestamp}-${scenario.selectedStartPoiIndex}`;
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

                const startPoiId = scenario.finalStartId;
                const startPoiTitle = scenario.selectedStartPoi.title;

                const restartPayload: Partial<GameData> = {
                    playerCharacter: character as PlayerCharacter,
                    playerInventory: processedInventory,
                    story: [{ id: `log-intro-${Date.now()}`, timestamp: gameData.currentTime, location: startPoiTitle, content: scenario.introNarrative, summary: scenario.introSummary, isNew: true }],
                    messages: [
                        { id: `sys-restart-${Date.now()}`, sender: 'system', content: `Journey synchronized. Initial wealth: ${startingFunds.quantity} ${startingFunds.name}.`, type: 'neutral' },
                        { id: `ai-intro-${Date.now()}`, sender: 'ai', content: scenario.introNarrative, location: startPoiTitle, alignmentOptions: Array.isArray(scenario.alignmentOptions) ? scenario.alignmentOptions : undefined }
                    ],
                    objectives: [{ id: `obj-start-${Date.now()}`, title: scenario.startingObjective.title, content: scenario.startingObjective.content, status: 'active', isTracked: true, isNew: true, tags: ['quest', 'main'], updates: [] }],
                    knowledge: knowledgeUpdates,
                    mapZones: mapZonesUpdate,
                    playerCoordinates: coords,
                    currentLocale: startPoiTitle,
                    current_site_id: startPoiId,
                    current_site_name: startPoiTitle,
                    npcs: (scenario.intro_npcs || []).map((n: any) => ({
                        id: `npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        name: n.name,
                        description: n.description,
                        race: n.race,
                        gender: n.gender,
                        relationship: 0,
                        status: 'Alive',
                        isNew: true,
                        currentPOI: startPoiTitle,
                        site_id: startPoiId
                    } as NPC)),
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
            // --- STEP 1: CHARACTER WEAVING (BIO & POWERS) ---
            
            // Handle Main Hero
            let finalPlayerCharacter = new PlayerCharacter(gameData.playerCharacter);
            let finalPlayerInventory = { ...gameData.playerInventory } as Inventory;

            if (finalPlayerCharacter.unwovenDetails) {
                setCreationProgress({ isActive: true, step: "Forging Main Hero backstory...", progress: 10 });
                
                const pendingPowers = [
                    ...finalPlayerCharacter.abilities.filter(a => a.id.startsWith('power-') || a.category === 'power'),
                    ...(finalPlayerCharacter.powers || [])
                ];

                const wovenBio = await weaveBio(gameData as any, {
                    ...finalPlayerCharacter.unwovenDetails,
                }, false);

                finalPlayerCharacter.name = wovenBio.name || finalPlayerCharacter.name;
                finalPlayerCharacter.profession = wovenBio.profession;
                finalPlayerCharacter.appearance = wovenBio.appearance;
                finalPlayerCharacter.background = wovenBio.background;
                finalPlayerCharacter.keywords = wovenBio.keywords;
                finalPlayerCharacter.alignment = wovenBio.moralAlignment;
                finalPlayerCharacter.abilityScores = wovenBio.abilityScores;
                finalPlayerCharacter.savingThrows = wovenBio.savingThrows;
                
                // --- NEW STEP: UNLOCKING POWERS ---
                setCreationProgress({ isActive: true, step: "Unlocking Powers...", progress: 12 });
                const skinnedAbilities = await skinAbilities(gameData as any, {
                    name: finalPlayerCharacter.name,
                    race: finalPlayerCharacter.race,
                    profession: finalPlayerCharacter.profession,
                    background: finalPlayerCharacter.background
                }, pendingPowers);
                
                // Merge Skinned Powers
                const otherAbilities = finalPlayerCharacter.abilities.filter(a => !a.id.startsWith('power-') && a.category !== 'power');
                finalPlayerCharacter.abilities = otherAbilities;
                finalPlayerCharacter.powers = skinnedAbilities;

                // Skin Inventory
                setCreationProgress({ isActive: true, step: "Theming starting gear...", progress: 15 });
                const blueprints = [
                    ...finalPlayerInventory.equipped,
                    ...finalPlayerInventory.carried.filter(i => !i.tags?.includes('currency'))
                ];
                const currency = finalPlayerInventory.carried.find(i => i.tags?.includes('currency'));
                
                const skinnedItems = await skinItemsForCharacter(blueprints, finalPlayerCharacter, gameData.worldSummary || '');
                finalPlayerInventory.equipped = skinnedItems.filter(i => i.equippedSlot);
                finalPlayerInventory.carried = [
                    ...(currency ? [currency] : []),
                    ...skinnedItems.filter(i => !i.equippedSlot)
                ];

                delete finalPlayerCharacter.unwovenDetails;
            }

            // Handle Companions
            const finalCompanions = (gameData.companions || []).map(c => new Companion(c));
            const finalCompanionInventories = { ...(gameData.companionInventories || {}) };

            for (let i = 0; i < finalCompanions.length; i++) {
                const comp = finalCompanions[i];
                if (comp.unwovenDetails) {
                    setCreationProgress({ isActive: true, step: `Enrolling ${comp.name}...`, progress: 20 + Math.floor((i + 1) * 10 / Math.max(1, finalCompanions.length)) });
                    
                    const pendingPowers = [
                        ...comp.abilities.filter(a => a.id.startsWith('power-') || a.category === 'power'),
                        ...(comp.powers || [])
                    ];

                    const wovenBio = await weaveBio(gameData as any, {
                        ...comp.unwovenDetails,
                    }, true);
                    
                    comp.name = wovenBio.name || comp.name;
                    comp.profession = wovenBio.profession;
                    comp.appearance = wovenBio.appearance;
                    comp.background = wovenBio.background;
                    comp.personality = comp.unwovenDetails.personality || wovenBio.personality || comp.personality;
                    comp.keywords = wovenBio.keywords;
                    comp.alignment = wovenBio.moralAlignment;
                    comp.abilityScores = wovenBio.abilityScores;
                    comp.savingThrows = wovenBio.savingThrows;

                    // --- NEW STEP: UNLOCKING POWERS ---
                    setCreationProgress({ isActive: true, step: "Unlocking Powers...", progress: 25 });
                    const skinnedAbilities = await skinAbilities(gameData as any, {
                        name: comp.name,
                        race: comp.race,
                        profession: comp.profession,
                        background: comp.background
                    }, pendingPowers);

                    const otherAbilities = comp.abilities.filter(a => !a.id.startsWith('power-') && a.category !== 'power');
                    comp.abilities = otherAbilities;
                    comp.powers = skinnedAbilities;

                    // Skin Companion Inventory
                    const compInv = finalCompanionInventories[comp.id] || { equipped: [], carried: [], storage: [], assets: [] };
                    const blueprints = [
                        ...compInv.equipped,
                        ...compInv.carried.filter(i => !i.tags?.includes('currency'))
                    ];
                    const currency = compInv.carried.find(i => i.tags?.includes('currency'));

                    const skinnedItems = await skinItemsForCharacter(blueprints, comp, gameData.worldSummary || '');
                    finalCompanionInventories[comp.id] = {
                        ...compInv,
                        equipped: skinnedItems.filter(i => i.equippedSlot),
                        carried: [
                            ...(currency ? [currency] : []),
                            ...skinnedItems.filter(i => !i.equippedSlot)
                        ]
                    };

                    delete comp.unwovenDetails;
                }
            }

            // --- STEP 2: SCENARIO GENERATION ---

            const setting = (gameData.skillConfiguration as SettingType) || 'Fantasy';
            const hooks = STORY_HOOKS[setting] || STORY_HOOKS.Fantasy;
            
            const finalHookIndex = hookIndex !== undefined 
                ? Math.min(Math.max(1, hookIndex), hooks.length) 
                : getFairSystemRandom(1, hooks.length, `starting_hook_${setting.toLowerCase()}`, 4);
                
            const selectedHook = hooks[finalHookIndex - 1];

            const startTimestamp = Date.now();
            setCreationProgress({ isActive: true, step: "Weaving narrative scenario...", progress: 40 });
            const scenario = await generateStartingScenario(finalPlayerCharacter, gameData, selectedHook, finalCompanions);

            const coords = '0-0';

            const startingZone: MapZone = {
                id: `zone-start-${startTimestamp}`,
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
                    id: `know-start-${startTimestamp}-${i}`,
                    title: k.title,
                    content: k.content,
                    coordinates: coords,
                    visited: k.isBackgroundRelated === true || k.title === scenario.selectedStartPoi.title,
                    tags: tags,
                    isNew: true
                } as LoreEntry);
            });

            setCreationProgress({ isActive: true, step: "Synthesizing initial timeline...", progress: 70 });

            const startPoiId = `know-start-${startTimestamp}-${scenario.selectedStartPoiIndex}`;
            const startPoiTitle = scenario.selectedStartPoi.title;

            const introNpcs: NPC[] = (scenario.intro_npcs || []).map((n: any) => ({
                id: `npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: n.name,
                description: n.description,
                race: n.race,
                gender: n.gender,
                relationship: 0,
                status: 'Alive',
                isNew: true,
                currentPOI: startPoiTitle,
                site_id: startPoiId
            } as NPC));

            const startingFundsQty = finalPlayerInventory.carried?.find(i => i.tags?.includes('currency'))?.quantity || 100;
            const startingFundsName = finalPlayerInventory.carried?.find(i => i.tags?.includes('currency'))?.name || 'Gold Pieces';

            // --- STEP 3: FINAL SYNCHRONIZATION ---

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
                playerInventory: finalPlayerInventory,
                companions: finalCompanions,
                companionInventories: finalCompanionInventories,
                story: [{ id: `log-intro-${Date.now()}`, timestamp: gameData.currentTime, location: startPoiTitle, content: scenario.introNarrative, summary: scenario.introSummary, isNew: true }],
                messages: [
                    { id: `sys-restart-${Date.now()}`, sender: 'system', content: `Journey synchronized. Party assembled. Initial wealth: ${startingFundsQty} ${startingFundsName}.`, type: 'neutral' },
                    { id: `ai-intro-${Date.now()}`, sender: 'ai', content: scenario.introNarrative, location: startPoiTitle, alignmentOptions: Array.isArray(scenario.alignmentOptions) ? scenario.alignmentOptions : undefined }
                ],
                objectives: [{ id: `obj-start-${Date.now()}`, title: scenario.startingObjective.title, content: scenario.startingObjective.content, status: 'active', isTracked: true, isNew: true, tags: ['quest', 'main'], updates: [] }],
                knowledge: knowledgeUpdates,
                mapZones: mapZonesUpdate,
                playerCoordinates: coords,
                currentLocale: startPoiTitle,
                current_site_id: startPoiId,
                current_site_name: startPoiTitle,
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

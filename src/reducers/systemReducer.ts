// reducers/systemReducer.ts

import { GameData, GameAction, Item, LoreEntry, MapZone, Inventory, NPC } from '../types';
import { PlayerCharacter, Companion } from '../types';
import { consolidateCurrencyToPlayer } from '../utils/inventoryUtils';
import { getStartingInventory } from '../utils/startingGearUtils';
import { getNewDndCharacter } from '../services/mockSheetsService';
import { parseGameTime } from '../utils/timeUtils';
import { getPOITheme, isLocaleMatch } from '../utils/mapUtils';
import { LANGUAGE_TECHNIQUES, HUMAN_LANGUAGE_TECHNIQUE } from '../constants/languageTechniques';

const BOARDING_SHIP_MESSAGES = {
    fantasy: [
        (shipName: string, hasParty: boolean) => `${hasParty ? 'You and your party' : 'You'} gather ${hasParty ? 'your' : 'your'} belongings and board the ${shipName}, your footsteps echoing on the wooden planks as the crew prepares the sails. The vessel cuts a path through the swells, ready for whatever lies ahead.`,
        (shipName: string, hasParty: boolean) => `You step onto the creaking deck of the ${shipName}, the smell of salt and old oak filling your lungs. The sails unfurl like the wings of a great bird, catching the wind as ${hasParty ? 'you and your party' : 'you'} set out toward the horizon.`,
        (shipName: string, hasParty: boolean) => `The gangplank thuds against the dock as ${hasParty ? 'you and your party' : 'you'} climb aboard the ${shipName}. Heavy ropes are cast off, and the hull groans with life, carrying you into the unknown reaches of the sea.`,
        (shipName: string, hasParty: boolean) => `The ${shipName} awaits, its figurehead pointing boldly toward your destination. ${hasParty ? 'You and your party' : 'You'} take your place on deck, watching the shore recede as the waves begin their rhythmic greeting against the wood.`,
        (shipName: string, hasParty: boolean) => `A steady breeze whistles through the rigging of the ${shipName} as ${hasParty ? 'you and your companions' : 'you'} come aboard. With a sharp command from the captain, the anchor is raised, and the vast span of the ocean opens before you.`
    ],
    modern: [
        (shipName: string, hasParty: boolean) => `${hasParty ? 'You and your party' : 'You'} haul the gear onto the ${shipName} and secure the hatches. You take the helm, the engine rumbling to life with a steady thrum into the hull. You clear the harbor, the wake trailing behind you.`,
        (shipName: string, hasParty: boolean) => `The metal deck of the ${shipName} vibrates under your boots as the generator hums. ${hasParty ? 'You and your group' : 'You'} check the navigation lights and give the signal; with a powerful surge, the vessel pushes away from the pier.`,
        (shipName: string, hasParty: boolean) => `You step onto the ${shipName}, the scent of diesel and sea air meeting you. With the flick of a few switches, the dashboard glows to life, and ${hasParty ? 'you and your party' : 'you'} watch as the propellers begin to churn the water into a white foam.`,
        (shipName: string, hasParty: boolean) => `Gear stowed and lines released. ${hasParty ? 'You and your team' : 'You'} take your position on the ${shipName}, feel the throb of the engine through the deck, and steer the craft into the open channel, leaving the safety of the dock behind.`,
        (shipName: string, hasParty: boolean) => `The ${shipName} bobs rhythmically as ${hasParty ? 'you and your party' : 'you'} board. You settle into the seats, the roar of the outboard motor drowning out the gulls as you accelerate towards the open water.`
    ],
    scifi: [
        (shipName: string, hasParty: boolean) => `Airlock cycled. ${hasParty ? 'You and your party' : 'You'} step into the pressurized cabin of the ${shipName} as the pre-flight sequence begins. The ion thrusters whine with increasing intensity before lifting you from the surface.`,
        (shipName: string, hasParty: boolean) => `The ramp retracts with a mechanical hiss as ${hasParty ? 'you and your party' : 'you'} board the ${shipName}. Synthetic gravity kicks in, grounding your steps as the pilot initiates the launch sequence, the stars awaiting your arrival.`,
        (shipName: string, hasParty: boolean) => `You step into the sleek interior of the ${shipName}, the humming reactor sounding like a heartbeat through the walls. Atmospheric scrubbers whir as ${hasParty ? 'your group' : 'you'} untether, drifting momentarily before the main drive ignites.`,
        (shipName: string, hasParty: boolean) => `Primary systems online. ${hasParty ? 'You and your party' : 'You'} take your stations aboard the ${shipName}. The external viewports shutter as the ship prepares for the high-G burn that will carry you through the void.`,
        (shipName: string, hasParty: boolean) => `A flash of blue light signals the connection between your suit and the ${shipName}'s interface. ${hasParty ? 'You and your crew' : 'You'} walk through the boarding tube, the silence of space replaced by the comforting vibration of an active starship.`
    ],
    magitech: [
        (shipName: string, hasParty: boolean) => `${hasParty ? 'You and your party' : 'You'} ascend the shimmering gangplank of the ${shipName}, feeling the hum of the mana-crystals beneath your feet. The navigator strikes the resonance chord, and the vessel lifts on a cushion of aetheric currents.`,
        (shipName: string, hasParty: boolean) => `The deck of the ${shipName} glows with intricate runes as ${hasParty ? 'you and your companions' : 'you'} step aboard. A sudden warmth spreads from the core as the arcane engines engage, lifting the ship effortlessly into the shimmering ley-lines.`,
        (shipName: string, hasParty: boolean) => `Arclight flickers along the hull of the ${shipName} as ${hasParty ? 'you and your party' : 'you'} come aboard. The air tastes of ozone and ancient spells; with a soft chime, the ship begins to glide through the currents of the world's soul.`,
        (shipName: string, hasParty: boolean) => `You board the ${shipName}, the wood and metal pulsating with vibrant energy. ${hasParty ? 'Your party' : 'You'} watch as the aether-sails catch the invisible tides of magic, and with a silent surge, you are carried away on a breath of pure enchantment.`,
        (shipName: string, hasParty: boolean) => `The ${shipName} hums a melodic tune as ${hasParty ? 'you and your party' : 'you'} ascend. You feel the connection to the world thrumming through the deck, the mana-flow directing your path as the vessel prepares to transcend the physical distance.`
    ]
};

const LEAVING_SHIP_MESSAGES = {
    fantasy: [
        (shipName: string, hasParty: boolean) => `You step off the ${shipName}, your boots meeting solid ground once more as the echo of the shifting tides fades. Behind you, the vessel stands tall, a silent sentinel of your journey across the deep.`,
        (shipName: string, hasParty: boolean) => `The wood of the dock feels strangely firm as ${hasParty ? 'you and your party' : 'you'} disembark from the ${shipName}. You look back one last time at the masts silhouetted against the sky, the tang of sea salt still clinging to your cloak.`,
        (shipName: string, hasParty: boolean) => `${hasParty ? 'You and your party' : 'You'} walk down the gangway, leaving the ${shipName} at rest in the harbor. The sway of the deck lingers in your stride as you turn your back to the water and face the challenges of the land.`,
        (shipName: string, hasParty: boolean) => `Farewell to the waves. You step from the ${shipName} onto the shore, the rhythmic creaking of the hull replaced by the sounds of the bustling port. ${hasParty ? 'Your' : 'Your'} sea-legs will take time to fade, but the road calls.`,
        (shipName: string, hasParty: boolean) => `Dust rises from your boots as ${hasParty ? 'you and your party' : 'you'} step off the ${shipName}. The journey was long, but as you reach solid earth, you feel the weight of your land-bound quest return. The ship remains behind, its duty done for now.`
    ],
    modern: [
        (shipName: string, hasParty: boolean) => `The engine cuts to a silence that feels heavy after hours of transit. ${hasParty ? 'You and your group' : 'You'} disembark from the ${shipName}, the scents of the land replacing the salt-spray. The journey is complete; the path ahead is ${hasParty ? 'yours' : 'yours'} to walk.`,
        (shipName: string, hasParty: boolean) => `You step from the ${shipName} onto the pier, the vibration of the engine still tingling in your feet. The modern world greets ${hasParty ? 'you and your party' : 'you'} with its familiar sounds as you leave the vessel behind at its mooring.`,
        (shipName: string, hasParty: boolean) => `The cleats are secured and the engine stilled. ${hasParty ? 'You and your team' : 'You'} climb off the ${shipName}, feeling the stable earth beneath you. The boat sways gently in your wake, a metal shell resting after its trial on the water.`,
        (shipName: string, hasParty: boolean) => `Transit complete. ${hasParty ? 'You and your party' : 'You'} gather your bags and step off the ${shipName}. The smell of exhaust fades into the air of the port, and the horizon you chased is now just a memory behind you.`,
        (shipName: string, hasParty: boolean) => `You disembark the ${shipName}, the metal hull cooling in the breeze. As ${hasParty ? 'your party walks' : 'you walk'} away from the docks, the steady ground feels strange, a reminder of the miles you covered across the shifting blue.`
    ],
    scifi: [
        (shipName: string, hasParty: boolean) => `Hissing hydraulics signal the opening of the airlock. ${hasParty ? 'You and your party' : 'You'} step out onto the surface as the ${shipName} cycles into standby mode. The hum of its reactor stays with you, a fading vibration as you find your footing in this new world.`,
        (shipName: string, hasParty: boolean) => `The pressure equalizes with a sharp pop, and the ramp of the ${shipName} descends. ${hasParty ? 'You and your party' : 'You'} step into the alien atmosphere, the synthetic sterile air of the cabin replaced by the raw, untamed scents of a new planet.`,
        (shipName: string, hasParty: boolean) => `You disembark from the ${shipName}, your boots striking the landing pad. The ship’s engines cool with a series of metallic ticks, its lights dimming as ${hasParty ? 'your crew' : 'you'} enter a new chapter, its journey through the stars paused.`,
        (shipName: string, hasParty: boolean) => `Footsteps echoing in the hollow boarding bay, ${hasParty ? 'you and your party' : 'you'} leave the ${shipName}. The vastness of the cosmos is now shielded behind the ship's hull, and the immediate reality of the ground beneath you takes hold.`,
        (shipName: string, hasParty: boolean) => `The airlock door slides shut behind ${hasParty ? 'your party' : 'you'} as you step off the ${shipName}. For a moment, you feel the lingering gravity of the ship, but as you walk forward, the weight of the world takes over, anchoring you to your new goal.`
    ],
    magitech: [
        (shipName: string, hasParty: boolean) => `The aetheric cushion dissipates with a soft chime. ${hasParty ? 'You and your party' : 'You'} descend the crystalline ramp of the ${shipName}, the resonance of the ley-lines grounding you. Your vessel remains behind, its mana-cells glowing faintly as you embark on your land-bound quest.`,
        (shipName: string, hasParty: boolean) => `You step off the ${shipName}, the tingling of arcane energy fading from your skin. The runes on the hull dim as ${hasParty ? 'your group touches' : 'you touch'} the natural earth, the grounded world reclaiming you from the ephemeral paths of the sky.`,
        (shipName: string, hasParty: boolean) => `The shimmering ramp retracts as ${hasParty ? 'you and your party' : 'you'} disembark the ${shipName}. You look back at the vessel, its crystalline parts catching the light like a gemstone. The silence of the world feels heavy after the singing of the mana-engines.`,
        (shipName: string, hasParty: boolean) => `Ley-line connection severed. ${hasParty ? 'You and your party' : 'You'} walk away from the ${shipName}, the air of the land feeling thick and heavy compared to the lightness of magic. The vessel waits, a beacon of arcane potential resting in the port.`,
        (shipName: string, hasParty: boolean) => `You leave the ${shipName}, the soft hum of its core still echoing in your mind. As ${hasParty ? 'your party walks' : 'you walk'} forward, the magical resonance fades, replaced by the mundane sounds of your destination. The adventure on the magic-tide ends, and a new one begins on foot.`
    ]
};

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
        case 'SET_GAME_DATA': {
            const loadedData = action.payload;
            
            // Backwards compatibility: Assign language config to old races
            if (loadedData && Array.isArray(loadedData.knowledge)) {
                const shuffledLanguages = [...LANGUAGE_TECHNIQUES].sort(() => 0.5 - Math.random());
                let languageIndex = 0;
                
                let modified = false;
                const updatedKnowledge = loadedData.knowledge.map(lore => {
                    if (lore.tags && lore.tags.includes('race') && !lore.languageConfig) {
                        modified = true;
                        let config = HUMAN_LANGUAGE_TECHNIQUE;
                        if (lore.title.toLowerCase() !== 'humans' && lore.title.toLowerCase() !== 'human') {
                            config = shuffledLanguages[languageIndex % shuffledLanguages.length];
                            languageIndex++;
                        }
                        return { ...lore, languageConfig: config };
                    }
                    return lore;
                });
                
                if (modified) {
                    return { ...loadedData, knowledge: updatedKnowledge };
                }
            }
            
            return loadedData;
        }

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
                stamina: type === 'long'
                    ? playerInstance.getMaxStamina(state.playerInventory)
                    : Math.min(
                        playerInstance.getMaxStamina(state.playerInventory),
                        (state.playerCharacter.stamina || 0) + Math.floor(playerInstance.getMaxStamina(state.playerInventory) * 0.25)
                    ),
                heroicPoints: type === 'long'
                    ? currentMaxHeroic
                    : Math.min(state.playerCharacter.heroicPoints || 0, currentMaxHeroic)
            });

            if (type === 'short') {
                // Recharge short rest abilities
                newPlayer.abilities = newPlayer.abilities.map(a =>
                    a.usage?.type === 'per_short_rest'
                        ? { ...a, usage: { ...a.usage, currentUses: a.usage.maxUses } }
                        : a
                );
            }

            if (type === 'long') {
                newPlayer.abilities = newPlayer.abilities.map(a =>
                    a.usage ? { ...a, usage: { ...a.usage, currentUses: a.usage.maxUses } } : a
                );
            }

            // --- RECHARGE ITEMS ---
            const rechargeInventory = (inv: Inventory): Inventory => {
                const updateItem = (item: Item) => {
                    if (!item.usage) return item;
                    const isShort = item.usage.type === 'per_short_rest';
                    const isLong = item.usage.type === 'per_long_rest';
                    if (type === 'long' && (isShort || isLong)) {
                        return new Item({ ...item, usage: { ...item.usage, currentUses: item.usage.maxUses } });
                    }
                    if (type === 'short' && isShort) {
                        return new Item({ ...item, usage: { ...item.usage, currentUses: item.usage.maxUses } });
                    }
                    return item;
                };

                return {
                    ...inv,
                    equipped: inv.equipped.map(updateItem),
                    carried: inv.carried.map(updateItem),
                    storage: inv.storage.map(updateItem),
                    assets: inv.assets.map(updateItem),
                };
            };

            const newPlayerInventory = rechargeInventory(state.playerInventory);
            
            const newCompanionInventories = { ...state.companionInventories };
            Object.keys(newCompanionInventories).forEach(id => {
                newCompanionInventories[id] = rechargeInventory(newCompanionInventories[id]);
            });

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
                    temporaryHitPoints: newCompMaxTempHP,
                    stamina: type === 'long'
                        ? compInstance.getMaxStamina(compInventory)
                        : Math.min(
                            compInstance.getMaxStamina(compInventory),
                            (c.stamina || 0) + Math.floor(compInstance.getMaxStamina(compInventory) * 0.25)
                        )
                });

                if (type === 'short') {
                    // Recharge short rest abilities
                    updatedComp.abilities = updatedComp.abilities.map(a =>
                        a.usage?.type === 'per_short_rest'
                            ? { ...a, usage: { ...a.usage, currentUses: a.usage.maxUses } }
                            : a
                    );
                }

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
                playerInventory: newPlayerInventory,
                companions: newCompanions,
                companionInventories: newCompanionInventories,
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

        case 'RESET_WORLD': {
            const hasSnapshot = !!state.startingPartySnapshot;
            const playerFromSnapshot = hasSnapshot 
                ? new PlayerCharacter(state.startingPartySnapshot!.player as Partial<PlayerCharacter>)
                : getNewDndCharacter();
            
            const companionsFromSnapshot = hasSnapshot
                ? (state.startingPartySnapshot!.companions || []).map(c => new Companion(c as Partial<Companion>))
                : [];

            const style = state.mapSettings?.style || 'fantasy';
            const playerInventory = getStartingInventory(style, playerFromSnapshot.level);

            const newCompanionInventories: Record<string, Inventory> = {};
            companionsFromSnapshot.forEach(c => {
                newCompanionInventories[c.id] = getStartingInventory(style, c.level);
            });

            return {
                ...state,
                playerCharacter: playerFromSnapshot,
                playerInventory: playerInventory,
                companions: companionsFromSnapshot,
                companionInventories: newCompanionInventories,
                story: [],
                gallery: [],
                messages: [{ id: `sys-reset-${Date.now()}`, sender: 'system', content: 'A new adventure begins in this world.', type: 'neutral' }],
                objectives: [],
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
                currentSubLocation: "",
                currentTime: state.currentTime || "Day 1, 08:00",
                skillConfiguration: state.skillConfiguration || 'Fantasy',
                isPartyHidden: false,
                partyStealthScore: 10,
                startingPartySnapshot: state.startingPartySnapshot
            };
        }

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
                currentSubLocation: "",
                globalStoreInventory: {},
                isPartyHidden: false,
                partyStealthScore: 10
            };

        case 'SET_PRE_GAME_STATE': {
            const preGamePayload = action.payload;
            const pcData = new PlayerCharacter(preGamePayload.playerCharacter as Partial<PlayerCharacter>);
            const playerInv = preGamePayload.playerInventory || { equipped: [], carried: [], storage: [], assets: [] };
            pcData.maxHeroicPoints = pcData.getMaxHeroicPoints(playerInv);
            pcData.heroicPoints = Math.min(pcData.heroicPoints || 0, pcData.maxHeroicPoints);

            return {
                ...state,
                playerCharacter: pcData,
                playerInventory: playerInv,
                knowledge: preGamePayload.knowledge || state.knowledge || [],
                mapZones: preGamePayload.mapZones || state.mapZones || [],
                story: [],
                currentTime: state.currentTime,
            };
        }

        case 'COMPLETE_RESTART': {
            const restartPayload = action.payload;
            const pcData = restartPayload.playerCharacter ? new PlayerCharacter(restartPayload.playerCharacter) : state.playerCharacter;
            const playerInv = restartPayload.playerInventory || { equipped: [], carried: [], storage: [], assets: [] };

            // Recalculate max heroic points for the newly set character state
            pcData.maxHeroicPoints = pcData.getMaxHeroicPoints(playerInv);
            // Cap current points
            pcData.heroicPoints = Math.min(pcData.heroicPoints || 0, pcData.maxHeroicPoints);

            const newState: GameData = {
                ...state,
                playerCharacter: pcData,
                world: state.world,
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
                currentSubLocation: restartPayload.currentSubLocation || "",
                currentTime: restartPayload.currentTime || state.currentTime,
                npcs: restartPayload.npcs || [],
                plotPoints: [],
                combatState: null,
                gmNotes: restartPayload.gmNotes || "",
                isPartyHidden: false,
                partyStealthScore: 10,
                startingPartySnapshot: restartPayload.startingPartySnapshot || state.startingPartySnapshot
            };
            return consolidateCurrencyToPlayer(newState);
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
            
            // --- VESSEL ENCLOSURE STATE ---
            if (updates.isAboard !== undefined) {
                newState.isAboard = updates.isAboard;
                
                // SYNC: Narrative -> System (Aboard implies in party)
                newState.companions = newState.companions.map(c => {
                    if (c.isShip) {
                        return new Companion({ ...c, isInParty: updates.isAboard });
                    }
                    return c;
                });
            }

            // --- SPATIAL SNAPPING LOGIC ---
            if (updates.location_update) {
                const loc = updates.location_update;
                const siteIdChanged = loc.site_id !== state.current_site_id;

                // Update identity anchors (Physical POI)
                newState.current_site_id = loc.site_id;
                newState.current_site_name = loc.site_name;

                // NARRATIVE LOCALE: AI update sets the base site name. 
                // The Ship Enclosure Sentinel in game_reducer.ts will forcibly snap it back to 'Inside [Ship]' if a healthy vessel is in the party.
                newState.currentLocale = loc.site_name;

                // Update coordinates if pattern matches
                if (loc.coordinates && /^-?\d+-(-?\d+)$/.test(loc.coordinates)) {
                    newState.playerCoordinates = loc.coordinates;
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
            if (updates.currentSubLocation !== undefined) newState.currentSubLocation = updates.currentSubLocation;

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
                        const oldComp = state.companions?.find(c => c.id === cUpdate.id) || newState.companions[cIdx];
                        const mergedData = { ...oldComp, ...cUpdate };
                        const updatedComp = new Companion(mergedData);

                        // SHIP TRANSITION DETECTION: Automated Boarding/Disembarking Narratives
                        if (updatedComp.isShip && cUpdate.isInParty !== undefined && cUpdate.isInParty !== oldComp.isInParty) {
                            const theme = getPOITheme(newState.worldSummary || "");
                            const shipName = updatedComp.name;

                            // Calculate party context
                            const followers = newState.companions.filter(c => !c.isShip && c.isInParty);
                            const hasParty = followers.length > 0;

                            // Case A: Disembarking (Removal from party)
                            if (cUpdate.isInParty === false && oldComp.isInParty !== false) {
                                const variationIdx = Math.floor(Math.random() * 5);
                                const content = (LEAVING_SHIP_MESSAGES as any)[theme]?.[variationIdx]?.(shipName, hasParty) || LEAVING_SHIP_MESSAGES.fantasy[0](shipName, hasParty);

                                newState.messages = [...newState.messages, {
                                    id: `disembark-${Date.now()}-${Math.random()}`,
                                    sender: 'ai',
                                    content: content,
                                    type: 'neutral'
                                }];
                            }

                            // Case B: Boarding (Addition to party)
                            // ENCLOSURE RULE: Only narrative if ship is functional (HP > 0)
                            if (cUpdate.isInParty === true && oldComp.isInParty === false && updatedComp.currentHitPoints > 0) {
                                const variationIdx = Math.floor(Math.random() * 5);
                                const content = (BOARDING_SHIP_MESSAGES as any)[theme]?.[variationIdx]?.(shipName, hasParty) || BOARDING_SHIP_MESSAGES.fantasy[0](shipName, hasParty);

                                newState.messages = [...newState.messages, {
                                    id: `boarding-${Date.now()}-${Math.random()}`,
                                    sender: 'ai',
                                    content: content,
                                    type: 'neutral'
                                }];
                                
                                // Note: Locale SNAP is handled globally by Ship Enclosure Sentinel in game_reducer.ts
                            }
                            
                            // SYNC: System -> Narrative (Party membership implies being aboard)
                            if (updates.isAboard === undefined) {
                                newState.isAboard = updatedComp.isInParty;
                            }
                        }

                        updatedComp.maxHeroicPoints = updatedComp.getMaxHeroicPoints(state.companionInventories[cUpdate.id]);
                        const newComps = [...newState.companions];
                        newComps[cIdx] = updatedComp;
                        newState.companions = newComps;
                    }
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

                // Automatic consolidation after AI inventory updates
                newState = consolidateCurrencyToPlayer(newState);
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
                        // If it's the currently tracked quest, allow 'nextStep' to update and accept 'progressUpdate' strings
                        const isThisQuestTracked = existing.isTracked;
                        const newNextStep = isThisQuestTracked ? (obj.nextStep || existing.nextStep) : existing.nextStep;

                        let newMilestones = [...(existing.milestones || [])];
                        // Only auto-append chronological logs for tracked quests
                        if (isThisQuestTracked && obj.progressUpdate) {
                            const timestampFormatted = `[${newState.currentTime}] ${obj.progressUpdate}`;
                            newMilestones.push(timestampFormatted);
                        } else if (obj.milestones && Array.isArray(obj.milestones)) {
                            // Legacy support
                            newMilestones = Array.from(new Set([...newMilestones, ...obj.milestones]));
                        }

                        newState.objectives![existingIdx] = {
                            ...existing,
                            status: obj.status ? (String(obj.status).toLowerCase() as any) : existing.status,
                            content: existing.content, // ALWAYS retain originally generated completion condition
                            nextStep: newNextStep,
                            coordinates: obj.coordinates || existing.coordinates,
                            isTracked: obj.isTracked !== undefined ? obj.isTracked : existing.isTracked,
                            milestones: newMilestones
                        };
                    } else if (obj.title && obj.content) {
                        newState.objectives!.push({
                            ...obj,
                            id: obj.id || `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            isNew: true,
                            status: obj.status ? (String(obj.status).toLowerCase() as any) : 'active',
                            nextStep: obj.nextStep || 'Establish a path.',
                            milestones: obj.progressUpdate ? [`[${newState.currentTime}] ${obj.progressUpdate}`] : [],
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
                        newState.mapZones!.push({
                            ...zone,
                            id: zone.id || `zone-${zone.coordinates}-${Date.now()}`,
                            visited: zone.visited !== undefined ? zone.visited : false,
                            isNew: true
                        } as MapZone);
                    }
                });
            }

            if (updates.npcMemories && Array.isArray(updates.npcMemories)) {
                newState.npcs = [...(newState.npcs || [])];
                updates.npcMemories.forEach(memData => {
                    if (!memData || !memData.npcId || !memData.memory) return;

                    const npcIdx = newState.npcs!.findIndex(n => n.id === memData.npcId);
                    if (npcIdx > -1) {
                        const existingNpc = newState.npcs![npcIdx];
                        newState.npcs![npcIdx] = {
                            ...existingNpc,
                            memories: [
                                ...(existingNpc.memories || []),
                                {
                                    content: memData.memory,
                                    timestamp: newState.currentTime || new Date().toISOString(),
                                    embedding: memData.embedding // Inject the vector created by the Background Indexer!
                                }
                            ]
                        };
                    }
                });
            }

            if (updates.storyUpdates && Array.isArray(updates.storyUpdates)) {
                newState.story = [...(newState.story || [])];
                const nowStamp = new Date().toISOString();
                updates.storyUpdates.forEach(su => {
                    newState.story!.push({
                        id: su.id || `story-${Date.now()}-${Math.random()}`,
                        content: su.content,
                        summary: su.summary,
                        location: newState.current_site_name || newState.currentLocale || 'Unknown',
                        timestamp: newState.currentTime || nowStamp,
                        embedding: su.embedding,
                        isNew: su.isNew,
                        originatingMessageId: su.originatingMessageId
                    });
                });
            }

            // POI Memory Processing: Append event memories to knowledge entries (Points of Interest)
            if (updates.poiMemories && Array.isArray(updates.poiMemories)) {
                newState.knowledge = [...(newState.knowledge || [])];
                updates.poiMemories.forEach(memData => {
                    if (!memData || !memData.poiId || !memData.memory) return;

                    // Resolve POI: Try by id first, then by matching title directly, then by matching current locale name
                    let poiIdx = newState.knowledge!.findIndex(k =>
                        (k.id === memData.poiId || k.title.toLowerCase().trim() === memData.poiId.toLowerCase().trim()) && 
                        k.tags?.includes('location')
                    );
                    if (poiIdx === -1) {
                        // Fallback: match by title against current locale/site name in the state
                        const currentSiteName = newState.current_site_name || newState.currentLocale || '';
                        if (currentSiteName) {
                            poiIdx = newState.knowledge!.findIndex(k =>
                                k.tags?.includes('location') &&
                                (k.title.toLowerCase().trim() === currentSiteName.toLowerCase().trim() ||
                                 isLocaleMatch(k.title, currentSiteName) ||
                                 isLocaleMatch(k.title, memData.poiId))
                            );
                        }
                    }

                    if (poiIdx > -1) {
                        const existingPoi = newState.knowledge![poiIdx];
                        newState.knowledge![poiIdx] = {
                            ...existingPoi,
                            memories: [
                                ...(existingPoi.memories || []),
                                {
                                    content: memData.memory,
                                    timestamp: newState.currentTime || new Date().toISOString(),
                                    embedding: memData.embedding
                                }
                            ].slice(-30) // Cap at 30 entries per POI
                        };
                    }
                });
            }

            return newState;
        }

        default:
            return state;
    }
};

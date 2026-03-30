// reducers/characterReducer.ts

import { GameData, PlayerCharacter, Companion, Inventory, GameAction, ChatMessage } from '../types';
import { consolidateCurrencyToPlayer } from '../utils/inventoryUtils';
import { getNextLevelXP, getXPForLevel } from '../utils/mechanics';
import { getPOITheme } from '../utils/mapUtils';

const BOARDING_SHIP_MESSAGES = {
    fantasy: [
        (shipName: string) => `You and your party gather your belongings and board the ${shipName}, your footsteps echoing on the wooden planks as the crew prepares the sails. The vessel cuts a path through the swells, ready for whatever lies ahead.`,
        (shipName: string) => `You step onto the creaking deck of the ${shipName}, the smell of salt and old oak filling your lungs. The sails unfurl like the wings of a great bird, catching the wind as you set out toward the horizon.`,
        (shipName: string) => `The gangplank thuds against the dock as you and your party climb aboard the ${shipName}. Heavy ropes are cast off, and the hull groans with life, carrying you into the unknown reaches of the sea.`,
        (shipName: string) => `The ${shipName} awaits, its figurehead pointing boldly toward your destination. You take your place on deck, watching the shore recede as the waves begin their rhythmic greeting against the wood.`,
        (shipName: string) => `A steady breeze whistles through the rigging of the ${shipName} as you come aboard. With a sharp command from the captain, the anchor is raised, and the vast span of the ocean opens before you.`
    ],
    modern: [
        (shipName: string) => `You and your party haul the gear onto the ${shipName} and secure the hatches. You take the helm, the engine rumbling to life with a steady thrum into the hull. You clear the harbor, the wake trailing behind you.`,
        (shipName: string) => `The metal deck of the ${shipName} vibrates under your boots as the generator hums. You check the navigation lights and give the signal; with a powerful surge, the vessel pushes away from the pier.`,
        (shipName: string) => `You step onto the ${shipName}, the scent of diesel and sea air meeting you. With the flick of a few switches, the dashboard glows to life, and the propellers begin to churn the water into a white foam.`,
        (shipName: string) => `Gear stowed and lines released. You take your position on the ${shipName}, feel the throb of the engine through the deck, and steer the craft into the open channel, leaving the safety of the dock behind.`,
        (shipName: string) => `The ${shipName} bobs rhythmically as you and your party board. You settle into the seats, the roar of the outboard motor drowning out the gulls as you accelerate towards the open water.`
    ],
    scifi: [
        (shipName: string) => `Airlock cycled. You and your party step into the pressurized cabin of the ${shipName} as the pre-flight sequence begins. The ion thrusters whine with increasing intensity before lifting you from the surface.`,
        (shipName: string) => `The ramp retracts with a mechanical hiss as you board the ${shipName}. Synthetic gravity kicks in, grounding your steps as the pilot initiates the launch sequence, the stars awaiting your arrival.`,
        (shipName: string) => `You step into the sleek interior of the ${shipName}, the humming reactor sounding like a heartbeat through the walls. Atmospheric scrubbers whir as the vessel untethers, drifting momentarily before the main drive ignites.`,
        (shipName: string) => `Primary systems online. You and your party take your stations aboard the ${shipName}. The external viewports shutter as the ship prepares for the high-G burn that will carry you through the void.`,
        (shipName: string) => `A flash of blue light signals the connection between your suit and the ${shipName}'s interface. You walk through the boarding tube, the silence of space replaced by the comforting vibration of an active starship.`
    ],
    magitech: [
        (shipName: string) => `You and your party ascend the shimmering gangplank of the ${shipName}, feeling the hum of the mana-crystals beneath your feet. The navigator strikes the resonance chord, and the vessel lifts on a cushion of aetheric currents.`,
        (shipName: string) => `The deck of the ${shipName} glows with intricate runes as you step aboard. A sudden warmth spreads from the core as the arcane engines engage, lifting the ship effortlessly into the shimmering ley-lines.`,
        (shipName: string) => `Arclight flickers along the hull of the ${shipName} as you and your party come aboard. The air tastes of ozone and ancient spells; with a soft chime, the ship begins to glide through the currents of the world's soul.`,
        (shipName: string) => `You board the ${shipName}, the wood and metal pulsating with vibrant energy. The aether-sails catch the invisible tides of magic, and with a silent surge, you are carried away on a breath of pure enchantment.`,
        (shipName: string) => `The ${shipName} hums a melodic tune as you ascend. You feel the connection to the world thrumming through the deck, the mana-flow directing your path as the vessel prepares to transcend the physical distance.`
    ]
};

const LEAVING_SHIP_MESSAGES = {
    fantasy: [
        (shipName: string) => `You step off the ${shipName}, your boots meeting solid ground once more as the echo of the shifting tides fades. Behind you, the vessel stands tall, a silent sentinel of your journey across the deep.`,
        (shipName: string) => `The wood of the dock feels strangely firm as you disembark from the ${shipName}. You look back one last time at the masts silhouetted against the sky, the tang of sea salt still clinging to your cloak.`,
        (shipName: string) => `You and your party walk down the gangway, leaving the ${shipName} at rest in the harbor. The sway of the deck lingers in your stride as you turn your back to the water and face the challenges of the land.`,
        (shipName: string) => `Farewell to the waves. You step from the ${shipName} onto the shore, the rhythmic creaking of the hull replaced by the sounds of the bustling port. Your sea-legs will take time to fade, but the road calls.`,
        (shipName: string) => `Dust rises from your boots as you step off the ${shipName}. The journey was long, but as you reach solid earth, you feel the weight of your land-bound quest return. The ship remains behind, its duty done for now.`
    ],
    modern: [
        (shipName: string) => `The engine cuts to a silence that feels heavy after hours of transit. You disembark from the ${shipName}, the scents of the land replacing the salt-spray. The journey is complete; the path ahead is yours to walk.`,
        (shipName: string) => `You step from the ${shipName} onto the pier, the vibration of the engine still tingling in your feet. The modern world greets you with its familiar sounds as you leave the vessel behind at its mooring.`,
        (shipName: string) => `The cleats are secured and the engine stilled. You climb off the ${shipName}, feeling the stable earth beneath you. The boat sways gently in your wake, a metal shell resting after its trial on the water.`,
        (shipName: string) => `Transit complete. You and your party gather your bags and step off the ${shipName}. The smell of exhaust fades into the air of the port, and the horizon you chased is now just a memory behind you.`,
        (shipName: string) => `You disembark the ${shipName}, the metal hull cooling in the breeze. As you walk away from the docks, the steady ground feels strange, a reminder of the miles you covered across the shifting blue.`
    ],
    scifi: [
        (shipName: string) => `Hissing hydraulics signal the opening of the airlock. You step out onto the surface as the ${shipName} cycles into standby mode. The hum of its reactor stays with you, a fading vibration as you find your footing in this new world.`,
        (shipName: string) => `The pressure equalizes with a sharp pop, and the ramp of the ${shipName} descends. You step into the alien atmosphere, the synthetic sterile air of the cabin replaced by the raw, untamed scents of a new planet.`,
        (shipName: string) => `You disembark from the ${shipName}, your boots striking the landing pad. The ship’s engines cool with a series of metallic ticks, its lights dimming as it enters low-power mode, its journey through the stars paused.`,
        (shipName: string) => `Footsteps echoing in the hollow boarding bay, you leave the ${shipName}. The vastness of the cosmos is now shielded behind the ship's hull, and the immediate reality of the ground beneath you takes hold.`,
        (shipName: string) => `The airlock door slides shut behind you as you step off the ${shipName}. For a moment, you feel the lingering gravity of the ship, but as you walk forward, the weight of the world takes over, anchoring you to your new goal.`
    ],
    magitech: [
        (shipName: string) => `The aetheric cushion dissipates with a soft chime. You descend the crystalline ramp of the ${shipName}, the resonance of the ley-lines grounding you. Your vessel remains behind, its mana-cells glowing faintly as you embark on your land-bound quest.`,
        (shipName: string) => `You step off the ${shipName}, the tingling of arcane energy fading from your skin. The runes on the hull dim as you touch the natural earth, the grounded world reclaiming you from the ephemeral paths of the sky.`,
        (shipName: string) => `The shimmering ramp retracts as you disembark the ${shipName}. You look back at the vessel, its crystalline parts catching the light like a gemstone. The silence of the world feels heavy after the singing of the mana-engines.`,
        (shipName: string) => `Ley-line connection severed. You and your party walk away from the ${shipName}, the air of the land feeling thick and heavy compared to the lightness of magic. The vessel waits, a beacon of arcane potential resting in the port.`,
        (shipName: string) => `You leave the ${shipName}, the soft hum of its core still echoing in your mind. As you walk forward, the magical resonance fades, replaced by the mundane sounds of your destination. The adventure on the magic-tide ends, and a new one begins on foot.`
    ]
};

export const characterReducer = (state: GameData, action: GameAction): GameData => {
    switch (action.type) {
        case 'UPDATE_PLAYER': {
            // Ensure we maintain class instance for methods
            const pc = action.payload instanceof PlayerCharacter 
                ? action.payload 
                : new PlayerCharacter(action.payload);
            
            // Re-apply item-based bonuses that require inventory context
            pc.maxHeroicPoints = pc.getMaxHeroicPoints(state.playerInventory);
            
            return { 
                ...state, 
                playerCharacter: pc 
            };
        }
        
        case 'UPDATE_COMPANION': {
            let newLocale = state.currentLocale;
            let vesselMsg: ChatMessage | null = null;
            let newAboard: boolean | undefined;
            const updatedCompanions = (state.companions ?? []).map(c => {
                if (c.id === action.payload.id) {
                    const companion = action.payload instanceof Companion
                        ? action.payload
                        : new Companion({
                            ...(action.payload as any),
                            relationship: Number((action.payload as any).relationship || 0)
                        });
                    
                    // Sync derived capacity
                    companion.maxHeroicPoints = companion.getMaxHeroicPoints(state.companionInventories[companion.id]);
                    
                    // Note: Locale SNAP is handled globally by Ship Enclosure Sentinel in game_reducer.ts

                    // BOARDING & DISEMBARK LOGIC: Detecting when a ship companion is added/removed from the party
                    if (companion.isShip) {
                        const theme = getPOITheme(state.worldSummary || "");
                        const shipName = companion.name;

                        // Case A: Disembarking (Removal)
                        if ((action.payload as any).isInParty === false && c.isInParty !== false) {
                            const variationIdx = Math.floor(Math.random() * 5);
                            const content = (LEAVING_SHIP_MESSAGES as any)[theme]?.[variationIdx]?.(shipName) || LEAVING_SHIP_MESSAGES.fantasy[0](shipName);

                            vesselMsg = {
                                id: `disembark-${Date.now()}`,
                                sender: 'ai',
                                content: content,
                                type: 'neutral'
                            };

                            // If they were inside the ship, snap the locale back to just the site vicinity
                            if (newLocale && newLocale.includes(`Inside ${shipName}`)) {
                                newLocale = state.current_site_name || "Open Area";
                            }
                        }
                        
                        // Case B: Boarding (Addition)
                        if ((action.payload as any).isInParty === true && c.isInParty === false) {
                            // ENCLOSURE RULE: Only play narrative if ship is healthy
                            if (c.currentHitPoints > 0) {
                                const variationIdx = Math.floor(Math.random() * 5);
                                const content = (BOARDING_SHIP_MESSAGES as any)[theme]?.[variationIdx]?.(shipName) || BOARDING_SHIP_MESSAGES.fantasy[0](shipName);

                                vesselMsg = {
                                    id: `boarding-${Date.now()}`,
                                    sender: 'ai',
                                    content: content,
                                    type: 'neutral'
                                };
                                
                                // Note: Locale SNAP is handled globally by Ship Enclosure Sentinel in game_reducer.ts
                            }
                        }
                        
                        // SYNC: Narratively aboard if ship is in party
                        newAboard = (action.payload as any).isInParty !== false;
                    }
                    
                    return companion;
                }
                return c;
            });

            return {
                ...state,
                companions: updatedCompanions,
                currentLocale: newLocale,
                isAboard: newAboard !== undefined ? newAboard : state.isAboard,
                messages: vesselMsg ? [...state.messages, vesselMsg] : state.messages
            };
        }
        
        case 'ADD_COMPANION': {
            const newCompanionData = action.payload.companion;
            const newInventory = action.payload.inventory;
            
            const companionInstance = newCompanionData instanceof Companion
                ? newCompanionData
                : new Companion({
                    ...(newCompanionData as any),
                    relationship: Number((newCompanionData as any).relationship || 0),
                    activeBuffs: (newCompanionData as any).activeBuffs || []
                });

            // Sync derived capacity using the companion's specific starting inventory
            companionInstance.maxHeroicPoints = companionInstance.getMaxHeroicPoints(newInventory);

            const exists = (state.companions ?? []).some(c => c.id === companionInstance.id);
            
            let newLocale = state.currentLocale;
            let boardingMsg: ChatMessage | null = null;
            
            // ENCLOSURE RULE: Only play boarding narrative if ship is functional
            if (companionInstance.isShip && companionInstance.isInParty !== false && companionInstance.currentHitPoints > 0) {
                const theme = getPOITheme(state.worldSummary || "");
                const shipName = companionInstance.name;
                const variationIdx = Math.floor(Math.random() * 5);
                const content = (BOARDING_SHIP_MESSAGES as any)[theme]?.[variationIdx]?.(shipName) || BOARDING_SHIP_MESSAGES.fantasy[0](shipName);

                boardingMsg = {
                    id: `boarding-${Date.now()}`,
                    sender: 'ai',
                    content: content,
                    type: 'neutral'
                };
                
                // Note: Locale SNAP is handled globally by Ship Enclosure Sentinel in game_reducer.ts
            }

            if (exists) {
                const newState = {
                    ...state,
                    companions: (state.companions ?? []).map(c => c.id === companionInstance.id ? companionInstance : c),
                    companionInventories: {
                        ...state.companionInventories,
                        [companionInstance.id]: newInventory
                    },
                    currentLocale: newLocale,
                    isAboard: companionInstance.isShip ? (companionInstance.isInParty !== false) : state.isAboard,
                    messages: boardingMsg ? [...state.messages, boardingMsg] : state.messages
                };
                return consolidateCurrencyToPlayer(newState);
            }

            const newState = {
                ...state,
                companions: [...(state.companions ?? []), companionInstance],
                companionInventories: {
                    ...state.companionInventories,
                    [companionInstance.id]: newInventory
                },
                currentLocale: newLocale,
                isAboard: companionInstance.isShip ? (companionInstance.isInParty !== false) : state.isAboard,
                messages: boardingMsg ? [...state.messages, boardingMsg] : state.messages
            };
            
            // Automatic consolidation: ensure any currency received during companion creation is moved to player
            return consolidateCurrencyToPlayer(newState);
        }
        
        case 'DELETE_COMPANION':
            const newInventories = { ...state.companionInventories };
            delete newInventories[action.payload];
            return {
                ...state,
                companions: (state.companions ?? []).filter(c => c.id !== action.payload),
                companionInventories: newInventories
            };
            
        case 'USE_ABILITY': {
            const { abilityId, ownerId } = action.payload;
            const newState = { ...state };
            
            let staminaCost = 0;

            const decrementUsage = (abilities: any[]) => {
                return abilities.map(a => {
                    if (a.id === abilityId) {
                        const effectType = a.effect?.type;
                        const implicitCost = (effectType && ['Heal', 'Damage', 'Status'].includes(effectType)) ? 1 : 0;
                        staminaCost = a.staminaCost !== undefined ? a.staminaCost : implicitCost;

                        if (a.usage && a.usage.type !== 'passive' && staminaCost === 0) {
                            return {
                                ...a,
                                usage: {
                                    ...a.usage,
                                    currentUses: Math.max(0, a.usage.currentUses - 1)
                                }
                            };
                        }
                    }
                    return a;
                });
            };

            if (ownerId === 'player' || ownerId === state.playerCharacter.id) {
                const updatedAbilities = decrementUsage(state.playerCharacter.abilities);
                const pc = new PlayerCharacter({
                    ...state.playerCharacter,
                    abilities: updatedAbilities,
                    stamina: Math.max(0, (state.playerCharacter.stamina || 0) - staminaCost)
                });
                // Re-apply item context
                pc.maxHeroicPoints = pc.getMaxHeroicPoints(state.playerInventory);
                newState.playerCharacter = pc;
            } else {
                newState.companions = state.companions.map(c => {
                    if (c.id === ownerId) {
                        const updated = new Companion({
                            ...c,
                            abilities: decrementUsage(c.abilities),
                            stamina: Math.max(0, (c.stamina || 0) - staminaCost)
                        });
                        updated.maxHeroicPoints = updated.getMaxHeroicPoints(state.companionInventories[ownerId]);
                        return updated;
                    }
                    return c;
                });
            }
            return newState;
        }

        case 'ADD_ACTIVE_BUFF': {
            const { ownerId, buffs } = action.payload;
            const newState = { ...state };
            
            if (ownerId === 'player' || ownerId === state.playerCharacter.id) {
                const pc = new PlayerCharacter({
                    ...state.playerCharacter,
                    activeBuffs: [...(state.playerCharacter.activeBuffs || []), ...buffs]
                });
                pc.maxHeroicPoints = pc.getMaxHeroicPoints(state.playerInventory);
                newState.playerCharacter = pc;
            } else {
                newState.companions = state.companions.map(c => {
                    if (c.id === ownerId) {
                        const updated = new Companion({
                            ...c,
                            activeBuffs: [...(c.activeBuffs || []), ...buffs]
                        });
                        updated.maxHeroicPoints = updated.getMaxHeroicPoints(state.companionInventories[ownerId]);
                        return updated;
                    }
                    return c;
                });
            }
            return newState;
        }

        case 'USE_HEROIC_POINT': {
            const pc = new PlayerCharacter({
                ...state.playerCharacter,
                heroicPoints: Math.max(0, (state.playerCharacter.heroicPoints || 0) - 1)
            });
            // Maintenance: Ensure capacity is correct
            pc.maxHeroicPoints = pc.getMaxHeroicPoints(state.playerInventory);
            
            return {
                ...state,
                playerCharacter: pc
            };
        }

        case 'AWARD_XP': {
            const amount = action.payload.amount;
            const source = action.payload.source;
            
            const activeCompanions = (state.companions ?? []).filter(c => c.isInParty !== false);
            const partySize = 1 + activeCompanions.length; 
            const xpPerMember = Math.max(1, Math.floor(amount / partySize));

            // PC progression logic
            const pcData = { ...state.playerCharacter };
            const oldLevel = pcData.level;
            
            // Phase 2: Check heroic point capacity increase
            const oldMaxHeroic = state.playerCharacter.getMaxHeroicPoints(state.playerInventory);
            
            pcData.experiencePoints += xpPerMember;
            
            let currentLevel = pcData.level;
            let nextLevelXP = getNextLevelXP(currentLevel);
            while (nextLevelXP > 0 && pcData.experiencePoints >= nextLevelXP) {
                currentLevel += 1;
                nextLevelXP = getNextLevelXP(currentLevel);
            }
            
            pcData.level = currentLevel;
            let pcInstance = new PlayerCharacter(pcData);
            
            // Re-calculate max heroic points for the new level including item context
            const newMaxHeroic = pcInstance.getMaxHeroicPoints(state.playerInventory);
            pcInstance.maxHeroicPoints = newMaxHeroic;

            const updatedCompanions = (state.companions ?? []).map(c => {
                const cData = { ...c };
                const oldCompLevel = cData.level;
                
                if (cData.isInParty !== false) {
                    cData.experiencePoints += xpPerMember;
                }
                
                if (cData.level < pcInstance.level) {
                    cData.level = pcInstance.level;
                }
                
                let compLevel = cData.level;
                let compNextXP = getNextLevelXP(compLevel);
                while (compNextXP > 0 && cData.experiencePoints >= compNextXP) {
                    compLevel += 1;
                    compNextXP = getNextLevelXP(compLevel);
                }
                
                cData.level = compLevel;
                const compInstance = new Companion(cData);
                compInstance.maxHeroicPoints = compInstance.getMaxHeroicPoints(state.companionInventories[c.id]);
                return compInstance;
            });

            let msgContent = `Party gained ${amount.toLocaleString()} XP from ${source.toLowerCase()}.`;
            if (partySize > 1) {
                msgContent += ` That's ${xpPerMember.toLocaleString()} XP for each member.`;
            }

            if (pcInstance.level > oldLevel) {
                msgContent += `\n\nLevel up! You have reached Level ${pcInstance.level}. Check your features to assign new traits.`;
                
                // Milestone Rule: Grant bonus heroic point if capacity increased
                if (newMaxHeroic > oldMaxHeroic) {
                    pcInstance.heroicPoints = (pcInstance.heroicPoints || 0) + 1;
                    msgContent += `\n\nHeroic Moment: Your heroic point capacity has increased to ${newMaxHeroic}! You gained 1 bonus heroic point.`;
                }
            }
            
            const xpMsg: ChatMessage = {
                id: `sys-xp-${Date.now()}`,
                sender: 'system',
                content: msgContent,
                type: 'positive'
            };

            return {
                ...state,
                playerCharacter: pcInstance,
                companions: updatedCompanions,
                messages: [...state.messages, xpMsg]
            };
        }
        
        default:
            return state;
    }
};

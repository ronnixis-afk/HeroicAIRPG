// reducers/npcReducer.ts

import { GameData, GameAction, NPC } from '../types';

export const npcReducer = (state: GameData, action: GameAction): GameData => {
    // Ensure npcs array exists
    const currentNpcs = state.npcs || [];

    switch (action.type) {
        case 'ADD_NPC': {
            const newNpc = action.payload;

            // Safety: Ignore invalid payloads
            if (!newNpc || !newNpc.name || typeof newNpc.name !== 'string') {
                return state;
            }

            const normalizedNewName = newNpc.name.toLowerCase().trim();

            // Prevent duplicating the player or companions as an NPC
            const isPlayer = state.playerCharacter?.name && state.playerCharacter.name.toLowerCase().trim() === normalizedNewName;
            const isCompanion = state.companions?.some(c => c.name && c.name.toLowerCase().trim() === normalizedNewName);
            
            // Allow if it's explicitly a companion being registered as an NPC
            if ((isPlayer || isCompanion) && !newNpc.companionId) {
                return state;
            }

            // Check for name collision
            const existingIndex = currentNpcs.findIndex(n =>
                n.name && n.name.toLowerCase().trim() === normalizedNewName
            );

            if (existingIndex > -1) {
                // MERGE instead of REPLACE to maintain relationship progress
                const updatedNpcs = [...currentNpcs];
                const existing = updatedNpcs[existingIndex];

                // --- LOCATION PERSISTENCE LOGIC ---
                let finalCurrentPOI = newNpc.currentPOI;
                if (finalCurrentPOI === 'Unknown' && existing.currentPOI && existing.currentPOI !== 'Unknown') {
                    finalCurrentPOI = existing.currentPOI;
                }

                let finalLocation = newNpc.location;
                if ((!finalLocation || finalLocation === 'Unknown') && existing.location && existing.location !== 'Unknown') {
                    finalLocation = existing.location;
                }

                // --- STATUS PERSISTENCE ---
                let finalStatus = newNpc.status || existing.status || 'Alive';

                updatedNpcs[existingIndex] = {
                    ...existing,
                    ...newNpc,
                    currentPOI: finalCurrentPOI,
                    location: finalLocation,
                    status: finalStatus,
                    relationship: Number(newNpc.relationship !== undefined ? newNpc.relationship : existing.relationship || 0),
                    id: existing.id // Preserve internal ID
                };
                return { ...state, npcs: updatedNpcs };
            }

            return {
                ...state,
                npcs: [...currentNpcs, {
                    ...newNpc,
                    relationship: Number(newNpc.relationship || 0)
                }]
            };
        }
        case 'UPDATE_NPC':
            if (!action.payload?.id) return state;
            return {
                ...state,
                npcs: currentNpcs.map(npc => npc.id === action.payload.id ? {
                    ...npc,
                    ...action.payload,
                    relationship: Number(action.payload.relationship !== undefined ? action.payload.relationship : npc.relationship || 0)
                } : npc)
            };
        case 'DELETE_NPC':
            return {
                ...state,
                npcs: currentNpcs.filter(npc => npc.id !== action.payload)
            };
        case 'MARK_ALL_NPCS_SEEN':
            return { ...state, npcs: currentNpcs.map(n => ({ ...n, isNew: false })) };
        case 'SET_NPCS_WILL_TRAVEL': {
            const { ids, willTravel } = action.payload;
            return {
                ...state,
                npcs: currentNpcs.map(npc => 
                    ids.includes(npc.id) ? { ...npc, willTravel } : npc
                )
            };
        }

        case 'AI_UPDATE': {
            const { npc_resolution, location_update } = action.payload;
            if (!npc_resolution) return state;

            let updatedNpcs = [...currentNpcs];

            // 1. AUTOMATIC FOLLOWERS: Resolve spatial anchoring for NPCs flagged as following
            if (location_update) {
                // REGISTRY FOLLOW RULE: NPCs only follow for "locale" moves (transition_type: 'staying').
                // If the party moves to a new POI or Zone, they stop following and remain at their last location.
                const isPOIChange = location_update.transition_type !== 'staying';

                updatedNpcs = updatedNpcs.map(npc => {
                    if (npc.isFollowing) {
                        if (npc.status === 'Dead') {
                            return { ...npc, isFollowing: false };
                        }
                        
                        if (isPOIChange) {
                            if (npc.willTravel) {
                                // AUTHORIZED TRAVEL: Move NPC to new location
                                return {
                                    ...npc,
                                    currentPOI: location_update.site_name || 'Current',
                                    site_id: location_update.site_id,
                                    willTravel: false // Reset authorization after travel
                                };
                            } else {
                                // DISCONNECT: Party moved too far; NPC stays put.
                                return { ...npc, isFollowing: false };
                            }
                        } else {
                            // NARRATIVE SYNC: Party moved within the same POI; NPC follows.
                            return {
                                ...npc,
                                currentPOI: location_update.site_name || 'Current',
                                site_id: location_update.site_id
                            };
                        }
                    }
                    return npc;
                });
            }

            npc_resolution.forEach(res => {
                if (!res.name) return;

                const normalizedName = res.name.toLowerCase().trim();

                // Prevent duplicating the player or companions as an NPC
                const isPlayer = state.playerCharacter?.name && state.playerCharacter.name.toLowerCase().trim() === normalizedName;
                const isCompanion = state.companions?.some(c => c.name && c.name.toLowerCase().trim() === normalizedName);
                if (isPlayer || isCompanion) {
                    return; // Skip resolution for player/companion entities
                }

                const index = updatedNpcs.findIndex(n => n.name && n.name.toLowerCase().trim() === normalizedName);

                if (res.action === 'leaves') {
                    // DEPARTURE LOGIC: Clear spatial anchors to remove from active scene
                    if (index > -1) {
                        updatedNpcs[index] = {
                            ...updatedNpcs[index],
                            currentPOI: 'Unknown',
                            site_id: undefined,
                            isFollowing: false,
                            presenceMode: 'Physical' // Reset on departure
                        };
                    }
                } else if (res.action === 'existing' || res.action === 'new') {
                    // SNAPPING LOGIC: Anchor to the current site context
                    const npcData: Partial<NPC> = {
                        name: res.name,
                        currentPOI: location_update?.site_name || 'Current',
                        site_id: location_update?.site_id,
                        isFollowing: res.isFollowing,
                        presenceMode: res.presenceMode || 'Physical'
                    };

                    if (index > -1) {
                        // Update existing actor with new narrative context
                        updatedNpcs[index] = { ...updatedNpcs[index], ...npcData };
                    } else if (res.action === 'new') {
                        // Instantiate new actor in registry
                        updatedNpcs.push({
                            id: `npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            relationship: 0,
                            status: 'Alive', // Auditor will refine this if the extraction says they are dead
                            ...npcData,
                            isNew: true
                        } as NPC);
                    }
                }
            });

            return { ...state, npcs: updatedNpcs };
        }

        default:
            return state;
    }
};
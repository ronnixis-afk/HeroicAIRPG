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
            const updates = action.payload;
            // Ensure we have a valid payload
            if (!updates) return state;

            let updatedNpcs = [...currentNpcs];
            const locationUpdate = updates.location_update;
            const isPOIChange = locationUpdate && locationUpdate.transition_type !== 'staying';

            // 1. Process Structured npcUpdates (System/Direct updates)
            if (updates.npcUpdates && Array.isArray(updates.npcUpdates)) {
                updatedNpcs = updatedNpcs.map(existing => {
                    const update = updates.npcUpdates!.find(u => u.id === existing.id);
                    if (update) {
                        // --- TRAVEL GUARD: npcUpdates ---
                        // If it's a POI change and this update tries to move a non-authorized NPC, block the loc change.
                        const isMovingToNewSite = isPOIChange && update.currentPOI && update.currentPOI !== existing.currentPOI;
                        if (isMovingToNewSite && !existing.willTravel) {
                            // Strip location data from hallucinated move
                            const { currentPOI, site_id, ...safeData } = update;
                            return { ...existing, ...safeData };
                        }

                        return { ...existing, ...update };
                    }
                    return existing;
                });
            }

            // 2. AUTOMATIC FOLLOWERS (Legacy logic for compatibility)
            if (locationUpdate) {
                updatedNpcs = updatedNpcs.map(npc => {
                    if (npc.isFollowing) {
                        if (npc.status === 'Dead') return { ...npc, isFollowing: false };
                        
                        if (isPOIChange) {
                            if (npc.willTravel) {
                                return {
                                    ...npc,
                                    currentPOI: locationUpdate.site_name || 'Current',
                                    site_id: locationUpdate.site_id,
                                    willTravel: false 
                                };
                            } else {
                                return { ...npc, isFollowing: false };
                            }
                        } else {
                            return {
                                ...npc,
                                currentPOI: locationUpdate.site_name || 'Current',
                                site_id: locationUpdate.site_id
                            };
                        }
                    }
                    return npc;
                });
            }

            // 3. Narrative npc_resolution (Narrative Snappings)
            if (updates.npc_resolution) {
                updates.npc_resolution.forEach(res => {
                    if (!res.name) return;
                    const normalizedName = res.name.toLowerCase().trim();

                    // Filter out player/companions
                    const isPlayer = state.playerCharacter?.name && state.playerCharacter.name.toLowerCase().trim() === normalizedName;
                    const isCompanion = state.companions?.some(c => c.name && c.name.toLowerCase().trim() === normalizedName);
                    if (isPlayer || isCompanion) return;

                    const index = updatedNpcs.findIndex(n => n.name && n.name.toLowerCase().trim() === normalizedName);

                    if (res.action === 'leaves') {
                        if (index > -1) {
                            updatedNpcs[index] = {
                                ...updatedNpcs[index],
                                currentPOI: 'Unknown',
                                site_id: undefined,
                                isFollowing: false,
                                presenceMode: 'Physical'
                            };
                        }
                    } else if (res.action === 'existing' || res.action === 'new') {
                        const isRemote = res.presenceMode === 'Remote';
                        const npcData: Partial<NPC> = {
                            name: res.name,
                            currentPOI: isRemote ? 'Remote Presence' : (locationUpdate?.site_name || state.current_site_name || 'Current'),
                            site_id: isRemote ? 'remote' : (locationUpdate?.site_id || state.current_site_id),
                            isFollowing: res.isFollowing,
                            presenceMode: res.presenceMode || 'Physical'
                        };

                        if (index > -1) {
                            // --- TRAVEL GUARD: npc_resolution ---
                            // Check if this NPC is being "teleported" to a new site without authorization.
                            const existing = updatedNpcs[index];
                            const isMovingToNewSite = isPOIChange && npcData.currentPOI !== existing.currentPOI;
                            
                            // If they are stationary or staying behind, block any snap to the new site.
                            if (isMovingToNewSite && !existing.willTravel) {
                                return; // Hard block: DO NOT snap their location
                            }

                            updatedNpcs[index] = { ...updatedNpcs[index], ...npcData };
                        } else if (res.action === 'new') {
                            updatedNpcs.push({
                                id: `npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                relationship: 0,
                                status: 'Alive',
                                ...npcData,
                                isNew: true
                            } as NPC);
                        }
                    }
                });
            }

            return { ...state, npcs: updatedNpcs };
        }

        default:
            return state;
    }
};
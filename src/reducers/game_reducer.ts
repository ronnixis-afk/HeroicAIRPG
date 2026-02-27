// reducers/game_reducer.ts

import { GameData, GameAction } from '../types';
import { characterReducer } from './characterReducer';
import { inventoryReducer } from './inventoryReducer';
import { combatReducer } from './combatReducer';
import { worldReducer } from './worldReducer';
import { narrativeReducer } from './narrativeReducer';
import { systemReducer } from './systemReducer';
import { npcReducer } from './npcReducer';

export const gameReducer = (state: GameData | null, action: GameAction): GameData | null => {
    // If state is null, only allow initializing actions
    if (!state) {
        if (action.type === 'SET_GAME_DATA') return action.payload;
        if (action.type === 'RESET_WORLD') return systemReducer({} as GameData, action); 
        return state;
    }

    switch (action.type) {
        // Character Actions
        case 'UPDATE_PLAYER':
        case 'UPDATE_COMPANION':
        case 'ADD_COMPANION':
        case 'DELETE_COMPANION':
        case 'AWARD_XP':
        case 'USE_ABILITY':
        case 'USE_HEROIC_POINT':
            return characterReducer(state, action);

        // Inventory Actions
        case 'UPDATE_ITEM':
        case 'MARK_ITEM_SEEN':
        case 'DROP_ITEM':
        case 'SPLIT_ITEM': 
        case 'MOVE_ITEM':
        case 'EQUIP_ITEM':
        case 'UNEQUIP_ITEM':
        case 'TRANSFER_ITEM':
        case 'USE_ITEM':
        case 'CONSOLIDATE_CURRENCY':
        case 'ADD_STORE_INVENTORY':
        case 'BUY_ITEM':
        case 'SELL_ITEM':
        case 'UPDATE_ITEM_PRICES':
        case 'TAKE_LOOT':
            return inventoryReducer(state, action);

        // Combat Actions
        case 'START_COMBAT':
        case 'ADD_COMBAT_ENEMY':
        case 'UPDATE_COMBAT_ENEMY':
        case 'DELETE_COMBAT_ENEMY':
        case 'DUPLICATE_COMBAT_ENEMY':
        case 'SYNC_SCENE_ACTORS':
        case 'ADD_TO_TURN_ORDER':
        case 'REMOVE_FROM_TURN_ORDER':
        case 'MOVE_TURN_ORDER_ITEM':
        case 'ADVANCE_TURN':
        case 'END_COMBAT':
        case 'CLEAR_SCENE':
        case 'UPDATE_TEMPLATE':
        case 'UPDATE_SIZE_MODIFIER':
        case 'UPDATE_BASE_SCORE':
        case 'UPDATE_AFFINITY':
        case 'APPLY_HP_UPDATES':
        case 'APPLY_STATUS_UPDATES':
            return combatReducer(state, action);

        // World/Map Actions
        case 'UPDATE_MAP_ZONE':
        case 'MOVE_PLAYER_ON_MAP':
        case 'UPDATE_MAP_SETTINGS':
        case 'ADD_SECTOR':
        case 'UPDATE_SECTOR':
        case 'DELETE_SECTOR':
        case 'MARK_ALL_MAP_ZONES_SEEN':
            return worldReducer(state, action);

        // Narrative Actions
        case 'ADD_MESSAGE':
        case 'SET_MESSAGES':
        case 'ADD_STORY_LOG':
        case 'DELETE_STORY_LOG':
        case 'REMOVE_STORY_LOGS_BY_MESSAGE':
        case 'COMPRESS_DAY_LOGS':
        case 'UPDATE_STORY_LOG':
        case 'MARK_ALL_STORY_SEEN':
            return narrativeReducer(state, action);

        case 'UPDATE_LORE':
        case 'ADD_LORE':
        case 'DELETE_LORE':
        case 'MARK_LORE_SEEN':
            return narrativeReducer(state, action);

        case 'UPDATE_KNOWLEDGE':
        case 'ADD_KNOWLEDGE':
        case 'DELETE_KNOWLEDGE':
        case 'MARK_KNOWLEDGE_SEEN':
            return narrativeReducer(state, action);

        case 'UPDATE_OBJECTIVE':
        case 'DELETE_OBJECTIVE':
        case 'MARK_OBJECTIVE_SEEN':
        case 'TRACK_OBJECTIVE':
            return narrativeReducer(state, action);

        case 'UPDATE_GM_NOTES':
        case 'UPDATE_GRAND_DESIGN':
        case 'UPDATE_WORLD_SUMMARY':
            return narrativeReducer(state, action);

        case 'ADD_PLOT_POINT':
        case 'UPDATE_PLOT_POINT':
        case 'DELETE_PLOT_POINT':
        case 'MARK_ALL_PLOT_POINTS_SEEN':
            return narrativeReducer(state, action);

        case 'ADD_NEMESIS':
        case 'UPDATE_NEMESIS':
        case 'DELETE_NEMESIS':
        case 'MARK_NEMESIS_SEEN':
        case 'UPDATE_ALL_NEMESES':
            return narrativeReducer(state, action);

        // NPC Actions
        case 'ADD_NPC':
        case 'UPDATE_NPC':
        case 'DELETE_NPC':
        case 'MARK_ALL_NPCS_SEEN':
            return npcReducer(state, action);

        // System Actions
        case 'SET_GAME_DATA':
        case 'UPDATE_GM_SETTINGS':
        case 'AI_UPDATE':
            const systemState = systemReducer(state, action);
            if (!systemState) return null;
            return npcReducer(systemState, action);

        case 'SET_NARRATION_VOICE':
        case 'SET_NARRATION_TONE':
        case 'SET_IMAGE_STYLE':
        case 'SET_IMAGE_MODEL':
        case 'SET_IS_MATURE':
        case 'SET_HANDS_FREE':
        case 'SET_DIFFICULTY':
        case 'UPDATE_CURRENT_TIME':
        case 'REST':
        case 'WAIT':
        case 'SET_SKILL_CONFIGURATION':
        case 'RESET_WORLD':
        case 'RESTART_ADVENTURE':
        case 'COMPLETE_RESTART':
        case 'UPDATE_COMBAT_CONFIGURATION':
        case 'SET_USE_AI_TTS':
        case 'SET_PARTY_HIDDEN':
            return systemReducer(state, action);

        default:
            return state;
    }
};
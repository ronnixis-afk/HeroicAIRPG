
import { GameData, GameAction } from '../types';

export const worldReducer = (state: GameData, action: GameAction): GameData => {
    switch (action.type) {
        case 'UPDATE_MAP_ZONE': {
            const newState = { ...state };
            if (!newState.mapZones) newState.mapZones = [];
            const idx = newState.mapZones.findIndex(z => z.id === action.payload.id);
            if (idx > -1) newState.mapZones[idx] = action.payload;
            else newState.mapZones.push(action.payload);
            return newState;
        }

        case 'MOVE_PLAYER_ON_MAP':
            return { ...state, playerCoordinates: action.payload };

        case 'UPDATE_MAP_SETTINGS':
            return { ...state, mapSettings: action.payload };

        case 'ADD_SECTOR': {
            const newState = { ...state };
            if (!newState.mapSectors) newState.mapSectors = [];
            newState.mapSectors.push(action.payload);
            return newState;
        }

        case 'UPDATE_SECTOR':
            if (state.mapSectors) {
                return {
                    ...state,
                    mapSectors: state.mapSectors.map(s => s.id === action.payload.id ? action.payload : s)
                };
            }
            return state;

        case 'DELETE_SECTOR':
            if (state.mapSectors) {
                return {
                    ...state,
                    mapSectors: state.mapSectors.filter(s => s.id !== action.payload)
                };
            }
            return state;

        case 'MARK_ALL_MAP_ZONES_SEEN':
            return { ...state, mapZones: (state.mapZones || []).map(z => ({ ...z, isNew: false })) };

        default:
            return state;
    }
};


import { GameData, GameAction, LoreEntry, GalleryMetadata } from '../types';

export const narrativeReducer = (state: GameData, action: GameAction): GameData => {
    switch (action.type) {
        case 'ADD_MESSAGE':
            return { ...state, messages: [...state.messages, action.payload] };
        
        case 'SET_MESSAGES':
            const nextMessages = typeof action.payload === 'function' 
                ? action.payload(state.messages) 
                : action.payload;
            return { ...state, messages: nextMessages };

        // Story Log Actions
        case 'ADD_STORY_LOG':
            return { ...state, story: [...state.story, action.payload] };

        case 'DELETE_STORY_LOG':
            return { ...state, story: state.story.filter(l => l.id !== action.payload) };

        case 'REMOVE_STORY_LOGS_BY_MESSAGE':
            return { ...state, story: state.story.filter(l => !l.originatingMessageId || !action.payload.includes(l.originatingMessageId)) };

        case 'COMPRESS_DAY_LOGS': {
            const { removeIds, newLog } = action.payload;
            return {
                ...state,
                story: [...state.story.filter(l => !removeIds.includes(l.id)), newLog]
            };
        }

        case 'UPDATE_STORY_LOG':
            return { ...state, story: state.story.map(l => l.id === action.payload.id ? action.payload : l) };
        
        case 'MARK_ALL_STORY_SEEN':
            return { ...state, story: state.story.map(l => ({ ...l, isNew: false })) };

        // Lore/Knowledge Actions
        case 'UPDATE_LORE':
            return { ...state, world: state.world.map(l => l.id === action.payload.id ? action.payload : l) };

        case 'ADD_LORE': {
            const newEntries = action.payload.map((l, i) => ({ 
                ...l, 
                id: `lore-${Date.now()}-${i}`,
                isNew: true 
            } as LoreEntry));
            return { ...state, world: [...state.world, ...newEntries] };
        }

        case 'DELETE_LORE':
            return { ...state, world: state.world.filter(l => l.id !== action.payload) };

        case 'MARK_LORE_SEEN':
            return { ...state, world: state.world.map(l => l.id === action.payload ? { ...l, isNew: false } : l) };

        case 'UPDATE_KNOWLEDGE':
            return { ...state, knowledge: state.knowledge.map(k => k.id === action.payload.id ? action.payload : k) };

        case 'ADD_KNOWLEDGE': {
            const newKn = action.payload.map((k, i) => ({ 
                ...k, 
                id: `know-${Date.now()}-${i}`,
                isNew: true 
            } as LoreEntry));
            return { ...state, knowledge: [...state.knowledge, ...newKn] };
        }

        case 'DELETE_KNOWLEDGE':
            return { ...state, knowledge: state.knowledge.filter(k => k.id !== action.payload) };

        case 'MARK_KNOWLEDGE_SEEN':
            return { ...state, knowledge: state.knowledge.map(k => k.id === action.payload ? { ...k, isNew: false } : k) };

        // Objective Actions
        case 'UPDATE_OBJECTIVE': {
            const index = state.objectives.findIndex(o => o.id === action.payload.id);
            if (index > -1) {
                return { ...state, objectives: state.objectives.map(o => o.id === action.payload.id ? action.payload : o) };
            } else {
                return { ...state, objectives: [...state.objectives, action.payload] };
            }
        }

        case 'DELETE_OBJECTIVE':
            return { ...state, objectives: state.objectives.filter(o => o.id !== action.payload) };

        case 'MARK_OBJECTIVE_SEEN':
            return { ...state, objectives: state.objectives.map(o => o.id === action.payload ? { ...o, isNew: false } : o) };

        case 'TRACK_OBJECTIVE':
            return {
                ...state,
                objectives: state.objectives.map(o => ({
                    ...o,
                    isTracked: o.id === action.payload
                }))
            };

        // Plot/Summary Actions
        case 'UPDATE_GM_NOTES':
            return { ...state, gmNotes: action.payload };

        case 'UPDATE_GRAND_DESIGN':
            return { 
                ...state, 
                grandDesign: action.payload.design,
                connectedNpcIds: action.payload.connectedNpcIds 
            };

        case 'UPDATE_WORLD_SUMMARY':
            return { ...state, worldSummary: action.payload };

        case 'ADD_PLOT_POINT':
            return { ...state, plotPoints: [...(state.plotPoints || []), action.payload] };

        case 'UPDATE_PLOT_POINT':
            return { ...state, plotPoints: (state.plotPoints || []).map(p => p.id === action.payload.id ? action.payload : p) };

        case 'DELETE_PLOT_POINT':
            return { ...state, plotPoints: (state.plotPoints || []).filter(p => p.id !== action.payload) };
            
        case 'MARK_ALL_PLOT_POINTS_SEEN':
            return { ...state, plotPoints: (state.plotPoints || []).map(p => ({ ...p, isNew: false })) };

        // Nemesis Actions
        case 'ADD_NEMESIS':
            return { ...state, nemeses: [...state.nemeses, action.payload] };

        case 'UPDATE_NEMESIS':
            return { ...state, nemeses: state.nemeses.map(n => n.id === action.payload.id ? action.payload : n) };

        case 'DELETE_NEMESIS':
            return { ...state, nemeses: state.nemeses.filter(n => n.id !== action.payload) };

        case 'MARK_NEMESIS_SEEN':
            return { ...state, nemeses: state.nemeses.map(n => n.id === action.payload ? { ...n, isNew: false } : n) };

        case 'UPDATE_ALL_NEMESES':
            return { ...state, nemeses: action.payload };

        // Gallery Actions
        case 'ADD_GALLERY_ENTRY': {
            // Strip imageUrl for the main state to keep memory footprint low
            const { imageUrl, ...metadata } = action.payload as any;
            return { ...state, gallery: [...(state.gallery || []), metadata] };
        }

        case 'DELETE_GALLERY_ENTRY':
            return { ...state, gallery: (state.gallery || []).filter(e => e.id !== action.payload) };

        // NPC Actions
        case 'MARK_ALL_NPCS_SEEN':
            return { ...state, npcs: state.npcs.map(n => ({ ...n, isNew: false })) };

        default:
            return state;
    }
};

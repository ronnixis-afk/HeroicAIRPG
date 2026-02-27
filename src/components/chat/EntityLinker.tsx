import React, { useMemo, useContext } from 'react';
/* Fix: Import GameDataContextType to resolve context usage errors */
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI, EntityType } from '../../context/UIContext';
import { Companion, CombatActor, PlayerCharacter } from '../../types';
import { canBeTargeted } from '../../utils/resolution/StatusRules';

interface EntityLinkerProps {
    text: string;
}

interface DictionaryEntry {
    name: string;
    type: EntityType;
    data: any;
    avatar?: string;
}

// Common articles and RPG titles to strip for loose matching
const IGNORED_PREFIXES = [
    /^the\s+/i, /^a\s+/i, /^an\s+/i,
    /^captain\s+/i, /^general\s+/i, /^commander\s+/i, /^lord\s+/i, /^lady\s+/i, 
    /^sir\s+/i, /^madam\s+/i, /^king\s+/i, /^queen\s+/i, /^prince\s+/i, /^princess\s+/i, 
    /^master\s+/i, /^mistress\s+/i, /^doctor\s+/i, /^prof\.\s+/i, /^professor\s+/i, 
    /^saint\s+/i, /^st\.\s+/i, /^baron\s+/i, /^duke\s+/i, /^archmage\s+/i, /^elder\s+/i, /^high\s+/i
];

export const EntityLinker: React.FC<EntityLinkerProps> = ({ text }) => {
    /* Fix: Added GameDataContextType casting to ensure context properties are correctly inferred */
    const { gameData } = useContext(GameDataContext) as GameDataContextType;
    const { setInspectedEntity } = useUI();

    const dictionary = useMemo(() => {
        if (!gameData) return [];
        const dict: DictionaryEntry[] = [];

        const addIfValid = (name: string | undefined, type: EntityType, data: any, avatar?: string) => {
            if (name && typeof name === 'string' && name.trim().length > 2) {
                const trimmed = name.trim();

                // FOUNDATION: Gating visibility. If the actor is invisible/concealed, we don't link them.
                if (type === 'npc') {
                    const actor = data as (CombatActor | PlayerCharacter | Companion);
                    if (!canBeTargeted(actor)) return;
                }

                // 1. Add the full original name
                dict.push({ name: trimmed, type, data, avatar });

                // 2. Add a "Loose" version by stripping titles/articles
                let stripped = trimmed;
                let modified = false;
                for (const prefix of IGNORED_PREFIXES) {
                    if (prefix.test(stripped)) {
                        stripped = stripped.replace(prefix, '').trim();
                        modified = true;
                        break; // Only strip the primary leading prefix
                    }
                }

                if (modified && stripped.length > 2 && stripped.toLowerCase() !== trimmed.toLowerCase()) {
                    dict.push({ name: stripped, type, data, avatar });
                }
            }
        };

        // 1. Companions (Highest Priority - Includes Avatar)
        (gameData.companions || []).forEach(c => addIfValid(c.name, 'npc', c, c.imageUrl));

        // 2. NPCs (Registry)
        (gameData.npcs || []).forEach(n => {
             // Only add if not already added via companion list to avoid duplicates
             if (!gameData.companions.some(c => c.name.toLowerCase() === n.name.toLowerCase())) {
                 addIfValid(n.name, 'npc', n, n.image);
             }
        });

        // 3. Items
        const allInventories = [
            gameData.playerInventory,
            ...Object.values(gameData.companionInventories || {})
        ].filter(Boolean);
        
        allInventories.forEach(inv => {
            if (!inv) return;
            const allItems = [...(inv.equipped || []), ...(inv.carried || []), ...(inv.storage || []), ...(inv.assets || [])];
            allItems.forEach(item => addIfValid(item?.name, 'item', item));
        });

        // 4. Locations (Map Zones)
        (gameData.mapZones || []).forEach(z => {
            if (z.visited) addIfValid(z.name, 'location', z);
        });

        // 5. Locations (Map Sectors)
        (gameData.mapSectors || []).forEach(s => addIfValid(s.name, 'location', s));

        // 6. Lore Entries
        (gameData.world || []).forEach(l => addIfValid(l.title, 'lore', l));
        (gameData.knowledge || []).forEach(k => {
             if (k.visited) addIfValid(k.title, 'lore', k);
        });

        // 7. Objectives
        (gameData.objectives || []).forEach(o => addIfValid(o.title, 'objective', o));

        // Remove duplicates and sort by length descending (Greedy matching)
        // Important: Greedy matching ensures "Captain Rook" matches before "Rook" if both exist in chat
        const uniqueDict = Array.from(
            new Map(dict.map(item => [item.name.toLowerCase(), item])).values()
        );
        
        return uniqueDict.sort((a, b) => b.name.length - a.name.length);
    }, [gameData]);

    const linkedElements = useMemo(() => {
        if (!text || typeof text !== 'string') return [text];
        if (dictionary.length === 0) return [text];

        // Create a large regex pattern of all entity names
        const pattern = dictionary
            .map(entry => entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .filter(Boolean)
            .join('|');

        if (!pattern) return [text];

        const regex = new RegExp(`\\b(${pattern})\\b`, 'gi'); // Added word boundaries for cleaner matching
        const parts = text.split(regex);

        return parts.map((part, i) => {
            if (!part) return null;
            
            const match = dictionary.find(entry => entry.name.toLowerCase() === part.toLowerCase());
            if (match) {
                return (
                    <button
                        key={`${part}-${i}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setInspectedEntity({ type: match.type, data: match.data });
                        }}
                        className="inline font-bold text-white underline decoration-white/40 decoration-dotted underline-offset-4 hover:decoration-brand-accent hover:text-brand-accent transition-all cursor-pointer select-text tracking-normal"
                    >
                        {part}
                    </button>
                );
            }
            return part;
        });
    }, [text, dictionary, setInspectedEntity]);

    return <>{linkedElements}</>;
};
import { useMemo, useContext } from 'react';
import { GameDataContext, GameDataContextType } from '../context/GameDataContext';
import { EntityType } from '../context/UIContext';
import { Companion, CombatActor, PlayerCharacter } from '../types';
import { canBeTargeted } from '../utils/resolution/StatusRules';

export interface DictionaryEntry {
    name: string;
    type: EntityType;
    data: any;
    avatar?: string;
}

// Common articles and RPG titles to strip for loose matching
export const IGNORED_PREFIXES = [
    /^the\s+/i, /^a\s+/i, /^an\s+/i,
    /^captain\s+/i, /^general\s+/i, /^commander\s+/i, /^lord\s+/i, /^lady\s+/i,
    /^sir\s+/i, /^madam\s+/i, /^king\s+/i, /^queen\s+/i, /^prince\s+/i, /^princess\s+/i,
    /^master\s+/i, /^mistress\s+/i, /^doctor\s+/i, /^prof\.\s+/i, /^professor\s+/i,
    /^saint\s+/i, /^st\.\s+/i, /^baron\s+/i, /^duke\s+/i, /^archmage\s+/i, /^elder\s+/i, /^high\s+/i
];

export const useEntityDictionary = () => {
    const { gameData } = useContext(GameDataContext) as GameDataContextType;

    const dictionary = useMemo(() => {
        if (!gameData) return [];
        const dict: DictionaryEntry[] = [];

        const addIfValid = (name: string | undefined, type: EntityType, data: any, avatar?: string) => {
            if (name && typeof name === 'string' && name.trim().length > 2) {
                const trimmed = name.trim();

                // Gating visibility
                if (type === 'npc') {
                    const actor = data as (CombatActor | PlayerCharacter | Companion);
                    if (!canBeTargeted(actor)) return;
                }

                let stripped = trimmed;
                let modified = false;
                for (const prefix of [/^the\s+/i, /^a\s+/i, /^an\s+/i]) {
                    if (prefix.test(stripped)) {
                        stripped = stripped.replace(prefix, '').trim();
                        modified = true;
                        break;
                    }
                }

                if (modified && stripped.length > 2) {
                    dict.push({ name: stripped, type, data, avatar });
                } else {
                    dict.push({ name: trimmed, type, data, avatar });
                }

                // Add loose versions (skipping titles)
                let looseVersion = stripped;
                let looseModified = false;
                for (const prefix of IGNORED_PREFIXES.slice(3)) {
                    if (prefix.test(looseVersion)) {
                        looseVersion = looseVersion.replace(prefix, '').trim();
                        looseModified = true;
                        break;
                    }
                }

                if (looseModified && looseVersion.length > 2 && looseVersion.toLowerCase() !== stripped.toLowerCase()) {
                    dict.push({ name: looseVersion, type, data, avatar });
                }
            }
        };

        // 1. Companions
        (gameData.companions || []).forEach(c => addIfValid(c.name, 'npc', c, c.imageUrl));

        // 2. NPCs
        (gameData.npcs || []).forEach(n => {
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

        const uniqueDict = Array.from(
            new Map(dict.map(item => [item.name.toLowerCase(), item])).values()
        );

        return uniqueDict.sort((a, b) => b.name.length - a.name.length);
    }, [gameData]);

    return dictionary;
};

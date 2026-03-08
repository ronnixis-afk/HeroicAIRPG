import React, { useMemo, useContext } from 'react';
/* Fix: Import GameDataContextType to resolve context usage errors */
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI, EntityType } from '../../context/UIContext';
import { Companion, CombatActor, PlayerCharacter } from '../../types';
import { canBeTargeted } from '../../utils/resolution/StatusRules';
import { useEntityDictionary, DictionaryEntry } from '../../hooks/useEntityDictionary';

interface EntityLinkerProps {
    text: string;
}



export const EntityLinker: React.FC<EntityLinkerProps> = ({ text }) => {
    /* Fix: Added GameDataContextType casting to ensure context properties are correctly inferred */
    const { gameData } = useContext(GameDataContext) as GameDataContextType;
    const { setInspectedEntity } = useUI();
    const dictionary = useEntityDictionary();


    const linkedElements = useMemo(() => {
        if (!text || typeof text !== 'string') return [text];
        if (dictionary.length === 0) return [text];

        // Create a large regex pattern of all entity names
        const pattern = dictionary
            .map((entry: DictionaryEntry) => entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .filter(Boolean)
            .join('|');

        if (!pattern) return [text];

        const regex = new RegExp(`\\b(${pattern})\\b`, 'gi'); // Added word boundaries for cleaner matching
        const parts = text.split(regex);

        return parts.map((part, i) => {
            if (!part) return null;

            const match = dictionary.find((entry: DictionaryEntry) => entry.name.toLowerCase() === part.toLowerCase());
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
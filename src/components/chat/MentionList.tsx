import React, { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import { DictionaryEntry } from '../../hooks/useEntityDictionary';

interface MentionListProps {
    suggestions: DictionaryEntry[];
    activeIndex: number;
    onSelect: (entry: DictionaryEntry) => void;
}

const MentionList: React.FC<MentionListProps> = ({ suggestions, activeIndex, onSelect }) => {
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const activeElement = listRef.current?.children[activeIndex] as HTMLElement;
        if (activeElement) {
            activeElement.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex]);

    if (suggestions.length === 0) return null;

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'npc': return 'user';
            case 'item': return 'chest';
            case 'location': return 'map';
            case 'lore': return 'book';
            case 'objective': return 'check';
            default: return 'info';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'npc': return 'text-blue-400';
            case 'item': return 'text-amber-400';
            case 'location': return 'text-emerald-400';
            case 'lore': return 'text-purple-400';
            case 'objective': return 'text-rose-400';
            default: return 'text-brand-accent';
        }
    };

    return (
        <div
            ref={listRef}
            className="absolute bottom-full left-0 right-0 mb-3 max-h-[50vh] overflow-y-auto bg-brand-bg/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-[100] animate-in fade-in slide-in-from-bottom-3 duration-300 custom-scroll ring-1 ring-white/5"
        >
            <div className="p-1.5 flex flex-col gap-1">
                {suggestions.map((entry, index) => (
                    <button
                        key={`${entry.type}-${entry.name}-${index}`}
                        onClick={() => onSelect(entry)}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left group ${index === activeIndex
                                ? 'bg-brand-primary/20 ring-1 ring-brand-primary/30 shadow-inner'
                                : 'hover:bg-brand-primary/10 active:scale-[0.98]'
                            }`}
                    >
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-brand-surface border border-white/10 flex items-center justify-center overflow-hidden shadow-sm transition-transform group-hover:scale-110 ${getTypeColor(entry.type)}`}>
                            {entry.avatar ? (
                                <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <Icon name={getTypeIcon(entry.type)} className="w-5 h-5" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="text-body-base font-bold text-brand-text truncate leading-tight">
                                {entry.name}
                            </div>
                            <div className={`text-[9px] tracking-[0.1em] font-black opacity-80 mt-0.5 ${getTypeColor(entry.type)}`}>
                                {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                            </div>
                        </div>

                        {index === activeIndex && (
                            <div className="text-brand-accent animate-pulse flex items-center justify-center w-6 h-6 rounded-full bg-brand-accent/10">
                                <Icon name="send" className="w-3.5 h-3.5" />
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MentionList;

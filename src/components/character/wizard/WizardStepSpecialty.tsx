import React from 'react';
import { LibraryTrait } from '../../../utils/traitLibrary';
import { Icon } from '../../Icon';

interface WizardStepSpecialtyProps {
    isCompanion: boolean;
    options: LibraryTrait[];
    selected: LibraryTrait | null;
    onSelect: (trait: LibraryTrait) => void;
    possessedTraitNames?: string[]; // Added for cross-step requirement validation
    level?: number;
}

export const WizardStepSpecialty: React.FC<WizardStepSpecialtyProps> = ({ isCompanion, options, selected, onSelect, possessedTraitNames = [], level }) => {
    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h4 className="text-2xl font-bold text-brand-text">
                    {isCompanion ? "What is their specialty?" : "How do you strike?"}
                </h4>
                <p className="text-sm text-brand-text-muted italic">Define their primary starting prowess.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
                {options.map(t => {
                    const isSelected = selected?.name === t.name;
                    const isLockedByPrereq = t.requires?.some(req => !possessedTraitNames.includes(req));
                    const isLockedByLevel = t.minLevel !== undefined && (level || 1) < t.minLevel;
                    const isLocked = isLockedByPrereq || isLockedByLevel;

                    return (
                        <button 
                            key={t.name}
                            onClick={() => !isLocked && onSelect(t)}
                            disabled={isLocked}
                            className={`text-left p-5 rounded-xl border transition-all flex flex-col gap-2 ${
                                isSelected 
                                    ? 'border-brand-accent bg-brand-accent/5' 
                                    : (isLocked ? 'bg-brand-primary/10 border-brand-primary opacity-40 cursor-not-allowed grayscale' : 'border-brand-primary bg-brand-primary/10 hover:border-brand-secondary')
                            }`}
                        >
                            <div className="flex justify-between items-center">
                                <span className={`font-bold text-base ${isSelected ? 'text-brand-accent' : (isLocked ? 'text-brand-text-muted' : 'text-brand-text')}`}>
                                    {t.name}
                                </span>
                                {isSelected && <Icon name="check" className="w-4 h-4 text-brand-accent" />}
                                {isLocked && <span className="text-[10px] font-bold text-brand-danger border border-brand-danger/20 px-3 py-0.5 rounded-lg">Locked</span>}
                            </div>
                            <p className="text-xs text-brand-text-muted leading-relaxed">{t.description}</p>

                            {isLocked && (
                                <div className="mt-1 space-y-0.5">
                                    {isLockedByPrereq && t.requires && (
                                        <p className="text-brand-danger text-[10px] font-bold">Requires: {t.requires.join(', ')}</p>
                                    )}
                                    {isLockedByLevel && t.minLevel && (
                                        <p className="text-brand-danger text-[10px] font-bold">Requires: Level {t.minLevel}</p>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

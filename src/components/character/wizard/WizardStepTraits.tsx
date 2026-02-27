import React from 'react';
import { LibraryTrait } from '../../../utils/traitLibrary';
import { Icon } from '../../Icon';

interface WizardStepTraitsProps {
    title: string;
    subtitle: string;
    traits: LibraryTrait[];
    selectedTraits: LibraryTrait[];
    onToggle: (trait: LibraryTrait) => void;
    limit: number;
    possessedTraitNames?: string[]; // Added to check requirements from previous steps
}

export const WizardStepTraits: React.FC<WizardStepTraitsProps> = ({ title, subtitle, traits, selectedTraits, onToggle, limit, possessedTraitNames = [] }) => {
    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-brand-text">{title}</h2>
                <p className="text-sm text-brand-text-muted italic">{subtitle}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
                {traits.map(t => {
                    const isSelected = selectedTraits.some(st => st.name === t.name);
                    const isLocked = t.requires?.some(req => 
                        !selectedTraits.some(st => st.name === req) && 
                        !possessedTraitNames.includes(req)
                    );

                    return (
                        <button 
                            key={t.name}
                            onClick={() => !isLocked && onToggle(t)}
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
                                {isLocked && <span className="text-[9px] font-bold text-brand-danger border border-brand-danger/20 px-3 py-0.5 rounded-full">Locked</span>}
                            </div>
                            <p className="text-xs text-brand-text-muted leading-relaxed">{t.description}</p>
                            
                            {isLocked && t.requires && (
                                <div className="mt-1">
                                    <p className="text-brand-danger text-[10px] font-bold">Requires: {t.requires.join(', ')}</p>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

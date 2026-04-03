import React from 'react';
import { LibraryTrait } from '../../../utils/traitLibrary';
import { Icon } from '../../Icon';

interface WizardStepSpecialtyProps {
    isCompanion: boolean;
    options: LibraryTrait[];
    selected: LibraryTrait | null;
    onSelect: (trait: LibraryTrait) => void;
    onEditEffect?: () => void;
    possessedTraitNames?: string[]; // Added for cross-step requirement validation
    level?: number;
}

export const WizardStepSpecialty: React.FC<WizardStepSpecialtyProps> = ({ isCompanion, options, selected, onSelect, onEditEffect, possessedTraitNames = [], level }) => {
    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h3 className="text-brand-text mb-0">
                    {isCompanion ? "What Is Their Specialty?" : "How Do You Strike?"}
                </h3>
                <p className="text-sm text-brand-text-muted italic">Define Their Primary Starting Prowess.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                {options.map(t => {
                    const isSelected = selected?.name === t.name;
                    const isLockedByPrereq = t.requires?.some(req => !possessedTraitNames.includes(req));
                    const isLockedByLevel = t.minLevel !== undefined && (level || 1) < t.minLevel;
                    const isLocked = isLockedByPrereq || isLockedByLevel;

                    // Display current selection details
                    const currentDamageType = isSelected && selected?.effect?.type === 'Damage' ? selected.effect.damageType : null;
                    const currentStatus = isSelected && selected?.effect?.type === 'Status' ? selected.effect.status : null;

                    return (
                        <button 
                            key={t.name}
                            onClick={() => !isLocked && onSelect(t)}
                            disabled={isLocked}
                            className={`text-left p-6 rounded-3xl border-2 transition-all flex flex-col gap-3 relative overflow-hidden group ${
                                isSelected 
                                    ? 'border-brand-accent bg-brand-accent/10' 
                                    : (isLocked ? 'bg-brand-primary/10 border-brand-primary opacity-40 cursor-not-allowed grayscale' : 'border-brand-primary bg-brand-primary/10 hover:border-brand-secondary')
                            }`}
                        >
                            <div className="flex justify-between items-start relative z-10 w-full">
                                <div className="space-y-1">
                                    <span className={`font-bold text-base block ${isSelected ? 'text-brand-accent' : (isLocked ? 'text-brand-text-muted' : 'text-brand-text')}`}>
                                        {t.name}
                                    </span>
                                    {isSelected && (currentDamageType || currentStatus) && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/20 px-2 py-0.5 rounded-lg border border-brand-accent/30">
                                                {currentDamageType || currentStatus} {selected.effect?.type}
                                            </span>
                                            {onEditEffect && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditEffect();
                                                    }}
                                                    className="text-[10px] font-bold text-brand-text-muted hover:text-brand-accent underline underline-offset-2 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {isSelected && <Icon name="check" className="w-5 h-5 text-brand-accent drop-shadow-[0_0_8px_rgba(62,207,142,0.5)]" />}
                                {isLocked && <span className="text-[9px] font-bold text-brand-danger border border-brand-danger/30 bg-brand-danger/5 px-2.5 py-1 rounded-full">Locked</span>}
                            </div>
                            
                            <p className="text-xs text-brand-text-muted leading-relaxed relative z-10">{t.description}</p>
                            
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                            {isLocked && (
                                <div className="mt-2 space-y-1 relative z-10">
                                    {isLockedByPrereq && t.requires && (
                                        <p className="text-brand-danger text-[10px] font-bold">Requires: {t.requires.map(r => r).join(', ')}</p>
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

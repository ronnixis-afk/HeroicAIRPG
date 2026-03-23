import React from 'react';
import { Icon } from '../../Icon';

interface WizardStepAncestryProps {
    races: { name: string, description: string, racialTrait?: any }[];
    selectedRace: string;
    onSelect: (race: string) => void;
    isCompanion: boolean;
}

export const WizardStepAncestry: React.FC<WizardStepAncestryProps> = ({ races, selectedRace, onSelect, isCompanion }) => {
    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h4 className="text-2xl font-bold text-brand-text">
                    {isCompanion ? "Who is this traveler?" : "Where do you come from?"}
                </h4>
                <p className="text-sm text-brand-text-muted italic">
                    {isCompanion ? "Select their ancestry from the world lore." : "Choose your ancestry from the world lore."}
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
                {races.map(r => (
                    <button 
                        key={r.name}
                        onClick={() => onSelect(r.name)}
                        className={`text-left p-5 rounded-xl border transition-all ${selectedRace === r.name ? 'border-brand-accent bg-brand-accent/5' : 'border-brand-primary bg-brand-primary/10 hover:border-brand-secondary'}`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold text-base ${selectedRace === r.name ? 'text-brand-accent' : 'text-brand-text'}`}>{r.name}</span>
                            {selectedRace === r.name && <Icon name="check" className="w-4 h-4 text-brand-accent" />}
                        </div>
                        <p className="text-xs text-brand-text-muted leading-relaxed mb-3">{r.description}</p>
                        {r.racialTrait && (
                            <div className={`mt-auto pt-3 border-t ${selectedRace === r.name ? 'border-brand-accent/20' : 'border-brand-primary/40'}`}>
                                <div className="flex items-center gap-2">
                                    <Icon name="sparkles" className={`w-3 h-3 ${selectedRace === r.name ? 'text-brand-accent' : 'text-brand-text-muted'}`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedRace === r.name ? 'text-brand-accent' : 'text-brand-text-muted'}`}>
                                        {r.racialTrait.name}
                                    </span>
                                </div>
                                <p className="text-[10px] text-brand-text-muted mt-1 italic">
                                    {r.racialTrait.buffs?.[0]?.abilityName ? `+2 ${r.racialTrait.buffs[0].abilityName.charAt(0).toUpperCase() + r.racialTrait.buffs[0].abilityName.slice(1)}: ` : ''}
                                    {r.racialTrait.description}
                                </p>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

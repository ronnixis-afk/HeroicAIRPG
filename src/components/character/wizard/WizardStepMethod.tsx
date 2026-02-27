import React from 'react';
import { Icon } from '../../Icon';
import { CharacterTemplate, TEMPLATE_LIBRARY } from '../../../utils/templateRegistry';
import { SkillConfiguration } from '../../../types';
import { LibraryTrait } from '../../../utils/traitLibrary';
import { getBuffTag } from '../../../utils/itemModifiers';

interface WizardStepMethodProps {
    skillConfig: SkillConfiguration;
    selectedTemplateId: string | null;
    onSelectCustom: () => void;
    onSelectTemplate: (template: CharacterTemplate) => void;
    libraryTraits: LibraryTrait[];
    isShip?: boolean;
}

export const WizardStepMethod: React.FC<WizardStepMethodProps> = ({ 
    skillConfig, 
    selectedTemplateId, 
    onSelectCustom, 
    onSelectTemplate,
    libraryTraits,
    isShip = false
}) => {
    const allTemplates = TEMPLATE_LIBRARY[skillConfig] || [];
    // Filter templates to only show relevant ones (Ship vs Character)
    const templates = allTemplates.filter(t => t.isShip === isShip);

    const getTraitDetails = (traitNames: string[], category: string) => {
        const matching = libraryTraits.filter(t => traitNames.includes(t.name));
        if (category === 'skills') {
            const skills = new Set<string>();
            matching.forEach(t => t.buffs?.forEach(b => { if (b.type === 'skill' && b.skillName) skills.add(b.skillName); }));
            return Array.from(skills).sort().join(', ');
        }
        if (category === 'bonuses') {
            const bonuses = new Set<string>();
            matching.forEach(t => t.buffs?.forEach(b => { 
                if (b.type !== 'skill') {
                    const { label } = getBuffTag(b);
                    bonuses.add(label);
                }
            }));
            return Array.from(bonuses).sort().join(', ');
        }
        return '';
    };

    const getCombatSkill = (traitName: string) => {
        const trait = libraryTraits.find(t => t.name === traitName);
        if (trait?.effect) {
            const e = trait.effect;
            if (e.type === 'Damage') return `${e.damageDice} ${e.damageType || ''} Strike`;
            if (e.type === 'Heal') return `${e.healDice || ''} Restore`;
            if (e.type === 'Status') return `${e.status} Influence`;
        }
        return traitName;
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-brand-text">The Path of Creation</h2>
                <p className="text-sm text-brand-text-muted italic">
                    {isShip ? 'Choose to forge a custom vessel or select an established blueprint.' : 'Choose to forge a custom legend or select an established archetype.'}
                </p>
            </div>

            <div className="flex flex-col gap-4 max-w-2xl mx-auto pb-10">
                <button
                    onClick={onSelectCustom}
                    className={`text-left p-6 rounded-2xl border-2 transition-all group flex flex-row items-center gap-6 ${
                        selectedTemplateId === null 
                            ? 'border-brand-accent bg-brand-accent/5' 
                            : 'border-brand-primary bg-brand-primary/10 hover:border-brand-secondary'
                    }`}
                >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${selectedTemplateId === null ? 'bg-brand-accent text-black border-brand-accent' : 'bg-brand-surface text-brand-text-muted border-brand-primary'}`}>
                        <Icon name="hammer" className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <span className={`text-lg font-bold ${selectedTemplateId === null ? 'text-brand-accent' : 'text-brand-text'}`}>
                                {isShip ? 'Custom Commission' : 'Custom Journey'}
                            </span>
                            {selectedTemplateId === null && <Icon name="check" className="w-5 h-5 text-brand-accent" />}
                        </div>
                        <p className="text-xs text-brand-text-muted leading-relaxed">
                            {isShip ? 'Manually configure your hull plating, internal modules, and primary batteries.' : 'Manually select your background, general traits, and combat prowess.'}
                        </p>
                    </div>
                </button>

                <div className="flex items-center gap-4 py-4">
                    <div className="h-px bg-brand-primary/30 flex-1"></div>
                    <span className="text-[10px] font-bold text-brand-text-muted tracking-normal normal-case">Available Blueprints</span>
                    <div className="h-px bg-brand-primary/30 flex-1"></div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {templates.map(template => {
                        const isSelected = selectedTemplateId === template.id;
                        const skillList = getTraitDetails([...template.backgroundTraitNames, ...template.generalTraitNames], 'skills');
                        const bonusList = getTraitDetails([...template.backgroundTraitNames, ...template.generalTraitNames], 'bonuses');
                        const combatSkill = getCombatSkill(template.combatTraitName);

                        return (
                            <button
                                key={template.id}
                                onClick={() => onSelectTemplate(template)}
                                className={`text-left p-5 rounded-2xl border-2 transition-all flex flex-col gap-4 ${
                                    isSelected 
                                        ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20' 
                                        : 'border-brand-primary bg-brand-surface hover:border-brand-primary/80'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className={`text-base font-bold ${isSelected ? 'text-brand-accent' : 'text-brand-text'}`}>{template.name}</span>
                                            <span className="text-[10px] font-bold text-brand-accent/60 px-2 py-0.5 rounded border border-brand-accent/20">{template.role}</span>
                                        </div>
                                        <p className="text-xs text-brand-text-muted italic leading-relaxed">{template.description}</p>
                                    </div>
                                    {isSelected && <Icon name="check" className="w-5 h-5 text-brand-accent mt-1" />}
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-brand-primary/20">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[8px] font-bold text-brand-text-muted block mb-1 tracking-normal normal-case">
                                                {isShip ? 'Modules' : 'Expertise'}
                                            </label>
                                            <p className="text-[10px] font-bold text-brand-accent leading-snug line-clamp-2 capitalize">{skillList || 'Standard'}</p>
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-bold text-brand-text-muted block mb-1 tracking-normal normal-case">Combat</label>
                                            <p className="text-[10px] font-bold text-purple-400 leading-snug truncate capitalize">{combatSkill}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[8px] font-bold text-brand-text-muted block mb-1 tracking-normal normal-case">
                                                {isShip ? 'Hull Reinforcement' : 'Passive Bonuses'}
                                            </label>
                                            <p className="text-[10px] font-bold text-orange-400 leading-snug line-clamp-2 capitalize">{bonusList || 'Standard'}</p>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
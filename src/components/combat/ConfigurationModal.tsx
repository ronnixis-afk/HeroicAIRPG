import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { type CombatActorSize, type EnemyTemplate, type AffinityDefinition, DAMAGE_TYPES, ARCHETYPE_NAMES, type ArchetypeName, type SkillName } from '../../types';
import { TagEditor } from '../TagEditor';
// Fix: Added missing Icon import
import { Icon } from '../Icon';
import { InputField, ModalTabButton } from './CombatFormFields';

interface ConfigurationModalProps {
    isOpen: boolean;
    onClose: () => void;
    templates: Record<string, EnemyTemplate>;
    affinities: Record<string, AffinityDefinition>;
    sizeModifiers: Record<CombatActorSize, { str: number, dex: number, con: number, ac: number }>;
    baseScore: number;
    archetypeDefinitions?: Record<ArchetypeName, { ground: number, climb: number, swim: number, fly: number }>;
    onUpdateTemplate: (key: string, template: EnemyTemplate) => void;
    onUpdateAffinity: (key: string, affinity: AffinityDefinition) => void;
    onUpdateSizeModifier: (size: CombatActorSize, mods: { str: number, dex: number, con: number, ac: number }) => void;
    onUpdateBaseScore: (score: number) => void;
    onUpdateArchetype: (name: ArchetypeName, speeds: { ground: number, climb: number, swim: number, fly: number }) => void;
}

const INTERACTION_SKILLS: SkillName[] = [
    'Perception', 'Insight', 'Investigation', 'Deception', 'Intimidation', 'Persuasion', 'Stealth', 'Athletics'
];

export const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ 
    isOpen, 
    onClose, 
    templates, 
    affinities, 
    sizeModifiers, 
    baseScore,
    archetypeDefinitions,
    onUpdateTemplate,
    onUpdateAffinity,
    onUpdateSizeModifier,
    onUpdateBaseScore,
    onUpdateArchetype
}) => {
    const [templateTab, setTemplateTab] = useState<'templates' | 'archetypes' | 'sizes' | 'base' | 'affinities'>('templates');
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [selectedAffinityKey, setSelectedAffinityKey] = useState<string | null>(null);

    // Default selections
    useEffect(() => {
        if (isOpen) {
            if (!selectedTemplate) setSelectedTemplate(Object.keys(templates).find(k => k !== 'Custom') || null);
            if (!selectedAffinityKey) setSelectedAffinityKey(Object.keys(affinities)[0] || null);
        }
    }, [isOpen, templates, affinities, selectedTemplate, selectedAffinityKey]);

    const handleTemplateChange = (key: string, field: string, value: any) => {
        const newTemplate = { ...templates[key] };
        (newTemplate as any)[field] = value;
        onUpdateTemplate(key, newTemplate);
    };

    const handleTemplateModChange = (key: string, index: number, value: number) => {
        const newTemplate = { ...templates[key] };
        const newMods = [...newTemplate.mods];
        newMods[index] = value;
        newTemplate.mods = newMods;
        onUpdateTemplate(key, newTemplate);
    };

    const handleToggleSkill = (key: string, skill: SkillName) => {
        const newTemplate = { ...templates[key] };
        const currentSkills = newTemplate.proficientSkills || [];
        if (currentSkills.includes(skill)) {
            newTemplate.proficientSkills = currentSkills.filter(s => s !== skill);
        } else {
            newTemplate.proficientSkills = [...currentSkills, skill];
        }
        onUpdateTemplate(key, newTemplate);
    };
    
    const handleAffinityDefChange = (key: string, field: string, value: any) => {
        const newAffinity = { ...affinities[key] };
        (newAffinity as any)[field] = value;
        onUpdateAffinity(key, newAffinity);
    };

    const handleSizeModChange = (size: CombatActorSize, field: 'str' | 'dex' | 'con' | 'ac', value: number) => {
        const currentMods = sizeModifiers[size];
        onUpdateSizeModifier(size, { ...currentMods, [field]: value });
    };

    const handleArchetypeSpeedChange = (name: ArchetypeName, type: 'ground' | 'climb' | 'swim' | 'fly', value: number) => {
        if (!archetypeDefinitions) return;
        const currentSpeeds = archetypeDefinitions[name];
        onUpdateArchetype(name, { ...currentSpeeds, [type]: value });
    };

    const selectClass = "w-full bg-brand-primary h-11 px-4 rounded-xl border border-brand-surface focus:border-brand-accent focus:ring-1 focus:ring-brand-accent focus:outline-none text-body-base text-brand-text appearance-none transition-all cursor-pointer shadow-inner";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configuration">
            <div className="flex border-b border-brand-primary/20 mb-6 bg-brand-primary/10 rounded-xl p-1">
                <ModalTabButton label="Templates" isActive={templateTab === 'templates'} onClick={() => setTemplateTab('templates')} />
                <ModalTabButton label="Archetypes" isActive={templateTab === 'archetypes'} onClick={() => setTemplateTab('archetypes')} />
                <ModalTabButton label="Affinities" isActive={templateTab === 'affinities'} onClick={() => setTemplateTab('affinities')} />
                <ModalTabButton label="Sizes" isActive={templateTab === 'sizes'} onClick={() => setTemplateTab('sizes')} />
                <ModalTabButton label="Base" isActive={templateTab === 'base'} onClick={() => setTemplateTab('base')} />
            </div>

            <div className="h-[60vh] overflow-y-auto custom-scroll px-1">
                
                {/* Templates Editor */}
                {templateTab === 'templates' && (
                    <div className="flex flex-col h-full">
                        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 flex-shrink-0 no-scrollbar">
                            {Object.keys(templates).filter(k => k !== 'Custom').map(key => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedTemplate(key)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${selectedTemplate === key ? 'bg-brand-accent text-black border-brand-accent shadow-md' : 'bg-brand-primary text-brand-text-muted border-brand-surface hover:border-brand-primary/50'}`}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                        
                        {selectedTemplate && templates[selectedTemplate] && (
                            <div className="space-y-8 animate-fade-in pb-8">
                                <InputField label="Attack Type" value={templates[selectedTemplate].attackType} onChange={e => handleTemplateChange(selectedTemplate, 'attackType', e.target.value)} />
                                
                                <div className="space-y-2">
                                    <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Default Archetype</label>
                                    <div className="relative">
                                        <select
                                            value={templates[selectedTemplate].defaultArchetype || 'Bipedal'}
                                            onChange={e => handleTemplateChange(selectedTemplate, 'defaultArchetype', e.target.value as ArchetypeName)}
                                            className={selectClass}
                                        >
                                            {ARCHETYPE_NAMES.map(arch => (
                                                <option key={arch} value={arch}>{arch}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted opacity-50">
                                            <Icon name="chevronDown" className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface shadow-inner">
                                    <h4 className="text-body-sm font-bold text-brand-text-muted mb-4 ml-1">Stat Modifiers</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        {['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'].map((stat, idx) => (
                                            <div key={stat} className="space-y-1.5">
                                                <label className="block text-[10px] font-black text-brand-text-muted mb-1 text-center uppercase tracking-tight">{stat}</label>
                                                <input 
                                                    type="number" 
                                                    value={templates[selectedTemplate].mods[idx]} 
                                                    onChange={e => handleTemplateModChange(selectedTemplate, idx, parseInt(e.target.value) || 0)}
                                                    className="w-full bg-brand-primary h-11 rounded-xl text-sm border border-brand-surface focus:border-brand-accent focus:outline-none text-center font-black shadow-inner"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface shadow-inner">
                                    <h4 className="text-body-sm font-bold text-brand-text-muted mb-4 ml-1">Skill Proficiencies</h4>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        {INTERACTION_SKILLS.map(skill => {
                                            const isProf = (templates[selectedTemplate].proficientSkills || []).includes(skill);
                                            return (
                                                <div key={skill} className="flex items-center gap-3 p-2.5 hover:bg-brand-primary/30 rounded-xl transition-all group cursor-pointer" onClick={() => handleToggleSkill(selectedTemplate, skill)}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isProf}
                                                        onChange={() => {}} // Handled by div click
                                                        className="custom-checkbox"
                                                    />
                                                    <span className={`text-body-sm font-bold transition-colors ${isProf ? 'text-brand-text' : 'text-brand-text-muted group-hover:text-brand-text'}`}>
                                                        {skill}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Archetypes Editor */}
                {templateTab === 'archetypes' && archetypeDefinitions && (
                    <div className="space-y-6 animate-fade-in pb-8">
                        <p className="text-body-sm text-brand-text-muted mb-4 px-1 italic leading-relaxed">Configure default movement speeds for each archetype. Changes apply to newly generated enemies.</p>
                        {ARCHETYPE_NAMES.map(arch => {
                            const speeds = archetypeDefinitions[arch];
                            return (
                                <div key={arch} className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface shadow-inner">
                                    <h4 className="text-body-base font-bold text-brand-text mb-4 ml-1">{arch}</h4>
                                    <div className="grid grid-cols-4 gap-3">
                                        {['ground', 'climb', 'swim', 'fly'].map((type) => (
                                            <div key={type} className="space-y-1.5">
                                                <label className="text-[10px] font-black text-brand-text-muted block text-center capitalize tracking-tight">{type}</label>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        value={(speeds as any)[type]} 
                                                        onChange={e => handleArchetypeSpeedChange(arch, type as any, parseInt(e.target.value) || 0)} 
                                                        className="w-full bg-brand-primary h-10 rounded-xl text-center text-sm font-black border border-brand-surface focus:border-brand-accent focus:outline-none shadow-inner" 
                                                    />
                                                    <span className="absolute right-1 bottom-1 text-[8px] text-brand-text-muted opacity-40 font-bold">ft</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Affinities Editor */}
                {templateTab === 'affinities' && (
                    <div className="space-y-6 animate-fade-in pb-8">
                        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                            {Object.keys(affinities).map(key => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedAffinityKey(key)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${selectedAffinityKey === key ? 'bg-brand-accent text-black border-brand-accent shadow-md' : 'bg-brand-primary text-brand-text-muted border-brand-surface hover:border-brand-primary/50'}`}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                        {selectedAffinityKey && affinities[selectedAffinityKey] && (
                            <div className="space-y-8">
                                <InputField label="Description" value={affinities[selectedAffinityKey].description} onChange={e => handleAffinityDefChange(selectedAffinityKey, 'description', e.target.value)} />
                                
                                <div className="space-y-10 pt-4 border-t border-brand-primary/20">
                                    <TagEditor 
                                        label="Resistances" 
                                        tags={affinities[selectedAffinityKey].resistances} 
                                        onTagsChange={tags => handleAffinityDefChange(selectedAffinityKey, 'resistances', tags)} 
                                        options={DAMAGE_TYPES} 
                                    />
                                    <TagEditor 
                                        label="Immunities" 
                                        tags={affinities[selectedAffinityKey].immunities} 
                                        onTagsChange={tags => handleAffinityDefChange(selectedAffinityKey, 'immunities', tags)} 
                                        options={DAMAGE_TYPES} 
                                    />
                                    <TagEditor 
                                        label="Vulnerabilities" 
                                        tags={affinities[selectedAffinityKey].vulnerabilities} 
                                        onTagsChange={tags => handleAffinityDefChange(selectedAffinityKey, 'vulnerabilities', tags)} 
                                        options={DAMAGE_TYPES} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Sizes Editor */}
                {templateTab === 'sizes' && (
                    <div className="space-y-6 animate-fade-in pb-8">
                        {Object.keys(sizeModifiers).map((sizeKey) => {
                            const size = sizeKey as CombatActorSize;
                            const mods = sizeModifiers[size];
                            return (
                                <div key={size} className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface shadow-inner">
                                    <h4 className="text-body-base font-bold text-brand-text mb-4 ml-1">{size}</h4>
                                    <div className="grid grid-cols-4 gap-3">
                                        {['str', 'dex', 'con', 'ac'].map((field) => (
                                            <div key={field} className="space-y-1.5">
                                                <label className="text-[10px] font-black text-brand-text-muted block text-center uppercase tracking-tight">{field}</label>
                                                <input 
                                                    type="number" 
                                                    value={(mods as any)[field]} 
                                                    onChange={e => handleSizeModChange(size, field as any, parseInt(e.target.value) || 0)} 
                                                    className="w-full bg-brand-primary h-11 rounded-xl text-center text-sm font-black border border-brand-surface focus:border-brand-accent focus:outline-none shadow-inner" 
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Base Score Editor */}
                {templateTab === 'base' && (
                    <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-8 animate-fade-in pb-8">
                        <div className="text-center max-w-xs space-y-4">
                            <h3 className="text-brand-text">Core Difficulty</h3>
                            <p className="text-body-base text-brand-text-muted italic leading-relaxed">
                                The base score determines the starting stat block value before modifiers for all dynamically generated enemies.
                            </p>
                        </div>
                        <div className="flex flex-col items-center p-8 bg-brand-primary/20 rounded-3xl border border-brand-surface shadow-inner">
                            <label className="text-xs font-black text-brand-accent uppercase mb-4 tracking-normal">Global base score</label>
                            <input 
                                type="number" 
                                value={baseScore} 
                                onChange={e => onUpdateBaseScore(parseInt(e.target.value) || 8)}
                                className="w-24 h-16 text-center bg-brand-surface rounded-2xl border-2 border-brand-primary focus:border-brand-accent text-3xl font-black text-brand-text focus:outline-none transition-all shadow-lg"
                            />
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

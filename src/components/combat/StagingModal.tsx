
// components/combat/StagingModal.tsx

import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { type CombatActorSize, type EnemyTemplate, type AffinityDefinition, type ArchetypeName, ARCHETYPE_NAMES, type ActorAlignment } from '../../types';
import { generateEnemyFromTemplate, recalculateCombatActorStats, DEFAULT_ARCHETYPE_DEFINITIONS, getDifficultyParams, DifficultyPreset } from '../../utils/mechanics';
import { InputField, CheckboxField } from './CombatFormFields';
import { Icon } from '../Icon';

interface StagingModalProps {
    isOpen: boolean;
    onClose: () => void;
    templates: Record<string, EnemyTemplate>;
    affinities: Record<string, AffinityDefinition>;
    sizeModifiers: Record<CombatActorSize, { str: number, dex: number, con: number, ac: number }>;
    baseScore: number;
    playerLevel: number;
    onAddActor: (enemy: any) => void;
    archetypeDefinitions?: Record<ArchetypeName, { ground: number, climb: number, swim: number, fly: number }>;
}

const AlignmentButton: React.FC<{ label: string, active: boolean, onClick: () => void, colorClass: string }> = ({ label, active, onClick, colorClass }) => (
    <button 
        onClick={onClick}
        className={`flex-1 flex flex-col items-center justify-center h-16 rounded-2xl border transition-all shadow-md group ${
            active 
                ? `bg-brand-primary/40 border-brand-accent ${colorClass}` 
                : 'bg-brand-primary/40 border-brand-surface text-brand-text-muted hover:border-brand-primary'
        }`}
    >
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mb-1 transition-all ${
            active ? 'bg-brand-accent border-brand-accent' : 'border-brand-text-muted/30'
        }`}>
            {active && <Icon name="check" className="w-3 h-3 text-black" />}
        </div>
        <span className={`text-body-sm font-bold ${active ? 'text-brand-text' : 'text-brand-text-muted group-hover:text-brand-text'}`}>
            {label}
        </span>
    </button>
);

export const StagingModal: React.FC<StagingModalProps> = ({ 
    isOpen, 
    onClose, 
    templates, 
    affinities, 
    sizeModifiers, 
    baseScore,
    playerLevel,
    onAddActor,
    archetypeDefinitions
}) => {
    const [difficultyTag, setDifficultyTag] = useState<DifficultyPreset>('Normal');
    const [enemySize, setEnemySize] = useState<CombatActorSize>('Medium');
    const [selectedAffinity, setSelectedAffinity] = useState<string>('');
    const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeName>('Bipedal');
    const [customName, setCustomName] = useState('');
    const [alignment, setAlignment] = useState<ActorAlignment>('enemy'); 
    const [newActorIsShip, setNewActorIsShip] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setCustomName('');
            setAlignment('enemy'); 
            setNewActorIsShip(false);
            setSelectedAffinity('');
            setSelectedArchetype('Bipedal');
            setDifficultyTag('Normal');
        }
    }, [isOpen]);

    const handleApplyTemplate = (templateName: string) => {
        const params = getDifficultyParams(difficultyTag, playerLevel);

        let fallbackName = '';
        if (!customName.trim()) {
            const parts: string[] = [];
            if (difficultyTag !== 'Normal') parts.push(difficultyTag);
            parts.push(templateName);
            fallbackName = parts.join(' ');
        }

        const newEnemy = generateEnemyFromTemplate(
            templateName, 
            params.cr, 
            params.rank, 
            enemySize, 
            customName || fallbackName, 
            templates, 
            sizeModifiers, 
            baseScore,
            selectedArchetype,
            archetypeDefinitions || DEFAULT_ARCHETYPE_DEFINITIONS
        );
        newEnemy.alignment = alignment;
        newEnemy.isAlly = alignment === 'ally';
        newEnemy.isShip = newActorIsShip;
        
        if (selectedAffinity && affinities[selectedAffinity]) {
            const aff = affinities[selectedAffinity];
            newEnemy.affinity = selectedAffinity;
            newEnemy.resistances = [...aff.resistances];
            newEnemy.immunities = [...aff.immunities];
            newEnemy.vulnerabilities = [...aff.vulnerabilities];
        }
        
        // Centralize final scaling logic (HP, Attacks, TempHP)
        const finalizedEnemy = recalculateCombatActorStats(newEnemy, templates);

        onAddActor(finalizedEnemy); 
        onClose();
    };

    const selectClass = "w-full bg-brand-primary h-11 px-4 rounded-xl border border-brand-surface focus:border-brand-accent focus:ring-1 focus:ring-brand-accent focus:outline-none text-body-base text-brand-text appearance-none transition-all cursor-pointer shadow-inner";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Stage Actor">
            <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scroll pb-4">
                <InputField 
                    label="Custom Name (Optional)" 
                    placeholder="e.g. Goblin King, Guard Captain"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                />
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-1">
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Difficulty Cr</label>
                        <div className="relative">
                            <select 
                                value={difficultyTag}
                                onChange={(e) => setDifficultyTag(e.target.value as DifficultyPreset)}
                                className={selectClass}
                            >
                                <option value="Weak">Weak</option>
                                <option value="Normal">Normal</option>
                                <option value="Elite">Elite (+2)</option>
                                <option value="Boss">Boss (+4)</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted opacity-50">
                                <Icon name="chevronDown" className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                    <div className="col-span-1">
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Size</label>
                        <div className="relative">
                            <select 
                                value={enemySize} 
                                onChange={(e) => setEnemySize(e.target.value as any)}
                                className={selectClass}
                            >
                                {Object.keys(sizeModifiers).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted opacity-50">
                                <Icon name="chevronDown" className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Movement</label>
                        <div className="relative">
                            <select 
                                value={selectedArchetype} 
                                onChange={(e) => setSelectedArchetype(e.target.value as ArchetypeName)}
                                className={selectClass}
                            >
                                {ARCHETYPE_NAMES.map(arch => <option key={arch} value={arch}>{arch}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted opacity-50">
                                <Icon name="chevronDown" className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Affinity</label>
                        <div className="relative">
                            <select 
                                value={selectedAffinity} 
                                onChange={(e) => setSelectedAffinity(e.target.value)} 
                                className={selectClass}
                            >
                                <option value="">None</option>
                                {Object.keys(affinities).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted opacity-50">
                                <Icon name="chevronDown" className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="block text-body-sm font-bold text-brand-text-muted ml-1">Combat Alignment</label>
                    <div className="flex gap-2">
                        <AlignmentButton label="Enemy" active={alignment === 'enemy'} onClick={() => setAlignment('enemy')} colorClass="text-brand-danger" />
                        <AlignmentButton label="Neutral" active={alignment === 'neutral'} onClick={() => setAlignment('neutral')} colorClass="text-brand-text-muted" />
                        <AlignmentButton label="Ally" active={alignment === 'ally'} onClick={() => setAlignment('ally')} colorClass="text-brand-accent" />
                    </div>
                </div>

                <div className="pt-2">
                    <CheckboxField label="Is Ship / Vehicle" checked={newActorIsShip} onChange={e => setNewActorIsShip(e.target.checked)} />
                    <p className="text-[10px] text-brand-text-muted mt-2 ml-1 italic opacity-60">Ships have doubled HP and higher fire-rate scaling.</p>
                </div>
                
                <div className="pt-2">
                    <label className="block text-body-sm font-bold text-brand-text-muted mb-3 ml-1">Select Template</label>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.keys(templates).map(key => (
                            <button
                                key={key}
                                onClick={() => handleApplyTemplate(key)}
                                className="bg-brand-primary hover:bg-brand-surface p-4 rounded-2xl border border-brand-surface text-left transition-all hover:border-brand-accent group flex flex-col h-full shadow-inner"
                            >
                                <div className="font-bold text-brand-text text-body-base group-hover:text-brand-accent mb-1 transition-colors">
                                    {key === 'Custom' ? 'Blank / Custom' : key}
                                </div>
                                {key !== 'Custom' && (
                                    <div className="text-[10px] font-black text-brand-text-muted mt-auto opacity-60 tracking-tight">
                                        {templates[key].attackType}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

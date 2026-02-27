
// components/combat/ActorIdentity.tsx

import React, { useMemo } from 'react';
import { type CombatActor, type AffinityDefinition, ARCHETYPE_NAMES, type ArchetypeName, type ActorAlignment } from '../../types';
import { InputField, CheckboxField } from './CombatFormFields';
import { getDifficultyParams, DifficultyPreset } from '../../utils/mechanics';
import { Icon } from '../Icon';

interface ActorIdentityProps {
    actor: CombatActor;
    playerLevel: number;
    onChange: (path: (string | number)[], value: any) => void;
    onAffinityChange: (affinity: string) => void;
    onShipToggle: (isShip: boolean) => void;
    affinities: Record<string, AffinityDefinition>;
    archetypeDefinitions: Record<ArchetypeName, { ground: number, climb: number, swim: number, fly: number }>;
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

export const ActorIdentity: React.FC<ActorIdentityProps> = ({ actor, playerLevel, onChange, onAffinityChange, onShipToggle, affinities, archetypeDefinitions }) => {
    
    const adjustHp = (amount: number) => {
        const newHp = Math.max(0, Math.min(actor.maxHitPoints || 0, (actor.currentHitPoints || 0) + amount));
        onChange(['currentHitPoints'], newHp);
    };

    const handleArchetypeChange = (newArchetype: string) => {
        onChange(['archetype'], newArchetype);
        const stats = archetypeDefinitions[newArchetype as ArchetypeName];
        if (stats) {
            onChange(['speed'], stats.ground);
            onChange(['climbSpeed'], stats.climb);
            onChange(['swimSpeed'], stats.swim);
            onChange(['flySpeed'], stats.fly);
        }
    };

    const handleDifficultyPresetChange = (tag: string) => {
        const params = getDifficultyParams(tag as DifficultyPreset, playerLevel);
        onChange(['rank'], params.rank);
        onChange(['challengeRating'], params.cr);
    };

    const handleAlignmentChange = (val: ActorAlignment) => {
        onChange(['alignment'], val);
        onChange(['isAlly'], val === 'ally');
    };

    const currentDifficultyTag = useMemo(() => {
        const presets: DifficultyPreset[] = ['Weak', 'Normal', 'Elite', 'Boss'];
        for (const p of presets) {
            const params = getDifficultyParams(p, playerLevel);
            if (params.cr === actor.challengeRating && params.rank === actor.rank) {
                return p;
            }
        }
        return 'Custom';
    }, [actor.challengeRating, actor.rank, playerLevel]);

    const selectClass = "w-full bg-brand-primary h-11 px-4 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base text-brand-text transition-all shadow-inner appearance-none cursor-pointer";

    return (
        <div className="space-y-4">
            <InputField label="Name" value={actor.name} onChange={e => onChange(['name'], e.target.value)} />

            <div className="grid grid-cols-6 gap-3">
                <div className="col-span-4">
                    <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Difficulty Cr</label>
                    <div className="relative">
                        <select 
                            value={currentDifficultyTag} 
                            onChange={e => handleDifficultyPresetChange(e.target.value)}
                            className={selectClass}
                        >
                            <option value="Weak">Weak</option>
                            <option value="Normal">Normal</option>
                            <option value="Elite">Elite</option>
                            <option value="Boss">Boss</option>
                            {currentDifficultyTag === 'Custom' && <option value="Custom">Custom</option>}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted opacity-50">
                            <Icon name="chevronDown" className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                <div className="col-span-2">
                    <InputField label="Ac" type="number" value={String(actor.armorClass)} onChange={e => onChange(['armorClass'], parseInt(e.target.value) || 10)} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                    <InputField label="Max Hp" type="number" value={String(actor.maxHitPoints)} onChange={e => onChange(['maxHitPoints'], parseInt(e.target.value) || 10)} />
                </div>
                <div className="col-span-1">
                    <InputField label="Current Hp" type="number" value={String(actor.currentHitPoints)} onChange={e => onChange(['currentHitPoints'], parseInt(e.target.value) || 0)} className="text-brand-accent font-bold" />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1 flex items-center justify-between gap-2">
                    <button onClick={() => adjustHp(-5)} className="flex-1 bg-brand-danger/10 hover:bg-brand-danger/20 text-brand-danger border border-brand-danger/20 h-10 rounded-xl font-bold text-xs transition-colors">-5</button>
                    <button onClick={() => adjustHp(-1)} className="flex-1 bg-brand-danger/10 hover:bg-brand-danger/20 text-brand-danger border border-brand-danger/20 h-10 rounded-xl font-bold text-xs transition-colors">-1</button>
                </div>
                <div className="col-span-1 flex items-center justify-between gap-2">
                    <button onClick={() => adjustHp(1)} className="flex-1 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent border border-brand-accent/20 h-10 rounded-xl font-bold text-xs transition-colors">+1</button>
                    <button onClick={() => adjustHp(5)} className="flex-1 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent border border-brand-accent/20 h-10 rounded-xl font-bold text-xs transition-colors">+5</button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                    <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">Max Temp Hp</label>
                    <div className="relative">
                        {/* Fix: Access maxTemporaryHitPoints from updated CombatActor interface */}
                        <input 
                            type="number" 
                            value={actor.maxTemporaryHitPoints || 0} 
                            readOnly
                            className="w-full bg-brand-primary/50 h-11 px-4 rounded-xl border border-brand-surface text-body-base text-brand-text-muted cursor-not-allowed shadow-inner" 
                            aria-label="Maximum Temporary Hit Points"
                        />
                        <div className="absolute inset-y-0 right-3 flex items-center text-brand-text-muted" title="Calculated from rank and challenge rating.">
                            <Icon name="check" className="w-4 h-4 opacity-30" />
                        </div>
                    </div>
                </div>
                <div className="col-span-1">
                    <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">Current Temp Hp</label>
                    {/* Fix: Access temporaryHitPoints from updated CombatActor interface */}
                    <input 
                        type="number" 
                        value={actor.temporaryHitPoints || 0} 
                        onChange={e => onChange(['temporaryHitPoints'], parseInt(e.target.value) || 0)} 
                        className="w-full bg-brand-primary h-11 px-4 rounded-xl focus:ring-brand-accent focus:ring-1 focus:border-brand-accent focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base text-emerald-400 font-bold transition-all shadow-inner" 
                        aria-label="Current Temporary Hit Points"
                    />
                </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                    <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Affinity</label>
                    <div className="relative">
                        <select 
                            value={actor.affinity || ''} 
                            onChange={e => onAffinityChange(e.target.value)}
                            className={selectClass}
                        >
                            <option value="">None</option>
                            {Object.keys(affinities).map(key => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted opacity-50">
                            <Icon name="chevronDown" className="w-4 h-4" />
                        </div>
                    </div>
                </div>
                <div className="col-span-2">
                    <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Archetype</label>
                    <div className="relative">
                        <select
                            value={actor.archetype || 'Bipedal'}
                            onChange={e => handleArchetypeChange(e.target.value)}
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
            </div>

            <div className="space-y-3">
                <label className="block text-body-sm font-bold text-brand-text-muted ml-1">Alignment</label>
                <div className="flex gap-2">
                    <AlignmentButton label="Enemy" active={actor.alignment === 'enemy'} onClick={() => handleAlignmentChange('enemy')} colorClass="text-brand-danger" />
                    <AlignmentButton label="Neutral" active={actor.alignment === 'neutral'} onClick={() => handleAlignmentChange('neutral')} colorClass="text-brand-text-muted" />
                    <AlignmentButton label="Ally" active={actor.alignment === 'ally'} onClick={() => handleAlignmentChange('ally')} colorClass="text-brand-accent" />
                </div>
            </div>

            <div className="pt-2">
                <CheckboxField label="Is Ship / Vehicle" checked={actor.isShip || false} onChange={e => onShipToggle(e.target.checked)} />
            </div>
        </div>
    );
};

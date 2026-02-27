import React, { useState } from 'react';
import { CombatActor, CombatActorSpecialAbility, DAMAGE_TYPES, ABILITY_SCORES } from '../../types';
import Accordion from '../Accordion';
import { Icon } from '../Icon';
import { InputField } from './CombatFormFields';

interface ActorActionsProps {
    actor: CombatActor;
    onChange: (keys: (string | number)[], value: any) => void;
    onAddAttack: () => void;
    onRemoveAttack: (index: number) => void;
    onAddAbility: () => void;
    onRemoveAbility: (index: number) => void;
}

export const ActorActions: React.FC<ActorActionsProps> = ({ 
    actor, 
    onChange, 
    onAddAttack, 
    onRemoveAttack, 
    onAddAbility, 
    onRemoveAbility 
}) => {
    const [openAttacks, setOpenAttacks] = useState(true);
    const [openAbilities, setOpenAbilities] = useState(true);

    const STATUS_EFFECT_OPTIONS: (CombatActorSpecialAbility['status'])[] = [
        'Prone', 'Stunned', 'Poisoned', 'Paralyzed', 'Blinded', 'Deafened'
    ];

    return (
        <div className="space-y-6">
            <Accordion title="Combat Strikes" isOpen={openAttacks} onToggle={() => setOpenAttacks(!openAttacks)}>
                <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center px-2 mb-2">
                        <label className="text-[10px] font-black text-brand-text-muted tracking-normal">Strikes per Turn</label>
                        <input 
                            type="number" 
                            value={actor.numberOfAttacks || 1}
                            onChange={e => onChange(['numberOfAttacks'], parseInt(e.target.value) || 1)}
                            className="w-16 bg-brand-primary h-9 rounded-lg border border-brand-surface focus:border-brand-accent text-center text-body-base font-black tabular-nums shadow-inner"
                        />
                    </div>
                    {(actor.attacks || []).map((attack, index) => (
                        <div key={index} className="bg-brand-primary/20 p-4 rounded-2xl border border-brand-surface/50 relative shadow-inner animate-fade-in">
                            <button 
                                onClick={() => onRemoveAttack(index)}
                                className="absolute top-3 right-3 text-brand-text-muted hover:text-brand-danger transition-colors p-1"
                            >
                                <Icon name="close" className="w-4 h-4" />
                            </button>
                            <div className="space-y-4 pt-1">
                                <InputField label="Strike Name" value={attack.name} onChange={e => onChange(['attacks', index, 'name'], e.target.value)} />
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="To Hit (+)" type="number" value={String(attack.toHitBonus)} onChange={e => onChange(['attacks', index, 'toHitBonus'], parseInt(e.target.value) || 0)} />
                                    <InputField label="Damage Dice" value={attack.damageDice} onChange={e => onChange(['attacks', index, 'damageDice'], e.target.value)} placeholder="e.g. 1d8+4" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-brand-text-muted tracking-normal ml-1">Type</label>
                                    <div className="relative">
                                        <select 
                                            value={attack.damageType} 
                                            onChange={e => onChange(['attacks', index, 'damageType'], e.target.value)}
                                            className="w-full bg-brand-primary h-11 px-4 pr-10 rounded-xl border border-brand-surface focus:border-brand-accent text-body-sm font-bold appearance-none cursor-pointer"
                                        >
                                            {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted opacity-40">
                                            <Icon name="chevronDown" className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button onClick={onAddAttack} className="btn-secondary btn-sm w-full gap-2 rounded-xl h-12">
                        <Icon name="plus" className="w-4 h-4" /> <span>Add Attack Pattern</span>
                    </button>
                </div>
            </Accordion>

            <Accordion title="Special Powers" isOpen={openAbilities} onToggle={() => setOpenAbilities(!openAbilities)}>
                <div className="space-y-4 pt-2">
                    {(actor.specialAbilities || []).map((ability, index) => (
                        <div key={index} className="bg-brand-primary/20 p-4 rounded-2xl border border-brand-surface/50 relative shadow-inner animate-fade-in">
                            <button 
                                onClick={() => onRemoveAbility(index)}
                                className="absolute top-3 right-3 text-brand-text-muted hover:text-brand-danger transition-colors p-1"
                            >
                                <Icon name="close" className="w-4 h-4" />
                            </button>
                            
                            <div className="space-y-4 pt-1">
                                <InputField label="Ability Name" value={ability.name} onChange={e => onChange(['specialAbilities', index, 'name'], e.target.value)} />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-brand-text-muted tracking-normal ml-1">Logic</label>
                                        <select 
                                            value={ability.type} 
                                            onChange={e => onChange(['specialAbilities', index, 'type'], e.target.value)}
                                            className="w-full bg-brand-primary h-11 px-3 rounded-xl border border-brand-surface focus:border-brand-accent text-body-sm font-bold"
                                        >
                                            <option value="Damage">Damage</option>
                                            <option value="Status">Status</option>
                                            <option value="Heal">Heal</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-brand-text-muted tracking-normal ml-1">Scope</label>
                                        <select 
                                            value={ability.targetType} 
                                            onChange={e => onChange(['specialAbilities', index, 'targetType'], e.target.value)}
                                            className="w-full bg-brand-primary h-11 px-3 rounded-xl border border-brand-surface focus:border-brand-accent text-body-sm font-bold"
                                        >
                                            <option value="Single">Single</option>
                                            <option value="Multiple">Multiple</option>
                                        </select>
                                    </div>
                                </div>

                                {ability.type === 'Damage' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputField label="Magnitude" value={ability.damageDice || ''} onChange={e => onChange(['specialAbilities', index, 'damageDice'], e.target.value)} placeholder="e.g. 3d6" />
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-brand-text-muted tracking-normal ml-1">Nature</label>
                                            <select 
                                                value={ability.damageType} 
                                                onChange={e => onChange(['specialAbilities', index, 'damageType'], e.target.value)}
                                                className="w-full bg-brand-primary h-11 px-3 rounded-xl border border-brand-surface focus:border-brand-accent text-body-sm font-bold capitalize"
                                            >
                                                {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {ability.type === 'Status' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-brand-text-muted tracking-normal ml-1">Effect</label>
                                            <select 
                                                value={ability.status} 
                                                onChange={e => onChange(['specialAbilities', index, 'status'], e.target.value)}
                                                className="w-full bg-brand-primary h-11 px-3 rounded-xl border border-brand-surface focus:border-brand-accent text-body-sm font-bold"
                                            >
                                                {STATUS_EFFECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <InputField label="Duration (Rnd)" type="number" value={String(ability.duration || 1)} onChange={e => onChange(['specialAbilities', index, 'duration'], parseInt(e.target.value) || 1)} />
                                    </div>
                                )}

                                {ability.type === 'Heal' && (
                                    <InputField label="Recovery Dice" value={ability.healDice || ''} onChange={e => onChange(['specialAbilities', index, 'healDice'], e.target.value)} placeholder="e.g. 2d4+2" />
                                )}

                                {ability.type !== 'Heal' && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-1">
                                            <InputField label="Dc" type="number" value={String(ability.dc)} onChange={e => onChange(['specialAbilities', index, 'dc'], parseInt(e.target.value) || 10)} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black text-brand-text-muted tracking-normal mb-1.5 ml-1">Resisted By</label>
                                            <select 
                                                value={ability.saveAbility} 
                                                onChange={e => onChange(['specialAbilities', index, 'saveAbility'], e.target.value)}
                                                className="w-full bg-brand-primary h-11 px-3 rounded-xl border border-brand-surface focus:border-brand-accent text-body-sm font-bold capitalize"
                                            >
                                                {ABILITY_SCORES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <button onClick={onAddAbility} className="btn-secondary btn-sm w-full gap-2 rounded-xl h-12">
                        <Icon name="plus" className="w-4 h-4" /> <span>Add Specialized Ability</span>
                    </button>
                </div>
            </Accordion>
        </div>
    );
};
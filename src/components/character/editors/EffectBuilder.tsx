import React, { useState, useEffect } from 'react';
import { AbilityEffect, ABILITY_SCORES, AbilityScoreName, STATUS_EFFECT_NAMES, DAMAGE_TYPES, AbilityUsage } from '../../../types';
import { Icon } from '../../Icon';

const InputFieldSlim: React.FC<{label: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type?: string, placeholder?: string, readOnly?: boolean}> = ({ label, value, onChange, type = 'text', placeholder, readOnly }) => (
    <div className="flex flex-col col-span-1">
        <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">{label}</label>
        <input 
            type={type} 
            value={value} 
            onChange={onChange} 
            placeholder={placeholder} 
            readOnly={readOnly}
            className={`w-full input-md text-body-base transition-all ${readOnly ? 'bg-brand-primary/50 text-brand-text-muted cursor-not-allowed select-none' : ''}`}
        />
    </div>
);

const SelectFieldSlim: React.FC<{label: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: readonly string[], allowCustom?: string}> = ({ label, value, onChange, options, allowCustom }) => (
    <div className="flex flex-col col-span-1">
        <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">{label}</label>
        <div className="relative">
             <select value={value} onChange={onChange} className="w-full input-md text-body-base appearance-none transition-all">
                {options.map(opt => <option key={opt} value={opt} className="capitalize">{opt.charAt(0).toUpperCase() + opt.slice(1).toLowerCase()}</option>)}
                {allowCustom && <option value={allowCustom}>{allowCustom}</option>}
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
        </div>
    </div>
);

const formatEffectLabel = (effect: AbilityEffect, standardDC?: number, standardDice?: string) => {
    const target = effect.targetType === 'Multiple' ? 'Mul' : 'Sin';
    
    if (effect.type === 'Damage') {
        const save = effect.saveAbility ? effect.saveAbility.slice(0, 3).charAt(0).toUpperCase() + effect.saveAbility.slice(1, 3) : 'Dex';
        const eff = effect.saveEffect === 'negate' ? 'Neg' : 'Half';
        const dc = standardDC !== undefined ? standardDC : (effect.dc || 10);
        const dice = standardDice !== undefined ? standardDice : (effect.damageDice || '1d6');
        return `${dice} ${effect.damageType} ${target} ${save} ${eff} ${dc}`;
    }
    
    if (effect.type === 'Status') {
        const save = effect.saveAbility ? effect.saveAbility.slice(0, 3).charAt(0).toUpperCase() + effect.saveAbility.slice(1, 3) : 'Con';
        const dc = standardDC !== undefined ? standardDC : (effect.dc || 10);
        return `${effect.status} ${target} ${save} ${dc} ${effect.duration ? `(${effect.duration} rnds)` : ''}`;
    }

    if (effect.type === 'Heal') {
        const dice = standardDice !== undefined ? standardDice : (effect.healDice || '1d8');
        return `${dice} Heal ${target}`;
    }
    
    return `Effect: ${effect.type}`;
};

export const EffectBuilder: React.FC<{
    effect: AbilityEffect;
    onChange: (effect: AbilityEffect) => void;
    onRemove?: () => void;
    standardDC?: number;
    standardDice?: string;
}> = ({ effect, onChange, onRemove, standardDC, standardDice }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        let updates: Partial<AbilityEffect> = {};
        
        if (standardDC !== undefined && effect.dc !== standardDC) {
            updates.dc = standardDC;
        }

        if (standardDice !== undefined) {
            if (effect.type === 'Damage' && effect.damageDice !== standardDice) {
                updates.damageDice = standardDice;
            } else if (effect.type === 'Heal' && effect.healDice !== standardDice) {
                updates.healDice = standardDice;
            }
        }

        // CULPRIT FIX: Ensure saveAbility exists for Damage/Status effects to trigger the system's Save Pivot logic gate.
        // This addresses the issue where single-target traits were initialized without save properties.
        if ((effect.type === 'Damage' || effect.type === 'Status') && !effect.saveAbility) {
            updates.saveAbility = effect.type === 'Damage' ? 'dexterity' : 'constitution';
            if (!effect.saveEffect && effect.type === 'Damage') updates.saveEffect = 'half';
            if (effect.type === 'Status' && !effect.duration) updates.duration = 1;
            if (effect.dc === undefined) updates.dc = standardDC || 10;
        }

        if (Object.keys(updates).length > 0) {
            onChange({ ...effect, ...updates });
        }
    }, [standardDC, standardDice, effect, onChange]);

    const updateEffect = <K extends keyof AbilityEffect>(key: K, value: AbilityEffect[K]) => {
        onChange({ ...effect, [key]: value });
    };

    return (
        <div className="space-y-4 mt-6">
             <label className="block text-body-sm font-bold text-brand-text-muted ml-1">Mechanical effect</label>
             <div className="flex flex-wrap gap-2">
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`flex items-center gap-2 pl-5 pr-3 py-2 rounded-full border text-xs font-bold cursor-pointer transition-all hover:scale-105 bg-brand-bg border-purple-500/50 text-purple-400 ${isExpanded ? 'ring-2 ring-white/20 shadow-lg' : 'shadow-sm'}`}
                >
                    <Icon name="sparkles" className="w-4 h-4" />
                    <span>{formatEffectLabel(effect, standardDC, standardDice)}</span>
                    {onRemove && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemove(); }} 
                            className="hover:bg-brand-danger hover:text-white rounded-full p-1 ml-2 transition-colors"
                        >
                            <Icon name="close" className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="bg-brand-primary/10 p-6 rounded-3xl border border-brand-accent/20 animate-page shadow-inner">
                    <h4 className="text-brand-accent mb-6 flex items-center gap-2 font-bold uppercase tracking-widest text-xs">
                        <Icon name="sparkles" className="w-4 h-4" />
                        Effect configuration
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <label className="text-body-sm font-bold text-brand-text-muted block mb-1.5 ml-1">Type</label>
                            <div className="relative">
                                <select
                                    value={effect.type}
                                    onChange={(e) => {
                                        const newType = e.target.value as AbilityEffect['type'];
                                        const newEffect: AbilityEffect = { type: newType };
                                        if (newType === 'Damage') {
                                            newEffect.dc = standardDC || 10;
                                            newEffect.saveAbility = 'dexterity';
                                            newEffect.saveEffect = 'half';
                                            newEffect.targetType = 'Single';
                                            newEffect.damageDice = standardDice || '1d10';
                                            newEffect.damageType = 'Fire';
                                        } else if (newType === 'Heal') {
                                            newEffect.targetType = 'Single';
                                            newEffect.healDice = standardDice || '1d8';
                                        } else {
                                            newEffect.status = 'Prone';
                                            newEffect.dc = standardDC || 10;
                                            newEffect.saveAbility = 'strength';
                                            newEffect.duration = 1;
                                        }
                                        onChange(newEffect);
                                    }}
                                    className="w-full input-md text-body-base font-bold appearance-none cursor-pointer"
                                >
                                    <option value="Damage">Damage</option>
                                    <option value="Status">Status</option>
                                    <option value="Heal">Heal</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
                            </div>
                        </div>
                    </div>

                    {effect.type === 'Damage' && (
                        <div className="space-y-6 mt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">Dc</label>
                                    {standardDC !== undefined ? (
                                        <div className="w-full bg-brand-primary/50 h-11 rounded-xl border border-brand-accent/30 flex items-center justify-center text-brand-accent font-black text-lg cursor-help" title="Standardized DC: 8 + Prof + Max Stat Mod">
                                            {standardDC}
                                        </div>
                                    ) : (
                                        <input type="number" value={String(effect.dc || '')} onChange={(e) => updateEffect('dc', parseInt(e.target.value) || undefined)} className="w-full input-md text-body-base font-bold" />
                                    )}
                                </div>
                                <SelectFieldSlim label="Save" value={effect.saveAbility || 'dexterity'} onChange={(e) => updateEffect('saveAbility', e.target.value as AbilityScoreName)} options={[...ABILITY_SCORES]} />
                                <SelectFieldSlim label="On save" value={effect.saveEffect || 'half'} onChange={(e) => updateEffect('saveEffect', e.target.value as 'half' | 'negate')} options={['half', 'negate']} />
                                <SelectFieldSlim label="Target" value={effect.targetType || 'Single'} onChange={(e) => updateEffect('targetType', e.target.value as any)} options={['Single', 'Multiple']} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InputFieldSlim 
                                    label="Damage" 
                                    value={standardDice !== undefined ? standardDice : (effect.damageDice || '')} 
                                    placeholder="e.g. 2d6" 
                                    readOnly={standardDice !== undefined}
                                    onChange={(e) => updateEffect('damageDice', e.target.value)} 
                                />
                                <SelectFieldSlim 
                                    label="Type" 
                                    value={effect.damageType || 'Fire'} 
                                    onChange={(e) => updateEffect('damageType', e.target.value)} 
                                    options={[...DAMAGE_TYPES]}
                                    allowCustom={!DAMAGE_TYPES.some(t => t.toLowerCase() === (effect.damageType || '').toLowerCase()) ? effect.damageType : undefined}
                                />
                            </div>
                            {standardDice !== undefined && (
                                <p className="text-body-sm text-brand-accent/70 italic px-1">Values locked to character scaling formula.</p>
                            )}
                        </div>
                    )}
                    
                    {effect.type === 'Status' && (
                        <div className="space-y-6 mt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">Dc</label>
                                    {standardDC !== undefined ? (
                                        <div className="w-full bg-brand-primary/50 h-11 rounded-xl border border-brand-accent/30 flex items-center justify-center text-brand-accent font-black text-lg cursor-help" title="Standardized DC: 8 + Prof + Max Stat Mod">
                                            {standardDC}
                                        </div>
                                    ) : (
                                        <input type="number" value={String(effect.dc || '')} onChange={(e) => updateEffect('dc', parseInt(e.target.value) || undefined)} className="w-full input-md text-body-base font-bold" />
                                    )}
                                </div>
                                <SelectFieldSlim label="Save" value={effect.saveAbility || 'strength'} onChange={(e) => updateEffect('saveAbility', e.target.value as AbilityScoreName)} options={[...ABILITY_SCORES]} />
                                <SelectFieldSlim label="Target" value={effect.targetType || 'Single'} onChange={(e) => updateEffect('targetType', e.target.value as any)} options={['Single', 'Multiple']} />
                                <InputFieldSlim label="Duration" type="number" value={String(effect.duration || '')} onChange={(e) => updateEffect('duration', parseInt(e.target.value) || undefined)} />
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <SelectFieldSlim label="Status effect" value={effect.status || 'Prone'} onChange={(e) => updateEffect('status', e.target.value as any)} options={[...STATUS_EFFECT_NAMES]} />
                            </div>
                            {standardDC !== undefined && (
                                <p className="text-body-sm text-brand-accent/70 italic px-1">Dc locked to character scaling formula.</p>
                            )}
                        </div>
                    )}

                    {effect.type === 'Heal' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <SelectFieldSlim label="Target" value={effect.targetType || 'Single'} onChange={(e) => updateEffect('targetType', e.target.value as any)} options={['Single', 'Multiple']} />
                            <InputFieldSlim 
                                label="Heal amount" 
                                value={standardDice !== undefined ? standardDice : (effect.healDice || '')} 
                                placeholder="e.g. 2d4+2" 
                                readOnly={standardDice !== undefined}
                                onChange={(e) => updateEffect('healDice', e.target.value)} 
                            />
                        </div>
                    )}

                    <div className="flex justify-center mt-8 pt-4 border-t border-brand-surface/30">
                        <button 
                            onClick={() => setIsExpanded(false)}
                            className="btn-primary btn-md w-full max-w-xs"
                        >
                            Commit changes
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
import React from 'react';
import { Icon } from '../../Icon';
import { AbilityEffect, AbilityUsage, ABILITY_SCORES, DAMAGE_TYPES, STATUS_EFFECT_NAMES } from '../../../types';

interface ForgeEffectsProps {
    effectType: 'None' | 'Damage' | 'Status' | 'Heal';
    setEffectType: (val: 'None' | 'Damage' | 'Status' | 'Heal') => void;
    isEditingEffect: boolean;
    setIsEditingEffect: (val: boolean) => void;
    effectConfig: AbilityEffect;
    setEffectConfig: (config: AbilityEffect) => void;
    usageType: AbilityUsage['type'];
    setUsageType: (val: AbilityUsage['type']) => void;
    usageCount: number;
    setUsageCount: (val: number) => void;
    allowedEffectTypes: string[];
    isSingleUse: boolean;
}

const formatEffectLabel = (effect: AbilityEffect, usage: AbilityUsage | undefined, isSingleUse: boolean) => {
    const usageLabel = isSingleUse ? '' : (usage?.type === 'per_short_rest' ? 'Short' 
                        : usage?.type === 'per_long_rest' ? 'Long' 
                        : usage?.type === 'charges' ? 'Chg' : '');
    const uses = isSingleUse ? '' : (usage?.maxUses || 0);
    const usagePart = isSingleUse ? '' : `${usageLabel} ${uses}`;
    const target = effect.targetType === 'Multiple' ? 'Mul' : 'Sin';
    
    if (effect.type === 'Damage') {
        const save = effect.saveAbility ? effect.saveAbility.slice(0, 3).charAt(0).toUpperCase() + effect.saveAbility.slice(1, 3).toLowerCase() : 'Dex';
        const eff = effect.saveEffect === 'half' ? 'Half' : 'Neg';
        const dc = effect.dc || 10;
        return `${effect.damageDice} ${effect.damageType || ''} ${target} ${save} ${eff} ${dc} ${usagePart} `.trim();
    }
    if (effect.type === 'Status') {
        const save = effect.saveAbility ? effect.saveAbility.slice(0, 3).charAt(0).toUpperCase() + effect.saveAbility.slice(1, 3).toLowerCase() : 'Con';
        const dc = effect.dc || 10;
        return `${effect.status} ${target} ${save} ${dc} ${usagePart} `.trim();
    }
    if (effect.type === 'Heal') {
        const healDisplay = effect.healDice?.includes('d') ? effect.healDice : `${effect.healDice} HP`;
        return `${healDisplay} Heal ${target} ${usagePart} `.trim();
    }
    return `Effect: ${effect.type}`;
};

export const ForgeEffects: React.FC<ForgeEffectsProps> = ({
    effectType,
    setEffectType,
    isEditingEffect,
    setIsEditingEffect,
    effectConfig,
    setEffectConfig,
    usageType,
    setUsageType,
    usageCount,
    setUsageCount,
    allowedEffectTypes,
    isSingleUse
}) => {
    const labelClass = "text-body-sm font-bold text-brand-text-muted mb-2 ml-1 block";
    const inputClass = "w-full input-md font-bold";
    const selectClass = "w-full input-md appearance-none cursor-pointer font-bold";

    const renderEffectEditor = () => (
        <div className="bg-brand-primary/10 p-6 rounded-2xl border border-brand-primary/30 space-y-6 animate-fade-in shadow-inner">
            <div>
                <label className={labelClass}>Type</label>
                <div className="relative">
                    <select value={effectType} onChange={e => setEffectType(e.target.value as any)} className={selectClass}>
                        {allowedEffectTypes.length === 0 && <option value="None">None</option>}
                        {allowedEffectTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
                </div>
            </div>
            {effectType !== 'None' && !isSingleUse && (
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-brand-primary/20">
                    <div>
                        <label className={labelClass}>Usage Type</label>
                        <div className="relative">
                            <select value={usageType} onChange={(e) => setUsageType(e.target.value as any)} className={selectClass}>
                                <option value="per_short_rest">Per Short Rest</option>
                                <option value="per_long_rest">Per Long Rest</option>
                                <option value="charges">Charges</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Uses</label>
                        <input type="number" value={usageCount} onChange={(e) => setUsageCount(Math.max(1, parseInt(e.target.value) || 1))} className={inputClass} />
                    </div>
                </div>
            )}
            {effectType === 'Damage' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1"><label className={labelClass}>Dc</label><input type="number" value={effectConfig.dc} onChange={e => setEffectConfig({...effectConfig, dc: parseInt(e.target.value)})} className={inputClass} /></div>
                        <div className="col-span-1">
                            <label className={labelClass}>Save</label>
                            <div className="relative">
                                <select value={effectConfig.saveAbility} onChange={e => setEffectConfig({...effectConfig, saveAbility: e.target.value as any})} className={selectClass + " !px-2 capitalize"}>
                                    {ABILITY_SCORES.map(s => <option key={s} value={s}>{s.slice(0,3)}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="col-span-1"><label className={labelClass}>On Save</label><select value={effectConfig.saveEffect} onChange={e => setEffectConfig({...effectConfig, saveEffect: e.target.value as any})} className={selectClass + " !px-2"}>
                            <option value="half">Half</option>
                            <option value="negate">Neg</option>
                        </select></div>
                        <div className="col-span-1"><label className={labelClass}>Target</label><select value={effectConfig.targetType} onChange={e => setEffectConfig({...effectConfig, targetType: e.target.value as any})} className={selectClass + " !px-2"}>
                            <option value="Single">Sin</option>
                            <option value="Multiple">Mul</option>
                        </select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Damage</label><input type="text" value={effectConfig.damageDice} onChange={e => setEffectConfig({...effectConfig, damageDice: e.target.value})} className={inputClass} /></div>
                        <div>
                            <label className={labelClass}>Type</label>
                            <div className="relative">
                                <select value={effectConfig.damageType} onChange={e => setEffectConfig({...effectConfig, damageType: e.target.value})} className={selectClass + " capitalize"}>
                                    {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {effectType === 'Status' && (
                 <div className="space-y-6">
                    <div className="grid grid-cols-4 gap-4">
                         <div className="col-span-1"><label className={labelClass}>Dc</label><input type="number" value={effectConfig.dc} onChange={e => setEffectConfig({...effectConfig, dc: parseInt(e.target.value)})} className={inputClass}/></div>
                         <div className="col-span-1"><label className={labelClass}>Save</label><select value={effectConfig.saveAbility} onChange={e => setEffectConfig({...effectConfig, saveAbility: e.target.value as any})} className={selectClass + " !px-2 capitalize"}>{ABILITY_SCORES.map(s => <option key={s} value={s}>{s.slice(0,3)}</option>)}</select></div>
                         <div className="col-span-1"><label className={labelClass}>Rnds</label><input type="number" value={effectConfig.duration || 1} onChange={e => setEffectConfig({...effectConfig, duration: parseInt(e.target.value)})} className={inputClass}/></div>
                         <div className="col-span-1"><label className={labelClass}>Target</label><select value={effectConfig.targetType} onChange={e => setEffectConfig({...effectConfig, targetType: e.target.value as any})} className={selectClass + " !px-2"}><option value="Single">Sin</option><option value="Multiple">Mul</option></select></div>
                    </div>
                    <div>
                        <label className={labelClass}>Status Effect</label>
                        <div className="relative">
                            <select value={effectConfig.status} onChange={e => setEffectConfig({...effectConfig, status: e.target.value as any})} className={selectClass}>
                                {STATUS_EFFECT_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
                        </div>
                    </div>
                 </div>
            )}
            {effectType === 'Heal' && (
                <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelClass}>Heal Dice / Hp</label><input type="text" value={effectConfig.healDice} onChange={e => setEffectConfig({...effectConfig, healDice: e.target.value})} className={inputClass} placeholder="e.g. 2d4+2" /></div>
                    <div><label className={labelClass}>Target</label><select value={effectConfig.targetType} onChange={e => setEffectConfig({...effectConfig, targetType: e.target.value as any})} className={selectClass}><option value="Single">Single</option><option value="Multiple">Multiple</option></select></div>
                </div>
            )}
            <div className="flex justify-center pt-4">
                <button onClick={() => setIsEditingEffect(false)} className="btn-tertiary btn-sm">Done Editing</button>
            </div>
        </div>
    );

    return (
        <div className="mb-8">
            <label className="text-body-sm font-bold text-brand-text-muted mb-3 ml-1 block">Mechanical Effects</label>
            {effectType !== 'None' && !isEditingEffect ? (
                <div className="flex items-center">
                    <div onClick={() => setIsEditingEffect(true)} className="flex items-center gap-2 pl-4 pr-1 py-1.5 rounded-full border text-body-sm font-bold bg-brand-bg cursor-pointer hover:scale-105 transition-all shadow-sm border-purple-500 text-purple-400">
                        <span>{formatEffectLabel({ ...effectConfig, type: effectType as any }, { type: usageType, maxUses: usageCount, currentUses: usageCount }, isSingleUse)}</span>
                        <button onClick={(e) => { e.stopPropagation(); setEffectType('None'); }} className="hover:bg-brand-danger hover:text-white rounded-full p-1 ml-1 transition-colors"><Icon name="close" className="w-3 h-3" /></button>
                    </div>
                </div>
            ) : isEditingEffect ? renderEffectEditor() : (
                <button onClick={() => { setEffectType(allowedEffectTypes[0] as any); setIsEditingEffect(true); }} className="btn-tertiary btn-sm !px-2 gap-2"><Icon name="plus" className="w-4 h-4" /> <span>Add Effect</span></button>
            )}
        </div>
    );
};
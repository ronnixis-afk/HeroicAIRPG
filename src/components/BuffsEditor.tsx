// components/BuffsEditor.tsx

import React from 'react';
import { 
    ActiveBuff, 
    ABILITY_SCORES, 
    SKILL_NAMES, 
    DAMAGE_TYPES, 
    SkillName, 
    AbilityScoreName, 
    DamageType 
} from '../types';
import { Icon } from './Icon';

interface BuffsEditorProps {
    activeBuffs: ActiveBuff[];
    onBuffsChange: (newBuffs: ActiveBuff[]) => void;
}

const BUFF_TYPE_OPTIONS = [
    { value: 'ability', label: 'Ability Score' },
    { value: 'skill', label: 'Skill Check' },
    { value: 'attack', label: 'Attack Bonus' },
    { value: 'damage', label: 'Damage Bonus' },
    { value: 'ac', label: 'Armor Class' },
    { value: 'save', label: 'Saving Throw' },
    { value: 'resistance', label: 'Resistance' },
    { value: 'immunity', label: 'Immunity' },
    { value: 'exdam', label: 'Extra Damage' },
    { value: 'temp_hp', label: 'Shield / Temp HP' }
] as const;

export const BuffsEditor: React.FC<BuffsEditorProps> = ({ activeBuffs, onBuffsChange }) => {

    const handleAddBuff = () => {
        const newBuff: ActiveBuff = {
            type: 'ability',
            bonus: 1,
            duration: 10,
            abilityName: 'strength'
        };
        onBuffsChange([...activeBuffs, newBuff]);
    };

    const handleRemoveBuff = (index: number) => {
        onBuffsChange(activeBuffs.filter((_, i) => i !== index));
    };

    const handleUpdateBuff = (index: number, updates: Partial<ActiveBuff>) => {
        const newBuffs = [...activeBuffs];
        const updatedBuff = { ...newBuffs[index], ...updates };

        // Reset subtypes when type changes
        if (updates.type) {
            delete updatedBuff.abilityName;
            delete updatedBuff.skillName;
            delete updatedBuff.damageType;
            delete updatedBuff.damageDice;

            if (updates.type === 'ability' || updates.type === 'save') {
                updatedBuff.abilityName = 'strength';
            } else if (updates.type === 'skill') {
                updatedBuff.skillName = SKILL_NAMES[0];
            } else if (updates.type === 'resistance' || updates.type === 'immunity' || updates.type === 'exdam') {
                updatedBuff.damageType = 'Fire';
            }
        }

        newBuffs[index] = updatedBuff;
        onBuffsChange(newBuffs);
    };

    const renderSubtypeDropdown = (buff: ActiveBuff, index: number) => {
        const selectClass = "w-full bg-brand-primary h-10 px-3 rounded-lg border border-brand-surface focus:border-brand-accent appearance-none text-body-sm font-bold cursor-pointer";

        if (buff.type === 'ability' || buff.type === 'save') {
            return (
                <div className="relative">
                    <select
                        value={buff.abilityName || 'strength'}
                        onChange={(e) => handleUpdateBuff(index, { abilityName: e.target.value as AbilityScoreName })}
                        className={selectClass}
                    >
                        {ABILITY_SCORES.map(score => (
                            <option key={score} value={score} className="capitalize">{score}</option>
                        ))}
                        {buff.type === 'save' && <option value="all">All</option>}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-brand-text-muted opacity-40">
                        <Icon name="chevronDown" className="w-3.5 h-3.5" />
                    </div>
                </div>
            );
        }

        if (buff.type === 'skill') {
            return (
                <div className="relative">
                    <select
                        value={buff.skillName || SKILL_NAMES[0]}
                        onChange={(e) => handleUpdateBuff(index, { skillName: e.target.value as SkillName })}
                        className={selectClass}
                    >
                        {SKILL_NAMES.map(skill => (
                            <option key={skill} value={skill}>{skill}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-brand-text-muted opacity-40">
                        <Icon name="chevronDown" className="w-3.5 h-3.5" />
                    </div>
                </div>
            );
        }

        if (buff.type === 'resistance' || buff.type === 'immunity' || buff.type === 'exdam') {
            return (
                <div className="relative">
                    <select
                        value={buff.damageType || 'Fire'}
                        onChange={(e) => handleUpdateBuff(index, { damageType: e.target.value as DamageType })}
                        className={selectClass}
                    >
                        {DAMAGE_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-brand-text-muted opacity-40">
                        <Icon name="chevronDown" className="w-3.5 h-3.5" />
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full h-10 flex items-center justify-center bg-brand-primary/30 rounded-lg text-body-micro text-brand-text-muted italic border border-brand-surface">
                N/a
            </div>
        );
    };

    return (
        <div className="bg-brand-primary/10 p-4 rounded-2xl space-y-4 border border-brand-primary/30 shadow-inner">
            <div className="space-y-3">
                {/* Column Headers */}
                <div className="grid grid-cols-12 gap-x-3 px-2">
                    <label className="col-span-3 text-[10px] font-black text-brand-text-muted tracking-normal">Type</label>
                    <label className="col-span-4 text-[10px] font-black text-brand-text-muted tracking-normal">Subtype</label>
                    <label className="col-span-2 text-[10px] font-black text-brand-text-muted tracking-normal text-center">Value</label>
                    <label className="col-span-2 text-[10px] font-black text-brand-text-muted tracking-normal text-center">Rounds</label>
                    <div className="col-span-1" />
                </div>

                {/* Buff Rows */}
                {activeBuffs.map((buff, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center bg-brand-surface/40 p-2 rounded-xl border border-brand-primary/50 shadow-sm animate-fade-in">
                        {/* Type Select */}
                        <div className="col-span-3">
                            <div className="relative">
                                <select
                                    value={buff.type}
                                    onChange={(e) => handleUpdateBuff(index, { type: e.target.value as any })}
                                    className="w-full bg-brand-primary h-10 px-2 rounded-lg border border-brand-surface focus:border-brand-accent appearance-none text-[10px] font-bold cursor-pointer"
                                >
                                    {BUFF_TYPE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-brand-text-muted opacity-40">
                                    <Icon name="chevronDown" className="w-3 h-3" />
                                </div>
                            </div>
                        </div>

                        {/* Subtype Select */}
                        <div className="col-span-4">
                            {renderSubtypeDropdown(buff, index)}
                        </div>

                        {/* Value Input */}
                        <div className="col-span-2">
                            <input
                                type="number"
                                value={buff.bonus}
                                onChange={(e) => handleUpdateBuff(index, { bonus: parseInt(e.target.value, 10) || 0 })}
                                className="w-full bg-brand-primary h-10 px-1 rounded-lg border border-brand-surface focus:border-brand-accent text-center text-body-sm font-black tabular-nums shadow-inner"
                            />
                        </div>

                        {/* Rounds Input */}
                        <div className="col-span-2">
                            <input
                                type="number"
                                value={buff.duration}
                                onChange={(e) => handleUpdateBuff(index, { duration: parseInt(e.target.value, 10) || 0 })}
                                className="w-full bg-brand-primary h-10 px-1 rounded-lg border border-brand-surface focus:border-brand-accent text-center text-body-sm font-black tabular-nums shadow-inner"
                            />
                        </div>

                        {/* Delete Button */}
                        <div className="col-span-1 flex justify-end">
                            <button
                                onClick={() => handleRemoveBuff(index)}
                                className="btn-icon-delete p-1.5 rounded-lg shadow-sm"
                                aria-label="Remove active buff"
                            >
                                <Icon name="trash" className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Button */}
            <button
                onClick={handleAddBuff}
                className="btn-secondary btn-sm w-full gap-2 rounded-xl"
            >
                <Icon name="plus" className="w-3.5 h-3.5" /> 
                <span>Add Active Buff</span>
            </button>

            {activeBuffs.length === 0 && (
                <p className="text-center text-body-sm italic text-brand-text-muted py-4 opacity-40">No active buffs.</p>
            )}
        </div>
    );
};

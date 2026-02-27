// components/character/editors/ModifierBuilder.tsx

import React, { useState, useMemo } from 'react';
import { Buff, SkillConfiguration, SKILL_DEFINITIONS, SKILL_NAMES, BuffDuration } from '../../../types';
import { MODIFIER_REGISTRY, ModifierCategory, getBuffTag, getTempHpLabel } from '../../../utils/itemModifiers';
import { Icon } from '../../Icon';
import { NumberStepper } from '../../NumberStepper';

// Map local buff logic to Registry definitions for consistent UI
const MODIFIER_DEFS = {
    ability: MODIFIER_REGISTRY.ability,
    skill: MODIFIER_REGISTRY.skill,
    combat: MODIFIER_REGISTRY.combat,
    defense: MODIFIER_REGISTRY.defense,
    save: MODIFIER_REGISTRY.save,
    resist: MODIFIER_REGISTRY.resist,
    exdam: MODIFIER_REGISTRY.exdam,
    temp_hp: MODIFIER_REGISTRY.temp_hp,
};

interface ModifierItem {
    id: string;
    type: ModifierCategory;
    label: string;
    value: string;
    rawValue: any;
    subOption: string;
    duration: BuffDuration;
    index: number;
    colorClass: string;
}

interface ModifierBuilderProps {
    buffs: Buff[];
    onChange: (newBuffs: Buff[]) => void;
    skillConfig?: SkillConfiguration;
}

export const ModifierBuilder: React.FC<ModifierBuilderProps> = ({ buffs, onChange, skillConfig }) => {
    const [category, setCategory] = useState<ModifierCategory>('ability');
    const [subOption, setSubOption] = useState<string>('strength');
    const [value, setValue] = useState<string>('1');
    const [modDuration, setModDuration] = useState<BuffDuration>('Passive');
    const [editModeIndex, setEditModeIndex] = useState<number | null>(null);

    const thpLabel = getTempHpLabel(skillConfig);

    // Convert Buffs to Display Items matching the standardized compact format
    const modifiers = useMemo(() => {
        const list: ModifierItem[] = [];
        (buffs || []).forEach((buff, i) => {
            const { label, colorClass } = getBuffTag(buff, skillConfig);
            const id = `mod-buff-${i}`;
            
            list.push({ 
                id, 
                type: buff.type as any, 
                label, 
                colorClass,
                value: String(buff.bonus), 
                rawValue: buff.bonus, 
                subOption: buff.skillName || buff.abilityName || 'strength', 
                duration: buff.duration || 'Passive',
                index: i 
            });
        });
        return list;
    }, [buffs, skillConfig]);

    const getFilteredSkills = (): string[] => {
        if (!skillConfig) return SKILL_NAMES;
        return SKILL_NAMES.filter(s => {
            const def = SKILL_DEFINITIONS[s];
            return def.usedIn === 'All' || def.usedIn.includes(skillConfig);
        });
    };

    const setDefaultsForCategory = (cat: ModifierCategory) => {
        setCategory(cat);
        const def = MODIFIER_REGISTRY[cat];
        
        let initialSub = '';
        if (def && def.hasSubOption) {
            if (cat === 'skill' && skillConfig) {
                const filtered = getFilteredSkills();
                initialSub = filtered.length > 0 ? filtered[0] : '';
            } else if (def.subOptions && def.subOptions.length > 0) {
                initialSub = def.subOptions[0];
            }
        }
        
        setSubOption(initialSub);

        if (cat === 'resist') setValue('Resist');
        else if (cat === 'exdam') setValue('1d6');
        else if (cat === 'temp_hp') setValue('5');
        else setValue('1');

        setModDuration('Passive');
    };

    const handleEdit = (mod: ModifierItem) => {
        setEditModeIndex(mod.index);
        setCategory(mod.type);
        setSubOption(mod.subOption);
        setValue(mod.value);
        setModDuration(mod.duration);
    };

    const handleCancelEdit = () => {
        setEditModeIndex(null);
        setDefaultsForCategory('ability');
    };

    const handleDelete = (index: number) => {
        const newBuffs = (buffs || []).filter((_, i) => i !== index);
        onChange(newBuffs);
        if (editModeIndex === index) handleCancelEdit();
    };

    const handleAddOrUpdate = () => {
        const numVal = parseInt(value) || 0;
        
        let newBuff: Buff = { type: 'ac', bonus: numVal }; // default
        
        if (category === 'ability') newBuff = { type: 'ability', bonus: numVal, abilityName: subOption as any };
        else if (category === 'skill') newBuff = { type: 'skill', bonus: numVal, skillName: subOption as any };
        else if (category === 'combat') newBuff = { type: subOption.toLowerCase() as any, bonus: numVal };
        else if (category === 'defense') newBuff = { type: 'ac', bonus: numVal };
        else if (category === 'save') newBuff = { type: 'save', bonus: numVal, abilityName: subOption === 'All' ? undefined : subOption as any };
        else if (category === 'resist') newBuff = { type: value === 'Resist' ? 'resistance' : 'immunity', bonus: 0, damageType: subOption as any };
        else if (category === 'exdam') newBuff = { type: 'exdam', bonus: 0, damageDice: value, damageType: subOption as any };
        else if (category === 'temp_hp') newBuff = { type: 'temp_hp', bonus: numVal };

        const currentBuffs = [...(buffs || [])];
        
        if (editModeIndex !== null) {
            currentBuffs[editModeIndex] = { ...newBuff, duration: modDuration };
            setEditModeIndex(null);
        } else {
            currentBuffs.push({ ...newBuff, duration: modDuration });
        }
        onChange(currentBuffs);
    };

    const renderSubOptionInput = () => {
        const def = MODIFIER_REGISTRY[category];
        if (!def || !def.hasSubOption) {
            return (
                <div className="h-11 w-full bg-brand-primary/30 rounded-xl border border-brand-surface/30 flex items-center justify-center text-brand-text-muted text-[10px] font-bold italic">
                    N/a
                </div>
            );
        }

        const options = (category === 'skill' && skillConfig) 
            ? getFilteredSkills() 
            : (def.subOptions || []);
        
        const selectClass = "w-full input-md text-body-sm font-bold appearance-none capitalize transition-all cursor-pointer";
        return (
            <div className="relative">
                <select value={subOption} onChange={e => setSubOption(e.target.value)} className={selectClass}>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
            </div>
        );
    };

    const renderValueInput = () => {
        if (category === 'resist') {
            return (
                <div className="relative">
                    <select 
                        value={value} 
                        onChange={e => setValue(e.target.value)} 
                        className="w-full input-md text-body-sm font-bold appearance-none transition-all cursor-pointer"
                    >
                        <option value="Resist">Resistance</option>
                        <option value="Immu">Immunity</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
                </div>
            );
        }

        if (category === 'exdam') {
            return (
                <input 
                    type="text" 
                    placeholder="e.g. 1d6"
                    value={value} 
                    onChange={e => setValue(e.target.value)}
                    className="w-full input-md text-body-sm font-black text-center"
                />
            );
        }

        const numVal = parseInt(value) || 0;
        let min = 1, max = 5;
        if (category === 'ability') max = 8;
        if (category === 'skill') { min = 1; max = 10; }
        if (category === 'temp_hp') { min = 5; max = 50; }
        
        return (
            <NumberStepper 
                value={numVal} 
                onChange={(val) => setValue(val.toString())} 
                min={min} 
                max={max} 
            />
        );
    };

    const getSubLabel = () => {
        switch(category) {
            case 'ability': return 'Ability';
            case 'skill': return 'Skill';
            case 'resist': return 'Damage type';
            case 'exdam': return 'Damage type';
            default: return 'Option';
        }
    };

    return (
        <div className="space-y-4">
            <label className="block text-body-sm font-bold text-brand-text-muted ml-1">Passive Buffs</label>
            
            <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
                {modifiers.length > 0 ? (
                    modifiers.map((mod) => (
                        <div 
                            key={mod.id} 
                            onClick={() => handleEdit(mod)}
                            className={`flex items-center gap-1.5 pl-4 pr-1 py-1.5 rounded-full border text-[10px] font-bold cursor-pointer transition-all hover:scale-105 bg-brand-bg ${editModeIndex === mod.index ? 'ring-2 ring-white shadow-lg' : 'shadow-sm'} ${mod.colorClass}`}
                        >
                            <span>{mod.label}</span>
                            {mod.duration === 'Active' && <span className="text-[8px] opacity-60 ml-0.5">(A)</span>}
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(mod.index); }} 
                                className="hover:bg-red-500 hover:text-white rounded-full p-1 ml-1 transition-colors"
                            >
                                <Icon name="close" className="w-3 h-3" />
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="text-[10px] text-brand-text-muted/50 italic w-full text-center py-2">No active buffs.</p>
                )}
            </div>

            <div className={`bg-brand-primary/10 p-5 rounded-2xl border border-brand-primary/30 shadow-inner ${editModeIndex !== null ? 'border-brand-accent/50' : ''}`}>
                <div className="flex flex-col gap-5">
                    {/* Row 1: Identification */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-brand-text-muted mb-1.5 ml-1">Modifier Category</label>
                            <div className="relative">
                                <select 
                                    value={category} 
                                    onChange={e => setDefaultsForCategory(e.target.value as ModifierCategory)}
                                    className="w-full input-md text-[10px] font-black appearance-none transition-all cursor-pointer"
                                >
                                    {Object.values(MODIFIER_DEFS).map(def => (
                                        <option key={def.id} value={def.id}>{def.id === 'temp_hp' ? thpLabel : def.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-brand-text-muted mb-1.5 ml-1 truncate">
                                {getSubLabel()}
                            </label>
                            {renderSubOptionInput()}
                        </div>
                    </div>

                    {/* Row 2: Parameters & Action */}
                    <div className="grid grid-cols-3 gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-brand-text-muted mb-1.5 ml-1">Value</label>
                            <div className="flex justify-center h-11 items-center">
                                {renderValueInput()}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-brand-text-muted mb-1.5 ml-1">Duration</label>
                            <div className="relative">
                                <select
                                    value={modDuration}
                                    onChange={e => setModDuration(e.target.value as BuffDuration)}
                                    className="w-full input-md text-[10px] font-black appearance-none transition-all cursor-pointer"
                                >
                                    <option value="Passive">Passive</option>
                                    <option value="Active">Active</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
                            </div>
                        </div>

                        <div className="flex">
                            <button 
                                onClick={handleAddOrUpdate}
                                className={`w-full h-11 flex items-center justify-center font-bold rounded-xl transition-all shadow-md active:scale-95 text-[10px] ${editModeIndex !== null ? 'bg-brand-surface text-brand-accent border-2 border-brand-accent hover:bg-brand-accent/10' : 'bg-brand-accent text-black hover:opacity-90 shadow-brand-accent/10'}`}
                            >
                                {editModeIndex !== null ? (
                                    <span>Update</span>
                                ) : (
                                    <>
                                        <Icon name="plus" className="w-3.5 h-3.5 mr-1" /> Add
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                {editModeIndex !== null && (
                    <div className="mt-3 text-center">
                        <button onClick={handleCancelEdit} className="text-[10px] font-bold text-brand-text-muted hover:text-brand-text underline transition-colors">Cancel Editing</button>
                    </div>
                )}
            </div>
        </div>
    );
};
// components/inventory/editors/ModifierManager.tsx

import React, { useState, useMemo, useContext } from 'react';
import { Item, SkillConfiguration, BuffDuration } from '../../../types';
import { MODIFIER_REGISTRY, ModifierCategory, applyModifierToItem, getTempHpLabel } from '../../../utils/itemModifiers';
import { Icon } from '../../Icon';
import { NumberStepper } from '../../NumberStepper';
import { GameDataContext, GameDataContextType } from '../../../context/GameDataContext';

interface ModifierItem {
    id: string; 
    type: ModifierCategory;
    label: string;
    value: string;
    subOption: string;
    duration: BuffDuration;
}

export const ModifierManager: React.FC<{ item: Item, onChange: (path: (string | number)[], value: any) => void }> = ({ item, onChange }) => {
    const { gameData } = useContext(GameDataContext) as GameDataContextType;
    const skillConfig = gameData?.skillConfiguration;
    const thpLabel = getTempHpLabel(skillConfig);

    // Builder State
    const [category, setCategory] = useState<ModifierCategory>('enhancement');
    const [subOption, setSubOption] = useState<string>('');
    const [value, setValue] = useState<string>('1');
    const [modDuration, setModDuration] = useState<BuffDuration>('Passive');
    const [editModeId, setEditModeId] = useState<string | null>(null);

    // Extract Modifiers using Registry
    const modifiers = useMemo(() => {
        let list: ModifierItem[] = [];
        
        Object.values(MODIFIER_REGISTRY).forEach(def => {
            const extracted = def.extract(item);
            extracted.forEach(ex => {
                let label = def.label;
                if (def.id === 'enhancement') label = `Enh +${ex.value}`;
                else if (def.id === 'ability') {
                    const short = ex.subOption.slice(0, 3);
                    label = `${short.charAt(0).toUpperCase()}${short.slice(1).toLowerCase()} +${ex.value}`;
                }
                else if (def.id === 'skill') label = `${ex.subOption} +${ex.value}`;
                else if (def.id === 'combat') label = `${ex.subOption} +${ex.value}`;
                else if (def.id === 'defense') label = `Ac +${ex.value}`;
                else if (def.id === 'save') label = `${ex.subOption} Save +${ex.value}`;
                else if (def.id === 'resist') label = `${ex.value} ${ex.subOption}`;
                else if (def.id === 'exdam') label = `Exdam ${ex.subOption} ${ex.value}`;
                else if (def.id === 'temp_hp') label = `${thpLabel} +${ex.value}`;
                
                list.push({
                    id: ex.id,
                    type: def.id,
                    label,
                    value: ex.value,
                    subOption: ex.subOption,
                    duration: ex.duration
                });
            });
        });
        
        return list;
    }, [item, thpLabel]);

    // Helpers to reset builder defaults
    const setDefaultsForCategory = (cat: ModifierCategory) => {
        setCategory(cat);
        const def = MODIFIER_REGISTRY[cat];
        if (def && def.hasSubOption && def.subOptions && def.subOptions.length > 0) {
            setSubOption(def.subOptions[0]);
        } else {
            setSubOption('');
        }

        if (cat === 'resist') setValue('Resist');
        else if (cat === 'exdam') setValue('1d6');
        else if (cat === 'temp_hp') setValue('5');
        else setValue('1');
        
        setModDuration('Passive');
    };

    const handleEdit = (mod: ModifierItem) => {
        setEditModeId(mod.id);
        setCategory(mod.type);
        setSubOption(mod.subOption);
        setValue(mod.value);
        setModDuration(mod.duration);
    };

    const handleCancelEdit = () => {
        setEditModeId(null);
        setDefaultsForCategory('enhancement');
    };

    const handleDelete = (mod: ModifierItem) => {
        if (mod.id.startsWith('mod-buff') || mod.id.startsWith('mod-ab') || mod.id.startsWith('mod-sk') || mod.id.startsWith('mod-com') || mod.id.startsWith('mod-ac') || mod.id.startsWith('mod-sv') || mod.id.startsWith('mod-res') || mod.id.startsWith('mod-thp')) {
            const indexStr = mod.id.split('-').pop();
            const index = indexStr ? parseInt(indexStr) : -1;
            if (index > -1 && item.buffs) {
                 const newBuffs = [...(item.buffs || [])];
                 let foundIndex = -1;
                 
                 if (mod.type === 'ability') foundIndex = newBuffs.findIndex(b => b.type === 'ability' && b.abilityName === mod.subOption && String(b.bonus) === mod.value);
                 else if (mod.type === 'skill') foundIndex = newBuffs.findIndex(b => b.type === 'skill' && b.skillName === mod.subOption && String(b.bonus) === mod.value);
                 else if (mod.type === 'combat') foundIndex = newBuffs.findIndex(b => (b.type === 'attack' || b.type === 'damage') && String(b.bonus) === mod.value && (b.type === 'attack' ? 'Attack' : 'Damage') === mod.subOption);
                 else if (mod.type === 'defense') foundIndex = newBuffs.findIndex(b => b.type === 'ac' && String(b.bonus) === mod.value);
                 else if (mod.type === 'save') foundIndex = newBuffs.findIndex(b => b.type === 'save' && String(b.bonus) === mod.value && (mod.subOption === 'All' ? !b.abilityName : b.abilityName === mod.subOption));
                 else if (mod.type === 'resist') foundIndex = newBuffs.findIndex(b => (b.type === 'resistance' || b.type === 'immunity') && b.damageType === mod.subOption);
                 else if (mod.type === 'temp_hp') foundIndex = newBuffs.findIndex(b => b.type === 'temp_hp' && String(b.bonus) === mod.value);

                 if (foundIndex > -1) {
                     newBuffs.splice(foundIndex, 1);
                     onChange(['buffs'], newBuffs);
                 }
            }
        } 
        else if (mod.type === 'enhancement') {
             if (mod.id === 'mod-enh-wep') onChange(['weaponStats', 'enhancementBonus'], 0);
             if (mod.id === 'mod-enh-arm') onChange(['armorStats', 'plusAC'], 0);
        }
        else if (mod.type === 'exdam' && item.weaponStats) {
             const newDamages = item.weaponStats.damages.filter(d => !(d.dice === mod.value && d.type === mod.subOption));
             if (newDamages.length === 0 && item.weaponStats.damages.length > 0) {
                 // Dont delete base damage
             } else {
                 onChange(['weaponStats', 'damages'], [item.weaponStats.damages[0], ...newDamages]);
             }
        }

        if (editModeId === mod.id) handleCancelEdit();
    };

    const handleAddOrUpdate = () => {
        if (editModeId) {
            const mod = modifiers.find(m => m.id === editModeId);
            if (mod) {
                handleDelete(mod);
            }
            setEditModeId(null);
        }

        setTimeout(() => {
             const freshItem = item.clone(); 
             applyModifierToItem(freshItem, category, value, subOption, modDuration);
             
             if(freshItem.buffs !== item.buffs) onChange(['buffs'], freshItem.buffs);
             if(freshItem.weaponStats !== item.weaponStats) onChange(['weaponStats'], freshItem.weaponStats);
             if(freshItem.armorStats !== item.armorStats) onChange(['armorStats'], freshItem.armorStats);
        }, 50);
    };

    const renderSubOptionInput = () => {
        const def = MODIFIER_REGISTRY[category];
        if (!def || !def.hasSubOption) return <div className="input-md w-full bg-brand-primary/30 border-brand-surface/30 flex items-center justify-center text-brand-text-muted text-[10px] font-bold italic">N/a</div>;
        
        return (
            <div className="relative">
                <select value={subOption} onChange={e => setSubOption(e.target.value)} className="w-full input-md appearance-none cursor-pointer">
                    {def.subOptions?.map(opt => <option key={opt} value={opt} className="capitalize">{opt}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
            </div>
        );
    };

    const renderValueInput = () => {
        if (category === 'resist') return (
            <div className="relative">
                <select 
                    value={value} 
                    onChange={e => setValue(e.target.value)} 
                    className="w-full input-md appearance-none cursor-pointer"
                >
                    <option value="Resist">Resistance</option>
                    <option value="Immu">Immunity</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted"><Icon name="chevronDown" className="w-4 h-4" /></div>
            </div>
        );
        
        if (category === 'exdam') return (
            <input 
                type="text" 
                placeholder="e.g. 1d6" 
                value={value} 
                onChange={e => setValue(e.target.value)} 
                className="w-full input-md text-center font-mono" 
            />
        );
        
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
        const def = MODIFIER_REGISTRY[category];
        if (!def.hasSubOption) return 'Type';
        
        switch(def.subOptionType) {
            case 'ability': return 'Ability';
            case 'skill': return 'Skill';
            case 'saveType': return 'Target';
            case 'damageType': return 'Damage Type';
            case 'combatType': return 'Bonus Type';
            default: return 'Option';
        }
    };

    return (
        <div className="space-y-4">
            <label className="block text-body-sm font-bold text-brand-text-muted ml-1">System Modifiers</label>
            
            <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
                {modifiers.length > 0 ? (
                    modifiers.map((mod) => (
                        <div 
                            key={mod.id} 
                            onClick={() => handleEdit(mod)}
                            className={`flex items-center gap-1.5 pl-4 pr-1 py-1.5 rounded-full border text-[10px] font-bold cursor-pointer transition-all hover:scale-105 bg-brand-bg ${editModeId === mod.id ? 'ring-2 ring-brand-text shadow-lg' : 'shadow-sm'} ${MODIFIER_REGISTRY[mod.type].colorClass}`}
                        >
                            <span>{mod.label}</span>
                            {mod.duration === 'Active' && <span className="text-[8px] opacity-60 ml-0.5">(A)</span>}
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(mod); }} 
                                className="hover:bg-brand-danger hover:text-white rounded-full p-1 ml-1.5 transition-colors"
                            >
                                <Icon name="close" className="w-3 h-3" />
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="text-[10px] text-brand-text-muted/50 italic w-full text-center py-2">No modifiers active.</p>
                )}
            </div>

            <div className={`bg-brand-primary/10 p-5 rounded-2xl border border-brand-primary/30 shadow-inner ${editModeId ? 'border-brand-accent/50' : ''}`}>
                <div className="flex flex-col gap-5">
                    {/* Row 1: Identification */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-brand-text-muted mb-1.5 ml-1">Modifier Category</label>
                            <div className="relative">
                                <select 
                                    value={category} 
                                    onChange={e => setDefaultsForCategory(e.target.value as ModifierCategory)}
                                    className="w-full input-md appearance-none cursor-pointer"
                                >
                                    {Object.values(MODIFIER_REGISTRY).map(def => (
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
                                    className="w-full input-md appearance-none cursor-pointer"
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
                                className={`w-full btn-md flex items-center justify-center transition-all shadow-md active:scale-95 ${editModeId ? 'btn-secondary' : 'btn-primary'}`}
                            >
                                {editModeId ? <span>Update Modifier</span> : <><Icon name="plus" className="w-4 h-4 mr-2" /> Add Modifier</>}
                            </button>
                        </div>
                    </div>
                </div>
                {editModeId && (
                    <div className="mt-4 text-center">
                        <button onClick={handleCancelEdit} className="btn-tertiary btn-sm">Cancel Editing</button>
                    </div>
                )}
            </div>
        </div>
    );
};
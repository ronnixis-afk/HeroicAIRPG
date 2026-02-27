
import React from 'react';
import { Icon } from '../../Icon';
import { ModifierCategory, MODIFIER_REGISTRY } from '../../../utils/itemModifiers';
import { NumberStepper } from '../../NumberStepper';
import { BodySlot, BuffDuration } from '../../../types';
import { isSubOptionAllowedForSlot } from '../../../utils/itemMechanics';

export interface ForgeModifier {
    id: string;
    type: ModifierCategory;
    subOption: string;
    value: string;
    tag: string;
    duration: BuffDuration;
}

interface ForgeModifiersProps {
    selectedModifiers: ForgeModifier[];
    editModeId: string | null;
    modCategory: ModifierCategory;
    modSubOption: string;
    modValue: string;
    modDuration: BuffDuration;
    validationError: string | null;
    activeSlot?: BodySlot;
    onResetBuilderState: (category: ModifierCategory) => void;
    onEditModifier: (mod: ForgeModifier) => void;
    onCancelEdit: () => void;
    onAddModifier: () => void;
    onRemoveModifier: (id: string) => void;
    onSetModSubOption: (val: string) => void;
    onSetModValue: (val: string) => void;
    onSetModDuration: (val: BuffDuration) => void;
    filteredModifierCategories: any[];
}

export const ForgeModifiers: React.FC<ForgeModifiersProps> = ({
    selectedModifiers,
    editModeId,
    modCategory,
    modSubOption,
    modValue,
    modDuration,
    validationError,
    activeSlot,
    onResetBuilderState,
    onEditModifier,
    onCancelEdit,
    onAddModifier,
    onRemoveModifier,
    onSetModSubOption,
    onSetModValue,
    onSetModDuration,
    filteredModifierCategories
}) => {
    const renderSubOptionInput = () => {
        const def = MODIFIER_REGISTRY[modCategory];
        if (!def || !def.hasSubOption) return <div className="input-md w-full bg-brand-primary/30 border-brand-surface/30 flex items-center justify-center text-brand-text-muted text-body-sm font-bold italic">N/a</div>;
        
        const subOptions = def.subOptions || [];
        const filteredOptions = subOptions.filter(opt => isSubOptionAllowedForSlot(modCategory, opt, activeSlot));
        
        return (
            <div className="relative">
                <select 
                    value={modSubOption} 
                    onChange={e => onSetModSubOption(e.target.value)} 
                    className="w-full input-md appearance-none cursor-pointer"
                >
                    {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    )) : <option value="">None</option>}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted">
                    <Icon name="chevronDown" className="w-4 h-4" />
                </div>
            </div>
        );
    };

    const renderValueInput = () => {
        if (modCategory === 'resist') return (
            <div className="relative">
                <select 
                    value={modValue} 
                    onChange={e => onSetModValue(e.target.value)} 
                    className="w-full input-md appearance-none cursor-pointer"
                >
                    <option value="Resist">Resistance</option>
                    <option value="Immu">Immunity</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted">
                    <Icon name="chevronDown" className="w-4 h-4" />
                </div>
            </div>
        );
        
        if (modCategory === 'exdam') return (
            <input 
                type="text" 
                placeholder="e.g. 1d6" 
                value={modValue} 
                onChange={e => onSetModValue(e.target.value)} 
                className="w-full input-md text-center font-black" 
            />
        );
        
        const numVal = parseInt(modValue) || 0;
        let min = 1, max = 5;
        if (modCategory === 'ability') max = 8;
        if (modCategory === 'skill') { min = 1; max = 10; }
        return <NumberStepper value={numVal} onChange={(val) => onSetModValue(val.toString())} min={min} max={max} />;
    };

    const getSubLabel = () => { 
        const def = MODIFIER_REGISTRY[modCategory]; 
        if (!def || !def.hasSubOption) return 'Type'; 
        switch(def.subOptionType) { 
            case 'ability': return 'Ability'; 
            case 'skill': return 'Skill'; 
            case 'saveType': return 'Target'; 
            case 'damageType': return 'Dmg Type'; 
            case 'combatType': return 'Bonus Type'; 
            default: return 'Option'; 
        } 
    };

    return (
        <div className="space-y-4 mb-8">
            <label className="block text-body-sm font-bold text-brand-text-muted ml-1">System Modifiers</label>
            
            <div className="flex flex-wrap gap-2 mb-4 min-h-[32px]">
                {selectedModifiers.length > 0 ? selectedModifiers.map((mod) => (
                    <div 
                        key={mod.id} 
                        onClick={() => onEditModifier(mod)} 
                        className={`flex items-center gap-1.5 pl-4 pr-1 py-1.5 rounded-full border text-body-sm font-bold bg-brand-bg cursor-pointer hover:scale-105 transition-all shadow-sm ${editModeId === mod.id ? 'ring-2 ring-brand-text' : ''} ${MODIFIER_REGISTRY[mod.type].colorClass}`}
                    >
                        <span>{mod.tag}</span>
                        {mod.duration === 'Active' && <span className="text-[8px] opacity-60 ml-0.5">(A)</span>}
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemoveModifier(mod.id); }} 
                            className="hover:bg-brand-danger hover:text-white rounded-full p-1 ml-1 transition-colors"
                        >
                            <Icon name="close" className="w-3 h-3" />
                        </button>
                    </div>
                )) : (
                    <p className="text-body-sm text-brand-text-muted/50 italic w-full text-center py-2">No modifiers added yet.</p>
                )}
            </div>

            <div className={`bg-brand-primary/10 p-5 rounded-2xl border border-brand-primary/30 shadow-inner ${editModeId ? 'border-brand-accent/50' : ''} ${validationError ? 'border-brand-danger/50 bg-brand-danger/5' : ''}`}>
                <div className="flex flex-col gap-5">
                    {/* Row 1: Identification */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-brand-text-muted ml-1">Modifier Category</label>
                            <div className="relative">
                                <select 
                                    value={modCategory} 
                                    onChange={e => onResetBuilderState(e.target.value as ModifierCategory)} 
                                    className="w-full input-md appearance-none cursor-pointer"
                                >
                                    {filteredModifierCategories.map(def => (
                                        <option key={def.id} value={def.id}>{def.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                                    <Icon name="chevronDown" className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-brand-text-muted ml-1 truncate">{getSubLabel()}</label>
                            {renderSubOptionInput()}
                        </div>
                    </div>

                    {/* Row 2: Parameters & Action */}
                    <div className="grid grid-cols-3 gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-brand-text-muted ml-1">Value</label>
                            <div className="flex justify-center h-11 items-center">
                                {renderValueInput()}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-brand-text-muted ml-1">Duration</label>
                            <div className="relative">
                                <select 
                                    value={modDuration} 
                                    onChange={e => onSetModDuration(e.target.value as BuffDuration)} 
                                    className="w-full input-md appearance-none cursor-pointer"
                                >
                                    <option value="Passive">Passive</option>
                                    <option value="Active">Active</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                                    <Icon name="chevronDown" className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex">
                            <button 
                                onClick={onAddModifier} 
                                className={`w-full btn-md transition-all shadow-md active:scale-95 ${editModeId ? 'btn-secondary !text-xs' : 'btn-primary !text-xs'}`}
                            >
                                {editModeId ? <span>Update Modifier</span> : <><Icon name="plus" className="w-4 h-4 mr-2" /> Add Modifier</>}
                            </button>
                        </div>
                    </div>
                </div>

                {editModeId && (
                    <div className="mt-4 text-center">
                        <button onClick={onCancelEdit} className="text-body-sm font-bold text-brand-text-muted hover:text-brand-text underline transition-colors">Cancel Editing</button>
                    </div>
                )}
                {validationError && (
                    <p className="text-center text-body-sm text-brand-danger font-bold animate-pulse mt-4">{validationError}</p>
                )}
            </div>
        </div>
    );
};

import React from 'react';
import { ArmorStats, PlayerCharacter, Companion } from '../../../types';
import { Icon } from '../../Icon';

const InputField: React.FC<{
    label: string, 
    value: string, 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    type?: string,
    placeholder?: string,
}> = ({ label, value, onChange, type = 'text', placeholder }) => (
    <div className="flex-1">
        <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">{label}</label>
        <input 
            type={type} 
            value={value} 
            onChange={onChange}
            placeholder={placeholder}
            className="w-full input-md"
        />
    </div>
);

const SelectField: React.FC<{
    label: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void,
    options: readonly string[] | string[],
}> = ({ label, value, onChange, options }) => (
    <div className="flex-1">
        <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">{label}</label>
        <div className="relative">
             <select 
                value={value} 
                onChange={onChange}
                className="w-full input-md appearance-none cursor-pointer"
             >
                {options.map(opt => (
                    <option key={opt} value={opt} className="capitalize">
                        {opt.charAt(0).toUpperCase() + opt.slice(1).toLowerCase()}
                    </option>
                ))}
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-brand-text-muted">
                <Icon name="chevronDown" className="w-4 h-4" />
            </div>
        </div>
    </div>
);

export const ArmorStatsEditor: React.FC<{
    stats: ArmorStats;
    character: PlayerCharacter | Companion;
    onChange: (path: (string | number)[], value: any) => void;
}> = ({ stats, character, onChange }) => {
    const isShield = stats.armorType === 'shield';

    const handleBaseACChange = (val: string) => {
        let num = parseInt(val) || 0;
        if (isShield) {
            num = Math.min(num, 4); // Max 4 for shields
        }
        onChange(['armorStats', 'baseAC'], num);
    };

    return (
        <div className="bg-brand-primary/10 p-5 rounded-2xl border border-brand-primary/30 mt-4 space-y-6 shadow-inner">
            <h4 className="text-brand-text">
                {isShield ? 'Shield Statistics' : 'Armor Base Stats'}
            </h4>
            <div className="grid grid-cols-2 gap-4">
                <InputField 
                    label={isShield ? "Shield Ac (Max 4)" : "Base Ac"} 
                    type="number" 
                    value={String(stats.baseAC)} 
                    onChange={e => handleBaseACChange(e.target.value)} 
                />
                <InputField label="Magic Bonus (+)" type="number" value={String(stats.plusAC || 0)} onChange={e => onChange(['armorStats', 'plusAC'], parseInt(e.target.value) || 0)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <SelectField label="Type" value={stats.armorType} onChange={e => onChange(['armorStats', 'armorType'], e.target.value as any)} options={['light', 'medium', 'heavy', 'shield']} />
                <InputField label="Str Req." type="number" value={String(stats.strengthRequirement)} onChange={e => onChange(['armorStats', 'strengthRequirement'], parseInt(e.target.value) || 0)} />
            </div>
            {isShield && stats.baseAC > 4 && (
                <p className="text-[10px] text-amber-500 mt-2 font-bold italic px-1">Shield base Ac is capped at 4 by system rules.</p>
            )}
        </div>
    );
};

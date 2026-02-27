import React from 'react';
import { WeaponStats, PlayerCharacter, Companion, DAMAGE_TYPES, DamageSource, ABILITY_SCORES } from '../../../types';
import { Icon } from '../../Icon';

const InputFieldSlim: React.FC<{label: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type?: string, placeholder?: string}> = ({ label, value, onChange, type = 'text', placeholder }) => (
    <div className="flex flex-col col-span-1">
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

const SelectFieldSlim: React.FC<{label: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: readonly string[], allowCustom?: string}> = ({ label, value, onChange, options, allowCustom }) => (
    <div className="flex flex-col col-span-1">
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
                {allowCustom && <option value={allowCustom}>{allowCustom}</option>}
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-brand-text-muted">
                <Icon name="chevronDown" className="w-4 h-4" />
            </div>
        </div>
    </div>
);

export const WeaponStatsEditor: React.FC<{
    stats: WeaponStats;
    character: PlayerCharacter | Companion;
    onChange: (path: (string | number)[], value: any) => void;
}> = ({ stats, character, onChange }) => {
    const { ability, damages, critRange, enhancementBonus } = stats;

    const handleDamageChange = (index: number, field: keyof DamageSource, value: string) => {
        onChange(['weaponStats', 'damages', index, field], value);
    };

    const handleDiceChange = (index: number, part: 'count' | 'die', value: string) => {
        const currentDice = damages[index]?.dice || '1d6';
        const parts = currentDice.split('d');
        const count = part === 'count' ? value : parts[0];
        const die = part === 'die' ? value : parts[1];
        onChange(['weaponStats', 'damages', index, 'dice'], `${count}d${die}`);
    };

    return (
        <div className="bg-brand-primary/10 p-5 rounded-2xl border border-brand-primary/30 mt-4 space-y-6 shadow-inner">
            <h4 className="text-brand-text">Weapon Base Stats</h4>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="col-span-1">
                    <SelectFieldSlim label="Attack Attribute" value={ability} onChange={e => onChange(['weaponStats', 'ability'], e.target.value)} options={ABILITY_SCORES} />
                </div>
                <div className="col-span-1">
                     <InputFieldSlim label="Magic Bonus (+)" type="number" value={String(enhancementBonus || 0)} onChange={e => onChange(['weaponStats', 'enhancementBonus'], parseInt(e.target.value) || 0)} />
                </div>
                <div className="col-span-1">
                     <InputFieldSlim label="Crit Range" type="number" value={String(critRange ?? 20)} onChange={e => onChange(['weaponStats', 'critRange'], parseInt(e.target.value) || 20)} />
                </div>
            </div>

            <div className="border-b border-brand-primary/30"></div>

            <div className="space-y-4">
                <label className="block text-body-sm font-bold text-brand-text-muted ml-1">Base Damage</label>
                {(damages || []).slice(0, 1).map((damage, index) => {
                    const [diceCount, diceType] = (damage.dice || '1d6').split('d');
                    const currentType = damage.type || 'Bludgeoning';
                    const normalizedType = DAMAGE_TYPES.find(t => t.toLowerCase() === currentType.toLowerCase()) || currentType;

                    return (
                        <div key={index} className="grid grid-cols-12 gap-3 items-end">
                             <div className="flex flex-col col-span-5">
                                <div className="flex items-center gap-1 bg-brand-primary border border-brand-surface rounded-xl p-1.5 shadow-inner">
                                    <input 
                                        type="number" 
                                        value={diceCount} 
                                        onChange={(e) => handleDiceChange(index, 'count', e.target.value)} 
                                        className="w-full bg-transparent text-center focus:outline-none text-body-base font-bold"
                                    />
                                    <span className="text-brand-text-muted font-bold">d</span>
                                    <input 
                                        type="number" 
                                        value={diceType} 
                                        onChange={(e) => handleDiceChange(index, 'die', e.target.value)} 
                                        className="w-full bg-transparent text-center focus:outline-none text-body-base font-bold"
                                    />
                                </div>
                            </div>
                             <div className="flex flex-col col-span-7">
                                <div className="relative">
                                    <select 
                                        value={normalizedType} 
                                        onChange={(e) => handleDamageChange(index, 'type', e.target.value)}
                                        className="w-full input-md appearance-none cursor-pointer capitalize"
                                    >
                                        {DAMAGE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                        {!DAMAGE_TYPES.some(t => t.toLowerCase() === currentType.toLowerCase()) && <option value={currentType}>{currentType}</option>}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-brand-text-muted">
                                        <Icon name="chevronDown" className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

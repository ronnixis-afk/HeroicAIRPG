import React from 'react';
import { DAMAGE_TYPES } from '../../../types';
import { NumberStepper } from '../../NumberStepper';

interface ForgeChassisProps {
    showWeaponChassis: boolean;
    showArmorChassis: boolean;
    forgeScale: string;
    isHeavy: boolean;
    setIsHeavy: (val: boolean) => void;
    baseDamageDice: string;
    setBaseDamageDice: (val: string) => void;
    baseDamageType: string;
    setBaseDamageType: (val: string) => void;
    armorType: 'light' | 'medium' | 'heavy' | 'shield';
    setArmorType: (val: 'light' | 'medium' | 'heavy' | 'shield') => void;
    baseAC: number;
    setBaseAC: (val: number) => void;
}

export const ForgeChassis: React.FC<ForgeChassisProps> = ({
    showWeaponChassis,
    showArmorChassis,
    forgeScale,
    isHeavy,
    setIsHeavy,
    baseDamageDice,
    setBaseDamageDice,
    baseDamageType,
    setBaseDamageType,
    armorType,
    setArmorType,
    baseAC,
    setBaseAC
}) => {
    return (
        <div className="bg-brand-surface p-6 rounded-2xl border border-brand-primary shadow-lg mb-6 animate-fade-in">
            <label className="block text-body-sm font-bold text-brand-text-muted mb-4 ml-1">Base Chassis</label>
            
            {showWeaponChassis && (
                <div className="space-y-6">
                    {forgeScale === 'Person' && (
                        <div className="flex items-center justify-between p-4 bg-brand-primary rounded-xl border border-brand-surface shadow-inner">
                            <div className="flex flex-col">
                                <span className="text-body-base font-bold text-brand-text">Heavy Weapon</span>
                                <span className="text-body-sm text-brand-text-muted">Two-handed; occupies both hand slots.</span>
                            </div>
                            <input type="checkbox" checked={isHeavy} onChange={e => setIsHeavy(e.target.checked)} className="custom-checkbox w-5 h-5" />
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Base Damage</label>
                            <input 
                                type="text" 
                                value={baseDamageDice} 
                                onChange={e => setBaseDamageDice(e.target.value)} 
                                className="w-full input-md text-center font-bold" 
                                placeholder="1d8" 
                            />
                        </div>
                        <div>
                            <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Damage Type</label>
                            <div className="relative">
                                <select 
                                    value={baseDamageType} 
                                    onChange={e => setBaseDamageType(e.target.value)} 
                                    className="w-full input-md appearance-none cursor-pointer font-bold"
                                >
                                    {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showArmorChassis && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Armor Type</label>
                            <div className="relative">
                                <select 
                                    value={armorType} 
                                    onChange={e => setArmorType(e.target.value as any)} 
                                    className="w-full input-md appearance-none cursor-pointer font-bold"
                                >
                                    <option value="light">Light</option>
                                    <option value="medium">Medium</option>
                                    <option value="heavy">Heavy</option>
                                    <option value="shield">Shield</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1 text-center">Base Ac</label>
                            <div className="flex justify-center">
                                <NumberStepper value={baseAC} onChange={setBaseAC} min={0} max={20} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
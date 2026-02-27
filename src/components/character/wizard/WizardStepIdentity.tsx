
import React from 'react';
import { Icon } from '../../Icon';
import { NumberStepper } from '../../NumberStepper';
import AutoResizingTextarea from '../../AutoResizingTextarea';

interface WizardStepIdentityProps {
    isCompanion: boolean;
    name: string;
    onNameChange: (val: string) => void;
    gender: string;
    onGenderChange: (val: string) => void;
    level: number;
    onLevelChange: (val: number) => void;
    genderOptions: string[];
    isShip?: boolean;
    customBackground: string;
    onCustomBackgroundChange: (val: string) => void;
}

const StyledSelect: React.FC<{
    label: string,
    value: string,
    onChange: (val: string) => void,
    options: string[],
    disabled?: boolean
}> = ({ label, value, onChange, options, disabled }) => (
    <div className="w-full">
        {label && <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">{label}</label>}
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-full bg-brand-primary h-11 px-5 pr-10 rounded-full text-sm font-semibold text-brand-text border border-brand-surface focus:border-brand-accent focus:outline-none appearance-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                <Icon name="chevronDown" className="w-4 h-4" />
            </div>
        </div>
    </div>
);

export const WizardStepIdentity: React.FC<WizardStepIdentityProps> = ({
    isCompanion,
    name,
    onNameChange,
    gender,
    onGenderChange,
    level,
    onLevelChange,
    genderOptions,
    isShip,
    customBackground,
    onCustomBackgroundChange
}) => {
    return (
        <div className="space-y-10 max-w-2xl mx-auto pb-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-brand-text">
                    {isShip ? "Commission Your Vessel" : (isCompanion ? "Enlist Your Ally" : "Finalize Your Legacy")}
                </h2>
                <p className="text-sm text-brand-text-muted italic">
                    {isShip ? "Give your new craft a name to be feared or respected." : (isCompanion ? "Give your new companion a name to be remembered." : "By what name shall the world know you?")}
                </p>
            </div>

            <div className="space-y-10">
                <div className="w-full text-center">
                    <input 
                        value={name} 
                        onChange={e => onNameChange(e.target.value)}
                        className="w-full bg-transparent border-b border-brand-primary hover:border-brand-secondary focus:border-brand-accent px-0 py-4 text-center text-3xl font-bold text-brand-text focus:outline-none transition-all"
                        placeholder={isShip ? "Enter vessel name" : (isCompanion ? "Enter companion name" : "Enter hero name")}
                        autoFocus
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 pt-4 items-center border-t border-brand-surface/30">
                    <div className="flex flex-col">
                        <label className="text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">Gender</label>
                        <StyledSelect 
                            label="" 
                            value={isShip ? 'Unspecified' : gender} 
                            onChange={onGenderChange} 
                            options={genderOptions} 
                            disabled={isShip} 
                        />
                    </div>
                    <div className="flex flex-col items-start ml-auto">
                        <label className="text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">
                            {isCompanion ? "Sync Level" : "Starting Level"}
                        </label>
                        <div className="h-11 flex items-center justify-center">
                            <NumberStepper value={level} onChange={onLevelChange} min={1} max={20} />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-brand-surface/30">
                    <label className="block text-body-sm font-bold text-brand-text-muted mb-3 ml-1">
                        {isShip ? "Technical Details & Function" : "Background Context & Personal History"}
                    </label>
                    <AutoResizingTextarea 
                        value={customBackground} 
                        onChange={e => onCustomBackgroundChange(e.target.value)} 
                        placeholder={isShip ? "Describe the vessel's construction, purpose, or unique quirks..." : "Describe your character's life before this moment, their family, or defining events..."} 
                        className="w-full bg-brand-primary p-5 rounded-2xl border border-brand-surface focus:border-brand-accent focus:ring-1 focus:ring-brand-accent focus:outline-none text-body-base text-brand-text leading-relaxed shadow-inner transition-all min-h-[120px]" 
                    />
                    <p className="text-[10px] text-brand-text-muted mt-3 italic px-1 opacity-70">
                        The architect will weave this context into your generated background and appearance.
                    </p>
                </div>
            </div>
        </div>
    );
};

import React from 'react';
import { Icon } from '../../Icon';

export const SelectField: React.FC<{
    label: string,
    value: string,
    onChange: (val: string) => void,
    options: { id: string, label: string }[] | string[],
    placeholder?: string,
    className?: string
}> = ({ label, value, onChange, options, placeholder, className }) => (
    <div className={`w-full ${className || ''}`}>
        {label && <label className="text-body-sm font-bold text-brand-text-muted mb-2 ml-1 block">{label}</label>}
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full input-md appearance-none cursor-pointer font-bold"
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map(opt => {
                    const id = typeof opt === 'string' ? opt : opt.id;
                    const label = typeof opt === 'string' ? opt : opt.label;
                    return <option key={id} value={id}>{label}</option>;
                })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                <Icon name="chevronDown" className="w-4 h-4" />
            </div>
        </div>
    </div>
);
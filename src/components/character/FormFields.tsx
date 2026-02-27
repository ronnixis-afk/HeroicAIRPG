import React from 'react';
import { Icon } from '../Icon';
import AutoResizingTextarea from '../AutoResizingTextarea';

interface InputFieldProps {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    placeholder?: string;
    className?: string;
}

export const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, type = 'text', placeholder, className }) => (
    <div className={className}>
        <label htmlFor={label} className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">{label}</label>
        <input
            type={type}
            id={label}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full input-md"
        />
    </div>
);

interface SelectFieldProps {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
    className?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({ label, value, onChange, options, className }) => (
    <div className={className}>
        <label htmlFor={label} className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">{label}</label>
        <div className="relative">
            <select
                id={label}
                value={value}
                onChange={onChange}
                className="w-full input-md appearance-none cursor-pointer"
            >
                {options.map(option => (
                    <option key={option} value={option} className="capitalize">{option}</option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted">
                <Icon name="chevronDown" className="w-4 h-4" />
            </div>
        </div>
    </div>
);

interface TextareaFieldProps {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
}

export const TextareaField: React.FC<TextareaFieldProps> = ({ label, value, onChange, placeholder }) => (
     <div>
        <label htmlFor={label} className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">{label}</label>
        <AutoResizingTextarea
            id={label}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-brand-primary p-4 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent min-h-[44px] text-body-base text-brand-text leading-relaxed shadow-inner"
        />
    </div>
);

interface CheckboxFieldProps {
    label: string;
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CheckboxField: React.FC<CheckboxFieldProps> = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-center input-md cursor-pointer hover:border-brand-accent/30 w-full group" onClick={() => onChange({ target: { checked: !checked } } as any)}>
        <input type="checkbox" checked={checked} onChange={onChange} className="custom-checkbox" />
        <span className="ml-3 text-body-base text-brand-text-muted font-bold group-hover:text-brand-text transition-colors select-none">{label}</span>
    </div>
);
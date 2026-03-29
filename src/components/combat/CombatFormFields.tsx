import React from 'react';
import { Icon } from '../Icon';

export const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, className, ...props }) => (
    <div className={className}>
        <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">{label}</label>
        <input 
            {...props} 
            className="w-full bg-brand-primary h-11 px-4 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base text-brand-text transition-all shadow-inner" 
        />
    </div>
);

export const CheckboxField: React.FC<{ label: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, checked, onChange }) => (
    <div 
        className={`flex items-center justify-center h-14 px-4 rounded-2xl border transition-all w-full group shadow-md cursor-pointer select-none ${
            checked 
                ? 'bg-brand-primary/40 border-brand-accent text-brand-accent' 
                : 'bg-brand-primary/40 border-brand-surface text-brand-text-muted hover:border-brand-primary'
        }`}
        onClick={() => onChange({ target: { checked: !checked } } as any)}
    >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            checked ? 'bg-brand-accent border-brand-accent' : 'border-brand-text-muted/30 bg-transparent'
        }`}>
            {checked && <Icon name="check" className="w-3.5 h-3.5 text-black" />}
        </div>
        <span className={`ml-3 text-body-base font-bold transition-colors ${checked ? 'text-brand-text' : 'text-brand-text-muted group-hover:text-brand-text'}`}>
            {label}
        </span>
    </div>
);

export const ModalTabButton: React.FC<{label: string, isActive: boolean, onClick: () => void}> = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-bold transition-colors duration-200 focus:outline-none relative ${
          isActive ? 'text-brand-accent' : 'text-brand-text-muted hover:text-brand-text'
      }`}
    >
      {label}
      {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-accent"></div>}
    </button>
);

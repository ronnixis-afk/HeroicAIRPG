import React from 'react';
import { Icon } from './Icon';

interface NumberStepperProps {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({ value, onChange, min = 0, max = 99 }) => (
    <div className="flex items-center gap-3">
        <button 
            onClick={() => onChange(Math.max(min, value - 1))}
            className="btn-secondary w-8 h-8 !p-0 flex items-center justify-center rounded-full"
            aria-label="Decrease value"
        >
            <Icon name="minus" className="w-3.5 h-3.5" />
        </button>
        <div className="text-body-lg font-bold tabular-nums text-brand-text min-w-[1.5rem] text-center">
            {value}
        </div>
        <button 
            onClick={() => onChange(Math.min(max, value + 1))}
            className="btn-secondary w-8 h-8 !p-0 flex items-center justify-center rounded-full"
            aria-label="Increase value"
        >
            <Icon name="plus" className="w-3.5 h-3.5" />
        </button>
    </div>
);
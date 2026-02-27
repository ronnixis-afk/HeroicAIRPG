import React from 'react';

interface WizardProgressProps {
    steps: string[];
    currentStep: number;
}

export const WizardProgress: React.FC<WizardProgressProps> = ({ steps, currentStep }) => {
    return (
        <div className="flex justify-between items-center mb-10 px-2 gap-1 flex-shrink-0">
            {steps.map((_, i) => (
                <div key={i} className="flex-1">
                    <div 
                        className={`h-1 w-full rounded-full transition-all duration-500 ${
                            currentStep > i 
                                ? 'bg-brand-accent shadow-[0_0_8px_#3ecf8e]' 
                                : 'bg-brand-primary'
                        }`} 
                    />
                </div>
            ))}
        </div>
    );
};
import React from 'react';
import { Icon } from '../../Icon';

interface WizardNavigationProps {
    onBack: () => void;
    onNext: () => void;
    nextLabel: string;
    isNextDisabled: boolean;
    showBack: boolean;
}

export const WizardNavigation: React.FC<WizardNavigationProps> = ({ onBack, onNext, nextLabel, isNextDisabled, showBack }) => {
    return (
        <div className="pt-8 flex items-center justify-center gap-4 flex-shrink-0 bg-brand-bg">
            <button onClick={onBack} className={`btn-secondary btn-md rounded-full px-8 ${!showBack ? 'invisible' : ''}`}>
                Back
            </button>
            <button 
                onClick={onNext}
                disabled={isNextDisabled}
                className="btn-primary btn-md flex-1 rounded-full shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-3"
            >
                {nextLabel}
                {nextLabel === 'Next step' ? <Icon name="chevronDown" className="w-4 h-4 -rotate-90" /> : <Icon name="play" className="w-4 h-4" />}
            </button>
        </div>
    );
};
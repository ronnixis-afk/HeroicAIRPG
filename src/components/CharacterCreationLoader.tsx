
import React from 'react';

interface CharacterCreationLoaderProps {
    title?: string;
    step: string;
    progress: number;
    onCancel?: () => void;
}

const CharacterCreationLoader: React.FC<CharacterCreationLoaderProps> = ({ title = "Processing...", step, progress, onCancel }) => {
    return (
        <div className="flex flex-col items-center justify-center w-full bg-transparent p-0">
            <h3 className="text-brand-accent mb-4">{title}</h3>
            <div className="w-full bg-brand-primary rounded-full h-2 mb-3 overflow-hidden border border-brand-surface shadow-inner">
                <div 
                    className="bg-brand-accent h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(62,207,142,0.4)]" 
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                />
            </div>
            <p className="text-body-sm text-brand-text-muted text-center h-10 transition-opacity duration-300 italic font-medium">{step}</p>
            {onCancel && (
                <button 
                    onClick={onCancel}
                    className="mt-4 text-xs font-bold text-brand-text-muted hover:text-brand-danger transition-colors border border-brand-primary/30 px-3 py-1.5 rounded-lg hover:border-brand-danger/30"
                >
                    Cancel Generation
                </button>
            )}
        </div>
    );
};

export default CharacterCreationLoader;

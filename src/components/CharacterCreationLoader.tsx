
import React from 'react';

interface CharacterCreationLoaderProps {
    title?: string;
    step: string;
    progress: number;
}

const CharacterCreationLoader: React.FC<CharacterCreationLoaderProps> = ({ title = "Processing...", step, progress }) => {
    return (
        <div className="flex flex-col items-center justify-center p-6 bg-brand-surface rounded-2xl w-full border border-brand-primary shadow-inner">
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
        </div>
    );
};

export default CharacterCreationLoader;

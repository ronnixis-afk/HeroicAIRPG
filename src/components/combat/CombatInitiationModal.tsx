import React from 'react';
import CharacterCreationLoader from '../CharacterCreationLoader';

interface CombatInitiationModalProps {
  isOpen: boolean;
  step: string;
  progress: number;
  narrative: string;
}

const CombatInitiationModal: React.FC<CombatInitiationModalProps> = ({ isOpen, step, progress, narrative }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150] p-4 text-center transition-opacity duration-300 backdrop-blur-sm">
        <div className="w-full max-w-sm">
            {narrative && (
                <div className="mb-6 p-5 bg-brand-primary/20 rounded-2xl border border-brand-primary/30 max-h-48 overflow-y-auto custom-scroll shadow-inner">
                    <p className="text-body-sm text-brand-text-muted italic text-center whitespace-pre-wrap leading-relaxed">
                        {narrative}
                    </p>
                </div>
            )}
            <div className="bg-brand-surface p-8 rounded-3xl border border-brand-primary/50 shadow-2xl">
                <CharacterCreationLoader 
                  title="Combat Initiating" 
                  step={step} 
                  progress={progress} 
                />
            </div>
        </div>
    </div>
  );
};

export default CombatInitiationModal;
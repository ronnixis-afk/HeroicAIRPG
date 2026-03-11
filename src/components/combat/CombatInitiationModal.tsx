import React from 'react';
import CharacterCreationLoader from '../CharacterCreationLoader';

interface CombatInitiationModalProps {
  isOpen: boolean;
  step: string;
  progress: number;
}

const CombatInitiationModal: React.FC<CombatInitiationModalProps> = ({ isOpen, step, progress }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150] p-4 text-center transition-opacity duration-300 backdrop-blur-sm">
        <div className="w-full max-w-sm">
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
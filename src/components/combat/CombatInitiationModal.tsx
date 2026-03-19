import React from 'react';
import CharacterCreationLoader from '../CharacterCreationLoader';
import Modal from '../Modal';

interface CombatInitiationModalProps {
  isOpen: boolean;
  step: string;
  progress: number;
}

const CombatInitiationModal: React.FC<CombatInitiationModalProps> = ({ 
  isOpen, 
  step, 
  progress 
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Non-closable by user as it is a transition state
      hideHeader
      maxWidth="sm"
    >
      <div className="py-8">
        <CharacterCreationLoader 
          title="Combat Initiating" 
          step={step} 
          progress={progress} 
        />
      </div>
    </Modal>
  );
};

export default CombatInitiationModal;

import React from 'react';
import { Icon } from './Icon';
import Modal from './Modal';

interface ActionSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: string[];
  isLoading: boolean;
  onSelectAction: (action: string) => void;
}

const ActionSuggestionsModal: React.FC<ActionSuggestionsModalProps> = ({ 
  isOpen, 
  onClose, 
  suggestions, 
  isLoading, 
  onSelectAction 
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Suggested Actions"
      maxWidth="md"
      footer={
        <p className="text-[10px] text-brand-text-muted text-center italic">
          Suggestions based on recent chat history, tracked objectives, and local knowledge.
        </p>
      }
    >
      <div className="flex flex-col items-center justify-center min-h-[180px]">
        {isLoading ? (
          <div className="flex flex-col items-center space-y-6 animate-pulse">
            <div className="relative">
              <Icon name="spinner" className="w-12 h-12 text-brand-accent animate-spin" />
              <Icon name="sparkles" className="w-5 h-5 text-brand-accent absolute -top-1 -right-1 animate-bounce" />
            </div>
            <p className="text-sm text-brand-text-muted font-medium">Analyzing situation...</p>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {suggestions.length > 0 ? (
              suggestions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => onSelectAction(action)}
                  className="w-full text-left bg-white/5 hover:bg-brand-accent/10 border border-white/5 hover:border-brand-accent/30 p-4 rounded-2xl transition-all group relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-sm font-medium text-brand-text group-hover:text-white leading-relaxed">
                    {action}
                  </span>
                </button>
              ))
            ) : (
              <div className="text-center py-8">
                <Icon name="info" className="w-8 h-8 text-brand-text-muted/30 mx-auto mb-3" />
                <p className="text-sm text-brand-text-muted italic">No actions could be suggested at this time.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ActionSuggestionsModal;


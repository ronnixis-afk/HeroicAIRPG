
import React from 'react';
import { Icon } from './Icon';

interface ActionSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: string[];
  isLoading: boolean;
  onSelectAction: (action: string) => void;
}

const ActionSuggestionsModal: React.FC<ActionSuggestionsModalProps> = ({ isOpen, onClose, suggestions, isLoading, onSelectAction }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-brand-surface rounded-xl shadow-2xl w-full max-w-md border border-brand-primary flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-brand-primary/50">
          <h2 className="text-lg font-bold text-brand-text flex items-center gap-2">
            <Icon name="sparkles" className="w-5 h-5 text-brand-accent" />
            Suggested Actions
          </h2>
          <button onClick={onClose} className="text-brand-text-muted hover:text-brand-text p-1">
            <Icon name="close" className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            {isLoading ? (
                <div className="flex flex-col items-center space-y-4">
                    <Icon name="spinner" className="w-10 h-10 text-brand-accent animate-spin" />
                    <p className="text-sm text-brand-text-muted animate-pulse">Analyzing situation...</p>
                </div>
            ) : (
                <div className="w-full space-y-3">
                    {suggestions.length > 0 ? (
                        suggestions.map((action, index) => (
                            <button
                                key={index}
                                onClick={() => onSelectAction(action)}
                                className="w-full text-left bg-brand-primary hover:bg-brand-secondary border border-brand-surface hover:border-brand-accent/50 p-4 rounded-lg transition-all group relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-sm font-medium text-brand-text group-hover:text-white">{action}</span>
                            </button>
                        ))
                    ) : (
                        <p className="text-center text-brand-text-muted italic">No actions could be suggested.</p>
                    )}
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-brand-primary/50 bg-brand-bg/30 rounded-b-xl text-center">
            <p className="text-[10px] text-brand-text-muted">
                Suggestions based on recent chat history, tracked objectives, and local knowledge.
            </p>
        </div>

      </div>
    </div>
  );
};

export default ActionSuggestionsModal;

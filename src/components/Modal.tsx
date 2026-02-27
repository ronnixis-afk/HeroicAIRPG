// components/Modal.tsx

import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 animate-fade-in" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="bg-brand-surface rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] border border-brand-primary animate-modal overflow-hidden"
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {/* Fixed Header */}
        <div className="flex justify-between items-center p-6 pb-2 flex-shrink-0">
          <h3 id="modal-title" className="text-brand-text truncate pr-4 mb-0">{title}</h3>
          <button 
            onClick={onClose} 
            className="btn-icon text-brand-text-muted hover:text-brand-text hover:bg-brand-primary/40 transition-all"
            aria-label="Close modal"
          >
            <Icon name="close" className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scroll px-6 pb-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
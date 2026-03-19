// components/Modal.tsx

import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  hideHeader?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  hideHeader, 
  children, 
  footer,
  maxWidth = 'lg' 
}) => {
  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-[95vw]',
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`bg-brand-surface border border-white/10 rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] w-full ${maxWidthClasses[maxWidth]} flex flex-col max-h-[90vh] animate-modal overflow-hidden relative glass-effect`}
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="absolute inset-0 bg-gradient-to-b from-brand-accent/5 to-transparent pointer-events-none" />

        {/* Fixed Header */}
        {!hideHeader && (
          <div className="flex justify-between items-center p-6 pb-2 flex-shrink-0 relative z-10">
            <h3 id="modal-title" className="text-brand-text truncate pr-4 mb-0">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="btn-icon text-brand-text-muted hover:text-brand-text hover:bg-white/5 transition-all p-2 rounded-full"
              aria-label="Close modal"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
        )}

        {hideHeader && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 btn-icon text-brand-text-muted hover:text-brand-text bg-brand-surface/40 hover:bg-white/5 backdrop-blur-md transition-all rounded-full p-2"
            aria-label="Close modal"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        )}

        {/* Scrollable Body */}
        <div className={`flex-1 overflow-y-auto custom-scroll relative z-10 ${hideHeader ? 'px-6 pb-6 pt-14' : 'px-6 pb-6 pt-4'}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 pt-2 flex-shrink-0 relative z-10 bg-brand-bg/20 backdrop-blur-sm border-t border-white/5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;

import React, { useState, ReactNode } from 'react';
import { Icon } from './Icon';

interface AccordionProps {
  title: ReactNode;
  children: ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}

const Accordion: React.FC<AccordionProps> = ({ title, children, isOpen, onToggle }) => {
  const isControlled = isOpen !== undefined && onToggle !== undefined;
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const open = isControlled ? isOpen : internalIsOpen;
  
  const handleToggle = () => {
    if (isControlled) {
      onToggle();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  return (
    <div className="mb-3 border-b border-brand-surface last:border-0">
      <button
        onClick={handleToggle}
        className="w-full flex justify-between items-center p-4 text-left text-brand-text focus:outline-none hover:bg-brand-primary/10 transition-colors rounded-xl"
      >
        <span className="text-body-lg font-bold">{title}</span>
        <span className={`transform transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <Icon name="chevronDown" />
        </span>
      </button>
      <div 
        className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
            <div className="p-4 pt-0 text-brand-text-muted">
                {children}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Accordion;
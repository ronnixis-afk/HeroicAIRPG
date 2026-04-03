import React from 'react';
import Modal from '../../Modal';
import { DAMAGE_TYPES, STATUS_EFFECT_NAMES } from '../../../types/Core';

interface WizardEffectSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'Damage' | 'Status';
    onSelect: (value: string) => void;
}

/**
 * A specialized modal for choosing the specific flavor of a combat ability (Damage Type or Status Effect).
 * Uses a mobile-first responsive grid (1 column on mobile, 3 columns on larger screens).
 */
export const WizardEffectSelectorModal: React.FC<WizardEffectSelectorModalProps> = ({ 
    isOpen, 
    onClose, 
    type, 
    onSelect 
}) => {
    // Both constants from Core.ts are already Title Cased
    const options = type === 'Damage' ? [...DAMAGE_TYPES] : [...STATUS_EFFECT_NAMES].filter(s => !['Invisible', 'Hidden', 'Disappeared'].includes(s as string));
    const title = type === 'Damage' ? 'Choose Your Damage Type' : 'Choose Your Status Effect';

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={title}
            maxWidth="xl"
        >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {options.map(option => (
                    <button
                        key={option}
                        onClick={() => {
                            onSelect(option);
                            onClose();
                        }}
                        className="p-5 rounded-2xl border border-brand-primary bg-brand-primary/20 hover:border-brand-accent hover:bg-brand-accent/5 transition-all text-xs font-bold text-brand-text flex items-center justify-center text-center shadow-lg active:scale-95 group"
                    >
                        <span className="group-hover:text-brand-accent transition-colors">
                            {option}
                        </span>
                    </button>
                ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/5 text-center px-4 pb-4">
                <p className="text-[10px] text-brand-text-muted italic opacity-60 leading-relaxed">
                    This selection will define the thematic essence of your starting prowess.
                </p>
            </div>
        </Modal>
    );
};

import React, { useState } from 'react';
import { Icon } from '../../Icon';

interface WizardMethodSelectionProps {
    onSelect: (method: 'manual' | 'recruitment' | 'shipyard') => void;
}

export const WizardMethodSelection: React.FC<WizardMethodSelectionProps> = ({ onSelect }) => {
    const [view, setView] = useState<'root' | 'ally'>('root');

    if (view === 'ally') {
        return (
            <div className="flex-1 flex flex-col items-center justify-start py-8 space-y-10 animate-fade-in overflow-y-auto custom-scroll px-1">
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-brand-text">Enlist an Ally</h2>
                    <p className="text-sm text-brand-text-muted italic px-4">Choose how you wish to welcome a new companion to the party.</p>
                </div>
                
                <div className="grid grid-cols-1 gap-4 w-full max-w-md">
                    <button 
                        onClick={() => onSelect('recruitment')}
                        className="group relative flex flex-row items-center p-6 bg-brand-primary/10 border-2 border-brand-primary rounded-3xl transition-all hover:border-brand-accent hover:bg-brand-accent/5"
                    >
                        <div className="w-14 h-14 rounded-full bg-brand-accent flex items-center justify-center mr-6 shadow-lg shadow-brand-accent/20 group-hover:scale-110 transition-transform flex-shrink-0">
                            <Icon name="users" className="w-8 h-8 text-black" />
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-brand-text group-hover:text-brand-accent">Recruit from Tavern</h3>
                            <p className="text-[10px] text-brand-text-muted mt-1 leading-relaxed">Choose from pre-generated candidates with quirky backgrounds.</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => onSelect('manual')}
                        className="group relative flex flex-row items-center p-6 bg-brand-primary/10 border-2 border-brand-primary rounded-3xl transition-all hover:border-brand-accent hover:bg-brand-accent/5"
                    >
                        <div className="w-14 h-14 rounded-full bg-brand-primary flex items-center justify-center mr-6 shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                            <Icon name="hammer" className="w-8 h-8 text-brand-text" />
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-brand-text group-hover:text-brand-accent">Forge Custom Hero</h3>
                            <p className="text-[10px] text-brand-text-muted mt-1 leading-relaxed">Manually select every trait for a specific ally.</p>
                        </div>
                    </button>
                </div>

                <button 
                    onClick={() => setView('root')}
                    className="btn-tertiary btn-sm mt-4 opacity-60 hover:opacity-100"
                >
                    Back to Selection
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-start py-8 space-y-10 animate-fade-in overflow-y-auto custom-scroll px-1">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-brand-text">Welcome a Companion</h2>
                <p className="text-sm text-brand-text-muted italic px-4">Begin the process of expanding your party's capabilities.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4 w-full max-w-md">
                <button 
                    onClick={() => setView('ally')}
                    className="group relative flex flex-row items-center p-6 bg-brand-primary/10 border-2 border-brand-primary rounded-3xl transition-all hover:border-brand-accent hover:bg-brand-accent/5"
                >
                    <div className="w-14 h-14 rounded-full bg-brand-accent flex items-center justify-center mr-6 shadow-lg shadow-brand-accent/20 group-hover:scale-110 transition-transform flex-shrink-0">
                        <Icon name="character" className="w-8 h-8 text-black" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-bold text-brand-text group-hover:text-brand-accent">Enlist an Ally</h3>
                        <p className="text-[10px] text-brand-text-muted mt-1 leading-relaxed">Bring a living companion or sentient hireling into your group.</p>
                    </div>
                </button>

                <button 
                    onClick={() => onSelect('shipyard')}
                    className="group relative flex flex-row items-center p-6 bg-brand-primary/10 border-2 border-brand-primary rounded-3xl transition-all hover:border-brand-accent hover:bg-brand-accent/5"
                >
                    <div className="w-14 h-14 rounded-full bg-brand-accent flex items-center justify-center mr-6 shadow-lg shadow-brand-accent/20 group-hover:scale-110 transition-transform flex-shrink-0">
                        <Icon name="world" className="w-8 h-8 text-black" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-bold text-brand-text group-hover:text-brand-accent">Commission a Vessel</h3>
                        <p className="text-[10px] text-brand-text-muted mt-1 leading-relaxed">Design a non-sentient vessel, mount, or industrial vehicle.</p>
                    </div>
                </button>
            </div>
        </div>
    );
};
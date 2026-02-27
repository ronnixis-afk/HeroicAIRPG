// components/modals/PickpocketModal.tsx

import React, { useState, useEffect, useContext } from 'react';
import { useUI } from '../../context/UIContext';
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { Icon } from '../Icon';
import Modal from '../Modal';

export const PickpocketModal: React.FC = () => {
    const { isPickpocketModalOpen, setIsPickpocketModalOpen, pickpocketTarget, setPickpocketTarget } = useUI();
    const { performPickpocket } = useContext(GameDataContext) as GameDataContextType;
    const [itemIntent, setItemIntent] = useState('');

    useEffect(() => {
        if (isPickpocketModalOpen) {
            setItemIntent('');
        }
    }, [isPickpocketModalOpen]);

    if (!isPickpocketModalOpen || !pickpocketTarget) return null;

    const handleClose = () => {
        setIsPickpocketModalOpen(false);
        setPickpocketTarget(null);
    };

    const handleConfirm = async () => {
        if (!itemIntent.trim()) return;
        
        const target = pickpocketTarget;
        const intent = itemIntent;
        
        handleClose();
        
        // Execute the mechanical resolution pipeline
        await performPickpocket(target, intent);
    };

    return (
        <Modal 
            isOpen={isPickpocketModalOpen} 
            onClose={handleClose} 
            title="Sleight Of Hand"
        >
            <div className="space-y-8 py-2 animate-fade-in">
                <div className="flex flex-col items-center text-center p-6 bg-purple-900/10 rounded-3xl border border-purple-500/30 shadow-inner group relative overflow-hidden">
                    {/* Stealthy visual flare */}
                    <div className="absolute -inset-1 bg-gradient-to-tr from-purple-500/5 to-brand-accent/5 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
                    
                    <div className="w-16 h-16 rounded-full bg-brand-bg flex items-center justify-center mb-6 border border-purple-500/40 relative z-10">
                        <Icon name="sparkles" className="w-8 h-8 text-brand-accent shadow-[0_0_15px_rgba(62,207,142,0.4)]" />
                    </div>
                    
                    <div className="relative z-10">
                        <h4 className="text-brand-text font-bold mb-2">Shadow Work</h4>
                        <p className="text-body-sm text-brand-text-muted italic leading-relaxed">
                            You are moving into the blind spot of <span className="text-brand-text font-bold">{pickpocketTarget.name}</span>.
                        </p>
                    </div>
                </div>

                <div className="space-y-3 relative z-10">
                    <label className="block text-body-sm font-bold text-brand-text-muted ml-1 uppercase tracking-widest opacity-60">Intended Item</label>
                    <input 
                        type="text" 
                        value={itemIntent}
                        onChange={(e) => setItemIntent(e.target.value)}
                        placeholder="What are you trying to take?"
                        className="w-full bg-brand-primary h-14 px-5 rounded-2xl border-2 border-brand-surface focus:border-brand-accent focus:ring-1 focus:ring-brand-accent focus:outline-none text-body-base text-brand-text transition-all shadow-inner"
                        autoFocus
                    />
                    <p className="text-[10px] text-brand-text-muted italic px-1 mt-1 leading-relaxed">
                        Specify a generic item (e.g. "keys", "gold") or a specific one if known. The fates will decide if you find it.
                    </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                    <button 
                        onClick={handleConfirm}
                        disabled={!itemIntent.trim()}
                        className="btn-primary btn-lg w-full rounded-2xl shadow-xl shadow-brand-accent/20 gap-3 border border-white/10 group overflow-hidden relative"
                    >
                        {/* High-stakes button styling */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        <Icon name="photo" className="w-5 h-5 text-black" />
                        <span className="font-black">Take Item</span>
                    </button>
                    
                    <button 
                        onClick={handleClose}
                        className="btn-tertiary btn-md w-full rounded-xl opacity-60 hover:opacity-100 transition-opacity"
                    >
                        Abstain
                    </button>
                </div>
            </div>
        </Modal>
    );
};
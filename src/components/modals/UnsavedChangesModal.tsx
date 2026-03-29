
// components/modals/UnsavedChangesModal.tsx

import React, { useContext, useState } from 'react';
import Modal from '../Modal';
import { useUI } from '../../context/UIContext';
import { GameDataContext } from '../../context/GameDataContext';
import { PlayerCharacter, Companion } from '../../types';
import { Icon } from '../Icon';

export const UnsavedChangesModal: React.FC = () => {
    const { unsavedChanges, setUnsavedChanges, pendingNavigation, setPendingNavigation } = useUI();
    const { updatePlayerCharacter, updateCompanion } = useContext(GameDataContext);
    const [isSaving, setIsSaving] = useState(false);

    if (!unsavedChanges || !pendingNavigation) return null;

    const handleDiscard = () => {
        setUnsavedChanges(null);
        if (pendingNavigation) pendingNavigation();
        setPendingNavigation(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (unsavedChanges.type === 'player') {
                await updatePlayerCharacter(unsavedChanges.data as PlayerCharacter);
            } else {
                await updateCompanion(unsavedChanges.data as Companion);
            }
            setUnsavedChanges(null);
            if (pendingNavigation) pendingNavigation();
            setPendingNavigation(null);
        } catch (e) {
            console.error("Save failed in guard", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setPendingNavigation(null);
    };

    return (
        <Modal 
            isOpen={true} 
            onClose={handleCancel} 
            title="Unsaved Changes"
        >
            <div className="space-y-8 py-2">
                <div className="flex flex-col items-center text-center p-8 bg-brand-primary/10 rounded-3xl border border-brand-primary/50 shadow-inner group">
                    <div className="w-16 h-16 rounded-full bg-brand-accent/10 flex items-center justify-center mb-6 border border-brand-accent/20 group-hover:scale-105 transition-transform duration-500">
                        <Icon name="edit" className="w-8 h-8 text-brand-accent" />
                    </div>
                    <p className="text-body-lg text-brand-text leading-relaxed font-bold">
                        The profile for <span className="text-brand-accent">{unsavedChanges.name}</span> has pending modifications.
                    </p>
                    <p className="text-body-sm text-brand-text-muted mt-3 italic opacity-80">
                        Would you like to preserve these records before moving to the new view?
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        className="btn-primary btn-lg w-full rounded-2xl shadow-xl shadow-brand-accent/20 gap-3"
                    >
                        {isSaving ? (
                            <><Icon name="spinner" className="w-5 h-5 animate-spin" /><span>Saving Profile...</span></>
                        ) : (
                            <><Icon name="save" className="w-5 h-5" /><span>Save and Proceed</span></>
                        )}
                    </button>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={handleDiscard}
                            disabled={isSaving}
                            className="btn-secondary btn-md flex-1 rounded-xl"
                        >
                            Discard
                        </button>
                        <button 
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="btn-tertiary btn-md flex-1 rounded-xl"
                        >
                            Stay Here
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

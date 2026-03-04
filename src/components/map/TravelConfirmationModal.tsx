// components/map/TravelConfirmationModal.tsx
import React, { useContext } from 'react';
import { useUI } from '../../context/UIContext';
import { GameDataContext } from '../../context/GameDataContext';
import { useWorldActions } from '../../hooks/useWorldActions';
import { Icon } from '../Icon';

export const TravelConfirmationModal: React.FC = () => {
    const { pendingTravelConfirmation, setPendingTravelConfirmation, setIsAiGenerating } = useUI();
    const { gameData, dispatch } = useContext(GameDataContext);
    const { initiateTravel } = useWorldActions(
        gameData,
        dispatch,
        async () => { }, // initiateCombatSequence stub, rarely used directly from toast
        setIsAiGenerating
    );

    if (!pendingTravelConfirmation) return null;

    const handleConfirm = async () => {
        const { destination, method, targetCoords } = pendingTravelConfirmation;
        setPendingTravelConfirmation(null);
        await initiateTravel(destination, method, targetCoords);
    };

    const handleCancel = () => {
        setPendingTravelConfirmation(null);
        if (dispatch) {
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `sys-travel-cancel-${Date.now()}`,
                    sender: 'system',
                    content: `Zone travel cancelled.`,
                    type: 'neutral'
                }
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-brand-surface border border-brand-primary/20 rounded-lg p-6 max-w-sm w-full shadow-2xl animate-slide-up text-center">
                <div className="w-12 h-12 rounded-full bg-brand-primary/20 flex items-center justify-center mx-auto mb-4 text-brand-accent">
                    <Icon name="map" className="w-6 h-6" />
                </div>

                <h3 className="text-xl font-bold font-heading text-brand-text mb-2">Travel Intent Detected</h3>
                <p className="text-brand-text-muted mb-6">
                    Do you want to travel to <strong className="text-brand-accent">{pendingTravelConfirmation.destination}</strong>?
                </p>

                <div className="flex gap-3 justify-center">
                    <button
                        onClick={handleCancel}
                        className="btn-secondary flex-1"
                    >
                        Stay
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="btn-primary flex-1 bg-brand-accent text-black hover:bg-white"
                    >
                        Yes, Travel
                    </button>
                </div>
            </div>
        </div>
    );
};

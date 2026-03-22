import React, { useContext, useMemo, useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import { GameDataContext } from '../../context/GameDataContext';
import { useWorldActions } from '../../hooks/useWorldActions';
import { Icon } from '../Icon';

export const TravelConfirmationModal: React.FC = () => {
    const { pendingTravelConfirmation, setPendingTravelConfirmation } = useUI();
    const { gameData, initiateTravel, dispatch } = useContext(GameDataContext);
    const [selectedMethod, setSelectedMethod] = useState('');

    const travelMethods = useMemo(() => {
        if (!gameData) return ['Walk', 'Public Transport'];
        
        const baseMethods = ['Walk', 'Public Transport'];
        const { playerInventory, companions, mapSettings } = gameData;

        const allItems = [
            ...playerInventory.assets, 
            ...playerInventory.carried, 
            ...playerInventory.equipped
        ];
        
        const vehicleNames = allItems
            .filter(item => item.tags?.some(t => t.toLowerCase() === 'vehicle'))
            .map(item => item.name);

        const shipNames = (companions || [])
            .filter(c => c.isShip)
            .map(c => c.name);
            
        let methods = Array.from(new Set([...baseMethods, ...vehicleNames, ...shipNames]));

        if (mapSettings?.style === 'sci-fi') {
            methods = methods.filter(m => m.toLowerCase() !== 'walk');
        }

        return methods;
    }, [gameData]);

    useEffect(() => {
        if (pendingTravelConfirmation && !selectedMethod) {
            setSelectedMethod(pendingTravelConfirmation.method || travelMethods[0] || 'Walk');
        }
    }, [pendingTravelConfirmation, travelMethods, selectedMethod]);

    if (!pendingTravelConfirmation) return null;

    const handleConfirm = async () => {
        const { destination, targetCoords } = pendingTravelConfirmation;
        const finalMethod = selectedMethod || 'Walk';
        setPendingTravelConfirmation(null);
        await initiateTravel(destination, finalMethod, targetCoords);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
            <div className="bg-brand-surface border border-brand-primary/30 rounded-3xl shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center max-w-md w-full animate-page">
                
                <div className="w-16 h-16 rounded-full bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center mb-6 shadow-[0_0_25px_rgba(var(--brand-primary-rgb),0.1)]">
                    <Icon name="map" className="w-8 h-8 text-brand-primary animate-pulse" />
                </div>
                
                <div className="space-y-2 mb-6 w-full text-center">
                    <h3 className="text-2xl font-bold text-brand-text">Travel Intent Detected</h3>
                    <p className="text-body-base text-brand-text-muted leading-relaxed">
                        Do you want to travel to <strong className="text-brand-accent">{pendingTravelConfirmation.destination}</strong>?
                    </p>
                </div>
                
                <div className="w-full space-y-2 mb-8 text-left">
                    <label className="text-[10px] uppercase font-bold text-brand-text-muted ml-1 tracking-widest">Choose Travel Mode</label>
                    <div className="relative">
                        <select
                            value={selectedMethod}
                            onChange={(e) => setSelectedMethod(e.target.value)}
                            className="w-full bg-brand-primary h-12 px-4 pr-10 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-brand-text appearance-none text-sm font-bold transition-all shadow-inner"
                        >
                            {travelMethods.map(method => (
                                <option key={method} value={method}>{method}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                            <Icon name="chevronDown" className="w-4 h-4"/>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3 w-full">
                    <button 
                        onClick={handleConfirm}
                        className="btn-primary btn-md shadow-brand-accent/20 rounded-xl"
                    >
                        Yes, Travel
                    </button>

                    <button 
                        onClick={handleCancel}
                        className="btn-secondary btn-md text-sm rounded-xl"
                    >
                        Stay Here
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-brand-primary/10 w-full flex flex-col items-center">
                    <button 
                        onClick={handleCancel}
                        className="text-body-sm font-bold text-brand-text-muted hover:text-brand-danger transition-colors underline underline-offset-4"
                    >
                        Is this incorrect? Dismiss.
                    </button>
                </div>
            </div>
        </div>
    );
};

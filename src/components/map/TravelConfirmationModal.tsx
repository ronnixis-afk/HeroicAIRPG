import React, { useContext, useMemo, useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import { GameDataContext } from '../../context/GameDataContext';
import { useWorldActions } from '../../hooks/useWorldActions';
import { Icon } from '../Icon';
import { NPC } from '../../types';

export const TravelConfirmationModal: React.FC = () => {
    const { pendingTravelConfirmation, setPendingTravelConfirmation } = useUI();
    const { gameData, initiateTravel, dispatch } = useContext(GameDataContext);
    const [selectedMethod, setSelectedMethod] = useState('');
    const [eligibleNpcs, setEligibleNpcs] = useState<NPC[]>([]);
    const [authorizedNpcIds, setAuthorizedNpcIds] = useState<string[]>([]);

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

        if (mapSettings?.style === 'sci-fi' || mapSettings?.style === 'magitech') {
            methods = methods.filter(m => m.toLowerCase() !== 'walk');
        }

        return methods;
    }, [gameData]);
    
    // Sync initial state when modal opens
    useEffect(() => {
        if (pendingTravelConfirmation) {
            // One-time capture of eligible followers when modal opens
            if (gameData && eligibleNpcs.length === 0) {
                const partyCompanionIds = (gameData.companions || []).map(c => c.id);
                
                const followers = gameData.npcs.filter(n => {
                    if (!n.isFollowing) return false;
                    
                    const isPartyMember = partyCompanionIds.includes(n.id) || 
                                         (n.id.startsWith('npc-') && partyCompanionIds.includes(n.id.replace('npc-', ''))) ||
                                         (n.companionId && partyCompanionIds.includes(n.companionId));
                    
                    return !isPartyMember;
                });
                
                setEligibleNpcs(followers);
                setAuthorizedNpcIds(followers.map(n => n.id));
            }
        } else {
            // Reset when closed
            setEligibleNpcs([]);
            setAuthorizedNpcIds([]);
        }
    }, [pendingTravelConfirmation, gameData, eligibleNpcs.length]);

    useEffect(() => {
        if (pendingTravelConfirmation && !selectedMethod) {
            setSelectedMethod(pendingTravelConfirmation.method || travelMethods[0] || 'Walk');
        }
    }, [pendingTravelConfirmation, travelMethods, selectedMethod]);

    if (!pendingTravelConfirmation) return null;

    const handleConfirm = async () => {
        if (!pendingTravelConfirmation) return;
        const { destination, targetCoords } = pendingTravelConfirmation;
        const finalMethod = selectedMethod || 'Walk';
        
        // Finalize travel authorization for selected NPCs
        if (dispatch) {
            dispatch({
                type: 'SET_NPCS_WILL_TRAVEL',
                payload: { ids: authorizedNpcIds, willTravel: true }
            });
        }

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
                
                <div className="mb-6 animate-entrance flex items-center justify-center">
                    <img 
                        src="/icons/map.png" 
                        alt="Map" 
                        className="w-24 h-24 object-contain animate-bounce-subtle drop-shadow-[0_0_15px_rgba(var(--brand-accent-rgb),0.2)]" 
                    />
                </div>
                
                <div className="space-y-2 mb-6 w-full text-center">
                    <h3 className="text-2xl font-bold text-brand-text">Travel Intent Detected</h3>
                    <p className="text-body-base text-brand-text-muted leading-relaxed">
                        Do you want to travel to <strong className="text-brand-accent">{pendingTravelConfirmation.destination}</strong>?
                    </p>
                </div>
                
                <div className="w-full space-y-2 mb-8 text-left">
                    <label className="text-[10px] font-bold text-brand-text-muted ml-1">Choose Travel Mode</label>
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

                {eligibleNpcs.length > 0 && (
                    <div className="w-full space-y-3 mb-8 text-left animate-fade-in">
                        <label className="text-[10px] font-bold text-brand-text-muted ml-1 uppercase-none">Choose Who Follows You</label>
                        <div className="grid grid-cols-2 gap-2 bg-brand-primary/10 p-4 rounded-2xl border border-brand-surface shadow-inner max-h-[30vh] overflow-y-auto custom-scrollbar">
                            {eligibleNpcs.map(npc => {
                                const isAuthorized = authorizedNpcIds.includes(npc.id);
                                return (
                                    <div 
                                        key={npc.id} 
                                        onClick={() => {
                                            const newAuthorizedIds = isAuthorized 
                                                ? authorizedNpcIds.filter(id => id !== npc.id) 
                                                : [...authorizedNpcIds, npc.id];
                                            
                                            setAuthorizedNpcIds(newAuthorizedIds);
                                            
                                            // IMMEDIATE GLOBAL SYNC: If we uncheck, immediately stop following.
                                            // If we re-check, they follow again.
                                            if (dispatch) {
                                                dispatch({
                                                    type: 'UPDATE_NPC',
                                                    payload: { id: npc.id, isFollowing: !isAuthorized }
                                                });
                                            }
                                        }}
                                        className={`flex items-center justify-between p-3 rounded-xl transition-all border cursor-pointer ${
                                            isAuthorized 
                                                ? 'bg-brand-accent/10 border-brand-accent/40 shadow-[0_0_10px_rgba(62,207,142,0.1)]' 
                                                : 'bg-brand-primary/40 border-transparent opacity-60 grayscale'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col">
                                                <span className={`text-body-sm font-bold leading-none ${isAuthorized ? 'text-brand-text' : 'text-brand-text-muted'}`}>{npc.name}</span>
                                                <span className="text-[9px] text-brand-text-muted font-normal mt-1">Authorized for travel</span>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                            isAuthorized ? 'bg-brand-accent border-brand-accent text-black' : 'bg-brand-surface border-brand-primary/30'
                                        }`}>
                                            {isAuthorized && <Icon name="check" className="w-3.5 h-3.5 bold" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                
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

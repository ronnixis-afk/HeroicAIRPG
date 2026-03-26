
import React, { useState, useMemo, useContext } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import { parseGameTime, formatGameTime, addDuration } from '../utils/timeUtils';
import { Icon } from './Icon';

interface TimeManagementModalContentProps {
    onClose: () => void;
}

const TimeManagementModalContent: React.FC<TimeManagementModalContentProps> = ({ onClose }) => {
    const { gameData, initiateRest, initiateWait } = useContext(GameDataContext);
    const [waitHours, setWaitHours] = useState(1);

    const currentTime = gameData?.currentTime || '';
    const isCombatActive = gameData?.combatState?.isActive || false;
    
    const currentDate = useMemo(() => parseGameTime(currentTime), [currentTime]);

    if (!currentDate || !gameData) {
        return <p className="text-brand-danger text-body-base">Could not parse the current game time.</p>;
    }

    const shortRestEndDate = addDuration(currentDate, 1);
    const longRestEndDate = addDuration(currentDate, 8);
    const waitEndDate = addDuration(currentDate, waitHours);

    const handleConfirmRest = (type: 'short' | 'long') => {
        if (isCombatActive) return;
        initiateRest(type);
        onClose();
    };

    const handleConfirmWait = () => {
        if (isCombatActive) return;
        initiateWait(waitHours);
        onClose();
    };

    if (isCombatActive) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-center animate-page">
                <div className="w-20 h-20 rounded-full bg-brand-danger/10 flex items-center justify-center mb-6 border border-brand-danger/30 shadow-[0_0_35px_rgba(239,68,68,0.2)] animate-pulse">
                    <Icon name="danger" className="w-10 h-10 text-brand-danger" />
                </div>
                <h3 className="text-brand-text">Combat Active</h3>
                <p className="text-body-base text-brand-text-muted mb-8 max-w-xs leading-relaxed">
                    You cannot rest or wait while in danger!
                </p>
                <button 
                    onClick={onClose}
                    className="btn-secondary btn-md w-full rounded-xl"
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center text-center space-y-8 py-4 animate-fade-in">
            {/* Header Icon - 4x bigger dimension (w-40) */}
            <div className="w-40 h-40 flex items-center justify-center relative group">
                <div className="absolute inset-0 bg-brand-accent/5 rounded-full blur-2xl group-hover:bg-brand-accent/10 transition-colors" />
                <img 
                    src="/icons/rest-camp.png" 
                    alt="Rest & Camp" 
                    className="w-full h-full object-contain relative z-10 drop-shadow-2xl transition-transform duration-500 group-hover:scale-110" 
                />
            </div>
            
            <div className="space-y-3 px-2">
                <p className="text-body-lg text-brand-text italic leading-relaxed px-4">
                    "Find a safe spot to catch your breath or establish a secure camp as the day turns to dusk."
                </p>
                <p className="text-body-sm text-brand-text-muted font-medium">
                    Choose to recover health and abilities or wait for time to pass.
                </p>
            </div>
            
            {/* Action Grid */}
            <div className="grid grid-cols-2 gap-4 w-full px-2">
                <button 
                    onClick={() => handleConfirmRest('short')}
                    className="flex flex-col items-center justify-center py-8 px-4 bg-brand-primary/20 border border-brand-surface rounded-3xl hover:bg-brand-primary/40 hover:border-brand-accent/30 transition-all group gap-2 shadow-inner text-center min-h-[160px]"
                >
                    <div className="flex flex-col gap-2">
                        <span className="text-body-lg font-bold text-brand-accent">Short Rest</span>
                        <div className="flex flex-col gap-1">
                            <p className="text-[10px] text-brand-text font-medium leading-relaxed opacity-90">
                                Recovers 1d8 hp per level and resets short rest abilities.
                            </p>
                            <span className="text-[9px] text-brand-text-muted font-bold opacity-50 mt-1">1 Hour • Ends at {formatGameTime(shortRestEndDate)}</span>
                        </div>
                    </div>
                </button>
                
                <button 
                    onClick={() => handleConfirmRest('long')}
                    className="flex flex-col items-center justify-center py-8 px-4 bg-brand-primary/20 border border-brand-surface rounded-3xl hover:bg-brand-primary/40 hover:border-brand-accent/30 transition-all group gap-2 shadow-inner text-center min-h-[160px]"
                >
                    <div className="flex flex-col gap-2">
                        <span className="text-body-lg font-bold text-brand-accent">Long Rest</span>
                        <div className="flex flex-col gap-1">
                            <p className="text-[10px] text-brand-text font-medium leading-relaxed opacity-90">
                                Fully recovers hp and resets all abilities.
                            </p>
                            <span className="text-[9px] text-brand-text-muted font-bold opacity-50 mt-1">8 Hours • Ends at {formatGameTime(longRestEndDate)}</span>
                        </div>
                    </div>
                </button>
            </div>

            {/* Wait Section */}
            <div className="w-full px-2 pt-4 space-y-4 border-t border-brand-primary/10">
                <div className="flex justify-between items-center mb-2 px-2">
                    <span className="text-body-sm font-bold text-brand-text">Wait For Time To Pass</span>
                    <div className="bg-brand-surface px-3 py-1 rounded-full border border-brand-primary/30 flex items-center">
                        <span className="text-body-base font-bold text-brand-accent tabular-nums">{waitHours}</span>
                        <span className="text-[10px] font-bold text-brand-text-muted ml-1.5 opacity-60">Hours</span>
                    </div>
                </div>
                
                <div className="px-2 space-y-1">
                    <input
                        type="range"
                        min="1"
                        max="24"
                        value={waitHours}
                        onChange={(e) => setWaitHours(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-brand-primary/40 rounded-full appearance-none cursor-pointer accent-brand-accent"
                    />
                    <div className="flex justify-between px-1">
                        <span className="text-[8px] font-bold text-brand-text-muted opacity-40">1h</span>
                        <span className="text-[8px] font-bold text-brand-text-muted opacity-40">12h</span>
                        <span className="text-[8px] font-bold text-brand-text-muted opacity-40">24h</span>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <p className="text-[10px] text-brand-text-muted italic leading-tight text-center">
                        Wait until {formatGameTime(waitEndDate)}
                    </p>
                    <button
                        onClick={handleConfirmWait}
                        className="btn-primary btn-md w-full rounded-xl shadow-lg shadow-brand-accent/10"
                    >
                        Confirm Wait
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TimeManagementModalContent;

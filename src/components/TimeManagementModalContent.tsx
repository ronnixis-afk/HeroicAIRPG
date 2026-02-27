
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
                <div className="w-16 h-16 rounded-full bg-brand-danger/10 flex items-center justify-center mb-6 border border-brand-danger/20">
                    <Icon name="danger" className="w-8 h-8 text-brand-danger" />
                </div>
                <h3>Combat Active</h3>
                <p className="text-body-base text-brand-text-muted mb-8 max-w-xs">
                    You cannot rest or wait while in danger!
                </p>
                <button 
                    onClick={onClose}
                    className="btn-secondary btn-md w-full"
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-page">
            <p className="text-body-sm text-brand-text-muted border-b border-brand-primary/20 pb-4 mb-2 leading-relaxed italic">
                Choose to rest to recover health and abilities, or wait for time to pass. The Gm will describe any events that occur.
            </p>
            
            {/* Short Rest */}
            <div className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface/50 shadow-inner transition-all hover:border-brand-accent/20">
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 pr-4">
                            <h4>Short Rest (1 hour)</h4>
                            <p className="text-body-sm text-brand-text-muted leading-relaxed">Recovers 1d8 Hp per level and resets short rest abilities.</p>
                        </div>
                        <button
                            onClick={() => handleConfirmRest('short')}
                            className="btn-primary btn-md flex-shrink-0"
                        >
                            Confirm
                        </button>
                    </div>
                    <div className="pt-3 border-t border-brand-primary/20 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-brand-text-muted opacity-60">Ends At:</span>
                        <span className="text-body-sm font-bold text-brand-accent">{formatGameTime(shortRestEndDate)}</span>
                    </div>
                </div>
            </div>

            {/* Long Rest */}
            <div className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface/50 shadow-inner transition-all hover:border-brand-accent/20">
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 pr-4">
                            <h4>Long Rest (8 hours)</h4>
                            <p className="text-body-sm text-brand-text-muted leading-relaxed">Fully recovers Hp and resets all abilities.</p>
                        </div>
                        <button
                            onClick={() => handleConfirmRest('long')}
                            className="btn-primary btn-md flex-shrink-0"
                        >
                            Confirm
                        </button>
                    </div>
                    <div className="pt-3 border-t border-brand-primary/20 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-brand-text-muted opacity-60">Ends At:</span>
                        <span className="text-body-sm font-bold text-brand-accent">{formatGameTime(longRestEndDate)}</span>
                    </div>
                </div>
            </div>

            {/* Wait Slider */}
            <div className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface/50 shadow-inner transition-all hover:border-brand-accent/20">
                <div className="flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                        <h4>Wait</h4>
                        <div className="bg-brand-bg/50 px-3 py-1 rounded-full border border-brand-surface shadow-sm">
                            <span className="text-body-base font-black text-brand-accent tabular-nums">{waitHours}</span>
                            <span className="text-[10px] font-bold text-brand-text-muted ml-1.5 opacity-60">Hours</span>
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <input
                            type="range"
                            min="1"
                            max="24"
                            value={waitHours}
                            onChange={(e) => setWaitHours(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-brand-secondary rounded-full appearance-none cursor-pointer accent-brand-accent"
                        />
                        <div className="flex justify-between px-1">
                            <span className="text-[8px] font-bold text-brand-text-muted opacity-40">1h</span>
                            <span className="text-[8px] font-bold text-brand-text-muted opacity-40">12h</span>
                            <span className="text-[8px] font-bold text-brand-text-muted opacity-40">24h</span>
                        </div>
                    </div>

                    <p className="text-body-sm text-brand-text-muted italic leading-relaxed text-center px-2">
                        Pass the time and see what happens. No Hp recovery occurs during a standard wait.
                    </p>

                    <div className="pt-4 border-t border-brand-primary/20 flex flex-col gap-4">
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] font-bold text-brand-text-muted opacity-60">Ends At:</span>
                            <span className="text-body-sm font-bold text-brand-accent">{formatGameTime(waitEndDate)}</span>
                        </div>
                        <button
                            onClick={handleConfirmWait}
                            className="btn-primary btn-md w-full"
                        >
                            Confirm Wait
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimeManagementModalContent;

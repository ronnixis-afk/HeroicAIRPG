
import React from 'react';
import { Icon } from '../Icon';

interface CharacterTabProps {
    name: string;
    initials: string;
    imageUrl?: string;
    isActive: boolean;
    onClick: () => void;
    currentHp: number;
    maxHp: number;
    tempHp?: number;
    maxTempHp?: number;
    isInParty?: boolean;
    onToggleParty?: () => void;
    isPlayer?: boolean;
    isShrunk?: boolean;
}

export const CharacterTab: React.FC<CharacterTabProps> = ({ 
    name, 
    initials, 
    imageUrl, 
    isActive, 
    onClick, 
    currentHp, 
    maxHp, 
    tempHp = 0,
    maxTempHp = 0,
    isInParty, 
    onToggleParty, 
    isPlayer,
    isShrunk = false
}) => {
    const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
    const hpPercent = Math.max(0, Math.min(1, hpRatio));
    const tempPercent = maxTempHp > 0 ? tempHp / maxTempHp : 0;

    const color = hpRatio > 0.5 ? '#3ecf8e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
    const tempColor = '#38bdf8'; // Shield blue

    const isDead = currentHp <= 0;
    const isLowHp = !isDead && hpRatio <= 0.25;

    const displayName = name.length > 9 ? name.slice(0, 8) + '..' : name;

    return (
        <div className={`flex flex-col items-center group flex-shrink-0 transition-all duration-300 w-20 ${isShrunk ? 'gap-1' : 'gap-2'}`}>
            <div className="relative w-full">
                <button
                    onClick={onClick}
                    title={`${name} (${currentHp}/${maxHp} Hp)`}
                    className={`relative flex flex-col items-center justify-center transition-all duration-300 w-full ${
                        isActive ? 'scale-100 z-10' : 'opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                >
                    <div className={`relative transition-all duration-300 w-full aspect-square rounded-xl overflow-hidden border-2 bg-brand-surface ${isActive ? 'border-brand-text' : 'border-brand-primary'} ${isDead ? 'grayscale brightness-50' : ''}`}>
                         {imageUrl ? (
                            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full">
                                <span className={`font-bold text-brand-text-muted transition-all duration-300 ${isShrunk ? 'text-body-micro' : 'text-xl'}`}>{initials.slice(0, 2)}</span>
                            </div>
                        )}
                        
                        {isLowHp && (
                            <div className="absolute inset-0 bg-brand-danger/20 animate-pulse pointer-events-none" />
                        )}
                    </div>
                </button>

                {/* Health and Shield Bars */}
                <div className={`mt-1.5 w-full px-1 ${isShrunk ? 'space-y-0.5' : 'space-y-1'}`}>
                    {/* HP Bar */}
                    <div className={`${isShrunk ? 'h-1' : 'h-1.5'} w-full bg-black/40 rounded-full overflow-hidden border border-white/5`}>
                        <div 
                            className="h-full transition-all duration-500 ease-out"
                            style={{ 
                                width: `${hpPercent * 100}%`,
                                backgroundColor: color
                            }}
                        />
                    </div>
                    
                    {/* Shield Bar (Temp HP) */}
                    {maxTempHp > 0 && (
                        <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <div 
                                className="h-full transition-all duration-700 ease-out opacity-90"
                                style={{ 
                                    width: `${tempPercent * 100}%`,
                                    backgroundColor: tempColor
                                }}
                            />
                        </div>
                    )}
                </div>

                {!isPlayer && onToggleParty && !isShrunk && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleParty(); }}
                        className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 shadow-md transition-all duration-200 z-20 ${
                            isInParty 
                                ? 'bg-brand-accent border-brand-accent text-black scale-100' 
                                : 'bg-brand-surface border-brand-primary text-brand-text-muted hover:text-brand-text scale-90 hover:scale-100'
                        }`}
                        title={isInParty ? "Remove from party" : "Add to party"}
                    >
                        {isInParty ? <Icon name="check" className="w-3 h-3" /> : <Icon name="plus" className="w-3 h-3" />}
                    </button>
                )}
            </div>
            
            <span className={`font-bold truncate w-full text-center transition-all duration-300 ${isShrunk ? 'text-body-micro opacity-80' : 'text-body-sm opacity-100'} ${isActive ? 'text-brand-text' : 'text-brand-text-muted'}`}>
                {displayName}
            </span>
        </div>
    );
};

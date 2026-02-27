
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
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
    const hpPercent = Math.max(0, Math.min(1, hpRatio));
    const strokeDashoffset = circumference * (1 - hpPercent);
    
    const tempHpRatio = maxTempHp > 0 ? tempHp / maxTempHp : 0;
    const tempPercent = Math.max(0, Math.min(1, tempHpRatio));
    const tempRadius = radius + 3;
    const tempCircumference = 2 * Math.PI * tempRadius;
    const tempDashoffset = tempCircumference * (1 - tempPercent);

    const color = hpRatio > 0.5 ? '#3ecf8e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
    const tempColor = '#38bdf8'; // Shield blue

    const isDead = currentHp <= 0;
    const isLowHp = !isDead && hpRatio <= 0.25;

    const displayName = name.length > 9 ? name.slice(0, 8) + '..' : name;

    return (
        <div className={`flex flex-col items-center group flex-shrink-0 transition-all duration-300 w-20 ${isShrunk ? 'gap-1' : 'gap-2'}`}>
            <div className="relative">
                <button
                    onClick={onClick}
                    title={`${name} (${currentHp}/${maxHp} HP)`}
                    className={`relative flex flex-col items-center justify-center transition-all duration-300 ${
                        isActive ? 'scale-100 z-10' : 'opacity-80 hover:opacity-100 hover:scale-105'
                    } ${isShrunk ? 'w-10 h-10' : 'w-20 h-20'}`}
                >
                    <div className={`relative transition-all duration-300 ${isShrunk ? 'w-10 h-10' : 'w-20 h-20'}`}>
                        <svg 
                            className="absolute top-0 left-0 w-full h-full transform -rotate-90 drop-shadow-md z-10" 
                            viewBox="0 0 80 80"
                        >
                            <circle cx="40" cy="40" r={radius} fill="transparent" stroke="#242424" strokeWidth="4" />
                            <circle cx="40" cy="40" r={radius} fill="transparent" stroke={color} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-500 ease-out" />
                            
                            {/* Shield Ring (Temp HP) */}
                            {maxTempHp > 0 && (
                                <circle
                                    cx="40"
                                    cy="40"
                                    r={tempRadius}
                                    fill="transparent"
                                    stroke={tempColor}
                                    strokeWidth={1.5}
                                    strokeDasharray={tempCircumference}
                                    strokeDashoffset={tempDashoffset}
                                    strokeLinecap="round"
                                    className="transition-all duration-700 ease-out opacity-80"
                                />
                            )}
                        </svg>

                        <div className={`absolute rounded-full overflow-hidden flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'border-brand-text' : 'border-brand-primary'} bg-brand-surface ${isShrunk ? 'inset-[3px]' : 'inset-[6px]'} ${isDead ? 'grayscale brightness-50' : ''}`}>
                             {imageUrl ? (
                                <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                            ) : (
                                <span className={`font-bold text-brand-text-muted transition-all duration-300 ${isShrunk ? 'text-body-micro' : 'text-xl'}`}>{initials.slice(0, 2)}</span>
                            )}
                            
                            {isLowHp && (
                                <div className="absolute inset-0 bg-brand-danger/20 animate-pulse pointer-events-none" />
                            )}
                        </div>
                    </div>
                </button>

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

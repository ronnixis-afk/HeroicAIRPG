
import React from 'react';
import { PlayerCharacter, Companion, NPC } from '../../types';
import { Icon } from '../Icon';

interface StatusAvatarProps {
    char: PlayerCharacter | Companion | NPC;
    size: number;
    isPlayer?: boolean;
    showBars?: boolean;
    onClick?: () => void;
    isTargeted?: boolean;
    isStealthed?: boolean;
    isEnriching?: boolean;
    className?: string;
    showName?: boolean;
    // For NPCs and companions that aren't the main player
    tempHp?: number;
    maxTempHp?: number;
}

export const StatusAvatar: React.FC<StatusAvatarProps> = ({
    char,
    size,
    isPlayer,
    showBars = true,
    onClick,
    isTargeted,
    isStealthed,
    isEnriching,
    className = "",
    showName = true,
    tempHp = 0,
    maxTempHp = 0
}) => {
    // Determine stats from various possible character types
    const currentHp = (char as any).currentHitPoints;
    const maxHp = (char as any).maxHitPoints;
    
    // HP Detection fallback: If bars are requested, we should show a bar even if stats are missing (common for nearby NPCs)
    const hasHp = showBars && (currentHp !== undefined && maxHp !== undefined);
    const displayCurrentHp = currentHp !== undefined ? currentHp : 1;
    const displayMaxHp = maxHp !== undefined ? maxHp : 1;

    // PC/Companion specific temp HP detection if not provided via props
    const actualTempHp = tempHp || (char as any).temporaryHitPoints || 0;
    const actualMaxTempHp = maxTempHp || (char as any).maxTemporaryHitPoints || 0;

    const hpRatio = displayMaxHp > 0 ? displayCurrentHp / displayMaxHp : 0;
    const hpPercent = Math.max(0, Math.min(1, hpRatio));

    const tempHpRatio = actualMaxTempHp > 0 ? actualTempHp / actualMaxTempHp : 0;
    const tempPercent = Math.max(0, Math.min(1, tempHpRatio));

    const currentStamina = (char as any).stamina || 0;
    const maxStamina = (char as any).maxStamina || 0;
    const staminaRatio = maxStamina > 0 ? currentStamina / maxStamina : 0;
    const staminaPercent = Math.max(0, Math.min(1, staminaRatio));

    const hpColor = hpRatio > 0.5 ? '#3ecf8e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
    const tempColor = '#38bdf8'; // Shield blue
    const staminaColor = '#f59e0b'; // Brand gold/yellow
    const initials = char.name.slice(0, 2);

    const isDead = (char as any).status === 'Dead' || (currentHp !== undefined && currentHp <= 0);
    const isLowHp = showBars && (currentHp !== undefined) && !isDead && hpRatio <= 0.25;

    // If the character is dead, force the bar to show empty (red or gray)
    const finalHpPercent = isDead ? 0 : hpPercent;
    const finalHpColor = isDead ? '#ef4444' : hpColor;

    return (
        <div
            className={`relative flex flex-col items-center transition-all duration-300 ease-out ${isTargeted ? 'scale-110 z-50' : 'scale-100 z-10'} ${className}`}
            style={{ width: size }}
        >
            <button
                onClick={onClick}
                className={`relative rounded-xl overflow-hidden flex items-center justify-center bg-brand-surface border transition-all duration-300 w-full aspect-square
                    ${isTargeted
                        ? 'border-white ring-4 ring-brand-accent/30 shadow-[0_0_25px_rgba(62,207,142,0.8)] z-30'
                        : (showBars ? 'border-brand-primary' : 'border-brand-primary/40')
                    } 
                    ${isDead ? 'grayscale brightness-50' : ''}
                    ${isStealthed ? 'brightness-50' : ''}
                `}
            >
                {(char as any).imageUrl || (char as any).image ? (
                    <img src={(char as any).imageUrl || (char as any).image} alt={char.name} className="w-full h-full object-cover" />
                ) : (
                    <span className="font-bold text-brand-text-muted" style={{ fontSize: size * 0.4 }}>
                        {initials}
                    </span>
                )}

                {isLowHp && (
                    <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none" />
                )}

                {isEnriching && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                        <Icon name="spinner" className="w-1/2 h-1/2 text-brand-accent animate-spin" />
                    </div>
                )}

                {isDead && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
                        <Icon name="close" className="w-3/5 h-3/5 text-brand-danger opacity-50 drop-shadow-md" />
                    </div>
                )}

                {isStealthed && !isEnriching && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none text-brand-accent drop-shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: size * 0.45, height: size * 0.45 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                    </div>
                )}
            </button>

            {/* Name and Health/Shield Bars */}
            <div className="mt-1.5 w-full flex flex-col items-center">
                {/* Name */}
                {showName && (
                    <span className={`text-[9px] font-bold text-center truncate w-full mb-0.5 ${isTargeted ? 'text-brand-text' : 'text-brand-text-muted opacity-80'}`}>
                        {char.name}
                    </span>
                )}

                {/* Bars Container */}
                {showBars && (
                    <div className="w-full bg-black/40 rounded-full overflow-hidden border border-white/5 flex flex-col">
                        {/* HP Bar */}
                        <div className="h-1 w-full relative">
                            <div 
                                className="h-full transition-all duration-500 ease-out"
                                style={{ 
                                    width: `${finalHpPercent * 100}%`,
                                    backgroundColor: finalHpColor
                                }}
                            />
                        </div>
                        
                        {/* Shield Bar (Temp HP) */}
                        {actualMaxTempHp > 0 && (
                            <div className="h-1 w-full relative border-t border-white/5">
                                <div 
                                    className="h-full transition-all duration-700 ease-out opacity-90"
                                    style={{ 
                                        width: `${tempPercent * 100}%`,
                                        backgroundColor: tempColor
                                    }}
                                />
                            </div>
                        )}

                        {/* Stamina Bar */}
                        {maxStamina > 0 && (
                            <div className="h-1 w-full relative border-t border-white/5">
                                <div 
                                    className="h-full transition-all duration-700 ease-out opacity-90"
                                    style={{ 
                                        width: `${staminaPercent * 100}%`,
                                        backgroundColor: staminaColor
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


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
    stamina?: number;
    maxStamina?: number;
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
    stamina = 0,
    maxStamina = 0,
    isInParty, 
    onToggleParty, 
    isPlayer,
    isShrunk = false
}) => {
    const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
    const hpPercent = Math.max(0, Math.min(1, hpRatio));
    const tempPercent = maxTempHp > 0 ? tempHp / maxTempHp : 0;
    const staminaPercent = maxStamina > 0 ? Math.max(0, Math.min(1, stamina / maxStamina)) : 0;

    const color = hpRatio > 0.5 ? '#3ecf8e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
    const tempColor = '#38bdf8'; // Shield blue
    const staminaColor = '#f59e0b'; // Stamina Gold

    const isDead = currentHp <= 0;
    const isLowHp = !isDead && hpRatio <= 0.25;

    const displayName = name.length > 9 ? name.slice(0, 8) + '..' : name;

    const ratios: number[] = [];
    const colors: string[] = [];
    if (maxHp > 0) {
        ratios.push(hpPercent);
        colors.push(color);
    }
    if (maxTempHp > 0) {
        ratios.push(tempPercent);
        colors.push(tempColor);
    }
    if (maxStamina > 0) {
        ratios.push(staminaPercent);
        colors.push(staminaColor);
    }

    const size = isShrunk ? 40 : 80;
    const strokeWidth = Math.max(2, size * 0.06);
    const padding = 2;
    const totalSize = size + (strokeWidth + padding) * 2;
    const center = totalSize / 2;
    const radius = (size / 2) + padding + (strokeWidth / 2);
    const circumference = 2 * Math.PI * radius;

    return (
        <div className={`flex flex-col items-center group flex-shrink-0 transition-all duration-300 ${isShrunk ? 'w-10 gap-0.5' : 'w-24 gap-2'}`}>
            <div className="relative flex items-center justify-center" style={{ width: totalSize, height: totalSize }}>
                <button
                    onClick={onClick}
                    title={`${name} (${currentHp}/${maxHp} Hp)`}
                    className={`relative flex items-center justify-center transition-all duration-300 ${
                        isActive ? 'scale-100 z-10' : 'opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ width: size, height: size }}
                >
                    <div className={`relative transition-all duration-300 w-full h-full rounded-full overflow-hidden border-2 bg-brand-surface ${isActive ? 'border-brand-text' : 'border-brand-primary'} ${isDead ? 'grayscale brightness-50' : ''}`}>
                         {imageUrl ? (
                            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full">
                                <span className={`font-bold text-brand-text-muted transition-all duration-300 ${isShrunk ? 'text-[10px]' : 'text-xl'}`}>{initials.slice(0, 2)}</span>
                            </div>
                        )}
                        
                        {isLowHp && (
                            <div className="absolute inset-0 bg-brand-danger/20 animate-pulse pointer-events-none" />
                        )}
                    </div>
                </button>

                {/* Status Arcs SVG */}
                {ratios.length > 0 && (
                    <svg 
                        viewBox="0 0 100 100" 
                        className="absolute pointer-events-none -rotate-90 z-20 inset-0 w-full h-full"
                    >
                        <circle
                            cx="50"
                            cy="50"
                            r="47"
                            fill="none"
                            stroke="rgba(0, 0, 0, 0.4)"
                            strokeWidth="6"
                        />
                        {ratios.map((ratio, i) => {
                            if (ratio <= 0) return null;
                            const svgCircumference = 2 * Math.PI * 47;
                            const activeCount = ratios.length;
                            const segmentLength = svgCircumference / activeCount;
                            const gap = activeCount > 1 ? svgCircumference * 0.02 : 0;
                            const availableLength = segmentLength - gap;
                            const dashLength = availableLength * ratio;
                            const gapLength = svgCircumference - dashLength;
                            const rotation = (360 / activeCount) * i;
                            
                            return (
                                <circle
                                    key={i}
                                    cx="50"
                                    cy="50"
                                    r="47"
                                    fill="none"
                                    stroke={colors[i]}
                                    strokeWidth="6"
                                    strokeDasharray={`${dashLength} ${gapLength}`}
                                    style={{ 
                                        transform: `rotate(${rotation}deg)`,
                                        transformOrigin: '50% 50%',
                                        transition: 'all 0.5s ease-out'
                                    }}
                                    strokeLinecap="round"
                                />
                            );
                        })}
                    </svg>
                )}

                {/* Party Toggle Indicator */}
                {!isPlayer && onToggleParty && !isShrunk && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleParty(); }}
                        className={`absolute -top-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center border-2 shadow-md transition-all duration-200 z-30 ${
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

import React, { useState, useEffect, useRef } from 'react';
import { PlayerCharacter, Companion, NPC, CombatActor } from '../types';
import { Icon } from './Icon';
import { canBeTargeted } from '../utils/resolution/StatusRules';

interface ActorAvatarProps {
    actor: PlayerCharacter | Companion | NPC | CombatActor;
    size?: number;
    showBars?: boolean;
    showName?: boolean;
    isActive?: boolean;
    isTargeted?: boolean;
    isStealthed?: boolean;
    isEnriching?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
    // Overrides for specific UI cases
    hpOverride?: number;
    maxHpOverride?: number;
    tempHpOverride?: number;
    maxTempHpOverride?: number;
    staminaOverride?: number;
    maxStaminaOverride?: number;
    showGlow?: boolean;
}

/**
 * Unified Actor Avatar Component
 * Handles Player, Companion, and NPC styling across Chat and Combat.
 * Centralizes frame styling, status bars, and indicators.
 */
export const ActorAvatar: React.FC<ActorAvatarProps> = ({
    actor,
    size = 40,
    showBars = true,
    showName = false,
    isActive = false,
    isTargeted = false,
    isStealthed = false,
    isEnriching = false,
    onClick,
    className = "",
    hpOverride,
    maxHpOverride,
    tempHpOverride,
    maxTempHpOverride,
    staminaOverride,
    maxStaminaOverride,
    showGlow = true
}) => {
    const a = actor as any;
    const isStatusDead = a.status?.toLowerCase() === 'dead';

    // Stagger animation state when taking damage
    const [isStaggering, setIsStaggering] = useState(false);
    const [popups, setPopups] = useState<{ id: number; value: string; type: 'damage' | 'healing' }[]>([]);
    const prevHpRef = useRef<number | null>(null);

    // Normalize stats extraction with fallbacks for narrative NPCs
    const maxHp = maxHpOverride !== undefined ? maxHpOverride : (a.maxHitPoints ?? (!isStatusDead ? 1 : 0));
    const currentHp = hpOverride !== undefined ? hpOverride : (a.currentHitPoints ?? a.maxHitPoints ?? maxHp);
    
    const tempHp = tempHpOverride !== undefined ? tempHpOverride : (a.temporaryHitPoints ?? 0);
    const maxTempHp = maxTempHpOverride !== undefined ? maxTempHpOverride : (a.maxTemporaryHitPoints ?? tempHp);

    // Effect to trigger stagger and floating text when HP changes
    useEffect(() => {
        if (prevHpRef.current !== null && currentHp !== prevHpRef.current) {
            const diff = currentHp - prevHpRef.current;
            const id = Date.now() + Math.random();
            
            if (diff < 0) {
                // Damage
                setIsStaggering(true);
                setPopups(prev => [...prev, { id, value: `${diff}`, type: 'damage' }]);
                setTimeout(() => setIsStaggering(false), 400);
            } else {
                // Healing
                setPopups(prev => [...prev, { id, value: `+${diff}`, type: 'healing' }]);
            }

            // Cleanup popup after animation (increased to 3s)
            setTimeout(() => {
                setPopups(prev => prev.filter(p => p.id !== id));
            }, 3000);
        }
        prevHpRef.current = currentHp;
    }, [currentHp]);
    
    const stamina = staminaOverride !== undefined ? staminaOverride : (a.stamina ?? 0);
    const maxStamina = maxStaminaOverride !== undefined ? maxStaminaOverride : (a.maxStamina ?? stamina);

    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const tempRatio = maxTempHp > 0 ? Math.max(0, Math.min(1, tempHp / maxTempHp)) : 0;
    const staminaRatio = maxStamina > 0 ? Math.max(0, Math.min(1, stamina / maxStamina)) : 0;

    const isDead = isStatusDead || (maxHp > 0 && currentHp <= 0);
    const isLowHp = maxHp > 0 && !isDead && hpRatio <= 0.25;
    const hasStatus = (a.statusEffects?.length || 0) > 0;
    const initials = a.name ? a.name.slice(0, 2).toUpperCase() : '??';
    
    // Health bar always uses the green brand accent
    const finalHpColor = 'var(--color-status-hp)';

    const ratios: number[] = [];
    const colors: string[] = [];
    if (maxHp > 0) {
        ratios.push(hpRatio);
        colors.push(finalHpColor);
    }
    if (maxTempHp > 0) {
        ratios.push(tempRatio);
        colors.push('var(--color-status-shield)');
    }
    if (maxStamina > 0) {
        ratios.push(staminaRatio);
        colors.push('var(--color-status-stamina)');
    }

    const strokeWidth = Math.max(2, size * 0.06);
    const padding = 2; // Gap between avatar and ring
    const totalSize = size + (strokeWidth + padding) * 2;
    const center = totalSize / 2;
    const radius = (size / 2) + padding + (strokeWidth / 2);
    const circumference = 2 * Math.PI * radius;

    return (
        <div 
            className={`relative flex flex-col items-center transition-all duration-300 ease-out ${isActive || isTargeted ? 'scale-110 z-50' : 'scale-100 z-10'} ${isStaggering ? 'animate-stagger' : ''} ${className}`}
            style={{ width: totalSize }}
        >
            <div className="relative flex items-center justify-center" style={{ width: totalSize, height: totalSize }}>
                {/* Floating Combat Text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]" style={{ width: totalSize, height: totalSize }}>
                    {popups.map(popup => (
                        <span 
                            key={popup.id}
                            className={`absolute font-black text-sm filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] animate-float-up ${popup.type === 'damage' ? 'text-brand-danger' : 'text-brand-accent'}`}
                        >
                            {popup.value}
                        </span>
                    ))}
                </div>

                <button
                    onClick={(e) => {
                        if (onClick) {
                            e.stopPropagation();
                            onClick(e);
                        }
                    }}
                    style={{ width: size, height: size }}
                    className={`
                        relative rounded-full overflow-hidden flex items-center justify-center bg-brand-surface border transition-all duration-300
                        ${isActive || isTargeted
                            ? `border-white border-[var(--avatar-border-width-active)] ${showGlow ? (a.isAlly !== false ? 'ring-4 ring-brand-accent/30 shadow-[0_0_20px_rgba(62,207,142,0.6)]' : 'ring-4 ring-brand-danger/30 shadow-[0_0_20px_rgba(239,68,68,0.6)]') : ''} z-30`
                            : `border-brand-primary border-[var(--avatar-border-width)] ${showBars ? 'opacity-100' : 'opacity-80'}`
                        }
                        ${isDead ? 'grayscale brightness-50' : ''}
                        ${isStealthed ? 'brightness-50' : ''}
                        ${!onClick ? 'cursor-default' : 'cursor-pointer hover:border-brand-accent/50'}
                    `}
                >
                    {/* Image or Initials */}
                    {a.imageUrl || a.image ? (
                        <img src={a.imageUrl || a.image} alt={a.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="font-bold text-brand-text-muted" style={{ fontSize: size * 0.4 }}>
                            {initials}
                        </span>
                    )}

                    {/* Overlays */}
                    {isLowHp && (
                        <div className="absolute inset-0 bg-brand-danger/20 animate-pulse pointer-events-none" />
                    )}

                    {isEnriching && (
                        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                            <Icon name="spinner" className="w-1/2 h-1/2 text-brand-accent animate-spin" />
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

                {/* Status Arcs SVG */}
                {showBars && ratios.length > 0 && (
                    <svg 
                        viewBox="0 0 100 100"
                        className="absolute pointer-events-none -rotate-90 z-20 inset-0 w-full h-full"
                    >
                        {/* 
                            Fixed coordinate system (100x100) ensures scaling is handled by CSS transitions,
                            preventing "jumps" during resizing.
                            Inner avatar = 84 units
                            Stroke = 6 units
                            Padding = 2 units
                            84 + (6+2)*2 = 100 units total width/height
                        */}
                        {/* Background Ring */}
                        <circle
                            cx="50"
                            cy="50"
                            r="47"
                            fill="none"
                            stroke="var(--color-status-bg)"
                            strokeWidth="6"
                        />
                        {/* Resource Arcs */}
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

                {/* Rank Indicators (Corner Flags) - Adjusted for circle */}
                {a.rank && a.rank !== 'normal' && (
                    <div className="absolute top-[10%] left-[10%] z-40">
                        <div className={`w-3 h-3 rotate-45 border border-brand-bg -translate-x-1/2 -translate-y-1/2 ${a.rank === 'boss' ? 'bg-brand-danger shadow-[0_0_5px_var(--color-brand-danger)]' : 'bg-blue-400'}`} />
                    </div>
                )}
                
                {/* Dead Status Overlay */}
                {isDead && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-fade-in">
                        <Icon name="close" className="w-[64%] h-[64%] text-brand-danger drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
                    </div>
                )}

                {/* Buff Indicators (Upper Right) */}
                {a.activeBuffs && a.activeBuffs.length > 0 && (
                    <div 
                        className="absolute -top-1 -right-1 z-50"
                        title={(a.activeBuffs || []).map((b: any) => b.name).join(', ')}
                    >
                        <div className="w-4 h-4 bg-brand-accent rounded-full border border-brand-bg shadow-lg flex items-center justify-center animate-pulse">
                            <Icon name="chevronUp" className="w-3 h-3 text-black" />
                        </div>
                    </div>
                )}

                {/* Status/Debuff Indicators (Upper Left) */}
                {hasStatus && (
                    <div 
                        className="absolute -top-1 -left-1 z-50"
                        title={(a.statusEffects || []).map((s: any) => s.name).join(', ')}
                    >
                        <div className="w-4 h-4 bg-brand-danger rounded-full border border-brand-bg shadow-lg flex items-center justify-center">
                            <Icon name="chevronDown" className="w-3 h-3 text-white" />
                        </div>
                    </div>
                )}
            </div>
            
            {/* Name - Now below the circular container */}
            {showName && (
                <div className={`mt-2 flex flex-col items-center w-full`}>
                    <span className={`text-body-tiny font-bold text-center truncate w-full ${isActive || isTargeted ? 'text-brand-text' : 'text-brand-text-muted opacity-80'}`}>
                        {a.name}
                    </span>
                </div>
            )}
        </div>
    );
};

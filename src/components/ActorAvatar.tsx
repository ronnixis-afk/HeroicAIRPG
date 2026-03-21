
import React from 'react';
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
    maxStaminaOverride
}) => {
    const a = actor as any;

    // Normalize stats extraction
    const currentHp = hpOverride !== undefined ? hpOverride : (a.currentHitPoints ?? a.maxHitPoints ?? 0);
    const maxHp = maxHpOverride !== undefined ? maxHpOverride : (a.maxHitPoints ?? 0);
    const tempHp = tempHpOverride !== undefined ? tempHpOverride : (a.temporaryHitPoints ?? 0);
    const maxTempHp = maxTempHpOverride !== undefined ? maxTempHpOverride : (a.maxTemporaryHitPoints ?? 0);
    const stamina = staminaOverride !== undefined ? staminaOverride : (a.stamina ?? 0);
    const maxStamina = maxStaminaOverride !== undefined ? maxStaminaOverride : (a.maxStamina ?? 0);

    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const tempRatio = maxTempHp > 0 ? Math.max(0, Math.min(1, tempHp / maxTempHp)) : 0;
    const staminaRatio = maxStamina > 0 ? Math.max(0, Math.min(1, stamina / maxStamina)) : 0;

    const isDead = (a.status === 'Dead' || currentHp <= 0);
    const isLowHp = !isDead && hpRatio <= 0.25;
    const hasStatus = (a.statusEffects?.length || 0) > 0;
    const initials = a.name ? a.name.slice(0, 2).toUpperCase() : '??';
    
    // Support for alignment-based HP colors
    // Default to 'ally' for player character or companions
    const alignment = a.alignment || (a.isAlly || a.isInParty !== undefined ? 'ally' : 'enemy');
    
    const hpColor = alignment === 'ally' 
        ? 'var(--color-status-hp)' 
        : (alignment === 'neutral' ? 'var(--color-status-hp-warn)' : 'var(--color-status-hp-danger)');

    // For non-combat actors without explicit alignment, use threshold-based color
    const chatHpColor = hpRatio > 0.5 
        ? 'var(--color-status-hp)' 
        : hpRatio > 0.25 ? 'var(--color-status-hp-warn)' : 'var(--color-status-hp-danger)';

    // Final HP color: Prefer alignment-based if available/inferred
    const finalHpColor = (a.alignment || a.isAlly !== undefined) ? hpColor : chatHpColor;

    return (
        <div 
            className={`relative flex flex-col items-center transition-all duration-300 ease-out ${isActive || isTargeted ? 'scale-110 z-50' : 'scale-100 z-10'} ${className}`}
            style={{ width: size }}
        >
            <button
                onClick={(e) => {
                    if (onClick) {
                        e.stopPropagation();
                        onClick(e);
                    }
                }}
                className={`
                    relative rounded-[var(--avatar-radius)] overflow-hidden flex items-center justify-center bg-brand-surface border transition-all duration-300 w-full aspect-square
                    ${isActive || isTargeted
                        ? 'border-white border-[var(--avatar-border-width-active)] ring-4 ring-brand-accent/30 shadow-[0_0_20px_rgba(62,207,142,0.6)] z-30'
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

                {/* Rank Indicators (Corner Flags) */}
                {a.rank && a.rank !== 'normal' && (
                    <div className="absolute top-0 left-0 z-20">
                        <div className={`w-3 h-3 rotate-45 border border-brand-bg -translate-x-1/2 -translate-y-1/2 ${a.rank === 'boss' ? 'bg-brand-danger shadow-[0_0_5px_var(--color-brand-danger)]' : 'bg-blue-400'}`} />
                    </div>
                )}

                {/* Target Indicator - Only for non-allies */}
                {isTargeted && alignment !== 'ally' && (
                    <div className="absolute top-1 right-1 bg-brand-accent rounded-full p-1 z-30 shadow-lg border border-brand-bg animate-bounce-in">
                        <Icon name="check" className="w-2 h-2 text-black" />
                    </div>
                )}

            </button>

            {/* Status and Buff Indicators (Outside overflow-hidden) */}
            {((hasStatus || (a.statusEffects && a.statusEffects.length > 0)) || (a.activeBuffs && a.activeBuffs.length > 0)) && (
                <div 
                    className="absolute -top-1 -right-1 z-50 flex flex-col items-center gap-0.5"
                    title={[
                        ...(a.statusEffects || []).map((s: any) => s.name),
                        ...(a.activeBuffs || []).map((b: any) => b.name)
                    ].join(', ')}
                >
                    {a.activeBuffs && a.activeBuffs.length > 0 && (
                        <div className="w-4 h-4 bg-brand-accent rounded-full border border-brand-bg shadow-lg flex items-center justify-center animate-pulse">
                            <Icon name="chevronUp" className="w-3 h-3 text-black" />
                        </div>
                    )}
                    {a.statusEffects && a.statusEffects.length > 0 && (
                        <div className="w-4 h-4 bg-brand-danger rounded-full border border-brand-bg shadow-lg flex items-center justify-center">
                            <Icon name="chevronDown" className="w-3 h-3 text-white" />
                        </div>
                    )}
                </div>
            )}

            {/* Name and Status Bars */}
            <div className={`w-full flex flex-col items-center ${showBars ? 'mt-1.5' : 'mt-1'}`}>
                {showName && (
                    <span className={`text-body-tiny font-bold text-center truncate w-full mb-0.5 ${isActive || isTargeted ? 'text-brand-text' : 'text-brand-text-muted opacity-80'}`}>
                        {a.name}
                    </span>
                )}

                {showBars && (
                    <div className="w-full bg-[var(--color-status-bg)] rounded-full overflow-hidden border border-[var(--color-status-border)] flex flex-col shadow-inner">
                        {/* HP Bar */}
                        <div 
                            className="w-full relative" 
                            style={{ height: size > 50 ? 'var(--status-bar-height-combat)' : 'var(--status-bar-height)' }}
                        >
                            <div 
                                className="h-full transition-all duration-500 ease-out"
                                style={{ 
                                    width: `${hpRatio * 100}%`,
                                    backgroundColor: finalHpColor
                                }}
                            />
                        </div>
                        
                        {/* Shield Bar (Temp HP) */}
                        {maxTempHp > 0 && (
                            <div 
                                className="w-full relative border-t border-[var(--color-status-border)]"
                                style={{ height: size > 50 ? 'var(--status-bar-height-combat)' : 'var(--status-bar-height)' }}
                            >
                                <div 
                                    className="h-full transition-all duration-700 ease-out opacity-90 shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                                    style={{ 
                                        width: `${tempRatio * 100}%`,
                                        backgroundColor: 'var(--color-status-shield)'
                                    }}
                                />
                            </div>
                        )}

                        {/* Stamina Bar */}
                        {maxStamina > 0 && (
                            <div 
                                className="w-full relative border-t border-[var(--color-status-border)]"
                                style={{ height: size > 50 ? 'var(--status-bar-height-combat)' : 'var(--status-bar-height)' }}
                            >
                                <div 
                                    className="h-full transition-all duration-700 ease-out opacity-90 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                    style={{ 
                                        width: `${staminaRatio * 100}%`,
                                        backgroundColor: 'var(--color-status-stamina)'
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

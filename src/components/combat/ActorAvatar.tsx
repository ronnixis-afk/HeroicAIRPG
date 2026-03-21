
// components/combat/ActorAvatar.tsx

import React from 'react';
import { CombatActor } from '../../types';
import { canBeTargeted } from '../../utils/resolution/StatusRules';
import { Icon } from '../Icon';

interface ActorAvatarProps {
    actor: CombatActor;
    isActive: boolean;
    onClick: () => void;
}

export const ActorAvatar: React.FC<ActorAvatarProps> = ({ actor, isActive, onClick }) => {
    const isDefeated = (actor.currentHitPoints ?? 0) <= 0;
    const currentHp = actor.currentHitPoints || 0;
    const maxHp = actor.maxHitPoints || 1;
    const hpRatio = currentHp / maxHp;
    const hpPercent = Math.max(0, Math.min(1, hpRatio));

    // Fix: Access temporary hit points from updated CombatActor interface
    const tempHp = actor.temporaryHitPoints || 0;
    const maxTempHp = actor.maxTemporaryHitPoints || 0;
    const tempHpRatio = maxTempHp > 0 ? Math.max(0, Math.min(1, tempHp / maxTempHp)) : 0;
    
    // Add stamina properties for ActorAvatar
    const currentStamina = (actor as any).stamina || 0;
    const maxStamina = (actor as any).maxStamina || 0;
    const staminaRatio = maxStamina > 0 ? Math.max(0, Math.min(1, currentStamina / maxStamina)) : 0;

    const targetable = canBeTargeted(actor);

    const hpColor = actor.alignment === 'ally' || actor.isAlly ? '#3ecf8e' : (actor.alignment === 'neutral' ? '#facc15' : '#ef4444');
    const tempColor = '#38bdf8'; // Brand Light Blue
    const staminaColor = '#f59e0b'; // Brand gold/yellow
    const initials = actor.name.slice(0, 2);

    const hasStatus = (actor.statusEffects?.length || 0) > 0;
    const isLowHp = !isDefeated && hpRatio <= 0.25;

    return (
        <button
            onClick={onClick}
            className={`
                relative flex flex-col items-center justify-center transition-all duration-200 group
                ${isActive ? 'scale-110 z-10' : 'hover:scale-105'}
                ${!targetable ? 'opacity-40 grayscale-[0.5]' : ''}
            `}
            title={`${actor.name} (${currentHp}/${maxHp} Hp)${!targetable ? ' [Untargetable]' : ''}`}
        >
            <div className="relative w-20 h-20">
                <div className={`
                    absolute inset-0 rounded-xl overflow-hidden flex items-center justify-center border-2 transition-all
                    ${isActive ? 'border-brand-text' : 'border-brand-primary'}
                    bg-brand-surface ${isDefeated ? 'grayscale brightness-50' : ''}
                `}>
                    {(actor as any).imageUrl || (actor as any).image ? (
                        <img 
                            src={(actor as any).imageUrl || (actor as any).image} 
                            alt={actor.name} 
                            className="w-full h-full object-cover" 
                        />
                    ) : (
                        <div className={`text-xl font-black ${actor.alignment === 'ally' || actor.isAlly ? 'text-brand-accent' : (actor.alignment === 'neutral' ? 'text-yellow-400' : 'text-brand-danger')}`}>
                            {initials}
                        </div>
                    )}

                    {isLowHp && (
                        <div className="absolute inset-0 bg-brand-danger/20 animate-pulse pointer-events-none" />
                    )}
                </div>

                {hasStatus && (
                    <div className="absolute top-[-2px] right-[-2px] w-4 h-4 bg-yellow-500 rounded-full border-2 border-brand-bg shadow-sm z-20" />
                )}

                {!targetable && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                        <Icon name="eye" className="w-8 h-8 text-brand-accent drop-shadow-lg opacity-80" />
                    </div>
                )}

                {actor.rank && actor.rank !== 'normal' && (
                    <div className="absolute top-[-2px] left-[-2px] z-20">
                        <div className={`w-3 h-3 rotate-45 border border-brand-bg ${actor.rank === 'boss' ? 'bg-brand-danger' : 'bg-blue-400'}`} />
                    </div>
                )}
            </div>

            {/* Health and Shield Bars */}
            <div className="mt-2 w-full px-1">
                <div className="w-full bg-black/40 rounded-full overflow-hidden border border-white/5 flex flex-col shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                    {/* HP Bar */}
                    <div className="h-1.5 w-full relative">
                        <div 
                            className="h-full transition-all duration-500 ease-out"
                            style={{ 
                                width: `${hpPercent * 100}%`,
                                backgroundColor: hpColor
                            }}
                        />
                    </div>
                    
                    {/* Shield Bar (Temp HP) */}
                    {maxTempHp > 0 && (
                        <div className="h-1.5 w-full relative border-t border-white/5">
                            <div 
                                className="h-full transition-all duration-700 ease-out opacity-90 shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                                style={{ 
                                    width: `${tempHpRatio * 100}%`,
                                    backgroundColor: tempColor
                                }}
                            />
                        </div>
                    )}
                    
                    {/* Stamina Bar */}
                    {maxStamina > 0 && (
                        <div className="h-1.5 w-full relative border-t border-white/5">
                            <div 
                                className="h-full transition-all duration-700 ease-out opacity-90 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                style={{ 
                                    width: `${staminaRatio * 100}%`,
                                    backgroundColor: staminaColor
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            <span className={`mt-1 text-body-tiny truncate max-w-[80px] font-bold ${isActive ? 'text-brand-text' : 'text-brand-text-muted'} ${!targetable ? 'italic' : ''}`}>
                {actor.name}
            </span>

        </button>
    );
};

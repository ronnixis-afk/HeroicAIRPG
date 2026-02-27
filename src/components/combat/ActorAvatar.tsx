
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

    const targetable = canBeTargeted(actor);
    
    // SVG Calc
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - hpPercent);
    const strokeWidth = 4;

    const tempRadius = radius + 3;
    const tempCircumference = 2 * Math.PI * tempRadius;
    const tempDashoffset = tempCircumference * (1 - tempHpRatio);
    
    const ringColor = actor.isAlly ? '#3ecf8e' : '#ef4444'; 
    const tempColor = '#38bdf8'; // Brand Light Blue
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
                <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90 drop-shadow-md" viewBox="0 0 80 80">
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        fill="transparent"
                        stroke="#1e1e1e"
                        strokeWidth={strokeWidth}
                    />
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        fill="transparent"
                        stroke={ringColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-500 ease-out"
                    />

                    {/* Outer Shield/Temp HP Ring */}
                    {maxTempHp > 0 && (
                        <circle
                            cx={40}
                            cy={40}
                            r={tempRadius}
                            fill="transparent"
                            stroke={tempColor}
                            strokeWidth={2}
                            strokeDasharray={tempCircumference}
                            strokeDashoffset={tempDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-700 ease-out opacity-80"
                        />
                    )}
                </svg>

                <div className={`
                    absolute inset-[6px] rounded-full overflow-hidden flex items-center justify-center border-2 transition-all
                    ${isActive ? 'border-brand-text' : 'border-brand-primary'}
                    bg-brand-surface ${isDefeated ? 'grayscale brightness-50' : ''}
                `}>
                    <div className={`text-xl font-black ${actor.isAlly ? 'text-brand-accent' : 'text-brand-danger'}`}>
                        {initials}
                    </div>
                    
                    {isLowHp && (
                        <div className="absolute inset-0 bg-brand-danger/20 animate-pulse pointer-events-none" />
                    )}
                </div>
                
                {hasStatus && (
                    <div className="absolute top-0 right-0 w-4 h-4 bg-yellow-500 rounded-full border-2 border-brand-bg shadow-sm z-20" />
                )}

                {!targetable && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                        <Icon name="eye" className="w-8 h-8 text-brand-accent drop-shadow-lg opacity-80" />
                    </div>
                )}
                
                {actor.rank && actor.rank !== 'normal' && (
                    <div className="absolute bottom-0 right-0 z-20">
                         <div className={`w-3 h-3 rotate-45 border border-brand-bg ${actor.rank === 'boss' ? 'bg-brand-danger' : 'bg-blue-400'}`} />
                    </div>
                )}
            </div>
            
            <span className={`mt-2 text-body-tiny truncate max-w-[80px] ${isActive ? 'text-brand-text' : 'text-brand-text-muted'} ${!targetable ? 'italic' : ''}`}>
                {actor.name}
            </span>
        </button>
    );
};

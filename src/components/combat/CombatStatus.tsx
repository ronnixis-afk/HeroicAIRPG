
// components/combat/CombatStatus.tsx

import React, { useContext, useRef, useEffect, useState } from 'react';
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { type StatusEffect, type CombatActor, PlayerCharacter, Companion } from '../../types';
import { Icon } from '../Icon';
import { getTempHpLabel } from '../../utils/itemModifiers';

interface CombatAvatarProps {
  name: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  maxTempHp: number;
  isAlly: boolean;
  isCurrentTurn: boolean;
  statusEffects: StatusEffect[];
  imageUrl?: string;
}

const CombatAvatar: React.FC<CombatAvatarProps> = ({ name, hp, maxHp, tempHp, maxTempHp, isAlly, isCurrentTurn, statusEffects, imageUrl }) => {
  const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const tempHpRatio = maxTempHp > 0 ? Math.max(0, Math.min(1, tempHp / maxTempHp)) : 0;
  
  const visualSize = isCurrentTurn ? 50 : 40;
  const strokeWidth = 3;
  const containerSize = visualSize + 12; // Increased to fit outer shield ring
  
  const center = containerSize / 2;
  const radius = (visualSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - hpRatio);

  const tempRadius = radius + 4;
  const tempCircumference = 2 * Math.PI * tempRadius;
  const tempDashoffset = tempCircumference * (1 - tempHpRatio);

  const ringColor = isAlly ? '#3ecf8e' : '#ef4444';
  const tempColor = '#38bdf8'; // Brand Light Blue
  const initials = name.slice(0, 2);

  const hasStatus = statusEffects && statusEffects.length > 0;
  const isDead = hp <= 0;
  const isLowHp = !isDead && hpRatio <= 0.25;

  return (
    <div 
        className={`flex flex-col items-center justify-center transition-all duration-300 ${isCurrentTurn ? 'opacity-100 scale-100' : 'opacity-40 scale-100'}`}
        title={`${name} (${hp}/${maxHp} Hit Points)${tempHp > 0 ? ` + ${tempHp} Shield` : ''}`}
    >
        <div className="relative" style={{ width: containerSize, height: containerSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isCurrentTurn && (
                <div className="absolute inset-0 rounded-full bg-brand-accent/20 blur-md scale-110" />
            )}

            <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90 z-10 pointer-events-none" viewBox={`0 0 ${containerSize} ${containerSize}`}>
                {/* Health Ring */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke="#242424"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={center}
                    cy={center}
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
                        cx={center}
                        cy={center}
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

            <div 
                className={`absolute rounded-full overflow-hidden flex items-center justify-center bg-brand-surface z-0 border border-brand-primary transition-all ${isDead ? 'grayscale brightness-50' : ''}`}
                style={{ 
                    width: radius * 2, 
                    height: radius * 2 
                }}
            >
                {imageUrl ? (
                    <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                    <span className={`font-bold ${isAlly ? 'text-brand-accent' : 'text-brand-danger'}`} style={{ fontSize: isCurrentTurn ? '14px' : '12px' }}>
                        {initials}
                    </span>
                )}
                
                {isLowHp && (
                    <div className="absolute inset-0 bg-brand-danger/20 animate-pulse pointer-events-none" />
                )}
            </div>

            {hasStatus && (
                <div 
                    className="absolute top-1 right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full border border-brand-bg z-20 shadow-sm" 
                    title={statusEffects.map(e => e.name).join(', ')}
                />
            )}
        </div>
    </div>
  );
};


const CombatStatusDisplay: React.FC = () => {
    const { gameData, moveInTurnOrder, removeFromTurnOrder } = useContext(GameDataContext) as GameDataContextType;
    const { setActiveView, navigateToCharacter } = useUI();
    const { combatState, playerCharacter, companions, playerInventory, companionInventories } = gameData ?? {};
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    if (!combatState?.isActive || !playerCharacter) {
        return null;
    }

    const tempHpLabel = getTempHpLabel(gameData?.skillConfiguration);

    // Build normalized actor objects for display logic
    const allActors = [
        { 
            ...playerCharacter, 
            isAlly: true, 
            imageUrl: playerCharacter.imageUrl, 
            rank: 'player',
            temporaryHitPoints: playerCharacter.temporaryHitPoints,
            maxTemporaryHitPoints: playerCharacter.getMaxTemporaryHitPoints(playerInventory || { equipped: [], carried: [], storage: [], assets: [] })
        },
        ...(companions || []).map(c => ({ 
            ...c, 
            isAlly: true, 
            imageUrl: c.imageUrl, 
            rank: 'companion',
            temporaryHitPoints: c.temporaryHitPoints,
            maxTemporaryHitPoints: c.getMaxTemporaryHitPoints(companionInventories?.[c.id] || { equipped: [], carried: [], storage: [], assets: [] })
        })),
        ...combatState.enemies.map(e => ({ ...e, isAlly: !!e.isAlly, imageUrl: undefined })),
    ];

    const combatantsInOrder = (combatState.turnOrder || [])
        .map(identifier => {
            let actor = allActors.find(a => a.id === identifier);
            if (actor) return actor;
            actor = allActors.find(a => a.name === identifier);
            if (actor) return actor;
            return undefined;
        })
        .filter((c): c is NonNullable<typeof c> => c !== undefined);
        
    const currentTurnIdentifier = (combatState.turnOrder || [])[combatState.currentTurnIndex];
    let currentTurnDisplayId: string | null = null;
    const currentActor = allActors.find(a => a.id === currentTurnIdentifier || a.name === currentTurnIdentifier);
    if (currentActor) {
        currentTurnDisplayId = currentActor.id;
    }

    useEffect(() => {
        if (combatState?.isActive && scrollContainerRef.current && currentTurnDisplayId && !isExpanded) {
            const activeCardContainer = scrollContainerRef.current.querySelector(`[data-actor-id="${currentTurnDisplayId}"]`);
            if (activeCardContainer) {
                activeCardContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [combatState, currentTurnDisplayId, isExpanded]);

    const getActorNameColor = (actor: any) => {
        if (actor.isAlly) return 'text-brand-accent';
        if (actor.rank === 'boss') return 'text-brand-danger font-bold';
        if (actor.rank === 'elite') return 'text-blue-400';
        return 'text-brand-danger';
    };

    return (
        <div 
            className={`w-full z-30 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-primary/50 shadow-lg transition-all duration-300 ease-in-out flex flex-col flex-shrink-0 ${isExpanded ? 'h-[60vh]' : 'h-24 cursor-pointer'}`}
            onClick={() => !isExpanded && setIsExpanded(true)}
        >
            {!isExpanded && (
                <div 
                    ref={scrollContainerRef}
                    className="w-full flex items-center gap-2 px-4 pt-1 pb-2 overflow-x-auto overflow-y-hidden custom-scroll scroll-smooth flex-grow"
                >
                    {combatantsInOrder.map((combatant) => {
                        if (!combatant) return null;
                        return (
                            <div key={combatant.id} data-actor-id={combatant.id} className="flex-shrink-0 flex items-center justify-center">
                                <CombatAvatar
                                    name={combatant.name}
                                    hp={combatant.currentHitPoints ?? combatant.maxHitPoints ?? 0}
                                    maxHp={combatant.maxHitPoints ?? 0}
                                    // Fix: Explicitly cast combatant to any to safely access normalized temporary HP properties
                                    tempHp={(combatant as any).temporaryHitPoints ?? 0}
                                    maxTempHp={(combatant as any).maxTemporaryHitPoints ?? 0}
                                    isAlly={combatant.isAlly}
                                    isCurrentTurn={combatant.id === currentTurnDisplayId}
                                    statusEffects={combatant.statusEffects}
                                    imageUrl={(combatant as any).imageUrl}
                                />
                            </div>
                        )
                    })}
                </div>
            )}

            {isExpanded && (
                <div className="flex flex-col h-full animate-fade-in" onClick={e => e.stopPropagation()}>
                    <div className="p-4 pb-2 flex justify-between items-center border-b border-brand-primary/20">
                        <h4 className="text-brand-text-muted">Initiative Order</h4>
                        <div className="text-body-sm text-brand-text-muted font-bold">Round {combatState.round}</div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scroll p-4 py-2 space-y-2">
                        {combatantsInOrder.map((actor, index) => {
                            const isFullCharacter = actor.rank === 'player' || actor.rank === 'companion';
                            
                            return (
                                <div 
                                    key={`${actor.id}-${index}`} 
                                    className={`flex items-center bg-brand-primary p-3 rounded-xl border transition-all ${actor.id === currentTurnIdentifier ? 'border-brand-accent shadow-lg shadow-brand-accent/5' : 'border-brand-surface'}`}
                                >
                                    <span className="font-bold text-brand-text-muted text-body-sm w-6 text-center tabular-nums">{index + 1}</span>
                                    
                                    {isFullCharacter ? (
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                navigateToCharacter(actor.rank === 'player' ? 'player' : actor.id);
                                            }}
                                            className="flex-grow px-3 py-1 overflow-hidden text-left hover:bg-brand-bg/40 rounded-lg transition-all group/row border border-transparent hover:border-brand-accent/20"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`font-bold text-body-base truncate ${getActorNameColor(actor)} group-hover/row:text-brand-accent transition-colors`}>{actor.name}</div>
                                                <Icon name="character" className="w-3 h-3 text-brand-accent opacity-0 group-hover/row:opacity-100 transition-all -translate-x-1 group-hover/row:translate-x-0" />
                                                {(actor as any).rank === 'boss' && <span className="text-[10px] bg-brand-danger/20 text-brand-danger px-1.5 py-0.5 rounded-lg font-bold border border-brand-danger/20">Boss</span>}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-brand-text-muted mt-1">
                                                <span className={`font-bold ${actor.currentHitPoints && actor.currentHitPoints <= 0 ? 'text-brand-danger' : ''}`}>
                                                    Hit Points: {actor.currentHitPoints}/{actor.maxHitPoints}
                                                </span>
                                                {/* Fix: Explicitly cast actor to any to safely access normalized temporary HP properties */}
                                                {((actor as any).temporaryHitPoints !== undefined && ((actor as any).temporaryHitPoints > 0 || ((actor as any).maxTemporaryHitPoints || 0) > 0)) && (
                                                    <span className="font-bold text-sky-400">
                                                        {tempHpLabel}: {(actor as any).temporaryHitPoints}/{(actor as any).maxTemporaryHitPoints}
                                                    </span>
                                                )}
                                                {actor.statusEffects && actor.statusEffects.length > 0 && (
                                                    <div className="flex gap-1">
                                                        {actor.statusEffects.map((ef, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-500 text-[10px] border border-yellow-500/20 font-bold">{ef.name} ({ef.duration})</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ) : (
                                        <div className="flex-grow px-3 py-1 overflow-hidden">
                                            <div className="flex items-center gap-2">
                                                <div className={`font-bold text-body-base truncate ${getActorNameColor(actor)}`}>{actor.name}</div>
                                                {(actor as any).rank === 'boss' && <span className="text-[10px] bg-brand-danger/20 text-brand-danger px-1.5 py-0.5 rounded-lg font-bold border border-brand-danger/20">Boss</span>}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-brand-text-muted mt-1">
                                                <span className={`font-bold ${actor.currentHitPoints && actor.currentHitPoints <= 0 ? 'text-brand-danger' : ''}`}>
                                                    Hit Points: {actor.currentHitPoints}/{actor.maxHitPoints}
                                                </span>
                                                {/* Fix: Explicitly cast actor to any to safely access normalized temporary HP properties */}
                                                {((actor as any).temporaryHitPoints !== undefined && ((actor as any).temporaryHitPoints > 0 || ((actor as any).maxTemporaryHitPoints || 0) > 0)) && (
                                                    <span className="font-bold text-sky-400">
                                                        {tempHpLabel}: {(actor as any).temporaryHitPoints}/{(actor as any).maxTemporaryHitPoints}
                                                    </span>
                                                )}
                                                {actor.statusEffects && actor.statusEffects.length > 0 && (
                                                    <div className="flex gap-1">
                                                        {actor.statusEffects.map((ef, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-500 text-[10px] border border-yellow-500/20 font-bold">{ef.name} ({ef.duration})</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); moveInTurnOrder(actor.id, 'up'); }} disabled={index === 0} className="btn-icon p-1.5 text-brand-text-muted hover:text-brand-text disabled:opacity-20 transition-all active:scale-90"><Icon name="chevronUp" className="w-4 h-4" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); moveInTurnOrder(actor.id, 'down'); }} disabled={index === combatantsInOrder.length - 1} className="btn-icon p-1.5 text-brand-text-muted hover:text-brand-text disabled:opacity-20 transition-all active:scale-90"><Icon name="chevronDown" className="w-4 h-4" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); removeFromTurnOrder(actor.id); }} className="btn-icon-delete p-1.5 rounded-lg transition-all active:scale-90"><Icon name="close" className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="p-4 pt-2 flex justify-center gap-4 border-t border-brand-primary/20 bg-brand-bg">
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setActiveView('temp-stats'); 
                                setIsExpanded(false); 
                            }}
                            className="btn-primary btn-md flex-1 rounded-xl gap-2 shadow-lg shadow-brand-accent/20"
                        >
                            <Icon name="skull" className="w-4 h-4" />
                            <span>Scene Manager</span>
                        </button>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setIsExpanded(false); 
                            }}
                            className="btn-secondary btn-md flex-1 rounded-xl gap-2"
                        >
                            <Icon name="close" className="w-4 h-4" />
                            <span>Collapse</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CombatStatusDisplay;

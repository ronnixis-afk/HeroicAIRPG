
// components/combat/CombatStatus.tsx

import React, { useContext, useRef, useEffect, useState } from 'react';
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { type StatusEffect, type CombatActor, PlayerCharacter, Companion } from '../../types';
import { ActorAvatar } from '../ActorAvatar';
import { Icon } from '../Icon';
import { getTempHpLabel } from '../../utils/itemModifiers';

interface CombatAvatarProps {
    name: string;
    hp: number;
    maxHp: number;
    tempHp: number;
    maxTempHp: number;
    stamina?: number;
    maxStamina?: number;
    isAlly: boolean;
    alignment: string;
    isCurrentTurn: boolean;
    statusEffects: StatusEffect[];
    imageUrl?: string;
}

const CombatAvatar: React.FC<CombatAvatarProps> = ({ name, hp, maxHp, tempHp, maxTempHp, stamina = 0, maxStamina = 0, isAlly, alignment, isCurrentTurn, statusEffects, imageUrl }) => {
    return (
        <ActorAvatar 
            actor={{ name, imageUrl, alignment, statusEffects, isAlly } as any}
            size={isCurrentTurn ? 50 : 40}
            isActive={isCurrentTurn}
            hpOverride={hp}
            maxHpOverride={maxHp}
            tempHpOverride={tempHp}
            maxTempHpOverride={maxTempHp}
            staminaOverride={stamina}
            maxStaminaOverride={maxStamina}
            showBars={true}
        />
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
            alignment: 'ally',
            imageUrl: playerCharacter.imageUrl,
            rank: 'player',
            temporaryHitPoints: playerCharacter.temporaryHitPoints,
            maxTemporaryHitPoints: playerCharacter.getMaxTemporaryHitPoints(playerInventory || { equipped: [], carried: [], storage: [], assets: [] }),
            stamina: playerCharacter.stamina,
            maxStamina: playerCharacter.maxStamina
        },
        ...(companions || []).map(c => ({
            ...c,
            isAlly: true,
            alignment: 'ally',
            imageUrl: c.imageUrl,
            rank: 'companion',
            temporaryHitPoints: c.temporaryHitPoints,
            maxTemporaryHitPoints: c.getMaxTemporaryHitPoints(companionInventories?.[c.id] || { equipped: [], carried: [], storage: [], assets: [] }),
            stamina: c.stamina,
            maxStamina: c.maxStamina
        })),
        ...combatState.enemies.map(e => ({ ...e, isAlly: e.alignment === 'ally', imageUrl: undefined })),
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
        if (actor.alignment === 'ally' || actor.isAlly === true) return 'text-brand-accent';
        if (actor.rank === 'boss') return 'text-brand-danger font-bold';
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
                                    stamina={(combatant as any).stamina ?? 0}
                                    maxStamina={(combatant as any).maxStamina ?? 0}
                                    isAlly={combatant.isAlly}
                                    alignment={(combatant.alignment as string) || (combatant.isAlly ? 'ally' : 'enemy')}
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
                                                {((actor as any).stamina !== undefined && ((actor as any).maxStamina || 0) > 0) && (
                                                    <span className="font-bold text-[#f59e0b]">
                                                        Stamina: {(actor as any).stamina}/{(actor as any).maxStamina}
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
                                                {((actor as any).stamina !== undefined && ((actor as any).maxStamina || 0) > 0) && (
                                                    <span className="font-bold text-[#f59e0b]">
                                                        Stamina: {(actor as any).stamina}/{(actor as any).maxStamina}
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

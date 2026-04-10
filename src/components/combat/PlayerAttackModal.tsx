// components/combat/PlayerAttackModal.tsx

import React, { useState, useContext, useEffect, useMemo } from 'react';
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import { Item, Ability, PlayerCharacter, Companion, CombatActor, RollMode, Inventory, getItemRarityColor, AbilityEffect, type StatusEffect } from '../../types';
import { toTitleCase } from '../../utils/npcUtils';
import { formatAbilityEffect } from '../../services/ItemGeneratorService';
import AutoResizingTextarea from '../AutoResizingTextarea';
import { canBeTargeted } from '../../utils/resolution/StatusRules';
import Modal from '../Modal';
import { ActorAvatar } from '../ActorAvatar';

interface PlayerAttackModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceActorId?: string;
    isQuickAction?: boolean;
}

interface TargetAssignment {
    targetId: string;
    hand: 'main' | 'off';
}

const formatEffectString = (effect: AbilityEffect, actor?: PlayerCharacter | Companion, inventory?: Inventory | null): string => {
    const dc = actor ? actor.getStandardAbilityDC(inventory || undefined) : effect.dc;
    const damageDice = (actor && effect.type === 'Damage') ? (effect.damageDice || actor.getStandardEffectFormula(effect, inventory || undefined)) : effect.damageDice;
    const healDice = (actor && effect.type === 'Heal') ? (effect.healDice || actor.getStandardEffectFormula(effect, inventory || undefined)) : effect.healDice;

    const displayEffect: AbilityEffect = {
        ...effect,
        dc,
        damageDice,
        healDice
    };

    return formatAbilityEffect(displayEffect);
};

const PlayerAttackModal: React.FC<PlayerAttackModalProps> = ({ isOpen, onClose, sourceActorId, isQuickAction }) => {
    const { gameData, performPlayerAttack } = useContext(GameDataContext) as GameDataContextType;
    const { isHeroicModeActive, setIsHeroicModeActive } = useUI();
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>('primary-attack');
    const [targetCounts, setTargetCounts] = useState<Record<string, number>>({});
    const [assignments, setAssignments] = useState<TargetAssignment[]>([]);
    const [flavorText, setFlavorText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [rollMode, setRollMode] = useState<RollMode>('normal');

    if (!gameData) return null;

    const { actor, inventory } = useMemo<{ actor: PlayerCharacter | Companion | null, inventory: Inventory | null }>(() => {
        if (!gameData) return { actor: null, inventory: null };
        let targetActor: PlayerCharacter | Companion = gameData.playerCharacter;
        let targetInventory = gameData.playerInventory;
        if (sourceActorId && sourceActorId !== gameData.playerCharacter.id) {
            const companion = gameData.companions.find(c => c.id === sourceActorId);
            if (companion) {
                targetActor = companion;
                targetInventory = gameData.companionInventories[companion.id];
            }
        }
        return { actor: targetActor, inventory: targetInventory };
    }, [gameData, sourceActorId]);

    const combatStats = useMemo(() => {
        if (!actor || !inventory) return null;
        return actor.getCombatStats(inventory);
    }, [actor, inventory]);

    const weapons = useMemo(() => {
        if (!inventory) return [];
        return inventory.equipped.filter(item =>
            item.weaponStats ||
            item.tags?.includes('weapon') ||
            item.tags?.includes('heavy weapon')
        );
    }, [inventory]);

    const mainHandWeapon = useMemo(() => {
        return weapons.find(w => w.equippedSlot === 'Main Hand') || weapons[0];
    }, [weapons]);

    const offHandWeapon = useMemo(() => {
        return weapons.find(w => w.equippedSlot === 'Off Hand' && w.id !== mainHandWeapon?.id);
    }, [weapons, mainHandWeapon]);

    const isDualWielding = combatStats?.isDualWielding || false;
    const attacksPerHand: number = combatStats?.baseAttacksPerHand || 1;
    const offHandAttacksAllowed: number = combatStats?.offHandAttacks || 0;

    const heroicPoints = gameData?.playerCharacter?.heroicPoints ?? 0;
    const isPlayerAttacking = actor?.id === gameData?.playerCharacter?.id;

    const abilities = useMemo(() => {
        if (!actor) return [];
        const allAbilities = [...(actor.abilities || []), ...(actor.powers || [])];
        return allAbilities.filter(a => {
            const hasUsage = a.usage && a.usage.type !== 'passive';
            const hasStaminaCost = (a.staminaCost !== undefined && a.staminaCost > 0) || 
                                   (a.effect && ['Heal', 'Damage', 'Status'].includes(a.effect.type));
            return hasUsage || hasStaminaCost || a.tags?.includes('offensive') || a.tags?.includes('attack');
        });
    }, [actor]);

    const items = useMemo(() => {
        const equipped = inventory?.equipped || [];
        const all = isQuickAction ? equipped : [...(inventory?.carried || []), ...equipped];
        return all.filter(i => (i.effect || i.tags?.includes('mechanical')) && !i.tags?.includes('weapon') && !i.tags?.includes('heavy weapon'));
    }, [inventory, isQuickAction]);

    const activeSource = useMemo(() => {
        if (selectedSourceId === 'primary-attack') return undefined;
        return abilities.find(a => a.id === selectedSourceId) || items.find(i => i.id === selectedSourceId);
    }, [abilities, items, selectedSourceId]);

    const mode = useMemo<'weapon' | 'ability' | 'item'>(() => {
        if (selectedSourceId === 'primary-attack') return 'weapon';
        if (abilities.some(a => a.id === selectedSourceId)) return 'ability';
        return 'item';
    }, [selectedSourceId, abilities]);

    const sourceType = useMemo(() => {
        if (mode === 'weapon') return 'Damage';
        if (!activeSource) return 'Unknown';
        if ('effect' in activeSource && activeSource.effect?.type === 'Heal') return 'Heal';
        return 'Damage';
    }, [activeSource, mode]);

    const availableTargets = useMemo((): (CombatActor | PlayerCharacter | Companion)[] => {
        if (!gameData) return [];
        const enemies = gameData.combatState?.enemies || [];
        const allies = [gameData.playerCharacter, ...gameData.companions.filter(c => c.isInParty !== false), ...enemies.filter(e => e.isAlly)];

        let pool: (CombatActor | PlayerCharacter | Companion)[] = [];
        if (isQuickAction && !gameData.combatState?.isActive) {
            pool = allies;
        } else if (sourceType === 'Heal') {
            pool = allies;
        } else {
            pool = enemies.filter(e => !e.isAlly && (e.currentHitPoints || 0) > 0);
        }

        return pool.filter(actor => canBeTargeted(actor));
    }, [sourceType, gameData, isQuickAction]);

    const isMultiTargetAbility = useMemo(() => 
        mode !== 'weapon' && activeSource && 'effect' in activeSource && activeSource.effect?.targetType === 'Multiple', 
    [mode, activeSource]);

    const maxTotalAttacks: number = mode === 'weapon' ? (combatStats?.numberOfAttacks || 1) : 1;

    useEffect(() => {
        if (isOpen && actor && inventory) {
            setSelectedSourceId('primary-attack');
            setTargetCounts({});
            setAssignments([]);
            setFlavorText('');
            setIsProcessing(false);
            setRollMode('normal');
        }
    }, [isOpen, actor, inventory]);

    // Handle auto-targeting when an action is selected
    const selectSource = (id: string | null) => {
        setSelectedSourceId(id);
        setAssignments([]);
        
        // Auto-select all targets if it's a multi-target action
        if (id && id !== 'primary-attack') {
            const source = abilities.find(a => a.id === id) || items.find(i => i.id === id);
            if (source && 'effect' in source && source.effect?.targetType === 'Multiple') {
                // We need to know the sourceType (Heal/Damage) to know availableTargets
                // But sourceType depends on activeSource which is derived from selectedSourceId
                // So we calculate it locally for the trigger
                let localSourceType = 'Damage';
                if (source.effect.type === 'Heal') localSourceType = 'Heal';
                
                const pool = availableTargets; // This might be stale if sourceType hasn't updated yet?
                // Actually availableTargets depends on sourceType which depends on activeSource.
                // It's safer to just set the counts in another useEffect or wait for next render.
            } else {
                setTargetCounts({});
            }
        } else {
            setTargetCounts({});
        }
    };

    // Auto-select targets effect
    useEffect(() => {
        if (isMultiTargetAbility && availableTargets.length > 0) {
            const newCounts: Record<string, number> = {};
            availableTargets.forEach(t => newCounts[t.id] = 1);
            setTargetCounts(newCounts);
        } else if (mode !== 'weapon' && !isMultiTargetAbility) {
            // Keep existing selection if single target? 
            // Or reset. The user said: "Select a target below".
            // But if they click a single target ability, maybe we shouldn't reset?
            // Actually, resetting is cleaner.
            setTargetCounts({});
        }
    }, [selectedSourceId, isMultiTargetAbility, availableTargets.length]);

    const handleTargetClick = (targetId: string) => {
        if (mode === 'weapon') {
            const targetMain = assignments.filter(a => a.targetId === targetId && a.hand === 'main').length;
            const targetOff = assignments.filter(a => a.targetId === targetId && a.hand === 'off').length;
            const totalMain = assignments.filter(a => a.hand === 'main').length;
            const totalOff = assignments.filter(a => a.hand === 'off').length;

            if (totalMain < attacksPerHand) {
                setAssignments([...assignments, { targetId, hand: 'main' }]);
            } else if (isDualWielding && totalOff < offHandAttacksAllowed) {
                setAssignments([...assignments, { targetId, hand: 'off' }]);
            } else {
                if (targetMain > 0 || targetOff > 0) {
                    setAssignments(assignments.filter(a => a.targetId !== targetId));
                }
            }
        } else {
            if (isMultiTargetAbility) {
                const areAllCurrentlySelected = Object.keys(targetCounts).length === availableTargets.length && availableTargets.length > 0;
                if (areAllCurrentlySelected) {
                    setTargetCounts({});
                } else {
                    const newCounts: Record<string, number> = {};
                    availableTargets.forEach(t => newCounts[t.id] = 1);
                    setTargetCounts(newCounts);
                }
            } else {
                const currentCount = targetCounts[targetId] || 0;
                setTargetCounts({ [targetId]: currentCount > 0 ? 0 : 1 });
            }
        }
    };

    const handleConfirm = async () => {
        if (isProcessing || !actor) return;

        const currentActorId = actor.id;

        if (mode === 'weapon') {
            if (assignments.length === 0) return;
            setIsProcessing(true);
            const targetIdList: string[] = assignments.map(a => a.targetId);
            const weaponName = mainHandWeapon?.name || 'Unarmed Strike';
            await performPlayerAttack(mainHandWeapon || { name: weaponName } as Item, targetIdList, flavorText, rollMode, currentActorId);
        } else {
            if (!selectedSourceId || Object.keys(targetCounts).length === 0) return;
            setIsProcessing(true);
            const targetIdList: string[] = [];

            Object.entries(targetCounts).forEach(([targetId, count]) => {
                if (typeof count === 'number') {
                    for (let i = 0; i < count; i++) {
                        targetIdList.push(targetId);
                    }
                }
            });

            if (activeSource) {
                let sourceToUse = activeSource;
                if (mode === 'item' && 'weaponStats' in activeSource) {
                    const stripped = { ...activeSource };
                    delete (stripped as any).weaponStats;
                    sourceToUse = stripped as Item;
                }
                await performPlayerAttack(sourceToUse, targetIdList, flavorText, rollMode, currentActorId);
            }
        }
        setIsProcessing(false);
        onClose();
    };

    const getIconName = (source: Item | Ability) => {
        if ('tags' in source) {
            const tags = source.tags || [];
            if (tags.includes('weapon')) return 'sword';
            if (tags.includes('armor') || tags.includes('shield')) return 'shield';
            if (tags.includes('currency')) return 'currencyCoins';
            if (tags.includes('note') || tags.includes('quest')) return 'clipboardList';
            return 'inventory';
        }
        return 'sparkles';
    };

    const totalAssigned: number = mode === 'weapon' ? assignments.length : Object.values(targetCounts).reduce((acc: number, val: number) => acc + val, 0);

    const footer = (
        <button
            onClick={handleConfirm}
            disabled={totalAssigned === 0 || isProcessing}
            className="btn-primary btn-lg w-full gap-3 shadow-xl shadow-brand-accent/20 rounded-2xl font-medium"
        >
            {isProcessing ? (
                <><Icon name="spinner" className="w-5 h-5 animate-spin" /><span>{gameData.combatConfiguration?.narrativeCombat ? 'Syncing Round...' : 'Processing...'}</span></>
            ) : (
                <><Icon name={isQuickAction ? "sparkles" : "sword"} className="w-5 h-5" /><span>{isQuickAction ? 'Perform Action' : 'Execute Maneuver'}</span></>
            )}
        </button>
    );

    if (!actor) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={actor.name}
            footer={footer}
            maxWidth="md"
        >
            <div className="space-y-6 py-2 animate-fade-in px-1">

                {gameData.combatConfiguration?.narrativeCombat && (
                    <div className="bg-brand-accent/10 border border-brand-accent/20 p-4 rounded-2xl flex items-center gap-4 shadow-inner">
                        <Icon name="sparkles" className="w-6 h-6 text-brand-accent shrink-0" />
                        <p className="text-body-sm text-brand-accent font-medium leading-relaxed">
                            Narrative Combat Active: Round Summary Will Be Generated Cinematically.
                        </p>
                    </div>
                )}

                {/* Primary Attack Section */}
                <div className="space-y-4">
                    <label className="block text-xs font-bold text-brand-text-muted ml-1">Primary Attack</label>
                    <button
                        onClick={() => selectSource('primary-attack')}
                        className={`w-full text-left bg-brand-primary/10 rounded-2xl p-4 border-2 transition-all flex items-center gap-4 group relative overflow-hidden shadow-sm ${selectedSourceId === 'primary-attack' ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20' : 'border-brand-surface hover:border-brand-primary/50'}`}
                    >
                        <div className="shrink-0 group-hover:scale-110 transition-transform">
                            <Icon name="sword" className={`w-6 h-6 text-brand-accent transition-opacity ${selectedSourceId === 'primary-attack' ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-3">
                            <p className="text-body-base font-bold text-brand-text truncate">
                                {mainHandWeapon ? mainHandWeapon.name : 'Unarmed Strike'}
                                {offHandWeapon ? ` & ${offHandWeapon.name}` : ''}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold text-brand-text bg-brand-surface/30 px-3 py-1.5 rounded-xl border border-brand-surface/50 flex items-center gap-1.5 shadow-sm">
                                    <Icon name="play" className="w-3 h-3 text-brand-accent" />
                                    {combatStats?.toHitBonusString} To Hit
                                </span>
                                <span className="text-[10px] font-bold text-brand-text bg-brand-surface/30 px-3 py-1.5 rounded-xl border border-brand-surface/50 flex items-center gap-1.5 shadow-sm">
                                    <Icon name="sword" className="w-3 h-3 text-brand-accent" />
                                    {combatStats?.damageValue} {combatStats?.damageType}
                                </span>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Abilities Section */}
                {abilities.length > 0 && (
                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-brand-text-muted ml-1">Abilities</label>
                        <div className="space-y-3">
                            {abilities.map(source => {
                                const isSelected = selectedSourceId === source.id;
                                const effect = source.effect;
                                let disabledReason = undefined;
                                let costDisplay = '';

                                const implicitCost = (effect && ['Heal', 'Damage', 'Status'].includes(effect.type)) ? 1 : 0;
                                const cost = source.staminaCost !== undefined ? source.staminaCost : implicitCost;

                                if (cost > 0) {
                                    costDisplay = `${cost} Stamina`;
                                    if ((actor as any).stamina < cost) disabledReason = "Not Enough Stamina";
                                } else if (source.usage && source.usage.type !== 'passive' && source.usage.currentUses === 0) {
                                    disabledReason = "0 Charges";
                                    costDisplay = "0 Charges";
                                }

                                return (
                                    <button
                                        key={source.id}
                                        onClick={() => selectSource(source.id)}
                                        disabled={!!disabledReason}
                                        className={`w-full text-left bg-brand-primary/10 rounded-2xl p-4 border-2 transition-all flex flex-col gap-4 relative overflow-hidden group shadow-sm ${isSelected ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20' : 'border-brand-surface hover:border-brand-primary/50'} ${disabledReason ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4 overflow-hidden flex-1">
                                                <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                    <Icon name={getIconName(source)} className="w-6 h-6 text-brand-accent" />
                                                </div>
                                                <div className="flex flex-col truncate flex-1 min-w-0 pr-2 gap-2">
                                                    <span className={`text-body-base font-bold truncate ${isSelected ? 'text-brand-accent' : 'text-brand-text'}`}>{source.name}</span>
                                                    
                                                    <div className="flex flex-col gap-2">
                                                        {effect && (
                                                            <div className="flex items-center gap-2">
                                                                <Icon name="sparkles" className="w-3.5 h-3.5 text-brand-accent/50" />
                                                                <span className="text-xs font-bold text-brand-accent/90">
                                                                    {formatEffectString(effect, actor, inventory || undefined)}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-2">
                                                            {costDisplay && (
                                                                <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${
                                                                    costDisplay.includes('Stamina') 
                                                                        ? 'text-status-stamina bg-status-stamina/10 border-status-stamina/20' 
                                                                        : 'text-brand-accent bg-brand-accent/10 border-brand-accent/20'
                                                                }`}>
                                                                    {costDisplay}
                                                                </span>
                                                            )}
                                                            {disabledReason && <span className="text-[9px] font-bold text-brand-danger bg-brand-danger/10 px-2 py-1 rounded-lg border border-brand-danger/20">{disabledReason}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelected && <Icon name="check" className="w-5 h-5 text-brand-accent shrink-0" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Items Section */}
                {items.length > 0 && (
                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-brand-text-muted ml-1">Items</label>
                        <div className="space-y-3">
                            {items.map(source => {
                                const isSelected = selectedSourceId === source.id;
                                const rarity = source.rarity;
                                const rarityColorClass = getItemRarityColor(rarity);
                                const effect = source.effect;
                                let disabledReason = undefined;
                                let costDisplay = '';

                                if (source.usage && source.usage.type !== 'passive' && source.usage.currentUses === 0 && (!source.quantity || source.quantity <= 1)) {
                                    disabledReason = "0 Charges";
                                    costDisplay = "0 Charges";
                                }

                                return (
                                    <button
                                        key={source.id}
                                        onClick={() => selectSource(source.id)}
                                        disabled={!!disabledReason}
                                        className={`w-full text-left bg-brand-primary/10 rounded-2xl p-4 border-2 transition-all flex flex-col gap-4 relative overflow-hidden group shadow-sm ${isSelected ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20' : 'border-brand-surface hover:border-brand-primary/50'} ${disabledReason ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4 overflow-hidden flex-1">
                                                <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                    <Icon name={getIconName(source)} className={`w-6 h-6 ${rarityColorClass}`} />
                                                </div>
                                                <div className="flex flex-col truncate flex-1 min-w-0 pr-2 gap-2">
                                                    <span className={`text-body-base font-bold truncate ${isSelected ? 'text-brand-accent' : 'text-brand-text'}`}>{source.name}</span>
                                                    
                                                    <div className="flex flex-col gap-2">
                                                        {effect && (
                                                            <div className="flex items-center gap-2">
                                                                <Icon name="sparkles" className="w-3.5 h-3.5 text-brand-accent/50" />
                                                                <span className="text-xs font-bold text-brand-accent/90">
                                                                    {formatEffectString(effect, actor, inventory || undefined)}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-2">
                                                            {rarity && <span className={`text-[9px] font-bold ${rarityColorClass} opacity-80`}>{rarity}</span>}
                                                            {costDisplay && <span className="text-[9px] font-bold text-brand-accent bg-brand-accent/10 px-2 py-1 rounded-lg border border-brand-accent/20">{costDisplay}</span>}
                                                            {disabledReason && <span className="text-[9px] font-bold text-brand-danger bg-brand-danger/10 px-2 py-1 rounded-lg border border-brand-danger/20">{disabledReason}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelected && <Icon name="check" className="w-5 h-5 text-brand-accent shrink-0" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {isPlayerAttacking && (
                    <div className="animate-fade-in space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <label className="block text-xs font-bold text-brand-text-muted mb-2">Heroic Action</label>
                            <span className="text-[8px] font-bold text-brand-text-muted opacity-60">Spend 1 Point For A Legendary Outcome</span>
                        </div>
                        <button
                            onClick={() => { if (heroicPoints > 0) setIsHeroicModeActive(!isHeroicModeActive); }}
                            disabled={heroicPoints <= 0}
                            className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all group ${isHeroicModeActive
                                ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20'
                                : 'border-brand-surface bg-brand-primary/10 hover:border-brand-primary/50'
                                } ${heroicPoints <= 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer shadow-sm'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="shrink-0">
                                    <Icon name={isHeroicModeActive ? "heroicAction" : "heroicActionOutline"} className="w-6 h-6 text-brand-accent" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className={`text-body-base font-bold ${isHeroicModeActive ? 'text-brand-accent' : 'text-brand-text'}`}>
                                        {isHeroicModeActive ? 'Heroic Strike Enabled' : 'Activate Heroic Point'}
                                    </span>
                                    <span className="text-[9px] font-bold text-brand-text-muted opacity-70">
                                        {heroicPoints} Point{heroicPoints !== 1 ? 's' : ''} Available
                                    </span>
                                </div>
                            </div>
                            {isHeroicModeActive && <Icon name="check" className="w-6 h-6 text-brand-accent animate-bounce-in" />}
                        </button>
                    </div>
                )}

                <div className="animate-fade-in space-y-5 pb-4">
                    <div className="flex justify-between items-end px-1">
                        <label className="text-xs font-bold text-brand-text-muted mb-2">Target Selection {sourceType === 'Heal' ? '(Allies)' : ''}</label>
                        <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-3 py-1 rounded-full border border-brand-accent/20 shadow-sm leading-none">
                            {isMultiTargetAbility ? 'Entire Team' : `Slots: ${totalAssigned}/${maxTotalAttacks}`}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-6 px-2">
                        {availableTargets.length === 0 ? (
                            <div className="col-span-full py-10 text-center border-2 border-dashed border-brand-primary/30 rounded-3xl bg-brand-primary/5">
                                <p className="text-body-sm text-brand-text-muted italic">{sourceType === 'Heal' ? 'No Allies Found In Vicinity.' : 'No Valid Threats Detected.'}</p>
                            </div>
                        ) : (
                            availableTargets.map((targetValue: CombatActor | PlayerCharacter | Companion) => {
                                let displayLabel = '';
                                let isSelected = false;
                                if (mode === 'weapon') {
                                    const targetMain = assignments.filter(a => a.targetId === targetValue.id && a.hand === 'main').length;
                                    const targetOff = assignments.filter(a => a.targetId === targetValue.id && a.hand === 'off').length;
                                    isSelected = targetMain > 0 || targetOff > 0;
                                    const labels = [];
                                    if (targetMain > 0) labels.push(`Main x${targetMain}`);
                                    if (targetOff > 0) labels.push(`Off x${targetOff}`);
                                    displayLabel = labels.join(', ');
                                } else {
                                    const count = targetCounts[targetValue.id] || 0;
                                    isSelected = count > 0;
                                    displayLabel = isMultiTargetAbility && isSelected ? 'Entire Team' : (count > 1 ? `x${count}` : '');
                                }

                                return (
                                    <button key={targetValue.id} onClick={() => handleTargetClick(targetValue.id)} className="flex flex-col items-center group transition-all">
                                        <ActorAvatar 
                                            actor={targetValue} 
                                            isTargeted={isSelected} 
                                            size={48}
                                        />
                                        <span className={`text-[10px] font-bold mt-3 truncate w-full text-center transition-colors px-1 ${isSelected ? 'text-brand-text' : 'text-brand-text-muted group-hover:text-brand-text'}`}>{targetValue.name}</span>
                                        {displayLabel && <span className="text-[9px] font-bold text-brand-accent mt-1">{displayLabel}</span>}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="animate-fade-in space-y-3">
                    <label className="block text-xs font-bold text-brand-text-muted mb-2 ml-1">{isQuickAction ? 'Action Intent' : 'Dialogue & Flavor'}</label>
                    <AutoResizingTextarea
                        value={flavorText}
                        onChange={(e) => setFlavorText(e.target.value)}
                        placeholder={isQuickAction ? "How Do You Use This? Describe The Flourish..." : "Declare Your Battle Cry Or Tactical Maneuver..."}
                        className="w-full bg-brand-primary/20 text-brand-text border border-brand-surface rounded-3xl p-5 text-body-base focus:outline-none focus:border-brand-accent focus:bg-brand-primary/40 transition-all placeholder-brand-text-muted/30 min-h-[80px] shadow-inner leading-relaxed"
                    />
                </div>
            </div>
        </Modal>
    );
};

export default PlayerAttackModal;

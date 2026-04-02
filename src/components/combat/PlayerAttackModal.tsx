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
    const [mode, setMode] = useState<'weapon' | 'ability' | 'item'>('weapon');
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
    const [targetCounts, setTargetCounts] = useState<Record<string, number>>({});
    const [assignments, setAssignments] = useState<TargetAssignment[]>([]);
    const [flavorText, setFlavorText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [rollMode, setRollMode] = useState<RollMode>('normal');

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
    const maxTotalAttacks: number = mode === 'weapon' ? (combatStats?.numberOfAttacks || 1) : 1;

    const heroicPoints = gameData?.playerCharacter?.heroicPoints ?? 0;
    const isPlayerAttacking = actor?.id === gameData?.playerCharacter?.id;

    useEffect(() => {
        if (isOpen && actor && inventory) {
            setMode('weapon');
            setSelectedSourceId(null);
            setTargetCounts({});
            setAssignments([]);
            setFlavorText('');
            setIsProcessing(false);
            setRollMode('normal');
            if (weapons.length === 0) setMode('ability');
        }
    }, [isOpen, actor, inventory, weapons.length]);

    const abilities = useMemo(() => {
        if (!actor) return [];
        const activeAbilities = (actor.abilities || []).filter(a => {
            const hasUsage = a.usage && a.usage.type !== 'passive';
            const hasStaminaCost = a.staminaCost !== undefined ? a.staminaCost > 0 : 
                                   (a.effect && ['Heal', 'Damage', 'Status'].includes(a.effect.type));
            return hasUsage || hasStaminaCost || a.tags?.includes('offensive') || a.tags?.includes('attack');
        });

        return activeAbilities;
    }, [actor, isQuickAction]);

    const items = useMemo(() => {
        const equipped = inventory?.equipped || [];
        const all = isQuickAction ? equipped : [...(inventory?.carried || []), ...equipped];
        return all.filter(i => (i.effect || i.tags?.includes('mechanical')) && !i.tags?.includes('weapon') && !i.tags?.includes('heavy weapon'));
    }, [inventory, isQuickAction]);

    const activeSource = useMemo(() => {
        if (mode === 'weapon') return undefined;
        if (mode === 'ability') return abilities.find(a => a.id === selectedSourceId);
        if (mode === 'item') return items.find(i => i.id === selectedSourceId);
        return undefined;
    }, [mode, abilities, items, selectedSourceId]);

    const currentList = useMemo(() => {
        if (mode === 'ability') return abilities;
        if (mode === 'item') return items;
        return [];
    }, [mode, abilities, items]);

    const sourceType = useMemo(() => {
        if (mode === 'weapon') return 'Damage';
        if (!activeSource) return 'Unknown';
        if ('effect' in activeSource && activeSource.effect) {
            if (activeSource.effect.type === 'Heal') return 'Heal';
        }
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

    const isMultiTargetAbility = useMemo(() => mode !== 'weapon' && activeSource && 'effect' in activeSource && activeSource.effect?.targetType === 'Multiple', [mode, activeSource]);

    if (!gameData || !actor) return null;

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

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isQuickAction ? 'Quick Action' : 'Combat Action'}
            footer={footer}
            maxWidth="md"
        >
            <div className="space-y-8 py-2 animate-fade-in">
                {sourceActorId && sourceActorId !== gameData.playerCharacter.id && (
                    <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] text-brand-accent font-bold bg-brand-accent/10 py-1 px-3 rounded-full border border-brand-accent/20">
                            Acting As: {actor.name}
                        </span>
                    </div>
                )}

                {gameData.combatConfiguration?.narrativeCombat && (
                    <div className="bg-brand-accent/10 border border-brand-accent/20 p-4 rounded-2xl flex items-center gap-4 shadow-inner">
                        <Icon name="sparkles" className="w-6 h-6 text-brand-accent shrink-0" />
                        <p className="text-body-sm text-brand-accent font-medium leading-relaxed">
                            Narrative Combat active: Round summary will be generated cinematically.
                        </p>
                    </div>
                )}

                <div className="space-y-3">
                    <label className="block text-xs font-bold text-brand-text-muted mb-2 ml-1">Action Type</label>
                    <div className="flex gap-2 bg-brand-primary/50 p-1 rounded-xl shadow-inner border border-brand-surface">
                        <button onClick={() => { setMode('weapon'); setAssignments([]); setTargetCounts({}); }} className={`flex-1 h-10 px-4 rounded-lg text-xs font-bold transition-all ${mode === 'weapon' ? 'bg-brand-surface text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}`}>Attack</button>
                        <button onClick={() => { setMode('ability'); setSelectedSourceId(null); setTargetCounts({}); }} className={`flex-1 h-10 px-4 rounded-lg text-xs font-bold transition-all ${mode === 'ability' ? 'bg-brand-surface text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}`}>Ability</button>
                        <button onClick={() => { setMode('item'); setSelectedSourceId(null); setTargetCounts({}); }} className={`flex-1 h-10 px-4 rounded-lg text-xs font-bold transition-all ${mode === 'item' ? 'bg-brand-surface text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}`}>Item</button>
                    </div>
                </div>

                {mode === 'weapon' ? (
                    <div className="animate-fade-in bg-brand-primary/20 p-5 rounded-3xl border border-brand-surface shadow-inner flex justify-between items-center group">
                        <div className="flex-1 min-w-0">
                            <label className="block text-[8px] font-bold text-brand-accent mb-2">Standard Strike</label>
                            <p className="text-body-lg font-bold text-brand-text truncate mb-3">
                                {mainHandWeapon ? mainHandWeapon.name : 'Unarmed Strike'}
                                {offHandWeapon ? ` & ${offHandWeapon.name}` : ''}
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-[10px] font-bold text-brand-text bg-brand-surface/50 px-3 py-1.5 rounded-xl border border-brand-surface flex items-center gap-2 shadow-sm">
                                    <Icon name="play" className="w-3 h-3 text-brand-accent" />
                                    {combatStats?.toHitBonusString} To Hit
                                </span>
                                <span className="text-[10px] font-bold text-brand-text bg-brand-surface/50 px-3 py-1.5 rounded-xl border border-brand-surface flex items-center gap-2 shadow-sm">
                                    <Icon name="sword" className="w-3 h-3 text-brand-accent" />
                                    {combatStats?.damageValue} {combatStats?.damageType}
                                </span>
                            </div>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-brand-surface flex items-center justify-center border border-brand-primary shadow-xl group-hover:scale-105 transition-transform ml-4 shrink-0">
                            <Icon name="sword" className="w-7 h-7 text-brand-accent opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in space-y-4">
                        <label className="block text-xs font-bold text-brand-text-muted mb-2 ml-1">Select {toTitleCase(mode)}</label>
                        {currentList.length === 0 ? (
                            <div className="py-12 text-center border-2 border-dashed border-brand-primary/30 rounded-3xl bg-brand-primary/5">
                                <p className="text-body-sm text-brand-text-muted italic">No {mode}s available in current loadout.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {currentList.map(source => {
                                    const isSelected = selectedSourceId === source.id;
                                    const rarity = 'rarity' in source ? source.rarity : undefined;
                                    const rarityColorClass = getItemRarityColor(rarity);
                                    const effect = 'effect' in source ? source.effect : undefined;

                                    let disabledReason = undefined;
                                    let costDisplay = '';

                                    if (!('rarity' in source) && mode === 'ability') {
                                        // It's an Ability (Trait)
                                        const ability = source as Ability;
                                        const implicitCost = (effect && ['Heal', 'Damage', 'Status'].includes(effect.type)) ? 1 : 0;
                                        const cost = ability.staminaCost !== undefined ? ability.staminaCost : implicitCost;

                                        if (cost > 0) {
                                            costDisplay = `${cost} Stamina`;
                                            if ((actor as any).stamina < cost) disabledReason = "Not enough stamina";
                                        } else if (ability.usage && ability.usage.type !== 'passive' && ability.usage.currentUses === 0) {
                                            disabledReason = "0 Charges";
                                            costDisplay = "0 Charges";
                                        }
                                    } else if (mode === 'item' && 'usage' in source) {
                                        // Item usages
                                        const item = source as Item;
                                        if (item.usage && item.usage.type !== 'passive' && item.usage.currentUses === 0 && (!item.quantity || item.quantity <= 1)) {
                                            disabledReason = "0 Charges";
                                            costDisplay = "0 Charges";
                                        }
                                    }

                                    return (
                                        <button
                                            key={source.id}
                                            onClick={() => { setSelectedSourceId(source.id); setTargetCounts({}); }}
                                            disabled={!!disabledReason}
                                            className={`w-full text-left bg-brand-primary/10 rounded-3xl p-5 border-2 transition-all flex flex-col gap-2 relative overflow-hidden group shadow-sm ${isSelected ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20' : 'border-brand-surface hover:border-brand-primary/50'} ${disabledReason ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-4 overflow-hidden flex-1">
                                                    <div className={`shrink-0 flex items-center justify-center p-3 bg-brand-surface rounded-2xl border border-brand-primary shadow-inner group-hover:scale-105 transition-transform ${isSelected ? 'border-brand-accent/30' : ''}`}>
                                                        <Icon name={getIconName(source)} className={`w-5 h-5 ${rarityColorClass}`} />
                                                    </div>
                                                    <div className="flex flex-col truncate flex-1 min-w-0 pr-2">
                                                        <span className={`text-body-base font-bold truncate ${isSelected ? 'text-brand-accent' : 'text-brand-text'}`}>{source.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            {rarity && <span className={`text-[8px] font-bold ${rarityColorClass} opacity-80`}>{toTitleCase(rarity || 'Core')}</span>}
                                                            {costDisplay && <span className="text-[8px] font-bold text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded border border-brand-accent/20">{costDisplay}</span>}
                                                            {disabledReason && <span className="text-[8px] font-bold text-brand-danger bg-brand-danger/10 px-1.5 py-0.5 rounded border border-brand-danger/20">{disabledReason}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isSelected && <Icon name="check" className="w-5 h-5 text-brand-accent shrink-0" />}
                                            </div>

                                            <p className="text-body-sm text-brand-text-muted line-clamp-2 italic px-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                {source.description}
                                            </p>

                                            {effect && (
                                                <div className="mt-2 pt-3 border-t border-brand-primary/10 flex items-center gap-3">
                                                    <Icon name="sparkles" className="w-4 h-4 text-brand-accent/50" />
                                                    <span className="text-[10px] font-bold text-brand-accent">
                                                        {formatEffectString(effect, actor, inventory)}
                                                    </span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
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
                            className={`w-full flex items-center justify-between p-5 rounded-3xl border-2 transition-all group ${isHeroicModeActive
                                ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20'
                                : 'border-brand-surface bg-brand-primary/10 hover:border-brand-primary/50'
                                } ${heroicPoints <= 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer shadow-sm'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl border transition-colors ${isHeroicModeActive ? 'bg-brand-accent text-black border-brand-accent shadow-lg shadow-brand-accent/20' : 'bg-brand-surface text-brand-text-muted border-brand-primary shadow-inner'}`}>
                                    <Icon name={isHeroicModeActive ? "heroicAction" : "heroicActionOutline"} className="w-5 h-5" />
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

                {(mode === 'weapon' || selectedSourceId) && (
                    <div className="animate-fade-in space-y-5">
                        <div className="flex justify-between items-end px-1">
                            <label className="text-xs font-bold text-brand-text-muted mb-2">Target Selection {sourceType === 'Heal' ? '(Allies)' : ''}</label>
                            <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-3 py-1 rounded-full border border-brand-accent/20 shadow-sm leading-none">
                                {isMultiTargetAbility ? 'Entire Team' : `Slots: ${totalAssigned}/${maxTotalAttacks}`}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-6 px-2">
                            {availableTargets.length === 0 ? (
                                <div className="col-span-full py-10 text-center border-2 border-dashed border-brand-primary/30 rounded-3xl bg-brand-primary/5">
                                    <p className="text-body-sm text-brand-text-muted italic">{sourceType === 'Heal' ? 'No allies found in vicinity.' : 'No valid threats detected.'}</p>
                                </div>
                            ) : (
                                availableTargets.map((target: CombatActor | PlayerCharacter | Companion) => {
                                    let displayLabel = '';
                                    let isSelected = false;
                                    if (mode === 'weapon') {
                                        const targetMain = assignments.filter(a => a.targetId === target.id && a.hand === 'main').length;
                                        const targetOff = assignments.filter(a => a.targetId === target.id && a.hand === 'off').length;
                                        isSelected = targetMain > 0 || targetOff > 0;
                                        const labels = [];
                                        if (targetMain > 0) labels.push(`Main x${targetMain}`);
                                        if (targetOff > 0) labels.push(`Off x${targetOff}`);
                                        displayLabel = labels.join(', ');
                                    } else {
                                        const count = targetCounts[target.id] || 0;
                                        isSelected = count > 0;
                                        displayLabel = isMultiTargetAbility && isSelected ? 'Entire Team' : (count > 1 ? `x${count}` : '');
                                    }

                                    return (
                                        <button key={target.id} onClick={() => handleTargetClick(target.id)} className="flex flex-col items-center group transition-all">
                                            <ActorAvatar 
                                                actor={target} 
                                                isTargeted={isSelected} 
                                                size={48}
                                            />
                                            <span className={`text-[10px] font-bold mt-3 truncate w-full text-center transition-colors px-1 ${isSelected ? 'text-brand-text' : 'text-brand-text-muted group-hover:text-brand-text'}`}>{target.name}</span>
                                            {displayLabel && <span className="text-[9px] font-bold text-brand-accent mt-1">{displayLabel}</span>}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {(mode === 'weapon' || selectedSourceId) && (
                    <div className="animate-fade-in space-y-3">
                        <label className="block text-xs font-bold text-brand-text-muted mb-2 ml-1">{isQuickAction ? 'Action Intent' : 'Dialogue & Flavor'}</label>
                        <AutoResizingTextarea
                            value={flavorText}
                            onChange={(e) => setFlavorText(e.target.value)}
                            placeholder={isQuickAction ? "How do you use this? Describe the flourish..." : "Declare your battle cry or tactical maneuver..."}
                            className="w-full bg-brand-primary/20 text-brand-text border border-brand-surface rounded-3xl p-5 text-body-base focus:outline-none focus:border-brand-accent focus:bg-brand-primary/40 transition-all placeholder-brand-text-muted/30 min-h-[80px] shadow-inner leading-relaxed"
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default PlayerAttackModal;

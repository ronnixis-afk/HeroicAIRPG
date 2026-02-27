// components/combat/PlayerAttackModal.tsx

import React, { useState, useContext, useEffect, useMemo } from 'react';
// Fix: Import GameDataContextType to allow explicit type casting of the context value
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
// Fix: Ensure all type imports are correctly resolved from the barrel file
import { Item, Ability, PlayerCharacter, Companion, CombatActor, RollMode, Inventory, getItemRarityColor, AbilityEffect } from '../../types';
import { getBuffTag } from '../../utils/itemModifiers';
import AutoResizingTextarea from '../AutoResizingTextarea';
import { canBeTargeted } from '../../utils/resolution/StatusRules';

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

const TargetAvatar: React.FC<{ 
    actor: CombatActor | PlayerCharacter | Companion; 
    isSelected: boolean;
    hpPercent: number;
    isAlly: boolean;
}> = ({ actor, isSelected, hpPercent, isAlly }) => {
    const size = 48;
    const strokeWidth = 3;
    const center = size / 2 + 4; 
    const totalSize = size + 8;
    const radius = size / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - (hpPercent / 100));
    
    const ringColor = isAlly ? '#3ecf8e' : '#ef4444';
    const initials = actor.name.slice(0, 2);
    const imageUrl = (actor as any).imageUrl || (actor as any).image;

    return (
        <div className={`relative transition-all duration-300 ${isSelected ? 'scale-110' : 'scale-100'}`} style={{ width: totalSize, height: totalSize }}>
            <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90 z-10 pointer-events-none" viewBox={`0 0 ${totalSize} ${totalSize}`}>
                <circle cx={center} cy={center} r={radius} fill="transparent" stroke="#1a1a1a" strokeWidth={strokeWidth} />
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
            </svg>
            <div className={`absolute rounded-full overflow-hidden flex items-center justify-center bg-brand-surface border-2 transition-all ${isSelected ? 'border-white' : 'border-brand-primary'}`} style={{ width: size, height: size, top: 4, left: 4 }}>
                {imageUrl ? (
                    <img src={imageUrl} alt={actor.name} className="w-full h-full object-cover" />
                ) : (
                    <span className={`font-black text-[8px] ${isAlly ? 'text-brand-accent' : 'text-brand-danger'}`}>{initials}</span>
                )}
            </div>
            {isSelected && (
                <div className="absolute -top-1 -right-1 bg-brand-accent rounded-full p-0.5 z-20 shadow-lg border border-brand-bg animate-bounce-in">
                    <Icon name="check" className="w-2.5 h-2.5 text-black" />
                </div>
            )}
        </div>
    );
};

const formatEffectString = (effect: AbilityEffect, actor?: PlayerCharacter | Companion, inventory?: Inventory | null): string => {
    let parts: string[] = [];
    const dc = actor ? actor.getStandardAbilityDC(inventory || undefined) : effect.dc;
    const damage = (actor && effect.type === 'Damage') ? actor.getStandardEffectFormula(effect, inventory || undefined) : effect.damageDice;
    const heal = (actor && effect.type === 'Heal') ? actor.getStandardEffectFormula(effect, inventory || undefined) : effect.healDice;

    if (effect.type === 'Damage') {
      parts.push(`Deals ${damage || 'damage'}`);
      if (dc && effect.saveAbility) {
        parts.push(`(Dc ${dc} ${effect.saveAbility.slice(0, 3)} save)`);
      }
    } else if (effect.type === 'Heal') {
        parts.push(`Heals ${heal || 'health'}`);
    } else if (effect.type === 'Status') {
      parts.push(`Applies ${effect.status || 'status'}`);
      if (effect.duration) {
        parts.push(`for ${effect.duration} rounds`);
      }
    }
    return parts.join(' ');
};

const PlayerAttackModal: React.FC<PlayerAttackModalProps> = ({ isOpen, onClose, sourceActorId, isQuickAction }) => {
  // Logic centralization: useHeroicPoint removed from local context usage to prevent double-dispatch
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
  const maxTotalAttacks: number = mode === 'weapon' ? (combatStats?.numberOfAttacks || 1) : 1;

  const heroicPoints = gameData?.playerCharacter?.heroicPoints ?? 0;

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
      const activeAbilities = (actor.abilities || []).filter(a => a.usage?.type !== 'passive');
      
      if (isQuickAction) return activeAbilities;
      return activeAbilities.filter(a => (a.effect && (a.effect.type === 'Damage' || a.effect.type === 'Status' || a.effect.type === 'Heal')) || a.tags?.includes('offensive') || a.tags?.includes('attack'));
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
          if (activeSource.effect.healDice) return 'Heal';
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

  if (!isOpen || !gameData || !actor) return null;

  const handleTargetClick = (targetId: string) => {
      if (mode === 'weapon') {
          const targetMain = assignments.filter(a => a.targetId === targetId && a.hand === 'main').length;
          const targetOff = assignments.filter(a => a.targetId === targetId && a.hand === 'off').length;
          const totalMain = assignments.filter(a => a.hand === 'main').length;
          const totalOff = assignments.filter(a => a.hand === 'off').length;
          
          if (totalMain < attacksPerHand) {
              setAssignments([...assignments, { targetId, hand: 'main' }]);
          } else if (isDualWielding && totalOff < attacksPerHand) {
              setAssignments([...assignments, { targetId, hand: 'off' }]);
          } else {
              if (targetMain > 0 || targetOff > 0) {
                  setAssignments(assignments.filter(a => a.targetId !== targetId));
              }
          }
      } else {
          if (isMultiTargetAbility) {
              // For Area of Effect abilities, clicking any target toggles selection for all valid targets
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

      // Phase 1 Remediation: Removed redundant Heroic Point consumption call.
      // Point consumption is now handled solely by the performPlayerAttack hook
      // which monitors the isHeroicModeActive UI state before resolution.

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

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-brand-surface rounded-3xl shadow-2xl w-full max-w-md border border-brand-primary flex flex-col max-h-[90vh] animate-modal" onClick={e => e.stopPropagation()}>
        
        <div className="flex justify-between items-center p-6 pb-2">
          <div className="flex flex-col">
              <h3 className="text-brand-text mb-0 font-bold tracking-tight">{isQuickAction ? 'Quick Action' : 'Combat Action'}</h3>
              {sourceActorId && sourceActorId !== gameData.playerCharacter.id && (
                  <span className="text-[8px] text-brand-accent font-medium capitalize tracking-normal mt-1">
                      Acting as: {actor.name}
                  </span>
              )}
          </div>
          <button onClick={onClose} className="btn-icon text-brand-text-muted hover:text-brand-text transition-all" aria-label="Close">
            <Icon name="close" className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-8 custom-scroll">
            {gameData.combatConfiguration?.narrativeCombat && (
                <div className="bg-brand-accent/10 border border-brand-accent/20 p-4 rounded-2xl flex items-center gap-4 shadow-inner">
                    <Icon name="sparkles" className="w-6 h-6 text-brand-accent shrink-0" />
                    <p className="text-body-sm text-brand-accent font-medium leading-relaxed">
                        Narrative combat active: Round summary will be generated cinematically.
                    </p>
                </div>
            )}

            <div className="space-y-3">
                <label className="block text-body-sm font-medium text-brand-text-muted ml-1">Action Type</label>
                <div className="flex gap-2 bg-brand-primary p-1 rounded-xl shadow-inner">
                    <button onClick={() => { setMode('weapon'); setAssignments([]); setTargetCounts({}); }} className={`flex-1 h-10 px-4 rounded-lg text-xs font-black transition-all ${mode === 'weapon' ? 'bg-brand-surface text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}`}>Attack</button>
                    <button onClick={() => { setMode('ability'); setSelectedSourceId(null); setTargetCounts({}); }} className={`flex-1 h-10 px-4 rounded-lg text-xs font-black transition-all ${mode === 'ability' ? 'bg-brand-surface text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}`}>Ability</button>
                    <button onClick={() => { setMode('item'); setSelectedSourceId(null); setTargetCounts({}); }} className={`flex-1 h-10 px-4 rounded-lg text-xs font-black transition-all ${mode === 'item' ? 'bg-brand-surface text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}`}>Item</button>
                </div>
            </div>

            {mode === 'weapon' ? (
                <div className="animate-fade-in bg-brand-primary/20 p-5 rounded-2xl border border-brand-primary/50 flex justify-between items-center group shadow-inner">
                    <div className="flex-1 min-w-0">
                        <label className="block text-[8px] font-medium text-brand-accent capitalize tracking-normal mb-2">Standard Strike</label>
                        <p className="text-body-lg font-medium text-brand-text truncate mb-2">
                            {mainHandWeapon ? mainHandWeapon.name : 'Unarmed Strike'}
                            {offHandWeapon ? ` & ${offHandWeapon.name}` : ''}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[10px] font-medium text-brand-text bg-brand-bg px-2.5 py-1 rounded-lg border border-brand-surface flex items-center gap-1.5 shadow-sm">
                                <Icon name="play" className="w-2.5 h-2.5 text-brand-accent" />
                                {combatStats?.toHitBonusString} To Hit
                            </span>
                            <span className="text-[10px] font-medium text-brand-text bg-brand-bg px-2.5 py-1 rounded-lg border border-brand-surface flex items-center gap-1.5 shadow-sm">
                                <Icon name="sword" className="w-2.5 h-2.5 text-brand-accent" />
                                {combatStats?.damageValue} {combatStats?.damageType}
                            </span>
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center border border-brand-primary shadow-lg group-hover:scale-110 transition-transform ml-4 shrink-0">
                        <Icon name="sword" className="w-6 h-6 text-brand-accent/50 group-hover:text-brand-accent transition-colors" />
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in space-y-4">
                    <label className="block text-body-sm font-medium text-brand-text-muted ml-1">Select {mode}</label>
                    {currentList.length === 0 ? (
                        <div className="py-12 text-center border-2 border-dashed border-brand-primary/30 rounded-2xl bg-brand-surface/20">
                            <p className="text-body-sm text-brand-text-muted italic">No {mode}s available in current loadout.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {currentList.map(source => {
                                const isSelected = selectedSourceId === source.id;
                                const rarity = 'rarity' in source ? source.rarity : undefined;
                                const rarityColorClass = getItemRarityColor(rarity);
                                const effect = 'effect' in source ? source.effect : undefined;

                                return (
                                    <button 
                                        key={source.id} 
                                        onClick={() => { setSelectedSourceId(source.id); setTargetCounts({}); }}
                                        className={`w-full text-left bg-brand-primary/20 rounded-2xl p-4 border-2 transition-all flex flex-col gap-1 relative overflow-hidden group shadow-sm ${isSelected ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20' : 'border-brand-surface hover:border-brand-primary/50'}`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`shrink-0 flex items-center justify-center p-2 bg-brand-bg rounded-xl border border-brand-surface shadow-inner group-hover:scale-105 transition-transform ${isSelected ? 'border-brand-accent/30' : ''}`}>
                                                    <Icon name={getIconName(source)} className={`w-5 h-5 ${rarityColorClass}`} />
                                                </div>
                                                <div className="flex flex-col truncate">
                                                    <span className={`text-body-base font-medium truncate ${isSelected ? 'text-brand-accent' : 'text-brand-text'}`}>{source.name}</span>
                                                    <span className={`text-[7px] font-medium ${rarityColorClass} opacity-80 capitalize tracking-normal`}>{rarity || 'Core'}</span>
                                                </div>
                                            </div>
                                            {isSelected && <Icon name="check" className="w-5 h-5 text-brand-accent shrink-0" />}
                                        </div>
                                        
                                        <p className="text-body-sm text-brand-text-muted line-clamp-1 italic px-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                            {source.description}
                                        </p>

                                        {effect && (
                                            <div className="mt-2 pt-2 border-t border-brand-primary/20 flex items-center gap-2">
                                                <Icon name="sparkles" className="w-3.5 h-3.5 text-brand-accent/70" />
                                                <span className="text-[8px] font-medium text-brand-accent capitalize tracking-normal">
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

            {/* Heroic Action Toggle */}
            <div className="animate-fade-in space-y-3">
                <div className="flex justify-between items-center px-1">
                    <label className="block text-body-sm font-medium text-brand-text-muted">Heroic Action</label>
                    <span className="text-[8px] font-medium text-brand-text-muted italic opacity-60">Spend 1 point for a legendary outcome</span>
                </div>
                <button 
                    onClick={() => { if (heroicPoints > 0) setIsHeroicModeActive(!isHeroicModeActive); }}
                    disabled={heroicPoints <= 0}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                        isHeroicModeActive 
                            ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20' 
                            : 'border-brand-primary bg-brand-primary/20 hover:border-brand-primary/50'
                    } ${heroicPoints <= 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl border transition-colors ${isHeroicModeActive ? 'bg-brand-accent text-black border-brand-accent' : 'bg-brand-bg text-brand-text-muted border-brand-surface'}`}>
                            <Icon name={isHeroicModeActive ? "starFill" : "star"} className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className={`text-body-base font-bold ${isHeroicModeActive ? 'text-brand-accent' : 'text-brand-text'}`}>
                                {isHeroicModeActive ? 'Heroic Strike Enabled' : 'Activate Heroic Point'}
                            </span>
                            <span className="text-[8px] font-bold text-brand-text-muted tracking-normal">
                                {heroicPoints} point{heroicPoints !== 1 ? 's' : ''} available
                            </span>
                        </div>
                    </div>
                    {isHeroicModeActive && <Icon name="check" className="w-5 h-5 text-brand-accent animate-bounce-in" />}
                </button>
            </div>

            {(mode === 'weapon' || selectedSourceId) && (
                <div className="animate-fade-in space-y-4">
                    <div className="flex justify-between items-end px-1">
                        <label className="text-body-sm font-medium text-brand-text-muted">Target Selection {sourceType === 'Heal' ? '(Allies)' : ''}</label>
                        <span className="text-[8px] font-medium text-brand-accent capitalize tracking-normal bg-brand-accent/10 px-2 py-0.5 rounded-md border border-brand-accent/20">
                            {isMultiTargetAbility ? 'Entire Team' : `Slots: ${totalAssigned}/${maxTotalAttacks}`}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        {availableTargets.length === 0 ? (
                            <div className="col-span-full py-8 text-center border-2 border-dashed border-brand-primary/30 rounded-2xl bg-brand-surface/20">
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
                                const hpPercent = Math.round(((target.currentHitPoints || 0) / (target.maxHitPoints || (target as any).maxHp || 1)) * 100);
                                const isEnemy = !('isInParty' in target) && !(target as any).isAlly;
                                
                                return (
                                    <button key={target.id} onClick={() => handleTargetClick(target.id)} className="flex flex-col items-center group transition-all">
                                        <TargetAvatar actor={target} isSelected={isSelected} hpPercent={hpPercent} isAlly={!isEnemy} />
                                        <span className={`text-[9px] font-medium mt-2 truncate w-full text-center transition-colors ${isSelected ? 'text-brand-text' : 'text-brand-text-muted group-hover:text-brand-text'}`}>{target.name}</span>
                                        {displayLabel && <span className="text-[8px] font-medium text-brand-accent mt-0.5 capitalize tracking-normal">{displayLabel}</span>}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
            
            {(mode === 'weapon' || selectedSourceId) && (
                <div className="animate-fade-in space-y-3">
                    <label className="block text-body-sm font-medium text-brand-text-muted ml-1">{isQuickAction ? 'Action Intent' : 'Dialogue & Flavor'}</label>
                    <AutoResizingTextarea 
                        value={flavorText} 
                        onChange={(e) => setFlavorText(e.target.value)} 
                        placeholder={isQuickAction ? "How do you use this? Describe the flourish..." : "Declare your battle cry or tactical maneuver..."} 
                        className="w-full bg-brand-primary/40 text-brand-text border border-brand-primary rounded-2xl p-4 text-body-base focus:outline-none focus:border-brand-accent focus:bg-brand-bg transition-all placeholder-brand-text-muted/40 min-h-[60px] shadow-inner leading-relaxed" 
                    />
                </div>
            )}
        </div>

        <div className="p-6 border-t border-brand-primary/20 bg-brand-bg/50 backdrop-blur-md rounded-b-3xl">
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
        </div>
      </div>
    </div>
  );
};

export default PlayerAttackModal;

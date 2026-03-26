// components/QuantityModal.tsx

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Icon } from './Icon';
import Modal from './Modal';
import { Item, StoreItem, AbilityEffect, BodySlot, PlayerCharacter, Companion } from '../types';
import { getBuffTag, getActivePowerPill, getEnhancementPill } from '../utils/itemModifiers';
import { getSlotSynonym } from '../utils/slotUtils';
import { ActorAvatar } from './ActorAvatar';
import { GameDataContext } from '../context/GameDataContext';
import { getItemRarityColor } from '../types/Core';

interface QuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | StoreItem;
  action: 'Buy' | 'Sell' | 'Drop' | 'Split';
  maxQuantity: number;
  onConfirm: (quantity: number, recipientId?: string) => Promise<void>;
  balance?: number; // for buying
  characters?: (PlayerCharacter | Companion)[];
}

const formatEffectLabel = (effect: AbilityEffect) => {
  const target = effect.targetType === 'Multiple' ? 'Mul' : 'Sin';
  if (effect.type === 'Damage') {
    return `${effect.damageDice} ${effect.damageType || 'Dmg'} ${target}`;
  }
  if (effect.type === 'Status') {
    return `${effect.status || 'Status'} ${target}`;
  }
  if (effect.type === 'Heal') {
    return `${effect.healDice || 'Health'} Heal ${target}`;
  }
  const typeName = String(effect.type);
  return typeName.charAt(0).toUpperCase() + typeName.slice(1).toLowerCase();
};

const QuantityModal: React.FC<QuantityModalProps> = ({ isOpen, onClose, item, action, maxQuantity, onConfirm, balance, characters }) => {
  const { gameData } = useContext(GameDataContext);
  const [quantity, setQuantity] = useState(1);
  const [loadingAction, setLoadingAction] = useState<'confirm' | 'all' | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [recipientId, setRecipientId] = useState<string>('player');
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (action === 'Split') {
        setQuantity(Math.floor((item.quantity || 2) / 2));
      } else {
        setQuantity(1);
      }
      setLoadingAction(null);
      setIsSuccess(false);
      setRecipientId('player');
      setShowCompare(false);
    }
  }, [isOpen, item, action]);

  const targetSlot = useMemo(() => {
    if (item.bodySlotTag) return item.bodySlotTag;
    const tags = (item.tags || []).map(t => t.toLowerCase());
    
    // Check if it's armor/shield from Forge Groups categorization
    if (tags.some(t => t.includes('shield'))) return 'Off Hand' as BodySlot;
    if (tags.some(t => t.includes('armor'))) return 'Body' as BodySlot;
    if (tags.some(t => t.includes('weapon'))) return 'Main Hand' as BodySlot;
    
    // Mapping from Wondrous/Accessories
    if (tags.some(t => t.includes('ring'))) return 'Ring 1' as BodySlot;
    if (tags.some(t => t.includes('amulet') || t.includes('neck'))) return 'Neck' as BodySlot;
    if (tags.some(t => t.includes('head'))) return 'Head' as BodySlot;
    if (tags.some(t => t.includes('gloves') || t.includes('hand'))) return 'Gloves' as BodySlot;
    if (tags.some(t => t.includes('boots') || t.includes('foot') || t.includes('feet') || t.includes('shoes'))) return 'Feet' as BodySlot;
    if (tags.some(t => t.includes('legs'))) return 'Legs' as BodySlot;
    if (tags.some(t => t.includes('back') || t.includes('cloak') || t.includes('shoulder'))) return 'Shoulders' as BodySlot;
    if (tags.some(t => t.includes('waist') || t.includes('belt'))) return 'Waist' as BodySlot;
    if (tags.some(t => t.includes('bracer') || t.includes('wrist'))) return 'Bracers' as BodySlot;
    if (tags.some(t => t.includes('vest'))) return 'Vest' as BodySlot;
    if (tags.some(t => t.includes('eyes') || t.includes('goggles'))) return 'Eyes' as BodySlot;

    return undefined;
  }, [item]);

  const equippedInSlot = useMemo(() => {
    if (!gameData || !targetSlot || action !== 'Buy') return null;
    const inv = recipientId === 'player' ? gameData.playerInventory : gameData.companionInventories[recipientId];
    return inv?.equipped.find(i => i.equippedSlot === targetSlot) || null;
  }, [gameData, targetSlot, recipientId, action]);

  const { weaponTags, slotLabel } = useMemo(() => {
    let wTags: string[] = [];
    let sLabel = '';
    const tags = item.tags || [];

    if (item.weaponStats) {
      if (tags.some(t => t.toLowerCase().includes('heavy'))) wTags.push('Heavy');
      else if (tags.some(t => t.toLowerCase().includes('light'))) wTags.push('Light');
      else if (tags.some(t => t.toLowerCase().includes('medium'))) wTags.push('Medium');

      if (tags.some(t => t.toLowerCase().includes('ranged'))) wTags.push('Ranged');
      else if (tags.some(t => t.toLowerCase().includes('melee'))) wTags.push('Melee');

      if (item.weaponStats.ability) {
        const ab = item.weaponStats.ability.toLowerCase();
        wTags.push(ab === 'dexterity' ? 'Dexterity' : 'Strength');
      }
    }

    const slotName = getSlotSynonym(item.bodySlotTag, tags);
    if (item.bodySlotTag) sLabel = slotName;

    return { weaponTags: wTags, slotLabel: sLabel };
  }, [item]);

  const executeConfirm = async (qty: number, actionType: 'confirm' | 'all') => {
    setLoadingAction(actionType);
    try {
      await onConfirm(qty, action === 'Buy' ? recipientId : undefined);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (error) {
      console.error(`Failed to ${action.toLowerCase()} item:`, error);
      setLoadingAction(null);
    }
  };

  const handleConfirm = () => executeConfirm(quantity, 'confirm');
  const handleAll = () => executeConfirm(maxQuantity, 'all');

  const totalPrice = 'price' in item ? (item.price || 0) * quantity : 0;
  const canAfford = action === 'Buy' ? balance !== undefined && totalPrice <= balance : true;
  const isConfirmDisabled = (action === 'Buy' && !canAfford) || quantity <= 0 || maxQuantity <= 0;
  const isLoading = loadingAction !== null;

  const isBuff = item.tags?.some(tag => tag.toLowerCase() === 'buff');
  const isMechanical = item.tags?.some(tag => tag.toLowerCase() === 'mechanical');

  if (isSuccess) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} hideHeader>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-20 h-20 rounded-full bg-brand-accent/20 flex items-center justify-center mb-8 border-2 border-brand-accent animate-bounce">
            <Icon name="check" className="w-10 h-10 text-brand-accent" />
          </div>
          <h3 className="text-brand-text">{action} Successful</h3>
        </div>
      </Modal>
    );
  }

  const footer = (
    <div className="flex flex-col gap-[10px]">
      {/* Compare Section */}

      <div className="flex flex-col gap-[10px]">
        {action === 'Buy' && (
          <div>
            {equippedInSlot ? (
              <div className="space-y-3">
                <button
                  onClick={() => setShowCompare(!showCompare)}
                  className="btn-secondary w-full h-12 font-bold text-xs rounded-2xl flex items-center justify-center gap-2"
                >
                  {showCompare ? "Hide Comparison" : "Compare"}
                </button>
                
                {showCompare && (
                  <div className="p-4 bg-brand-surface border border-white/10 rounded-2xl animate-modal shadow-xl">
                    <p className="text-[10px] font-bold text-brand-text-muted mb-2 tracking-wider opacity-60">Currently Equipped</p>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={`text-sm mb-0 ${getItemRarityColor(equippedInSlot.rarity)}`}>{equippedInSlot.name}</h4>
                      {equippedInSlot.armorStats && (
                         <span className="text-[10px] font-bold text-brand-accent">AC {equippedInSlot.armorStats.baseAC + equippedInSlot.armorStats.plusAC}</span>
                      )}
                      {equippedInSlot.weaponStats && (
                         <span className="text-[10px] font-bold text-brand-accent">{equippedInSlot.weaponStats.damages[0].dice} {equippedInSlot.weaponStats.damages[0].type}</span>
                      )}
                    </div>
                    <p className="text-xs text-brand-text-muted line-clamp-2 italic leading-relaxed opacity-80 mb-3">{equippedInSlot.description}</p>
                    
                    <div className="flex flex-wrap gap-2">
                        {/* Enhancement Pill */}
                        {getEnhancementPill(equippedInSlot) && (
                            <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border bg-brand-bg shadow-sm ${getEnhancementPill(equippedInSlot)!.colorClass}`}>
                                {getEnhancementPill(equippedInSlot)!.label}
                            </span>
                        )}

                        {/* Passive Buffs */}
                        {equippedInSlot.buffs?.map((buff, idx) => {
                            const { label, colorClass } = getBuffTag(buff);
                            return (
                                <span key={idx} className={`text-[9px] font-bold px-2 py-1 rounded-lg border bg-brand-bg shadow-sm ${colorClass}`}>
                                    {label}
                                </span>
                            );
                        })}

                        {/* Active Power Slot */}
                        {equippedInSlot.effect && (
                            <span className="text-[9px] font-bold text-purple-400 bg-brand-bg px-2 py-1 rounded-lg border border-purple-400/30 flex items-center gap-1.5 shadow-sm">
                                <Icon name="sparkles" className="w-2.5 h-2.5" />
                                {getActivePowerPill(equippedInSlot.effect).label}
                            </span>
                        )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
                <div className="text-center p-3 bg-white/5 rounded-xl border border-dashed border-white/10">
                    <p className="text-[10px] font-bold text-brand-text-muted italic mb-0">No item equipped in this body slot yet</p>
                </div>
            )}
          </div>
        )}

        <div className="flex gap-4">
          {action === 'Sell' && maxQuantity > 1 && (
            <button
              onClick={handleAll}
              disabled={isConfirmDisabled || isLoading}
              className="btn-secondary h-12 flex-1 font-bold text-xs rounded-2xl"
            >
              {loadingAction === 'all' ? <Icon name="spinner" className="w-5 h-5 animate-spin text-brand-accent" /> : `Sell All`}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled || isLoading}
            className={`btn-primary h-12 ${action === 'Sell' && maxQuantity > 1 ? 'flex-[2]' : 'w-full'} gap-3 rounded-2xl font-bold transition-all flex items-center justify-center`}
          >
            {loadingAction === 'confirm' ? (
              <Icon name="spinner" className="w-5 h-5 animate-spin text-black" />
            ) : (
                <div className="flex items-center gap-2">
                    <span>{action}</span>
                    {(action === 'Buy' || action === 'Sell') && (
                        <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-black/20">
                            <Icon name="currencyCoins" className="w-3.5 h-3.5 text-black" />
                            <span className="tabular-nums">
                              {action === 'Buy' ? totalPrice : Math.floor((('price' in item ? item.price : 0) || 0) / 2) * quantity}
                            </span>
                        </div>
                    )}
                </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideHeader
      footer={footer}
      maxWidth="md"
    >
      {/* Character Selector row atop the modal content */}
      {action === 'Buy' && characters && characters.length > 1 && (
        <div className="absolute top-4 left-6 z-50 flex items-center gap-2">
            {characters.map(char => {
                const charId = char.id || (char instanceof PlayerCharacter ? 'player' : 'unknown');
                const isSelected = recipientId === charId || (recipientId === 'player' && char instanceof PlayerCharacter);
                
                return (
                    <div key={charId} className="relative group">
                        <ActorAvatar 
                            actor={char}
                            size={32}
                            showBars={false}
                            isActive={isSelected}
                            showGlow={false}
                            onClick={() => setRecipientId(charId)}
                            className={`cursor-pointer transition-all ${isSelected ? 'scale-110 opacity-100' : 'opacity-40 scale-100 hover:scale-110'}`}
                        />
                    </div>
                );
            })}
        </div>
      )}

      <div className="space-y-6 pt-5">
        <div>
          <h3 className="text-brand-text leading-tight mb-2">{item.name}</h3>

          {(weaponTags.length > 0 || slotLabel) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {weaponTags.map(tag => (
                <span key={tag} className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded-lg border border-brand-accent/20">
                  {tag}
                </span>
              ))}
              {slotLabel && (
                <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded-lg border border-brand-accent/20">
                  {slotLabel}
                </span>
              )}
            </div>
          )}

          <div className="bg-white/5 p-4 rounded-2xl mb-2 border border-white/5">
            <p className="text-sm text-brand-text-muted leading-relaxed opacity-90 italic">
              {item.description}
            </p>
          </div>
        </div>

        {/* Stats Bar */}
        {(item.weaponStats || item.armorStats) && (
          <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-8">
            {item.weaponStats && (
              <div className="flex items-center gap-3">
                <Icon name="sword" className="w-5 h-5 text-brand-accent/70" />
                <span className="text-sm font-bold text-brand-text">
                  {item.weaponStats.damages.map(d => `${d.dice} ${d.type}`).join(' + ')}
                  {item.weaponStats.enhancementBonus !== 0 && ` (${item.weaponStats.enhancementBonus >= 0 ? '+' : ''}${item.weaponStats.enhancementBonus})`}
                </span>
              </div>
            )}
            {item.armorStats && (
              <div className="flex items-center gap-3">
                <Icon name="shield" className="w-5 h-5 text-blue-400/70" />
                <span className="text-sm text-brand-text-muted whitespace-nowrap">
                  AC {(item.armorStats.baseAC || 0) + (item.armorStats.plusAC || 0)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Buff Pills */}
        {(isBuff || isMechanical || (item.buffs && item.buffs.length > 0) || item.effect) && (
          <div className="flex flex-wrap gap-2 px-1">
            {item.buffs?.map((buff, idx) => {
              const { label, colorClass } = getBuffTag(buff);
              return (
                <span
                  key={idx}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border bg-brand-bg shadow-sm ${colorClass}`}
                >
                  {label}
                </span>
              );
            })}
            {item.effect && (
              <span className="border border-purple-500/30 text-purple-400 bg-brand-bg text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                <Icon name="sparkles" className="w-3 h-3" />
                {formatEffectLabel(item.effect)}
              </span>
            )}
          </div>
        )}

        {/* Stepper Controls */}
        <div className="bg-white/5 p-2 rounded-2xl border border-white/5 shadow-inner flex flex-col items-center">
          <label className="text-[9px] font-bold text-brand-text-muted mb-1 opacity-60 text-center">Select Quantity</label>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1 || isLoading}
              className="h-11 w-11 flex items-center justify-center rounded-lg bg-white/5 hover:bg-brand-accent/20 transition-all active:scale-95 disabled:opacity-20 border border-white/10 shadow-lg group"
            >
              <Icon name="minus" className="w-5 h-5 text-brand-text group-hover:text-brand-accent transition-colors" />
            </button>
            <div className="flex flex-col items-center min-w-[70px]">
              <h2 className="text-brand-text text-3xl font-heading font-bold tabular-nums mb-0">{quantity}</h2>
              <span className="text-[10px] font-bold text-brand-text-muted opacity-40">Units</span>
            </div>
            <button
              onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
              disabled={quantity >= maxQuantity || isLoading}
              className="h-11 w-11 flex items-center justify-center rounded-lg bg-white/5 hover:bg-brand-accent/20 transition-all active:scale-95 disabled:opacity-20 border border-white/10 shadow-lg group"
            >
              <Icon name="plus" className="w-5 h-5 text-brand-text group-hover:text-brand-accent transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default QuantityModal;

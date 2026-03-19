// components/QuantityModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './Icon';
import Modal from './Modal';
import { Item, StoreItem, AbilityEffect } from '../types';
import { getBuffTag } from '../utils/itemModifiers';
import { getSlotSynonym } from '../utils/slotUtils';

interface QuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | StoreItem;
  action: 'Buy' | 'Sell' | 'Drop' | 'Split';
  maxQuantity: number;
  onConfirm: (quantity: number) => Promise<void>;
  balance?: number; // for buying
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

const QuantityModal: React.FC<QuantityModalProps> = ({ isOpen, onClose, item, action, maxQuantity, onConfirm, balance }) => {
  const [quantity, setQuantity] = useState(1);
  const [loadingAction, setLoadingAction] = useState<'confirm' | 'all' | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (action === 'Split') {
        setQuantity(Math.floor((item.quantity || 2) / 2));
      } else {
        setQuantity(1);
      }
      setLoadingAction(null);
      setIsSuccess(false);
    }
  }, [isOpen, item, action]);

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
      await onConfirm(qty);
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
    <div className="flex flex-col gap-4">
      {/* Action Summary */}
      <div className="flex items-center justify-center h-10">
        {action === 'Buy' && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-brand-text-muted font-bold tracking-tight uppercase opacity-60">Total Cost</span>
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border shadow-inner ${canAfford ? 'bg-brand-accent/5 border-brand-accent/20' : 'bg-brand-danger/5 border-brand-danger/20'}`}>
              <Icon name="currencyCoins" className={`w-4 h-4 ${canAfford ? 'text-brand-accent' : 'text-brand-danger'}`} />
              <span className={`text-sm font-bold tabular-nums ${canAfford ? 'text-brand-accent' : 'text-brand-danger'}`}>{totalPrice}</span>
            </div>
          </div>
        )}
        {action === 'Sell' && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-brand-text-muted font-bold tracking-tight uppercase opacity-60">Return Value</span>
            <div className="flex items-center gap-2 bg-brand-accent/5 px-4 py-1.5 rounded-full border border-brand-accent/20 shadow-inner">
              <Icon name="currencyCoins" className="w-4 h-4 text-brand-accent" />
              <span className="text-sm font-bold text-brand-accent tabular-nums">{Math.floor((('price' in item ? item.price : 0) || 0) / 2) * quantity}</span>
            </div>
          </div>
        )}
        {action === 'Drop' && <p className="text-sm text-brand-danger font-bold tracking-normal italic">Discarding {quantity} unit{quantity > 1 ? 's' : ''}</p>}
        {action === 'Split' && <p className="text-sm text-brand-accent font-bold tracking-normal italic">New Stack: {quantity} unit{quantity > 1 ? 's' : ''}</p>}
      </div>

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
          className={`btn-primary h-12 ${action === 'Sell' && maxQuantity > 1 ? 'flex-[2]' : 'w-full'} gap-3 rounded-2xl font-bold transition-all`}
        >
          {loadingAction === 'confirm' ? <Icon name="spinner" className="w-5 h-5 animate-spin text-black" /> : action}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${action} Quantity`}
      footer={footer}
      maxWidth="md"
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-brand-text leading-tight mb-2">{item.name}</h3>

          {(weaponTags.length > 0 || slotLabel) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {weaponTags.map(tag => (
                <span key={tag} className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded-lg border border-brand-accent/20 tracking-normal">
                  {tag}
                </span>
              ))}
              {slotLabel && (
                <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded-lg border border-brand-accent/20 tracking-normal">
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
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-full border bg-brand-bg tracking-normal shadow-sm ${colorClass}`}
                >
                  {label}
                </span>
              );
            })}
            {item.effect && (
              <span className="border border-purple-500/30 text-purple-400 bg-brand-bg text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                <Icon name="sparkles" className="w-3 h-3" />
                {formatEffectLabel(item.effect)}
              </span>
            )}
          </div>
        )}

        {/* Stepper Controls */}
        <div className="bg-white/5 p-8 rounded-3xl border border-white/5 shadow-inner flex flex-col items-center">
          <label className="text-[10px] font-bold text-brand-text-muted mb-6 uppercase tracking-widest opacity-60 text-center">Select amount</label>
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1 || isLoading}
              className="h-14 w-14 flex items-center justify-center rounded-full bg-white/5 hover:bg-brand-accent/20 transition-all active:scale-90 disabled:opacity-20 border border-white/10 shadow-lg group"
            >
              <Icon name="minus" className="w-6 h-6 text-brand-text group-hover:text-brand-accent transition-colors" />
            </button>
            <div className="flex flex-col items-center min-w-[100px]">
              <h2 className="text-brand-text text-6xl font-bold tabular-nums mb-0 tracking-tighter">{quantity}</h2>
              <span className="text-[10px] font-bold text-brand-text-muted mt-1 opacity-40 uppercase">units</span>
            </div>
            <button
              onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
              disabled={quantity >= maxQuantity || isLoading}
              className="h-14 w-14 flex items-center justify-center rounded-full bg-white/5 hover:bg-brand-accent/20 transition-all active:scale-90 disabled:opacity-20 border border-white/10 shadow-lg group"
            >
              <Icon name="plus" className="w-6 h-6 text-brand-text group-hover:text-brand-accent transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default QuantityModal;

// components/QuantityModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { Item, StoreItem, getItemRarityColor, AbilityEffect } from '../types';
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

  if (!isOpen) {
    return null;
  }

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

  const renderContent = () => {
    if (isSuccess) {
      return (
        <div className="flex flex-col items-center justify-center h-48 py-8">
          <div className="w-16 h-16 rounded-full bg-brand-accent/20 flex items-center justify-center mb-6 border-2 border-brand-accent">
            <Icon name="check" className="w-8 h-8 text-brand-accent" />
          </div>
          <p className="text-body-lg font-bold text-brand-text">{action} Successful</p>
        </div>
      );
    }
    
    return (
      <div className="animate-fade-in flex flex-col h-full">
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-6">
          <span className="text-[10px] font-bold text-brand-text-muted">{action} Quantity</span>
          <button onClick={onClose} className="btn-icon p-1.5 text-brand-text-muted hover:text-brand-text hover:bg-brand-primary/40 transition-all" disabled={isLoading}>
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Item Context Block */}
        <div className="space-y-6 mb-8 flex-1">
          <div>
            <h2 className="text-brand-text font-merriweather text-3xl leading-tight mb-2">{item.name}</h2>
            
            {(weaponTags.length > 0 || slotLabel) && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {weaponTags.map(tag => (
                        <span key={tag} className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded border border-brand-accent/20 tracking-normal">
                            {tag}
                        </span>
                    ))}
                    {slotLabel && (
                        <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded border border-brand-accent/20 tracking-normal">
                            {slotLabel}
                        </span>
                    )}
                </div>
            )}

            <div className="bg-brand-primary/10 p-5 rounded-2xl border-l-4 border-brand-accent shadow-inner">
                <p className="text-body-base text-brand-text leading-relaxed font-bold italic opacity-90">
                    {item.description}
                </p>
            </div>
          </div>

          {/* Stats Bar */}
          {(item.weaponStats || item.armorStats) && (
              <div className="bg-brand-primary/20 p-4 rounded-xl border border-brand-surface shadow-inner flex items-center gap-8">
                  {item.weaponStats && (
                      <div className="flex items-center gap-3">
                          <Icon name="sword" className="w-5 h-5 text-brand-accent/70" />
                          <span className="text-body-base font-bold text-brand-text">
                              {item.weaponStats.damages.map(d => `${d.dice} ${d.type}`).join(' + ')}
                              {item.weaponStats.enhancementBonus !== 0 && ` (${item.weaponStats.enhancementBonus >= 0 ? '+' : ''}${item.weaponStats.enhancementBonus})`}
                          </span>
                      </div>
                  )}
                  {item.armorStats && (
                      <div className="flex items-center gap-3">
                          <Icon name="shield" className="w-5 h-5 text-blue-400/70" />
                          <span className="text-body-base font-bold text-brand-text">
                              Ac {(item.armorStats.baseAC || 0) + (item.armorStats.plusAC || 0)}
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
                      <span className="border border-purple-500 text-purple-400 bg-brand-bg text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                          <Icon name="sparkles" className="w-3 3" />
                          {formatEffectLabel(item.effect)}
                      </span>
                  )}
              </div>
          )}
        </div>

        {/* Stepper Controls */}
        <div className="bg-brand-primary/20 p-8 rounded-3xl border border-brand-surface shadow-inner mb-8 flex flex-col items-center">
            <label className="text-[10px] font-bold text-brand-text-muted mb-6">Select Amount</label>
            <div className="flex items-center justify-center gap-8">
                <button 
                    onClick={() => setQuantity(q => Math.max(1, q - 1))} 
                    disabled={quantity <= 1 || isLoading} 
                    className="h-12 w-12 flex items-center justify-center rounded-full bg-brand-surface-raised hover:bg-brand-secondary transition-all active:scale-90 disabled:opacity-20 border border-brand-primary shadow-lg"
                >
                    <Icon name="minus" className="w-6 h-6 text-brand-text" />
                </button>
                <div className="flex flex-col items-center min-w-[80px]">
                    <h2 className="text-brand-text text-5xl font-bold tabular-nums mb-0">{quantity}</h2>
                    <span className="text-[10px] font-bold text-brand-text-muted mt-1 opacity-40">units</span>
                </div>
                <button 
                    onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))} 
                    disabled={quantity >= maxQuantity || isLoading} 
                    className="h-12 w-12 flex items-center justify-center rounded-full bg-brand-surface-raised hover:bg-brand-secondary transition-all active:scale-90 disabled:opacity-20 border border-brand-primary shadow-lg"
                >
                    <Icon name="plus" className="w-6 h-6 text-brand-text" />
                </button>
            </div>
        </div>

        {/* Action Summary */}
        <div className="h-12 flex items-center justify-center mb-6">
          {action === 'Buy' && (
            <div className="flex items-center gap-3">
                <span className="text-xs text-brand-text-muted font-bold tracking-tight">Total Cost</span>
                <div className="flex items-center gap-2 bg-brand-accent/5 px-4 py-2 rounded-full border border-brand-accent/20 shadow-inner">
                    <Icon name="currencyCoins" className={`w-4 h-4 ${canAfford ? 'text-brand-accent' : 'text-brand-danger'}`} />
                    <span className={`text-body-lg font-bold tabular-nums ${canAfford ? 'text-brand-accent' : 'text-brand-danger'}`}>{totalPrice}</span>
                </div>
            </div>
          )}
          {action === 'Sell' && (
            <div className="flex items-center gap-3">
                <span className="text-xs text-brand-text-muted font-bold tracking-tight">Return Value</span>
                <div className="flex items-center gap-2 bg-brand-accent/5 px-4 py-2 rounded-full border border-brand-accent/20 shadow-inner">
                    <Icon name="currencyCoins" className="w-4 h-4 text-brand-accent" />
                    <span className="text-body-lg font-bold text-brand-accent tabular-nums">{Math.floor((('price' in item ? item.price : 0) || 0) / 2) * quantity}</span>
                </div>
            </div>
          )}
          {action === 'Drop' && <p className="text-body-sm text-brand-danger font-bold tracking-normal">Discarding {quantity} Unit{quantity > 1 ? 's' : ''}</p>}
          {action === 'Split' && <p className="text-body-sm text-brand-accent font-bold tracking-normal">New Stack: {quantity} Unit{quantity > 1 ? 's' : ''}</p>}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-4">
            {action === 'Sell' && maxQuantity > 1 && (
                <button
                    onClick={handleAll}
                    disabled={isConfirmDisabled || isLoading}
                    className="btn-secondary btn-md flex-1 font-bold text-[11px] rounded-2xl"
                >
                    {loadingAction === 'all' ? <Icon name="spinner" className="w-5 h-5 animate-spin text-brand-accent" /> : `Sell All`}
                </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={isConfirmDisabled || isLoading}
              className={`btn-primary btn-md ${action === 'Sell' && maxQuantity > 1 ? 'flex-[2]' : 'w-full'} gap-3 rounded-2xl shadow-xl shadow-brand-accent/20 font-bold tracking-normal`}
            >
              {loadingAction === 'confirm' ? <Icon name="spinner" className="w-5 h-5 animate-spin text-black" /> : action}
            </button>
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150] p-4 backdrop-blur-sm animate-fade-in"
      onClick={!isLoading ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-brand-surface rounded-3xl shadow-2xl w-full max-w-lg p-6 border border-brand-primary animate-modal overflow-hidden max-h-[95vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto custom-scroll pr-1">
            {renderContent()}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuantityModal;
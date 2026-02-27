import React from 'react';
import { Icon } from '../../Icon';
import Modal from '../../Modal';
import { Item, getItemRarityColor } from '../../../types';
import { MODIFIER_REGISTRY } from '../../../utils/itemModifiers';
import { ForgeModifier } from './ForgeModifiers';

interface ForgeResultModalProps {
    isOpen: boolean;
    isForging: boolean;
    forgedItem: Item | null;
    onClose: () => void;
    onRetry: () => void;
    onConfirm: () => void;
    selectedModifiers: ForgeModifier[];
    showModifiers: boolean;
    formatEffectLabel: (effect: any, usage: any, isSingleUse: boolean) => string;
}

export const ForgeResultModal: React.FC<ForgeResultModalProps> = ({
    isOpen,
    isForging,
    forgedItem,
    onClose,
    onRetry,
    onConfirm,
    selectedModifiers,
    showModifiers,
    formatEffectLabel
}) => {
    return (
        <Modal isOpen={isOpen} onClose={() => !isForging && onClose()} title="The Anvil">
            <div className="p-4 flex flex-col items-center min-h-[300px] justify-center">
                {isForging ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 text-brand-accent animate-dice">
                            <Icon name="dice" className="w-full h-full drop-shadow-[0_0_8px_rgba(62,207,142,0.4)]" />
                        </div>
                        <p className="text-body-base text-brand-accent font-black animate-pulse tracking-widest uppercase normal-case">Striking the iron...</p>
                    </div>
                ) : forgedItem ? (
                    <div className="w-full space-y-8 animate-fade-in">
                        <div className="text-center space-y-2">
                            <h2 className="text-brand-accent leading-tight">{forgedItem.name}</h2>
                            <p className="text-body-base italic text-brand-text-muted px-4 leading-relaxed font-medium">"{forgedItem.description}"</p>
                        </div>

                        {(selectedModifiers.length > 0 && showModifiers) || forgedItem.effect ? (
                            <div className="flex flex-wrap justify-center gap-2 px-2">
                                {selectedModifiers.map(mod => (
                                    <div key={mod.id} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-[10px] font-black bg-brand-bg shadow-sm ${MODIFIER_REGISTRY[mod.type].colorClass}`}>
                                        <span>{mod.tag}</span>
                                    </div>
                                ))}
                                {forgedItem.effect && (
                                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-purple-500 text-purple-400 text-[10px] font-black bg-brand-bg shadow-sm">
                                        <Icon name="sparkles" className="w-3 h-3" />
                                        <span>{formatEffectLabel(forgedItem.effect, forgedItem.usage, (forgedItem.tags || []).some(t => t === 'consumable' || t === 'throwable'))}</span>
                                    </div>
                                )}
                            </div>
                        ) : null}

                        <div className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface text-center shadow-inner">
                            <label className="block text-[10px] font-black text-brand-text-muted uppercase normal-case mb-1.5 opacity-60">Estimated market value</label>
                            <div className="text-body-lg font-black text-brand-accent flex items-center justify-center gap-2">
                                <Icon name="currencyCoins" className="w-5 h-5" />
                                <span>{forgedItem.price}</span>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4">
                            <button 
                                onClick={onConfirm} 
                                className="btn-primary btn-md w-full shadow-brand-accent/20"
                            >
                                Add to inventory
                            </button>
                            <div className="flex gap-3">
                                <button 
                                    onClick={onRetry} 
                                    className="btn-secondary btn-md flex-1"
                                >
                                    <Icon name="refresh" className="w-4 h-4 mr-2" />
                                    <span>Retry</span>
                                </button>
                                <button 
                                    onClick={onClose} 
                                    className="btn-tertiary btn-md flex-1"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </Modal>
    );
};
import React from 'react';
import AutoResizingTextarea from '../../AutoResizingTextarea';
import { getItemRarityColor, BodySlot } from '../../../types';

interface ForgeIdentityProps {
    itemName: string;
    setItemName: (name: string) => void;
    lorePrompt: string;
    setLorePrompt: (lore: string) => void;
    selectedRarity: string;
    baseGroup: string;
    baseSubtypeLabel?: string;
    forgeScale: string;
    activeSlot?: BodySlot;
}

export const ForgeIdentity: React.FC<ForgeIdentityProps> = ({
    itemName,
    setItemName,
    lorePrompt,
    setLorePrompt,
    selectedRarity,
    baseGroup,
    baseSubtypeLabel,
    forgeScale,
    activeSlot
}) => {
    return (
        <div className="bg-brand-surface p-6 rounded-2xl border border-brand-primary shadow-lg mb-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-body-sm font-bold ${getItemRarityColor(selectedRarity)}`}>{selectedRarity}</span>
                        <span className="text-body-sm font-bold text-brand-text-muted opacity-70">/ {baseGroup}</span>
                        {baseSubtypeLabel && <span className="text-body-sm font-bold text-brand-text-muted opacity-70">/ {baseSubtypeLabel}</span>}
                        {forgeScale !== 'Person' && (
                            <span className="text-body-sm bg-brand-accent/10 border border-brand-accent/20 text-brand-accent font-bold px-2 py-0.5 rounded-lg ml-2">
                                {forgeScale} Scale
                            </span>
                        )}
                    </div>
                </div>
                {activeSlot && (
                    <span className="text-body-sm bg-brand-accent/10 border border-brand-accent/20 text-brand-accent font-bold px-3 py-1 rounded-full">
                        Slot: {activeSlot}
                    </span>
                )}
            </div>
            <div className="space-y-6">
                <div>
                    <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Item Name (Optional)</label>
                    <input 
                        type="text" 
                        placeholder="Leave blank for Ai generation..." 
                        value={itemName} 
                        onChange={e => setItemName(e.target.value)} 
                        className="w-full input-md" 
                    />
                </div>
                <div>
                    <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Lore & Details (Optional)</label>
                    <AutoResizingTextarea 
                        value={lorePrompt} 
                        onChange={e => setLorePrompt(e.target.value)} 
                        placeholder="Describe appearance, history, or unique traits..." 
                        className="w-full input-md min-h-[44px] leading-relaxed" 
                    />
                </div>
            </div>
        </div>
    );
};
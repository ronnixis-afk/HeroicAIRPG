import React from 'react';
import { Item, AbilityUsage } from '../../../types';

export const ItemUsageEditor: React.FC<{
    item: Item;
    onChange: (path: (string | number)[], value: any) => void;
}> = ({ item, onChange }) => {

    const handleAddUsage = () => {
        const newItem = item.clone();
        newItem.usage = { type: 'charges', maxUses: 1, currentUses: 1 };
        delete newItem.quantity;
        onChange([], newItem);
    };

    const handleRemoveUsage = () => {
        const newItem = item.clone();
        delete newItem.usage;
        newItem.quantity = 1;
        onChange([], newItem);
    };

    if (item.usage) {
        return (
            <div className="bg-brand-primary/30 p-4 rounded-2xl mt-3 border border-brand-surface">
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">Usage Type</label>
                        <div className="relative">
                            <select
                                value={item.usage.type}
                                onChange={(e) => {
                                    const newType = e.target.value as AbilityUsage['type'];
                                    onChange(['usage', 'type'], newType);
                                }}
                                className="w-full input-md text-body-base appearance-none"
                            >
                                <option value="charges">Charges</option>
                                <option value="per_short_rest">Short rest</option>
                                <option value="per_long_rest">Long rest</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">Max Uses</label>
                        <input
                            type="number"
                            value={item.usage.maxUses}
                            onChange={(e) => onChange(['usage', 'maxUses'], parseInt(e.target.value) || 0)}
                            className="w-full input-md text-body-base font-bold"
                        />
                    </div>
                    <div>
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">Current Uses</label>
                        <input
                            type="number"
                            value={item.usage.currentUses}
                             onChange={(e) => onChange(['usage', 'currentUses'], parseInt(e.target.value) || 0)}
                            className="w-full input-md text-body-base font-bold"
                        />
                    </div>
                </div>
                 <button 
                    onClick={handleRemoveUsage} 
                    className="btn-tertiary btn-sm mt-3 w-full"
                >
                    Use quantity instead
                </button>
            </div>
        );
    }

    return (
        <div className="bg-brand-primary/30 p-4 rounded-2xl mt-3 border border-brand-surface">
            <div className="flex items-end gap-4">
                 <div className="flex-1">
                    <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">Quantity</label>
                    <input
                        type="number"
                        value={item.quantity ?? 1}
                        onChange={(e) => onChange(['quantity'], parseInt(e.target.value) || 1)}
                        className="w-full input-md text-body-base font-bold"
                    />
                </div>
                <button 
                    onClick={handleAddUsage} 
                    className="btn-secondary btn-md"
                >
                    Add usage charges
                </button>
            </div>
        </div>
    );
};
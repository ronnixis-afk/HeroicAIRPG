import React from 'react';
import { Inventory } from '../../types';
import { Icon } from '../Icon';

interface CurrencyDisplayProps {
    inventory: Inventory | undefined;
    className?: string;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ inventory, className }) => {
    if (!inventory) return null;
    const currencyItems = inventory.carried.filter(i => i.tags?.includes('currency'));

    if (currencyItems.length === 0) return null;

    const totalBalance = currencyItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const currencyName = currencyItems[0].name;

    return (
        <div className={`flex items-center gap-2 p-2 rounded-lg bg-brand-primary/50 text-body-sm ${className || ''}`}>
            <Icon name="currencyCoins" className="w-4 h-4 text-brand-accent" />
            <span className="font-bold text-brand-text">{totalBalance}</span>
            <span className="text-brand-text-muted">{currencyName}</span>
        </div>
    );
};
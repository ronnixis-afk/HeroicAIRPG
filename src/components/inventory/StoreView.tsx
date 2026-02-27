// components/inventory/StoreView.tsx

import React, { useContext, useState, useEffect, useMemo } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { Item, StoreItem, getItemRarityColor, FORGE_GROUPS } from '../../types';
import { Icon } from '../Icon';
import QuantityModal from '../QuantityModal';
import { CurrencyDisplay } from './CurrencyDisplay';
import Modal from '../Modal';
import { getBuffTag, getActivePowerPill } from '../../utils/itemModifiers';

// Categories matching shared Forge Groups (excluding Quest, Mounts, and Ships for scale-based selection)
const SHOP_CATEGORIES = FORGE_GROUPS.filter(g => g.id !== 'Quest' && g.id !== 'Mounts' && g.id !== 'Ships');

const CategoryTab: React.FC<{ label: string, isActive: boolean, onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm`}
    >
        {label}
    </button>
);

const ScaleRadio: React.FC<{ label: string, isActive: boolean, onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className="flex items-center gap-2 group cursor-pointer py-2 px-1 focus:outline-none"
    >
        <div className={`
            w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all p-0.5
            ${isActive ? 'border-brand-accent' : 'border-brand-primary group-hover:border-brand-text-muted'}
        `}>
            {isActive && <div className="w-full h-full rounded-full bg-brand-accent shadow-[0_0_8px_rgba(62,207,142,0.4)]" />}
        </div>
        <span className={`text-body-sm font-bold transition-colors ${isActive ? 'text-brand-text' : 'text-brand-text-muted group-hover:text-brand-text'}`}>
            {label}
        </span>
    </button>
);

const StoreItemCard: React.FC<{ item: StoreItem, onBuy: (item: StoreItem) => void, canAfford: boolean }> = ({ item, onBuy, canAfford }) => (
    <div 
        onClick={() => onBuy(item)}
        className={`
            bg-brand-surface p-3 rounded-xl border border-brand-primary/50 
            flex justify-between items-center group hover:border-brand-accent/30 
            transition-all cursor-pointer hover:bg-brand-surface-raised relative overflow-hidden
            ${!canAfford ? 'opacity-70' : ''}
        `}
    >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex-grow min-w-0 mr-4 pl-2">
            <div className="flex items-center gap-2 mb-1">
                <span className={`text-body-base font-bold truncate ${getItemRarityColor(item.rarity)}`}>{item.name}</span>
            </div>
            <p className="text-body-sm text-brand-text-muted line-clamp-1 italic mb-2">{item.description}</p>
            
            {/* Mechanical Detail Section */}
            <div className="flex flex-wrap gap-1.5">
                {/* Weapon/Armor Stats */}
                {item.weaponStats && (
                    <span className="text-[9px] font-bold text-brand-text-muted bg-brand-primary/40 px-2 py-0.5 rounded-full border border-brand-text-muted/30 capitalize tracking-normal">
                        {item.weaponStats.damages[0].dice.toLowerCase()} {item.weaponStats.damages[0].type.toLowerCase()}
                        {item.weaponStats.enhancementBonus !== 0 && ` (${item.weaponStats.enhancementBonus >= 0 ? '+' : ''}${item.weaponStats.enhancementBonus})`}
                    </span>
                )}
                {item.armorStats && (
                    <span className="text-[9px] font-bold text-brand-text-muted bg-brand-primary/40 px-2 py-0.5 rounded-full border border-brand-text-muted/30 capitalize tracking-normal">
                        Ac {(item.armorStats.baseAC || 0) + (item.armorStats.plusAC || 0)}
                        {item.armorStats.plusAC !== 0 && ` (${item.armorStats.plusAC >= 0 ? '+' : ''}${item.armorStats.plusAC})`}
                    </span>
                )}
                
                {/* Passive Buffs */}
                {item.buffs?.map((buff, idx) => {
                    const { label, colorClass } = getBuffTag(buff);
                    return (
                        <span key={idx} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border bg-brand-bg/50 ${colorClass} tracking-normal`}>
                            {label}
                        </span>
                    );
                })}

                {/* Active Power Slot */}
                {item.effect && (
                    <span className="text-[9px] font-bold text-purple-400 bg-purple-900/10 px-2 py-0.5 rounded-full border border-purple-400/50 flex items-center gap-1.5 tracking-normal">
                        <Icon name="sparkles" className="w-2 h-2" />
                        {getActivePowerPill(item.effect).label}
                    </span>
                )}
            </div>
        </div>
        
        <button 
            className={`
                btn-sm min-w-[70px] gap-1
                ${canAfford ? 'btn-primary' : 'btn-secondary opacity-50'}
            `}
        >
            <span className="tabular-nums">{item.price}</span>
            <Icon name="currencyCoins" className="w-3.5 h-3.5" />
        </button>
    </div>
);

const SellItemCard: React.FC<{ item: Item & { _sourceList?: string }, onSell: (item: Item) => void }> = ({ item, onSell }) => {
    const sellPrice = Math.floor((item.price || 0) / 2);
    
    return (
        <div 
            onClick={() => onSell(item)}
            className="bg-brand-surface p-3 rounded-xl border border-brand-primary/50 flex justify-between items-center group hover:border-brand-danger/30 transition-all cursor-pointer hover:bg-brand-surface-raised relative overflow-hidden"
        >
             <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-danger opacity-0 group-hover:opacity-100 transition-opacity" />
             
             <div className="flex-grow min-w-0 mr-4 pl-2">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-body-base font-bold truncate ${getItemRarityColor(item.rarity)}`}>{item.name}</span>
                    {item.quantity && item.quantity > 1 && <span className="text-body-sm font-bold text-brand-text-muted">x{item.quantity}</span>}
                    {item._sourceList && item._sourceList !== 'Carried' && (
                        <span className="text-[9px] font-bold text-brand-text-muted bg-brand-primary/40 px-2 py-0.5 rounded-full border border-brand-text-muted/30 tracking-normal">
                            {item._sourceList}
                        </span>
                    )}
                </div>
                 <p className="text-body-sm text-brand-text-muted line-clamp-1 italic">{item.description}</p>
             </div>
             
             <button 
                className="btn-secondary btn-sm min-w-[70px] gap-1 text-brand-text border-brand-primary hover:border-brand-danger hover:text-brand-danger"
            >
                <span className="tabular-nums">{sellPrice}</span>
                <Icon name="currencyCoins" className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

const StoreView: React.FC = () => {
    const { 
        gameData, 
        fetchStoreCategory, 
        buyItem, 
        sellItem, 
        identifyAndAppraiseItems 
    } = useContext(GameDataContext);
    
    const [mode, setMode] = useState<'buy' | 'sell'>('buy');
    const [activeScale, setActiveScale] = useState<'Person' | 'Mount' | 'Ship'>('Person');
    const [activeCategory, setActiveCategory] = useState(SHOP_CATEGORIES[0].id);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);

    // Initial load of category
    useEffect(() => {
        if (mode === 'buy') {
            loadCategory(activeCategory);
        }
    }, [activeCategory, activeScale, mode]);

    const loadCategory = async (cat: string) => {
        // If data exists, don't auto-fetch, let user refresh if they want
        const cacheKey = `${activeScale}:${cat}`;
        if (gameData?.globalStoreInventory && gameData.globalStoreInventory[cacheKey]) return;
        handleRefreshCategory(cat);
    };

    const handleRefreshCategory = async (cat: string = activeCategory) => {
        setIsLoading(true);
        try {
            await fetchStoreCategory(cat, activeScale, true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    if (!gameData) return <div className="text-center p-8 text-brand-text-muted animate-pulse">Synchronizing ledger...</div>;

    const inventory = gameData.globalStoreInventory?.[`${activeScale}:${activeCategory}`] || [];
    const playerGold = gameData.playerInventory.carried.find(i => i.tags?.includes('currency'))?.quantity || 0;
    const currencyName = gameData.mapSettings?.style === 'sci-fi' ? 'Credits' : 'Gold';
    
    // Filter sellable items (must have price, not be currency)
    const allItemsForSale = [
        ...gameData.playerInventory.carried.map(i => Object.assign(i.clone(), { _sourceList: 'Carried' })),
        ...gameData.playerInventory.equipped.map(i => Object.assign(i.clone(), { _sourceList: 'Equipped' })),
        ...gameData.playerInventory.storage.map(i => Object.assign(i.clone(), { _sourceList: 'Stored' }))
    ];

    const sellableItems = allItemsForSale.filter(i => 
        !i.tags?.includes('currency') && 
        (i.price || 0) > 0
    );

    // Count Unidentified
    const unidentifiedCount = allItemsForSale.filter(i => 
        i.tags?.includes('unidentified') || 
        (i.name && i.name.toLowerCase().includes('unidentified'))
    ).length;

    const handleBuyClick = (item: StoreItem) => {
        setSelectedItem(item);
    };

    const handleSellClick = (item: Item) => {
        setSelectedItem(item);
    };

    const handleIdentify = async () => {
        setIsLoading(true);
        try {
            await identifyAndAppraiseItems();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const confirmTransaction = async (quantity: number) => {
        if (selectedItem) {
            if (mode === 'buy') {
                await buyItem(selectedItem as StoreItem, quantity);
            } else {
                // Sell logic
                const sellPrice = Math.floor((selectedItem.price || 0) / 2);
                await sellItem(selectedItem, sellPrice, quantity);
            }
        }
    };

    return (
        <div className="p-4 pt-8 max-w-2xl mx-auto h-full flex flex-col">
            <h1 className="text-center mb-1">Marketplace</h1>
            <p className="text-body-base text-brand-text-muted mb-4 text-center font-medium italic">Buy and sell equipment and supplies.</p>
            
            <div className="flex justify-center mb-4 bg-brand-surface p-1 rounded-2xl w-full max-w-xs mx-auto border border-brand-primary/30 shadow-sm">
                <button 
                    onClick={() => setMode('buy')}
                    className={`flex-1 btn-md transition-all duration-200 focus:outline-none ${
                        mode === 'buy' 
                            ? 'btn-primary shadow-lg shadow-brand-accent/20' 
                            : 'text-brand-text-muted hover:text-brand-text'
                    }`}
                >
                    Buy
                </button>
                <button 
                    onClick={() => setMode('sell')}
                    className={`flex-1 btn-md transition-all duration-200 focus:outline-none ${
                        mode === 'sell' 
                            ? 'bg-brand-danger text-white shadow-lg shadow-brand-danger/20' 
                            : 'text-brand-text-muted hover:text-brand-text'
                    }`}
                >
                    Sell
                </button>
            </div>

            {mode === 'buy' && (
                <div className="flex justify-center gap-8 mb-3 animate-fade-in border-b border-brand-primary/20 pb-2">
                    <ScaleRadio label="Person" isActive={activeScale === 'Person'} onClick={() => setActiveScale('Person')} />
                    <ScaleRadio label="Mount" isActive={activeScale === 'Mount'} onClick={() => setActiveScale('Mount')} />
                    <ScaleRadio label="Ship" isActive={activeScale === 'Ship'} onClick={() => setActiveScale('Ship')} />
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scroll pr-1 pb-24">
                <div className="space-y-4 animate-fade-in">
                    
                    {mode === 'buy' ? (
                        <>
                            <div className="flex flex-col w-full px-1">
                                <div className="flex justify-center items-center mb-4">
                                    <div className="flex items-center gap-1.5 text-brand-accent font-black text-xs tabular-nums bg-brand-accent/5 px-3 py-1 rounded-full border border-brand-accent/20 shadow-sm">
                                        <Icon name="currencyCoins" className="w-3.5 h-3.5" />
                                        <span>{playerGold} {currencyName}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 w-full">
                                    {SHOP_CATEGORIES.map(cat => (
                                        <CategoryTab 
                                            key={cat.id}
                                            label={cat.label} 
                                            isActive={activeCategory === cat.id} 
                                            onClick={() => setActiveCategory(cat.id)} 
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-center w-full">
                                <button 
                                    onClick={() => handleRefreshCategory()} 
                                    disabled={isLoading}
                                    className="btn-secondary btn-md w-48"
                                >
                                    {isLoading ? (
                                        <><Icon name="spinner" className="w-4 h-4 animate-spin mr-2" /> Stocking...</>
                                    ) : (
                                        <><Icon name="refresh" className="w-4 h-4 mr-2" /> Request shipment</>
                                    )}
                                </button>
                            </div>

                            <div>
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center h-48 text-brand-text-muted">
                                        <Icon name="spinner" className="w-8 h-8 animate-spin mb-4 text-brand-accent" />
                                        <p className="text-body-sm font-bold animate-pulse">Negotiating with suppliers...</p>
                                    </div>
                                ) : inventory.length > 0 ? (
                                    <div className="space-y-2">
                                        {inventory.map((item, idx) => (
                                            <StoreItemCard 
                                                key={`${item.id}-${idx}`} 
                                                item={item} 
                                                onBuy={handleBuyClick} 
                                                canAfford={(item.price || 99999) <= playerGold}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-brand-text-muted italic border-2 border-dashed border-brand-primary/30 rounded-2xl bg-brand-surface/20">
                                        <p className="text-body-base">The shelves are bare.</p>
                                        <p className="text-body-sm mt-1 opacity-60">Try requesting a new shipment above.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="animate-fade-in">
                             <div className="flex justify-between items-end mb-3 px-1">
                                <h3 className="mb-0 text-body-base">Personal Gear</h3>
                                <div className="flex items-center gap-1.5 text-brand-accent font-black text-xs tabular-nums bg-brand-accent/5 px-3 py-1 rounded-full border border-brand-accent/20 shadow-sm">
                                    <Icon name="currencyCoins" className="w-3.5 h-3.5" />
                                    <span>{playerGold} {currencyName}</span>
                                </div>
                            </div>
                            
                            {unidentifiedCount > 0 && (
                                <div className="mb-3 p-4 bg-brand-accent/5 border border-brand-accent/20 rounded-2xl flex justify-between items-center animate-page">
                                    <div className="text-body-sm font-medium text-brand-text">
                                        <span className="font-black text-brand-accent">{unidentifiedCount}</span> unidentified item{unidentifiedCount !== 1 ? 's' : ''}.
                                    </div>
                                    <button
                                        onClick={handleIdentify}
                                        disabled={isLoading}
                                        className="btn-primary btn-sm gap-2 shadow-sm"
                                    >
                                        {isLoading ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : <Icon name="search" className="w-4 h-4" />}
                                        Identify & appraise
                                    </button>
                                </div>
                            )}

                            {sellableItems.length > 0 ? (
                                <div className="space-y-2">
                                    {sellableItems.map((item) => (
                                        <SellItemCard 
                                            key={item.id} 
                                            item={item} 
                                            onSell={handleSellClick} 
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-brand-text-muted italic border-2 border-dashed border-brand-primary/30 rounded-2xl bg-brand-surface/20">
                                    <p className="text-body-base">Nothing valuable found in your backpack.</p>
                                    {unidentifiedCount > 0 && <p className="text-body-sm mt-1 opacity-60">Identify your loot to reveal its market value.</p>}
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="mt-4 p-4 bg-brand-surface rounded-2xl border border-brand-primary/30 text-center shadow-inner">
                        <p className="text-body-sm text-brand-text-muted italic leading-relaxed">
                            Prices fluctuate based on location and scarcity. Selling items typically returns 50% of their base value.
                        </p>
                    </div>
                </div>
            </div>

            {selectedItem && (
                <QuantityModal
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    item={selectedItem}
                    action={mode === 'buy' ? 'Buy' : 'Sell'}
                    maxQuantity={mode === 'buy' ? 99 : (selectedItem.quantity || 1)}
                    onConfirm={confirmTransaction}
                    balance={playerGold}
                />
            )}
        </div>
    );
};

export default StoreView;
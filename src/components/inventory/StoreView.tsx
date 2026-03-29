// components/inventory/StoreView.tsx

import React, { useContext, useState, useEffect, useMemo } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { Item, StoreItem, getItemRarityColor, FORGE_GROUPS } from '../../types';
import { Icon } from '../Icon';
import QuantityModal from '../QuantityModal';
import { CurrencyDisplay } from './CurrencyDisplay';
import Modal from '../Modal';
import PageHeader from '../PageHeader';
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
                    <span className="text-[10px] font-bold text-brand-text-muted bg-brand-primary/40 px-2 py-0.5 rounded-lg border border-brand-text-muted/30">
                        {item.weaponStats.damages[0].dice} {item.weaponStats.damages[0].type}
                        {item.weaponStats.enhancementBonus !== 0 && ` (${item.weaponStats.enhancementBonus >= 0 ? '+' : ''}${item.weaponStats.enhancementBonus})`}
                    </span>
                )}
                {item.armorStats && (
                    <span className="text-body-sm text-brand-text-muted">
                        AC {(item.armorStats.baseAC || 0) + (item.armorStats.plusAC || 0)}
                        {item.armorStats.plusAC !== 0 && ` (${item.armorStats.plusAC >= 0 ? '+' : ''}${item.armorStats.plusAC})`}
                    </span>
                )}

                {/* Passive Buffs */}
                {item.buffs?.map((buff, idx) => {
                    const { label, colorClass } = getBuffTag(buff);
                    return (
                        <span key={idx} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-brand-bg/50 ${colorClass}`}>
                            {label}
                        </span>
                    );
                })}

                {/* Active Power Slot */}
                {item.effect && (
                    <span className="text-[10px] font-bold text-purple-400 bg-purple-900/10 px-2 py-0.5 rounded-lg border border-purple-400/50 flex items-center gap-1.5">
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
                        <span className="text-[10px] font-bold text-brand-text-muted bg-brand-primary/40 px-2 py-0.5 rounded-lg border border-brand-text-muted/30">
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
        identifyAndAppraiseItems
    } = useContext(GameDataContext);

    const [mode] = useState<'buy' | 'sell'>('buy');
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

    const currentZone = gameData.mapZones?.find(z => z.coordinates === gameData.playerCoordinates);
    const hasShipyard = currentZone?.zoneFeatures?.includes('Shipyard') || currentZone?.populationLevel === 'Capital';

    // Reset active scale if user had Ship selected but Shipyard is no longer available
    useEffect(() => {
        if (!hasShipyard && activeScale === 'Ship') {
            setActiveScale('Person');
        }
    }, [hasShipyard, activeScale]);

    const sellableItems: Item[] = [];


    const handleBuyClick = (item: StoreItem) => {
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

    const confirmTransaction = async (quantity: number, recipientId?: string) => {
        if (selectedItem && mode === 'buy') {
            await buyItem(selectedItem as StoreItem, quantity, recipientId);
        }
    };

    return (
        <div className="max-w-2xl mx-auto h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scroll px-4 pb-24 pr-1">
                <div className="animate-fade-in pt-0">
                    <PageHeader 
                        title="Merchant" 
                        subtitle="Buy equipment and supplies." 
                        showReturnButton={true}
                    />

                    <div className="sticky top-0 z-20 bg-brand-bg pb-3 -mx-4 px-4 border-b border-brand-primary/20 mb-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">

                        <div className="flex justify-center gap-8 mb-4">
                            <ScaleRadio label="Person" isActive={activeScale === 'Person'} onClick={() => setActiveScale('Person')} />
                            <ScaleRadio label="Mount" isActive={activeScale === 'Mount'} onClick={() => setActiveScale('Mount')} />
                            {hasShipyard && (
                                <ScaleRadio label="Ship" isActive={activeScale === 'Ship'} onClick={() => setActiveScale('Ship')} />
                            )}
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

                    <div className="space-y-4">
                        <div className="flex flex-col w-full px-1">
                            <div className="flex justify-center items-center mb-4">
                                <div className="flex items-center gap-1.5 text-brand-accent font-bold text-[10px] tabular-nums bg-brand-accent/5 px-3 py-1 rounded-lg border border-brand-accent/20 shadow-sm">
                                    <Icon name="currencyCoins" className="w-3.5 h-3.5" />
                                    <span>{playerGold} {currencyName}</span>
                                </div>
                            </div>
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

                        <div className="flex flex-col items-center justify-center w-full gap-4 pt-4 border-t border-brand-primary/10">
                            <p className="text-[10px] font-bold text-brand-text-muted opacity-60">
                                Can't Find What You Are Looking For?
                            </p>
                            <button
                                onClick={() => handleRefreshCategory()}
                                disabled={isLoading}
                                className="btn-secondary btn-md w-60"
                            >
                                {isLoading ? (
                                    <><Icon name="spinner" className="w-4 h-4 animate-spin mr-2" /> Stocking...</>
                                ) : (
                                    <><Icon name="refresh" className="w-4 h-4 mr-2 text-brand-accent" /> Request Shipment</>
                                )}
                            </button>
                        </div>

                        <div className="mt-4 p-4 bg-brand-surface rounded-2xl border border-brand-primary/30 text-center shadow-inner">
                            <p className="text-body-sm text-brand-text-muted italic leading-relaxed">
                                Prices fluctuate based on location and scarcity.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {selectedItem && (
                <QuantityModal
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    item={selectedItem}
                    action="Buy"
                    maxQuantity={99}
                    onConfirm={confirmTransaction}
                    balance={playerGold}
                    characters={[gameData.playerCharacter, ...gameData.companions]}
                />
            )}
        </div>
    );
};


export default StoreView;

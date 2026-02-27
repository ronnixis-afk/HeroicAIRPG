// components/inventory/InventoryView.tsx

import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
/* Fix: Import GameDataContextType alongside GameDataContext to ensure proper type inference for context values */
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Item, Companion, type BodySlot, type WorldStyle, type Inventory } from '../../types';
import { Icon } from '../Icon';
import { BodyPaperDoll } from '../BodyPaperDoll';
import Modal from '../Modal';

// Components
import { InventoryTab } from './InventoryTab';
import { InventoryGridItem } from './InventoryGridItem';
import { ItemDetailView } from './ItemDetailView';

type InventoryListType = 'carried' | 'storage' | 'assets';

const isSlotCompatible = (tag: string | undefined, slot: string): boolean => {
    if (!tag) return true;
    const t = tag.toLowerCase().trim();
    const s = slot.toLowerCase().trim();

    if (t === s) return true;

    const RING_SLOTS = ['ring 1', 'ring 2'];
    const ACC_SLOTS = ['accessory 1', 'accessory 2'];
    const HAND_SLOTS = ['main hand', 'off hand'];

    if (t === 'ring' && RING_SLOTS.includes(s)) return true;
    if (t === 'accessory' && ACC_SLOTS.includes(s)) return true;
    
    // Weapon slot logic: Light and Medium can go in either. Heavy is restricted to Main.
    if (t === 'heavy weapon') {
        return s === 'main hand';
    }
    
    // Updated to allow "Main Hand" and "Off Hand" tags to be compatible with both hand slots
    const weaponTags = ['hand', 'weapon', 'light weapon', 'medium weapon', 'main hand', 'off hand'];
    if (weaponTags.includes(t) && HAND_SLOTS.includes(s)) return true;

    if (RING_SLOTS.includes(t) && RING_SLOTS.includes(s)) return true;
    if (ACC_SLOTS.includes(t) && ACC_SLOTS.includes(s)) return true;
    
    return false;
};

const InventoryView: React.FC = () => {
    /* Fix: Explicitly cast GameDataContext result to GameDataContextType to resolve multiple "Property does not exist" errors */
    const { gameData, equipItem, unequipItem, markInventoryItemAsSeen, moveItem, transferItem, dropItem, performPlayerAttack } = useContext(GameDataContext) as GameDataContextType;
    const { selectedCharacterId, setSelectedCharacterId } = useUI();
    
    // UI State
    const [activeOwner, setActiveOwner] = useState(selectedCharacterId || 'player');
    const [activeList, setActiveList] = useState<InventoryListType>('carried');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [equipModalItemId, setEquipModalItemId] = useState<string | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);
    
    // Batch Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedCharacterId) {
            setActiveOwner(selectedCharacterId);
        }
    }, [selectedCharacterId]);

    useEffect(() => {
        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            setIsScrolled(target.scrollTop > 30);
        };
        const scrollContainer = containerRef.current?.closest('.custom-scroll');
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', handleScroll);
            return () => scrollContainer.removeEventListener('scroll', handleScroll);
        }
    }, []);

    if (!gameData) return <div className="text-center p-8 text-body-base">Loading inventory...</div>;

    const { playerCharacter, companions, playerInventory, companionInventories, mapSettings, combatState } = gameData;
    const isCombatActive = combatState?.isActive || false;
    
    const isPlayerView = activeOwner === 'player';
    const activeCharacter = isPlayerView ? playerCharacter : companions.find(c => c.id === activeOwner);
    const activeInventory = isPlayerView ? playerInventory : (companionInventories?.[activeOwner]);

    if (!activeInventory || !activeCharacter) {
        if (!isPlayerView) {
            setActiveOwner('player');
            setSelectedCharacterId('player');
        }
        return <div className="text-center p-8 text-body-base">Loading inventory...</div>;
    }

    const combatStats = useMemo(() => {
        return activeCharacter.getCombatStats(activeInventory);
    }, [activeCharacter, activeInventory]);

    const hasUnarmedStyle = useMemo(() => activeCharacter.abilities.some(a => a.name === "Unarmed Style"), [activeCharacter.abilities]);
    const isUnarmed = useMemo(() => !activeInventory.equipped.some(item => 
        (item.weaponStats || item.tags?.some(t => t.toLowerCase().includes('weapon')) || item.tags?.includes('heavy weapon')) &&
        (item.equippedSlot === 'Main Hand' || item.equippedSlot === 'Off Hand')
    ), [activeInventory.equipped]);

    const selectedItemData = useMemo(() => {
        if (!selectedItemId || !activeInventory) return null;
        const lists: (keyof Inventory)[] = ['equipped', 'carried', 'storage', 'assets'];
        for (const l of lists) {
            const item = activeInventory[l].find(i => i.id === selectedItemId);
            if (item) return { item, list: l };
        }
        return null;
    }, [selectedItemId, activeInventory]);

    const itemToEquip = useMemo(() => {
        if (!equipModalItemId || !activeInventory) return null;
        const all = [...activeInventory.equipped, ...activeInventory.carried, ...activeInventory.storage, ...activeInventory.assets];
        return all.find(i => i.id === equipModalItemId) || null;
    }, [equipModalItemId, activeInventory]);

    const currentGridItems = useMemo(() => {
        const list = activeInventory[activeList] || [];
        return [...list].sort((a, b) => {
            const aIsCurrency = a.tags?.includes('currency');
            const bIsCurrency = b.tags?.includes('currency');
            if (aIsCurrency && !bIsCurrency) return -1;
            if (!aIsCurrency && bIsCurrency) return 1;
            if (a.isNew && !b.isNew) return -1;
            if (!a.isNew && b.isNew) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [activeInventory, activeList]);

    const unslottedEquipped = activeInventory.equipped.filter(i => !i.equippedSlot);
    const primaryCurrencyItemId = activeInventory.carried.find(i => i.tags?.includes('currency'))?.id;

    const handleItemClick = (item: Item, list: keyof Inventory) => {
        if (isSelectionMode) {
            const newSelected = new Set(selectedIds);
            if (newSelected.has(item.id)) newSelected.delete(item.id);
            else newSelected.add(item.id);
            setSelectedIds(newSelected);
            if (newSelected.size === 0) setIsSelectionMode(false);
        } else {
            if (item.isNew) markInventoryItemAsSeen(item.id, activeOwner);
            setSelectedItemId(item.id);
        }
    };

    const handleLongPress = (item: Item) => {
        if (isCombatActive) return;
        setIsSelectionMode(true);
        setSelectedIds(new Set([item.id]));
    };

    const exitSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
    };

    const handleBatchMove = () => {
        if (activeList === 'assets') return;
        const toList = activeList === 'carried' ? 'storage' : 'carried';
        selectedIds.forEach(id => moveItem(id, activeList, toList, activeOwner));
        exitSelectionMode();
    };

    const handleBatchDelete = () => {
        if (window.confirm(`Permanently discard ${selectedIds.size} selected items?`)) {
            selectedIds.forEach(id => {
                const item = currentGridItems.find(i => i.id === id);
                if (item) dropItem(id, activeList, activeOwner, item.quantity || 1);
            });
            exitSelectionMode();
        }
    };

    const handleBatchTransfer = (toOwnerId: string) => {
        selectedIds.forEach(id => transferItem(id, activeOwner, activeList, toOwnerId));
        setIsTransferModalOpen(false);
        exitSelectionMode();
    };

    const handleSlotSelection = (slot: BodySlot) => {
        if (equipModalItemId) {
            const item = [...activeInventory.equipped, ...activeInventory.carried, ...activeInventory.storage, ...activeInventory.assets]
                .find(i => i.id === equipModalItemId);
            if (item) {
                if (item.bodySlotTag && !isSlotCompatible(item.bodySlotTag, slot)) {
                    alert(`Compatibility Error: This item requires the ${item.bodySlotTag} slot.`);
                    return;
                }
                equipItem(equipModalItemId, slot, activeOwner);
            }
            setEquipModalItemId(null);
            setSelectedItemId(null);
        }
    };

    const getInitials = (name: string) => name.slice(0, 2);

    const TabButton: React.FC<{label: string, isActive: boolean, onClick: () => void}> = ({ label, isActive, onClick }) => (
        <button
            onClick={onClick}
            className={`flex-1 btn-sm font-bold transition-all duration-200 focus:outline-none ${
                isActive ? 'bg-brand-surface text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-primary/50'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div ref={containerRef} className="p-2 pt-8 max-w-2xl mx-auto pb-24">
            <div className="flex justify-between items-center mb-2 px-2">
                <div className="w-10"></div>
                <h1 className="text-center flex-1">Inventory</h1>
                <div className="w-10 flex justify-end">
                    {isSelectionMode && (
                        <button onClick={exitSelectionMode} className="btn-icon text-brand-accent hover:bg-brand-primary transition-colors">
                            <Icon name="close" className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
            <p className="text-center text-brand-text-muted mb-6 text-body-base">Manage gear for yourself and your companions.</p>

            <div className={`sticky top-0 z-40 transition-all duration-300 -mx-2 px-2 bg-brand-bg/95 backdrop-blur-sm ${isScrolled ? 'py-1 shadow-lg border-b border-brand-primary/20' : 'py-4'}`}>
                <div className={`flex flex-nowrap items-center transition-all duration-300 overflow-x-auto no-scrollbar px-4 pt-2 pb-2 gap-4 justify-around`}>
                    <InventoryTab 
                        name={playerCharacter.name} 
                        initials={getInitials(playerCharacter.name)}
                        imageUrl={playerCharacter.imageUrl}
                        isActive={activeOwner === 'player'} 
                        onClick={() => { if(!isSelectionMode) { setActiveOwner('player'); setSelectedCharacterId('player'); } }} 
                        isShrunk={isScrolled}
                    />
                    {companions.map(comp => (
                        <InventoryTab 
                            key={comp.id} 
                            name={comp.name} 
                            initials={getInitials(comp.name)}
                            imageUrl={comp.imageUrl}
                            isActive={activeOwner === comp.id} 
                            onClick={() => { if(!isSelectionMode) { setActiveOwner(comp.id); setSelectedCharacterId(comp.id); } }} 
                            isShrunk={isScrolled}
                        />
                    ))}
                </div>
            </div>

            <div className="mb-10 mt-6 animate-fade-in">
                <div className="flex flex-col items-center mb-6 px-1">
                    <h2 className="mb-1 text-center">Equipped</h2>
                    <p className="text-body-sm text-brand-text-muted text-center max-w-xs">
                        {isCombatActive ? "Combat is active. Equipment changes are restricted." : "Current equipment and modifications."}
                    </p>
                    
                    {/* Weapon Stance Indicators with Tooltips */}
                    {isUnarmed && hasUnarmedStyle && (
                         <div className="mt-2 flex items-center justify-center gap-1.5 group/tooltip relative animate-fade-in">
                            <span className="text-body-sm text-brand-accent font-bold">Unarmed Style: Your fists are as deadly as blades (Base 1d6).</span>
                            <div className="text-brand-accent/60 cursor-help">
                                <Icon name="info" className="w-3.5 h-3.5" />
                            </div>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-brand-surface text-brand-text text-[10px] p-3 rounded-xl shadow-2xl border border-brand-primary opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 leading-relaxed font-normal text-left">
                                Your base unarmed damage increases to 1d6 and you use the higher of your Strength or Dexterity for attack and damage rolls.
                            </div>
                         </div>
                    )}

                    {combatStats.isFlurryActive && (
                         <div className="mt-2 flex items-center justify-center gap-1.5 group/tooltip relative animate-fade-in">
                            <span className="text-body-sm text-brand-accent font-bold">Flurry Of Blows Active</span>
                            <div className="text-brand-accent/60 cursor-help">
                                <Icon name="info" className="w-3.5 h-3.5" />
                            </div>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-brand-surface text-brand-text text-[10px] p-3 rounded-xl shadow-2xl border border-brand-primary opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 leading-relaxed font-normal text-left">
                                Your mastery of unarmed combat allows you to strike with incredible speed. Your number of attacks per round is doubled while your hands are free.
                            </div>
                         </div>
                    )}

                    {combatStats.isDualWielding && (
                         <div className="mt-2 flex items-center justify-center gap-1.5 group/tooltip relative">
                            <span className="text-body-sm text-brand-accent font-bold">You are dual wielding</span>
                            <div className="text-brand-accent/60 cursor-help">
                                <Icon name="info" className="w-3.5 h-3.5" />
                            </div>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-brand-surface text-brand-text text-[10px] p-3 rounded-xl shadow-2xl border border-brand-primary opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 leading-relaxed font-normal text-left">
                                You can attack {combatStats.numberOfAttacks} times per round (split between hands) at a -2 global penalty to attack rolls.
                            </div>
                         </div>
                    )}
                    {combatStats.isDueling && (
                         <div className="mt-2 flex items-center justify-center gap-1.5 group/tooltip relative">
                            <span className="text-body-sm text-brand-accent font-bold">You are dueling</span>
                            <div className="text-brand-accent/60 cursor-help">
                                <Icon name="info" className="w-3.5 h-3.5" />
                            </div>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-brand-surface text-brand-text text-[10px] p-3 rounded-xl shadow-2xl border border-brand-primary opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 leading-relaxed font-normal text-left">
                                You gain a +2 bonus to damage rolls and +1 to Ac for wielding a single weapon.
                            </div>
                         </div>
                    )}
                    {combatStats.isTwoHanding && (
                         <div className="mt-2 flex items-center justify-center gap-1.5 group/tooltip relative">
                            <span className="text-body-sm text-brand-accent font-bold">You are two-handing</span>
                            <div className="text-brand-accent/60 cursor-help">
                                <Icon name="info" className="w-3.5 h-3.5" />
                            </div>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-brand-surface text-brand-text text-[10px] p-3 rounded-xl shadow-2xl border border-brand-primary opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 leading-relaxed font-normal text-left">
                                Your damage bonus from {combatStats.mainHandAbilityName} is doubled when wielding a heavy weapon.
                            </div>
                         </div>
                    )}

                    {isCombatActive && <span className="text-[8px] text-brand-danger font-bold animate-pulse mt-2">Combat restricted</span>}
                </div>
                <div className="p-4 rounded-2xl">
                    <BodyPaperDoll 
                        equippedItems={activeInventory.equipped} 
                        onSlotClick={() => {}} 
                        onItemClick={(item) => handleItemClick(item, 'equipped')}
                        isShip={(activeCharacter as Companion).isShip}
                        setting={(mapSettings?.style || 'fantasy') as WorldStyle}
                    />
                </div>

                {unslottedEquipped.length > 0 && (
                    <div className="mt-4 p-4 border border-brand-danger/10 bg-brand-danger/5 rounded-xl animate-fade-in">
                        <h3 className="mb-3 flex items-center gap-2">
                            <Icon name="danger" className="w-4 h-4 text-brand-danger" />
                            Unassigned Equipment
                        </h3>
                        <div className="grid grid-cols-4 gap-2">
                            {unslottedEquipped.map(item => (
                                <InventoryGridItem 
                                    key={item.id} 
                                    item={item} 
                                    onClick={() => handleItemClick(item, 'equipped')} 
                                    onLongPress={() => handleLongPress(item)}
                                    isSelected={selectedIds.has(item.id)}
                                    isSelectionMode={isSelectionMode}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="animate-fade-in">
                        <div className="flex justify-center mb-4 bg-brand-primary p-1 rounded-xl w-full max-w-sm mx-auto shadow-sm">
                    <TabButton label="Carried" isActive={activeList === 'carried'} onClick={() => { if(!isSelectionMode) setActiveList('carried'); }} />
                    {isPlayerView && <TabButton label="Storage" isActive={activeList === 'storage'} onClick={() => { if(!isSelectionMode) setActiveList('storage'); }} />}
                    <TabButton label="Assets" isActive={activeList === 'assets'} onClick={() => { if(!isSelectionMode) setActiveList('assets'); }} />
                </div>

                <div className="text-center px-4 mb-6 transition-all duration-300 min-h-[40px]">
                    {isSelectionMode ? (
                        <p className="text-body-sm text-brand-accent font-bold animate-fade-in">
                            Selection mode: {selectedIds.size} items selected
                        </p>
                    ) : (
                        <p className="text-body-sm text-brand-text-muted leading-relaxed">
                            {activeList === 'carried' ? "Functional gear and trade goods. Only carried items can be sold." : activeList === 'storage' ? "Extra gear kept at your home base. Items here must be moved to Carried to be used." : "Large property and global holdings."}
                        </p>
                    )}
                </div>

                {currentGridItems.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 sm:gap-3 px-1 animate-fade-in">
                        {currentGridItems.map(item => (
                            <InventoryGridItem 
                                key={item.id} 
                                item={item} 
                                onClick={() => handleItemClick(item, activeList)} 
                                onLongPress={() => handleLongPress(item)}
                                isSelected={selectedIds.has(item.id)}
                                isSelectionMode={isSelectionMode}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center border-2 border-dashed border-brand-primary/30 rounded-2xl bg-brand-surface/20">
                        <Icon name="inventory" className="w-10 h-10 mx-auto mb-3 text-brand-text-muted opacity-30" />
                        <p className="text-body-base text-brand-text-muted italic">This inventory pocket is currently empty.</p>
                    </div>
                )}
            </div>

            {/* Selection Toolbar */}
            {isSelectionMode && (
                <div className="fixed inset-x-0 bottom-24 flex justify-center z-[55] pointer-events-none px-4 animate-modal">
                    <div className="bg-brand-surface border border-brand-primary rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-2 overflow-hidden pointer-events-auto w-full max-w-sm">
                        <button 
                            onClick={handleBatchMove} 
                            disabled={activeList === 'assets'}
                            className="flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-brand-primary transition-all disabled:opacity-30 group"
                        >
                            <Icon name="refresh" className="w-5 h-5 text-brand-accent group-hover:rotate-180 transition-transform duration-500" />
                            <span className="text-body-sm font-bold text-brand-text-muted">Move</span>
                        </button>
                        
                        <button 
                            onClick={() => setIsTransferModalOpen(true)}
                            disabled={companions.length === 0 || activeList === 'assets'}
                            className="flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-brand-primary transition-all disabled:opacity-30"
                        >
                            <Icon name="character" className="w-5 h-5 text-brand-accent" />
                            <span className="text-body-sm font-bold text-brand-text-muted">Transfer</span>
                        </button>
                        
                        <button 
                            onClick={handleBatchDelete}
                            className="flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-brand-primary transition-all group"
                        >
                            <Icon name="trash" className="w-5 h-5 text-brand-danger group-hover:scale-110 transition-transform" />
                            <span className="text-body-sm font-bold text-brand-text-muted">Discard</span>
                        </button>
                    </div>
                </div>
            )}

            {selectedItemData && (
                <Modal isOpen={!!selectedItemId} onClose={() => setSelectedItemId(null)} title="Item Details">
                    <ItemDetailView 
                        item={selectedItemData.item}
                        ownerId={activeOwner}
                        character={activeCharacter}
                        fromList={selectedItemData.list}
                        primaryCurrencyItemId={primaryCurrencyItemId}
                        onEquipRequest={() => setEquipModalItemId(selectedItemId)}
                        onUnequipRequest={() => {
                            unequipItem(selectedItemId!, activeOwner);
                            setSelectedItemId(null);
                        }}
                        onActionCompleted={() => setSelectedItemId(null)}
                    />
                </Modal>
            )}

            {equipModalItemId && itemToEquip && (
                <Modal isOpen={!!equipModalItemId} onClose={() => setEquipModalItemId(null)} title="Assign Slot">
                    <div className="p-4 max-h-[75vh] overflow-y-auto custom-scroll">
                        <div className="text-center mb-6">
                            <p className="text-body-sm text-brand-text-muted mb-2 font-bold">
                                Assigning: <span className="text-brand-text capitalize inline-block">{itemToEquip.name}</span>
                            </p>
                            {itemToEquip.bodySlotTag && (
                                <p className="text-[10px] text-brand-accent font-bold bg-brand-accent/5 py-1.5 rounded inline-block px-4 border border-brand-accent/20">
                                    Required slot: <span className="capitalize inline-block">{itemToEquip.bodySlotTag}</span>
                                </p>
                            )}
                        </div>
                        <BodyPaperDoll 
                            equippedItems={activeInventory.equipped} 
                            onSlotClick={handleSlotSelection}
                            onItemClick={() => {}} 
                            selectionMode={true}
                            isShip={(activeCharacter as Companion).isShip}
                            setting={(mapSettings?.style || 'fantasy') as WorldStyle}
                            validSlotTag={itemToEquip.bodySlotTag}
                        />
                        <button onClick={() => setEquipModalItemId(null)} className="btn-tertiary w-full mt-8 btn-md">Cancel Assignment</button>
                    </div>
                </Modal>
            )}

            {isTransferModalOpen && (
                <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="Batch Transfer">
                    <div className="p-4 space-y-3">
                        <p className="text-body-sm text-brand-text-muted text-center mb-6 font-bold">Transfer {selectedIds.size} items to:</p>
                        <div className="flex flex-col gap-2">
                            {activeOwner !== 'player' && (
                                <button onClick={() => handleBatchTransfer('player')} className="w-full p-4 bg-brand-primary rounded-xl text-brand-text font-bold text-sm hover:bg-brand-surface transition-all border border-brand-surface flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-bg border border-brand-primary flex-shrink-0 shadow-sm">
                                        {gameData.playerCharacter.imageUrl ? (
                                            <img src={gameData.playerCharacter.imageUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs font-bold text-brand-text-muted flex items-center justify-center h-full">
                                                {gameData.playerCharacter.name.slice(0,2).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <span className="text-body-base font-bold">{gameData.playerCharacter.name}</span>
                                        <span className="text-[8px] text-brand-accent font-medium">Lead Character</span>
                                    </div>
                                    <Icon name="chevronDown" className="w-4 h-4 -rotate-90 ml-auto opacity-40" />
                                </button>
                            )}
                            {companions.filter(c => c.id !== activeOwner).map(c => (
                                <button key={c.id} onClick={() => handleBatchTransfer(c.id)} className="w-full p-4 bg-brand-primary rounded-xl text-brand-text font-bold text-sm hover:bg-brand-surface transition-all border border-brand-surface flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-bg border border-brand-primary flex-shrink-0 shadow-sm">
                                        {c.imageUrl ? (
                                            <img src={c.imageUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs font-bold text-brand-text-muted flex items-center justify-center h-full">
                                                {c.name.slice(0,2).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <span className="text-body-base font-bold">{c.name}</span>
                                        <span className="text-[8px] text-brand-text-muted font-medium capitalize">
                                            {c.isShip ? 'Vessel' : (c.isMount ? 'Mount' : 'Companion')}
                                        </span>
                                    </div>
                                    <Icon name="chevronDown" className="w-4 h-4 -rotate-90 ml-auto opacity-40" />
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setIsTransferModalOpen(false)} className="btn-tertiary w-full mt-6 btn-md">Cancel</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default InventoryView;
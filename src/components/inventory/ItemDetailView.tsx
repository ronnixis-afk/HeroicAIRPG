// components/inventory/ItemDetailView.tsx

import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import { Item, type Inventory, PlayerCharacter, Companion, type BodySlot, getItemRarityColor, ITEM_TAGS, type AbilityEffect, BODY_SLOTS, BODY_SLOT_TAGS } from '../../types';
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import AutoResizingTextarea from '../AutoResizingTextarea';
import QuantityModal from '../QuantityModal';
import { TagEditor } from '../TagEditor';
import { KeywordEditor } from '../KeywordEditor';
import { getSlotSynonym } from '../../utils/slotUtils';

// Editors
import { ModifierManager } from './editors/ModifierManager';
import { WeaponStatsEditor } from './editors/WeaponStatsEditor';
import { ArmorStatsEditor } from './editors/ArmorStatsEditor';
import { ItemUsageEditor } from './editors/ItemUsageEditor';
import { EffectBuilder } from '../character/editors/EffectBuilder';
import { getBuffTag, getEnhancementPill, getActivePowerPill, MechanicalPill } from '../../utils/itemModifiers';

interface ItemDetailViewProps {
    item: Item;
    ownerId: string;
    character: PlayerCharacter | Companion;
    fromList: keyof Inventory;
    primaryCurrencyItemId?: string;
    onEquipRequest?: () => void;
    onUnequipRequest?: () => void;
    onActionCompleted?: () => void;
}

export const ItemDetailView: React.FC<ItemDetailViewProps> = ({ 
    item, ownerId, character, fromList, primaryCurrencyItemId, 
    onEquipRequest, onUnequipRequest, onActionCompleted 
}) => {
    const { gameData, dropItem, splitItem, updateItem, moveItem, useItem, transferItem, consolidateCurrency, performPlayerAttack } = useContext(GameDataContext) as GameDataContextType;

    const [localItem, setLocalItem] = useState(item);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isUsingItem, setIsUsingItem] = useState(false);
    const [isTransferDropdownOpen, setIsTransferDropdownOpen] = useState(false);
    const [isDropModalOpen, setIsDropModalOpen] = useState(false);
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (item) setLocalItem(item);
    }, [item]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsTransferDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const safeLocalTags = useMemo(() => Array.isArray(localItem?.tags) ? localItem.tags : [], [localItem?.tags]);
    const isWeapon = safeLocalTags.some(tag => typeof tag === 'string' && tag.toLowerCase().includes('weapon'));
    const isArmor = safeLocalTags.some(tag => typeof tag === 'string' && tag.toLowerCase().includes('armor'));
    const isShield = safeLocalTags.some(tag => typeof tag === 'string' && ['shield'].includes(tag.toLowerCase()));
    const isBuff = safeLocalTags.some(tag => typeof tag === 'string' && tag.toLowerCase() === 'buff');
    const isMechanical = safeLocalTags.some(tag => typeof tag === 'string' && tag.toLowerCase() === 'mechanical');
    const isConsolidatable = localItem?.tags?.some(tag => tag.toLowerCase() === 'currency') && item?.id !== primaryCurrencyItemId && primaryCurrencyItemId !== undefined;
    const canSplit = (item.quantity || 1) > 1;

    const isDirty = useMemo(() => {
        if (!localItem || !item) return false;
        try {
            return JSON.stringify(localItem) !== JSON.stringify(item);
        } catch (e) {
            return false;
        }
    }, [localItem, item]);

    /**
     * UNIFIED PILL CALCULATION
     * Aggregates all mechanical truth into high-visibility badges.
     */
    const mechanicalPills = useMemo(() => {
        const pills: MechanicalPill[] = [];

        // 1. Enhancement Pill (+1, +2 etc)
        const enhPill = getEnhancementPill(item);
        if (enhPill) pills.push(enhPill);

        // 2. Passive Buff Pills (Ability scores, skills, etc)
        if (item.buffs) {
            item.buffs.forEach(buff => {
                const tagData = getBuffTag(buff, gameData?.skillConfiguration);
                pills.push({
                    label: tagData.label,
                    colorClass: tagData.colorClass
                });
            });
        }

        // 3. Active Power Pill (Spells, special effects)
        if (item.effect) {
            pills.push(getActivePowerPill(item.effect));
        }

        return pills;
    }, [item, gameData?.skillConfiguration]);

    const handleConfirmDrop = async (quantity: number) => {
        await dropItem(item.id, fromList, ownerId, quantity);
        if (onActionCompleted) onActionCompleted();
    };

    const handleConfirmSplit = async (quantity: number) => {
        await splitItem(item.id, fromList, ownerId, quantity);
        if (onActionCompleted) onActionCompleted();
    };
    
    const handleMove = (toList: keyof Inventory) => {
        moveItem(item.id, fromList, toList, ownerId);
        if (onActionCompleted) onActionCompleted();
    };

    const handleUse = async () => {
        setIsUsingItem(true);
        try {
            if (item.effect && ownerId === 'player') {
                let targetIds: string[] = [];
                if (item.effect.type === 'Heal') {
                    targetIds = [gameData?.playerCharacter.id || 'player'];
                } else if (gameData?.combatState?.enemies && gameData.combatState.enemies.length > 0) {
                    targetIds = [gameData.combatState.enemies[0].id];
                }

                if (targetIds.length > 0) {
                    await performPlayerAttack(item, targetIds);
                } else {
                    await useItem(item.id, fromList, ownerId);
                }
            } else {
                await useItem(item.id, fromList, ownerId);
            }
        } finally {
            setTimeout(() => {
                setIsUsingItem(false);
                if (onActionCompleted) onActionCompleted();
            }, 500);
        }
    };

    const handleSave = async () => {
        if (!isDirty) {
            setIsEditing(false);
            return;
        }
        setIsSaving(true);
        await updateItem(localItem, ownerId);
        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => {
            setSaveSuccess(false);
            setIsEditing(false);
        }, 800);
    };

    const handleTransfer = (toOwnerId: string) => {
        transferItem(item.id, ownerId, fromList, toOwnerId);
        setIsTransferDropdownOpen(false);
        if (onActionCompleted) onActionCompleted();
    };

    const handleNestedChange = (path: (string | number)[], value: any) => {
        setLocalItem(prev => {
            const newItem = prev.clone();
            let current: any = newItem;
            for (let i = 0; i < path.length - 1; i++) {
                const key = path[i];
                if (current[key] === undefined || current[key] === null) {
                    current[key] = typeof path[i + 1] === 'number' ? [] : {};
                }
                current = current[key];
            }
            const finalKey = path[path.length - 1];
            if (value === undefined) delete current[finalKey];
            else current[finalKey] = value;
            return newItem;
        });
    };
    
    const handleChange = (field: keyof Omit<Item, 'weaponStats' | 'armorStats'>, value: string | number) => {
        setLocalItem(prev => {
            const newItem = prev.clone();
            (newItem as any)[field] = value;
            return newItem;
        });
    };

    const handleTagsChange = (newTags: string[]) => {
        setLocalItem(prev => {
            const newItem = prev.clone();
            const addedTag = newTags.find(t => !prev.tags.includes(t));
            let finalTags = [...newTags];
            
            // Logic to prevent having multiple weapon/armor types simultaneously
            const weaponTags = ['Light Weapon', 'Medium Weapon', 'Heavy Weapon'];
            const armorTags = ['Light Armor', 'Medium Armor', 'Heavy Armor'];

            if (addedTag && weaponTags.some(wt => wt.toLowerCase() === addedTag.toLowerCase())) {
                finalTags = finalTags.filter(t => t.toLowerCase() === addedTag.toLowerCase() || !weaponTags.some(wt => wt.toLowerCase() === t.toLowerCase()));
            }
            if (addedTag && armorTags.some(at => at.toLowerCase() === addedTag.toLowerCase())) {
                finalTags = finalTags.filter(t => t.toLowerCase() === addedTag.toLowerCase() || !armorTags.some(at => at.toLowerCase() === t.toLowerCase()));
            }

            newItem.tags = finalTags;
            
            // Sync stats type if possible
            if (addedTag) {
                const lower = addedTag.toLowerCase();
                if (lower === 'light armor' && newItem.armorStats) newItem.armorStats.armorType = 'light';
                if (lower === 'medium armor' && newItem.armorStats) newItem.armorStats.armorType = 'medium';
                if (lower === 'heavy armor' && newItem.armorStats) newItem.armorStats.armorType = 'heavy';
                
                if (lower === 'light weapon' && newItem.weaponStats) newItem.weaponStats.ability = 'dexterity';
                if (lower === 'medium weapon' && newItem.weaponStats) newItem.weaponStats.ability = 'strength';
                if (lower === 'heavy weapon' && newItem.weaponStats) newItem.weaponStats.ability = 'strength';
            }

            return newItem;
        });
    };

    const handleKeywordsChange = (newKeywords: string[]) => {
        setLocalItem(prev => {
            const newItem = prev.clone();
            newItem.keywords = newKeywords;
            return newItem;
        });
    };

    const handleInitializeArmorStats = (type: 'armor' | 'shield') => {
        handleNestedChange(['armorStats'], {
            baseAC: type === 'shield' ? 2 : 11,
            armorType: type === 'shield' ? 'shield' : 'light',
            plusAC: 0,
            strengthRequirement: 0
        });
    };

    const handleInitializeWeaponStats = () => {
        handleNestedChange(['weaponStats'], {
            ability: 'strength',
            enhancementBonus: 0,
            damages: [{ dice: '1d6', type: 'Slashing' }],
            critRange: 20
        });
    };

    const ActionButton: React.FC<{onClick: () => void, children: React.ReactNode, className?: string}> = ({ onClick, children, className }) => (
        <button 
            onClick={onClick}
            className={`btn-secondary btn-md ${className || ''}`}
        >
            {children}
        </button>
    );

    const slotLabel = useMemo(() => {
        return getSlotSynonym(item.bodySlotTag, item.tags || []);
    }, [item.bodySlotTag, item.tags]);

    return (
        <div className="space-y-6">
            {isEditing ? (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-1 ml-1">Item Name</label>
                        <input type="text" value={localItem.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full input-md text-body-base" />
                    </div>
                    <div>
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-1 ml-1">Flavor Description</label>
                        <AutoResizingTextarea value={localItem.description} onChange={(e) => handleChange('description', e.target.value)} className="w-full bg-brand-primary p-3 rounded-md focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base leading-relaxed" />
                    </div>
                    <div>
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-1 ml-1">Lore and Details</label>
                        <AutoResizingTextarea value={localItem.details} onChange={(e) => handleChange('details', e.target.value)} className="w-full bg-brand-primary p-3 rounded-md focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base leading-relaxed" />
                    </div>
                    
                    <div>
                        <label className="block text-body-sm font-bold text-brand-text-muted mb-1 ml-1">Functional Slot (Anatomy Map)</label>
                        <div className="relative">
                            <select
                                value={localItem.bodySlotTag || ''}
                                onChange={(e) => handleChange('bodySlotTag', e.target.value)}
                                className="w-full input-md appearance-none text-body-base"
                            >
                                <option value="">None (Universal)</option>
                                {BODY_SLOT_TAGS.map(slot => (
                                    <option key={slot} value={slot}>{slot}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-brand-text-muted">
                                <Icon name="chevronDown" className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    <TagEditor label="Tags" tags={safeLocalTags} onTagsChange={handleTagsChange} options={ITEM_TAGS} />
                    <KeywordEditor keywords={localItem.keywords || []} onKeywordsChange={handleKeywordsChange} />
                    <ItemUsageEditor item={localItem} onChange={handleNestedChange} />

                    {!localItem.armorStats && (isArmor || isShield) && (
                        <button 
                            onClick={() => handleInitializeArmorStats(isShield ? 'shield' : 'armor')}
                            className="btn-secondary btn-md w-full gap-2"
                        >
                            <Icon name="shield" className="w-4 h-4" />
                            Add {isShield ? 'Shield' : 'Armor'} Statistics
                        </button>
                    )}
                    
                    {!localItem.weaponStats && isWeapon && (
                        <button 
                            onClick={handleInitializeWeaponStats}
                            className="btn-secondary btn-md w-full gap-2"
                        >
                            <Icon name="sword" className="w-4 h-4" />
                            Add Weapon Statistics
                        </button>
                    )}

                    {isWeapon && localItem.weaponStats && <WeaponStatsEditor stats={localItem.weaponStats} character={character} onChange={handleNestedChange} />}
                    {(isArmor || isShield) && localItem.armorStats && <ArmorStatsEditor stats={localItem.armorStats} character={character} onChange={handleNestedChange} />}
                    {(isWeapon || isArmor || isShield || isBuff) && <ModifierManager item={localItem} onChange={handleNestedChange} />}
                    {isMechanical && localItem.effect && <EffectBuilder effect={localItem.effect} onChange={(newEffect) => handleNestedChange(['effect'], newEffect)} onRemove={() => handleTagsChange(safeLocalTags.filter(t => t !== 'mechanical'))} />}
                    
                    <div className="flex flex-col items-center gap-4 pt-6 border-t border-brand-primary/20">
                        <button 
                            onClick={handleSave} 
                            disabled={isSaving} 
                            className="btn-primary btn-md w-full gap-2"
                        >
                            {isSaving ? <Icon name="spinner" className="w-5 h-5 animate-spin" /> : saveSuccess ? <Icon name="check" className="w-5 h-5" /> : 'Save Changes'}
                        </button>
                        <button 
                            onClick={() => setIsEditing(false)} 
                            className="btn-tertiary btn-sm"
                        >
                            Cancel Editing
                        </button>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in p-1">
                    <div className="flex justify-between items-start gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                            <h5 className="text-brand-text mb-2 font-merriweather text-3xl leading-tight">{item.name}</h5>
                            {item.bodySlotTag && (
                                <div className="mb-4">
                                    <span className="bg-brand-accent/20 text-brand-accent text-[10px] font-bold px-2.5 py-1 rounded border border-brand-accent/30 inline-flex items-center tracking-normal">
                                        {slotLabel}
                                    </span>
                                </div>
                            )}

                            {item.description && (
                                <div className="bg-brand-primary/10 p-5 rounded-2xl border-l-4 border-brand-accent shadow-inner mb-6">
                                    <p className="text-body-base text-brand-text leading-relaxed font-bold italic opacity-90">
                                        {item.description}
                                    </p>
                                </div>
                            )}

                            {item.details && (
                                <div className="mb-6 px-1">
                                    <p className="text-body-sm text-brand-text-muted leading-relaxed whitespace-pre-wrap font-medium">
                                        {item.details}
                                    </p>
                                </div>
                            )}
                        </div>
                        <button onClick={() => setIsEditing(true)} className="btn-icon bg-brand-primary/30 border border-brand-surface text-brand-text-muted hover:text-brand-accent shrink-0 relative z-10">
                            <Icon name="edit" className="w-4 h-4" />
                        </button>
                    </div>

                    {(item.weaponStats || item.armorStats) && (
                        <div className="bg-brand-primary/10 p-4 rounded-2xl border border-brand-surface flex items-center gap-8 mb-6 shadow-sm">
                            {item.weaponStats && (
                                <div className="flex items-center gap-3">
                                    <Icon name="sword" className="w-5 h-5 text-brand-accent/70" />
                                    <span className="text-body-base font-bold text-brand-text">
                                        {(item.weaponStats.damages || []).map(d => `${d.dice} ${d.type}`).join(' + ')}
                                        {item.weaponStats.enhancementBonus !== 0 && ` (${item.weaponStats.enhancementBonus >= 0 ? '+' : ''}${item.weaponStats.enhancementBonus})`}
                                    </span>
                                </div>
                            )}
                            {item.armorStats && (
                                <div className="flex items-center gap-3">
                                    <Icon name="shield" className="w-5 h-5 text-blue-400/70" />
                                    <span className="text-body-base font-bold text-brand-text">
                                        {item.armorStats.armorType === 'shield' ? 'Shield Ac' : 'Ac'} {(item.armorStats.baseAC || 0) + (item.armorStats.plusAC || 0)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Unified Mechanical Bonus Section */}
                    {mechanicalPills.length > 0 && (
                        <div className="space-y-3 mb-8 px-1">
                            <label className="text-[10px] font-bold text-brand-text-muted block mb-2">Mechanical Bonuses</label>
                            <div className="flex flex-wrap gap-2">
                                {mechanicalPills.map((pill, idx) => (
                                    <span 
                                        key={idx} 
                                        className={`text-[10px] font-bold px-3 py-1.5 rounded-full border bg-brand-bg tracking-normal shadow-sm flex items-center gap-1.5 ${pill.colorClass}`}
                                    >
                                        {pill.icon && <Icon name={pill.icon} className="w-3 h-3" />}
                                        {pill.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {isConsolidatable && (
                        <button onClick={() => consolidateCurrency(item.id, ownerId)} className="btn-primary btn-md w-full gap-2 relative z-10 mb-6">
                            <Icon name="plus" className="w-4 h-4" /> Consolidate Balance
                        </button>
                    )}

                    <div className="pt-8 border-t border-brand-primary/10 relative z-10">
                        <div className="grid grid-cols-2 gap-3 w-full">
                            {(fromList === 'carried' || fromList === 'equipped') && (
                                <button 
                                    onClick={handleUse} 
                                    disabled={isUsingItem || !localItem?.isUsable()} 
                                    className="btn-primary btn-md"
                                >
                                    {isUsingItem ? <Icon name="spinner" className="w-4 h-4 animate-spin text-black" /> : 'Use Item'}
                                </button>
                            )}
                            {fromList === 'equipped' && onUnequipRequest && <ActionButton onClick={onUnequipRequest}>Unequip</ActionButton>}
                            {fromList === 'equipped' && onEquipRequest && <ActionButton onClick={onEquipRequest}>Assign Slot</ActionButton>}
                            {fromList === 'carried' && onEquipRequest && <ActionButton onClick={onEquipRequest}>Equip</ActionButton>}
                            {fromList === 'carried' && ownerId === 'player' && <ActionButton onClick={() => handleMove('storage')}>Store</ActionButton>}
                            {fromList === 'storage' && ownerId === 'player' && <ActionButton onClick={() => handleMove('carried')}>Carry</ActionButton>}
                            {canSplit && <ActionButton onClick={() => setIsSplitModalOpen(true)}>Split</ActionButton>}
                            
                            <div className="relative inline-block" ref={dropdownRef}>
                                {fromList !== 'assets' && gameData && gameData.companions.length > 0 && (
                                    <button onClick={() => setIsTransferDropdownOpen(prev => !prev)} className="btn-secondary btn-md w-full">Transfer</button>
                                )}
                                {isTransferDropdownOpen && (
                                    <div className="absolute bottom-full mb-2 w-[240px] sm:w-[280px] left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-0 bg-brand-surface rounded-2xl shadow-2xl z-[110] border border-brand-primary overflow-hidden animate-fade-in py-2">
                                        <div className="p-1 space-y-1">
                                            {ownerId !== 'player' && gameData?.playerCharacter && (
                                                <button onClick={() => handleTransfer('player')} className="w-full text-left px-4 py-3 hover:bg-brand-primary transition-all flex items-center gap-3 rounded-xl group">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-primary border border-brand-surface flex-shrink-0 group-hover:border-brand-accent transition-colors shadow-sm">
                                                        {gameData.playerCharacter.imageUrl ? (
                                                            <img src={gameData.playerCharacter.imageUrl} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-xs font-bold text-brand-text-muted flex items-center justify-center h-full">
                                                                {gameData.playerCharacter.name.slice(0,2).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-body-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors truncate">To {gameData.playerCharacter.name}</span>
                                                        <span className="text-[10px] text-brand-text-muted font-medium">Lead Character</span>
                                                    </div>
                                                </button>
                                            )}
                                            {gameData?.companions.filter(c => c.id !== ownerId).map(companion => (
                                                <button key={companion.id} onClick={() => handleTransfer(companion.id)} className="w-full text-left px-4 py-3 hover:bg-brand-primary transition-all flex items-center gap-3 rounded-xl group">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-primary border border-brand-surface flex-shrink-0 group-hover:border-brand-accent transition-colors shadow-sm">
                                                        {companion.imageUrl ? (
                                                            <img src={companion.imageUrl} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-xs font-bold text-brand-text-muted flex items-center justify-center h-full">
                                                                {companion.name.slice(0,2).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-body-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors truncate">To {companion.name}</span>
                                                        <span className="text-[10px] text-brand-text-muted font-medium capitalize">
                                                            {companion.isShip ? 'Vessel' : (companion.isMount ? 'Mount' : 'Companion')}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setIsDropModalOpen(true)} className="w-full mt-8 flex items-center justify-center gap-2 group transition-all">
                            <Icon name="trash" className="w-4 h-4 text-brand-danger group-hover:scale-110 transition-transform" />
                            <span className="text-body-sm font-bold text-brand-danger hover:underline">Discard Item</span>
                        </button>
                    </div>
                </div>
            )}

            {isDropModalOpen && <QuantityModal isOpen={isDropModalOpen} onClose={() => setIsDropModalOpen(false)} item={item} action="Drop" maxQuantity={item?.quantity || 1} onConfirm={handleConfirmDrop} />}
            {isSplitModalOpen && <QuantityModal isOpen={isSplitModalOpen} onClose={() => setIsSplitModalOpen(false)} item={item} action="Split" maxQuantity={(item?.quantity || 2) - 1} onConfirm={handleConfirmSplit} />}
        </div>
    );
};
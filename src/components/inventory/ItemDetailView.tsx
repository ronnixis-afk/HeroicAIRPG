// components/inventory/ItemDetailView.tsx

import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import { Item, type Inventory, PlayerCharacter, Companion, type BodySlot, getItemRarityColor, ITEM_TAGS, type AbilityEffect, BODY_SLOTS, BODY_SLOT_TAGS } from '../../types';
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import Button from '../Button';
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
import { toTitleCase } from '../../utils/npcUtils';

interface ItemDetailViewProps {
    item: Item;
    ownerId: string;
    character: PlayerCharacter | Companion;
    fromList: keyof Inventory;
    primaryCurrencyItemId?: string;
    onEquipRequest?: () => void;
    onUnequipRequest?: () => void;
    onActionCompleted?: () => void;
    hideName?: boolean;
}

export const ItemDetailView: React.FC<ItemDetailViewProps> = ({
    item, ownerId, character, fromList, primaryCurrencyItemId,
    onEquipRequest, onUnequipRequest, onActionCompleted, hideName
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
    const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const targetDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (item) setLocalItem(item);
    }, [item]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsTransferDropdownOpen(false);
            }
            if (targetDropdownRef.current && !targetDropdownRef.current.contains(event.target as Node)) {
                setIsTargetDropdownOpen(false);
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
    const isConsumable = safeLocalTags.some(tag => typeof tag === 'string' && tag.toLowerCase() === 'consumable');
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

    // Determine if this consumable is a buff-only item (no offensive combat effect)
    const isBuffOnlyConsumable = useMemo(() => {
        if (!isConsumable) return false;
        const hasActiveBuffs = item.buffs?.some(b => b.duration === 'Active' || true); // All buffs on consumables are active
        const hasCombatEffect = item.effect && (item.effect.type === 'Damage' || item.effect.type === 'Status');
        
        // Return true if it's literally just a flavor item or has buffs but no combat effect
        if (!item.effect && !item.buffs) return true;
        
        // Buff-only if it has active buffs and no offensive effect, OR if it only heals
        return (hasActiveBuffs && !hasCombatEffect) || (item.effect?.type === 'Heal' && !hasCombatEffect);
    }, [isConsumable, item.buffs, item.effect]);

    const handleUse = async () => {
        if (isConsumable && !gameData?.combatState?.isActive) {
            setIsTargetDropdownOpen(prev => !prev);
            return;
        }

        setIsUsingItem(true);
        try {
            if (item.effect && ownerId === 'player') {
                let targetIds: string[] = [];
                if (item.effect.type === 'Heal' || isBuffOnlyConsumable) {
                    targetIds = [gameData?.playerCharacter.id || 'player'];
                } else if (gameData?.combatState?.enemies && gameData.combatState.enemies.length > 0) {
                    targetIds = [gameData.combatState.enemies[0].id];
                }

                if (isBuffOnlyConsumable) {
                    // Buff-only consumables should not go through the attack pipeline
                    await useItem(item.id, fromList, ownerId);
                } else if (targetIds.length > 0) {
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

    const handleTargetSelect = async (targetId: string) => {
        setIsTargetDropdownOpen(false);
        setIsUsingItem(true);
        try {
            if (isBuffOnlyConsumable) {
                // For buff-only consumables, apply the buff to the selected target
                // and consume the item from the user's inventory
                const resolvedTargetId = targetId === gameData?.playerCharacter.id ? 'player' : targetId;
                await useItem(item.id, fromList, ownerId, resolvedTargetId);
            } else {
                await performPlayerAttack(item, [targetId]);
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

    const ActionButton: React.FC<{ onClick: () => void, children: React.ReactNode, className?: string }> = ({ onClick, children, className }) => (
        <Button
            onClick={onClick}
            variant="secondary"
            className={className}
        >
            {children}
        </Button>
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
                        <Button
                            onClick={() => handleInitializeArmorStats(isShield ? 'shield' : 'armor')}
                            variant="secondary"
                            className="w-full"
                            icon="shield"
                        >
                            Add {isShield ? 'Shield' : 'Armor'} Statistics
                        </Button>
                    )}

                    {!localItem.weaponStats && isWeapon && (
                        <Button
                            onClick={handleInitializeWeaponStats}
                            variant="secondary"
                            className="w-full"
                            icon="sword"
                        >
                            Add Weapon Statistics
                        </Button>
                    )}

                    {isWeapon && localItem.weaponStats && <WeaponStatsEditor stats={localItem.weaponStats} character={character} onChange={handleNestedChange} />}
                    {(isArmor || isShield) && localItem.armorStats && <ArmorStatsEditor stats={localItem.armorStats} character={character} onChange={handleNestedChange} />}
                    {(isWeapon || isArmor || isShield || isBuff) && <ModifierManager item={localItem} onChange={handleNestedChange} />}
                    {isMechanical && localItem.effect && <EffectBuilder effect={localItem.effect} onChange={(newEffect) => handleNestedChange(['effect'], newEffect)} onRemove={() => handleTagsChange(safeLocalTags.filter(t => t !== 'mechanical'))} />}

                     <div className="flex flex-col items-center gap-4 pt-6 border-t border-brand-primary/20">
                        <Button
                            onClick={handleSave}
                            isLoading={isSaving}
                            variant="primary"
                            className="w-full"
                            icon={saveSuccess ? 'check' : undefined}
                        >
                            {saveSuccess ? 'Changes Saved' : 'Save Changes'}
                        </Button>
                        <Button
                            onClick={() => setIsEditing(false)}
                            variant="tertiary"
                            size="sm"
                        >
                            Cancel Editing
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <div className="mb-3">
                        {/* Name + inline edit */}
                        {!hideName && (
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-brand-text leading-tight flex-1 min-w-0">{item.name}</h3>
                            </div>
                        )}

                        {/* Property Tag Row */}
                        {(() => {
                            const propTags: { label: string; color: string }[] = [];

                            // Weapon / Armor type-tier tags
                            const typeTagMap: Record<string, string> = {
                                'Light Weapon': 'text-green-400 border-green-500/40 bg-green-900/10',
                                'Medium Weapon': 'text-yellow-400 border-yellow-500/40 bg-yellow-900/10',
                                'Heavy Weapon': 'text-red-400 border-red-500/40 bg-red-900/10',
                                'Light Armor': 'text-blue-300 border-blue-400/40 bg-blue-900/10',
                                'Medium Armor': 'text-blue-400 border-blue-500/40 bg-blue-900/10',
                                'Heavy Armor': 'text-blue-500 border-blue-600/40 bg-blue-900/20',
                                'Shield': 'text-cyan-400 border-cyan-500/40 bg-cyan-900/10',
                                'ranged': 'text-orange-300 border-orange-400/40 bg-orange-900/10',
                                'melee': 'text-brand-text-muted border-brand-primary/50 bg-brand-primary/20',
                            };

                            const safeItemTags = item.tags || [];
                            safeItemTags.forEach(tag => {
                                const key = Object.keys(typeTagMap).find(k => k.toLowerCase() === tag.toLowerCase());
                                if (key) propTags.push({ label: key, color: typeTagMap[key] });
                            });

                            // Weapon ability (e.g. Dexterity, Strength)
                            if (item.weaponStats?.ability) {
                                const abilityLabel = item.weaponStats.ability.charAt(0).toUpperCase() + item.weaponStats.ability.slice(1);
                                propTags.push({ label: abilityLabel, color: 'text-purple-300 border-purple-500/40 bg-purple-900/10' });
                            }

                            // Equip body slot
                            if (item.bodySlotTag) {
                                propTags.push({ label: slotLabel, color: 'text-brand-accent border-brand-accent/30 bg-brand-accent/5' });
                            }

                            if (propTags.length === 0) return null;

                            return (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {propTags.map((tag, i) => (
                                        <span key={i} className={`text-[10px] font-bold px-2.5 py-1 rounded border inline-flex items-center tracking-normal ${tag.color}`}>
                                            {tag.label}
                                        </span>
                                    ))}
                                </div>
                            );
                        })()}

                        {item.description && (
                            <div className="bg-brand-primary/10 p-4 rounded-2xl mb-4">
                                <p className="text-body-base text-brand-text-muted leading-relaxed opacity-90">
                                    {item.description}
                                </p>
                            </div>
                        )}


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
                                        {item.armorStats.armorType === 'shield' ? 'Shield AC' : 'AC'} {(item.armorStats.baseAC || 0) + (item.armorStats.plusAC || 0)}
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
                        <Button
                            onClick={() => consolidateCurrency(item.id, ownerId)}
                            variant="primary"
                            className="w-full mb-6"
                            icon="plus"
                        >
                            Consolidate Balance
                        </Button>
                    )}

                    <div className="pt-8 border-t border-brand-primary/10 relative z-10">
                        <div className="grid grid-cols-2 gap-3 w-full">
                             {(fromList === 'carried' || fromList === 'equipped') && (
                                <div className="relative inline-block" ref={targetDropdownRef}>
                                    <Button
                                        onClick={handleUse}
                                        isLoading={isUsingItem}
                                        disabled={!localItem?.isUsable()}
                                        variant="primary"
                                        className="w-full"
                                    >
                                        Use Item
                                    </Button>
                                    {isTargetDropdownOpen && (
                                        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 animate-fade-in backdrop-blur-sm">
                                            <div className="w-full max-w-[320px] bg-brand-surface rounded-3xl shadow-2xl border border-brand-primary overflow-hidden flex flex-col max-h-[80vh]">
                                                <div className="px-6 py-4 border-b border-brand-primary/10 flex justify-between items-center bg-brand-primary/5">
                                                    <span className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">Select Target</span>
                                                     <Button 
                                                        onClick={() => setIsTargetDropdownOpen(false)} 
                                                        variant="tertiary" 
                                                        size="icon"
                                                        icon="close" 
                                                    />
                                                </div>
                                                <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
                                                    {/* Player Target */}
                                                    <button onClick={() => handleTargetSelect(gameData?.playerCharacter.id || 'player')} className="w-full text-left px-4 py-3 hover:bg-brand-primary transition-all flex items-center gap-3 rounded-2xl group">
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-brand-primary border border-brand-surface flex-shrink-0 group-hover:border-brand-accent transition-colors shadow-md">
                                                            {gameData?.playerCharacter.imageUrl ? (
                                                                <img src={gameData.playerCharacter.imageUrl} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-brand-text-muted flex items-center justify-center h-full">
                                                                    {gameData?.playerCharacter.name.slice(0, 2).toUpperCase()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-body-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors truncate">Self ({toTitleCase(gameData?.playerCharacter.name)})</span>
                                                        </div>
                                                    </button>

                                                    <div className="h-px bg-brand-primary/10 my-2 mx-4" />

                                                    {/* Companion Targets */}
                                                    {gameData?.companions.map(companion => (
                                                        <button key={companion.id} onClick={() => handleTargetSelect(companion.id)} className="w-full text-left px-4 py-3 hover:bg-brand-primary transition-all flex items-center gap-3 rounded-2xl group">
                                                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-brand-primary border border-brand-surface flex-shrink-0 group-hover:border-brand-accent transition-colors shadow-md">
                                                                {companion.imageUrl ? (
                                                                    <img src={companion.imageUrl} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-brand-text-muted flex items-center justify-center h-full">
                                                                        {companion.name.slice(0, 2).toUpperCase()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-body-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors truncate">{toTitleCase(companion.name)}</span>
                                                                <span className="text-[10px] text-brand-text-muted font-medium capitalize">
                                                                    {companion.relationship >= 50 ? 'Loyal' : (companion.relationship >= 10 ? 'Friendly' : 'Companion')}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    ))}

                                                    {/* Nearby NPC Targets (excluding duplicates from companion list) */}
                                                    {(gameData?.npcs || [])
                                                        .filter(npc => npc.currentPOI === gameData?.currentLocale && npc.status === 'Alive')
                                                        .filter(npc => !gameData?.companions.some(c => c.id === (npc.companionId || npc.id.replace('npc-', ''))))
                                                        .map(npc => (
                                                            <button key={npc.id} onClick={() => handleTargetSelect(npc.id)} className="w-full text-left px-4 py-3 hover:bg-brand-primary transition-all flex items-center gap-3 rounded-2xl group">
                                                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-brand-primary border border-brand-surface flex-shrink-0 group-hover:border-brand-accent transition-colors shadow-md">
                                                                    {npc.image ? (
                                                                        <img src={npc.image} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold text-brand-text-muted flex items-center justify-center h-full">
                                                                            {npc.name.slice(0, 2).toUpperCase()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-body-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors truncate">{toTitleCase(npc.name)}</span>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mt-0.5 ${npc.alignment === 'enemy' ? 'text-red-400 bg-red-400/10' : (npc.alignment === 'ally' ? 'text-emerald-400 bg-emerald-400/10' : 'text-yellow-400 bg-yellow-400/10')}`}>
                                                                        {toTitleCase(npc.alignment || 'Neutral')}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {fromList === 'equipped' && onUnequipRequest && <ActionButton onClick={onUnequipRequest}>Unequip</ActionButton>}
                            {fromList === 'equipped' && onEquipRequest && <ActionButton onClick={onEquipRequest}>Assign Slot</ActionButton>}
                            {fromList === 'carried' && onEquipRequest && <ActionButton onClick={onEquipRequest}>Equip</ActionButton>}
                            {fromList === 'carried' && ownerId === 'player' && <ActionButton onClick={() => handleMove('storage')}>Store</ActionButton>}
                            {fromList === 'storage' && ownerId === 'player' && <ActionButton onClick={() => handleMove('carried')}>Carry</ActionButton>}
                            {canSplit && <ActionButton onClick={() => setIsSplitModalOpen(true)}>Split</ActionButton>}

                            <div className="relative inline-block" ref={dropdownRef}>
                                 {fromList !== 'assets' && gameData && gameData.companions.length > 0 && (
                                    <Button onClick={() => setIsTransferDropdownOpen(prev => !prev)} variant="secondary" className="w-full">Transfer</Button>
                                )}
                                {isTransferDropdownOpen && (
                                    <div className="absolute bottom-full mb-2 w-[240px] sm:w-[280px] left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-0 bg-brand-surface rounded-2xl shadow-2xl z-[110] border border-brand-primary overflow-hidden animate-fade-in py-2">
                                        <div className="p-1 space-y-1">
                                            {ownerId !== 'player' && gameData?.playerCharacter && (
                                                <button onClick={() => handleTransfer('player')} className="w-full text-left px-4 py-3 hover:bg-brand-primary transition-all flex items-center gap-3 rounded-xl group">
                                                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-brand-primary border border-brand-surface flex-shrink-0 group-hover:border-brand-accent transition-colors shadow-sm">
                                                        {gameData.playerCharacter.imageUrl ? (
                                                            <img src={gameData.playerCharacter.imageUrl} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-xs font-bold text-brand-text-muted flex items-center justify-center h-full">
                                                                {gameData.playerCharacter.name.slice(0, 2).toUpperCase()}
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
                                                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-brand-primary border border-brand-surface flex-shrink-0 group-hover:border-brand-accent transition-colors shadow-sm">
                                                        {companion.imageUrl ? (
                                                            <img src={companion.imageUrl} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-xs font-bold text-brand-text-muted flex items-center justify-center h-full">
                                                                {companion.name.slice(0, 2).toUpperCase()}
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

                         <Button
                            onClick={() => setIsEditing(true)}
                            variant="secondary"
                            className="w-full mt-6"
                            icon="edit"
                        >
                            Edit Item
                        </Button>

                        <Button 
                            onClick={() => setIsDropModalOpen(true)} 
                            variant="danger" 
                            className="w-full mt-8"
                            icon="trash"
                        >
                            Discard Item
                        </Button>
                    </div>
                </div>
            )
            }

            {isDropModalOpen && <QuantityModal isOpen={isDropModalOpen} onClose={() => setIsDropModalOpen(false)} item={item} action="Drop" maxQuantity={item?.quantity || 1} onConfirm={handleConfirmDrop} />}
            {isSplitModalOpen && <QuantityModal isOpen={isSplitModalOpen} onClose={() => setIsSplitModalOpen(false)} item={item} action="Split" maxQuantity={(item?.quantity || 2) - 1} onConfirm={handleConfirmSplit} />}
        </div >
    );
};

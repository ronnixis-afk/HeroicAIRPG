// components/character/FeaturesList.tsx

import React, { useMemo, useState, useEffect } from 'react';
import { PlayerCharacter, Companion, type Ability, type AbilityUsage, type SkillConfiguration, type Inventory } from '../../types';
import { Icon } from '../Icon';
import AutoResizingTextarea from '../AutoResizingTextarea';
import Modal from '../Modal';
import { ModifierBuilder } from './editors/ModifierBuilder';
import { EffectBuilder } from './editors/EffectBuilder';
import { getBuffTag } from '../../utils/itemModifiers';
import { CombatLoadout } from './CompanionLoadout';
import { TRAIT_LIBRARY, LibraryTrait } from '../../utils/traitLibrary';
import { skinAbilityFlavor } from '../../services/aiCharacterService';

interface AbilityCardProps {
    ability: Ability;
    onEdit: () => void;
    onDelete: () => void;
    standardDC?: number;
    standardDice?: string;
    disabledReason?: string;
}

const ShimmerOverlay: React.FC = () => (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
        <style>{`
            @keyframes shimmer {
                100% { transform: translateX(100%); }
            }
            .animate-shimmer {
                animation: shimmer 1.5s infinite linear;
            }
        `}</style>
    </div>
);

const AbilityCard: React.FC<AbilityCardProps> = ({ ability, onEdit, onDelete, standardDC, standardDice, disabledReason }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const formatUsage = (usage: AbilityUsage | undefined): string => {
        if (!usage || usage.type === 'passive') return 'Passive';
        const type = usage.type === 'per_short_rest' ? 'Short rest' : 'Long rest';
        return `${usage.currentUses}/${usage.maxUses} ${type}`;
    };

    const hasEffect = !!ability.effect;
    const hasBuffs = ability.buffs && ability.buffs.length > 0;
    const isRefining = !!ability.isRefining;

    return (
        <div
            onClick={() => !isRefining && setIsExpanded(!isExpanded)}
            className={`flex flex-col w-full bg-brand-surface border border-brand-primary rounded-2xl p-5 shadow-xl transition-all group relative overflow-hidden ${isRefining ? 'cursor-wait opacity-80' : 'cursor-pointer hover:border-brand-accent/30'} ${isExpanded ? 'ring-1 ring-brand-accent/20' : ''} ${disabledReason ? 'opacity-80 grayscale-[0.2]' : ''}`}
        >
            {isRefining && <ShimmerOverlay />}

            {!isRefining && (
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-accent/5 rounded-full blur-3xl group-hover:bg-brand-accent/10 transition-all" />
            )}

            <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                        <h4 className={`text-body-lg font-bold truncate leading-tight transition-colors mb-0 ${isRefining ? 'text-brand-text-muted bg-brand-primary/30 animate-pulse rounded px-2 h-5 w-3/4' : 'text-brand-text group-hover:text-brand-accent'}`}>
                            {isRefining ? '' : (ability.name || 'Unnamed Ability')}
                        </h4>
                        {ability.isLevelUpTrait && !isRefining && (
                            <span className="inline-flex items-center bg-brand-accent/10 text-brand-accent text-[6px] font-bold px-1.5 py-0.5 rounded border border-brand-accent/20">Trait Point</span>
                        )}
                        {disabledReason && !isRefining && (
                            <span className="inline-flex items-center bg-brand-danger/10 text-brand-danger text-[7px] font-bold px-2 py-0.5 rounded border border-brand-danger/20 tracking-normal animate-pulse">
                                Disabled: {disabledReason}
                            </span>
                        )}
                    </div>
                    <span className="text-[8px] font-bold text-brand-accent/80 mt-1 tracking-normal">
                        {formatUsage(ability.usage)}
                    </span>
                </div>
                {!isRefining && (
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="p-1.5 text-brand-text-muted hover:text-brand-text hover:bg-brand-primary/50 rounded-lg transition-all"
                            title="Edit Ability"
                        >
                            <Icon name="edit" className="w-4 h-4" />
                        </button>
                        <Icon name="chevronDown" className={`w-4 h-4 text-brand-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                )}
            </div>

            <div className={`relative z-10 transition-all duration-300 ${isExpanded ? '' : 'max-h-12 overflow-hidden'}`}>
                <p className={`text-body-sm leading-relaxed italic ${isRefining ? 'text-brand-text-muted bg-brand-primary/30 animate-pulse rounded px-2 h-12 w-full mt-2' : 'text-brand-text-muted'} ${isExpanded ? 'mb-4' : 'line-clamp-2'}`}>
                    {isRefining ? '' : (ability.description || 'No description provided.')}
                </p>
            </div>

            {!isRefining && isExpanded && (
                <div className="animate-page space-y-4 pt-4 border-t border-brand-primary/20 mt-4 relative z-10">
                    {hasBuffs && (
                        <div>
                            <label className="text-[8px] font-bold text-brand-text-muted block mb-2 opacity-50">Passive Bonuses</label>
                            <div className="flex flex-wrap gap-1.5">
                                {ability.buffs?.map((buff, i) => {
                                    const { label, colorClass } = getBuffTag(buff);
                                    return (
                                        <span key={i} className={`text-[7px] font-bold px-3 py-1 rounded-full border bg-brand-bg/50 ${colorClass}`}>
                                            {label}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {hasEffect && (
                        <div>
                            <label className="text-[8px] font-bold text-brand-text-muted block mb-2 opacity-50">Mechanical Effect</label>
                            <div className="bg-brand-primary/20 p-4 rounded-xl border border-brand-surface flex items-center gap-4">
                                <Icon name="sparkles" className="w-5 h-5 text-brand-accent/70 shrink-0" />
                                <div className="text-body-sm font-bold text-brand-text leading-tight">
                                    <div className="opacity-50 text-[7px] mb-1 capitalize">{ability.effect?.type} {ability.effect?.targetType}</div>
                                    <div className="text-brand-accent text-sm">
                                        {ability.effect?.damageDice || ability.effect?.healDice || ability.effect?.status}
                                        {ability.effect?.dc && ` (DC ${ability.effect.dc})`}
                                        {ability.effect?.damageType && ` [${ability.effect.damageType}]`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {ability.tags && ability.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                            {ability.tags.map(tag => (
                                <span key={tag} className="text-[7px] font-bold text-brand-text-muted bg-brand-primary/40 px-2.5 py-1 rounded-full capitalize border border-brand-primary/30">{tag}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isRefining && (
                <div className="mt-4 flex items-center gap-3 px-1">
                    <Icon name="sparkles" className="w-4 h-4 text-brand-accent animate-spin" />
                    <span className="text-[8px] font-bold text-brand-accent tracking-normal">Personalizing Ability...</span>
                </div>
            )}
        </div>
    );
};

interface FeaturesListProps {
    character: PlayerCharacter | Companion;
    inventory: Inventory;
    onChange: (path: (string | number)[], value: any) => void;
    isOpen: boolean;
    onToggle: () => void;
    skillConfig?: SkillConfiguration;
}

export const FeaturesList: React.FC<FeaturesListProps> = ({ character, inventory, onChange, isOpen, onToggle, skillConfig }) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [libraryTab, setLibraryTab] = useState<'general' | 'combat'>('general');
    const [notification, setNotification] = useState<string | null>(null);

    // Phase 2: Calculate Trait Point Metrics
    const metrics = useMemo(() => {
        if (character && typeof (character as any).getTraitPointMetrics === 'function') {
            return (character as any).getTraitPointMetrics();
        }
        return { total: 0, used: 0, available: 0 };
    }, [character, character.abilities, character.level]);

    // Phase 3: Cleanup notification timer
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const handleAbilityChange = (index: number, field: string, value: any) => {
        onChange(['abilities', index, field], value);
    };

    const addAbility = () => {
        const newAbility: Ability = {
            id: `ability-${Date.now()}`,
            name: 'New Feature',
            description: '',
            usage: { type: 'passive', maxUses: 0, currentUses: 0 }
        };
        const newAbilities = [...character.abilities, newAbility];
        onChange(['abilities'], newAbilities);
        setEditingIndex(newAbilities.length - 1);
    };

    const addTraitFromLibrary = async (trait: LibraryTrait) => {
        const abilityId = `ability-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const isCombat = trait.category === 'combat';

        const newAbility: Ability = {
            ...trait,
            id: abilityId,
            isRefining: isCombat,
            isLevelUpTrait: true // Phase 2/3: Consume point
        };

        const newAbilities = [...character.abilities, newAbility];
        onChange(['abilities'], newAbilities);
        setIsLibraryOpen(false);

        // Phase 3: Visual Feedback
        setNotification(`${trait.name} Trait Assigned`);

        if (isCombat) {
            try {
                const { name, description, damageType } = await skinAbilityFlavor(newAbility, character, (window as any).gameDataCache || { worldSummary: '' });

                const updatedAbilities = newAbilities.map(a => {
                    if (a.id === abilityId) {
                        const updated: Ability = {
                            ...a,
                            name,
                            description,
                            isRefining: false
                        };
                        if (damageType && updated.effect) {
                            updated.effect = { ...updated.effect, damageType };
                        }
                        return updated;
                    }
                    return a;
                });
                onChange(['abilities'], updatedAbilities);
            } catch (err) {
                console.error("Trait personalization failed", err);
                const failedAbilities = newAbilities.map(a => a.id === abilityId ? { ...a, isRefining: false } : a);
                onChange(['abilities'], failedAbilities);
            }
        }
    };

    const removeAbility = (index: number) => {
        if (window.confirm("Are you sure you want to delete this ability?")) {
            const newAbilities = character.abilities.filter((_, i) => i !== index);
            onChange(['abilities'], newAbilities);
            setEditingIndex(null);
        }
    };

    const standardDC = useMemo(() => {
        if ('getStandardAbilityDC' in character) {
            return (character as PlayerCharacter).getStandardAbilityDC(inventory);
        }
        return undefined;
    }, [character, inventory]);

    const getStandardDiceForEffect = (effect: any) => {
        if ('getStandardEffectFormula' in character && effect) {
            return (character as PlayerCharacter).getStandardEffectFormula(effect, inventory);
        }
        return undefined;
    };

    const handleInitializeEffect = () => {
        if (editingIndex === null) return;
        const defaultEffect = {
            type: 'Damage' as const,
            dc: standardDC || 10,
            saveAbility: 'dexterity' as const,
            saveEffect: 'half' as const,
            targetType: 'Single' as const,
            damageDice: '1d6',
            damageType: 'Force'
        };
        handleAbilityChange(editingIndex, 'effect', defaultEffect);
    };

    const sortedAbilities = useMemo(() => {
        if (!character.abilities) return [];

        // Phase 2 Fix: Separate level-up traits from core abilities to maintain slot positions
        const coreAbilities = character.abilities.filter(a => !a.isLevelUpTrait);
        const levelUpTraits = character.abilities.filter(a => a.isLevelUpTrait);

        coreAbilities.sort((a: any, b: any) => {
            const catA = a.category || 'general';
            const catB = b.category || 'general';

            const weights: Record<string, number> = { 'background': 3, 'general': 2, 'combat': 1 };
            const wA = weights[catA] || 2;
            const wB = weights[catB] || 2;

            if (wA !== wB) return wB - wA;
            return (a.name || '').localeCompare(b.name || '');
        });

        // Level-up traits append chronologically beneath the sorted core class features
        return [...coreAbilities, ...levelUpTraits];
    }, [character.abilities]);

    const filteredLibrary = useMemo(() => {
        return TRAIT_LIBRARY.filter(trait =>
            trait.category === libraryTab &&
            (!trait.requiredConfig || trait.requiredConfig === skillConfig)
        );
    }, [skillConfig, libraryTab]);

    const isStrictlyUnarmed = useMemo(() => {
        return !inventory.equipped.some(item =>
            (item.weaponStats || item.tags?.includes('weapon')) &&
            (item.equippedSlot === 'Main Hand' || item.equippedSlot === 'Off Hand')
        );
    }, [inventory.equipped]);

    const editingAbility = editingIndex !== null ? character.abilities[editingIndex] : null;

    return (
        <div className="animate-fade-in pb-12">
            <div className="mb-10 px-1">
                <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-brand-text">Combat Behavior Tactics</h3>
                    <div className="relative group/tooltip flex items-center justify-center">
                        <div className="text-brand-text-muted hover:text-brand-text cursor-help p-0.5 rounded-full transition-colors opacity-60 hover:opacity-100">
                            <Icon name="info" className="w-5 h-5" />
                        </div>
                        <div className="absolute left-0 bottom-full mb-3 w-64 bg-brand-surface text-brand-text text-body-sm p-4 rounded-2xl shadow-2xl border border-brand-primary opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 italic">
                            Characters use basic attacks (70%) or custom abilities (30%). If special abilities are chosen, the system splits the chance equally between Ability 1 and 2. Selecting "Basic weapon attack" in a slot allows for custom overrides.
                        </div>
                    </div>
                </div>
                <div className="bg-brand-primary/10 rounded-3xl border border-brand-surface shadow-inner p-2">
                    <CombatLoadout character={character} onChange={onChange} />
                </div>
            </div>

            <div className="flex justify-between items-center mb-6 px-1">
                <div className="flex flex-col">
                    <h3 className="text-brand-text mb-0">Class Features & Traits</h3>
                    {metrics.total > 0 && (
                        <span className="text-[8px] font-bold text-brand-accent mt-1 tracking-normal">
                            Trait Points: {metrics.used} / {metrics.total}
                        </span>
                    )}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsLibraryOpen(true)}
                        className="btn-secondary btn-sm rounded-full"
                    >
                        Library
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-5 px-1 pb-4">
                {sortedAbilities.length > 0 && sortedAbilities.map((ability) => {
                    const originalIndex = character.abilities.findIndex(a => a.id === ability.id);

                    let disabledReason = undefined;
                    if (ability.name === "Flurry of Blows" && !isStrictlyUnarmed) {
                        disabledReason = "Must be Unarmed";
                    }

                    return (
                        <AbilityCard
                            key={ability.id}
                            ability={ability}
                            onEdit={() => setEditingIndex(originalIndex)}
                            onDelete={() => removeAbility(originalIndex)}
                            standardDC={standardDC}
                            standardDice={getStandardDiceForEffect(ability.effect)}
                            disabledReason={disabledReason}
                        />
                    );
                })}

                {/* Phase 2: Available Trait Slots */}
                {Array.from({ length: metrics.available }).map((_, i) => {
                    const earnedAtLevel = (metrics.used + i + 1) * 3;
                    return (
                        <button
                            key={`trait-slot-${i}`}
                            onClick={() => setIsLibraryOpen(true)}
                            className="w-full h-28 border-2 border-dashed border-brand-primary/40 rounded-3xl flex items-center justify-center gap-4 text-brand-text-muted hover:border-brand-accent/50 hover:text-brand-accent transition-all group animate-pulse"
                        >
                            <div className="w-11 h-11 rounded-full bg-brand-primary/30 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                <Icon name="plus" className="w-6 h-6" />
                            </div>
                            <span className="text-body-base font-bold">Add Level {earnedAtLevel} Trait</span>
                        </button>
                    );
                })}

                <button
                    onClick={addAbility}
                    className="w-full py-4 border border-dashed border-brand-primary/20 rounded-2xl flex items-center justify-center gap-2 text-brand-text-muted hover:text-brand-accent transition-colors mt-2"
                >
                    <Icon name="plus" className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-bold tracking-normal opacity-60">Custom Feature</span>
                </button>

                {sortedAbilities.length === 0 && metrics.available === 0 && (
                    <div className="py-24 text-center border-2 border-dashed border-brand-primary/30 rounded-3xl bg-brand-surface/20">
                        <Icon name="sparkles" className="w-12 h-12 mx-auto mb-4 text-brand-text-muted opacity-30" />
                        <p className="text-body-base text-brand-text-muted italic">This hero has no unique traits yet.</p>
                        <div className="flex gap-6 justify-center mt-6">
                            <button onClick={() => setIsLibraryOpen(true)} className="text-brand-accent font-bold text-xs hover:underline underline-offset-4">Trait library</button>
                            <button onClick={addAbility} className="text-brand-accent font-bold text-xs hover:underline underline-offset-4">Manual entry</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Phase 3: Trait Assigned Notification */}
            {notification && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-page pointer-events-none">
                    <div className="bg-brand-accent text-black px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-3 border border-white/20">
                        <Icon name="check" className="w-5 h-5" />
                        <span>{notification}</span>
                    </div>
                </div>
            )}

            <Modal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} title={`Trait Library (${skillConfig || 'Universal'})`}>
                <div className="flex flex-col h-[75vh]">
                    <div className="flex justify-center mb-6 bg-brand-primary p-1 rounded-xl w-full flex-shrink-0">
                        <button
                            onClick={() => setLibraryTab('general')}
                            className={`flex-1 btn-sm transition-all ${libraryTab === 'general' ? 'bg-brand-surface text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}`}
                        >
                            General
                        </button>
                        <button
                            onClick={() => setLibraryTab('combat')}
                            className={`flex-1 btn-sm transition-all ${libraryTab === 'combat' ? 'bg-brand-surface text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}`}
                        >
                            Combat
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scroll pr-1">
                        <p className="text-body-sm text-brand-text-muted mb-6 px-1 italic">
                            {libraryTab === 'general' ? 'Core attributes and setting-specific advantages.' : 'Mechanical advantages for the heat of battle.'}
                        </p>
                        <div className="flex flex-col gap-4 pb-8">
                            {filteredLibrary.length > 0 ? filteredLibrary.map((trait, idx) => {
                                const isOwned = character.abilities.some(a => a.name === trait.name);
                                const isLocked = trait.requires?.some(reqName => !character.abilities.some(a => a.name === reqName));

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => !isOwned && !isLocked && addTraitFromLibrary(trait)}
                                        disabled={isOwned || isLocked}
                                        className={`w-full text-left p-5 rounded-2xl border transition-all flex flex-col gap-2 ${isOwned || isLocked ? 'bg-brand-primary/10 border-brand-primary opacity-40 cursor-not-allowed' : 'bg-brand-surface border-brand-primary hover:border-brand-accent group'} ${isLocked ? 'grayscale' : ''}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <h4 className={`text-body-base font-bold ${isOwned || isLocked ? 'text-brand-text-muted' : 'text-brand-text group-hover:text-brand-accent'}`}>
                                                    {trait.name}
                                                </h4>
                                                {trait.requiredConfig && (
                                                    <span className="text-[7px] font-bold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full border border-brand-accent/20">
                                                        {trait.requiredConfig}
                                                    </span>
                                                )}
                                            </div>
                                            {isOwned && <span className="text-[9px] font-bold text-brand-accent/40 border border-brand-accent/20 px-3 py-0.5 rounded-full">Owned</span>}
                                            {isLocked && <span className="text-[9px] font-bold text-brand-danger border border-brand-danger/20 px-3 py-0.5 rounded-full">Locked</span>}
                                        </div>
                                        <p className="text-body-sm text-brand-text-muted line-clamp-2 leading-relaxed italic">{trait.description}</p>

                                        {isLocked && trait.requires && (
                                            <div className="mt-1">
                                                <p className="text-brand-danger text-[10px] font-bold">Requires: {trait.requires.join(', ')}</p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {trait.buffs?.map((buff, i) => {
                                                const { label, colorClass } = getBuffTag(buff);
                                                return <span key={i} className={`text-[9px] font-bold border px-2.5 py-0.5 rounded-full ${colorClass}`}>{label}</span>;
                                            })}
                                        </div>
                                    </button>
                                );
                            }) : (
                                <div className="py-16 text-center text-brand-text-muted opacity-40 italic text-body-sm">
                                    No {libraryTab} traits available for this setting.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={editingIndex !== null}
                onClose={() => setEditingIndex(null)}
                title="Edit Feature"
            >
                {editingAbility && (
                    <div className="space-y-8 animate-fade-in max-h-[75vh] overflow-y-auto custom-scroll pr-1 pb-4">
                        <div>
                            <label className="block text-xs font-bold text-brand-text-muted mb-2 ml-1 tracking-normal">Ability Identity</label>
                            <input
                                type="text"
                                value={editingAbility.name}
                                onChange={(e) => handleAbilityChange(editingIndex!, 'name', e.target.value)}
                                className="w-full input-md font-bold text-base text-brand-text"
                                placeholder="Feature Name"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-brand-text-muted mb-2 ml-1 tracking-normal">Function & Lore</label>
                            <AutoResizingTextarea
                                value={editingAbility.description}
                                onChange={(e) => handleAbilityChange(editingIndex!, 'description', e.target.value)}
                                className="w-full input-md text-body-sm min-h-[100px] leading-relaxed"
                                placeholder="Describe what the ability does..."
                            />
                        </div>

                        <div className="bg-brand-primary/10 p-5 rounded-3xl border border-brand-surface space-y-5">
                            <label className="block text-xs font-bold text-brand-text-muted ml-1 tracking-normal">Activation & Usage</label>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-brand-text-muted mb-1.5 ml-1">Type</label>
                                    <select
                                        value={editingAbility.usage?.type || 'passive'}
                                        onChange={(e) => {
                                            const newType = e.target.value as AbilityUsage['type'];
                                            const newMaxUses = newType === 'passive' ? 0 : (editingAbility.usage?.maxUses || 1);
                                            handleAbilityChange(editingIndex!, 'usage', {
                                                type: newType,
                                                maxUses: newMaxUses,
                                                currentUses: newMaxUses,
                                            });
                                        }}
                                        className="w-full input-md text-xs font-bold appearance-none transition-all cursor-pointer"
                                    >
                                        <option value="passive">Passive</option>
                                        <option value="per_short_rest">Short rest</option>
                                        <option value="per_long_rest">Long rest</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-brand-text-muted mb-1.5 ml-1">Limit</label>
                                    <input
                                        type="number"
                                        value={editingAbility.usage?.maxUses || 0}
                                        onChange={(e) => {
                                            const newMaxUses = parseInt(e.target.value) || 0;
                                            handleAbilityChange(editingIndex!, 'usage', {
                                                ...(editingAbility.usage || { type: 'passive' }),
                                                maxUses: newMaxUses,
                                                currentUses: newMaxUses,
                                            });
                                        }}
                                        disabled={editingAbility.usage?.type === 'passive'}
                                        className="w-full input-md text-sm font-black text-center disabled:opacity-20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-brand-text-muted mb-1.5 ml-1">Current</label>
                                    <input
                                        type="number"
                                        value={editingAbility.usage?.currentUses ?? 0}
                                        onChange={(e) => {
                                            const newCurrentUses = parseInt(e.target.value) || 0;
                                            const maxUses = editingAbility.usage?.maxUses ?? newCurrentUses;
                                            const cappedCurrentUses = Math.max(0, Math.min(newCurrentUses, maxUses));
                                            handleAbilityChange(editingIndex!, 'usage', {
                                                ...(editingAbility.usage || { type: 'passive', maxUses: 0 }),
                                                currentUses: cappedCurrentUses,
                                            });
                                        }}
                                        disabled={editingAbility.usage?.type === 'passive'}
                                        className="w-full input-md text-sm font-black text-center disabled:opacity-20"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8 pt-2">
                            <ModifierBuilder
                                buffs={editingAbility.buffs || []}
                                onChange={(newBuffs) => handleAbilityChange(editingIndex!, 'buffs', newBuffs)}
                                skillConfig={skillConfig}
                            />

                            <div className="pt-2">
                                {editingAbility.effect ? (
                                    <EffectBuilder
                                        effect={editingAbility.effect}
                                        standardDC={standardDC}
                                        standardDice={getStandardDiceForEffect(editingAbility.effect)}
                                        onChange={(newEffect) => handleAbilityChange(editingIndex!, 'effect', newEffect)}
                                        onRemove={() => handleAbilityChange(editingIndex!, 'effect', undefined)}
                                    />
                                ) : (
                                    <button
                                        onClick={handleInitializeEffect}
                                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-dashed border-brand-primary text-body-sm font-bold text-brand-accent hover:border-brand-accent hover:bg-brand-accent/5 transition-all shadow-sm"
                                    >
                                        <Icon name="sparkles" className="w-4 h-4" /> Add Actionable Effect
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="pt-10 border-t border-brand-primary/20 flex justify-between items-center gap-4">
                            <button
                                onClick={() => removeAbility(editingIndex!)}
                                className="text-brand-danger hover:opacity-80 text-xs font-bold flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
                            >
                                <Icon name="trash" className="w-5 h-5" /> Purge Feature
                            </button>
                            <button
                                onClick={() => setEditingIndex(null)}
                                className="btn-primary btn-md flex-1"
                            >
                                Commit Changes
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default FeaturesList;
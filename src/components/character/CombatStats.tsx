
// components/character/CombatStats.tsx

import React, { useMemo } from 'react';
import { PlayerCharacter, Companion, formatModifier, type Inventory, type SkillConfiguration } from '../../types';
import Accordion from '../Accordion';
import { Icon } from '../Icon';
import { getTempHpLabel } from '../../utils/itemModifiers';

const DefenseTag: React.FC<{ label: string }> = ({ label }) => (
    <span className="bg-brand-surface border border-brand-primary text-[9px] font-bold text-brand-text px-3 py-1.5 rounded-full capitalize select-none cursor-default hover:border-brand-secondary transition-colors shadow-sm">
        {label}
    </span>
);

const StatCard: React.FC<{
    label: string;
    children: React.ReactNode;
    tooltip: string;
    isBuffed?: boolean;
}> = ({ label, children, tooltip, isBuffed }) => (
    <div 
        className={`flex flex-col items-center justify-center bg-brand-surface p-4 rounded-xl text-center h-full shadow-lg border min-h-[100px] cursor-help transition-all hover:bg-brand-primary/30 group relative overflow-hidden ${isBuffed ? 'border-brand-accent/40 bg-brand-accent/5' : 'border-brand-primary'}`} 
        title={tooltip}
    >
        <div className={`text-[8px] font-bold mb-3 transition-colors ${isBuffed ? 'text-brand-accent' : 'text-brand-text-muted group-hover:text-brand-accent'}`}>
            {label}
        </div>
        <div className={`font-bold leading-tight w-full ${isBuffed ? 'text-brand-accent drop-shadow-[0_0_8px_rgba(62,207,142,0.4)]' : 'text-brand-text'}`}>
            {children}
            {isBuffed && <span className="ml-1 text-[8px] opacity-70">+</span>}
        </div>
        <div className="absolute bottom-1 right-2 opacity-10 group-hover:opacity-40 transition-opacity">
            <Icon name="info" className="w-2.5 h-2.5" />
        </div>
    </div>
);

interface CombatStatsProps {
    character: PlayerCharacter | Companion;
    inventory: Inventory;
    onChange: (path: (string | number)[], value: any) => void;
    onLevelChange: (level: number) => void;
    isOpen: boolean;
    onToggle: () => void;
    resistances: string[];
    immunities: string[];
    vulnerabilities: string[];
    hideSummary?: boolean;
    hideDefenses?: boolean;
    skillConfig?: SkillConfiguration;
}

export const CombatStats: React.FC<CombatStatsProps> = ({ 
    character, 
    inventory, 
    onChange, 
    onLevelChange,
    isOpen, 
    onToggle,
    resistances,
    immunities,
    vulnerabilities,
    hideSummary = false,
    hideDefenses = false,
    skillConfig
}) => {
    
    const stats = useMemo(() => {
        return character.getCombatStats(inventory);
    }, [character, inventory]);

    const maxTempHP = useMemo(() => {
        if ('getMaxTemporaryHitPoints' in character) {
            return (character as PlayerCharacter).getMaxTemporaryHitPoints(inventory);
        }
        return 0;
    }, [character, inventory]);

    // Check for Traits and State for UI Feedback
    const hasUnarmedStyle = useMemo(() => character.abilities.some(a => a.name === "Unarmed Style"), [character.abilities]);
    const hasSneakAttack = useMemo(() => character.abilities.some(a => a.name === "Sneak Attack"), [character.abilities]);
    const isUnarmed = useMemo(() => !inventory.equipped.some(item => 
        (item.weaponStats || item.tags?.some(t => t.toLowerCase().includes('weapon')) || item.tags?.includes('heavy weapon')) &&
        (item.equippedSlot === 'Main Hand' || item.equippedSlot === 'Off Hand')
    ), [inventory.equipped]);

    const {
        totalAC,
        acBreakdown,
        toHitBonusString,
        attackBreakdown,
        damageValue,
        damageType,
        damageBreakdown,
        numberOfAttacks,
        isDualWielding,
        isDueling,
        isTwoHanding,
        isFlurryActive,
        hasTwoWeaponFighting,
        hasGreatWeaponFighting,
        hasDuelingStyle,
        mainHandAbilityName,
        offHandToHitBonusString,
        offHandAttackBreakdown,
        offHandDamageValue,
        offHandDamageType,
        offHandDamageBreakdown,
        isAcBuffed,
        isAttackBuffed,
        isDamageBuffed,
        isOffHandAttackBuffed,
        isOffHandDamageBuffed
    } = stats;

    const thpLabel = getTempHpLabel(skillConfig);
    const thpDisplayLabel = thpLabel === 'Shield' ? 'Shield' : 'Temporary Hit Points';

    return (
        <div className="space-y-6 animate-fade-in">
             {!hideSummary && (
                 <>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1">
                            <label htmlFor="level" className="block text-[8px] font-bold text-brand-text-muted mb-1 px-1">Level</label>
                            <input
                                id="level"
                                type="number"
                                value={character.level}
                                onChange={e => onLevelChange(parseInt(e.target.value) || 1)}
                                className="w-full input-md text-center font-bold text-lg"
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-[8px] font-bold text-brand-text-muted mb-1 px-1">Proficiency</label>
                            <div className="w-full bg-brand-primary/40 h-11 px-2 rounded-md border border-brand-surface text-center font-black text-lg flex items-center justify-center text-brand-accent">
                                {formatModifier(character.proficiencyBonus)}
                            </div>
                        </div>
                        
                        <div className="col-span-1">
                            <label className="block text-[8px] font-bold text-brand-text-muted mb-1 px-1">Attacks</label>
                            <div className="w-full bg-brand-primary/40 h-11 px-2 rounded-md border border-brand-surface text-center font-black text-lg flex items-center justify-center text-brand-text-muted/80">
                                {character.numberOfAttacks || 1}
                            </div>
                        </div>
                        
                        <div className="col-span-1">
                            <label htmlFor="size" className="block text-[8px] font-bold text-brand-text-muted mb-1 px-1">Size</label>
                            <div className="relative">
                                <select
                                    id="size"
                                    value={character.size || 'Medium'}
                                    onChange={e => onChange(['size'], e.target.value)}
                                    className="w-full input-md text-center font-bold text-xs appearance-none"
                                >
                                    {['Small', 'Medium', 'Large', 'Huge', 'Gargantuan', 'Colossal'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-brand-text-muted">
                                    <Icon name="chevronDown" className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>

                        {/* Speed Row */}
                        <div className="col-span-1">
                            <label className="block text-[8px] font-bold text-brand-text-muted mb-1 px-1">Ground</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={character.speed}
                                    onChange={e => onChange(['speed'], parseInt(e.target.value) || 0)}
                                    className="w-full input-md text-center font-bold text-sm"
                                />
                                <span className="absolute right-1 bottom-1 text-[8px] text-brand-text-muted font-bold capitalize">ft</span>
                            </div>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-[8px] font-bold text-brand-text-muted mb-1 px-1">Climb</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={character.climbSpeed || 0}
                                    onChange={e => onChange(['climbSpeed'], parseInt(e.target.value) || 0)}
                                    className="w-full input-md text-center font-bold text-sm"
                                />
                                <span className="absolute right-1 bottom-1 text-[8px] text-brand-text-muted font-bold capitalize">ft</span>
                            </div>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-[8px] font-bold text-brand-text-muted mb-1 px-1">Swim</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={character.swimSpeed || 0}
                                    onChange={e => onChange(['swimSpeed'], parseInt(e.target.value) || 0)}
                                    className="w-full input-md text-center font-bold text-sm"
                                />
                                <span className="absolute right-1 bottom-1 text-[8px] text-brand-text-muted font-bold capitalize">ft</span>
                            </div>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-[8px] font-bold text-brand-text-muted mb-1 px-1">Fly</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={character.flySpeed || 0}
                                    onChange={e => onChange(['flySpeed'], parseInt(e.target.value) || 0)}
                                    className="w-full input-md text-center font-bold text-sm"
                                />
                                <span className="absolute right-1 bottom-1 text-[8px] text-brand-text-muted font-bold capitalize">ft</span>
                            </div>
                        </div>

                        {/* Temporary Hit Points / Shield Section */}
                        {maxTempHP > 0 && (
                            <div className="col-span-4 animate-fade-in mb-2">
                                <label className="block text-[8px] font-bold text-brand-text-muted mb-1 px-1">
                                    {thpDisplayLabel}
                                </label>
                                <div className="flex items-center gap-2 bg-brand-primary/20 p-2 rounded-xl border border-brand-primary/50">
                                    <input 
                                        type="number" 
                                        value={character.temporaryHitPoints || 0} 
                                        onChange={e => onChange(['temporaryHitPoints'], parseInt(e.target.value) || 0)} 
                                        className="w-full input-md text-center font-black text-xl text-emerald-400"
                                        aria-label={thpLabel}
                                    />
                                    <span className="text-brand-text-muted text-xl font-black">/</span>
                                    <div className="relative w-full">
                                        <input 
                                            type="number" 
                                            value={maxTempHP} 
                                            readOnly
                                            className="w-full input-md bg-brand-primary/50 text-center font-black text-xl text-brand-text-muted cursor-not-allowed"
                                            aria-label={`Maximum ${thpLabel}`}
                                        />
                                        <div className="absolute inset-y-0 right-2 flex items-center text-brand-text-muted" title="Calculated from equipment and traits">
                                            <Icon name="check" className="w-4 h-4 opacity-30" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="col-span-4">
                            <label className="block text-[8px] font-bold text-brand-text-muted mb-1 px-1">Hit Points</label>
                            <div className="flex items-center gap-2 bg-brand-primary/20 p-2 rounded-xl border border-brand-primary/50">
                                <input 
                                    type="number" 
                                    value={character.currentHitPoints} 
                                    onChange={e => onChange(['currentHitPoints'], parseInt(e.target.value) || 0)} 
                                    className="w-full input-md text-center font-black text-xl text-brand-accent"
                                    aria-label="Current Hit Points"
                                />
                                <span className="text-brand-text-muted text-xl font-black">/</span>
                                <div className="relative w-full">
                                    <input 
                                        type="number" 
                                        value={character.maxHitPoints} 
                                        readOnly
                                        className="w-full input-md bg-brand-primary/50 text-center font-black text-xl text-brand-text-muted cursor-not-allowed"
                                        aria-label="Maximum Hit Points"
                                    />
                                    <div className="absolute inset-y-0 right-2 flex items-center text-brand-text-muted" title="Calculated based on Level and Con">
                                        <Icon name="check" className="w-4 h-4 opacity-30" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h3 className="text-brand-text mb-4 px-1">Engagement Summary</h3>
                        
                        {isUnarmed && hasUnarmedStyle && (
                            <p className="text-[10px] text-brand-accent text-left mb-4 font-bold bg-brand-accent/5 p-2 rounded border border-brand-accent/20 animate-fade-in">
                                Unarmed Style: Your fists are as deadly as blades (Base 1d6).
                            </p>
                        )}
                        
                        {isFlurryActive && (
                            <p className="text-[10px] text-brand-accent text-left mb-4 font-bold bg-brand-accent/5 p-2 rounded border border-brand-accent/20 animate-fade-in">
                                Flurry Of Blows: Your unarmed strikes are a rapid blur. You gain 1 additional strike per round.
                            </p>
                        )}

                        {hasSneakAttack && (
                            <p className="text-[10px] text-brand-accent text-left mb-4 font-bold bg-brand-accent/5 p-2 rounded border border-brand-accent/20 animate-fade-in">
                                Sneak Attack: Deal an extra {character.getSneakAttackDice()}d6 damage on your first hit each turn when you have advantage.
                            </p>
                        )}
                        
                        {isDualWielding && (
                            <p className="text-[10px] text-brand-accent text-left mb-4 font-bold bg-brand-accent/5 p-2 rounded border border-brand-accent/20">
                                {hasTwoWeaponFighting 
                                    ? "Two-Weapon Style: You gain 1 additional off-hand strike and no longer take a -2 penalty to attack rolls when dual wielding."
                                    : `Dual Wielding: Split your attacks per round between hands with a -2 penalty.`
                                }
                            </p>
                        )}
                        
                        {isDueling && hasDuelingStyle && (
                            <p className="text-[10px] text-brand-accent text-left mb-4 font-bold bg-brand-accent/5 p-2 rounded border border-brand-accent/20">
                                Dueling Style: You gain a +2 bonus to damage rolls and +1 to Ac for wielding a single weapon.
                            </p>
                        )}
                        
                        {isTwoHanding && hasGreatWeaponFighting && (
                            <p className="text-[10px] text-brand-accent text-left mb-4 font-bold bg-brand-accent/5 p-2 rounded border border-brand-accent/20">
                                Great Weapon Fighting: Your ability bonus to damage is doubled when wielding a heavy weapon.
                            </p>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <StatCard label="Total Ac" tooltip={acBreakdown} isBuffed={isAcBuffed}>
                                <span className="text-3xl font-black">{totalAC}</span>
                            </StatCard>
                            <StatCard 
                                label="To Hit Bonus" 
                                isBuffed={isAttackBuffed || isOffHandAttackBuffed}
                                tooltip={isDualWielding 
                                    ? `Main: ${attackBreakdown}\nOff: ${offHandAttackBreakdown}` 
                                    : attackBreakdown
                                }
                            >
                                {isDualWielding ? (
                                    <div className="flex flex-col items-center">
                                        <div className={`text-lg font-black ${isAttackBuffed ? 'text-brand-accent' : ''}`}>M: {toHitBonusString}</div>
                                        <div className={`text-lg font-black ${isOffHandAttackBuffed ? 'text-brand-accent' : ''}`}>O: {offHandToHitBonusString}</div>
                                    </div>
                                ) : (
                                    <span className="text-3xl font-black">{toHitBonusString}</span>
                                )}
                            </StatCard>
                            <StatCard label="Attacks/Round" tooltip="Calculated based on level. Dual wielding or flurry of blows increases your total attack count.">
                                <span className="text-3xl font-black">{numberOfAttacks}</span>
                            </StatCard>
                            <StatCard 
                                label="Primary Damage" 
                                isBuffed={isDamageBuffed || isOffHandDamageBuffed}
                                tooltip={isDualWielding 
                                    ? `Main: ${damageBreakdown}\nOff: ${offHandDamageBreakdown}` 
                                    : damageBreakdown
                                }
                            >
                                {isDualWielding ? (
                                     <div className="flex flex-col items-start w-full px-2">
                                        <div className={`text-[9px] font-black truncate w-full text-left ${isDamageBuffed ? 'text-brand-accent' : 'text-brand-text'}`}>
                                            <span className="text-brand-text-muted mr-1.5">M:</span>{damageValue}
                                        </div>
                                        <div className={`text-[9px] font-black mt-1.5 truncate w-full text-left ${isOffHandDamageBuffed ? 'text-brand-accent' : 'text-brand-text'}`}>
                                            <span className="text-brand-text-muted mr-1.5">O:</span>{offHandDamageValue}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="text-2xl font-black">{damageValue}</div>
                                        <div className="text-[8px] font-bold text-brand-accent/70 capitalize">{damageType}</div>
                                    </div>
                                )}
                            </StatCard>
                        </div>
                    </div>
                </>
             )}

             {!hideDefenses && (
                 <div className="space-y-6 pt-2 pb-2">
                    <h3 className="text-brand-text mb-4 px-1">Resistances & Defenses</h3>
                    <div className="bg-brand-primary/10 p-5 rounded-2xl border border-brand-primary/30 shadow-inner">
                        <div className="mb-6">
                            <label className="block text-[9px] font-black text-brand-text-muted mb-3">Immunities</label>
                            <div className="flex flex-wrap gap-2">
                                {immunities.length > 0 ? (
                                    immunities.map(t => <DefenseTag key={t} label={t} />)
                                ) : (
                                    <span className="text-xs text-brand-text-muted opacity-40 italic">No immunities recorded.</span>
                                )}
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-[9px] font-black text-brand-text-muted mb-3">Resistances</label>
                            <div className="flex flex-wrap gap-2">
                                {resistances.length > 0 ? (
                                    resistances.map(t => <DefenseTag key={t} label={t} />)
                                ) : (
                                    <span className="text-xs text-brand-text-muted opacity-40 italic">No resistances recorded.</span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-brand-text-muted mb-3">Vulnerabilities</label>
                            <div className="flex flex-wrap gap-2">
                                {vulnerabilities.length > 0 ? (
                                    vulnerabilities.map(t => <DefenseTag key={t} label={t} />)
                                ) : (
                                    <span className="text-xs text-brand-text-muted opacity-40 italic">No vulnerabilities recorded.</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
             )}
        </div>
    );
};

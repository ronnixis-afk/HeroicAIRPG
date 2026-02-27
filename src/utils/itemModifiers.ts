// utils/itemModifiers.ts

import { Item, Buff, ABILITY_SCORES, SKILL_NAMES, DAMAGE_TYPES, AbilityScoreName, SkillName, DamageType, SkillConfiguration, BuffDuration, ActiveBuff, AbilityEffect } from '../types';

export type ModifierCategory = 'enhancement' | 'ability' | 'skill' | 'combat' | 'defense' | 'save' | 'resist' | 'exdam' | 'temp_hp';

export interface ModifierDefinition {
    id: ModifierCategory;
    label: string;
    syntax: string; // Used for text representation (e.g. Loot generation text)
    colorClass: string;
    description: string;
    hasSubOption: boolean;
    subOptionType?: 'ability' | 'skill' | 'damageType' | 'combatType' | 'saveType';
    subOptions?: readonly string[];
    
    // Logic: Apply this modifier to an item
    apply: (item: Item, value: number | string, subOption?: string, duration?: BuffDuration) => void;
    
    // Logic: Extract this modifier from an item for UI editing
    extract: (item: Item) => { id: string, value: string, subOption: string, duration: BuffDuration }[];

    // Logic: Instruction for AI Generation
    aiInstruction: string;
}

/**
 * Returns the localized label for Temp HP based on game setting.
 */
export const getTempHpLabel = (config?: SkillConfiguration): string => {
    const activeConfig = config || (window as any).gameDataCache?.skillConfiguration;
    if (activeConfig === 'Sci-Fi' || activeConfig === 'Magitech') return 'Shield';
    return 'Temp HP';
};

export const MODIFIER_REGISTRY: Record<ModifierCategory, ModifierDefinition> = {
    enhancement: {
        id: 'enhancement',
        label: 'Enhancement',
        syntax: 'Enhancement +[X]',
        colorClass: 'text-blue-400 border-blue-400',
        description: 'Magical bonus to hit/damage (Weapons) or AC (Armor).',
        hasSubOption: false,
        apply: (item, val) => {
            const num = typeof val === 'string' ? parseInt(val) : val;
            const isWeapon = item.tags?.some(t => t.toLowerCase().includes('weapon'));
            const isArmor = item.tags?.some(t => t.toLowerCase().includes('armor') || t === 'shield');

            if (isWeapon) {
                if (!item.weaponStats) {
                    item.weaponStats = { enhancementBonus: 0, ability: 'strength', damages: [{ dice: '1d6', type: 'Slashing' }], critRange: 20 };
                }
                item.weaponStats.enhancementBonus += num;
            }
            if (isArmor) {
                if (!item.armorStats) {
                    item.armorStats = { baseAC: 11, armorType: 'light', plusAC: 0, strengthRequirement: 0 };
                }
                item.armorStats.plusAC += num;
            }
        },
        extract: (item) => {
            const res = [];
            if (item.weaponStats && item.weaponStats.enhancementBonus > 0) {
                res.push({ id: 'mod-enh-wep', value: String(item.weaponStats.enhancementBonus), subOption: '', duration: 'Passive' as BuffDuration });
            }
            if (item.armorStats && item.armorStats.plusAC > 0) {
                res.push({ id: 'mod-enh-arm', value: String(item.armorStats.plusAC), subOption: '', duration: 'Passive' as BuffDuration });
            }
            return res;
        },
        aiInstruction: `"Enhancement +X" -> Update numeric 'weaponStats.enhancementBonus' or 'armorStats.plusAC'.`
    },
    ability: {
        id: 'ability',
        label: 'Ability Score',
        syntax: 'Ability [Name] +[X]',
        colorClass: 'text-purple-400 border-purple-400',
        description: 'Direct bonus to an ability score.',
        hasSubOption: true,
        subOptionType: 'ability',
        subOptions: ABILITY_SCORES,
        apply: (item, val, sub, duration) => {
            if (!sub) return;
            const num = typeof val === 'string' ? parseInt(val) : val;
            if (!item.buffs) item.buffs = [];
            item.buffs.push({ type: 'ability', bonus: num, abilityName: sub as AbilityScoreName, duration: duration || 'Passive' });
        },
        extract: (item) => {
            return (item.buffs || [])
                .filter(b => b.type === 'ability')
                .map((b, i) => ({ id: `mod-ab-${i}`, value: String(b.bonus), subOption: b.abilityName || 'strength', duration: b.duration || 'Passive' }));
        },
        aiInstruction: `"Ability [Name] +X" -> Append to 'buffs' object: { "type": "ability", "bonus": X, "abilityName": "strength|intelligence|etc" }.`
    },
    skill: {
        id: 'skill',
        label: 'Skill Check',
        syntax: 'Skill [Name] +[X]',
        colorClass: 'text-emerald-400 border-emerald-400',
        description: 'Bonus to specific skill checks.',
        hasSubOption: true,
        subOptionType: 'skill',
        subOptions: SKILL_NAMES,
        apply: (item, val, sub, duration) => {
            if (!sub) return;
            const num = typeof val === 'string' ? parseInt(val) : val;
            if (!item.buffs) item.buffs = [];
            item.buffs.push({ type: 'skill', bonus: num, skillName: sub as SkillName, duration: duration || 'Passive' });
        },
        extract: (item) => {
            return (item.buffs || [])
                .filter(b => b.type === 'skill')
                .map((b, i) => ({ id: `mod-sk-${i}`, value: String(b.bonus), subOption: b.skillName || 'Athletics', duration: b.duration || 'Passive' }));
        },
        aiInstruction: `"Skill [Name] +X" -> Append to 'buffs' object: { "type": "skill", "bonus": X, "skillName": "Athletics|Stealth|etc" }.`
    },
    combat: {
        id: 'combat',
        label: 'Combat Bonus',
        syntax: 'Combat [Attack/Damage] +[X]',
        colorClass: 'text-red-400 border-red-400',
        description: 'Flat bonus to attack rolls or damage rolls.',
        hasSubOption: true,
        subOptionType: 'combatType',
        subOptions: ['Attack', 'Damage'],
        apply: (item, val, sub, duration) => {
            if (!sub) return;
            const num = typeof val === 'string' ? parseInt(val) : val;
            if (!item.buffs) item.buffs = [];
            item.buffs.push({ type: sub.toLowerCase() as any, bonus: num, duration: duration || 'Passive' });
        },
        extract: (item) => {
            return (item.buffs || [])
                .filter(b => b.type === 'attack' || b.type === 'damage')
                .map((b, i) => ({ id: `mod-com-${i}`, value: String(b.bonus), subOption: b.type === 'attack' ? 'Attack' : 'Damage', duration: b.duration || 'Passive' }));
        },
        aiInstruction: `"Combat [Attack/Damage] +X" -> Append to 'buffs' object: { "type": "attack" OR "damage", "bonus": X }.`
    },
    defense: {
        id: 'defense',
        label: 'Armor Class',
        syntax: 'AC +[X]',
        colorClass: 'text-yellow-400 border-yellow-400',
        description: 'Bonus armor class (Armor/Shields only).',
        hasSubOption: false,
        apply: (item, val, sub, duration) => {
            const num = typeof val === 'string' ? parseInt(val) : val;
            if (!item.buffs) item.buffs = [];
            item.buffs.push({ type: 'ac', bonus: num, duration: duration || 'Passive' });
        },
        extract: (item) => {
            return (item.buffs || [])
                .filter(b => b.type === 'ac')
                .map((b, i) => ({ id: `mod-ac-${i}`, value: String(b.bonus), subOption: '', duration: b.duration || 'Passive' }));
        },
        aiInstruction: `"AC +X" -> Append to 'buffs' object: { "type": "ac", "bonus": X }.`
    },
    save: {
        id: 'save',
        label: 'Saving Throw',
        syntax: 'Save [Ability/All] +[X]',
        colorClass: 'text-orange-400 border-orange-400',
        description: 'Bonus to specific or all saving throws.',
        hasSubOption: true,
        subOptionType: 'saveType',
        subOptions: ['All', ...ABILITY_SCORES],
        apply: (item, val, sub, duration) => {
            const num = typeof val === 'string' ? parseInt(val) : val;
            if (!item.buffs) item.buffs = [];
            item.buffs.push({ type: 'save', bonus: num, abilityName: sub === 'All' ? undefined : sub as AbilityScoreName, duration: duration || 'Passive' });
        },
        extract: (item) => {
            return (item.buffs || [])
                .filter(b => b.type === 'save')
                .map((b, i) => ({ id: `mod-sv-${i}`, value: String(b.bonus), subOption: b.abilityName || 'All', duration: b.duration || 'Passive' }));
        },
        aiInstruction: `"Save [Name] +X" -> Append to 'buffs' object: { "type": "save", "bonus": X, "abilityName": "Name" (omit for All) }.`
    },
    resist: {
        id: 'resist',
        label: 'Resistance',
        syntax: 'Resist/Immunity [Type]',
        colorClass: 'text-cyan-400 border-cyan-400',
        description: 'Grants Resistance (half dmg) or Immunity (zero dmg).',
        hasSubOption: true,
        subOptionType: 'damageType',
        subOptions: DAMAGE_TYPES,
        apply: (item, val, sub, duration) => {
            if (!sub) return;
            const isImmune = val === 'Immu' || val === 'Immunity';
            if (!item.buffs) item.buffs = [];
            item.buffs.push({ type: isImmune ? 'immunity' : 'resistance', bonus: 0, damageType: sub as DamageType, duration: duration || 'Passive' });
        },
        extract: (item) => {
            return (item.buffs || [])
                .filter(b => b.type === 'resistance' || b.type === 'immunity')
                .map((b, i) => ({ 
                    id: `mod-res-${i}`, 
                    value: b.type === 'immunity' ? 'Immu' : 'Resist', 
                    subOption: b.damageType || 'Fire',
                    duration: b.duration || 'Passive'
                }));
        },
        aiInstruction: `"Resist/Immunity [Type]" -> Append to 'buffs' object: { "type": "resistance" OR "immunity", "damageType": "Type" }.`
    },
    exdam: {
        id: 'exdam',
        label: 'Extra Damage',
        syntax: 'ExDam [Type] [Dice]',
        colorClass: 'text-rose-400 border-rose-400',
        description: 'Additional damage die on hit (Weapons, Accessories, or Passive Features).',
        hasSubOption: true,
        subOptionType: 'damageType',
        subOptions: DAMAGE_TYPES,
        apply: (item, val, sub, duration) => {
            if (!sub) return;
            const isWeapon = item.tags?.some(t => t.toLowerCase().includes('weapon'));

            // Case 1: Physical Weapon (Mutate weapon stats)
            if (isWeapon && item.weaponStats) {
                item.weaponStats.damages.push({ dice: String(val), type: sub });
            } 
            // Case 2: Passive Accessory or Feature (Add as Buff)
            else {
                if (!item.buffs) item.buffs = [];
                item.buffs.push({ type: 'exdam', bonus: 0, damageDice: String(val), damageType: sub as DamageType, duration: duration || 'Passive' });
            }
        },
        extract: (item) => {
            const res: { id: string, value: string, subOption: string, duration: BuffDuration }[] = [];
            
            // Check Weapon Stats
            if (item.weaponStats && item.weaponStats.damages.length > 1) {
                item.weaponStats.damages.slice(1).forEach((d, i) => {
                    res.push({
                        id: `mod-exdam-wep-${i}`,
                        value: d.dice,
                        subOption: d.type,
                        duration: 'Passive'
                    });
                });
            }
            
            // Check Passive Buffs (Accessories/Features)
            (item.buffs || []).filter(b => b.type === 'exdam').forEach((b, i) => {
                res.push({
                    id: `mod-exdam-buff-${i}`,
                    value: b.damageDice || '1d6',
                    subOption: b.damageType || 'Fire',
                    duration: b.duration || 'Passive'
                });
            });
            
            return res;
        },
        aiInstruction: `"ExDam [Type] [Dice]" -> If weapon: append to 'weaponStats.damages'. Otherwise: append to 'buffs' as { "type": "exdam", "damageDice": "Dice", "damageType": "Type" }.`
    },
    temp_hp: {
        id: 'temp_hp',
        label: 'Temp HP',
        syntax: 'Temp HP +[X]',
        colorClass: 'text-emerald-500 border-emerald-500',
        description: 'Grants bonus temporary hit points after resting.',
        hasSubOption: false,
        apply: (item, val, sub, duration) => {
            const num = typeof val === 'string' ? parseInt(val) : val;
            if (!item.buffs) item.buffs = [];
            item.buffs.push({ type: 'temp_hp', bonus: num, duration: duration || 'Passive' });
        },
        extract: (item) => {
            return (item.buffs || [])
                .filter(b => b.type === 'temp_hp')
                .map((b, i) => ({ id: `mod-thp-${i}`, value: String(b.bonus), subOption: '', duration: b.duration || 'Passive' }));
        },
        aiInstruction: `"Temp HP +X" -> Append to 'buffs' object: { "type": "temp_hp", "bonus": X }.`
    }
};

/**
 * UI Pill Representation for unified display
 */
export interface MechanicalPill {
    label: string;
    colorClass: string;
    icon?: string;
}

/**
 * Converts enhancement stats into standardized UI pills.
 */
export const getEnhancementPill = (item: Item): MechanicalPill | null => {
    let bonus = 0;
    if (item.weaponStats?.enhancementBonus) bonus = item.weaponStats.enhancementBonus;
    else if (item.armorStats?.plusAC) bonus = item.armorStats.plusAC;

    if (bonus > 0) {
        return {
            label: `Enhancement +${bonus}`,
            colorClass: 'text-blue-400 border-blue-400'
        };
    }
    return null;
};

/**
 * Formats an AbilityEffect into a standardized UI pill.
 */
export const getActivePowerPill = (effect: AbilityEffect): MechanicalPill => {
    let label = 'Active Power';
    if (effect.type === 'Damage') label = `${effect.damageDice} ${effect.damageType || 'Force'} Impact`;
    else if (effect.type === 'Heal') label = `${effect.healDice} Restoration`;
    else if (effect.type === 'Status') label = `${effect.status} Influence`;

    return {
        label,
        colorClass: 'text-purple-400 border-purple-500/50',
        icon: 'sparkles'
    };
};

/**
 * Returns a standardized label and color class for a buff/modifier.
 * Optimized to match Item Forge's naming convention: [Category] [Option] [Value].
 */
export const getBuffTag = (buff: Buff, config?: SkillConfiguration): { label: string, colorClass: string } => {
    let label = '';
    let category: ModifierCategory = 'ability';
    const formatVal = (v: number) => v >= 0 ? `+${v}` : `${v}`;
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

    switch (buff.type) {
        case 'ability':
            label = `Ability ${cap(buff.abilityName || 'Stat')} ${formatVal(buff.bonus)}`;
            category = 'ability';
            break;
        case 'skill':
            label = `Skill ${buff.skillName || 'Check'} ${formatVal(buff.bonus)}`;
            category = 'skill';
            break;
        case 'ac':
            label = `AC ${formatVal(buff.bonus)}`;
            category = 'defense';
            break;
        case 'attack':
            label = `Combat Attack ${formatVal(buff.bonus)}`;
            category = 'combat';
            break;
        case 'damage':
            label = `Combat Damage ${formatVal(buff.bonus)}`;
            category = 'combat';
            break;
        case 'save':
            label = `Save ${buff.abilityName ? cap(buff.abilityName) : 'All'} ${formatVal(buff.bonus)}`;
            category = 'save';
            break;
        case 'resistance':
            label = `Resist ${buff.damageType || 'Type'}`;
            category = 'resist';
            break;
        case 'immunity':
            label = `Immunity ${buff.damageType || 'Type'}`;
            category = 'resist';
            break;
        case 'exdam':
            label = `ExDam ${buff.damageType || 'Force'} ${buff.damageDice || '1d6'}`;
            category = 'exdam';
            break;
        case 'temp_hp':
            const thpLabel = getTempHpLabel(config);
            label = `${thpLabel} ${formatVal(buff.bonus)}`;
            category = 'temp_hp';
            break;
        case 'hero_points':
            label = `Heroic Capacity ${formatVal(buff.bonus)}`;
            category = 'ability'; // Use purple color for heroic buffs
            break;
        default:
            label = 'Modifier';
    }

    if (buff.duration === 'Active') {
        label = `(Active) ${label}`;
    }

    return {
        label,
        colorClass: MODIFIER_REGISTRY[category]?.colorClass || 'text-brand-text-muted border-brand-primary'
    };
};

export const getAIModifierInstructions = (): string => {
    return Object.values(MODIFIER_REGISTRY).map(def => `- ${def.aiInstruction}`).join('\n    ');
};

export const applyModifierToItem = (item: Item, type: ModifierCategory, value: string | number, subOption?: string, duration?: BuffDuration) => {
    const def = MODIFIER_REGISTRY[type];
    if (def) {
        def.apply(item, value, subOption, duration);
    }
};

export interface ParsedModifier {
    type: ModifierCategory;
    value: string;
    subOption: string;
}

export const parseModifierString = (str: string): ParsedModifier | null => {
    if (str.startsWith('Enhancement')) { 
        return { type: 'enhancement', value: str.split('+')[1], subOption: '' };
    } 
    else if (str.startsWith('Ability')) { 
        const parts = str.split(' '); 
        return { type: 'ability', subOption: parts[1].toLowerCase(), value: parts[2].replace('+', '') };
    }
    else if (str.startsWith('Skill')) { 
        const lastSpaceIndex = str.lastIndexOf(' ');
        if (lastSpaceIndex !== -1 && lastSpaceIndex > 6) {
            const subOption = str.substring(6, lastSpaceIndex).trim();
            const value = str.substring(lastSpaceIndex + 1).replace('+', '');
            return { type: 'skill', subOption, value };
        }
        const parts = str.split(' '); 
        return { type: 'skill', subOption: parts[1], value: parts[2]?.replace('+', '') || '0' };
    }
    else if (str.startsWith('Combat')) { 
        const parts = str.split(' '); 
        return { type: 'combat', subOption: parts[1], value: parts[2].replace('+', '') };
    }
    else if (str.startsWith('AC')) { 
        return { type: 'defense', value: str.split('+')[1], subOption: '' };
    }
    else if (str.startsWith('Save')) { 
        const parts = str.split(' '); 
        return { type: 'save', subOption: parts[1], value: parts[2].replace('+', '') };
    }
    else if (str.startsWith('Resist')) { 
        return { type: 'resist', value: 'Resist', subOption: str.split(' ')[1] };
    }
    else if (str.startsWith('Immunity')) { 
        return { type: 'resist', value: 'Immu', subOption: str.split(' ')[1] };
    }
    else if (str.startsWith('ExDam')) { 
        const parts = str.split(' '); 
        return { type: 'exdam', subOption: parts[1], value: parts[2] };
    }
    else if (str.startsWith('Temp HP') || str.startsWith('Shield')) {
        return { type: 'temp_hp', value: str.split('+')[1], subOption: '' };
    }
    
    return null;
};
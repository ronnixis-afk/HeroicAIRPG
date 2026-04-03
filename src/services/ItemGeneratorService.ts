// services/ItemGeneratorService.ts

import { getAi, cleanJson } from './aiClient';
import { AI_MODELS, THINKING_BUDGETS } from '../config/aiConfig';
import { Item, AbilityEffect, AbilityUsage, TargetType, SkillConfiguration, SKILL_DEFINITIONS, SKILL_NAMES, ABILITY_SCORES, DAMAGE_TYPES, STATUS_EFFECT_NAMES, BodySlot, GameData, CombatActor, NPC } from '../types';
import { applyModifierToItem, parseModifierString, getBuffTag } from '../utils/itemModifiers';
import { CATEGORY_WEIGHTS, RARITY_DISTRIBUTIONS, RARITY_TIERS, LOOT_TABLES } from '../utils/item/itemRegistry';

// Re-export common data for UI consumers
export { CATEGORY_WEIGHTS, RARITY_TIERS };

// --- HELPERS FROM MECHANICS ---

export const inferTagsFromStats = (itemData: any): string[] => {
    const rawTags = Array.isArray(itemData.tags) ? itemData.tags : (typeof itemData.tags === 'string' ? [itemData.tags] : []);
    const tags = new Set<string>(rawTags.filter((t: any) => typeof t === 'string').map((t: any) => t as string));

    if (itemData.buffs && Array.isArray(itemData.buffs) && itemData.buffs.length > 0) {
        tags.add('buff');
        if (!itemData.weaponStats && !itemData.armorStats && !itemData.bodySlotTag) {
            tags.add('consumable');
        }
    }

    if (itemData.effect) {
        tags.add('mechanical');
    }

    if (itemData.weaponStats) {
        const ability = itemData.weaponStats.ability?.toLowerCase();
        const isHeavy = Array.from(tags).some(t => t.toLowerCase().includes('heavy'));
        if (isHeavy) {
            tags.add('Heavy Weapon');
        } else if (ability === 'dexterity') {
            tags.add('Light Weapon');
        } else {
            tags.add('Medium Weapon');
        }
    }

    if (itemData.armorStats) {
        if (itemData.armorStats.armorType === 'shield') {
            tags.add('shield');
            tags.add('Light Armor');
        } else {
            const type = itemData.armorStats.armorType?.toLowerCase();
            if (type === 'light') tags.add('Light Armor');
            else if (type === 'medium') tags.add('Medium Armor');
            else if (type === 'heavy') tags.add('Heavy Armor');
            else tags.add('Light Armor');
        }
    }

    const toRemove = ['unidentified', 'weapon', 'armor', 'heavy weapon', 'light weapon', 'medium weapon', 'light armor', 'medium armor', 'heavy armor'];
    toRemove.forEach(r => {
        tags.delete(r);
    });

    return Array.from(tags);
};

const RANGED_KEYWORDS = ['bow', 'crossbow', 'sling', 'bolt', 'arrow', 'cannon', 'laser', 'battery', 'dart', 'arbalest'];

export const isRangedItem = (item: any): boolean => {
    const name = (item.name || '').toLowerCase();
    const hasRangedKeyword = RANGED_KEYWORDS.some(k => name.includes(k));
    const hasRangedTag = item.tags?.some((t: string) => t.toLowerCase().includes('ranged'));
    return hasRangedKeyword || hasRangedTag;
};

// --- PROBABILITY LOGIC ---

export const rollWeightedCategory = (): string => {
    const totalWeight = CATEGORY_WEIGHTS.reduce((sum, c) => sum + c.weight, 0);
    let random = Math.random() * totalWeight;
    for (const entry of CATEGORY_WEIGHTS) {
        if (random < entry.weight) return entry.category;
        random -= entry.weight;
    }
    return 'Consumables';
};

export const getItemRarityDistribution = (level: number): Record<string, number> => {
    if (level <= 5) return RARITY_DISTRIBUTIONS.tier1;
    if (level <= 10) return RARITY_DISTRIBUTIONS.tier2;
    if (level <= 15) return RARITY_DISTRIBUTIONS.tier3;
    if (level <= 20) return RARITY_DISTRIBUTIONS.tier4;
    return RARITY_DISTRIBUTIONS.tier5;
};

export const getMaxRarityForLevel = (playerLevel: number, cr?: number): string => {
    const effectiveLevel = Math.max(cr || 1, Math.floor(playerLevel / 2.5));
    if (effectiveLevel < 4) return 'Uncommon';
    if (effectiveLevel < 9) return 'Rare';
    if (effectiveLevel < 14) return 'Very Rare';
    if (effectiveLevel < 19) return 'Legendary';
    return 'Artifact';
};

export const rollWeightedRarity = (playerLevel: number, cr?: number): string => {
    const dist = getItemRarityDistribution(playerLevel);
    const weightedPool: string[] = [];
    Object.entries(dist).forEach(([rarity, weight]) => {
        for (let i = 0; i < weight; i++) weightedPool.push(rarity);
    });
    let rolled = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    if (cr) {
        const maxAllowed = getMaxRarityForLevel(playerLevel, cr);
        const order = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];
        if (order.indexOf(rolled) > order.indexOf(maxAllowed)) rolled = maxAllowed;
    }
    return rolled;
};

// --- SLOT RESTRICTION LOGIC ---

export const isModifierCategoryAllowedForSlot = (category: string, slot?: BodySlot): boolean => {
    if (!slot) return true;
    const s = slot.replace(/\s\d+$/, '').toLowerCase();

    switch (s) {
        case 'head': return ['ability', 'skill'].includes(category);
        case 'eyes': return ['ability', 'skill'].includes(category);
        case 'neck': return ['ability', 'save', 'resist', 'skill', 'temp_hp'].includes(category);
        case 'shoulders': return ['ability', 'skill', 'resist'].includes(category);
        case 'body':
        case 'vest': return ['ability', 'ac', 'save', 'temp_hp'].includes(category);
        case 'gloves': return ['ability', 'skill'].includes(category);
        case 'bracers': return ['ability', 'combat'].includes(category);
        case 'waist': return ['ability', 'skill', 'save', 'temp_hp'].includes(category);
        case 'legs':
        case 'feet': return ['ability', 'skill'].includes(category);
        case 'ring': return ['ability', 'save', 'resist', 'immunity', 'temp_hp'].includes(category);
        case 'accessory': return ['skill', 'exdam', 'temp_hp'].includes(category);
        default: return true;
    }
};

export const isSubOptionAllowedForSlot = (category: string, sub: string, slot?: BodySlot): boolean => {
    if (!slot) return true;

    if (category === 'temp_hp') return true;

    const s = slot.replace(/\s\d+$/, '').toLowerCase();
    const subLower = sub.toLowerCase();

    const getSkillAbility = (skillName: string) => {
        const def = (SKILL_DEFINITIONS as any)[skillName];
        return def ? def.ability : null;
    };

    switch (s) {
        case 'head':
            if (category === 'ability') return ['intelligence', 'wisdom', 'charisma'].includes(subLower);
            if (category === 'skill') return getSkillAbility(sub) === 'charisma';
            return false;
        case 'eyes':
            if (category === 'ability') return subLower === 'intelligence';
            if (category === 'skill') return ['intelligence', 'wisdom'].includes(getSkillAbility(sub));
            return false;
        case 'neck':
            if (category === 'ability') return subLower === 'constitution';
            if (category === 'save') return subLower === 'all';
            if (category === 'skill') return getSkillAbility(sub) === 'wisdom';
            return true;
        case 'shoulders':
            if (category === 'ability') return subLower === 'dexterity';
            if (category === 'skill') return subLower === 'stealth';
            return true;
        case 'body':
        case 'vest':
            if (category === 'ability') return subLower === 'constitution';
            if (category === 'ac') return true;
            if (category === 'save') return ['strength', 'dexterity', 'constitution'].includes(subLower);
            return false;
        case 'gloves':
            if (category === 'ability') return subLower === 'dexterity';
            if (category === 'skill') return getSkillAbility(sub) === 'dexterity';
            return false;
        case 'bracers':
            if (category === 'ability') return subLower === 'strength';
            if (category === 'combat') return true;
            return false;
        case 'waist':
            if (category === 'ability') return subLower === 'strength';
            if (category === 'skill') return ['athletics', 'survival'].includes(subLower);
            if (category === 'save') return ['strength', 'constitution'].includes(subLower);
            return false;
        case 'legs':
        case 'feet':
            if (category === 'ability') return subLower === 'dexterity';
            if (category === 'skill') return ['acrobatics', 'athletics', 'stealth'].includes(subLower);
            return false;
        case 'ring':
            return true;
        case 'accessory':
            if (category === 'skill') return true;
            if (category === 'exdam') return true;
            return false;
        default: return true;
    }
};

export const formatAbilityEffect = (effect: AbilityEffect): string => {
    let parts: string[] = [];

    if (effect.type === 'Damage') {
        parts.push(`${effect.damageDice || '0'} ${effect.damageType || 'Force'}`);
    } else if (effect.type === 'Heal') {
        parts.push(`${effect.healDice || '0'} Heal`);
    } else if (effect.type === 'Status') {
        parts.push(effect.status || 'Status');
    }

    if (effect.targetType === 'Multiple') {
        parts.push('Multiple');
    } else {
        parts.push('Single');
    }

    if (effect.dc) {
        const ability = effect.saveAbility ? effect.saveAbility.charAt(0).toUpperCase() + effect.saveAbility.slice(1, 3) : 'Dex';
        const result = effect.saveEffect === 'half' ? 'Half' : 'Negates';
        parts.push(`DC ${effect.dc} ${ability} (${result})`);
    }

    return parts.join(' | ');
};

export const buildMechanicalSummary = (item: Item, baseTemplateName?: string): string => {
    const parts: string[] = [];
    const tags = item.tags.map(t => t.toLowerCase());

    let scaleLabel = 'Personnel';
    if (tags.includes('ship')) scaleLabel = 'Vessel / Ship';
    else if (tags.includes('mount')) scaleLabel = 'Beast / Mount';
    parts.push(`[Scale]: ${scaleLabel}`);

    parts.push(`[Tier]: ${item.rarity || 'Common'}`);
    parts.push(`[Chassis]: ${item.bodySlotTag || 'Universal'}`);

    if (item.weaponStats) {
        const dmg = item.weaponStats.damages.map(d => `${d.dice} ${d.type}`).join(' + ');
        const isRanged = isRangedItem(item);
        const scaling = item.weaponStats.ability === 'dexterity' ? 'Finesse / Dexterity' : 'Might / Strength';
        const weight = tags.includes('heavy weapon') ? 'Heavy' : (tags.includes('light weapon') ? 'Light' : 'Medium');

        let powerDesc = `[Power]: ${dmg} (${isRanged ? 'Ranged' : 'Melee'}). ${weight} weight. ${scaling} scaling.`;
        if (item.weaponStats.enhancementBonus !== 0) {
            powerDesc += ` Enhancement ${item.weaponStats.enhancementBonus >= 0 ? '+' : ''}${item.weaponStats.enhancementBonus}.`;
        }
        parts.push(powerDesc);
    } else if (item.armorStats) {
        const total = (item.armorStats.baseAC || 0) + (item.armorStats.plusAC || 0);
        const weight = tags.includes('light armor') ? 'Light' : (tags.includes('medium armor') ? 'Heavy' : 'Custom');

        let powerDesc = `[Power]: AC ${total} (${weight} defense).`;
        if (item.armorStats.plusAC !== 0) {
            powerDesc += ` Enhancement ${item.armorStats.plusAC >= 0 ? '+' : ''}${item.armorStats.plusAC}.`;
        }
        parts.push(powerDesc);
    }

    if (item.buffs && item.buffs.length > 0) {
        const passiveLabels = item.buffs.map(b => getBuffTag(b).label);
        parts.push(`[Passives]: ${passiveLabels.join(', ')}`);
    }

    if (item.effect) {
        parts.push(`[Active Power]: ${formatAbilityEffect(item.effect)}`);
    }

    return parts.join('\n').trim();
};

export const generateMechanicalEffect = (
    rarity: string, 
    forcedType?: 'Damage' | 'Status' | 'Heal', 
    isConsumable: boolean = false,
    forcedTargetType?: TargetType,
    isUtility?: boolean
): { effect: AbilityEffect, usage: AbilityUsage } | null => {
    const d = (n: number) => Math.floor(Math.random() * n) + 1;
    
    const roll = Math.random();
    let type = forcedType || (roll < 0.8 ? 'Damage' : (roll < 0.9 ? 'Status' : 'Heal'));

    if (isConsumable && type === 'Heal' && forcedType === undefined) {
        type = 'Status';
    }

    let damage = '1d6';
    let heal = '1d8';
    let dc = 10;
    let uses = 1;

    switch (rarity) {
        case 'Common': damage = '1d6'; heal = '2d8'; dc = 10; break;
        case 'Uncommon': damage = '4d6'; heal = '4d8+8'; dc = 12; break;
        case 'Rare': damage = '8d6'; heal = '8d8+16'; dc = 15; break;
        case 'Very Rare': damage = '12d6'; heal = '12d8+24'; dc = 17; break;
        case 'Legendary': damage = '20d6'; heal = '120'; dc = 19; break;
        case 'Artifact': damage = '24d6'; heal = '250'; dc = 21; break;
    }

    if (isUtility) {
        if (rarity === 'Common') uses = 1;
        else if (rarity === 'Uncommon') uses = d(3);
        else if (rarity === 'Rare') uses = d(4);
        else uses = d(6);
    }

    const damageType = DAMAGE_TYPES[Math.floor(Math.random() * DAMAGE_TYPES.length)];
    
    const offensiveStatuses = [...STATUS_EFFECT_NAMES];
    const status = offensiveStatuses[Math.floor(Math.random() * offensiveStatuses.length)];
    
    const saveAbility = ABILITY_SCORES[Math.floor(Math.random() * ABILITY_SCORES.length)];

    const targetType = forcedTargetType || ((forcedType !== undefined || isConsumable) && Math.random() < 0.4 ? 'Multiple' : 'Single');

    const effect: AbilityEffect = {
        type,
        targetType,
        dc,
        saveAbility,
        saveEffect: type === 'Damage' ? 'half' : 'negate',
    };

    if (type === 'Damage') {
        effect.damageDice = damage;
        effect.damageType = damageType;
    } else if (type === 'Heal') {
        effect.healDice = heal;
    } else if (type === 'Status') {
        effect.status = status;
        effect.duration = d(3) + 1; // 2-4 rounds
    }

    const usage: AbilityUsage = isUtility 
        ? { type: Math.random() > 0.6 ? 'per_long_rest' : 'per_short_rest', maxUses: uses, currentUses: uses }
        : { type: 'charges', maxUses: uses, currentUses: uses };

    if (isUtility && usage.type === 'per_long_rest') {
        usage.maxUses = Math.max(1, Math.floor(uses / 2));
        usage.currentUses = usage.maxUses;
    }

    return { effect, usage };
}

export const generateSystemModifiers = (rarity: string, typeHint: string = 'other', skillConfig: SkillConfiguration = 'Fantasy', slotHint?: BodySlot): string[] => {
    if (typeHint === 'quest' || typeHint === 'throwable') return [];
    if (typeHint === 'consumable' && rarity === 'Common') return [];

    const d = (n: number) => Math.floor(Math.random() * n) + 1;
    const isWepOrArmor = (typeHint === 'weapon' || typeHint === 'armor');
    const isConsumable = typeHint === 'consumable';
    const modifiers: Set<string> = new Set();

    if (rarity !== 'Common' && isWepOrArmor) {
        let enhValue = 1;
        if (rarity === 'Rare') enhValue = 2;
        else if (rarity === 'Very Rare') enhValue = 3;
        else if (rarity === 'Legendary') enhValue = 4;
        else if (rarity === 'Artifact') enhValue = 5;
        modifiers.add(`Enhancement +${enhValue}`);
    }

    let passiveBudget = 0;
    if (isConsumable) {
        passiveBudget = 1; 
    } else {
        switch (rarity) {
            case 'Common': passiveBudget = 0; break;
            case 'Uncommon': passiveBudget = 1; break;
            case 'Rare': passiveBudget = 1 + (Math.random() > 0.6 ? 1 : 0); break;
            case 'Very Rare': passiveBudget = 2; break;
            case 'Legendary': passiveBudget = 3; break;
            case 'Artifact': passiveBudget = 3 + d(2); break;
            default: passiveBudget = 0;
        }
    }

    if (passiveBudget === 0 && modifiers.size === 0) return [];

    const tierData = RARITY_TIERS[rarity] || RARITY_TIERS['Common'];
    const allowedStats = (tierData.stats || []).filter(s => {
        if (isWepOrArmor && (s === "Mechanical Effect" || s.startsWith("Enhancement"))) return false;

        if (!isWepOrArmor && !isConsumable && s.startsWith("Enhancement")) return false;
        if (isConsumable && s.startsWith("Enhancement")) return false; 

        if (typeHint === 'weapon') return s.startsWith("Ability") || s.startsWith("Combat") || s.startsWith("ExDam");
        if (typeHint === 'armor') return !s.startsWith("Combat") && !s.startsWith("ExDam");

        if (typeHint === 'other' && slotHint) {
            let cat = 'skill';
            if (s.startsWith('Ability')) cat = 'ability';
            else if (s.startsWith('Combat')) cat = 'combat';
            else if (s.startsWith('AC')) cat = 'ac';
            else if (s.startsWith('Save')) cat = 'save';
            else if (s.startsWith('Resist')) cat = 'resist';
            else if (s.startsWith('Immunity')) cat = 'immunity';
            else if (s.startsWith('ExDam')) cat = 'exdam';
            else if (s.startsWith('Temp HP')) cat = 'temp_hp';
            else if (s === 'Mechanical Effect') return true;
            return isModifierCategoryAllowedForSlot(cat as any, slotHint);
        }
        return true;
    });

    if (allowedStats.length > 0) {
        const maxAttempts = 50;
        let attempts = 0;
        const targetSize = passiveBudget + modifiers.size;

        while (modifiers.size < targetSize && attempts < maxAttempts) {
            attempts++;
            const rawStat = allowedStats[Math.floor(Math.random() * allowedStats.length)];
            let finalStat = rawStat;

            if (rawStat.startsWith("Skill")) {
                const availableSkills = SKILL_NAMES.filter(s => {
                    const def = SKILL_DEFINITIONS[s];
                    return (def.usedIn === 'All' || def.usedIn.includes(skillConfig)) && isSubOptionAllowedForSlot('skill', s, slotHint);
                });
                if (availableSkills.length === 0) continue;
                finalStat = `Skill ${availableSkills[Math.floor(Math.random() * availableSkills.length)]} +${rawStat.split('+')[1]}`;
            } else if (rawStat.startsWith("Ability")) {
                const availableAbilities = ABILITY_SCORES.filter(a => isSubOptionAllowedForSlot('ability', a, slotHint));
                if (availableAbilities.length === 0) continue;
                finalStat = `Ability ${availableAbilities[Math.floor(Math.random() * availableAbilities.length)]} +${rawStat.split('+')[1]}`;
            } else if (rawStat.startsWith("Combat")) {
                const type = Math.random() > 0.5 ? 'Attack' : 'Damage';
                if (!isSubOptionAllowedForSlot('combat', type, slotHint)) continue;
                finalStat = `Combat ${type} +${rawStat.split('+')[1]}`;
            } else if (rawStat.startsWith("ExDam")) {
                const type = DAMAGE_TYPES[Math.floor(Math.random() * DAMAGE_TYPES.length)];
                if (!isSubOptionAllowedForSlot('exdam', type, slotHint)) continue;
                finalStat = `ExDam ${type} ${rawStat.split(' ')[1]}`;
            } else if (rawStat === "Resist" || rawStat === "Immunity") {
                const type = DAMAGE_TYPES[Math.floor(Math.random() * DAMAGE_TYPES.length)];
                const cat = rawStat === "Resist" ? "resist" : "immunity";
                if (!isSubOptionAllowedForSlot(cat, type, slotHint)) continue;
                finalStat = `${rawStat} ${type}`;
            } else if (rawStat.startsWith("Save (Specific)")) {
                const availableAbilities = ABILITY_SCORES.filter(a => isSubOptionAllowedForSlot('save', a, slotHint));
                if (availableAbilities.length === 0) continue;
                const ability = availableAbilities[Math.floor(Math.random() * availableAbilities.length)];
                finalStat = `Save ${ability.charAt(0).toUpperCase() + ability.slice(1)} +${rawStat.split('+')[1]}`;
            } else if (rawStat.startsWith("Save (All)")) {
                if (!isSubOptionAllowedForSlot('save', 'all', slotHint)) continue;
                finalStat = `Save All +${rawStat.split('+')[1]}`;
            } else if (rawStat.startsWith("Temp HP")) {
                if (!isSubOptionAllowedForSlot('temp_hp', '', slotHint)) continue;
                finalStat = rawStat;
            }
            modifiers.add(finalStat);
        }
    }
    return Array.from(modifiers);
};

export const calculateItemPrice = (item: Item): number => {
    if (item.tags?.some(t => t.toLowerCase() === 'quest')) return 0;
    const d = (n: number) => Math.floor(Math.random() * n) + 1;
    let base = 50;
    switch (item.rarity) {
        case 'Uncommon': base = d(6) * 100; break;
        case 'Rare': base = d(10) * 500; break;
        case 'Very Rare': base = d(4) * 10000; break;
        case 'Legendary': base = d(6) * 25000; break;
        case 'Artifact': base = 100000; break;
    }
    
    if (item.tags?.some(t => {
        const lower = t.toLowerCase();
        return lower === 'consumable' || lower === 'throwable';
    })) {
        return Math.max(1, Math.floor(base * 0.1));
    }
    
    return base;
};

export const forgeRandomItem = (
    category: string,
    rarity: string,
    skillConfig: SkillConfiguration = 'Fantasy',
    slotHint?: BodySlot,
    scaleHint?: string,
    departmentHint?: string,
    isIdentified: boolean = true,
    isUsable: boolean = true
): Item => {
    let tableKey = 'consumables';
    const catLower = category.toLowerCase();
    const majorLower = (scaleHint || '').toLowerCase();
    const depLower = (departmentHint || '').toLowerCase();

    const gearKeywords = ['accessor', 'wondrous', 'wear', 'gear', 'ring', 'amulet', 'cloak', 'boots', 'gloves', 'belt', 'circlet', 'trinket', 'head', 'eyes', 'neck', 'shoulders', 'body', 'vest', 'bracers', 'waist', 'legs', 'feet'];

    const isMountScale = majorLower === 'mount';
    const isShipScale = majorLower === 'ship';
    const isMacroScale = isMountScale || isShipScale;

    if (depLower.includes('weapon') || catLower.includes('weapon')) tableKey = 'weapons';
    else if (depLower.includes('protection') || depLower.includes('armor') || catLower.includes('armor') || catLower.includes('shield')) tableKey = 'armors';
    else if (depLower.includes('accessor') || gearKeywords.some(k => catLower.includes(k))) tableKey = 'accessories';
    else if (catLower.includes('utilit') || depLower.includes('utilit')) tableKey = 'utilities';
    else if (catLower.includes('consumable') || depLower.includes('consumable')) tableKey = 'consumables';
    else if (catLower.includes('throw') || depLower.includes('throw')) tableKey = 'throwables';
    else if (catLower.includes('quest') || depLower.includes('quest') || !isUsable) tableKey = 'quest';
    else if (isMacroScale) {
        const roll = Math.random();
        tableKey = roll < 0.4 ? 'weapons' : roll < 0.7 ? 'armors' : roll < 0.9 ? 'accessories' : 'consumables';
    }

    let baseList = [...(LOOT_TABLES[tableKey] || LOOT_TABLES['consumables'])];

    if (category && category !== 'Universal') {
        const filtered = baseList.filter(i => (i.name || '').toLowerCase().includes(category.toLowerCase()));
        if (filtered.length > 0) baseList = filtered;
    }

    let baseItemData: any;
    let pickedRangedStatus = false;

    if (tableKey === 'weapons') {
        const isHeavyBlueprint = (item: any) => item.tags?.some((t: string) => t.toLowerCase().includes('heavy'));

        const meleeNormal = baseList.filter(i => !isRangedItem(i) && !isHeavyBlueprint(i));
        const meleeHeavy = baseList.filter(i => !isRangedItem(i) && isHeavyBlueprint(i));
        const rangedNormal = baseList.filter(i => isRangedItem(i) && !isHeavyBlueprint(i));
        const rangedHeavy = baseList.filter(i => isRangedItem(i) && isHeavyBlueprint(i));

        const isOffHand = category === 'Off Hand' || category === 'Off Hand Weapon';

        let quadrants: { items: any[] }[] = [];
        if (isShipScale) {
            quadrants = [
                { items: rangedNormal },
                { items: rangedHeavy }
            ];
        } else {
            quadrants = [
                { items: meleeNormal },
                { items: isOffHand ? [] : meleeHeavy },
                { items: rangedNormal },
                { items: isOffHand ? [] : rangedHeavy }
            ];
        }

        const validQuadrants = quadrants.filter(q => q.items.length > 0);

        if (validQuadrants.length > 0) {
            const pickedQuadrant = validQuadrants[Math.floor(Math.random() * validQuadrants.length)];
            baseItemData = pickedQuadrant.items[Math.floor(Math.random() * pickedQuadrant.items.length)];
        } else {
            baseItemData = baseList[Math.floor(Math.random() * baseList.length)];
        }

        pickedRangedStatus = isRangedItem(baseItemData);
    } else {
        baseItemData = baseList[Math.floor(Math.random() * baseList.length)];
    }

    const blueprintTemplateName = baseItemData.name || 'Item';

    const isWeapon = tableKey === 'weapons' || !!baseItemData.weaponStats;
    const isArmor = tableKey === 'armors' || !!baseItemData.armorStats;
    const isConsumable = tableKey === 'consumables';
    const isThrowable = tableKey === 'throwables';
    const isQuest = tableKey === 'quest' || (baseItemData.tags || []).some((t: string) => t.toLowerCase() === 'quest');

    const typeHint = isQuest ? 'quest' : (isWeapon ? 'weapon' : (isArmor ? 'armor' : (isConsumable ? 'consumable' : (isThrowable ? 'throwable' : 'other'))));
    const finalRarity = isQuest ? 'Common' : rarity;

    const baseHasBuffs = baseItemData.buffs && baseItemData.buffs.length > 0;
    const baseHasEffect = !!baseItemData.effect;

    let modStrings: string[] = [];
    if (isConsumable && (baseHasBuffs || baseHasEffect)) {
        modStrings = [];
    } else {
        modStrings = generateSystemModifiers(finalRarity, typeHint, skillConfig, slotHint);
    }
    
    const rolledStatBuffs = modStrings.filter(s => s !== "Mechanical Effect");
    const hasRolledStatBuff = rolledStatBuffs.length > 0;
    const canHaveActiveEffect = isThrowable || (modStrings.includes("Mechanical Effect") && !isWeapon && !isArmor);

    let effect: AbilityEffect | undefined;
    let usage: AbilityUsage | undefined;

    const isUtility = (baseItemData.tags || []).some((t: string) => t.toLowerCase() === 'utility') && !isConsumable;
    
    // DECISION: Should this utility item be active? (Uncommon+ utilities have high chance to be active)
    const isActiveUtility = isUtility && finalRarity !== 'Common' && Math.random() > 0.3;

    const hasAnyExistingEffect = baseHasEffect || hasRolledStatBuff || baseHasBuffs;
    const shouldGenerateDynamicEffect = canHaveActiveEffect || (isConsumable && !hasAnyExistingEffect) || (isConsumable && finalRarity !== 'Common' && !hasAnyExistingEffect) || (isActiveUtility && !hasAnyExistingEffect);

    if (shouldGenerateDynamicEffect) {
        let forcedType = baseItemData.effect?.type as 'Heal' | 'Status' | 'Damage' | undefined;
        
        if (!forcedType) {
            if (isThrowable) {
                // Keep default distribution
            } else if (isConsumable || isActiveUtility) {
                const roll = Math.random();
                forcedType = roll < 0.4 ? 'Heal' : (roll < 0.8 ? 'Damage' : 'Status');
            }
        }
        
        const forcedTargetType = baseItemData.effect?.targetType;
        const mech = generateMechanicalEffect(finalRarity, forcedType, isConsumable || isThrowable, forcedTargetType, isUtility);
        if (mech) { 
            effect = mech.effect; 
            usage = mech.usage; 
        }
    } else if (isActiveUtility && hasAnyExistingEffect && !usage) {
        // It has buffs/modifiers but no effect yet - give it usage charges anyway
        const mech = generateMechanicalEffect(finalRarity, undefined, false, undefined, true);
        if (mech) usage = mech.usage;
    }

    const finalTags = [...(baseItemData.tags || [])];
    if (isWeapon) finalTags.push(pickedRangedStatus ? 'ranged' : 'melee');
    if (isShipScale) finalTags.push('ship');
    if (isMountScale) finalTags.push('mount');

    const item = new Item({
        ...baseItemData,
        id: `forged-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        rarity: finalRarity as any,
        isNew: true,
        weaponStats: isWeapon && baseItemData.weaponStats ? JSON.parse(JSON.stringify(baseItemData.weaponStats)) : undefined,
        armorStats: isArmor && baseItemData.armorStats ? JSON.parse(JSON.stringify(baseItemData.armorStats)) : undefined,
        buffs: (isConsumable || isThrowable || isActiveUtility) && (effect || usage) ? [] : (baseItemData.buffs ? JSON.parse(JSON.stringify(baseItemData.buffs)) : []),
        tags: finalTags,
        effect: effect || (baseItemData.effect ? JSON.parse(JSON.stringify(baseItemData.effect)) : undefined),
        usage: usage || (baseItemData.usage ? JSON.parse(JSON.stringify(baseItemData.usage)) : undefined),
        bodySlotTag: slotHint || baseItemData.bodySlotTag
    });

    rolledStatBuffs.forEach(modStr => {
        const parsed = parseModifierString(modStr);
        if (parsed) {
            applyModifierToItem(item, parsed.type, parsed.value, parsed.subOption, (isConsumable || isActiveUtility) ? 'Active' : 'Passive');
        }
    });

    if (isIdentified || isQuest) {
        item.name = item.name || blueprintTemplateName;
        item.description = item.description || 'A unique discovery.';
    }

    item.tags = inferTagsFromStats(item);
    item.details = buildMechanicalSummary(item, blueprintTemplateName);
    item.price = isQuest ? 0 : calculateItemPrice(item);
    return item;
}

const THEME_KEYWORDS: Record<SkillConfiguration, Record<string, string[]>> = {
    'Fantasy': {
        consumables: ['potion', 'elixir', 'draught', 'food', 'bread', 'wine', 'herb', 'tonic', 'scroll'],
        throwables: ['bomb', 'grenade', 'vial', 'oil', 'firepot', 'flask'],
        weapons: ['sword', 'bow', 'dagger', 'axe', 'spear', 'mace', 'staff', 'blade', 'claymore', 'hammer'],
        armors: ['mail', 'plate', 'leather', 'gambeson', 'shield', 'cuirass']
    },
    'Sci-Fi': {
        consumables: ['stim', 'medkit', 'ration', 'battery', 'injector', 'pill', 'booster', 'canister'],
        throwables: ['thermal', 'emp', 'plasma grenade', 'mine', 'explosive', 'grenade', 'charge'],
        weapons: ['laser', 'blaster', 'rifle', 'pistol', 'saber', 'plasma', 'railgun', 'cannon', 'carbine'],
        armors: ['power armor', 'mesh', 'shield generator', 'carbon', 'plating', 'exosuit']
    },
    'Modern': {
        consumables: ['pill', 'soda', 'snack', 'first aid', 'bandage', 'medicine', 'water', 'energy drink'],
        throwables: ['grenade', 'molotov', 'flashbang', 'smoke', 'c4', 'dynamite'],
        weapons: ['handgun', 'rifle', 'shotgun', 'knife', 'baton', 'pistol', 'revolver', 'smg'],
        armors: ['vest', 'helmet', 'ballistic', 'shield', 'kevlar']
    },
    'Magitech': {
        consumables: ['aether', 'crystal', 'mana stim', 'potion', 'battery', 'vial', 'capacitor'],
        throwables: ['arcane bomb', 'sonic grenade', 'shock vial', 'core', 'unstable'],
        weapons: ['arc-blade', 'mana-pistol', 'staff', 'focus', 'gauntlet', 'wand', 'caster'],
        armors: ['reinforced', 'engraved', 'plate', 'barrier', 'kinetic', 'plated']
    }
};

export const forgeSkins = (items: any[], skillConfig: SkillConfiguration = 'Fantasy'): any[] => {
    return items.map(itemData => {
        if (!itemData) return itemData;

        if (itemData.weaponStats || itemData.armorStats || (itemData.buffs?.length > 0) || itemData.effect || (itemData.price > 0)) {
            return { ...itemData, isNew: true };
        }

        let category = 'Utilities';
        const name = (itemData.name || '').toLowerCase();
        const tags = (Array.isArray(itemData.tags) ? itemData.tags : []).map((t: any) => String(t).toLowerCase());
        
        const isUsable = itemData.type !== 'Non-Usable';
        const slotHint = itemData.slot as BodySlot | undefined;

        if (tags.includes('currency')) return { ...itemData, isNew: true };

        if (isUsable) {
            const theme = THEME_KEYWORDS[skillConfig] || THEME_KEYWORDS['Fantasy'];
            const check = (list: string[]) => list.some(k => name.includes(k));

            if (tags.some((t: string) => t.includes('weapon')) || check(theme.weapons)) category = 'Weapons';
            else if (tags.some((t: string) => t.includes('armor')) || tags.includes('shield') || check(theme.armors)) category = 'Armors';
            else if (tags.includes('accessory') || name.includes('ring') || name.includes('amulet') || slotHint) category = 'Accessories';
            else if (tags.includes('consumable') || check(theme.consumables)) category = 'Consumables';
            else if (tags.includes('throwable') || check(theme.throwables)) category = 'Throwables';
        } else {
            category = 'Quest';
        }

        const baseItem = forgeRandomItem(category, itemData.rarity || 'Common', skillConfig, slotHint, undefined, undefined, true, isUsable);

        return {
            ...baseItem,
            ...itemData,
            name: itemData.name || baseItem.name,
            description: itemData.description || baseItem.description,
            quantity: itemData.quantity || baseItem.quantity,
            isNew: true
        };
    });
};

// --- AI SKINNING FROM AIITEMSERVICE ---

export const detectItemAdditionIntent = (text: string): boolean => {
    const lower = (text || '').toLowerCase();
    if (lower.includes('take a look') || lower.includes('take damage') || lower.includes('take cover') || lower.includes('take a rest') || lower.includes('take aim')) return false;
    return (lower.includes('pick up') || lower.includes('loot the') || lower.includes('grab the') || lower.includes('retrieve the') || lower.includes('collect the') || lower.includes('steal the') || lower.includes('pocket the'));
};

export const generateItemCorrection = async (userContent: string, narrative: string) => {
    const input = `The user said: "${userContent}". The GM narrated: "${narrative}". Did the party acquire items? Extract into JSON.
    STRICT RULE: ONLY extract items if they were explicitly picked up, stolen, looted, or received.
    Return JSON: { "updates": { "inventoryUpdates": [ { "ownerId": "player", "list": "carried", "items": [ { "name": "string", "quantity": number, "description": "MAX 20 WORDS", "rarity": "string" } ] } ] } }`;
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: input,
        config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC } }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

export const enrichItemDetails = async (item: Item, gameData: GameData): Promise<Partial<Item>> => {
    const level = gameData.playerCharacter.level || 1;
    const contextPrompt = `
    Define the precise mechanical stats and thematic flavor for this item based on the current context.
    
    **CONCEPT**: 
    Name: "${item.name}"
    Narrative Context: "${item.description || item.details || 'Found during exploration.'}"
    Initial Tags: ${(item.tags || []).join(', ') || 'None'}
    
    **WORLD LORE CONTEXT (THEMATIC SKINNING)**:
    ${gameData.worldSummary || 'Standard Fantasy Setting'}

    **CONTEXT**:
    Player Level: ${level}
    
    **STRICT POLICY - CONSERVATIVE BUFFS & DESCRIPTIVE ITEMS**:
    - ONLY include mechanical buffs (enhancementBonus, plusAC, buffs) if the narrative explicitly describes the item as superior, magical, advanced, or masterwork.
    - Plain, mundane, or scavenged items MUST NOT have any buffs.
    - **DESCRIPTIVE ITEMS**: If the item name or context implies it is a "Quest Item", "Note", "Letter", "Book", "Key", or "Trophy", it MUST NOT have any mechanical stats (weaponStats, armorStats, buffs, effect). These items are purely for narrative and flavor.
    - If the item is "Credits" or "Gold", ensure you assign a logical 'quantity' based on the lore context.

    **STRICT POLICY - ENHANCEMENT SCALE (ONLY IF BUFFED)**:
    - Uncommon (+1), Rare (+2), Very Rare (+3), Legendary (+4), Artifact (+5).

    **MECHANICAL SCHEMAS**:
    1. 'weaponStats': { "ability": "strength|dexterity", "enhancementBonus": number, "damages": [{ "dice": "1d8", "type": "Slashing" }], "critRange": number }
    2. 'armorStats': { "baseAC": number, "armorType": "light|medium|heavy|shield", "plusAC": number, "strengthRequirement": number }
    3. 'buffs': Array of { "type": "ac|attack|damage|save|skill|ability|resistance|immunity|temp_hp|exdam", "bonus": number, "skillName": "String", "abilityName": "String", "damageType": "String", "duration": "Passive|Active" }
    4. 'effect': { "type": "Damage|Status|Heal", "targetType": "Single|Multiple", "dc": number, "saveAbility": "dexterity|constitution|wisdom|etc", "damageDice": "string", "damageType": "string", "status": "string", "healDice": "string" }
    5. 'usage': { "type": "charges|per_short_rest|per_long_rest", "maxUses": number, "currentUses": number }

    **STRICT POLICY - CONSUMABLES & THROWABLES (ONE EFFECT ONLY)**:
    - Consumables and Throwables MUST ONLY have ONE of either 'effect' OR ONE entry in 'buffs'. Never both.
    - Throwables must ONLY use 'Damage' or 'Status' effect types (NEVER 'Heal').
    - PRICING: Consumables and Throwables are priced at 10% of standard market rates for their rarity.

    **STRICT POLICY - UTILITY ITEMS**:
    - High-Tier (Uncommon+) Utility items are often gadgets, artifacts, or wands.
    - They are NOT consumed on use. They MUST use 'per_short_rest' or 'per_long_rest' for their 'usage'.
    - Use evocative names for these gadgets (e.g. "Plasma Cannon", "Wand of Light", "Occult Mask").

    **INSTRUCTIONS**:
    - **PRICING**: Use logical market rates. Remember the 90% discount for consumables/throwables. If it is a quest item, set price to 0.
    - **DESCRIPTION**: Atmospheric flavor text. MUST be under 20 words. **RULE**: If the item is NOT a consumable or throwable, the description MUST include the name of the enemy it was looted from (e.g. 'A radiant longsword that once belonged to [enemy name]. It hums with holy energy...').
    - **DETAILS**: Longer lore and history details (if applicable).
    - **STRICT RULE**: DO NOT include numerical stats (e.g. "AC 3", "+1") in the 'name' or 'description'. Use pure flavor.
    - **BODY SLOT**: Select logical slot. For non-gear, set bodySlotTag to null.
    
    Return JSON only containing: name, description, details, rarity, tags, keywords, weaponStats, armorStats, effect, buffs, usage, price, bodySlotTag, quantity.`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: contextPrompt,
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } }
        });
        const details = JSON.parse(cleanJson(response.text || '{}'));

        const finalName = details.name || item.name;
        const finalDesc = details.description || item.description;

        const mergedData = { ...item, ...details, name: finalName, description: finalDesc };
        const tempItem = new Item(mergedData);
        mergedData.tags = inferTagsFromStats(mergedData);
        const sysSummary = buildMechanicalSummary(tempItem);
        mergedData.details = (mergedData.details ? mergedData.details + '\n\n' : '') + sysSummary;

        return mergedData;
    } catch (e) { return item; }
};

export const identifyItems = async (items: Item[], gameData: GameData): Promise<Item[]> => {
    if (!items || items.length === 0) return [];
    const input = `You are a legendary Appraiser and Lorekeeper.
    
    [WORLD LORE FOR SKINNING]
    ${gameData.worldSummary || 'Standard setting.'}

    [ITEMS TO IDENTIFY]
    ${JSON.stringify(items.map((i, idx) => ({ id: i.id, _index: idx, rarity: i.rarity, mechanicalTruth: i.details || buildMechanicalSummary(i) })))}
    
    [THEMATIC INTEGRITY INSTRUCTIONS]
    You MUST ensure the Name and Description of each item are logical representations of its Mechanical Truth.
    1. RANGE: 'Ranged' items named Bow, Blaster, etc.
    2. WEIGHT: 'Heavy Weight' is massive (Cannon, Greatsword). 'Light Weight' is compact (Dagger).
    3. SCALING: 'Dexterity' -> precision. 'Strength' -> brute force.
    4. ENHANCEMENTS: If '+1' or powerful passives, use 'Superior', 'Masterwork'.
    
    Return JSON array: [{ "id": "string", "name": "string", "description": "string", "details": "string", "rarity": "string", "tags": ["string"], "keywords": ["string"] }]`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: input,
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } }
        });
        const rawJson = cleanJson(response.text || '[]');
        let parsed = JSON.parse(rawJson);
        if (!Array.isArray(parsed) && parsed.items && Array.isArray(parsed.items)) parsed = parsed.items;

        if (Array.isArray(parsed)) {
            return items.map((original, index) => {
                let aiItem = parsed.find(p => p.id === original.id) || parsed[index];
                if (!aiItem) return original;
                const sanitizedTags = Array.isArray(aiItem.tags) ? aiItem.tags : (typeof aiItem.tags === 'string' ? [aiItem.tags] : []);
                const sanitizedKeywords = Array.isArray(aiItem.keywords) ? aiItem.keywords : (typeof aiItem.keywords === 'string' ? [aiItem.keywords] : []);
                const mergedData = {
                    ...original, ...aiItem, id: original.id,
                    tags: Array.from(new Set([...(original.tags || []), ...sanitizedTags])).filter(t => typeof t === 'string' && t.toLowerCase() !== 'unidentified'),
                    keywords: Array.from(new Set([...(original.keywords || []), ...sanitizedKeywords])),
                    isNew: true
                };
                const newItem = new Item(mergedData);
                newItem.details = (aiItem.details ? aiItem.details + '\n\n' : '') + buildMechanicalSummary(newItem);
                return newItem;
            });
        }
        return [];
    } catch (e) { return []; }
};

export const generateItemPrices = async (items: Item[]): Promise<{ id: string, price: number }[]> => {
    const input = `Price items based on rarity, power, and lore.\nItems: ${JSON.stringify(items.map(i => ({ id: i.id, name: i.name, rarity: i.rarity, tags: i.tags, mechanics: i.details })))}\nReturn JSON: [{ id, price }]`;
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: input,
        config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC } }
    });
    return JSON.parse(cleanJson(response.text || '[]'));
};

export const generateStoreCategoryInventory = async (category: string, blueprints: Item[], worldSummary: string, scale: string = 'Person'): Promise<any[]> => {
    const itemsContext = blueprints.map((b, i) => ({ index: i, rarity: b.rarity, mechanicalDetails: b.details }));
    const isMacroScale = scale.toLowerCase().includes('ship') || scale.toLowerCase().includes('mount') || category.toLowerCase().includes('ship') || category.toLowerCase().includes('mount');
    const scaleContext = isMacroScale ? `Vessel/Beast-Scale Component (${scale}). Render names and flavor for large-scale entities.` : 'Personnel-Scale gear.';

    const input = `[IDENTITY]
    You are the Shopkeeper providing thematic 'skins' (names and descriptions) for a shipment of items in a store.
    [CONTEXT] Setting: ${worldSummary} Category: ${category} Scale: ${scaleContext}
    [INPUT DATA] ${JSON.stringify(itemsContext, null, 2)}
    [MECHANICAL GUIDELINES] 1. Names and Descriptions MUST reflect Mechanical Details. NO NUMBERS.
    Return JSON: [{ "index": number, "name": "string", "description": "string", "details": "string" }]`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: input,
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } }
        });
        const skins = JSON.parse(cleanJson(response.text || '[]'));
        if (Array.isArray(skins)) {
            return blueprints.map((blueprint, i) => {
                const skin = skins.find(s => s.index === i);
                const itemData = { ...blueprint, name: skin?.name || blueprint.name, description: skin?.description || blueprint.description };
                itemData.details = (skin?.details ? skin.details + '\n\n' : '') + buildMechanicalSummary(new Item(itemData));
                return itemData;
            });
        }
        return blueprints;
    } catch (e) { return blueprints; }
};

export const generateForgeDetails = async (blueprint: Item, worldSummary: string, userIdea: string): Promise<{ name: string, description: string }> => {
    const summary = buildMechanicalSummary(blueprint);
    const isMacroScale = (blueprint.tags || []).some(t => t.toLowerCase().includes('ship') || t.toLowerCase().includes('mount'));
    const input = `Create a unique, thematic name and flavor for a forged RPG item.
    [BLUEPRINT] ${summary}
    [SCALE] ${isMacroScale ? 'Vessel/Beast-Scale.' : 'Personnel-Scale.'}
    [WORLD LORE] ${worldSummary}
    [USER IDEA] "${userIdea || 'A powerful custom creation.'}"
    [INSTRUCTIONS] NO NUMBERS or STATS in the name or description. Use only evocative flavor. (Max 15 words).
    Return JSON: { "name": "string", "description": "string" }`;

    const ai = getAi();
    const response = await ai.models.generateContent({
        model: AI_MODELS.DEFAULT,
        contents: input,
        config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: THINKING_BUDGETS.LOGIC } }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

export const skinItemsForCharacter = async (items: Item[], character: any, worldSummary: string): Promise<Item[]> => {
    const itemsContext = items.map((item, idx) => ({ index: idx, type: item.weaponStats ? 'Weapon' : (item.armorStats ? 'Armor' : 'Item'), stats: buildMechanicalSummary(item) }));
    const prompt = `Provide unique skins for 3 starting items.
    [CHARACTER] ${character.name}, ${character.profession}, ${character.background}. Appearance: ${character.appearance}
    [LORE] ${worldSummary}
    [ITEMS] ${JSON.stringify(itemsContext)}
    [INSTRUCTIONS] Names and flavor MUST fit the character. NO numbers or stat indicators in flavor.
    Return JSON array: [{ "index": number, "name": "string", "description": "string" }]`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 512 }, responseMimeType: "application/json" }
        });
        const skins = JSON.parse(cleanJson(response.text || '[]'));
        return items.map((item, i) => {
            const skin = skins.find((s: any) => s.index === i);
            if (skin) {
                const updated = new Item({ ...item, name: skin.name, description: skin.description, isNew: true });
                updated.details = (item.details ? item.details + '\n\n' : '') + buildMechanicalSummary(updated);
                return updated;
            }
            return item;
        });
    } catch (e) { return items; }
};

export const generateStolenItem = async (intendedItem: string, npc: NPC, gameData: GameData): Promise<Partial<Item>> => {
    const prompt = `You are an AI Item Architect. The player pickpocketed ${npc.name}.
    INTENDED ITEM: "${intendedItem}"
    NPC CONTEXT: ${npc.name} (${npc.description || 'A local character'}). Status: ${npc.status}.
    WORLD CONTEXT: ${gameData.worldSummary || "Standard setting."}
    [INSTRUCTIONS]
    1. Skin the "INTENDED ITEM" based on the NPC. Return JSON: { "name": "string", "description": "string", "rarity": "string", "quantity": number }`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 512 }, responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) { return { name: intendedItem, description: "A lifted item.", rarity: "Common", quantity: 1 }; }
};

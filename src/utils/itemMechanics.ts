// utils/itemMechanics.ts

import { Item, AbilityEffect, AbilityUsage, SkillConfiguration, SKILL_DEFINITIONS, SKILL_NAMES, ABILITY_SCORES, DAMAGE_TYPES, BodySlot } from '../types';
import { applyModifierToItem, parseModifierString, getBuffTag } from './itemModifiers';
import { CATEGORY_WEIGHTS, RARITY_DISTRIBUTIONS, RARITY_TIERS, LOOT_TABLES } from './item/itemRegistry';
import { inferTagsFromStats } from '../services/aiItemService';

// Re-export common data for UI consumers
export { CATEGORY_WEIGHTS, RARITY_TIERS };

// --- CONSTANTS ---
const RANGED_KEYWORDS = ['bow', 'crossbow', 'sling', 'bolt', 'arrow', 'cannon', 'laser', 'battery', 'dart', 'arbalest'];

// --- HELPERS ---

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

    // Temp HP is always allowed in its specific slots (handled by isModifierCategoryAllowedForSlot)
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

// --- CORE FACTORY LOGIC ---

/**
 * buildMechanicalSummary - THE TRUTH BRIEF
 * Generates a structured technical summary of the item's power.
 * Optimized with clear headers to ensure the AI Librarian understands precisely what it is skinning.
 */
export const buildMechanicalSummary = (item: Item, baseTemplateName?: string): string => {
    const parts: string[] = [];
    const tags = item.tags.map(t => t.toLowerCase());

    // 1. Scale Section
    let scaleLabel = 'Personnel';
    if (tags.includes('ship')) scaleLabel = 'Vessel / Ship';
    else if (tags.includes('mount')) scaleLabel = 'Beast / Mount';
    parts.push(`[Scale]: ${scaleLabel}`);

    // 2. Rarity & Slot
    parts.push(`[Tier]: ${item.rarity || 'Common'}`);
    parts.push(`[Chassis]: ${item.bodySlotTag || 'Universal'}`);

    // 3. Power Profile (Core Stats)
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
        const weight = tags.includes('light armor') ? 'Light' : (tags.includes('medium armor') ? 'Medium' : (tags.includes('heavy armor') ? 'Heavy' : 'Custom'));

        let powerDesc = `[Power]: AC ${total} (${weight} defense).`;
        if (item.armorStats.plusAC !== 0) {
            powerDesc += ` Enhancement ${item.armorStats.plusAC >= 0 ? '+' : ''}${item.armorStats.plusAC}.`;
        }
        parts.push(powerDesc);
    }

    // 4. Passives Section
    if (item.buffs && item.buffs.length > 0) {
        const passiveLabels = item.buffs.map(b => getBuffTag(b).label);
        parts.push(`[Passives]: ${passiveLabels.join(', ')}`);
    }

    // 5. Active Section
    if (item.effect) {
        const e = item.effect;
        // Fix: Explicitly type activeLabel as string to avoid union type mismatch during narrative formatting
        let activeLabel: string = e.type;
        if (e.type === 'Damage') activeLabel = `${e.damageDice} ${e.damageType || 'Force'} Impact`;
        else if (e.type === 'Heal') activeLabel = `${e.healDice} Restoration`;
        else if (e.type === 'Status') activeLabel = `${e.status} Influence`;
        parts.push(`[Active Power]: ${activeLabel}`);
    }

    return parts.join('\n').trim();
};

export const generateMechanicalEffect = (rarity: string, forcedType?: 'Damage' | 'Status' | 'Heal', isConsumable: boolean = false): { effect: AbilityEffect, usage: AbilityUsage } | null => {
    const d = (n: number) => Math.floor(Math.random() * n) + 1;
    const type = forcedType || (Math.random() < 0.6 ? 'Damage' : (Math.random() < 0.5 ? 'Status' : 'Heal'));

    let damage = '1d6';
    let heal = '1d8';
    let dc = 10;
    let uses = 1;

    switch (rarity) {
        case 'Common': damage = '1d6'; heal = '1d8'; dc = 10; break;
        case 'Uncommon': damage = '4d6'; heal = '4d8+8'; dc = 12; break;
        case 'Rare': damage = '8d6'; heal = '8d8+16'; dc = 15; break;
        case 'Very Rare': damage = '12d6'; heal = '12d8+24'; dc = 17; break;
        case 'Legendary': damage = '20d6'; heal = '100'; dc = 19; break;
        case 'Artifact': damage = '24d6'; heal = '200'; dc = 21; break;
    }

    const damageType = DAMAGE_TYPES[Math.floor(Math.random() * DAMAGE_TYPES.length)];

    return {
        effect: {
            type,
            targetType: 'Single',
            damageDice: damage,
            healDice: heal,
            damageType,
            dc,
            saveAbility: 'dexterity',
            status: 'Poisoned'
        },
        usage: { type: 'charges', maxUses: uses, currentUses: uses }
    };
};

/**
 * generateSystemModifiers - THE BUDGET BALANCER
 * Refined to ensure that rarity always feels rewarding by separating 
 * the mandatory Enhancement/Active slots from the passive buff budget.
 */
export const generateSystemModifiers = (rarity: string, typeHint: string = 'other', skillConfig: SkillConfiguration = 'Fantasy', slotHint?: BodySlot): string[] => {
    if (typeHint === 'quest' || typeHint === 'consumable' || typeHint === 'throwable') return [];

    const d = (n: number) => Math.floor(Math.random() * n) + 1;
    const isWepOrArmor = (typeHint === 'weapon' || typeHint === 'armor');
    const modifiers: Set<string> = new Set();

    // 1. PHASE A: MANDATORY REWARD SLOT
    // Weapons and Armor receive a guaranteed enhancement bonus that does NOT spend budget.
    if (rarity !== 'Common' && isWepOrArmor) {
        let enhValue = 1;
        if (rarity === 'Rare') enhValue = 2;
        else if (rarity === 'Very Rare') enhValue = 3;
        else if (rarity === 'Legendary') enhValue = 4;
        else if (rarity === 'Artifact') enhValue = 5;
        modifiers.add(`Enhancement +${enhValue}`);
    }

    // 2. PHASE B: PASSIVE BUDGET CALCULATION
    // Budget determines the number of additional passive modifiers rolled.
    let passiveBudget = 0;
    switch (rarity) {
        case 'Common': passiveBudget = 0; break;
        case 'Uncommon': passiveBudget = 1; break;
        case 'Rare': passiveBudget = 1 + (Math.random() > 0.6 ? 1 : 0); break;
        case 'Very Rare': passiveBudget = 2; break;
        case 'Legendary': passiveBudget = 3; break;
        case 'Artifact': passiveBudget = 3 + d(2); break;
        default: passiveBudget = 0;
    }

    if (passiveBudget === 0 && modifiers.size === 0) return [];

    // 3. PHASE C: ROLL PASSIVES
    const tierData = RARITY_TIERS[rarity] || RARITY_TIERS['Common'];
    const allowedStats = (tierData.stats || []).filter(s => {
        // Exclude mandatory slots from the random pool
        if (isWepOrArmor && (s === "Mechanical Effect" || s.startsWith("Enhancement"))) return false;

        // Exclude Enhancement for non-weapons/armor
        if (!isWepOrArmor && s.startsWith("Enhancement")) return false;

        // Category filtering
        if (typeHint === 'weapon') return s.startsWith("Ability") || s.startsWith("Combat") || s.startsWith("ExDam");
        if (typeHint === 'armor') return !s.startsWith("Combat") && !s.startsWith("ExDam");

        // Slot filtering for Accessories
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
        // Total expected size is (Budget + Enhancement)
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
    return base;
};

/**
 * forgeRandomItem - THE CHASSIS FACTORY
 * Deterministically creates mechanical blueprints based on department and scale.
 */
export const forgeRandomItem = (
    category: string,
    rarity: string,
    skillConfig: SkillConfiguration = 'Fantasy',
    slotHint?: BodySlot,
    scaleHint?: string,
    departmentHint?: string,
    isIdentified: boolean = false
): Item => {
    let tableKey = 'consumables';
    const catLower = category.toLowerCase();
    const majorLower = (scaleHint || '').toLowerCase();
    const depLower = (departmentHint || '').toLowerCase();

    const gearKeywords = ['accessor', 'wondrous', 'wear', 'gear', 'ring', 'amulet', 'cloak', 'boots', 'gloves', 'belt', 'circlet', 'trinket', 'head', 'eyes', 'neck', 'shoulders', 'body', 'vest', 'bracers', 'waist', 'legs', 'feet'];

    const isMountScale = majorLower === 'mount';
    const isShipScale = majorLower === 'ship';
    const isMacroScale = isMountScale || isShipScale;

    // --- REFINED CHASSIS SELECTION (Strict Department Sync) ---
    if (depLower.includes('weapon') || catLower.includes('weapon')) tableKey = 'weapons';
    else if (depLower.includes('protection') || depLower.includes('armor') || catLower.includes('armor') || catLower.includes('shield')) tableKey = 'armors';
    else if (depLower.includes('accessor') || gearKeywords.some(k => catLower.includes(k))) tableKey = 'accessories';
    else if (catLower.includes('utilit')) tableKey = 'utilities';
    else if (catLower.includes('consumable')) tableKey = 'consumables';
    else if (catLower.includes('throw')) tableKey = 'throwables';
    else if (catLower.includes('quest')) tableKey = 'quest';
    else if (isMacroScale) {
        const roll = Math.random();
        tableKey = roll < 0.4 ? 'weapons' : roll < 0.7 ? 'armors' : roll < 0.9 ? 'accessories' : 'consumables';
    }

    let baseList = [...(LOOT_TABLES[tableKey] || LOOT_TABLES['consumables'])];

    // --- SUBTYPE FILTERING ---
    if (category && category !== 'Universal') {
        const filtered = baseList.filter(i => (i.name || '').toLowerCase().includes(category.toLowerCase()));
        if (filtered.length > 0) baseList = filtered;
    }

    let baseItemData: any;
    let pickedRangedStatus = false;

    if (tableKey === 'weapons') {
        const isHeavyBlueprint = (item: any) => item.tags?.some((t: string) => t.toLowerCase().includes('heavy'));

        // Filter pool into quadrants to ensure perfect randomization balance
        const meleeNormal = baseList.filter(i => !isRangedItem(i) && !isHeavyBlueprint(i));
        const meleeHeavy = baseList.filter(i => !isRangedItem(i) && isHeavyBlueprint(i));
        const rangedNormal = baseList.filter(i => isRangedItem(i) && !isHeavyBlueprint(i));
        const rangedHeavy = baseList.filter(i => isRangedItem(i) && isHeavyBlueprint(i));

        const isOffHand = category === 'Off Hand' || category === 'Off Hand Weapon';

        // Vessel Restriction: Ship weapons MUST be ranged or heavy-ranged.
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
            // Hard fallback if filtered subtypes emptied all quadrants
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

    const typeHint = isWeapon ? 'weapon' : (isArmor ? 'armor' : (isConsumable ? 'consumable' : (isThrowable ? 'throwable' : 'other')));
    const finalRarity = tableKey === 'quest' ? 'Common' : rarity;

    const modStrings = generateSystemModifiers(finalRarity, typeHint, skillConfig, slotHint);

    let effect: AbilityEffect | undefined;
    let usage: AbilityUsage | undefined;

    const canHaveActiveEffect = isConsumable || isThrowable || (modStrings.includes("Mechanical Effect") && !isWeapon && !isArmor);

    if (canHaveActiveEffect) {
        const forcedEffectType = isConsumable ? 'Heal' : (isThrowable ? (Math.random() > 0.5 ? 'Damage' : 'Status') : undefined);
        const mech = generateMechanicalEffect(finalRarity, forcedEffectType, (isConsumable || isThrowable));
        if (mech) { effect = mech.effect; usage = mech.usage; }
    }

    // Determine basic tags
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
        buffs: [],
        tags: finalTags,
        effect: effect || (baseItemData.effect ? JSON.parse(JSON.stringify(baseItemData.effect)) : undefined),
        usage: usage || (baseItemData.usage ? JSON.parse(JSON.stringify(baseItemData.usage)) : undefined),
        bodySlotTag: slotHint || baseItemData.bodySlotTag
    });

    modStrings.filter(s => s !== "Mechanical Effect").forEach(modStr => {
        const parsed = parseModifierString(modStr);
        if (parsed) applyModifierToItem(item, parsed.type, parsed.value, parsed.subOption);
    });

    // Identification Logic
    const isQuest = tableKey === 'quest' || item.tags?.some(t => t.toLowerCase() === 'quest');
    if (isIdentified || isQuest) {
        item.name = item.name || blueprintTemplateName;
        item.description = item.description || 'A unique discovery.';
    } else {
        item.description = 'Needs appraisal.';
        item.name = 'Unidentified Item';
    }

    item.tags = inferTagsFromStats(item);
    item.details = buildMechanicalSummary(item, blueprintTemplateName);
    item.price = calculateItemPrice(item);
    return item;
};

export const forgeSkins = (items: any[], skillConfig: SkillConfiguration = 'Fantasy'): any[] => {
    return items.map(itemData => {
        if (!itemData) return itemData;

        // If it already has rich details, just mark it new
        if (itemData.weaponStats || itemData.armorStats || (itemData.buffs?.length > 0) || itemData.effect || (itemData.price > 0)) {
            return { ...itemData, isNew: true };
        }

        let category = 'Utilities';
        const name = (itemData.name || '').toLowerCase();
        const tags = (Array.isArray(itemData.tags) ? itemData.tags : []).map((t: any) => String(t).toLowerCase());

        if (tags.includes('currency')) return { ...itemData, isNew: true };
        if (tags.some((t: string) => t.includes('weapon')) || name.includes('sword') || name.includes('bow') || name.includes('dagger')) category = 'Weapons';
        else if (tags.some((t: string) => t.includes('armor')) || tags.includes('shield') || name.includes('mail') || name.includes('plate')) category = 'Armors';
        else if (tags.includes('accessory') || name.includes('ring') || name.includes('amulet')) category = 'Accessories';
        else if (tags.includes('consumable') || name.includes('potion')) category = 'Consumables';
        else if (tags.includes('throwable') || name.includes('grenade')) category = 'Throwables';

        // Force identified for items added via narrative/SKIN logic
        const baseItem = forgeRandomItem(category, itemData.rarity || 'Common', skillConfig, undefined, undefined, undefined, true);

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

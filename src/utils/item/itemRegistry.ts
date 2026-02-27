
// utils/item/itemRegistry.ts

import { Item } from '../../types';

export const CATEGORY_WEIGHTS = [
    { category: 'Consumables', weight: 35 },
    { category: 'Weapons', weight: 20 },
    { category: 'Armors', weight: 20 },
    { category: 'Utilities', weight: 15 },
    { category: 'Accessories', weight: 10 },
    { category: 'Throwables', weight: 5 },
];

export const RARITY_DISTRIBUTIONS: Record<string, Record<string, number>> = {
    tier1: { 'Common': 3, 'Uncommon': 3 },
    tier2: { 'Common': 2, 'Uncommon': 3, 'Rare': 1 },
    tier3: { 'Uncommon': 2, 'Rare': 3, 'Very Rare': 1 },
    tier4: { 'Rare': 2, 'Very Rare': 3, 'Legendary': 1 },
    tier5: { 'Very Rare': 2, 'Legendary': 3, 'Artifact': 1 }
};

export const RARITY_TIERS: Record<string, { desc: string, stats: string[] }> = {
    'Common': { desc: "0 Modifiers. Base item only.", stats: [] },
    'Uncommon': { desc: "1 Modifier. Minor enhancements.", stats: ["Enhancement +1", "Skill +2", "Ability +2", "Combat +1", "AC +1", "Save (Specific) +2", "Save (All) +1", "ExDam 1d6", "Mechanical Effect", "Temp HP +5"] },
    'Rare': { desc: "1-2 Modifiers. Potent magical properties.", stats: ["Enhancement +2", "Skill +4", "Ability +4", "Combat +2", "AC +2", "Save (Specific) +4", "Save (All) +2", "ExDam 1d8", "Resist", "Mechanical Effect", "Temp HP +10"] },
    'Very Rare': { desc: "2-3 Modifiers. High magic properties.", stats: ["Enhancement +3", "Skill +6", "Ability +6", "Combat +3", "AC +3", "Save (Specific) +6", "Save (All) +3", "ExDam 2d6", "Resist", "Mechanical Effect", "Temp HP +15"] },
    'Legendary': { desc: "3-4 Modifiers. Legendary power.", stats: ["Enhancement +4", "Skill +8", "Ability +8", "Combat +4", "AC +4", "Save (Specific) +8", "Save (All) +4", "ExDam 2d8", "Resist", "Immunity", "Mechanical Effect", "Temp HP +20"] },
    'Artifact': { desc: "4-5 Modifiers. Mythic power.", stats: ["Enhancement +5", "Skill +10", "Ability +10", "Combat +5", "AC +5", "Save (Specific) +10", "Save (All) +5", "ExDam 3d6", "Resist", "Immunity", "Mechanical Effect", "Temp HP +25"] },
};

export const LOOT_TABLES: Record<string, Partial<Item>[]> = {
    weapons: [
        // --- Light Weapons (Dexterity Based) ---
        // Melee
        { name: 'light_weapon_p_1_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'light_weapon_p_2_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'light_weapon_s_1_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'light_weapon_s_2_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'light_weapon_b_1_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'light_weapon_b_2_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        // Ranged
        { name: 'light_weapon_p_1_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'light_weapon_p_2_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'light_weapon_s_1_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'light_weapon_s_2_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'light_weapon_b_1_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'light_weapon_b_2_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },

        // --- Medium Weapons (Strength Based) ---
        // Melee
        { name: 'medium_weapon_p_1_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d4', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_p_2_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d8', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_p_3_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d10', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_s_1_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d4', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_s_2_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d8', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_s_3_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d10', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_b_1_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d4', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_b_2_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d8', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_b_3_m', tags: ['weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d10', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        // Ranged
        { name: 'medium_weapon_p_1_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d4', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_p_2_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d8', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_p_3_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d10', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_s_1_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d4', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_s_2_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d8', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_s_3_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d10', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_b_1_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d4', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_b_2_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d8', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'medium_weapon_b_3_r', tags: ['weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d10', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },

        // --- Heavy Weapons (Strength Based) ---
        // Melee
        { name: 'heavy_weapon_p_1_m', tags: ['heavy weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d12', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_p_2_m', tags: ['heavy weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d6', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_p_3_m', tags: ['heavy weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d8', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_s_1_m', tags: ['heavy weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d12', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_s_2_m', tags: ['heavy weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d6', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_s_3_m', tags: ['heavy weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d8', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_b_1_m', tags: ['heavy weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d12', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_b_2_m', tags: ['heavy weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d6', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_b_3_m', tags: ['heavy weapon', 'melee'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d8', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        // Ranged
        { name: 'heavy_weapon_p_1_r', tags: ['heavy weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d12', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_p_2_r', tags: ['heavy weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d6', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_p_3_r', tags: ['heavy weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d8', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_s_1_r', tags: ['heavy weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d12', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_s_2_r', tags: ['heavy weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d6', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_s_3_r', tags: ['heavy weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d10', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_b_1_r', tags: ['heavy weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d12', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_b_2_r', tags: ['heavy weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '2d6', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'heavy_weapon_b_3_r', tags: ['heavy weapon', 'ranged'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d10', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 } },
    ],
    armors: [
        // --- Light Armor (Full Dex) ---
        { name: 'Light Armor Tier 1', tags: ['armor'], bodySlotTag: 'Body', armorStats: { baseAC: 11, armorType: 'light', plusAC: 0, strengthRequirement: 0 } },
        { name: 'Light Armor Tier 2', tags: ['armor'], bodySlotTag: 'Body', armorStats: { baseAC: 12, armorType: 'light', plusAC: 0, strengthRequirement: 0 } },
        { name: 'Light Armor Tier 3', tags: ['armor'], bodySlotTag: 'Body', armorStats: { baseAC: 13, armorType: 'light', plusAC: 0, strengthRequirement: 0 } },
        
        // --- Medium Armor (Half Dex) ---
        { name: 'Medium Armor Tier 1', tags: ['armor'], bodySlotTag: 'Body', armorStats: { baseAC: 14, armorType: 'medium', plusAC: 0, strengthRequirement: 0 } },
        { name: 'Medium Armor Tier 2', tags: ['armor'], bodySlotTag: 'Body', armorStats: { baseAC: 15, armorType: 'medium', plusAC: 0, strengthRequirement: 0 } },
        { name: 'Medium Armor Tier 3', tags: ['armor'], bodySlotTag: 'Body', armorStats: { baseAC: 16, armorType: 'medium', plusAC: 0, strengthRequirement: 0 } },
        
        // --- Heavy Armor (No Dex) ---
        { name: 'Heavy Armor Tier 1', tags: ['armor'], bodySlotTag: 'Body', armorStats: { baseAC: 17, armorType: 'heavy', plusAC: 0, strengthRequirement: 13 } },
        { name: 'Heavy Armor Tier 2', tags: ['armor'], bodySlotTag: 'Body', armorStats: { baseAC: 18, armorType: 'heavy', plusAC: 0, strengthRequirement: 15 } },
        { name: 'Heavy Armor Tier 3', tags: ['armor'], bodySlotTag: 'Body', armorStats: { baseAC: 19, armorType: 'heavy', plusAC: 0, strengthRequirement: 15 } },
        { name: 'Heavy Armor Tier 4', tags: ['armor'], bodySlotTag: 'Body', armorStats: { baseAC: 20, armorType: 'heavy', plusAC: 0, strengthRequirement: 17 } },
        
        // --- Shields ---
        { name: 'Basic Shield', tags: ['armor', 'shield'], bodySlotTag: 'Off Hand', armorStats: { baseAC: 2, armorType: 'shield', plusAC: 0, strengthRequirement: 0 } },
    ],
    accessories: [
        { name: 'Ring', tags: ['accessory'], bodySlotTag: 'Ring 1' },
        { name: 'Amulet', tags: ['accessory'], bodySlotTag: 'Neck' },
        { name: 'Cloak', tags: ['accessory'], bodySlotTag: 'Shoulders' },
        { name: 'Boots', tags: ['accessory'], bodySlotTag: 'Feet' },
        { name: 'Gloves', tags: ['accessory'], bodySlotTag: 'Gloves' },
        { name: 'Belt', tags: ['accessory'], bodySlotTag: 'Waist' },
        { name: 'Circlet', tags: ['accessory'], bodySlotTag: 'Head' },
        { name: 'Goggles', tags: ['accessory'], bodySlotTag: 'Eyes' },
        { name: 'Wondrous Trinket', tags: ['accessory'], bodySlotTag: 'Accessory 1' },
    ],
    consumables: [
        { name: 'Healing Potion', tags: ['consumable'], effect: { type: 'Heal', healDice: '2d4+2', targetType: 'Single' } },
        { name: 'Greater Healing Potion', tags: ['consumable'], rarity: 'Uncommon', effect: { type: 'Heal', healDice: '4d4+4', targetType: 'Single' } },
        { name: 'Scroll', tags: ['consumable'] },
    ],
    utilities: [
        { name: 'Silk Rope (50ft)', tags: ['utility'], description: 'Strong and lightweight.' },
        { name: 'Grappling Hook', tags: ['utility'], description: 'Iron hook with a secure loop.' },
        { name: 'Thieves\' Tools', tags: ['utility'], description: 'Picks, wrenches, and files.' },
        { name: 'Healer\'s Kit', tags: ['utility', 'consumable'], description: 'Bandages and salves. 10 uses.', usage: { type: 'charges', maxUses: 10, currentUses: 10 }, effect: { type: 'Heal', healDice: '1', targetType: 'Single' } },
        { name: 'Spyglass', tags: ['utility'], description: 'Magnifies objects.' },
    ],
    throwables: [
        { name: 'Alchemist\'s Fire', tags: ['ammunition', 'throwable'], bodySlotTag: 'Main Hand', effect: { type: 'Damage', damageDice: '1d4', damageType: 'Fire', targetType: 'Single' } },
        { name: 'Acid Vial', tags: ['ammunition', 'throwable'], bodySlotTag: 'Main Hand', effect: { type: 'Damage', damageDice: '2d6', damageType: 'Acid', targetType: 'Single' } },
        { name: 'Holy Water', tags: ['ammunition', 'throwable'], bodySlotTag: 'Main Hand', effect: { type: 'Damage', damageDice: '2d6', damageType: 'Radiant', targetType: 'Single' } },
        { name: 'Throwing Dagger', tags: ['weapon', 'throwable'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'Handaxe', tags: ['weapon', 'throwable'], bodySlotTag: 'Main Hand', weaponStats: { ability: 'strength', damages: [{ dice: '1d6', type: 'Slashing' }], enhancementBonus: 0, critRange: 20 } },
        { name: 'Grenade', tags: ['ammunition', 'throwable'], bodySlotTag: 'Main Hand', effect: { type: 'Damage', damageDice: '3d6', damageType: 'Fire', targetType: 'Multiple', dc: 12, saveAbility: 'dexterity', saveEffect: 'half' } },
    ],
    quest: [
        { name: 'Mysterious Note', tags: ['quest'], description: 'A piece of parchment with hurried handwriting.' },
        { name: 'Ancient Relic', tags: ['quest'], description: 'It pulses with a faint, rhythmic light.' },
        { name: 'Heavy Iron Key', tags: ['quest'], description: 'Cold to the touch and covered in rust.' },
        { name: 'Signed Contract', tags: ['quest'], description: 'The ink is fresh and the wax seal is intact.' },
        { name: 'Broken Emblem', tags: ['quest'], description: 'Part of a larger crest, jaggedly snapped.' },
    ]
};


// utils/lootMechanics.ts

import { CombatActor, CombatActorSize, Item, SkillConfiguration } from '../types';
import { forgeRandomItem, rollWeightedRarity, rollWeightedCategory } from './itemMechanics';

export interface LootSlotRequest {
    rarity: string;
    enemySource: string;
    blueprint: Item; 
}

export interface LootDropPlan {
    slots: LootSlotRequest[];
    totalCurrency: number;
    currencyName: string;
}

const SIZE_CHANCE_MODIFIER: Record<CombatActorSize, number> = {
    'Small': -5,
    'Medium': 0,
    'Large': 10,
    'Huge': 15,
    'Gargantuan': 20,
    'Colossal': 25
};

/**
 * Multiplier for the amount of currency dropped based on physical scale.
 */
const SIZE_CURRENCY_MULTIPLIER: Record<CombatActorSize, number> = {
    'Small': 0.5,
    'Medium': 1.0,
    'Large': 2.0,
    'Huge': 4.0,
    'Gargantuan': 8.0,
    'Colossal': 16.0
};

/**
 * Core function to process defeated enemies and generate a deterministic loot plan.
 * Scales potential rarity to both enemy difficulty and player progression.
 */
export const calculateLootDrops = (
    enemies: CombatActor[], 
    worldStyle: string = 'fantasy', 
    skillConfig: SkillConfiguration = 'Fantasy',
    playerLevel: number = 1
): LootDropPlan => {
    const plan: LootDropPlan = {
        slots: [],
        totalCurrency: 0,
        currencyName: worldStyle.toLowerCase().includes('sci-fi') ? 'Credits' : 'Gold Pieces'
    };

    enemies.forEach(enemy => {
        const cr = enemy.challengeRating || 1;
        const rank = enemy.rank || 'normal';
        const size = enemy.size || 'Medium';

        // 1. Calculate Base Drop Chance for Items
        let baseChance = 35;
        if (rank === 'elite') baseChance = 75;
        if (rank === 'boss') baseChance = 100;

        // 2. Apply Size Modifier to Chance
        const finalChance = baseChance + (SIZE_CHANCE_MODIFIER[size] || 0);

        // 3. Roll for Primary Item Drop
        if (Math.random() * 100 <= finalChance) {
            const rarity = rollWeightedRarity(playerLevel, cr);
            const category = rollWeightedCategory();
            
            plan.slots.push({
                rarity,
                enemySource: enemy.name,
                blueprint: forgeRandomItem(category, rarity, skillConfig)
            });
        }

        // 4. Roll for Boss Bonus Drop
        if (rank === 'boss' && Math.random() * 100 <= 35) {
            const rarity = rollWeightedRarity(playerLevel + 2, cr + 2);
            const category = rollWeightedCategory();

            plan.slots.push({
                rarity,
                enemySource: `${enemy.name} (Hoard)`,
                blueprint: forgeRandomItem(category, rarity, skillConfig)
            });
        }

        // 5. Calculate Currency Loot
        // Tiered Scaling: Aligns with exponential item price jumps
        let lootTierMultiplier = 1;
        if (cr >= 17) lootTierMultiplier = 1000;
        else if (cr >= 11) lootTierMultiplier = 100;
        else if (cr >= 5) lootTierMultiplier = 10;
        else lootTierMultiplier = 1;

        // Rank Multipliers
        let rankMultiplier = 1;
        if (rank === 'elite') rankMultiplier = 3;
        if (rank === 'boss') rankMultiplier = 12;

        // Size Multipliers (Scales amount, not just chance)
        const sizeMultiplier = SIZE_CURRENCY_MULTIPLIER[size] || 1.0;

        const baseGold = cr * 15;
        const variance = 0.8 + (Math.random() * 0.4); 
        
        const enemyGold = Math.floor(baseGold * rankMultiplier * lootTierMultiplier * sizeMultiplier * variance);
        
        plan.totalCurrency += enemyGold;
    });

    return plan;
};

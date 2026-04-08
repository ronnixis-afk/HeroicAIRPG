
import { forgeRandomItem } from '../src/services/ItemGeneratorService';
import { LOOT_TABLES } from '../src/utils/item/itemRegistry';

const healingBlueprints = LOOT_TABLES.consumables.filter(i => i.name?.includes('Healing Potion'));

console.log('--- Testing Potion Rarity Scaling ---');

const rarities = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

rarities.forEach(rarity => {
    console.log(`\nTesting Rarity: ${rarity}`);
    healingBlueprints.forEach(bp => {
        const item = forgeRandomItem('Consumables', rarity, 'Fantasy', undefined, undefined, 'Consumables');
        // Filter to make sure we got a healing potion (optional, but good for test clarity)
        if (item.effect?.type === 'Heal') {
            console.log(`Blueprint: ${(bp.name || '').padEnd(20)} | Heal: ${item.effect.healDice || 'FIXED VAL'}`);
        }
    });
});

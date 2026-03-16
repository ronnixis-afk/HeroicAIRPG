
import { forgeRandomItem, buildMechanicalSummary } from '../src/utils/itemMechanics';
import { Item } from '../src/types/Items';

async function testQuestItem() {
    console.log("Testing Quest Item Generation...");
    
    // Test Case 1: Quest Item tagged blueprint
    const questItem = forgeRandomItem('Quest', 'Rare', 'Fantasy', undefined, undefined, 'Quest', true);
    
    console.log("Item Name:", questItem.name);
    console.log("Item Rarity:", questItem.rarity);
    console.log("Item Tags:", questItem.tags);
    console.log("Item Price:", questItem.price);
    console.log("Weapon Stats:", questItem.weaponStats);
    console.log("Armor Stats:", questItem.armorStats);
    console.log("Buffs:", questItem.buffs);
    console.log("Effect:", questItem.effect);
    
    const summary = buildMechanicalSummary(questItem);
    console.log("\nMechanical Summary:\n", summary);

    if (questItem.price === 0 && !questItem.weaponStats && !questItem.armorStats && (!questItem.buffs || questItem.buffs.length === 0)) {
        console.log("\n✅ SUCCESS: Quest item is mundane and free.");
    } else {
        console.log("\n❌ FAILURE: Quest item has mechanical stats or price.");
    }
}

testQuestItem().catch(console.error);

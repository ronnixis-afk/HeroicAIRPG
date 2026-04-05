// utils/startingGearUtils.ts

import { Item, Inventory } from '../types';
import { getSystemRandom } from './systemRandom';

/**
 * Generates a starting inventory for a character based on world style and level.
 * This provides the baseline "Blueprints" which can then be skinned by AI services.
 */
export const getStartingInventory = (style: string = 'fantasy', level: number = 1): Inventory => {
    const s = style.toLowerCase();
    
    // --- Funds Calculation ---
    let base = 50;
    let multiplier = 15;
    if (level >= 17) { base = 20000; multiplier = 500; }
    else if (level >= 11) { base = 5000; multiplier = 250; }
    else if (level >= 5) { base = 500; multiplier = 25; }
    
    // Note: Reducers using this should ideally pass a seed or accept the impurity of getSystemRandom/Date.now
    const roll = getSystemRandom(1, 10);
    const total = base + (roll * multiplier);
    const curName = (s.includes('sci-fi') || s.includes('modern')) ? 'Credits' : 'Gold Pieces';
    
    const startingFunds = new Item({
        id: `start-funds-${Date.now()}-${Math.random()}`,
        name: curName, 
        quantity: total, 
        tags: ['currency'],
        description: 'Initial wealth.', 
        rarity: 'Common', 
        isNew: true
    });

    // --- Blueprint Selection ---
    let blueprints: Item[] = [];
    
    if (s.includes('modern')) {
        blueprints = [
            new Item({
                name: 'Combat Knife',
                tags: ['Light Weapon', 'melee'],
                weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Slashing' }], enhancementBonus: 0, critRange: 19 },
                rarity: 'Common',
                equippedSlot: 'Main Hand'
            }),
            new Item({
                name: 'Tactical Handgun',
                tags: ['Light Weapon', 'ranged'],
                weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 },
                rarity: 'Common'
            }),
            new Item({
                name: 'Kevlar Vest',
                tags: ['Light Armor'],
                armorStats: { baseAC: 12, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                rarity: 'Common',
                equippedSlot: 'Body'
            })
        ];
    } else if (s.includes('sci-fi') || s.includes('futuristic')) {
        blueprints = [
            new Item({
                name: 'Laser Blade',
                tags: ['Light Weapon', 'melee'],
                weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Fire' }], enhancementBonus: 0, critRange: 19 },
                rarity: 'Common',
                equippedSlot: 'Main Hand'
            }),
            new Item({
                name: 'Ion Pistol',
                tags: ['Light Weapon', 'ranged'],
                weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Electric' }], enhancementBonus: 0, critRange: 20 },
                rarity: 'Common'
            }),
            new Item({
                name: 'Mesh Underlay',
                tags: ['Light Armor'],
                armorStats: { baseAC: 12, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                rarity: 'Common',
                equippedSlot: 'Body'
            })
        ];
    } else if (s.includes('magitech')) {
        blueprints = [
            new Item({
                name: 'Rune Blade',
                tags: ['Light Weapon', 'melee'],
                weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Force' }], enhancementBonus: 0, critRange: 19 },
                rarity: 'Common',
                equippedSlot: 'Main Hand'
            }),
            new Item({
                name: 'Aether Caster',
                tags: ['Light Weapon', 'ranged'],
                weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Radiant' }], enhancementBonus: 0, critRange: 20 },
                rarity: 'Common'
            }),
            new Item({
                name: 'Infused Vest',
                tags: ['Light Armor'],
                armorStats: { baseAC: 12, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                rarity: 'Common',
                equippedSlot: 'Body'
            })
        ];
    } else if (s.includes('historical')) {
        blueprints = [
            new Item({
                name: 'Dagger',
                tags: ['Light Weapon', 'melee'],
                weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Piercing' }], enhancementBonus: 0, critRange: 19 },
                rarity: 'Common',
                equippedSlot: 'Main Hand'
            }),
            new Item({
                name: 'Sling',
                tags: ['Light Weapon', 'ranged'],
                weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 },
                rarity: 'Common'
            }),
            new Item({
                name: 'Padded Jack',
                tags: ['Light Armor'],
                armorStats: { baseAC: 11, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                rarity: 'Common',
                equippedSlot: 'Body'
            })
        ];
    } else {
        // Fantasy fallback
        blueprints = [
            new Item({
                name: 'Dagger',
                tags: ['Light Weapon', 'melee'],
                weaponStats: { ability: 'dexterity', damages: [{ dice: '1d4', type: 'Piercing' }], enhancementBonus: 0, critRange: 19 },
                rarity: 'Common',
                equippedSlot: 'Main Hand'
            }),
            new Item({
                name: 'Shortbow',
                tags: ['Light Weapon', 'ranged'],
                weaponStats: { ability: 'dexterity', damages: [{ dice: '1d6', type: 'Piercing' }], enhancementBonus: 0, critRange: 20 },
                rarity: 'Common'
            }),
            new Item({
                name: 'Leather Armor',
                tags: ['Light Armor'],
                armorStats: { baseAC: 11, armorType: 'light', plusAC: 0, strengthRequirement: 0 },
                rarity: 'Common',
                equippedSlot: 'Body'
            })
        ];
    }

    // Assign IDs to blueprints if they don't have them
    const processedBlueprints = blueprints.map(b => {
        if (!b.id) b.id = `blueprint-${Date.now()}-${Math.random()}`;
        return b;
    });

    return {
        equipped: processedBlueprints.filter(i => i.equippedSlot),
        carried: [startingFunds, ...processedBlueprints.filter(i => !i.equippedSlot)],
        storage: [],
        assets: []
    };
};

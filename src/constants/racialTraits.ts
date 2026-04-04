import { Ability } from '../types';

/**
 * Racial Trait Blueprints
 * 6 generic traits representing ability score bonuses for each of the 6 ability scores.
 */
export const RACIAL_TRAIT_BLUEPRINTS: Omit<Ability, 'id'>[] = [
    {
        name: "Strength Bonus",
        description: "Natural physical power and muscle density.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'ability', bonus: 2, abilityName: 'strength' }],
        tags: ['racial', 'combat']
    },
    {
        name: "Dexterity Bonus",
        description: "Innate grace, speed, and precision.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'ability', bonus: 2, abilityName: 'dexterity' }],
        tags: ['racial', 'speed']
    },
    {
        name: "Constitution Bonus",
        description: "Inherent toughness and physical resilience.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'ability', bonus: 2, abilityName: 'constitution' }],
        tags: ['racial', 'survival']
    },
    {
        name: "Intelligence Bonus",
        description: "A natural aptitude for logic and learning.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'ability', bonus: 2, abilityName: 'intelligence' }],
        tags: ['racial', 'knowledge']
    },
    {
        name: "Wisdom Bonus",
        description: "Deep-seated intuition and awareness.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'ability', bonus: 2, abilityName: 'wisdom' }],
        tags: ['racial', 'exploration']
    },
    {
        name: "Charisma Bonus",
        description: "Force of personality and social magnetism.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'ability', bonus: 2, abilityName: 'charisma' }],
        tags: ['racial', 'social']
    }
];

/**
 * Maps common D&D race keywords to their primary attribute bonuses.
 */
export const RACE_ATTRIBUTE_MAPPING: Record<string, string> = {
    'elf': 'dexterity',
    'elven': 'dexterity',
    'high-elf': 'dexterity',
    'wood-elf': 'dexterity',
    'halfling': 'dexterity',
    'nimble': 'dexterity',
    'dwarf': 'constitution',
    'dwarven': 'constitution',
    'mountain': 'constitution',
    'tough': 'constitution',
    'sturdy': 'constitution',
    'gnome': 'intelligence',
    'scholar': 'intelligence',
    'orc': 'strength',
    'half-orc': 'strength',
    'warrior': 'strength',
    'mighty': 'strength',
    'dragonborn': 'strength',
    'dragon': 'strength',
    'tiefling': 'charisma',
    'noble': 'charisma',
    'social': 'charisma'
};

/**
 * Returns the recommended racial trait (attribute bonus) for a race name based on keywords.
 */
export const getRacialTraitForRace = (raceName: string): Omit<Ability, 'id'> | null => {
    const lowerName = raceName.toLowerCase();
    
    for (const [keyword, attribute] of Object.entries(RACE_ATTRIBUTE_MAPPING)) {
        if (lowerName.includes(keyword)) {
            const blueprint = RACIAL_TRAIT_BLUEPRINTS.find(b => 
                b.buffs?.[0].abilityName === attribute
            );
            if (blueprint) return blueprint;
        }
    }
    
    return null;
};

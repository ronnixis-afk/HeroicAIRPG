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

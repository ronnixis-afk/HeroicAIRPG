import { LibraryTrait } from '../traitLibrary';

export const GENERIC_TRAITS: LibraryTrait[] = [
    {
        name: "Keen Senses",
        category: 'general',
        description: "Sharp eyes and refined intuition. You notice details that others miss.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'skill', bonus: 2, skillName: 'Perception' }, { type: 'skill', bonus: 2, skillName: 'Investigation' }],
        tags: ['universal', 'exploration']
    },
    {
        name: "Hardy",
        category: 'general',
        description: "Natural resilience and enhanced vitality. You are difficult to shake.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'save', bonus: 2, abilityName: 'constitution' }],
        tags: ['universal', 'survival']
    },
    {
        name: "Silver Tongue",
        category: 'general',
        description: "Charismatic charm and social subroutines. You always know what to say.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'skill', bonus: 2, skillName: 'Persuasion' }, { type: 'skill', bonus: 2, skillName: 'Deception' }],
        tags: ['universal', 'social']
    },
    {
        name: "Iron Skin",
        category: 'general',
        description: "Physical toughness or tactical layering. Attacks struggle to find purchase.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'ac', bonus: 1 }],
        tags: ['universal', 'combat']
    },
    {
        name: "Athlete",
        category: 'general',
        description: "Peak physical conditioning. You move with power and grace.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'skill', bonus: 2, skillName: 'Athletics' }, { type: 'skill', bonus: 2, skillName: 'Acrobatics' }],
        tags: ['universal', 'mobility']
    },
    {
        name: "Indomitable Will",
        category: 'general',
        description: "Mental discipline or hardened firewalls. Your mind is an impenetrable fortress.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'save', bonus: 2, abilityName: 'wisdom' }],
        tags: ['universal', 'defense']
    },
    {
        name: "Quick Reflexes",
        category: 'general',
        description: "You react before you even think. Danger finds you a difficult target.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'save', bonus: 2, abilityName: 'dexterity' }],
        tags: ['universal', 'speed']
    },
    {
        name: "Scholarly Mind",
        category: 'general',
        description: "A thirst for knowledge that spans all disciplines.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'save', bonus: 2, abilityName: 'intelligence' }],
        tags: ['universal', 'knowledge']
    },
    {
        name: "Natural Leader",
        category: 'general',
        description: "Presence that commands respect and inspires confidence.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'save', bonus: 2, abilityName: 'charisma' }],
        tags: ['universal', 'social']
    },
    {
        name: "Observant",
        category: 'general',
        description: "You have a knack for reading people and situations.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'skill', bonus: 2, skillName: 'Insight' }, { type: 'skill', bonus: 2, skillName: 'Perception' }],
        tags: ['universal', 'exploration']
    },
    { 
        name: "Iron Grip", 
        category: 'general', 
        description: "You hold your ground against the fiercest tides.", 
        usage: { type: 'passive', maxUses: 0, currentUses: 0 }, 
        buffs: [{ type: 'save', bonus: 2, abilityName: 'strength' }], 
        tags: ['universal', 'combat'] 
    },
    { 
        name: "Quick Fingers", 
        category: 'general', 
        description: "Manual dexterity that defies the eye.", 
        usage: { type: 'passive', maxUses: 0, currentUses: 0 }, 
        buffs: [{ type: 'skill', bonus: 2, skillName: 'Sleight of Hand' }], 
        tags: ['universal', 'stealth'] 
    },
    {
        name: "Two-Weapon Style",
        category: 'general',
        description: "You are a master of the twin-blade. You gain 1 additional off-hand strike and no longer take a -2 penalty to attack rolls when dual-wielding.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        tags: ['universal', 'combat_style']
    },
    {
        name: "Great Weapon Style",
        category: 'general',
        description: "You wield massive weapons with terrifying efficiency. When using a two-handed weapon, your ability bonus to damage is doubled.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        tags: ['universal', 'combat_style']
    },
    {
        name: "Dueling Style",
        category: 'general',
        description: "You excel with a single blade. When wielding a melee weapon in one hand and no shield or off-hand weapon, you gain +2 damage and +1 AC.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        tags: ['universal', 'combat_style']
    },
    {
        name: "Unarmed Style",
        category: 'general',
        description: "Your base unarmed damage increases to 1d6 and you use the higher of your Strength or Dexterity for attack and damage rolls.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        tags: ['universal', 'combat']
    },
    {
        name: "Flurry of Blows",
        category: 'general',
        requires: ['Unarmed Style'],
        description: "Strikes with a rapid blur of movement. You gain 1 additional strike per round while your hands are free.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        tags: ['universal', 'martial', 'passive']
    },
    {
        name: "Sneak Attack",
        category: 'general',
        description: "You strike with lethal precision when your foe is distracted. Deal an extra 1d6 damage per 2 character levels on your first successful hit each turn, provided you have advantage on the attack roll.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        tags: ['universal', 'combat']
    },
    {
        name: "Heroic Soul",
        category: 'general',
        description: "Your spirit burns brighter than others. Your maximum Heroic Point capacity is increased by 1.",
        usage: { type: 'passive', maxUses: 0, currentUses: 0 },
        buffs: [{ type: 'hero_points', bonus: 1 }],
        tags: ['universal', 'heroic']
    }
];
// utils/mechanics.ts

import { CombatActor, AbilityScoreName, Item, PlayerCharacter, Companion, Inventory, EnemyTemplate, CombatActorSize, StatusEffect, ABILITY_SCORES, AffinityDefinition, DiceRoll, calculateModifier, formatModifier, getStatPenalties, ActorSuggestion, DAMAGE_TYPES, SKILL_NAMES, BASE_SIZE_MODIFIERS, ArchetypeName, ARCHETYPE_NAMES, CombatActorAttack, CombatActorSpecialAbility, SkillName, SKILL_DEFINITIONS, AbilityEffect } from '../types';
import { parseDiceString } from './combatUtils';

// Re-export Encounter Logic from its new home
export * from './EncounterMechanics';

// XP Table (D&D 5e style simplified)
const XP_TABLE = [
    0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

export const getXPForLevel = (level: number): number => {
    if (level <= 1) return 0;
    if (level > 20) return XP_TABLE[19];
    return XP_TABLE[level - 1];
};

export const getNextLevelXP = (level: number): number => {
    if (level >= 20) return 0;
    return XP_TABLE[level];
};

export const getHalfwayXP = (level: number): number => {
    const currentBase = getXPForLevel(level);
    const nextBase = getNextLevelXP(level);
    if (nextBase === 0) return currentBase; 
    return Math.floor(currentBase + (nextBase - currentBase) / 2);
};

export const getLevelFromXP = (xp: number): number => {
    for (let i = 19; i >= 0; i--) {
        if (xp >= XP_TABLE[i]) return i + 1;
    }
    return 1;
};

export const getEnemyXP = (cr: number): number => {
    if (cr < 1) return 10;
    if (cr === 1) return 200;
    if (cr === 2) return 450;
    if (cr === 3) return 700;
    if (cr === 4) return 1100;
    if (cr === 5) return 1800;
    return cr * 500; 
};

/**
 * Calculates the total number of Trait Points earned through leveling.
 * Characters gain 1 point every 3 levels.
 */
export const calculateTotalTraitPoints = (level: number): number => {
    return Math.floor(level / 3);
};

/**
 * Calculates the base number of Heroic Points for a given level.
 * Formula: 1 point at level 1, +1 per 5 levels (e.g. 2 at lvl 6, 3 at lvl 11).
 * Matches: Math.floor((level - 1) / 5) + 1
 */
export const calculateBaseHeroicPoints = (level: number): number => {
    return Math.floor((level - 1) / 5) + 1;
};

export type DifficultyPreset = 'Weak' | 'Normal' | 'Elite' | 'Boss';

export const DEFAULT_SIZE_MODIFIERS = BASE_SIZE_MODIFIERS;

export const DEFAULT_TEMPLATES: Record<string, EnemyTemplate> = {
    'Agile': {
        name: 'Agile',
        attackType: 'Melee',
        mods: [0, 4, 0, 0, 2, 0],
        saves: ['dexterity', 'wisdom'],
        proficientSkills: ['Acrobatics', 'Stealth'],
        abilities: [{ target: 'Single', type: 'Damage' }],
        defaultArchetype: 'Bipedal'
    },
    'Brute': {
        name: 'Brute',
        attackType: 'Melee',
        mods: [4, 0, 4, -2, -2, -2],
        saves: ['strength', 'constitution'],
        proficientSkills: ['Athletics', 'Intimidation'],
        abilities: [{ target: 'Single', type: 'Damage' }],
        defaultArchetype: 'Bipedal'
    },
    'Tank': {
        name: 'Tank',
        attackType: 'Melee',
        mods: [2, -2, 6, -2, 0, -2],
        saves: ['constitution', 'strength'],
        proficientSkills: ['Athletics'],
        abilities: [{ target: 'Single', type: 'Status', status: 'Prone', save: 'strength' }],
        defaultArchetype: 'Bipedal'
    },
    'Brawler': {
        name: 'Brawler',
        attackType: 'Melee',
        mods: [3, 2, 3, -1, 0, 0],
        saves: ['strength', 'dexterity'],
        proficientSkills: ['Acrobatics', 'Athletics'],
        abilities: [{ target: 'Single', type: 'Damage' }],
        defaultArchetype: 'Bipedal'
    },
    'Sniper': {
        name: 'Sniper',
        attackType: 'Ranged',
        mods: [0, 6, 0, 2, 2, 0],
        saves: ['dexterity', 'intelligence'],
        proficientSkills: ['Stealth', 'Perception'],
        abilities: [{ target: 'Single', type: 'Damage' }],
        defaultArchetype: 'Bipedal'
    },
    'Grenadier': {
        name: 'Grenadier',
        attackType: 'Ranged',
        mods: [0, 2, 2, 4, 0, 0],
        saves: ['dexterity', 'intelligence'],
        proficientSkills: ['Investigation'],
        abilities: [{ target: 'Multiple', type: 'Damage', save: 'dexterity', saveEffect: 'half' }],
        defaultArchetype: 'Bipedal'
    },
    'Caster': {
        name: 'Caster',
        attackType: 'Magic',
        mods: [-2, 0, 0, 6, 2, 2],
        saves: ['intelligence', 'wisdom'],
        proficientSkills: ['Arcana', 'History'],
        abilities: [{ target: 'Multiple', type: 'Damage', save: 'dexterity', saveEffect: 'half' }],
        defaultArchetype: 'Bipedal'
    },
    'Healer': {
        name: 'Healer',
        attackType: 'Magic',
        mods: [-2, 0, 2, 0, 6, 2],
        saves: ['wisdom', 'charisma'],
        proficientSkills: ['Medicine', 'Insight'],
        abilities: [{ target: 'Single', type: 'Heal' }],
        defaultArchetype: 'Bipedal'
    },
    'Controller': {
        name: 'Controller',
        attackType: 'Magic',
        mods: [-2, 0, 2, 2, 4, 4],
        saves: ['charisma', 'wisdom'],
        proficientSkills: ['Persuasion', 'Deception'],
        abilities: [{ target: 'Multiple', type: 'Status', status: 'Stunned', save: 'wisdom' }],
        defaultArchetype: 'Bipedal'
    },
    'Skirmisher': {
        name: 'Skirmisher',
        attackType: 'Melee',
        mods: [2, 4, 2, 0, 0, 0],
        saves: ['dexterity', 'strength'],
        proficientSkills: ['Stealth', 'Survival'],
        abilities: [{ target: 'Single', type: 'Damage' }],
        defaultArchetype: 'Bestial'
    },
    'Custom': {
        name: 'Custom',
        attackType: 'Melee',
        mods: [0, 0, 0, 0, 0, 0],
        saves: [],
        proficientSkills: [],
        abilities: [],
        defaultArchetype: 'Bipedal'
    }
};

export const DEFAULT_AFFINITIES: Record<string, AffinityDefinition> = {
    'Thermal': {
        name: 'Thermal',
        description: 'Infused with extreme heat or volcanic energy.',
        immunities: ['Fire'],
        resistances: [],
        vulnerabilities: ['Cold']
    },
    'Cryo': {
        name: 'Cryo',
        description: 'Formed of eternal ice or liquid nitrogen.',
        immunities: ['Cold'],
        resistances: [],
        vulnerabilities: ['Fire']
    },
    'Voltaic': {
        name: 'Voltaic',
        description: 'Crackling with electrical discharge.',
        immunities: ['Electric'],
        resistances: [],
        vulnerabilities: ['Acid']
    },
    'Reinforced': {
        name: 'Reinforced',
        description: 'Armored or constructed of dense alloys.',
        immunities: [],
        resistances: ['Slashing', 'Piercing', 'Bludgeoning'],
        vulnerabilities: ['Electric']
    },
    'Phased': {
        name: 'Phased',
        description: 'Partially ethereal or out of sync with reality.',
        immunities: [],
        resistances: ['Force', 'Psychic'],
        vulnerabilities: ['Radiant']
    },
    'Caustic': {
        name: 'Caustic',
        description: 'Dripping with corrosive fluids.',
        immunities: ['Acid'],
        resistances: [],
        vulnerabilities: ['Fire']
    },
    'Luminous': {
        name: 'Luminous',
        description: 'Radiating intense, blinding light.',
        immunities: ['Radiant'],
        resistances: [],
        vulnerabilities: ['Necrotic']
    },
    'Entropic': {
        name: 'Entropic',
        description: 'Shadowy, decaying, or nihilistic energy.',
        immunities: ['Necrotic'],
        resistances: [],
        vulnerabilities: ['Radiant']
    },
    'Neural': {
        name: 'Neural',
        description: 'Emits disruptive brainwaves.',
        immunities: ['Psychic'],
        resistances: [],
        vulnerabilities: ['Force']
    },
    'Kinetic': {
        name: 'Kinetic',
        description: 'Fast moving and hyper-reactive.',
        immunities: [],
        resistances: ['Thunder'],
        vulnerabilities: ['Force']
    }
};

export const getDifficultyParams = (tag: DifficultyPreset | string, playerLevel: number): { cr: number, rank: 'normal' | 'elite' | 'boss' } => {
    const normalized = tag.toLowerCase().trim();
    if (normalized === 'weak') {
        return { cr: Math.max(1, Math.floor(playerLevel / 2)), rank: 'normal' };
    }
    if (normalized === 'elite') {
        return { cr: Math.max(1, playerLevel + 2), rank: 'elite' };
    }
    if (normalized === 'boss' || normalized === 'tough') {
        return { cr: Math.max(1, playerLevel + 4), rank: 'boss' };
    }
    // Default to 'Normal'
    return { cr: Math.max(1, playerLevel), rank: 'normal' };
};

// Legacy support for CR only calculation
export const calculateCrFromTag = (tag: string, playerLevel: number): number => {
    return getDifficultyParams(tag, playerLevel).cr;
};

export const getSkillCheckXP = (dc: number): number => {
    return dc * 5; 
};

export const getDiscoveryXP = (level: number): number => {
    return level * 50;
};

export const getObjectiveCompleteXP = (level: number): number => {
    return level * 200;
};

export const getHitDie = (profession: string): number => {
    const p = profession.toLowerCase();
    if (p.includes('barbarian')) return 12;
    if (p.includes('fighter') || p.includes('paladin') || p.includes('ranger')) return 10;
    if (p.includes('wizard') || p.includes('sorcerer')) return 6;
    return 8; 
};

export const calculateCharacterMaxHp = (level: number, conScore: number): number => {
    const conMod = calculateModifier(conScore);
    const hpPerLevel = Math.max(1, 10 + conMod);
    return hpPerLevel * level;
};

export const DEFAULT_ARCHETYPE_DEFINITIONS: Record<ArchetypeName, { ground: number, climb: number, swim: number, fly: number }> = {
    'Bipedal': { ground: 30, climb: 0, swim: 0, fly: 0 },
    'Bestial': { ground: 50, climb: 0, swim: 0, fly: 0 },
    'Aerial': { ground: 10, climb: 0, swim: 60, fly: 60 },
    'Marine': { ground: 0, climb: 0, swim: 40, fly: 0 },
    'Amphibian': { ground: 30, climb: 0, swim: 30, fly: 0 },
    'Crawler': { ground: 30, climb: 30, swim: 0, fly: 0 },
    'Hoverer': { ground: 0, climb: 0, swim: 0, fly: 30 },
    'Sentry': { ground: 0, climb: 0, swim: 0, fly: 0 },
};

export const createDefaultCombatActor = (): CombatActor => {
    const defaultAbilities = ABILITY_SCORES.reduce((acc, score) => {
        acc[score] = { score: 10 };
        return acc;
    }, {} as Record<AbilityScoreName, { score: number }>);

    const defaultSaves = ABILITY_SCORES.reduce((acc, score) => {
        acc[score] = { proficient: false };
        return acc;
    }, {} as Record<AbilityScoreName, { proficient: boolean }>);

    const defaultSkills = SKILL_NAMES.reduce((acc, skill) => {
        acc[skill] = { proficient: false, passiveScore: 10 };
        return acc;
    }, {} as Record<SkillName, { proficient: boolean; passiveScore: number }>);

    return {
        id: `enemy-${Date.now()}`,
        name: 'Unnamed Entity',
        description: 'Analyzing entity...',
        maxHitPoints: 10,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maxTemporaryHitPoints: 0,
        armorClass: 10,
        numberOfAttacks: 1,
        challengeRating: 0,
        abilityScores: defaultAbilities,
        savingThrows: defaultSaves,
        skills: defaultSkills,
        attacks: [],
        specialAbilities: [],
        statusEffects: [],
        rank: 'normal',
        size: 'Medium',
        isAlly: false,
        isShip: false,
        alignment: 'neutral', 
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        archetype: 'Bipedal',
        speed: 30,
        climbSpeed: 0,
        swimSpeed: 0,
        flySpeed: 0
    };
};

/**
 * Maps CR to the appropriate Damage Die string.
 */
const getDamageDiceForCR = (cr: number): string => {
    if (cr < 5) return '1d6';
    if (cr < 9) return '2d6';
    if (cr < 13) return '3d6';
    if (cr < 17) return '4d6';
    return '5d6';
};

/**
 * Re-calculates actor stats based on CR and Ability Scores.
 */
export const recalculateCombatActorStats = (actor: CombatActor, templates: Record<string, EnemyTemplate> = DEFAULT_TEMPLATES, baseScore: number = 8): CombatActor => {
    const updatedActor: CombatActor = { ...actor };
    const cr = updatedActor.challengeRating || 1;
    const sizeMod = BASE_SIZE_MODIFIERS[updatedActor.size || 'Medium'] || BASE_SIZE_MODIFIERS['Medium'];
    
    const profBonus = Math.floor(cr / 5) + 2;

    // 1. Sync Ability Scores from Template if available
    const templateName = updatedActor.template || '';
    const activeTemplates = templates || DEFAULT_TEMPLATES;
    const template = activeTemplates[templateName] || Object.values(activeTemplates).find(t => updatedActor.name.includes(t.name));
    const rankBonus = updatedActor.rank === 'boss' ? 4 : (updatedActor.rank === 'elite' ? 2 : 0);

    if (template && updatedActor.abilityScores) {
        ABILITY_SCORES.forEach((s, idx) => {
            if (updatedActor.abilityScores![s]) {
                // Formula: Total Score = [Base Score] + [Template Modifier] + [Rank Bonus]
                updatedActor.abilityScores![s].score = baseScore + (template.mods[idx] || 0) + rankBonus;
            }
        });
    }

    const scores = updatedActor.abilityScores;
    if (!scores) return updatedActor;

    const dexMod = calculateModifier(scores.dexterity?.score || 10);
    const rankACBonus = updatedActor.rank === 'boss' ? 2 : (updatedActor.rank === 'elite' ? 1 : 0);
    updatedActor.armorClass = Math.floor(10 + (cr / 2) + dexMod + sizeMod.ac + rankACBonus);

    const modifiers = ABILITY_SCORES.map(s => {
        const abilityScore = scores[s];
        return {
            name: s,
            score: abilityScore?.score || 10,
            mod: calculateModifier(abilityScore?.score || 10)
        };
    });
    
    const highest = [...modifiers].sort((a, b) => b.score - a.score)[0];
    const highestMod = highest.mod;

    const topTwo = [...modifiers].sort((a, b) => b.score - a.score).slice(0, 2);
    const newSaves = {} as Record<AbilityScoreName, { proficient: boolean }>;
    ABILITY_SCORES.forEach(s => {
        newSaves[s] = { proficient: topTwo.some(t => t.name === s) };
    });
    updatedActor.savingThrows = newSaves;

    const proficientSkills = template?.proficientSkills || [];

    const newSkills = {} as Record<SkillName, { proficient: boolean; passiveScore: number }>;
    SKILL_NAMES.forEach(skill => {
        const isProf = proficientSkills.includes(skill as SkillName);
        const skillDef = SKILL_DEFINITIONS[skill];
        const ability = skillDef.ability;
        const abilityScore = scores[ability]?.score || 10;
        const abilityMod = calculateModifier(abilityScore);
        const passiveScore = 10 + abilityMod + (isProf ? profBonus : 0);
        newSkills[skill as SkillName] = { proficient: isProf, passiveScore };
    });
    updatedActor.skills = newSkills;

    const conMod = calculateModifier(scores.constitution?.score || 10);
    let newMaxHp = Math.max(5, (12 + conMod) * cr);
    if (updatedActor.isShip) newMaxHp *= 2; 

    updatedActor.maxHitPoints = newMaxHp;
    if (actor.maxHitPoints === 0 || updatedActor.currentHitPoints === actor.maxHitPoints) {
        updatedActor.currentHitPoints = newMaxHp;
    } else {
        const ratio = (actor.currentHitPoints || 0) / (actor.maxHitPoints || 1);
        updatedActor.currentHitPoints = Math.round(newMaxHp * ratio);
    }

    let attacks = cr < 5 ? 1 : cr < 11 ? 2 : cr < 17 ? 3 : 4;
    if (updatedActor.isShip) attacks *= 2; 
    updatedActor.numberOfAttacks = attacks;

    let calcTempHP = 0;
    if (updatedActor.rank === 'elite') calcTempHP = cr * 3;
    else if (updatedActor.rank === 'boss') calcTempHP = cr * 10;
    if (updatedActor.isShip) calcTempHP *= 2; 

    updatedActor.maxTemporaryHitPoints = calcTempHP;
    if ((actor.maxTemporaryHitPoints || 0) === 0 || actor.temporaryHitPoints === actor.maxTemporaryHitPoints) {
        updatedActor.temporaryHitPoints = calcTempHP;
    } else {
        const ratio = (actor.temporaryHitPoints || 0) / (actor.maxTemporaryHitPoints || 1);
        updatedActor.temporaryHitPoints = Math.round(calcTempHP * ratio);
    }

    const baseDamageDice = getDamageDiceForCR(cr);
    if (updatedActor.attacks) {
        updatedActor.attacks = updatedActor.attacks.map(attack => {
            const attackBonus = profBonus + highestMod;
            const damageBonus = highestMod;
            const damageDice = `${baseDamageDice}${formatModifier(damageBonus)}`;
            return {
                ...attack,
                toHitBonus: attackBonus,
                damageDice,
                ability: highest.name as AbilityScoreName 
            };
        });
    }

    if (updatedActor.specialAbilities) {
        updatedActor.specialAbilities = updatedActor.specialAbilities.map(ability => {
            const newAbility = { ...ability };
            newAbility.dc = 8 + profBonus + highestMod;
            if (newAbility.type === 'Damage') {
                newAbility.damageDice = `${Math.ceil(cr/2)}d6`;
            }
            return newAbility;
        });
    }

    return updatedActor;
};

export const generateEnemyFromTemplate = (
    templateName: string,
    cr: number,
    rank: 'normal' | 'elite' | 'boss',
    size: CombatActorSize,
    nameOverride?: string,
    templates: Record<string, EnemyTemplate> = DEFAULT_TEMPLATES,
    sizeModifiers: Record<CombatActorSize, { str: number, dex: number, con: number, ac: number }> = DEFAULT_SIZE_MODIFIERS,
    baseScore: number = 8,
    archetypeOverride?: ArchetypeName | string,
    archetypeDefinitions: Record<ArchetypeName, { ground: number, climb: number, swim: number, fly: number }> = DEFAULT_ARCHETYPE_DEFINITIONS
): CombatActor => {
    const template = (templates && templates[templateName]) ? templates[templateName] : DEFAULT_TEMPLATES[templateName] || DEFAULT_TEMPLATES['Agile'];
    const archetypeKey = (archetypeOverride as ArchetypeName) || template.defaultArchetype || 'Bipedal';
    const speeds = archetypeDefinitions[archetypeKey] || DEFAULT_ARCHETYPE_DEFINITIONS['Bipedal'];

    const actor = createDefaultCombatActor();
    actor.name = nameOverride || template.name;
    actor.challengeRating = cr;
    actor.rank = rank;
    actor.size = size;
    actor.template = templateName;
    actor.archetype = archetypeKey;
    actor.speed = speeds.ground;
    actor.climbSpeed = speeds.climb;
    actor.swimSpeed = speeds.swim;
    actor.flySpeed = speeds.fly;

    const rankBonus = rank === 'boss' ? 4 : (rank === 'elite' ? 2 : 0);

    ABILITY_SCORES.forEach((s, idx) => {
        actor.abilityScores![s] = { 
            score: baseScore + (template.mods[idx] || 0) + rankBonus 
        };
        actor.savingThrows![s] = { 
            proficient: template.saves.includes(s) 
        };
    });

    actor.attacks = [{
        name: template.attackType + " Strike",
        toHitBonus: 0,
        damageDice: '1d6',
        damageType: 'Bludgeoning'
    }];

    if (template.abilities) {
        actor.specialAbilities = template.abilities.map((a, i) => ({
            name: `${template.name} Power ${i+1}`,
            description: `A ${a.type} ability.`,
            ...a,
            status: a.status as any
        }));
    }

    return recalculateCombatActorStats(actor, templates, baseScore);
};

export const generateSystemCombatants = (partySize: number): Partial<ActorSuggestion>[] => {
    const suggestions: Partial<ActorSuggestion>[] = [];
    const templateKeys = Object.keys(DEFAULT_TEMPLATES).filter(k => k !== 'Custom');
    const sizes: CombatActorSize[] = ['Small', 'Medium', 'Large', 'Huge'];
    
    let budget = partySize * 1.5;
    
    while (budget > 0) {
        const difficultyRoll = Math.random();
        let diff = 'Normal';
        let cost = 1.0;

        if (difficultyRoll > 0.9 && budget >= 2.0) {
            diff = 'Boss';
            cost = 2.0;
        } else if (difficultyRoll > 0.7 && budget >= 1.5) {
            diff = 'Elite';
            cost = 1.5;
        } else if (difficultyRoll > 0.3) {
            diff = 'Normal';
            cost = 1.0;
        } else {
            diff = 'Weak';
            cost = 0.5;
        }

        const template = templateKeys[Math.floor(Math.random() * templateKeys.length)];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        
        suggestions.push({
            template,
            difficulty: diff,
            size: size as CombatActorSize,
            isAlly: false,
            alignment: 'enemy'
        });

        budget -= cost;
    }

    return suggestions;
};
import { ROLE_STAT_DISTRIBUTIONS, ROLE_SAVE_PROFICIENCIES, AbilityScoreName, RoleName } from '../../types';
import { CharacterTemplate } from '../templateRegistry';

const getScores = (role: RoleName): Record<AbilityScoreName, { score: number }> => {
    const dist = ROLE_STAT_DISTRIBUTIONS[role];
    const scores = {} as Record<AbilityScoreName, { score: number }>;
    (Object.keys(dist) as AbilityScoreName[]).forEach(key => {
        scores[key] = { score: dist[key] };
    });
    return scores;
};

const getSaves = (role: RoleName): AbilityScoreName[] => {
    return ROLE_SAVE_PROFICIENCIES[role];
};


export const FANTASY_TEMPLATES: CharacterTemplate[] = [
    {
        id: 'fan-vanguard',
        name: 'Vanguard',
        role: 'Tank',
        backgroundTraitNames: ['Soldier', 'Noble'],
        generalTraitNames: ['Hardy', 'Iron Skin'],
        combatTraitName: 'Multi Target Status',
        description: 'A resilient front-line defender who excels at controlling the battlefield and protecting allies.',
        isShip: false,
        abilityScores: getScores('Tank'),
        savingThrows: getSaves('Tank')
    },

    {
        id: 'fan-shadowblade',
        name: 'Shadowblade',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Urchin', 'Criminal'],
        generalTraitNames: ['Quick Reflexes', 'Quick Fingers'],
        combatTraitName: 'Single Target Damage',
        description: 'A lethal strike-from-shadows expert who relies on agility and precision to dispatch foes.',
        isShip: false,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },

    {
        id: 'fan-archmage',
        name: 'Archmage',
        role: 'DPS_Int',
        backgroundTraitNames: ['Sage', 'Acolyte'],
        generalTraitNames: ['Scholarly Mind', 'Arcane Initiate'],
        combatTraitName: 'Multi Target Damage',
        description: 'A master of the arcane arts, capable of unleashing devastating area-of-effect spells.',
        isShip: false,
        abilityScores: getScores('DPS_Int'),
        savingThrows: getSaves('DPS_Int')
    },


    {
        id: 'fan-high-priest',
        name: 'High Priest',
        role: 'Healer',
        backgroundTraitNames: ['Acolyte', 'Hermit'],
        generalTraitNames: ['Natural Leader', 'Hardy'],
        combatTraitName: 'Multi Target Healing',
        description: 'A beacon of divine light who keeps the party standing through powerful restorative prayers.',
        isShip: false,
        abilityScores: getScores('Healer'),
        savingThrows: getSaves('Healer')
    },

    {
        id: 'fan-slayer',
        name: 'Slayer',
        role: 'DPS_Str',
        backgroundTraitNames: ['Soldier', 'Outlander'],
        generalTraitNames: ['Iron Grip', 'Athlete'],
        combatTraitName: 'Single Target Damage',
        description: 'A brutal powerhouse focused on overpowering individual enemies with sheer strength.',
        isShip: false,
        abilityScores: getScores('DPS_Str'),
        savingThrows: getSaves('DPS_Str')
    },

    {
        id: 'fan-pathfinder',
        name: 'Pathfinder',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Outlander', 'Sailor'],
        generalTraitNames: ['Keen Senses', 'Hunter\'s Instinct'],
        combatTraitName: 'Single Target Damage',
        description: 'A long-range specialist who picks off threats with deadly accuracy before they get close.',
        isShip: false,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },


    {
        id: 'fan-skald',
        name: 'Skald',
        role: 'Support',
        backgroundTraitNames: ['Entertainer', 'Folk Hero'],
        generalTraitNames: ['Silver Tongue', 'Natural Leader'],
        combatTraitName: 'Single Target Healing',
        description: 'A charismatic warrior-poet who inspires the party and mends wounds with song.',
        isShip: false,
        abilityScores: getScores('Support'),
        savingThrows: getSaves('Support')
    },

    {
        id: 'fan-witch-doctor',
        name: 'Witch Doctor',
        role: 'Utility',
        backgroundTraitNames: ['Sage', 'Hermit'],
        generalTraitNames: ['Observant', 'Wild Heart'],
        combatTraitName: 'Single Target Status',
        description: 'An unconventional practitioner who uses debilitating curses to weaken and stun enemies.',
        isShip: false,
        abilityScores: getScores('Utility'),
        savingThrows: getSaves('Utility')
    },

    {
        id: 'fan-paladin',
        name: 'Paladin',
        role: 'Balanced_Cha',
        backgroundTraitNames: ['Noble', 'Soldier'],
        generalTraitNames: ['Indomitable Will', 'Iron Skin'],
        combatTraitName: 'Single Target Healing',
        description: 'A noble protector combining solid defense with the ability to heal themselves and others.',
        isShip: false,
        abilityScores: getScores('Balanced_Cha'),
        savingThrows: getSaves('Balanced_Cha')
    },


    {
        id: 'fan-warden',
        name: 'Warden',
        role: 'Utility',
        backgroundTraitNames: ['Outlander', 'Hermit'],
        generalTraitNames: ['Wild Heart', 'Hardy'],
        combatTraitName: 'Multi Target Status',
        description: 'A defender of nature who calls upon environmental hazards to disrupt groups of foes.',
        isShip: false,
        abilityScores: getScores('Utility'),
        savingThrows: getSaves('Utility')
    },

    // Fantasy Ship Templates
    {
        id: 'ship-fan-dreadnought',
        name: 'War Galley',
        role: 'Tank',
        backgroundTraitNames: ['Reinforced Oak Hull', 'Deep-Sea Ballast'],
        generalTraitNames: ['Broadside Cannons'],
        combatTraitName: 'Multi Target Status',
        description: 'A massive, heavily armored galley designed to take a beating and crush through blockades.',
        isShip: true,
        abilityScores: getScores('Tank'),
        savingThrows: getSaves('Tank')
    },

    {
        id: 'ship-fan-cutter',
        name: 'Elven Cutter',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Balanced Elven Rudder'],
        generalTraitNames: ['Full-Bellied Sails', 'Broadside Cannons'],
        combatTraitName: 'Single Target Damage',
        description: 'A sleek, magically responsive vessel that dances through waves to deliver precise broadsides.',
        isShip: true,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },


    {
        id: 'ship-fan-raider',
        name: 'Ghost Ship',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Mithril-Leaf Plating'],
        generalTraitNames: ['Shrouding Silk Sails', 'Navigator\'s Astrolabe'],
        combatTraitName: 'Single Target Status',
        description: 'A light, elusive raider that utilizes alchemical shadows to vanish from sight.',
        isShip: true,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },


    {
        id: 'ship-fan-cathedral',
        name: 'Floating Cathedral',
        role: 'Support',
        backgroundTraitNames: ['Sacred Amulet Mast', 'Figurehead of Valor'],
        generalTraitNames: ['Siren-Call Broadcast'],
        combatTraitName: 'Multi Target Healing',
        description: 'A consecrated sanctuary on the water, inspiring allies and healing the crew via divine pipes.',
        isShip: true,
        abilityScores: getScores('Support'),
        savingThrows: getSaves('Support')
    },

    {
        id: 'ship-fan-merchant',
        name: 'Explorer Cog',
        role: 'Balanced_Str',
        backgroundTraitNames: ['Ancient Archive Library', 'Iron-Anchor Prow'],
        generalTraitNames: ['Cartographer\'s Table'],
        combatTraitName: 'Single Target Healing',
        description: 'A sturdy, well-equipped vessel built for long-haul discoveries and deep-sea survival.',
        isShip: true,
        abilityScores: getScores('Balanced_Str'),
        savingThrows: getSaves('Balanced_Str')
    }


];
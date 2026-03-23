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


export const MODERN_TEMPLATES: CharacterTemplate[] = [
    {
        id: 'mod-swat',
        name: 'SWAT Breacher',
        role: 'Tank',
        backgroundTraitNames: ['Military Vet', 'First Responder'],
        generalTraitNames: ['Iron Skin', 'Iron Grip'],
        combatTraitName: 'Multi Target Status',
        description: 'A tactical expert trained to take the lead and neutralize threats with non-lethal force.',
        isShip: false,
        abilityScores: getScores('Tank'),
        savingThrows: getSaves('Tank')
    },


    {
        id: 'mod-infiltrator',
        name: 'Infiltrator',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Ex-Con', 'Mechanic'],
        generalTraitNames: ['Quick Fingers', 'Quick Reflexes'],
        combatTraitName: 'Single Target Damage',
        description: 'A ghost in the concrete jungle, specialized in covert entry and precise eliminations.',
        isShip: false,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },



    {
        id: 'mod-tech',
        name: 'Tech Specialist',
        role: 'Specialist',
        backgroundTraitNames: ['Hacker', 'Mechanic'],
        generalTraitNames: ['Scholarly Mind', 'Observant'],
        combatTraitName: 'Single Target Status',
        description: 'Uses advanced gadgets and digital mastery to disrupt enemy systems and communications.',
        isShip: false,
        abilityScores: getScores('Specialist'),
        savingThrows: getSaves('Specialist')
    },



    {
        id: 'mod-surgeon',
        name: 'Field Surgeon',
        role: 'Healer',
        backgroundTraitNames: ['First Responder', 'Scientist'],
        generalTraitNames: ['Hardy', 'Indomitable Will'],
        combatTraitName: 'Single Target Healing',
        description: 'A trauma expert who keeps the team alive under fire with clinical efficiency.',
        isShip: false,
        abilityScores: getScores('Healer'),
        savingThrows: getSaves('Healer')
    },


    {
        id: 'mod-muscle',
        name: 'Heavy Muscle',
        role: 'DPS_Str',
        backgroundTraitNames: ['Military Vet', 'Blue Collar'],
        generalTraitNames: ['Iron Grip', 'Athlete'],
        combatTraitName: 'Single Target Damage',
        description: 'Sheer physical power used to intimidate foes and dominate close-quarters brawls.',
        isShip: false,
        abilityScores: getScores('DPS_Str'),
        savingThrows: getSaves('DPS_Str')
    },



    {
        id: 'mod-marksman',
        name: 'Marksman',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Military Vet', 'Private Eye'],
        generalTraitNames: ['Keen Senses', 'Quick Reflexes'],
        combatTraitName: 'Single Target Damage',
        description: 'A professional sniper who provides overwatch and takes down high-value targets.',
        isShip: false,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },



    {
        id: 'mod-fixer',
        name: 'Fixer',
        role: 'Social',
        backgroundTraitNames: ['Politician', 'Salesperson'],
        generalTraitNames: ['Silver Tongue', 'Natural Leader'],
        combatTraitName: 'Single Target Healing',
        description: 'The social glue of the team; solves problems with a phone call or a handshake.',
        isShip: false,
        abilityScores: getScores('Social'),
        savingThrows: getSaves('Social')
    },


    {
        id: 'mod-consultant',
        name: 'Consultant',
        role: 'Specialist',
        backgroundTraitNames: ['Academic', 'Journalist'],
        generalTraitNames: ['Scholarly Mind', 'Observant'],
        combatTraitName: 'Multi Target Status',
        description: 'A subject matter expert who uses analysis to identify and exploit enemy weaknesses.',
        isShip: false,
        abilityScores: getScores('Specialist'),
        savingThrows: getSaves('Specialist')
    },


    {
        id: 'mod-stunt',
        name: 'Stunt Driver',
        role: 'Utility',
        backgroundTraitNames: ['Gig Worker', 'Mechanic'],
        generalTraitNames: ['Quick Reflexes', 'Athlete'],
        combatTraitName: 'Multi Target Damage',
        description: 'High-speed specialist who turns vehicles and mechanical assets into offensive tools.',
        isShip: false,
        abilityScores: getScores('Utility'),
        savingThrows: getSaves('Utility')
    },


    {
        id: 'mod-bodyguard',
        name: 'Bodyguard',
        role: 'Balanced_Str',
        backgroundTraitNames: ['Military Vet', 'First Responder'],
        generalTraitNames: ['Observant', 'Iron Skin'],
        combatTraitName: 'Single Target Status',
        description: 'A protective specialist dedicated to keeping a specific asset safe at any cost.',
        isShip: false,
        abilityScores: getScores('Balanced_Str'),
        savingThrows: getSaves('Balanced_Str')
    },



    // Modern Mobile Base Templates
    {
        id: 'ship-mod-tactical',
        name: 'SWAT Command Van',
        role: 'Tank',
        backgroundTraitNames: ['Hardened Steel Chassis', 'Roll-Cage Support'],
        generalTraitNames: ['Tactical Hardpoints', 'Faraday-Cage Lining'],
        combatTraitName: 'Multi Target Status',
        description: 'A ballistic-reinforced mobile fortress equipped with tactical sensors and countermeasures.',
        isShip: true,
        abilityScores: getScores('Tank'),
        savingThrows: getSaves('Tank')
    },


    {
        id: 'ship-mod-news',
        name: 'SNN Broadcast Truck',
        role: 'Specialist',
        backgroundTraitNames: ['Advanced Dash Array', 'Shock-Absorber Frame'],
        generalTraitNames: ['Wide-Angle Dash Cam', 'Public Address System'],
        combatTraitName: 'Single Target Status',
        description: 'A specialized surveillance unit used for data gathering, long-range broadcasting, and crowd control.',
        isShip: true,
        abilityScores: getScores('Specialist'),
        savingThrows: getSaves('Specialist')
    },


    {
        id: 'ship-mod-clinic',
        name: 'Response Unit',
        role: 'Healer',
        backgroundTraitNames: ['Luxury Interior Quarters', 'Kevlar-Mesh Lining'],
        generalTraitNames: ['Integrated Tool-Chest'],
        combatTraitName: 'Multi Target Healing',
        description: 'A rapid-response field clinic designed for emergency medical triage in hostile urban zones.',
        isShip: true,
        abilityScores: getScores('Healer'),
        savingThrows: getSaves('Healer')
    },


    {
        id: 'ship-mod-semi',
        name: 'Hauler Juggernaut',
        role: 'DPS_Str',
        backgroundTraitNames: ['Industrial V8 Engine', 'Turbo-Charged Intake'],
        generalTraitNames: ['Nitrous Injection System', 'Tactical Hardpoints'],
        combatTraitName: 'Single Target Damage',
        description: 'A massive semi-truck modified for raw force, kinetic impact, and high-speed cargo delivery.',
        isShip: true,
        abilityScores: getScores('DPS_Str'),
        savingThrows: getSaves('DPS_Str')
    },



    {
        id: 'ship-mod-luxury',
        name: 'Mobile Safehouse',
        role: 'Social',
        backgroundTraitNames: ['Luxury Interior Quarters', 'Firewalled Cab'],
        generalTraitNames: ['Matte-Black Finish', 'Precision Gps Unit'],
        combatTraitName: 'Single Target Healing',
        description: 'A discreet, high-comfort RV designed for diplomatic transit and undercover operations.',
        isShip: true,
        abilityScores: getScores('Social'),
        savingThrows: getSaves('Social')
    }


];
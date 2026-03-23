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


export const MAGITECH_TEMPLATES: CharacterTemplate[] = [
    {
        id: 'mag-knight',
        name: 'Magitek Knight',
        role: 'Tank',
        backgroundTraitNames: ['Elite Soldier', 'Magitek Pilot'],
        generalTraitNames: ['Iron Skin', 'Hardy'],
        combatTraitName: 'Single Target Status',
        description: 'Heavy armor and aether-infused weapons allow this warrior to stand as an unbreakable wall.',
        isShip: false,
        abilityScores: getScores('Tank'),
        savingThrows: getSaves('Tank')
    },


    {
        id: 'mag-dragoon',
        name: 'High-Wind Dragoon',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Sky-Pirate', 'Beast Arena Tamer'],
        generalTraitNames: ['Athlete', 'Quick Reflexes'],
        combatTraitName: 'Single Target Damage',
        description: 'Masters of vertical combat and high-speed strikes using gravity-defying gear.',
        isShip: false,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },



    {
        id: 'mag-materia',
        name: 'Materia Specialist',
        role: 'DPS_Int',
        backgroundTraitNames: ['Materia Scholar', 'Crystalline Jeweler'],
        generalTraitNames: ['Scholarly Mind', 'Arcane Initiate'],
        combatTraitName: 'Multi Target Damage',
        description: 'Harnesses the condensed power of Materia orbs to unleash widespread magical destruction.',
        isShip: false,
        abilityScores: getScores('DPS_Int'),
        savingThrows: getSaves('DPS_Int')
    },



    {
        id: 'mag-white',
        name: 'Aether-Medic',
        role: 'Healer',
        backgroundTraitNames: ['Guardian of the Fane', 'Ex-Experimental Subject'],
        generalTraitNames: ['Devout Faith', 'Hardy'],
        combatTraitName: 'Multi Target Healing',
        description: 'Uses ancient knowledge and modern conduits to restore the life force of their allies.',
        isShip: false,
        abilityScores: getScores('Healer'),
        savingThrows: getSaves('Healer')
    },


    {
        id: 'mag-black',
        name: 'Pulse-Caster',
        role: 'DPS_Int',
        backgroundTraitNames: ['Mana-Reactor Technician', 'Resistance Operative'],
        generalTraitNames: ['Arcane Initiate', 'Quick Reflexes'],
        combatTraitName: 'Multi Target Damage',
        description: 'Specializes in high-output energy bursts designed to overload enemy defenses.',
        isShip: false,
        abilityScores: getScores('DPS_Int'),
        savingThrows: getSaves('DPS_Int')
    },



    {
        id: 'mag-operative',
        name: 'Deep-Plate Infiltrator',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Corporate Assassin', 'Aether-Thief'],
        generalTraitNames: ['Quick Fingers', 'Stealth'],
        combatTraitName: 'Single Target Damage',
        description: 'A shadow in the high-tech city, specialized in precise sabotage and elimination.',
        isShip: false,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },



    {
        id: 'mag-envoy',
        name: 'Corporate Envoy',
        role: 'Social',
        backgroundTraitNames: ['High-City Envoy', 'Public Servant'],
        generalTraitNames: ['Silver Tongue', 'Natural Leader'],
        combatTraitName: 'Single Target Healing',
        description: 'Navigates the boardrooms and battlefields with equal charm and diplomatic precision.',
        isShip: false,
        abilityScores: getScores('Social'),
        savingThrows: getSaves('Social')
    },


    {
        id: 'mag-surveyor',
        name: 'Ley-Line Surveyor',
        role: 'Specialist',
        backgroundTraitNames: ['Ley-Line Surveyor', 'Materia Scholar'],
        generalTraitNames: ['Aether Sense', 'Observant'],
        combatTraitName: 'Single Target Status',
        description: 'Analyzes the planet\'s energy to identify and exploit environmental weaknesses.',
        isShip: false,
        abilityScores: getScores('Specialist'),
        savingThrows: getSaves('Specialist')
    },


    {
        id: 'mag-pilot',
        name: 'Ace Void-Runner',
        role: 'Utility',
        backgroundTraitNames: ['Void-Runner', 'Mana-Cell Courier'],
        generalTraitNames: ['Quick Reflexes', 'Athlete'],
        combatTraitName: 'Multi Target Status',
        description: 'Unrivaled at the helm of any aetheric vehicle, turning mobility into a weapon.',
        isShip: false,
        abilityScores: getScores('Utility'),
        savingThrows: getSaves('Utility')
    },


    {
        id: 'mag-relic',
        name: 'Ancient Chronicler',
        role: 'Balanced_Str',
        backgroundTraitNames: ['Relic Hunter', 'Ancient Bloodline'],
        generalTraitNames: ['Scholarly Mind', 'Indomitable Will'],
        combatTraitName: 'Single Target Healing',
        description: 'Combines modern tech with pre-calamity relics to provide a versatile support role.',
        isShip: false,
        abilityScores: getScores('Balanced_Str'),
        savingThrows: getSaves('Balanced_Str')
    },




    // --- MAGITECH VESSELS (5) ---
    {
        id: 'ship-mag-warship',
        name: 'Aetheric War-Cruiser',
        role: 'Tank',
        backgroundTraitNames: ['Aether-Shielded Hull', 'Heavy Displacement Plating'],
        generalTraitNames: ['Homing Mana-Batteries', 'Voltage Dampeners'],
        combatTraitName: 'Multi Target Status',
        description: 'A heavy capital ship with multi-layered energy shields and crushing kinetic batteries.',
        isShip: true,
        abilityScores: getScores('Tank'),
        savingThrows: getSaves('Tank')
    },


    {
        id: 'ship-mag-pirate',
        name: 'High-Wind Raider',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Gravity-Lift Stabilizers', 'Crystalline Keel'],
        generalTraitNames: ['Photon Thrusters', 'Homing Mana-Batteries'],
        combatTraitName: 'Single Target Damage',
        description: 'A sleek interceptor designed for sky-piracy, emphasizing speed and surgical strikes.',
        isShip: true,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },



    {
        id: 'ship-mag-lab',
        name: 'Mobile Research Nexus',
        role: 'Specialist',
        backgroundTraitNames: ['Tactical Data-Nexus', 'Aether-Resonance Grid'],
        generalTraitNames: ['Mana-Scan Lenses', 'Diagnostic Scrying-Pool'],
        combatTraitName: 'Single Target Status',
        description: 'A floating computational hub equipped for deep-mana analysis and invisible threat detection.',
        isShip: true,
        abilityScores: getScores('Specialist'),
        savingThrows: getSaves('Specialist')
    },


    {
        id: 'ship-mag-救急',
        name: 'Crystalline Mercy',
        role: 'Healer',
        backgroundTraitNames: ['Bio-Organic Core', 'Officer\'s Sky-Lounge'],
        generalTraitNames: ['Artificer\'s Workshop'],
        combatTraitName: 'Multi Target Healing',
        description: 'A semi-living humanitarian frigate that uses high-resonance fields to mend allies and hull.',
        isShip: true,
        abilityScores: getScores('Healer'),
        savingThrows: getSaves('Healer')
    },


    {
        id: 'ship-mag-galleon',
        name: 'Grand Aether-Galleon',
        role: 'Balanced_Cha',
        backgroundTraitNames: ['Aether-Shielded Hull', 'Officer\'s Sky-Lounge'],
        generalTraitNames: ['Slipstream Sails', 'Amplified Rune-Voice'],
        combatTraitName: 'Multi Target Damage',
        description: 'A majestic vessel of state that combines overwhelming fire-power with unmatched diplomatic presence.',
        isShip: true,
        abilityScores: getScores('Balanced_Cha'),
        savingThrows: getSaves('Balanced_Cha')
    }



];

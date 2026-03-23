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


export const SCIFI_TEMPLATES: CharacterTemplate[] = [
    {
        id: 'sci-dread',
        name: 'Dreadnought',
        role: 'Tank',
        backgroundTraitNames: ['Space Marine', 'Shipwright'],
        generalTraitNames: ['Iron Skin', 'Hardy'],
        combatTraitName: 'Multi Target Status',
        description: 'A walking fortress in powered armor designed to withstand orbital bombardment.',
        isShip: false,
        abilityScores: getScores('Tank'),
        savingThrows: getSaves('Tank')
    },


    {
        id: 'sci-spectre',
        name: 'Spectre',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Android Fugitive', 'Galactic Courier'],
        generalTraitNames: ['Quick Reflexes', 'Quick Fingers'],
        combatTraitName: 'Single Target Damage',
        description: 'Covert operatives using cloaking tech and neural links to assassinate targets.',
        isShip: false,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },



    {
        id: 'sci-ai',
        name: 'Ship Systems AI',
        role: 'Specialist',
        backgroundTraitNames: ['AI Technician', 'Neural Architect'],
        generalTraitNames: ['Scholarly Mind', 'Indomitable Will'],
        combatTraitName: 'Single Target Status',
        description: 'Specializes in electronic warfare, hacking enemy hardware, and managing ship subsystems.',
        isShip: false,
        abilityScores: getScores('Specialist'),
        savingThrows: getSaves('Specialist')
    },


    {
        id: 'sci-bio',
        name: 'Bio-Gen',
        role: 'Healer',
        backgroundTraitNames: ['Cyber-Doc', 'Xenobiologist'],
        generalTraitNames: ['Hardy', 'Observant'],
        combatTraitName: 'Multi Target Healing',
        description: 'Master of nano-menders and synthetic biology, restoring life with high-tech stimulants.',
        isShip: false,
        abilityScores: getScores('Healer'),
        savingThrows: getSaves('Healer')
    },


    {
        id: 'sci-breaker',
        name: 'Exo-Breaker',
        role: 'DPS_Str',
        backgroundTraitNames: ['Salvage Crew', 'Scavenger'],
        generalTraitNames: ['Iron Grip', 'Athlete'],
        combatTraitName: 'Single Target Damage',
        description: 'Uses industrial-grade power tools and raw force to breach hulls and crush resistance.',
        isShip: false,
        abilityScores: getScores('DPS_Str'),
        savingThrows: getSaves('DPS_Str')
    },



    {
        id: 'sci-ordnance',
        name: 'Ordnance Sniper',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Star Mercenary', 'Space Marine'],
        generalTraitNames: ['Keen Senses', 'Quick Reflexes'],
        combatTraitName: 'Single Target Damage',
        description: 'Operates railguns and plasma rifles to deliver devastating shots across planetary distances.',
        isShip: false,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },



    {
        id: 'sci-envoy',
        name: 'Envoy',
        role: 'Social',
        backgroundTraitNames: ['Diplomat', 'Planetary Governor'],
        generalTraitNames: ['Silver Tongue', 'Natural Leader'],
        combatTraitName: 'Single Target Healing',
        description: 'Representative of galactic powers who uses diplomacy and influence to navigate conflict.',
        isShip: false,
        abilityScores: getScores('Social'),
        savingThrows: getSaves('Social')
    },


    {
        id: 'sci-ling',
        name: 'Xeno-Linguist',
        role: 'Specialist',
        backgroundTraitNames: ['Xenobiologist', 'Diplomat'],
        generalTraitNames: ['Scholarly Mind', 'Observant'],
        combatTraitName: 'Single Target Status',
        description: 'Bridge builder between species who understands the psychology and biology of the unknown.',
        isShip: false,
        abilityScores: getScores('Specialist'),
        savingThrows: getSaves('Specialist')
    },


    {
        id: 'sci-pilot',
        name: 'Ace Pilot',
        role: 'Utility',
        backgroundTraitNames: ['Starship Pilot', 'Galactic Courier'],
        generalTraitNames: ['Quick Reflexes', 'Keen Senses'],
        combatTraitName: 'Multi Target Damage',
        description: 'Unrivaled at the helm, capable of using ship-scale weaponry to dominate local space.',
        isShip: false,
        abilityScores: getScores('Utility'),
        savingThrows: getSaves('Utility')
    },


    {
        id: 'sci-officer',
        name: 'Officer',
        role: 'Balanced_Cha',
        backgroundTraitNames: ['Planetary Governor', 'Space Marine'],
        generalTraitNames: ['Natural Leader', 'Indomitable Will'],
        combatTraitName: 'Multi Target Status',
        description: 'A tactical commander who coordinates the party and maintains discipline under fire.',
        isShip: false,
        abilityScores: getScores('Balanced_Cha'),
        savingThrows: getSaves('Balanced_Cha')
    },



    // Sci-Fi Starship Templates
    {
        id: 'ship-sci-dreadnought',
        name: 'Heavy Dreadnought',
        role: 'Tank',
        backgroundTraitNames: ['Dura-Steel Hull', 'Kinetic Deflector Grids'],
        generalTraitNames: ['Weapon Targeting Computer', 'Thermal Shielding'],
        combatTraitName: 'Multi Target Status',
        description: 'A massive frontline capital ship designed to absorb punishment and control planetary orbits.',
        isShip: true,
        abilityScores: getScores('Tank'),
        savingThrows: getSaves('Tank')
    },


    {
        id: 'ship-sci-interceptor',
        name: 'Stealth Interceptor',
        role: 'DPS_Dex',
        backgroundTraitNames: ['Emergency Thruster-Bank', 'Neural Link Cradle'],
        generalTraitNames: ['Active Cloaking Field', 'Weapon Targeting Computer'],
        combatTraitName: 'Single Target Damage',
        description: 'A high-speed neural-linked craft specialized in covert strikes and precision assassinations.',
        isShip: true,
        abilityScores: getScores('DPS_Dex'),
        savingThrows: getSaves('DPS_Dex')
    },



    {
        id: 'ship-sci-science',
        name: 'Science Explorer',
        role: 'Specialist',
        backgroundTraitNames: ['Advanced Ship Mainframe', 'Plasma Reactor Core'],
        generalTraitNames: ['Deep-Space Scanners', 'Long-Range Radar Array'],
        combatTraitName: 'Single Target Status',
        description: 'A floating research lab equipped for deep-space analysis and anomaly investigation.',
        isShip: true,
        abilityScores: getScores('Specialist'),
        savingThrows: getSaves('Specialist')
    },


    {
        id: 'ship-sci-medical',
        name: 'Medical Frigate',
        role: 'Healer',
        backgroundTraitNames: ['Captain\'s Command Deck', 'Faraday-Cage Plating'],
        generalTraitNames: ['Automated Engineering Bay'],
        combatTraitName: 'Multi Target Healing',
        description: 'A humanitarian vessel providing widespread relief and repairs across war-torn systems.',
        isShip: true,
        abilityScores: getScores('Healer'),
        savingThrows: getSaves('Healer')
    },


    {
        id: 'ship-sci-smuggler',
        name: 'Smuggler\'s Runner',
        role: 'Utility',
        backgroundTraitNames: ['Repulsor Arrays', 'Plasma Reactor Core'],
        generalTraitNames: ['Hyperspace Nav-Computer', 'Overclocked Thrusters'],
        combatTraitName: 'Multi Target Damage',
        description: 'A fast, reliable courier vessel built to outrun authorities and navigate treacherous nebula.',
        isShip: true,
        abilityScores: getScores('Utility'),
        savingThrows: getSaves('Utility')
    }


];
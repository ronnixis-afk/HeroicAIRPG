import { CharacterTemplate } from '../templateRegistry';

export const MODERN_TEMPLATES: CharacterTemplate[] = [
    {
        id: 'mod-swat',
        name: 'SWAT Breacher',
        role: 'Tank',
        backgroundTraitNames: ['Military Vet', 'First Responder'],
        generalTraitNames: ['Iron Skin', 'Iron Grip'],
        combatTraitName: 'Multi Target Status',
        description: 'A tactical expert trained to take the lead and neutralize threats with non-lethal force.',
        isShip: false
    },
    {
        id: 'mod-infiltrator',
        name: 'Infiltrator',
        role: 'DPS',
        backgroundTraitNames: ['Ex-Con', 'Mechanic'],
        generalTraitNames: ['Quick Fingers', 'Quick Reflexes'],
        combatTraitName: 'Single Target Damage',
        description: 'A ghost in the concrete jungle, specialized in covert entry and precise eliminations.',
        isShip: false
    },
    {
        id: 'mod-tech',
        name: 'Tech Specialist',
        role: 'Support',
        backgroundTraitNames: ['Hacker', 'Mechanic'],
        generalTraitNames: ['Scholarly Mind', 'Observant'],
        combatTraitName: 'Single Target Status',
        description: 'Uses advanced gadgets and digital mastery to disrupt enemy systems and communications.',
        isShip: false
    },
    {
        id: 'mod-surgeon',
        name: 'Field Surgeon',
        role: 'Healer',
        backgroundTraitNames: ['First Responder', 'Scientist'],
        generalTraitNames: ['Hardy', 'Indomitable Will'],
        combatTraitName: 'Single Target Healing',
        description: 'A trauma expert who keeps the team alive under fire with clinical efficiency.',
        isShip: false
    },
    {
        id: 'mod-muscle',
        name: 'Heavy Muscle',
        role: 'DPS',
        backgroundTraitNames: ['Military Vet', 'Blue Collar'],
        generalTraitNames: ['Iron Grip', 'Athlete'],
        combatTraitName: 'Single Target Damage',
        description: 'Sheer physical power used to intimidate foes and dominate close-quarters brawls.',
        isShip: false
    },
    {
        id: 'mod-marksman',
        name: 'Marksman',
        role: 'DPS',
        backgroundTraitNames: ['Military Vet', 'Private Eye'],
        generalTraitNames: ['Keen Senses', 'Quick Reflexes'],
        combatTraitName: 'Single Target Damage',
        description: 'A professional sniper who provides overwatch and takes down high-value targets.',
        isShip: false
    },
    {
        id: 'mod-fixer',
        name: 'Fixer',
        role: 'Social',
        backgroundTraitNames: ['Politician', 'Salesperson'],
        generalTraitNames: ['Silver Tongue', 'Natural Leader'],
        combatTraitName: 'Single Target Healing',
        description: 'The social glue of the team; solves problems with a phone call or a handshake.',
        isShip: false
    },
    {
        id: 'mod-consultant',
        name: 'Consultant',
        role: 'Specialist',
        backgroundTraitNames: ['Academic', 'Journalist'],
        generalTraitNames: ['Scholarly Mind', 'Observant'],
        combatTraitName: 'Multi Target Status',
        description: 'A subject matter expert who uses analysis to identify and exploit enemy weaknesses.',
        isShip: false
    },
    {
        id: 'mod-stunt',
        name: 'Stunt Driver',
        role: 'Utility',
        backgroundTraitNames: ['Gig Worker', 'Mechanic'],
        generalTraitNames: ['Quick Reflexes', 'Athlete'],
        combatTraitName: 'Multi Target Damage',
        description: 'High-speed specialist who turns vehicles and mechanical assets into offensive tools.',
        isShip: false
    },
    {
        id: 'mod-bodyguard',
        name: 'Bodyguard',
        role: 'Balanced',
        backgroundTraitNames: ['Military Vet', 'First Responder'],
        generalTraitNames: ['Observant', 'Iron Skin'],
        combatTraitName: 'Single Target Status',
        description: 'A protective specialist dedicated to keeping a specific asset safe at any cost.',
        isShip: false
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
        isShip: true
    },
    {
        id: 'ship-mod-news',
        name: 'SNN Broadcast Truck',
        role: 'Specialist',
        backgroundTraitNames: ['Advanced Dash Array', 'Shock-Absorber Frame'],
        generalTraitNames: ['Wide-Angle Dash Cam', 'Public Address System'],
        combatTraitName: 'Single Target Status',
        description: 'A specialized surveillance unit used for data gathering, long-range broadcasting, and crowd control.',
        isShip: true
    },
    {
        id: 'ship-mod-clinic',
        name: 'Response Unit',
        role: 'Healer',
        backgroundTraitNames: ['Luxury Interior Quarters', 'Kevlar-Mesh Lining'],
        generalTraitNames: ['Integrated Tool-Chest'],
        combatTraitName: 'Multi Target Healing',
        description: 'A rapid-response field clinic designed for emergency medical triage in hostile urban zones.',
        isShip: true
    },
    {
        id: 'ship-mod-semi',
        name: 'Hauler Juggernaut',
        role: 'DPS',
        backgroundTraitNames: ['Industrial V8 Engine', 'Turbo-Charged Intake'],
        generalTraitNames: ['Nitrous Injection System', 'Tactical Hardpoints'],
        combatTraitName: 'Single Target Damage',
        description: 'A massive semi-truck modified for raw force, kinetic impact, and high-speed cargo delivery.',
        isShip: true
    },
    {
        id: 'ship-mod-luxury',
        name: 'Mobile Safehouse',
        role: 'Social',
        backgroundTraitNames: ['Luxury Interior Quarters', 'Firewalled Cab'],
        generalTraitNames: ['Matte-Black Finish', 'Precision Gps Unit'],
        combatTraitName: 'Single Target Healing',
        description: 'A discreet, high-comfort RV designed for diplomatic transit and undercover operations.',
        isShip: true
    }
];
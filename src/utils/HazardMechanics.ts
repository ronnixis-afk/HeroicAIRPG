
// utils/HazardMechanics.ts

import { 
    AbilityScoreName, 
    AbilityEffect, 
    DiceRollRequest, 
    PlayerCharacter, 
    Companion, 
    GameData 
} from '../types';

export type HazardTier = 'Weak' | 'Potent' | 'Deadly';
export type HazardScope = 'Single' | 'Multiple';

export interface HazardResult {
    tier: HazardTier;
    scope: HazardScope;
    dc: number;
    damageDice: string;
    saveAbility: AbilityScoreName;
    label: string;
    targetIds: string[];
}

/**
 * SOCIAL EXCLUSION LIST
 * Skills that shouldn't trigger physical traps on a natural 1.
 */
export const SOCIAL_SKILLS = ['Persuasion', 'Intimidation', 'Deception', 'Performance', 'Insight'];

/**
 * Calculates a complete hazard event based on player level and party state.
 */
export const calculateHazardEvent = (
    playerLevel: number, 
    triggeringCharacterId: string,
    partyMembers: (PlayerCharacter | Companion)[]
): HazardResult => {
    const d100 = Math.floor(Math.random() * 100) + 1;
    const scopeRoll = Math.random(); // 50/50 chance for Single vs Multiple
    const halfLvl = Math.floor(playerLevel / 2);
    
    // 1. Randomize Save Type
    const saveAbilities: AbilityScoreName[] = ['strength', 'dexterity', 'constitution'];
    const saveAbility = saveAbilities[Math.floor(Math.random() * saveAbilities.length)];

    // 2. Determine Tier
    let tier: HazardTier = 'Weak';
    let dc = 8 + halfLvl;
    let damageDice = `${Math.max(1, Math.floor(playerLevel / 4))}d4`;
    let label = 'Minor Hazard';

    if (d100 > 95) {
        tier = 'Deadly';
        dc = 12 + halfLvl;
        damageDice = `${Math.max(1, playerLevel)}d8`;
        label = 'Deadly Trap';
    } else if (d100 > 70) {
        tier = 'Potent';
        dc = 10 + halfLvl;
        damageDice = `${Math.max(1, Math.floor(playerLevel / 2))}d6`;
        label = 'Potent Hazard';
    }

    // 3. Determine Scope
    const scope: HazardScope = scopeRoll > 0.7 ? 'Multiple' : 'Single';
    const targetIds = scope === 'Multiple' 
        ? partyMembers.filter(p => !('isShip' in p && (p as any).isShip)).map(p => p.id)
        : [triggeringCharacterId];

    return {
        tier,
        scope,
        dc,
        damageDice,
        saveAbility,
        label,
        targetIds
    };
};

/**
 * Helper to build the mechanical effect object for the hazard.
 */
export const buildHazardEffect = (hazard: HazardResult): AbilityEffect => ({
    type: 'Damage',
    dc: hazard.dc,
    saveAbility: hazard.saveAbility,
    saveEffect: 'half',
    damageDice: hazard.damageDice,
    targetType: hazard.scope === 'Multiple' ? 'Multiple' : 'Single'
});

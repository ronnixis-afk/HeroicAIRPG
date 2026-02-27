
// utils/resolution/StatusRules.ts

import { CombatActor, PlayerCharacter, Companion, RollMode, UNTARGETABLE_STATUS_NAMES, NPC } from '../../types';

interface StatusCheckResult {
    mode: RollMode;
    reason: string;
}

/**
 * Determines if an actor can be targeted for an action.
 * Returns false if the actor possesses any status effect defined as untargetable.
 */
// Fix: Exporting canBeTargeted to resolve missing member errors in consumer components
export const canBeTargeted = (actor: CombatActor | PlayerCharacter | Companion | NPC): boolean => {
    if (!actor.statusEffects || actor.statusEffects.length === 0) return true;
    
    // Check if any active status effect is in the untargetable registry
    return !actor.statusEffects.some(effect => 
        (UNTARGETABLE_STATUS_NAMES as readonly string[]).includes(effect.name)
    );
};

export const checkStatusBasedRollMode = (
    attacker: CombatActor | PlayerCharacter | Companion,
    target?: CombatActor | PlayerCharacter | Companion,
    rollType?: string,
    attackType?: 'Melee' | 'Ranged' | 'Magic'
): StatusCheckResult => {
    const results: { mode: 'advantage' | 'disadvantage', reason: string }[] = [];

    const attackerEffects = attacker.statusEffects || [];
    const targetEffects = target?.statusEffects || [];

    // --- ATTACKER CONDITIONS ---
    
    // Blinded: Disadvantage on attacks
    if (attackerEffects.some(e => e.name === 'Blinded')) {
        results.push({ mode: 'disadvantage', reason: 'Blinded' });
    }

    // Poisoned: Disadvantage on Attacks and Ability Checks
    if (attackerEffects.some(e => e.name === 'Poisoned') && (rollType === 'Attack Roll' || rollType === 'Ability Check' || rollType === 'Skill Check')) {
        results.push({ mode: 'disadvantage', reason: 'Poisoned' });
    }

    // Prone: Disadvantage on Attacks
    if (attackerEffects.some(e => e.name === 'Prone') && rollType === 'Attack Roll') {
        results.push({ mode: 'disadvantage', reason: 'Prone' });
    }

    // Invisible: Advantage on Attacks
    if (attackerEffects.some(e => e.name === 'Invisible')) {
        results.push({ mode: 'advantage', reason: 'Invisible' });
    }

    // --- TARGET CONDITIONS ---
    if (target && rollType === 'Attack Roll') {
        // Target Prone
        if (targetEffects.some(e => e.name === 'Prone')) {
            if (attackType === 'Melee') {
                results.push({ mode: 'advantage', reason: 'Target Prone' });
            } else if (attackType === 'Ranged') {
                results.push({ mode: 'disadvantage', reason: 'Target Prone' });
            }
        }

        // Target Blinded
        if (targetEffects.some(e => e.name === 'Blinded')) {
            results.push({ mode: 'advantage', reason: 'Target Blinded' });
        }

        // Target Stunned/Paralyzed/Unconscious (Auto Advantage)
        const incapacitation = targetEffects.find(e => ['Stunned', 'Paralyzed', 'Unconscious'].includes(e.name));
        if (incapacitation) {
            results.push({ mode: 'advantage', reason: `Target ${incapacitation.name}` });
        }
        
        // Target Invisible
        if (targetEffects.some(e => e.name === 'Invisible')) {
            results.push({ mode: 'disadvantage', reason: 'Target Invisible' });
        }
    }

    // --- RESOLUTION ---
    const advantages = results.filter(r => r.mode === 'advantage');
    const disadvantages = results.filter(r => r.mode === 'disadvantage');

    if (advantages.length > 0 && disadvantages.length > 0) {
        return { mode: 'normal', reason: `(Cancelled: ${advantages[0].reason} vs ${disadvantages[0].reason})` };
    } else if (advantages.length > 0) {
        // Combine reasons if multiple
        const reason = advantages.map(r => r.reason).join(', ');
        return { mode: 'advantage', reason: `[Adv: ${reason}]` };
    } else if (disadvantages.length > 0) {
        const reason = disadvantages.map(r => r.reason).join(', ');
        return { mode: 'disadvantage', reason: `[Dis: ${reason}]` };
    }

    return { mode: 'normal', reason: '' };
};

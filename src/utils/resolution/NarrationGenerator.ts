// src/utils/resolution/NarrationGenerator.ts

import { DiceRoll, CombatActor } from '../../types/World';

type DamageSeverity = 'none' | 'light' | 'moderate' | 'serious';

/**
 * Determines damage severity based on the amount of damage vs target's max HP.
 */
const getDamageSeverity = (totalDamage: number, targetHpMax: number): DamageSeverity => {
    if (totalDamage <= 0) return 'none';
    const percent = totalDamage / (targetHpMax || 1);
    if (percent < 0.10) return 'light';
    if (percent < 0.30) return 'moderate';
    return 'serious';
};

/**
 * Generates a natural sentence for system combat narration.
 * Considers both attacks and ability use, handles multi-target scenarios.
 */
export const generateSystemNarration = (
    attackerName: string,
    actionName: string,
    isWeaponAttack: boolean,
    rolls: DiceRoll[],
    allPotentialTargets: any[]
): string => {
    // Group totals by target
    const targetUpdates: Record<string, { totalDamage: number, totalHealing: number }> = {};

    rolls.forEach(roll => {
        if (!roll.targetName) return;
        if (!targetUpdates[roll.targetName]) {
            targetUpdates[roll.targetName] = { totalDamage: 0, totalHealing: 0 };
        }

        if (roll.rollType === 'Damage Roll' && roll.total) {
            targetUpdates[roll.targetName].totalDamage += roll.total;
        } else if (roll.rollType === 'Healing Roll' && roll.total) {
            targetUpdates[roll.targetName].totalHealing += roll.total;
        }
    });

    const targetNames = Object.keys(targetUpdates);
    if (targetNames.length === 0) {
        const verb = isWeaponAttack ? 'strikes at' : 'uses';
        return `${attackerName} ${verb} ${actionName}, but nothing happens.`;
    }

    const segments = targetNames.map(name => {
        const target = allPotentialTargets.find(t => t.name === name);
        const update = targetUpdates[name];

        if (update.totalHealing > 0) {
            return `healing ${name} for ${update.totalHealing} health`;
        }

        if (update.totalDamage > 0) {
            const severity = getDamageSeverity(update.totalDamage, target?.maxHitPoints || 100);
            const severityText = severity === 'none' ? 'negligible' : severity;
            return `causing ${severityText} damage to ${name}`;
        }

        // If it was a miss/fail
        const targetRolls = rolls.filter(r => r.targetName === name);
        const miss = targetRolls.some(r => r.outcome === 'Miss' || r.outcome === 'Fail');
        if (miss) {
            return `missing ${name}`;
        }

        return `targeting ${name}`;
    });

    const verb = isWeaponAttack ? 'attacks' : 'uses';
    const preposition = isWeaponAttack ? 'with' : 'on';

    // Format: Attacker [verb] [action] [preposition] [targets with effects]
    let result = `${attackerName} ${verb} ${actionName}`;

    if (targetNames.length === 1) {
        result += ` ${preposition} ${targetNames[0]}, ${segments[0]}.`;
    } else {
        // Multi-target formatting
        const lastSegment = segments.pop();
        result += ` ${preposition} multiple targets: ${segments.join(', ')} and ${lastSegment}.`;
    }

    return result;
};

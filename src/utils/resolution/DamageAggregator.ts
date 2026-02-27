// src/utils/resolution/DamageAggregator.ts

import { PlayerCharacter, Companion, CombatActor, Inventory, Item, RollMode, calculateModifier } from '../../types';

export interface DamageSequencePart {
    dice: string;
    type: string;
    sourceName: string;
    bonus: number;
}

/**
 * THE AGGREGATOR
 * Handles the calculation of all damage components for an attack.
 * Resolves Sneak Attack and Combat Style modifiers deterministically.
 */
export const calculateDamageSequence = (
    roller: PlayerCharacter | Companion | CombatActor,
    inventory: Inventory | undefined,
    sourceItem: Item | null,
    rollMode: RollMode
): DamageSequencePart[] => {
    const sequence: DamageSequencePart[] = [];
    const isPC = 'getCombatStats' in roller;
    const actor = roller as any;

    // 1. Identify Base Weapon/Attack Statistics
    let baseDamageDice = '1d6';
    let baseDamageType = 'Bludgeoning';
    let weaponName = sourceItem?.name || 'Attack';
    let baseBonus = 0;

    if (sourceItem && sourceItem.weaponStats) {
        const stats = sourceItem.weaponStats;
        const mainDamage = stats.damages[0];
        baseDamageDice = mainDamage.dice;
        baseDamageType = mainDamage.type;

        if (isPC && inventory) {
            const pc = roller as PlayerCharacter | Companion;
            const combatStats = pc.getCombatStats(inventory);
            const abilityScore = pc.getBuffedScore(stats.ability, inventory);
            const abilityMod = calculateModifier(abilityScore);

            // Apply Style: Great Weapon Fighting (2x Mod)
            const hasGWF = pc.abilities.some(a => a.name === "Great Weapon Style");
            const isHeavy = sourceItem.tags?.some(t => t.toLowerCase().includes('heavy'));
            const effectiveMod = (isHeavy && hasGWF) ? abilityMod * 2 : abilityMod;

            // Apply Style: Dueling (+2 Damage)
            const hasDueling = pc.abilities.some(a => a.name === "Dueling Style");
            const isDueling = combatStats.isDueling;
            const duelingBonus = (isDueling && hasDueling) ? 2 : 0;

            // Global Damage Buffs (from other items)
            const globalBuffs = inventory.equipped.flatMap(i => i.buffs || [])
                .filter(b => b.type === 'damage')
                .reduce((sum, b) => sum + b.bonus, 0);

            baseBonus = stats.enhancementBonus + effectiveMod + duelingBonus + globalBuffs;

            // Add secondary damage types from weapon stats (e.g. Flametongue)
            stats.damages.slice(1).forEach(dmg => {
                sequence.push({
                    dice: dmg.dice,
                    type: dmg.type,
                    sourceName: weaponName,
                    bonus: 0
                });
            });
        }
    } else if (!isPC && 'attacks' in roller && Array.isArray(actor.attacks)) {
        // NPC Monster Attack path
        const attack = actor.attacks[0]; // Logic assumes primary strike for automation
        if (attack) {
            baseDamageDice = attack.damageDice;
            baseDamageType = attack.damageType;
            weaponName = attack.name;
        }
    }

    // Add Primary Weapon Strike
    sequence.unshift({
        dice: baseDamageDice,
        type: baseDamageType,
        sourceName: weaponName,
        bonus: baseBonus
    });

    // 2. Resolve Sneak Attack
    const hasSneakAttack = isPC && actor.abilities?.some((a: any) => a.name === "Sneak Attack");
    if (hasSneakAttack && rollMode === 'advantage') {
        const sneakDice = Math.ceil(actor.level / 2);
        sequence.push({
            dice: `${sneakDice}d6`,
            type: baseDamageType,
            sourceName: 'Sneak Attack',
            bonus: 0
        });
    }

    // 3. Resolve Passive Extra Damage Buffs (e.g. Divine Favor, Elemental Trait)
    const passiveBuffs = [
        ...(inventory?.equipped.flatMap(i => (i.buffs || []).map(b => ({ ...b, source: i.name }))) || []),
        ...(actor.abilities?.flatMap((a: any) => (a.buffs || []).map((b: any) => ({ ...b, source: a.name }))) || [])
    ];

    passiveBuffs.filter(b => b.type === 'exdam' && b.damageDice).forEach(buff => {
        sequence.push({
            dice: buff.damageDice!,
            type: buff.damageType || 'Force',
            sourceName: buff.source || 'Passive Ability',
            bonus: 0
        });
    });

    return sequence;
};

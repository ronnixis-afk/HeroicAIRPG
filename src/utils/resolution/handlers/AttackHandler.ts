// src/utils/resolution/handlers/AttackHandler.ts

import { DiceRoll, DiceRollRequest, CombatActor } from '../../../types/World';
import { PlayerCharacter, Companion } from '../../../types/Characters';
import { Inventory } from '../../../types/Items';
import { AbilityEffect, calculateModifier, StatusEffect } from '../../../types/Core';
import { parseDiceString } from '../../combatUtils';
import { applyDamageModifiers } from '../DamageMath';
import { calculateDamageSequence } from '../DamageAggregator';

const rollDice = (count: number, sides: number): number => {
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
};

export const resolveAttack = (
    request: DiceRollRequest,
    roller: PlayerCharacter | Companion | CombatActor,
    inventory: Inventory | undefined,
    target: PlayerCharacter | Companion | CombatActor | undefined,
    targetInventory: Inventory | undefined,
    systemEffect: AbilityEffect | null | undefined,
    dieRoll: number,
    rawRolls: number[],
    droppedRoll: number | undefined,
    currentTargetHp: number = 0
): { rolls: DiceRoll[], hpUpdates: Record<string, number>, statusUpdates: Record<string, StatusEffect[]>, logs: string[] } => {
    
    const rolls: DiceRoll[] = [];
    const hpUpdates: Record<string, number> = {};
    const statusUpdates: Record<string, StatusEffect[]> = {};
    const logs: string[] = [];

    let bonus = 0;
    let npcAttackUsed: any = null;
    
    const checkTerm = String(request.checkName).toLowerCase().trim();
    const isPCorCompanion = 'experiencePoints' in roller;

    // 1. Identify Source (Weapon or Monster Attack)
    let weaponItem: any = null;
    if (isPCorCompanion && inventory) {
        weaponItem = inventory.equipped.find(i => {
            const matchesName = String(i.name).toLowerCase() === checkTerm;
            const isPrimary = checkTerm === 'primary strike' && i.equippedSlot === 'Main Hand';
            const isGeneric = (checkTerm === 'attack' || checkTerm === 'primary strike') && (i.tags?.some(t => t.toLowerCase().includes('weapon')) || !!i.weaponStats);
            return (matchesName || isPrimary || isGeneric) && !!i.weaponStats && !i.armorStats;
        });

        if (!weaponItem && (checkTerm === 'attack' || checkTerm === 'primary strike')) {
            weaponItem = inventory.equipped.find(i => !!i.weaponStats && !i.armorStats);
        }

        if (!weaponItem && (checkTerm === 'unarmed strike' || checkTerm === 'unarmed' || checkTerm === 'attack' || checkTerm === 'primary strike')) {
            weaponItem = {
                name: 'Unarmed Strike',
                equippedSlot: 'Main Hand',
                weaponStats: { ability: 'strength', damages: [{ dice: '1d3', type: 'Bludgeoning' }], enhancementBonus: 0, critRange: 20 },
                tags: ['weapon']
            } as any;
        }

        if (weaponItem && 'getCombatStats' in roller) {
            const stats = (roller as any).getCombatStats(inventory);
            bonus = weaponItem.equippedSlot === 'Off Hand' ? stats.offHandToHitBonus : stats.mainHandToHitBonus;
        }
    } else if (!isPCorCompanion && 'attacks' in roller && Array.isArray(roller.attacks)) {
        npcAttackUsed = roller.attacks.find(a => a.name.toLowerCase() === checkTerm) || roller.attacks[0];
        if (npcAttackUsed) bonus = npcAttackUsed.toHitBonus;
    }

    // 2. Resolve Hit
    const total = dieRoll + bonus;
    let targetAC = 10;
    if (target) {
        if ('armorClass' in target && target.armorClass) targetAC = target.armorClass;
        if (targetInventory && 'getCombatStats' in target) targetAC = (target as any).getCombatStats(targetInventory).totalAC;
    }
    
    let outcome: DiceRoll['outcome'];
    
    // Determine critical threat range
    const critRange = weaponItem?.weaponStats?.critRange ?? 20;
    
    // Logic Gate: If Heroic Mode is active, explicitly force a Critical Hit outcome
    if (request.isHeroic || dieRoll >= critRange) {
        outcome = 'Critical Hit';
    } else if (dieRoll === 1) {
        outcome = 'Miss';
    } else {
        outcome = total >= targetAC ? 'Hit' : 'Miss';
    }

    const abilityLabel = weaponItem ? weaponItem.name : (npcAttackUsed ? npcAttackUsed.name : (request.abilityName || request.checkName));
    
    rolls.push({
        rollerName: roller.name, rollType: 'Attack Roll', checkName: abilityLabel,
        abilityName: request.abilityName, dieRoll, bonus, total, dc: targetAC, outcome, targetName: target?.name,
        mode: request.mode, rolls: rawRolls, dropped: droppedRoll, isHeroic: request.isHeroic
    });
    
    logs.push(`${roller.name} attacks ${target?.name || 'someone'} with ${abilityLabel}: ${outcome} (${total} vs AC ${targetAC})`);

    // 3. Resolve Damage Aggregate Sequence on Hit
    if (outcome === 'Hit' || outcome === 'Critical Hit') {
        const critMultiplier = outcome === 'Critical Hit' ? 2 : 1;
        let totalDamageApplied = 0;
        let hpTracker = currentTargetHp;

        // Use the Aggregator to gather all damage components (Styles, Sneak Attack, Buffs)
        const damageSequence = calculateDamageSequence(roller, inventory, weaponItem, request.mode || 'normal');

        damageSequence.forEach(source => {
            const { count, sides, bonus: staticFromDice } = parseDiceString(source.dice);
            let diceResult = 0;
            if (sides > 0) {
                // Apply critical multiplier to the number of dice rolled for all components
                for (let i = 0; i < count * critMultiplier; i++) diceResult += rollDice(1, sides);
            } else {
                diceResult = count;
            }

            const finalBonus = staticFromDice + source.bonus;
            let dmg = Math.max(1, diceResult + finalBonus);
            let tag = undefined;

            if (target) {
                const { finalDamage, modifierLog, tag: t } = applyDamageModifiers(dmg, source.type, target, targetInventory);
                dmg = finalDamage;
                tag = t;
                if (modifierLog) logs.push(`  -> ${source.type} Damage from ${source.sourceName}${modifierLog}`);
            }

            const prev = hpTracker;
            hpTracker = Math.max(0, hpTracker - dmg);
            totalDamageApplied += dmg;

            rolls.push({
                rollerName: roller.name, rollType: 'Damage Roll', checkName: `${source.sourceName} (${source.type})`,
                abilityName: abilityLabel, dieRoll: diceResult, diceString: `${count * critMultiplier}d${sides}`, bonus: finalBonus,
                total: dmg, targetName: target?.name, notes: tag, hpChange: { previousHp: prev, newHp: hpTracker }, isHeroic: request.isHeroic
            });
        });

        // Resolve Ability/Item Active Effect (Damage + Status)
        if (systemEffect) {
            const effect = systemEffect;
            if (effect.damageDice) {
                const { count, sides, bonus: staticBonus } = parseDiceString(effect.damageDice);
                let diceResult = 0;
                for(let i=0; i<count * critMultiplier; i++) diceResult += rollDice(1, sides);
                let damageTotal = Math.max(1, diceResult + staticBonus);
                let tag = undefined;
                if (target && effect.damageType) {
                    const { finalDamage, modifierLog, tag: t } = applyDamageModifiers(damageTotal, effect.damageType, target, targetInventory);
                    damageTotal = finalDamage;
                    tag = t;
                }
                const prev = hpTracker;
                hpTracker = Math.max(0, hpTracker - damageTotal);
                totalDamageApplied += damageTotal;
                rolls.push({
                    rollerName: roller.name, rollType: 'Damage Roll', checkName: `${abilityLabel} (${effect.damageType || 'Force'})`,
                    abilityName: abilityLabel, dieRoll: diceResult, diceString: `${count * critMultiplier}d${sides}`, bonus: staticBonus, total: damageTotal, 
                    targetName: target?.name, notes: tag, hpChange: { previousHp: prev, newHp: hpTracker }, isHeroic: request.isHeroic
                });
            }
            if (target && effect.status && !effect.saveAbility) {
                let duration = effect.duration || 1;
                if (request.isHeroic) {
                    duration *= 2;
                    logs.push(`  -> Heroic status duration doubled!`);
                }
                statusUpdates[target.id] = [{ name: effect.status, duration }];
                logs.push(`  -> Applied ${effect.status} to ${target.name} for ${duration} rounds.`);
            }
        }

        if (target && totalDamageApplied > 0) hpUpdates[target.id] = -totalDamageApplied;
    }

    return { rolls, hpUpdates, statusUpdates, logs };
};
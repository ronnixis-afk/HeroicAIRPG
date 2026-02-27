// utils/resolution/handlers/SaveHandler.ts

import { DiceRoll, DiceRollRequest, CombatActor } from '../../../types/World';
import { PlayerCharacter, Companion } from '../../../types/Characters';
import { Inventory } from '../../../types/Items';
import { AbilityEffect, AbilityScoreName, calculateModifier, StatusEffect } from '../../../types/Core';
import { parseDiceString } from '../../combatUtils';
import { applyDamageModifiers } from '../DamageMath';

const rollDice = (count: number, sides: number): number => {
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
};

export const resolveSave = (
    request: DiceRollRequest,
    roller: PlayerCharacter | Companion | CombatActor,
    inventory: Inventory | undefined,
    systemEffect: AbilityEffect | null | undefined,
    dieRoll: number,
    rawRolls: number[],
    droppedRoll: number | undefined,
    currentTargetHp: number = 0,
    isHeroic: boolean = false
): { rolls: DiceRoll[], hpUpdates: Record<string, number>, statusUpdates: Record<string, StatusEffect[]>, logs: string[] } => {
    
    const rolls: DiceRoll[] = [];
    const hpUpdates: Record<string, number> = {};
    const statusUpdates: Record<string, StatusEffect[]> = {};
    const logs: string[] = [];

    let bonus = 0;
    const checkName = (systemEffect && systemEffect.saveAbility) ? systemEffect.saveAbility : request.checkName;
    const dc = (systemEffect && systemEffect.dc) ? systemEffect.dc : (request.dc || 10);

    if ('getSavingThrowBonus' in roller && inventory && checkName) {
        bonus = (roller as PlayerCharacter | Companion).getSavingThrowBonus(checkName.toLowerCase() as AbilityScoreName, inventory);
    } else if ('abilityScores' in roller && roller.abilityScores && checkName) {
        const scoreName = checkName.toLowerCase() as AbilityScoreName;
        const score = roller.abilityScores[scoreName]?.score || 10;
        bonus = calculateModifier(score);
        if ('savingThrows' in roller && roller.savingThrows?.[scoreName]?.proficient) {
            bonus += ((roller as any).proficiencyBonus || 2);
        }
    }

    const total = dieRoll + bonus;
    let outcome: DiceRoll['outcome'] = total >= dc ? 'Success' : 'Fail';
    if (dieRoll === 20) outcome = 'Critical Success';
    if (dieRoll === 1) outcome = 'Critical Fail';
    
    const abilityLabel = request.abilityName || 'Effect';
    const sourceLabel = request.sourceName || 'Unknown Source';

    let saveNotes: string | undefined = undefined;
    const hasDamage = !!(systemEffect && systemEffect.damageDice);

    if ((outcome === 'Fail' || outcome === 'Critical Fail') && systemEffect) {
        const effect = systemEffect;
        
        // Status Application on Failed Save
        if (effect.status) {
            let duration = effect.duration || 1;
            if (isHeroic) {
                duration *= 2;
                saveNotes = "Heroic duration doubled";
                logs.push(`  -> Heroic status duration doubled!`);
            }
            statusUpdates[roller.id] = [{ name: effect.status, duration }];
            logs.push(`  -> Failed save! Applied ${effect.status} to ${roller.name} for ${duration} rounds.`);
        }
    }

    rolls.push({
        rollerName: roller.name, rollType: 'Saving Throw', checkName: checkName,
        abilityName: request.abilityName,
        sourceName: request.sourceName,
        dieRoll, bonus, total, dc, outcome,
        targetName: request.targetName || roller.name,
        mode: request.mode, rolls: rawRolls, dropped: droppedRoll,
        // Suppress Heroic flag on the Save Roll itself if it's a damaging ability (labeling refinement)
        isHeroic: isHeroic && !hasDamage,
        notes: saveNotes
    });
    
    logs.push(`${roller.name} makes a ${checkName} Save against ${abilityLabel} from ${sourceLabel}: ${outcome} (${total} vs DC ${dc})`);

    if (outcome === 'Fail' || outcome === 'Critical Fail') {
        if (systemEffect) {
            const effect = systemEffect;

            // Damage Resolution
            if (effect.damageDice) {
                const { count, sides, bonus: staticBonus } = parseDiceString(effect.damageDice);
                const heroicMultiplier = isHeroic ? 2 : 1;
                let diceResult = 0;
                for(let i=0; i<count * heroicMultiplier; i++) diceResult += rollDice(1, sides);
                let damageTotal = Math.max(1, diceResult + staticBonus);
                
                if (isHeroic) logs.push(`  -> Heroic damage dice doubled!`);

                if (effect.damageType) {
                    const { finalDamage, modifierLog } = applyDamageModifiers(damageTotal, effect.damageType, roller, inventory);
                    damageTotal = finalDamage;
                    if (modifierLog) logs.push(`  -> ${effect.damageType} Damage${modifierLog}`);
                }

                const prev = currentTargetHp;
                const after = Math.max(0, prev - damageTotal);
                rolls.push({
                    rollerName: request.sourceName || 'Source', rollType: 'Damage Roll', checkName: `${request.abilityName || 'Effect'}${effect.damageType ? ` (${effect.damageType})` : ''}`,
                    abilityName: request.abilityName, dieRoll: diceResult, diceString: effect.damageDice, bonus: staticBonus, total: damageTotal,
                    targetName: roller.name, hpChange: { previousHp: prev, newHp: after },
                    isHeroic: isHeroic,
                    notes: isHeroic ? "Heroic damage doubled" : undefined
                });
                hpUpdates[roller.id] = -damageTotal;
                logs.push(`  -> Failed save! Took ${damageTotal} damage.`);
            }
        }
    } else {
        // Success Logic (Half or Negate)
        if (systemEffect && (systemEffect as any).saveEffect === 'half' && systemEffect.damageDice) {
            const { count, sides, bonus: staticBonus } = parseDiceString(systemEffect.damageDice);
            const heroicMultiplier = isHeroic ? 2 : 1;
            let diceResult = 0;
            for(let i=0; i<count * heroicMultiplier; i++) diceResult += rollDice(1, sides);
            let fullDamage = Math.max(1, diceResult + staticBonus);
            
            if (isHeroic) logs.push(`  -> Heroic damage dice doubled!`);

            let finalValue = Math.floor(fullDamage / 2);

            if (systemEffect.damageType) {
                const { finalDamage, modifierLog } = applyDamageModifiers(finalValue, systemEffect.damageType, roller, inventory);
                finalValue = finalDamage;
                if (modifierLog) logs.push(`  -> ${systemEffect.damageType} Damage${modifierLog}`);
            }
            const prev = currentTargetHp;
            const after = Math.max(0, prev - finalValue);
            rolls.push({
                rollerName: request.sourceName || 'Source', rollType: 'Damage Roll', checkName: `${request.abilityName || 'Effect'}${systemEffect.damageType ? ` (${systemEffect.damageType})` : ''} (Half)`,
                abilityName: request.abilityName, dieRoll: diceResult, diceString: systemEffect.damageDice, bonus: staticBonus, total: finalValue,
                targetName: roller.name, hpChange: { previousHp: prev, newHp: after },
                isHeroic: isHeroic,
                notes: isHeroic ? "Heroic damage doubled" : undefined
            });
            hpUpdates[roller.id] = -finalValue;
            logs.push(`  -> Save Successful! Took half damage (${finalValue}).`);
        } else {
            logs.push(`  -> Save Successful! No damage/effect.`);
        }
    }

    return { rolls, hpUpdates, statusUpdates, logs };
};


// utils/resolution/handlers/HealHandler.ts

import { DiceRoll, DiceRollRequest, CombatActor } from '../../../types/World';
import { PlayerCharacter, Companion } from '../../../types/Characters';
import { AbilityEffect, StatusEffect } from '../../../types/Core';
import { parseDiceString } from '../../combatUtils';

const rollDice = (count: number, sides: number): number => {
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
};

export const resolveHealing = (
    request: DiceRollRequest,
    roller: PlayerCharacter | Companion | CombatActor,
    target: PlayerCharacter | Companion | CombatActor | undefined,
    systemEffect: AbilityEffect | null | undefined,
    gameData: any,
    isHeroic: boolean = false
): { rolls: DiceRoll[], hpUpdates: Record<string, number>, statusUpdates: Record<string, StatusEffect[]>, logs: string[] } => {
    
    const rolls: DiceRoll[] = [];
    const hpUpdates: Record<string, number> = {};
    const statusUpdates: Record<string, StatusEffect[]> = {};
    const logs: string[] = [];

    let healingAmount = 0;
    let diceStr = '2d4+2';
    let staticBonus = 2;
    let diceResult = 0;

    const heroicMultiplier = isHeroic ? 2 : 1;

    if (systemEffect) {
         let diceFormula = '';
         if ('getStandardEffectFormula' in roller) {
             diceFormula = (roller as PlayerCharacter | Companion).getStandardEffectFormula(systemEffect);
         }

         const activeDice = diceFormula || systemEffect.healDice || '1d8';
         
         if (activeDice) {
             diceStr = activeDice;
             const { count, sides, bonus: b } = parseDiceString(diceStr);
             staticBonus = b;
             for(let i=0; i<count * heroicMultiplier; i++) diceResult += rollDice(1, sides);
             healingAmount = diceResult + staticBonus;
             if (isHeroic) logs.push(`  -> Heroic healing dice doubled!`);
         }
    }

    if (healingAmount === 0) {
         diceResult = 0;
         const count = 1 * heroicMultiplier;
         const sides = 8;
         for(let i=0; i<count; i++) diceResult += rollDice(1, sides);
         healingAmount = diceResult; 
         diceStr = `${count}d8`;
         staticBonus = 0;
         if (isHeroic) logs.push(`  -> Heroic healing dice doubled!`);
    }
    
    const t = target || roller;
    hpUpdates[t.id] = healingAmount;
    rolls.push({
        rollerName: roller.name, rollType: 'Healing Roll', checkName: request.checkName,
        abilityName: request.abilityName || request.checkName, dieRoll: diceResult, diceString: diceStr, bonus: staticBonus, total: healingAmount,
        targetName: t.name, hpChange: { previousHp: t.currentHitPoints || 0, newHp: (t.currentHitPoints || 0) + healingAmount },
        isHeroic: isHeroic
    });
    logs.push(`${roller.name} heals ${t.name} for ${healingAmount} HP using ${request.abilityName || request.checkName}.`);

    return { rolls, hpUpdates, statusUpdates, logs };
};


import { DiceRoll, DiceRollRequest, PlayerCharacter, Companion, Inventory, AbilityScoreName, calculateModifier, resolveCanonicalSkillName } from '../../../types';

export const resolveSkillCheck = (
    request: DiceRollRequest,
    roller: PlayerCharacter | Companion | any,
    inventory: Inventory | undefined,
    dieRoll: number,
    rawRolls: number[],
    droppedRoll: number | undefined
): { roll: DiceRoll, log: string } => {
    let bonus = 0;
    let total = 0;
    let outcome: DiceRoll['outcome'] = undefined;

    // Calculate Bonus
    if ('getSkillBonus' in roller && inventory && request.rollType === 'Skill Check') {
        // Player / Companion branch: Uses full class-based calculation including buffs and penalties
        bonus = (roller as PlayerCharacter | Companion).getSkillBonus(request.checkName, inventory, request.abilityName);
    } else if (roller.skills && request.rollType === 'Skill Check') {
        // NPC branch: Pull from pre-calculated passive floor in recalculateCombatActorStats
        const canonical = resolveCanonicalSkillName(request.checkName);
        if (canonical && roller.skills[canonical]) {
            // passiveScore = 10 + Ability Mod + (Prof Bonus if Proficient).
            // Rolling bonus is simply passiveScore - 10.
            bonus = (roller.skills[canonical].passiveScore || 10) - 10;
        } else if ('abilityScores' in roller && roller.abilityScores) {
            const scoreName = (canonical || request.checkName).toLowerCase() as AbilityScoreName;
            bonus = calculateModifier(roller.abilityScores[scoreName]?.score || 10);
        }
    } else if ('abilityScores' in roller && roller.abilityScores) {
         // Generic Ability Check or fallback
         const scoreName = request.checkName.toLowerCase() as AbilityScoreName;
         bonus = calculateModifier(roller.abilityScores[scoreName]?.score || 10);
    }

    total = dieRoll + bonus;

    // Determine Outcome if DC exists
    if (request.dc) {
         // Standard check
         outcome = total >= request.dc ? 'Success' : 'Fail';
         
         // Critical Overrides (Dramatic Stakes)
         if (dieRoll === 20) outcome = 'Critical Success';
         if (dieRoll === 1) outcome = 'Critical Fail';
    }

    const roll: DiceRoll = {
        rollerName: roller.name,
        rollType: request.rollType as any,
        checkName: request.checkName,
        dieRoll,
        bonus,
        total,
        dc: request.dc,
        outcome,
        targetName: request.targetName,
        mode: request.mode,
        rolls: rawRolls,
        dropped: droppedRoll
    };

    const log = `${roller.name} ${request.checkName} Check: ${total} (vs DC ${request.dc || '?'}) -> ${outcome || 'Result'}`;

    return { roll, log };
};

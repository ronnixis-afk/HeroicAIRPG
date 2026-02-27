// utils/resolution/TargetingLogic.ts

import { CombatActor, PlayerCharacter, Companion, GameData } from '../../types';
import { canBeTargeted } from './StatusRules';

/**
 * Robustly determines if an actor is on the Player's team.
 */
const isActorAlly = (actor: CombatActor | PlayerCharacter | Companion, gameData: GameData): boolean => {
    // 1. Check for Player Identity (Explicit or Alias)
    if (actor.id === 'player' || actor.id === gameData.playerCharacter.id) return true;
    
    // 2. Check for Companion status
    if (gameData.companions.some(c => c.id === actor.id)) return true;
    
    // 3. Check for explicitly flagged NPC Allies
    const isNpc = 'statusEffects' in actor; // Simple duck-type check for CombatActor
    if (isNpc) {
        const combatActor = actor as CombatActor;
        return combatActor.isAlly === true || combatActor.alignment === 'ally';
    }

    return false;
};

/**
 * THE TARGETING ENGINE
 * Enforces Team Discernment, Scale Filtering, and The Flow Rule.
 * Ensuring deterministic tactical AI that respects visibility and team alignment.
 */
export const acquireTacticalTarget = (
    attacker: CombatActor | PlayerCharacter | Companion,
    allPotentialTargets: (CombatActor | PlayerCharacter | Companion)[],
    isHealing: boolean,
    getRunningHp: (id: string) => number,
    gameData: GameData
): (CombatActor | PlayerCharacter | Companion) | null => {
    
    const attackerIsAlly = isActorAlly(attacker, gameData);

    // 1. Primary Filtering: Alive, Targetable, and Correct Team
    let candidates = allPotentialTargets.filter(t => {
        // Prevent targeting self for damage
        if (!isHealing && t.id === attacker.id) return false;

        const hp = getRunningHp(t.id);
        const targetIsAlly = isActorAlly(t, gameData);
        
        // Basic check: Alive and not concealed
        if (hp <= 0 || !canBeTargeted(t)) return false;

        // Team check
        if (isHealing) {
            // Healing: Target must be on the SAME team as the attacker.
            return targetIsAlly === attackerIsAlly;
        } else {
            // Damage: Target must be on the OPPOSING team.
            return targetIsAlly !== attackerIsAlly;
        }
    });

    if (candidates.length === 0) return null;

    // 2. Scale Filter
    // Enforce that isShip attackers prioritize other ships unless none remain.
    if (!isHealing && attacker.isShip) {
        const opponentShips = candidates.filter(t => t.isShip);
        if (opponentShips.length > 0) {
            candidates = opponentShips;
        }
    }

    // 3. Tactical Sorting (The Flow Rule)
    if (isHealing) {
        // For recovery: Target the actor with the lowest current HP
        return candidates.sort((a, b) => getRunningHp(a.id) - getRunningHp(b.id))[0];
    } else {
        // For damage: Target the "healthier" hostile among valid candidates.
        // This distributes damage across the enemy team and reduces overkill.
        return candidates.sort((a, b) => getRunningHp(b.id) - getRunningHp(a.id))[0];
    }
};
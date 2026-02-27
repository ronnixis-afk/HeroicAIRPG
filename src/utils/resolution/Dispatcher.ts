// src/utils/resolution/Dispatcher.ts

import { GameData, DiceRollRequest, DiceRoll, StatusEffect, PlayerCharacter, Companion, CombatActor, AbilityEffect, RollMode } from '../../types';
import { findActorAndInventory, lookupAbilityOrItemEffect } from './ActorLookup';
import { checkStatusBasedRollMode } from './StatusRules';

// Import Handlers
import { resolveAttack } from './handlers/AttackHandler';
import { resolveSave } from './handlers/SaveHandler';
import { resolveHealing } from './handlers/HealHandler';
import { resolveSkillCheck } from './handlers/SkillHandler';

export interface DispatchedResolution {
    rolls: DiceRoll[];
    hpUpdates: Record<string, number>;
    statusUpdates: Record<string, StatusEffect[]>;
    logs: string[];
}

const rollDice = (count: number, sides: number): number => {
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
};

const resolveRollMode = (requested: RollMode, auto: RollMode): RollMode => {
    if (requested === 'normal') return auto;
    if (auto === 'normal') return requested;
    if (requested === auto) return requested;
    return 'normal';
};

/**
 * THE DISPATCHER
 * A deterministic resolution engine that replaces high-level AI context with strict mechanical gates.
 * Handles role-swapping for Saving Throws and applies environmental/status modifiers uniformly.
 */
export const resolveIntent = (gameData: GameData, request: DiceRollRequest, currentHpAtResolution: number): DispatchedResolution => {
    const rollerData = findActorAndInventory(gameData, request.rollerName);
    const targetData = request.targetName ? findActorAndInventory(gameData, request.targetName) : null;
    
    if (!rollerData) {
        return { 
            rolls: [], 
            hpUpdates: {}, 
            statusUpdates: {}, 
            logs: [`Dispatcher Error: Source actor "${request.rollerName}" not found in current scene context.`] 
        };
    }

    const { actor: roller, inventory: rollerInventory } = rollerData;
    
    // 1. Identify Source and Specific Resolution Method
    // We prioritize looking at the sourceName if this is a Saving Throw (meaning we've pivoted)
    const lookupTarget = (request.rollType === 'Saving Throw' && request.sourceName) 
        ? findActorAndInventory(gameData, request.sourceName) 
        : rollerData;

    const sourceEffect = lookupTarget ? lookupAbilityOrItemEffect(lookupTarget.actor, request.abilityName || request.checkName, lookupTarget.inventory) : null;
    
    let resolutionMethod: 'attack' | 'save' | 'skill' | 'heal' = 'attack';
    let systemEffect: AbilityEffect | null = null;
    
    if (sourceEffect) {
        systemEffect = ('effect' in sourceEffect && (sourceEffect as any).effect) ? { ...(sourceEffect as any).effect } : { ...(sourceEffect as any) };
        if (systemEffect) {
            // Recalculate DC and Dice for Player/Companion abilities
            if (lookupTarget && 'getStandardAbilityDC' in lookupTarget.actor) {
                const actorInstance = lookupTarget.actor as PlayerCharacter | Companion;
                systemEffect.dc = actorInstance.getStandardAbilityDC(lookupTarget.inventory);
                const standardDice = actorInstance.getStandardEffectFormula(systemEffect, lookupTarget.inventory);
                
                // Fix: Ensure dice are updated based on type even if current string is empty
                if (systemEffect.type === 'Heal') {
                    systemEffect.healDice = standardDice;
                } else if (systemEffect.type === 'Damage') {
                    systemEffect.damageDice = standardDice;
                }
            }

            if (systemEffect.resolutionMethod) {
                resolutionMethod = systemEffect.resolutionMethod;
            } else if (systemEffect.saveAbility) {
                resolutionMethod = 'save';
            } else if (systemEffect.type === 'Heal') {
                resolutionMethod = 'heal';
            }
        }
    }

    // Manual override based on rollType if no effect was found or specified
    if (request.rollType === 'Saving Throw') resolutionMethod = 'save';
    else if (request.rollType === 'Skill Check' || request.rollType === 'Ability Check') resolutionMethod = 'skill';
    else if (request.rollType === 'Healing Roll') resolutionMethod = 'heal';

    // 2. Perform The Explicit Pivot for Saving Throws
    // Rule: Logic Gate B - If method is save, the target becomes the roller, source becomes the DC anchor.
    if (resolutionMethod === 'save' && targetData && request.rollType !== 'Saving Throw') {
        const attacker = roller;
        const defender = targetData.actor;
        
        // Transform the request for the handler: Defender rolls vs Attacker DC
        // HEROIC UPDATE: Explicitly pass isHeroic property to the pivoted request to ensure damage doubling/status bonuses survive the pivot.
        const saveRequest: DiceRollRequest = {
            ...request,
            rollerName: defender.name,
            targetName: defender.name,
            sourceName: attacker.name,
            rollType: 'Saving Throw',
            checkName: systemEffect?.saveAbility || 'dexterity',
            dc: systemEffect?.dc || (attacker as any).getStandardAbilityDC?.(rollerInventory) || 10,
            isHeroic: request.isHeroic
        };

        return resolveIntent(gameData, saveRequest, currentHpAtResolution);
    }

    // 3. Status-Based Roll Mode Detection
    let autoMode: RollMode = 'normal';
    let autoReason = '';
    
    const isMagic = resolutionMethod === 'save' || resolutionMethod === 'heal';
    const isRanged = (request.checkName || '').toLowerCase().includes('bow') || (request.checkName || '').toLowerCase().includes('ranged');
    const attackType = isMagic ? 'Magic' : (isRanged ? 'Ranged' : 'Melee');

    const statusCheck = checkStatusBasedRollMode(roller, targetData?.actor, request.rollType, attackType);
    autoMode = statusCheck.mode;
    autoReason = statusCheck.reason;

    const finalMode = resolveRollMode(request.mode || 'normal', autoMode);
    
    // 4. Roll Dice
    let dieRoll = rollDice(1, 20);
    let rawRolls = [dieRoll];
    let droppedRoll: number | undefined = undefined;
    
    if (finalMode !== 'normal') {
        const roll2 = rollDice(1, 20);
        rawRolls = [dieRoll, roll2];
        if (finalMode === 'advantage') {
            dieRoll = Math.max(rawRolls[0], rawRolls[1]);
            droppedRoll = Math.min(rawRolls[0], rawRolls[1]);
        } else {
            dieRoll = Math.min(rawRolls[0], rawRolls[1]);
            droppedRoll = Math.max(rawRolls[0], rawRolls[1]);
        }
    }

    const finalRequest = { ...request, mode: finalMode };

    // 5. Logic Gate Dispatch
    switch (resolutionMethod) {
        case 'attack':
            return resolveAttack(finalRequest, roller, rollerInventory, targetData?.actor, targetData?.inventory, systemEffect, dieRoll, rawRolls, droppedRoll, currentHpAtResolution);
        
        case 'save':
            return resolveSave(finalRequest, roller, rollerInventory, systemEffect, dieRoll, rawRolls, droppedRoll, currentHpAtResolution);
            
        case 'heal':
            return resolveHealing(finalRequest, roller, targetData?.actor, systemEffect, gameData);
            
        case 'skill':
            const skillRes = resolveSkillCheck(finalRequest, roller, rollerInventory, dieRoll, rawRolls, droppedRoll);
            if (autoReason) skillRes.roll.rollReason = autoReason.replace(/\[Adv: |\[Dis: |\(Cancelled: |\]|\)/g, '');
            return { 
                rolls: [skillRes.roll], 
                hpUpdates: {}, 
                statusUpdates: {}, 
                logs: [skillRes.log] 
            };
            
        default:
            return resolveAttack(finalRequest, roller, rollerInventory, targetData?.actor, targetData?.inventory, systemEffect, dieRoll, rawRolls, droppedRoll, currentHpAtResolution);
    }
};
// src/utils/diceRolls.ts
import { GameData } from '../types/Game';
import { DiceRoll, DiceRollRequest, CombatActor } from '../types/World';
import { PlayerCharacter, Companion } from '../types/Characters';
import { StatusEffect, AbilityEffect, RollMode } from '../types/Core';
import { findActorAndInventory, lookupAbilityOrItemEffect } from './resolution/ActorLookup';
import { checkStatusBasedRollMode, canBeTargeted } from './resolution/StatusRules';

// Import Handlers
import { resolveAttack } from './resolution/handlers/AttackHandler';
import { resolveSave } from './resolution/handlers/SaveHandler';
import { resolveHealing } from './resolution/handlers/HealHandler';
import { resolveSkillCheck } from './resolution/handlers/SkillHandler';

export interface GroupCheckResult {
    checkName: string;
    rollType: string;
    totalSuccesses: number;
    totalFailures: number;
    participants: string[];
    isGroupSuccess: boolean;
    hasCriticalFailure: boolean;
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

export const calculateDiceRolls = (gameData: GameData, requests: DiceRollRequest[], isHeroicGlobal: boolean = false): {
    rolls: DiceRoll[],
    hpUpdates: Record<string, number>,
    statusUpdates: Record<string, StatusEffect[]>,
    rollSummary: string,
    groupOutcomes: GroupCheckResult[]
} => {
    const generatedRolls: DiceRoll[] = [];
    const hpUpdates: Record<string, number> = {};
    const statusUpdates: Record<string, StatusEffect[]> = {};
    const summaryLines: string[] = [];

    const runningHp = new Map<string, number>();
    const allActors = [gameData.playerCharacter, ...gameData.companions, ...(gameData.combatState?.enemies || [])];
    allActors.forEach(a => runningHp.set(a.id, a.currentHitPoints || 0));

    const mergeHpUpdates = (incoming: Record<string, number>) => {
        Object.entries(incoming).forEach(([key, val]) => {
            hpUpdates[key] = (hpUpdates[key] || 0) + val;
            const rhp = runningHp.get(key) || 0;
            runningHp.set(key, Math.max(0, rhp + val));
        });
    };

    const mergeStatusUpdates = (incoming: Record<string, StatusEffect[]>) => {
        Object.entries(incoming).forEach(([key, val]) => {
            statusUpdates[key] = [...(statusUpdates[key] || []), ...val];
        });
    };

    const isAlly = (actorId: string) => {
        if (actorId === 'player' || actorId === gameData.playerCharacter.id) return true;
        if (gameData.companions.some(c => c.id === actorId)) return true;
        const enemy = gameData.combatState?.enemies.find(e => e.id === actorId);
        return !!(enemy?.isAlly || enemy?.alignment === 'ally');
    };

    // 1. Multi-Attack and Multi-Target Expansion
    const expandedRequests: DiceRollRequest[] = [];
    const requestsByRoller: Record<string, DiceRollRequest[]> = {};
    requests.forEach(r => {
        if (!requestsByRoller[r.rollerName]) requestsByRoller[r.rollerName] = [];
        requestsByRoller[r.rollerName].push(r);
    });

    Object.keys(requestsByRoller).forEach(rollerName => {
        const rollerData = findActorAndInventory(gameData, rollerName);
        if (!rollerData) return;

        const rollerActor = rollerData.actor;
        const isPC = 'getCombatStats' in rollerActor;
        const rollerRequests = requestsByRoller[rollerName];

        rollerRequests.forEach(req => {
            const checkTerm = String(req.checkName).toLowerCase();
            const isAbilityAttack = !!req.abilityName;

            const found = lookupAbilityOrItemEffect(rollerActor, req.abilityName || req.checkName, rollerData.inventory);
            const systemEffect = found ? (('effect' in found && found.effect) ? { ...found.effect } : { ...(found as any) }) : null;

            if (systemEffect && systemEffect.targetType === 'Multiple') {
                const rollerIsAlly = isAlly(rollerActor.id);
                const isHeal = systemEffect.type === 'Heal';
                const targetPool = allActors.filter(a => {
                    const targetIsAlly = isAlly(a.id);
                    const hp = runningHp.get(a.id) || 0;
                    return (isHeal ? targetIsAlly === rollerIsAlly : targetIsAlly !== rollerIsAlly) && hp > 0 && canBeTargeted(a);
                });

                if (targetPool.length > 0) {
                    targetPool.forEach(target => {
                        expandedRequests.push({ ...req, targetName: target.name });
                    });
                } else {
                    expandedRequests.push(req);
                }
            }
            else if (req.rollType === 'Attack Roll' && !isAbilityAttack) {
                const isGeneric = checkTerm === 'attack' || checkTerm === 'primary strike' || checkTerm === 'unarmed strike';
                const isSpecificWeapon = isPC && rollerData.inventory?.equipped.some(i => i.name.toLowerCase() === checkTerm && !!i.weaponStats);
                const shouldExpand = !isAbilityAttack && (!isPC || isGeneric || isSpecificWeapon);

                if (shouldExpand) {
                    if (isPC) {
                        const stats = (rollerActor as PlayerCharacter | Companion).getCombatStats(rollerData.inventory!);
                        const mainCount = stats.mainHandAttacks || 1;
                        const offHandCount = stats.offHandAttacks || 0;
                        const mainHand = rollerData.inventory!.equipped.find(i => i.equippedSlot === 'Main Hand' && !!i.weaponStats);
                        const offHand = rollerData.inventory!.equipped.find(i => i.equippedSlot === 'Off Hand' && !!i.weaponStats);

                        for (let i = 0; i < mainCount; i++) expandedRequests.push({ ...req, checkName: mainHand?.name || req.checkName });
                        if (offHand && offHandCount > 0) {
                            for (let i = 0; i < offHandCount; i++) expandedRequests.push({ ...req, checkName: offHand.name });
                        }
                    } else {
                        const numAttacks = (rollerActor as CombatActor).numberOfAttacks || 1;
                        for (let i = 0; i < numAttacks; i++) expandedRequests.push({ ...req });
                    }
                } else {
                    expandedRequests.push(req);
                }
            } else {
                expandedRequests.push(req);
            }
        });
    });

    // 2. Main Processing Loop
    expandedRequests.forEach(request => {
        let rollerData = findActorAndInventory(gameData, request.rollerName);
        if (!rollerData) return;

        let targetData = request.targetName ? findActorAndInventory(gameData, request.targetName) : null;
        const isAttackRoll = request.rollType === 'Attack Roll';

        if (isAttackRoll && targetData) {
            const currentTargetHp = runningHp.get(targetData.actor.id) || 0;
            const attackerIsShip = rollerData.actor.isShip;
            const targetIsWrongScale = !isAlly(targetData.actor.id) && attackerIsShip && !targetData.actor.isShip;

            if (currentTargetHp <= 0 || targetIsWrongScale || !canBeTargeted(targetData.actor)) {
                const rollerIsAlly = isAlly(rollerData.actor.id);
                const validOpponents = allActors.filter(a =>
                    a.id !== rollerData!.actor.id && isAlly(a.id) !== rollerIsAlly && (runningHp.get(a.id) || 0) > 0 && canBeTargeted(a)
                );
                if (validOpponents.length > 0) {
                    const nextTarget = validOpponents.sort((a, b) => (runningHp.get(b.id) || 0) - (runningHp.get(a.id) || 0))[0];
                    request.targetName = nextTarget.name;
                    targetData = findActorAndInventory(gameData, nextTarget.name);
                }
            }
        }

        let { actor: roller, inventory } = rollerData;
        let weaponItem: any = null;
        if (request.rollType === 'Attack Roll' && inventory) {
            const checkTerm = String(request.checkName).toLowerCase();
            weaponItem = inventory.equipped.find(i => (String(i.name).toLowerCase() === checkTerm || checkTerm === 'primary strike') && i.weaponStats);
        }

        let systemEffect: AbilityEffect | any | null = null;
        if (request.abilityName || request.checkName) {
            const lookupTarget = (request.rollType === 'Saving Throw' && request.sourceName) ? findActorAndInventory(gameData, request.sourceName) : rollerData;
            if (lookupTarget) {
                const found = lookupAbilityOrItemEffect(lookupTarget.actor, request.abilityName || request.checkName, lookupTarget.inventory);
                if (found) {
                    systemEffect = ('effect' in found && found.effect) ? { ...found.effect } : { ...(found as any) };
                    if ('getStandardAbilityDC' in lookupTarget.actor && systemEffect) {
                        const actorInstance = lookupTarget.actor as PlayerCharacter | Companion;
                        systemEffect.dc = actorInstance.getStandardAbilityDC(lookupTarget.inventory);
                        const standardDice = actorInstance.getStandardEffectFormula(systemEffect, lookupTarget.inventory);
                        if (systemEffect.type === 'Heal') systemEffect.healDice = standardDice;
                        else if (systemEffect.type === 'Damage') systemEffect.damageDice = standardDice;
                    }
                    if (systemEffect && systemEffect.saveAbility && request.targetName && request.rollType !== 'Saving Throw') {
                        const victimName = request.targetName;
                        const originalAttacker = request.rollerName;
                        request.rollerName = victimName;
                        request.targetName = victimName;
                        request.sourceName = originalAttacker;
                        request.rollType = 'Saving Throw';
                        request.checkName = systemEffect.saveAbility;
                        request.dc = systemEffect.dc || 10;
                        rollerData = findActorAndInventory(gameData, request.rollerName);
                        if (rollerData) { roller = rollerData.actor; inventory = rollerData.inventory; }
                    }
                }
            }
        }

        if (rollerData) {
            const isHeroic = isHeroicGlobal || request.isHeroic;
            const isSavingThrow = request.rollType === 'Saving Throw';
            let autoMode: RollMode = 'normal';
            let autoReason = '';
            if (['Attack Roll', 'Ability Check', 'Skill Check'].includes(request.rollType)) {
                let type: 'Melee' | 'Ranged' | 'Magic' = weaponItem ? ((weaponItem.tags?.includes('bow') || weaponItem.tags?.includes('ranged')) ? 'Ranged' : 'Melee') : (systemEffect ? 'Magic' : 'Melee');
                const statusCheck = checkStatusBasedRollMode(rollerData.actor, targetData?.actor, request.rollType, type);
                autoMode = statusCheck.mode;
                autoReason = statusCheck.reason;
            }
            const finalMode = resolveRollMode(request.mode || 'normal', autoMode);

            // Phase 3: Force dieRoll to 20 for Heroic non-saving throw actions
            let dieRoll = (isHeroic && !isSavingThrow) ? 20 : rollDice(1, 20);

            let rawRolls = [dieRoll];
            let droppedRoll: number | undefined = undefined;
            if (finalMode !== 'normal' && !isHeroic) {
                const roll2 = rollDice(1, 20);
                rawRolls = [dieRoll, roll2];
                if (finalMode === 'advantage') { dieRoll = Math.max(rawRolls[0], rawRolls[1]); droppedRoll = Math.min(rawRolls[0], rawRolls[1]); }
                else { dieRoll = Math.min(rawRolls[0], rawRolls[1]); droppedRoll = Math.max(rawRolls[0], rawRolls[1]); }
            }
            const targetId = targetData?.actor.id;
            const hpAtRes = targetId ? (runningHp.get(targetId) || 0) : 0;

            if (request.rollType === 'Attack Roll') {
                // Phase 3 Propogation: Update the request object so the handler sees the merged heroic flag
                const modifiedRequest = { ...request, isHeroic };
                const res = resolveAttack(modifiedRequest, rollerData.actor, inventory, targetData?.actor, targetData?.inventory, systemEffect, dieRoll, rawRolls, droppedRoll, hpAtRes);
                res.rolls.forEach(r => {
                    r.isHeroic = isHeroic;
                    if (autoReason && r.mode !== 'normal') r.rollReason = autoReason.replace(/\[Adv: |\[Dis: |\]/g, '');
                });
                generatedRolls.push(...res.rolls);
                summaryLines.push(...res.logs);
                mergeHpUpdates(res.hpUpdates);
                if (res.statusUpdates) mergeStatusUpdates(res.statusUpdates);
            } else if (request.rollType === 'Saving Throw') {
                const res = resolveSave(request, rollerData.actor, inventory, systemEffect, dieRoll, rawRolls, droppedRoll, hpAtRes, isHeroic);
                res.rolls.forEach(r => { r.isHeroic = isHeroic; });
                generatedRolls.push(...res.rolls);
                summaryLines.push(...res.logs);
                mergeHpUpdates(res.hpUpdates);
                mergeStatusUpdates(res.statusUpdates);
            } else if (request.rollType === 'Healing Roll') {
                const res = resolveHealing(request, roller, targetData?.actor, systemEffect, gameData, isHeroic);
                res.rolls.forEach(r => { r.isHeroic = isHeroic; });
                generatedRolls.push(...res.rolls);
                summaryLines.push(...res.logs);
                mergeHpUpdates(res.hpUpdates);
            } else if (request.rollType === 'Skill Check' || request.rollType === 'Ability Check') {
                const res = resolveSkillCheck(request, rollerData.actor, inventory, dieRoll, rawRolls, droppedRoll);
                res.roll.isHeroic = isHeroic;
                if (autoReason) res.roll.rollReason = autoReason.replace(/\[Adv: |\[Dis: |\]/g, '');
                generatedRolls.push(res.roll);
                summaryLines.push(res.log);
            }
        }
    });

    // 3. Resolve Group Checks
    const groupOutcomes: GroupCheckResult[] = [];
    const skillAbilityRolls = generatedRolls.filter(r => r.rollType === 'Skill Check' || r.rollType === 'Ability Check');
    const grouped = skillAbilityRolls.reduce((acc, roll) => {
        const key = `${roll.rollType}:${roll.checkName}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(roll);
        return acc;
    }, {} as Record<string, DiceRoll[]>);

    Object.entries(grouped).forEach(([key, rolls]) => {
        if (rolls.length > 1) {
            const [rollType, checkName] = key.split(':');
            const totalSuccesses = rolls.filter(r => r.outcome?.includes('Success')).length;
            const totalFailures = rolls.length - totalSuccesses;
            const hasCriticalFailure = rolls.some(r => r.dieRoll === 1);

            // ANY SUCCESS POLICY: Group succeeds if ANY single member succeeds
            const isGroupSuccess = totalSuccesses > 0;

            groupOutcomes.push({
                checkName,
                rollType,
                totalSuccesses,
                totalFailures,
                participants: rolls.map(r => r.rollerName),
                isGroupSuccess,
                hasCriticalFailure
            });

            const outcomeText = isGroupSuccess ? 'SUCCESS' : 'FAILURE';
            summaryLines.push(`[GROUP RESULT]: ${checkName} ${rollType} - ${outcomeText} (${totalSuccesses} Successes vs ${totalFailures} Failures)`);
        }
    });

    return { rolls: generatedRolls, hpUpdates, statusUpdates, rollSummary: summaryLines.join('\n'), groupOutcomes };
};

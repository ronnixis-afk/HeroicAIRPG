
import { PlayerCharacter, Companion, CombatActor, Inventory } from '../../types';

export const applyDamageModifiers = (
    damage: number, 
    damageType: string, 
    target: PlayerCharacter | Companion | CombatActor,
    inventory?: Inventory
): { finalDamage: number; modifierLog: string; tag?: string } => {
    if (!damageType || damage <= 0) return { finalDamage: damage, modifierLog: '', tag: undefined };

    const type = damageType.toLowerCase();
    
    // 1. Collect Base Defenses
    let resistances = [...(target.resistances || [])];
    let immunities = [...(target.immunities || [])];
    let vulnerabilities = [...(target.vulnerabilities || [])];

    // 2. Aggregate from Inventory (Items with Buffs)
    if (inventory && inventory.equipped) {
        inventory.equipped.forEach(item => {
            item.buffs?.forEach(buff => {
                if (buff.type === 'resistance' && buff.damageType) resistances.push(buff.damageType);
                if (buff.type === 'immunity' && buff.damageType) immunities.push(buff.damageType);
            });
        });
    }

    // 3. Aggregate from Abilities (Passive Features with Buffs)
    if ('abilities' in target && target.abilities) {
        target.abilities.forEach(ability => {
             ability.buffs?.forEach(buff => {
                if (buff.type === 'resistance' && buff.damageType) resistances.push(buff.damageType);
                if (buff.type === 'immunity' && buff.damageType) immunities.push(buff.damageType);
             });
        });
    }

    // Normalize for comparison
    const norm = (s: string) => s.toLowerCase().trim();
    const hasImmunity = immunities.some(t => norm(t) === type);
    const hasVulnerability = vulnerabilities.some(t => norm(t) === type);
    const hasResistance = resistances.some(t => norm(t) === type);
    
    // Immunity (x0)
    if (hasImmunity) {
        return { finalDamage: 0, modifierLog: ' (Immune)', tag: '[Immune]' };
    }

    // Vulnerability (x2)
    let modifier = 1;
    let logParts = [];
    let tag = undefined;

    if (hasVulnerability) {
        modifier *= 2;
        logParts.push('Vulnerable x2');
        tag = '[Vulnerable]';
    }

    // Resistance (x0.5)
    if (hasResistance) {
        modifier *= 0.5;
        logParts.push('Resistant /2');
        tag = '[Resistant]'; // Simple precedence for display
        if (hasVulnerability) tag = '[Vuln+Res]';
    }

    const finalDamage = Math.floor(damage * modifier);
    const modifierLog = logParts.length > 0 ? ` (${logParts.join(', ')})` : '';

    return { finalDamage, modifierLog, tag };
};

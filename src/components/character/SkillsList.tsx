import React, { useMemo } from 'react';
import { PlayerCharacter, Companion, type Inventory, type SkillName, formatModifier, SKILL_NAMES, SKILL_DEFINITIONS, calculateModifier, getStatPenalties } from '../../types';
import Accordion from '../Accordion';

interface SkillsListProps {
    character: PlayerCharacter | Companion;
    inventory: Inventory;
    onChange: (path: (string | number)[], value: any) => void;
    isOpen: boolean;
    onToggle: () => void;
    config: string;
}

export const SkillsList: React.FC<SkillsListProps> = ({ character, inventory, onChange, isOpen, onToggle, config }) => {
    
    // Aggregate buffs with source names for tooltips
    const allBuffs = useMemo(() => {
        const itemBuffs = inventory.equipped.flatMap(i => (i.buffs || []).map(b => ({ ...b, source: i.name })));
        const abilityBuffs = character.abilities.flatMap(a => (a.buffs || []).map(b => ({ ...b, source: a.name })));
        const activeBuffs = (character.activeBuffs || []).map(b => ({ ...b, source: 'Active Buff' }));
        return [...itemBuffs, ...abilityBuffs, ...activeBuffs];
    }, [inventory, character.abilities, character.activeBuffs]);

    const penalties = getStatPenalties(character.statusEffects || []);

    const visibleSkills = useMemo(() => {
        return SKILL_NAMES.filter(skill => {
            const def = SKILL_DEFINITIONS[skill];
            if (!def) return false;
            return def.usedIn === 'All' || def.usedIn.includes(config as any);
        }).sort();
    }, [config]);

    return (
        <div className="animate-fade-in space-y-6">
            <div className="px-1">
                <h3 className="text-brand-text mb-1">Character Skills</h3>
                <p className="text-body-sm text-brand-text-muted font-medium tracking-normal opacity-70">
                    Configuration: <span className="text-brand-accent font-bold">{config}</span>
                </p>
            </div>

            <div className="bg-brand-primary/10 p-3 rounded-2xl border border-brand-primary/30 space-y-1 shadow-inner">
                 {visibleSkills.map(skill => {
                    const def = SKILL_DEFINITIONS[skill];
                    const ability = def.ability;
                    const skillEntry = character.skills ? character.skills[skill as SkillName] : undefined;
                    const isProficient = skillEntry?.proficient || false;
                    
                    // Breakdown Calculation
                    const buffedScore = character.getBuffedScore(ability, inventory);
                    const mod = calculateModifier(buffedScore);
                    const profBonus = isProficient ? character.proficiencyBonus : 0;
                    
                    const skillBuffs = allBuffs.filter(b => b.type === 'skill' && b.skillName === skill);
                    const buffBonus = skillBuffs.reduce((sum, b) => sum + b.bonus, 0);
                    
                    const totalBonus = mod + profBonus + buffBonus + penalties.check;
                    
                    const rawScore = character.abilityScores?.[ability]?.score || 10;
                    const rawMod = calculateModifier(rawScore);
                    const baseTotal = rawMod + profBonus;
                    const diff = totalBonus - baseTotal;
                    
                    let valueColor = "";
                    if (diff > 0) valueColor = "text-brand-accent";
                    else if (diff < 0) valueColor = "text-brand-danger";
                    
                    const tooltipLines = [`${ability.slice(0,1).toUpperCase() + ability.slice(1, 3).toLowerCase()} Mod: ${formatModifier(mod)}`];
                    if (isProficient) tooltipLines.push(`Proficiency: ${formatModifier(profBonus)}`);
                    skillBuffs.forEach(b => tooltipLines.push(`${formatModifier(b.bonus)} (${b.source})`));
                    if (penalties.check !== 0) tooltipLines.push(`${formatModifier(penalties.check)} (Status penalty)`);
                    tooltipLines.push(`Total: ${formatModifier(totalBonus)}`);

                     return (
                         <div key={skill} className="flex items-center hover:bg-brand-primary/30 rounded-xl py-2 px-3 transition-all group" title={def.description}>
                             <input
                                type="checkbox"
                                checked={isProficient}
                                onChange={e => onChange(['skills', skill, 'proficient'], e.target.checked)}
                                className="custom-checkbox"
                            />
                             <span 
                                className={`font-mono font-black text-sm w-12 text-center cursor-help border-b border-dotted border-brand-text-muted/30 mx-3 ${valueColor}`}
                                title={tooltipLines.join('\n')}
                            >
                                {formatModifier(totalBonus)}
                            </span>
                             <div className="flex flex-col min-w-0 flex-grow">
                                 <span className="text-body-base font-semibold truncate group-hover:text-brand-text transition-colors">{skill}</span>
                             </div>
                             <span className="text-[10px] font-black text-brand-text-muted ml-3 opacity-40 capitalize tracking-normal">{ability.slice(0, 3)}</span>
                         </div>
                     );
                 })}
            </div>
        </div>
    );
};

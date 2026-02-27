import React from 'react';
import { PlayerCharacter, Companion, type Inventory, type AbilityScoreName, calculateModifier, formatModifier, ABILITY_SCORES, getStatPenalties, BASE_SIZE_MODIFIERS } from '../../types';
import Accordion from '../Accordion';
import { Icon } from '../Icon';

const abilityScoreRenderOrder: AbilityScoreName[] = ['strength', 'intelligence', 'dexterity', 'wisdom', 'constitution', 'charisma'];

interface AbilityScoresProps {
    character: PlayerCharacter | Companion;
    inventory: Inventory;
    onChange: (path: (string | number)[], value: any) => void;
    scoresOpen: boolean;
    savesOpen: boolean;
    toggleScores: () => void;
    toggleSaves: () => void;
    hideScores?: boolean;
    hideSaves?: boolean;
}

export const AbilityScores: React.FC<AbilityScoresProps> = ({ 
    character, 
    inventory, 
    onChange,
    scoresOpen,
    savesOpen,
    toggleScores,
    toggleSaves,
    hideScores = false,
    hideSaves = false
}) => {

    const handleScoreChange = (ability: AbilityScoreName, delta: number) => {
        const currentScore = character.abilityScores?.[ability]?.score || 10;
        onChange(['abilityScores', ability, 'score'], currentScore + delta);
    };

    const itemBuffs = inventory.equipped.flatMap(i => (i.buffs || []).map(b => ({ ...b, source: i.name })));
    const abilityBuffs = character.abilities.flatMap(a => (a.buffs || []).map(b => ({ ...b, source: a.name })));
    const activeBuffs = (character.activeBuffs || []).map(b => ({ ...b, source: 'Active Buff' }));
    const allBuffs = [...itemBuffs, ...abilityBuffs, ...activeBuffs];
    const penalties = getStatPenalties(character.statusEffects || []);
    
    const sizeStats = BASE_SIZE_MODIFIERS[character.size] || BASE_SIZE_MODIFIERS['Medium'];

    return (
        <div className="space-y-6">
            {!hideScores && (
                <div className="animate-fade-in">
                    <h3 className="text-brand-text mb-4 px-1">Ability Scores</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {abilityScoreRenderOrder.map(ability => {
                            const baseScore = character.abilityScores?.[ability]?.score || 10;
                            const relevantBuffs = allBuffs.filter(b => b.type === 'ability' && b.abilityName === ability);
                            const buffTotal = relevantBuffs.reduce((sum, b) => sum + b.bonus, 0);
                            
                            let sizeMod = 0;
                            if (ability === 'strength') sizeMod = sizeStats.str;
                            else if (ability === 'dexterity') sizeMod = sizeStats.dex;
                            else if (ability === 'constitution') sizeMod = sizeStats.con;
                            
                            const finalScore = baseScore + buffTotal + sizeMod;
                            const modifier = calculateModifier(finalScore);
                            const isBuffed = finalScore !== baseScore;

                            const tooltipLines = [`Base score: ${baseScore}`];
                            if (sizeMod !== 0) tooltipLines.push(`${formatModifier(sizeMod)} (Size: ${character.size})`);
                            relevantBuffs.forEach(b => tooltipLines.push(`${formatModifier(b.bonus)} (${b.source})`));
                            if (isBuffed) tooltipLines.push(`Total: ${finalScore}`);

                            return (
                                <div key={ability} className={`flex flex-col items-center border p-4 rounded-2xl transition-all ${isBuffed ? 'border-brand-accent bg-brand-accent/5 shadow-lg shadow-brand-accent/5' : 'border-brand-primary bg-brand-primary/10'}`}>
                                    <label className="text-body-tiny text-brand-text-muted capitalize mb-2">{ability}</label>
                                    <div className={`text-3xl font-black tracking-tight ${isBuffed ? 'text-brand-accent' : 'text-brand-text'}`}>
                                        {formatModifier(modifier)}
                                    </div>
                                    <div className="flex items-center gap-3 mt-4">
                                        <button
                                            onClick={() => handleScoreChange(ability, -1)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-surface border border-brand-primary text-brand-text-muted hover:text-brand-accent hover:border-brand-accent transition-all active:scale-90"
                                            aria-label="Decrease score"
                                        >
                                            <Icon name="minus" className="w-4 h-4" />
                                        </button>
                                        <div 
                                            className={`w-12 h-10 flex items-center justify-center bg-brand-bg text-center rounded-xl text-lg font-bold tabular-nums cursor-help border border-brand-primary shadow-inner ${isBuffed ? 'text-brand-accent border-brand-accent/30' : 'text-brand-text'}`}
                                            title={tooltipLines.join('\n')}
                                        >
                                            {finalScore}
                                        </div>
                                        <button
                                            onClick={() => handleScoreChange(ability, 1)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-surface border border-brand-primary text-brand-text-muted hover:text-brand-accent hover:border-brand-accent transition-all active:scale-90"
                                            aria-label="Increase score"
                                        >
                                            <Icon name="plus" className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {!hideSaves && (
                <div className="animate-fade-in pt-4">
                    <h3 className="text-brand-text mb-4 px-1">Saving Throws</h3>
                    <div className="space-y-1 bg-brand-primary/10 p-3 rounded-2xl border border-brand-primary/30 shadow-inner">
                        {ABILITY_SCORES.map(ability => {
                            const isProficient = character.savingThrows?.[ability]?.proficient || false;
                            const buffedScore = character.getBuffedScore(ability, inventory);
                            const mod = calculateModifier(buffedScore);
                            const profBonus = isProficient ? character.proficiencyBonus : 0;
                            const saveBuffs = allBuffs.filter(b => b.type === 'save' && (!b.abilityName || b.abilityName === ability));
                            const buffBonus = saveBuffs.reduce((sum, b) => sum + b.bonus, 0);
                            const totalBonus = mod + profBonus + buffBonus + penalties.save;

                            const rawScore = character.abilityScores?.[ability]?.score || 10;
                            const rawMod = calculateModifier(rawScore);
                            const baseTotal = rawMod + profBonus;
                            const diff = totalBonus - baseTotal;
                            
                            let valueColor = "";
                            if (diff > 0) valueColor = "text-brand-accent";
                            else if (diff < 0) valueColor = "text-brand-danger";

                            const tooltipLines = [`${ability.slice(0,1).toUpperCase() + ability.slice(1, 3).toLowerCase()} Mod: ${formatModifier(mod)}`];
                            if (isProficient) tooltipLines.push(`Proficiency: ${formatModifier(profBonus)}`);
                            saveBuffs.forEach(b => tooltipLines.push(`${formatModifier(b.bonus)} (${b.source})`));
                            if (penalties.save !== 0) tooltipLines.push(`${formatModifier(penalties.save)} (Status penalty)`);
                            tooltipLines.push(`Total: ${formatModifier(totalBonus)}`);

                            return (
                                <div key={ability} className="flex items-center p-2 rounded-xl hover:bg-brand-primary/20 transition-all group">
                                    <input
                                        type="checkbox"
                                        checked={isProficient}
                                        onChange={e => onChange(['savingThrows', ability, 'proficient'], e.target.checked)}
                                        className="custom-checkbox"
                                    />
                                    <span 
                                        className={`font-mono font-black text-body-tiny w-12 text-center cursor-help border-b border-dotted border-brand-text-muted/30 mx-3 ${valueColor}`}
                                        title={tooltipLines.join('\n')}
                                    >
                                        {formatModifier(totalBonus)}
                                    </span>
                                    <span className="text-body-base text-brand-text-muted group-hover:text-brand-text transition-colors capitalize">{ability}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
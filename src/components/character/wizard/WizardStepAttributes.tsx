import React, { useMemo } from 'react';
import { Icon } from '../../Icon';
import { calculateModifier, formatModifier, AbilityScoreName, SKILL_NAMES, SKILL_DEFINITIONS } from '../../../types';

interface WizardStepAttributesProps {
    abilityScores: Record<AbilityScoreName, { score: number }>;
    onAbilityChange: (ability: AbilityScoreName, score: number) => void;
    skills: Record<string, { proficient: boolean }>;
    onSkillChange: (skill: string, proficient: boolean) => void;
    config: string;
    guaranteedSkills: string[];
    racialBonuses?: Partial<Record<AbilityScoreName, number>>;
}

const ABILITY_ORDER: AbilityScoreName[] = ['strength', 'intelligence', 'dexterity', 'wisdom', 'constitution', 'charisma'];

const POINT_COSTS: Record<number, number> = {
    8: 0,
    9: 1,
    10: 2,
    11: 3,
    12: 4,
    13: 5,
    14: 7,
    15: 9,
    16: 11
};

export const WizardStepAttributes: React.FC<WizardStepAttributesProps> = ({
    abilityScores,
    onAbilityChange,
    skills,
    onSkillChange,
    config,
    guaranteedSkills,
    racialBonuses = {}
}) => {

    const pointsSpent = useMemo(() => {
        return ABILITY_ORDER.reduce((total, ability) => {
            const score = abilityScores[ability]?.score || 8;
            return total + (POINT_COSTS[score] || 0);
        }, 0);
    }, [abilityScores]);

    const remainingPoints = 32 - pointsSpent;

    const visibleSkills = useMemo(() => {
        return SKILL_NAMES.filter(skill => {
            const def = SKILL_DEFINITIONS[skill];
            if (!def) return false;
            return def.usedIn === 'All' || def.usedIn.includes(config as any);
        }).sort();
    }, [config]);

    const handleScoreChange = (ability: AbilityScoreName, delta: number) => {
        const currentScore = abilityScores[ability]?.score || 8;
        const newScore = currentScore + delta;
        if (newScore < 8 || newScore > 16) return;
        
        const currentCost = POINT_COSTS[currentScore];
        const newCost = POINT_COSTS[newScore];
        const costDiff = newCost - currentCost;

        if (costDiff > remainingPoints) return; // Cannot afford

        onAbilityChange(ability, newScore);
    };

    return (
        <div className="space-y-10 max-w-2xl mx-auto pb-6">
            <div className="text-center space-y-2">
                <h4 className="text-2xl font-bold text-brand-text">Determine Attributes</h4>
                <p className="text-sm text-brand-text-muted italic">
                    Allocate points to define your core abilities, then select your practiced skills.
                </p>
                <div className="mt-4 inline-flex items-center gap-3 bg-brand-primary/30 px-6 py-2 rounded-full border border-brand-primary">
                    <span className="font-bold text-brand-text-muted text-sm">Points Remaining</span>
                    <span className={`text-xl font-black ${remainingPoints > 0 ? 'text-brand-accent' : (remainingPoints < 0 ? 'text-brand-danger' : 'text-brand-text')}`}>
                        {remainingPoints} / 32
                    </span>
                </div>
            </div>

            <div className="animate-fade-in">
                <h5 className="text-brand-text mb-4 px-1">Ability Scores <span className="text-[10px] text-brand-text-muted opacity-60 ml-2 font-normal">(Base score only, before racial modifiers)</span></h5>
                <div className="grid grid-cols-2 gap-4">
                    {ABILITY_ORDER.map(ability => {
                        const score = abilityScores[ability]?.score || 8;
                        const racialBonus = racialBonuses[ability] || 0;
                        const totalScore = score + racialBonus;
                        const modifier = calculateModifier(totalScore);
                        
                        const canIncrease = score < 16 && (POINT_COSTS[score + 1] - POINT_COSTS[score]) <= remainingPoints;
                        const canDecrease = score > 8;

                        return (
                            <div key={ability} className={`flex flex-col items-center border p-4 rounded-2xl transition-all ${racialBonus > 0 ? 'border-brand-accent bg-brand-accent/5' : 'border-brand-primary bg-brand-primary/10'}`}>
                                <label className="text-body-sm text-brand-text-muted capitalize mb-2 font-bold">{ability}</label>
                                <div className={`text-3xl font-bold ${racialBonus > 0 ? 'text-brand-accent' : 'text-brand-text'}`}>
                                    {formatModifier(modifier)}
                                </div>
                                <div className="flex items-center gap-3 mt-4">
                                    <button
                                        onClick={() => handleScoreChange(ability, -1)}
                                        disabled={!canDecrease}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-surface border border-brand-primary text-brand-text-muted hover:text-brand-danger hover:border-brand-danger transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-brand-text-muted disabled:hover:border-brand-primary"
                                        aria-label="Decrease score"
                                    >
                                        <Icon name="minus" className="w-4 h-4" />
                                    </button>
                                    <div 
                                        className={`w-12 h-10 flex items-center justify-center bg-brand-bg text-center rounded-xl text-lg font-bold tabular-nums border shadow-inner cursor-help ${racialBonus > 0 ? 'border-brand-accent/30 text-brand-accent' : 'border-brand-primary text-brand-text'}`}
                                        title={racialBonus > 0 ? `Base: ${score}\nRacial: +${racialBonus}\nTotal: ${totalScore}` : `Base Score: ${score}`}
                                    >
                                        {totalScore}
                                    </div>
                                    <button
                                        onClick={() => handleScoreChange(ability, 1)}
                                        disabled={!canIncrease}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-surface border border-brand-primary text-brand-text-muted hover:text-brand-accent hover:border-brand-accent transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-brand-text-muted disabled:hover:border-brand-primary"
                                        aria-label="Increase score"
                                    >
                                        <Icon name="plus" className="w-4 h-4" />
                                    </button>
                                </div>
                                {score < 16 && (
                                    <div className="text-[10px] text-brand-text-muted opacity-50 mt-2">
                                        Next point cost: {POINT_COSTS[score + 1] - POINT_COSTS[score]}
                                    </div>
                                )}
                                {score === 16 && (
                                    <div className="text-[10px] text-brand-accent opacity-50 mt-2">
                                        Maximum
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="animate-fade-in pt-4">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h5 className="text-brand-text mb-0">Skill Proficiencies</h5>
                    <p className="text-[10px] text-brand-text-muted">
                        Select skills to master
                    </p>
                </div>
                
                <div className="bg-brand-primary/10 p-3 rounded-2xl border border-brand-primary/30 space-y-1 shadow-inner">
                    {visibleSkills.map(skill => {
                        const def = SKILL_DEFINITIONS[skill];
                        const ability = def.ability;
                        const score = abilityScores[ability]?.score || 8;
                        const racialBonus = racialBonuses[ability] || 0;
                        const totalScore = score + racialBonus;
                        const mod = calculateModifier(totalScore);
                        
                        const isGuaranteed = guaranteedSkills.includes(skill);
                        const isProficient = isGuaranteed || skills[skill]?.proficient || false;
                        
                        // We assume proficiency bonus is +2 for level 1 character creation
                        const profBonus = isProficient ? 2 : 0;
                        const totalBonus = mod + profBonus;

                        return (
                            <div key={skill} className="flex items-center hover:bg-brand-primary/30 rounded-xl py-2 px-3 transition-all group" title={def.description}>
                                <input
                                    type="checkbox"
                                    checked={isProficient}
                                    disabled={isGuaranteed}
                                    onChange={e => onSkillChange(skill, e.target.checked)}
                                    className="custom-checkbox disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span 
                                    className={`font-mono font-bold text-body-sm w-12 text-center border-b border-dotted border-brand-text-muted/30 mx-3 ${isProficient ? "text-brand-accent" : "text-brand-text-muted"}`}
                                    title={`${ability.slice(0, 3)} Mod: ${formatModifier(mod)}\nProficiency: ${formatModifier(profBonus)}`}
                                >
                                    {formatModifier(totalBonus)}
                                </span>
                                <div className="flex flex-col min-w-0 flex-grow">
                                    <span className="text-body-sm font-semibold truncate group-hover:text-brand-text transition-colors flex items-center gap-2">
                                        {skill}
                                        {isGuaranteed && <span className="text-[9px] text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded-sm border border-brand-accent/20">Trait</span>}
                                    </span>
                                </div>
                                <span className="text-body-sm font-bold text-brand-text-muted ml-3 opacity-40 capitalize tracking-normal">{ability.slice(0, 3)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

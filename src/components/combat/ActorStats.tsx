import React, { useState, useMemo } from 'react';
import { type CombatActor, ABILITY_SCORES, DAMAGE_TYPES, type SkillName } from '../../types';
import Accordion from '../Accordion';
import StatusEffectsEditor from '../StatusEffectsEditor';
import { TagEditor } from '../TagEditor';
import { Icon } from '../Icon';

interface ActorStatsProps {
    actor: CombatActor;
    onChange: (keys: (string | number)[], value: any) => void;
}

const INTERACTION_SKILLS: SkillName[] = [
    'Perception', 'Insight', 'Investigation', 'Deception', 'Intimidation', 'Persuasion', 'Stealth', 'Athletics'
];

export const ActorStats: React.FC<ActorStatsProps> = ({ actor, onChange }) => {
    const [openScores, setOpenScores] = useState(false);
    const [openSkills, setOpenSkills] = useState(true);

    const skillsToDisplay = useMemo(() => {
        if (!actor.skills) return [];
        return INTERACTION_SKILLS.map(name => ({
            name,
            ...actor.skills![name]
        }));
    }, [actor.skills]);

    return (
        <div className="space-y-4 animate-fade-in">
            <Accordion title="Status Effects" isOpen={true}>
                <div className="pt-2">
                    <StatusEffectsEditor statusEffects={actor.statusEffects || []} onStatusEffectsChange={(newEffects) => onChange(['statusEffects'], newEffects)} />
                </div>
            </Accordion>

            <Accordion title="Ability Scores & Saves" isOpen={openScores} onToggle={() => setOpenScores(!openScores)}>
                <div className="grid grid-cols-3 gap-3 pt-2">
                    {ABILITY_SCORES.map(score => (
                        <div key={score} className="flex flex-col items-center bg-brand-primary/20 p-3 rounded-xl border border-brand-surface shadow-inner">
                            <label className="text-[10px] font-black text-brand-text-muted capitalize tracking-normal mb-1.5">{score.slice(0, 3)}</label>
                            <input
                                type="number"
                                value={actor.abilityScores?.[score]?.score || 10}
                                onChange={e => onChange(['abilityScores', score, 'score'], parseInt(e.target.value) || 10)}
                                className="w-full bg-brand-primary text-center h-9 rounded-lg border border-brand-surface focus:border-brand-accent text-sm font-black mb-3 shadow-inner"
                            />
                            <div className="flex items-center gap-2 w-full justify-center">
                                <input
                                    type="checkbox"
                                    checked={actor.savingThrows?.[score]?.proficient || false}
                                    onChange={e => onChange(['savingThrows', score, 'proficient'], e.target.checked)}
                                    className="custom-checkbox w-3 h-3"
                                />
                                <span className="text-[10px] font-bold text-brand-text-muted">Save</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Accordion>

            <Accordion title="Interaction Skills" isOpen={openSkills} onToggle={() => setOpenSkills(!openSkills)}>
                <div className="bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/30 shadow-inner mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                        {skillsToDisplay.map(skill => (
                            <div key={skill.name} className="flex items-center justify-between group py-2 border-b border-brand-primary/10 last:border-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${skill.proficient ? 'bg-brand-accent shadow-[0_0_8px_rgba(62,207,142,0.5)]' : 'bg-brand-secondary'}`} />
                                    <span className={`text-body-sm truncate font-bold ${skill.proficient ? 'text-brand-text' : 'text-brand-text-muted group-hover:text-brand-text transition-colors'}`}>
                                        {skill.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-brand-text-muted opacity-40 tracking-tight">Floor</span>
                                    <span className={`text-body-base font-black tabular-nums ${skill.proficient ? 'text-brand-accent' : 'text-brand-text-muted'}`}>
                                        {skill.passiveScore}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-brand-text-muted mt-4 italic text-center opacity-60">Passive scores determine the difficulty for player attempts.</p>
                </div>
            </Accordion>

            <div className="mt-8 pt-6 border-t border-brand-primary/20 space-y-8">
                <TagEditor
                    label="Damage Resistances"
                    tags={actor.resistances || []}
                    onTagsChange={(newTags) => onChange(['resistances'], newTags)}
                    options={DAMAGE_TYPES}
                />
                <TagEditor
                    label="Damage Immunities"
                    tags={actor.immunities || []}
                    onTagsChange={(newTags) => onChange(['immunities'], newTags)}
                    options={DAMAGE_TYPES}
                />
                <TagEditor
                    label="Damage Vulnerabilities"
                    tags={actor.vulnerabilities || []}
                    onTagsChange={(newTags) => onChange(['vulnerabilities'], newTags)}
                    options={DAMAGE_TYPES}
                />
            </div>
        </div>
    );
};
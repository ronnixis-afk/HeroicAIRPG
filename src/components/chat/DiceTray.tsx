// components/chat/DiceTray.tsx
import React, { useState } from 'react';
import { DiceRoll } from '../../types';
import { Icon } from '../Icon';
import { EntityLinker } from './EntityLinker';

const DiceRollRow: React.FC<{ roll: DiceRoll }> = ({ roll }) => {
    const isDamage = roll.rollType === 'Damage Roll';
    const isHealing = roll.rollType === 'Healing Roll';
    const isHeroic = roll.isHeroic;

    const outcomeColor = (outcome?: string) => {
        if (isHeroic) return 'text-brand-accent';
        if (!outcome) return 'text-brand-text-muted';
        if (['Success', 'Critical Success', 'Hit', 'Critical Hit'].includes(outcome)) return 'text-brand-accent';
        if (['Fail', 'Critical Fail', 'Miss'].includes(outcome)) return 'text-brand-danger';
        return 'text-brand-text-muted';
    };

    const sign = roll.bonus >= 0 ? ' +' : ' ';
    const dicePart = roll.diceString || 'd20';
    const formula = `(${dicePart}) ${roll.dieRoll}${sign}${Math.abs(roll.bonus)} = ${roll.total}`;

    let damageTypeLabel = '';
    let suffixClass = 'text-brand-text-muted opacity-80 font-normal';

    if (isDamage && roll.checkName) {
        const typeMatch = roll.checkName.match(/\(([^)]+)\)[^()]*$/);
        if (typeMatch) damageTypeLabel = typeMatch[1].toLowerCase();
    }

    let noteTag = '';
    if (roll.notes) {
        const n = roll.notes.toLowerCase();
        if (n.includes('resist')) {
            noteTag = 'Resisted';
            suffixClass = 'text-amber-500 font-normal';
        } else if (n.includes('vuln')) {
            noteTag = 'Vulnerable';
            suffixClass = 'text-brand-danger font-normal';
        } else if (n.includes('immune')) {
            noteTag = 'Immune';
            suffixClass = 'text-brand-text-muted opacity-70 font-normal';
        } else if (n.includes('doubled')) {
            noteTag = n.includes('damage') ? 'Heroic Doubled' : 'Heroic Duration Doubled';
            suffixClass = 'text-brand-accent font-bold';
        } else {
            noteTag = n;
        }
    }

    return (
        <div className="flex justify-between items-center py-1.5 group hover:bg-brand-primary/10 rounded px-2 transition-all font-sans font-normal text-brand-text text-body-sm">
            <div className="flex items-center min-w-0 gap-1.5 flex-grow pr-2">
                {isHeroic && (
                    <span className="text-[8px] font-black text-black bg-brand-accent px-1.5 py-0.5 rounded leading-none tracking-tighter shrink-0 animate-pulse shadow-[0_0_10px_rgba(62,207,142,0.6)]">
                        Heroic
                    </span>
                )}
                <div className="flex items-center gap-1.5 text-brand-text min-w-0 flex-1">
                    {roll.mode && roll.mode !== 'normal' ? (
                        <div className="flex items-center gap-1 bg-brand-primary/50 px-1.5 py-0.5 rounded flex-shrink-0">
                            <span className={roll.mode === 'advantage' ? 'text-brand-accent' : 'text-brand-danger'}>
                                {roll.mode === 'advantage' ? '▲' : '▼'}
                            </span>
                            {roll.rollReason && (
                                <span className="text-[9px] font-normal text-brand-text-muted max-w-[60px] truncate" title={roll.rollReason}>
                                    {roll.rollReason}
                                </span>
                            )}
                        </div>
                    ) : (
                        <Icon name="dice" className={`w-3.5 h-3.5 flex-shrink-0 ${isHeroic ? 'text-brand-accent opacity-100' : 'opacity-40'}`} />
                    )}

                    <span className={`tabular-nums whitespace-nowrap overflow-hidden text-ellipsis font-normal ${isHeroic ? 'text-brand-text font-bold' : ''}`}>
                        {formula}
                        {damageTypeLabel && (
                            <span className={`italic ml-1.5 ${suffixClass}`}>
                                {damageTypeLabel}
                            </span>
                        )}
                        {noteTag && (
                            <span className={`italic ml-1.5 opacity-70 ${suffixClass} capitalize`}>
                                {noteTag}
                            </span>
                        )}
                    </span>
                </div>
            </div>

            <div className="whitespace-nowrap flex-shrink-0 text-right min-w-[70px] flex justify-end">
                {(isDamage || isHealing) && roll.hpChange ? (
                    <div className="flex items-center gap-1.5 pl-1">
                        <span className="text-brand-text-muted text-[10px] font-mono tabular-nums font-normal">{roll.hpChange.previousHp}</span>
                        <span className="text-[10px] text-brand-text-muted opacity-40">➜</span>
                        <span className={`text-[10px] font-bold font-mono tabular-nums ${isHealing ? 'text-brand-accent' : (isHeroic ? 'text-brand-accent' : 'text-brand-danger')}`}>
                            {roll.hpChange.newHp}
                        </span>
                        <span className="text-[10px] ml-0.5 grayscale-[0.2] font-normal">{isHealing ? '💚' : '💔'}</span>
                    </div>
                ) : (
                    <span className={`font-bold tracking-tight ${outcomeColor(roll.outcome)}`}>
                        {roll.outcome}
                    </span>
                )}
            </div>
        </div>
    );
};

const getGroupHeader = (roll: DiceRoll) => {
    const roller = roll.rollerName || 'Someone';
    const target = roll.targetName || 'Target';

    if (roll.rollType === 'Skill Check' || roll.rollType === 'Ability Check') {
        let header = `${roller} ${roll.checkName}`;
        if (roll.dc) header += ` vs Dc ${roll.dc}`;
        return header;
    }
    if (roll.rollType === 'Saving Throw') {
        let header = `${roller} ${roll.checkName} Save`;
        if (roll.dc) header += ` vs Dc ${roll.dc}`;
        return header;
    }

    if (!roll.checkName) return roll.rollType;

    const cleanName = roll.checkName.replace(/\s*\([^)]*\)\s*$/, '').trim();

    let header = `${roller} ${cleanName} vs ${target}`;
    if (roll.rollType === 'Attack Roll' && roll.dc) header += ` Ac ${roll.dc}`;
    else if (roll.dc && !isNaN(Number(roll.dc))) header += ` Dc ${roll.dc}`;

    return header;
};

export const DiceTray: React.FC<{ rolls: DiceRoll[] }> = ({ rolls }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Filter out Encounter Checks as they should be represented in the text logs
    const visibleRolls = rolls.filter(r => r.rollType !== 'Encounter Check');

    if (visibleRolls.length === 0) return null;

    let lastHeader = '';
    return (
        <div className="w-full mt-2 animate-fade-in px-1">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 text-body-sm font-normal text-brand-text-muted hover:text-brand-text transition-all select-none focus:outline-none mb-1.5"
            >
                <span>{isOpen ? 'Hide Rolls' : `Show Rolls (${visibleRolls.length})`}</span>
            </button>
            {isOpen && (
                <div className="space-y-0.5 animate-fade-in">
                    {visibleRolls.map((roll, index) => {
                        const header = getGroupHeader(roll);
                        const showHeader = header !== lastHeader;
                        lastHeader = header;
                        return (
                            <div key={index}>
                                {showHeader && (
                                    <div className="text-[10px] text-brand-text/60 mt-2 mb-0.5 flex items-center gap-1 w-full font-normal border-b border-brand-primary/10 pb-0.5">
                                        <span>{header}</span>
                                    </div>
                                )}
                                <DiceRollRow roll={roll} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

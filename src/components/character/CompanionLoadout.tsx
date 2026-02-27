
// components/character/CompanionLoadout.tsx

import React, { useMemo } from 'react';
import { PlayerCharacter, Companion } from '../../types';
import { Icon } from '../Icon';

interface CombatLoadoutProps {
    character: PlayerCharacter | Companion;
    onChange: (path: (string | number)[], value: any) => void;
}

export const CombatLoadout: React.FC<CombatLoadoutProps> = ({ character, onChange }) => {
    const validAbilities = useMemo(() => {
        return (character.abilities || []).filter(a => a.effect && (a.effect.type === 'Damage' || a.effect.type === 'Heal' || a.effect.type === 'Status'));
    }, [character.abilities]);

    const selectClass = "w-full input-md appearance-none text-body-base font-bold transition-all cursor-pointer";

    return (
        <div className="p-5 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-brand-text-muted ml-1">Primary Action</label>
                    <div className="relative group">
                        <select
                            value={character.combatLoadout?.primaryAbilityId || ''}
                            onChange={(e) => onChange(['combatLoadout', 'primaryAbilityId'], e.target.value)}
                            className={selectClass}
                        >
                            <option value="">None (Empty slot)</option>
                            <option value="basic_attack" className="text-brand-accent font-bold">Basic weapon attack</option>
                            {validAbilities.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted group-hover:text-brand-accent transition-colors">
                            <Icon name="chevronDown" className="w-4 h-4" />
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-brand-text-muted ml-1">Secondary Action</label>
                    <div className="relative group">
                        <select
                            value={character.combatLoadout?.secondaryAbilityId || ''}
                            onChange={(e) => onChange(['combatLoadout', 'secondaryAbilityId'], e.target.value)}
                            className={selectClass}
                        >
                            <option value="">None (Empty slot)</option>
                            <option value="basic_attack" className="text-brand-accent font-bold">Basic weapon attack</option>
                            {validAbilities.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted group-hover:text-brand-accent transition-colors">
                            <Icon name="chevronDown" className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

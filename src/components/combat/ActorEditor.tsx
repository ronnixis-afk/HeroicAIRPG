// components/combat/ActorEditor.tsx

import React, { useState, useEffect } from 'react';
import type { CombatActor, CombatActorAttack, CombatActorSpecialAbility, AffinityDefinition, ArchetypeName, EnemyTemplate } from '../../types';
import { recalculateCombatActorStats, DEFAULT_ARCHETYPE_DEFINITIONS } from '../../utils/mechanics';
import { Icon } from '../Icon';
import { ActorIdentity } from './ActorIdentity';
import { ActorStats } from './ActorStats';
import { ActorActions } from './ActorActions';

interface ActorEditorProps {
    actor: CombatActor;
    onUpdate: (updatedActor: CombatActor) => void;
    onDelete: (actorId: string) => void;
    onDuplicate: (actorId: string) => void;
    affinities: Record<string, AffinityDefinition>;
    templates: Record<string, EnemyTemplate>;
    playerLevel: number;
    baseScore: number;
    archetypeDefinitions?: Record<ArchetypeName, { ground: number, climb: number, swim: number, fly: number }>;
}

export const ActorEditor: React.FC<ActorEditorProps> = ({ 
    actor, 
    onUpdate, 
    onDelete, 
    onDuplicate, 
    affinities, 
    templates,
    playerLevel, 
    baseScore, 
    archetypeDefinitions 
}) => {
    const [localActor, setLocalActor] = useState(actor);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        setLocalActor(actor);
        setSaveSuccess(false);
    }, [actor.id]); 

    const handleChange = <T,>(keys: (string | number)[], value: T) => {
        setLocalActor(prev => {
            const newActorData = JSON.parse(JSON.stringify(prev));
            let currentLevel: any = newActorData;
            for (let i = 0; i < keys.length - 1; i++) {
                 if (currentLevel[keys[i]] === undefined && value !== undefined) {
                    currentLevel[keys[i]] = (typeof keys[i+1] === 'number') ? [] : {};
                }
                currentLevel = currentLevel[keys[i]];
            }
            const changedKey = keys[keys.length - 1];
            
            if (value === undefined) {
                delete currentLevel[changedKey];
            } else {
                currentLevel[changedKey] = value;
            }
            
            // Logic for mutual exclusivity of affinities
            if (changedKey === 'resistances') {
                const newVals = value as unknown as string[];
                newActorData.immunities = (newActorData.immunities || []).filter((t: string) => !newVals.includes(t));
                newActorData.vulnerabilities = (newActorData.vulnerabilities || []).filter((t: string) => !newVals.includes(t));
            } else if (changedKey === 'immunities') {
                const newVals = value as unknown as string[];
                newActorData.resistances = (newActorData.resistances || []).filter((t: string) => !newVals.includes(t));
                newActorData.vulnerabilities = (newActorData.vulnerabilities || []).filter((t: string) => !newVals.includes(t));
            } else if (changedKey === 'vulnerabilities') {
                const newVals = value as unknown as string[];
                newActorData.resistances = (newActorData.resistances || []).filter((t: string) => !newVals.includes(t));
                newActorData.immunities = (newActorData.immunities || []).filter((t: string) => !newVals.includes(t));
            }
            
            const parentKey = keys[0];
            // Recalculate stats if CR, Rank, Is Ship, or Base Scores change
            if (parentKey === 'challengeRating' || parentKey === 'rank' || parentKey === 'isShip' || (parentKey === 'abilityScores' && changedKey === 'score')) {
                return recalculateCombatActorStats(newActorData, templates, baseScore);
            }
            
            return newActorData;
        });
        setSaveSuccess(false);
    };
    
    const handleAffinityChange = (affinityName: string) => {
        setLocalActor(prev => {
            const newActorData = { ...prev, affinity: affinityName };
            const affinityDef = affinities[affinityName];
            
            if (affinityDef) {
                newActorData.resistances = [...affinityDef.resistances];
                newActorData.immunities = [...affinityDef.immunities];
                newActorData.vulnerabilities = [...affinityDef.vulnerabilities];
            } else if (!affinityName) {
                newActorData.resistances = [];
                newActorData.immunities = [];
                newActorData.vulnerabilities = [];
            }
            return newActorData;
        });
        setSaveSuccess(false);
    };
    
    const handleShipToggle = (isShip: boolean) => {
        setLocalActor(prev => {
            const newActor = { ...prev, isShip };
            // Delegate mechanical scaling to central utility
            return recalculateCombatActorStats(newActor, templates, baseScore);
        });
        setSaveSuccess(false);
    };
    
    const handleAddAttack = () => {
        const newAttack: CombatActorAttack = { name: 'New Attack', toHitBonus: 0, damageDice: '1d6', damageType: 'Bludgeoning', ability: 'strength' };
        const potentialState = { ...localActor, attacks: [...(localActor.attacks || []), newAttack] };
        setLocalActor(recalculateCombatActorStats(potentialState, templates, baseScore));
        setSaveSuccess(false);
    };
    
    const handleRemoveAttack = (index: number) => {
        handleChange(['attacks'], (localActor.attacks || []).filter((_, i) => i !== index));
    };

    const handleAddSpecialAbility = () => {
        const newAbility: CombatActorSpecialAbility = { name: 'New Ability', description: '', type: 'Damage', dc: 10, saveAbility: 'dexterity', saveEffect: 'half', targetType: 'Single', damageType: 'Fire' };
         const potentialState = { ...localActor, specialAbilities: [...(localActor.specialAbilities || []), newAbility] };
        setLocalActor(recalculateCombatActorStats(potentialState, templates, baseScore));
        setSaveSuccess(false);
    };
    
    const handleRemoveSpecialAbility = (index: number) => {
        handleChange(['specialAbilities'], (localActor.specialAbilities || []).filter((_, i) => i !== index));
    };
    
    const handleSave = () => {
        onUpdate(localActor);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${actor.name}?`)) {
            onDelete(actor.id);
        }
    };
    
    const handleDuplicate = () => {
        onDuplicate(actor.id);
    };

    const isDefeated = (localActor.currentHitPoints ?? 0) <= 0;

    return (
        <div className={`space-y-6 ${isDefeated ? 'opacity-80 grayscale-[0.5]' : ''}`}>
            
            <ActorIdentity 
                actor={localActor} 
                onChange={handleChange} 
                onAffinityChange={handleAffinityChange} 
                onShipToggle={handleShipToggle}
                affinities={affinities}
                playerLevel={playerLevel}
                archetypeDefinitions={archetypeDefinitions || DEFAULT_ARCHETYPE_DEFINITIONS}
            />

            <ActorStats 
                actor={localActor} 
                onChange={handleChange} 
            />

            <ActorActions 
                actor={localActor} 
                onChange={handleChange} 
                onAddAttack={handleAddAttack} 
                onRemoveAttack={handleRemoveAttack}
                onAddAbility={handleAddSpecialAbility}
                onRemoveAbility={handleRemoveSpecialAbility}
            />

            <div className="flex justify-between items-center pt-6 pb-2 min-h-[60px]">
                <div className="flex gap-2">
                    <button onClick={handleDelete} className="text-brand-danger hover:text-red-300 text-body-sm font-bold hover:underline flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-brand-danger/10 transition-colors" title="Delete Actor">
                        <Icon name="trash" className="w-4 h-4" />
                        <span>Delete Actor</span>
                    </button>
                    <button onClick={handleDuplicate} className="text-brand-text-muted hover:text-brand-text text-body-sm font-bold flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-brand-primary transition-colors" title="Duplicate Actor">
                        <Icon name="copy" className="w-4 h-4" />
                        <span>Duplicate Actor</span>
                    </button>
                </div>
                
                {saveSuccess ? (
                    <div className="text-brand-accent font-bold px-6 py-3 rounded-xl text-body-base flex items-center gap-2 border border-brand-accent/30 bg-brand-accent/10">
                        <Icon name="check" className="w-4 h-4" /> <span>Saved!</span>
                    </div>
                ) : (
                    <button onClick={handleSave} className="btn-primary btn-md px-8 rounded-xl shadow-lg shadow-brand-accent/20">
                        Save Changes
                    </button>
                )}
            </div>
        </div>
    );
};
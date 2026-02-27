import React from 'react';
import { StatusEffect, STATUS_EFFECT_NAMES } from '../types';
import { Icon } from './Icon';

interface StatusEffectsEditorProps {
    statusEffects: StatusEffect[];
    onStatusEffectsChange: (newEffects: StatusEffect[]) => void;
}

const StatusEffectsEditor: React.FC<StatusEffectsEditorProps> = ({ statusEffects, onStatusEffectsChange }) => {

    const handleAddEffect = () => {
        const existingNames = new Set(statusEffects.map(e => e.name));
        const availableEffect = STATUS_EFFECT_NAMES.find(name => !existingNames.has(name));

        if (availableEffect) {
            onStatusEffectsChange([...statusEffects, { name: availableEffect, duration: 1 }]);
        }
    };

    const handleRemoveEffect = (index: number) => {
        onStatusEffectsChange(statusEffects.filter((_, i) => i !== index));
    };

    const handleUpdateEffect = (index: number, field: keyof StatusEffect, value: string | number) => {
        const newEffects = [...statusEffects];
        const effectToUpdate = { ...newEffects[index] };

        if (field === 'name') {
            const newName = value as StatusEffect['name'];
            const isDuplicate = newEffects.some((effect, i) => i !== index && effect.name === newName);
            if (!isDuplicate) {
                effectToUpdate.name = newName;
            }
        } else if (field === 'duration') {
            effectToUpdate.duration = Math.max(0, parseInt(value as string, 10) || 0);
        }

        newEffects[index] = effectToUpdate;
        onStatusEffectsChange(newEffects);
    };

    return (
        <div className="bg-brand-primary/10 p-4 rounded-2xl space-y-4 border border-brand-primary/30 shadow-inner">
            <div className="space-y-3">
                <div className="grid grid-cols-12 gap-x-4 px-2">
                    <label className="col-span-6 text-[10px] font-black text-brand-text-muted tracking-normal">Effect</label>
                    <label className="col-span-4 text-[10px] font-black text-brand-text-muted tracking-normal">Rounds</label>
                </div>
                {statusEffects.map((effect, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-center bg-brand-surface/40 p-2 rounded-xl border border-brand-primary/50 shadow-sm animate-fade-in">
                        <div className="col-span-6">
                            <div className="relative">
                                <select
                                    value={effect.name}
                                    onChange={(e) => handleUpdateEffect(index, 'name', e.target.value)}
                                    className="w-full bg-brand-primary h-10 px-3 rounded-lg border border-brand-surface focus:border-brand-accent appearance-none text-body-sm font-bold cursor-pointer"
                                >
                                    {STATUS_EFFECT_NAMES.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-brand-text-muted opacity-40">
                                    <Icon name="chevronDown" className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>
                        <div className="col-span-4">
                            <input
                                type="number"
                                value={effect.duration}
                                onChange={(e) => handleUpdateEffect(index, 'duration', e.target.value)}
                                className="w-full bg-brand-primary h-10 px-2 rounded-lg border border-brand-surface focus:border-brand-accent text-center text-body-base font-black tabular-nums shadow-inner"
                            />
                        </div>
                        <div className="col-span-2 flex justify-end">
                            <button
                                onClick={() => handleRemoveEffect(index)}
                                className="btn-icon-delete p-2 rounded-lg shadow-sm"
                                aria-label={`Remove ${effect.name} effect`}
                            >
                                <Icon name="trash" className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {statusEffects.length < STATUS_EFFECT_NAMES.length && (
                <button
                    onClick={handleAddEffect}
                    className="btn-secondary btn-sm w-full gap-2 rounded-xl"
                >
                    <Icon name="plus" className="w-3.5 h-3.5" /> 
                    <span>Add Status Effect</span>
                </button>
            )}

            {statusEffects.length === 0 && (
                <p className="text-center text-body-sm italic text-brand-text-muted py-4 opacity-40">No active status effects.</p>
            )}
        </div>
    );
};

export default StatusEffectsEditor;
import React from 'react';
import { Icon } from '../../Icon';
import { SelectField } from './ForgeShared';
import { ForgeGroup } from '../../../types';

const SCALE_OPTIONS = ['Person', 'Mount', 'Ship'];
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

interface ForgeHeaderProps {
    forgeScale: string;
    setForgeScale: (scale: string) => void;
    baseGroup: string;
    onCategorySelect: (id: string) => void;
    baseSubtype: string | null;
    setBaseSubtype: (subtype: string | null) => void;
    selectedRarity: string;
    setSelectedRarity: (rarity: string) => void;
    onRandomize: () => void;
    filteredGroups: ForgeGroup[];
    activeGroupData?: ForgeGroup;
    randomizedSummary?: string | null;
}

export const ForgeHeader: React.FC<ForgeHeaderProps> = ({
    forgeScale,
    setForgeScale,
    baseGroup,
    onCategorySelect,
    baseSubtype,
    setBaseSubtype,
    selectedRarity,
    setSelectedRarity,
    onRandomize,
    filteredGroups,
    activeGroupData,
    randomizedSummary
}) => {
    return (
        <div className="bg-brand-surface p-6 rounded-2xl border border-brand-primary/50 shadow-xl">
            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                <SelectField label="Scale" value={forgeScale} onChange={setForgeScale} options={SCALE_OPTIONS} />
                <SelectField label="Item Category" value={baseGroup} onChange={onCategorySelect} options={filteredGroups} />
                
                <div className={activeGroupData?.subtypes ? '' : 'opacity-40 pointer-events-none'}>
                    <SelectField 
                        label="Base Variant" 
                        value={baseSubtype || ''} 
                        onChange={setBaseSubtype} 
                        options={activeGroupData?.subtypes || []}
                        placeholder={activeGroupData?.subtypes ? undefined : "None Available"}
                    />
                </div>
                <SelectField label="Tier / Rarity" value={selectedRarity} onChange={setSelectedRarity} options={RARITIES} />
            </div>

            <div className="flex flex-col items-center pt-10">
                <button 
                    onClick={onRandomize} 
                    disabled={!baseGroup} 
                    className="btn-secondary btn-md w-full sm:w-64 gap-2"
                >
                    <Icon name="sparkles" className="w-4 h-4" /> 
                    <span>Randomize</span>
                </button>
                {randomizedSummary && (
                    <div className="mt-6 px-4 text-center animate-fade-in bg-brand-primary/20 py-3 rounded-xl border border-brand-surface w-full max-w-sm">
                        <p className="text-body-sm font-bold text-brand-text leading-relaxed capitalize">
                            {randomizedSummary}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
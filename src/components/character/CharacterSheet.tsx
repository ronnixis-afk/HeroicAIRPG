// components/character/CharacterSheet.tsx

import React, { useContext, useState, useEffect, useMemo } from 'react';
/* Fix: Import GameDataContextType to ensure proper type inference for context values */
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import {
    PlayerCharacter,
    Companion,
    calculateModifier,
} from '../../types';
import { generateCharacterImage } from '../../services/imageGenerationService';
import { Icon } from '../Icon';
import StatusEffectsEditor from '../StatusEffectsEditor';
import { BuffsEditor } from '../BuffsEditor';
import { KeywordEditor } from '../KeywordEditor';
import { getHalfwayXP, calculateCharacterMaxHp } from '../../utils/mechanics';

// Sub-components
import { CharacterHeader } from './CharacterHeader';
import { CombatStats } from './CombatStats';
import { AbilityScores } from './AbilityScores';
import { SkillsList } from './SkillsList';
import { FeaturesList } from './FeaturesList';

const calculateProficiencyBonus = (level: number) => Math.ceil(1 + level / 4);

interface CharacterSheetProps {
    initialData: PlayerCharacter | Companion;
    type: 'player' | 'companion';
}

type CharSection = 'General' | 'Stats' | 'Defenses' | 'Abilities';

const TabButton: React.FC<{ label: string, isActive: boolean, onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center justify-center btn-md font-bold transition-all duration-200 focus:outline-none ${isActive
            ? 'bg-brand-accent text-black shadow-lg shadow-brand-accent/20'
            : 'bg-brand-primary/40 text-brand-text hover:bg-brand-primary/60'
            }`}
    >
        {label}
    </button>
);

export const CharacterSheet: React.FC<CharacterSheetProps> = ({ initialData, type }) => {
    /* Fix: Explicitly cast GameDataContext result to GameDataContextType to resolve multiple "Property does not exist" errors on inferred return type */
    const {
        gameData,
        updatePlayerCharacter,
        updateCompanion,
        deleteCompanion,
    } = useContext(GameDataContext) as GameDataContextType;

    const { setUnsavedChanges } = useUI();

    const [charData, setCharData] = useState(initialData);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [generationError, setGenerationError] = useState('');
    const [imageCooldown, setImageCooldown] = useState(0);

    const [activeSection, setActiveSection] = useState<CharSection>('General');

    const setting = useMemo(() => gameData?.mapSettings?.style || 'fantasy', [gameData?.mapSettings]);

    useEffect(() => {
        setCharData(initialData);
        setIsDirty(false);
    }, [initialData]);

    useEffect(() => {
        if (initialData && charData) {
            const pruneForComparison = (d: any) => {
                // Derived fields that shouldn't trigger "Unsaved Changes"
                const { proficiencyBonus, maxHitPoints, numberOfAttacks, ...rest } = d;
                return JSON.stringify(rest);
            };

            const hasChanges = pruneForComparison(initialData) !== pruneForComparison(charData);
            setIsDirty(hasChanges);

            if (hasChanges) {
                setUnsavedChanges({
                    id: charData.id,
                    name: charData.name,
                    type: type,
                    data: charData
                });
            } else {
                setUnsavedChanges(null);
            }
        }

        return () => setUnsavedChanges(null);
    }, [charData, initialData, setUnsavedChanges, type]);

    useEffect(() => {
        const newProficiencyBonus = calculateProficiencyBonus(charData.level);
        const newAttackCount = Math.ceil(charData.level / 5);
        if (charData.proficiencyBonus !== newProficiencyBonus || charData.numberOfAttacks !== newAttackCount) {
            setCharData(prev => {
                const updatedData = {
                    ...prev,
                    proficiencyBonus: newProficiencyBonus,
                    numberOfAttacks: newAttackCount
                };
                return type === 'player' ? new PlayerCharacter(updatedData) : new Companion(updatedData);
            });
        }
    }, [charData.level, charData.proficiencyBonus, charData.numberOfAttacks, type]);

    const inventoryForStats = useMemo(() => {
        if (!gameData) return { equipped: [], carried: [], storage: [], assets: [] } as any;
        if (type === 'player' || !gameData.companionInventories) {
            return gameData.playerInventory;
        }
        return gameData.companionInventories[initialData.id] || { equipped: [], carried: [], storage: [], assets: [] };
    }, [type, gameData, initialData.id]);

    useEffect(() => {
        // CULPRIT FIX: Use getBuffedScore to include active buffs and items in the health calculation
        const conScore = charData.getBuffedScore('constitution', inventoryForStats);
        let newMaxHp: number;

        if (type === 'companion' && (charData as Companion).isShip) {
            const conMod = calculateModifier(conScore);
            const hpPerLevel = Math.max(1, 20 + (2 * conMod));
            newMaxHp = hpPerLevel * charData.level;
        } else {
            newMaxHp = calculateCharacterMaxHp(charData.level, conScore);
        }

        if (charData.maxHitPoints !== newMaxHp) {
            setCharData(prev => {
                const updatedData = { ...prev, maxHitPoints: newMaxHp };
                if (updatedData.currentHitPoints > newMaxHp) {
                    updatedData.currentHitPoints = newMaxHp;
                }
                return type === 'player' ? new PlayerCharacter(updatedData) : new Companion(updatedData);
            });
        }
    }, [charData.level, charData.abilityScores, charData.activeBuffs, charData.abilities, inventoryForStats, charData.maxHitPoints, charData.currentHitPoints, type]);

    useEffect(() => {
        if (imageCooldown > 0) {
            const timer = setTimeout(() => setImageCooldown(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [imageCooldown]);

    const availableRaces = useMemo(() => {
        if (!gameData?.world) return ['Human', 'Elf', 'Dwarf', 'Orc', 'Other', 'Unknown'];
        const racesFromLore = gameData.world
            .filter(l => l.tags?.includes('race'))
            .map(l => l.title)
            .sort();
        const defaults = racesFromLore.length === 0 ? ['Human', 'Elf', 'Dwarf', 'Orc'] : racesFromLore;
        return Array.from(new Set([...defaults, 'Other', 'Unknown']));
    }, [gameData?.world]);

    const { totalResistances, totalImmunities, totalVulnerabilities } = useMemo(() => {
        const itemBuffs = inventoryForStats.equipped.flatMap((i: any) => i.buffs || []);
        const abilityBuffs = charData.abilities.flatMap((a: any) => a.buffs || []);
        const allBuffs = [...itemBuffs, ...abilityBuffs];

        const derivedResistances = allBuffs.filter(b => b.type === 'resistance' && b.damageType).map(b => b.damageType!);
        const derivedImmunities = allBuffs.filter(b => b.type === 'immunity' && b.damageType).map(b => b.damageType!);

        return {
            totalResistances: Array.from(new Set([...(charData.resistances || []), ...derivedResistances])),
            totalImmunities: Array.from(new Set([...(charData.immunities || []), ...derivedImmunities])),
            totalVulnerabilities: charData.vulnerabilities || []
        };
    }, [charData, inventoryForStats]);

    const handleNestedChange = (path: (string | number)[], value: any) => {
        setCharData(prev => {
            const newCharData = JSON.parse(JSON.stringify(prev));
            let currentLevel: any = newCharData;
            for (let i = 0; i < path.length - 1; i++) {
                if (currentLevel[path[i]] === undefined && value !== undefined) {
                    currentLevel[path[i]] = {};
                }
                currentLevel = currentLevel[path[i]];
            }
            const finalKey = path[path.length - 1];
            if (value === undefined) {
                delete currentLevel[finalKey];
            } else {
                currentLevel[finalKey] = value;
            }
            return type === 'player' ? new PlayerCharacter(newCharData) : new Companion(newCharData);
        });
    };

    const handleLevelChange = (newLevel: number) => {
        const validLevel = Math.max(1, Math.min(20, newLevel));
        const halfwayXP = getHalfwayXP(validLevel);

        setCharData(prev => {
            const baseData = { ...prev, level: validLevel, experiencePoints: halfwayXP };
            return type === 'player' ? new PlayerCharacter(baseData) : new Companion(baseData);
        });
    };

    const handleSave = async () => {
        if (charData) {
            setIsSaving(true);
            setSaveSuccess(false);
            const isCompanion = type === 'companion';
            if (!isCompanion) await updatePlayerCharacter(charData as PlayerCharacter);
            else await updateCompanion(charData as Companion);

            setIsSaving(false);
            setSaveSuccess(true);
            setIsDirty(false);
            setUnsavedChanges(null);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleNestedChange(['imageUrl'], reader.result as string);
                handleNestedChange(['appearance'], 'As Image');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRegenerateImage = async () => {
        if (!charData.appearance) {
            setGenerationError("Please provide an appearance description first.");
            return;
        }
        setIsGeneratingImage(true);
        setGenerationError('');
        try {
            const equippedItems = inventoryForStats.equipped;
            const imageBytes = await generateCharacterImage(charData.appearance, equippedItems, setting as any, gameData?.isMature ?? false);
            if (imageBytes) {
                handleNestedChange(['imageUrl'], `data:image/jpeg;base64,${imageBytes}`);
            } else {
                throw new Error("Received no image data.");
            }
        } catch (error) {
            console.error(error);
            setGenerationError("Failed to generate image. Please try again.");
            setImageCooldown(15);
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleDelete = () => {
        if (type === 'companion' && window.confirm(`Are you sure you want to remove ${charData.name}?`)) {
            deleteCompanion(charData.id);
        }
    };

    const isDead = charData.currentHitPoints <= 0;
    const isLowHp = !isDead && charData.currentHitPoints / charData.maxHitPoints <= 0.25;

    const isVehicleOrMount = (charData as Companion).isShip || (charData as Companion).isMount;

    return (
        <div className="animate-fade-in relative">
            {/* Top Bar Controls for Companions */}
            {type === 'companion' && (
                <div className="flex items-center mb-3 px-1 gap-2 py-1.5">
                    <div className="flex-1 flex justify-center">
                        <label className="flex items-center cursor-pointer transition-opacity hover:opacity-80 p-2">
                            <input
                                type="checkbox"
                                checked={(charData as Companion).isShip || false}
                                onChange={(e) => {
                                    handleNestedChange(['isShip'], e.target.checked);
                                    if (e.target.checked) handleNestedChange(['isMount'], false);
                                    if (!e.target.checked && !(charData as Companion).isMount) {
                                        handleNestedChange(['isSentient'], false);
                                    }
                                }}
                                className="custom-checkbox"
                            />
                            <span className="ml-2 text-body-sm font-bold text-brand-text-muted select-none">Vehicle</span>
                        </label>
                    </div>

                    <div className="flex-1 flex justify-center">
                        <label className="flex items-center cursor-pointer transition-opacity hover:opacity-80 p-2">
                            <input
                                type="checkbox"
                                checked={(charData as Companion).isMount || false}
                                onChange={(e) => {
                                    handleNestedChange(['isMount'], e.target.checked);
                                    if (e.target.checked) handleNestedChange(['isShip'], false);
                                    if (!e.target.checked && !(charData as Companion).isShip) {
                                        handleNestedChange(['isSentient'], false);
                                    }
                                }}
                                className="custom-checkbox"
                            />
                            <span className="ml-2 text-body-sm font-bold text-brand-text-muted select-none">Mount</span>
                        </label>
                    </div>

                    <div
                        className={`transition-all duration-500 ease-in-out flex justify-center overflow-hidden ${isVehicleOrMount ? 'flex-1 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                    >
                        <div className="px-4 py-2">
                            <label className="flex items-center cursor-pointer transition-opacity hover:opacity-80 whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    checked={(charData as Companion).isSentient || false}
                                    onChange={(e) => handleNestedChange(['isSentient'], e.target.checked)}
                                    className="custom-checkbox"
                                />
                                <span className="ml-2 text-body-sm font-bold text-brand-text-muted select-none">Sentient</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex-1 flex justify-center">
                        <button
                            onClick={handleDelete}
                            className="text-brand-danger hover:opacity-80 text-body-sm font-bold flex items-center gap-1.5 transition-all p-2"
                        >
                            <Icon name="trash" className="w-4 h-4" />
                            Remove
                        </button>
                    </div>
                </div>
            )}

            {/* Portrait Section */}
            <div className="flex flex-col items-center mb-6">
                <div className="relative w-full aspect-square bg-brand-primary rounded-2xl flex items-center justify-center overflow-hidden mb-6 border-2 border-brand-surface shadow-2xl">
                    <div className={`w-full h-full flex items-center justify-center ${isDead ? 'grayscale brightness-50' : ''}`}>
                        {isGeneratingImage ? (
                            <div className="flex flex-col items-center text-brand-text-muted">
                                <Icon name="spinner" className="w-10 h-10 animate-spin mb-2 text-brand-accent" />
                                <span className="text-body-sm">Generating...</span>
                            </div>
                        ) : charData.imageUrl ? (
                            <img src={charData.imageUrl} alt={charData.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center text-brand-text-muted p-4">
                                <Icon name="character" className="w-24 h-24 mx-auto mb-2" />
                                <span className="text-body-sm">No image</span>
                            </div>
                        )}
                    </div>
                    {isLowHp && (
                        <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none" />
                    )}
                </div>
                <div className="flex gap-3">
                    <label className="btn-secondary btn-md cursor-pointer">
                        Upload
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                    <button
                        onClick={handleRegenerateImage}
                        disabled={isGeneratingImage || !charData.appearance || imageCooldown > 0}
                        className="btn-primary btn-md w-40 flex items-center justify-center gap-2"
                    >
                        {isGeneratingImage ? (
                            <Icon name="spinner" className="w-4 h-4 animate-spin text-black" />
                        ) : imageCooldown > 0 ? (
                            `Wait (${imageCooldown}s)`
                        ) : (
                            <>
                                <Icon name="refresh" className="w-4 h-4" />
                                Regenerate
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Navigation Grid */}
            <div className="mt-8 mb-12 py-8 border-y border-brand-primary/30">
                <div className="grid grid-cols-4 gap-3">
                    <TabButton label="General" isActive={activeSection === 'General'} onClick={() => setActiveSection('General')} />
                    <TabButton label="Stats" isActive={activeSection === 'Stats'} onClick={() => setActiveSection('Stats')} />
                    <TabButton label="Defenses" isActive={activeSection === 'Defenses'} onClick={() => setActiveSection('Defenses')} />
                    <TabButton label="Abilities" isActive={activeSection === 'Abilities'} onClick={() => setActiveSection('Abilities')} />
                </div>
            </div>

            {/* Active Content Section */}
            <div className="min-h-[400px]">
                {activeSection === 'General' && (
                    <div className="space-y-12 animate-fade-in">
                        <CharacterHeader
                            character={charData}
                            onChange={handleNestedChange}
                            isGeneratingImage={isGeneratingImage}
                            imageCooldown={imageCooldown}
                            onRegenerateImage={() => { }}
                            onImageUpload={handleImageUpload}
                            isCompanion={type === 'companion'}
                            availableRaces={availableRaces}
                            hideImageSection={true}
                        />
                        <div className="pt-4">
                            <CombatStats
                                character={charData}
                                inventory={inventoryForStats}
                                onChange={handleNestedChange}
                                onLevelChange={handleLevelChange}
                                isOpen={false}
                                onToggle={() => { }}
                                resistances={totalResistances}
                                immunities={totalImmunities}
                                vulnerabilities={totalVulnerabilities}
                                hideDefenses={true}
                            />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-brand-text mb-2 px-1">Current status</h3>
                            <StatusEffectsEditor
                                statusEffects={charData.statusEffects || []}
                                onStatusEffectsChange={(newEffects) => handleNestedChange(['statusEffects'], newEffects)}
                            />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-brand-text mb-2 px-1">Active Buffs</h3>
                            <BuffsEditor
                                activeBuffs={charData.activeBuffs || []}
                                onBuffsChange={(newBuffs) => handleNestedChange(['activeBuffs'], newBuffs)}
                            />
                        </div>
                        <KeywordEditor
                            keywords={charData.keywords || []}
                            onKeywordsChange={(newKeywords) => handleNestedChange(['keywords'], newKeywords)}
                        />
                    </div>
                )}

                {activeSection === 'Stats' && (
                    <div className="animate-fade-in space-y-12">
                        <AbilityScores
                            character={charData}
                            inventory={inventoryForStats}
                            onChange={handleNestedChange}
                            scoresOpen={true}
                            savesOpen={false}
                            toggleScores={() => { }}
                            toggleSaves={() => { }}
                            hideSaves={true}
                        />
                        <SkillsList
                            character={charData}
                            inventory={inventoryForStats}
                            onChange={handleNestedChange}
                            isOpen={true}
                            onToggle={() => { }}
                            config={gameData?.skillConfiguration || 'Fantasy'}
                        />
                    </div>
                )}

                {activeSection === 'Defenses' && (
                    <div className="animate-fade-in space-y-12">
                        <AbilityScores
                            character={charData}
                            inventory={inventoryForStats}
                            onChange={handleNestedChange}
                            scoresOpen={false}
                            savesOpen={true}
                            toggleScores={() => { }}
                            toggleSaves={() => { }}
                            hideScores={true}
                        />
                        <CombatStats
                            character={charData}
                            inventory={inventoryForStats}
                            onChange={handleNestedChange}
                            onLevelChange={handleLevelChange}
                            isOpen={true}
                            onToggle={() => { }}
                            resistances={totalResistances}
                            immunities={totalImmunities}
                            vulnerabilities={totalVulnerabilities}
                            hideSummary={true}
                        />
                    </div>
                )}

                {activeSection === 'Abilities' && (
                    <div className="animate-fade-in">
                        <FeaturesList
                            character={charData}
                            inventory={inventoryForStats}
                            onChange={handleNestedChange}
                            isOpen={true}
                            onToggle={() => { }}
                            skillConfig={gameData?.skillConfiguration}
                        />
                    </div>
                )}
            </div>

            <div className="h-32" />

            {/* Floating Save Toaster */}
            <div
                className={`fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xs transition-all duration-500 ease-out z-[60] ${isDirty ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
                    }`}
            >
                <div className="bg-brand-surface border border-brand-accent/20 rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-4 backdrop-blur-xl">
                    <div className="text-center">
                        <span className="text-[10px] font-bold text-brand-accent tracking-normal">Unsaved Changes</span>
                        <p className="text-body-base text-brand-text font-bold truncate max-w-[200px] mt-1">{charData.name}</p>
                    </div>

                    <div className="w-full flex flex-col items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="btn-primary btn-md w-full"
                        >
                            {isSaving ? 'Saving...' : 'Save changes'}
                        </button>

                        {saveSuccess && (
                            <div className="text-brand-accent text-body-sm font-bold animate-fade-in">
                                Saved
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {generationError && <p className="text-brand-danger text-center text-body-sm mt-4 font-bold">{generationError}</p>}
        </div>
    );
};
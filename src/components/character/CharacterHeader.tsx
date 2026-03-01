import React from 'react';
import { PlayerCharacter, Companion } from '../../types';
import { getXPForLevel, getNextLevelXP } from '../../utils/mechanics';
import { getGoodEvilLabel, getLawChaosLabel, GOOD_EVIL_ALIASES, LAW_CHAOS_ALIASES } from '../../utils/npcUtils';
import { Icon } from '../Icon';
import { InputField, SelectField, TextareaField } from './FormFields';

interface CharacterHeaderProps {
    character: PlayerCharacter | Companion;
    onChange: (path: (string | number)[], value: any) => void;
    isGeneratingImage: boolean;
    imageCooldown: number;
    onRegenerateImage: () => void;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isCompanion: boolean;
    onLevelChange?: (level: number) => void;
    availableRaces: string[];
    hideImageSection?: boolean;
}

export const CharacterHeader: React.FC<CharacterHeaderProps> = ({
    character,
    onChange,
    isGeneratingImage,
    imageCooldown,
    onRegenerateImage,
    onImageUpload,
    isCompanion,
    availableRaces,
    hideImageSection = false
}) => {
    const currentXP = character.experiencePoints || 0;
    const prevLevelXP = getXPForLevel(character.level);
    const nextLevelXP = getNextLevelXP(character.level);

    let xpPercentage = 0;
    if (currentXP < prevLevelXP) {
        xpPercentage = nextLevelXP > 0 ? (currentXP / nextLevelXP) * 100 : 0;
    } else {
        const xpRange = nextLevelXP - prevLevelXP;
        const xpProgress = currentXP - prevLevelXP;
        xpPercentage = xpRange > 0 ? (xpProgress / xpRange) * 100 : 100;
    }
    xpPercentage = Math.min(100, Math.max(0, xpPercentage));

    const isCustomRace = !availableRaces.includes(character.race) && character.race !== 'Unknown';

    // HEROIC POTENTIAL VISUALIZATION
    // HEROIC POTENTIAL VISUALIZATION
    const showHeroicPoints = !isCompanion;
    const currentHeroic = showHeroicPoints ? (character as PlayerCharacter).heroicPoints : 0;
    const maxHeroic = showHeroicPoints ? (character as PlayerCharacter).maxHeroicPoints : 0;

    return (
        <div>
            {/* Image Section */}
            {!hideImageSection && (
                <div className="mb-6 flex flex-col items-center">
                    <div className="w-full aspect-square bg-brand-primary rounded-xl flex items-center justify-center overflow-hidden mb-6 border-2 border-brand-surface shadow-lg">
                        {isGeneratingImage ? (
                            <div className="flex flex-col items-center text-brand-text-muted">
                                <Icon name="spinner" className="w-10 h-10 animate-spin mb-2 text-brand-accent" />
                                <span className="text-body-sm">Generating...</span>
                            </div>
                        ) : character.imageUrl ? (
                            <img src={character.imageUrl} alt={character.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center text-brand-text-muted p-4">
                                <Icon name="character" className="w-24 h-24 mx-auto mb-2 opacity-20" />
                                <span className="text-body-sm">No image</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <label className="btn-secondary btn-sm cursor-pointer">
                            Upload
                            <input type="file" className="hidden" accept="image/*" onChange={onImageUpload} />
                        </label>
                        <button
                            onClick={onRegenerateImage}
                            disabled={isGeneratingImage || !character.appearance || imageCooldown > 0}
                            className="btn-primary btn-sm w-36 flex items-center justify-center gap-2"
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
            )}

            {/* XP Bar */}
            <div className="w-full mb-8">
                <div className="flex justify-between items-end mb-2 px-1">
                    <label className="text-[10px] font-bold text-brand-text-muted tracking-normal">Experience</label>
                    <span className="text-[10px] font-bold text-brand-text-muted">
                        <span className="text-brand-text">{currentXP.toLocaleString()}</span> <span className="opacity-40">/</span> {nextLevelXP.toLocaleString()} Xp
                    </span>
                </div>
                <div className="relative w-full h-2.5 bg-brand-primary/50 rounded-full overflow-hidden border border-brand-surface shadow-inner">
                    <div
                        className="absolute top-0 left-0 h-full bg-brand-accent transition-all duration-500 ease-out shadow-[0_0_10px_rgba(62,207,142,0.3)]"
                        style={{ width: `${xpPercentage}%` }}
                    />
                </div>
            </div>

            {/* Heroic Potential Section */}
            {showHeroicPoints && (
                <div className="mb-8 animate-fade-in bg-brand-primary/10 p-5 rounded-2xl border border-brand-surface shadow-inner group">
                    <div className="flex justify-between items-center">
                        <h3 className="mb-0 text-brand-text text-lg">Heroic Potential</h3>
                        <div className="flex flex-wrap gap-2.5">
                            {Array.from({ length: maxHeroic }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`transition-all duration-700 transform ${i < currentHeroic ? 'scale-110' : 'opacity-20 scale-100'}`}
                                >
                                    <Icon
                                        name={i < currentHeroic ? "starFill" : "star"}
                                        className={`w-6 h-6 ${i < currentHeroic ? 'text-brand-accent drop-shadow-[0_0_10px_rgba(62,207,142,0.5)]' : 'text-brand-text-muted'}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Identity Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <InputField label="Name" value={character.name} onChange={(e) => onChange(['name'], e.target.value)} />
                <InputField label="Class" value={character.profession} onChange={(e) => onChange(['profession'], e.target.value)} />
                <SelectField label="Gender" value={character.gender} onChange={(e) => onChange(['gender'], e.target.value)} options={['Male', 'Female', 'Non-binary', 'Unspecified']} />
                <SelectField
                    label="Race"
                    value={availableRaces.includes(character.race) ? character.race : 'Other'}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Other') {
                            onChange(['race'], '');
                        } else {
                            onChange(['race'], val);
                        }
                    }}
                    options={availableRaces}
                />
            </div>

            {/* Custom Race Specification */}
            {(character.race === 'Other' || isCustomRace) && (
                <div className="mb-4 animate-fade-in">
                    <InputField
                        label="Specify custom race"
                        value={availableRaces.includes(character.race) ? '' : character.race}
                        onChange={(e) => onChange(['race'], e.target.value)}
                        placeholder="e.g. Half-Dragon, Automaton..."
                    />
                </div>
            )}

            <div className="space-y-6">
                <TextareaField label="Appearance" value={character.appearance} onChange={(e) => onChange(['appearance'], e.target.value)} />
                {isCompanion && 'personality' in character && (
                    <TextareaField label="Personality" value={(character as Companion).personality} onChange={(e) => onChange(['personality'], e.target.value)} />
                )}
                <TextareaField label="Background" value={character.background} onChange={(e) => onChange(['background'], e.target.value)} />

                {/* Alignment Sliders for Player only */}
                {!isCompanion && (
                    <div className="mb-8 animate-fade-in bg-brand-primary/10 p-5 rounded-2xl border border-brand-surface shadow-inner space-y-6">
                        <h3 className="text-brand-text text-lg mb-2">Alignment</h3>

                        <div className="w-full">
                            <div className="flex justify-center items-end mb-2 px-1">
                                <label className="text-xs font-bold text-brand-text tracking-normal">
                                    {getGoodEvilLabel(character.alignment?.goodEvil || 0)}({character.alignment?.goodEvil || 0})
                                </label>
                            </div>
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                value={character.alignment?.goodEvil || 0}
                                onChange={(e) => onChange(['alignment', 'goodEvil'], parseInt(e.target.value))}
                                className="w-full h-2.5 bg-brand-primary/50 rounded-full appearance-none cursor-pointer accent-brand-accent border border-brand-surface shadow-inner"
                            />
                        </div>

                        <div className="w-full">
                            <div className="flex justify-center items-end mb-2 px-1">
                                <label className="text-xs font-bold text-brand-text tracking-normal">
                                    {getLawChaosLabel(character.alignment?.lawChaos || 0)}({character.alignment?.lawChaos || 0})
                                </label>
                            </div>
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                value={character.alignment?.lawChaos || 0}
                                onChange={(e) => onChange(['alignment', 'lawChaos'], parseInt(e.target.value))}
                                className="w-full h-2.5 bg-brand-primary/50 rounded-full appearance-none cursor-pointer accent-brand-accent border border-brand-surface shadow-inner"
                            />
                        </div>
                    </div>
                )}

                {/* Alignment Dropdowns for Companions only */}
                {isCompanion && (
                    <div className="mb-8 animate-fade-in bg-brand-primary/10 p-5 rounded-2xl border border-brand-surface shadow-inner space-y-6">
                        <h3 className="text-brand-text text-lg mb-2">Alignment</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <SelectField
                                label="Moral Alignment (Good/Evil)"
                                value={getGoodEvilLabel(character.alignment?.goodEvil || 0)}
                                onChange={(e) => {
                                    const match = GOOD_EVIL_ALIASES.find(a => a.label === e.target.value);
                                    if (match) onChange(['alignment', 'goodEvil'], match.value);
                                }}
                                options={GOOD_EVIL_ALIASES.map(a => a.label)}
                            />
                            <SelectField
                                label="Ethical Alignment (Law/Chaos)"
                                value={getLawChaosLabel(character.alignment?.lawChaos || 0)}
                                onChange={(e) => {
                                    const match = LAW_CHAOS_ALIASES.find(a => a.label === e.target.value);
                                    if (match) onChange(['alignment', 'lawChaos'], match.value);
                                }}
                                options={LAW_CHAOS_ALIASES.map(a => a.label)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

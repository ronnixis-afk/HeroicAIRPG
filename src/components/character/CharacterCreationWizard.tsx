
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { RACIAL_TRAIT_BLUEPRINTS } from '../../constants/racialTraits';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import Modal from '../Modal';
import { TRAIT_LIBRARY, LibraryTrait } from '../../utils/traitLibrary';
import { CharacterTemplate } from '../../utils/templateRegistry';
import { Ability, PlayerCharacter, Companion, SKILL_NAMES, AbilityScoreName, ABILITY_SCORES } from '../../types';
import { weaveHero, generateRecruitSkins } from '../../services/aiCharacterService';
import { getXPForLevel, getXPForLevel as getXpForLevel } from '../../utils/mechanics';
import { getBuffTag } from '../../utils/itemModifiers';

// Sub-components
import { WizardProgress } from './wizard/WizardProgress';
import { WizardMethodSelection } from './wizard/WizardMethodSelection';
import { WizardTavernRecruits } from './wizard/WizardTavernRecruits';
import { WizardStepAncestry } from './wizard/WizardStepAncestry';
import { WizardStepTraits } from './wizard/WizardStepTraits';
import { WizardStepSpecialty } from './wizard/WizardStepSpecialty';
import { WizardStepIdentity } from './wizard/WizardStepIdentity';
import { WizardNavigation } from './wizard/WizardNavigation';
import { WizardStepMethod } from './wizard/WizardStepMethod';
import { WizardStepAttributes } from './wizard/WizardStepAttributes';
import { WizardEffectSelectorModal } from './wizard/WizardEffectSelectorModal';

interface CharacterCreationWizardProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'player' | 'companion';
    initialMethod?: 'manual' | 'recruitment' | 'shipyard';
    existingId?: string;
}

const PLAYER_STEPS = ["Ancestry", "Archetype", "Origin", "Qualities", "Prowess", "Attributes", "Identity"];
const COMPANION_STEPS = ["Ancestry", "Archetype", "Backstory", "Quirks", "Specialty", "Attributes", "Finalize"];
const SHIP_STEPS = ["Path", "Hull Configuration", "Prowess", "Identify"];
const GENDER_OPTIONS = ['Male', 'Female', 'Unspecified'];

export const CharacterCreationWizard: React.FC<CharacterCreationWizardProps> = ({ isOpen, onClose, type, initialMethod, existingId }) => {
    const { gameData, integrateCharacter } = useContext(GameDataContext);
    const { setCreationProgress, creationProgress } = useUI();

    // Core State
    const [creationMethod, setCreationMethod] = useState<'manual' | 'recruitment' | 'shipyard' | null>(null);
    const [step, setStep] = useState(1);
    const [isWeaving, setIsWeaving] = useState(false);
    const [weavingMessage, setWeavingMessage] = useState('Consulting the fates...');
    const [recruits, setRecruits] = useState<any[]>([]);
    const [isGeneratingRecruits, setIsGeneratingRecruits] = useState(false);

    // Character Build State
    const [name, setName] = useState('');
    const [gender, setGender] = useState('Unspecified');
    const [level, setLevel] = useState(1);
    const [race, setRace] = useState('');
    const [backgroundTraits, setBackgroundTraits] = useState<LibraryTrait[]>([]);
    const [generalTraits, setGeneralTraits] = useState<LibraryTrait[]>([]);
    const [combatAbility, setCombatAbility] = useState<LibraryTrait | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [isShip, setIsShip] = useState(false);
    const [customBackground, setCustomBackground] = useState('');
    const [abilityScores, setAbilityScores] = useState<any>(null);
    const [savingThrows, setSavingThrows] = useState<AbilityScoreName[] | null>(null);
    const [skills, setSkills] = useState<Record<string, { proficient: boolean }>>({});
    const [showEffectSelector, setShowEffectSelector] = useState(false);
    const [effectSelectorType, setEffectSelectorType] = useState<'Damage' | 'Status'>('Damage');

    const isCompanion = type === 'companion';
    const activeSteps = isShip ? SHIP_STEPS : (isCompanion ? COMPANION_STEPS : PLAYER_STEPS);
    const playerLevel = gameData?.playerCharacter.level || 1;
    const skillConfig = gameData?.skillConfiguration || 'Fantasy';
    const isPreGame = gameData?.story?.length === 0;

    const availableRaces = useMemo(() => {
        if (!gameData?.world) return [{ name: 'Human', description: 'Ambitious and versatile.', racialTrait: undefined }];
        const racesFromLore = gameData.world
            .filter(l => l.tags?.includes('race'))
            .map(l => ({ name: l.title, description: l.content, racialTrait: l.racialTrait }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return racesFromLore.length > 0 ? racesFromLore : [
            { name: 'Human', description: 'Ambitious and versatile.', racialTrait: { ...RACIAL_TRAIT_BLUEPRINTS[5], id: 'racial-human', name: 'Human Trait' } },
            { name: 'Elf', description: 'Graceful and long-lived.', racialTrait: { ...RACIAL_TRAIT_BLUEPRINTS[1], id: 'racial-elf', name: 'Elf Trait' } },
            { name: 'Dwarf', description: 'Stout and resilient.', racialTrait: { ...RACIAL_TRAIT_BLUEPRINTS[2], id: 'racial-dwarf', name: 'Dwarf Trait' } },
            { name: 'Orc', description: 'Strong and fierce.', racialTrait: { ...RACIAL_TRAIT_BLUEPRINTS[0], id: 'racial-orc', name: 'Orc Trait' } }
        ];
    }, [gameData?.world]);

    const libraryTraits = useMemo(() => TRAIT_LIBRARY.filter(t => !t.requiredConfig || t.requiredConfig === skillConfig), [skillConfig]);

    const backgrounds = useMemo(() => {
        if (isShip) return libraryTraits.filter(t => t.category === 'ship_hull' || t.category === 'ship_module');
        return libraryTraits.filter(t => t.category === 'background');
    }, [libraryTraits, isShip]);

    const generals = useMemo(() => {
        if (isShip) return [];
        return libraryTraits.filter(t => t.category === 'general');
    }, [libraryTraits, isShip]);

    const combats = useMemo(() => libraryTraits.filter(t => t.category === 'combat'), [libraryTraits]);

    useEffect(() => {
        if (creationProgress.isActive && creationProgress.step) {
            setWeavingMessage(creationProgress.step);
        }
    }, [creationProgress.step, creationProgress.isActive]);

    useEffect(() => {
        if (isOpen) {
            let existingChar: any = null;
            if (existingId === 'player') existingChar = gameData?.playerCharacter;
            else if (existingId) existingChar = gameData?.companions.find(c => c.id === existingId);

            if (existingChar && existingChar.unwovenDetails) {
                const unwoven = existingChar.unwovenDetails;
                setName(unwoven.name || '');
                setGender(unwoven.gender || 'Unspecified');
                setLevel(existingChar.level || 1);
                setRace(unwoven.race || '');
                setBackgroundTraits(libraryTraits.filter(t => unwoven.backgroundTraits.includes(t.name)));
                setGeneralTraits(libraryTraits.filter(t => unwoven.generalTraits.includes(t.name)));
                setCombatAbility(libraryTraits.find(t => t.name === unwoven.combatAbility?.name) || null);
                setCustomBackground(unwoven.customBackground || '');
                setAbilityScores(existingChar.abilityScores);
                setSavingThrows(existingChar.savingThrows ? Object.entries(existingChar.savingThrows).filter(([_, v]: any) => v.proficient).map(([k]) => k as AbilityScoreName) : null);
                setSkills(existingChar.skills || {});
                setCreationMethod('manual');
                setIsShip(existingChar.isShip || false);
                setStep(existingChar.isShip ? 4 : 7);
            } else {
                if (type === 'player') {
                    setCreationMethod('manual');
                } else if (initialMethod) {
                    setCreationMethod(initialMethod);
                    if (initialMethod === 'recruitment') handleGenerateRecruits();
                    if (initialMethod === 'shipyard') {
                        setIsShip(true);
                        setStep(1);
                        setGender('Unspecified');
                    }
                } else {
                    setCreationMethod(null);
                }

                setStep(1);
                setRecruits([]);
                setName('');
                setRace('');
                setBackgroundTraits([]);
                setGeneralTraits([]);
                setCombatAbility(null);
                setSelectedTemplateId(null);
                setLevel(playerLevel);
                setIsWeaving(false);
                setIsShip(false);
                setCustomBackground('');
                setAbilityScores({
                    strength: { score: 8 }, dexterity: { score: 8 }, constitution: { score: 8 },
                    intelligence: { score: 8 }, wisdom: { score: 8 }, charisma: { score: 8 }
                });
                setSavingThrows(null);
                setSkills({});
            }
        }
    }, [isOpen, type, playerLevel, existingId, gameData, libraryTraits]);

    const allSelectedTraitNames = useMemo(() => {
        return [...backgroundTraits, ...generalTraits].map(t => t.name);
    }, [backgroundTraits, generalTraits]);

    const acquiredSkills = useMemo(() => {
        const skills = new Set<string>();
        [...backgroundTraits, ...generalTraits].forEach(t => {
            t.buffs?.forEach(b => { if (b.type === 'skill' && b.skillName) skills.add(b.skillName); });
        });
        return Array.from(skills).sort();
    }, [backgroundTraits, generalTraits]);

    const acquiredOtherBonuses = useMemo(() => {
        const bonuses = new Set<string>();
        [...backgroundTraits, ...generalTraits].forEach(t => {
            t.buffs?.forEach(b => {
                if (b.type !== 'skill') {
                    const { label } = getBuffTag(b);
                    bonuses.add(label);
                }
            });
        });
        return Array.from(bonuses).sort();
    }, [backgroundTraits, generalTraits]);

    const racialBonuses = useMemo(() => {
        const bonuses: Partial<Record<AbilityScoreName, number>> = {};
        const selectedRaceObj = availableRaces.find(r => r.name === race);
        if (selectedRaceObj?.racialTrait?.buffs) {
            selectedRaceObj.racialTrait.buffs.forEach(buff => {
                if (buff.type === 'ability' && buff.abilityName) {
                    bonuses[buff.abilityName as AbilityScoreName] = (bonuses[buff.abilityName as AbilityScoreName] || 0) + buff.bonus;
                }
            });
        }
        return bonuses;
    }, [race, availableRaces]);

    const canGoNext = useMemo(() => {
        if (isShip) {
            if (step === 1) return true;
            if (step === 2) return backgroundTraits.length > 0 && backgroundTraits.length <= 3;
            if (step === 3) return combatAbility !== null;
            if (step === 4) return name.trim().length > 0;
            return true;
        }

        if (step === 1) return race.length > 0;
        if (step === 2) return true;
        if (step === 3) return backgroundTraits.length === 2;
        if (step === 4) return generalTraits.length === 2;
        if (step === 5) return combatAbility !== null;
        if (step === 6) return true; // Attributes
        if (step === 7) return name.trim().length > 0;
        return true;
    }, [step, race, backgroundTraits, generalTraits, combatAbility, name, isShip]);

    const handleSelectTemplate = (template: CharacterTemplate) => {
        setSelectedTemplateId(template.id);
        const bg = libraryTraits.filter(t => template.backgroundTraitNames.includes(t.name));
        const gen = libraryTraits.filter(t => template.generalTraitNames.includes(t.name));
        const com = libraryTraits.find(t => t.name === template.combatTraitName) || combats[0];
        setBackgroundTraits(bg);
        setGeneralTraits(gen);
        setCombatAbility(com);
        setShowEffectSelector(false); // Reset selector on template load

        // Prefill background context with all template traits
        const traitSummary = [...bg, ...gen].map(t => t.name).join(', ');
        setCustomBackground(traitSummary);
        setAbilityScores(template.abilityScores);
        setSavingThrows(template.savingThrows || null);
        setStep(isShip ? 4 : 7);

    };

    const handleSelectCustom = () => {
        setSelectedTemplateId(null);
        setBackgroundTraits([]);
        setGeneralTraits([]);
        setCombatAbility(null);
        setCustomBackground('');
        setAbilityScores({
            strength: { score: 8 }, dexterity: { score: 8 }, constitution: { score: 8 },
            intelligence: { score: 8 }, wisdom: { score: 8 }, charisma: { score: 8 }
        });
        setSavingThrows(null);
        setSkills({});
        setStep(isShip ? 2 : 3);

    };

    const handleGenerateRecruits = async () => {
        if (!gameData) return;
        setIsGeneratingRecruits(true);
        setIsShip(false); // Reset isShip to ensure proper ally trait lists
        setCreationMethod('recruitment');

        try {
            // Get fresh lists specifically for recruitment (isShip must be false)
            const recruitmentCombats = libraryTraits.filter(t => t.category === 'combat');
            const recruitmentBackgrounds = libraryTraits.filter(t => t.category === 'background');
            const recruitmentGenerals = libraryTraits.filter(t => t.category === 'general');

            if (recruitmentCombats.length === 0 || recruitmentBackgrounds.length === 0 || recruitmentGenerals.length === 0) {
                throw new Error("Required traits not found in library");
            }

            const shuffledCombats = [...recruitmentCombats].sort(() => 0.5 - Math.random());
            const seeds = [];
            for (let i = 0; i < 6; i++) {
                const raceObj = availableRaces[Math.floor(Math.random() * availableRaces.length)];
                const randomRace = raceObj?.name || "Human";
                const randomGender = GENDER_OPTIONS[Math.floor(Math.random() * GENDER_OPTIONS.length)];

                const bgSeeds = [...recruitmentBackgrounds].sort(() => 0.5 - Math.random()).slice(0, 2);
                const genSeeds = [...recruitmentGenerals].sort(() => 0.5 - Math.random()).slice(0, 2);
                const comSeed = shuffledCombats[i % shuffledCombats.length];

                seeds.push({
                    race: randomRace,
                    gender: randomGender,
                    traits: [...bgSeeds.map(t => t.name), ...genSeeds.map(t => t.name), comSeed.name],
                    bgSeeds,
                    genSeeds,
                    comSeed
                });
            }
            const skins = await generateRecruitSkins(gameData, seeds);
            setRecruits(seeds.map((s, i) => ({
                ...s,
                name: skins[i]?.name || `${s.race} Adventurer`,
                description: skins[i]?.description || "A wanderer looking for coin and glory.",
                personality: skins[i]?.personality || "Quirky and reliable.",
                moralAlignment: skins[i]?.moralAlignment || { goodEvil: 0, lawChaos: 0 }
            })));

        } catch (e) {
            console.error("Recruitment generation failed", e);
            setCreationMethod(null);
        } finally {
            setIsGeneratingRecruits(false);
        }
    };

    const handleSelectRecruit = async (recruit: any) => {
        if (!gameData) return;
        setIsWeaving(true);
        setWeavingMessage('Enrolling ally...');
        setCreationProgress({ isActive: true, step: "Enrolling candidate...", progress: 10 });
        try {
            const raceObj = availableRaces.find(r => r.name === recruit.race);
            const racialTrait = raceObj?.racialTrait;

            const traitSkillsList = [...recruit.bgSeeds, ...recruit.genSeeds].flatMap((t: any) => t.buffs || []).filter((b: any) => b.type === 'skill').map((b: any) => b.skillName).filter((s: any): s is string => !!s);
            const unwovenDetails = { 
                name: recruit.name, 
                gender: recruit.gender, 
                race: recruit.race, 
                backgroundTraits: recruit.bgSeeds.map((t: any) => t.name), 
                generalTraits: recruit.genSeeds.map((t: any) => t.name), 
                combatAbility: { ...recruit.comSeed, id: 'blueprint' } as Ability, 
                guaranteedSkills: traitSkillsList,
                racialTrait
            };
            
            const allAbilities: Ability[] = [
                ...(racialTrait ? [{ ...racialTrait, id: `racial-rec-${Date.now()}` }] : []),
                ...recruit.bgSeeds.map((t: any, i: number) => ({ ...t, id: `bg-${i}-${Date.now()}` })), 
                ...recruit.genSeeds.map((t: any, i: number) => ({ ...t, id: `gen-${i}-${Date.now()}` })), 
                { ...recruit.comSeed, id: `combat-${Date.now()}`, name: `[Pending] ${recruit.comSeed.name}`, description: "This ability is being forged." }
            ];

            const traitSkills = new Set([...recruit.bgSeeds, ...recruit.genSeeds].flatMap(t => t.buffs || []).filter(b => b.type === 'skill').map(b => b.skillName));
            const fullSkills = SKILL_NAMES.reduce((acc, skill) => { acc[skill] = { proficient: traitSkills.has(skill) }; return acc; }, {} as any);
            
            const defaultScores = ABILITY_SCORES.reduce((acc, s) => ({ ...acc, [s]: { score: 10 } }), {} as any);
            const defaultSaves = ABILITY_SCORES.reduce((acc, s) => ({ ...acc, [s]: { proficient: false } }), {} as any);

            const baseCharData = { 
                id: `comp-${Date.now()}`, 
                name: recruit.name, 
                gender: recruit.gender, 
                race: recruit.race, 
                profession: "[Pending Profession]", 
                appearance: "[Pending Appearance]", 
                background: "[Pending Background]", 
                personality: recruit.personality, 
                keywords: [], 
                abilityScores: defaultScores, 
                savingThrows: defaultSaves, 
                skills: fullSkills, 
                abilities: allAbilities, 
                level: playerLevel, 
                experiencePoints: getXpForLevel(playerLevel), 
                alignment: recruit.moralAlignment,
                unwovenDetails 
            };
            await integrateCharacter(new Companion(baseCharData), true, isPreGame);

            onClose();
        } catch (e) { 
            console.error("Recruit selection failed", e); 
            setIsWeaving(false); 
            setCreationProgress({ isActive: false, step: '', progress: 0 }); 
        }
    };

    const handleConfirmManual = async () => {
        if (!gameData || !combatAbility) return;
        setIsWeaving(true);
        const loadingMsg = isShip ? "Assembling Vessel..." : (isCompanion ? "Welcoming Your Companion..." : "Forging Your Destiny...");
        setWeavingMessage(loadingMsg);
        setCreationProgress({ isActive: true, step: loadingMsg, progress: 10 });
        try {
            const selectedRaceObj = availableRaces.find(r => r.name === race);
            const racialTrait = selectedRaceObj?.racialTrait;

            const unwovenDetails = {
                name,
                gender: isShip ? 'Unspecified' : gender,
                race: isShip ? 'Vessel' : race,
                backgroundTraits: backgroundTraits.map(t => t.name),
                generalTraits: generalTraits.map(t => t.name),
                combatAbility: { ...combatAbility, id: 'blueprint' } as Ability,
                customBackground: customBackground,
                abilityScores: abilityScores,
                savingThrows: savingThrows || undefined,
                guaranteedSkills: [...backgroundTraits, ...generalTraits].flatMap(t => t.buffs || []).filter(b => b.type === 'skill').map(b => b.skillName).filter((s): s is string => !!s),
                racialTrait
            };

            const allAbilities: Ability[] = [
                ...(racialTrait ? [{ ...racialTrait, id: `racial-${Date.now()}` }] : []),
                ...backgroundTraits.map((t, i) => ({ ...t, id: `bg-${i}-${Date.now()}` })),
                ...generalTraits.map((t, i) => ({ ...t, id: `gen-${i}-${Date.now()}` })),
                { ...combatAbility, id: `combat-${Date.now()}`, name: `[Pending] ${combatAbility.name}`, description: "This ability is being forged." }
            ];
            
            // Merge custom skills with guaranteed traits
            const traitSkills = new Set([...backgroundTraits, ...generalTraits].flatMap(t => t.buffs || []).filter(b => b.type === 'skill').map(b => b.skillName));
            // Use custom skills if defined
            const hasManualSkills = Object.keys(skills).some(key => skills[key].proficient);
            const finalSkills = hasManualSkills ? SKILL_NAMES.reduce((acc, skill) => { acc[skill] = { proficient: traitSkills.has(skill) || !!skills[skill]?.proficient }; return acc; }, {} as any) : SKILL_NAMES.reduce((acc, skill) => { acc[skill] = { proficient: traitSkills.has(skill) }; return acc; }, {} as any);

            const defaultSaves = ABILITY_SCORES.reduce((acc, s) => ({ ...acc, [s]: { proficient: false } }), {} as any);

            const baseCharData = { 
                id: existingId || (type === 'player' ? 'player' : `comp-${Date.now()}`), 
                name, 
                gender: isShip ? 'Unspecified' : gender, 
                race: isShip ? 'Vessel' : race, 
                profession: "[Pending Profession]", 
                appearance: "[Pending Appearance]", 
                background: "[Pending Background]", 
                personality: isShip ? '' : "[Pending Personality]", 
                keywords: [], 
                abilityScores: abilityScores, 
                savingThrows: savingThrows || defaultSaves, 
                skills: finalSkills, 
                abilities: allAbilities, 
                level, 
                experiencePoints: getXpForLevel(level), 
                isShip, 
                isSentient: !isShip, 
                alignment: { goodEvil: 0, lawChaos: 0 },
                unwovenDetails
            };
            const finalChar = type === 'player' ? new PlayerCharacter(baseCharData) : new Companion(baseCharData);

            await integrateCharacter(finalChar, isCompanion, isPreGame);
            onClose();
        } catch (e) { 
            console.error("Hero creation failed", e); 
            setIsWeaving(false); 
            setCreationProgress({ isActive: false, step: '', progress: 0 }); 
        }
    };

    const toggleTrait = (trait: LibraryTrait, set: LibraryTrait[], setter: (val: LibraryTrait[]) => void, limit: number) => {
        const isSelected = set.some(st => st.name === trait.name);
        if (isSelected) setter(set.filter(st => st.name !== trait.name));
        else if (set.length < limit) setter([...set, trait]);
    };

    const handleCombatAbilitySelect = (trait: LibraryTrait) => {
        setCombatAbility(trait);
        if (trait.effect?.type === 'Damage' || trait.effect?.type === 'Status') {
            setEffectSelectorType(trait.effect.type as 'Damage' | 'Status');
            setShowEffectSelector(true);
        }
    };

    const handleEffectSubtypeSelect = (value: string) => {
        if (!combatAbility) return;
        const updatedAbility = { ...combatAbility };
        if (!updatedAbility.effect) updatedAbility.effect = { type: 'Damage' }; // Fallback

        if (effectSelectorType === 'Damage') {
            updatedAbility.effect.damageType = value;
        } else {
            updatedAbility.effect.status = value as any;
        }
        setCombatAbility(updatedAbility);
    };

    const renderWeaving = () => (
        <div className="flex-1 flex flex-col items-center justify-center animate-fade-in py-12">
            <div className={`w-20 h-20 mb-10 transition-all duration-700 ${creationProgress.errorString ? 'text-red-400 animate-pulse scale-110' : 'text-brand-accent animate-dice'}`}>
                <Icon name="dice" className={`w-full h-full ${creationProgress.errorString ? 'drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]' : 'drop-shadow-[0_0_15px_rgba(62,207,142,0.5)]'}`} />
            </div>
            <div className="text-center space-y-3 w-full max-w-xs px-4">
                <h3 className={`text-lg font-bold transition-colors ${creationProgress.errorString ? 'text-red-400' : 'text-brand-text'}`}>
                    {creationProgress.errorString ? creationProgress.step : weavingMessage}
                </h3>
                <p className="text-xs text-brand-text-muted italic leading-relaxed">
                    {creationProgress.errorString 
                        ? creationProgress.errorString 
                        : (isShip ? "Technical schematics are being finalized..." : (isCompanion ? "The architect is drafting your new ally..." : "The architect is weaving your legend into the world..."))}
                </p>
                
                {creationProgress.errorString ? (
                    <div className="flex flex-col gap-3 mt-8 w-full animate-fade-in">
                        <button 
                            onClick={() => creationProgress.onRetry?.()}
                            className="btn-md btn-primary w-full flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/5"
                        >
                            <Icon name="dice" className="w-4 h-4" />
                            <span>Retry Integration</span>
                        </button>
                        <button 
                            onClick={() => {
                                setIsWeaving(false);
                                setCreationProgress({ isActive: false, step: '', progress: 0 });
                            }}
                            className="text-xs font-bold text-brand-text-muted hover:text-brand-text transition-colors underline underline-offset-4 decoration-brand-primary"
                        >
                            Return to Wizard
                        </button>
                    </div>
                ) : (
                    creationProgress.isActive && (
                        <div className="w-full mt-8 bg-brand-primary/30 h-1.5 rounded-full overflow-hidden border border-brand-surface">
                            <div className="bg-brand-accent h-full transition-all duration-1000 ease-out" style={{ width: `${creationProgress.progress}%` }} />
                        </div>
                    )
                )}
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={() => !isWeaving && onClose()} title="" hideHeader={true}>
            <div className="flex flex-col h-[85vh] overflow-hidden">
                {isWeaving ? renderWeaving() : (
                    <>
                        {creationMethod === null && <WizardMethodSelection onSelect={(method) => {
                            if (method === 'recruitment') handleGenerateRecruits();
                            else {
                                setCreationMethod(method);
                                if (method === 'shipyard') {
                                    setIsShip(true);
                                    setGender('Unspecified');
                                    setStep(1);
                                } else {
                                    setIsShip(false);
                                }
                            }
                        }} />}
                        {creationMethod === 'recruitment' && <WizardTavernRecruits recruits={recruits} isLoading={isGeneratingRecruits} onSelect={handleSelectRecruit} onCancel={() => setCreationMethod(null)} />}
                        {(creationMethod === 'manual' || creationMethod === 'shipyard') && (
                            <>
                                <WizardProgress steps={activeSteps} currentStep={step} />
                                {(backgroundTraits.length > 0 || generalTraits.length > 0 || acquiredSkills.length > 0 || acquiredOtherBonuses.length > 0) && (
                                    <div className="mb-6 px-1 animate-fade-in grid grid-cols-2 gap-4 border-b border-brand-primary/20 pb-4">
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-body-sm font-bold text-brand-text-muted opacity-60 block">
                                                    {isShip ? "Technical Grid" : (isCompanion ? "Their Past & Quirks" : "Origin & Traits")}
                                                </label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {[...backgroundTraits, ...generalTraits].map(trait => (
                                                        <span key={trait.name} className="text-brand-text text-[10px] font-bold px-2 py-0.5 rounded-lg border border-brand-surface bg-brand-primary/30">{trait.name}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            {acquiredOtherBonuses.length > 0 && (
                                                <div className="space-y-3">
                                                    <label className="text-body-sm font-bold text-brand-text-muted opacity-60 block">Other Bonuses</label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {acquiredOtherBonuses.map(bonus => (
                                                            <span key={bonus} className="text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-orange-400/20 bg-orange-400/5">{bonus}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-body-sm font-bold text-brand-text-muted opacity-60 block">Capabilities</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {acquiredSkills.map(skill => (
                                                    <span key={skill} className="text-brand-accent text-[10px] font-bold px-2 py-0.5 rounded-lg border border-brand-accent/20 bg-brand-accent/5 capitalize">{skill}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="flex-1 overflow-y-auto custom-scroll">
                                    <div className="animate-page py-2">
                                        {isShip ? (
                                            <>
                                                {step === 1 && (
                                                    <WizardStepMethod
                                                        skillConfig={skillConfig}
                                                        selectedTemplateId={selectedTemplateId}
                                                        onSelectCustom={handleSelectCustom}
                                                        onSelectTemplate={handleSelectTemplate}
                                                        libraryTraits={libraryTraits}
                                                        isShip={true}
                                                    />
                                                )}
                                                {step === 2 && <WizardStepTraits title="Systems & Modules" subtitle="Select up to 3 characteristic hull and module components." traits={backgrounds} selectedTraits={backgroundTraits} onToggle={(t) => toggleTrait(t, backgroundTraits, setBackgroundTraits, 3)} limit={3} />}
                                                {step === 3 && <WizardStepSpecialty isCompanion={isCompanion} options={combats} selected={combatAbility} onSelect={handleCombatAbilitySelect} onEditEffect={() => setShowEffectSelector(true)} possessedTraitNames={allSelectedTraitNames} level={level} />}
                                                {step === 4 && (
                                                    <WizardStepIdentity
                                                        isCompanion={isCompanion}
                                                        name={name}
                                                        onNameChange={setName}
                                                        gender='Unspecified'
                                                        onGenderChange={setGender}
                                                        level={level}
                                                        onLevelChange={setLevel}
                                                        genderOptions={GENDER_OPTIONS}
                                                        isShip={true}
                                                        customBackground={customBackground}
                                                        onCustomBackgroundChange={setCustomBackground}
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {step === 1 && <WizardStepAncestry races={availableRaces} selectedRace={race} onSelect={(r) => { setRace(r); setStep(2); }} isCompanion={isCompanion} />}
                                                {step === 2 && (
                                                    <WizardStepMethod
                                                        skillConfig={skillConfig}
                                                        selectedTemplateId={selectedTemplateId}
                                                        onSelectCustom={handleSelectCustom}
                                                        onSelectTemplate={handleSelectTemplate}
                                                        libraryTraits={libraryTraits}
                                                    />
                                                )}
                                                {step === 3 && <WizardStepTraits title={isCompanion ? "What is their story?" : "What was your past like?"} subtitle="Select two background markers that defined them." traits={backgrounds} selectedTraits={backgroundTraits} onToggle={(t) => toggleTrait(t, backgroundTraits, setBackgroundTraits, 2)} limit={2} level={level} />}
                                                {step === 4 && <WizardStepTraits title={isCompanion ? "What makes them tick?" : "What defines your spirit?"} subtitle="Choose two essential qualities or traits." traits={generals} selectedTraits={generalTraits} onToggle={(t) => toggleTrait(t, generalTraits, setGeneralTraits, 2)} limit={2} possessedTraitNames={backgroundTraits.map(t => t.name)} level={level} />}
                                                {step === 5 && <WizardStepSpecialty isCompanion={isCompanion} options={combats} selected={combatAbility} onSelect={handleCombatAbilitySelect} onEditEffect={() => setShowEffectSelector(true)} possessedTraitNames={allSelectedTraitNames} level={level} />}
                                                {step === 6 && (
                                                    <WizardStepAttributes
                                                        abilityScores={abilityScores || {}}
                                                        onAbilityChange={(ability, score) => setAbilityScores((prev: any) => ({ ...prev, [ability]: { score } }))}
                                                        skills={skills}
                                                        onSkillChange={(skill, proficient) => setSkills(prev => ({ ...prev, [skill]: { proficient } }))}
                                                        config={skillConfig}
                                                        guaranteedSkills={acquiredSkills}
                                                        racialBonuses={racialBonuses}
                                                    />
                                                )}
                                                {step === 7 && (
                                                    <WizardStepIdentity
                                                        isCompanion={isCompanion}
                                                        name={name}
                                                        onNameChange={setName}
                                                        gender={gender}
                                                        onGenderChange={setGender}
                                                        level={level}
                                                        onLevelChange={setLevel}
                                                        genderOptions={GENDER_OPTIONS}
                                                        customBackground={customBackground}
                                                        onCustomBackgroundChange={setCustomBackground}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                <WizardNavigation
                                    onBack={() => {
                                        if (isShip) {
                                            if (step === 4 && selectedTemplateId) setStep(1);
                                            else if (step > 1) setStep(s => s - 1);
                                            else { setCreationMethod(null); setIsShip(false); }
                                        } else {
                                            if (step === 7 && selectedTemplateId) setStep(2);
                                            else if (step > 1) setStep(s => s - 1);
                                            else { setCreationMethod(null); setIsShip(false); }
                                        }
                                    }}
                                    onNext={() => {
                                        if (isShip) {
                                            // Prefill background context when moving to the final step
                                            if (step === 3) {
                                                const traits = [...backgroundTraits, ...generalTraits];
                                                const traitSummary = traits.map(t => t.name).join(', ');
                                                setCustomBackground(traitSummary);
                                            }
                                            if (step === 4) handleConfirmManual();
                                            else setStep(s => s + 1);
                                        } else {
                                            // Prefill background context when moving to the final step
                                            if (step === 6) {
                                                const traits = [...backgroundTraits, ...generalTraits];
                                                const traitSummary = traits.map(t => t.name).join(', ');
                                                setCustomBackground(traitSummary);
                                            }
                                            if (step === 7) handleConfirmManual();
                                            else setStep(s => s + 1);
                                        }
                                    }}
                                    nextLabel={(isShip ? step === 4 : step === 7) ? (isShip ? "Commission Vessel" : "Add to Party") : "Next Step"}
                                    isNextDisabled={!canGoNext}
                                    showBack={true}
                                />
                            </>
                        )}
                    </>
                )}
                {showEffectSelector && (
                    <WizardEffectSelectorModal 
                        isOpen={showEffectSelector} 
                        onClose={() => setShowEffectSelector(false)} 
                        type={effectSelectorType} 
                        onSelect={handleEffectSubtypeSelect} 
                    />
                )}
            </div>
        </Modal>
    );
};

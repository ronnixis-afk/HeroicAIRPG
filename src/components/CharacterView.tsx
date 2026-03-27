
import React, { useContext, useState, useEffect, useRef } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import { useUI } from '../context/UIContext';
import { Companion } from '../types';
import { Icon } from './Icon';
import { CharacterSheet } from './character/CharacterSheet';
import { CharacterTab } from './character/CharacterTab';
import { CharacterCreationWizard } from './character/CharacterCreationWizard';
import PageHeader from './PageHeader';

const CharacterView: React.FC = () => {
    const { gameData, updateCompanion, startJourney } = useContext(GameDataContext);
    const { selectedCharacterId, setSelectedCharacterId, creationProgress } = useUI();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardType, setWizardType] = useState<'player' | 'companion'>('player');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            setIsScrolled(target.scrollTop > 30);
        };

        const scrollContainer = containerRef.current?.closest('.custom-scroll');
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', handleScroll);
            return () => scrollContainer.removeEventListener('scroll', handleScroll);
        }
    }, []);

    if (!gameData) return <div className="text-center p-8">Loading Character...</div>;

    const { playerCharacter, companions, mapZones, playerCoordinates } = gameData;

    const currentZone = mapZones?.find(z => z.coordinates === playerCoordinates);
    const currentPoi = gameData.knowledge?.find(k => k.coordinates === playerCoordinates && k.title === gameData.currentLocale);
    const isAtPopCenter = currentPoi?.tags?.includes('population-center');

    const isRecruitmentAvailable = isAtPopCenter && (currentZone?.zoneFeatures?.includes('Tavern') || 
        ['Settlement', 'Town', 'City', 'Capital'].includes(currentZone?.populationLevel || ''));

    // Fallback logic if selectedCharacterId points to nothing
    const activeCharacter = selectedCharacterId === 'player'
        ? playerCharacter
        : companions.find(c => c.id === selectedCharacterId);

    // Safety: ensure a valid character is selected
    useEffect(() => {
        if (!activeCharacter && selectedCharacterId !== 'player') {
            setSelectedCharacterId('player');
        }
    }, [activeCharacter, selectedCharacterId, setSelectedCharacterId]);

    // Initial characters have default names from mockSheetService
    const isPreGame = gameData.story.length === 0;
    const hasPlayer = playerCharacter.name !== 'Adventurer' && playerCharacter.name !== 'New Hero';

    const handleAddHero = (type: 'player' | 'companion') => {
        setWizardType(type);
        setIsWizardOpen(true);
    };

    const handleAddCompanion = () => {
        setWizardType('companion');
        setIsWizardOpen(true);
    };

    const toggleCompanionParty = async (companionId: string) => {
        const companion = companions.find(c => c.id === companionId);
        if (companion) {
            await updateCompanion(new Companion({ ...companion, isInParty: !companion.isInParty }));
        }
    };

    const handleTabClick = (id: string) => {
        setSelectedCharacterId(id);
    };

    const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

    return (
        <div ref={containerRef} className="p-2 pt-8 max-w-2xl mx-auto pb-24">

            {isPreGame ? (
                creationProgress.isActive ? (
                    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in py-12 min-h-[70vh]">
                        <div className="w-20 h-20 text-brand-accent animate-dice mb-10">
                            <Icon name="dice" className="w-full h-full drop-shadow-[0_0_15px_rgba(62,207,142,0.5)]" />
                        </div>
                        <div className="text-center space-y-3 w-full max-w-xs px-6">
                            <h5 className="font-bold text-brand-text">{creationProgress.step || "Consulting The Fates..."}</h5>
                            <p className="text-xs text-brand-text-muted italic animate-pulse">
                                The Architect Is Weaving Your Legend Into The World...
                            </p>
                            <div className="w-full mt-8 bg-brand-primary/30 h-1.5 rounded-full overflow-hidden border border-brand-surface">
                                <div className="bg-brand-accent h-full transition-all duration-1000 ease-out" style={{ width: `${creationProgress.progress}%` }} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 animate-fade-in bg-brand-bg">
                        <PageHeader 
                            title="Forge Your Party" 
                            subtitle="Every great chronicle starts with a capable crew." 
                            className="mb-8 border-none"
                            subtitleClassName="max-w-xs mx-auto leading-relaxed"
                            titleAs="h3"
                        />
                        
                        <div className="flex flex-col gap-4 w-full max-w-xl mb-12">
                            {/* Main Character Slot */}
                            <div 
                                className={`relative h-28 rounded-2xl border-2 flex items-center p-4 gap-6 transition-all cursor-pointer 
                                    ${hasPlayer ? 'border-brand-primary bg-brand-surface shadow-lg' : 'border-brand-primary/40 border-dashed bg-brand-primary/5 hover:border-brand-accent hover:bg-brand-primary/10'}`}
                                onClick={() => !hasPlayer && handleAddHero('player')}
                            >
                                {hasPlayer ? (
                                    <>
                                        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-brand-primary/30">
                                            {playerCharacter.imageUrl ? (
                                                <img src={playerCharacter.imageUrl} alt={playerCharacter.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-brand-primary/20 flex items-center justify-center">
                                                    <span className="text-xl font-bold text-brand-text">{getInitials(playerCharacter.name)}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-sm font-bold text-brand-accent mb-1">Main Hero</div>
                                            <div className="text-xl font-bold text-brand-text truncate">{playerCharacter.name}</div>
                                        </div>
                                        <div className="px-4">
                                            <Icon name="chevron-right" className="w-5 h-5 text-brand-text-muted/30" />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-brand-primary/30 flex items-center justify-center bg-brand-primary/10 shrink-0">
                                            <Icon name="plus" className="w-8 h-8 text-brand-accent opacity-60" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-sm font-bold text-brand-text-muted mb-1">Slot 1</div>
                                            <div className="text-lg font-bold text-brand-text/50">Add Main Hero</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Companion Slots */}
                            {[...Array(3)].map((_, index) => {
                                const companion = companions[index];
                                if (companion) {
                                    return (
                                        <div 
                                            key={companion.id} 
                                            className="relative h-28 rounded-2xl border-2 border-brand-primary/60 bg-brand-surface flex items-center p-4 gap-6 transition-all shadow-md"
                                        >
                                            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-brand-primary/30">
                                                {companion.imageUrl ? (
                                                    <img src={companion.imageUrl} alt={companion.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-brand-primary/20 flex items-center justify-center">
                                                        <span className="text-xl font-bold text-brand-text">{getInitials(companion.name)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 text-left">
                                                <div className="text-sm font-bold text-brand-accent/70 mb-1">{companion.profession || 'Companion'}</div>
                                                <div className="text-xl font-bold text-brand-text truncate">{companion.name}</div>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div 
                                            key={`empty-${index}`}
                                            className="relative h-28 rounded-2xl border-2 border-brand-primary/40 border-dashed bg-brand-primary/5 flex items-center p-4 gap-6 transition-all cursor-pointer hover:border-brand-accent hover:bg-brand-primary/10"
                                            onClick={() => handleAddHero('companion')}
                                        >
                                            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-brand-primary/30 flex items-center justify-center bg-brand-primary/10 shrink-0">
                                                <Icon name="plus" className="w-8 h-8 text-brand-accent opacity-60" />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <div className="text-sm font-bold text-brand-text-muted mb-1">Slot {index + 2}</div>
                                                <div className="text-lg font-bold text-brand-text/50">Add a Hero</div>
                                            </div>
                                        </div>
                                    );
                                }
                            })}
                        </div>

                        <button
                            onClick={() => startJourney(10)}
                            disabled={!hasPlayer}
                            className={`btn-lg rounded-lg px-12 transition-all ${hasPlayer ? 'btn-primary' : 'bg-brand-surface/50 text-brand-text-muted/50 border border-brand-primary/20 cursor-not-allowed'}`}
                        >
                            Begin Journey
                        </button>
                    </div>
                )
            ) : (
                <>
                    <PageHeader 
                        title="Heroes" 
                        subtitle="Manage stats, abilities, and details for your party." 
                        titleAs="h3"
                        showReturnButton={true}
                    />

                    <div className={`sticky top-0 z-40 transition-all duration-300 -mx-2 px-2 bg-brand-bg/95 backdrop-blur-sm ${isScrolled ? 'py-1 shadow-lg border-b border-brand-primary/20' : 'py-2'}`}>
                        <div className={`flex flex-nowrap items-center transition-all duration-300 overflow-x-auto no-scrollbar px-4 pt-1 pb-1 gap-4 justify-around`}>
                            <CharacterTab
                                name={playerCharacter.name}
                                initials={getInitials(playerCharacter.name)}
                                imageUrl={playerCharacter.imageUrl}
                                isActive={selectedCharacterId === 'player'}
                                onClick={() => handleTabClick('player')}
                                currentHp={playerCharacter.currentHitPoints}
                                maxHp={playerCharacter.maxHitPoints}
                                tempHp={playerCharacter.temporaryHitPoints}
                                maxTempHp={playerCharacter.getMaxTemporaryHitPoints(gameData.playerInventory)}
                                stamina={playerCharacter.stamina}
                                maxStamina={playerCharacter.maxStamina}
                                isPlayer={true}
                                isInParty={true}
                                isShrunk={isScrolled}
                            />

                            {companions.map(comp => (
                                <CharacterTab
                                    key={comp.id}
                                    name={comp.name}
                                    initials={getInitials(comp.name)}
                                    imageUrl={comp.imageUrl}
                                    isActive={selectedCharacterId === comp.id}
                                    onClick={() => handleTabClick(comp.id)}
                                    currentHp={comp.currentHitPoints}
                                    maxHp={comp.maxHitPoints}
                                    tempHp={comp.temporaryHitPoints}
                                    maxTempHp={comp.getMaxTemporaryHitPoints(gameData.companionInventories?.[comp.id] || { equipped: [], carried: [], storage: [], assets: [] })}
                                    stamina={comp.stamina}
                                    maxStamina={comp.maxStamina}
                                    isInParty={comp.isInParty !== false}
                                    onToggleParty={() => toggleCompanionParty(comp.id)}
                                    isShrunk={isScrolled}
                                />
                            ))}

                            <div className={`flex flex-col items-center gap-2 group flex-shrink-0 transition-all duration-300 w-20 ${isScrolled ? 'hidden' : 'flex'}`}>
                                <button
                                    onClick={isRecruitmentAvailable ? handleAddCompanion : undefined}
                                    disabled={!isRecruitmentAvailable}
                                    className={`w-20 h-20 flex items-center justify-center rounded-lg transition-colors shrink-0 border-2 border-dashed 
                                        ${isRecruitmentAvailable 
                                            ? 'bg-brand-primary/30 text-brand-text-muted hover:text-brand-accent hover:bg-brand-primary border-brand-primary/50 hover:border-brand-accent cursor-pointer' 
                                            : 'bg-brand-surface/50 text-brand-text-muted/30 border-brand-primary/20 cursor-not-allowed'}`}
                                    title={isRecruitmentAvailable ? "Recruit Companion" : "No Tavern available in this zone to recruit companions."}
                                >
                                    <Icon name="plus" className="w-8 h-8" />
                                </button>
                                <span className={`font-bold truncate text-[10px] ${isRecruitmentAvailable ? 'text-brand-text-muted' : 'text-brand-text-muted/50'} opacity-100`}>
                                    Recruit
                                </span>
                            </div>
                        </div>
                    </div>

                    {activeCharacter && (
                        <div key={activeCharacter.id} className="animate-fade-in mt-3">
                            <CharacterSheet
                                key={activeCharacter.id}
                                initialData={activeCharacter}
                                type={selectedCharacterId === 'player' ? 'player' : 'companion'}
                            />
                        </div>
                    )}
                </>
            )}

            <CharacterCreationWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                type={isPreGame ? wizardType : 'companion'}
            />
        </div>
    );
};

export default CharacterView;

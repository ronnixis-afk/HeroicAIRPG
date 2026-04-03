
import React, { useContext, useState, useEffect, useRef } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import { useUI } from '../context/UIContext';
import { Companion } from '../types';
import { Icon } from './Icon';
import Modal from './Modal';
import { CharacterSheet } from './character/CharacterSheet';
import { CharacterTab } from './character/CharacterTab';
import { CharacterCreationWizard } from './character/CharacterCreationWizard';
import PageHeader from './PageHeader';

const CharacterView: React.FC = () => {
    const { gameData, updateCompanion, startJourney, switchWorld, deleteCompanion, dispatch } = useContext(GameDataContext);
    const { selectedCharacterId, setSelectedCharacterId, creationProgress } = useUI();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardType, setWizardType] = useState<'player' | 'companion'>('player');
    const [editingId, setEditingId] = useState<string | undefined>(undefined);
    const [isAvatarModalOpen, setIsAvatarModalOpen]= useState(false);
    const [avatarSelectionTarget, setAvatarSelectionTarget] = useState<{ type: 'player' | 'companion', id?: string } | null>(null);
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
    const hasPlayer = !!playerCharacter.isInitialized || (playerCharacter.name !== 'Adventurer' && playerCharacter.name !== 'New Hero');

    const handleAddHero = (type: 'player' | 'companion') => {
        setWizardType(type);
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

    const handleEditHero = (type: 'player' | 'companion', id?: string) => {
        setWizardType(type);
        setEditingId(id || (type === 'player' ? 'player' : undefined));
        setIsWizardOpen(true);
    };

    const handleDeleteHero = (type: 'player' | 'companion', id?: string) => {
        if (type === 'player') {
            dispatch({ type: 'UPDATE_PLAYER', payload: { ...playerCharacter, name: 'New Hero', isInitialized: false } as any });
        } else if (id) {
            deleteCompanion(id);
        }
    };

    const handleAvatarClick = (type: 'player' | 'companion', id?: string) => {
        setAvatarSelectionTarget({ type, id });
        setIsAvatarModalOpen(true);
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && avatarSelectionTarget) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const imageUrl = reader.result as string;
                if (avatarSelectionTarget.type === 'player') {
                    dispatch({ type: 'UPDATE_PLAYER', payload: { ...playerCharacter, imageUrl } as any });
                } else if (avatarSelectionTarget.id) {
                    const companion = companions.find(c => c.id === avatarSelectionTarget.id);
                    if (companion) {
                        await updateCompanion(new Companion({ ...companion, imageUrl }));
                    }
                }
                setIsAvatarModalOpen(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const avatarTargetImage = avatarSelectionTarget?.type === 'player' 
        ? playerCharacter.imageUrl 
        : companions.find(c => c.id === avatarSelectionTarget?.id)?.imageUrl;

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
                            <h3 className="text-brand-text mb-0">{creationProgress.step || "Consulting The Fates..."}</h3>
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
                                        <div 
                                            className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-brand-primary/30 cursor-pointer hover:border-brand-accent transition-colors"
                                            onClick={(e) => { e.stopPropagation(); handleAvatarClick('player'); }}
                                        >
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
                                        <div className="flex items-center gap-1 group">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditHero('player'); }}
                                                className="p-2.5 rounded-xl hover:bg-brand-primary/20 text-brand-text-muted transition-all"
                                                title="Edit Hero"
                                            >
                                                <Icon name="edit" className="w-5 h-5 opacity-70 hover:opacity-100 hover:text-brand-accent" />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteHero('player'); }}
                                                className="p-2.5 rounded-xl hover:bg-brand-danger/20 text-brand-text-muted transition-all"
                                                title="Remove Hero"
                                            >
                                                <Icon name="trash" className="w-5 h-5 opacity-70 hover:opacity-100 hover:text-brand-danger" />
                                            </button>
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
                                            <div 
                                                className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-brand-primary/30 cursor-pointer hover:border-brand-accent transition-colors"
                                                onClick={(e) => { e.stopPropagation(); handleAvatarClick('companion', companion.id); }}
                                            >
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
                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleEditHero('companion', companion.id); }}
                                                    className="p-2.5 rounded-xl hover:bg-brand-primary/20 text-brand-text-muted transition-all"
                                                    title="Edit Hero"
                                                >
                                                    <Icon name="edit" className="w-5 h-5 opacity-70 hover:opacity-100 hover:text-brand-accent" />
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteHero('companion', companion.id); }}
                                                    className="p-2.5 rounded-xl hover:bg-brand-danger/20 text-brand-text-muted transition-all"
                                                    title="Remove Hero"
                                                >
                                                    <Icon name="trash" className="w-5 h-5 opacity-70 hover:opacity-100 hover:text-brand-danger" />
                                                </button>
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

                        <div className="flex items-center gap-4">
                            <button
                                onClick={switchWorld}
                                className="btn-md btn-secondary rounded-lg px-8 transition-all"
                            >
                                Exit World
                            </button>
                            <button
                                onClick={() => startJourney()}
                                disabled={!hasPlayer}
                                className={`btn-md rounded-lg px-12 transition-all ${hasPlayer ? 'btn-primary' : 'bg-brand-surface/50 text-brand-text-muted/50 border border-brand-primary/20 cursor-not-allowed'}`}
                            >
                                Begin Journey
                            </button>
                        </div>
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

                        </div>
                    </div>

                    {activeCharacter && (
                        <div key={activeCharacter.id} className="animate-fade-in mt-3">
                            <CharacterSheet
                                key={activeCharacter.id}
                                initialData={activeCharacter}
                                type={selectedCharacterId === 'player' ? 'player' : 'companion'}
                                isScrolled={isScrolled}
                            />
                        </div>
                    )}
                </>
            )}

            <CharacterCreationWizard
                isOpen={isWizardOpen}
                onClose={() => {
                    setIsWizardOpen(false);
                    setEditingId(undefined);
                }}
                type={isPreGame ? wizardType : 'companion'}
                existingId={editingId}
            />

            <Modal 
                isOpen={isAvatarModalOpen} 
                onClose={() => setIsAvatarModalOpen(false)} 
                title="Update Portrait"
            >
                <div className="p-8 flex flex-col items-center gap-8">
                    <p className="text-center text-brand-text-muted text-sm leading-relaxed max-w-[240px]">
                        Select a new image to represent your hero in the chronicles.
                    </p>
                    
                    <div className="w-32 h-32 rounded-2xl overflow-hidden bg-brand-primary/10 border-2 border-brand-surface shadow-inner flex items-center justify-center">
                        {avatarTargetImage ? (
                            <img src={avatarTargetImage} className="w-full h-full object-cover" />
                        ) : (
                            <Icon name="character" className="w-12 h-12 text-brand-text-muted/30" />
                        )}
                    </div>
                    
                    <div className="flex flex-col w-full gap-3">
                        <label className="w-full">
                            <div className="btn-md btn-primary w-full flex items-center justify-center gap-2 cursor-pointer transition-all">
                                <Icon name="upload" className="w-5 h-5" />
                                <span>{avatarTargetImage ? 'Replace Image' : 'Upload Image'}</span>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                        </label>
                        
                        <button 
                            onClick={() => setIsAvatarModalOpen(false)}
                            className="btn-md btn-secondary w-full"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CharacterView;

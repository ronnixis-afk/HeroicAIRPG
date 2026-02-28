
import React, { useContext, useState, useEffect, useRef } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import { useUI } from '../context/UIContext';
import { Companion } from '../types';
import { Icon } from './Icon';
import { CharacterSheet } from './character/CharacterSheet';
import { CharacterTab } from './character/CharacterTab';
import { CharacterCreationWizard } from './character/CharacterCreationWizard';

const CharacterView: React.FC = () => {
    const { gameData, updateCompanion } = useContext(GameDataContext);
    const { selectedCharacterId, setSelectedCharacterId } = useUI();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
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

    const { playerCharacter, companions } = gameData;

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
    const isNewHero = playerCharacter.name === 'Adventurer' || playerCharacter.name === 'New Hero';

    const handleAddCompanion = () => {
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

            {isNewHero ? (
                <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 animate-fade-in bg-brand-bg">
                    <div className="w-32 h-32 rounded-full bg-brand-primary/20 flex items-center justify-center mb-8 border-2 border-dashed border-brand-accent/40 animate-pulse">
                        <Icon name="character" className="w-16 h-16 text-brand-accent opacity-40" />
                    </div>
                    <h1 className="text-brand-text">Forge Your Legend</h1>
                    <p className="text-body-base text-brand-text-muted mb-12 max-w-xs italic leading-relaxed">
                        Every great chronicle starts with a single name and a defined spirit.
                    </p>
                    <button
                        onClick={() => setIsWizardOpen(true)}
                        className="btn-primary btn-lg rounded-full"
                    >
                        Create Your Hero
                    </button>
                </div>
            ) : (
                <>
                    <h2 className="text-brand-text mb-1 text-center">The Party</h2>
                    <p className="text-center text-brand-text-muted mb-4 text-body-sm font-medium">Manage stats, abilities, and details for your party.</p>

                    <div className={`sticky top-0 z-40 transition-all duration-300 -mx-2 px-2 bg-brand-bg/95 backdrop-blur-sm ${isScrolled ? 'py-1 shadow-lg border-b border-brand-primary/20' : 'py-4'}`}>
                        <div className={`flex flex-nowrap items-center transition-all duration-300 overflow-x-auto no-scrollbar px-4 pt-2 pb-2 gap-4 justify-around`}>
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
                                    isInParty={comp.isInParty !== false}
                                    onToggleParty={() => toggleCompanionParty(comp.id)}
                                    isShrunk={isScrolled}
                                />
                            ))}

                            <div className={`flex flex-col items-center gap-2 group flex-shrink-0 transition-all duration-300 w-20 ${isScrolled ? 'hidden' : 'flex'}`}>
                                <button
                                    onClick={handleAddCompanion}
                                    className="w-20 h-20 flex items-center justify-center rounded-full bg-brand-primary/30 text-brand-text-muted hover:text-brand-accent hover:bg-brand-primary transition-colors shrink-0 border-2 border-dashed border-brand-primary/50 hover:border-brand-accent"
                                    title="Add Companion"
                                >
                                    <Icon name="plus" className="w-8 h-8" />
                                </button>
                                <span className="font-bold truncate text-[10px] text-brand-text-muted opacity-100">
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
                type={isNewHero ? 'player' : 'companion'}
            />
        </div>
    );
};

export default CharacterView;

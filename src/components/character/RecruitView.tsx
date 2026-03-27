
import React, { useContext, useState } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import PageHeader from '../PageHeader';
import { CharacterCreationWizard } from './CharacterCreationWizard';

const RecruitView: React.FC = () => {
    const { gameData } = useContext(GameDataContext);
    const { creationProgress } = useUI();
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    if (!gameData) return <div className="text-center p-8 text-brand-text-muted animate-pulse">Consulting the tavern master...</div>;

    const { mapZones, playerCoordinates, knowledge, currentLocale } = gameData;

    const currentZone = mapZones?.find(z => z.coordinates === playerCoordinates);
    const currentPoi = knowledge?.find(k => k.coordinates === playerCoordinates && k.title === currentLocale);
    const isAtPopCenter = currentPoi?.tags?.includes('population-center');

    const isRecruitmentAvailable = isAtPopCenter && (currentZone?.zoneFeatures?.includes('Tavern') || 
        ['Settlement', 'Town', 'City', 'Capital'].includes(currentZone?.populationLevel || ''));

    const handleAddCompanion = () => {
        setIsWizardOpen(true);
    };

    return (
        <div className="p-4 max-w-2xl mx-auto h-full flex flex-col">
            <PageHeader 
                title="Recruit" 
                subtitle="Find capable adventurers to join your cause." 
                showReturnButton={true}
            />

            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-fade-in">
                {creationProgress.isActive ? (
                    <div className="flex flex-col items-center justify-center py-12 w-full">
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
                    <div className="space-y-8 w-full">
                        <div className="flex flex-col items-center gap-6">
                            <div className={`w-32 h-32 flex items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300
                                ${isRecruitmentAvailable 
                                    ? 'bg-brand-primary/20 border-brand-accent text-brand-accent shadow-[0_0_20px_rgba(62,207,142,0.2)]' 
                                    : 'bg-brand-surface/50 border-brand-primary/20 text-brand-text-muted/30'}`}
                            >
                                <Icon name="plus" className="w-12 h-12" />
                            </div>
                            
                            <div className="space-y-2">
                                <h4 className="text-xl font-bold text-brand-text">New Companion</h4>
                                <p className="text-sm text-brand-text-muted max-w-xs mx-auto">
                                    {isRecruitmentAvailable 
                                        ? "There are rumors of skilled help available at the local tavern or settlement center."
                                        : "You must be at a Population Center with a Tavern to recruit new companions."}
                                </p>
                            </div>

                            <button
                                onClick={handleAddCompanion}
                                disabled={!isRecruitmentAvailable}
                                className={`btn-lg px-12 rounded-xl font-bold transition-all
                                    ${isRecruitmentAvailable 
                                        ? 'btn-primary' 
                                        : 'bg-brand-surface/50 text-brand-text-muted/50 border border-brand-primary/20 cursor-not-allowed'}`}
                            >
                                Recruit Companion
                            </button>
                        </div>

                        {!isRecruitmentAvailable && (
                            <div className="p-4 bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-xs text-brand-text-muted italic">
                                Visit a nearby settlement or city to find more heroes for your party.
                            </div>
                        )}
                    </div>
                )}
            </div>

            <CharacterCreationWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                type='companion'
            />
        </div>
    );
};

export default RecruitView;

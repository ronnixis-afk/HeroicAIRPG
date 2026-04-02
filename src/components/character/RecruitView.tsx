
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
    const [wizardMethod, setWizardMethod] = useState<'recruitment' | 'shipyard' | 'manual' | undefined>(undefined);

    if (!gameData) return <div className="text-center p-8 text-brand-text-muted animate-pulse">Consulting the tavern master...</div>;

    const { mapZones, playerCoordinates, knowledge, currentLocale } = gameData;

    const currentZone = mapZones?.find(z => z.coordinates === playerCoordinates);
    const currentPoi = knowledge?.find(k => k.coordinates === playerCoordinates && k.title === currentLocale);
    const isAtPopCenter = currentPoi?.tags?.includes('population-center');

    const allFeatures = [
        ...(currentZone?.zoneFeatures || []),
        ...(currentPoi?.tags || [])
    ];

    const getFeatureLabel = (category: 'ally' | 'mount' | 'vessel') => {
        if (category === 'ally') {
            const found = allFeatures.find(f => ['Bar', 'Inn', 'Saloon', 'Tavern', 'Club', 'Pub'].includes(f));
            return found || 'Tavern';
        }
        if (category === 'mount') {
            const found = allFeatures.find(f => ['Stables', 'Mounts', 'Garage', 'Stable', 'Barn'].includes(f));
            return found || 'Stables';
        }
        if (category === 'vessel') {
            const found = allFeatures.find(f => ['Shipyard', 'Dockyard', 'Hangar', 'Port', 'Harbor'].includes(f));
            return found || 'Shipyard';
        }
        return '';
    };

    const isRecruitmentAvailable = isAtPopCenter && (currentZone?.zoneFeatures?.includes('Tavern') || 
        ['Settlement', 'Town', 'City', 'Capital'].includes(currentZone?.populationLevel || ''));

    const handleAddCompanion = (method: 'recruitment' | 'shipyard' | 'manual' | undefined) => {
        setWizardMethod(method);
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
                    <div className="space-y-6 w-full max-w-md animate-fade-in">
                        <div className="grid grid-cols-1 gap-4 w-full">
                            <button
                                onClick={() => handleAddCompanion('recruitment')}
                                disabled={!isRecruitmentAvailable}
                                className="group relative flex flex-row items-center p-6 bg-brand-primary/10 border-2 border-brand-primary rounded-3xl transition-all hover:border-brand-accent hover:bg-brand-accent/5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="w-14 h-14 rounded-full bg-brand-accent flex items-center justify-center mr-6 shadow-lg shadow-brand-accent/20 group-hover:scale-110 transition-transform flex-shrink-0">
                                    <Icon name="character" className="w-8 h-8 text-black" />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-lg font-bold text-brand-text group-hover:text-brand-accent">{getFeatureLabel('ally')}</h4>
                                    <p className="text-xs text-brand-text-muted mt-1 leading-relaxed">Hire a skilled hero to join your party and fight by your side.</p>
                                </div>
                            </button>

                            <button
                                disabled={true}
                                className="group relative flex flex-row items-center p-6 bg-brand-surface/30 border-2 border-brand-primary/10 rounded-3xl transition-all cursor-not-allowed opacity-60"
                            >
                                <div className="w-14 h-14 rounded-full bg-brand-surface flex items-center justify-center mr-6 shadow-lg group-hover:scale-105 transition-transform flex-shrink-0">
                                    <Icon name="store" className="w-8 h-8 text-brand-text-muted" />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-lg font-bold text-brand-text-muted">{getFeatureLabel('mount')}</h4>
                                    <p className="text-xs text-brand-text-muted mt-1 leading-relaxed">Acquire a loyal mount to travel faster across the dangerous wilderness.</p>
                                </div>
                                <div className="absolute top-4 right-4 bg-brand-primary/20 px-2 py-0.5 rounded-full text-[8px] font-bold text-brand-text-muted">
                                    Planned
                                </div>
                            </button>

                            <button
                                onClick={() => handleAddCompanion('shipyard')}
                                disabled={!isRecruitmentAvailable}
                                className="group relative flex flex-row items-center p-6 bg-brand-primary/10 border-2 border-brand-primary rounded-3xl transition-all hover:border-brand-accent hover:bg-brand-accent/5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="w-14 h-14 rounded-full bg-brand-accent flex items-center justify-center mr-6 shadow-lg shadow-brand-accent/20 group-hover:scale-110 transition-transform flex-shrink-0">
                                    <Icon name="world" className="w-8 h-8 text-black" />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-lg font-bold text-brand-text group-hover:text-brand-accent">{getFeatureLabel('vessel')}</h4>
                                    <p className="text-xs text-brand-text-muted mt-1 leading-relaxed">Commission a powerful vessel to explore distant lands and far-off horizons.</p>
                                </div>
                            </button>
                        </div>

                        {!isRecruitmentAvailable && (
                            <div className="p-4 bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-xs text-brand-text-muted italic text-center">
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
                initialMethod={wizardMethod}
            />
        </div>
    );
};

export default RecruitView;

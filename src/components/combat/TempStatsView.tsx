// components/combat/TempStatsView.tsx

import React, { useState, useContext, useEffect } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { DEFAULT_TEMPLATES, DEFAULT_SIZE_MODIFIERS, DEFAULT_AFFINITIES, DEFAULT_ARCHETYPE_DEFINITIONS } from '../../utils/mechanics';
import { Icon } from '../Icon';
import { ActorAvatar } from './ActorAvatar';
import { ActorEditor } from './ActorEditor';
import { StagingModal } from './StagingModal';
import { ConfigurationModal } from './ConfigurationModal';
import { useWorldSelectors } from '../../hooks/world/useWorldSelectors';

const TempStatsView: React.FC = () => {
    const { 
        gameData, 
        addCombatEnemy, 
        duplicateCombatEnemy,
        updateCombatEnemy, 
        deleteCombatEnemy, 
        concludeCombat, 
        clearScene,
        addToTurnOrder, 
        updateTemplate,
        updateAffinity,
        updateSizeModifier,
        updateBaseScore,
        updateArchetype,
        initiateCombatSequence
    } = useContext(GameDataContext);
    
    const { selectedCharacterId } = useUI();

    // UI Selectors
    const { getCombatSlots } = useWorldSelectors(gameData);

    // UI State
    const [isAddEnemyModalOpen, setIsAddEnemyModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<string | null>(null);

    // Load Data
    if (!gameData) {
        return <div className="p-8 text-center text-body-base text-brand-text-muted">Loading...</div>;
    }
    
    const enemies = gameData.combatState?.enemies || [];
    const turnOrder = gameData.combatState?.turnOrder || [];
    const isActive = gameData.combatState?.isActive || false;
    const templates = gameData.templates || DEFAULT_TEMPLATES;
    const affinities = gameData.affinities || DEFAULT_AFFINITIES;
    const sizeModifiers = gameData.sizeModifiers || DEFAULT_SIZE_MODIFIERS;
    const archetypes = gameData.archetypes || DEFAULT_ARCHETYPE_DEFINITIONS;
    const baseScore = gameData.combatBaseScore ?? 8;
    const playerLevel = gameData.playerCharacter.level || 1;
    const currentLocale = gameData.currentLocale;

    // Ensure active tab defaults to first enemy if available or respects context selection
    useEffect(() => {
        if (enemies.length > 0) {
            // If we have a specific selection from context, focus it
            if (selectedCharacterId && enemies.find(e => e.id === selectedCharacterId)) {
                setActiveTab(selectedCharacterId);
            } 
            // Otherwise maintain existing tab if valid
            else if (!activeTab || !enemies.find(e => e.id === activeTab)) {
                setActiveTab(enemies[0].id);
            }
        } else {
            setActiveTab(null);
        }
    }, [enemies, activeTab, selectedCharacterId]);

    const allActors = [
        { ...gameData.playerCharacter, type: 'ally' },
        ...gameData.companions.map(c => ({ ...c, type: 'ally' })),
        ...enemies.map(e => ({ ...e, type: e.isAlly ? 'ally' : 'enemy' }))
    ];

    const actorsInInitiative = turnOrder.map(id => allActors.find(a => a.id === id)).filter(a => a !== undefined);
    
    const availableActors = allActors.filter(a => {
        if (turnOrder.includes(a.id)) return false;
        // Don't show inactive companions
        const companion = gameData.companions.find(c => c.id === a.id);
        if (companion) {
            return companion.isInParty !== false; 
        }
        return true;
    });

    const hasAnyEnemies = enemies.length > 0; 
    const activeActor = enemies.find(e => e.id === activeTab);

    // Handlers
    const handleClearScene = () => {
        if (window.confirm("Clear all actors from the scene? This cannot be undone.")) {
            clearScene();
        }
    };
    
    const handleStartCombat = () => {
        // Calculate power deficit reinforcement slots
        const reinforcements = getCombatSlots();
        initiateCombatSequence("Combat Sequence Initiated!", reinforcements as any);
    };

    return (
        <>
            <div className="p-2 pt-8 max-w-2xl mx-auto pb-24">
                {/* Header */}
                <div className="flex flex-col items-center mb-4 relative px-1">
                    <h1 className="text-center">
                        {isActive ? 'Combat Manager' : 'Scene Manager'}
                    </h1>
                    <div className="absolute right-0 top-1 flex gap-1">
                        {!isActive && enemies.length > 0 && (
                            <button onClick={handleClearScene} className="btn-icon text-brand-text-muted hover:text-brand-danger" title="Clear Scene">
                                <Icon name="trash" className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={() => setIsTemplateModalOpen(true)} className="btn-icon text-brand-text-muted hover:text-brand-accent" title="Configure Templates">
                            <Icon name="settings" className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-center text-brand-text-muted mb-8 text-body-sm">
                        {isActive ? 'Manage initiative, foes, and allies.' : 'Stage actors and prepare for the next encounter.'}
                    </p>
                </div>

                {/* Staging Area */}
                <div className="bg-brand-primary/10 p-5 rounded-3xl border border-brand-primary/30 mb-8 shadow-inner">
                    {availableActors.length > 0 ? (
                        <div className="space-y-4">
                            <h3 className="text-center">Add to Fight</h3>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {availableActors.map(actor => (
                                    <button 
                                        key={actor.id} 
                                        onClick={() => addToTurnOrder(actor.id)}
                                        className={`btn-sm rounded-full transition-all border ${actor.type === 'ally' ? 'btn-secondary !border-brand-accent/30' : 'border-brand-danger/30 text-brand-danger hover:bg-brand-danger hover:text-white'}`}
                                    >
                                        + {actor.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 bg-brand-bg/50 rounded-2xl border border-dashed border-brand-primary/40">
                            <p className="text-brand-text-muted text-body-sm italic">All available actors are currently in the fray.</p>
                        </div>
                    )}
                </div>

                {/* Combat Control Button */}
                <div className="flex justify-center mb-12">
                    {!isActive ? (
                        <button 
                            onClick={handleStartCombat} 
                            disabled={!hasAnyEnemies}
                            className="btn-primary btn-md w-full sm:w-auto gap-3 shadow-xl"
                        >
                            <Icon name="sword" className="w-5 h-5" />
                            {actorsInInitiative.length === 0 ? 'Roll Initiative and Fight' : 'Start Combat'}
                        </button>
                    ) : (
                        <button
                            onClick={concludeCombat}
                            className="btn-primary btn-md w-full sm:w-auto !bg-brand-danger !text-white gap-3 shadow-lg shadow-brand-danger/20"
                        >
                            <Icon name="close" className="w-5 h-5" />
                            End Combat
                        </button>
                    )}
                </div>

                {/* Actors List */}
                <div className="relative flex justify-center items-center mb-6 px-1 border-b border-brand-primary/20 pb-4 min-h-[44px]">
                    <h2 className="mb-0">Actors</h2>
                    <button
                        onClick={() => setIsAddEnemyModalOpen(true)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 btn-secondary btn-sm rounded-full gap-1.5"
                    >
                        <Icon name="plus" className="w-3.5 h-3.5" /> 
                        <span>Add Actor</span>
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-6">
                    {enemies.map(actor => (
                        <ActorAvatar 
                            key={actor.id} 
                            actor={actor} 
                            isActive={activeTab === actor.id} 
                            onClick={() => setActiveTab(actor.id)} 
                        />
                    ))}
                </div>

                {/* Active Actor Editor */}
                {activeActor ? (
                    <div className="bg-brand-surface border border-brand-primary rounded-3xl p-6 shadow-2xl min-h-[300px] animate-page overflow-hidden">
                        <ActorEditor 
                            key={activeActor.id}
                            actor={activeActor}
                            onUpdate={updateCombatEnemy}
                            onDelete={deleteCombatEnemy}
                            onDuplicate={duplicateCombatEnemy}
                            affinities={affinities}
                            templates={templates}
                            playerLevel={playerLevel}
                            baseScore={baseScore}
                            archetypeDefinitions={archetypes}
                        />
                    </div>
                ) : (
                    <div className="py-20 text-center text-brand-text-muted flex flex-col items-center justify-center h-64 bg-brand-primary/5 rounded-3xl border border-dashed border-brand-primary/30">
                        <Icon name="skull" className="w-12 h-12 mb-4 opacity-10" />
                        <p className="mb-4 text-body-base italic">No actor selected in the current scene.</p>
                        <button onClick={() => setIsAddEnemyModalOpen(true)} className="btn-tertiary text-brand-accent hover:underline">Stage a new actor</button>
                    </div>
                )}
            </div>

            {/* Modals */}
            <StagingModal 
                isOpen={isAddEnemyModalOpen}
                onClose={() => setIsAddEnemyModalOpen(false)}
                templates={templates}
                affinities={affinities}
                sizeModifiers={sizeModifiers}
                baseScore={baseScore}
                playerLevel={playerLevel}
                onAddActor={(actor) => addCombatEnemy(actor, currentLocale)}
                archetypeDefinitions={archetypes}
            />

            <ConfigurationModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                templates={templates}
                affinities={affinities}
                sizeModifiers={sizeModifiers}
                baseScore={baseScore}
                archetypeDefinitions={archetypes}
                onUpdateTemplate={updateTemplate}
                onUpdateAffinity={updateAffinity}
                onUpdateSizeModifier={updateSizeModifier}
                onUpdateBaseScore={updateBaseScore}
                onUpdateArchetype={updateArchetype}
            />
        </>
    );
};

export default TempStatsView;
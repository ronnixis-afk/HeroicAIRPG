// components/ObjectivesView.tsx

import React, { useState, useContext } from 'react';
import Accordion from './Accordion';
import { GameDataContext } from '../context/GameDataContext';
import { type LoreEntry, LORE_TAGS } from '../types';
import { Icon } from './Icon';

const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const NewTag: React.FC = () => (
    <span className="bg-brand-accent text-black text-[9px] font-black px-1.5 py-0.5 rounded ml-2 flex-shrink-0">New</span>
);

const EditableObjectiveContent: React.FC<{
    entry: LoreEntry;
    onDelete: (id: string) => void;
    onFollowUp?: (entryId: string) => void;
    isFollowUpLoading?: boolean;
    onTrack: (objectiveId: string | null) => void;
    isTracking?: boolean;
    onTurnIn: (objectiveId: string) => void;
    isTurningIn?: boolean;
    locationLabel?: string; 
}> = ({ entry, onDelete, onFollowUp, isFollowUpLoading, onTrack, isTracking, onTurnIn, isTurningIn, locationLabel }) => {
    
    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to abandon the quest "${entry.title}"? This cannot be undone.`)) {
            onDelete(entry.id);
        }
    };

    const handleTrackToggle = () => {
        onTrack(entry.isTracked ? null : entry.id);
    };

    const displayTags = entry.tags?.filter(t => LORE_TAGS.includes(t as any) || t === 'main' || t === 'side_quest') || [];

    return (
        <div className="space-y-6 pt-2 pb-4 animate-page">
            <div className="flex flex-wrap gap-2">
                {displayTags.map(tag => (
                    <span key={tag} className="flex items-center bg-brand-surface border border-brand-primary rounded-full px-2.5 py-0.5 text-[10px] font-bold text-brand-text-muted capitalize">
                        <span className="mr-1 opacity-50">#</span>
                        {tag}
                    </span>
                ))}
                {entry.coordinates && (
                    <span className="text-brand-accent text-[10px] font-bold flex items-center gap-1 bg-brand-accent/10 px-2.5 py-0.5 rounded-full border border-brand-accent/20">
                        <Icon name="location" className="w-3 h-3" />
                        {locationLabel ? toTitleCase(locationLabel) : entry.coordinates}
                    </span>
                )}
            </div>

            {entry.status === 'active' && (
                <div className="space-y-1.5">
                    <label className="block text-body-sm font-bold text-brand-accent">Current lead</label>
                    <p className="text-body-base text-brand-text font-medium leading-relaxed">
                        {entry.nextStep || entry.content}
                    </p>
                </div>
            )}

             <div className="opacity-70">
                <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5">Quest details</label>
                <div className="text-body-sm text-brand-text-muted leading-relaxed">
                    {entry.content}
                </div>
            </div>

            <div className="space-y-3">
                 <label className="block text-body-sm font-bold text-brand-text-muted">Chronicle of progress</label>
                 {entry.milestones && entry.milestones.length > 0 ? (
                    <div className="space-y-4 border-l border-brand-primary/40 ml-1.5 pl-5 py-1">
                        {entry.milestones.map((m, index) => (
                            <div key={index} className="relative">
                                <div className="absolute -left-[24.5px] top-1.5 h-2 w-2 rounded-full bg-brand-primary border border-brand-bg shadow-sm"></div>
                                <p className="text-body-sm text-brand-text-muted italic leading-relaxed">{m}</p>
                            </div>
                        ))}
                    </div>
                 ) : (
                    <p className="text-body-sm italic text-brand-text-muted/40 pl-1.5">No milestones recorded for this path yet.</p>
                 )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-brand-primary/10">
                <div className="flex items-center gap-2">
                    {entry.status === 'active' && (
                        <button
                            onClick={() => onTurnIn(entry.id)}
                            disabled={isTurningIn}
                            className="btn-primary btn-sm gap-2"
                        >
                            {isTurningIn ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : <Icon name="check" className="w-4 h-4" />}
                            Complete
                        </button>
                    )}
                     <button 
                        onClick={handleDelete}
                        className="btn-icon p-2 text-brand-text-muted hover:text-brand-danger transition-colors"
                        title="Abandon quest"
                    >
                        <Icon name="trash" className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    {entry.status === 'active' && onFollowUp && (
                        <button
                            onClick={() => onFollowUp(entry.id)}
                            disabled={isFollowUpLoading}
                            className="btn-secondary btn-sm gap-2"
                        >
                            {isFollowUpLoading ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : <Icon name="sparkles" className="w-4 h-4" />}
                            Help
                        </button>
                    )}
                    {entry.status === 'active' && (
                        <button
                            onClick={handleTrackToggle}
                            disabled={isTracking}
                            className={`btn-secondary btn-sm gap-2 ${entry.isTracked ? 'bg-brand-accent/5 border-brand-accent/30 text-brand-accent' : ''}`}
                        >
                            {isTracking && <Icon name="spinner" className="w-3 h-3 animate-spin" />}
                            {entry.isTracked ? 'Tracked' : 'Track'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


const ObjectivesView: React.FC = () => {
    const { 
        gameData, 
        deleteObjective,
        markObjectiveAsSeen,
        generateObjectiveFollowUp,
        trackObjective,
        attemptObjectiveTurnIn,
    } = useContext(GameDataContext);
    const [openObjectiveIds, setOpenObjectiveIds] = useState<Record<string, boolean>>({});
    const [followUpLoadingId, setFollowUpLoadingId] = useState<string | null>(null);
    const [trackingId, setTrackingId] = useState<string | null>(null);
    const [turningInId, setTurningInId] = useState<string | null>(null);

    if (!gameData) {
        return <div className="text-center p-8 text-body-base text-brand-text-muted animate-pulse">Loading quest log...</div>;
    }

    const getLocationLabel = (coords: string | undefined): string | undefined => {
        if (!coords || !gameData.mapZones) return undefined;
        const zone = gameData.mapZones.find(z => z.coordinates === coords);
        if (zone) return zone.name;
        return undefined;
    };

    const handleToggle = (objective: LoreEntry) => {
        const isOpen = !!openObjectiveIds[objective.id];
        if (!isOpen && objective.isNew) {
            markObjectiveAsSeen(objective.id);
        }
        setOpenObjectiveIds(prev => ({ ...prev, [objective.id]: !isOpen }));
    };

    const handleFollowUp = async (objectiveId: string) => {
        setFollowUpLoadingId(objectiveId);
        try {
            await generateObjectiveFollowUp(objectiveId);
        } catch (error) {
            console.error(error);
        } finally {
            setFollowUpLoadingId(null);
        }
    };
    
    const handleTrack = async (objectiveId: string | null) => {
        if (!objectiveId) {
            await trackObjective(null);
            return;
        }
        setTrackingId(objectiveId);
        try {
            await trackObjective(objectiveId);
        } catch (error) {
            console.error(error);
        } finally {
            setTrackingId(null);
        }
    };

    const handleTurnIn = async (objectiveId: string) => {
        setTurningInId(objectiveId);
        try {
            await attemptObjectiveTurnIn(objectiveId);
        } catch (error) {
            console.error(error);
        } finally {
            setTurningInId(null);
        }
    };

    const trackedObjective = gameData.objectives.find(o => o.isTracked && o.status === 'active');
    const activeObjectives = gameData.objectives.filter(o => o.status === 'active' && !o.isTracked).sort((a,b) => b.id.localeCompare(a.id));
    const completedObjectives = gameData.objectives.filter(o => o.status === 'completed').sort((a,b) => b.id.localeCompare(a.id));

    const SectionHeader = ({ title, subtitle }: { title: string, subtitle?: string }) => (
        <div className="text-center mb-10">
            <h2 className="text-brand-text">{title}</h2>
            {subtitle && <p className="text-body-sm text-brand-text-muted mt-1 font-medium italic">{subtitle}</p>}
        </div>
    );

    const ObjectiveTitle = ({ entry }: { entry: LoreEntry }) => (
        <div className="flex items-center gap-4">
            <div className={`shrink-0 rounded-full transition-all duration-300 ${
                entry.isTracked 
                    ? 'w-2.5 h-2.5 bg-brand-accent shadow-[0_0_8px_rgba(62,207,142,0.5)]' 
                    : 'w-1.5 h-1.5 bg-brand-text'
            }`} />
            <span className={`text-body-lg font-bold truncate ${entry.status === 'completed' ? 'line-through opacity-40' : ''}`}>
                {entry.title}
            </span>
            {entry.isNew && <NewTag />}
        </div>
    );

    return (
        <div className="p-2 pt-8 max-w-2xl mx-auto pb-32">
            <div className="text-center mb-12 pb-6 border-b border-brand-primary/20">
                <h1 className="text-brand-text mb-2">Quest Log</h1>
                <p className="text-body-base text-brand-text-muted font-medium italic leading-relaxed">
                    The chronicle of your journey through the uncharted lands.
                </p>
            </div>

            {trackedObjective && (
                <div className="mb-16">
                    <SectionHeader title="Primary quest" subtitle="The current focus of your journey." />
                    <div className="border-t border-brand-primary/20">
                        <Accordion
                            title={<ObjectiveTitle entry={trackedObjective} />}
                            isOpen={openObjectiveIds[trackedObjective.id] ?? true}
                            onToggle={() => handleToggle(trackedObjective)}
                        >
                            <EditableObjectiveContent 
                                entry={trackedObjective}
                                onDelete={deleteObjective}
                                onFollowUp={handleFollowUp}
                                isFollowUpLoading={followUpLoadingId === trackedObjective.id}
                                onTrack={handleTrack}
                                isTracking={trackingId === trackedObjective.id}
                                onTurnIn={handleTurnIn}
                                isTurningIn={turningInId === trackedObjective.id}
                                locationLabel={getLocationLabel(trackedObjective.coordinates)}
                            />
                        </Accordion>
                    </div>
                </div>
            )}

            <div className="space-y-20">
                <div>
                    <SectionHeader title="Side quests" subtitle="Current leads and ongoing tasks." />
                    {activeObjectives.length > 0 ? (
                        <div className="border-t border-brand-primary/20">
                            {activeObjectives.map(objective => (
                                <Accordion
                                    key={objective.id}
                                    title={<ObjectiveTitle entry={objective} />}
                                    isOpen={!!openObjectiveIds[objective.id]}
                                    onToggle={() => handleToggle(objective)}
                                >
                                    <EditableObjectiveContent 
                                        entry={objective}
                                        onDelete={deleteObjective}
                                        onFollowUp={handleFollowUp}
                                        isFollowUpLoading={followUpLoadingId === objective.id}
                                        onTrack={handleTrack}
                                        isTracking={trackingId === objective.id}
                                        onTurnIn={handleTurnIn}
                                        isTurningIn={turningInId === objective.id}
                                        locationLabel={getLocationLabel(objective.coordinates)}
                                    />
                                </Accordion>
                            ))}
                        </div>
                    ) : (
                        !trackedObjective && <p className="text-center text-body-sm text-brand-text-muted italic py-10 opacity-40">No active paths found in your chronicle.</p>
                    )}
                </div>

                {completedObjectives.length > 0 && (
                    <div className="opacity-60">
                        <SectionHeader title="Completed" subtitle="Past deeds and finished stories." />
                        <div className="border-t border-brand-primary/20">
                            {completedObjectives.map(objective => (
                                <Accordion
                                    key={objective.id}
                                    title={<ObjectiveTitle entry={objective} />}
                                    isOpen={!!openObjectiveIds[objective.id]}
                                    onToggle={() => handleToggle(objective)}
                                >
                                    <EditableObjectiveContent 
                                        entry={objective}
                                        onDelete={deleteObjective}
                                        onTrack={handleTrack}
                                        onTurnIn={() => {}} 
                                        locationLabel={getLocationLabel(objective.coordinates)}
                                    />
                                </Accordion>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ObjectivesView;

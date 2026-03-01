import React, { useContext } from 'react';
import { useUI } from '../../context/UIContext';
import { GameDataContext } from '../../context/GameDataContext';
import Modal from '../Modal';
import { ItemDetailView } from '../inventory/ItemDetailView';
import NPCDetailsModal from '../npcs/NPCDetailsModal';
import { LoreEntry, NPC, Item, MapZone, MapSector, Companion } from '../../types';
import { companionToNPC } from '../../utils/npcUtils';

const getHostilityLabel = (value: number): { label: string, color: string } => {
    if (value <= -16) return { label: 'Sanctuary', color: 'text-emerald-400' };
    if (value <= -6) return { label: 'Safe', color: 'text-teal-400' };
    if (value <= 5) return { label: 'Neutral', color: 'text-yellow-400' };
    if (value <= 15) return { label: 'Hostile', color: 'text-orange-400' };
    return { label: 'Deadly', color: 'text-red-500' };
};

export const EntityLightbox: React.FC = () => {
    const { inspectedEntity, setInspectedEntity } = useUI();
    const { gameData, updateNPC, deleteNPC, updateCompanion } = useContext(GameDataContext);

    if (!inspectedEntity || !gameData) return null;

    const { type, data } = inspectedEntity;
    const onClose = () => setInspectedEntity(null);

    const handleNpcSave = (updatedNpc: NPC) => {
        updateNPC(updatedNpc);

        // If this NPC is a companion, sync back to the companion state as well
        if (updatedNpc.companionId) {
            const companion = gameData.companions.find(c => c.id === updatedNpc.companionId);
            if (companion) {
                const updatedCompanion = new Companion({
                    ...companion,
                    name: updatedNpc.name,
                    appearance: updatedNpc.appearance,
                    personality: updatedNpc.description,
                    relationship: updatedNpc.relationship,
                    alignment: updatedNpc.moralAlignment,
                    race: updatedNpc.race,
                    gender: updatedNpc.gender,
                    rank: updatedNpc.rank,
                    size: updatedNpc.size,
                    template: updatedNpc.template,
                    cr: updatedNpc.cr,
                    affinity: updatedNpc.affinity,
                    archetype: updatedNpc.archetype
                });
                updateCompanion(updatedCompanion);
            }
        }
    };

    const renderContent = () => {
        switch (type) {
            case 'item':
                return (
                    <ItemDetailView
                        item={data as Item}
                        ownerId="player"
                        character={gameData.playerCharacter}
                        fromList="carried"
                        onActionCompleted={onClose}
                    />
                );
            case 'npc':
                let npcData: NPC;
                if ('experiencePoints' in data) {
                    const registryEntry = gameData.npcs?.find(n => n.companionId === data.id);
                    npcData = registryEntry || companionToNPC(data as Companion);
                } else {
                    npcData = data as NPC;
                }

                return (
                    <NPCDetailsModal
                        isOpen={true}
                        onClose={onClose}
                        npc={npcData}
                        onSave={handleNpcSave}
                        onDelete={deleteNPC}
                    />
                );
            case 'location':
                // Check if it's a MapZone (string coordinates) or MapSector (array coordinates)
                if (typeof (data as any).coordinates === 'string') {
                    const zone = data as MapZone;
                    const hInfo = getHostilityLabel(zone.hostility || 0);
                    return (
                        <div className="space-y-6 p-2">
                            <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-brand-text mb-1 truncate">{zone.name}</h2>
                                    <span className="text-body-sm font-mono font-bold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded border border-brand-accent/20">
                                        {zone.coordinates}
                                    </span>
                                </div>
                                <div className="text-right flex-shrink-0 ml-4">
                                    <label className="block text-body-sm font-bold text-brand-text-muted mb-1">Threat</label>
                                    <span className={`text-xs font-black ${hInfo.color}`}>{hInfo.label}</span>
                                </div>
                            </div>

                            <div className="bg-brand-primary/20 p-4 rounded-xl border border-brand-primary/50 shadow-inner">
                                <p className="text-body-base text-brand-text leading-relaxed whitespace-pre-wrap italic opacity-90">
                                    {zone.description || "A mysterious place with no recorded overview."}
                                </p>
                            </div>

                            {zone.keywords && zone.keywords.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {zone.keywords.map(k => (
                                        <span key={k} className="px-2.5 py-1 bg-brand-primary/30 rounded-md text-body-sm font-mono text-brand-accent border border-brand-accent/10 font-bold">
                                            #{k}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="pt-4 border-t border-brand-primary/10 flex justify-center">
                                <button
                                    onClick={onClose}
                                    className="btn-primary btn-md px-10"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    );
                }

                const sector = data as MapSector;
                return (
                    <div className="space-y-4 p-2">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: sector.color }} />
                            <h2 className="text-brand-text">{sector.name}</h2>
                        </div>
                        <p className="text-body-sm text-brand-text-muted font-bold opacity-60">
                            Classification: Sector
                        </p>
                        <div className="bg-brand-primary/20 p-4 rounded-xl border border-brand-primary/50">
                            <p className="text-body-base text-brand-text leading-relaxed whitespace-pre-wrap">
                                {sector.description}
                            </p>
                        </div>
                        {sector.keywords && sector.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {sector.keywords.map(k => (
                                    <span key={k} className="px-2 py-1 bg-brand-primary rounded text-body-sm font-mono text-brand-text-muted">#{k}</span>
                                ))}
                            </div>
                        )}
                        <div className="pt-4 border-t border-brand-primary/10 flex justify-center">
                            <button
                                onClick={onClose}
                                className="btn-primary btn-md px-10"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                );
            case 'lore':
            case 'objective':
                const entry = data as LoreEntry;
                return (
                    <div className="space-y-4 p-2">
                        <h2 className="text-brand-text">{entry.title}</h2>
                        <div className="flex flex-wrap gap-2">
                            {entry.tags?.map(t => (
                                <span key={t} className="bg-brand-primary text-brand-text-muted text-body-sm font-bold px-2.5 py-0.5 rounded-full border border-brand-surface capitalize">{t}</span>
                            ))}
                        </div>
                        <div className="bg-brand-primary/20 p-4 rounded-xl border border-brand-primary/50">
                            <p className="text-body-base text-brand-text leading-relaxed whitespace-pre-wrap">
                                {entry.content}
                            </p>
                        </div>
                        {entry.milestones && entry.milestones.length > 0 && (
                            <div className="space-y-3">
                                <label className="text-body-sm font-black text-brand-text-muted">Chronicle History</label>
                                <div className="space-y-2 pl-3 border-l-2 border-brand-accent/30 ml-1">
                                    {entry.milestones.map((m, i) => (
                                        <p key={i} className="text-body-sm text-brand-text italic leading-relaxed">{m}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="pt-4 border-t border-brand-primary/10 flex justify-center">
                            <button
                                onClick={onClose}
                                className="btn-primary btn-md px-10"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                );
            default:
                return <p className="text-center p-8 text-body-base">Entity details unavailable.</p>;
        }
    };

    if (type === 'npc') return renderContent();

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={type === 'location' ? 'Discovery Detail' : 'Information'}
        >
            {renderContent()}
        </Modal>
    );
};
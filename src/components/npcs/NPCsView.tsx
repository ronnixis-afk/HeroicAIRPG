
import React, { useContext, useMemo, useState } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { Icon } from '../Icon';
import NPCCard from './NPCCard';
import NPCDetailsModal from './NPCDetailsModal';
import { companionToNPC } from '../../utils/npcUtils';
import { type NPC, Companion } from '../../types';

const NPCsView: React.FC = () => {
    const { gameData, addNPC, updateNPC, deleteNPC, updateCompanion } = useContext(GameDataContext);
    const [selectedNPC, setSelectedNPC] = useState<NPC | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    if (!gameData) return <div className="text-center p-12 text-brand-text-muted animate-pulse">Loading social ledger...</div>;

    const currentLocale = gameData.currentLocale || "";

    const sortedNPCs = useMemo(() => {
        // 1. Unify all NPCs
        const party = gameData.companions
            .filter(c => !c.isShip)
            .map(c => companionToNPC(c));

        const partyNames = new Set(party.map(p => p.name.toLowerCase().trim()));
        
        // Registry NPCs excluding those already in party
        const registry = (gameData.npcs || [])
            .filter(npc => {
                const name = npc.name?.toLowerCase().trim() || '';
                return name && !partyNames.has(name) && !npc.isShip;
            });

        const all = [...party, ...registry];

        // 2. Filter based on essential status or party membership
        const filtered = all.filter(npc => {
            const isCompanion = !!npc.companionId;
            const isEssential = npc.is_essential === true;
            
            // Show if essential OR already in our party
            if (!isEssential && !isCompanion) return false;

            if (searchQuery.trim()) {
                return npc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       npc.description?.toLowerCase().includes(searchQuery.toLowerCase());
            }
            return true;
        });

        // 3. Refined Sort Logic
        return filtered.sort((a, b) => {
            // Priority 1: Companions (In Party) always on top
            const aIsComp = !!a.companionId;
            const bIsComp = !!b.companionId;
            if (aIsComp && !bIsComp) return -1;
            if (!aIsComp && bIsComp) return 1;
            if (aIsComp && bIsComp) return a.name.localeCompare(b.name);

            // Priority 2: Current Locale Matching (for non-companions)
            const norm = (s: string) => s.toLowerCase().replace(/^(the|a|an)\s+/i, '').trim();
            const targetLocale = norm(currentLocale);
            const aLocale = norm(a.currentPOI || "");
            const bLocale = norm(b.currentPOI || "");

            const aAtLocale = targetLocale && aLocale === targetLocale;
            const bAtLocale = targetLocale && bLocale === targetLocale;

            if (aAtLocale && !bAtLocale) return -1;
            if (!aAtLocale && bAtLocale) return 1;

            if (aAtLocale && bAtLocale) {
                // Priority 3: Status within current locale (Alive before Dead)
                const aDead = a.status?.toLowerCase() === 'dead';
                const bDead = b.status?.toLowerCase() === 'dead';
                if (!aDead && bDead) return -1;
                if (aDead && !bDead) return 1;
                return a.name.localeCompare(b.name);
            }

            // Priority 4: Everything else alphabetically
            return a.name.localeCompare(b.name);
        });
    }, [gameData.companions, gameData.npcs, gameData.currentLocale, searchQuery]);

    const handleCardClick = (npc: NPC) => {
        setSelectedNPC(npc);
        setIsModalOpen(true);
    };

    const handleSaveNPC = (updatedNPC: NPC) => {
        updateNPC(updatedNPC);
        if (updatedNPC.companionId && gameData) {
            const companion = gameData.companions.find(c => c.id === updatedNPC.companionId);
            if (companion) {
                const updatedCompanion = new Companion({
                    ...companion,
                    name: updatedNPC.name,
                    appearance: updatedNPC.appearance,
                    personality: updatedNPC.description,
                    relationship: updatedNPC.relationship,
                    loves: updatedNPC.loves,
                    likes: updatedNPC.likes,
                    dislikes: updatedNPC.dislikes,
                    hates: updatedNPC.hates,
                    race: updatedNPC.race,
                    gender: updatedNPC.gender,
                    rank: updatedNPC.rank,
                    size: updatedNPC.size,
                    template: updatedNPC.template,
                    cr: updatedNPC.cr,
                    affinity: updatedNPC.affinity,
                    archetype: updatedNPC.archetype
                });
                updateCompanion(updatedCompanion);
            }
        }
    };

    const handleCreateNew = () => {
        const currentCoords = gameData.playerCoordinates;
        const currentZone = gameData.mapZones?.find(z => z.coordinates === currentCoords);
        const zoneName = currentZone ? currentZone.name : 'Unknown';
        const localeName = gameData.currentLocale || '';

        const newNPC: NPC = {
            id: `npc-${Date.now()}`,
            name: 'New Character',
            relationship: 0,
            status: 'Alive',
            location: zoneName,
            currentPOI: localeName,
            description: '',
            loves: '',
            likes: '',
            dislikes: '',
            hates: '',
            is_essential: true // Manually created NPCs are always essential by default
        };
        addNPC(newNPC);
        setSelectedNPC(newNPC);
        setIsModalOpen(true);
    };

    return (
        <div className="p-2 pt-8 max-w-2xl mx-auto pb-24">
            <div className="text-center mb-10 pb-6 border-b border-brand-primary/20 relative">
                <h1 className="text-brand-text mb-2">Social Ledger</h1>
                <p className="text-body-base text-brand-text-muted font-medium italic">
                    Allies, informants, and rivals encountered across the realms.
                </p>
            </div>

            {/* Search Box */}
            <div className="relative mb-10 group px-1">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-brand-text-muted group-focus-within:text-brand-accent transition-colors duration-300">
                    <Icon name="search" className="w-4 h-4" />
                </div>
                <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search the registry..."
                    className="w-full bg-brand-surface h-14 pl-12 pr-12 rounded-2xl border-2 border-brand-primary/50 focus:border-brand-accent focus:bg-brand-bg outline-none text-body-base text-brand-text transition-all shadow-inner"
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-5 flex items-center text-brand-text-muted hover:text-brand-text transition-colors"
                    >
                        <Icon name="close" className="w-5 h-5" />
                    </button>
                )}
            </div>
            
            {sortedNPCs.length > 0 ? (
                <div className="space-y-4 px-1 pb-8">
                    {sortedNPCs.map(npc => (
                        <NPCCard 
                            key={npc.id} 
                            npc={npc} 
                            onClick={handleCardClick}
                            onDelete={npc.companionId ? undefined : deleteNPC}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-brand-primary/40 rounded-3xl bg-brand-surface/20 animate-page mx-1">
                    <Icon name="users" className="w-16 h-16 text-brand-text-muted opacity-20 mb-4" />
                    <p className="text-body-base text-brand-text-muted italic px-8 text-center leading-relaxed">
                        {searchQuery 
                            ? `The chronicles contain no record of "${searchQuery}" in this context.` 
                            : 'No acquaintances have been recorded in this world yet.'}
                    </p>
                    {!searchQuery && (
                        <button 
                            onClick={handleCreateNew} 
                            className="btn-tertiary btn-md mt-6 text-brand-accent hover:underline underline-offset-4"
                        >
                            Log Manual Entry
                        </button>
                    )}
                </div>
            )}

            {selectedNPC && (
                <NPCDetailsModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    npc={selectedNPC}
                    onSave={handleSaveNPC}
                    onDelete={deleteNPC}
                />
            )}
        </div>
    );
};

export default NPCsView;

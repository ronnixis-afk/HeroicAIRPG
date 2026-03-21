// components/map/ZoneDetailsPanel.tsx

import React, { useState, useContext, useEffect, useMemo } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import { MapZone, LoreEntry, StoryLog } from '../../types';
import { KeywordEditor } from '../KeywordEditor';
import AutoResizingTextarea from '../../components/AutoResizingTextarea';
import Accordion from '../Accordion';
import { isLocaleMatch, parseHostility } from '../../utils/mapUtils';
import { toTitleCase } from '../../utils/npcUtils';

const getHostilityLabel = (value: number): { label: string, color: string, bg: string, border: string } => {
    if (value <= -16) return { label: 'Sanctuary', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' };
    if (value <= -6) return { label: 'Safe', color: 'text-teal-400', bg: 'bg-teal-400/10', border: 'border-teal-400/20' };
    if (value <= 5) return { label: 'Neutral', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' };
    if (value <= 15) return { label: 'Hostile', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' };
    return { label: 'Deadly', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
};

const getPropertyColor = (prop: string): string => {
    const p = prop.toLowerCase();
    if (p.includes('mana') || p.includes('magic') || p.includes('aether')) return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
    if (p.includes('threat') || p.includes('hazard') || p.includes('danger')) return 'text-red-400 bg-red-400/10 border-red-400/20';
    if (p.includes('terrain') || p.includes('biome') || p.includes('urban')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    if (p.includes('social') || p.includes('politi') || p.includes('authority')) return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    if (p.includes('resource') || p.includes('output') || p.includes('trade')) return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    if (p.includes('ruin') || p.includes('relic') || p.includes('ancient')) return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    if (p.includes('tech') || p.includes('synthetic') || p.includes('ai')) return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
    if (p.includes('stellar') || p.includes('cosmic') || p.includes('astral')) return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
    return 'text-brand-accent bg-brand-accent/10 border-brand-accent/20';
};

const POIShimmer: React.FC = () => (
    <div className="card-base aspect-[2/3] animate-pulse bg-brand-primary/5 border-brand-primary/20 flex flex-col overflow-hidden">
        <div className="h-[45%] bg-brand-primary/10 flex items-center justify-center">
            <Icon name="map" className="w-8 h-8 text-brand-text-muted/10" />
        </div>
        <div className="flex-1 p-3 flex flex-col gap-2">
            <div className="h-3.5 bg-brand-primary/20 rounded w-3/4 mb-1" />
            <div className="space-y-1.5">
                <div className="h-2 bg-brand-primary/10 rounded w-full" />
                <div className="h-2 bg-brand-primary/10 rounded w-full" />
                <div className="h-2 bg-brand-primary/10 rounded w-2/3" />
            </div>
            <div className="h-8 bg-brand-primary/30 rounded-lg w-full mt-auto" />
        </div>
    </div>
);

const POIListItem: React.FC<{
    entry: LoreEntry;
    zoneName: string;
    onDelete: (id: string) => void;
    onInvestigate: (entry: LoreEntry) => void;
    onEdit?: (entry: LoreEntry) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    isPlayerHere?: boolean;
    populationLevel?: string;
}> = ({ entry, zoneName, onDelete, onInvestigate, onEdit, isExpanded, onToggleExpand, isPlayerHere, populationLevel }) => {
    const tags = entry.tags || [];
    const isPopCenter = tags.includes('population-center');
    let popIcon = null;

    if (isPopCenter) {
        const possibleLevels = ['village', 'settlement', 'town', 'city', 'capital'];
        const levelFromTags = tags.find(t => possibleLevels.includes(t.toLowerCase()));
        const lv = (levelFromTags || populationLevel || 'settlement').toLowerCase();
        
        // Map village to settlement if no native village icon
        const iconName = lv === 'village' ? 'settlement' : 
                         possibleLevels.includes(lv) ? lv : 'settlement';
        
        popIcon = <img src={`/icons/${iconName}.png`} alt={lv} className="w-7 h-7 object-contain" />;
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete the entry titled "${entry.title}"? This cannot be undone.`)) {
            onDelete(entry.id);
        }
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit?.(entry);
    };

    const handleInvestigate = (e: React.MouseEvent) => {
        e.stopPropagation();
        onInvestigate(entry);
    };

    return (
        <div 
            onClick={onToggleExpand}
            className={`card-base flex flex-col overflow-hidden relative group border-brand-primary/40 hover:border-brand-accent/30 transition-all duration-500 cursor-pointer ${isExpanded ? 'col-span-2' : 'aspect-[2/3]'}`}
        >
            {/* Image/Icon Placeholder */}
            <div className={`${isExpanded ? 'h-40' : 'h-[45%]'} bg-brand-primary/10 flex items-center justify-center relative overflow-hidden p-4 transition-all duration-500`}>
                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 to-transparent opacity-50" />
                {popIcon ? (
                    <div className="relative z-10 drop-shadow-2xl transform transition-transform duration-500 group-hover:scale-110">
                        {popIcon}
                    </div>
                ) : (
                    <Icon name="map" className="w-12 h-12 text-brand-text-muted/20 relative z-10" />
                )}
                <button
                    onClick={handleDelete}
                    className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all bg-black/40 rounded-lg hover:text-brand-danger z-20"
                >
                    <Icon name="trash" className="w-3 h-3" />
                </button>
                {isExpanded && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-brand-accent/20 border border-brand-accent/30 rounded text-[8px] font-bold text-brand-accent uppercase tracking-widest z-20">
                        Details
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 p-4 flex flex-col">
                <div className="flex-1">
                    <h5 className={`text-[14px] leading-tight mb-2 font-bold transition-colors ${isPlayerHere ? 'text-brand-accent' : entry.visited ? 'text-[#FAF9F6] opacity-90' : 'text-brand-text'}`}>
                        {toTitleCase(entry.title)}
                    </h5>
                    <p className={`text-[11px] leading-[1.4] text-brand-text-muted italic opacity-80 ${isExpanded ? '' : 'line-clamp-4'}`}>
                        {entry.content}
                    </p>
                    
                    {isExpanded && entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-4">
                            {entry.tags.filter(t => t !== 'location' && t !== 'population-center').map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-brand-primary/40 border border-brand-surface rounded text-[9px] text-brand-text-muted">
                                    {toTitleCase(tag.replace(/-/g, ' '))}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 mt-4 flex-shrink-0">
                    {isExpanded && (
                        <button
                            onClick={handleEdit}
                            className="btn-secondary h-8 flex-1 text-[10px] rounded-lg gap-2"
                        >
                            <Icon name="edit" className="w-3 h-3" />
                            {toTitleCase('Edit')}
                        </button>
                    )}
                    <button
                        onClick={handleInvestigate}
                        className="btn-primary h-8 flex-1 text-[10px] rounded-lg"
                    >
                        {toTitleCase('Enter')}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ZoneDetailsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    coordinates: string;
}

const ZoneDetailsPanel: React.FC<ZoneDetailsPanelProps> = ({ isOpen, onClose, coordinates }) => {
    const {
        gameData,
        updateMapZone,
        deleteKnowledge,
        initiateTravel,
        investigateDiscovery,
        lazyLoadPois,
        syncCurrentLocaleToPoi
    } = useContext(GameDataContext);

    const { setActiveView } = useUI();

    const [name, setName] = useState('');
    const [hostility, setHostility] = useState<number>(0);
    const [description, setDescription] = useState('');
    const [keywords, setKeywords] = useState<string[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [travelMethod, setTravelMethod] = useState('');
    const [isBackfilling, setIsBackfilling] = useState(false);
    const [isDiscoveringLocale, setIsDiscoveringLocale] = useState(false);
    const [expandedPoiId, setExpandedPoiId] = useState<string | null>(null);

    if (!gameData) return null;

    const { mapZones = [], mapSectors = [], knowledge = [], mapSettings, playerCoordinates, playerInventory, companions, combatState, story = [], currentLocale } = gameData;
    const isCombatActive = combatState?.isActive || false;

    const zone = useMemo(() => mapZones.find(z => z.coordinates === coordinates) || null, [mapZones, coordinates]);
    const currentSector = useMemo(() => mapSectors.find(s => s.coordinates.includes(coordinates)), [mapSectors, coordinates]);
    const entries = useMemo(() => knowledge.filter(k => k.coordinates === coordinates && k.tags?.includes('location')), [knowledge, coordinates]);

    const isPlayerHere = coordinates === playerCoordinates;
    const isVisited = zone?.visited ?? false;

    useEffect(() => {
        if (isOpen && isPlayerHere && currentLocale && zone) {
            const localeExists = entries.some(e => isLocaleMatch(e.title, currentLocale));
            const isDefaultLocale = currentLocale === "Open Area" || currentLocale === "The Wilds";
            const isShipLocale = companions.some(c => c.isShip && isLocaleMatch(c.name, currentLocale));

            if (!localeExists && !isDefaultLocale && !isShipLocale && !isDiscoveringLocale) {
                setIsDiscoveringLocale(true);
                syncCurrentLocaleToPoi(zone, currentLocale).finally(() => setIsDiscoveringLocale(false));
            }
        }
    }, [isOpen, isPlayerHere, currentLocale, entries, zone, syncCurrentLocaleToPoi, isDiscoveringLocale, companions]);

    useEffect(() => {
        if (isOpen && zone?.visited && entries.length === 0 && !isBackfilling) {
            setIsBackfilling(true);
            lazyLoadPois(zone).finally(() => setIsBackfilling(false));
        }
    }, [isOpen, zone?.visited, entries.length, coordinates, lazyLoadPois, zone, isBackfilling]);

    useEffect(() => {
        if (isOpen) {
            setName(zone?.name || '');
            setHostility(zone?.hostility || 0);
            setDescription(zone?.description || '');
            setKeywords(zone?.keywords || []);
            setIsEditing(false);
            setTravelMethod('');
        }
    }, [coordinates, zone, isOpen]);

    const travelMethods = useMemo(() => {
        const baseMethods = ['Walk', 'Public Transport'];
        const allItems = [...playerInventory.assets, ...playerInventory.carried, ...playerInventory.equipped];
        const vehicleNames = allItems.filter(item => item.tags?.some(t => t.toLowerCase() === 'vehicle')).map(item => item.name);
        const shipNames = companions.filter(c => c.isShip).map(c => c.name);
        let methods = Array.from(new Set([...baseMethods, ...vehicleNames, ...shipNames]));

        if (mapSettings?.style === 'sci-fi') {
            methods = methods.filter(m => m.toLowerCase() !== 'walk');
        }
        return methods;
    }, [playerInventory, companions, mapSettings]);

    const handleSave = () => {
        const updatedZone: MapZone = {
            id: zone?.id || `zone-${coordinates}-${Date.now()}`,
            name,
            hostility,
            description,
            keywords,
            coordinates,
            visited: true,
            sectorId: currentSector?.id
        };
        updateMapZone(updatedZone);
        setIsEditing(false);
    };

    const handleInvestigate = (entry: LoreEntry) => {
        investigateDiscovery(entry, name || zone?.name || 'Unknown');
        onClose();
    };

    const handleTravel = () => {
        if (travelMethod) {
            initiateTravel(name || 'Uncharted Territory', travelMethod, coordinates);
            onClose();
        }
    };

    const hInfo = getHostilityLabel(hostility);

    if (!isOpen) return null;

    return (
        <>
            <div
                className={`fixed inset-0 bg-black/60 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} backdrop-blur-sm`}
                onClick={onClose}
            />
            <div className={`fixed bottom-0 right-0 top-0 w-full sm:w-[450px] bg-brand-bg z-[70] transform transition-transform duration-500 ease-out border-l border-brand-primary shadow-2xl flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex justify-end p-4 flex-shrink-0">
                    <button onClick={onClose} className="btn-icon p-2 hover:bg-brand-primary/20 rounded-full transition-colors">
                        <Icon name="close" className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scroll p-6 pt-0 pb-24">
                    <div className="space-y-8 animate-page">
                        {isEditing ? (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Zone Name</label>
                                    <input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-brand-primary h-12 px-4 rounded-xl border border-brand-surface focus:border-brand-accent focus:outline-none"
                                        placeholder="e.g. Whispering Woods"
                                    />
                                </div>
                                <div>
                                    <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Threat Level ({hostility})</label>
                                    <input
                                        type="range" min="-25" max="25"
                                        value={hostility}
                                        onChange={e => setHostility(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-brand-secondary rounded-full appearance-none cursor-pointer accent-brand-accent"
                                    />
                                    <div className="flex justify-between mt-1 px-1">
                                        <span className="text-[10px] text-brand-text-muted">Safe</span>
                                        <span className="text-[10px] text-brand-text-muted">Neutral</span>
                                        <span className="text-[10px] text-brand-text-muted">Hostile</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Description</label>
                                    <AutoResizingTextarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        className="w-full bg-brand-primary p-4 rounded-xl border border-brand-surface focus:border-brand-accent focus:outline-none min-h-[100px]"
                                    />
                                </div>
                                <KeywordEditor keywords={keywords} onKeywordsChange={setKeywords} />
                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => setIsEditing(false)} className="btn-secondary btn-md flex-1">Cancel</button>
                                    <button onClick={handleSave} className="btn-primary btn-md flex-1">Save Changes</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="mb-0 truncate">{toTitleCase(name || 'Uncharted Territory')}</h3>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] font-mono font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded border border-brand-accent/20 tracking-normal">
                                                {coordinates}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded border tracking-normal ${hInfo.bg} ${hInfo.color} ${hInfo.border}`}>
                                                {toTitleCase(hInfo.label)}
                                            </span>
                                            {keywords.map((kw, i) => (
                                                <span key={i} className={`text-[10px] font-bold px-2.5 py-1 rounded border tracking-normal ${getPropertyColor(kw)} whitespace-nowrap`}>
                                                    {toTitleCase(kw.split(':')[0].trim())}
                                                </span>
                                            ))}
                                            {currentSector && (
                                                <span className="text-body-sm font-bold text-brand-text-muted ml-1">
                                                    Sector: <span style={{ color: currentSector.color }}>{currentSector.name}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface shadow-inner">
                                    <p className="text-body-base text-brand-text leading-relaxed italic opacity-90 whitespace-pre-wrap">{description || "An unexplored region."}</p>
                                </div>

                                <div className="space-y-4">
                                    <h5 className="mb-0">Points Of Interest</h5>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(isBackfilling || isDiscoveringLocale) && entries.length === 0 ? (
                                            <>
                                                <POIShimmer />
                                                <POIShimmer />
                                            </>
                                        ) : entries.length > 0 ? (
                                            entries.map(entry => (
                                                <POIListItem
                                                    key={entry.id}
                                                    entry={entry}
                                                    zoneName={name}
                                                    onDelete={deleteKnowledge}
                                                    onInvestigate={handleInvestigate}
                                                    onEdit={(e) => {
                                                        // Handle edit - maybe use existing KeywordEditor logic or similar
                                                        // For now, let's just log or implement a simple edit flow if possible
                                                        console.log('Edit POI:', e);
                                                    }}
                                                    isExpanded={expandedPoiId === entry.id}
                                                    onToggleExpand={() => setExpandedPoiId(expandedPoiId === entry.id ? null : entry.id)}
                                                    isPlayerHere={isPlayerHere && currentLocale === entry.title}
                                                    populationLevel={zone?.populationLevel}
                                                />
                                            ))
                                        ) : (
                                            <div className="col-span-2 text-center text-body-sm text-brand-text-muted italic py-6">
                                                No specific sites identified here yet.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {!isPlayerHere && (
                                    <div className="pt-8 border-t border-brand-primary/10 space-y-6">
                                        <div className="space-y-3">
                                            <label className="text-body-sm font-bold text-brand-text-muted ml-1">Travel Method</label>
                                            <div className="relative">
                                                <select
                                                    value={travelMethod}
                                                    onChange={e => setTravelMethod(e.target.value)}
                                                    className="w-full bg-brand-primary h-12 px-4 rounded-xl border border-brand-surface focus:border-brand-accent appearance-none text-sm font-bold"
                                                >
                                                    <option value="">Select transport...</option>
                                                    {travelMethods.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                                                    <Icon name="chevronDown" className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleTravel}
                                            disabled={!travelMethod || isCombatActive}
                                            className="btn-primary btn-lg w-full gap-3 shadow-brand-accent/20 rounded-2xl"
                                        >
                                            <Icon name="play" className="w-5 h-5" />
                                            Travel To Zone
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="btn-secondary btn-md w-full mt-6 gap-2"
                                >
                                    <Icon name="edit" className="w-4 h-4 text-brand-text-muted" />
                                    Edit Zone Details
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 pt-2 bg-brand-bg border-t border-brand-primary/10 flex-shrink-0">
                    <button
                        onClick={() => { setActiveView('knowledge'); onClose(); }}
                        className="btn-primary btn-md w-full rounded-xl gap-2 shadow-lg shadow-brand-accent/20"
                    >
                        <Icon name="map" className="w-4 h-4" />
                        Open Map
                    </button>
                </div>
            </div>
        </>
    );
};

export default ZoneDetailsPanel;

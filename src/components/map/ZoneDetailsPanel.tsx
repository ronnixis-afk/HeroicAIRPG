// components/map/ZoneDetailsPanel.tsx

import React, { useState, useContext, useEffect, useMemo } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import { MapZone, LoreEntry, StoryLog } from '../../types';
import { KeywordEditor } from '../KeywordEditor';
import AutoResizingTextarea from '../../components/AutoResizingTextarea';
import Accordion from '../Accordion';
import { isLocaleMatch } from '../../utils/mapUtils';

const getHostilityLabel = (value: number): { label: string, color: string } => {
    if (value <= -16) return { label: 'Sanctuary', color: 'text-emerald-400' };
    if (value <= -6) return { label: 'Safe', color: 'text-teal-400' };
    if (value <= 5) return { label: 'Neutral', color: 'text-yellow-400' };
    if (value <= 15) return { label: 'Hostile', color: 'text-orange-400' };
    return { label: 'Deadly', color: 'text-red-500' };
};

const POIShimmer: React.FC<{ label?: string }> = ({ label }) => (
    <div className="space-y-0 animate-pulse">
        <div className="border-b border-brand-surface py-6 px-4 bg-brand-accent/5">
            <div className="flex items-center gap-2 mb-3">
                <Icon name="sparkles" className="w-4 h-4 text-brand-accent animate-spin" />
                <div className="h-4 bg-brand-accent/20 rounded w-1/3"></div>
            </div>
            <div className="h-2.5 bg-brand-primary/40 rounded w-full mb-1"></div>
            <div className="h-2.5 bg-brand-primary/40 rounded w-3/4"></div>
            {label && <p className="text-[10px] text-brand-accent font-bold mt-4 tracking-normal">{label}</p>}
        </div>
    </div>
);

const POIListItem: React.FC<{
    entry: LoreEntry;
    zoneName: string;
    allLogs: StoryLog[];
    onDelete: (id: string) => void;
    onInvestigate: (entry: LoreEntry) => void;
    isPlayerHere?: boolean;
}> = ({ entry, zoneName, allLogs, onDelete, onInvestigate, isPlayerHere }) => {
    const [isOpen, setIsOpen] = useState(false);

    const relatedLogs = useMemo(() => {
        const poiTerms = entry.title.toLowerCase().split(' ').filter(t => t.length > 3);
        return allLogs
            .filter(log => log.location === zoneName)
            .filter(log => {
                const content = (log.summary || log.content).toLowerCase();
                return poiTerms.some(term => content.includes(term)) || content.includes(entry.title.toLowerCase());
            })
            .slice(-2);
    }, [allLogs, zoneName, entry.title]);

    const truncate = (text: string) => {
        const words = text.split(' ');
        if (words.length <= 10) return text;
        return words.slice(0, 10).join(' ') + '...';
    };

    const getTimeOnly = (timestamp: string) => {
        const date = new Date(timestamp);
        return !isNaN(date.getTime()) 
            ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
            : timestamp.split(',')[0].trim();
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete the entry titled "${entry.title}"? This cannot be undone.`)) {
            onDelete(entry.id);
        }
    };

    const title = (
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full shrink-0 ${isPlayerHere ? 'bg-brand-accent shadow-[0_0_8px_rgba(62,207,142,0.6)] animate-pulse' : entry.visited ? 'bg-brand-text-muted opacity-30' : 'bg-brand-accent shadow-[0_0_8px_rgba(62,207,142,0.4)]'}`} />
            <span className={`text-body-base font-bold truncate transition-colors ${isPlayerHere ? 'text-brand-accent' : entry.visited ? 'text-brand-text-muted' : 'text-brand-text'}`}>
                {entry.title}
            </span>
        </div>
    );

    return (
        <Accordion 
            title={title} 
            isOpen={isOpen} 
            onToggle={() => setIsOpen(!isOpen)}
        >
            <div className="pt-2 pb-4">
                <div className="mb-6 pl-4 border-l-2 border-brand-primary/50">
                    <p className="text-body-sm text-brand-text leading-relaxed opacity-90 italic">{entry.content}</p>
                </div>

                {relatedLogs.length > 0 && (
                    <div className="mb-6 pl-4">
                        <label className="text-[10px] font-bold text-brand-accent block mb-3 opacity-60 tracking-normal">Chronicle Echoes</label>
                        <div className="space-y-4">
                            {relatedLogs.map(log => (
                                <div key={log.id} className="relative group/log">
                                    <div className="text-[9px] text-brand-text-muted font-mono mb-1 opacity-70 tracking-normal">{getTimeOnly(log.timestamp)}</div>
                                    <div className="text-body-sm text-brand-text leading-snug">{truncate(log.summary || log.content)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-brand-primary/10">
                    <button 
                        onClick={handleDelete}
                        className="text-brand-danger hover:opacity-80 text-xs font-bold flex items-center gap-1.5 px-2 py-1 transition-all"
                    >
                        <Icon name="trash" className="w-4 h-4" />
                        Delete
                    </button>
                    <button 
                        onClick={() => onInvestigate(entry)} 
                        className={`btn-sm rounded-lg flex items-center gap-2 ${
                            entry.visited 
                                ? 'btn-secondary' 
                                : 'btn-primary'
                        }`}
                    >
                        <Icon name={entry.visited ? "refresh" : "play"} className="w-3.5 h-3.5" />
                        {entry.visited ? "Enter Locale" : "Investigate Site"}
                    </button>
                </div>
            </div>
        </Accordion>
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
            const localeExists = entries.some(e => e.title.toLowerCase().trim() === currentLocale.toLowerCase().trim());
            const isDefaultLocale = currentLocale === "Open Area" || currentLocale === "The Wilds";
            const isShipLocale = companions.some(c => c.isShip && c.name.toLowerCase().trim() === currentLocale.toLowerCase().trim());
            
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
                                        <h3 className="mb-2 truncate">{name || 'Uncharted Territory'}</h3>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-[10px] font-mono font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded border border-brand-accent/20 tracking-normal">
                                                {coordinates}
                                            </span>
                                            {currentSector && (
                                                <span className="text-body-sm font-bold text-brand-text-muted">
                                                    Sector: <span style={{ color: currentSector.color }}>{currentSector.name}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-body-sm font-bold ${hInfo.color} mr-1`}>{hInfo.label}</span>
                                        <button onClick={() => setIsEditing(true)} className="btn-icon text-brand-text-muted hover:text-brand-accent">
                                            <Icon name="edit" className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface shadow-inner">
                                    <p className="text-body-base text-brand-text leading-relaxed italic opacity-90 whitespace-pre-wrap">{description || "An unexplored region."}</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-brand-text mb-4 border-b border-brand-primary/10 pb-2 font-bold">Points Of Interest</h4>
                                    <div className="space-y-1">
                                        {(isBackfilling || isDiscoveringLocale) && entries.length === 0 ? (
                                            <POIShimmer label={isDiscoveringLocale ? "Synthesizing site data..." : "Identifying landmarks..."} />
                                        ) : entries.length > 0 ? (
                                            entries.map(entry => (
                                                <POIListItem 
                                                    key={entry.id} 
                                                    entry={entry} 
                                                    zoneName={name} 
                                                    allLogs={story}
                                                    onDelete={deleteKnowledge}
                                                    onInvestigate={handleInvestigate}
                                                    isPlayerHere={isPlayerHere && currentLocale === entry.title}
                                                />
                                            ))
                                        ) : (
                                            <p className="text-center text-body-sm text-brand-text-muted italic py-6">No specific sites identified here yet.</p>
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

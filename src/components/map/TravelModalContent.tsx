import React, { useMemo, useState, useEffect, useContext } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import type { GameData } from '../../types';
import { Icon } from '../Icon';
import { parseCoords } from '../../utils/mapUtils';

const TravelModalContent: React.FC<TravelModalContentProps> = ({ gameData, onSubmit, currentLocation }) => {
    const { initiateTravel } = useContext(GameDataContext); 
    const { knowledge, playerInventory, mapZones, companions, combatState, playerCoordinates, mapSettings } = gameData;
    
    const [selectedLocation, setSelectedLocation] = useState('');
    const [travelMethod, setTravelMethod] = useState('');
    const isCombatActive = combatState?.isActive || false;

    const knownLocations = useMemo(() => {
        const loreDestinations = knowledge
            .filter(entry => entry.tags?.includes('location') && !entry.tags?.includes('npc'))
            .map(entry => entry.title);

        const mapDestinations = (mapZones || [])
            .filter(z => z.visited)
            .map(z => z.name);

        const allDestinations = new Set([...loreDestinations, ...mapDestinations]);
        
        return Array.from(allDestinations)
            .filter(loc => loc !== currentLocation)
            .sort();
    }, [knowledge, mapZones, currentLocation]);
    
    const travelMethods = useMemo(() => {
        const baseMethods = ['Walk', 'Public Transport'];
        const allItems = [
            ...playerInventory.assets, 
            ...playerInventory.carried, 
            ...playerInventory.equipped
        ];
        
        const vehicleNames = allItems
            .filter(item => item.tags?.some(t => t.toLowerCase() === 'vehicle'))
            .map(item => item.name);

        const shipNames = companions
            .filter(c => c.isShip)
            .map(c => c.name);
            
        let methods = Array.from(new Set([...baseMethods, ...vehicleNames, ...shipNames]));

        if (mapSettings?.style === 'sci-fi') {
            methods = methods.filter(m => m.toLowerCase() !== 'walk');
        }

        return methods;
    }, [playerInventory, companions, mapSettings?.style]);

    const reachability = useMemo(() => {
        if (!selectedLocation) return { canReach: false, reason: '' };
        const zone = mapZones?.find(z => z.name === selectedLocation);
        const knowledgeEntry = knowledge?.find(k => k.title === selectedLocation);
        const isVisited = zone?.visited || false;
        const coordinates = zone?.coordinates || knowledgeEntry?.coordinates;

        if (isVisited) return { canReach: true, reason: 'Visited' };

        if (coordinates && playerCoordinates) {
            const p1 = parseCoords(playerCoordinates);
            const p2 = parseCoords(coordinates);
            if (p1 && p2) {
                const dist = Math.max(Math.abs(p1.x - p2.x), Math.abs(p1.y - p2.y));
                if (dist <= 1) return { canReach: true, reason: 'Adjacent' };
                return { canReach: false, reason: 'Destination is too distant. Move to an adjacent zone first.' };
            }
        }
        if (!coordinates) return { canReach: false, reason: 'Location coordinates unknown.' };
        return { canReach: false, reason: 'Unreachable.' };
    }, [selectedLocation, mapZones, knowledge, playerCoordinates]);

    useEffect(() => {
        if (knownLocations.length > 0) {
            if (!selectedLocation || !knownLocations.includes(selectedLocation)) {
                setSelectedLocation(knownLocations[0]);
            }
        } else {
            setSelectedLocation('');
        }
    }, [knownLocations, selectedLocation]);

    useEffect(() => {
        if (travelMethods.length > 0) {
            if (!travelMethod || !travelMethods.includes(travelMethod)) {
                setTravelMethod(travelMethods[0]);
            }
        } else {
            setTravelMethod('');
        }
    }, [travelMethods, travelMethod]);

    const handleTravel = () => {
        if (isCombatActive) return;
        if (selectedLocation && travelMethod && reachability.canReach) {
            const zone = mapZones?.find(z => z.name === selectedLocation);
            const knowledgeEntry = knowledge?.find(k => k.title === selectedLocation);
            const coords = zone?.coordinates || knowledgeEntry?.coordinates;
            initiateTravel(selectedLocation, travelMethod, coords);
            onSubmit(''); 
        }
    };

    const travelPossible = selectedLocation && selectedLocation !== currentLocation && knownLocations.length > 0 && travelMethod && !isCombatActive && reachability.canReach;

    return (
        <div className="space-y-6 animate-page py-2">
            <div className="flex items-center gap-4 bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface shadow-inner">
                <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20">
                    <Icon name="location" className="w-6 h-6 text-brand-accent flex-shrink-0" />
                </div>
                <div>
                    <h5 className="text-[10px] font-black text-brand-text-muted mb-1 tracking-normal normal-case">Current Location</h5>
                    <p className="text-body-lg font-black text-brand-text tracking-tight">{currentLocation}</p>
                </div>
            </div>
            
            {isCombatActive && (
                <div className="bg-brand-danger/10 border border-brand-danger/20 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                    <Icon name="danger" className="w-5 h-5 text-brand-danger" />
                    <div className="flex-1">
                        <p className="text-body-sm font-black text-brand-danger">Combat Active</p>
                        <p className="text-[10px] text-brand-text-muted font-bold">You cannot travel while engaged in battle.</p>
                    </div>
                </div>
            )}

            {knownLocations.length > 0 ? (
                <div className="space-y-6">
                    <div className="space-y-2">
                         <label className="text-body-sm font-bold text-brand-text-muted ml-1">Destination</label>
                         <div className="relative">
                            <select
                                value={selectedLocation}
                                onChange={(e) => setSelectedLocation(e.target.value)}
                                disabled={isCombatActive}
                                className="w-full bg-brand-primary h-12 px-4 pr-10 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-brand-text appearance-none text-sm font-bold disabled:opacity-50 transition-all shadow-inner"
                            >
                                {knownLocations.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                            <Icon name="chevronDown" className="w-4 h-4"/>
                            </div>
                        </div>
                    </div>

                    {!isCombatActive && !reachability.canReach && selectedLocation && (
                        <div className="text-[10px] text-brand-danger bg-brand-danger/5 p-3 rounded-lg border border-brand-danger/10 flex items-center justify-center gap-2 font-bold italic">
                            <Icon name="danger" className="w-3.5 h-3.5" />
                            {reachability.reason}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-body-sm font-bold text-brand-text-muted ml-1">Travel Method</label>
                        <div className="relative">
                            <select
                                value={travelMethod}
                                onChange={(e) => setTravelMethod(e.target.value)}
                                disabled={isCombatActive}
                                className="w-full bg-brand-primary h-12 px-4 pr-10 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-brand-text appearance-none text-sm font-bold disabled:opacity-50 transition-all shadow-inner"
                            >
                                {travelMethods.map(method => (
                                <option key={method} value={method}>{method}</option>
                            ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                            <Icon name="chevronDown" className="w-4 h-4"/>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-brand-primary/20 text-center">
                        <p className="text-body-sm text-brand-text-muted mb-6 px-4 italic leading-relaxed">
                            Preparing to journey from <span className="text-brand-text font-bold">{currentLocation}</span> to <span className="text-brand-accent font-bold">{selectedLocation}</span>.
                        </p>
                        <button
                            onClick={handleTravel}
                            disabled={!travelPossible}
                            className="btn-primary btn-lg w-full rounded-2xl shadow-xl shadow-brand-accent/10"
                        >
                            <Icon name="play" className="w-4 h-4 mr-2" />
                            Initiate Travel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 px-6 border-2 border-dashed border-brand-primary/30 rounded-3xl bg-brand-surface/20">
                    <p className="text-body-base text-brand-text-muted italic">No known destinations recorded in the ledger yet.</p>
                </div>
            )}
        </div>
    );
};

interface TravelModalContentProps {
    gameData: GameData;
    onSubmit: (prompt: string) => void;
    currentLocation: string;
}

export default TravelModalContent;
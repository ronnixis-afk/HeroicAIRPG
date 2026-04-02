import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import type { MapZone } from '../../types';
import { Icon } from '../Icon';
import Modal from '../Modal';
import CharacterCreationLoader from '../CharacterCreationLoader';
import { KeywordEditor } from '../KeywordEditor';
import ZoneDetailsPanel from './ZoneDetailsPanel';
import { ActorAvatar } from '../ActorAvatar';
import { parseCoords } from '../../utils/mapUtils';

const CELL_SIZE = 60; // px
const VIEWPORT_PADDING = 3; // Cells to show beyond known bounds

const formatCoordinates = (x: number, y: number): string => {
    return `${x}-${y}`;
};

const getHostilityDotClass = (hostility: number): string => {
    if (hostility <= -10) return 'bg-emerald-400 shadow-[0_0_4px_#34d399]';
    if (hostility <= 0) return 'bg-teal-400 shadow-[0_0_4px_#2dd4bf]';
    if (hostility <= 10) return 'bg-yellow-400 shadow-[0_0_4px_#facc15]';
    return 'bg-red-500 shadow-[0_0_4px_#ef4444]';
};



const MapView: React.FC = () => {
    const { gameData } = useContext(GameDataContext);
    const containerRef = useRef<HTMLDivElement>(null);

    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const pinchRef = useRef({ startDist: 0, startScale: 1 });

    const [selectedCoords, setSelectedCoords] = useState<string | null>(null);

    if (!gameData) return <div className="text-center p-12 text-brand-text-muted animate-pulse">Loading map...</div>;

    const { mapZones = [], playerCoordinates = '0-0', combatState } = gameData;
    const mapSettings = gameData.mapSettings || { style: 'fantasy', gridUnit: 'Miles', gridDistance: 24, zoneLabel: 'Region' };
    const isCombatActive = combatState?.isActive || false;

    useEffect(() => {
        centerOnPlayer();
    }, []);

    const centerOnPlayer = () => {
        if (!containerRef.current) return;
        const coords = parseCoords(playerCoordinates);
        if (coords) {
            const gridX = coords.x * CELL_SIZE + (CELL_SIZE / 2);
            const gridY = coords.y * CELL_SIZE + (CELL_SIZE / 2);
            const viewportW = containerRef.current.clientWidth;
            const viewportH = containerRef.current.clientHeight;
            setPosition({
                x: (viewportW / 2) - (gridX * scale),
                y: (viewportH / 2) - (gridY * scale)
            });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleWheel = (e: React.WheelEvent) => {
        const sensitivity = 0.001;
        const delta = -e.deltaY * sensitivity;
        setScale(s => Math.min(Math.max(s + delta, 0.4), 3));
    };

    const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
        return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            setIsDragging(false);
            const dist = getTouchDistance(e.touches[0], e.touches[1]);
            pinchRef.current = { startDist: dist, startScale: scale };
        } else if (e.touches.length === 1) {
            setIsDragging(true);
            setDragStart({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y
            });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = getTouchDistance(e.touches[0], e.touches[1]);
            if (pinchRef.current.startDist > 0) {
                const scaleChange = dist / pinchRef.current.startDist;
                const newScale = pinchRef.current.startScale * scaleChange;
                setScale(Math.min(Math.max(newScale, 0.4), 3));
            }
        } else if (e.touches.length === 1 && isDragging) {
            setPosition({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y
            });
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        pinchRef.current = { startDist: 0, startScale: 1 };
    };

    const handleGridClick = (x: number, y: number) => {
        if (isCombatActive) return;
        const coords = formatCoordinates(x, y);
        setSelectedCoords(coords);
    };

    const toTitleCase = (str: string) => {
        return str.replace(
            /\w\S*/g,
            (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
        );
    };

    const renderGrid = () => {
        // Calculate dynamic bounds based on discovered territory and player position
        const allKnownCoords = [
            ...mapZones.map(z => z.coordinates),
            playerCoordinates
        ].map(parseCoords).filter((c): c is { x: number, y: number } => c !== null);

        if (allKnownCoords.length === 0) return [];

        const minX = Math.min(...allKnownCoords.map(c => c.x)) - VIEWPORT_PADDING;
        const maxX = Math.max(...allKnownCoords.map(c => c.x)) + VIEWPORT_PADDING;
        const minY = Math.min(...allKnownCoords.map(c => c.y)) - VIEWPORT_PADDING;
        const maxY = Math.max(...allKnownCoords.map(c => c.y)) + VIEWPORT_PADDING;

        const cells = [];
        const zoneMap = new Map<string, MapZone>();
        mapZones.forEach(z => zoneMap.set(z.coordinates, z));
        
        const playerPos = parseCoords(playerCoordinates);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const coordStr = formatCoordinates(x, y);
                const zone = zoneMap.get(coordStr);
                const isPlayerHere = playerPos && playerPos.x === x && playerPos.y === y;
                const isSelected = selectedCoords === coordStr;
                const isVisited = zone?.visited ?? false;
                const isNew = zone?.isNew ?? false;

                let cellStyle: React.CSSProperties = {};
                let borderClass = isCombatActive ? 'border-transparent cursor-not-allowed' : 'border-transparent hover:border-brand-primary/30';
                let content = null;

                if (zone) {
                    const zoneName = toTitleCase(zone.name);
                    const fontSize = Math.max(5, Math.min(14, 9 / scale));

                    if (zone.isLoading) {
                        content = (
                            <div className="flex items-center justify-center w-full h-full p-2">
                                <div className="w-full h-2 rounded animate-pulse bg-brand-primary/40"></div>
                            </div>
                        );
                    } else if (isVisited) {
                        content = (
                            <div className="flex flex-col items-center justify-center w-full h-full p-1 text-center relative">
                                <span
                                    className="font-bold text-brand-text leading-tight line-clamp-2 overflow-hidden text-ellipsis break-words w-full relative z-10 pointer-events-none tracking-normal"
                                    style={{ fontSize: `${fontSize}px` }}
                                >
                                    {zoneName}
                                </span>
                            </div>
                        );
                    } else {
                        // Preloaded but unvisited zones
                        const popLevel = zone.populationLevel;
                        const showPopIcon = popLevel && popLevel !== 'Barren';
                        const popIconName = popLevel ? popLevel.toLowerCase() : 'settlement';

                        content = (
                            <div className="flex flex-col items-center justify-center w-full h-full p-1 text-center relative pointer-events-none">
                                <span
                                    className="font-bold text-brand-text-muted opacity-60 leading-tight line-clamp-2 overflow-hidden text-ellipsis break-words w-full relative z-10 tracking-normal"
                                    style={{ fontSize: `${fontSize}px` }}
                                >
                                    {zoneName}
                                </span>
                                {showPopIcon && (
                                    <img 
                                        src={`/icons/${popIconName}.png`} 
                                        alt={popLevel} 
                                        className="absolute bottom-0.5 right-0.5 w-4 h-4 object-contain opacity-50 z-10"
                                    />
                                )}
                            </div>
                        );
                    }
                }

                if (isSelected) {
                    borderClass = 'border-2 border-brand-accent z-20 shadow-[0_0_15px_rgba(62,207,142,0.5)]';
                }

                cells.push(
                    <div
                        key={coordStr}
                        onClick={() => handleGridClick(x, y)}
                        className={`absolute flex flex-col items-center justify-center cursor-pointer transition-all duration-200 border ${borderClass}`}
                        style={{
                            left: x * CELL_SIZE,
                            top: y * CELL_SIZE,
                            width: CELL_SIZE,
                            height: CELL_SIZE,
                            ...cellStyle
                        }}
                    >
                        {isNew && !isVisited && (
                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_#3ecf8e] animate-pulse z-20" />
                        )}

                        {(isVisited || isSelected || isPlayerHere) && (
                            <span className="absolute top-0.5 left-1 text-[6px] font-mono text-brand-text-muted opacity-40 pointer-events-none select-none">{coordStr}</span>
                        )}

                        {zone && isVisited && (
                            <div
                                className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full z-20 ${getHostilityDotClass(zone.hostility || 0)}`}
                                title={`Hostility: ${zone.hostility}`}
                            />
                        )}

                        {content}

                        {isPlayerHere && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none drop-shadow-lg">
                                <div className="transition-all duration-300">
                                    <ActorAvatar 
                                        actor={gameData.playerCharacter} 
                                        size={20} 
                                        showBars={false} 
                                        showName={false}
                                        className="!scale-100"
                                    />
                                </div>
                                {isCombatActive && (
                                    <span 
                                        className="mt-0.5 text-brand-danger font-bold leading-tight text-center whitespace-nowrap"
                                        style={{ fontSize: `${Math.max(5, Math.min(14, 9 / scale))}px`, fontFamily: 'var(--font-inter, Inter, sans-serif)' }}
                                    >
                                        Travel Restricted During Combat
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                );
            }
        }
        return cells;
    };

    return (
        <div className="relative h-full w-full overflow-hidden bg-brand-bg select-none">
            <div className="absolute top-4 right-4 z-30 flex flex-col gap-3">
                <div className="flex flex-col bg-brand-surface/90 backdrop-blur-md border border-brand-primary rounded-lg shadow-lg overflow-hidden">
                    <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} className="p-3 text-brand-text hover:text-brand-accent transition-colors">
                        <Icon name="plus" className="w-5 h-5" />
                    </button>
                    <div className="h-px bg-brand-primary/50 w-full"></div>
                    <button onClick={() => setScale(s => Math.max(s - 0.2, 0.4))} className="p-3 text-brand-text hover:text-brand-accent transition-colors">
                        <Icon name="minus" className="w-5 h-5" />
                    </button>
                </div>

                <button
                    onClick={centerOnPlayer}
                    className="btn-icon bg-brand-surface/90 backdrop-blur-md border border-brand-primary p-3 rounded-lg shadow-lg text-brand-text hover:text-brand-accent"
                    title="Center on Player"
                >
                    <Icon name="location" className="w-6 h-6" />
                </button>
            </div>

            <div className="absolute top-4 left-4 z-30 bg-brand-surface/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-brand-primary shadow-lg pointer-events-none">
                <div className="flex flex-col">
                    <span className="text-xs font-mono text-brand-accent font-bold mb-1.5 tracking-normal">{selectedCoords || playerCoordinates}</span>
                    <div className="flex items-center gap-2 text-[10px] text-brand-text-muted border-t border-brand-primary/30 pt-1.5 mt-0.5">
                        <div className="w-10 h-3 border border-brand-text-muted/30 flex items-center justify-center text-[7px] font-bold">1 Cell</div>
                        <span className="font-bold">≈ {mapSettings.gridDistance} {mapSettings.gridUnit}</span>
                    </div>
                </div>
            </div>

            <div
                ref={containerRef}
                className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                        position: 'absolute'
                    }}
                >
                    {renderGrid()}
                </div>
            </div>

            {selectedCoords && (
                <ZoneDetailsPanel
                    isOpen={!!selectedCoords}
                    onClose={() => setSelectedCoords(null)}
                    coordinates={selectedCoords}
                />
            )}

            <style>{`
                @keyframes bounce-in {
                    0% { transform: scale(0.8); opacity: 0; }
                    60% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); }
                }
                .animate-bounce-in {
                    animation: bounce-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
            `}</style>
        </div>
    );
};

export default MapView;

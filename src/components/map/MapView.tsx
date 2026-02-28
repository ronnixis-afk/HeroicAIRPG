import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import type { MapZone, MapSector } from '../../types';
import { Icon } from '../Icon';
import Modal from '../Modal';
import CharacterCreationLoader from '../CharacterCreationLoader';
import { KeywordEditor } from '../KeywordEditor';
import ZoneDetailsPanel from './ZoneDetailsPanel';
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

const SECTOR_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#71717a'];

const SectorManagerModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    sectors: MapSector[],
    onGenerate: () => void,
    onDelete: (id: string) => void,
    onUpdate: (sector: MapSector) => void,
    onGenerateFromLore: () => void,
    generationProgress: { isActive: boolean, step: string, progress: number }
}> = ({ isOpen, onClose, sectors, onGenerate, onDelete, onUpdate, onGenerateFromLore, generationProgress }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editKeywords, setEditKeywords] = useState<string[]>([]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        await onGenerate();
        setIsGenerating(false);
    };

    const startEdit = (sector: MapSector) => {
        setEditingSectorId(sector.id);
        setEditName(sector.name);
        setEditDesc(sector.description);
        setEditColor(sector.color);
        setEditKeywords(sector.keywords || []);
    };

    const saveEdit = (id: string) => {
        const sector = sectors.find(s => s.id === id);
        if (sector) {
            onUpdate({
                ...sector,
                name: editName,
                description: editDesc,
                color: editColor,
                keywords: editKeywords
            });
        }
        setEditingSectorId(null);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Sector Manager">
            {generationProgress.isActive ? (
                <div className="p-4">
                    <CharacterCreationLoader
                        title="Constructing World Map"
                        step={generationProgress.step}
                        progress={generationProgress.progress}
                    />
                </div>
            ) : (
                <div className="max-h-[60vh] overflow-y-auto space-y-4 px-1 custom-scroll">
                    <div className="flex flex-col gap-3 justify-center mb-6">
                        <button
                            onClick={onGenerateFromLore}
                            className="btn-primary btn-md w-full gap-2 shadow-brand-accent/20"
                        >
                            <Icon name="world" className="w-5 h-5" />
                            Load Map From Lore
                        </button>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="btn-secondary btn-md w-full gap-2"
                        >
                            {isGenerating ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : <Icon name="plus" className="w-4 h-4" />}
                            Add Single Sector
                        </button>
                    </div>

                    <div className="border-t border-brand-primary/20 my-6"></div>

                    {sectors.length === 0 ? (
                        <p className="text-center text-brand-text-muted italic text-body-sm py-4">No sectors defined.</p>
                    ) : (
                        <div className="space-y-4">
                            {sectors.map(sector => (
                                <div key={sector.id} className="bg-brand-primary/10 p-4 rounded-2xl border border-brand-surface transition-colors hover:border-brand-primary/50 relative shadow-inner">
                                    {editingSectorId === sector.id ? (
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-brand-text-muted ml-1">Name</label>
                                                <input
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    className="w-full bg-brand-surface border border-brand-primary h-11 rounded-xl px-4 text-sm font-bold focus:outline-none focus:border-brand-accent"
                                                    placeholder="Sector Name"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-brand-text-muted ml-1">Description</label>
                                                <textarea
                                                    value={editDesc}
                                                    onChange={e => setEditDesc(e.target.value)}
                                                    className="w-full bg-brand-surface border border-brand-primary rounded-xl px-4 py-3 text-xs h-24 resize-none focus:outline-none focus:border-brand-accent leading-relaxed"
                                                    placeholder="Description"
                                                />
                                            </div>
                                            <KeywordEditor
                                                keywords={editKeywords}
                                                onKeywordsChange={setEditKeywords}
                                            />
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-brand-text-muted ml-1">Color</label>
                                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                                    {SECTOR_COLORS.map(c => (
                                                        <button
                                                            key={c}
                                                            onClick={() => setEditColor(c)}
                                                            className={`w-8 h-8 rounded-full border-2 flex-shrink-0 transition-all ${editColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                                            style={{ backgroundColor: c }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-brand-surface/30">
                                                <button onClick={() => setEditingSectorId(null)} className="btn-tertiary btn-sm">Cancel</button>
                                                <button onClick={() => saveEdit(sector.id)} className="btn-primary btn-sm rounded-lg">Save Changes</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: sector.color }}></div>
                                                    <h4 className="mb-0 text-brand-text">{sector.name}</h4>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => startEdit(sector)} className="btn-icon p-1.5 text-brand-text-muted hover:text-brand-accent"><Icon name="edit" className="w-4 h-4" /></button>
                                                    <button onClick={() => onDelete(sector.id)} className="btn-icon p-1.5 text-brand-text-muted hover:text-brand-danger"><Icon name="trash" className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                            <p className="text-body-sm text-brand-text-muted leading-relaxed line-clamp-3 italic">{sector.description}</p>
                                            {sector.keywords && sector.keywords.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-3">
                                                    {sector.keywords.map(k => (
                                                        <span key={k} className="text-[9px] font-bold bg-brand-bg px-2 py-0.5 rounded-md text-brand-text-muted border border-brand-primary/30">#{k}</span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-brand-surface border border-brand-primary/50 rounded-md text-[9px] font-mono font-bold text-brand-text-muted tracking-normal">{sector.coordinates.length} Zones</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};

const MapView: React.FC = () => {
    const { gameData, generateAndAddSector, deleteSector, updateSector, generateMapFromLore } = useContext(GameDataContext);
    const { mapGenerationProgress } = useUI();
    const containerRef = useRef<HTMLDivElement>(null);

    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const pinchRef = useRef({ startDist: 0, startScale: 1 });

    const [selectedCoords, setSelectedCoords] = useState<string | null>(null);
    const [isSectorManagerOpen, setIsSectorManagerOpen] = useState(false);

    if (!gameData) return <div className="text-center p-12 text-brand-text-muted animate-pulse">Loading map...</div>;

    const { mapZones = [], playerCoordinates = '0-0', mapSectors = [], combatState } = gameData;
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

    const renderGrid = () => {
        // Calculate dynamic bounds based on discovered territory and player position
        const allKnownCoords = [
            ...mapZones.map(z => z.coordinates),
            ...mapSectors.flatMap(s => s.coordinates),
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
        const sectorMap = new Map<string, MapSector>();
        mapSectors.forEach(s => {
            s.coordinates.forEach(coord => sectorMap.set(coord, s));
        });
        const playerPos = parseCoords(playerCoordinates);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const coordStr = formatCoordinates(x, y);
                const zone = zoneMap.get(coordStr);
                const sector = sectorMap.get(coordStr);
                const isPlayerHere = playerPos && playerPos.x === x && playerPos.y === y;
                const isSelected = selectedCoords === coordStr;
                const isVisited = zone?.visited ?? false;
                const isNew = zone?.isNew ?? false;

                let cellStyle: React.CSSProperties = {};
                let borderClass = isCombatActive ? 'border-transparent cursor-not-allowed opacity-50' : 'border-transparent hover:border-brand-primary/30';
                let content = null;

                if (sector && isVisited) {
                    cellStyle = { ...cellStyle, backgroundColor: `${sector.color}20` };
                }

                if (zone && isVisited) {
                    let zoneStyle: React.CSSProperties = {};
                    if (sector) {
                        zoneStyle = {
                            ...zoneStyle,
                            backgroundColor: `${sector.color}40`,
                            boxShadow: `inset 0 0 10px ${sector.color}20`
                        };
                    }
                    content = (
                        <div className="flex flex-col items-center justify-center w-full h-full p-1 text-center relative" style={zoneStyle}>
                            <span className="text-[9px] font-bold text-brand-text leading-tight line-clamp-2 overflow-hidden text-ellipsis break-words w-full relative z-10 pointer-events-none tracking-normal">
                                {zone.name}
                            </span>
                        </div>
                    );
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

                        {(isVisited || isSelected || isPlayerHere || sector) && (
                            <span className="absolute top-0.5 left-1 text-[6px] font-mono text-brand-text-muted opacity-40 pointer-events-none select-none tracking-normal">{coordStr}</span>
                        )}

                        {zone && isVisited && (
                            <div
                                className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full z-20 ${getHostilityDotClass(zone.hostility || 0)}`}
                                title={`Hostility: ${zone.hostility}`}
                            />
                        )}

                        {content}

                        {isPlayerHere && (
                            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                                <div className={`w-4 h-4 rounded-full shadow-lg animate-pulse ring-2 ring-white flex items-center justify-center ${isCombatActive ? 'bg-red-600 shadow-red-500/50' : 'bg-brand-accent shadow-[0_0_10px_#3ecf8e]'}`}>
                                    <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                                </div>
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
                <button
                    onClick={() => setIsSectorManagerOpen(true)}
                    className="btn-icon bg-brand-surface/90 backdrop-blur-md border border-brand-primary p-3 rounded-full shadow-lg text-brand-text hover:text-brand-accent"
                    title="Manage Sectors"
                >
                    <Icon name="world" className="w-6 h-6" />
                </button>

                <div className="flex flex-col bg-brand-surface/90 backdrop-blur-md border border-brand-primary rounded-full shadow-lg overflow-hidden">
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
                    className="btn-icon bg-brand-surface/90 backdrop-blur-md border border-brand-primary p-3 rounded-full shadow-lg text-brand-text hover:text-brand-accent"
                    title="Center on Player"
                >
                    <Icon name="location" className="w-6 h-6" />
                </button>
            </div>

            <div className="absolute top-4 left-4 z-30 bg-brand-surface/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-brand-primary shadow-lg pointer-events-none">
                <div className="flex flex-col">
                    <span className="text-xs font-mono text-brand-accent font-bold mb-1.5 tracking-normal">{selectedCoords || playerCoordinates}</span>
                    <div className="flex items-center gap-2 text-[10px] text-brand-text-muted border-t border-brand-primary/30 pt-1.5 mt-0.5">
                        <div className="w-10 h-3 border border-brand-text-muted/30 flex items-center justify-center text-[7px] font-black tracking-tight">1 Cell</div>
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

            <SectorManagerModal
                isOpen={isSectorManagerOpen}
                onClose={() => setIsSectorManagerOpen(false)}
                sectors={mapSectors || []}
                onGenerate={generateAndAddSector}
                onDelete={deleteSector}
                onUpdate={updateSector}
                onGenerateFromLore={generateMapFromLore}
                generationProgress={mapGenerationProgress}
            />

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
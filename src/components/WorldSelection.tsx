
import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { worldService } from '../services/worldService';
import { cloudSaveService, CloudSaveMetadata } from '../services/cloudSaveService';
import {
    generateWorldPreview,
    generateWorldSectors,
    generateGlobalWorldSummary
} from '../services/aiWorldService';
import type { World, LoreEntry, GameData, WorldPreview, MapSettings, MapSector, MapZone, SkillConfiguration } from '../types';
import { Icon } from './Icon';
import Modal from './Modal';
import CharacterCreationLoader from './CharacterCreationLoader';

interface WorldSelectionProps {
    onWorldSelected: (worldId: string) => void;
}

const SETTINGS = ['Fantasy', 'Sci-Fi', 'Modern', 'Magitech'];
const THEMES = [
    'Post-Apocalyptic', 'Alien Horror', 'Supernatural', 'High-Tech',
    'No-Magic', 'High-Magic', 'Cyberpunk', 'Steampunk', 'Dystopian',
    'Exploration', 'Survival', 'Grimdark', 'Whimsical'
];

const INITIAL_GEN_RADIUS = 13;
const formatCoordinates = (x: number, y: number): string => {
    return `${x}-${y}`;
};

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
    'newbie': { label: 'Newbie', color: 'text-brand-text-muted' },
    'adventurer': { label: 'Adventurer', color: 'text-blue-400' },
    'hero': { label: 'Hero', color: 'text-yellow-400' },
    'super_admin': { label: 'Super Admin', color: 'text-brand-accent' }
};

const WorldSelection: React.FC<WorldSelectionProps> = ({ onWorldSelected }) => {
    const { user } = useUser();
    const [worlds, setWorlds] = useState<World[]>([]);
    const [isLoadingWorlds, setIsLoadingWorlds] = useState(true);

    // User Tier State
    const [userTier, setUserTier] = useState<string>('newbie');
    const [isTierLoading, setIsTierLoading] = useState(true);

    // Cloud Save State
    const [cloudSaves, setCloudSaves] = useState<CloudSaveMetadata[]>([]);
    const [isLoadingCloud, setIsLoadingCloud] = useState(false);
    const [isRestoringCloud, setIsRestoringCloud] = useState(false);
    const [cloudError, setCloudError] = useState('');

    // Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Form State
    const [setting, setSetting] = useState('Fantasy');
    const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
    const [numRaces, setNumRaces] = useState(3);
    const [numFactions, setNumFactions] = useState(3);
    const [mapDistance, setMapDistance] = useState(24);
    const [mapUnit, setMapUnit] = useState('Miles');
    const [worldName, setWorldName] = useState('');
    const [startingDate, setStartingDate] = useState('');
    const [startingTime, setStartingTime] = useState('08:00');
    const [additionalContext, setAdditionalContext] = useState('');

    // Generation State
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStep, setGenerationStep] = useState('');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');

    // Preview State (Stage 1)
    const [previewData, setPreviewData] = useState<WorldPreview | null>(null);

    // Import/Export
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fetchWorlds = async () => {
        setIsLoadingWorlds(true);
        try {
            const loadedWorlds = await worldService.getAllWorlds();
            setWorlds(loadedWorlds);
        } catch (e) {
            console.error("Failed to load worlds:", e);
        } finally {
            setIsLoadingWorlds(false);
        }
    };

    useEffect(() => {
        fetchWorlds();

        // Fetch user tier
        fetch('/api/user-tier')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data?.tier) setUserTier(data.tier); })
            .catch(() => { })
            .finally(() => setIsTierLoading(false));

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        setStartingDate(`${year}-${month}-${day}`);
    }, []);

    const handleFetchCloudSaves = async () => {
        setIsLoadingCloud(true);
        setCloudError('');
        try {
            const saves = await cloudSaveService.fetchCloudSavesMetadata();
            setCloudSaves(saves);
        } catch (e: any) {
            setCloudError(e.message || 'Failed to load cloud saves.');
        } finally {
            setIsLoadingCloud(false);
        }
    };

    const handleRestoreCloudSave = async (save: CloudSaveMetadata) => {
        setIsRestoringCloud(true);
        setCloudError('');
        try {
            const { data, name, worldId } = await cloudSaveService.fetchCloudSaveContext(save.id);
            // Import as a local world
            const existingWorlds = await worldService.getAllWorlds();
            const existingWorld = existingWorlds.find(w => w.id === worldId);
            if (existingWorld) {
                await worldService.saveGameData(worldId, data);
            } else {
                await worldService.importWorldsFromJson(JSON.stringify([{ id: worldId, name, gameData: data }]));
            }
            await fetchWorlds();
            onWorldSelected(worldId);
        } catch (e: any) {
            setCloudError(e.message || 'Failed to restore cloud save.');
        } finally {
            setIsRestoringCloud(false);
        }
    };

    const resetForm = () => {
        setPreviewData(null);
        setError('');
        setWorldName('');
        setSelectedThemes([]);
        setAdditionalContext('');
        setIsGenerating(false);
    };

    const handleDeleteWorld = async (worldId: string) => {
        if (window.confirm("Are you sure you want to permanently delete this world?")) {
            await worldService.deleteWorld(worldId);
            await fetchWorlds();
        }
    };

    const handleThemeToggle = (theme: string) => {
        setSelectedThemes(prev =>
            prev.includes(theme)
                ? prev.filter(t => t !== theme)
                : [...prev, theme]
        );
    };

    const handleGeneratePreview = async () => {
        if (!worldName.trim()) {
            setError('Please enter a world name.');
            return;
        }

        setIsGenerating(true);
        setError('');
        setProgress(20);
        setGenerationStep('Architecting World Blueprint...');

        try {
            const preview = await generateWorldPreview(
                setting,
                selectedThemes,
                numRaces,
                numFactions,
                worldName,
                additionalContext
            );

            setPreviewData(preview);
            setIsGenerating(false);
        } catch (err) {
            console.error("Preview generation failed:", err);
            setError("Failed to generate world preview. Please try again.");
            setIsGenerating(false);
        }
    };

    const handleDeepGeneration = async () => {
        if (!previewData) return;

        setIsGenerating(true);
        setProgress(10);
        setGenerationStep('Assembling Chronicle...');

        try {
            // 1. Build initial core lore entries
            const loreEntries: Omit<LoreEntry, 'id' | 'isNew'>[] = [
                {
                    title: `World History`,
                    content: previewData.context,
                    tags: ['origin', 'history', 'world_lore'],
                    keywords: ['history', 'overview', worldName.toLowerCase()]
                }
            ];

            previewData.races.forEach(r => {
                loreEntries.push({
                    title: r.name,
                    content: `${r.description}\n\nPersonality: ${r.personality}\nAllegiance: ${r.faction || 'None'}`,
                    tags: ['race', 'npc'],
                    keywords: r.keywords || []
                });
            });

            previewData.factions.forEach(f => {
                loreEntries.push({
                    title: f.name,
                    content: `Goals: ${f.goals}\n\nRelationships: ${f.relationships}\nComposition: ${f.racialComposition}`,
                    tags: ['faction', 'politics'],
                    keywords: f.keywords || []
                });
            });

            const mapSettings: MapSettings = {
                style: setting.toLowerCase() as any,
                gridDistance: mapDistance,
                gridUnit: mapUnit,
                zoneLabel: setting === 'Sci-Fi' ? 'System' : (setting === 'Modern' ? 'District' : 'Region')
            };

            // 2. Sector Generation
            setGenerationStep('Surveying Sectors...');
            setProgress(30);
            const sectorBlueprints = await generateWorldSectors(loreEntries as LoreEntry[], mapSettings);

            const mapSectors: MapSector[] = sectorBlueprints.map((bp, i) => ({
                id: `sector-${i}-${Date.now()}`,
                name: bp.name,
                description: bp.description,
                color: bp.color,
                coordinates: [],
                keywords: bp.keywords || []
            }));

            const getDist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1);

            // Sector placement logic (Voronoi)
            for (let x = -INITIAL_GEN_RADIUS; x <= INITIAL_GEN_RADIUS; x++) {
                for (let y = -INITIAL_GEN_RADIUS; y <= INITIAL_GEN_RADIUS; y++) {
                    const coords = formatCoordinates(x, y);
                    let closestSectorIndex = 0;
                    let minDist = Infinity;

                    sectorBlueprints.forEach((bp, index) => {
                        const adjX = bp.centerX - INITIAL_GEN_RADIUS;
                        const adjY = bp.centerY - INITIAL_GEN_RADIUS;
                        const d = getDist(x, y, adjX, adjY);
                        if (d < minDist) {
                            minDist = d;
                            closestSectorIndex = index;
                        }
                    });

                    if (mapSectors[closestSectorIndex]) {
                        mapSectors[closestSectorIndex].coordinates.push(coords);
                    }
                }
            }

            // 3. Weave Global Overview (New Final Step)
            setGenerationStep('Weaving World Overview...');
            setProgress(60);
            const worldOverviewText = await generateGlobalWorldSummary(loreEntries as LoreEntry[]);

            loreEntries.push({
                title: "World Overview",
                content: worldOverviewText,
                tags: ['history', 'world_lore'],
                keywords: ['overview', 'summary', setting.toLowerCase()]
            });

            setGenerationStep('Finalizing World State...');
            setProgress(85);

            // Create starting zone at origin (0,0)
            const startingSector = mapSectors.find(s => s.coordinates.includes("0-0")) || mapSectors[0];
            const startingZone: MapZone = {
                id: `zone-start-${Date.now()}`,
                name: `${startingSector.name} Gateway`,
                description: `The central crossing of the ${startingSector.name}. Discovery begins here.`,
                hostility: 0,
                coordinates: "0-0",
                keywords: startingSector.keywords || [],
                sectorId: startingSector.id,
                visited: true,
                tags: ['location', 'safe', 'start']
            };

            const mapZones: MapZone[] = [startingZone];
            const startingLocationName = startingZone.name;
            const startingCoordinates = startingZone.coordinates;

            const date = new Date(`${startingDate}T${startingTime}`);
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const gameDateTime = `${date.toLocaleString('en-US', { month: 'long' })} ${date.getDate()}, ${date.getFullYear()}, ${hours}:${minutes}`;

            setProgress(95);

            const customGameData: Partial<GameData> = {
                story: [{
                    id: `story-start-${Date.now()}`,
                    timestamp: gameDateTime,
                    location: startingLocationName,
                    content: `You arrive in ${startingLocationName}. The World Of ${worldName} lies before you, waiting to be explored.`,
                    isNew: true
                }],
                objectives: [],
                knowledge: [],
                gmNotes: "",
                worldSummary: worldOverviewText, // Populate gameData field
                gmSettings: `Setting: ${setting}. Themes: ${selectedThemes.join(', ')}. Additional context: ${additionalContext}.`,
                mapSettings: mapSettings,
                mapSectors: mapSectors,
                mapZones: mapZones,
                messages: [
                    {
                        id: `ai-start-${Date.now()}`,
                        sender: 'ai',
                        content: `Welcome to ${worldName}. You stand in ${startingLocationName}. Use the Character Sheet to define who you are, or begin your journey immediately.`,
                        location: startingLocationName
                    }
                ],
                playerCoordinates: startingCoordinates,
                currentTime: gameDateTime,
                skillConfiguration: setting as SkillConfiguration
            };

            const newWorld = await worldService.createNewWorld(worldName, loreEntries, gameDateTime, customGameData);
            onWorldSelected(newWorld.id);

        } catch (err) {
            console.error("Deep generation failed:", err);
            setError("Failed to finalize world. Please try again.");
            setIsGenerating(false);
        }
    };

    const handleImportClick = () => {
        setImportMessage(null);
        fileInputRef.current?.click();
    };

    const handleExportAll = () => {
        worldService.getAllWorlds().then(allWorlds => {
            const jsonString = JSON.stringify(allWorlds, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gemini_adventures_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text === 'string') {
                    const newWorlds = await worldService.importWorldsFromJson(text);
                    setWorlds(newWorlds);
                    setImportMessage({ type: 'success', text: 'Import successful!' });
                }
            } catch (err) {
                setImportMessage({ type: 'error', text: 'Import failed. Invalid file.' });
            }
            if (event.target) event.target.value = '';
        };
        reader.readAsText(file);
    };

    if (isLoadingWorlds) {
        return <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-text-muted"><Icon name="spinner" className="w-8 h-8 animate-spin" /></div>;
    }

    const tierInfo = TIER_CONFIG[userTier] || TIER_CONFIG['newbie'];
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';

    return (
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4 animate-page">
            <div className="w-full max-w-2xl mx-auto">
                <h1 className="text-center mb-2">Heroic AI <span className="text-brand-accent">RPG</span></h1>
                <p className="text-body-sm text-brand-text-muted mb-8 text-center font-medium opacity-60">Powered by Gemini 3. Choose your realm or forge a new destiny.</p>

                {/* User Info Panel */}
                <div className="bg-brand-surface p-4 rounded-2xl border border-brand-primary/50 mb-10 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Icon name="character" className="w-5 h-5 text-brand-text-muted flex-shrink-0" />
                        <span className="text-body-sm font-bold text-brand-text truncate">{userEmail || 'Loading...'}</span>
                    </div>
                    <div className="flex-shrink-0">
                        {isTierLoading ? (
                            <span className="text-body-sm text-brand-text-muted">...</span>
                        ) : (
                            <span className={`text-body-sm font-black ${tierInfo.color}`}>{tierInfo.label}</span>
                        )}
                    </div>
                </div>

                <div className="space-y-4 mb-10">
                    {worlds.map(world => (
                        <div key={world.id} className="bg-brand-surface p-5 rounded-2xl flex items-center justify-between shadow-xl border border-brand-primary/50 hover:border-brand-accent/20 transition-all group">
                            <span className="text-body-lg font-bold text-brand-text group-hover:text-brand-accent transition-colors">{world.name}</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => onWorldSelected(world.id)} className="btn-primary btn-md w-32 shadow-sm">Enter Realm</button>
                                <button onClick={() => handleDeleteWorld(world.id)} className="btn-icon-delete">
                                    <Icon name="trash" className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-center gap-4">
                    <button
                        onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
                        className="btn-primary btn-lg shadow-xl shadow-brand-accent/10"
                    >
                        <Icon name="plus" className="w-5 h-5 mr-3" />
                        Forge New Realm
                    </button>
                </div>

                {/* Cloud Load Section */}
                <div className="mt-10 pt-8 border-t border-brand-primary/20">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-body-sm font-bold text-brand-text-muted">Cloud Archives</h4>
                        <button
                            onClick={handleFetchCloudSaves}
                            disabled={isLoadingCloud}
                            className="btn-secondary btn-sm"
                        >
                            {isLoadingCloud ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : 'Restore Archives'}
                        </button>
                    </div>

                    {cloudError && <p className="text-body-sm text-brand-danger font-bold mb-3">{cloudError}</p>}

                    {cloudSaves.length > 0 && (
                        <div className="space-y-3 mb-6">
                            {cloudSaves.map(save => (
                                <div key={save.id} className="bg-brand-primary/20 p-4 rounded-xl border border-brand-surface flex items-center justify-between">
                                    <div className="min-w-0">
                                        <span className="text-body-sm font-bold text-brand-text block truncate">{save.name}</span>
                                        <span className="text-[10px] text-brand-text-muted">{new Date(save.updatedAt).toLocaleString()}</span>
                                    </div>
                                    <button
                                        onClick={() => handleRestoreCloudSave(save)}
                                        disabled={isRestoringCloud}
                                        className="btn-primary btn-sm flex-shrink-0"
                                    >
                                        {isRestoringCloud ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : 'Restore'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-6 border-t border-brand-primary/20 text-center">
                    <div className="flex justify-center gap-8">
                        <button onClick={handleImportClick} className="btn-tertiary text-xs">Import Tome</button>
                        <button onClick={handleExportAll} className="btn-tertiary text-xs">Export Tomes</button>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".json" />
                    {importMessage && <p className={`mt-3 text-body-sm font-bold ${importMessage.type === 'success' ? 'text-brand-accent' : 'text-brand-danger'}`}>{importMessage.text}</p>}
                </div>
            </div>

            <Modal isOpen={isCreateModalOpen} onClose={() => !isGenerating && setIsCreateModalOpen(false)} title={previewData ? "World Preview" : "Forging a New World"}>
                {isGenerating ? (
                    <div className="p-6">
                        <CharacterCreationLoader title="Forging World..." step={generationStep} progress={progress} />
                    </div>
                ) : previewData ? (
                    <div className="space-y-8 animate-page py-2">
                        <div className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface shadow-inner">
                            <h3 className="text-brand-text mb-2">The World of {worldName}</h3>
                            <p className="text-body-base text-brand-text leading-relaxed whitespace-pre-wrap font-medium opacity-90">{previewData.context}</p>
                        </div>

                        <div>
                            <h4 className="px-1 mb-4">Ancestry Registry</h4>
                            <div className="space-y-3">
                                {previewData.races.map((race, i) => (
                                    <div key={i} className="bg-brand-surface/40 p-4 rounded-xl border border-brand-primary/50">
                                        <h5 className="font-bold text-brand-text text-sm mb-1">{race.name}</h5>
                                        <p className="text-body-sm text-brand-text-muted leading-relaxed italic">{race.description}</p>
                                        <div className="mt-2">
                                            <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/5 px-2 py-0.5 rounded border border-brand-accent/10">Faction: {race.faction || 'Neutral'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="px-1 mb-4">Major Factions</h4>
                            <div className="space-y-4">
                                {previewData.factions.map((faction, i) => (
                                    <div key={i} className="bg-brand-primary/10 p-5 rounded-2xl border border-brand-surface">
                                        <h5 className="font-black text-brand-text text-sm mb-2">{faction.name}</h5>
                                        <p className="text-body-sm text-brand-text mb-3 leading-relaxed">{faction.goals}</p>
                                        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-brand-primary/30">
                                            <p className="text-body-sm"><span className="font-bold text-brand-text-muted">Standing:</span> <span className="text-brand-text">{faction.relationships}</span></p>
                                            <p className="text-body-sm"><span className="font-bold text-brand-text-muted">Composition:</span> <span className="text-brand-text">{faction.racialComposition}</span></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-6 border-t border-brand-primary/20">
                            <button
                                onClick={() => setPreviewData(null)}
                                className="btn-secondary btn-md flex-1"
                            >
                                Back to Settings
                            </button>
                            <button
                                onClick={handleDeepGeneration}
                                className="btn-primary btn-md flex-1 shadow-lg shadow-brand-accent/20"
                            >
                                Breathe Life into Realm
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-page py-2">
                        <div className="space-y-2">
                            <label className="text-body-sm font-bold text-brand-text-muted ml-1">World Name</label>
                            <input
                                value={worldName}
                                onChange={(e) => setWorldName(e.target.value)}
                                placeholder="e.g. Eldoria, Neo-Tokyo, Sector 7..."
                                className="w-full bg-brand-primary h-12 px-4 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-sm font-bold"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-body-sm font-bold text-brand-text-muted ml-1">Genre And Setting</label>
                            <div className="grid grid-cols-2 gap-2">
                                {SETTINGS.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setSetting(s)}
                                        type="button"
                                        className={`btn-md focus:outline-none ${setting === s ? 'btn-primary' : 'btn-secondary'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-body-sm font-bold text-brand-text-muted ml-1">Thematic Threads</label>
                            <div className="flex flex-wrap gap-2">
                                {THEMES.map(theme => (
                                    <button
                                        key={theme}
                                        onClick={() => handleThemeToggle(theme)}
                                        type="button"
                                        className={`btn-sm rounded-full focus:outline-none ${selectedThemes.includes(theme) ? 'btn-primary' : 'btn-secondary opacity-60'}`}
                                    >
                                        {theme}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-body-sm font-bold text-brand-text-muted ml-1">Additional Races</label>
                                <input
                                    type="number"
                                    min="0" max="10"
                                    value={numRaces}
                                    onChange={(e) => setNumRaces(parseInt(e.target.value))}
                                    className="w-full bg-brand-primary h-12 rounded-xl text-center font-black border border-brand-surface focus:border-brand-accent focus:outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-body-sm font-bold text-brand-text-muted ml-1">Factions</label>
                                <input
                                    type="number"
                                    min="1" max="10"
                                    value={numFactions}
                                    onChange={(e) => setNumFactions(parseInt(e.target.value))}
                                    className="w-full bg-brand-primary h-12 rounded-xl text-center font-black border border-brand-surface focus:border-brand-accent focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 bg-brand-primary/10 p-5 rounded-2xl border border-brand-primary/30">
                            <div className="space-y-2">
                                <label className="text-body-sm font-bold text-brand-text-muted ml-1">Starting Date</label>
                                <input
                                    type="date"
                                    value={startingDate}
                                    onChange={(e) => setStartingDate(e.target.value)}
                                    className="w-full bg-brand-primary h-10 rounded-lg text-xs px-3 border border-brand-surface focus:outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-body-sm font-bold text-brand-text-muted ml-1">Time</label>
                                <input
                                    type="time"
                                    value={startingTime}
                                    onChange={(e) => setStartingTime(e.target.value)}
                                    className="w-full bg-brand-primary h-10 rounded-lg text-xs px-3 border border-brand-surface focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-body-sm font-bold text-brand-text-muted ml-1">Additional Context</label>
                            <textarea
                                value={additionalContext}
                                onChange={(e) => setAdditionalContext(e.target.value)}
                                placeholder="Provide specific details for the architect... e.g. Low magic, high technology, or the world is a single giant city..."
                                className="w-full bg-brand-primary p-4 rounded-2xl border border-brand-surface focus:border-brand-accent focus:outline-none h-28 text-sm leading-relaxed"
                            />
                        </div>

                        {error && <p className="text-brand-danger text-body-sm text-center font-bold animate-pulse">{error}</p>}

                        <button
                            onClick={handleGeneratePreview}
                            disabled={!worldName.trim() || isGenerating}
                            className="btn-primary btn-lg w-full mt-4 shadow-xl shadow-brand-accent/20"
                        >
                            {isGenerating ? <span className="flex items-center justify-center gap-2"><Icon name="spinner" className="w-5 h-5 animate-spin" /> Generating...</span> : 'Scout The Realm'}
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default WorldSelection;

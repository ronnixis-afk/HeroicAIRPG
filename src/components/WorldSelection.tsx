
import React, { useState, useEffect, useRef } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
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

    // Modal & Drawer State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
        handleFetchCloudSaves();

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
        <div className="min-h-screen bg-[#0a0f12] text-brand-text flex flex-col relative overflow-x-hidden hide-scrollbar animate-page">
            {/* Top Navigation Bar */}
            <header className="flex items-center justify-between px-6 py-5 sticky top-0 z-40 bg-gradient-to-b from-[#0a0f12] to-transparent">
                <h1 className="text-2xl font-black tracking-tighter text-brand-text">Heroic AI <span className="text-brand-accent">RPG</span></h1>
                <button
                    onClick={() => setIsDrawerOpen(true)}
                    className="p-2 -mr-2 text-brand-text-muted hover:text-brand-accent transition-colors focus:outline-none"
                    aria-label="Open User Menu"
                >
                    <Icon name="menu" className="w-7 h-7" />
                </button>
            </header>

            {/* User Account Drawer Overlay */}
            <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsDrawerOpen(false)}></div>
            <div className={`fixed inset-y-0 right-0 w-80 bg-brand-surface border-l border-brand-primary/30 z-50 transform transition-transform duration-300 ease-out shadow-2xl flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex items-center justify-between p-6 border-b border-brand-primary/20">
                    <h2 className="text-lg font-bold text-brand-text">Hero Profile</h2>
                    <button onClick={() => setIsDrawerOpen(false)} className="text-brand-text-muted hover:text-brand-accent transition-colors p-1">
                        <Icon name="x" className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 flex flex-col items-center gap-4">
                    <div className="p-1 rounded-full bg-gradient-to-tr from-brand-accent/20 to-brand-primary/20 border border-brand-accent/30 shadow-lg shadow-brand-accent/10">
                        <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-16 h-16 rounded-full" } }} />
                    </div>
                    <div className="text-center">
                        <span className={`text-xs font-black uppercase tracking-widest ${tierInfo.color} mb-1 block`}>{isTierLoading ? 'Syncing...' : tierInfo.label}</span>
                        <span className="text-sm font-medium text-brand-text break-all">{userEmail || 'Loading...'}</span>
                    </div>
                </div>
                <div className="mt-auto p-6 text-center">
                    <p className="text-[10px] text-brand-text-muted uppercase tracking-wider opacity-50">Powered by Gemini 3</p>
                </div>
            </div>

            <main className="flex-1 pb-20 mt-2">
                {/* Local Worlds Horizontal Scroll (Netflix Style) */}
                <section className="mb-10">
                    <h2 className="text-lg font-bold text-brand-text px-6 mb-4">Your Realms</h2>
                    <div className="flex gap-4 overflow-x-auto px-6 pb-6 pt-2 snap-x hide-scrollbar">
                        {/* Forge New Realm Card */}
                        <button
                            onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
                            className="w-36 md:w-44 aspect-[2/3] shrink-0 snap-start bg-gradient-to-br from-brand-surface to-brand-bg border border-dashed border-brand-primary/50 hover:border-brand-accent hover:from-brand-accent/10 hover:to-brand-bg transition-all rounded-xl flex flex-col items-center justify-center text-brand-text-muted hover:text-brand-accent group shadow-lg"
                        >
                            <div className="bg-brand-primary/30 group-hover:bg-brand-accent/20 p-4 rounded-full mb-4 transition-colors">
                                <Icon name="plus" className="w-8 h-8" />
                            </div>
                            <span className="font-bold text-sm text-center px-4 leading-tight">Forge New<br />Realm</span>
                        </button>

                        {worlds.map(world => (
                            <div key={world.id} className="w-36 md:w-44 aspect-[2/3] shrink-0 snap-start relative group rounded-xl overflow-hidden cursor-pointer shadow-lg bg-brand-surface border border-brand-primary/30 hover:border-brand-accent hover:shadow-brand-accent/20 transition-all flex flex-col" onClick={() => onWorldSelected(world.id)}>
                                {/* Placeholder Map/Setting Visual */}
                                <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/20 via-transparent to-black/90 z-0 text-brand-primary opacity-20 flex items-center justify-center overflow-hidden mix-blend-overlay">
                                    <div className="w-[200%] h-[200%] absolute top-0 -left-1/2 rotate-12 bg-gradient-to-r from-transparent via-brand-text to-transparent blur-3xl opacity-10"></div>
                                </div>
                                <div className="absolute top-2 right-2 z-10 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteWorld(world.id); }} className="bg-black/40 hover:bg-brand-danger/20 text-brand-text-muted hover:text-brand-danger p-2 rounded-full backdrop-blur-sm transition-colors shadow-md">
                                        <Icon name="trash" className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="mt-auto p-4 z-10 w-full flex flex-col relative">
                                    <h3 className="text-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors truncate mb-1 shadow-black drop-shadow-md">{world.name}</h3>
                                    <p className="text-[10px] text-brand-text-muted font-medium mb-3 shadow-black drop-shadow-md">Saved {new Date(parseInt(world.id.split('-').pop() || '0')).toLocaleDateString()}</p>
                                    <div className="w-full bg-brand-accent text-black font-black text-xs py-2 rounded flex items-center justify-center gap-1 opacity-100 md:opacity-0 md:translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 shadow-xl transition-all duration-300">
                                        <Icon name="play" className="w-3 h-3" /> Play
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Cloud Load Section Horizontal Scroll */}
                <section className="mb-6">
                    <div className="flex items-center justify-between px-6 mb-4">
                        <h2 className="text-lg font-bold text-brand-text">Archives</h2>
                        <button
                            onClick={handleFetchCloudSaves}
                            disabled={isLoadingCloud}
                            className="bg-brand-surface border border-brand-primary/50 text-brand-text-muted text-[10px] font-bold uppercase py-1 px-3 rounded-full tracking-wider flex items-center gap-1 hover:text-brand-accent hover:border-brand-accent/50 transition-colors shadow-sm"
                        >
                            {isLoadingCloud ? <Icon name="spinner" className="w-3 h-3 animate-spin" /> : <Icon name="cloud" className="w-3 h-3" />}
                            Sync
                        </button>
                    </div>

                    <div className="flex gap-4 overflow-x-auto px-6 pb-6 pt-2 snap-x hide-scrollbar min-h-[200px]">
                        {cloudError && <div className="w-full shrink-0"><p className="text-body-sm text-brand-danger font-bold">{cloudError}</p></div>}

                        {cloudSaves.length === 0 && !isLoadingCloud && !cloudError ? (
                            <div className="w-36 md:w-44 aspect-[2/3] shrink-0 bg-brand-primary/5 border border-brand-surface border-dashed rounded-xl flex items-center justify-center p-4">
                                <p className="text-brand-text-muted text-xs italic text-center opacity-60">No celestial archives found.</p>
                            </div>
                        ) : (
                            cloudSaves.map(save => (
                                <div key={save.id} className="w-36 md:w-44 aspect-[2/3] shrink-0 snap-start relative group rounded-xl overflow-hidden shadow-lg bg-brand-surface/40 border border-brand-primary/20 hover:border-brand-accent/50 transition-all flex flex-col">
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-bg/50 to-[#0a0f12] z-0 mix-blend-multiply border border-brand-accent/10"></div>
                                    <div className="absolute top-3 left-3 z-10 bg-brand-primary/80 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase text-brand-text/70 border border-brand-surface shadow-sm">
                                        Cloud
                                    </div>
                                    <div className="mt-auto p-4 z-10 w-full flex flex-col items-center text-center">
                                        <h3 className="text-sm font-bold text-brand-text truncate w-full mb-1 shadow-black drop-shadow-md">{save.name}</h3>
                                        <p className="text-[9px] text-brand-text-muted mb-4 opacity-70 border-b border-brand-primary/30 pb-2 w-full shadow-black drop-shadow-md">{new Date(save.updatedAt).toLocaleDateString()}</p>
                                        <button
                                            onClick={() => handleRestoreCloudSave(save)}
                                            disabled={isRestoringCloud}
                                            className="w-full bg-[#11181c] border border-brand-accent/50 text-brand-accent font-bold text-xs py-2 rounded flex items-center justify-center gap-1 hover:bg-brand-accent hover:text-black transition-colors shadow-lg"
                                        >
                                            {isRestoringCloud ? <Icon name="spinner" className="w-3 h-3 animate-spin mx-auto" /> : 'Restore'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </main>

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

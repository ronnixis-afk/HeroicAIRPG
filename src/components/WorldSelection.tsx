
import React, { useState, useEffect, useRef } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { worldService } from '../services/worldService';
import { cloudSaveService, CloudSaveMetadata } from '../services/cloudSaveService';
import {
    generateWorldPreview,
    generateGlobalWorldSummary
} from '../services/aiWorldService';
import type { World, LoreEntry, GameData, WorldPreview, MapSettings, MapZone, SkillConfiguration } from '../types';
import { SKILL_DEFINITIONS } from '../types/Core';
import { Icon } from './Icon';
import Modal from './Modal';
import CharacterCreationLoader from './CharacterCreationLoader';

interface WorldSelectionProps {
    onWorldSelected: (worldId: string) => void;
}

const SETTINGS = ['Fantasy', 'Sci-Fi', 'Modern', 'Magitech'];
const SETTING_IMAGES: Record<string, string> = {
    'Fantasy': '/login-bg.png',
    'Sci-Fi': '/bg-scifi.png',
    'Modern': '/bg-modern.png',
    'Magitech': '/bg-magitech.png'
};
const GENRE_THEMES: Record<string, string[]> = {
    'Fantasy': [
        'High-Magic', 'No-Magic', 'Supernatural', 'Grimdark', 'Whimsical', 
        'Exploration', 'Survival', 'Sword & Sorcery', 'Dark Fantasy', 
        'High Fantasy', 'Mythic', 'Heroic Age', 'Lost Civilizations'
    ],
    'Sci-Fi': [
        'Alien Horror', 'High-Tech', 'Cyberpunk', 'Dystopian', 'Exploration', 
        'Survival', 'Space Opera', 'Hard Sci-Fi', 'Mecha', 'Transhumanism',
        'Galactic Empire', 'Cybernetic Revolt', 'Star-Faring'
    ],
    'Modern': [
        'Supernatural', 'Post-Apocalyptic', 'Dystopian', 'Survival', 
        'Urban Fantasy', 'Contemporary', 'Noir', 'Espionage', 'Thriller', 
        'Zombie Apocalypse', 'Hidden World', 'Occult Detective'
    ],
    'Magitech': [
        'Steampunk', 'High-Magic', 'High-Tech', 'Clockwork', 'Airships', 
        'Rune-Tech', 'Industrial Gothic', 'Whimsical', 'Grimdark',
        'Alchemical', 'Steam & Sorcery', 'Automata'
    ]
};
const THEMES = Array.from(new Set(Object.values(GENRE_THEMES).flat()));

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
    const [cloudMessage, setCloudMessage] = useState('');

    // Modal & Drawer State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);

    // Form State
    const [setting, setSetting] = useState('Fantasy');
    const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
    const [numRaces, setNumRaces] = useState(3);
    const [numFactions, setNumFactions] = useState(3);
    const [raceNames, setRaceNames] = useState<string[]>(Array(10).fill(''));
    const [factionNames, setFactionNames] = useState<string[]>(Array(10).fill(''));
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
    const worldNameInputRef = useRef<HTMLInputElement>(null);
    const generationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Consumption & Credits State
    const [credits, setCredits] = useState({ currentCredits: 0, maxCredits: 1000 });
    const [consumptionData, setConsumptionData] = useState<{ logs: any[], stats: any } | null>(null);
    const [isLoadingConsumption, setIsLoadingConsumption] = useState(false);
    
    // Per-Realm Sync Status
    const [syncingRealms, setSyncingRealms] = useState<Record<string, 'loading' | 'synced'>>({});

    const formatRelativeTime = (dateInput: string | Date | number) => {
        const date = new Date(dateInput);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'Just Now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m ago`;
        return `${diffDays}d ${diffHours % 24}h ago`;
    };

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
        fetchCredits();

        // Fetch user tier
        fetch('/api/user-tier')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.tier) {
                    setUserTier(data.tier);
                    if (data.tier === 'super_admin') fetchConsumption();
                }
            })
            .catch(() => { })
            .finally(() => setIsTierLoading(false));

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        setStartingDate(`${year}-${month}-${day}`);
    }, []);

    const fetchCredits = async () => {
        try {
            const res = await fetch('/api/user/credits');
            if (res.ok) {
                const data = await res.json();
                setCredits(data);
            }
        } catch (e) {
            console.error("Failed to fetch credits:", e);
        }
    };

    const fetchConsumption = async () => {
        setIsLoadingConsumption(true);
        try {
            const res = await fetch('/api/admin/consumption');
            if (res.ok) {
                const data = await res.json();
                setConsumptionData(data);
            }
        } catch (e) {
            console.error("Failed to fetch consumption:", e);
        } finally {
            setIsLoadingConsumption(false);
        }
    };

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
                await worldService.saveGameData(worldId, data, save.updatedAt);
            } else {
                await worldService.importWorldsFromJson(JSON.stringify([{ id: worldId, name, gameData: data, updatedAt: save.updatedAt }]));
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
        if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
        setPreviewData(null);
        setError('');
        setWorldName('');
        setSelectedThemes([]);
        setAdditionalContext('');
        setIsGenerating(false);
        setWizardStep(1);
    };
    
    // Auto-focus world name input when modal opens
    useEffect(() => {
        if (isCreateModalOpen && !previewData) {
            setTimeout(() => {
                worldNameInputRef.current?.focus();
            }, 100);
        }
    }, [isCreateModalOpen, previewData]);

    const handleDeleteRealm = async (realm: any) => {
        const confirmMsg = realm.cloud 
            ? `Are you sure you want to permanently delete "${realm.name}" from BOTH local and cloud storage? This cannot be undone.`
            : `Are you sure you want to permanently delete "${realm.name}"?`;

        if (window.confirm(confirmMsg)) {
            setIsLoadingCloud(true);
            try {
                // Delete from cloud if it exists
                if (realm.cloud) {
                    await cloudSaveService.deleteCloudSave(realm.cloud.id);
                }

                // Delete local world if it exists
                if (realm.local) {
                    await worldService.deleteWorld(realm.id);
                }

                await fetchWorlds();
                await handleFetchCloudSaves();
                setCloudMessage('Realm extinguished from history.');
            } catch (err: any) {
                setCloudError(`Failed to delete realm: ${err.message}`);
            } finally {
                setIsLoadingCloud(false);
                setTimeout(() => setCloudMessage(''), 3000);
            }
        }
    };

    const handleUploadToCloud = async (realm: any) => {
        if (!realm.local) return;
        
        // Use per-realm loading state instead of global
        setSyncingRealms(prev => ({ ...prev, [realm.id]: 'loading' }));
        
        try {
            const result = await cloudSaveService.pushSaveToCloud(realm.id, realm.name, realm.local.gameData);
            // Sync local timestamp to match cloud for "synced" status
            await worldService.saveGameData(realm.id, realm.local.gameData, result.updatedAt);
            
            await fetchWorlds(); // Refresh local list to get updated timestamp
            await handleFetchCloudSaves(); // Refresh cloud list
            
            // Set success state for 3 seconds
            setSyncingRealms(prev => ({ ...prev, [realm.id]: 'synced' }));
            setTimeout(() => {
                setSyncingRealms(prev => {
                    const next = { ...prev };
                    delete next[realm.id];
                    return next;
                });
            }, 3000);
        } catch (e: any) {
            console.error("Failed to sync with cloud:", e);
            // Keep error as cloudError for visibility or alert? 
            // The user wants checks/circles, so we'll just clear on error for now?
            // Actually, keep cloudError for generic "failure" if needed, but remove the UI message block as requested.
            setCloudError(e.message || 'Failed to sync with cloud.');
        } finally {
            if (syncingRealms[realm.id] === 'loading') {
                setSyncingRealms(prev => {
                    const next = { ...prev };
                    delete next[realm.id];
                    return next;
                });
            }
        }
    };

    const handleThemeToggle = (theme: string) => {
        setSelectedThemes(prev => {
            const isSelected = prev.includes(theme);
            
            // Limit to 3 tags
            if (!isSelected && prev.length >= 3) return prev;

            let next = isSelected ? prev.filter(t => t !== theme) : [...prev, theme];
            
            // Conflict Validation: High-Magic vs No-Magic
            if (!isSelected) {
                if (theme === 'High-Magic') {
                    next = next.filter(t => t !== 'No-Magic');
                } else if (theme === 'No-Magic') {
                    next = next.filter(t => t !== 'High-Magic' && t !== 'Supernatural');
                } else if (theme === 'Supernatural') {
                    next = next.filter(t => t !== 'No-Magic');
                }
            }
            return next;
        });
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

        if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
        generationTimeoutRef.current = setTimeout(() => {
            if (isGenerating) {
                setError("Architect was delayed in the void. Please try again.");
                setIsGenerating(false);
            }
        }, 45000); // 45s timeout for architecting

        try {
            const preview = await generateWorldPreview(
                setting,
                selectedThemes,
                numRaces,
                numFactions,
                worldName,
                additionalContext,
                raceNames.slice(0, numRaces),
                factionNames.slice(0, numFactions)
            );

            if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
            setPreviewData(preview);
            setIsGenerating(false);
        } catch (err) {
            if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
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

        if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
        generationTimeoutRef.current = setTimeout(() => {
            setError("The chronicle forge is running cold. Please try again.");
            setIsGenerating(false);
        }, 60000); // 60s timeout for deep generation

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
                    content: `${r.description}\n\nAppearance: ${r.appearance}\nQualities: ${r.qualities}\nAllegiance: ${r.faction || 'None'}`,
                    tags: ['race', 'npc'],
                    keywords: r.keywords || [],
                    racialTrait: r.racialTrait,
                    languageConfig: r.languageConfig
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

            // 2. Weave Global Overview (New Final Step)
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
            const startingZone: MapZone = {
                id: `zone-start-${Date.now()}`,
                name: `${worldName} Entrance`,
                description: `A central arrival point in the world of ${worldName}. Discovery begins here.`,
                hostility: 0,
                coordinates: "0-0",
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
                story: [],
                objectives: [],
                knowledge: [],
                gmNotes: "",
                worldSummary: worldOverviewText, // Populate gameData field
                gmSettings: `Setting: ${setting}. Themes: ${selectedThemes.join(', ')}. Additional context: ${additionalContext}.`,
                mapSettings: mapSettings,
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
            if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
            onWorldSelected(newWorld.id);

        } catch (err) {
            if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
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

    // Unified Realms Logic
    const unifiedRealms = (() => {
        const realmsMap = new Map<string, any>();

        // Add Local Saves
        worlds.forEach(w => {
            realmsMap.set(w.id, {
                id: w.id,
                name: w.name,
                local: w,
                status: 'local-only' as const
            });
        });

        // Merge Cloud Saves
        cloudSaves.forEach(c => {
            const existing = realmsMap.get(c.worldId);
            if (existing) {
                existing.cloud = c;
                if (existing.local?.updatedAt) {
                    const localTime = new Date(existing.local.updatedAt).getTime();
                    const cloudTime = new Date(c.updatedAt).getTime();
                    
                    // Use a small buffer for "synced" status
                    if (Math.abs(localTime - cloudTime) < 5000) {
                        existing.status = 'synced';
                    } else if (localTime > cloudTime) {
                        existing.status = 'local-newer';
                    } else {
                        existing.status = 'cloud-newer';
                    }
                }
            } else {
                realmsMap.set(c.worldId, {
                    id: c.worldId,
                    name: c.name,
                    cloud: c,
                    status: 'cloud-only' as const
                });
            }
        });

        return Array.from(realmsMap.values()).sort((a, b) => {
            const timeA = new Date(a.local?.updatedAt || a.cloud?.updatedAt || 0).getTime();
            const timeB = new Date(b.local?.updatedAt || b.cloud?.updatedAt || 0).getTime();
            return timeB - timeA;
        });
    })();

    const handleRealmSelection = async (realm: any) => {
        if (realm.status === 'cloud-only' || realm.status === 'cloud-newer') {
            if (realm.cloud) await handleRestoreCloudSave(realm.cloud);
        } else {
            onWorldSelected(realm.id);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0f12] text-brand-text flex flex-col relative overflow-x-hidden hide-scrollbar animate-page">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-gradient-to-b from-[#0a0f12] to-transparent w-full">
                <div className="max-w-screen-2xl mx-auto flex flex-row items-center justify-between px-6 md:px-12 lg:px-20 xl:px-28 py-5">
                    <div className="flex items-center gap-3">
                        <Icon name="heroicAction" className="w-[1.6rem] h-[1.6rem] text-brand-accent drop-shadow-[0_0_8px_rgba(62,207,142,0.3)]" />
                        <h3 className="text-2xl font-bold text-brand-text m-0 leading-none font-merriweather uppercase">Heroic <span className="text-brand-accent">AI RPG</span></h3>
                    </div>
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="p-2 -mr-2 text-brand-text-muted hover:text-brand-accent transition-colors focus:outline-none"
                        aria-label="Open User Menu"
                    >
                        <Icon name="menu" className="w-7 h-7" />
                    </button>
                </div>
            </header>

            {/* User Account Drawer Overlay */}
            <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsDrawerOpen(false)}></div>
            <div className={`fixed inset-y-0 right-0 w-[368px] bg-[#0c1114] border-l border-brand-primary/30 z-50 transform transition-transform duration-300 ease-out shadow-2xl flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-brand-primary/10 bg-brand-surface/30">
                    <div className="flex items-center gap-3">
                        <div className="p-0.5 rounded-full bg-gradient-to-tr from-brand-accent/20 to-brand-primary/20 border border-brand-accent/30 shadow-lg flex items-center justify-center overflow-hidden aspect-square">
                            <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-10 h-10 rounded-full" } }} />
                        </div>
                    </div>
                    <button onClick={() => setIsDrawerOpen(false)} className="text-brand-text-muted hover:text-brand-accent transition-colors p-2 rounded-full hover:bg-brand-primary/10">
                        <Icon name="close" className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scroll pb-10">
                    {/* 1. Credits & Usage */}
                    <div className="p-6 pb-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Icon name="sparkles" className="w-4 h-4 text-brand-accent" />
                                <span className="text-xs font-bold text-brand-text inter">Credits & Usage</span>
                            </div>
                            <button className="text-[10px] font-bold text-brand-accent px-2 py-1 rounded-lg bg-brand-accent/10 border border-brand-accent/20 hover:bg-brand-accent hover:text-black transition-all inter">
                                Buy More
                            </button>
                        </div>
                        <div className="w-full h-2 bg-brand-primary/20 rounded-full overflow-hidden border border-brand-primary/10 shadow-inner">
                            <div className="h-full bg-gradient-to-r from-brand-accent to-brand-primary transition-all duration-1000" style={{ width: `${(credits.currentCredits / credits.maxCredits) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-between mt-2">
                            <span className="text-[10px] text-brand-text-muted font-medium inter">Remaining Credits</span>
                            <span className="text-[10px] text-brand-text font-bold inter">{credits.currentCredits} / {credits.maxCredits}</span>
                        </div>
                    </div>

                    <div className="px-3 space-y-1">
                        {/* 2. Subscription & Billing */}
                        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-primary/10 transition-colors group text-left">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                <Icon name="shield" className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-brand-text inter">Subscription & Billing</span>
                                <span className="text-[10px] text-brand-text-muted inter">Manage Plans & Payment</span>
                            </div>
                        </button>

                        {/* 3. Account Profile */}
                        <div className="w-full flex flex-col gap-3 p-3 rounded-xl bg-brand-primary/5 border border-brand-primary/10 mt-2 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col ml-1">
                                    <span className="text-sm font-bold text-brand-text inter">{userEmail?.split('@')[0] || 'User'}</span>
                                    <span className={`text-[10px] font-bold ${tierInfo.color} inter`}>{tierInfo.label}</span>
                                </div>
                                <button className="ml-auto p-2 text-brand-text-muted hover:text-brand-accent transition-colors">
                                    <Icon name="edit" className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-[11px] text-brand-text-muted leading-relaxed px-1 font-medium italic inter opacity-60">"Your profile summary and bio display here."</p>
                        </div>

                        <div className="h-px bg-brand-primary/10 mx-3 my-2" />

                        {/* 4. Characters & Worlds */}
                        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-primary/10 transition-colors group text-left">
                            <div className="w-8 h-8 rounded-lg bg-brand-accent/10 flex items-center justify-center text-brand-accent group-hover:scale-110 transition-transform">
                                <Icon name="boxDrawer" className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-brand-text inter">Characters & Worlds</span>
                                <span className="text-[10px] text-brand-text-muted inter">Manage Saved RPG Assets</span>
                            </div>
                        </button>

                        {/* 5. Achievements & Stats */}
                        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-primary/10 transition-colors group text-left">
                            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform">
                                <Icon name="starFill" className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-brand-text inter">Achievements & Stats</span>
                                <span className="text-[10px] text-brand-text-muted inter">Progress Tracking & Records</span>
                            </div>
                        </button>

                        {/* 6. App & AI Settings */}
                        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-primary/10 transition-colors group text-left">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
                                <Icon name="settings" className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-brand-text inter">Settings</span>
                                <span className="text-[10px] text-brand-text-muted inter">Preferences & AI Generation</span>
                            </div>
                        </button>

                        {/* 7. Community & Friends */}
                        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-primary/10 transition-colors group text-left">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                                <Icon name="users" className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-brand-text inter">Community & Friends</span>
                                <span className="text-[10px] text-brand-text-muted inter">Connect with Other Players</span>
                            </div>
                        </button>

                        {/* 8. Help & Support */}
                        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-primary/10 transition-colors group text-left">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                                <Icon name="info" className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-brand-text inter">Help & Support</span>
                                <span className="text-[10px] text-brand-text-muted inter">FAQs, Discord & Feedback</span>
                            </div>
                        </button>

                        {/* Super Admin Consumption Section */}
                        {userTier === 'super_admin' && (
                            <div className="mt-6 pt-6 border-t border-brand-primary/20">
                                <div className="flex items-center justify-between px-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Icon name="currencyCoins" className="w-4 h-4 text-brand-accent" />
                                        <span className="text-xs font-bold text-brand-text inter">Admin Consumption</span>
                                    </div>
                                    <button 
                                        onClick={() => window.location.href = '/admin/consumption'}
                                        className="text-[10px] font-bold text-brand-accent hover:underline inter"
                                    >
                                        View Full Dashboard
                                    </button>
                                </div>
                                
                                <div className="px-3 space-y-2 mb-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] text-brand-text-muted font-medium inter">Total Consumption</span>
                                        <span className="text-xs font-bold text-green-400 inter">
                                            ${consumptionData?.stats.totalCostUsd.toFixed(4) || '0.0000'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-brand-text-muted font-medium inter">Consumed Today</span>
                                        <span className="text-[10px] font-bold text-brand-text inter">
                                            ${consumptionData?.stats.totalTodayCostUsd.toFixed(4) || '0.0000'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="px-3 space-y-2">
                                    <div className="bg-brand-surface/50 border border-brand-primary/10 rounded-lg p-3">
                                        <div className="flex justify-between text-[10px] text-brand-text-muted mb-2 font-medium">
                                            <span>Type</span>
                                            <span>Tokens</span>
                                            <span>Cost</span>
                                        </div>
                                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll pr-1">
                                            {consumptionData?.logs.map((log: any) => (
                                                <div key={log.id} className="flex justify-between items-center text-[10px] border-b border-brand-primary/5 pb-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-brand-text font-bold truncate max-w-[80px]">{log.type}</span>
                                                        <span className="text-[8px] opacity-50">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                                    </div>
                                                    <span className="text-brand-text-muted">{(log.totalTokens / 1000).toFixed(1)}k</span>
                                                    <span className="text-brand-accent">${log.costUsd.toFixed(5)}</span>
                                                </div>
                                            ))}
                                            {(!consumptionData?.logs || consumptionData.logs.length === 0) && (
                                                <div className="text-center py-4 text-brand-text-muted italic opacity-50">No Consumption Logs Found.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 9. Log Out */}
                <div className="mt-auto p-4 border-t border-brand-primary/10 bg-brand-surface/20">
                    <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-danger/10 text-brand-text-muted hover:text-brand-danger transition-all group">
                        <Icon name="arrowLeft" className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-xs font-bold inter">Log Out</span>
                    </button>
                    <div className="mt-4 text-center opacity-30 select-none">
                        <p className="text-[8px] text-brand-text-muted font-bold">Powered By Gemini 3</p>
                    </div>
                </div>
            </div>

            <main className="flex-1 pb-20 mt-2">
                {/* Local Worlds Horizontal Scroll (Netflix Style) */}
                <section className="mb-10">
                    <div className="max-w-screen-2xl mx-auto flex flex-col px-6 md:px-12 lg:px-20 xl:px-28 mb-4">
                        <div className="flex items-center justify-between">
                            <h5 className="text-lg font-bold text-brand-text m-0 inter">Your Realms</h5>
                            <button
                                onClick={handleFetchCloudSaves}
                                disabled={isLoadingCloud}
                                className="bg-brand-surface border border-brand-primary/50 text-brand-text-muted text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 hover:text-brand-accent hover:border-brand-accent/50 transition-all shadow-sm active:scale-95"
                            >
                                {isLoadingCloud ? <Icon name="spinner" className="w-3 h-3 animate-spin" /> : <Icon name="cloud" className="w-3 h-3" />}
                                Sync Cloud
                            </button>
                        </div>
                    </div>
                    <div className="max-w-screen-2xl mx-auto flex gap-4 overflow-x-auto px-6 md:px-12 lg:px-20 xl:px-28 pb-6 pt-2 snap-x hide-scrollbar">
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

                        {unifiedRealms.map(realm => (
                            <div 
                                key={realm.id} 
                                className="w-36 md:w-44 aspect-[2/3] shrink-0 snap-start relative group rounded-xl overflow-hidden shadow-lg bg-brand-surface border border-brand-primary/30 hover:border-brand-accent hover:shadow-brand-accent/20 transition-all flex flex-col" 
                            >
                                <button
                                    onClick={() => handleRealmSelection(realm)}
                                    className="absolute inset-0 w-full h-full z-0 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-brand-accent rounded-xl"
                                    aria-label={`Select realm ${realm.name}`}
                                >
                                    {/* Placeholder Map/Setting Visual */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/20 via-transparent to-black/90 z-0 text-brand-primary opacity-20 flex items-center justify-center overflow-hidden mix-blend-overlay">
                                        <div className="w-[200%] h-[200%] absolute top-0 -left-1/2 rotate-12 bg-gradient-to-r from-transparent via-brand-text to-transparent blur-3xl opacity-10"></div>
                                    </div>
                                </button>
                                
                                {/* Status Icons & Badges */}
                                <div className="absolute top-2 left-2 z-10 flex gap-1 pointer-events-none">
                                    {(realm.status === 'synced' || realm.status === 'cloud-newer' || realm.status === 'local-newer') && (
                                        <div className={`p-1.5 rounded-full backdrop-blur-md shadow-sm border border-brand-surface/20 ${realm.status === 'synced' ? 'bg-brand-accent/20 text-brand-accent' : (realm.status === 'cloud-newer' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400')}`} title={realm.status === 'synced' ? 'Synced to Cloud' : (realm.status === 'cloud-newer' ? 'Cloud version is newer' : 'Local changes not yet synced')}>
                                            <Icon name="cloud" className="w-3 h-3" />
                                        </div>
                                    )}
                                    {realm.status === 'cloud-only' && (
                                        <div className="bg-brand-primary/80 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold text-brand-text/70 border border-brand-surface shadow-sm">
                                            Cloud Only
                                        </div>
                                    )}
                                </div>

                                <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    {(realm.status === 'local-only' || realm.status === 'local-newer') && (
                                        <button 
                                            disabled={syncingRealms[realm.id] === 'loading'}
                                            onClick={(e) => { e.stopPropagation(); handleUploadToCloud(realm); }} 
                                            className={`p-2 rounded-full backdrop-blur-md transition-all shadow-md transform hover:scale-110 ${syncingRealms[realm.id] === 'synced' ? 'bg-brand-accent text-black' : 'bg-black/60 text-brand-text-muted hover:bg-brand-accent/20 hover:text-brand-accent'}`}
                                            title={syncingRealms[realm.id] === 'synced' ? 'Synced' : 'Backup to Cloud'}
                                        >
                                            {syncingRealms[realm.id] === 'loading' ? (
                                                <Icon name="spinner" className="w-4 h-4 animate-spin text-brand-accent" />
                                            ) : syncingRealms[realm.id] === 'synced' ? (
                                                <Icon name="check" className="w-4 h-4" />
                                            ) : (
                                                <Icon name="upload" className="w-4 h-4" />
                                            )}
                                        </button>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRealm(realm); }} 
                                        className="bg-black/60 hover:bg-brand-danger/20 text-brand-text-muted hover:text-brand-danger p-2 rounded-full backdrop-blur-md transition-all shadow-md transform hover:scale-110"
                                        title="Delete Realm Everywhere"
                                    >
                                        <Icon name="trash" className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="mt-auto p-4 z-10 w-full flex flex-col relative pointer-events-none">
                                    <h5 className="text-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors leading-tight mb-1 shadow-black drop-shadow-md"> {realm.name}</h5>
                                    
                                    <div className="flex flex-col mb-3 shadow-black drop-shadow-md">
                                        <p className="text-[9px] text-brand-accent/70 font-bold inter mb-0.5">
                                            {formatRelativeTime(realm.local?.updatedAt || realm.cloud?.updatedAt || 0)}
                                        </p>
                                        <p className="text-[10px] text-brand-text-muted font-medium">
                                            {realm.local?.updatedAt ? `Saved ${new Date(realm.local.updatedAt).toLocaleDateString()}` : `Cloud Save ${new Date(realm.cloud?.updatedAt || 0).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                    <div className="w-full bg-brand-accent text-black font-bold text-xs py-2 rounded flex items-center justify-center gap-1 opacity-100 md:opacity-0 md:translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 shadow-xl transition-all duration-300">
                                        {isRestoringCloud && (realm.status === 'cloud-only' || realm.status === 'cloud-newer') ? (
                                            <Icon name="spinner" className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <><Icon name="play" className="w-3 h-3" /> {realm.status === 'cloud-only' ? 'Restore' : 'Play'}</>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

            </main>

            <Modal isOpen={isCreateModalOpen} onClose={() => !isGenerating && setIsCreateModalOpen(false)} hideHeader={true} title="">
                {isGenerating ? (
                    <CharacterCreationLoader 
                        title="Forging World..." 
                        step={generationStep} 
                        progress={progress} 
                        onCancel={() => {
                            if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
                            setIsGenerating(false);
                        }}
                    />
                ) : previewData ? (
                    <div className="space-y-8 animate-page py-2">
                        <div className="bg-brand-primary/20 p-5 rounded-2xl border border-brand-surface shadow-inner">
                            <h5 className="text-brand-text mb-2 font-bold inter"> The World of {worldName}</h5>
                            <p className="text-body-base text-brand-text leading-relaxed whitespace-pre-wrap font-medium opacity-90">{previewData.context}</p>
                        </div>

                        <div>
                            <h5 className="px-1 mb-4 font-bold inter"> Ancestry Registry</h5>
                            <div className="space-y-3">
                                {previewData.races.map((race, i) => (
                                    <div key={i} className="bg-brand-surface/40 p-4 rounded-xl border border-brand-primary/50">
                                        <h5 className="font-bold text-brand-text text-sm mb-1">{race.name}</h5>
                                        <p className="text-body-sm text-brand-text mb-2 leading-relaxed italic">{race.description}</p>
                                        <div className="grid grid-cols-1 gap-2 mb-3">
                                            <p className="text-[11px]"><span className="font-bold text-brand-text-muted">Appearance:</span> <span className="text-brand-text">{race.appearance}</span></p>
                                            <p className="text-[11px]"><span className="font-bold text-brand-text-muted">Qualities:</span> <span className="text-brand-text">{race.qualities}</span></p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/5 px-2 py-0.5 rounded-lg border border-brand-accent/10">Faction: {race.faction || 'Neutral'}</span>
                                            {race.racialTrait && (
                                                <span className="text-[10px] font-bold text-brand-text-muted bg-brand-primary/20 px-2 py-0.5 rounded-lg border border-brand-primary/30 flex items-center gap-1">
                                                    <Icon name="sparkles" className="w-2.5 h-2.5" />
                                                    {race.racialTrait.name} (+2 {race.racialTrait.buffs?.[0]?.abilityName})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h5 className="px-1 mb-4 font-bold inter"> Major Factions</h5>
                            <div className="space-y-4">
                                {previewData.factions.map((faction, i) => (
                                    <div key={i} className="bg-brand-primary/10 p-5 rounded-2xl border border-brand-surface">
                                        <h5 className="font-bold text-brand-text text-sm mb-2">{faction.name}</h5>
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
                    <div className="space-y-6 animate-page py-2">
                        {/* Wizard Progress Bar */}
                        <div className="flex justify-between items-center mb-8 px-2 gap-2 flex-shrink-0">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <div key={s} className="flex-1">
                                    <div 
                                        className={`h-1 w-full rounded-full transition-all duration-500 ${
                                            wizardStep >= s 
                                                ? 'bg-brand-accent' 
                                                : 'bg-brand-primary'
                                        }`} 
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Choices Chosen Summary */}
                        {(setting || selectedThemes.length > 0 || (wizardStep >= 3 && (numRaces > 0 || numFactions > 0))) && (
                            <div className="mb-6 px-4 animate-fade-in grid grid-cols-2 gap-6 border-b border-brand-primary/20 pb-6 max-w-4xl mx-auto w-full">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-brand-text-muted opacity-60 inter ml-0.5">Foundations</label>
                                        <div className="flex flex-wrap gap-2">
                                            {setting && (
                                                <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-brand-accent/20 bg-brand-accent/5 text-brand-accent shadow-sm">
                                                    {setting}
                                                </span>
                                            )}
                                            {selectedThemes.map(theme => (
                                                <span key={theme} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-brand-surface bg-brand-primary/30 text-brand-text-muted">
                                                    {theme}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {wizardStep >= 3 && (numRaces > 0 || numFactions > 0) && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-brand-text-muted opacity-60 inter ml-0.5">Composition</label>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-brand-surface bg-brand-primary/30 text-brand-text-muted">
                                                    {numRaces} Species
                                                </span>
                                                <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-brand-surface bg-brand-primary/30 text-brand-text-muted">
                                                    {numFactions} Powers
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                             {wizardStep === 1 && (
                                <div className="space-y-6 animate-page">
                                    <div className="text-center space-y-2 mb-8">
                                        <h4 className="text-2xl font-bold text-brand-text inter">Core Theme</h4>
                                        <p className="text-sm text-brand-text-muted italic inter">Choose the main genre and setting for your new world.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
                                        {SETTINGS.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => { setSetting(s); }}
                                                type="button"
                                                className={`group relative aspect-video rounded-3xl overflow-hidden border-2 transition-all duration-500 ${
                                                    setting === s 
                                                        ? 'border-brand-accent shadow-[0_0_20px_rgba(62,207,142,0.3)] scale-[1.02]' 
                                                        : 'border-brand-primary/30 hover:border-brand-accent/50'
                                                }`}
                                            >
                                                {/* Background Image */}
                                                <div 
                                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                                    style={{ backgroundImage: `url('${SETTING_IMAGES[s]}')` }}
                                                />
                                                {/* Overlay */}
                                                <div className={`absolute inset-0 transition-opacity duration-300 ${setting === s ? 'bg-brand-accent/20' : 'bg-black/40 group-hover:bg-black/20'}`} />
                                                
                                                {/* Centered Label Button */}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className={`px-5 py-2 rounded-full font-bold text-sm backdrop-blur-md border transition-all duration-300 ${
                                                        setting === s 
                                                            ? 'bg-brand-accent text-black border-brand-accent shadow-lg' 
                                                            : 'bg-brand-bg/80 text-brand-text border-white/10 group-hover:border-brand-accent/50 group-hover:text-brand-accent'
                                                    }`}>
                                                        {s}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {setting && (
                                        <div className="mt-8 space-y-6 animate-fade-in max-w-4xl mx-auto px-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-px flex-1 bg-brand-primary/10"></div>
                                                <h4 className="text-xl font-bold text-brand-text inter shrink-0">Archetype & Skills</h4>
                                                <div className="h-px flex-1 bg-brand-primary/10"></div>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                                                {Object.entries(SKILL_DEFINITIONS)
                                                    .filter(([_, def]) => def.usedIn === 'All' || (Array.isArray(def.usedIn) && (def.usedIn as any).includes(setting)))
                                                    .map(([name]) => (
                                                        <span key={name} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-brand-accent/20 bg-brand-accent/5 text-brand-accent shadow-sm animate-fade-in">
                                                            {name}
                                                        </span>
                                                    ))}
                                            </div>
                                            <p className="text-center text-[11px] text-brand-text-muted italic">
                                                These skills will form the fundamental ruleset for the {setting} setting.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {wizardStep === 2 && (
                                <div className="space-y-6 animate-page">
                                    <div className="text-center space-y-2 mb-8">
                                        <h4 className="text-2xl font-bold text-brand-text inter">World Traits</h4>
                                        <p className="text-sm text-brand-text-muted italic inter">Pick special features and unique traits for your realm.</p>
                                    </div>
                                    
                                    <div className="max-w-4xl mx-auto space-y-8 w-full">
                                        {/* Active Threads (Selected) */}
                                        {selectedThemes.length > 0 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <label className="text-[10px] font-bold text-brand-accent ml-1">Active Threads ({selectedThemes.length}/3)</label>
                                                <div className="flex flex-wrap gap-2 p-4 bg-brand-accent/5 rounded-2xl border border-brand-accent/20">
                                                    {selectedThemes.map(theme => (
                                                        <button
                                                            key={theme}
                                                            onClick={() => handleThemeToggle(theme)}
                                                            type="button"
                                                            className="btn-primary btn-sm rounded-full flex items-center gap-2 group pr-3 transition-all animate-bounce-subtle"
                                                        >
                                                            {theme}
                                                            <Icon name="close" className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Available Threads */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold text-brand-text-muted ml-1">Available Threads</label>
                                            <div className="flex flex-wrap gap-2">
                                                {(GENRE_THEMES[setting] || []).filter(t => !selectedThemes.includes(t)).map(theme => (
                                                    <button
                                                        key={theme}
                                                        onClick={() => handleThemeToggle(theme)}
                                                        type="button"
                                                        disabled={selectedThemes.length >= 3}
                                                        className={`btn-sm rounded-lg transition-all ${
                                                            selectedThemes.length >= 3 
                                                                ? 'btn-secondary opacity-30 cursor-not-allowed' 
                                                                : 'btn-secondary opacity-60 hover:opacity-100 hover:border-brand-accent/50'
                                                        }`}
                                                    >
                                                        {theme}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-brand-primary/10 p-4 rounded-xl border border-brand-primary/20 mt-4">
                                            <p className="text-[10px] text-brand-text-muted italic inter">Note: Select up to 3 threads. Conflicting themes like High-Magic and No-Magic will automatically adjust.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 3 && (
                                <div className="space-y-8 animate-page">
                                    <div className="text-center space-y-2 mb-8">
                                        <h4 className="text-2xl font-bold text-brand-text inter">Races & Factions</h4>
                                        <p className="text-sm text-brand-text-muted italic inter">Set the number of species and powerful groups in your world.</p>
                                    </div>
                                    
                                    <div className="space-y-10 max-w-2xl mx-auto w-full px-4">
                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center ml-1">
                                                    <label className="text-sm font-bold text-brand-text">Major Ancestries</label>
                                                    <span className="text-[10px] font-bold text-brand-accent px-3 py-1.5 rounded-lg border border-brand-accent/20 bg-brand-accent/5 shadow-sm">{numRaces} Species</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="1" max="10"
                                                    value={numRaces}
                                                    onChange={(e) => setNumRaces(parseInt(e.target.value))}
                                                    className="w-full accent-brand-accent bg-brand-primary h-1.5 rounded-full appearance-none cursor-pointer"
                                                />
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3 animate-fade-in">
                                                {Array.from({ length: numRaces }).map((_, i) => (
                                                    <input
                                                        key={`race-${i}`}
                                                        value={raceNames[i]}
                                                        onChange={(e) => {
                                                            const newNames = [...raceNames];
                                                            newNames[i] = e.target.value;
                                                            setRaceNames(newNames);
                                                        }}
                                                        placeholder={`Species ${i + 1} Name...`}
                                                        className="bg-brand-primary/40 border border-brand-surface rounded-xl px-4 py-2 text-xs focus:border-brand-accent focus:outline-none transition-all placeholder:text-brand-text-muted/40"
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center ml-1">
                                                    <label className="text-sm font-bold text-brand-text">Major Factions</label>
                                                    <span className="text-[10px] font-bold text-brand-accent px-3 py-1.5 rounded-lg border border-brand-accent/20 bg-brand-accent/5 shadow-sm">{numFactions} Powers</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="1" max="10"
                                                    value={numFactions}
                                                    onChange={(e) => setNumFactions(parseInt(e.target.value))}
                                                    className="w-full accent-brand-accent bg-brand-primary h-1.5 rounded-full appearance-none cursor-pointer"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 animate-fade-in">
                                                {Array.from({ length: numFactions }).map((_, i) => (
                                                    <input
                                                        key={`faction-${i}`}
                                                        value={factionNames[i]}
                                                        onChange={(e) => {
                                                            const newNames = [...factionNames];
                                                            newNames[i] = e.target.value;
                                                            setFactionNames(newNames);
                                                        }}
                                                        placeholder={`Faction ${i + 1} Name...`}
                                                        className="bg-brand-primary/40 border border-brand-surface rounded-xl px-4 py-2 text-xs focus:border-brand-accent focus:outline-none transition-all placeholder:text-brand-text-muted/40"
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-brand-accent/5 border border-brand-accent/10 p-4 rounded-2xl">
                                            <p className="text-[11px] text-brand-text-muted italic inter leading-relaxed">
                                                <span className="text-brand-accent font-bold not-italic">Architect's Note:</span> Any names left blank will be filled with thematic lore matches by the AI architect to complete the world's vision.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 4 && (
                                <div className="space-y-6 animate-page">
                                    <div className="text-center space-y-2 mb-8">
                                        <h4 className="text-2xl font-bold text-brand-text inter">World Details</h4>
                                        <p className="text-sm text-brand-text-muted italic inter">Set the starting time and add any extra details for the world.</p>
                                    </div>
                                    
                                    <div className="max-w-3xl mx-auto w-full space-y-6 px-4">
                                        <div className="grid grid-cols-2 gap-4 bg-brand-primary/10 p-5 rounded-2xl border border-brand-primary/30 mb-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-brand-text-muted ml-0.5">Starting Date</label>
                                                <input
                                                    type="date"
                                                    value={startingDate}
                                                    onChange={(e) => setStartingDate(e.target.value)}
                                                    className="w-full bg-brand-primary h-10 rounded-lg text-xs px-3 border border-brand-surface focus:outline-none focus:border-brand-accent text-brand-text"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-brand-text-muted ml-0.5">Time</label>
                                                <input
                                                    type="time"
                                                    value={startingTime}
                                                    onChange={(e) => setStartingTime(e.target.value)}
                                                    className="w-full bg-brand-primary h-10 rounded-lg text-xs px-3 border border-brand-surface focus:outline-none focus:border-brand-accent text-brand-text"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-brand-text-muted ml-1">Architectural Context</label>
                                            <textarea
                                                value={additionalContext}
                                                onChange={(e) => setAdditionalContext(e.target.value)}
                                                placeholder="Provide specific details for the architect... e.g. Single giant city, Floating islands, or Low magic technology..."
                                                className="w-full bg-brand-primary p-4 rounded-2xl border border-brand-surface focus:border-brand-accent focus:outline-none h-32 text-sm leading-relaxed text-brand-text"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 5 && (
                                <div className="space-y-6 animate-page">
                                    <div className="text-center space-y-2 mb-8">
                                        <h4 className="text-2xl font-bold text-brand-text inter">World Name</h4>
                                        <p className="text-sm text-brand-text-muted italic inter">Give your world a name to begin your adventure.</p>
                                    </div>
                                    
                                    <div className="max-w-2xl mx-auto w-full space-y-8 py-4 px-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-brand-text-muted ml-1">Realm Name</label>
                                            <input
                                                ref={worldNameInputRef}
                                                value={worldName}
                                                onChange={(e) => setWorldName(e.target.value)}
                                                placeholder="e.g. Eldoria, Neo-Tokyo, Sector 7..."
                                                className="w-full bg-brand-primary h-14 px-6 rounded-2xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-lg font-bold text-brand-text"
                                            />
                                        </div>

                                        {error && <p className="text-brand-danger text-body-sm text-center font-bold animate-pulse">{error}</p>}
                                    </div>
                                </div>
                            )}
                        </div>

                         {/* Wizard Navigation Footer */}
                        <div className="pt-8 flex items-center justify-center gap-4 border-t border-brand-primary/10 mt-8">
                            <button 
                                onClick={() => setWizardStep(s => Math.max(1, s - 1))}
                                className={`btn-secondary btn-md rounded-full px-8 transition-all ${wizardStep === 1 ? 'invisible' : ''}`}
                            >
                                Back
                            </button>
                            
                            {wizardStep < 5 ? (
                                <button
                                    onClick={() => setWizardStep(s => s + 1)}
                                    disabled={wizardStep === 1 && !setting}
                                    className={`btn-primary btn-md flex-1 rounded-full shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-3 transition-all ${wizardStep === 1 && !setting ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                >
                                    Next Step
                                    <Icon name="chevronDown" className="w-4 h-4 -rotate-90" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleGeneratePreview}
                                    disabled={!worldName.trim() || isGenerating}
                                    className="btn-primary btn-md flex-1 rounded-full shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-3 transition-all"
                                >
                                    {isGenerating ? (
                                        <><Icon name="spinner" className="w-4 h-4 animate-spin" /> Casting Seeds...</>
                                    ) : (
                                        <><Icon name="play" className="w-4 h-4" /> Breathe Life into Realm</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default WorldSelection;

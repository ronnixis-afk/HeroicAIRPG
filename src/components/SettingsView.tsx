// components/SettingsView.tsx

import React, { useState, useContext, useEffect, useMemo } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import type { NarrationTone, NarrationVoice, ImageGenerationStyle, Difficulty, MapSettings, SkillConfiguration } from '../types';
import { Icon } from './Icon';
import { NARRATION_TONES, IMAGE_GENERATION_STYLES, DIFFICULTIES } from '../constants';
import { NARRATION_VOICES, SKILL_DEFINITIONS, SKILL_NAMES } from '../types';
import { parseGameTime, formatGameTime } from '../utils/timeUtils';
import { worldService } from '../services/worldService';
import { cloudSaveService, CloudSaveMetadata } from '../services/cloudSaveService';
import { downloadAsTxt, DOCUMENTATION_FILES } from '../utils/documentation';
import Modal from './Modal';

// --- Helper Components ---

const SelectField: React.FC<{ label: string, value: string, options: readonly string[] | string[], onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }> = ({ label, value, options, onChange }) => (
    <div>
        <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">{label}</label>
        <div className="relative">
            <select value={value} onChange={onChange} className="w-full bg-brand-primary h-11 pl-4 pr-10 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent appearance-none text-body-base shadow-inner">
                {options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-text-muted">
                <Icon name="chevronDown" className="w-4 h-4" />
            </div>
        </div>
    </div>
);

const ToggleSwitch: React.FC<{ label: string, enabled: boolean, onChange: (enabled: boolean) => void, description?: string }> = ({ label, enabled, onChange, description }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className="w-full flex items-center justify-between p-4 bg-brand-surface rounded-2xl transition-all select-none border border-brand-primary shadow-sm hover:border-brand-accent/20 group relative">
            <div className="flex items-center gap-2 pr-4 flex-1">
                <span className="text-body-base font-bold text-brand-text group-hover:text-brand-accent transition-colors">{label}</span>
                {description && (
                    <div className="relative flex items-center">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }}
                            onMouseEnter={() => setShowTooltip(true)}
                            onMouseLeave={() => setShowTooltip(false)}
                            className="text-brand-text-muted hover:text-brand-accent transition-colors p-1 rounded-full hover:bg-brand-primary/50"
                            aria-label={`Info about ${label}`}
                        >
                            <Icon name="info" className="w-4 h-4 opacity-60" />
                        </button>
                        {showTooltip && (
                            <div className="absolute left-0 bottom-full mb-3 w-64 bg-brand-surface-raised text-brand-text text-body-sm p-4 rounded-2xl shadow-2xl border border-brand-primary z-[100] animate-page leading-relaxed font-normal pointer-events-auto">
                                {description}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => onChange(!enabled)}
                className={`${enabled ? 'bg-brand-accent' : 'bg-brand-primary'
                    } relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner`}
                role="switch"
                aria-checked={enabled}
            >
                <span
                    aria-hidden="true"
                    className={`${enabled ? 'translate-x-5' : 'translate-x-0'
                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
            </button>
        </div>
    );
};

const StorageMeter: React.FC<{ used: number; limit: number }> = ({ used, limit }) => {
    const usedMb = (used / (1024 * 1024)).toFixed(2);
    const limitMb = (limit / (1024 * 1024)).toFixed(1);
    const percentage = limit > 0 ? (used / limit) * 100 : 0;

    let barColor = 'bg-brand-accent';
    if (percentage > 90) {
        barColor = 'bg-brand-danger';
    } else if (percentage > 70) {
        barColor = 'bg-yellow-500';
    }

    return (
        <div className="px-1">
            <div className="flex justify-between items-center text-body-sm text-brand-text-muted mb-2">
                <span className="font-bold">Storage capacity</span>
                <span className="font-medium">{usedMb} Mb / {limitMb} Mb</span>
            </div>
            <div className="w-full bg-brand-primary rounded-full h-2 overflow-hidden border border-brand-surface shadow-inner">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

const TabButton: React.FC<{ label: string, isActive: boolean, onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex-1 h-11 px-4 rounded-xl text-body-sm font-bold transition-all duration-200 focus:outline-none ${isActive
                ? 'bg-brand-surface text-brand-accent shadow-sm'
                : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-primary/50'
            }`}
    >
        {label}
    </button>
);

const SettingsView: React.FC = () => {
    const {
        gameData,
        updateGmSettings,
        switchWorld,
        resetWorld,
        updateNarrationVoice,
        updateNarrationTone,
        updateImageGenerationStyle,
        updateIsMature,
        updateIsHandsFree,
        updateUseAiTts,
        updateCurrentTime,
        storageUsage,
        updateDifficulty,
        worldId,
        updateMapSettings,
        updateSkillConfiguration,
        updateCombatConfiguration
    } = useContext(GameDataContext);

    const [activeTab, setActiveTab] = useState<'gameplay' | 'system'>('gameplay');
    const [settings, setSettings] = useState('');
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);
    const [dateInput, setDateInput] = useState('');
    const [timeInput, setTimeInput] = useState('');
    const [isSavingTime, setIsSavingTime] = useState(false);
    const [saveTimeSuccess, setSaveTimeSuccess] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);

    // --- Cloud Save State ---
    const [cloudSaves, setCloudSaves] = useState<CloudSaveMetadata[]>([]);
    const [isFetchingSaves, setIsFetchingSaves] = useState(false);
    const [isSyncingCloud, setIsSyncingCloud] = useState(false);
    const [cloudMessage, setCloudMessage] = useState('');

    // Safe Access for Configuration (Defaults if undefined in older saves)
    const combatConfig = useMemo(() => {
        return gameData?.combatConfiguration || { aiNarratesTurns: true, manualCompanionControl: false, aiGeneratesLoot: true, smarterGm: true, fasterGm: false, narrativeCombat: false, autoIncludeNearbyNpcs: true };
    }, [gameData]);

    useEffect(() => {
        if (gameData) {
            setSettings(gameData.gmSettings || '');
            const currentDate = parseGameTime(gameData.currentTime);
            if (currentDate) {
                setDateInput(formatDateForInput(currentDate));
                setTimeInput(formatTimeForInput(currentDate));
            }
        }
    }, [gameData]);

    useEffect(() => {
        if (activeTab === 'system') {
            fetchCloudSaves();
        }
    }, [activeTab]);

    const fetchCloudSaves = async () => {
        setIsFetchingSaves(true);
        try {
            const saves = await cloudSaveService.fetchCloudSavesMetadata();
            setCloudSaves(saves);
        } catch (err) {
            console.error("Failed to load cloud saves", err);
        } finally {
            setIsFetchingSaves(false);
        }
    };

    const handleCloudBackup = async () => {
        if (!gameData || isSyncingCloud) return;
        setIsSyncingCloud(true);
        setCloudMessage('Uploading save data to cloud...');
        try {
            // Save local first to ensure we have the very latest data explicitly
            await worldService.saveGameData(worldId, gameData);

            const world = await worldService.getWorldById(worldId);
            if (world) {
                await cloudSaveService.pushSaveToCloud(worldId, world.name, world.gameData);
                setCloudMessage('Backup successful!');
                await fetchCloudSaves(); // refresh list
            }
        } catch (err: any) {
            setCloudMessage(`Backup failed: ${err.message}`);
        } finally {
            setIsSyncingCloud(false);
            setTimeout(() => setCloudMessage(''), 3000);
        }
    };

    const handleCloudRestore = async (saveId: string) => {
        if (isSyncingCloud) return;
        if (!window.confirm("Warning: Restoring this cloud save will completely overwrite your current local progress for this world. Proceed?")) return;

        setIsSyncingCloud(true);
        setCloudMessage('Downloading save data from cloud...');
        try {
            const result = await cloudSaveService.fetchCloudSaveContext(saveId);

            // Overwrite into IndexedDB
            await worldService.saveGameData(worldId, result.data);

            setCloudMessage('Restore successful! Reloading...');

            // Force reload to pick up new state easily
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err: any) {
            setCloudMessage(`Restore failed: ${err.message}`);
            setIsSyncingCloud(false);
            setTimeout(() => setCloudMessage(''), 3000);
        }
    };

    const formatDateForInput = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatTimeForInput = (date: Date): string => {
        return date.toTimeString().slice(0, 5);
    };

    const uniqueSkills = useMemo(() => {
        if (!gameData) return '';
        const config = gameData.skillConfiguration || 'Fantasy';
        return SKILL_NAMES.filter(s => {
            const def = SKILL_DEFINITIONS[s];
            return def.usedIn !== 'All' && def.usedIn.includes(config);
        }).join(', ');
    }, [gameData]);

    if (!gameData) return <div className="text-center p-8 animate-pulse text-brand-text-muted">Loading settings...</div>;

    const isSettingsDirty = settings !== (gameData.gmSettings || '');
    const initialDate = parseGameTime(gameData.currentTime);
    const isTimeDirty = initialDate
        ? dateInput !== formatDateForInput(initialDate) || timeInput !== formatTimeForInput(initialDate)
        : false;

    const handleSaveSettings = async () => {
        if (!isSettingsDirty) return;
        setIsSavingSettings(true);
        setSaveSettingsSuccess(false);
        await updateGmSettings(settings);
        setIsSavingSettings(false);
        setSaveSettingsSuccess(true);
        setTimeout(() => setSaveSettingsSuccess(false), 2000);
    };

    const handleUpdateTime = () => {
        if (!isTimeDirty || isSavingTime) return;
        setIsSavingTime(true);
        setSaveTimeSuccess(false);
        try {
            const newDate = new Date(`${dateInput}T${timeInput}`);
            if (!isNaN(newDate.getTime())) {
                const newTimeFormatted = formatGameTime(newDate);
                updateCurrentTime(newTimeFormatted);
                setSaveTimeSuccess(true);
                setTimeout(() => setSaveTimeSuccess(false), 2000);
            }
        } catch (error) {
            console.error("Failed to update time", error);
        } finally {
            setIsSavingTime(false);
        }
    };

    const handleResetWorld = () => {
        if (window.confirm("Are you sure? All character progress, inventory, and story logs will be permanently deleted. World lore and Gm settings will be kept.")) {
            resetWorld();
            setResetSuccess(true);
            setTimeout(() => setResetSuccess(false), 3000);
        }
    };

    const handleExportWorld = () => {
        worldService.exportWorldById(worldId);
    };

    const handleCombinedConfigChange = (config: SkillConfiguration) => {
        updateSkillConfiguration(config);

        let mapUpdate: MapSettings;
        let yearOffset = 0;

        if (config === 'Fantasy') {
            mapUpdate = { style: 'fantasy', gridUnit: 'Miles', gridDistance: 24, zoneLabel: 'Region' };
            yearOffset = -1500;
        } else if (config === 'Modern') {
            mapUpdate = { style: 'modern', gridUnit: 'Km', gridDistance: 2, zoneLabel: 'District' };
            yearOffset = 0;
        } else { // Sci-Fi and Magitech
            mapUpdate = { style: 'sci-fi', gridUnit: 'Light Years', gridDistance: 5, zoneLabel: 'System' };
            yearOffset = 1000;
        }

        const now = new Date();
        now.setFullYear(now.getFullYear() + yearOffset);
        updateCurrentTime(formatGameTime(now));
        updateMapSettings(mapUpdate);
    };

    return (
        <div className="p-2 pt-8 max-w-2xl mx-auto pb-24">
            <h1 className="text-center mb-2">Settings</h1>
            <p className="text-center text-brand-text-muted mb-10 text-body-base font-medium italic">Configure your adventure and game system.</p>

            <div className="flex justify-center mb-10 bg-brand-primary p-1 rounded-2xl w-full max-w-xs mx-auto border border-brand-surface shadow-sm">
                <TabButton label="Gameplay" isActive={activeTab === 'gameplay'} onClick={() => setActiveTab('gameplay')} />
                <TabButton label="System" isActive={activeTab === 'system'} onClick={() => setActiveTab('system')} />
            </div>

            <div className="overflow-y-auto custom-scroll pr-1">
                {activeTab === 'gameplay' && (
                    <div className="space-y-6 animate-fade-in pb-10">
                        <ToggleSwitch
                            label="Hands-Free Mode"
                            enabled={gameData.isHandsFree || false}
                            onChange={(val) => updateIsHandsFree(val)}
                            description="Adapts the UI for voice interaction and auto-reads AI responses. In this mode, the Game Master will describe combat turns with brutal, visceral realism."
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-brand-primary/20">
                            <SelectField label="Image generation style" value={gameData.imageGenerationStyle} onChange={(e) => updateImageGenerationStyle(e.target.value as ImageGenerationStyle)} options={[...IMAGE_GENERATION_STYLES]} />
                            <SelectField label="Narration voice" value={gameData.narrationVoice || ''} onChange={(e) => updateNarrationVoice(e.target.value as NarrationVoice)} options={[...NARRATION_VOICES]} />
                        </div>

                        <div className="pt-8 border-t border-brand-primary/20">
                            <h3 className="text-center mb-6">Skill and Map Configuration</h3>
                            <div className="bg-brand-primary/10 p-6 rounded-3xl border border-brand-surface shadow-inner">
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {['Fantasy', 'Modern', 'Sci-Fi', 'Magitech'].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => handleCombinedConfigChange(s as SkillConfiguration)}
                                            className={`h-11 rounded-xl text-body-sm font-bold border transition-all capitalize ${gameData.skillConfiguration === s
                                                    ? 'bg-brand-accent text-black border-brand-accent shadow-sm'
                                                    : 'bg-brand-surface text-brand-text-muted border-brand-primary hover:border-brand-accent/30'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                                {uniqueSkills && (
                                    <div className="bg-brand-bg/40 p-4 rounded-xl border border-brand-surface mb-6">
                                        <p className="text-[10px] text-brand-accent leading-relaxed text-center font-bold">
                                            <span className="text-brand-text-muted mr-1">Unique Skills:</span>
                                            {uniqueSkills}
                                        </p>
                                    </div>
                                )}
                                <div className="grid grid-cols-3 gap-4 pt-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-brand-text-muted mb-2 ml-1 uppercase-none">Zone name</label>
                                        <input
                                            value={gameData.mapSettings?.zoneLabel || 'Region'}
                                            onChange={e => updateMapSettings({ ...gameData.mapSettings!, zoneLabel: e.target.value, style: 'custom' })}
                                            className="w-full bg-brand-surface h-11 border border-brand-primary rounded-xl px-4 text-body-sm focus:outline-none focus:border-brand-accent shadow-inner font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-brand-text-muted mb-2 ml-1 uppercase-none">Grid size</label>
                                        <input
                                            type="number"
                                            value={gameData.mapSettings?.gridDistance || 24}
                                            onChange={e => updateMapSettings({ ...gameData.mapSettings!, gridDistance: parseInt(e.target.value) || 1, style: 'custom' })}
                                            className="w-full bg-brand-surface h-11 border border-brand-primary rounded-xl px-4 text-body-sm focus:outline-none focus:border-brand-accent shadow-inner font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-brand-text-muted mb-2 ml-1 uppercase-none">Unit</label>
                                        <input
                                            value={gameData.mapSettings?.gridUnit || 'Miles'}
                                            onChange={e => updateMapSettings({ ...gameData.mapSettings!, gridUnit: e.target.value, style: 'custom' })}
                                            className="w-full bg-brand-surface h-11 border border-brand-primary rounded-xl px-4 text-body-sm focus:outline-none focus:border-brand-accent shadow-inner font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-brand-primary/20 space-y-4">
                            <h3 className="text-center mb-4">Advanced Rules</h3>
                            <ToggleSwitch
                                label="Auto-include Nearby NPCs"
                                enabled={combatConfig.autoIncludeNearbyNpcs}
                                onChange={(val) => updateCombatConfiguration({ ...combatConfig, autoIncludeNearbyNpcs: val })}
                                description="Automatically pulls local characters into active combat based on proximity."
                            />
                            <ToggleSwitch
                                label="Smarter AI Game Master"
                                enabled={combatConfig.smarterGm}
                                onChange={(val) => updateCombatConfiguration({ ...combatConfig, smarterGm: val })}
                                description="Utilizes advanced tiered context injection for higher narrative continuity."
                            />
                            <ToggleSwitch
                                label="Faster AI Game Master"
                                enabled={combatConfig.fasterGm}
                                onChange={(val) => updateCombatConfiguration({ ...combatConfig, fasterGm: val })}
                                description="Switches to high-speed models for lower latency during interaction loops."
                            />
                            <ToggleSwitch
                                label="Use Gemini Neural TTS"
                                enabled={gameData.useAiTts || false}
                                onChange={(val) => updateUseAiTts(val)}
                                description="Generates high-fidelity neural speech. Adopts a dramatic storyteller persona."
                            />
                            <ToggleSwitch
                                label="Narrative Combat"
                                enabled={combatConfig.narrativeCombat}
                                onChange={(val) => updateCombatConfiguration({
                                    ...combatConfig,
                                    narrativeCombat: val,
                                    aiNarratesTurns: val ? false : combatConfig.aiNarratesTurns
                                })}
                                description="Prioritizes cinematic round summaries over strict turn-by-turn mechanics."
                            />
                            <ToggleSwitch
                                label="AI Narrates Combat Turns"
                                enabled={combatConfig.aiNarratesTurns}
                                onChange={(val) => updateCombatConfiguration({
                                    ...combatConfig,
                                    aiNarratesTurns: val,
                                    narrativeCombat: val ? false : combatConfig.narrativeCombat
                                })}
                                description="The AI describes every combat action as it occurs."
                            />
                            <ToggleSwitch
                                label="AI Generates Loot"
                                enabled={combatConfig.aiGeneratesLoot}
                                onChange={(val) => updateCombatConfiguration({ ...combatConfig, aiGeneratesLoot: val })}
                                description="Skins and names loot immediately after victory. Otherwise, appraisal is required."
                            />
                            <ToggleSwitch
                                label="Companion Manual Control"
                                enabled={combatConfig.manualCompanionControl}
                                onChange={(val) => updateCombatConfiguration({ ...combatConfig, manualCompanionControl: val })}
                                description="Enables manual control over your allies' combat turns instead of the AI auto-playing them."
                            />
                            <ToggleSwitch
                                label="Mature Content"
                                enabled={gameData.isMature}
                                onChange={updateIsMature}
                                description="Allows the AI to describe adult themes, graphic violence, and visceral situations."
                            />
                        </div>

                        <div className="pt-8 border-t border-brand-primary/20">
                            <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Gm directives</label>
                            <p className="text-body-sm text-brand-text-muted mb-3 italic opacity-70 px-1 leading-relaxed">Permanent instructions for the Ai Game Master (e.g., tone, rules, or world quirks).</p>
                            <textarea value={settings} onChange={(e) => setSettings(e.target.value)} rows={6} className="w-full bg-brand-primary p-4 rounded-2xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base leading-relaxed shadow-inner" />
                            <div className="flex justify-center items-center h-14 mt-4">
                                {isSettingsDirty && !isSavingSettings && !saveSettingsSuccess && (
                                    <button onClick={handleSaveSettings} className="btn-primary btn-md w-full rounded-xl shadow-lg shadow-brand-accent/20">
                                        Save directives
                                    </button>
                                )}
                                {isSavingSettings && <Icon name="spinner" className="w-6 h-6 animate-spin text-brand-accent" />}
                                {saveSettingsSuccess && <div className="text-brand-accent flex items-center font-bold text-body-base animate-fade-in"><Icon name="check" className="w-5 h-5 mr-2" /> Directives saved!</div>}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'system' && (
                    <div className="space-y-10 animate-fade-in pb-10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={handleExportWorld} className="btn-primary btn-md rounded-xl gap-3 shadow-lg shadow-brand-accent/20">
                                <Icon name="download" className="w-5 h-5" />
                                Export world
                            </button>

                            <button onClick={switchWorld} className="btn-secondary btn-md rounded-xl shadow-sm">
                                Switch world
                            </button>
                        </div>

                        {/* Cloud Save Section */}
                        <div className="pt-6 border-t border-brand-primary/20">
                            <h3 className="text-center mb-6 text-brand-accent">Cloud Sync</h3>
                            <div className="bg-brand-primary/10 p-6 rounded-3xl border border-brand-surface shadow-inner flex flex-col gap-4 relative">
                                {isSyncingCloud && (
                                    <div className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl z-10">
                                        <Icon name="spinner" className="w-8 h-8 animate-spin text-brand-accent mb-2" />
                                        <div className="text-brand-text font-bold animate-pulse">{cloudMessage}</div>
                                    </div>
                                )}

                                <div className="flex justify-between items-center bg-brand-surface p-4 rounded-xl border border-brand-primary shadow-sm">
                                    <div>
                                        <h4 className="text-body-base font-bold text-brand-text">Backup Current World</h4>
                                        <p className="text-body-sm text-brand-text-muted mt-1">Uploads your game progress to your account securely.</p>
                                    </div>
                                    <button
                                        onClick={handleCloudBackup}
                                        disabled={isSyncingCloud}
                                        className="btn-primary btn-sm whitespace-nowrap px-6 rounded-lg shadow-md hover:scale-105 transition-transform"
                                    >
                                        <Icon name="upload" className="w-4 h-4 mr-2" /> Backup
                                    </button>
                                </div>

                                {cloudMessage && !isSyncingCloud && (
                                    <div className="text-center text-body-sm font-bold text-brand-accent animate-fade-in py-2">
                                        {cloudMessage}
                                    </div>
                                )}

                                <div>
                                    <div className="flex justify-between items-end mb-3 mt-4">
                                        <h4 className="text-body-sm font-bold text-brand-text-muted ml-1">Available Cloud Backups</h4>
                                        <button onClick={fetchCloudSaves} className="text-brand-accent hover:text-white transition-colors p-1" aria-label="Refresh cloud saves">
                                            <Icon name="refresh" className={`w-4 h-4 ${isFetchingSaves ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>

                                    <div className="bg-brand-primary rounded-xl border border-brand-surface overflow-hidden shadow-inner max-h-48 overflow-y-auto custom-scroll">
                                        {isFetchingSaves && cloudSaves.length === 0 ? (
                                            <div className="p-6 text-center text-brand-text-muted animate-pulse">Loading backups...</div>
                                        ) : cloudSaves.length === 0 ? (
                                            <div className="p-6 text-center text-brand-text-muted italic">No cloud backups found for your account.</div>
                                        ) : (
                                            <div className="divide-y divide-brand-surface">
                                                {cloudSaves.map(save => (
                                                    <div key={save.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-brand-surface/30 transition-colors">
                                                        <div>
                                                            <div className="font-bold text-brand-text text-body-sm">{save.name}</div>
                                                            <div className="text-[10px] text-brand-text-muted mt-1">
                                                                {new Date(save.updatedAt).toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleCloudRestore(save.id)}
                                                            className="btn-secondary btn-sm px-4 rounded-lg self-start sm:self-auto text-brand-accent hover:bg-brand-accent hover:text-black border-brand-accent/30"
                                                        >
                                                            <Icon name="download" className="w-4 h-4 mr-1.5" /> Restore Here
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-brand-primary/20">
                            <StorageMeter used={storageUsage.used} limit={storageUsage.limit} />
                        </div>

                        <div>
                            <h3 className="text-center mb-6">Date and Time Override</h3>
                            <div className="bg-brand-primary/10 p-6 rounded-3xl border border-brand-surface shadow-inner flex flex-col gap-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Date</label>
                                        <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className="w-full bg-brand-primary h-11 px-4 rounded-xl border border-brand-surface focus:border-brand-accent focus:outline-none text-body-sm font-bold shadow-inner" />
                                    </div>
                                    <div>
                                        <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Time</label>
                                        <input type="time" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} className="w-full bg-brand-primary h-11 px-4 rounded-xl border border-brand-surface focus:border-brand-accent focus:outline-none text-body-sm font-bold shadow-inner" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-center">
                                    {isTimeDirty && !isSavingTime && !saveTimeSuccess && (
                                        <button onClick={handleUpdateTime} className="btn-primary btn-md w-full rounded-xl shadow-md">
                                            Apply override
                                        </button>
                                    )}
                                    {isSavingTime && <Icon name="spinner" className="w-6 h-6 animate-spin text-brand-accent" />}
                                    {saveTimeSuccess && <div className="text-brand-accent flex items-center font-bold text-body-base animate-fade-in"><Icon name="check" className="w-5 h-5 mr-2" /> Time updated!</div>}
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-brand-primary/20">
                            <h3 className="text-center mb-6">Documentation</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setIsDocModalOpen(true)}
                                    className="btn-secondary btn-md rounded-xl gap-2 shadow-sm"
                                >
                                    <Icon name="eye" className="w-4 h-4" />
                                    View manual
                                </button>
                                <button
                                    onClick={downloadAsTxt}
                                    className="btn-secondary btn-md rounded-xl gap-2 shadow-sm"
                                >
                                    <Icon name="download" className="w-4 h-4" />
                                    Download txt
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-brand-primary/20 pt-10">
                            <div className="bg-brand-danger/5 border border-brand-danger/20 rounded-3xl p-6 space-y-6">
                                <div className="text-center">
                                    <h3 className="text-brand-danger mb-1 font-black">Danger Zone</h3>
                                    <p className="text-body-sm text-brand-text-muted italic opacity-70">Irreversible actions that modify your save data.</p>
                                </div>
                                <button
                                    onClick={handleResetWorld}
                                    className="btn-md w-full bg-brand-danger/10 border-2 border-brand-danger/30 text-brand-danger font-black rounded-xl hover:bg-brand-danger/20 transition-all active:scale-95"
                                >
                                    Reset world
                                </button>
                                {resetSuccess && <p className="text-brand-accent text-center text-body-sm font-bold animate-fade-in">World reset successfully!</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Modal isOpen={isDocModalOpen} onClose={() => setIsDocModalOpen(false)} title="Technical Manual">
                <div className="space-y-12 py-4 pb-12 custom-scroll max-h-[70vh]">
                    {DOCUMENTATION_FILES.map((doc, idx) => (
                        <section key={idx} className="animate-fade-in border-b border-brand-primary/10 pb-10 last:border-0" style={{ animationDelay: `${idx * 50}ms` }}>
                            <h3 className="text-brand-accent mb-4">
                                {doc.title}
                            </h3>
                            <div className="text-body-base text-brand-text leading-relaxed whitespace-pre-wrap font-medium opacity-90">
                                {doc.content}
                            </div>
                        </section>
                    ))}

                    <div className="pt-4 flex justify-center">
                        <button
                            onClick={downloadAsTxt}
                            className="btn-primary btn-md rounded-xl gap-2 px-10 shadow-lg shadow-brand-accent/20"
                        >
                            <Icon name="download" className="w-4 h-4" />
                            Download technical manual
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SettingsView;
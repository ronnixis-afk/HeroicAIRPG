// components/SettingsView.tsx

import React, { useState, useContext, useEffect, useMemo } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import type { NarrationVoice, ImageGenerationStyle } from '../types';
import { Icon } from './Icon';
import Button from './Button';
import { IMAGE_GENERATION_STYLES } from '../constants';
import { NARRATION_VOICES } from '../types';
import { parseGameTime, formatGameTime } from '../utils/timeUtils';
import { worldService } from '../services/worldService';
import { cloudSaveService } from '../services/cloudSaveService';
import { downloadAsTxt, DOCUMENTATION_FILES } from '../utils/documentation';
import Modal from './Modal';
import PageHeader from './PageHeader';

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
        resetWorld,
        updateNarrationVoice,
        updateImageGenerationStyle,
        updateIsMature,
        updateIsHandsFree,
        updateUseAiTts,
        updateCurrentTime,
        storageUsage,
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

    // --- Cloud Sync State ---
    const [isSyncingCloud, setIsSyncingCloud] = useState(false);
    const [cloudMessage, setCloudMessage] = useState('');

    // Safe Access for Configuration (Defaults if undefined in older saves)
    const combatConfig = useMemo(() => {
        return gameData?.combatConfiguration || { aiNarratesTurns: true, aiGeneratesLoot: true, smarterGm: true, narrativeCombat: false, autoIncludeNearbyNpcs: true };
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

    const handleCloudBackup = async () => {
        if (!gameData || isSyncingCloud) return;
        setIsSyncingCloud(true);
        setCloudMessage('Uploading save data to cloud...');
        try {
            // Save local first to ensure we have the very latest data explicitly
            await worldService.saveGameData(worldId, gameData);

            const world = await worldService.getWorldById(worldId);
            if (world) {
                const result = await cloudSaveService.pushSaveToCloud(worldId, world.name, world.gameData);
                // Update local save metadata to match cloud's updatedAt for sync status accuracy
                await worldService.saveGameData(worldId, world.gameData, result.updatedAt);
                setCloudMessage('Backup successful!');
            }
        } catch (err: any) {
            setCloudMessage(`Backup failed: ${err.message}`);
        } finally {
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

    return (
        <div className="p-2 pt-8 max-w-2xl mx-auto pb-24">
            <PageHeader 
                title="Settings" 
                subtitle="Configure your adventure and game system." 
                showReturnButton={true}
            />

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

                        <div className="pt-8 border-t border-brand-primary/20 space-y-4">
                            <h4 className="mb-0">Advanced Rules</h4>
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
                                    <Button 
                                        onClick={handleSaveSettings} 
                                        variant="primary" 
                                        size="md" 
                                        className="w-full"
                                    >
                                        Save Directives
                                    </Button>
                                )}
                                {isSavingSettings && <Icon name="spinner" className="w-6 h-6 animate-spin text-brand-accent" />}
                                {saveSettingsSuccess && <div className="text-brand-accent flex items-center font-bold text-body-base animate-fade-in"><Icon name="check" className="w-5 h-5 mr-2" /> Directives Saved!</div>}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'system' && (
                    <div className="space-y-10 animate-fade-in pb-10">
                        <div className="flex flex-col gap-4 relative">
                            {isSyncingCloud && (
                                <div className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl z-10 text-center p-4">
                                    <Icon name="spinner" className="w-8 h-8 animate-spin text-brand-accent mb-2 mx-auto" />
                                    <div className="text-brand-text font-bold animate-pulse">{cloudMessage}</div>
                                </div>
                            )}

                             <Button
                                onClick={handleCloudBackup}
                                isLoading={isSyncingCloud}
                                variant="primary"
                                className="w-full"
                                icon="upload"
                            >
                                Sync To Cloud
                            </Button>

                            {cloudMessage && !isSyncingCloud && (
                                <div className="text-center text-body-sm font-bold text-brand-accent animate-fade-in py-1 absolute top-12 left-0 right-0 z-20 pointer-events-none">
                                    {cloudMessage}
                                </div>
                            )}

                            <Button
                                onClick={handleExportWorld}
                                variant="secondary"
                                className="w-full"
                                icon="download"
                            >
                                Export World
                            </Button>
                        </div>

                        <div className="pt-6 border-t border-brand-primary/20">
                            <StorageMeter used={storageUsage.used} limit={storageUsage.limit} />
                        </div>

                        <div>
                            <h4 className="mb-0">Date and Time Override</h4>
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
                            <h4 className="mb-0">Documentation</h4>
                             <div className="grid grid-cols-2 gap-4">
                                <Button
                                    onClick={() => setIsDocModalOpen(true)}
                                    variant="secondary"
                                    icon="eye"
                                >
                                    View Manual
                                </Button>
                                <Button
                                    onClick={downloadAsTxt}
                                    variant="secondary"
                                    icon="download"
                                >
                                    Download Txt
                                </Button>
                            </div>
                        </div>

                        <div className="border-t border-brand-primary/20 pt-10">
                            <div className="bg-brand-danger/5 border border-brand-danger/20 rounded-3xl p-6 space-y-6">
                                <div className="text-center">
                                    <h4 className="text-brand-danger mb-0 font-black">Danger Zone</h4>
                                    <p className="text-body-sm text-brand-text-muted italic opacity-70">Irreversible actions that modify your save data.</p>
                                </div>
                                 <Button
                                    onClick={handleResetWorld}
                                    variant="danger"
                                    className="w-full"
                                >
                                    Reset World
                                </Button>
                                {resetSuccess && <p className="text-brand-accent text-center text-body-sm font-bold animate-fade-in">World Reset Successfully!</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Modal isOpen={isDocModalOpen} onClose={() => setIsDocModalOpen(false)} title="Technical Manual">
                <div className="space-y-12 py-4 pb-12 custom-scroll max-h-[70vh]">
                    {DOCUMENTATION_FILES.map((doc, idx) => (
                        <section key={idx} className="animate-fade-in border-b border-brand-primary/10 pb-10 last:border-0" style={{ animationDelay: `${idx * 50}ms` }}>
                            <h5 className="text-brand-accent mb-4">
                                {doc.title}
                            </h5>
                            <div className="text-body-base text-brand-text leading-relaxed whitespace-pre-wrap font-medium opacity-90">
                                {doc.content}
                            </div>
                        </section>
                    ))}

                     <div className="pt-4 flex justify-center">
                        <Button
                            onClick={downloadAsTxt}
                            variant="primary"
                            icon="download"
                            className="px-10"
                        >
                            Download Technical Manual
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SettingsView;

import React, { useState, useContext, useEffect } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import Accordion from './Accordion';
import { Icon } from './Icon';
import AutoResizingTextarea from './AutoResizingTextarea';
import type { Nemesis } from '../types';

const NewTag: React.FC = () => (
    <span className="bg-brand-accent text-black text-[9px] font-black px-1.5 py-0.5 rounded ml-2 flex-shrink-0 animate-pulse">New</span>
);

const EditableNemesisContent: React.FC<{
    nemesis: Nemesis;
    onSave: (updatedNemesis: Nemesis) => Promise<void>;
    onDelete: (nemesisId: string) => void;
}> = ({ nemesis, onSave, onDelete }) => {
    const [localNemesis, setLocalNemesis] = useState(nemesis);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        setLocalNemesis(nemesis);
    }, [nemesis]);

    const isDirty = JSON.stringify(localNemesis) !== JSON.stringify(nemesis);

    const handleChange = (field: keyof Omit<Nemesis, 'id' | 'isNew'>, value: string | number) => {
        setLocalNemesis(prev => ({
            ...prev,
            [field]: typeof value === 'number' ? Math.max(0, value) : value,
        }));
    };

    const handleSave = async () => {
        if (!isDirty) return;
        setIsSaving(true);
        setSaveSuccess(false);
        const finalNemesis = {
            ...localNemesis,
            currentHeat: Math.min(localNemesis.currentHeat, localNemesis.maxHeat)
        };
        await onSave(finalNemesis);
        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete this nemesis: "${nemesis.title}"?`)) {
            onDelete(nemesis.id);
        }
    };
    
    const heatPercentage = localNemesis.maxHeat > 0 ? (localNemesis.currentHeat / localNemesis.maxHeat) * 100 : 0;

    return (
        <div className="space-y-6 pt-2 pb-4">
            <div>
                <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Title</label>
                <input
                    type="text"
                    value={localNemesis.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="w-full bg-brand-primary h-11 px-4 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base transition-all shadow-inner"
                />
            </div>
            <div>
                <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Description</label>
                <AutoResizingTextarea
                    value={localNemesis.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full bg-brand-primary p-4 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base leading-relaxed transition-all shadow-inner min-h-[80px]"
                />
            </div>
            
            <div>
                <label className="block text-body-sm font-bold text-brand-text-muted mb-3 ml-1">Threat Heat</label>
                <div className="bg-brand-primary/30 p-5 rounded-2xl space-y-4 border border-brand-surface shadow-inner">
                    <div className="w-full bg-brand-bg rounded-full h-2 overflow-hidden border border-brand-surface">
                        <div 
                            className="bg-brand-danger h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(239,68,68,0.3)]" 
                            style={{ width: `${heatPercentage}%` }}
                            role="progressbar"
                            aria-valuenow={localNemesis.currentHeat}
                            aria-valuemin={0}
                            aria-valuemax={localNemesis.maxHeat}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-[10px] font-bold text-brand-text-muted mb-1.5 ml-1">Current Heat</label>
                            <input
                                type="number"
                                value={localNemesis.currentHeat}
                                onChange={(e) => handleChange('currentHeat', parseInt(e.target.value, 10) || 0)}
                                className="w-full bg-brand-primary h-10 px-3 rounded-lg focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-center font-bold text-sm"
                            />
                        </div>
                         <div>
                            <label className="block text-[10px] font-bold text-brand-text-muted mb-1.5 ml-1">Max Heat</label>
                            <input
                                type="number"
                                value={localNemesis.maxHeat}
                                onChange={(e) => handleChange('maxHeat', parseInt(e.target.value, 10) || 10)}
                                className="w-full bg-brand-primary h-10 px-3 rounded-lg focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-center font-bold text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-brand-primary/10">
                <button 
                    onClick={handleDelete}
                    className="text-brand-danger hover:opacity-80 text-body-sm font-bold flex items-center gap-1.5 px-3 py-1.5 transition-all"
                    aria-label={`Delete ${nemesis.title}`}
                >
                    <Icon name="trash" className="w-4 h-4" />
                    Delete
                </button>
                 <div className="flex items-center">
                    {isDirty && !saveSuccess && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="btn-primary btn-md min-w-[120px]"
                        >
                            {isSaving ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : 'Save changes'}
                        </button>
                    )}
                    {saveSuccess && (
                        <div className="text-brand-accent text-body-sm font-bold flex items-center gap-1.5">
                            <Icon name="check" className="w-4 h-4" />
                            Saved
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const NemesisView: React.FC = () => {
    const { gameData, generateAndAddNemesis, deleteNemesis, markNemesisAsSeen, updateNemesis } = useContext(GameDataContext);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [openNemesisId, setOpenNemesisId] = useState<string | null>(null);
    
    const nemeses = gameData?.nemeses || [];

    const handleGenerate = async () => {
        if (!prompt.trim() || isGenerating) return;
        setIsGenerating(true);
        setError('');
        try {
            await generateAndAddNemesis(prompt);
            setPrompt('');
        } catch (err) {
            console.error(err);
            const errorMessageString = err instanceof Error ? err.message : JSON.stringify(err);
            if (errorMessageString.includes('429') || errorMessageString.includes('RESOURCE_EXHAUSTED')) {
                setError('Request limit reached. Please wait a bit before trying again.');
            } else {
                setError('Failed to generate nemesis. Please try again.');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleToggle = (nemesis: Nemesis) => {
        const newOpenId = openNemesisId === nemesis.id ? null : nemesis.id;
        setOpenNemesisId(newOpenId);
        if (newOpenId && nemesis.isNew) {
            markNemesisAsSeen(nemesis.id);
        }
    };

    return (
        <div className="p-2 pt-8 max-w-2xl mx-auto pb-24">
            <div className="text-center mb-10 pb-6 border-b border-brand-primary/20">
                <h1 className="text-brand-text mb-2">Nemesis System</h1>
                <p className="text-body-base text-brand-text-muted font-medium italic">
                    Persistent individuals or factions actively working against your party.
                </p>
            </div>

            <div className="space-y-4 mb-16 animate-page">
                {nemeses.length > 0 ? (
                    nemeses.map(nemesis => {
                        const title = (
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-brand-text">{nemesis.title}</span>
                                {nemesis.isNew && <NewTag />}
                            </div>
                        );
                        return (
                            <Accordion
                                key={nemesis.id}
                                title={title}
                                isOpen={openNemesisId === nemesis.id}
                                onToggle={() => handleToggle(nemesis)}
                            >
                                <EditableNemesisContent
                                    nemesis={nemesis}
                                    onSave={updateNemesis}
                                    onDelete={deleteNemesis}
                                />
                            </Accordion>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-brand-surface/20 rounded-3xl border-2 border-dashed border-brand-primary/30">
                        <Icon name="danger" className="w-16 h-16 mb-4 text-brand-text-muted opacity-20" />
                        <p className="text-body-base text-brand-text-muted italic">No active nemeses recorded in this world.</p>
                    </div>
                )}
            </div>
            
            <div className="mt-16 pt-10 border-t border-brand-primary/20">
                <div className="text-center mb-8">
                    <h2 className="text-brand-text mb-2">Forge a Rival</h2>
                    <p className="text-body-base text-brand-text-muted italic max-w-sm mx-auto leading-relaxed">
                        Describe the nature of your antagonist. The architect will manifest them within your story context.
                    </p>
                </div>
                
                <div className="bg-brand-surface p-6 rounded-3xl border border-brand-primary/30 shadow-2xl space-y-6">
                    <div className="space-y-2">
                        <label className="block text-body-sm font-bold text-brand-text-muted ml-1">The Request</label>
                        <AutoResizingTextarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g. A charismatic cult leader seeking a prophecy, a rival mercenary company..."
                            className="w-full bg-brand-primary p-5 rounded-2xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base leading-relaxed shadow-inner min-h-[100px]"
                        />
                    </div>
                    
                    <div className="flex flex-col items-center">
                        <button
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || isGenerating}
                            className="btn-primary btn-lg w-full max-w-xs gap-3 shadow-brand-accent/20"
                        >
                            {isGenerating ? (
                                <><Icon name="spinner" className="w-5 h-5 animate-spin" /> Manifesting...</>
                            ) : (
                                <><Icon name="sparkles" className="w-5 h-5" /> Generate Nemesis</>
                            )}
                        </button>
                        {error && <p className="text-brand-danger text-[10px] font-bold mt-4 animate-pulse">{error}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NemesisView;
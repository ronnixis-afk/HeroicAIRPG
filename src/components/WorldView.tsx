
import React, { useState, useContext, useEffect } from 'react';
import Accordion from './Accordion';
import { GameDataContext } from '../context/GameDataContext';
import { type LoreEntry, LORE_TAGS } from '../types';
import { generateAdditionalLore, generateGlobalWorldSummary } from '../services/geminiService';
import { Icon } from './Icon';
import AutoResizingTextarea from './AutoResizingTextarea';
import { TagEditor } from './TagEditor';
import { KeywordEditor } from './KeywordEditor';

const NewTag: React.FC = () => (
    <span className="bg-brand-accent text-black text-[9px] font-black px-1.5 py-0.5 rounded ml-2 flex-shrink-0 animate-bounce">New</span>
);

const EditableLoreContent: React.FC<{
    entry: LoreEntry;
    onSave: (entry: LoreEntry) => Promise<void>;
    onDelete: (id: string) => void;
}> = ({ entry, onSave, onDelete }) => {
    const [content, setContent] = useState(entry.content);
    const [tags, setTags] = useState<string[]>(entry.tags || []);
    const [keywords, setKeywords] = useState<string[]>(entry.keywords || []);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        setContent(entry.content);
        setTags(entry.tags || []);
        setKeywords(entry.keywords || []);
    }, [entry.content, entry.tags, entry.keywords]);

    const isDirty = content !== entry.content || JSON.stringify(tags) !== JSON.stringify(entry.tags || []) || JSON.stringify(keywords) !== JSON.stringify(entry.keywords || []);

    const handleSave = async () => {
        if (!isDirty) return;
        setIsSaving(true);
        setSaveSuccess(false);
        await onSave({ ...entry, content, tags, keywords });
        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete the entry titled "${entry.title}"? This cannot be undone.`)) {
            onDelete(entry.id);
        }
    };

    return (
        <div className="bg-brand-primary/10 p-5 rounded-2xl space-y-6 border border-brand-surface shadow-inner mt-4 animate-page">
            <TagEditor
                tags={tags}
                onTagsChange={setTags}
                options={LORE_TAGS}
            />

            <KeywordEditor
                keywords={keywords}
                onKeywordsChange={setKeywords}
            />

            <div className="space-y-1.5">
                <label className="block text-body-sm font-bold text-brand-text-muted ml-1">Lore content</label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    className="w-full bg-brand-primary p-4 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base leading-relaxed shadow-inner"
                />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-brand-primary/20">
                <div className="flex items-center gap-3">
                    {isDirty && !isSaving && !saveSuccess && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="btn-primary btn-md min-w-[120px]"
                        >
                            Save entry
                        </button>
                    )}
                    {isSaving && <Icon name="spinner" className="w-6 h-6 animate-spin text-brand-accent" />}
                    {saveSuccess && (
                        <div className="text-brand-accent text-body-sm font-bold flex items-center gap-1.5">
                            <Icon name="check" className="w-4 h-4" />
                            Saved!
                        </div>
                    )}
                </div>
                <button
                    onClick={handleDelete}
                    className="text-brand-danger hover:opacity-80 text-body-sm font-bold flex items-center gap-1.5 px-3 py-1.5 transition-all"
                    aria-label={`Delete ${entry.title}`}
                >
                    <Icon name="trash" className="w-4 h-4" />
                    Delete
                </button>
            </div>
        </div>
    );
};

const WorldView: React.FC = () => {
    const { gameData, updateWorldLore, deleteWorldLore, markLoreAsSeen, addWorldLore, updateWorldSummary } = useContext(GameDataContext);
    const [openAccordionIds, setOpenAccordionIds] = useState<Record<string, boolean>>({});
    const [generationPrompt, setGenerationPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [error, setError] = useState('');

    if (!gameData) return <div className="text-center p-8 animate-pulse text-brand-text-muted text-body-base">Loading world data...</div>;

    const handleAccordionToggle = (id: string) => {
        setOpenAccordionIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleGenerateLore = async () => {
        if (!generationPrompt.trim() || isGenerating) return;
        setIsGenerating(true);
        setError('');
        try {
            const newLore = await generateAdditionalLore(generationPrompt, gameData.world);
            addWorldLore([newLore]);
            setGenerationPrompt('');
        } catch (err) {
            console.error("Failed to generate lore:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to generate lore.";
            if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                setError("Request limit reached. Please wait a moment.");
            } else {
                setError("Failed to generate lore. Please try again.");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateSummary = async () => {
        setIsGeneratingSummary(true);
        try {
            const summary = await generateGlobalWorldSummary(gameData.world);
            updateWorldSummary(summary);
        } catch (e) {
            console.error("Failed to generate summary", e);
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const groupAndRenderLore = () => {
        const entries = gameData.world;
        if (!entries || entries.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 bg-brand-surface/20 rounded-3xl border-2 border-dashed border-brand-primary/30 animate-page">
                    <Icon name="world" className="w-16 h-16 mb-4 text-brand-text-muted opacity-20" />
                    <p className="text-body-base text-brand-text-muted italic">No lore entries found in this chronicle.</p>
                </div>
            );
        }

        const grouped: Record<string, LoreEntry[]> = {};
        LORE_TAGS.forEach(tag => grouped[tag] = []);
        grouped['other'] = [];

        entries.forEach(entry => {
            const safeTags = Array.isArray(entry.tags) ? entry.tags : [];
            const tag = safeTags.find(t => LORE_TAGS.includes(t as any));
            if (tag) grouped[tag].push(entry);
            else grouped['other'].push(entry);
        });

        const categories = [...LORE_TAGS, 'other'].filter(cat => grouped[cat] && grouped[cat].length > 0);

        return (
            <div className="space-y-6">
                {categories.map(category => {
                    const categoryEntries = grouped[category];
                    categoryEntries.sort((a, b) => {
                        const aNew = a.isNew ? 1 : 0;
                        const bNew = b.isNew ? 1 : 0;
                        if (aNew !== bNew) return bNew - aNew;
                        return a.title.localeCompare(b.title);
                    });

                    const categoryId = `cat-${category}`;
                    const hasNew = categoryEntries.some(e => e.isNew);
                    const displayCategory = category.charAt(0).toUpperCase() + category.slice(1);

                    const categoryTitle = (
                        <div className="flex items-center gap-2">
                            <span className="text-brand-text tracking-tight font-black">{displayCategory}</span>
                            {hasNew && <NewTag />}
                        </div>
                    );

                    return (
                        <Accordion
                            key={categoryId}
                            title={categoryTitle}
                            isOpen={!!openAccordionIds[categoryId]}
                            onToggle={() => handleAccordionToggle(categoryId)}
                        >
                            <div className="space-y-2 pt-2 border-l-2 border-brand-primary/30 ml-2 pl-4">
                                {categoryEntries.map(entry => {
                                    const handleToggle = () => {
                                        if (entry.isNew && !openAccordionIds[entry.id]) {
                                            markLoreAsSeen(entry.id);
                                        }
                                        handleAccordionToggle(entry.id);
                                    };

                                    const title = (
                                        <div className="flex items-center gap-2">
                                            <span className="text-body-lg font-bold">{entry.title}</span>
                                            {entry.isNew && <NewTag />}
                                        </div>
                                    );

                                    return (
                                        <Accordion
                                            key={entry.id}
                                            title={title}
                                            isOpen={!!openAccordionIds[entry.id]}
                                            onToggle={handleToggle}
                                        >
                                            <EditableLoreContent
                                                entry={entry}
                                                onSave={updateWorldLore}
                                                onDelete={deleteWorldLore}
                                            />
                                        </Accordion>
                                    );
                                })}
                            </div>
                        </Accordion>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="p-2 pt-8 max-w-2xl mx-auto pb-24">
            <div className="text-center mb-10 pb-6 border-b border-brand-primary/20">
                <h1 className="text-brand-text mb-2">Realm Codex</h1>
                <p className="text-body-base text-brand-text-muted font-medium italic">
                    The history, myths, and facts that define this realm.
                </p>
            </div>

            <div className="bg-brand-surface rounded-3xl border border-brand-primary/30 p-6 mb-12 shadow-xl animate-page overflow-hidden group">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20">
                            <Icon name="world" className="w-5 h-5 text-brand-accent" />
                        </div>
                        <h3 className="text-brand-text mb-0">Realm Overview</h3>
                    </div>
                    <button
                        onClick={handleGenerateSummary}
                        disabled={isGeneratingSummary}
                        className="btn-icon-refresh shadow-sm"
                        title={gameData.worldSummary ? 'Regenerate summary' : 'Generate summary'}
                    >
                        {isGeneratingSummary ? <Icon name="spinner" className="w-5 h-5 animate-spin text-brand-accent" /> : <Icon name="refresh" className="w-5 h-5" />}
                    </button>
                </div>

                {gameData.worldSummary ? (
                    <div className="text-body-base text-brand-text leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-brand-accent/30 italic opacity-90">
                        {gameData.worldSummary}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-brand-primary/10 rounded-2xl border border-dashed border-brand-surface">
                        <p className="text-body-sm text-brand-text-muted italic">
                            {isGeneratingSummary ? 'The architect is analyzing world data...' : 'No overview has been woven for this world yet.'}
                        </p>
                        {!isGeneratingSummary && (
                            <button
                                onClick={handleGenerateSummary}
                                className="text-brand-accent font-bold text-[10px] mt-2 hover:underline"
                            >
                                Consult the Architect
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="mb-12">
                {groupAndRenderLore()}
            </div>

            <div className="mt-16 pt-10 border-t border-brand-primary/20">
                <div className="text-center mb-8">
                    <h2 className="text-brand-text mb-2">Unveil Secrets</h2>
                    <p className="text-body-base text-brand-text-muted italic max-w-sm mx-auto">
                        Ask the architect to describe specific aspects of the realm or hidden histories.
                    </p>
                </div>

                <div className="bg-brand-surface p-6 rounded-3xl border border-brand-primary/30 shadow-2xl space-y-6">
                    <div className="space-y-1.5">
                        <label className="block text-body-sm font-bold text-brand-text-muted ml-1">The request</label>
                        <AutoResizingTextarea
                            value={generationPrompt}
                            onChange={(e) => setGenerationPrompt(e.target.value)}
                            placeholder="e.g. Describe the magic system, or the geography of the northern wastes..."
                            className="w-full bg-brand-primary p-5 rounded-2xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base leading-relaxed shadow-inner min-h-[100px]"
                        />
                    </div>

                    <p className="text-[10px] text-brand-text-muted text-center italic opacity-60 leading-relaxed px-4">
                        Tip: You can ask for specific tags like "Create a faction called..." or "Add history about..."
                    </p>

                    <div className="flex flex-col items-center">
                        <button
                            onClick={handleGenerateLore}
                            disabled={!generationPrompt.trim() || isGenerating}
                            className="btn-primary btn-lg w-full max-w-xs gap-3 shadow-brand-accent/20"
                        >
                            {isGenerating ? (
                                <><Icon name="spinner" className="w-5 h-5 animate-spin" /> Writing lore...</>
                            ) : (
                                <><Icon name="sparkles" className="w-5 h-5" /> Transcribe Lore</>
                            )}
                        </button>
                        {error && <p className="text-brand-danger text-[10px] font-bold mt-4 animate-pulse">{error}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorldView;

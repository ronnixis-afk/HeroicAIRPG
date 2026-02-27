// components/GmNotesView.tsx

import React, { useState, useContext, useEffect, useMemo } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import { useUI } from '../context/UIContext';
import { Icon } from './Icon';
import type { PlotPointType, PlotPoint, NPC } from '../types';
import AutoResizingTextarea from './AutoResizingTextarea';
import Modal from './Modal';

const PlotPointTypeColors: Record<PlotPointType, string> = {
    'Achievement': 'bg-emerald-900/60 text-emerald-300 border-emerald-400/40',
    'Choice': 'bg-purple-900/50 text-purple-300 border-purple-500/30',
    'Background': 'bg-stone-800 text-stone-300 border-stone-500/30',
    'Milestone': 'bg-yellow-900/40 text-yellow-300 border-yellow-500/30',
    'Secret': 'bg-red-900/40 text-red-300 border-red-500/30',
    'World': 'bg-blue-900/40 text-blue-300 border-blue-500/30',
    'Objective': 'bg-cyan-900/40 text-cyan-300 border-cyan-500/30',
};

const EditablePlotPoint: React.FC<{
    point: PlotPoint;
    onUpdate: (point: PlotPoint) => void;
    onDelete: (id: string) => void;
}> = ({ point, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(point.content);
    const [type, setType] = useState(point.type);

    useEffect(() => {
        setContent(point.content);
        setType(point.type);
    }, [point]);

    const handleSave = () => {
        if (content !== point.content || type !== point.type) {
            onUpdate({ ...point, content, type });
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setContent(point.content);
        setType(point.type);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="bg-brand-surface p-4 rounded-xl border border-brand-primary shadow-lg animate-fade-in">
                <div className="mb-4 flex flex-wrap gap-2">
                    {(Object.keys(PlotPointTypeColors) as PlotPointType[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setType(t)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                                type === t 
                                    ? 'bg-brand-accent text-black border-brand-accent' 
                                    : 'bg-brand-primary text-brand-text-muted border-brand-secondary hover:border-brand-primary'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <AutoResizingTextarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-brand-primary p-3 rounded-xl text-body-base text-brand-text border border-brand-surface focus:border-brand-accent focus:outline-none mb-4 min-h-[60px]"
                    autoFocus
                />
                <div className="flex justify-end gap-3">
                    <button onClick={handleCancel} className="btn-tertiary btn-sm">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="btn-primary btn-sm rounded-lg">
                        Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="group flex items-start gap-4 bg-brand-surface/50 p-4 rounded-2xl border border-brand-primary/50 hover:border-brand-primary transition-colors">
            <div className={`flex-shrink-0 w-2.5 h-2.5 mt-2 rounded-full ${point.type === 'Secret' ? 'bg-brand-danger' : (point.type === 'Achievement' ? 'bg-brand-accent shadow-[0_0_8px_#3ecf8e]' : 'bg-brand-text-muted')}`}></div>
            <div className="flex-grow min-w-0">
                <div className="flex justify-between items-center mb-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${PlotPointTypeColors[point.type]}`}>
                        {point.type}
                    </span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="btn-icon text-brand-text-muted hover:text-brand-accent"
                            title="Edit"
                        >
                            <Icon name="edit" className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => onDelete(point.id)}
                            className="btn-icon text-brand-text-muted hover:text-brand-danger"
                            title="Delete"
                        >
                            <Icon name="trash" className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <p className="text-body-base text-brand-text leading-relaxed whitespace-pre-wrap">{point.content}</p>
            </div>
        </div>
    );
};

const GmNotesView: React.FC = () => {
    const { gameData, updateGmNotes, addPlotPoint, deletePlotPoint, updatePlotPoint, weaveGrandDesign } = useContext(GameDataContext);
    const { setInspectedEntity } = useUI();
    const [localGmNotes, setLocalGmNotes] = useState('');
    const [newPointText, setNewPointText] = useState('');
    const [selectedType, setSelectedType] = useState<PlotPointType>('Achievement');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [isWeaving, setIsWeaving] = useState(false);
    
    // UI State for the Grand Design
    const [isGrandDesignModalOpen, setIsGrandDesignModalOpen] = useState(false);

    useEffect(() => {
        if (gameData?.gmNotes !== undefined) {
            setLocalGmNotes(gameData.gmNotes);
        }
    }, [gameData?.gmNotes]);

    // AUTO-INITIATE: Generate first Grand Design if viewing and it's empty
    useEffect(() => {
        if (isGrandDesignModalOpen && !gameData?.grandDesign && !isWeaving) {
            handleManualWeave();
        }
    }, [isGrandDesignModalOpen, gameData?.grandDesign]);

    const handleAddPoint = () => {
        if (!newPointText.trim()) return;
        const point: PlotPoint = {
            id: `pp-${Date.now()}`,
            content: newPointText,
            type: selectedType,
            isNew: true
        };
        addPlotPoint(point);
        setNewPointText('');
    };

    const handleManualWeave = async () => {
        if (isWeaving) return;
        setIsWeaving(true);
        try {
            await weaveGrandDesign();
        } finally {
            setIsWeaving(false);
        }
    };

    // Manual save for current plot if user edits it directly
    const handleManualSaveNotes = async () => {
        if (localGmNotes !== gameData?.gmNotes) {
            setIsSavingNotes(true);
            await updateGmNotes(localGmNotes);
            setIsSavingNotes(false);
        }
    };

    const designDisplayValue = isWeaving 
        ? "The architect is analyzing world lore and recent chronicles to weave your destiny..." 
        : (gameData?.grandDesign || "The narrative threads are currently being woven. This field will be populated as the AI synthesizes your choices into a grand overarching plot.");

    const connectedNpcs = useMemo(() => {
        if (!gameData?.connectedNpcIds || !gameData.npcs) return [];
        return gameData.connectedNpcIds
            .map(id => gameData.npcs.find(n => n.id === id))
            .filter((n): n is NPC => !!n);
    }, [gameData?.connectedNpcIds, gameData?.npcs]);

    return (
        <div className="p-4 pt-8 max-w-2xl mx-auto pb-32">
            <div className="text-center mb-12">
                <h1 className="text-brand-text mb-2">The Narrative Web</h1>
                <p className="text-body-base text-brand-text-muted italic">
                    Interconnect player choices, achievements, and secrets to guide the storyteller.
                </p>
            </div>

            {/* SECTION 0: THE GRAND DESIGN */}
            <div className="mb-12">
                <div className="mb-4 text-center">
                    <h2 className="text-brand-text mb-1">The Grand Design</h2>
                    <p className="text-body-sm text-brand-text-muted">An generated compass that directs the overall plot.</p>
                </div>
                <div className="flex justify-center">
                    <button 
                        onClick={() => setIsGrandDesignModalOpen(true)}
                        className="btn-secondary btn-md rounded-xl gap-2 shadow-sm"
                    >
                        <Icon name="eye" className="w-5 h-5" />
                        View (Spoiler alert)
                    </button>
                </div>
            </div>

            {/* SECTION 1: CURRENT PLOT */}
            <div className="mb-12">
                <div className="flex flex-col items-center mb-4">
                    <h3 className="text-brand-accent flex items-center gap-2 mb-0">
                        <Icon name="sparkles" className="w-5 h-5" /> 
                        Current Encounter Plot
                    </h3>
                </div>
                
                <div className="bg-brand-surface rounded-2xl border border-brand-primary shadow-xl overflow-hidden group">
                    <textarea
                        value={localGmNotes}
                        onChange={(e) => setLocalGmNotes(e.target.value)}
                        onBlur={handleManualSaveNotes}
                        className="w-full h-44 bg-transparent p-6 text-body-base text-brand-text resize-none focus:outline-none leading-relaxed custom-scroll font-medium"
                        placeholder="Encounter details from the matrix (archetype, motivation, twist) will appear here automatically when triggered..."
                    />
                    <div className="bg-brand-primary/20 px-6 py-3 border-t border-brand-primary/50 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-brand-text-muted italic">This brief guides the storyteller during active encounters.</span>
                        {isSavingNotes && <span className="text-brand-accent text-[10px] font-black animate-pulse">Saving...</span>}
                    </div>
                </div>
            </div>

            {/* SECTION 2: THE WEB OF TRUTH */}
            <div>
                <div className="mb-6 text-center">
                    <h2 className="text-brand-text">The Web of Truth</h2>
                </div>

                {/* Input Area */}
                <div className="bg-brand-surface rounded-2xl border border-brand-primary p-6 mb-8 shadow-xl">
                    <AutoResizingTextarea
                        value={newPointText}
                        onChange={(e) => setNewPointText(e.target.value)}
                        placeholder="Add a new plot point or achievement..."
                        className="w-full bg-brand-primary rounded-xl p-4 text-body-base text-brand-text focus:ring-1 focus:ring-brand-accent focus:outline-none border border-brand-surface mb-6 min-h-[100px] shadow-inner leading-relaxed"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddPoint();
                            }
                        }}
                    />
                    
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                            {(Object.keys(PlotPointTypeColors) as PlotPointType[]).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setSelectedType(type)}
                                    className={`px-4 py-2 rounded-full text-[10px] font-black border transition-all ${
                                        selectedType === type 
                                            ? 'bg-brand-accent text-black border-brand-accent shadow-md' 
                                            : 'bg-brand-bg text-brand-text-muted border-brand-primary hover:border-brand-secondary'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleAddPoint}
                            disabled={!newPointText.trim()}
                            className="btn-primary btn-md w-full sm:w-40 rounded-xl"
                        >
                            Add Note
                        </button>
                    </div>
                </div>

                {/* List Area */}
                <div className="space-y-4">
                    {gameData?.plotPoints && gameData.plotPoints.length > 0 ? (
                        [...gameData.plotPoints].reverse().map(point => (
                            <EditablePlotPoint 
                                key={point.id} 
                                point={point} 
                                onUpdate={updatePlotPoint} 
                                onDelete={deletePlotPoint} 
                            />
                        ))
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed border-brand-primary/30 rounded-3xl bg-brand-surface/20">
                            <Icon name="rocket" className="w-12 h-12 mx-auto mb-4 text-brand-text-muted opacity-20" />
                            <p className="text-body-base text-brand-text-muted italic">No plot points have been woven into the tapestry yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* LIGHTBOX FOR THE GRAND DESIGN */}
            <Modal isOpen={isGrandDesignModalOpen} onClose={() => setIsGrandDesignModalOpen(false)} title="The Grand Design">
                <div className="space-y-8 py-2">
                    <p className="text-body-sm text-brand-text-muted leading-relaxed italic px-1">
                        This document contains the underlying narrative arc generated to ensure consistency across sessions. Editing this will fundamentally change how the storyteller perceives your long-term destiny.
                    </p>
                    
                    <div className="bg-brand-primary/10 rounded-2xl border border-brand-primary/50 p-6 shadow-inner relative group min-h-[300px]">
                        <div className={`text-body-base text-brand-text leading-relaxed whitespace-pre-wrap font-medium ${isWeaving ? 'opacity-30 animate-pulse' : ''}`}>
                            {designDisplayValue}
                        </div>
                        
                        {isWeaving && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="flex flex-col items-center gap-3 bg-brand-surface/90 p-6 rounded-2xl backdrop-blur-md border border-brand-accent/20 shadow-2xl">
                                    <Icon name="spinner" className="w-10 h-10 animate-spin text-brand-accent" />
                                    <span className="text-[10px] text-brand-accent font-black uppercase tracking-widest animate-pulse">Architecting fate...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CONNECTED NPCS SECTION */}
                    {(gameData?.grandDesign || isWeaving) && (
                        <div className="animate-fade-in border-t border-brand-primary/20 pt-6">
                            <h5 className="text-brand-accent text-center mb-6 flex items-center justify-center gap-2">
                                <Icon name="users" className="w-4 h-4" />
                                Connected Npcs
                            </h5>
                            
                            {connectedNpcs.length > 0 ? (
                                <div className="flex flex-wrap justify-center gap-6">
                                    {connectedNpcs.map(npc => {
                                        const isDead = npc.status === 'Dead';
                                        return (
                                            <button 
                                                key={npc.id}
                                                onClick={() => setInspectedEntity({ type: 'npc', data: npc })}
                                                className="flex flex-col items-center gap-3 group transition-all"
                                            >
                                                <div className={`relative w-14 h-14 rounded-full overflow-hidden border-2 transition-all ${isDead ? 'border-brand-danger/50 grayscale' : 'border-brand-accent/30 group-hover:border-brand-accent group-hover:scale-105 shadow-lg shadow-brand-accent/5'}`}>
                                                    {npc.image ? (
                                                        <img src={npc.image} alt={npc.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-brand-surface">
                                                            <span className="text-sm font-black text-brand-text-muted">{npc.name.slice(0, 2).toUpperCase()}</span>
                                                        </div>
                                                    )}
                                                    {isDead && (
                                                        <div className="absolute inset-0 bg-brand-danger/40 flex items-center justify-center">
                                                            <Icon name="skull" className="w-6 h-6 text-white opacity-80" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-center">
                                                    <p className={`text-[10px] font-bold truncate max-w-[90px] transition-colors ${isDead ? 'text-brand-danger' : 'text-brand-text-muted group-hover:text-brand-text'}`}>
                                                        {npc.name}
                                                    </p>
                                                    {isDead && <p className="text-[8px] font-black text-brand-danger/80 uppercase tracking-tighter mt-0.5">(Deceased)</p>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-body-sm text-brand-text-muted text-center italic opacity-40 py-2">
                                    No named characters identified in this arc.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-4">
                        <button 
                            onClick={handleManualWeave} 
                            disabled={isWeaving}
                            className="btn-secondary btn-md w-full sm:flex-1 rounded-xl gap-2"
                        >
                            <Icon name="refresh" className={`w-4 h-4 ${isWeaving ? 'animate-spin' : ''}`} />
                            Regenerate
                        </button>
                        <button 
                            onClick={() => setIsGrandDesignModalOpen(false)}
                            className="btn-primary btn-md w-full sm:flex-1 rounded-xl shadow-lg"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default GmNotesView;

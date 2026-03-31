
import React, { useState, useEffect, useContext, useMemo } from 'react';
import Modal from '../Modal';
import { type NPC, type CombatActorSize, type ArchetypeName, ARCHETYPE_NAMES, type NPCMemory } from '../../types';
import { getRelationshipLabel, getGoodEvilLabel, getLawChaosLabel, GOOD_EVIL_ALIASES, LAW_CHAOS_ALIASES, toTitleCase, getRaceColor, getGenderColor, fixCasing } from '../../utils/npcUtils';
import AutoResizingTextarea from '../AutoResizingTextarea';
import { Icon } from '../../components/Icon';
import Button from '../Button';
import { DEFAULT_TEMPLATES, DEFAULT_AFFINITIES, getDifficultyParams, DifficultyPreset } from '../../utils/mechanics';
import { GameDataContext } from '../../context/GameDataContext';


interface NPCDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    npc: NPC;
    onSave: (updatedNPC: NPC) => void;
    onDelete: (id: string) => void;
}


const StyledInputGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex flex-col">
        <label className="text-body-sm font-bold text-brand-text-muted mb-2 ml-1">{toTitleCase(label)}</label>
        {children}
    </div>
);

const PillSelect: React.FC<{
    value: string;
    onChange: (val: string) => void;
    options: string[] | readonly string[];
    colorClass: string;
    label?: string;
}> = ({ value, onChange, options, colorClass, label }) => (
    <div className={`relative inline-flex items-center border rounded-lg px-4 py-1.5 ${colorClass} transition-all hover:bg-opacity-20`}>
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="appearance-none bg-transparent border-none text-[10px] font-bold focus:outline-none cursor-pointer pr-5 w-full tracking-normal"
        >
            <option value="" className="text-black">Select {label ? toTitleCase(label) : ''}</option>
            {options.map(opt => (
                <option key={opt} value={opt} className="text-black">{toTitleCase(opt)}</option>
            ))}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60">
            <Icon name="chevronDown" className="w-3.5 h-3.5" />
        </div>
    </div>
);

const NPCViewContent: React.FC<{
    npc: NPC;
    onEdit: () => void;
    onInvite: () => void;
    isInviting: boolean;
}> = ({ npc, onEdit, onInvite, isInviting }) => {
    const [isMemoriesOpen, setIsMemoriesOpen] = useState(false);
    const relInfo = getRelationshipLabel(npc.relationship);

    const DataRow = ({ label, value, icon, noTitle }: { label: string, value?: string, icon?: string, noTitle?: boolean }) => {
        if (!value) return null;
        return (
            <div className="space-y-1.5">
                <label className="text-xs font-bold text-brand-text-muted opacity-60 flex items-center gap-2 tracking-normal">
                    {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
                    {toTitleCase(label)}
                </label>
                <p className="text-body-base text-brand-text leading-relaxed font-medium">
                    {noTitle ? fixCasing(value) : toTitleCase(value)}
                </p>
            </div>
        );
    };

    const TraitPill = ({ label, value }: { label: string, value?: string }) => {
        if (!value) return null;
        return (
            <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-brand-text-muted opacity-50 tracking-normal">{toTitleCase(label)}</span>
                <span className="text-body-sm font-bold text-brand-text">{toTitleCase(value)}</span>
            </div>
        );
    };

    const sortedMemories = useMemo(() => {
        return [...(npc.memories || [])].reverse();
    }, [npc.memories]);

    return (
        <div className="space-y-8 animate-fade-in pb-4">
            <div className="space-y-5">
                <div className="flex justify-between items-center gap-4">
                    <div className="flex flex-wrap gap-2">
                        {npc.race && (
                            <span className={`text-[10px] font-bold px-3 py-1 rounded-lg border tracking-normal ${getRaceColor(npc.race)}`}>
                                {toTitleCase(npc.race)}
                            </span>
                        )}
                        {npc.gender && (
                            <span className={`text-[10px] font-bold px-3 py-1 rounded-lg border tracking-normal ${getGenderColor(npc.gender)}`}>
                                {toTitleCase(npc.gender)}
                            </span>
                        )}
                        {npc.status !== 'Alive' && (
                            <span className="text-[10px] font-bold text-brand-danger bg-brand-danger/10 px-3 py-1 rounded-lg border border-brand-danger/20 tracking-normal">
                                {toTitleCase(npc.status)}
                            </span>
                        )}
                        {npc.presenceMode === 'Remote' && (
                            <span className="text-[10px] font-bold text-blue-400 bg-blue-900/20 px-3 py-1 rounded-lg border border-blue-500/20 tracking-normal flex items-center gap-1">
                                <Icon name="radio" className="w-3 h-3" />
                                Remote
                            </span>
                        )}
                        {npc.is_essential && (
                            <span className="text-[10px] font-bold text-yellow-400 bg-yellow-900/20 px-3 py-1 rounded-lg border border-yellow-500/20 tracking-normal flex items-center gap-1">
                                <Icon name="starFill" className="w-3 h-3" />
                                Essential
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-brand-primary/10 p-5 rounded-2xl border border-brand-surface shadow-inner">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-xs font-bold text-brand-text-muted opacity-60 tracking-normal">Current Standing</label>
                        <span className={`text-xs font-bold tracking-normal ${relInfo.color.replace('bg-', 'text-')}`}>
                            {toTitleCase(relInfo.label)} ({npc.relationship > 0 ? '+' : ''}{npc.relationship})
                        </span>
                    </div>

                </div>
            </div>

            <div className="space-y-8">
                <DataRow label="Appearance" value={npc.appearance} noTitle />
                <DataRow label="History and Background" value={npc.description} noTitle />
            </div>

            {(npc.location || npc.currentPOI) && (
                <div className="p-5 rounded-2xl border border-dashed border-brand-primary/40 bg-brand-primary/5">
                    <h5 className="text-xs font-bold text-brand-text-muted opacity-60 mb-3 tracking-normal">{toTitleCase("Last Sighted")}</h5>
                    <div className="flex items-start gap-4">
                        <Icon name="location" className="w-6 h-6 text-brand-accent shrink-0" />
                        <div className="text-body-base font-bold leading-tight pt-0.5">
                            {npc.currentPOI && <span className="text-brand-text">{npc.currentPOI}</span>}
                            {npc.currentPOI && npc.location && <span className="text-brand-text-muted">, </span>}
                            {npc.location && <span className="text-brand-text-muted">{npc.location}</span>}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 bg-brand-primary/5 p-5 rounded-2xl border border-brand-surface">
                <TraitPill label="Moral Alignment (Good/Evil)" value={getGoodEvilLabel(npc.moralAlignment?.goodEvil || 0)} />
                <TraitPill label="Ethical Alignment (Law/Chaos)" value={getLawChaosLabel(npc.moralAlignment?.lawChaos || 0)} />
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-bold text-brand-text-muted opacity-60 tracking-normal">{toTitleCase("Chronicle of Interactions")}</label>
                    <span className="text-[10px] font-bold text-brand-accent px-2.5 py-1 rounded-lg bg-brand-accent/5 border border-brand-accent/20 tracking-normal">{toTitleCase("Digital Memory Active")}</span>
                </div>
                
                <Button
                    onClick={() => setIsMemoriesOpen(true)}
                    variant="secondary"
                    size="sm"
                    className="w-full py-3 rounded-xl border-dashed border-brand-primary/40 bg-brand-primary/5 hover:bg-brand-primary/10 transition-all font-bold"
                    icon="history"
                >
                    View Memories
                </Button>

                <Modal 
                    isOpen={isMemoriesOpen} 
                    onClose={() => setIsMemoriesOpen(false)} 
                    title={toTitleCase(`${npc.name}'s Memories`)}
                    maxWidth="lg"
                >
                    <div className="bg-brand-primary/10 rounded-2xl border border-brand-surface overflow-hidden divide-y divide-brand-surface/30">
                        {sortedMemories.length > 0 ? (
                            sortedMemories.map((m, i) => (
                                <div key={i} className="p-5 flex flex-col gap-2 group/mem hover:bg-brand-primary/20 transition-colors">
                                    <div className="text-[10px] font-mono font-bold text-brand-accent/60 tracking-normal">
                                        {m.timestamp}
                                    </div>
                                    <div className="w-full">
                                        <p className="text-body-base text-brand-text leading-relaxed italic">
                                            "{m.content}"
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-10 text-center">
                                <p className="text-body-base text-brand-text-muted italic opacity-40">No previous interactions recorded.</p>
                            </div>
                        )}
                    </div>
                </Modal>
            </div>

            {!npc.companionId && (npc.template || npc.affinity || npc.archetype) && (
                <div className="space-y-3 pt-2">
                    <label className="text-xs font-bold text-brand-text-muted opacity-60 px-1 tracking-normal">{toTitleCase("Combat Classification")}</label>
                    <div className="flex flex-wrap gap-2">
                        {npc.difficulty && <span className="text-[10px] font-bold text-brand-danger bg-brand-danger/10 px-3 py-1.5 rounded-lg border border-brand-danger/20 tracking-normal">{toTitleCase(npc.difficulty)} {toTitleCase("Threat")}</span>}
                        {npc.template && <span className="text-[10px] font-bold text-purple-400 bg-purple-900/10 px-3 py-1.5 rounded-lg border border-purple-500/20 tracking-normal">{toTitleCase(npc.template)}</span>}
                        {npc.affinity && npc.affinity !== 'None' && <span className="text-[10px] font-bold text-orange-400 bg-orange-900/10 px-3 py-1.5 rounded-lg border border-orange-500/20 tracking-normal">{toTitleCase(npc.affinity)} {toTitleCase("Affinity")}</span>}
                        {npc.archetype && <span className="text-[10px] font-bold text-teal-400 bg-teal-900/10 px-3 py-1.5 rounded-lg border border-teal-500/20 tracking-normal">{toTitleCase(npc.archetype)}</span>}
                    </div>
                </div>
            )}

            {!npc.companionId && npc.status === 'Alive' && (
                <div className="pt-8 border-t border-brand-primary/20 flex flex-col gap-6">
                    <Button
                        onClick={onInvite}
                        isLoading={isInviting}
                        variant="primary"
                        size="lg"
                        className="w-full"
                        icon="character"
                    >
                        Invite to Party
                    </Button>

                    <Button
                        onClick={onEdit}
                        variant="secondary"
                        size="lg"
                        className="w-full"
                        icon="edit"
                    >
                        Edit Profile
                    </Button>
                </div>
            )}
        </div>
    );
};

const NPCDetailsModal: React.FC<NPCDetailsModalProps> = ({ isOpen, onClose, npc, onSave, onDelete }) => {
    const { gameData, inviteNpcToParty } = useContext(GameDataContext);
    const [isEditing, setIsEditing] = useState(false);
    const [editedNPC, setEditedNPC] = useState<NPC>(npc);
    const [isDirty, setIsDirty] = useState(false);
    const [isInviting, setIsInviting] = useState(false);

    const playerLevel = gameData?.playerCharacter.level || 1;

    useEffect(() => {
        if (isOpen) {
            setEditedNPC(npc);
            setIsDirty(false);
            setIsEditing(false);
        }
    }, [npc, isOpen]);

    const availableRaces = useMemo(() => {
        if (!gameData?.world) return ['Human', 'Elf', 'Dwarf', 'Orc', 'Other', 'Unknown'];
        const racesFromLore = gameData.world
            .filter(l => l.tags?.includes('race'))
            .map(l => l.title)
            .sort();
        const defaults = racesFromLore.length === 0 ? ['Human', 'Elf', 'Dwarf', 'Orc'] : racesFromLore;
        return Array.from(new Set([...defaults, 'Other', 'Unknown']));
    }, [gameData?.world]);

    const genderOptions = ['Male', 'Female', 'Non-binary', 'Unspecified', 'Other'];
    const visitedZones = useMemo(() => {
        return (gameData?.mapZones || []).filter(z => z.visited).sort((a, b) => a.name.localeCompare(b.name));
    }, [gameData?.mapZones]);

    const selectedZone = useMemo(() => {
        return visitedZones.find(z => z.name === editedNPC.location);
    }, [visitedZones, editedNPC.location]);

    const localPois = useMemo(() => {
        if (!selectedZone || !gameData?.knowledge) return [];
        return gameData.knowledge
            .filter(k => k.coordinates === selectedZone.coordinates && k.tags?.includes('location'))
            .sort((a, b) => a.title.localeCompare(b.title));
    }, [selectedZone, gameData?.knowledge]);

    const handleChange = (field: keyof NPC, value: any) => {
        setEditedNPC(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleDifficultyPresetChange = (tag: string) => {
        const params = getDifficultyParams(tag as DifficultyPreset, playerLevel);
        setEditedNPC(prev => ({
            ...prev,
            difficulty: tag,
            cr: tag,
            rank: params.rank,
            challengeRating: params.cr
        }));
        setIsDirty(true);
    };

    const handleInvite = async () => {
        if (isInviting) return;
        setIsInviting(true);
        try {
            await inviteNpcToParty(npc);
            onClose();
        } finally {
            setIsInviting(false);
        }
    };

    const handleSave = () => {
        onSave(editedNPC);
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${npc.name}?`)) {
            onDelete(npc.id);
            onClose();
        }
    };

    const currentDifficultyTag = useMemo(() => {
        const presets: DifficultyPreset[] = ['Weak', 'Normal', 'Elite', 'Boss'];
        for (const p of presets) {
            const params = getDifficultyParams(p, playerLevel);
            if (params.cr === editedNPC.challengeRating && params.rank === editedNPC.rank) return p;
        }
        return editedNPC.difficulty || editedNPC.cr || 'Normal';
    }, [editedNPC.difficulty, editedNPC.cr, editedNPC.challengeRating, editedNPC.rank, playerLevel]);

    const inputClass = "w-full bg-brand-primary h-11 px-4 rounded-xl border border-brand-surface focus:border-brand-accent focus:ring-1 focus:ring-brand-accent focus:outline-none text-body-base text-brand-text transition-all shadow-inner";
    const selectClass = "w-full bg-brand-primary h-11 px-4 pr-10 rounded-xl border border-brand-surface focus:border-brand-accent focus:ring-1 focus:ring-brand-accent focus:outline-none text-body-base text-brand-text appearance-none transition-all cursor-pointer shadow-inner";
    const textareaClass = "w-full bg-brand-primary p-4 rounded-xl border border-brand-surface focus:border-brand-accent focus:ring-1 focus:ring-brand-accent focus:outline-none text-body-base text-brand-text leading-relaxed transition-all shadow-inner";

    const templates = Object.keys(DEFAULT_TEMPLATES).filter(t => t !== 'Custom');
    const affinities = Object.keys(DEFAULT_AFFINITIES);
    const sizes: CombatActorSize[] = ['Small', 'Medium', 'Large', 'Huge', 'Gargantuan', 'Colossal'];
    const difficultyPresets: DifficultyPreset[] = ['Weak', 'Normal', 'Elite', 'Boss'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? toTitleCase("Edit Record") : toTitleCase(editedNPC.name)}>
            {!isEditing ? (
                <NPCViewContent
                    npc={editedNPC}
                    onEdit={() => setIsEditing(true)}
                    onInvite={handleInvite}
                    isInviting={isInviting}
                />
            ) : (
                <div className="space-y-8 pb-4 animate-page">
                    <div className="bg-brand-primary/10 p-5 rounded-2xl border border-brand-surface shadow-inner">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-xs font-bold text-brand-text-muted tracking-normal">Relationship Adjustment</label>
                            <span className="text-body-sm font-bold text-brand-accent tabular-nums">
                                {editedNPC.relationship > 0 ? '+' : ''}{editedNPC.relationship}
                            </span>
                        </div>
                        <input
                            type="range" min="-50" max="50" step="1"
                            value={editedNPC.relationship}
                            onChange={(e) => handleChange('relationship', parseInt(e.target.value))}
                            className="w-full h-1.5 bg-brand-secondary rounded-full appearance-none cursor-pointer accent-brand-accent mb-2"
                        />
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-brand-primary/30 rounded-2xl border border-brand-surface shadow-inner">
                            <div className="flex flex-col">
                                <span className="text-body-base font-bold text-brand-text">{toTitleCase("Essential Status")}</span>
                                <span className="text-[10px] text-brand-text-muted italic">Essential NPCs are prioritized in the social ledger.</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={editedNPC.is_essential || false}
                                onChange={(e) => handleChange('is_essential', e.target.checked)}
                                className="custom-checkbox w-5 h-5"
                            />
                        </div>

                        <StyledInputGroup label="Full Name">
                            <input type="text" value={editedNPC.name} onChange={(e) => handleChange('name', e.target.value)} className={inputClass} />
                        </StyledInputGroup>

                        <div className="grid grid-cols-3 gap-4">
                            <StyledInputGroup label="Ancestry">
                                <div className="relative">
                                    <select
                                        value={availableRaces.includes(editedNPC.race || '') ? editedNPC.race : 'Other'}
                                        onChange={(e) => handleChange('race', e.target.value === 'Other' ? '' : e.target.value)}
                                        className={selectClass}
                                    >
                                        {availableRaces.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                                        <Icon name="chevronDown" className="w-4 h-4" />
                                    </div>
                                </div>
                            </StyledInputGroup>
                            <StyledInputGroup label="Gender">
                                <div className="relative">
                                    <select
                                        value={genderOptions.includes(editedNPC.gender || '') ? editedNPC.gender : 'Other'}
                                        onChange={(e) => handleChange('gender', e.target.value === 'Other' ? '' : e.target.value)}
                                        className={selectClass}
                                    >
                                        {genderOptions.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                                        <Icon name="chevronDown" className="w-4 h-4" />
                                    </div>
                                </div>
                            </StyledInputGroup>
                            <StyledInputGroup label="Status">
                                <div className="relative">
                                    <select
                                        value={editedNPC.status || 'Alive'}
                                        onChange={(e) => handleChange('status', e.target.value)}
                                        className={selectClass}
                                    >
                                        {['Alive', 'Dead', 'Unknown'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-text-muted">
                                        <Icon name="chevronDown" className="w-4 h-4" />
                                    </div>
                                </div>
                            </StyledInputGroup>
                        </div>

                        <StyledInputGroup label="Physical Appearance">
                            <AutoResizingTextarea value={editedNPC.appearance || ''} onChange={(e) => handleChange('appearance', e.target.value)} className={`${textareaClass} min-h-[80px]`} />
                        </StyledInputGroup>

                        <StyledInputGroup label="History and Background">
                            <AutoResizingTextarea value={editedNPC.description || ''} onChange={(e) => handleChange('description', e.target.value)} className={`${textareaClass} min-h-[100px]`} />
                        </StyledInputGroup>

                        <div className="bg-brand-primary/5 p-5 rounded-2xl border border-brand-primary/20 space-y-5">
                            <h5 className="text-xs font-bold text-brand-text-muted mb-2 opacity-60">Alignment Disposition</h5>
                            <div className="grid grid-cols-2 gap-4">
                                <StyledInputGroup label="Moral Alignment (Good/Evil)">
                                    <div className="relative">
                                        <select
                                            value={getGoodEvilLabel(editedNPC.moralAlignment?.goodEvil || 0)}
                                            onChange={(e) => {
                                                const match = GOOD_EVIL_ALIASES.find(a => a.label === e.target.value);
                                                if (match) handleChange('moralAlignment', { ...editedNPC.moralAlignment, goodEvil: match.value, lawChaos: editedNPC.moralAlignment?.lawChaos || 0 });
                                            }}
                                            className={`${selectClass} h-10 text-sm`}
                                        >
                                            {GOOD_EVIL_ALIASES.map(a => <option key={a.value} value={a.label}>{toTitleCase(a.label)}</option>)}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"><Icon name="chevronDown" className="w-3.5 h-3.5" /></div>
                                    </div>
                                </StyledInputGroup>
                                <StyledInputGroup label="Ethical Alignment (Law/Chaos)">
                                    <div className="relative">
                                        <select
                                            value={getLawChaosLabel(editedNPC.moralAlignment?.lawChaos || 0)}
                                            onChange={(e) => {
                                                const match = LAW_CHAOS_ALIASES.find(a => a.label === e.target.value);
                                                if (match) handleChange('moralAlignment', { ...editedNPC.moralAlignment, lawChaos: match.value, goodEvil: editedNPC.moralAlignment?.goodEvil || 0 });
                                            }}
                                            className={`${selectClass} h-10 text-sm`}
                                        >
                                            {LAW_CHAOS_ALIASES.map(a => <option key={a.value} value={a.label}>{toTitleCase(a.label)}</option>)}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"><Icon name="chevronDown" className="w-3.5 h-3.5" /></div>
                                    </div>
                                </StyledInputGroup>
                            </div>
                        </div>
                    </div>

                    <div className="bg-brand-primary/10 p-5 rounded-2xl border border-brand-surface shadow-inner">
                        <div className="flex justify-between items-center mb-4">
                            <h5 className="text-xs font-bold text-brand-text-muted opacity-60">Spatial Registry</h5>
                            <div className="flex items-center gap-2 bg-brand-primary/20 px-3 py-1.5 rounded-xl border border-brand-surface">
                                <span className="text-[10px] font-bold text-brand-text-muted">Presence:</span>
                                <select 
                                    value={editedNPC.presenceMode || 'Physical'} 
                                    onChange={(e) => handleChange('presenceMode', e.target.value)}
                                    className="bg-transparent text-[10px] font-bold text-brand-accent focus:outline-none cursor-pointer"
                                >
                                    <option value="Physical" className="text-black">Physical</option>
                                    <option value="Remote" className="text-black">Remote</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <StyledInputGroup label="Last Visited Zone">
                                <div className="relative">
                                    <select
                                        value={editedNPC.location || ''}
                                        onChange={(e) => handleChange('location', e.target.value)}
                                        className={`${selectClass} h-10 text-sm pr-8`}
                                    >
                                        <option value="">Uncharted</option>
                                        {visitedZones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"><Icon name="chevronDown" className="w-3.5 h-3.5" /></div>
                                </div>
                            </StyledInputGroup>
                            <StyledInputGroup label="Specific Locale">
                                <div className="relative">
                                    <select
                                        value={editedNPC.currentPOI || ''}
                                        onChange={(e) => handleChange('currentPOI', e.target.value)}
                                        disabled={!editedNPC.location}
                                        className={`${selectClass} h-10 text-sm pr-8 disabled:opacity-30`}
                                    >
                                        <option value="">General area</option>
                                        {localPois.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"><Icon name="chevronDown" className="w-3.5 h-3.5" /></div>
                                </div>
                            </StyledInputGroup>
                        </div>
                    </div>

                    {!editedNPC.companionId && (
                        <div className="bg-brand-primary/10 p-5 rounded-2xl border border-brand-surface shadow-inner">
                            <h5 className="text-xs font-bold text-brand-text-muted mb-4 opacity-60">Mechanical Blueprints</h5>
                            <div className="flex flex-wrap gap-3">
                                <PillSelect label="Difficulty" value={currentDifficultyTag} onChange={handleDifficultyPresetChange} options={difficultyPresets} colorClass="bg-brand-danger/10 text-brand-danger border-brand-danger/20" />
                                <PillSelect label="Size" value={editedNPC.size || 'Medium'} onChange={(val) => handleChange('size', val)} options={sizes} colorClass="bg-blue-400/10 text-blue-400 border-blue-400/20" />
                                <PillSelect label="Role" value={editedNPC.template || 'Brute'} onChange={(val) => handleChange('template', val)} options={templates} colorClass="bg-purple-400/10 text-purple-400 border-purple-400/20" />
                                <PillSelect label="Affinity" value={editedNPC.affinity || 'None'} onChange={(val) => handleChange('affinity', val)} options={['None', ...affinities]} colorClass="bg-orange-400/10 text-orange-400 border-orange-400/20" />
                                <PillSelect label="Archetype" value={editedNPC.archetype || 'Bipedal'} onChange={(val) => handleChange('archetype', val)} options={ARCHETYPE_NAMES} colorClass="bg-teal-400/10 text-teal-400 border-teal-400/20" />
                            </div>
                        </div>
                    )}

                     <div className="flex justify-between items-center pt-10 border-t border-brand-primary/20 gap-4">
                        <Button
                            onClick={handleDelete}
                            variant="danger"
                            icon="trash"
                        >
                            Purge Record
                        </Button>
                        <div className="flex gap-3 flex-1">
                            <Button
                                onClick={() => setIsEditing(false)}
                                variant="tertiary"
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={!isDirty}
                                variant="primary"
                                className="flex-1"
                            >
                                Commit Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default NPCDetailsModal;

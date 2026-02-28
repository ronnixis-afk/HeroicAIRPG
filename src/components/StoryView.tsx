// components/StoryView.tsx

import React, { useContext, useState, useMemo, useEffect } from 'react';
import Accordion from './Accordion';
import { GameDataContext } from '../context/GameDataContext';
import type { StoryLog } from '../types';
import { Icon } from './Icon';

const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const NewTag: React.FC = () => (
    <span className="bg-brand-accent text-black text-[9px] font-black px-1.5 py-0.5 rounded ml-2 flex-shrink-0">New</span>
);

const StoryEditableContent: React.FC<{ log: StoryLog; onFinish: () => void }> = ({ log, onFinish }) => {
    const { updateStoryLog } = useContext(GameDataContext);
    const [content, setContent] = useState(log.content);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setContent(log.content);
    }, [log.content]);

    const handleSave = async () => {
        if (content !== log.content) {
            setIsSaving(true);
            await updateStoryLog({ ...log, content });
            setIsSaving(false);
        }
        onFinish();
    };

    return (
        <div className="mt-4 animate-fade-in">
            <div className="mb-3 p-3 bg-brand-primary/20 rounded-xl border border-brand-surface/50 shadow-inner">
                <span className="text-body-sm font-bold text-brand-accent">Memory summary:</span>
                <p className="text-body-sm text-brand-text-muted italic mt-1">{log.summary || 'No summary available.'}</p>
            </div>
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="w-full bg-brand-primary p-4 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent mb-4 text-body-sm leading-relaxed shadow-inner"
                autoFocus
            />
            <div className="flex justify-end gap-3">
                <button
                    onClick={onFinish}
                    className="btn-tertiary btn-sm"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn-primary btn-md min-w-[100px]"
                >
                    {isSaving ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : 'Save entry'}
                </button>
            </div>
        </div>
    );
};

const StoryView: React.FC = () => {
    const { gameData, summarizeDayLog, summarizePastStoryLogs, deleteStoryLog, markStoryLogAsSeen } = useContext(GameDataContext);
    const [openDayIds, setOpenDayIds] = useState<Record<string, boolean>>({});
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [summarizingDay, setSummarizingDay] = useState<string | null>(null);
    const [isSummarizingPast, setIsSummarizingPast] = useState(false);

    const getLogDateGroup = (timestamp: string) => {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
        const lastCommaIndex = timestamp.lastIndexOf(',');
        return lastCommaIndex !== -1 ? timestamp.substring(0, lastCommaIndex).trim() : timestamp;
    };

    const getTimeOnly = (timestamp: string) => {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        const parts = timestamp.split(',');
        return parts.length > 1 ? parts[parts.length - 1].trim() : timestamp;
    };

    const groupedLogs = useMemo(() => {
        if (!gameData?.story) return {};

        const sortedStory = [...gameData.story].sort((a, b) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            if (isNaN(dateA)) return -1;
            if (isNaN(dateB)) return 1;
            return dateA - dateB;
        });

        return sortedStory.reduce((acc, log) => {
            if (!log.timestamp) return acc;
            const day = getLogDateGroup(log.timestamp);
            if (!acc[day]) acc[day] = [];
            acc[day].push(log);
            return acc;
        }, {} as Record<string, StoryLog[]>);
    }, [gameData?.story]);

    const sortedDays = useMemo(() => Object.keys(groupedLogs).sort((a, b) => {
        const dateA = new Date(a).getTime();
        const dateB = new Date(b).getTime();
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
    }), [groupedLogs]);

    const canSummarizePast = useMemo(() => {
        if (!gameData?.story) return false;
        const calendarDays = new Set<string>();
        gameData.story.forEach(log => {
            if (!log.timestamp) return;
            const dayKey = getLogDateGroup(log.timestamp);
            if (dayKey) calendarDays.add(dayKey);
        });
        return calendarDays.size > 1;
    }, [gameData?.story]);

    useEffect(() => {
        if (sortedDays.length > 0) {
            const newestDay = sortedDays[0];
            if (openDayIds[newestDay] === undefined) {
                setOpenDayIds(prev => ({ ...prev, [newestDay]: true }));
            }
        }
    }, [sortedDays]);

    const handleDayToggle = (day: string) => {
        const isOpening = !openDayIds[day];
        if (isOpening) {
            groupedLogs[day].forEach(log => {
                if (log.isNew) markStoryLogAsSeen(log.id);
            });
        }
        setOpenDayIds(prev => ({ ...prev, [day]: isOpening }));
    };

    const handleSummarizeDay = async (day: string, dayEntries: StoryLog[], previousDayEntries: StoryLog[]) => {
        if (window.confirm(`Are you sure you want to summarize this day? The ${dayEntries.length} individual entries will be replaced by a single summary. This cannot be undone.`)) {
            setSummarizingDay(day);
            try {
                await summarizeDayLog(day, dayEntries, previousDayEntries);
            } catch (error) {
                console.error("Failed to summarize day:", error);
            } finally {
                setSummarizingDay(null);
            }
        }
    };

    const handleSummarizePast = async () => {
        if (window.confirm("Are you sure you want to summarize all past logs?")) {
            setIsSummarizingPast(true);
            try {
                await summarizePastStoryLogs();
            } catch (error) {
                console.error("Failed to summarize past logs:", error);
            } finally {
                setIsSummarizingPast(false);
            }
        }
    };

    const handleDeleteLog = (logId: string) => {
        if (window.confirm("Delete this story entry?")) {
            deleteStoryLog(logId);
        }
    };

    const handleLogClick = (log: StoryLog) => {
        if (log.isNew) markStoryLogAsSeen(log.id);
        setEditingLogId(log.id);
    };

    if (!gameData) return <div className="text-center p-8 text-body-base text-brand-text-muted animate-pulse">Loading chronicle...</div>;

    return (
        <div className="p-2 pt-8 max-w-2xl mx-auto pb-24">
            <div className="text-center mb-10 pb-6 border-b border-brand-primary/20">
                <h1 className="text-brand-text mb-2">The Chronicle</h1>
                <p className="text-body-sm text-brand-text-muted font-medium italic">
                    The evolving chronicle of your journey through the realms.
                </p>
            </div>

            {sortedDays.length > 0 ? (
                <div className="space-y-6">
                    {sortedDays.map((day, index) => {
                        const dayLogs = groupedLogs[day];
                        const displayLogs = [...dayLogs].reverse();
                        const hasNewInDay = dayLogs.some(l => l.isNew);
                        const previousDayIndex = index + 1;
                        const previousDayKey = sortedDays[previousDayIndex];
                        const previousDayLogs = previousDayKey ? groupedLogs[previousDayKey] : [];

                        return (
                            <Accordion
                                key={day}
                                title={
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-brand-text tracking-tight">{day}</span>
                                        {hasNewInDay && <NewTag />}
                                    </div>
                                }
                                isOpen={!!openDayIds[day]}
                                onToggle={() => handleDayToggle(day)}
                            >
                                <div className="animate-page">
                                    <div className="space-y-10 border-l-2 border-brand-primary/30 pl-6 py-4 ml-2">
                                        {displayLogs.map(log => (
                                            <div key={log.id} className="relative group">
                                                {/* Visual indicator dot */}
                                                <div className={`absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-brand-bg border-2 z-10 transition-all duration-500 ${log.isNew ? 'border-brand-accent shadow-[0_0_12px_rgba(62,207,142,0.6)] scale-110' : 'border-brand-primary group-hover:border-brand-text-muted/40'}`} />

                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <span className="text-body-sm font-black text-brand-accent">{getTimeOnly(log.timestamp)}</span>
                                                        <span className="text-[10px] font-bold text-brand-text-muted opacity-60 flex items-center gap-1.5">
                                                            <Icon name="location" className="w-3 h-3" />
                                                            {toTitleCase(log.location)} {log.locale ? `• ${toTitleCase(log.locale)}` : ''}
                                                        </span>
                                                        {log.isNew && <NewTag />}
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleLogClick(log)}
                                                            className="btn-icon p-1 text-brand-text-muted hover:text-brand-accent"
                                                            title="Edit entry"
                                                        >
                                                            <Icon name="edit" className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteLog(log.id)}
                                                            className="btn-icon p-1 text-brand-text-muted hover:text-brand-danger"
                                                            title="Delete entry"
                                                        >
                                                            <Icon name="trash" className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {editingLogId === log.id ? (
                                                    <StoryEditableContent log={log} onFinish={() => setEditingLogId(null)} />
                                                ) : (
                                                    <div
                                                        className={`text-body-sm leading-relaxed whitespace-pre-wrap cursor-pointer transition-colors ${log.isNew ? 'text-brand-text font-medium' : 'text-brand-text-muted hover:text-brand-text'}`}
                                                        onClick={() => handleLogClick(log)}
                                                    >
                                                        {log.summary || log.content}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {dayLogs.length > 1 && day !== 'Story progress' && (
                                        <div className="mt-6 pt-4 border-t border-brand-primary/10 flex justify-end">
                                            <button
                                                onClick={() => handleSummarizeDay(day, dayLogs, previousDayLogs)}
                                                disabled={summarizingDay === day}
                                                className="btn-tertiary btn-sm gap-2"
                                            >
                                                {summarizingDay === day ? <Icon name="spinner" className="w-3.5 h-3.5 animate-spin" /> : <Icon name="code" className="w-3.5 h-3.5" />}
                                                Seal Chapter
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </Accordion>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 bg-brand-surface/20 rounded-3xl border-2 border-dashed border-brand-primary/30">
                    <Icon name="story" className="w-16 h-16 mb-4 text-brand-text-muted opacity-20" />
                    <p className="text-body-lg text-brand-text-muted italic">The first pages of your legend are waiting.</p>
                    <p className="text-body-sm text-brand-text-muted opacity-60 mt-2">Begin your journey to populate the chronicle.</p>
                </div>
            )}

            {canSummarizePast && (
                <div className="mt-16 flex justify-center border-t border-brand-primary/10 pt-8">
                    <button
                        onClick={handleSummarizePast}
                        disabled={isSummarizingPast}
                        className="btn-tertiary btn-sm gap-2 opacity-60 hover:opacity-100"
                    >
                        {isSummarizingPast ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : <Icon name="boxDrawer" className="w-4 h-4" />}
                        Archive Ancient Lore
                    </button>
                </div>
            )}
        </div>
    );
};

export default StoryView;

import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { useUser } from '@clerk/nextjs';

interface AdminConsumptionData {
    logs: any[];
    stats: {
        totalCostUsd: number;
        totalTodayCostUsd: number;
        totalTokens: number;
        totalInputTokens: number;
        totalOutputTokens: number;
    };
    filters: {
        types: string[];
        models: string[];
    };
}

const AdminConsumptionDashboard: React.FC = () => {
    const { user, isLoaded } = useUser();
    const [data, setData] = useState<AdminConsumptionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('');
    const [modelFilter, setModelFilter] = useState('');
    const [period, setPeriod] = useState('today');

    const fetchConsumption = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (typeFilter) params.append('type', typeFilter);
            if (modelFilter) params.append('model', modelFilter);
            params.append('period', period);

            const res = await fetch(`/api/admin/consumption?${params.toString()}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (e) {
            console.error("Failed to fetch consumption data:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isLoaded && user) {
            fetchConsumption();
        }
    }, [isLoaded, user, typeFilter, modelFilter, period]);

    if (!isLoaded || loading) {
        return (
            <div className="min-h-screen bg-[#0c1114] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Dynamic types and models from API
    const availableTypes = data?.filters?.types || [];
    const availableModels = data?.filters?.models || [];

    return (
        <div className="h-screen bg-[#0c1114] text-brand-text overflow-y-auto inter custom-scroll">
            <div className="max-w-6xl mx-auto p-4 md:p-8">
                <button 
                    onClick={() => window.location.href = '/'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-primary/20 hover:bg-brand-primary/20 transition-all text-xs font-bold text-brand-text-muted hover:text-brand-text mb-6"
                >
                    <Icon name="arrowLeft" className="w-3.5 h-3.5" />
                    Back
                </button>
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-brand-text mb-1 tracking-tight">Admin Consumption Dashboard</h3>
                        <p className="text-brand-text-muted text-xs">Monitor AI Usage and Real-Time Infrastructure Costs</p>
                    </div>
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-brand-surface border border-brand-primary/20 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4 text-brand-accent">
                            <Icon name="currencyCoins" className="w-5 h-5" />
                            <span className="text-xs font-black tracking-wide opacity-60">Total Cost</span>
                        </div>
                        <div className="text-3xl font-bold text-brand-text mb-1">${data?.stats.totalCostUsd.toFixed(4) || '0.0000'}</div>
                        <div className="text-[10px] text-brand-text-muted">Lifetime Expenditure in USD</div>
                    </div>

                    <div className="bg-brand-surface border border-brand-primary/20 rounded-2xl p-6 shadow-xl border-t-green-500/30">
                        <div className="flex items-center gap-3 mb-4 text-green-400">
                            <Icon name="sparkles" className="w-5 h-5" />
                            <span className="text-xs font-black tracking-wide opacity-60">Period Cost</span>
                        </div>
                        <div className="text-3xl font-bold text-brand-text mb-1">${data?.stats.totalTodayCostUsd.toFixed(4) || '0.0000'}</div>
                        <div className="text-[10px] text-brand-text-muted">Total Cost For Selected Period</div>
                    </div>

                    <div className="bg-brand-surface border border-brand-primary/20 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4 text-blue-400">
                            <Icon name="status" className="w-5 h-5" />
                            <span className="text-xs font-black tracking-wide opacity-60">Total Tokens</span>
                        </div>
                        <div className="text-3xl font-bold text-brand-text mb-1">{(data?.stats.totalTokens ? data.stats.totalTokens / 1000000 : 0).toFixed(2)}M</div>
                        <div className="text-[10px] text-brand-text-muted">Total Volume In and Out</div>
                    </div>

                    <div className="bg-brand-surface border border-brand-primary/20 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4 text-purple-400">
                            <Icon name="users" className="w-5 h-5" />
                            <span className="text-xs font-black tracking-wide opacity-60">Period Activity</span>
                        </div>
                        <div className="text-3xl font-bold text-brand-text mb-1">{data?.logs.length || 0}</div>
                        <div className="text-[10px] text-brand-text-muted">Interactions In This Period</div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    {/* Period Selector */}
                    <div className="flex bg-brand-surface border border-brand-primary/10 rounded-2xl p-1.5 shadow-lg h-14 items-center">
                        {['today', 'week', 'month'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-6 h-full rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    period === p 
                                    ? 'bg-brand-accent text-black shadow-lg shadow-brand-accent/20' 
                                    : 'text-brand-text-muted hover:text-brand-text'
                                }`}
                            >
                                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Today'}
                            </button>
                        ))}
                    </div>

                    {/* Dropdown Filters */}
                    <div className="flex-1 bg-brand-surface border border-brand-primary/10 rounded-2xl p-4 md:p-1.5 flex flex-col md:flex-row gap-2 shadow-lg items-center">
                        <div className="md:px-4 text-[10px] font-black text-brand-accent/40 uppercase tracking-widest hidden md:block">
                            Filters
                        </div>
                        <select 
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-[#0c1114] border border-brand-primary/20 rounded-xl px-4 h-11 text-xs text-brand-text focus:outline-none focus:border-brand-accent transition-colors cursor-pointer w-full md:w-auto md:min-w-[180px]"
                        >
                            <option value="">All Call Types</option>
                            {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>

                        <select 
                            value={modelFilter}
                            onChange={(e) => setModelFilter(e.target.value)}
                            className="bg-[#0c1114] border border-brand-primary/20 rounded-xl px-4 h-11 text-xs text-brand-text focus:outline-none focus:border-brand-accent transition-colors cursor-pointer w-full md:w-auto md:min-w-[180px]"
                        >
                            <option value="">All AI Models</option>
                            {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>

                        {(typeFilter || modelFilter) && (
                            <button 
                                onClick={() => { setTypeFilter(''); setModelFilter(''); }}
                                className="px-4 text-[10px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest transition-colors"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Log Table */}
                <div className="bg-brand-surface border border-brand-primary/10 rounded-2xl shadow-2xl overflow-hidden mb-20">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-brand-primary/5 border-b border-brand-primary/20">
                                    <th className="p-4 text-xs font-black tracking-wide text-brand-text-muted">Timestamp</th>
                                    <th className="p-4 text-xs font-black tracking-wide text-brand-text-muted">User Email</th>
                                    <th className="p-4 text-xs font-black tracking-wide text-brand-text-muted">Activity Type</th>
                                    <th className="p-4 text-xs font-black tracking-wide text-brand-text-muted">Model Used</th>
                                    <th className="p-4 text-xs font-black tracking-wide text-brand-text-muted text-right">Duration</th>
                                    <th className="p-4 text-xs font-black tracking-wide text-brand-text-muted text-right">Tokens</th>
                                    <th className="p-4 text-xs font-black tracking-wide text-brand-text-muted text-right">Estimated Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.logs.map((log) => (
                                    <tr key={log.id} className="border-b border-brand-primary/5 hover:bg-brand-primary/5 transition-colors group">
                                        <td className="p-4 text-xs text-brand-text-muted">
                                            {new Date(log.createdAt).toLocaleDateString()} <br/>
                                            <span className="opacity-50">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="p-4 text-xs font-medium text-brand-text truncate max-w-[150px]">{log.email}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 rounded-md bg-brand-primary/10 text-[10px] font-bold text-brand-accent border border-brand-primary/10">
                                                {log.type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[10px] font-medium text-brand-text-muted opacity-80">{log.model}</td>
                                        <td className="p-4 text-right text-xs font-mono text-brand-text-muted">
                                            {(log.durationMs / 1000).toFixed(1)}s
                                        </td>
                                        <td className="p-4 text-right text-xs">
                                            <div className="font-bold text-brand-text">{(log.totalTokens / 1000).toFixed(1)}k</div>
                                            <div className="text-[9px] opacity-40">In: {(log.inputTokens/1000).toFixed(1)}k | Out: {(log.outputTokens/1000).toFixed(1)}k</div>
                                        </td>
                                        <td className="p-4 text-right text-sm font-bold text-green-400 group-hover:scale-110 transition-transform origin-right">
                                            ${log.costUsd.toFixed(5)}
                                        </td>
                                    </tr>
                                ))}
                                {(!data?.logs || data.logs.length === 0) && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-brand-text-muted italic opacity-50">
                                            No Consumption Records Found matching these filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminConsumptionDashboard;

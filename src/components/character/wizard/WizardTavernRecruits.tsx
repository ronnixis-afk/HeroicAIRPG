import React from 'react';
import { Icon } from '../../Icon';

interface WizardTavernRecruitsProps {
    recruits: any[];
    isLoading: boolean;
    onSelect: (recruit: any) => void;
    onCancel: () => void;
}

const RecruitCardShimmer = () => (
    <div className="p-5 bg-brand-surface border border-brand-primary rounded-2xl relative overflow-hidden h-48">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-primary/20 to-transparent -translate-x-full animate-shimmer" />
        <div className="flex justify-between items-start mb-4">
            <div className="space-y-2 flex-1">
                <div className="h-4 bg-brand-primary rounded w-3/4"></div>
                <div className="h-2 bg-brand-primary rounded w-1/2"></div>
            </div>
            <div className="h-5 bg-brand-primary rounded w-10"></div>
        </div>
        <div className="space-y-2 mb-6">
            <div className="h-2 bg-brand-primary rounded w-full"></div>
            <div className="h-2 bg-brand-primary rounded w-5/6"></div>
        </div>
        <div className="flex gap-2">
            <div className="h-4 bg-brand-primary rounded-full w-20"></div>
            <div className="h-4 bg-brand-primary rounded-full w-16"></div>
        </div>
        <style>{`
            @keyframes shimmer {
                100% { transform: translateX(100%); }
            }
            .animate-shimmer {
                animation: shimmer 1.5s infinite linear;
            }
        `}</style>
    </div>
);

export const WizardTavernRecruits: React.FC<WizardTavernRecruitsProps> = ({ recruits, isLoading, onSelect, onCancel }) => {
    return (
        <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
            <div className="text-center mb-8 shrink-0">
                <h2 className="text-2xl font-bold text-brand-text">The Tavern Bounty</h2>
                <p className="text-xs text-brand-text-muted italic">Six willing souls await your command.</p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scroll px-1">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                        {[...Array(6)].map((_, i) => <RecruitCardShimmer key={i} />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                        {recruits.map((recruit, idx) => (
                            <button
                                key={idx}
                                onClick={() => onSelect(recruit)}
                                className="text-left p-5 bg-brand-surface border border-brand-primary rounded-2xl transition-all hover:border-brand-accent group flex flex-col"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-base font-bold text-brand-text group-hover:text-brand-accent truncate">{recruit.name}</h4>
                                        <p className="text-[10px] font-bold text-brand-text-muted opacity-60 capitalize">{recruit.gender} {recruit.race}</p>
                                    </div>
                                    <div className="bg-brand-accent/10 border border-brand-accent/20 px-2 py-0.5 rounded text-[9px] font-bold text-brand-accent">Ally</div>
                                </div>
                                
                                <div className="flex-1">
                                    <p className="text-xs text-brand-text-muted italic leading-relaxed line-clamp-2 mb-2">"{recruit.description}"</p>
                                    <p className="text-[10px] text-brand-accent font-bold mb-4">Quirk: <span className="text-brand-text">{recruit.personality}</span></p>
                                </div>
                                
                                <div className="space-y-3 mt-auto">
                                    <div>
                                        <label className="text-[8px] font-bold text-brand-text-muted opacity-40 block mb-1">Prowess</label>
                                        <span className="text-[10px] font-bold text-purple-400 bg-purple-900/10 border border-purple-500/20 px-2.5 py-1 rounded-full">{recruit.comSeed.name}</span>
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-bold text-brand-text-muted opacity-40 block mb-1">Expertise</label>
                                        <div className="flex flex-wrap gap-1">
                                            {[...recruit.bgSeeds, ...recruit.genSeeds].flatMap(t => t.buffs || [])
                                                .filter(b => b.type === 'skill')
                                                .map((b, i) => (
                                                    <span key={i} className="text-[9px] font-bold text-brand-accent bg-brand-accent/5 border border-brand-accent/10 px-2 py-0.5 rounded-md capitalize">{b.skillName}</span>
                                                ))
                                            }
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="pt-6 flex justify-center shrink-0">
                <button onClick={onCancel} className="btn-tertiary btn-sm">Cancel</button>
            </div>
        </div>
    );
};
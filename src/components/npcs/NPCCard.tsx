import React from 'react';
import { NPC } from '../../types';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { toTitleCase, getRaceColor, getGenderColor, getRelationshipLabel } from '../../utils/npcUtils';

interface NPCCardProps {
    npc: NPC;
    onDelete?: (id: string) => void;
    onClick?: (npc: NPC) => void;
}

const NPCCard: React.FC<NPCCardProps> = ({ npc, onDelete, onClick }) => {
    const isDead = npc.status?.toLowerCase() === 'dead';
    const relationshipData = getRelationshipLabel(npc.relationship);

    const handleClick = (e: React.MouseEvent) => {
        if (onClick) {
            onClick(npc);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`min-h-[88px] w-full border-2 rounded-2xl flex items-center px-5 gap-5 transition-all duration-300 group relative overflow-hidden cursor-pointer ${isDead
                ? 'bg-brand-primary/10 border-brand-primary/30 grayscale opacity-60'
                : 'bg-brand-surface border-brand-primary/50 hover:border-brand-accent/30 hover:bg-brand-surface-raised hover:shadow-xl'
                }`}
        >
            {/* Background Glow Effect */}
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-accent/5 rounded-full blur-2xl group-hover:bg-brand-accent/10 transition-all duration-500" />

            {/* Text Content */}
            <div className="flex-grow flex flex-col justify-center min-w-0 h-full py-3 relative z-10">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h5 className={`mb-0 leading-tight transition-colors ${isDead ? 'text-brand-text-muted' : 'text-brand-text group-hover:text-brand-accent'}`}>
                        {toTitleCase(npc.name)}
                    </h5>

                    {npc.isNew && (
                        <span className="bg-brand-accent text-black text-[10px] px-2 py-0.5 rounded-lg shadow-sm animate-pulse font-bold">
                            New
                        </span>
                    )}

                    {isDead && (
                        <span className="text-[10px] bg-brand-danger/10 text-brand-danger px-2 py-0.5 rounded-lg border border-brand-danger/20 font-bold">
                            Deceased
                        </span>
                    )}

                    {npc.companionId && !isDead && (
                        <span className="text-[10px] bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded-lg border border-brand-accent/20 font-bold">
                            Companion
                        </span>
                    )}
                </div>

                {/* Gender, Race and Relationship Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {npc.gender && (
                            <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold ${getGenderColor(npc.gender)}`}>
                                {toTitleCase(npc.gender)}
                            </span>
                        )}
                        {npc.race && (
                            <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold ${getRaceColor(npc.race)}`}>
                                {toTitleCase(npc.race)}
                            </span>
                        )}
                    </div>

                    <div className={`flex items-center gap-1.5 text-[10px] font-bold transition-opacity duration-300 ${isDead ? 'opacity-40' : 'opacity-100'}`}>
                        <span className="text-brand-accent tabular-nums bg-brand-accent/5 px-2 py-1 rounded-lg border border-brand-accent/20">
                            {npc.relationship > 0 ? `+${npc.relationship}` : npc.relationship}
                        </span>
                        <span className="text-brand-text-muted text-[9px]">
                            {relationshipData.label}
                        </span>
                    </div>
                </div>
            </div>

            {onDelete && !npc.companionId && (
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <Button
                        variant="danger"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(npc.id);
                        }}
                        className="w-8 h-8 rounded-xl shadow-lg"
                        aria-label="Delete acquaintance"
                    >
                        <Icon name="trash" className="w-3.5 h-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default NPCCard;

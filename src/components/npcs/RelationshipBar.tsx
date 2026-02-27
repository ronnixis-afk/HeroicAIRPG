import React from 'react';
import { getRelationshipLabel } from '../../utils/npcUtils';

interface RelationshipBarProps {
    value: number; // -50 to 50
}

const RelationshipBar: React.FC<RelationshipBarProps> = ({ value }) => {
    // Normalize -50..50 to 0..100 for width
    const percent = Math.min(100, Math.max(0, value + 50));
    const { label, color } = getRelationshipLabel(value);

    return (
        <div className="w-full">
            <div className="h-1.5 w-full bg-brand-surface rounded-full overflow-hidden mb-1 relative border border-white/5">
                {/* Center marker for Neutral */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-brand-bg z-10 opacity-30"></div>
                
                <div 
                    className={`h-full transition-all duration-700 ease-out ${color} shadow-[0_0_8px_rgba(0,0,0,0.3)]`} 
                    style={{ width: `${percent}%` }}
                />
            </div>
            <div className="flex justify-between items-center text-body-sm font-bold tracking-normal">
                <span className="text-brand-text-muted">{label}</span>
                <span className="text-brand-accent tabular-nums">{value > 0 ? `+${value}` : value}</span>
            </div>
        </div>
    );
};

export default RelationshipBar;
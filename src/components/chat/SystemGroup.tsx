import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { Icon } from '../Icon';
import { EntityLinker } from './EntityLinker';

const SystemMessage: React.FC<{ text: string }> = ({ text }) => {
    if (!text || typeof text !== 'string') return null;
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return (
        <span className="whitespace-pre-wrap">
            {parts.map((part, i) => {
                if (!part) return null;
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <span key={i} className="font-bold"><EntityLinker text={part.slice(2, -2)} /></span>;
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                    return <span key={i} className="italic"><EntityLinker text={part.slice(1, -1)} /></span>;
                }
                return <EntityLinker key={i} text={part} />;
            })}
        </span>
    );
};

export const SystemMessageGroup: React.FC<{ messages: ChatMessage[] }> = ({ messages }) => {
    const [isOpen, setIsOpen] = useState(false);
    if (messages.length === 0) return null;

    return (
        <div className="w-full flex flex-col items-center my-3 animate-fade-in px-4">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-4 focus:outline-none py-1 group"
            >
                {/* Leading Line */}
                <div className="flex-1 h-[1px] bg-brand-primary/20 transition-colors group-hover:bg-brand-accent/30" />
                
                {/* Title Content - Applied very subtle color to match line */}
                <div className="flex items-center gap-1.5 flex-shrink-0 text-brand-text-muted/30 group-hover:text-brand-accent transition-colors">
                    <Icon 
                        name="chevronDown" 
                        className={`w-2.5 h-2.5 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'} opacity-60 group-hover:opacity-100`} 
                    />
                    <span className="text-body-sm font-bold tracking-normal">Logs ({messages.length})</span>
                </div>

                {/* Trailing Line */}
                <div className="flex-1 h-[1px] bg-brand-primary/20 transition-colors group-hover:bg-brand-accent/30" />
            </button>
            
            {isOpen && (
                <div className="w-full mt-2 space-y-1 animate-fade-in">
                    {messages.map(msg => {
                        return (
                            <div key={msg.id} className={`text-body-sm font-normal text-center leading-tight text-brand-text-muted`}>
                                <SystemMessage text={msg.content || ''} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
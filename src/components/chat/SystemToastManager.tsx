import React, { useState, useEffect, useContext } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import { ChatMessage } from '../../types';

interface Toast {
    id: string;
    title: string;
    message: string;
    type: 'inventory' | 'roll' | 'level' | 'xp' | 'general' | 'combat';
}

export const SystemToastManager: React.FC = () => {
    const { gameData } = useContext(GameDataContext);
    const { setActiveView } = useUI();
    const [toasts, setToasts] = useState<Toast[]>([]);
    
    // We only care about messages changing
    const messages = gameData?.messages || [];

    useEffect(() => {
        if (messages.length === 0) return;

        // Get the very last message
        const lastMessage = messages[messages.length - 1];

        // Check if it's a system message.
        // Prevent triggering on historic logs by ensuring it was added recently based on timestamp
        // or just rely on the fact that this effect runs when messages update and we grab the tip.
        // We need a ref to track the last processed message ID to prevent infinite loops or duplicates on re-renders.
        if (lastMessage.sender === 'system') {
            processSystemMessage(lastMessage);
        }
    }, [messages]);

    // To prevent duplicate toasts across renders if the last message hasn't changed.
    const [lastProcessedMsgId, setLastProcessedMsgId] = useState<string | null>(null);

    const processSystemMessage = (msg: ChatMessage) => {
        if (msg.id === lastProcessedMsgId) return;
        setLastProcessedMsgId(msg.id);

        const content = msg.content || '';
        let type: Toast['type'] = 'general';
        let title = 'System Update';
        
        const lowerContent = content.toLowerCase();

        // Categorize message
        if (msg.rolls && msg.rolls.length > 0) {
            type = 'roll';
            title = 'Action Check';
        } else if (lowerContent.includes('level up') || lowerContent.includes('leveled up')) {
            type = 'level';
            title = 'Level Up';
        } else if (lowerContent.includes('experience') || lowerContent.includes('xp')) {
            type = 'xp';
            title = 'Experience Gained';
        } else if (
            lowerContent.includes('inventory') || 
            lowerContent.includes('loot') || 
            lowerContent.includes('item') || 
            lowerContent.includes('added') ||
            lowerContent.includes('removed') ||
            lowerContent.includes('equipped')
        ) {
            type = 'inventory';
            title = 'Inventory Update';
        } else if (lowerContent.includes('sneak') || lowerContent.includes('hide') || lowerContent.includes('pickpocket')) {
            type = 'roll';
            title = 'Skill Check';
        } else if (lowerContent.includes('damage') || lowerContent.includes('attack') || lowerContent.includes('initiative')) {
            type = 'combat';
            title = 'Combat Log';
        }

        // Clean up markdown bold/italic tags and enforce sentence case
        let cleanContent = content.replace(/(\*\*|\*)/g, '').trim();
        // Capitalize first letter if it exists
        if (cleanContent.length > 0) {
            cleanContent = cleanContent.charAt(0).toUpperCase() + cleanContent.slice(1);
        }

        // Add the toast
        const newToast: Toast = {
            id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title,
            message: cleanContent,
            type,
        };

        setToasts(prev => [...prev, newToast]);

        // Auto-dismiss
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newToast.id));
        }, 5000);
    };

    const handleToastClick = (toast: Toast) => {
        if (toast.type === 'inventory') {
            setActiveView('inventory');
        }
        // Dismiss early on click
        setToasts(prev => prev.filter(t => t.id !== toast.id));
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'inventory': return '/icons/backpack.png';
            case 'roll': return <Icon name="dice" className="w-8 h-8 text-brand-accent drop-shadow-[0_0_5px_rgba(62,207,142,0.6)]" />;
            case 'level': return <Icon name="user" className="w-8 h-8 text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.6)]" />;
            case 'xp': return '/icons/quests.png';
            case 'combat': return '/icons/combat.png';
            default: return <Icon name="info" className="w-8 h-8 text-blue-400" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'inventory': return 'text-amber-400';
            case 'roll': return 'text-brand-accent';
            case 'level': return 'text-amber-300';
            case 'xp': return 'text-emerald-400';
            case 'combat': return 'text-rose-400';
            default: return 'text-blue-400';
        }
    };

    return (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    onClick={() => handleToastClick(toast)}
                    className={`
                        w-full flex items-center gap-4 px-4 py-3 
                        bg-brand-bg/95 backdrop-blur-xl border border-white/10 rounded-2xl 
                        shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-1 ring-white/5 
                        animate-in slide-in-from-bottom-5 fade-in duration-300
                        ${toast.type === 'inventory' ? 'cursor-pointer pointer-events-auto hover:bg-brand-primary/10 transition-colors' : 'pointer-events-none'}
                    `}
                >
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center overflow-hidden">
                         {typeof getTypeIcon(toast.type) === 'string' ? (
                            <img src={getTypeIcon(toast.type) as string} alt="" className="w-10 h-10 object-contain" />
                         ) : (
                             getTypeIcon(toast.type)
                         )}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className={`text-[10px] font-bold opacity-80 mb-0.5 tracking-wider uppercase ${getTypeColor(toast.type)}`}>
                            {toast.title}
                        </div>
                        <div className="text-body-sm text-brand-text truncate leading-relaxed">
                            {toast.message}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

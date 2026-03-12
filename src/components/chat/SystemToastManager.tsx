import React, { useState, useEffect, useContext } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import { ChatMessage } from '../../types';

interface Toast {
    id: string;
    title: string;
    message: string;
    type: 'inventory' | 'roll' | 'level' | 'xp' | 'general' | 'combat' | 'alignment' | 'relationship';
}

export const SystemToastManager: React.FC = () => {
    const { gameData } = useContext(GameDataContext);
    const { setActiveView } = useUI();
    const [toasts, setToasts] = useState<Toast[]>([]);
    
    const [lastProcessedMsgId, setLastProcessedMsgId] = useState<string | null>(null);

    // We only care about messages changing
    const messages = gameData?.messages || [];

    useEffect(() => {
        if (messages.length === 0) return;

        const startIndex = lastProcessedMsgId 
            ? messages.findIndex(m => m.id === lastProcessedMsgId) + 1 
            : Math.max(0, messages.length - 1); // Start from the last message on initial load to avoid flooding

        if (startIndex > 0 && startIndex < messages.length) {
            const newMessages = messages.slice(startIndex);
            newMessages.forEach(msg => {
                if (msg.sender === 'system') {
                    processSystemMessage(msg);
                }
            });
            setLastProcessedMsgId(messages[messages.length - 1].id);
        } else if (startIndex === 0 && !lastProcessedMsgId) {
            // Initial load edge case
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.sender === 'system') {
                processSystemMessage(lastMsg);
            }
            setLastProcessedMsgId(lastMsg.id);
        }

    }, [messages, lastProcessedMsgId]);

    const processSystemMessage = (msg: ChatMessage) => {
        const content = msg.content || '';
        const lowerContent = content.toLowerCase();

        // Check if this is a dual-update message from ChatView.tsx
        // Format: "**Alignment Shift**: *+X Good* (Morality axis).\n**Reactions**: NPC (+Y)..."
        if (lowerContent.includes('alignment shift') || lowerContent.includes('alignment detected')) {
            const hasReactions = lowerContent.includes('reactions:');
            
            if (hasReactions) {
                // Split multi-part messages
                const sections = content.split('\n');
                sections.forEach(section => {
                    const lowerSection = section.toLowerCase();
                    if (lowerSection.includes('alignment shift') || lowerSection.includes('alignment detected')) {
                        addToast('Alignment Update', section, 'alignment');
                    } else if (lowerSection.includes('reactions:')) {
                        addToast('Relationship Update', section, 'relationship');
                    }
                });
                return;
            }
        }

        // Standard single categorization
        let type: Toast['type'] = 'general';
        let title = 'System Update';
        
        if (msg.rolls && msg.rolls.length > 0) {
            type = 'roll';
            title = 'Action Check';
        } else if (lowerContent.includes('level up') || lowerContent.includes('leveled up')) {
            type = 'level';
            title = 'Level Up';
        } else if (lowerContent.includes('alignment shift') || lowerContent.includes('alignment detected')) {
            type = 'alignment';
            title = 'Alignment Update';
        } else if (lowerContent.includes('reactions:')) {
            type = 'relationship';
            title = 'Relationship Update';
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

        addToast(title, content, type);
    };

    const addToast = (title: string, rawMessage: string, type: Toast['type']) => {
        // Clean up markdown bold/italic tags
        let cleanContent = rawMessage.replace(/(\*\*|\*)/g, '').trim();
        
        // Remove "Reactions: " prefix for cleaner relationship toasts
        if (type === 'relationship' && cleanContent.toLowerCase().startsWith('reactions:')) {
            cleanContent = cleanContent.slice(10).trim();
        }

        // Enforce sentence case: Capitalize first letter, lower the rest (unless it's a known name or title)
        // But for many system messages, just ensuring first letter is capped and avoiding ALL CAPS is enough.
        if (cleanContent.length > 0) {
            // First check if it's already basically okay
            cleanContent = cleanContent.charAt(0).toUpperCase() + cleanContent.slice(1);
        }

        // Add the toast
        const newToast: Toast = {
            id: `toast-${Date.now()}-${Math.floor(Math.random() * 1000000).toString(36)}`,
            title,
            message: cleanContent,
            type,
        };

        setToasts(prev => [...prev, newToast]);

        // Auto-dismiss
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newToast.id));
        }, 10000);
    };

    const removeToast = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setToasts(prev => prev.filter(t => t.id !== id));
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
            case 'relationship': return '/icons/people.png';
            case 'alignment': return '/icons/heroes.png';
            case 'roll': return <Icon name="dice" className="w-8 h-8 text-brand-accent drop-shadow-[0_0_5px_rgba(62,207,142,0.6)]" />;
            case 'level': return '/icons/heroes.png';
            case 'xp': return '/icons/quests.png';
            case 'combat': return <Icon name="sword" className="w-8 h-8 text-rose-400 drop-shadow-[0_0_5px_rgba(244,63,94,0.6)]" />;
            default: return '/icons/chronicle.png';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'inventory': return 'text-amber-400';
            case 'relationship': return 'text-pink-400';
            case 'alignment': return 'text-purple-400';
            case 'roll': return 'text-brand-accent';
            case 'level': return 'text-amber-300';
            case 'xp': return 'text-emerald-400';
            case 'combat': return 'text-rose-400';
            default: return 'text-blue-400';
        }
    };

    return (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    onClick={() => handleToastClick(toast)}
                    className={`
                        relative w-full flex items-center gap-4 px-4 py-3 
                        bg-brand-bg/95 backdrop-blur-xl border border-white/10 rounded-2xl 
                        shadow-[0_10px_30px_rgba(0,0,0,0.5)]
                        animate-toast-container
                        ${toast.type === 'inventory' ? 'cursor-pointer pointer-events-auto hover:bg-brand-primary/10 transition-colors' : 'pointer-events-none'}
                    `}
                >
                    <svg className="absolute inset-0 w-full h-full pointer-events-none rounded-2xl z-0" preserveAspectRatio="none">
                        <rect 
                            x="0" y="0" width="100%" height="100%" 
                            rx="16" ry="16" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            className="text-brand-accent animate-toast-border shadow-sm drop-shadow-[0_0_8px_rgba(62,207,142,0.5)]"
                            pathLength="100"
                        />
                    </svg>
                    
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center overflow-hidden z-10">
                         {typeof getTypeIcon(toast.type) === 'string' ? (
                            <img src={getTypeIcon(toast.type) as string} alt="" className="w-10 h-10 object-contain" />
                         ) : (
                             getTypeIcon(toast.type)
                         )}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
                        <div className={`text-[11px] font-bold opacity-90 mb-0.5 ${getTypeColor(toast.type)}`}>
                            {toast.title}
                        </div>
                        <div className="text-body-sm text-brand-text leading-relaxed whitespace-pre-wrap break-words">
                            {toast.message}
                        </div>
                    </div>
                    
                    <button 
                        onClick={(e) => removeToast(e, toast.id)}
                        className="p-1 -mr-2 text-brand-text-muted hover:text-white transition-colors flex-shrink-0 self-start z-10 pointer-events-auto"
                    >
                        <Icon name="close" className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};

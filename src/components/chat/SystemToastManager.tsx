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
    alignmentType?: string;
}

export const SystemToastManager: React.FC = () => {
    const { gameData } = useContext(GameDataContext);
    const { setActiveView } = useUI();
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [queue, setQueue] = useState<Toast[]>([]);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);
    
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

        // 1. Relationship Updates
        // Format: "**Reactions**: NPC (+Y), NPC2 (-Z)" or "Garrick liked that (+1)"
        const hasReactionKeyword = /(reaction|relationship)s?:/i.test(lowerContent);
        const hasSentimentShift = /\([+-]\d+\)/.test(content);
        
        if (hasReactionKeyword || hasSentimentShift) {
            // Clean up prefix: "**Reactions**: ", "Reaction: ", etc.
            const reactionText = content.replace(/\*\*?Reactions?\*\*?:\s*/i, '').replace(/Reactions?:\s*/i, '');
            
            // Multi-reaction support (comma separated)
            const reactions = reactionText.split(',');
            reactions.forEach(r => {
                const trimmed = r.trim();
                if (trimmed) addToast('Relationship Updates', trimmed, 'relationship');
            });
            
            // Don't return yet if there's other info, though usually these are separate
            if (!lowerContent.includes('alignment')) return;
        }

        // 2. Alignment Updates
        if (lowerContent.includes('alignment shift') || lowerContent.includes('alignment detected')) {
            const sections = content.split('\n');
            const alignmentSection = sections.find(s => s.toLowerCase().includes('alignment'));
            if (alignmentSection) addToast('Alignment Updates', alignmentSection, 'alignment');
            return;
        }

        // 3. Level Up & XP
        if (lowerContent.includes('level up') || lowerContent.includes('leveled up')) {
            addToast('Level Up', content, 'level');
            return;
        }
        if (lowerContent.includes('experience') || lowerContent.includes('xp')) {
            addToast('Experience Gained', content, 'xp');
            return;
        }

        // 4. Inventory & Loot
        const isInventory = 
            lowerContent.includes('inventory') || 
            lowerContent.includes('loot') || 
            lowerContent.includes('acquired') ||
            lowerContent.includes('received') ||
            lowerContent.includes('lost') ||
            lowerContent.includes('removed') ||
            lowerContent.includes('dropped') ||
            lowerContent.includes('moved') ||
            lowerContent.includes('bought') ||
            lowerContent.includes('sold') ||
            lowerContent.includes('transferred') ||
            lowerContent.includes('used') ||
            (lowerContent.includes('item') && (lowerContent.includes('added') || lowerContent.includes('equipped')));
        
        if (isInventory) {
            addToast('Inventory Updates', content, 'inventory');
            return;
        }

        // 5. Action Rolls (Specific labels based on roll type)
        if (msg.rolls && msg.rolls.length > 0) {
            const firstRoll = msg.rolls[0];
            let rollTitle = 'Action Check';
            if (firstRoll.rollType === 'Skill Check') rollTitle = 'Skill Check';
            else if (firstRoll.rollType === 'Saving Throw') rollTitle = 'Saving Throw';
            else if (firstRoll.rollType === 'Attack Roll') rollTitle = 'Attack Roll';
            else if (firstRoll.rollType === 'Damage Roll') rollTitle = 'Damage Roll';
            else if (firstRoll.rollType === 'Encounter Check') rollTitle = 'Encounter Check';
            else if (firstRoll.rollType === 'Healing Roll') rollTitle = 'Healing Roll';

            addToast(rollTitle, content, 'roll');
            return;
        }

        // 6. Skill Checks (fallback for non-roll skill logs)
        if (lowerContent.includes('sneak') || lowerContent.includes('hide') || lowerContent.includes('pickpocket')) {
            addToast('Skill Check', content, 'roll');
            return;
        }

        // 7. Combat Log
        if (lowerContent.includes('damage') || lowerContent.includes('attack') || lowerContent.includes('initiative')) {
            addToast('Combat Log', content, 'combat');
            return;
        }

        // Default
        addToast('System Update', content, 'general');
    };

    const addToast = (title: string, rawMessage: string, type: Toast['type']) => {
        // Clean up markdown bold/italic tags
        let cleanContent = rawMessage.replace(/(\*\*|\*)/g, '').trim();
        let alignmentType;
        
        // RPG Flavor Transformations
        if (type === 'relationship') {
            // Remove "Reactions: " prefix if still there
            if (cleanContent.toLowerCase().startsWith('reactions:')) {
                cleanContent = cleanContent.slice(10).trim();
            }

            // Parse: "NPC (+Y)" -> "NPC liked/disliked that (+Y)"
            const relMatch = cleanContent.match(/^(.+?)\s*\(([+-]?\d+)\)$/);
            if (relMatch) {
                const name = relMatch[1].trim();
                const value = parseInt(relMatch[2]);
                const verb = value > 0 ? 'liked' : 'disliked';
                const sign = value > 0 ? '+' : '';
                cleanContent = `${name} ${verb} that (${sign}${value})`;
            }
        } 
        else if (type === 'alignment') {
            // Parse: "+X Lawful" or "-Y Evil"
            const alignMatch = cleanContent.match(/([+-]\d+)\s+(\w+)/);
            if (alignMatch) {
                const value = alignMatch[1];
                const alignType = alignMatch[2]; // Lawful, Chaotic, Good, Evil
                cleanContent = `You have performed a ${alignType} act (${value})`;
                alignmentType = alignType;
            }
        }
        else if (type === 'inventory') {
            // "Item added to inventory" -> "You acquired: Item"
            if (cleanContent.toLowerCase().includes('added')) {
                const itemMatch = cleanContent.match(/^(.+?)\s+added/i);
                if (itemMatch) cleanContent = `You acquired: ${itemMatch[1].trim()}`;
                else if (cleanContent.includes('to your inventory')) {
                    cleanContent = `Item added to your inventory`;
                }
            } else if (cleanContent.toLowerCase().includes('removed')) {
                const itemMatch = cleanContent.match(/^(.+?)\s+removed/i);
                if (itemMatch) cleanContent = `Lost: ${itemMatch[1].trim()}`;
            }
        }

        // Enforce sentence case: Capitalize first letter
        if (cleanContent.length > 0) {
            cleanContent = cleanContent.charAt(0).toUpperCase() + cleanContent.slice(1);
        }

        // Create the toast object
        const newToast: Toast = {
            id: `toast-${Date.now()}-${Math.floor(Math.random() * 1000000).toString(36)}`,
            title,
            message: cleanContent,
            type,
            alignmentType,
        };

        // Add to queue instead of active toasts
        setQueue(prev => [...prev, newToast]);
    };

    // Effect to process the queue sequentially
    useEffect(() => {
        if (queue.length === 0 || isProcessingQueue) return;

        const processNextToast = async () => {
            setIsProcessingQueue(true);
            
            // Get the next toast
            const nextToast = queue[0];
            
            // Remove it from queue and add to active toasts
            setQueue(prev => prev.slice(1));
            setToasts(prev => [...prev, nextToast]);

            // Auto-dismiss after 10s
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== nextToast.id));
            }, 10000);

            // Wait 500ms before allowing the next toast to be processed
            await new Promise(resolve => setTimeout(resolve, 500));
            setIsProcessingQueue(false);
        };

        processNextToast();
    }, [queue, isProcessingQueue]);

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

    const getTypeIcon = (type: string, alignmentType?: string) => {
        switch (type) {
            case 'inventory': return '/icons/backpack.png';
            case 'relationship': return '/icons/people.png';
            case 'alignment': 
                if (alignmentType === 'Good') return '/icons/good-alignment.png';
                if (alignmentType === 'Evil') return '/icons/evil-alignment.png';
                if (alignmentType === 'Lawful') return '/icons/lawful-alignment.png';
                if (alignmentType === 'Chaotic') return '/icons/chaotic-alignment.png';
                return '/icons/heroes.png';
            case 'roll': return <Icon name="dice" className="w-10 h-10 text-brand-accent drop-shadow-[0_0_5px_rgba(62,207,142,0.6)]" />;
            case 'level': return '/icons/heroes.png';
            case 'xp': return '/icons/experience-gained.png';
            case 'combat': return <Icon name="sword" className="w-10 h-10 text-rose-400 drop-shadow-[0_0_5px_rgba(244,63,94,0.6)]" />;
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
        <div className="fixed top-16 right-4 z-[100] flex flex-col items-end gap-2 pointer-events-none w-full max-w-sm px-4">
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
                    
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center overflow-hidden z-10">
                         {typeof getTypeIcon(toast.type, toast.alignmentType) === 'string' ? (
                            <img src={getTypeIcon(toast.type, toast.alignmentType) as string} alt="" className="w-12 h-12 object-contain" />
                         ) : (
                             getTypeIcon(toast.type, toast.alignmentType)
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

import React from 'react';
import { ChatMessage } from '../../types';
import { EntityLinker } from './EntityLinker';
import { DiceTray } from './DiceTray';
import { Icon } from '../Icon';

const FormattedMessage: React.FC<{ text: string; dialogues?: any[]; visibleLines?: number }> = ({ text, dialogues, visibleLines = Infinity }) => {
    if (!text || typeof text !== 'string') return null;

    let currentLineIdx = 0;

    const renderTextContent = (content: string) => {
        const lines = content.trim().split('\n');
        return (
            <div className="leading-relaxed text-body-base">
                {lines.map((line, lineIdx) => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) {
                        return <div key={lineIdx} className="h-2" />;
                    }
                    
                    const isVisible = currentLineIdx < visibleLines;
                    const isJustRevealed = isVisible && currentLineIdx === Math.floor(visibleLines) - 1 && visibleLines !== Infinity;
                    currentLineIdx++;

                    if (!isVisible) return null;

                    const isDialogue = trimmedLine.startsWith('**') || (trimmedLine.startsWith('*') && trimmedLine.includes(':'));
                    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
                    
                    return (
                        <div 
                            key={lineIdx} 
                            className={`relative ${isDialogue ? 'mt-3 pt-3' : 'mb-1'} ${isJustRevealed ? 'animate-reveal-line' : ''}`}
                        >
                            {isDialogue && <div className="absolute top-0 left-0 w-full h-[1px] bg-brand-primary/10" />}
                            {parts.map((part, partIndex) => {
                                if (!part) return null;
                                
                                let contentToShow = part;
                                let isFormatting = false;
                                let strippedPart = part;

                                if (part.startsWith('**') && part.endsWith('**')) {
                                    strippedPart = part.slice(2, -2);
                                    isFormatting = true;
                                } else if (part.startsWith('*') && part.endsWith('*')) {
                                    strippedPart = part.slice(1, -1);
                                    isFormatting = true;
                                }

                                contentToShow = strippedPart;

                                if (isFormatting) {
                                    if (part.startsWith('**')) {
                                        return <strong key={partIndex} className="font-bold text-brand-text"><EntityLinker text={contentToShow} /></strong>;
                                    } else {
                                        return <em key={partIndex} className="italic text-brand-text"><EntityLinker text={contentToShow} /></em>;
                                    }
                                }
                                return <EntityLinker key={partIndex} text={contentToShow} />;
                            })}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderDialogues = () => {
        if (!dialogues || dialogues.length === 0) return null;

        return (
            <div className="my-6 space-y-4">
                {dialogues.map((d, idx) => {
                    const actorName = d.actorName;
                    const content = d.content;
                    
                    const isVisible = currentLineIdx < visibleLines;
                    const isJustRevealed = isVisible && currentLineIdx === Math.floor(visibleLines) - 1 && visibleLines !== Infinity;
                    currentLineIdx++;

                    if (!isVisible) return null;

                    return (
                        <div key={idx} className={isJustRevealed ? 'animate-reveal-line' : 'animate-fade-in'}>
                            <div className="mb-3 pt-3 relative">
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-brand-primary/10" />
                                <span className="font-bold text-brand-text text-body-base mr-1">
                                    <EntityLinker text={actorName} />:
                                </span>
                                {content && (
                                    <span className="text-body-base leading-relaxed">
                                        <EntityLinker text={content} />
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
    
    if (dialogues && dialogues.length > 0 && paragraphs.length >= 2) {
        return (
            <>
                {renderTextContent(paragraphs[0])}
                {renderDialogues()}
                {paragraphs.slice(1).map((para, i) => (
                    <React.Fragment key={i}>
                        {currentLineIdx < visibleLines && <div className="h-4" />}
                        {renderTextContent(para)}
                    </React.Fragment>
                ))}
            </>
        );
    }

    const sections = text.split('\n---\n');
    return (
        <>
            {sections.map((section, sectionIdx) => (
                <React.Fragment key={sectionIdx}>
                    {sectionIdx > 0 && currentLineIdx < visibleLines && <hr className="my-3 border-brand-primary/50" />}
                    {renderTextContent(section)}
                </React.Fragment>
            ))}
            {renderDialogues()}
        </>
    );
};

interface MessageItemProps {
    msg: ChatMessage;
    onSpeak: (text: string, id: string) => void;
    onClearChat: () => void;
    isPlaying: boolean;
    showAlignmentOptions?: boolean;
    isLatest?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ msg, onSpeak, onClearChat, isPlaying, showAlignmentOptions = true, isLatest = false }) => {
    const isUser = msg.sender === 'user';
    const [visibleLines, setVisibleLines] = React.useState(isUser ? Infinity : 0);
    const [isRevealing, setIsRevealing] = React.useState(!isUser && isLatest);
    
    const totalLines = React.useMemo(() => {
        let count = 0;
        
        // Count lines in content
        if (msg.content) {
            const sections = msg.content.split('\n---\n');
            sections.forEach(section => {
                const paragraphs = section.split('\n\n').filter(p => p.trim().length > 0);
                paragraphs.forEach(para => {
                    const lines = para.trim().split('\n');
                    count += lines.filter(l => l.trim().length > 0).length;
                });
            });
        }
        
        // Count dialogues
        if (msg.dialogues) {
            count += msg.dialogues.length;
        }
        
        return count;
    }, [msg.content, msg.dialogues]);

    const msgTimestamp = React.useMemo(() => {
        const match = msg.id.match(/-(\d+)$/);
        return match ? parseInt(match[1]) : Date.now();
    }, [msg.id]);

    const isRecentlyCreated = React.useMemo(() => Date.now() - msgTimestamp < 10000, [msgTimestamp]);

    React.useEffect(() => {
        if (isUser || !isLatest || !isRecentlyCreated || msg.isStreaming) {
            setVisibleLines(Infinity);
            setIsRevealing(false);
            return;
        }

        // Reveal effect line by line
        let current = 0;
        const lineSpeed = 300; // time between lines
        
        const interval = setInterval(() => {
            current += 1;
            if (current >= totalLines) {
                setVisibleLines(Infinity);
                setIsRevealing(false);
                clearInterval(interval);
                // Dispatch final update to ensure scroll reaches newly appeared alignment buttons
                setTimeout(() => window.dispatchEvent(new CustomEvent('chat-reveal-update')), 50);
            } else {
                setVisibleLines(current);
                window.dispatchEvent(new CustomEvent('chat-reveal-update'));
            }
        }, lineSpeed);

        return () => clearInterval(interval);
    }, [isLatest, isUser, totalLines, isRecentlyCreated]);

    return (
        <div id={`msg-${msg.id}`} className="flex flex-col items-start animate-fade-in w-full scroll-mt-6">
            <div className={`relative group w-[85%] max-w-2xl ml-0 transition-all mb-10 ${msg.mode === 'OOC' ? 'italic text-brand-text-muted/70' : ''}`}>
                {isUser ? (
                    <div className={`text-body-base leading-relaxed font-medium py-1 ${msg.mode === 'OOC' ? 'text-brand-text-muted/60' : 'text-brand-text-muted/50'}`}>
                        <EntityLinker text={msg.content || ''} />
                    </div>
                ) : (
                    <div className={msg.mode === 'OOC' ? 'text-brand-text-muted/80' : 'text-brand-text'}>
                        <FormattedMessage 
                            text={msg.content || ''} 
                            dialogues={msg.dialogues} 
                            visibleLines={visibleLines}
                        />
                        
                        {!isRevealing && msg.rolls && <DiceTray rolls={msg.rolls} />}



                        {/* Contextual Action Tray: Slides out on hover/focus */}
                        {!isRevealing && (
                            <div className="grid transition-all duration-300 ease-in-out grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                                <div className="overflow-hidden">
                                    <div className="flex justify-between items-center w-full pt-4 pb-1 animate-fade-in">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onSpeak(msg.content || '', msg.id)}
                                                className={`btn-secondary btn-sm rounded-full gap-2 ${isPlaying ? 'bg-brand-accent/10 border-brand-accent text-brand-accent animate-pulse' : 'text-brand-text-muted hover:text-brand-text'}`}
                                                title={isPlaying ? "Stop" : "Read aloud"}
                                            >
                                                <Icon name={isPlaying ? "close" : "play"} className="w-3.5 h-3.5" />
                                                <span className="font-bold">{isPlaying ? "Stop" : "Listen"}</span>
                                            </button>
                                        </div>
                                        <button
                                            onClick={onClearChat}
                                            className="btn-tertiary text-[10px] gap-1.5 text-brand-danger hover:text-white hover:bg-brand-danger/20 px-3 py-1.5 rounded-full transition-all"
                                            title="Clear history up to this point"
                                        >
                                            <Icon name="trash" className="w-3 h-3" />
                                            <span>Clear Previous</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {msg.isStreaming && (
                            <div className="flex items-center gap-2 mt-4 text-brand-accent animate-pulse">
                                <div className="flex gap-1">
                                    <span className="w-1 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1 h-5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-[10px] uppercase tracking-widest font-bold">Narrating...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

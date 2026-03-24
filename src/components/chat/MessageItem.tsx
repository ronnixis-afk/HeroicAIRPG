import React from 'react';
import { ChatMessage } from '../../types';
import { EntityLinker } from './EntityLinker';
import { DiceTray } from './DiceTray';
import { Icon } from '../Icon';

const FormattedMessage: React.FC<{ text: string; dialogues?: any[]; visibleChars?: number }> = ({ text, dialogues, visibleChars = Infinity }) => {
    if (!text || typeof text !== 'string') return null;

    let remainingChars = visibleChars;

    const renderTextContent = (content: string) => {
        if (remainingChars <= 0) return null;
        
        const lines = content.trim().split('\n');
        return (
            <div className="leading-relaxed text-body-base">
                {lines.map((line, lineIdx) => {
                    if (remainingChars <= 0) return null;
                    const trimmedLine = line.trim();
                    if (!trimmedLine) {
                        return <div key={lineIdx} className="h-2" />;
                    }
                    const isDialogue = trimmedLine.startsWith('**') || (trimmedLine.startsWith('*') && trimmedLine.includes(':'));
                    
                    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
                    return (
                        <div key={lineIdx} className={`relative ${isDialogue ? 'mt-3 pt-3' : 'mb-1'}`}>
                            {isDialogue && <div className="absolute top-0 left-0 w-full h-[1px] bg-brand-primary/10" />}
                            {parts.map((part, partIndex) => {
                                if (!part || remainingChars <= 0) return null;
                                
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

                                if (remainingChars < strippedPart.length) {
                                    contentToShow = strippedPart.slice(0, remainingChars);
                                    remainingChars = 0;
                                } else {
                                    contentToShow = strippedPart;
                                    remainingChars -= strippedPart.length;
                                }

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
        if (!dialogues || dialogues.length === 0 || remainingChars <= 0) return null;

        return (
            <div className="my-6 space-y-4">
                {dialogues.map((d, idx) => {
                    if (remainingChars <= 0) return null;
                    
                    let actorName = d.actorName;
                    let content = d.content;

                    if (remainingChars < actorName.length) {
                        actorName = actorName.slice(0, remainingChars);
                        content = "";
                        remainingChars = 0;
                    } else {
                        remainingChars -= actorName.length;
                        if (remainingChars < content.length) {
                            content = content.slice(0, remainingChars);
                            remainingChars = 0;
                        } else {
                            remainingChars -= content.length;
                        }
                    }

                    return (
                        <div key={idx} className="animate-fade-in">
                            <div className="mb-3 pt-3 relative">
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-brand-primary/10" />
                                <strong className="font-bold text-brand-text italic block mb-1">
                                    <EntityLinker text={actorName} />
                                </strong>
                                {content && (
                                    <span className="text-body-base leading-relaxed italic block pl-2 border-l-2 border-brand-primary/20">
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
                        {remainingChars > 0 && <div className="h-4" />}
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
                    {sectionIdx > 0 && remainingChars > 0 && <hr className="my-3 border-brand-primary/50" />}
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
    const [visibleChars, setVisibleChars] = React.useState(isUser ? Infinity : 0);
    const [isRevealing, setIsRevealing] = React.useState(!isUser && isLatest);
    
    const totalChars = React.useMemo(() => {
        let count = (msg.content || '').length;
        if (msg.dialogues) {
            msg.dialogues.forEach(d => {
                count += (d.actorName || '').length + (d.content || '').length;
            });
        }
        return count;
    }, [msg.content, msg.dialogues]);

    const msgTimestamp = React.useMemo(() => {
        const match = msg.id.match(/-(\d+)$/);
        return match ? parseInt(match[1]) : Date.now();
    }, [msg.id]);

    const isRecentlyCreated = React.useMemo(() => Date.now() - msgTimestamp < 10000, [msgTimestamp]);

    React.useEffect(() => {
        if (isUser || !isLatest || !isRecentlyCreated) {
            setVisibleChars(Infinity);
            setIsRevealing(false);
            return;
        }

        // Reveal effect
        let current = 0;
        const speed = 10; // slightly faster for better feeel
        const interval = setInterval(() => {
            current += 3; // reveal 3 chars at a time
            if (current >= totalChars) {
                setVisibleChars(Infinity);
                setIsRevealing(false);
                clearInterval(interval);
            } else {
                setVisibleChars(current);
                window.dispatchEvent(new CustomEvent('chat-reveal-update'));
            }
        }, speed);

        return () => clearInterval(interval);
    }, [isLatest, isUser, totalChars, isRecentlyCreated]);

    return (
        <div className="flex flex-col items-start animate-fade-in w-full">
            <div className={`relative group w-full ${isUser
                ? "bg-transparent border-none max-w-[83%]"
                : "bg-transparent max-w-[83%] font-normal mb-1"
                } ${msg.mode === 'OOC' ? 'italic text-brand-text-muted/70' : ''}`}>
                {isUser ? (
                    <div className={`text-body-base leading-relaxed font-medium py-1 ${msg.mode === 'OOC' ? 'text-brand-text-muted/60' : 'text-brand-text-muted/50'}`}>
                        <EntityLinker text={msg.content || ''} />
                    </div>
                ) : (
                    <div className={msg.mode === 'OOC' ? 'text-brand-text-muted/80' : 'text-brand-text'}>
                        <FormattedMessage 
                            text={msg.content || ''} 
                            dialogues={msg.dialogues} 
                            visibleChars={visibleChars}
                        />
                        
                        {!isRevealing && msg.rolls && <DiceTray rolls={msg.rolls} />}

                        {!isRevealing && showAlignmentOptions && msg.alignmentOptions && msg.alignmentOptions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4 animate-fade-in">
                                {msg.alignmentOptions.map((opt, idx) => {
                                    let iconFile = '';
                                    if (opt.alignment === 'Good') iconFile = '/icons/good-alignment.png';
                                    else if (opt.alignment === 'Evil') iconFile = '/icons/evil-alignment.png';
                                    else if (opt.alignment === 'Lawful') iconFile = '/icons/lawful-alignment.png';
                                    else if (opt.alignment === 'Chaotic') iconFile = '/icons/chaotic-alignment.png';

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                const event = new CustomEvent('alignment-action', {
                                                    detail: { label: opt.label, alignment: opt.alignment }
                                                });
                                                window.dispatchEvent(event);
                                            }}
                                            className="px-4 h-8 text-xs font-bold rounded-full transition-all flex items-center gap-2 text-white bg-[#1C1C1E] hover:bg-[#2C2C2E] shadow-sm transform hover:scale-[1.02] active:scale-95"
                                        >
                                            {iconFile && (
                                                <img src={iconFile} alt={opt.alignment} className="w-[25px] h-[25px] object-contain drop-shadow-md" />
                                            )}
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

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
                                                <span className="font-bold tracking-normal">{isPlaying ? "Stop" : "Listen"}</span>
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
                    </div>
                )}
            </div>
        </div>
    );
};

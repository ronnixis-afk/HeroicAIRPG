import React from 'react';
import { ChatMessage } from '../../types';
import { EntityLinker } from './EntityLinker';
import { DiceTray } from './DiceTray';
import { Icon } from '../Icon';

const FormattedMessage: React.FC<{ text: string }> = ({ text }) => {
    if (!text || typeof text !== 'string') return null;
    const sections = text.split('\n---\n');
    return (
        <>
            {sections.map((section, sectionIdx) => {
                const lines = section.trim().split('\n');
                return (
                    <React.Fragment key={sectionIdx}>
                        {sectionIdx > 0 && <hr className="my-3 border-brand-primary/50" />}
                        <div className="leading-relaxed text-body-base">
                            {lines.map((line, lineIdx) => {
                                const trimmedLine = line.trim();
                                if (!trimmedLine) return <div key={lineIdx} className="h-2" />;

                                // Detect dialogue line: starts with bold or italic patterns e.g. **Name** or *Name*
                                const isDialogue = trimmedLine.startsWith('**') || (trimmedLine.startsWith('*') && trimmedLine.includes(':'));
                                
                                return (
                                    <div key={lineIdx} className={`relative ${isDialogue ? 'mt-3 pt-3' : 'mb-1'}`}>
                                        {isDialogue && <div className="absolute top-0 left-0 w-full h-[1px] bg-brand-primary/10" />}
                                        {line.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, partIndex) => {
                                            if (!part) return null;
                                            if (part.startsWith('**') && part.endsWith('**')) return <strong key={partIndex} className="font-bold text-brand-text"><EntityLinker text={part.slice(2, -2)} /></strong>;
                                            if (part.startsWith('*') && part.endsWith('*')) return <em key={partIndex} className="italic text-brand-text"><EntityLinker text={part.slice(1, -1)} /></em>;
                                            return <EntityLinker key={partIndex} text={part} />;
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </React.Fragment>
                );
            })}
        </>
    );
};

interface MessageItemProps {
    msg: ChatMessage;
    onSpeak: (text: string, id: string) => void;
    onClearChat: () => void;
    isPlaying: boolean;
    showAlignmentOptions?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ msg, onSpeak, onClearChat, isPlaying, showAlignmentOptions = true }) => {
    const isUser = msg.sender === 'user';

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
                        <FormattedMessage text={msg.content || ''} />
                        {msg.rolls && <DiceTray rolls={msg.rolls} />}

                        {showAlignmentOptions && msg.alignmentOptions && msg.alignmentOptions.length > 0 && (
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
                    </div>
                )}
            </div>
        </div>
    );
};

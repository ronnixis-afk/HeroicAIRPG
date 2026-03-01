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
            {sections.map((section, index) => (
                <React.Fragment key={index}>
                    {index > 0 && <hr className="my-3 border-brand-primary/50" />}
                    <div className="whitespace-pre-wrap my-1 leading-relaxed text-body-base">
                        {section.trim().split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, partIndex) => {
                            if (!part) return null;
                            if (part.startsWith('**') && part.endsWith('**')) return <strong key={partIndex} className="font-bold text-brand-text"><EntityLinker text={part.slice(2, -2)} /></strong>;
                            if (part.startsWith('*') && part.endsWith('*')) return <em key={partIndex} className="italic text-brand-accent/90"><EntityLinker text={part.slice(1, -1)} /></em>;
                            return <EntityLinker key={partIndex} text={part} />;
                        })}
                    </div>
                </React.Fragment>
            ))}
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
                }`}>
                {isUser ? (
                    <p className="text-body-base text-brand-text-muted/50 leading-relaxed font-medium py-1">
                        {msg.content}
                    </p>
                ) : (
                    <div className="text-brand-text">
                        <FormattedMessage text={msg.content || ''} />
                        {msg.rolls && <DiceTray rolls={msg.rolls} />}

                        {showAlignmentOptions && msg.alignmentOptions && msg.alignmentOptions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4 animate-fade-in">
                                {msg.alignmentOptions.map((opt, idx) => {
                                    let colorClass = "border-brand-text-muted text-brand-text-muted hover:bg-brand-text-muted/10";
                                    if (opt.alignment === 'Good') colorClass = "border-blue-500 text-blue-500 hover:bg-blue-500/10";
                                    if (opt.alignment === 'Evil') colorClass = "border-red-500 text-red-500 hover:bg-red-500/10";
                                    if (opt.alignment === 'Lawful') colorClass = "border-yellow-500 text-yellow-500 hover:bg-yellow-500/10";
                                    if (opt.alignment === 'Chaotic') colorClass = "border-purple-500 text-purple-500 hover:bg-purple-500/10";

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                // We will need to pass a handler from ChatView
                                                // For now, just dispatch a custom event that ChatView can listen to
                                                const event = new CustomEvent('alignment-action', {
                                                    detail: { label: opt.label, alignment: opt.alignment }
                                                });
                                                window.dispatchEvent(event);
                                            }}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-full border bg-transparent transition-colors ${colorClass}`}
                                        >
                                            {opt.alignment} | {opt.label}
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
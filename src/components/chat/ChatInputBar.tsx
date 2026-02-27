// components/chat/ChatInputBar.tsx

import React, { useState, useContext } from 'react';
import { Icon } from '../Icon';
import AutoResizingTextarea from '../AutoResizingTextarea';
import SpeechToTextButton from '../SpeechToTextButton';
import { useUI } from '../../context/UIContext';
import { GameDataContext } from '../../context/GameDataContext';

interface ChatInputBarProps {
    value: string;
    onChange: (val: string) => void;
    onSubmit: () => void;
    onViewScene: () => void;
    onMicClick: () => void;
    isGeneratingImage: boolean;
    isHandsFree: boolean;
    onRepeatLast: () => void;
    isCombatActive: boolean;
    isPlayerTurn: boolean;
    onAutoResolve: () => void;
    isLocked: boolean;
    onMenuClick: () => void;
    onInteraction?: () => void;
    isChatViewActive: boolean;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = (props) => {
    const [mode, setMode] = useState<'Char' | 'Ooc'>('Char');
    const [isFocused, setIsFocused] = useState(false);
    const { isHeroicModeActive, setIsHeroicModeActive } = useUI();
    const { gameData } = useContext(GameDataContext);

    const heroicPoints = gameData?.playerCharacter?.heroicPoints ?? 0;
    const maxHeroicPoints = gameData?.playerCharacter?.maxHeroicPoints ?? 1;
    const canActivateHeroic = heroicPoints > 0;

    const handleInteraction = () => {
        props.onInteraction?.();
    };

    const handleHeroicToggle = () => {
        if (!canActivateHeroic) return;
        setIsHeroicModeActive(!isHeroicModeActive);
    };

    const NavigationOverlay = () => {
        if (props.isChatViewActive) return null;
        return (
            <div className="absolute -inset-[2px] z-50 animate-active-nav-pulse flex items-center justify-center cursor-pointer backdrop-blur-[2px] transition-all hover:bg-brand-accent/20 rounded-[inherit] border-2 border-transparent">
                <div className="flex items-center gap-3 animate-text-glow-pulse">
                    <span className="text-brand-accent font-bold text-sm drop-shadow-md">
                        Return to Story
                    </span>
                </div>
            </div>
        );
    };

    if (props.isHandsFree) {
        return (
            <div 
                onClick={handleInteraction}
                className={`flex items-center justify-center p-4 gap-8 bg-brand-bg/80 rounded-3xl border border-brand-primary/30 shadow-2xl animate-fade-in relative overflow-hidden transition-all ${!props.isChatViewActive ? 'hover:scale-[1.02] active:scale-95' : ''}`}
            >
                <button onClick={props.onRepeatLast} className="w-16 h-16 rounded-full bg-brand-surface flex items-center justify-center text-brand-text-muted hover:text-brand-text hover:bg-brand-primary transition-all active:scale-95 border border-brand-primary shadow-lg">
                    <Icon name="play" className="w-8 h-8" />
                </button>
                
                {props.isCombatActive && props.isPlayerTurn && (
                    <button 
                        onClick={props.onAutoResolve} 
                        className="w-16 h-16 rounded-full bg-brand-surface flex items-center justify-center text-brand-danger hover:bg-brand-primary transition-all active:scale-95 shadow-lg border-2 border-brand-danger"
                        title="Auto-Combat Player Turn"
                    >
                        <Icon name="sword" className="w-8 h-8" />
                    </button>
                )}

                <button onClick={props.onMicClick} className="w-16 h-16 rounded-full bg-brand-accent flex items-center justify-center text-black hover:opacity-90 transition-all active:scale-95 shadow-[0_0_20px_rgba(62,207,142,0.3)]">
                    <Icon name="microphone" className="w-8 h-8" />
                </button>

                <NavigationOverlay />
            </div>
        );
    }

    return (
        <div 
            onClick={handleInteraction}
            className={`bg-brand-bg rounded-2xl flex items-center p-2 gap-2 shadow-sm border relative overflow-visible transition-all duration-500
                ${isHeroicModeActive 
                    ? 'border-brand-accent shadow-[0_0_15px_rgba(62,207,142,0.3)] ring-1 ring-brand-accent/20' 
                    : 'border-brand-primary/20'}
                ${!props.isChatViewActive ? 'hover:scale-[1.01] active:scale-[0.99]' : ''}`}
        >
            <div className={`flex items-center gap-2 transition-all duration-500 ease-in-out overflow-visible whitespace-nowrap ${isFocused ? 'max-w-0 opacity-0 -translate-x-10 pointer-events-none' : 'max-w-[150px] opacity-100 translate-x-0'}`}>
                <button 
                    onClick={handleHeroicToggle}
                    disabled={!canActivateHeroic}
                    className={`btn-icon relative transition-all duration-300 ${!canActivateHeroic ? 'opacity-20 cursor-not-allowed' : ''} ${isHeroicModeActive ? 'scale-[1.15]' : ''}`}
                    title={canActivateHeroic 
                        ? `${isHeroicModeActive ? "Heroic Mode Active" : "Enable Heroic Mode"} (${heroicPoints}/${maxHeroicPoints} Available)` 
                        : `No Heroic Points Remaining (0/${maxHeroicPoints})`}
                >
                    <Icon 
                        name={isHeroicModeActive ? "starFill" : "star"} 
                        className={`w-6 h-6 transition-colors duration-300 ${isHeroicModeActive ? 'text-brand-accent animate-pulse' : 'text-brand-text-muted hover:text-brand-accent'}`} 
                    />
                    
                    {/* Heroic Points Badge */}
                    <span className="absolute -top-1 -right-1 bg-brand-accent text-black text-[8px] font-black h-4 min-w-[20px] px-1 rounded-full flex items-center justify-center border border-brand-bg z-10 shadow-sm transition-transform duration-300 tabular-nums">
                        {heroicPoints}/{maxHeroicPoints}
                    </span>
                </button>
                <button 
                    onClick={() => setMode(mode === 'Char' ? 'Ooc' : 'Char')} 
                    className={`btn-secondary btn-sm rounded-full transition-all flex-shrink-0 ${
                        mode === 'Char' 
                            ? 'border-brand-accent text-brand-accent bg-brand-accent/5' 
                            : 'border-brand-primary text-brand-text-muted bg-brand-primary/20'
                    }`}
                >
                    {mode}
                </button>
            </div>
            
            <AutoResizingTextarea 
                value={props.value} 
                onChange={(e) => props.onChange(e.target.value)} 
                onFocus={() => {
                    setIsFocused(true);
                    handleInteraction();
                }} 
                onBlur={() => setIsFocused(false)} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); props.onSubmit(); } }} 
                placeholder={isHeroicModeActive ? "Say or Do" : (mode === 'Char' ? "Say or Do" : "Ask The Game Master")} 
                className={`flex-1 bg-transparent p-2 focus:outline-none w-full min-w-[100px] text-body-base transition-all duration-300 ${isHeroicModeActive ? 'font-medium' : ''}`} 
                style={{ maxHeight: '120px' }} 
            />
            
            <div className="flex items-center self-center gap-1">
                <div className={`flex items-center gap-1 transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap ${isFocused ? 'max-w-0 opacity-0 translate-x-10' : 'max-w-[100px] opacity-100 translate-x-0'}`}>
                    <button onClick={props.onViewScene} disabled={props.isGeneratingImage} className="btn-icon">
                        {props.isGeneratingImage ? <Icon name="spinner" className="w-5 h-5 animate-spin text-brand-accent" /> : <Icon name="eye" className="w-5 h-5 text-brand-text-muted hover:text-brand-accent transition-colors" />}
                    </button>
                    <SpeechToTextButton onClick={props.onMicClick} className="btn-icon" />
                </div>
                <button 
                    onClick={props.onSubmit} 
                    disabled={!props.value.trim() || props.isLocked} 
                    className={`btn-primary w-11 h-11 rounded-full p-0 flex-shrink-0 disabled:opacity-40 transition-all duration-300 ${isHeroicModeActive ? 'shadow-[0_0_15px_rgba(62,207,142,0.4)] scale-105' : ''}`}
                >
                    {props.isLocked ? <Icon name="spinner" className="w-5 h-5 animate-spin" /> : <Icon name="send" className="w-5 h-5" />}
                </button>
            </div>

            {isHeroicModeActive && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-brand-accent text-black text-[9px] font-semibold rounded-full shadow-lg animate-fade-in z-[60] border border-white/20">
                    Heroic Action
                </div>
            )}

            <NavigationOverlay />
        </div>
    );
};

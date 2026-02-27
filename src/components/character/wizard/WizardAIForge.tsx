import React from 'react';
import { Icon } from '../../Icon';
import AutoResizingTextarea from '../../AutoResizingTextarea';

interface WizardAIForgeProps {
    prompt: string;
    onPromptChange: (val: string) => void;
    onForge: () => void;
    onBack: () => void;
}

export const WizardAIForge: React.FC<WizardAIForgeProps> = ({ prompt, onPromptChange, onForge, onBack }) => {
    return (
        <div className="flex-1 flex flex-col justify-start py-8 space-y-8 animate-fade-in overflow-y-auto custom-scroll px-1">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-brand-text">Ai Companion Forge</h2>
                <p className="text-xs text-brand-text-muted italic px-4">The architect will manifest a fitting ally based on your prompt and story context.</p>
            </div>

            <div className="space-y-4">
                <label className="block text-[10px] font-bold text-brand-text-muted ml-1">The Request</label>
                <AutoResizingTextarea 
                    value={prompt}
                    onChange={e => onPromptChange(e.target.value)}
                    placeholder="e.g. Add the goblin tinker from our previous conversation, or create a grizzled sky-pirate captain..."
                    className="w-full bg-brand-primary p-4 rounded-2xl border border-brand-primary focus:border-brand-accent focus:outline-none text-sm min-h-[120px] shadow-inner leading-relaxed"
                    autoFocus
                />
                <div className="flex items-center gap-2 p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-xl">
                    <Icon name="info" className="w-4 h-4 text-brand-accent/60" />
                    <p className="text-[9px] text-brand-text-muted leading-tight">
                        The last 5 chat messages are automatically included. You can refer to people, places, or events from your adventure.
                    </p>
                </div>
            </div>

            <div className="pt-8 flex items-center justify-center gap-4 flex-shrink-0">
                <button onClick={onBack} className="btn-secondary btn-md rounded-full px-8">Back</button>
                <button 
                    onClick={onForge}
                    disabled={!prompt.trim()}
                    className="btn-primary btn-md flex-1 rounded-full shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-3"
                >
                    Generate Companion <Icon name="sparkles" className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
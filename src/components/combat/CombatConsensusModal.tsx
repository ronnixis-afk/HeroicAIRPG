import React, { useContext, useState } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import { DiceRollRequest, ChatMessage, DiceRoll } from '../../types';
import { generateResponse } from '../../services/geminiService';
import Modal from '../Modal';

const CombatConsensusPanel: React.FC = () => {
    const { pendingCombat, setPendingCombat, setIsAiGenerating } = useUI();
    const { gameData, processDiceRolls, executeInitiationPipeline, setMessages, applyAiUpdates } = useContext(GameDataContext);
    const [isProcessing, setIsProcessing] = useState(false);

    if (!pendingCombat || !gameData) return null;

    const handleEngage = () => {
        const { narrative, suggestions } = pendingCombat;
        setPendingCombat(null);
        executeInitiationPipeline(narrative, suggestions);
    };

    const handleCancel = () => {
        setPendingCombat(null);
        setMessages(prev => [...prev, {
            id: `sys-cancel-${Date.now()}`,
            sender: 'system',
            content: "Combat sequence cancelled by user.",
            type: 'neutral'
        }]);
    };

    const handleDeescalate = async (skill: 'Persuasion' | 'Intimidation' | 'Stealth' | 'Deception') => {
        if (isProcessing) return;
        
        const currentSuggestions = pendingCombat.suggestions;
        setPendingCombat(null);
        setIsAiGenerating(true);
        setIsProcessing(true);

        const pcName = gameData.playerCharacter.name;
        const pcLevel = gameData.playerCharacter.level;
        const dc = 15 + Math.floor(pcLevel / 2);

        let finalRolls: DiceRoll[] = [];
        let isSuccess = false;
        let outcomeNarrative = "";

        const request: DiceRollRequest = {
            rollerName: pcName,
            rollType: 'Skill Check',
            checkName: skill,
            dc: dc
        };
        const result = processDiceRolls([request]);
        const roll = result.rolls[0];
        isSuccess = roll.outcome === 'Success' || roll.outcome === 'Critical Success';
        finalRolls = result.rolls;
        outcomeNarrative = isSuccess 
            ? `A masterfully executed use of ${skill} has temporarily calmed the situation or allowed for a clean break.`
            : `The attempt to use ${skill} failed, leaving no choice but to face the consequences.`;

        const systemPrompt: ChatMessage = {
            id: `sys-deesc-${Date.now()}`,
            sender: 'system',
            mode: 'OOC',
            content: `[System] The player attempts to de-escalate.
            Skill Attempted: ${skill}
            Outcome: ${isSuccess ? 'Success' : 'Failure'}
            Dice Truth: ${outcomeNarrative}
            
            Instructions:
            ${isSuccess ? 
                'Narrate a successful de-escalation. Hostiles back down or are bypassed. Combat avoided.' : 
                'Narrate a failed attempt. Hostiles are provoked. Combat begins.'}
            `
        };

        try {
            const aiRes = await generateResponse(systemPrompt, {
                ...gameData,
                messages: [...gameData.messages, systemPrompt]
            });

            const aiMessage: ChatMessage = {
                id: `ai-deesc-${Date.now()}`,
                sender: 'ai',
                content: aiRes.narrative,
                rolls: finalRolls
            };
            setMessages(prev => [...prev, aiMessage]);

            if (aiRes.updates) applyAiUpdates(aiRes.updates);

            if (!isSuccess) {
                executeInitiationPipeline(aiRes.narrative, currentSuggestions);
            }
        } catch (e) {
            console.error("De-escalation failed", e);
        } finally {
            setIsProcessing(false);
            setIsAiGenerating(false);
        }
    };

    const footer = (
        <div className="flex flex-col gap-4 w-full">
            <button 
                onClick={handleEngage}
                className="btn-primary btn-lg w-full shadow-lg shadow-brand-accent/20 rounded-2xl"
            >
                Engage Hostiles
            </button>
            <button 
                onClick={handleCancel}
                className="text-[10px] font-bold text-brand-text-muted hover:text-brand-danger transition-colors text-center"
            >
                Dismiss Encounter
            </button>
        </div>
    );

    return (
        <Modal 
            isOpen={true} 
            onClose={handleCancel} 
            title="Hostiles Detected"
            footer={footer}
            maxWidth="md"
        >
            <div className="flex flex-col items-center text-center space-y-8 py-4 animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-brand-danger/10 border border-brand-danger/30 flex items-center justify-center shadow-[0_0_35px_rgba(239,68,68,0.2)] animate-pulse">
                    <Icon name="exclamation" className="w-10 h-10 text-brand-danger" />
                </div>
                
                <div className="space-y-3">
                    <p className="text-body-lg text-brand-text italic leading-relaxed px-4">
                        "The atmosphere tenses. Steel is drawn. The line between discourse and violence has vanished."
                    </p>
                    <p className="text-body-sm text-brand-text-muted font-medium">
                        Will you stand your ground or attempt to de-escalate?
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full px-2">
                    <button 
                        onClick={() => handleDeescalate('Stealth')} 
                        disabled={isProcessing}
                        className="flex flex-col items-center py-6 px-4 bg-brand-primary/20 border border-brand-surface rounded-3xl hover:bg-brand-primary/40 hover:border-brand-accent/30 transition-all group gap-3 shadow-inner"
                    >
                        <div className="p-3 bg-brand-surface rounded-2xl border border-brand-primary group-hover:scale-110 transition-transform shadow-md">
                            <img src="/icons/sneak.png" alt="Stealth" className="w-6 h-6 object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-brand-accent text-center">Stealth</span>
                            <span className="text-body-sm text-brand-text font-bold">Distract & Hide</span>
                        </div>
                    </button>
                    
                    <button 
                        onClick={() => handleDeescalate('Persuasion')} 
                        disabled={isProcessing}
                        className="flex flex-col items-center py-6 px-4 bg-brand-primary/20 border border-brand-surface rounded-3xl hover:bg-brand-primary/40 hover:border-brand-accent/30 transition-all group gap-3 shadow-inner"
                    >
                        <div className="p-3 bg-brand-surface rounded-2xl border border-brand-primary group-hover:scale-110 transition-transform shadow-md">
                            <img src="/icons/persuade.png" alt="Persuade" className="w-6 h-6 object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-brand-accent text-center">Social</span>
                            <span className="text-body-sm text-brand-text font-bold">Charm Your Way</span>
                        </div>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CombatConsensusPanel;

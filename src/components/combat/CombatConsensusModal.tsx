// components/combat/CombatConsensusPanel.tsx

import React, { useContext, useState } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import { DiceRollRequest, ChatMessage, DiceRoll } from '../../types';
import { generateResponse } from '../../services/geminiService';

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

        // Standard check
        const request: DiceRollRequest = {
            rollerName: pcName,
            rollType: 'Skill Check',
            checkName: skill,
            dc: dc
        };
        // FIX: processDiceRolls expects an array of requests to support group checks or multi-part resolutions
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

    return (
        <div className="w-full max-w-xl mx-auto my-8 animate-page px-4">
            <div className="bg-brand-surface border border-brand-danger/30 rounded-3xl shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center">
                
                <div className="w-16 h-16 rounded-full bg-brand-danger/10 border border-brand-danger/30 flex items-center justify-center mb-6 shadow-[0_0_25px_rgba(239,68,68,0.1)]">
                    <Icon name="exclamation" className="w-8 h-8 text-brand-danger animate-pulse" />
                </div>
                
                <div className="space-y-2 mb-8 w-full">
                    <h3 className="text-brand-text">Hostiles Detected</h3>
                    <p className="text-body-base text-brand-text-muted leading-relaxed max-w-sm mx-auto">
                        The situation has turned critical. Will you stand your ground or attempt to de-escalate?
                    </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                    <button 
                        onClick={handleEngage}
                        className="btn-primary btn-md sm:col-span-2 shadow-brand-accent/20 rounded-xl"
                    >
                        Engage Hostiles
                    </button>

                    <button 
                        onClick={() => handleDeescalate('Stealth')} 
                        disabled={isProcessing}
                        className="btn-secondary btn-md text-xs rounded-xl"
                    >
                        Distract and Hide
                    </button>
                    
                    <button 
                        onClick={() => handleDeescalate('Persuasion')} 
                        disabled={isProcessing}
                        className="btn-secondary btn-md text-xs rounded-xl"
                    >
                        Charm Your Way Out
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-brand-primary/20 w-full flex flex-col items-center gap-4">
                    <button 
                        onClick={handleCancel}
                        className="text-body-sm font-bold text-brand-text-muted hover:text-brand-danger transition-colors underline underline-offset-4"
                    >
                        Is this encounter incorrect? Dismiss.
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CombatConsensusPanel;
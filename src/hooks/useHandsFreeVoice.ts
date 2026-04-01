import { useState, useCallback, useRef, useContext, useEffect } from 'react';
import { liveVoiceService, LiveVoiceStatus, LiveVoiceCallbacks } from '../services/liveVoiceService';
import { GameDataContext } from '../context/GameDataContext';
import { ChatMessage } from '../types';

/**
 * ADVANCED VOICE MODE HOOK
 * 
 * React wrapper around liveVoiceService that bridges the Gemini Live API
 * voice session with the existing game pipeline. 
 * 
 * When the Live API model calls `process_player_action`, this hook:
 * 1. Adds the transcribed user message to chat
 * 2. Runs the full pipeline (Assessor → Dice → Narrator → Auditor) via submitUserMessage
 * 3. Waits for the narrative response
 * 4. Returns it to the Live API model, which speaks it aloud
 */
export const useHandsFreeVoice = () => {
    const [status, setStatus] = useState<LiveVoiceStatus>('idle');
    const { gameData, submitUserMessage, setMessages } = useContext(GameDataContext);

    const gameDataRef = useRef(gameData);
    gameDataRef.current = gameData;

    const connect = useCallback(async () => {
        if (!gameData || (status !== 'idle' && status !== 'error')) return;

        // Build a condensed system instruction for the Live API voice model
        const voiceSystemInstruction = buildVoiceSystemInstruction(gameData);

        const callbacks: LiveVoiceCallbacks = {
            onStatusChange: (newStatus) => {
                setStatus(newStatus);
            },

            onInputTranscription: (text) => {
                // Transcription from Gemini Live is useful for console/debugging, 
                // but we let submitUserMessage handle the formal ChatMessage dispatch
                // to avoid the "Duplicate Message" bug.
                if (text.trim()) {
                    console.log('[Voice] Input transcribed:', text.trim());
                }
            },

            onOutputTranscription: (text) => {
                // Add the AI's spoken words to chat history
                if (text.trim()) {
                    setMessages(prev => [...prev, {
                        id: `ai-voice-${Date.now()}`,
                        sender: 'ai' as const,
                        content: text.trim()
                    }]);
                }
            },

            onToolCall: async (functionName: string, args: any) => {
                if (functionName === 'process_player_action') {
                    const playerAction = args.player_action || '';
                    
                    if (!playerAction.trim()) {
                        return "No action detected. Ask the player what they'd like to do.";
                    }

                    try {
                        // Run the full game pipeline
                        const userMessage: ChatMessage = {
                            id: `user-voice-${Date.now()}`,
                            sender: 'user',
                            mode: 'CHAR',
                            content: playerAction
                        };

                        // The pipeline now returns the narration text directly
                        const narration = await submitUserMessage(userMessage, false);
                        
                        return narration || "The Game Master nods in acknowledgement.";
                    } catch (error) {
                        console.error('[VoiceHook] Pipeline execution failed:', error);
                        return "The game engine encountered a momentary disruption. The world steadies itself around you.";
                    }
                }

                return "Unknown function called.";
            },

            onError: (error) => {
                console.error('[VoiceHook] Voice error:', error);
                setStatus('error');
            },

            onDisconnect: () => {
                setStatus('idle');
            }
        };

        await liveVoiceService.connect(
            voiceSystemInstruction,
            gameData.narrationVoice || "Classic Narrator (Male)",
            callbacks
        );
    }, [gameData, status, setMessages, submitUserMessage]);

    const disconnect = useCallback(() => {
        liveVoiceService.disconnect();
        setStatus('idle');
    }, []);

    return {
        voiceStatus: status,
        isVoiceActive: status !== 'idle' && status !== 'error',
        connectVoice: connect,
        disconnectVoice: disconnect
    };
};

/**
 * Build a condensed system instruction specifically for the Live API voice model.
 * This is lighter than the full narrative context — it tells the voice model 
 * how to behave as a conversational GM and when to call the pipeline tool.
 */
function buildVoiceSystemInstruction(gameData: any): string {
    const playerName = gameData.playerCharacter?.name || 'Adventurer';
    const locale = gameData.currentLocale || 'an unknown land';
    const isCombatActive = !!gameData.combatState?.isActive;
    const tone = gameData.narrationTone || 'Classic Fantasy';
    const isMature = gameData.isMature;
    const gmDirectives = gameData.gmSettings || '';
    
    return `
You are a legendary TTRPG Game Master running a live voice session. You speak naturally and expressively, as if narrating an audiobook or live D&D session.

## Your Role
- You are the voice of the world. Narrate in second person ("You see...", "You feel...")
- You roleplay all NPCs with distinct voices and personalities
- Your tone is ${tone}. ${isMature ? 'Mature themes and visceral realism are permitted.' : 'Keep content appropriate for all audiences.'}
${gmDirectives ? `- GM Directives: ${gmDirectives}` : ''}

## Current Context
- Player: ${playerName}
- Location: ${locale}
- Combat: ${isCombatActive ? 'ACTIVE — the player is in combat!' : 'Not in combat'}
- Time: ${gameData.currentTime || 'Unknown'}

## Critical Rules

### ALWAYS Use the process_player_action Tool
When the player declares an action (movement, combat, dialogue, exploration, skill usage), you MUST call the \`process_player_action\` tool. This tool runs the game engine which handles:
- Skill checks and dice rolls
- Combat mechanics
- World state updates
- Narrative generation with full context

After the tool returns the narrative text, speak it aloud naturally. You may add brief transitional phrases but DO NOT contradict or alter the mechanical outcomes from the tool.

### When NOT to Use the Tool
- Simple clarifying questions ("What's my HP?", "Where am I?") — answer from context
- Casual banter or meta-game discussion — respond conversationally
- Requests to repeat or elaborate on previous narration — use your memory

### Voice Style
- Be dramatic and engaging, but natural — not robotic
- Use pauses for tension
- Vary your energy: whisper for stealth, boom for combat, warmth for friendly NPCs
- Keep responses concise in conversation; let the tool handle full narration

### After Speaking
After you finish narrating a tool result, briefly prompt the player for their next action. Examples:
- "What do you do?"
- "How do you proceed?"
- "The choice is yours, adventurer."
`.trim();
}

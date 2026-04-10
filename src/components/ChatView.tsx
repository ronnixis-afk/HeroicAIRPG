// components/ChatView.tsx

import React, { useContext, useRef, useEffect, useMemo } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import { useUI } from '../context/UIContext';
import { Icon } from './Icon';
import PlayerAttackModal from './combat/PlayerAttackModal';
import { PartyQuickStatus } from './chat/PartyQuickStatus';

// Modular Components
import { MessageItem } from './chat/MessageItem';
import { SystemMessageGroup } from './chat/SystemGroup';
import { CombatControls } from './chat/CombatControls';
import { EntityLinker } from './chat/EntityLinker';
import { calculateAlignmentRelationshipShift, normalizeAlignment } from '../utils/npcUtils';
import { isLocaleMatch } from '../utils/mapUtils';
import CombatConsensusPanel from './combat/CombatConsensusModal';
import { EntityLightbox } from './chat/EntityLightbox';
import { SystemToastManager } from './chat/SystemToastManager';

import { useHandsFreeVoice } from '../hooks/useHandsFreeVoice';
import { useAudioPlayback } from './chat/useAudioPlayback';
import { DiceTray } from './chat/DiceTray';
import { AlignmentActionTray } from './chat/AlignmentActionTray';

const ChatView: React.FC = () => {
    const {
        gameData,
        playNpcTurn,
        performAutomatedPlayerTurn,
        generateObjectiveFollowUp,
        setMessages,
        removeStoryLogsByMessageIds,
        submitUserMessage,
        updatePlayerCharacter,
        updateNPC,
        updateCompanion,
        dispatch
    } = useContext(GameDataContext);

    const { isAssessing, isAiGenerating, isAuditing, isHousekeeping, pendingCombat, setActiveView, setActivePanel, setActingCharacterId, isHeroicModeActive, setSelectedCharacterId, setActiveCharacterSection } = useUI();

    const chatEndRef = useRef<HTMLDivElement>(null);
    const isInitialRender = useRef(true);
    const lastUserMessageId = useRef<string | null>(null);

    // Audio Logic for auto-play in Hands-Free
    const { speak, playingMessageId } = useAudioPlayback(
        gameData?.useAiTts ?? false,
        gameData?.narrationVoice || "Classic Narrator (Male)",
        gameData?.narrationTone || "Classic Fantasy"
    );

    const { isVoiceActive } = useHandsFreeVoice();

    const messages = gameData?.messages ?? [];
    const isHandsFree = gameData?.isHandsFree ?? false;

    const processedMessages = useMemo(() => {
        if (!messages || !Array.isArray(messages) || messages.length === 0) return [];

        // Pass 1: Handle Roll Splitting and AI Attachment
        const phase1: any[] = [];
        let i = 0;
        while (i < messages.length) {
            const currentMsg = messages[i];
            if (!currentMsg) { i++; continue; }
            const nextMsg = (i + 1 < messages.length) ? messages[i + 1] : null;

            if (currentMsg.sender === 'system' && currentMsg.rolls && nextMsg && nextMsg.sender === 'ai') {
                const encounterRolls = currentMsg.rolls.filter((r: any) => r.rollType === 'Encounter Check');
                const actionRolls = currentMsg.rolls.filter((r: any) => r.rollType !== 'Encounter Check');

                if (actionRolls.length > 0) {
                    // If we have encounter rolls in the same beat, keep them as a separate system entry (will be grouped in Pass 2)
                    if (encounterRolls.length > 0) {
                        phase1.push({ ...currentMsg, rolls: encounterRolls });
                    }
                    // Attach Skill/Combat rolls to the narrative response
                    phase1.push({ ...nextMsg, rolls: actionRolls });
                    i += 2;
                    continue;
                }
            }

            phase1.push(currentMsg);
            i += 1;
        }

        // Pass 2: Group consecutive standalone system messages
        const phase2: any[] = [];
        let j = 0;
        while (j < phase1.length) {
            const msg = phase1[j];

            // A system message is considered "simple" (loggable) if it has no action rolls (Skill/Attack).
            // Encounter Checks are now considered simple as they are text-only logs.
            const hasActionRolls = msg.rolls?.some((r: any) => r.rollType !== 'Encounter Check');
            const isSimpleSystem = msg.sender === 'system' && !hasActionRolls;

            if (isSimpleSystem) {
                const group: any[] = [msg];
                let k = j + 1;
                while (k < phase1.length && phase1[k].sender === 'system' && !(phase1[k].rolls?.some((r: any) => r.rollType !== 'Encounter Check'))) {
                    group.push(phase1[k]);
                    k++;
                }
                phase2.push({
                    id: `group-${msg.id}`,
                    sender: 'system_group',
                    group
                });
                j = k;
            } else {
                phase2.push(msg);
                j++;
            }
        }
        return phase2;
    }, [messages]);

    const trackedObjective = useMemo(() => gameData?.objectives.find(o => o.isTracked && o.status === 'active'), [gameData?.objectives]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!processedMessages || processedMessages.length === 0) return;

            // Find the latest user message in the current set
            const lastUserMsg = [...processedMessages].reverse().find(m => m.sender === 'user') as any;

            // Handle Initial Render: Always anchor to the bottom of the chat history
            if (isInitialRender.current) {
                if (chatEndRef.current) {
                    chatEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
                }
                if (lastUserMsg) {
                    lastUserMessageId.current = lastUserMsg.id;
                }
                isInitialRender.current = false;
                return;
            }
            
            // Check if this is a NEW user message we haven't scrolled to top yet
            if (lastUserMsg && lastUserMsg.id !== lastUserMessageId.current) {
                const element = document.getElementById(`msg-${lastUserMsg.id}`);
                if (element) {
                    // Force the user message to the top of the screen/container
                    element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    lastUserMessageId.current = lastUserMsg.id;
                    return; // Skip standard bottom scroll for this specific update
                }
            }

            if (chatEndRef.current) {
                chatEndRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end'
                });
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [processedMessages, isAssessing, isAiGenerating, isAuditing, isHousekeeping, gameData?.combatState?.turnOrder, pendingCombat]);

    // HANDS-FREE AUTO-PLAY EFFECT
    useEffect(() => {
        // GUARD: Only trigger if isHandsFree is on AND Gemini Live is NOT actively handles audio
        if (isHandsFree && !isVoiceActive && processedMessages.length > 0) {
            const lastMsg = processedMessages[processedMessages.length - 1];
            // GUARD: Only trigger if the message is from AI and we aren't already playing it
            if (lastMsg && lastMsg.sender === 'ai' && lastMsg.content && playingMessageId !== lastMsg.id) {
                speak(lastMsg.content, lastMsg.id, lastMsg.dialogues);
            }
        }
    }, [processedMessages.length, isHandsFree, isVoiceActive, speak, playingMessageId]);

    useEffect(() => {
        const handleAlignmentAction = async (e: Event) => {
            const customEvent = e as CustomEvent<{ label: string; alignment: string }>;
            const { label, alignment } = customEvent.detail;

            if (gameData?.playerCharacter) {
                const updatedPlayer = { ...gameData.playerCharacter };
                if (!updatedPlayer.alignment) {
                    updatedPlayer.alignment = { lawChaos: 0, goodEvil: 0 };
                }

                const normAlign = normalizeAlignment(alignment);
                const roll = Math.floor(Math.random() * 4) + 1; // 1d4
                let axis = '';
                let change = '';

                if (normAlign === 'Good') {
                    updatedPlayer.alignment.goodEvil += roll;
                    axis = 'Morality';
                    change = `+${roll} Good`;
                } else if (normAlign === 'Evil') {
                    updatedPlayer.alignment.goodEvil -= roll;
                    axis = 'Morality';
                    change = `-${roll} Evil`;
                } else if (normAlign === 'Lawful') {
                    updatedPlayer.alignment.lawChaos += roll;
                    axis = 'Order';
                    change = `+${roll} Lawful`;
                } else if (normAlign === 'Chaotic') {
                    updatedPlayer.alignment.lawChaos -= roll;
                    axis = 'Order';
                    change = `-${roll} Chaotic`;
                }

                // Clamp values between -100 and 100
                updatedPlayer.alignment.goodEvil = Math.max(-100, Math.min(100, updatedPlayer.alignment.goodEvil));
                updatedPlayer.alignment.lawChaos = Math.max(-100, Math.min(100, updatedPlayer.alignment.lawChaos));

                await updatePlayerCharacter(updatedPlayer as any);

                // Determine relationship shifts for present NPCs
                const shifts: string[] = [];
                const currentLocale = gameData.currentLocale || "";
                const activeCompanionIds = new Set((gameData.companions || []).map(c => c.id));

                for (const npc of (gameData.npcs || [])) {
                    const npcPOI = npc.currentPOI || "";
                    const isAtLocale = isLocaleMatch(npcPOI, currentLocale) || npcPOI === 'Current' || npcPOI === 'With Party';
                    const isActiveCompanion = npc.companionId && activeCompanionIds.has(npc.companionId);
                    const isAlive = npc.status !== 'Dead';
                    const isSentient = npc.isSentient !== false && !npc.isShip;

                    if ((isAtLocale || isActiveCompanion) && isAlive && isSentient) {
                        const relChange = calculateAlignmentRelationshipShift(alignment, npc.moralAlignment);
                        if (relChange !== 0) {
                            const updatedNpc = { ...npc, relationship: (npc.relationship || 0) + relChange };
                            updateNPC(updatedNpc);
                            if (updatedNpc.companionId) {
                                const comp = gameData.companions.find(c => c.id === updatedNpc.companionId);
                                if (comp) {
                                    updateCompanion({ ...comp, relationship: updatedNpc.relationship } as any);
                                }
                            }
                            shifts.push(`${npc.name} (${relChange > 0 ? '+' : ''}${relChange})`);
                        }
                    }
                }

                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `sys-align-${Date.now()}`,
                        sender: 'system',
                        content: `**Alignment Shift**: *${change}* (${axis} axis).`,
                        timestamp: gameData.currentTime || new Date().toISOString()
                    }
                });

                if (shifts.length > 0) {
                    dispatch({
                        type: 'ADD_MESSAGE',
                        payload: {
                            id: `sys-rel-${Date.now()}`,
                            sender: 'system',
                            content: `**Reactions**: ${shifts.join(', ')}`,
                            timestamp: gameData.currentTime || new Date().toISOString()
                        }
                    });
                }
            }

            await submitUserMessage({
                id: `msg-${Date.now()}`,
                sender: 'user',
                content: label,
                mode: 'CHAR',
                explicitAlignment: alignment
            }, isHeroicModeActive);
        };

        window.addEventListener('alignment-action', handleAlignmentAction);
        return () => window.removeEventListener('alignment-action', handleAlignmentAction);
    }, [gameData, submitUserMessage, updatePlayerCharacter, updateNPC, updateCompanion, dispatch]);


    const handleClearPrevious = (messageId: string) => {
        if (!gameData || !gameData.messages) return;

        const msgIndex = gameData.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;

        // Identify all messages to remove (everything up to and including the selected one)
        const messagesToRemove = gameData.messages.slice(0, msgIndex + 1);
        const idsToRemove = messagesToRemove.map(m => m.id);

        // Sync removal with Story Logs to prevent the Librarian agent from retrieving deleted context
        removeStoryLogsByMessageIds(idsToRemove);

        // Update the message state
        setMessages(prev => prev.filter(m => !idsToRemove.includes(m.id)));
    };

    const loadingConfig = useMemo(() => {
        if (isAssessing) return { label: 'Assessing', diceColor: 'text-gray-500', textColor: 'text-gray-500' };
        if (isAiGenerating) return { label: 'Thinking', diceColor: 'text-brand-accent', textColor: 'text-brand-accent' };
        if (isAuditing) return { label: 'Auditing', diceColor: 'text-blue-400', textColor: 'text-blue-400' };
        if (isHousekeeping) return { label: 'Housekeeping', diceColor: 'text-emerald-400', textColor: 'text-emerald-400' };
        return null;
    }, [isAssessing, isAiGenerating, isAuditing, isHousekeeping]);

    const activeAlignmentOptions = useMemo(() => {
        if (gameData?.combatState?.isActive) return null;

        // Search backwards for the latest alignment offering
        for (let i = processedMessages.length - 1; i >= 0; i--) {
            const msg = processedMessages[i];
            
            // FENCING: If we hit a combat start/end boundary, stop searching.
            // We don't want to show options from before a previous fight.
            const content = msg.content || '';
            if (msg.sender === 'system' && (
                content.includes('**Combat begins**') || 
                content.includes('**Victory**') ||
                content.includes('**Combat concludes**')
            )) {
                return null;
            }

            // If the user already made an alignment choice, the current context is consumed
            if (msg && msg.sender === 'user' && msg.explicitAlignment) {
                return null;
            }

            // If we find an AI message, it is the sole source of truth for the latest narrative state.
            // If it doesn't have options (e.g. OOC mode), we do NOT reach back to previous turns.
            if (msg && msg.sender === 'ai') {
                return (msg.alignmentOptions && msg.alignmentOptions.length > 0) ? msg.alignmentOptions : null;
            }

            // Skip any other messages (System logs, regular User chat, AI narration without choices)
            // to ensure alignment buttons persist through transitions like travel or boarding.
        }
        return null;
    }, [processedMessages, gameData?.combatState?.isActive]);

    const charactersWithUnspentTraits = useMemo(() => {
        if (!gameData) return [];
        const result: { id: string, name: string }[] = [];

        const check = (char: any, id: string) => {
            const level = char.level || 1;
            const total = Math.floor(level / 3);
            const used = (char.abilities || []).filter((a: any) => a.isLevelUpTrait).length;
            if (total > used) {
                result.push({ id, name: char.name });
            }
        };

        if (gameData.playerCharacter) {
            check(gameData.playerCharacter, 'player');
        }

        (gameData.companions || []).forEach(comp => {
            check(comp, comp.id);
        });

        return result;
    }, [gameData]);

    const smoothScrollToBottom = (force = false) => {
        const container = document.querySelector('.chat-scroll-container');
        if (container) {
            // Increase threshold to 500px to ensure we don't 'lose' the bottom during a long text reveal 
            // where alignment buttons might push the scroll significantly
            const isNearBottom = force || (container.scrollHeight - container.scrollTop - container.clientHeight) < 500;
            if (isNearBottom) {
                if (chatEndRef.current) {
                    chatEndRef.current.scrollIntoView({
                        behavior: 'smooth',
                        block: 'end'
                    });
                }
            }
        }
    };

    useEffect(() => {
        const handleRevealUpdate = () => smoothScrollToBottom(false);
        window.addEventListener('chat-reveal-update', handleRevealUpdate);
        return () => window.removeEventListener('chat-reveal-update', handleRevealUpdate);
    }, []);

    return (
        <div className="h-full flex flex-col overflow-hidden relative">
            <div className="absolute top-[3px] right-[3px] z-60">
                <PartyQuickStatus />
            </div>

            <div className="flex-1 overflow-y-auto chat-scroll-container">
                <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
                    {processedMessages.map((msg, index) => {
                        if (!msg) return null;

                        if (msg.sender === 'system_group') {
                            return (
                                <React.Fragment key={msg.id}>
                                    <SystemMessageGroup messages={msg.group} />
                                </React.Fragment>
                            );
                        }

                        if (msg.sender === 'system') {
                            const parts = (msg.content || '').split(/(\*\*.*?\*\*|\*.*?\*)/g);
                            const hasRolls = msg.rolls && msg.rolls.length > 0;
                            return (
                                <div key={msg.id} className="w-full flex flex-col items-center my-3 animate-fade-in px-4">
                                    <div className={`text-body-sm font-normal text-center text-brand-text-muted ${hasRolls ? 'mb-2' : ''}`}>
                                        {parts.map((part: string, i: number) => {
                                            if (!part) return null;
                                            if (part.startsWith('**') && part.endsWith('**')) {
                                                return <strong key={i} className="font-bold text-brand-text"><EntityLinker text={part.slice(2, -2)} /></strong>;
                                            }
                                            if (part.startsWith('*') && part.endsWith('*')) {
                                                return <em key={i} className="italic text-brand-accent/90"><EntityLinker text={part.slice(1, -1)} /></em>;
                                            }
                                            return <EntityLinker key={i} text={part} />;
                                        })}
                                    </div>
                                    {hasRolls && <DiceTray rolls={msg.rolls} />}
                                </div>
                            );
                        }

                        const isLatest = index === processedMessages.length - 1;

                        return (
                            <React.Fragment key={msg.id}>
                                <MessageItem
                                    msg={msg}
                                    onSpeak={speak}
                                    isPlaying={playingMessageId === msg.id}
                                    showAlignmentOptions={false}
                                    onClearChat={() => handleClearPrevious(msg.id)}
                                    isLatest={isLatest}
                                />
                            </React.Fragment>
                        );
                    })}

                    {pendingCombat && <CombatConsensusPanel />}

                    {loadingConfig && (
                        <div className="flex justify-center pb-8 pt-4">
                            <div className="max-w-[120px] w-full flex flex-col items-center gap-2">
                                <div className={`w-10 h-10 ${loadingConfig.diceColor} animate-dice flex items-center justify-center transition-colors duration-500`}>
                                    <Icon name="dice" className="w-full h-full drop-shadow-[0_0_8px_rgba(62,207,142,0.4)]" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className={`text-body-sm ${loadingConfig.textColor} font-bold animate-pulse transition-colors duration-500`}>
                                        {loadingConfig.label}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}



                    <div ref={chatEndRef} className="h-1" />
                </div>
            </div>

            <div className="w-full max-w-4xl mx-auto">
                {activeAlignmentOptions && activeAlignmentOptions.length > 0 && (
                    <AlignmentActionTray options={activeAlignmentOptions} />
                )}
            </div>
            {charactersWithUnspentTraits.length > 0 && (
                <div 
                    className={`absolute ${activeAlignmentOptions && activeAlignmentOptions.length > 0 ? 'bottom-[136px]' : 'bottom-[44px]'} left-1/2 -translate-x-1/2 z-50 animate-bounce-subtle cursor-pointer transition-all duration-500`}
                    onClick={() => {
                        const first = charactersWithUnspentTraits[0];
                        setSelectedCharacterId(first.id);
                        setActiveCharacterSection('Abilities');
                        setActiveView('character');
                    }}
                >
                    <div className="bg-brand-accent/90 backdrop-blur-md text-black px-4 py-2 rounded-full shadow-2xl border border-white/20 flex items-center gap-2 hover:scale-105 transition-transform active:scale-95 group">
                        <Icon name="sparkles" className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                        <span className="text-xs font-bold leading-tight text-center">Your Party Has Unspent Trait Points</span>
                    </div>
                </div>
            )}

            <SystemToastManager />
            <EntityLightbox />
        </div>
    );
};

export default ChatView;

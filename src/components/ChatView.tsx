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
import { calculateAlignmentRelationshipShift } from '../utils/npcUtils';
import { isLocaleMatch } from '../utils/mapUtils';
import CombatConsensusPanel from './combat/CombatConsensusModal';
import { EntityLightbox } from './chat/EntityLightbox';

// Custom Hooks
import { useAudioPlayback } from './chat/useAudioPlayback';
import { DiceTray } from './chat/DiceTray';

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

    const { isAssessing, isAiGenerating, isAuditing, isHousekeeping, pendingCombat, setActivePanel, setActingCharacterId } = useUI();

    const chatEndRef = useRef<HTMLDivElement>(null);
    const isInitialRender = useRef(true);

    // Audio Logic for auto-play in Hands-Free
    const { speak, playingMessageId } = useAudioPlayback(
        gameData?.useAiTts ?? false,
        gameData?.narrationVoice || "Classic Narrator (Male)",
        gameData?.narrationTone || "Classic Fantasy"
    );

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
            if (chatEndRef.current) {
                chatEndRef.current.scrollIntoView({
                    behavior: isInitialRender.current ? 'auto' : 'smooth',
                    block: 'end'
                });
                isInitialRender.current = false;
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [processedMessages, isAssessing, isAiGenerating, isAuditing, isHousekeeping, gameData?.combatState?.turnOrder, pendingCombat]);

    // HANDS-FREE AUTO-PLAY EFFECT
    useEffect(() => {
        if (isHandsFree && processedMessages.length > 0) {
            const lastMsg = processedMessages[processedMessages.length - 1];
            // GUARD: Only trigger if the message is from AI and we aren't already playing it
            if (lastMsg && lastMsg.sender === 'ai' && lastMsg.content && playingMessageId !== lastMsg.id) {
                speak(lastMsg.content, lastMsg.id);
            }
        }
    }, [processedMessages.length, isHandsFree, speak, playingMessageId]);

    useEffect(() => {
        const handleAlignmentAction = async (e: Event) => {
            const customEvent = e as CustomEvent<{ label: string; alignment: string }>;
            const { label, alignment } = customEvent.detail;

            if (gameData?.playerCharacter) {
                const updatedPlayer = { ...gameData.playerCharacter };
                if (!updatedPlayer.alignment) {
                    updatedPlayer.alignment = { lawChaos: 0, goodEvil: 0 };
                }

                const roll = Math.floor(Math.random() * 4) + 1; // 1d4
                let axis = '';
                let change = '';

                if (alignment === 'Good') {
                    updatedPlayer.alignment.goodEvil += roll;
                    axis = 'Morality';
                    change = `+${roll} Good`;
                } else if (alignment === 'Evil') {
                    updatedPlayer.alignment.goodEvil -= roll;
                    axis = 'Morality';
                    change = `-${roll} Evil`;
                } else if (alignment === 'Lawful') {
                    updatedPlayer.alignment.lawChaos += roll;
                    axis = 'Order';
                    change = `+${roll} Lawful`;
                } else if (alignment === 'Chaotic') {
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

                let syncMessage = `**Alignment Shift**: *${change}* (${axis} axis).`;
                if (shifts.length > 0) {
                    syncMessage += `\n**Reactions**: ${shifts.join(', ')}`;
                }

                await submitUserMessage({
                    id: `msg-align-${Date.now()}`,
                    sender: 'system',
                    content: syncMessage,
                    timestamp: gameData.currentTime || new Date().toISOString()
                });
            }

            await submitUserMessage({
                id: `msg-${Date.now()}`,
                sender: 'user',
                content: label,
                mode: 'CHAR'
            });
        };

        window.addEventListener('alignment-action', handleAlignmentAction);
        return () => window.removeEventListener('alignment-action', handleAlignmentAction);
    }, [gameData, submitUserMessage, updatePlayerCharacter, updateNPC, updateCompanion, dispatch]);

    const handleFollowUp = async () => {
        if (trackedObjective) {
            await generateObjectiveFollowUp(trackedObjective.id);
        }
    };

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

    const latestAiMessageWithAlignment = useMemo(() => {
        for (let i = processedMessages.length - 1; i >= 0; i--) {
            const msg = processedMessages[i];
            if (msg && msg.sender === 'user') {
                return null; // A user message was sent after, hide options
            }
            if (msg && msg.sender === 'ai') {
                if (msg.alignmentOptions && msg.alignmentOptions.length > 0) {
                    return msg.id;
                }
                return null; // Another AI message without options was sent
            }
        }
        return null;
    }, [processedMessages]);

    return (
        <div className="h-full flex flex-col overflow-hidden relative">
            <div className="absolute top-[3px] right-[3px] z-40">
                <PartyQuickStatus />
            </div>

            <div className="flex-1 overflow-y-auto chat-scroll-container">
                <div className="max-w-3xl mx-auto p-4 space-y-4">
                    {processedMessages.map((msg, index) => {
                        if (!msg) return null;

                        // Location Change Detection Logic
                        let renderLocationHeader = null;
                        if (msg.sender === 'ai' || msg.sender === 'system') {
                            const currentLocName = msg.current_site_name || msg.currentPOI || msg.location;
                            const currentZoneName = msg.location;
                            // Search backwards for the last relevant AI/System message to compare location
                            let prevLocName = null;
                            for (let k = index - 1; k >= 0; k--) {
                                const prevMsg = processedMessages[k];
                                if (prevMsg && (prevMsg.sender === 'ai' || prevMsg.sender === 'system')) {
                                    prevLocName = prevMsg.current_site_name || prevMsg.currentPOI || prevMsg.location;
                                    break;
                                }
                            }

                            if (currentLocName && currentLocName !== prevLocName) {
                                renderLocationHeader = (
                                    <div className="w-full flex flex-col items-center mt-12 mb-6 animate-fade-in px-4">
                                        <div className="h-[1px] w-1/3 bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent mb-4"></div>
                                        <h3 className="text-2xl font-black text-brand-text font-serif tracking-tight text-center drop-shadow-md mb-1 capitalize">
                                            {currentLocName}
                                        </h3>
                                        {currentZoneName && currentZoneName !== currentLocName && (
                                            <span className="text-body-base font-semibold text-brand-accent/80 tracking-normal uppercase text-center flex items-center gap-2">
                                                <Icon name="location" className="w-4 h-4" />
                                                {currentZoneName}
                                            </span>
                                        )}
                                        <div className="h-[1px] w-1/3 bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent mt-4"></div>
                                    </div>
                                );
                            }
                        }

                        if (msg.sender === 'system_group') {
                            return (
                                <React.Fragment key={msg.id}>
                                    {renderLocationHeader}
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

                        return (
                            <React.Fragment key={msg.id}>
                                {renderLocationHeader}
                                <MessageItem
                                    msg={msg}
                                    onSpeak={speak}
                                    isPlaying={playingMessageId === msg.id}
                                    showAlignmentOptions={msg.id === latestAiMessageWithAlignment}
                                    onClearChat={() => handleClearPrevious(msg.id)}
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

                    {gameData && !loadingConfig && (
                        <CombatControls
                            gameData={gameData}
                            isLoading={!!loadingConfig}
                            onManualAction={(actorId) => {
                                setActingCharacterId(actorId || 'player');
                                setActivePanel('abilities');
                            }}
                            onAutoResolve={performAutomatedPlayerTurn}
                            onNpcTurn={playNpcTurn}
                        />
                    )}

                    {!gameData?.combatState?.isActive && trackedObjective && !loadingConfig && (
                        <div className="flex justify-center my-4 pb-4 animate-fade-in">
                            <button onClick={handleFollowUp} className="btn-primary btn-sm rounded-full gap-2 shadow-md">
                                <Icon name="target" className="w-3 h-3" />
                                Follow Up Quest: {trackedObjective.title}
                            </button>
                        </div>
                    )}
                    <div ref={chatEndRef} className="h-1" />
                </div>
            </div>
            <EntityLightbox />
        </div>
    );
};

export default ChatView;
// components/chat/PartyQuickStatus.tsx

import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import type { DiceRollRequest, ChatMessage, StatusEffect, DiceRoll } from '../../types';
import { Icon } from '../Icon';
import { generateResponse } from '../../services/geminiService';
import { npcToCombatActor } from '../../utils/npcUtils';
import { StatusAvatar } from './StatusAvatar';
import { NearbyActors } from './NearbyActors';
import { canBeTargeted } from '../../utils/resolution/StatusRules';

/**
 * THE PARTY QUICK STATUS PANEL
 * Orchestrates the high-level UI for the active party and nearby entities.
 * Manages the "Two-Step Hide" stealth mechanic and navigation shortcuts.
 */
export const PartyQuickStatus: React.FC = () => {
    const { gameData, processDiceRolls, applyAiUpdates, dispatch, refineNPC } = useContext(GameDataContext) as GameDataContextType;
    // Fix: isPartyHidden is part of GameData state, not UIContext. Removed from useUI destructuring.
    const { setActiveView, setActivePanel, setSelectedCharacterId, setActingCharacterId, setIsAiGenerating } = useUI();
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Filter active party members
    const activeCompanions = useMemo(() => {
        if (!gameData) return [];
        return gameData.companions.filter(c => c.isInParty !== false);
    }, [gameData]);
    
    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!gameData || gameData.combatState?.isActive) return null;

    // Fix: Destructured isPartyHidden from gameData to resolve the UI context error.
    const { playerCharacter, partyStealthScore, isPartyHidden } = gameData;

    const handleCharacterClick = (id: string) => {
        setOpenMenuId(prev => prev === id ? null : id);
    };

    const navigateToView = (view: 'character' | 'inventory', charId: string) => {
        setSelectedCharacterId(charId);
        setActiveView(view);
        setOpenMenuId(null);
    };

    const openQuickActions = (charId: string) => {
        setActingCharacterId(charId);
        setActivePanel('abilities');
        setOpenMenuId(null);
    };

    const handleStealthToggle = async () => {
        if (!gameData) return;

        if (isPartyHidden) {
            dispatch({ type: 'SET_PARTY_HIDDEN', payload: { isHidden: false } });
            const removalUpdates: any = {
                playerCharacter: {
                    statusEffects: (playerCharacter.statusEffects || []).filter(s => s.name !== 'Invisible')
                },
                companions: activeCompanions.map(c => ({
                    id: c.id,
                    statusEffects: (c.statusEffects || []).filter(s => s.name !== 'Invisible')
                }))
            };
            await applyAiUpdates(removalUpdates);
            dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-stealth-off-${Date.now()}`, sender: 'system', content: "Stealth mode disabled. The party is now visible.", type: 'neutral' } });
            setOpenMenuId(null);
            return;
        }

        setOpenMenuId(null);
        const hideableParty = [playerCharacter, ...activeCompanions.filter(c => !c.isShip)];
        const aiNarrates = gameData.combatConfiguration?.aiNarratesTurns ?? true;
        const partyShip = activeCompanions.find(c => c.isShip === true);
        
        // Find highest perception among nearby observers
        const nearbyNPCs = (gameData.npcs || []).filter(n => n.currentPOI === gameData.currentLocale && n.status !== 'Dead' && !n.isShip);
        const highestInsight = nearbyNPCs.length > 0 
            ? Math.max(...nearbyNPCs.map(n => npcToCombatActor(n, playerCharacter.level).skills?.Insight?.passiveScore || 10))
            : 10;
        const highestPerception = nearbyNPCs.length > 0 
            ? Math.max(...nearbyNPCs.map(n => npcToCombatActor(n, playerCharacter.level).skills?.Perception?.passiveScore || 10))
            : 10;

        const allRolls: DiceRoll[] = [];
        let phase1Success = true;
        let phase2Success = false;
        let avgStealthScore = 10;

        // Step 1: Deception (The Ruse)
        if (nearbyNPCs.length > 0) {
            const deceptionRequests: DiceRollRequest[] = hideableParty.map(p => ({
                rollerName: p.name,
                rollType: 'Skill Check',
                checkName: 'Deception',
                dc: highestInsight
            }));
            const deceptionRes = processDiceRolls(deceptionRequests);
            allRolls.push(...deceptionRes.rolls);
            const deceptionSuccesses = deceptionRes.rolls.filter(r => r.outcome === 'Success' || r.outcome === 'Critical Success').length;
            phase1Success = deceptionSuccesses >= Math.ceil(hideableParty.length / 2);
        }

        // Step 2: Stealth (The Movement)
        if (phase1Success) {
            const stealthRequests: DiceRollRequest[] = hideableParty.map(p => ({
                rollerName: p.name,
                rollType: 'Skill Check',
                checkName: 'Stealth',
                dc: highestPerception
            }));
            const stealthRes = processDiceRolls(stealthRequests);
            allRolls.push(...stealthRes.rolls);
            const stealthSuccesses = stealthRes.rolls.filter(r => r.outcome === 'Success' || r.outcome === 'Critical Success').length;
            phase2Success = stealthSuccesses >= Math.ceil(hideableParty.length / 2);
            avgStealthScore = Math.round(stealthRes.rolls.reduce((sum, r) => sum + r.total, 0) / stealthRes.rolls.length);
        }

        const finalSuccess = phase1Success && phase2Success;

        const getMechanicalUpdates = (existingUpdates: any = {}) => {
            const updates: any = { ...existingUpdates };
            if (finalSuccess) {
                const hiddenStatus: StatusEffect = { name: 'Invisible', duration: 10 };
                const pcCurrent = playerCharacter.statusEffects || [];
                if (!pcCurrent.some(s => s.name === 'Invisible')) {
                    updates.playerCharacter = { ...updates.playerCharacter, statusEffects: [...pcCurrent, hiddenStatus] };
                }
                
                updates.companions = activeCompanions.filter(c => !c.isShip).map(comp => {
                    const current = comp.statusEffects || [];
                    const hasStatus = current.some(s => s.name === 'Invisible');
                    return { id: comp.id, statusEffects: hasStatus ? current : [...current, hiddenStatus] };
                });
            }
            return updates;
        };

        dispatch({ type: 'SET_PARTY_HIDDEN', payload: { isHidden: finalSuccess, score: avgStealthScore } });

        if (!aiNarrates) {
            const finalUpdates = getMechanicalUpdates();
            const manualMessage: ChatMessage = {
                id: `sys-stealth-manual-${Date.now()}`,
                sender: 'system',
                type: finalSuccess ? 'positive' : 'negative',
                content: `**Group Hide Attempt**: ${finalSuccess ? 'SUCCESS' : 'SPOTTED'}. Avg Stealth: **${avgStealthScore}**.`,
                rolls: allRolls
            };
            await applyAiUpdates(finalUpdates, manualMessage);
            return;
        }

        setIsAiGenerating(true);
        try {
            const prompt = `[CONTEXT]: Stealth check in presence of observers.
            1. DECEPTION (DC ${highestInsight}): ${phase1Success ? 'SUCCESS' : 'FAILURE'}.
            2. STEALTH (DC ${highestPerception}): ${phase1Success ? (phase2Success ? 'SUCCESS' : 'FAILURE') : 'Not Attempted'}
            OUTCOME: ${finalSuccess ? 'SUCCESS' : 'FAILURE'}.
            Narrate the transition based on these results. Plain text, max 60 words.`;

            const aiResponse = await generateResponse({ id: 'stealth-prompt', sender: 'system', content: prompt } as ChatMessage, gameData);
            const finalUpdates = getMechanicalUpdates(aiResponse.updates || {});
            const aiMessage: ChatMessage = {
                id: `ai-stealth-${Date.now()}`,
                sender: 'ai',
                content: aiResponse.narration || (finalSuccess ? "The party vanishes into the shadows." : "A misstep betrays your position."),
                rolls: allRolls
            };
            await applyAiUpdates(finalUpdates, aiMessage);
        } catch (e) {
            console.error("Stealth narration failed", e);
        } finally {
            setIsAiGenerating(false);
        }
    };

    const ContextMenu = ({ charId }: { charId: string }) => {
        const char = [playerCharacter, ...activeCompanions].find(c => c.id === charId);
        const isHidden = char ? !canBeTargeted(char) : false;
        
        return (
            <div className="absolute right-full mr-3 top-0 flex flex-col gap-1 bg-brand-surface/90 backdrop-blur-xl border border-brand-primary rounded-2xl p-1.5 shadow-2xl animate-fade-in z-[100] min-w-[180px]">
                <button onClick={() => navigateToView('character', charId)} className="w-full text-left px-4 py-2.5 hover:bg-brand-primary/50 rounded-xl transition-all text-body-sm font-normal text-brand-text flex items-center gap-3">
                    <Icon name="character" className="w-4 h-4 text-brand-accent" />
                    <span>View Profile</span>
                </button>
                <button onClick={() => navigateToView('inventory', charId)} className="w-full text-left px-4 py-2.5 hover:bg-brand-primary/50 rounded-xl transition-all text-body-sm font-normal text-brand-text flex items-center gap-3">
                    <Icon name="inventory" className="w-4 h-4 text-brand-accent" />
                    <span>Inventory</span>
                </button>
                <button onClick={() => openQuickActions(charId)} className="w-full text-left px-4 py-2.5 hover:bg-brand-primary/50 rounded-xl transition-all text-body-sm font-normal text-brand-text flex items-center gap-3">
                    <Icon name="sparkles" className="w-4 h-4 text-brand-accent" />
                    <span>Quick Actions</span>
                </button>
                <button onClick={handleStealthToggle} className="w-full text-left px-4 py-2.5 hover:bg-brand-primary/50 rounded-xl transition-all text-body-sm font-normal text-brand-text flex items-center gap-3">
                    <Icon name={isPartyHidden ? "close" : "eye"} className="w-4 h-4 text-brand-accent" />
                    <span>{isPartyHidden ? 'Disable Stealth' : 'Hide & Sneak'}</span>
                </button>
            </div>
        );
    };

    return (
        <div 
            ref={menuRef}
            className={`flex flex-col items-center gap-1.5 p-2 transition-all duration-500 ${isPartyHidden ? 'pt-4' : 'pt-2'}`}
            style={{ pointerEvents: 'auto' }}
        >
            {/* Party Stack */}
            <div className="flex flex-col items-center gap-1.5">
                {isPartyHidden && (
                    <div className="text-body-sm font-bold text-brand-accent mb-1 animate-fade-in text-center drop-shadow-[0_0_8px_rgba(62,207,142,0.4)]">
                        Dc {partyStealthScore}
                    </div>
                )}
                
                <div className="relative">
                    <StatusAvatar 
                        char={playerCharacter} 
                        size={40} 
                        isPlayer={true} 
                        tempHp={playerCharacter.temporaryHitPoints}
                        maxTempHp={playerCharacter.getMaxTemporaryHitPoints(gameData.playerInventory)}
                        onClick={() => handleCharacterClick(playerCharacter.id)}
                        isTargeted={openMenuId === playerCharacter.id}
                        isStealthed={isPartyHidden || !canBeTargeted(playerCharacter)}
                    />
                    {openMenuId === playerCharacter.id && <ContextMenu charId={playerCharacter.id} />}
                </div>

                {activeCompanions.map(companion => (
                    <div key={companion.id} className="relative">
                        <StatusAvatar 
                            char={companion} 
                            size={30} 
                            tempHp={companion.temporaryHitPoints}
                            maxTempHp={companion.getMaxTemporaryHitPoints(gameData.companionInventories[companion.id] || { equipped: [], carried: [], storage: [], assets: [] })}
                            onClick={() => handleCharacterClick(companion.id)}
                            isTargeted={openMenuId === companion.id}
                            isStealthed={isPartyHidden || !canBeTargeted(companion)}
                        />
                        {openMenuId === companion.id && <ContextMenu charId={companion.id} />}
                    </div>
                ))}
            </div>

            {/* Local NPCs Stack */}
            <NearbyActors gameData={gameData} refineNPC={refineNPC} />
        </div>
    );
};
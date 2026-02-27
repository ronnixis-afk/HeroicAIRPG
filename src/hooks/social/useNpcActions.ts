// hooks/social/useNpcActions.ts

import React, { useCallback } from 'react';
import { GameAction, GameData, NPC, Ability, SKILL_NAMES, Companion, DiceRollRequest, ChatMessage, PlayerCharacter, Item } from '../../types';
import { refineNPCDetails, generateResponse, weaveHero, generateStolenItem } from '../../services/geminiService';
import { TRAIT_LIBRARY } from '../../utils/traitLibrary';
import { TEMPLATE_LIBRARY } from '../../utils/templateRegistry';
import { getXPForLevel } from '../../utils/mechanics';
import { useUI } from '../../context/UIContext';
import { npcToCombatActor } from '../../utils/npcUtils';

export const useNpcActions = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    ui: ReturnType<typeof useUI>,
    combatActions: any,
    integrateCharacter: (character: PlayerCharacter | Companion, isCompanion?: boolean) => Promise<void>
) => {
    const { setIsLoading, setCreationProgress } = ui;

    const addNPC = useCallback((npc: NPC) => { 
        dispatch({ type: 'ADD_NPC', payload: npc }); 
    }, [dispatch]);

    const updateNPC = useCallback((npc: NPC) => { 
        dispatch({ type: 'UPDATE_NPC', payload: npc }); 
    }, [dispatch]);

    const deleteNPC = useCallback((id: string) => { 
        dispatch({ type: 'DELETE_NPC', payload: id }); 
    }, [dispatch]);

    const refineNPC = useCallback(async (npc: NPC) => {
        if (!gameData) return;
        
        // Extract established ancestries for context reinforcement
        const availableRaces = (gameData.world || [])
            .filter(l => l.tags?.includes('race'))
            .map(l => l.title);

        try {
            const updates = await refineNPCDetails(npc, gameData, availableRaces);
            dispatch({ type: 'UPDATE_NPC', payload: { ...npc, ...updates } });
        } catch (e) {
            console.error("Refine Npc failed", e);
        }
    }, [gameData, dispatch]);

    const performPickpocket = useCallback(async (npc: NPC, intendedItem: string) => {
        if (!gameData) return;
        
        setIsLoading(true);
        
        const isHidden = gameData.isPartyHidden;

        // 1. Calculate DC based on target's passive perception
        const playerLevel = gameData.playerCharacter.level;
        const targetActor = npcToCombatActor(npc, playerLevel, gameData.combatBaseScore, gameData.templates);
        const targetPassivePerception = targetActor.skills?.Perception?.passiveScore || 10;
        const dc = targetPassivePerception + 5;
        
        // 2. Request a Sleight of Hand check with advantage if hidden
        const request: DiceRollRequest = {
            rollerName: gameData.playerCharacter.name,
            rollType: 'Skill Check',
            checkName: 'Sleight of Hand',
            dc: dc,
            targetName: npc.name,
            mode: isHidden ? 'advantage' : 'normal'
        };
        
        const { rolls } = combatActions.processDiceRolls([request]);
        const roll = rolls[0];
        const isSuccess = roll.outcome === 'Success' || roll.outcome === 'Critical Success';
        
        // Calculate Failure Margin
        const failureMargin = dc - roll.total;

        // 3. Resolve Outcome
        if (isSuccess) {
            // Logic Gate C: Success
            const newRel = Math.max(-50, npc.relationship - 10);
            dispatch({ type: 'UPDATE_NPC', payload: { ...npc, relationship: newRel } });

            try {
                const stolenItemData = await generateStolenItem(intendedItem, npc, gameData);
                const stolenItem = new Item({
                    ...stolenItemData,
                    isNew: true
                });

                dispatch({ type: 'TAKE_LOOT', payload: [stolenItem] });

                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `pickpocket-success-${Date.now()}`,
                        sender: 'system',
                        content: `Success! ${isHidden ? 'Striking from the shadows, you' : 'You'} successfully lift the **${stolenItem.name}** from ${npc.name}'s pocket.`,
                        rolls: rolls,
                        type: 'positive'
                    }
                });
            } catch (err) {
                console.error("Pickpocket item generation failed", err);
                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `pickpocket-success-fallback-${Date.now()}`,
                        sender: 'system',
                        content: `Success! ${isHidden ? 'Leveraging your cover, you' : 'You'} successfully lift the ${intendedItem} from ${npc.name}'s pocket.`,
                        rolls: rolls,
                        type: 'positive'
                    }
                });
            }
        } else if (failureMargin >= 10) {
            // Logic Gate A: Caught Red-Handed (Failure by 10 or more)
            dispatch({ type: 'UPDATE_NPC', payload: { ...npc, relationship: -50 } });

            // Phase 3 Update: Refined "Caught" narrative emphasizing clumsiness
            const caughtNarrative = `Caught red-handed! Your fingers fumble with the clasp, snagging on the fabric. ${npc.name} catches your wrist in a crushing grip, eyes flashing with immediate hostility.`;
            
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `pickpocket-fail-${Date.now()}`,
                    sender: 'system',
                    content: `Caught! Your clumsy attempt snagged on ${npc.name}'s clothing. They have spotted you and turned hostile.`,
                    rolls: rolls,
                    type: 'negative'
                }
            });
            
            await combatActions.executeInitiationPipeline(caughtNarrative, []);
        } else {
            // Logic Gate B: Close Call (Failure by less than 10)
            // Phase 3 Update: Refined "Close Call" narrative
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `pickpocket-close-call-${Date.now()}`,
                    sender: 'system',
                    content: `A tense moment passes. You couldn't find a clean opening to reach the item, but ${npc.name} remains completely unaware of your attempt. You withdraw your hand just in time.`,
                    rolls: rolls,
                    type: 'neutral'
                }
            });
        }
        
        setIsLoading(false);
    }, [gameData, combatActions, dispatch, setIsLoading]);

    const inviteNpcToParty = useCallback(async (npc: NPC) => {
        if (!gameData) return;
        
        // Corpses can't join parties
        if (npc.status === 'Dead') {
            dispatch({ type: 'ADD_MESSAGE', payload: { id: `sys-invite-dead-${Date.now()}`, sender: 'system', content: `${npc.name} is deceased and cannot join your party.`, type: 'negative' } });
            return;
        }

        setIsLoading(true);
        const rel = npc.relationship;
        
        // Relationship-based Dc
        const dc = rel >= 50 ? 5 : rel >= 30 ? 10 : rel >= 10 ? 12 : rel >= -10 ? 15 : rel >= -30 ? 20 : 25;
        
        const request: DiceRollRequest = {
            rollerName: gameData.playerCharacter.name,
            rollType: 'Skill Check',
            checkName: 'Persuasion',
            dc: dc,
            targetName: npc.name
        };
        
        const { rolls, groupOutcomes } = combatActions.processDiceRolls([request]);
        const groupResult = groupOutcomes.find((g: any) => g.checkName === 'Persuasion');
        const isSuccess = groupResult ? groupResult.isGroupSuccess : (rolls[0].outcome === 'Success' || rolls[0].outcome === 'Critical Success');

        const systemPrompt: ChatMessage = {
            id: `sys-invite-${Date.now()}`,
            sender: 'system',
            mode: 'OOC',
            content: `[SYSTEM] The player attempts to invite ${npc.name} to join their party.
            CURRENT STANDING: ${rel} points.
            PERSUASION DC: ${dc}
            DICE RESULT: ${isSuccess ? 'SUCCESS' : 'FAILURE'}
            
            [INSTRUCTIONS]
            1. Narrate the dialogue response of ${npc.name} in PLAIN TEXT.
            2. If success: They agree to join the quest.
            3. If failure: They politely or rudely decline based on standing.
            
            Return JSON: { "narration": "string" }`
        };

        try {
            // Speed Update: Explicitly override to gemini-3-flash-preview for recruitment dialogue.
            const aiRes = await generateResponse(
                systemPrompt, 
                { ...gameData, messages: [...gameData.messages, systemPrompt] },
                undefined,
                undefined,
                'gemini-3-flash-preview'
            );
            
            const aiMessage: ChatMessage = {
                id: `ai-invite-res-${Date.now()}`,
                sender: 'ai',
                content: aiRes.narration || (isSuccess ? `${npc.name} agrees to join you!` : `${npc.name} declines the offer.`),
                location: gameData.currentLocale || 'Current Area',
                rolls: rolls
            };
            dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });

            if (isSuccess) {
                setCreationProgress({ isActive: true, step: `Welcoming ${npc.name}...`, progress: 10 });
                
                // Blueprint Selection: Select a mechanical template based on the NPC's profile
                const templateKey = npc.template || 'Brute';
                const config = gameData.skillConfiguration || 'Fantasy';
                const availableTemplates = TEMPLATE_LIBRARY[config] || [];
                const template = availableTemplates.find(t => t.name.toLowerCase() === templateKey.toLowerCase()) || 
                                   availableTemplates.find(t => t.role.toLowerCase() === templateKey.toLowerCase()) ||
                                   availableTemplates[0];

                const bgTraits = TRAIT_LIBRARY.filter(t => template.backgroundTraitNames.includes(t.name));
                const genTraits = TRAIT_LIBRARY.filter(t => template.generalTraitNames.includes(t.name));
                const combatTrait = TRAIT_LIBRARY.find(t => t.name === template.combatTraitName) || TRAIT_LIBRARY.find(t => t.category === 'combat')!;

                const woven = await weaveHero(gameData, {
                    name: npc.name,
                    gender: npc.gender || 'Unspecified',
                    race: npc.race || 'Human',
                    backgroundTraits: template.backgroundTraitNames,
                    generalTraits: template.generalTraitNames,
                    combatAbility: { ...combatTrait, id: 'blueprint' } as Ability
                }, true);

                const allAbilities: Ability[] = [
                    ...bgTraits.map((t, i) => ({ ...t, id: `bg-${i}-${Date.now()}` })),
                    ...genTraits.map((t, i) => ({ ...t, id: `gen-${i}-${Date.now()}` })),
                    { ...combatTrait, ...woven.skinnedAbility, id: `combat-${Date.now()}` }
                ];

                // Automatic Skill Proficiency from Traits
                const traitSkills = new Set(allAbilities.flatMap(a => a.buffs || []).filter(b => b.type === 'skill').map(b => b.skillName));
                const fullSkills = SKILL_NAMES.reduce((acc, skill) => { 
                    acc[skill] = { proficient: traitSkills.has(skill) || !!(woven.skills?.[skill]?.proficient) }; 
                    return acc; 
                }, {} as any);

                const companionData = {
                    id: npc.id.startsWith('npc-') ? npc.id.replace('npc-', '') : `comp-${Date.now()}`,
                    name: npc.name,
                    gender: npc.gender,
                    race: npc.race,
                    profession: woven.profession,
                    appearance: woven.appearance,
                    background: woven.background,
                    personality: npc.description || '',
                    keywords: woven.keywords,
                    abilityScores: woven.abilityScores,
                    savingThrows: woven.savingThrows,
                    skills: fullSkills,
                    abilities: allAbilities,
                    level: gameData.playerCharacter.level,
                    experiencePoints: getXPForLevel(gameData.playerCharacter.level),
                    relationship: npc.relationship,
                    isShip: !!npc.isShip,
                    isMount: !!npc.isMount,
                    isSentient: npc.isSentient,
                    isInParty: true
                };

                await integrateCharacter(new Companion(companionData), true);
                
                // Update registry to record that this NPC is now a party member
                dispatch({ type: 'UPDATE_NPC', payload: { ...npc, companionId: (companionData as any).id } });
            }
        } catch (e) {
            console.error("Invitation error", e);
        } finally {
            setIsLoading(false);
            setCreationProgress({ isActive: false, step: '', progress: 0 });
        }
    }, [gameData, dispatch, combatActions, integrateCharacter, setIsLoading, setCreationProgress]);

    return {
        addNPC,
        updateNPC,
        deleteNPC,
        refineNPC,
        inviteNpcToParty,
        performPickpocket
    };
};

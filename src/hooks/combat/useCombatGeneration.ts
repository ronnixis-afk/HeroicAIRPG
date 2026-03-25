// hooks/combat/useCombatGeneration.ts

import React, { useCallback } from 'react';
import { GameData, GameAction, CombatActorSize, ActorSuggestion, ChatMessage, CombatActor, ActorAlignment } from '../../types';
import { useUI, CombatTriggerSource } from '../../context/UIContext';
import { generateEnemyFromTemplate, DEFAULT_TEMPLATES, DEFAULT_SIZE_MODIFIERS, DEFAULT_ARCHETYPE_DEFINITIONS, getDifficultyParams, DEFAULT_AFFINITIES, recalculateCombatActorStats } from '../../utils/mechanics';
import { generateCombatStartNarrative, generateCombatEncounterSuggestions, resolveCombatAlignments, reassessCombatEnemies } from '../../services/geminiService';
import { enrichCombatantDetails } from '../../services/aiCombatService';
import { combatActorToNPC } from '../../utils/npcUtils';

type UIActions = ReturnType<typeof useUI>;

export const useCombatGeneration = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>,
    ui: UIActions
) => {
    const { setCombatInitiationStatus, setPendingCombat, setIsAiGenerating } = ui;

    const addEnemyFromTemplate = useCallback((templateName: string, cr: number, rank: 'normal' | 'elite' | 'boss', size: CombatActorSize, nameOverride?: string) => {
        const templates = gameData?.templates || DEFAULT_TEMPLATES;
        const sizeModifiers = gameData?.sizeModifiers || DEFAULT_SIZE_MODIFIERS;
        const baseScore = gameData?.combatBaseScore ?? 8;
        const archetypes = gameData?.archetypes || DEFAULT_ARCHETYPE_DEFINITIONS;
        const currentLocale = gameData?.currentLocale;

        const actor = generateEnemyFromTemplate(
            templateName, cr, rank, size, nameOverride, templates, sizeModifiers, baseScore, undefined, archetypes
        );

        // Use 'enemy' as the default for manual spawns
        actor.alignment = 'enemy';
        actor.isAlly = false;

        dispatch({ type: 'ADD_COMBAT_ENEMY', payload: actor });
        dispatch({ type: 'ADD_NPC', payload: combatActorToNPC(actor, currentLocale) });
    }, [gameData, dispatch]);

    const stageActors = useCallback((suggestions: ActorSuggestion[], suppressDispatch: boolean = false) => {
        const templates = gameData?.templates || DEFAULT_TEMPLATES;
        const sizeModifiers = gameData?.sizeModifiers || DEFAULT_SIZE_MODIFIERS;
        const baseScore = gameData?.combatBaseScore ?? 8;
        const affinities = gameData?.affinities || DEFAULT_AFFINITIES;
        const archetypes = gameData?.archetypes || DEFAULT_ARCHETYPE_DEFINITIONS;
        const playerLevel = gameData?.playerCharacter.level || 1;
        const currentLocale = gameData?.currentLocale;

        const currentEnemies = gameData?.combatState?.enemies || [];
        const currentEnemyIds = new Set(currentEnemies.map(e => e.id));

        const nameCount: Record<string, number> = {};
        const stagedResults: { actor: CombatActor, npc: any }[] = [];

        suggestions.forEach(suggestion => {
            let resolvedId = suggestion.id || (suggestion.name?.toLowerCase().includes('npc-') ? suggestion.name : null);
            let finalName = suggestion.name || '';

            // 1. DEDUPLICATION: Attempt to find by Name if ID is missing
            if (!resolvedId && finalName) {
                const standardizedTarget = finalName.toLowerCase().trim();
                const registryMatch = gameData?.npcs.find(n => n.name.toLowerCase().trim() === standardizedTarget);
                if (registryMatch) {
                    resolvedId = registryMatch.id;
                }
            }

            // 2. PREVENT RE-STAGING OF ALREADY STAGED OR DEAD ACTORS
            if (resolvedId) {
                // Skip if already in the active combat tracker
                if (currentEnemyIds.has(resolvedId)) return;
                
                // Skip if already staged in THIS loop (prevents AI doubling down on same name)
                if (stagedResults.some(r => r.actor.id === resolvedId)) return;

                const registryEntry = gameData?.npcs.find(n => n.id === resolvedId);
                // Skip if dead
                if (registryEntry?.status === 'Dead') return;
            }

            let safeSize: CombatActorSize = 'Medium';
            if (suggestion.size) {
                const sStr = String(suggestion.size).trim();
                const formatted = sStr.charAt(0).toUpperCase() + sStr.slice(1).toLowerCase();
                if (formatted in sizeModifiers) {
                    safeSize = formatted as CombatActorSize;
                }
            }

            let safeTemplateKey = suggestion.template || '';
            if (!safeTemplateKey || safeTemplateKey === 'Custom' || !templates[safeTemplateKey]) {
                const templatePool = Object.keys(templates).filter(k => k !== 'Custom');
                safeTemplateKey = templatePool[Math.floor(Math.random() * templatePool.length)];
            }

            const params = getDifficultyParams(suggestion.difficulty || 'Normal', playerLevel);

            const lowerName = finalName.toLowerCase();
            if (lowerName.includes('replace') || lowerName.includes('unknown') || lowerName.includes('[') || lowerName.trim() === '') {
                finalName = '';
            }

            if (finalName.toLowerCase().includes('npc-')) {
                const registryNpc = gameData?.npcs.find(n => n.id === finalName);
                if (registryNpc) {
                    // FINAL GUARD: Skip if dead even if requested by name
                    if (registryNpc.status === 'Dead') return;
                    finalName = registryNpc.name;
                }
            }

            if (finalName) {
                if (nameCount[finalName]) {
                    nameCount[finalName]++;
                    finalName = `${finalName} ${nameCount[finalName]}`;
                } else {
                    nameCount[finalName] = 1;
                }
            }

            const actor = generateEnemyFromTemplate(
                safeTemplateKey, params.cr, params.rank, safeSize, finalName || undefined, templates, sizeModifiers, baseScore, suggestion.archetype, archetypes
            );

            actor.id = resolvedId || `enemy-${safeTemplateKey.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

            if (suggestion.alignment) {
                actor.alignment = suggestion.alignment;
                actor.isAlly = suggestion.alignment === 'ally';
            } else {
                actor.isAlly = !!suggestion.isAlly;
                actor.alignment = suggestion.isAlly ? 'ally' : 'enemy';
            }

            if (suggestion.isShip) {
                actor.isShip = true;
                actor.maxHitPoints = (actor.maxHitPoints || 10) * 2;
                actor.currentHitPoints = actor.maxHitPoints;
                actor.numberOfAttacks = (actor.numberOfAttacks || 1) * 2;
            }

            let affinityToUse = suggestion.affinity;
            if (affinityToUse && affinities[affinityToUse]) {
                const aff = affinities[affinityToUse];
                actor.affinity = affinityToUse;
                actor.resistances = [...aff.resistances];
                actor.immunities = [...aff.immunities];
                actor.vulnerabilities = [...aff.vulnerabilities];
            }

            if (suggestion.description) actor.description = suggestion.description;

            // Only create a new NPC entry if this wasn't matched to an existing one
            const npc = actor.alignment === 'enemy' && !actor.id.startsWith('npc-') ? combatActorToNPC(actor, currentLocale) : null;

            if (!suppressDispatch) {
                dispatch({ type: 'ADD_COMBAT_ENEMY', payload: actor });
                if (npc) {
                    dispatch({ type: 'ADD_NPC', payload: npc });
                }
            }

            stagedResults.push({ actor, npc });
        });

        return stagedResults;
    }, [gameData, dispatch]);

    const initiateCombatSequence = useCallback(async (narrative: string, suggestions: ActorSuggestion[], source: CombatTriggerSource = 'Narrative') => {
        setPendingCombat({ narrative, suggestions, source });
    }, [setPendingCombat]);

    const executeInitiationPipeline = useCallback(async (narrative: string, suggestions: ActorSuggestion[]) => {
        if (!gameData) return;

        setIsAiGenerating(true);

        let finalNarrative = narrative;
        const isManualStart = narrative === "Combat Sequence Initiated!";
        const worldSummary = gameData.worldSummary || '';
        const context = [...gameData.messages.slice(-3)];
        const level = gameData.playerCharacter.level || 1;
        const hasShip = !!(gameData.playerInventory.assets.some(i => i.tags?.includes('ship')) || gameData.companions.some(c => c.isShip));

        setCombatInitiationStatus({
            isActive: true,
            step: 'Locking Target...',
            progress: 10,
            narrative: finalNarrative
        });

        // Step 1: Alignment & Social Stance Resolution
        setCombatInitiationStatus(prev => ({ ...prev, step: 'Resolving Social Stances...', progress: 30 }));
        let currentEnemies = [...(gameData.combatState?.enemies || [])];
        const alignmentCandidates = currentEnemies.filter(e => (e.alignment === 'neutral' || !e.alignment) && e.currentHitPoints && e.currentHitPoints > 0).map(e => {
            const registry = gameData.npcs.find(n => n.id === e.id);
            return { id: e.id, name: e.name, relationship: registry?.relationship || 0 };
        });

        if (alignmentCandidates.length > 0) {
            try {
                const alignmentMap = await resolveCombatAlignments(narrative, alignmentCandidates, gameData);
                Object.entries(alignmentMap).forEach(([id, alignment]) => {
                    const idx = currentEnemies.findIndex(e => e.id === id);
                    if (idx > -1) {
                        const actor = { ...currentEnemies[idx], alignment, isAlly: alignment === 'ally' };
                        currentEnemies[idx] = actor;
                        dispatch({ type: 'UPDATE_COMBAT_ENEMY', payload: actor });

                        // If resolved to neutral, remove from combat initiative
                        if (alignment === 'neutral') {
                            dispatch({ type: 'DELETE_COMBAT_ENEMY', payload: id });
                            currentEnemies = currentEnemies.filter(e => e.id !== id);
                        }
                    }
                });
            } catch (e) {
                console.warn("Social alignment auto-resolution failed", e);
            }
        }

        // Filter out existing hostiles who are actually enemies or allies already engaged
        const engagedHostiles = currentEnemies.filter(e => e.alignment === 'enemy');

        // Step 2: Enrichment & Reinforcements
        let finalSuggestions = [...suggestions];

        // Safety check for empty combat: If no suggestions and no existing hostiles, re-assess from history
        if (finalSuggestions.length === 0 && engagedHostiles.length === 0) {
            setCombatInitiationStatus(prev => ({ ...prev, step: 'Identifying Hostiles...', progress: 40 }));
            try {
                const reassessed = await reassessCombatEnemies(gameData, context);
                if (reassessed.length > 0) {
                    finalSuggestions = reassessed;
                }
            } catch (e) {
                console.warn("Combat re-assessment failed", e);
            }
        }

        const hasAnonymousSlots = finalSuggestions.some(s => !s.name);
        const needsBalancing = finalSuggestions.length > 0;

        if (hasAnonymousSlots || needsBalancing) {
            setCombatInitiationStatus(prev => ({ ...prev, step: 'Naming Reinforcements...', progress: 50 }));
            try {
                const excludeList = [
                    gameData.playerCharacter.name,
                    ...gameData.companions.map(c => c.name),
                    ...(gameData.npcs || []).map(n => n.name)
                ];
                // Pass engaged hostiles to the AI so it can balance against them
                const enriched = await generateCombatEncounterSuggestions(
                    narrative, level, hasShip, engagedHostiles, gameData, finalSuggestions as any, excludeList
                );
                finalSuggestions = enriched;
            } catch (e) {
                console.warn("Failed to enrich reinforcements", e);
            }
        }

        setCombatInitiationStatus(prev => ({ ...prev, step: 'Initializing Fray...', progress: 70 }));

        // Collect ALL hostiles that need skinning (existing ones + new reinforcements)
        const stagedReinforcements = finalSuggestions.length > 0 ? stageActors(finalSuggestions, true) : [];
        const newActors = stagedReinforcements.map(p => p.actor);
        const allHostilesForSkinning = [...engagedHostiles, ...newActors];

        if (allHostilesForSkinning.length > 0) {
            setCombatInitiationStatus(prev => ({ ...prev, step: 'Skinning Abilities...', progress: 80 }));
            try {
                const enrichedData = await enrichCombatantDetails(
                    allHostilesForSkinning,
                    context,
                    gameData.affinities || DEFAULT_AFFINITIES,
                    worldSummary
                );

                allHostilesForSkinning.forEach((actor, index) => {
                    const skinData = enrichedData[index.toString()];
                    if (skinData) {
                        // 1. Update basic fields
                        if (skinData.name && skinData.name !== "Unique Name") actor.name = skinData.name;
                        if (skinData.description && skinData.description !== "Short description") actor.description = skinData.description;
                        
                        if (skinData.affinity && skinData.affinity !== "AffinityName" && (gameData.affinities || DEFAULT_AFFINITIES)[skinData.affinity]) {
                            actor.affinity = skinData.affinity;
                            const aff = (gameData.affinities || DEFAULT_AFFINITIES)[skinData.affinity];
                            actor.resistances = [...aff.resistances];
                            actor.immunities = [...aff.immunities];
                            actor.vulnerabilities = [...aff.vulnerabilities];
                        }
                        
                        // 2. Skin Attacks (Immutably update the array)
                        if (skinData.attacks && skinData.attacks.length > 0) {
                            actor.attacks = (actor.attacks || []).map((atk, j) => {
                                const skinnedAtk = skinData.attacks[j];
                                if (skinnedAtk) {
                                    return { 
                                        ...atk, 
                                        name: skinnedAtk.name, 
                                        damageType: skinnedAtk.damageType || atk.damageType,
                                        description: skinnedAtk.description || (atk as any).description 
                                    };
                                }
                                return atk;
                            });
                        }
                        
                        // 3. Skin Special Abilities (Immutably update the array)
                        if (skinData.specialAbilities && skinData.specialAbilities.length > 0) {
                            actor.specialAbilities = (actor.specialAbilities || []).map((ab, j) => {
                                const skinnedAb = skinData.specialAbilities[j];
                                if (skinnedAb) {
                                    return {
                                        ...ab,
                                        name: skinnedAb.name,
                                        description: skinnedAb.description || ab.description,
                                        damageType: skinnedAb.damageType || ab.damageType,
                                        targetType: skinnedAb.targetType || ab.targetType
                                    };
                                }
                                return ab;
                            });
                        }

                        // SYNC BACK TO REGISTRY / STATE
                        // If it's an existing actor, we need to UPDATE it with a NEW reference
                        if (index < engagedHostiles.length) {
                            dispatch({ type: 'UPDATE_COMBAT_ENEMY', payload: { ...actor } });
                        }
                        
                        // Sync names/descriptions to NPC registry if it's a persistent NPC
                        const registryNpc = gameData.npcs.find(n => n.id === actor.id);
                        if (registryNpc) {
                            dispatch({ 
                                type: 'UPDATE_NPC', 
                                payload: { ...registryNpc, name: actor.name, description: actor.description || registryNpc.description } 
                            });
                        }
                    }
                });
            } catch (e) {
                console.warn("Skinning failed", e);
            }
        }

        // Final dispatch for staged reinforcements
        stagedReinforcements.forEach(({ actor, npc }) => {
            dispatch({ type: 'ADD_COMBAT_ENEMY', payload: actor });
            if (npc) {
                npc.name = actor.name;
                npc.description = actor.description || '';
                dispatch({ type: 'ADD_NPC', payload: npc });
            }
        });

        // Step 3: Final Narrative Bridge
        if (isManualStart) {
            try {
                const existingEnemies = gameData.combatState?.enemies || [];
                const allNames = [
                    ...existingEnemies.map(e => e.name),
                    ...finalSuggestions.map(s => s.name || 'Reinforcement')
                ];

                const transitionRes = await generateCombatStartNarrative(allNames, context, worldSummary);
                finalNarrative = transitionRes.narrative;
                setCombatInitiationStatus(prev => ({ ...prev, narrative: finalNarrative }));

                dispatch({
                    type: 'ADD_MESSAGE', payload: {
                        id: `ai-start-narr-${Date.now()}`, sender: 'ai', content: finalNarrative, location: gameData.currentLocale || 'Current Scene'
                    }
                });
            } catch (e) { console.warn("Manual start narrative failed", e); }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        setCombatInitiationStatus(prev => ({ ...prev, step: 'Rolling Initiative...', progress: 90 }));
        dispatch({ type: 'START_COMBAT' });
        await new Promise(resolve => setTimeout(resolve, 600));

        setCombatInitiationStatus(prev => ({ ...prev, step: 'Engage!', progress: 100 }));
        await new Promise(resolve => setTimeout(resolve, 300));
        setCombatInitiationStatus(prev => ({ ...prev, isActive: false }));
        setIsAiGenerating(false);

    }, [gameData, dispatch, stageActors, setCombatInitiationStatus, setIsAiGenerating]);

    const processUserInitiatedCombat = useCallback(async (userContent: string) => {
        if (!gameData) return;

        const userMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', mode: 'CHAR', content: userContent };
        dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

        setIsAiGenerating(true);

        try {
            const aiResponse = await window.getGeminiResponse?.(userMessage, gameData) || { narrative: "Conflict erupts!", suggestedActors: [] };

            const aiMessage: ChatMessage = { id: `ai-${Date.now()}`, sender: 'ai', content: aiResponse.narrative, location: aiResponse.location };
            dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });

            if (aiResponse.updates) dispatch({ type: 'AI_UPDATE', payload: aiResponse.updates });

            setPendingCombat({
                narrative: aiResponse.narrative,
                suggestions: aiResponse.suggestedActors || [],
                source: 'Narrative'
            });

        } catch (e) {
            console.error("Combat initiation failed", e);
        } finally {
            setIsAiGenerating(false);
        }
    }, [gameData, dispatch, setIsAiGenerating, setPendingCombat]);

    return { addEnemyFromTemplate, stageActors, initiateCombatSequence, executeInitiationPipeline, processUserInitiatedCombat };
};
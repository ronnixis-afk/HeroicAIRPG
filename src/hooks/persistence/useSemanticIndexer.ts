import { useEffect, useState } from 'react';
import { GameData, GameAction } from '../../types';
import { generateEmbedding } from '../../services/geminiService';

/**
 * BACKGROUND WORKER: The Semantic Indexer
 * Scans the user's save file upon loading or idle state.
 * If it finds Lore or NPC Memories without vector embeddings, it silently generating them
 * using the Gemini API and commits them to the state quietly without disrupting gameplay.
 */
export const useSemanticIndexer = (
    gameData: GameData | null,
    dispatch: React.Dispatch<GameAction>
) => {
    const [isIndexing, setIsIndexing] = useState(false);

    useEffect(() => {
        // Prevent indexing if the game hasn't loaded or an index is already running
        if (!gameData || isIndexing) return;

        const runBackgroundIndexing = async () => {
            setIsIndexing(true);
            try {
                let requiresStateUpdate = false;

                // 1. Scan Knowledge (World Lore)
                const knowledgeToUpdate = [...(gameData.knowledge || [])];
                for (let i = 0; i < knowledgeToUpdate.length; i++) {
                    const entry = knowledgeToUpdate[i];
                    if (!entry.embedding) {
                        const textToEmbed = `${entry.title || ''} ${entry.content || ''}`.trim();
                        if (textToEmbed) {
                            const vec = await generateEmbedding(textToEmbed);
                            if (vec) {
                                knowledgeToUpdate[i] = { ...entry, embedding: vec };
                                requiresStateUpdate = true;
                            }
                        }
                    }
                }

                if (requiresStateUpdate) {
                    dispatch({
                        type: 'AI_UPDATE',
                        payload: { knowledge: knowledgeToUpdate }
                    });
                }

                // We reset this flag for the next batch to avoid unnecessary re-renders
                requiresStateUpdate = false;

                // 2. Scan Objectives (Quests)
                const objectivesToUpdate = [...(gameData.objectives || [])];
                for (let i = 0; i < objectivesToUpdate.length; i++) {
                    const obj = objectivesToUpdate[i];
                    if (!obj.embedding) {
                        const textToEmbed = `${obj.title || ''} ${obj.content || ''}`.trim();
                        if (textToEmbed) {
                            const vec = await generateEmbedding(textToEmbed);
                            if (vec) {
                                objectivesToUpdate[i] = { ...obj, embedding: vec };
                                requiresStateUpdate = true;
                            }
                        }
                    }
                }

                if (requiresStateUpdate) {
                    dispatch({
                        type: 'AI_UPDATE',
                        payload: { objectives: objectivesToUpdate }
                    });
                }

                requiresStateUpdate = false;

                // 3. Scan NPC Memories
                // We use a specific structure because AI_UPDATE for npcMemories expects { npcId, memory, embedding }
                const memoryUpdates: { npcId: string, memory: string, embedding?: number[] }[] = [];

                if (gameData.npcs) {
                    for (const npc of gameData.npcs) {
                        if (npc.memories) {
                            for (const mem of npc.memories) {
                                if (!mem.embedding && mem.content) {
                                    const vec = await generateEmbedding(mem.content);
                                    if (vec) {
                                        memoryUpdates.push({
                                            npcId: npc.id,
                                            memory: mem.content,
                                            embedding: vec
                                        });
                                        requiresStateUpdate = true;
                                    }
                                }
                            }
                        }
                    }
                }

                if (requiresStateUpdate && memoryUpdates.length > 0) {
                    dispatch({
                        type: 'AI_UPDATE',
                        payload: { npcMemories: memoryUpdates }
                    });
                }

                requiresStateUpdate = false;

                // 4. Scan Story Logs (Long-Term Vector RAG)
                const storyToUpdate = [...(gameData.story || [])];
                for (let i = 0; i < storyToUpdate.length; i++) {
                    const entry = storyToUpdate[i];
                    if (!entry.embedding) {
                        const textToEmbed = `${entry.summary || ''} ${entry.content || ''}`.trim();
                        if (textToEmbed) {
                            const vec = await generateEmbedding(textToEmbed);
                            if (vec) {
                                storyToUpdate[i] = { ...entry, embedding: vec };
                                requiresStateUpdate = true;
                            }
                        }
                    }
                }

                if (requiresStateUpdate) {
                    dispatch({
                        type: 'AI_UPDATE',
                        payload: { story: storyToUpdate }
                    });
                }

            } catch (err) {
                console.error("Background indexing process naturally terminated or failed:", err);
            } finally {
                // We don't reset isIndexing to false right away because we only want to run this once per session
                // The indexer will run again on the next full page reload.
            }
        };

        // Delay the indexer by 10 seconds to ensure the UI is fully loaded and responsive first
        const timeoutId = setTimeout(() => {
            runBackgroundIndexing();
        }, 10000);

        return () => clearTimeout(timeoutId);

    }, [gameData, dispatch, isIndexing]);

    return { isIndexing };
};

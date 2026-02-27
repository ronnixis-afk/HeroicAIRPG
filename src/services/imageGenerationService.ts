
import { getAi } from './aiClient';
import { ChatMessage, PlayerCharacter, Companion, CombatActor, ImageGenerationStyle, GameData } from '../types';

// Helper to extract base64 and mimeType from data URI
const parseBase64 = (dataUri: string | undefined): { data: string, mimeType: string } | null => {
    if (!dataUri || !dataUri.startsWith('data:')) return null;
    
    const matches = dataUri.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    
    return {
        mimeType: matches[1],
        data: matches[2]
    };
};

/**
 * Scans recent messages for entity names present in gameData and returns their descriptions.
 */
const extractRelevantLore = (messages: ChatMessage[], gameData: GameData): string => {
    const recentContent = messages.slice(-3).map(m => m.content).join(' ').toLowerCase();
    const loreSnippets: string[] = [];
    const seenTitles = new Set<string>();

    // 1. Check NPCs (Registry)
    gameData.npcs?.forEach(npc => {
        if (recentContent.includes(npc.name.toLowerCase()) && !seenTitles.has(npc.name)) {
            loreSnippets.push(`[NPC: ${npc.name}]: ${npc.appearance || npc.description}`);
            seenTitles.add(npc.name);
        }
    });

    // 2. Check World Lore & Knowledge
    const worldLore = [...(gameData.world || []), ...(gameData.knowledge || [])];
    worldLore.forEach(entry => {
        if (recentContent.includes(entry.title.toLowerCase()) && !seenTitles.has(entry.title)) {
            loreSnippets.push(`[CONTEXT: ${entry.title}]: ${entry.content}`);
            seenTitles.add(entry.title);
        }
    });

    return loreSnippets.join('\n');
};

/**
 * Generates a character portrait based on description and equipment.
 */
export const generateCharacterImage = async (description: string, items: any[], style: string, isMature: boolean): Promise<string | null> => {
    const itemDesc = items.map(i => i.name).join(', ');
    const prompt = `Character portrait. 
    Description: ${description}
    Visible Equipment: ${itemDesc}
    Art Style: ${style}. 
    Aspect Ratio: 1:1.
    High quality, detailed, no text, no borders.
    ${isMature ? '' : 'Safe for work, no explicit content.'}`;
    
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K"
                }
            }
        });
        
        if (response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
        }
        return null;
    } catch (e) {
        console.error("Character image gen error", e);
        return null;
    }
};

/**
 * Generates a scene visualization using Player and Companion images as visual references.
 * Now includes deep lore context for any entities mentioned in the recent chat.
 */
export const generateSceneVisuals = async (
    gameData: GameData,
    style: ImageGenerationStyle, 
    enemies?: CombatActor[]
): Promise<string | null> => {
    const messages = gameData.messages;
    const player = gameData.playerCharacter;
    const companions = gameData.companions;
    
    const lastMessage = messages[messages.length - 1];
    const location = lastMessage?.location || 'Unknown';
    
    // Get last few narrative messages for context
    const narrativeContext = messages
        .filter(m => m.sender === 'ai' || m.sender === 'user')
        .slice(-2)
        .map(m => m.content)
        .join('\n');

    // Extract detailed lore for mentioned entities (Races, NPCs, Items, etc)
    const supplementaryLore = extractRelevantLore(messages, gameData);

    // 1. Construct the Text Prompt
    let prompt = `Generate a vertical portrait-format illustration of the current scene in a Tabletop RPG.
    
    **ART STYLE**: ${style}
    **SETTING**: ${location}
    **NARRATIVE CONTEXT**: 
    "${narrativeContext}"

    ${supplementaryLore ? `**SUPPLEMENTARY LORE & ENTITY DETAILS (STRICT ADHERENCE)**:\n${supplementaryLore}` : ''}

    **CHARACTERS & REFERENCES**:
    `;

    const parts: any[] = [];
    let imageIndex = 1;

    // Player Reference
    prompt += `\n1. MAIN HERO (${player.name}): See Reference Image ${imageIndex}. Use this character's visual design (face, hair, gear) but IGNORE the pose in the reference image. Put them in a dynamic pose fitting the narrative action.`;
    const playerImg = parseBase64(player.imageUrl);
    if (playerImg) {
        parts.push({ inlineData: { mimeType: playerImg.mimeType, data: playerImg.data } });
        imageIndex++;
    }

    // Companion References (Only include those in party)
    const activeCompanions = companions.filter(c => c.isInParty !== false);
    activeCompanions.forEach(c => {
        prompt += `\n2. ALLY (${c.name}): ${c.imageUrl ? `See Reference Image ${imageIndex}.` : 'No reference provided.'} ${c.appearance}. IGNORE any reference pose; render them interacting with the scene.`;
        const compImg = parseBase64(c.imageUrl);
        if (compImg) {
            parts.push({ inlineData: { mimeType: compImg.mimeType, data: compImg.data } });
            imageIndex++;
        }
    });

    // Enemies
    if (enemies && enemies.length > 0) {
        const uniqueEnemies = Array.from(new Set(enemies.map(e => e.name.replace(/\s\d+$/, ''))));
        prompt += `\n\n**ENEMIES/THREATS**:
        ${uniqueEnemies.join(', ')}.
        Depict these threats looming or engaging the characters.`;
    }

    prompt += `\n\n**IMPORTANT REQUIREMENTS**:
    - COMPOSITION: Vertical Portrait (9:16 ratio). Cinematic lighting.
    - POSING: Dynamic, action-oriented or dramatic standing. Do NOT copy the static poses from the reference images.
    - BACKGROUND: Detailed environment matching the Setting and Supplementary Lore.
    - FORMAT: Full bleed, NO borders, NO frames, NO text overlays.`;

    // Add prompt as the last part
    parts.push({ text: prompt });

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview', 
            contents: { parts: parts },
            config: {
                imageConfig: {
                    aspectRatio: "9:16",
                    imageSize: "1K"
                }
            }
        });

        if (response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
        }
        return null;
    } catch (e) {
        console.error("Scene visualization error", e);
        return null;
    }
};

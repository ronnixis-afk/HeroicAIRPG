
// services/aiContextService.ts

import { GameData, ChatMessage, LoreEntry, ActorSuggestion, SKILL_DEFINITIONS, SKILL_NAMES, PlayerCharacter, Companion, CombatActor, CalculatedCombatStats, Inventory, NPC, NPCMemory, StoryLog } from '../types';
import { getAi, cleanJson } from './aiClient';
import { ThinkingLevel } from '@google/genai';
import { isLocaleMatch } from '../utils/mapUtils';
import { canBeTargeted } from '../utils/resolution/StatusRules';
import { getTimePeriod } from '../utils/timeUtils';

// --- DATA MENU DEFINITIONS ---
export type ContextKey = 'core_stats' | 'inventory' | 'combat_state' | 'location_details' | 'active_quests' | 'recent_history' | 'world_lore' | 'social_registry';

const DATA_MENU: Record<ContextKey, string> = {
    'core_stats': "Player Character Sheet (HP, AC, Stats, Abilities, Skills). Needed for checks, saves, and physical actions.",
    'inventory': "Equipped and Carried Items. Needed for combat, trading, using items, or crafting.",
    'combat_state': "Current Enemies, Allies, Turn Order, and HP. CRITICAL if in combat or initiating combat.",
    'location_details': "Current Zone Description, Weather, Local POIs, Map Adjacency. Needed for movement or exploration.",
    'active_quests': "Current Objectives and tracked quests. Needed for plot progression.",
    'recent_history': "Last 10 chat messages and story logs. Needed for conversation continuity.",
    'world_lore': "Historical facts, faction details, or world knowledge (RAG). Needed for specific lore questions.",
    'social_registry': "List of known NPCs, their relationship to player, and their current status (Alive/Dead)."
};

// 1. THE LIBRARIAN (Selector Agent)
export const determineContextRequirements = async (
    userContent: string,
    isCombatActive: boolean,
    lastAiMessage: string
): Promise<{ keys: ContextKey[], usage?: any }> => {

    const defaults: ContextKey[] = ['core_stats', 'recent_history', 'active_quests', 'social_registry'];
    if (isCombatActive) defaults.push('combat_state', 'inventory');

    const menuItems = Object.entries(DATA_MENU).map(([key, desc]) => `- "${key}": ${desc}`).join('\n');

    const prompt = `
You are a Data Retrieval Agent. Analyze the User Action and select the MINIMUM data modules needed to generate a response.
    
[USER ACTION]: "${userContent}"
[PREVIOUS SYSTEM OUTPUT]: "${lastAiMessage.slice(0, 100)}..."
[COMBAT ACTIVE]: ${isCombatActive}

[DATA MENU]:
${menuItems}

[RULES]:
1. If user attacks/fights, include "combat_state", "core_stats", "inventory".
2. If user moves/looks around, include "location_details".
3. If user does something requiring specialized knowledge, include "world_lore".
4. Always include "core_stats" for skill checks.
5. Always include "active_quests" to ensure plot continuity.
6. Always include "social_registry" to ensure NPCs are reacted to correctly.

Return JSON: { "keys": ["key1", "key2"] }`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const result = JSON.parse(response.text || "{}");
        const finalKeys = Array.isArray(result.keys)
            ? Array.from(new Set([...defaults, ...result.keys])) as ContextKey[]
            : defaults;

        return { keys: finalKeys, usage: response.usageMetadata };
    } catch (e) {
        return { keys: Object.keys(DATA_MENU) as ContextKey[] };
    }
};

import { searchEmbeddings } from '../utils/mathUtils';

// --- RAG HELPERS ---

/**
 * Retrieves relevant memories for an NPC based on the current user action.
 * Uses a "Composite Memory" strategy: 5 most recent + up to 5 most resonant (via semantic vector search).
 */
export const getRelevantMemories = (searchText: string, memories: NPCMemory[] = [], queryEmbedding?: number[]): string => {
    if (!memories || memories.length === 0) return 'First meeting.';

    // 1. Get 5 most recent (Chronological)
    const recent = memories.slice(-5);
    const recentIds = new Set(recent.map(m => m.timestamp + m.content));

    // 2. Score remaining for resonance
    const pool = memories.filter(m => !recentIds.has(m.timestamp + m.content));
    let resonant: NPCMemory[] = [];

    if (queryEmbedding && queryEmbedding.length > 0) {
        // --- LOCAL VECTOR RAG ---
        // We have a mathematical vector of the user's current action.
        // We compare it against the vectors of all past memories to find the absolute most relevant ones.
        const semanticResults = searchEmbeddings<NPCMemory>(
            queryEmbedding,
            pool,
            (m) => m.embedding,
            5,    // Top K
            0.4   // Similarity threshold (adjustable based on testing, 0.4 is usually a decent baseline for text-embedding models)
        );
        resonant = semanticResults.map(r => r.item);
    } else {
        // --- LEGACY LEXICAL FALLBACK ---
        const terms = (searchText || '').toLowerCase().split(/[\W_]+/).filter(t => t.length > 3);
        if (terms.length > 0) {
            const scored = pool.map(m => {
                let score = 0;
                const content = m.content.toLowerCase();
                terms.forEach(term => {
                    if (content.includes(term)) score += 10;
                });
                return { memory: m, score };
            });

            resonant = scored
                .filter(s => s.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map(s => s.memory);
        }
    }

    // 3. Merge and Format
    const composite = [...resonant, ...recent].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return composite.map(m => `[${m.timestamp}]: ${m.content}`).join('; ');
};

export const getRelevantLore = (searchText: string, worldLore: LoreEntry[], queryEmbedding?: number[]): string => {
    if (!worldLore || worldLore.length === 0) return '';
    let topEntries: { entry: LoreEntry, score: number }[] = [];

    if (queryEmbedding && queryEmbedding.length > 0) {
        // --- LOCAL VECTOR RAG ---
        const semanticResults = searchEmbeddings<LoreEntry>(
            queryEmbedding,
            worldLore,
            (l) => l.embedding,
            3,      // Top K (We keep this low because Lore entries can be long, preserving token space)
            0.4     // Similarity threshold
        );
        topEntries = semanticResults.map(r => ({ entry: r.item, score: r.score }));
    } else {
        // --- LEGACY LEXICAL FALLBACK ---
        const terms = (searchText || '').toLowerCase().split(/[\W_]+/).filter(t => t.length > 3);
        if (terms.length > 0) {
            const scored = worldLore.map(entry => {
                let score = 0;
                const title = (entry.title || '').toLowerCase();
                const content = (entry.content || '').toLowerCase();
                const kw = (entry.keywords || []).map(k => k.toLowerCase());

                terms.forEach(term => {
                    if (title === term) score += 20;
                    else if (title.includes(term)) score += 10;
                    if (kw.includes(term)) score += 8;
                    if (content.includes(term)) score += 2;
                });
                return { entry, score };
            });
            topEntries = scored.filter(s => s.score > 5).sort((a, b) => b.score - a.score).slice(0, 3);
        }
    }

    if (topEntries.length === 0) return '';
    return topEntries.map(s => `[RESONANT LORE (${s.entry.title})]: ${s.entry.content}`).join('\n');
};

export const getAdjacencyContext = (gameData: GameData, coords: string): string => {
    if (!coords) return '';
    const parts = coords.split('-');
    if (parts.length !== 2) return '';
    const colChar = parts[0];
    const rowChar = parts[1];
    const colCode = colChar.charCodeAt(0);
    const rowCode = rowChar.charCodeAt(0);

    const adjCoords = [
        `${colChar}-${String.fromCharCode(rowCode - 1)}`,
        `${colChar}-${String.fromCharCode(rowCode + 1)}`,
        `${String.fromCharCode(colCode - 1)}-${rowChar}`,
        `${String.fromCharCode(colCode + 1)}-${rowChar}`
    ];

    return (gameData.mapZones || [])
        .filter(z => adjCoords.includes(z.coordinates) && z.visited)
        .map(z => `[ADJACENT: ${z.name} (${z.coordinates})]: ${z.description}`)
        .join('\n');
};

export const getAvailableSkillsContext = (gameData: GameData): string => {
    const config = gameData.skillConfiguration || 'Fantasy';
    const activeSkills = SKILL_NAMES.filter(s => {
        const def = SKILL_DEFINITIONS[s];
        return def.usedIn === 'All' || def.usedIn.includes(config as any);
    });

    const skillListWithKeywords = activeSkills.map(s => {
        const def = SKILL_DEFINITIONS[s];
        return `- ${s} (Keywords: ${def.keywords.join(', ')})`;
    }).join('\n');

    return `[AVAILABLE SKILLS (CONFIG: ${config})]:\n${skillListWithKeywords}`;
};

// 2. THE NARRATOR CONTEXT BUILDER
export const buildSystemInstruction = (
    gameData: GameData,
    lastMessage: ChatMessage,
    requiredKeys: ContextKey[],
    intervention?: string,
    systemGeneratedCombatants?: Partial<ActorSuggestion>[],
    isHeroic: boolean = false,
    queryEmbedding?: number[]
): string => {

    // --- FOUNDATIONAL PERSONA (THE GM CORE) ---
    const narratorPersona = `
### CORE NARRATOR IDENTITY
You are a legendary TTRPG Storyteller and Game Master. Your goal is to create vivid, immersive scenes and epic narratives.
1. PERSPECTIVE: Always address the player in the second person ('You').
2. DICE TRUTH: Player choices and system-provided dice rolls are the absolute drivers of the narrative.
3. GROUP SUCCESS POLICY: In scenes where multiple party members attempt the same task, if ANY single member succeeds, the entire party succeeds.
4. VISCERAL PROSE: Do NOT narrate specific amounts of damage. Describe physical impact, exhaustion, or material degradation.
5. CHARACTERFUL DIALOGUE: Incorporate rich banter from Companions and Enemies.
6. CONCISION: Avoid repeating info from recent history unless asked.
7. STANCE AREAWARENESS: Reflect weapon stances (Dual Wielding, Heavy, Dueling) in action verbs.
8. VISIBILITY DOCTRINE: If an actor is flagged as [Visibility: Concealed], they are hidden from mundane sight. Do not have others interact with them visually. Narrate them as ghosts, shadows, or absent.
`;

    const activeCompanions = (gameData.companions || []).filter(c => c.isInParty !== false);
    const partyShip = activeCompanions.find(c => c.isShip === true);

    const z = (gameData.mapZones ?? []).find(z => z.coordinates === gameData.playerCoordinates);
    const tracked = (gameData.objectives ?? []).find(o => o.isTracked && o.status === 'active');

    // --- TEMPORAL REASONING ---
    const period = getTimePeriod(gameData.currentTime);
    const zoneDesc = z?.description?.toLowerCase() || "";
    const isIsolatedEnv = zoneDesc.includes('space') || zoneDesc.includes('underground') || zoneDesc.includes('vault') || zoneDesc.includes('cave');

    const temporalContext = `
### TEMPORAL CONTEXT
[WORLD TIME]: ${gameData.currentTime} | [PERIOD]: ${period}
[SCHEDULES & ROUTINES]: 
- Shops/Businesses: Typically open Morning through Dusk. Closed during Night/Midnight unless specified as "24hr".
- Citizens: Most NPCs sleep during Night/Midnight. Streets are emptier, while guards and nocturnal entities become active.
- Atmosphere: Descriptions must reflect the ${period} (lighting, sounds, temperature).
${isIsolatedEnv ? `[ENVIRONMENTAL OVERRIDE]: You are in an ISOLATED environment (Space/Underground). External lighting from the sun does not change based on time, but NPC shifts, facility schedules, and technological lighting cycles still strictly follow the [WORLD TIME].` : ''}
`;

    // --- TIER 1: CORE REALITY (Always partially mandatory, but pruned) ---
    const tier1Mandatory = `
### TIER 1: CORE REALITY
[CURRENT POSITION]: Zone: ${z?.name || 'Unknown'} (${gameData.playerCoordinates}) | Locale: ${gameData.currentLocale || 'Open Area'}
${requiredKeys.includes('location_details') ? `[ZONE DESCRIPTION]: ${z?.description || 'Uncharted territory.'}` : ''}
[ADVENTURE BRIEF]: ${gameData.adventureBrief || 'Proceed with exploration.'}
${requiredKeys.includes('active_quests') ? `[PRIMARY TRACKED QUEST]: ${tracked ? `"${tracked.title}" - ${tracked.nextStep || tracked.content}` : "None."}` : ''}
${temporalContext}

${partyShip ? `[SPATIAL ENCLOSURE]: The party is currently ABOARD the vessel '${partyShip.name}'. Unless explicitly narrated otherwise, assume all dialogue and immediate actions happen within its corridors, cabins, or on its deck/bridge.` : ''}

${gameData.isPartyHidden ? `[PARTY STATUS]: HIDDEN (Stealth Score: ${gameData.partyStealthScore}). NPCs are unaware of your presence and cannot initiate dialogue or attack unless they succeed a Perception check vs your Stealth Score.
${partyShip ? `[STEALTH DOCTRINE]: Since the party is aboard '${partyShip.name}', narrate this stealth as a vessel operation (e.g., thermal masking, sensor baffles, silent running, or cloaking field) rather than individual biological hiding.` : ''}` : ''}

**SPATIAL AWARENESS RULE**: If you narrate the player entering a specific building, shop, or room, you MUST update 'location_update.site_name' in your JSON.

### TACTICAL ENCOUNTER BRIEF (GM NOTES)
${gameData.gmNotes ? `[MANDATORY PLOT ANCHOR]: ${gameData.gmNotes}
(INSTRUCTION: You MUST respect and weave these three tactical sentences into your narration if an encounter is active or starting.)` : "No active encounter brief."}
`;

    const heroicDirective = isHeroic ? `
### HEROIC MOMENT DIRECTIVE
The user has expended a HEROIC POINT. 
1. NARRATION: This action MUST be described with cinematic, awe-inspiring, and legendary impact.
2. SUCCESS: The dice favor them; they are performing at their absolute peak potential.
3. FLAVOR: Use superlatives and high-stakes sensory details.
` : "";

    let tier2Resonance = "";
    if (requiredKeys.includes('world_lore') || requiredKeys.includes('location_details')) {
        const resonantLore = getRelevantLore(lastMessage.content, [...(gameData.world || []), ...(gameData.knowledge || [])], queryEmbedding);
        const localPOIs = (gameData.knowledge ?? [])
            .filter(k => k.coordinates === gameData.playerCoordinates && k.tags?.includes('location'))
            .map(k => `- ${k.title}: ${k.content}`)
            .join('\n');

        tier2Resonance = `
### TIER 2: WORLD RESONANCE
${resonantLore || "No relevant historical lore detected."}
[LOCAL POINTS OF INTEREST]:
${localPOIs || "No specific local landmarks."}
`;
    }

    let tier3Recency = "";
    if (requiredKeys.includes('recent_history')) {
        const recentStoryLogs = (gameData.story ?? []).slice(-3);
        const recentMemory = recentStoryLogs
            .map(log => `- ${log.summary || log.content}`)
            .join('\n');

        let historicalEchoes = "";

        if (queryEmbedding && (gameData.story?.length || 0) > 3) {
            const recentIds = new Set(recentStoryLogs.map(l => l.id));
            const olderLogs = gameData.story!.filter(l => !recentIds.has(l.id));

            const semanticLogs = searchEmbeddings<StoryLog>(
                queryEmbedding,
                olderLogs,
                (l) => l.embedding,
                3, // Top K
                0.4
            );

            if (semanticLogs.length > 0) {
                // Sort chronologically by original timestamp/order
                const sortedLogs = semanticLogs.map(r => r.item).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                historicalEchoes = `[HISTORICAL ECHOES]:\n` + sortedLogs.map(log => `- (Archived Memory): ${log.summary || log.content}`).join('\n') + `\n`;
            }
        }

        tier3Recency = `
### TIER 3: NARRATIVE CONTINUITY
[OVERARCHING ARC (GRAND DESIGN)]: ${gameData.grandDesign || "The path is yet to be woven."}
${historicalEchoes}[RECENT DEEDS]:
${recentMemory || "The journey has just begun."}
`;
    }

    let tier4Social = "";
    const fullSocialRegistryNames = (gameData.npcs || []).map(n => n.name);
    if (requiredKeys.includes('social_registry')) {
        // --- REFINED NPC REGISTRY INJECTION ---
        const activeCompanionIds = new Set(activeCompanions.map(c => c.id));

        const npcRegistryDisplay = (gameData.npcs || [])
            .filter(n => {
                const isAtLocale = isLocaleMatch(n.currentPOI || "", gameData.currentLocale || "");
                const isActiveCompanion = n.companionId && activeCompanionIds.has(n.companionId);
                return (isAtLocale || isActiveCompanion) && !n.isBodyCleared;
            })
            .map(n => {
                const memoryBlock = getRelevantMemories(lastMessage.content, n.memories, queryEmbedding);
                if (n.status === 'Dead') {
                    return `- [CORPSE]: ${n.name}. [CONDITION]: Dead. [FINAL MEMORY]: ${memoryBlock}`;
                }
                // Explicitly report sentience to the model
                const sentientLabel = n.isSentient !== false ? 'YES' : 'NO';
                const visibilityTag = !canBeTargeted(n) ? ' | [Visibility: Concealed]' : '';
                return `- ${n.name} [STATUS: ${n.status}] [RELATIONSHIP: ${n.relationship}] [TYPE: ${n.isShip ? 'Vehicle' : 'Personnel'}] [SENTIENT: ${sentientLabel}]${visibilityTag} [MEMORIES: ${memoryBlock}]: ${n.description?.slice(0, 50)}...`;
            })
            .join('\n');

        tier4Social = `
### TIER 4: SOCIAL STATE (NARRATIVE BRANCHING)
The following NPCs are in your immediate vicinity or are active party members. 

**BRANCHING RULE (DEATH STATUS)**: 
1. If an NPC is flagged as [STATUS: Dead], they ARE A CORPSE.
2. DEAD NPCs CANNOT SPEAK, MOVE, OR ACT. 
3. Narrate them as static objects, remains, or environmental features. 
4. NPCs who see a [STATUS: Dead] character should react with shock, grief, or indifference depending on their relationship.

**SENTIENCE AND PERSONIFICATION RULE**: 
1. If an entity is flagged as [SENTIENT: NO], it is a standard tool, mount, or vehicle. 
2. Non-sentient entities CANNOT speak, have "inner thoughts", or express complex human-like emotions.
3. For [SENTIENT: NO] vehicles: Describe their performance mechanically (e.g., "thrusters whining", "hull groaning"). 
4. For [SENTIENT: NO] animals: Describe their instinctual reactions (e.g., "whinnying in fear", "pawing the ground").
5. Only [SENTIENT: YES] entities (Androids, AI-Ships, Humans) are permitted to engage in dialogue.

**MEMORY RULE**: Use the provided [MEMORIES] to inform NPC reactions. These are a composite of recent interactions and specific past events relevant to the current situation.

[ACTIVE SOCIAL CONTEXT]:
${npcRegistryDisplay || "No notable NPCs nearby."}

**NAME PROTECTION RULE (CRITICAL)**:
You are STRICTLY FORBIDDEN from reusing names from the following global registry for any new random characters. Every entity in the world must have a unique identity.
[REGISTERED NAMES]: [${fullSocialRegistryNames.join(', ')}]
`;
    }

    const coreDirectives = `
[GM DIRECTIVES]: ${gameData.gmSettings || 'None.'}
[SKILL CONFIG]: ${getAvailableSkillsContext(gameData)}

[SYSTEM_OVERRIDE PROCESSING]:
If you see a block labeled [SYSTEM_OVERRIDE] in the user prompt or dice truth, you MUST execute those instructions exactly. 
- Specifically, if [SYSTEM_OVERRIDE: ENCOUNTER QUEST] is present, you MUST generate a new objective in 'updates.objectives' following the provided constraints.

[CRITICAL INVARIANTS]:
1. SPATIAL ANCHORING: If the player moves within the zone, you MUST update 'location_update.site_name' in the JSON.
2. PLAIN TEXT ONLY: No Markdown (**, *) in 'narration'.
3. NAME PROTECTION: DO NOT use the names of established NPCs for new random characters.
4. ADVENTURE BRIEF: You MUST update 'adventure_brief' in your JSON with a STRICT MAX 10 WORD summary of the player's immediate goal or next step.
5. QUEST GENERATION: If the narrative organically introduces a new mission, task, or overarching goal for the party, you MUST generate a new objective in 'updates.objectives'. Provide a 'title' and a 'content' that explicitly defines the completion condition.
6. QUEST PROGRESSION: If the player advances an existing active quest (especially the one marked as isTracked), you MUST update it in 'updates.objectives'. Provide the new 'nextStep' (Current Lead) and a short 'progressUpdate' string summarizing the advancement.
7. QUEST STATUS: If the player completes or fails an existing quest, include it in 'updates.objectives' and set 'status' to 'completed' or 'failed', along with a final 'progressUpdate'.
`;

    let builtContext = `${narratorPersona}\n${tier1Mandatory}\n${heroicDirective}\n${tier2Resonance}\n${tier3Recency}\n${tier4Social}\n${coreDirectives}`;

    const buildActorDetail = (char: PlayerCharacter | CombatActor, inventory?: Inventory) => {
        const isPC = 'experiencePoints' in char;
        const pc = char as PlayerCharacter;
        const npc = char as CombatActor;
        const inCombatContext = !!(gameData.combatState?.isActive || gameData.combatConfiguration?.narrativeCombat);

        const profession = pc.profession || npc.description || 'Unknown';
        const sentient = char.isSentient !== false ? 'YES' : 'NO';
        const status = (char as any).status || 'Alive';

        let details = `- ${char.name} (${profession})`;

        if (requiredKeys.includes('core_stats')) {
            details += ` [HP: ${char.currentHitPoints}/${char.maxHitPoints}] [STATUS: ${status}] [SENTIENT: ${sentient}]`;
        }

        if (isPC) {
            if (pc.background && requiredKeys.includes('social_registry')) details += ` | Background: ${pc.background.slice(0, 100)}...`;
            // GATED CONTEXT: Only include weapon stance detail if we are in a combat situation.
            if (inventory && inCombatContext && requiredKeys.includes('inventory')) {
                const stats = pc.getCombatStats(inventory);
                let stance = "Single-handed";
                if (stats.isFlurryActive) stance = "Unarmed Multi-Striker (Flurry Active)";
                else if (stats.isDualWielding) stance = "Dual Wielding";
                else if (stats.isTwoHanding) stance = "Two-Handed (Heavy Weapon)";
                else if (stats.isDueling) stance = "Dueling (Precision single blade)";

                details += ` | Weapon Stance: ${stance}`;
                if (stats.isFlurryActive) {
                    details += ` | [Combat Style: Unarmed Multi-Striker (Flurry Active)]`;
                }
            }
        }

        if (char.isShip) {
            details += ` | TYPE: VEHICLE/SHIP`;
        }

        if (!canBeTargeted(char)) {
            details += ` | [Visibility: Concealed]`;
        }

        if (char.statusEffects?.length && requiredKeys.includes('core_stats')) {
            details += ` | STATUS EFFECTS: ${char.statusEffects.map(e => e.name).join(', ')}`;
        }
        return details;
    };

    const partyDetails = [
        buildActorDetail(gameData.playerCharacter, gameData.playerInventory),
        ...activeCompanions.map(c =>
            buildActorDetail(c, gameData.companionInventories?.[c.id])
        )
    ].join('\n');

    builtContext += `\n\n[ACTIVE PARTY]:\n${partyDetails}`;

    if (gameData.combatState?.isActive && requiredKeys.includes('combat_state')) {
        const enemyDetails = gameData.combatState.enemies.map(e => buildActorDetail(e)).join('\n');
        builtContext += `\n\n[COMBATANTS]:\n${enemyDetails}`;
    }

    const instructions = `
[FINAL GM INSTRUCTION]
Roleplay the outcome of the user action using the CORE NARRATOR IDENTITY.
Adhere strictly to the SENTIENCE RULE: if a vehicle or animal is not sentient, it DOES NOT speak or have complex thoughts.
Adhere strictly to the DEATH STATUS: if an NPC is dead, they are a corpse.
Return a JSON response following the provided root schema.
`;

    return `${builtContext}\n${instructions}`;
};

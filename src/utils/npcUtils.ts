// utils/npcUtils.ts

import { NPC, Companion, CombatActor, EnemyTemplate } from '../types';
import { generateEnemyFromTemplate, DEFAULT_TEMPLATES, DEFAULT_SIZE_MODIFIERS, DEFAULT_ARCHETYPE_DEFINITIONS, recalculateCombatActorStats, DEFAULT_AFFINITIES } from './mechanics';

export const getRelationshipLabel = (score: number): { label: string, color: string } => {
    if (score >= 50) return { label: 'Loyal', color: 'bg-brand-accent' }; // +50
    if (score >= 30) return { label: 'Trusted', color: 'bg-emerald-400' };
    if (score >= 10) return { label: 'Friendly', color: 'bg-teal-400' };
    if (score > -10) return { label: 'Neutral', color: 'bg-yellow-400' };
    if (score >= -30) return { label: 'Unfriendly', color: 'bg-orange-400' };
    if (score >= -49) return { label: 'Hostile', color: 'bg-red-500' };
    return { label: 'Nemesis', color: 'bg-red-700' }; // -50
};

/**
 * Formats a relationship change into a narrative string.
 */
export const formatRelationshipChange = (npcName: string, change: number): string => {
    let verb = "noticed that";
    if (change >= 8) verb = "loved that";
    else if (change > 0) verb = "liked that";
    else if (change <= -8) verb = "hated that";
    else if (change < 0) verb = "disliked that";

    const symbol = change > 0 ? "+" : "";
    return `**${npcName}** ${verb}. ${symbol}${change}`;
};

/**
 * Scans a text block for mentions of NPCs in the registry.
 * Returns IDs of up to 'limit' unique, living, non-generic NPCs.
 */
export const detectMentionedNpcs = (text: string, npcs: NPC[], limit: number = 2): string[] => {
    if (!text || !npcs || npcs.length === 0) return [];

    const textLower = text.toLowerCase();
    const mentionedIds: string[] = [];

    const candidates = npcs.filter(npc => {
        const isGenericUnit = /\s\d+$/.test(npc.name || '');
        const isClearedCorpse = npc.status === 'Dead' && npc.isBodyCleared;
        return !isGenericUnit && !isClearedCorpse;
    });

    for (const npc of candidates) {
        if (mentionedIds.length >= limit) break;

        const nameLower = npc.name.toLowerCase();
        // Escape special chars for regex
        const escapedName = nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fullRegex = new RegExp(`\\b${escapedName}\\b`, 'i');

        if (fullRegex.test(textLower)) {
            mentionedIds.push(npc.id);
        } else {
            // Check partial name if distinct enough
            const firstName = nameLower.split(' ')[0];
            if (firstName.length > 3) {
                const escapedFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const firstRegex = new RegExp(`\\b${escapedFirst}\\b`, 'i');
                if (firstRegex.test(textLower)) {
                    mentionedIds.push(npc.id);
                }
            }
        }
    }

    return mentionedIds;
};

export const companionToNPC = (companion: Companion): NPC => {
    return {
        id: `npc-${companion.id}`,
        name: companion.name,
        description: companion.personality || companion.background || 'A trusted companion.',
        relationship: Number(companion.relationship || 0),
        status: 'Alive',
        location: 'With Party',
        currentPOI: 'Current',
        gender: companion.gender,
        race: companion.race || 'Unknown',
        appearance: companion.appearance,
        companionId: companion.id,
        image: companion.imageUrl,
        isShip: !!companion.isShip,
        isMount: !!companion.isMount,
        isSentient: companion.isSentient !== undefined ? companion.isSentient : true,
        moralAlignment: companion.alignment || { lawChaos: 0, goodEvil: 0 },
        rank: companion.rank || 'normal',
        size: companion.size || 'Medium',
        template: companion.template || 'Brute',
        cr: companion.cr || 'Normal',
        affinity: companion.affinity || 'None',
        archetype: companion.archetype || 'Bipedal'
    };
};

/**
 * Converts a mechanical CombatActor back into a lore NPC entry.
 */
export const combatActorToNPC = (actor: CombatActor, currentPOI: string | undefined): NPC => {
    const safeSize = actor.size || 'Medium';
    const safeRank = actor.rank || 'normal';
    const safePOI = currentPOI || "";

    const blueprintDesc = `${safeRank.charAt(0).toUpperCase() + safeRank.slice(1)} ${actor.template || 'entity'}. ` +
        `Affinity: ${actor.affinity || 'None'}. Size: ${safeSize}. ` +
        `Archetype: ${actor.archetype || 'Bipedal'}.`;

    return {
        id: actor.id,
        name: actor.name,
        description: actor.description && actor.description !== 'Analyzing entity...' ? actor.description : blueprintDesc,
        relationship: actor.isAlly ? 20 : 0,
        status: 'Alive',
        currentPOI: safePOI,
        size: actor.size,
        template: actor.template || 'Brute',
        cr: actor.challengeRating?.toString() || 'Normal',
        challengeRating: actor.challengeRating,
        difficulty: actor.rank === 'normal' ? 'Normal' : (actor.rank === 'elite' ? 'Elite' : 'Boss'),
        rank: actor.rank,
        affinity: actor.affinity || 'None',
        archetype: actor.archetype,
        isShip: !!actor.isShip,
        isMount: !!actor.isMount,
        isSentient: actor.isSentient !== undefined ? actor.isSentient : true
    };
};

/**
 * Converts a Registry NPC into a fully hydrated CombatActor.
 */
export const npcToCombatActor = (npc: NPC, playerLevel: number, baseScore: number = 8, templates?: Record<string, EnemyTemplate>): CombatActor => {
    const template = npc.template || 'Brute';
    const crTag = npc.difficulty || npc.cr || 'Normal';
    const size = npc.size || 'Medium';
    const archetype = (npc.archetype as any) || 'Bipedal';
    const affinity = npc.affinity || 'None';

    const getParams = (tag: string, level: number) => {
        const n = tag.toLowerCase().trim();
        if (n === 'weak') return { cr: Math.max(1, Math.floor(level / 2)), rank: 'normal' as const };
        if (n === 'elite') return { cr: level + 2, rank: 'elite' as const };
        if (n === 'boss' || n === 'tough') return { cr: level + 4, rank: 'boss' as const };
        return { cr: level, rank: 'normal' as const };
    };

    const params = getParams(crTag, playerLevel);

    let actor = generateEnemyFromTemplate(
        template,
        params.cr,
        params.rank,
        size,
        npc.name,
        templates || DEFAULT_TEMPLATES,
        DEFAULT_SIZE_MODIFIERS,
        baseScore,
        archetype,
        DEFAULT_ARCHETYPE_DEFINITIONS
    );

    actor.id = npc.id;
    actor.description = npc.description || 'A person of interest.';
    actor.isAlly = npc.relationship >= 10;
    actor.isShip = !!npc.isShip;
    actor.isMount = !!npc.isMount;
    actor.isSentient = npc.isSentient !== undefined ? npc.isSentient : true;

    if (affinity && DEFAULT_AFFINITIES[affinity]) {
        const affDef = DEFAULT_AFFINITIES[affinity];
        actor.resistances = [...(affDef.resistances || [])];
        actor.immunities = [...(affDef.immunities || [])];
        actor.vulnerabilities = [...(affDef.vulnerabilities || [])];
    }

    actor = recalculateCombatActorStats(actor, templates, baseScore);

    return actor;
};

export const GOOD_EVIL_ALIASES = [
    { label: 'Pure Good', value: 100 },
    { label: 'Altruistic', value: 75 },
    { label: 'Compassionate', value: 25 },
    { label: 'Kind', value: 10 },
    { label: 'Neutral', value: 0 },
    { label: 'Selfish', value: -25 },
    { label: 'Ruthless', value: -75 },
    { label: 'Malicious', value: -85 },
    { label: 'Pure Evil', value: -100 }
];

export const LAW_CHAOS_ALIASES = [
    { label: 'Pure Law', value: 100 },
    { label: 'Strict', value: 75 },
    { label: 'Disciplined', value: 30 },
    { label: 'Methodical', value: 10 },
    { label: 'Neutral', value: 0 },
    { label: 'Spontaneous', value: -20 },
    { label: 'Unbound', value: -75 },
    { label: 'Rebellious', value: -85 },
    { label: 'Pure Chaos', value: -100 }
];

export const getGoodEvilLabel = (score: number) => {
    if (score >= 100) return 'Pure Good';
    if (score >= 75) return 'Altruistic';
    if (score >= 25) return 'Compassionate';
    if (score >= 10) return 'Kind';
    if (score > -10) return 'Neutral';
    if (score > -30) return 'Selfish';
    if (score > -75) return 'Ruthless';
    if (score > -100) return 'Malicious';
    return 'Pure Evil';
};

export const getLawChaosLabel = (score: number) => {
    if (score >= 100) return 'Pure Law';
    if (score >= 75) return 'Strict';
    if (score >= 30) return 'Disciplined';
    if (score >= 10) return 'Methodical';
    if (score > -10) return 'Neutral';
    if (score > -30) return 'Spontaneous';
    if (score > -75) return 'Unbound';
    if (score > -100) return 'Rebellious';
    return 'Pure Chaos';
};

export const calculateAlignmentRelationshipShift = (
    actionAlignment: string, // "Good", "Evil", "Lawful", "Chaotic"
    npcAlignment?: { lawChaos?: number; goodEvil?: number }
): number => {
    if (!npcAlignment) return 0;

    if (actionAlignment === 'Good' || actionAlignment === 'Evil') {
        const score = npcAlignment.goodEvil || 0;
        const label = getGoodEvilLabel(score);
        const index = GOOD_EVIL_ALIASES.findIndex(a => a.label === label);
        if (index === -1 || index === 4) return 0; // 4 is Neutral

        // Neutral is index 4
        // Good action: 4 - index (Pure Good [0] -> +4, Pure Evil [8] -> -4)
        // Evil action: index - 4 (Pure Good [0] -> -4, Pure Evil [8] -> +4)
        return actionAlignment === 'Good' ? (4 - index) : (index - 4);
    }

    if (actionAlignment === 'Lawful' || actionAlignment === 'Chaotic') {
        const score = npcAlignment.lawChaos || 0;
        const label = getLawChaosLabel(score);
        const index = LAW_CHAOS_ALIASES.findIndex(a => a.label === label);
        if (index === -1 || index === 4) return 0; // 4 is Neutral

        // Neutral is index 4
        // Lawful action: 4 - index
        // Chaotic action: index - 4
        return actionAlignment === 'Lawful' ? (4 - index) : (index - 4);
    }

    return 0;
};
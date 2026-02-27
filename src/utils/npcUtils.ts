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
        loves: companion.loves || '',
        likes: companion.likes || '',
        dislikes: companion.dislikes || '',
        hates: companion.hates || '',
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
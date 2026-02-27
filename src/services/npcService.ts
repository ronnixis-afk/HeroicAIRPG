
import { NPC, Companion } from '../types';
import { companionToNPC } from '../utils/npcUtils';

export const generateNPCsFromCompanions = (companions: Companion[], existingNPCs: NPC[]): NPC[] => {
    const newNPCs: NPC[] = [];
    const existingCompanionIds = new Set(existingNPCs.map(n => n.companionId).filter(Boolean));

    companions.forEach(comp => {
        // Exclude if it's a ship OR if already exists
        if (!comp.isShip && !existingCompanionIds.has(comp.id)) {
            newNPCs.push(companionToNPC(comp));
        }
    });

    return newNPCs;
};

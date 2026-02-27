
// utils/EncounterMechanics.ts

import { DiceRoll } from '../types';
import { ENCOUNTER_MATRIX } from '../constants';

export interface EncounterMatrixResult {
    encounterType: string;
    entityType: string;
    condition: string;
    summary: string;
}

/**
 * Deterministically rolls on the encounter matrix.
 */
export const generateEncounterMatrix = (): EncounterMatrixResult => {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    const roll3 = Math.floor(Math.random() * 20) + 1;

    const encType = ENCOUNTER_MATRIX.encounterTypes[roll1 - 1];
    const entType = ENCOUNTER_MATRIX.entityTypes[roll2 - 1];
    const cond = ENCOUNTER_MATRIX.conditions[roll3 - 1];
    
    return { 
        encounterType: encType, 
        entityType: entType, 
        condition: cond, 
        summary: `[Rolls: ${roll1}, ${roll2}, ${roll3}] ${encType} | ${entType} | ${cond}` 
    };
};

/**
 * Performs a d100 check. Returns 'Threat' if danger is present.
 */
export const generateEncounterRoll = (
    checkName: string, 
    hostilityModifier: number
): { roll: DiceRoll, matrix?: EncounterMatrixResult } => {
    const d100 = Math.floor(Math.random() * 100) + 1;
    const total = d100 + hostilityModifier;
    let outcome: DiceRoll['outcome'] = 'No Encounter';
    let matrix = undefined;
    
    // Threshold for Threat: 75
    if (total >= 75) {
        outcome = 'Encounter'; // Matches type union but used as "Threat Detected"
        matrix = generateEncounterMatrix();
    }

    return {
        roll: {
            rollerName: 'System',
            rollType: 'Encounter Check',
            checkName: checkName,
            dieRoll: d100,
            bonus: hostilityModifier,
            total: total,
            outcome: outcome
        },
        matrix
    };
};

/**
 * CORE PROCEDURAL PLOT SYSTEM
 */
export const getUnifiedProceduralPrompt = (matrix: EncounterMatrixResult, isNewDiscovery: boolean = false): string => {
    const basePillars = `
[ENCOUNTER PILLARS]:
- ENCOUNTER TYPE: ${matrix.encounterType}
- ENTITY TYPE: ${matrix.entityType}
- CONDITION/TWIST: ${matrix.condition}
`;

    const gmNotesInstruction = `
[SYSTEM_OVERRIDE: GM NOTES]:
You MUST update 'updates.gmNotes' (Current Encounter Plot) with exactly THREE concise sentences:
1. (ENCOUNTER TYPE): Define the nature of the encounter.
2. (ENTITY TYPE): Define the physical nature of this entity/hazard.
3. (CONDITION/TWIST): Define the hidden complication.

**STRICT RULE**: NEVER use the bracketed system summary "${matrix.summary}" as the content for gmNotes. You MUST write full, descriptive sentences.
*JSON Schema: "gmNotes": "Sentence 1. Sentence 2. Sentence 3."*
`;

    const questInstruction = `
[SYSTEM_OVERRIDE: ENCOUNTER QUEST]:
You MUST create a NEW tracked objective in 'updates.objectives' for this encounter.
- The quest goal MUST be the resolution of the [ENCOUNTER PILLARS].
- It MUST NOT be more than 30 words.
- It MUST include a clear quest completion condition.
- Set "isTracked": true.
- You MUST provide a "title" and "content" for the objective.
`;

    return `${basePillars}\n${gmNotesInstruction}\n${questInstruction}`;
};

/**
 * Instruction for environmental hazards/traps triggered by crit fails.
 */
export const getHazardPrompt = (tier: string, scope: string, totalDamageDealt: number): string => {
    const scopeNarrative = scope === 'Multiple' 
        ? "affected the ENTIRE PARTY" 
        : "targeted ONLY the character who failed";

    return `
[MANDATORY SYSTEM DIRECTIVE: HAZARD TRIGGERED]
The player has CRITICALLY FAILED their action, triggering an immediate ${tier.toUpperCase()} environmental hazard or trap.
SCOPE: This event ${scopeNarrative}.
STATISTICAL TRUTH: The system has resolved the damage; total health lost by affected party members is significant.

INSTRUCTIONS:
1. Explain WHAT specifically in the environment caused the harm (e.g., a massive falling stone, a toxic gas leak, a magical backlash explosion).
2. The hazard MUST be consistent with the SCOPE (${scope}). 
   - If 'Multiple', it should be a large-scale event (collapsing floor, area explosion).
   - If 'Single', it should be precise (a poison dart, a specific limb-trap).
3. The explanation MUST fit the current location and the failed skill.
4. Narrate the shock and the immediate physical consequence.
5. DO NOT start combat unless hostiles are already present. This is an environmental setback.
`;
};

/**
 * Instruction for non-combat skill setbacks.
 */
export const getSkillFailurePrompt = (skill: string, reason: string): string => {
    return `
[SYSTEM DIRECTIVE: SKILL SETBACK]
The player has FAILED a ${skill} check. 
The system has determined that COMBAT IS NOT REASONABLE here: ${reason}.
1. NARRATE a non-combat failure or setback.
2. POSSIBLE CONSEQUENCES: Lost time, minor physical injury (bruises), social embarrassment, broken equipment, or a dead-end path.
3. DO NOT introduce new enemies or traps.
4. Keep the scene grounded in the current locale.
`;
};

/**
 * Instruction for when a party succeeds a check to avoid/spot a threat.
 */
export const getSkillSuccessPrompt = (skill: string, matrix: EncounterMatrixResult): string => {
    return `
[SYSTEM DIRECTIVE: THREAT AVERTED]
The system detected a threat, but the party SUCCEEDED their ${skill} check to spot or avoid it.
PILLARS: ${matrix.summary}
1. NARRATE a scene where the party detects the danger EARLY.
2. The player should have the upper hand. They might see the enemy before being seen, or bypass a hazard safely.
3. DO NOT start combat yet. Provide the player with options on how to handle the detected threat.
`;
};

/**
 * Instruction to clear the persistent plot brief and FORBID conflict.
 */
export const getClearPlotPrompt = (): string => {
    return `
[MANDATORY SYSTEM DIRECTIVE: PEACEFUL SCENE]
The system has determined that NO encounter occurs. 
1. YOU ARE FORBIDDEN from introducing hostiles, traps, combat triggers, or dramatic interruptions.
2. NARRATE a scene of absolute safety, quiet contemplation, or peaceful transition. 
3. DO NOT imply danger or "looming threats." Focus on sensory details of the environment, weather, or party banter.
4. Set 'updates.gmNotes' to an empty string ("") to clear any previous encounter context.
5. Return 'suggestedActors' as an empty array [].
6. DO NOT include a 'combatTrigger' in your response.
`;
};

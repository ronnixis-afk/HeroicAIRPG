// services/aiHousekeeperService.ts

import { getAi, cleanJson } from './aiClient';
import { ThinkingLevel } from '@google/genai';
import { GameData, AIUpdatePayload, ExtractionScopeFlags } from '../types';
import { isLocaleMatch } from '../utils/mapUtils';

/**
 * THE HOUSEKEEPER (Mechanical Specialist)
 * Reconciles inventory, social standing, quest progress, and NPC memories.
 * Optimized for logic and reliability using gemini-flash-lite-latest.
 */
export const performHousekeeping = async (
  userAction: string,
  narrativeResult: string,
  gameData: GameData,
  explicitAlignment?: string,
  flags?: ExtractionScopeFlags
): Promise<{
  inventoryUpdates: any[];
  userAlignmentShift: string;
  npcMemories: { npcId: string, memory: string }[];
}> => {

  // Create a unified, deduplicated social registry for the Housekeeper
  const socialMap = new Map<string, any>();
  const currentLocale = gameData.currentLocale || "";
  const activeCompanionIds = new Set((gameData.companions || []).map(c => c.id));

  (gameData.npcs || []).forEach(n => {
    const npcPOI = n.currentPOI || "";
    const isAtLocale = isLocaleMatch(npcPOI, currentLocale) ||
      npcPOI === 'Current' ||
      npcPOI === 'With Party';

    const isActiveCompanion = n.companionId && activeCompanionIds.has(n.companionId);
    const isAlive = n.status !== 'Dead';
    const isSentient = n.isSentient !== false && !n.isShip;

    if ((isAtLocale || isActiveCompanion) && isAlive && isSentient) {
      socialMap.set(n.id, {
        id: n.id,
        name: n.name,
        type: isActiveCompanion ? 'Active Companion' : 'Local NPC',
        moralAlignment: n.moralAlignment,
        currentRel: n.relationship,
        isCompanion: !!n.companionId
      });
    }
  });

  const socialRegistry = Array.from(socialMap.values());

  // Format existing inventory context
  const playerInv = gameData.playerInventory || { equipped: [], carried: [], storage: [], assets: [] };
  const playerItems = [
    ...playerInv.equipped.map(i => `${i.name} (Equipped)`),
    ...playerInv.carried.map(i => i.name),
    ...playerInv.storage.map(i => `${i.name} (Storage)`),
    ...playerInv.assets.map(i => `${i.name} (Asset)`)
  ];

  const companionInventoryContext = (gameData.companions || []).map(c => {
    const cInv = gameData.companionInventories[c.id] || { equipped: [], carried: [], storage: [], assets: [] };
    const cItems = [
      ...cInv.equipped.map(i => `${i.name} (Equipped)`),
      ...cInv.carried.map(i => i.name),
      ...cInv.storage.map(i => `${i.name} (Storage)`),
      ...cInv.assets.map(i => `${i.name} (Asset)`)
    ];
    return `${c.name} Inventory: ${cItems.length > 0 ? cItems.join(', ') : 'Empty'}`;
  }).join('\n    ');

  const prompt = `
    You are the "Social & Mechanical Housekeeper". 
    Your task is to extract relationship shifts, inventory changes, and specific NPC memories from the narrative.
    
    [USER ACTION]
    "${userAction}"

    [GM NARRATIVE]
    "${narrativeResult}"
    
    [SOCIAL REGISTRY (COMPANIONS & OBSERVERS)]
    ${socialRegistry.length > 0 ? JSON.stringify(socialRegistry) : "No established characters are present."}

    [CURRENT INVENTORIES (FOR CONTEXT)]
    Player Inventory: ${playerItems.length > 0 ? playerItems.join(', ') : 'Empty'}
    ${companionInventoryContext}

    [INVENTORY EXTRACTION RULES - STRICT POLICY]
    [INVENTORY EXTRACTION RULES - STRICT POLICY]
    1. **ACQUISITION vs. PRESENCE**: ${flags?.itemChange ? `ONLY add items if the narrative confirms a character HAS PHYSICALLY ACQUIRED it. 
       - DO NOT add items simply because they are mentioned as being in the room, on a shelf, or wielded by an enemy.
       - VALID VERBS: "picked up", "received", "looted", "grabbed", "was handed", "purchased", "stole".
       - INVALID MENTIONS: "You see a...", "The merchant shows you...", "The guard has a...", "A chest sits in the corner".` : "SKIP: No inventory acquisitions occurred."}
    2. **DUPLICATE PREVENTION**:
       - BEFORE adding an item, check if the character ALREADY HAS it or a very similar item in their inventory.
       - IF the character already has the item, DO NOT add it again unless it is a stackable resource (Gold, Credits, Ammunition, Consumables, Materials).
       - For unique gear (weapons, armor, tools), assume one is enough.
    3. **CLASSIFICATION (WATERFALL LOGIC)**: 
       - Classify items as type: "Usable" (Gear, Consumables, Weapons) or "Non-Usable" (Notes, Letters, Maps, Keys, Quest Items).
       - If "Usable", identify the logical 'slot' (Head, Eyes, Neck, Shoulders, Body, Vest, Bracers, Gloves, Main Hand, Off Hand, Ring, Waist, Legs, Feet, Accessory).
    4. **REMOVAL VALIDATION**: ${flags?.itemChange ? `
       - ONLY remove items if the narrative confirms they are lost, dropped, destroyed, or consumed.
       - CRITICAL: Check the [CURRENT INVENTORIES] context. If an item is NOT in the character's inventory, you CANNOT remove it.
       - Use the exact name from the character's inventory for the removal.` : "SKIP: No inventory losses occurred."}
    5. **OWNER IDENTIFICATION**:
       - If the narrative says "You receive/take..." -> ownerId is "player".
       - If the narrative says "[Companion Name] takes..." -> ownerId is the specific ID from the SOCIAL REGISTRY.
       - DEFAULT: If it is unclear but the Player is the one acting, default to ownerId: "player".
    6. **QUANTITY**: If currency (Gold, Credits) is added, estimate a logical amount based on narrative context (e.g. "a few coins" = 5, "a heavy purse" = 50).

    [ALIGNMENT AUDIT INSTRUCTIONS]
    ${explicitAlignment ? `
    1. The player's action has already been explicitly aligned as "${explicitAlignment}".
    2. Therefore, you MUST output exactly "${explicitAlignment}" into the 'userAlignmentShift' field. Do not analyze.
    ` : `
    1. Read the user's action and classify their intent into ONE of the following precise alignment strings:
       - "Good" (healing, helping, altruism, protecting the weak)
       - "Evil" (murder, cruelty, theft, selfishness)
       - "Lawful" (following rules, deferring to authority, methodical checks)
       - "Chaotic" (breaking rules, reckless behavior, spontaneous actions)
       - "Neutral" (casual conversation, basic exploration, walking)
     2. Output this single string into the 'userAlignmentShift' field.
    `}

    [NPC MEMORY INSTRUCTIONS]
    1. For each NPC the player interacted with, extract ONE concise memory (MAX 10 WORDS).

    // (Quest Audit Instructions removed as per user request to keep only Location Discovery quests)

    [OUTPUT JSON SCHEMA]
    {
      "inventoryUpdates": [
        { 
          "ownerId": "player OR companion-id", 
          "list": "carried|equipped|storage|assets", 
          "action": "add|remove",
          "items": [ 
            { 
              "name": "string", 
              "quantity": number, 
              "description": "flavor summary", 
              "rarity": "string",
              "type": "Usable|Non-Usable",
              "slot": "string OR null"
            } 
          ] 
        }
      ],
      "userAlignmentShift": "Good|Evil|Lawful|Chaotic|Neutral",
      "npcMemories": [
        { "npcId": "string", "memory": "string" }
      ]
    }
    `;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 512 }
      }
    });

    const result = JSON.parse(cleanJson(response.text || "{}"));

    return {
      inventoryUpdates: result.inventoryUpdates || [],
      userAlignmentShift: result.userAlignmentShift || "Neutral",
      npcMemories: result.npcMemories || []
    };
  } catch (e) {
    console.error("Housekeeper failed:", e);
    return { inventoryUpdates: [], userAlignmentShift: "Neutral", npcMemories: [] };
  }
};
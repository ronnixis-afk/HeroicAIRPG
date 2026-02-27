// services/aiItemService.ts

import { getAi, cleanJson } from './aiClient';
import { Item, GameData, CombatActor, SkillConfiguration, NPC } from '../types';
import { calculateItemPrice, getItemRarityDistribution, forgeRandomItem, RARITY_TIERS, buildMechanicalSummary } from '../utils/itemMechanics';
import { getAIModifierInstructions } from '../utils/itemModifiers';

export const inferTagsFromStats = (itemData: any): string[] => {
    const rawTags = Array.isArray(itemData.tags) ? itemData.tags : (typeof itemData.tags === 'string' ? [itemData.tags] : []);
    const tags = new Set<string>(rawTags.filter((t: any) => typeof t === 'string').map((t: any) => t as string));

    if (itemData.buffs && Array.isArray(itemData.buffs) && itemData.buffs.length > 0) {
        tags.add('buff');
        if (!itemData.weaponStats && !itemData.armorStats && !itemData.bodySlotTag) {
            tags.add('consumable');
        }
    }

    if (itemData.effect) {
        tags.add('mechanical');
    }

    if (itemData.weaponStats) {
        const ability = itemData.weaponStats.ability?.toLowerCase();
        const isHeavy = Array.from(tags).some(t => t.toLowerCase().includes('heavy'));
        if (isHeavy) {
            tags.add('Heavy Weapon');
        } else if (ability === 'dexterity') {
            tags.add('Light Weapon');
        } else {
            tags.add('Medium Weapon');
        }
    }

    if (itemData.armorStats) {
        if (itemData.armorStats.armorType === 'shield') {
            tags.add('shield');
            tags.add('Light Armor');
        } else {
            const type = itemData.armorStats.armorType?.toLowerCase();
            if (type === 'light') tags.add('Light Armor');
            else if (type === 'medium') tags.add('Medium Armor');
            else if (type === 'heavy') tags.add('Heavy Armor');
            else tags.add('Light Armor');
        }
    }

    const toRemove = ['unidentified', 'weapon', 'armor', 'heavy weapon', 'light weapon', 'medium weapon', 'light armor', 'medium armor', 'heavy armor'];
    toRemove.forEach(r => {
        tags.delete(r);
    });

    return Array.from(tags);
};

/**
 * Conservative check for item acquisition intent in user messages.
 */
export const detectItemAdditionIntent = (text: string): boolean => {
    const lower = (text || '').toLowerCase();

    // Explicit Negations: Cases where "take" doesn't mean acquisition
    if (lower.includes('take a look') ||
        lower.includes('take damage') ||
        lower.includes('take cover') ||
        lower.includes('take a rest') ||
        lower.includes('take aim')) return false;

    // Direct Acquisition Verbs
    return (
        lower.includes('pick up') ||
        lower.includes('loot the') ||
        lower.includes('grab the') ||
        lower.includes('retrieve the') ||
        lower.includes('collect the') ||
        lower.includes('steal the') ||
        lower.includes('pocket the')
    );
};

export const generateItemCorrection = async (userContent: string, narrative: string) => {
    const input = `The user said: "${userContent}". The GM narrated: "${narrative}". Did the party acquire items? Extract into JSON.
    STRICT RULE: ONLY extract items if they were explicitly picked up, stolen, looted, or received.
    Return JSON: { "updates": { "inventoryUpdates": [ { "ownerId": "player", "list": "carried", "items": [ { "name": "string", "quantity": number, "description": "MAX 20 WORDS", "rarity": "string" } ] } ] } }`;
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input,
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

export const enrichItemDetails = async (item: Item, gameData: GameData): Promise<Partial<Item>> => {
    const level = gameData.playerCharacter.level || 1;

    const contextPrompt = `
    Define the precise mechanical stats and thematic flavor for this item based on the current context.
    
    **CONCEPT**: 
    Name: "${item.name}"
    Narrative Context: "${item.description || item.details || 'Found during exploration.'}"
    Initial Tags: ${(item.tags || []).join(', ') || 'None'}
    
    **WORLD LORE CONTEXT (THEMATIC SKINNING)**:
    ${gameData.worldSummary || 'Standard Fantasy Setting'}

    **CONTEXT**:
    Player Level: ${level}
    
    **STRICT POLICY - CONSERVATIVE BUFFS**:
    - ONLY include mechanical buffs (enhancementBonus, plusAC, buffs) if the narrative explicitly describes the item as superior, magical, advanced, or masterwork.
    - Plain, mundane, or scavenged items MUST NOT have any buffs.
    - If the item is "Credits" or "Gold", ensure you assign a logical 'quantity' based on the lore context.

    **STRICT POLICY - ENHANCEMENT SCALE (ONLY IF BUFFED)**:
    - Uncommon (+1), Rare (+2), Very Rare (+3), Legendary (+4), Artifact (+5).

    **MECHANICAL SCHEMAS**:
    1. 'weaponStats': { "ability": "strength|dexterity", "enhancementBonus": number, "damages": [{ "dice": "1d8", "type": "Slashing" }], "critRange": number }
    2. 'armorStats': { "baseAC": number, "armorType": "light|medium|heavy|shield", "plusAC": number, "strengthRequirement": number }
    3. 'buffs': Array of { "type": "ac|attack|damage|save|skill|ability|resistance|immunity", "bonus": number, "skillName": "String", "abilityName": "String", "damageType": "String" }
    4. 'effect': { "type": "Damage|Status|Heal", "targetType": "Single|Multiple", "dc": number, "saveAbility": "dexterity|constitution|wisdom|etc", "damageDice": "string", "damageType": "string", "status": "string", "healDice": "string" }
    5. 'usage': { "type": "charges|per_short_rest|per_long_rest", "maxUses": number, "currentUses": number }

    **INSTRUCTIONS**:
    - **PRICING**: Use logical market rates (e.g., Common: 10-100g, Rare: 500-2000g, Legendary: 10000g+).
    - **DESCRIPTION**: Atmospheric flavor text. MUST be under 20 words.
    - **DETAILS**: Longer lore and history details (if applicable).
    - **STRICT RULE**: DO NOT include numerical stats (e.g. "AC 3", "+1") in the 'name' or 'description'. Use pure flavor.
    - **BODY SLOT**: Select: Head, Eyes, Neck, Shoulders, Body, Vest, Bracers, Gloves, Main Hand, Off Hand, Ring 1, Forward 2, Waist, Legs, Feet, Accessory 1, Accessory 2.
    
    Return JSON only containing: name, description, details, rarity, tags, keywords, weaponStats, armorStats, effect, buffs, usage, price, bodySlotTag, quantity.`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: contextPrompt,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const details = JSON.parse(cleanJson(response.text || '{}'));

        const tempItem = new Item(details);
        details.tags = inferTagsFromStats(details);
        const sysSummary = buildMechanicalSummary(tempItem);
        details.details = (details.details ? details.details + '\n\n' : '') + sysSummary;

        return details;
    } catch (e) {
        console.error("Item Enrichment failed", e);
        return {};
    }
};

export const identifyItems = async (items: Item[], gameData: GameData): Promise<Item[]> => {
    if (!items || items.length === 0) return [];

    const input = `You are a legendary Appraiser and Lorekeeper. You must Identify and skin the following items.
    
    [WORLD LORE FOR SKINNING]
    ${gameData.worldSummary || 'Standard setting.'}

    [ITEMS TO IDENTIFY]
    ${JSON.stringify(items.map((i, idx) => ({
        id: i.id,
        _index: idx,
        rarity: i.rarity,
        mechanicalTruth: i.details || buildMechanicalSummary(i)
    })))}
    
    [THEMATIC INTEGRITY INSTRUCTIONS]
    You MUST ensure the Name and Description of each item are logical representations of its Mechanical Truth.
    1. RANGE: If a weapon is 'Ranged', do NOT name it a 'Baton', 'Sword', or 'Mace'. Name it a 'Throwing Star', 'Blaster', 'Sling', 'Bow', etc.
    2. WEIGHT: A 'Heavy Weight' item should sound massive and powerful (e.g. Greatsword, Cannon). A 'Light Weight' item should sound compact or surgical (e.g. Dagger, Pistol).
    3. ATTRIBUTE: If a weapon is 'Dexterity-scaling', focus on precision, speed, and finesse. If 'Strength-scaling', focus on brute impact, weight, and destructive force.
    4. DAMAGE TYPE: Ensure the name fits the damage type (e.g., 'Bludgeoning' -> Hammer/Club/Staff, 'Slashing' -> Blade/Axe, 'Piercing' -> Spear/Rapier/Dart).
    5. ENHANCEMENTS & BUFFS: If the 'mechanicalTruth' includes an 'Enhancement' bonus (+1, +2, etc.) or powerful 'Passives', you MUST acknowledge this quality. Reflect it in the name using adjectives like 'Superior', 'Masterwork', 'Blessed', 'Hardened', or 'High-Grade'. In the description, mention sensory details like the item's unnatural balance, its humming energy, or its pristine craftsmanship.

    [INSTRUCTIONS]
    1. For each item, you MUST generate a new, evocative, THEMATIC name that replaces any 'Unidentified' placeholders.
    2. description: Atmospheric flavor text matching the item's mechanical power. MAX 20 WORDS.
    3. details: Deep lore and historical background about this specific item.
    4. You MUST preserve the EXACT 'id' provided for each item.
    5. STRICT RULE: DO NOT include numerical stats (e.g. "AC 4", "+2") in 'name' or 'description'.
    6. Ensure the Name and Flavor fit the World Lore context provided.
    
    Return JSON array: [{ id, name, description, details, rarity, tags, keywords, weaponStats, armorStats, buffs, effect, usage, bodySlotTag }]`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: input,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        const rawJson = cleanJson(response.text || '[]');
        let parsed = JSON.parse(rawJson);

        if (!Array.isArray(parsed) && parsed.items && Array.isArray(parsed.items)) {
            parsed = parsed.items;
        }

        if (Array.isArray(parsed)) {
            return items.map((original, index) => {
                let aiItem = parsed.find(p => p.id === original.id);
                if (!aiItem && parsed[index]) {
                    aiItem = parsed[index];
                }

                if (!aiItem) return original;

                const sanitizedTags = Array.isArray(aiItem.tags) ? aiItem.tags : (typeof aiItem.tags === 'string' ? [aiItem.tags] : []);
                const sanitizedKeywords = Array.isArray(aiItem.keywords) ? aiItem.keywords : (typeof aiItem.keywords === 'string' ? [aiItem.keywords] : []);

                const mergedData = {
                    ...original,
                    ...aiItem,
                    id: original.id,
                    tags: Array.from(new Set([...(original.tags || []), ...sanitizedTags]))
                        .filter(t => typeof t === 'string' && t.toLowerCase() !== 'unidentified'),
                    keywords: Array.from(new Set([...(original.keywords || []), ...sanitizedKeywords])),
                    isNew: true
                };

                const newItem = new Item(mergedData);
                const sysSummary = buildMechanicalSummary(newItem);
                newItem.details = (aiItem.details ? aiItem.details + '\n\n' : '') + sysSummary;

                return newItem;
            });
        }
        return [];
    } catch (e) {
        console.error("Identification failed", e);
        return [];
    }
};

export const generateItemPrices = async (items: Item[]): Promise<{ id: string, price: number }[]> => {
    const input = `Price items based on rarity, power, and world lore.\nItems: ${JSON.stringify(items.map(i => ({ id: i.id, name: i.name, rarity: i.rarity, tags: i.tags, mechanics: i.details })))}\nReturn JSON: [{ id, price }]`;
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input,
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    return JSON.parse(cleanJson(response.text || '[]'));
};

export const generateStoreCategoryInventory = async (category: string, blueprints: Item[], worldSummary: string, scale: string = 'Person'): Promise<any[]> => {
    const itemsContext = blueprints.map((b, i) => ({
        index: i,
        rarity: b.rarity,
        mechanicalDetails: b.details
    }));

    const isMacroScale = scale.toLowerCase().includes('ship') || scale.toLowerCase().includes('mount') || category.toLowerCase().includes('ship') || category.toLowerCase().includes('mount');
    const scaleContext = isMacroScale ? `Vessel/Beast-Scale Component (${scale}). Render names and flavor for large-scale entities. For Ships: Hull, Batteries, Sensors, Thrusters. For Mounts: Barding, Saddles, Harnesses, Talons.` : 'Personnel-Scale gear.';

    const input = `You are a merchant for "${category}". Skin these store items using the world lore for flavor.
    
    [WORLD LORE]
    ${worldSummary}
    
    [SCALE CONTEXT]
    ${scaleContext}

    [STOCK BLUEPRINTS]
    ${JSON.stringify(itemsContext)}
    
    [THEMATIC INTEGRITY INSTRUCTIONS]
    You MUST ensure the Name and Description of each item are logical representations of its Mechanical Details.
    1. RANGE: If a weapon is 'Ranged', do NOT name it a 'Baton', 'Sword', or 'Mace'. Name it a 'Throwing Star', 'Blaster', 'Sling', 'Bow', etc.
    2. WEIGHT: A 'Heavy Weight' item should sound massive and powerful (e.g. Greatsword, Cannon). A 'Light Weight' item should sound compact or surgical (e.g. Dagger, Pistol).
    3. ATTRIBUTE: If a weapon is 'Dexterity-scaling', focus on precision, speed, and finesse in the name/flavor. If 'Strength-scaling', focus on brute impact, weight, and destructive force.
    4. DAMAGE TYPE: Ensure the name fits the damage type (e.g., 'Bludgeoning' -> Hammer/Club/Staff, 'Slashing' -> Blade/Axe, 'Piercing' -> Spear/Rapier/Dart).
    5. ENHANCEMENTS & BUFFS: Look for 'Enhancement' or '[Passives]' in the 'mechanicalDetails'. You MUST reflect this quality. High-rarity items with bonuses should sound 'Exceptional', 'Master-Crafted', or 'Blessed'. The description should mention how the item feels superior to its mundane counterparts.

    [INSTRUCTIONS]
    Provide thematic names and atmospheric descriptions (MAX 20 WORDS) for each item index.
    STRICT RULE: DO NOT include numerical stats (e.g. "+1", "AC 15") in 'name' or 'description'.
    
    Return JSON: [{ index, name, description, details }]`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: input,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const skins = JSON.parse(cleanJson(response.text || '[]'));
        if (Array.isArray(skins)) {
            return blueprints.map((blueprint, i) => {
                const skin = skins.find(s => s.index === i);
                const itemData = { ...blueprint, name: skin?.name || blueprint.name, description: skin?.description || blueprint.description };
                const sysSummary = buildMechanicalSummary(new Item(itemData));
                itemData.details = (skin?.details ? skin.details + '\n\n' : '') + sysSummary;
                return itemData;
            });
        }
        return blueprints;
    } catch (e) { return blueprints; }
};

export const generateForgeDetails = async (
    blueprint: Item,
    worldSummary: string,
    userIdea: string
): Promise<{ name: string, description: string }> => {

    const summary = buildMechanicalSummary(blueprint);

    const isMacroScale = (blueprint.tags || []).some(t => t.toLowerCase().includes('ship') || t.toLowerCase().includes('mount'));
    const scaleContext = isMacroScale ? 'Vessel/Beast-Scale. Focus on macro-scale flavor (Armor Plating, Ordnance, Structure).' : 'Personnel-Scale.';

    const input = `Create a unique, thematic name and atmospheric flavor text for a newly forged RPG item.
    
    [MECHANICAL BLUEPRINT]
    ${summary}

    [SCALE CONTEXT]
    ${scaleContext}

    [WORLD LORE CONTEXT]
    ${worldSummary}

    [USER IDEA / SEED]
    "${userIdea || 'A powerful custom creation.'}"

    [INSTRUCTIONS]
    1. **DESCRIPTION**: Evocative flavor text. STRICTLY MAX 15 WORDS.
    2. **STRICT RULE**: NO NUMBERS or STATS in the name or description. Use only evocative flavor.
    
    Return JSON: { "name": "string", "description": "string" }`;

    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input,
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    return JSON.parse(cleanJson(response.text || '{}'));
};

/**
 * Skins a list of starting items based on character flavor and world context.
 */
export const skinItemsForCharacter = async (items: Item[], character: any, worldSummary: string): Promise<Item[]> => {
    const itemsContext = items.map((item, idx) => ({
        index: idx,
        type: item.weaponStats ? 'Weapon' : (item.armorStats ? 'Armor' : 'Item'),
        stats: buildMechanicalSummary(item)
    }));

    const prompt = `You are a Master Armorer. Provide unique thematic skins for these 3 pieces of starting equipment.
    
    [CHARACTER PROFILE]
    Name: ${character.name}
    Class: ${character.profession}
    Background: ${character.background}
    Appearance: ${character.appearance}
    
    [WORLD LORE SUMMARY]
    ${worldSummary}
    
    [MECHANICAL BLUEPRINTS]
    ${JSON.stringify(itemsContext)}
    
    [INSTRUCTIONS]
    1. For each item, generate an evocative NAME and flavor DESCRIPTION (max 15 words).
    2. The names and flavor MUST be derived from the character's specific profile and the world lore.
    3. DO NOT change any mechanical properties.
    4. NO numbers or stat indicators in the name or description.
    
    Return JSON array: [{ "index": number, "name": "string", "description": "string" }]`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const skins = JSON.parse(cleanJson(response.text || '[]'));

        return items.map((item, i) => {
            const skin = skins.find((s: any) => s.index === i);
            if (skin) {
                const updated = new Item({
                    ...item,
                    name: skin.name,
                    description: skin.description,
                    isNew: true
                });
                updated.details = (item.details ? item.details + '\n\n' : '') + buildMechanicalSummary(updated);
                return updated;
            }
            return item;
        });
    } catch (e) {
        console.error("Starting equipment skinning failed", e);
        return items;
    }
};

/**
 * Generates a unique thematic item for pickpocketing.
 * Skins the user's intent based on the NPC's profile and world context.
 */
export const generateStolenItem = async (intendedItem: string, npc: NPC, gameData: GameData): Promise<Partial<Item>> => {
    const worldContext = gameData.worldSummary || "Standard setting.";
    const npcContext = `${npc.name} (${npc.description || 'A local character'}). Status: ${npc.status}.`;

    const prompt = `You are an AI Item Architect. The player has successfully pickpocketed ${npc.name}.
    INTENDED ITEM: "${intendedItem}"
    NPC CONTEXT: ${npcContext}
    WORLD CONTEXT: ${worldContext}

    [INSTRUCTIONS]
    1. Skin the "INTENDED ITEM" based on who the NPC is. 
       - If they ask for "keys", what specific keys would THIS NPC have? (e.g., "Silver-Engraved Keyring").
       - If they ask for "money", what currency or valuables would they have? (e.g., "Silk Pouch of Emeralds").
       - If they ask for a weapon, what small hidden weapon might they carry?
    2. description: Evocative flavor text (Max 15 words).
    3. rarity: Choose a logical rarity (Common, Uncommon, or Rare).
    4. quantity: 1, unless it's currency, then provide a logical amount.
    5. Return a JSON object.

    Return JSON: { "name": "string", "description": "string", "rarity": "string", "quantity": number }`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        console.error("Stolen item generation failed", e);
        return { name: intendedItem, description: "A lifted item.", rarity: "Common", quantity: 1 };
    }
};
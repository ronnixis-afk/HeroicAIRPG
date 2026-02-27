
// services/worldService.ts

import { World, GameData, Item, PlayerCharacter, Companion, LoreEntry, StoreItem, ITEM_TAGS, LORE_TAGS, NPC, PlotPoint } from '../types';
import { getDefaultGameData, getNewGameData, getNewDndCharacter } from './mockSheetsService';
import { DEFAULT_TEMPLATES, DEFAULT_SIZE_MODIFIERS, DEFAULT_ARCHETYPE_DEFINITIONS, calculateBaseHeroicPoints } from '../utils/mechanics';
import { dbService } from './dbService';

// Map legacy tags to modern allowed enums
const ITEM_TAG_MAPPING: Record<string, string> = {
    'food': 'consumable', 'potion': 'consumable', 'scroll': 'consumable',
    'reagent': 'material', 'ingredient': 'material', 'loot': 'material',
    'treasure': 'currency', 'gold': 'currency',
    'mount': 'asset', 'ship': 'asset', 'property': 'asset',
    'key': 'note', 'book': 'note', 'letter': 'note',
    'weapon': 'Medium Weapon', 'armor': 'Medium Armor',
    'sword': 'Medium Weapon', 'axe': 'Medium Weapon', 'bow': 'Light Weapon',
    'helmet': 'Medium Armor', 'chestplate': 'Medium Armor', 'boots': 'Medium Armor'
};

const LORE_TAG_MAPPING: Record<string, string> = {
    'place': 'location', 'geography': 'location', 'city': 'location', 'town': 'location',
    'village': 'location', 'region': 'location', 'landmark': 'location', 'forest': 'location',
    'mountain': 'location', 'dungeon': 'location', 'map': 'location', 'kingdom': 'location',
    'capital': 'location', 'border': 'location',
    'beast': 'npc', 'enemy': 'npc', 'monster': 'npc', 'boss': 'npc',
    'species': 'race', 'ancestry': 'race', 'lineage': 'race',
    'group': 'faction', 'organization': 'faction', 'politics': 'faction',
    'guild': 'faction', 'cult': 'faction',
    'origin': 'history', 'timeline': 'history', 'past': 'history',
    'legend': 'history', 'myth': 'history', 'lore': 'history', 'general': 'history', 'event': 'history',
    'rumor': 'history', 'ancient': 'history', 'cataclysm': 'history',
    'technology': 'magic', 'science': 'magic', 'system': 'magic',
    'gods': 'magic', 'religion': 'magic', 'artifact': 'magic',
    'side_quest': 'quest', 'main': 'quest', 'objective': 'quest',
};

const migrateTags = (tags: any, type: 'item' | 'lore'): string[] => {
    if (!tags || !Array.isArray(tags)) return [];
    const mapping = type === 'item' ? ITEM_TAG_MAPPING : LORE_TAG_MAPPING;
    const allowed = (type === 'item' ? ITEM_TAGS : LORE_TAGS) as readonly string[];
    
    const newTags = new Set<string>();
    tags.forEach((t: any) => {
        if (typeof t !== 'string') return;
        const lower = t.toLowerCase();
        
        // Find match in allowed tags (case insensitive)
        const match = allowed.find(a => a.toLowerCase() === lower);
        if (match) {
            newTags.add(match);
        } else if (mapping[lower]) {
            newTags.add(mapping[lower]);
        } else if (lower.startsWith('damage:') || lower.startsWith('protection:')) {
            newTags.add(lower);
        }
    });
    return Array.from(newTags);
};

const slugify = (text: string) => {
    return text.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
};

export const deepMerge = (target: any, source: any): any => {
    if (source === undefined) return target;
    if (typeof target !== 'object' || target === null) return source;
    if (Array.isArray(target)) return Array.isArray(source) ? source : target;

    const result = { ...target };
    if (typeof source === 'object' && source !== null) {
        for (const key of Object.keys(source)) {
            if (key in target) {
                 result[key] = deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    return result;
};

/**
 * Sequential Normalization Pipeline.
 * Transforms data from potentially corrupt or legacy states into modern types.
 */
const hydrateWorldData = (savedGameData: any): GameData => {
    const freshState = getNewGameData();
    // Prioritize existing saved data over fresh state for all existing keys
    const mergedData = deepMerge(freshState, savedGameData);

    // 1. Mandatory Core Collections
    mergedData.npcs = Array.isArray(mergedData.npcs) ? mergedData.npcs : [];
    mergedData.plotPoints = Array.isArray(mergedData.plotPoints) ? mergedData.plotPoints : [];
    mergedData.mapZones = Array.isArray(mergedData.mapZones) ? mergedData.mapZones : [];
    mergedData.mapSectors = Array.isArray(mergedData.mapSectors) ? mergedData.mapSectors : [];
    mergedData.knowledge = Array.isArray(mergedData.knowledge) ? mergedData.knowledge : [];
    mergedData.objectives = Array.isArray(mergedData.objectives) ? mergedData.objectives : [];
    mergedData.story = Array.isArray(mergedData.story) ? mergedData.story : [];
    mergedData.gallery = Array.isArray(mergedData.gallery) ? mergedData.gallery : []; 
    mergedData.messages = Array.isArray(mergedData.messages) ? mergedData.messages : [];
    mergedData.nemeses = Array.isArray(mergedData.nemeses) ? mergedData.nemeses : [];

    // 2. Character Restoration
    if (mergedData.playerCharacter) {
        mergedData.playerCharacter.activeBuffs = mergedData.playerCharacter.activeBuffs || [];
        // Hydrate heroicPoints for legacy saves (fallback to base level calculation)
        mergedData.playerCharacter.heroicPoints = mergedData.playerCharacter.heroicPoints !== undefined ? Number(mergedData.playerCharacter.heroicPoints) : calculateBaseHeroicPoints(mergedData.playerCharacter.level || 1);
        mergedData.playerCharacter = new PlayerCharacter(mergedData.playerCharacter);
    } else {
        mergedData.playerCharacter = getNewDndCharacter();
    }

    if (Array.isArray(mergedData.companions)) {
        mergedData.companions = mergedData.companions.map((c: any) => new Companion({
            ...c,
            relationship: Number(c.relationship || 0),
            activeBuffs: c.activeBuffs || []
        }));
    } else {
        mergedData.companions = [];
    }

    // 3. NPC Registry Sanitization & Site ID Injection
    mergedData.npcs = mergedData.npcs.map((npc: any) => {
        // Backfill is_essential based on legacy number-in-name logic
        const isGeneric = /\s\d+$/.test(npc.name || '');
        const hydratedNpc = {
            ...npc,
            relationship: Number(npc.relationship || 0),
            status: npc.status || 'Alive',
            isNew: !!npc.isNew,
            is_essential: npc.is_essential !== undefined ? npc.is_essential : !isGeneric
        };
        
        // Legacy site_id fallback
        if (!hydratedNpc.site_id && hydratedNpc.currentPOI) {
            hydratedNpc.site_id = slugify(hydratedNpc.currentPOI);
        }
        
        return hydratedNpc;
    });

    // 4. Inventory Hydration & Tag Migration
    const hydrateItem = (item: any) => {
        const newItem = new Item(item);
        newItem.tags = migrateTags(newItem.tags, 'item');
        return newItem;
    };

    if (mergedData.playerInventory) {
        const inv = mergedData.playerInventory;
        inv.equipped = (inv.equipped || []).map(hydrateItem);
        inv.carried = (inv.carried || []).map(hydrateItem);
        inv.storage = (inv.storage || []).map(hydrateItem);
        inv.assets = (inv.assets || []).map(hydrateItem);
    }

    if (mergedData.companionInventories) {
        for (const compId in mergedData.companionInventories) {
            const inv = mergedData.companionInventories[compId];
            if (inv) {
                inv.equipped = (inv.equipped || []).map(hydrateItem);
                inv.carried = (inv.carried || []).map(hydrateItem);
                inv.storage = (inv.storage || []).map(hydrateItem);
                inv.assets = (inv.assets || []).map(hydrateItem);
            }
        }
    }

    // 5. Narrative & Lore Normalization
    const hydrateLore = (entry: any) => ({
        ...entry,
        tags: migrateTags(entry.tags, 'lore'),
        isNew: !!entry.isNew
    });

    mergedData.world = mergedData.world.map(hydrateLore);
    mergedData.knowledge = mergedData.knowledge.map(hydrateLore);
    
    mergedData.objectives = mergedData.objectives.map((obj: any) => {
        const hydratedObj = hydrateLore(obj);
        if (hydratedObj.updates && hydratedObj.updates.length > 0 && typeof (hydratedObj.updates as any)[0] === 'string') {
            const migratedUpdates = (hydratedObj.updates as unknown as string[]).map(content => ({
                content,
                timestamp: "Previously"
            }));
            hydratedObj.updates = migratedUpdates;
        }
        return hydratedObj;
    });

    // Story Logs Site ID Injection
    mergedData.story = mergedData.story.map((log: any) => {
        if (!log.site_id && (log.locale || log.location)) {
            log.site_id = slugify(log.locale || log.location);
        }
        return log;
    });
    
    mergedData.mapZones = mergedData.mapZones.map((zone: any) => ({
        ...zone,
        tags: migrateTags(zone.tags, 'lore'),
        visited: !!zone.visited,
        hostility: Number(zone.hostility || 0)
    }));

    // 6. System Defaults & Site Tracking
    if (typeof mergedData.gmNotes !== 'string') mergedData.gmNotes = "";
    if (typeof mergedData.grandDesign !== 'string') mergedData.grandDesign = "";
    if (!mergedData.narrationVoice) mergedData.narrationVoice = "Classic Narrator (Male)";
    if (!mergedData.templates) mergedData.templates = DEFAULT_TEMPLATES;
    if (!mergedData.sizeModifiers) mergedData.sizeModifiers = DEFAULT_SIZE_MODIFIERS;
    if (!mergedData.archetypes) mergedData.archetypes = DEFAULT_ARCHETYPE_DEFINITIONS;
    if (typeof mergedData.combatBaseScore !== 'number') mergedData.combatBaseScore = 8;
    if (!mergedData.skillConfiguration) mergedData.skillConfiguration = 'Fantasy';
    
    // NEW: Site Tracking Restoration
    if (!mergedData.current_site_id && mergedData.currentLocale) {
        mergedData.current_site_id = slugify(mergedData.currentLocale);
        mergedData.current_site_name = mergedData.currentLocale;
    }

    if (!mergedData.combatConfiguration) {
        mergedData.combatConfiguration = { 
            aiNarratesTurns: true, 
            manualCompanionControl: false, 
            aiGeneratesLoot: true,
            smarterGm: true,
            narrativeCombat: false,
            autoIncludeNearbyNpcs: true
        };
    }

    // 7. Heroic Point Capacity Reconciliation (FINAL STEP)
    // Ensures that loaded saves recalculate max points based on the new formula + current level/inventory/traits.
    if (mergedData.playerCharacter && mergedData.playerCharacter instanceof PlayerCharacter) {
        const pc = mergedData.playerCharacter as PlayerCharacter;
        pc.maxHeroicPoints = pc.getMaxHeroicPoints(mergedData.playerInventory);
        // Clamp existing points to new maximum to prevent over-inflated legacy pools
        pc.heroicPoints = Math.min(pc.heroicPoints, pc.maxHeroicPoints);
    }
    
    return mergedData as GameData;
};

const getAllWorlds = async (): Promise<World[]> => {
    const worlds = await dbService.getAll<World>();
    
    if (worlds.length === 0) {
        const defaultWorldData = getDefaultGameData();
        const hydratedDefaultData = hydrateWorldData(defaultWorldData);
        const defaultWorld: World = {
            id: `world-${Date.now()}`,
            name: "Whisperwood Adventure",
            gameData: hydratedDefaultData,
        };
        await dbService.put(defaultWorld);
        return [defaultWorld];
    }

    return worlds.map(w => ({ ...w, gameData: hydrateWorldData(w.gameData) }));
};

const getWorldById = async (worldId: string): Promise<World | undefined> => {
    const world = await dbService.get<World>(worldId);
    if (world) {
        return { ...world, gameData: hydrateWorldData(world.gameData) };
    }
    return undefined;
};

const saveWorld = async (updatedWorld: World): Promise<void> => {
    await dbService.put(updatedWorld);
};

const saveGameData = async (worldId: string, gameData: GameData): Promise<void> => {
    const world = await dbService.get<World>(worldId);
    if (world) {
        world.gameData = gameData;
        await dbService.put(world);
    }
};

const createNewWorld = async (name: string, loreEntries: Omit<LoreEntry, 'id'|'isNew'>[], startingDateTime: string, customGameData?: Partial<GameData>): Promise<World> => {
    const newGameData = getNewGameData();
    newGameData.world = loreEntries.map((lore, index) => ({
        ...lore,
        id: `lore-${Date.now()}-${index}`,
        isNew: false,
    }));
    newGameData.currentTime = startingDateTime;
    if (customGameData) Object.assign(newGameData, customGameData);
    const newWorld: World = { id: `world-${Date.now()}`, name, gameData: hydrateWorldData(newGameData) };
    await dbService.put(newWorld);
    return newWorld;
};

const deleteWorld = async (worldId: string): Promise<void> => {
    await dbService.delete(worldId);
};

const importWorldsFromJson = async (jsonString: string): Promise<World[]> => {
    let parsedData = JSON.parse(jsonString);
    if (!Array.isArray(parsedData)) {
        if (parsedData.id && parsedData.name && parsedData.gameData) parsedData = [parsedData];
        else throw new Error("Invalid single world file format.");
    }
    const importedWorlds: World[] = parsedData;
    if (importedWorlds.some(w => !w.id || !w.name || !w.gameData)) throw new Error("Invalid worlds file format.");

    const hydratedWorlds = importedWorlds.map(w => ({
        ...w,
        gameData: hydrateWorldData(w.gameData)
    }));

    await dbService.putAll(hydratedWorlds);
    return await getAllWorlds();
};

const exportWorldById = async (worldId: string) => {
    const world = await getWorldById(worldId);
    if (!world) return;
    const jsonString = JSON.stringify(world, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const formattedDateTime = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const sanitizedName = world.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${formattedDateTime}_${sanitizedName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const worldService = {
    getAllWorlds,
    getWorldById,
    saveWorld,
    saveGameData,
    createNewWorld,
    deleteWorld,
    importWorldsFromJson,
    exportWorldById,
};

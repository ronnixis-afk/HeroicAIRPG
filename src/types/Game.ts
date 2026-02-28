
// types/Game.ts

import { PlayerCharacter, Companion } from './Characters';
import { Inventory, Item, StoreItem, InventoryUpdatePayload } from './Items';
import { StoryLog, LoreEntry, GalleryEntry, GalleryMetadata, Nemesis, ChatMessage, PlotPoint, CombatState, MapZone, MapSector, MapSector as MapSectorType, MapSettings, Shop, NPC, ActorSuggestion, DiceRoll, DiceRollRequest, CombatActor, EnemyTemplate, AffinityDefinition, UsageStats, LocationUpdate, NPCResolution } from './World';
import { NarrationTone, NarrationVoice, ImageGenerationStyle, Difficulty, SkillConfiguration, BodySlot, CombatActorSize, StatusEffect, ArchetypeName, ActiveBuff } from './Core';

export interface CombatConfiguration {
  aiNarratesTurns: boolean;
  manualCompanionControl: boolean;
  aiGeneratesLoot: boolean;
  smarterGm: boolean;
  fasterGm: boolean;
  narrativeCombat: boolean;
  autoIncludeNearbyNpcs: boolean;
}

export interface GameData {
  playerCharacter: PlayerCharacter;
  companions: Companion[];
  npcs: NPC[];
  playerInventory: Inventory;
  companionInventories: Record<string, Inventory>;
  story: StoryLog[];
  gallery: GalleryMetadata[];
  world: LoreEntry[];
  knowledge: LoreEntry[];
  objectives: LoreEntry[];
  nemeses: Nemesis[];
  messages: ChatMessage[];
  gmSettings?: string;
  gmNotes?: string;
  grandDesign?: string;
  connectedNpcIds?: string[]; // NEW: Links NPCs mentioned in the Grand Design
  adventureBrief?: string; // NEW: 10-word concise direction
  plotPoints?: PlotPoint[];
  worldSummary?: string;
  currentTime: string;
  narrationVoice?: NarrationVoice;
  narrationTone: NarrationTone;
  imageGenerationStyle: ImageGenerationStyle;
  imageGenerationModel?: string;
  difficulty: Difficulty;
  combatConfiguration: CombatConfiguration;
  isMature: boolean;
  isHandsFree: boolean;
  useAiTts: boolean;
  combatState: CombatState | null;
  justFinishedCombat?: boolean;
  storesByLocation?: Record<string, Shop[]>;
  globalStoreInventory?: Record<string, StoreItem[]>;
  templates?: Record<string, EnemyTemplate>;
  affinities?: Record<string, AffinityDefinition>;
  sizeModifiers?: Record<CombatActorSize, { str: number, dex: number, con: number, ac: number }>;
  archetypes?: Record<ArchetypeName, { ground: number, climb: number, swim: number, fly: number }>;
  combatBaseScore?: number;
  playerCoordinates?: string;
  currentLocale?: string;
  current_site_id?: string; // NEW: Machine-readable spatial anchor
  current_site_name?: string; // NEW: Canonical site name
  current_site_detail?: string; // NEW: Narrative context of the immediate site
  mapZones?: MapZone[];
  mapSectors?: MapSector[];
  mapSettings?: MapSettings;
  skillConfiguration: SkillConfiguration;
  isPartyHidden?: boolean;
  partyStealthScore?: number;
}

export interface World {
  id: string;
  name: string;
  gameData: GameData;
}

export interface AIUpdatePayload {
  currentTime?: string;
  playerCharacter?: Partial<PlayerCharacter>;
  companions?: (Partial<Omit<Companion, 'id' | 'abilityScores' | 'savingThrows' | 'skills'>> & { id: string })[];
  inventory?: {
    equipped?: Partial<Item>[];
    carried?: Partial<Item>[];
    storage?: Partial<Item>[];
    assets?: Partial<Item>[];
  };
  inventoryUpdates?: InventoryUpdatePayload[];
  npcUpdates?: (Partial<NPC> & { id: string })[];
  world?: LoreEntry[];
  knowledge?: LoreEntry[];
  objectives?: (Partial<LoreEntry> & { progressUpdate?: string })[];
  combatState?: Partial<CombatState>;
  gmNotes?: string;
  grandDesign?: string;
  adventureBrief?: string; // NEW: Consequence extraction field
  playerCoordinates?: string;
  currentLocale?: string;
  current_site_id?: string;
  current_site_name?: string;
  current_site_detail?: string; // NEW: Narrative context of the immediate site
  mapZones?: Partial<MapZone>[];
  location_update?: LocationUpdate; // NEW: Structured spatial snapping data
  npc_resolution?: NPCResolution[]; // NEW: Structured social resolution data
}

export interface AIResponse {
  location_update: LocationUpdate;
  npc_resolution: NPCResolution[];
  narration: string;
  turnSummary: string;
  adventure_brief: string;
  // Metadata for internal plumbing
  usage?: UsageStats;
  updates?: AIUpdatePayload;
  suggestedActors?: ActorSuggestion[];
  alignmentOptions?: { label: string; alignment: 'Good' | 'Evil' | 'Lawful' | 'Chaotic' }[];
  active_engagement?: boolean; // NEW: Specifically flags if the party is being attacked or attacking
}

export type GameAction =
  | { type: 'UPDATE_PLAYER'; payload: PlayerCharacter }
  | { type: 'UPDATE_COMPANION'; payload: Companion }
  | { type: 'ADD_COMPANION'; payload: { companion: Companion; inventory: Inventory } }
  | { type: 'DELETE_COMPANION'; payload: string }
  | { type: 'AWARD_XP'; payload: { amount: number; source: string } }
  | { type: 'UPDATE_ITEM'; payload: { item: Item; ownerId: string } }
  | { type: 'MARK_ITEM_SEEN'; payload: { itemId: string; ownerId: string } }
  | { type: 'DROP_ITEM'; payload: { itemId: string; list: keyof Inventory; ownerId: string; quantity: number } }
  | { type: 'SPLIT_ITEM'; payload: { itemId: string; list: keyof Inventory; ownerId: string; splitQuantity: number } }
  | { type: 'MOVE_ITEM'; payload: { itemId: string; fromList: keyof Inventory; toList: keyof Inventory; ownerId: string } }
  | { type: 'EQUIP_ITEM'; payload: { itemId: string; slot: BodySlot; ownerId: string } }
  | { type: 'UNEQUIP_ITEM'; payload: { itemId: string; ownerId: string } }
  | { type: 'TRANSFER_ITEM'; payload: { itemId: string; fromOwnerId: string; fromList: keyof Inventory; toOwnerId: string } }
  | { type: 'USE_ITEM'; payload: { itemId: string; list: keyof Inventory; ownerId: string } }
  | { type: 'ADD_ACTIVE_BUFF'; payload: { ownerId: string; buffs: ActiveBuff[] } }
  | { type: 'USE_ABILITY'; payload: { abilityId: string; ownerId: string } }
  | { type: 'CONSOLIDATE_CURRENCY'; payload: { itemId: string; ownerId: string } }
  | { type: 'ADD_STORE_INVENTORY'; payload: { category: string; items: StoreItem[] } }
  | { type: 'BUY_ITEM'; payload: { item: StoreItem; quantity: number } }
  | { type: 'SELL_ITEM'; payload: { item: Item; sellPrice: number; quantity: number } }
  | { type: 'UPDATE_ITEM_PRICES'; payload: { id: string; price: number }[] }
  | { type: 'TAKE_LOOT'; payload: Item[] }
  | { type: 'START_COMBAT' }
  | { type: 'ADD_COMBAT_ENEMY'; payload: CombatActor }
  | { type: 'UPDATE_COMBAT_ENEMY'; payload: CombatActor }
  | { type: 'DELETE_COMBAT_ENEMY'; payload: string }
  | { type: 'DUPLICATE_COMBAT_ENEMY'; payload: string }
  | { type: 'SYNC_SCENE_ACTORS'; payload: { newActors: CombatActor[], removeStaleIds: string[] } }
  | { type: 'ADD_TO_TURN_ORDER'; payload: string }
  | { type: 'REMOVE_FROM_TURN_ORDER'; payload: string }
  | { type: 'MOVE_TURN_ORDER_ITEM'; payload: { id: string; direction: 'up' | 'down' } }
  | { type: 'ADVANCE_TURN' }
  | { type: 'END_COMBAT'; payload: { lootItems: Item[] } }
  | { type: 'CLEAR_SCENE' }
  | { type: 'UPDATE_TEMPLATE'; payload: { key: string; template: EnemyTemplate } }
  | { type: 'UPDATE_SIZE_MODIFIER'; payload: { size: CombatActorSize; mods: { str: number; dex: number, con: number, ac: number } } }
  | { type: 'UPDATE_BASE_SCORE'; payload: number }
  | { type: 'UPDATE_AFFINITY'; payload: { key: string; affinity: AffinityDefinition } }
  | { type: 'UPDATE_ARCHETYPE'; payload: { name: ArchetypeName; speeds: { ground: number, climb: number, swim: number, fly: number } } }
  | { type: 'APPLY_HP_UPDATES'; payload: Record<string, number> }
  | { type: 'APPLY_STATUS_UPDATES'; payload: Record<string, StatusEffect[]> }
  | { type: 'UPDATE_MAP_ZONE'; payload: MapZone }
  | { type: 'MOVE_PLAYER_ON_MAP'; payload: string }
  | { type: 'UPDATE_MAP_SETTINGS'; payload: MapSettings }
  | { type: 'ADD_SECTOR'; payload: MapSectorType }
  | { type: 'UPDATE_SECTOR'; payload: MapSectorType }
  | { type: 'DELETE_SECTOR'; payload: string }
  | { type: 'MARK_ALL_MAP_ZONES_SEEN' }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]) }
  | { type: 'ADD_STORY_LOG'; payload: StoryLog }
  | { type: 'DELETE_STORY_LOG'; payload: string }
  | { type: 'REMOVE_STORY_LOGS_BY_MESSAGE'; payload: string[] }
  | { type: 'COMPRESS_DAY_LOGS'; payload: { removeIds: string[]; newLog: StoryLog } }
  | { type: 'UPDATE_STORY_LOG'; payload: StoryLog }
  | { type: 'MARK_ALL_STORY_SEEN' }
  | { type: 'UPDATE_LORE'; payload: LoreEntry }
  | { type: 'ADD_LORE'; payload: Omit<LoreEntry, 'id'>[] }
  | { type: 'DELETE_LORE'; payload: string }
  | { type: 'MARK_LORE_SEEN'; payload: string }
  | { type: 'UPDATE_KNOWLEDGE'; payload: LoreEntry }
  | { type: 'ADD_KNOWLEDGE'; payload: Omit<LoreEntry, 'id'>[] }
  | { type: 'DELETE_KNOWLEDGE'; payload: string }
  | { type: 'MARK_KNOWLEDGE_SEEN'; payload: string }
  | { type: 'UPDATE_OBJECTIVE'; payload: LoreEntry }
  | { type: 'DELETE_OBJECTIVE'; payload: string }
  | { type: 'MARK_OBJECTIVE_SEEN'; payload: string }
  | { type: 'TRACK_OBJECTIVE'; payload: string | null }
  | { type: 'UPDATE_GM_NOTES'; payload: string }
  | { type: 'UPDATE_GRAND_DESIGN'; payload: { design: string, connectedNpcIds: string[] } }
  | { type: 'UPDATE_WORLD_SUMMARY'; payload: string }
  | { type: 'ADD_PLOT_POINT'; payload: PlotPoint }
  | { type: 'UPDATE_PLOT_POINT'; payload: PlotPoint }
  | { type: 'DELETE_PLOT_POINT'; payload: string }
  | { type: 'MARK_ALL_PLOT_POINTS_SEEN' }
  | { type: 'ADD_NEMESIS'; payload: Nemesis }
  | { type: 'UPDATE_NEMESIS'; payload: Nemesis }
  | { type: 'DELETE_NEMESIS'; payload: string }
  | { type: 'MARK_NEMESIS_SEEN'; payload: string }
  | { type: 'UPDATE_ALL_NEMESES'; payload: Nemesis[] }
  | { type: 'ADD_NPC'; payload: NPC }
  | { type: 'UPDATE_NPC'; payload: NPC }
  | { type: 'DELETE_NPC'; payload: string }
  | { type: 'MARK_ALL_NPCS_SEEN' }
  | { type: 'ADD_GALLERY_ENTRY'; payload: GalleryEntry }
  | { type: 'DELETE_GALLERY_ENTRY'; payload: string }
  | { type: 'SET_GAME_DATA'; payload: GameData }
  | { type: 'UPDATE_GM_SETTINGS'; payload: string }
  | { type: 'AI_UPDATE'; payload: AIUpdatePayload }
  | { type: 'SET_NARRATION_VOICE'; payload: NarrationVoice }
  | { type: 'SET_NARRATION_TONE'; payload: NarrationTone }
  | { type: 'SET_IMAGE_STYLE'; payload: ImageGenerationStyle }
  | { type: 'SET_IMAGE_MODEL'; payload: string }
  | { type: 'SET_IS_MATURE'; payload: boolean }
  | { type: 'SET_HANDS_FREE'; payload: boolean }
  | { type: 'SET_USE_AI_TTS'; payload: boolean }
  | { type: 'SET_DIFFICULTY'; payload: Difficulty }
  | { type: 'UPDATE_CURRENT_TIME'; payload: string }
  | { type: 'REST'; payload: { type: 'short' | 'long', newTime: string, playerHeal: number, companionHeals: Record<string, number> } }
  | { type: 'WAIT'; payload: { newTime: string } }
  | { type: 'SET_SKILL_CONFIGURATION'; payload: SkillConfiguration }
  | { type: 'RESET_WORLD' }
  | { type: 'RESTART_ADVENTURE' }
  | { type: 'COMPLETE_RESTART'; payload: Partial<GameData> }
  | { type: 'UPDATE_COMBAT_CONFIGURATION'; payload: CombatConfiguration }
  | { type: 'SET_PARTY_HIDDEN'; payload: { isHidden: boolean, score?: number } }
  | { type: 'USE_HEROIC_POINT' };

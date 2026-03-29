
// types/World.ts

import { AbilityScoreName, AbilityEffect, StatusEffect, RollMode, CombatActorSize, ArchetypeName, SkillName, ActiveBuff } from './Core';
import { Ability } from './Characters';

// Fix: Added LocationUpdate interface to support structured AI spatial transition responses
export interface LocationUpdate {
  coordinates: string;
  zone: string;
  site_name: string;
  site_id: string;
  is_new_site: boolean;
  transition_type?: 'staying' | 'returning' | 'exploring_new' | 'zone_change';
  destination_zone_hint?: string;
  is_aboard_ship?: boolean;
  ship_name?: string;
}

/**
 * Flags indicating which extraction steps are required based on narrative analysis.
 * Part of Phase 4/Step 0 optimization.
 */
export interface ExtractionScopeFlags {
  spatialChange: boolean;    // Location discovery, zone transitions, or physical movement
  socialChange: boolean;     // New NPCs, NPC deaths, or status updates
  itemChange: boolean;       // Picking up or losing items
  alignmentChange: boolean;  // Actions with moral or ethical weight
  engagementChange: boolean; // Transitions into or out of combat
  timeChange: boolean;       // Significant passage of time
}

export interface ExtractionScope {
  required: boolean;         // True if ANY flag is true
  flags: ExtractionScopeFlags;
}

// Fix: Added NPCResolution interface to support structured AI social status updates
export interface NPCResolution {
  name: string;
  action: string; // e.g., "existing", "new", "leaves"
  summary: string;
  isFollowing?: boolean;
}

export interface ObjectiveUpdate {
  timestamp: string;
  content: string;
}

// Fix: Added NPCMemory interface to support persistent social state
export interface NPCMemory {
  timestamp: string;
  content: string;
  embedding?: number[]; // Semantic Retrieval Vector
}

// POI Memory: Tracks events that occur at a specific Point of Interest
export interface POIMemory {
  timestamp: string;
  content: string;
  embedding?: number[]; // Semantic Retrieval Vector
}

export type ActorAlignment = 'ally' | 'neutral' | 'enemy';

export interface LoreEntry {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  keywords?: string[];
  isNew?: boolean;
  status?: 'active' | 'completed' | 'failed';
  updates?: ObjectiveUpdate[];
  isTracked?: boolean;
  coordinates?: string;
  visited?: boolean;

  // Journal System Additions
  nextStep?: string; // The "Compass": What the player should do RIGHT NOW
  milestones?: string[]; // The "Journal": Chronological list of major accomplishments

  // AI Architecture
  embedding?: number[]; // Semantic Retrieval Vector

  // POI Memory System: Tracks events that happened at this location
  memories?: POIMemory[];

  // Racial Trait: Ability score bonus trait for races
  racialTrait?: Ability;
  
  // Naming/Language technique for generated races
  languageConfig?: string;
}

export interface GalleryEntry {
  id: string;
  worldId: string; // NEW: Link to specific adventure
  imageUrl: string;
  description: string;
  timestamp: string; // In-game time
  realTimestamp: number; // Real world time for sorting
}

/**
 * Metadata version of a gallery entry used to maintain a lightweight state.
 * Binary image data (imageUrl) is fetched on demand.
 */
export type GalleryMetadata = Omit<GalleryEntry, 'imageUrl'>;

export interface StoryLog {
  id: string;
  timestamp: string;
  location: string;
  content: string;
  summary?: string;
  originatingMessageId?: string;
  isNew?: boolean;
  embedding?: number[]; // Semantic Retrieval Vector
}

export interface NPC {
  id: string;
  name: string;
  description?: string;
  relationship: number; // -50 to 50
  status: string; // 'Alive', 'Dead', 'Unknown'
  deathTimestamp?: string; // In-game time of death
  isBodyCleared?: boolean; // True if the corpse was removed
  location?: string; // The Zone name
  currentPOI?: string; // The specific site/locale name
  // Fix: Added site_id to NPC interface to support machine-readable spatial anchoring
  site_id?: string;
  gender?: string;
  race?: string;
  appearance?: string;
  companionId?: string; // Link to companion if applicable
  image?: string; // Optional avatar
  isNew?: boolean; // Notification flag
  isShip?: boolean; // NEW: Explicitly identify non-sentient vehicles in registry
  isMount?: boolean; // NEW: Explicitly identify companions who can be used as mounts
  // Fix: Added isSentient to NPC interface to support tracked vehicles/entities.
  isSentient?: boolean; // NEW: Track if the vehicle/entity can talk
  is_essential?: boolean; // NEW: Determines if the NPC appears in the social ledger
  // Combat Actor Data
  currentHitPoints?: number;
  maxHitPoints?: number;
  temporaryHitPoints?: number;
  maxTemporaryHitPoints?: number;
  rank?: 'normal' | 'elite' | 'boss';
  size?: CombatActorSize;
  template?: string; // e.g. "Brute", "Sniper"
  difficulty?: string; // NEW: Replaces separate CR/Rank in suggestions
  cr?: string; // Keep for legacy
  challengeRating?: number;
  affinity?: string; // e.g. "Thermal", "None"
  archetype?: ArchetypeName | string;
  moralAlignment?: { lawChaos: number; goodEvil: number };
  // Fix: Added alignment to NPC to support social stance resolution
  alignment?: ActorAlignment;
  // Fix: Added memories to NPC registry for narrative continuity
  memories?: NPCMemory[];
  // Fix: Added statusEffects to NPC to support untargetable logic (e.g. Invisible/Hidden)
  statusEffects?: StatusEffect[];
  activeBuffs?: ActiveBuff[];
  isFollowing?: boolean;
}

export interface DiceRoll {
  rollerName: string;
  rollType: 'Skill Check' | 'Saving Throw' | 'Attack Roll' | 'Damage Roll' | 'Ability Check' | 'Encounter Check' | 'Healing Roll';
  checkName: string;
  abilityName?: string; // Added for narrative context
  sourceName?: string;  // Added for narrative context (the original caster/attacker)
  dieRoll: number;
  diceString?: string;
  bonus: number;
  total: number;
  dc?: number;
  outcome?: 'Success' | 'Fail' | 'Critical Success' | 'Critical Fail' | 'Hit' | 'Miss' | 'Critical Hit' | 'No Encounter' | 'Non-Combat Encounter' | 'Combat Encounter' | 'Boss Encounter' | 'Encounter';
  targetName?: string;
  hpChange?: {
    previousHp: number;
    newHp: number;
  };
  mode?: RollMode;
  rollReason?: string; // Reason for the mode (e.g. "Target Prone")
  rolls?: number[];
  dropped?: number;
  notes?: string;
  isHeroic?: boolean; // NEW: Flag for visual styling of heroic actions
}

export interface UsageStats {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs?: number;
}

export interface AlignmentOption {
  label: string;
  alignment: 'Good' | 'Evil' | 'Lawful' | 'Chaotic';
}

export interface DialogueLine {
  actorName: string;
  content: string;
  isAlignmentReaction?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  mode?: 'CHAR' | 'OOC';
  content: string;
  imagePrompt?: string;
  type?: 'positive' | 'negative' | 'neutral';
  options?: string[];
  alignmentOptions?: AlignmentOption[];
  explicitAlignment?: string; // NEW: Tells the pipeline that alignment was already handled
  location?: string;
  timestamp?: string;
  rolls?: DiceRoll[];
  usage?: UsageStats;
  combatInfo?: {
    attackerName: string;
    nextCombatantName: string;
  };
  dialogues?: DialogueLine[]; // Structured dialogue lines for consistent formatting
}

export interface DiceRollRequest {
  rollerName: string;
  rollType: 'Attack Roll' | 'Ability Check' | 'Saving Throw' | 'Skill Check' | 'Healing Roll';
  checkName: string;
  targetName?: string;
  dc?: number;
  abilityName?: string;
  sourceName?: string;
  mode?: RollMode;
  isHeroic?: boolean; // NEW: Input flag for heroic actions
}

export interface CombatActorAttack {
  name: string;
  toHitBonus: number;
  damageDice: string;
  damageType: string;
  ability?: AbilityScoreName;
}

export interface CombatActorSpecialAbility extends AbilityEffect {
  name: string;
  description: string;
}

export interface CombatActor {
  id: string;
  name: string;
  description: string;
  armorClass?: number;
  maxHitPoints?: number;
  currentHitPoints?: number;
  // Fix: Added temporaryHitPoints and maxTemporaryHitPoints to CombatActor interface
  temporaryHitPoints?: number;
  maxTemporaryHitPoints?: number;
  attacks?: CombatActorAttack[];
  numberOfAttacks?: number;
  challengeRating?: number;
  abilityScores?: Record<AbilityScoreName, { score: number }>;
  savingThrows?: Record<AbilityScoreName, { proficient: boolean }>;
  skills?: Record<SkillName, { proficient: boolean; passiveScore: number }>;
  specialAbilities?: CombatActorSpecialAbility[];
  statusEffects: StatusEffect[];
  activeBuffs?: ActiveBuff[];
  rank?: 'normal' | 'elite' | 'boss';
  size?: CombatActorSize;
  isAlly?: boolean;
  isShip?: boolean;
  isMount?: boolean;
  // Fix: Added isSentient to CombatActor interface to resolve access errors in context services
  isSentient?: boolean;
  alignment?: ActorAlignment; // NEW: Combat alignment
  resistances?: string[];
  immunities?: string[];
  vulnerabilities?: string[];
  affinity?: string;
  template?: string;
  archetype?: ArchetypeName | string;
  speed?: number;
  climbSpeed?: number;
  swimSpeed?: number;
  flySpeed?: number;
}

export interface CombatState {
  isActive: boolean;
  enemies: CombatActor[];
  round: number;
  turnOrder: string[];
  currentTurnIndex: number;
}

export interface LootState {
  isOpen: boolean;
  isLoading: boolean;
  items: any[]; // Avoid circular dependency with Item class here if possible, or use 'any' for loose coupling in state
  defeatedEnemies: CombatActor[];
}



export interface EnemyTemplate {
  name: string;
  attackType: string;
  mods: number[];
  saves: AbilityScoreName[];
  proficientSkills: SkillName[];
  /* Fix: Replaced 'effect' with 'status' to align with AbilityEffect type and fix Object Literal errors in mechanics templates */
  abilities: {
    target: 'Single' | 'Multiple';
    type: 'Damage' | 'Status' | 'Heal';
    status?: string;
    save?: AbilityScoreName;
    saveEffect?: 'half' | 'negate';
  }[];
  defaultArchetype?: ArchetypeName;
}

export interface AffinityDefinition {
  name: string;
  description: string;
  immunities: string[];
  resistances: string[];
  vulnerabilities: string[];
}

export type PlotPointType = 'Choice' | 'Background' | 'Milestone' | 'Secret' | 'World' | 'Objective' | 'Achievement';

export interface PlotPoint {
  id: string;
  content: string;
  type: PlotPointType;
  isNew: boolean;
}

export interface MapZone {
  id: string;
  coordinates: string;
  name: string;
  hostility: number;
  description?: string;
  visited?: boolean;
  isNew?: boolean; // Notification flag
  isLoading?: boolean; // NEW: Indicates background generation
  tags?: string[];
  keywords?: string[];
  populationLevel?: 'Barren' | 'Settlement' | 'Town' | 'City' | 'Capital';
  zoneFeatures?: string[];
  isMajorHub?: boolean; // New: Explicitly identifies Faction Seats of Power
}


export interface MapSettings {
  style: string;
  gridUnit: string;
  gridDistance: number;
  zoneLabel: string;
}

export interface MapGenerationProgress {
  isActive: boolean;
  step: string;
  progress: number;
}

export interface Shop {
  name: string;
  type: string;
  greeting: string;
  inventory?: any[]; // StoreItems
}

export interface ActorSuggestion {
  id?: string; // Standardize with ID support for deterministic resolution
  name: string;
  template: string;
  size: CombatActorSize;
  difficulty: 'Weak' | 'Normal' | 'Elite' | 'Boss' | string;
  description?: string;
  isAlly: boolean;
  alignment?: ActorAlignment; // NEW: Combat alignment
  isShip?: boolean;
  affinity?: string;
  archetype?: ArchetypeName;
}

export interface Race {
  name: string;
  description: string;
  appearance: string;
  qualities: string;
  faction?: string;
  keywords?: string[];
  racialTrait?: Ability;
  languageConfig?: string;
}

export interface Faction {
  name: string;
  goals: string;
  relationships: string;
  racialComposition?: string;
  keywords?: string[];
}

export interface WorldPreview {
  context: string;
  races: Race[];
  factions: Faction[];
}

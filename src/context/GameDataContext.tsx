// context/GameDataContext.tsx

import React, { createContext, ReactNode, useContext } from 'react';
// FIX: Imported GroupCheckResult for process DiceRolls return type definition
import { GroupCheckResult } from '../utils/diceRolls';
import type { GameData, PlayerCharacter, StoryLog, LoreEntry, GalleryEntry, GalleryMetadata, ChatMessage, AIUpdatePayload, Item, Companion, NarrationTone, Inventory, NarrationVoice, ImageGenerationStyle, StoreItem, CombatActor, Difficulty, Nemesis, EnemyTemplate, CombatActorSize, Ability, PlotPoint, MapZone, MapSettings, MapSector, ActorSuggestion, AffinityDefinition, RollMode, BodySlot, SkillConfiguration, NPC, ArchetypeName, CombatConfiguration, StatusEffect, DiceRoll, DiceRollRequest, GameAction } from '../types';
import { useGameData } from '../hooks/useGameData';
// FIX: Imported CombatTriggerSource for initiateCombatSequence signature
import { useUI, CombatTriggerSource } from './UIContext';

// Fix: Exported GameDataContextType to resolve interface visibility issues in consumer components (like PlayerAttackModal)
export interface GameDataContextType {
  gameData: GameData | null;
  gallery: GalleryMetadata[];
  worldId: string;
  worldName: string;
  storageUsage: { used: number; limit: number; };

  // Actions
  updatePlayerCharacter: (character: PlayerCharacter) => Promise<void>;
  updateCompanion: (companion: Companion) => Promise<void>;
  useHeroicPoint: () => void;
  addCompanion: () => string; // Returns new companion's ID
  deleteCompanion: (companionId: string) => void;
  updateStoryLog: (log: StoryLog) => Promise<void>;
  updateWorldLore: (lore: LoreEntry) => Promise<void>;
  updateKnowledge: (knowledge: LoreEntry) => Promise<void>;
  updateObjective: (objective: LoreEntry) => Promise<void>;
  updateGmSettings: (settings: string) => Promise<void>;
  updateGmNotes: (notes: string) => Promise<void>;
  updateWorldSummary: (summary: string) => void;
  regenerateGmNotes: () => Promise<void>;
  updateItem: (item: Item, ownerId: string) => Promise<void>;
  setMessages: (updater: (prevMessages: ChatMessage[]) => ChatMessage[]) => void;
  submitUserMessage: (message: ChatMessage, isHeroic?: boolean) => Promise<void>;
  processUserInitiatedCombat: (userContent: string) => Promise<void>;
  processUserInitiatedTravel: (userContent: string) => Promise<void>;
  applyAiUpdates: (updates: AIUpdatePayload, aiMessage?: ChatMessage) => Promise<void>;
  dropItem: (itemId: string, list: keyof Inventory, ownerId: string, quantity: number) => Promise<void>;
  // FIX: Added splitItem to context interface
  splitItem: (itemId: string, list: keyof Inventory, ownerId: string, splitQuantity: number) => Promise<void>;
  moveItem: (itemId: string, fromList: keyof Inventory, toList: keyof Inventory, ownerId: string) => void;
  transferItem: (itemId: string, fromOwnerId: string, fromList: keyof Inventory, toOwnerId: string) => void;
  equipItem: (itemId: string, slot: BodySlot, ownerId: string) => void;
  unequipItem: (itemId: string, ownerId: string) => void;
  useItem: (itemId: string, list: keyof Inventory, ownerId: string) => Promise<void>;
  consolidateCurrency: (itemIdToConsolidate: string, ownerId: string) => void;
  switchWorld: () => void;
  removeStoryLogsByMessageIds: (messageIds: string[]) => void;
  deleteStoryLog: (id: string) => void;
  resetWorld: () => void;
  restartAdventure: () => void;
  deleteWorldLore: (loreId: string) => void;
  deleteKnowledge: (knowledgeId: string) => void;
  deleteObjective: (objectiveId: string) => void;
  addWorldLore: (newLores: Omit<LoreEntry, 'id'>[]) => void;
  markInventoryItemAsSeen: (itemId: string, ownerId: string) => void;
  markStoryLogAsSeen: (logId: string) => void;
  markLoreAsSeen: (loreId: string) => void;
  markKnowledgeAsSeen: (knowledgeId: string) => void;
  markObjectiveAsSeen: (objectiveId: string) => void;
  markNemesisAsSeen: (nemesisId: string) => void;
  markAllStoryLogsAsSeen: () => void;
  markAllNpcsAsSeen: () => void;
  markAllPlotPointsAsSeen: () => void;
  markAllMapZonesAsSeen: () => void;
  updateNarrationVoice: (voiceName: NarrationVoice) => void;
  updateNarrationTone: (tone: NarrationTone) => void;
  updateImageGenerationStyle: (style: ImageGenerationStyle) => void;
  updateIsMature: (isMature: boolean) => void;
  updateIsHandsFree: (isHandsFree: boolean) => void;
  updateUseAiTts: (useAiTts: boolean) => void;
  updateCurrentTime: (time: string) => void;
  updateDifficulty: (difficulty: Difficulty) => void;
  updateSkillConfiguration: (config: SkillConfiguration) => void;
  updateCombatConfiguration: (config: CombatConfiguration) => void;
  summarizeDayLog: (day: string, dayEntries: StoryLog[], previousDayEntries: StoryLog[]) => Promise<void>;
  summarizePastStoryLogs: () => Promise<void>;
  saveWorldProgress: () => Promise<void>;
  fetchStoreCategory: (category: string, scale?: string, forceRefresh?: boolean) => Promise<void>;
  buyItem: (item: StoreItem, quantity: number) => Promise<void>;
  sellItem: (item: Item, sellPrice: number, quantity: number) => Promise<void>;
  initiateRest: (type: 'short' | 'long') => void;
  initiateWait: (hours: number) => void;
  initiateTravel: (destination: string, method: string, targetCoordinates?: string) => void;
  priceUnpricedItems: () => Promise<void>;
  identifyAndAppraiseItems: () => Promise<number>;
  generateObjectiveFollowUp: (objectiveId: string) => Promise<void>;
  attemptObjectiveTurnIn: (objectiveId: string) => Promise<void>;
  trackObjective: (objectiveId: string | null) => Promise<void>;
  // Updated addCombat Enemy signature to include the optional currentPOI parameter
  addCombatEnemy: (enemyData: Partial<CombatActor>, currentPOI?: string) => void;
  duplicateCombatEnemy: (enemyId: string) => void;
  updateCombatEnemy: (enemy: CombatActor) => void;
  deleteCombatEnemy: (enemyId: string) => void;
  startCombat: () => void;
  // FIX: Updated initiateCombatSequence signature to match implementation using CombatTriggerSource
  initiateCombatSequence: (narrative: string, suggestions: ActorSuggestion[], source?: CombatTriggerSource) => Promise<void>;
  // FIX: Added missing executeInitiationPipeline to interface
  executeInitiationPipeline: (narrative: string, suggestions: ActorSuggestion[]) => Promise<void>;
  addToTurnOrder: (actorId: string) => void;
  removeFromTurnOrder: (actorId: string) => void;
  moveInTurnOrder: (actorId: string, direction: 'up' | 'down') => void;
  concludeCombat: () => void;
  clearScene: () => void;
  removeActorFromTurnOrder: (actorId: string) => void;
  takeAllLoot: (items: Item[], defeatedNames?: string[], defeatedIds?: string[]) => void;
  generateAndAddNemesis: (prompt: string) => Promise<void>;
  deleteNemesis: (nemesisId: string) => void;
  updateNemesis: (nemesis: Nemesis) => Promise<void>;
  playNpcTurn: (actorId: string) => Promise<void>;
  performPlayerAttack: (source: Item | Ability, targetIds: string[], flavorText?: string, mode?: RollMode, sourceActorId?: string) => Promise<void>;
  performAutomatedPlayerTurn: () => Promise<void>;
  // FIX: Added processDiceRolls update with options parameter to satisfy Phase 3 requirements
  processDiceRolls: (requests: DiceRollRequest[], options?: { suppressLoot?: boolean, isHeroic?: boolean }) => {
    rolls: DiceRoll[],
    summary: string,
    groupOutcomes: GroupCheckResult[],
    victoryData?: any,
    statusUpdates?: Record<string, StatusEffect[]>
  };
  addEnemyFromTemplate: (templateName: string, cr: number, rank: 'normal' | 'elite' | 'boss', size: CombatActorSize, nameOverride?: string) => void;
  updateTemplate: (key: string, template: EnemyTemplate) => void;
  updateAffinity: (key: string, affinity: AffinityDefinition) => void;
  updateSizeModifier: (size: CombatActorSize, mods: { str: number, dex: number, con: number, ac: number }) => void;
  updateBaseScore: (score: number) => void;
  updateBaseScoreAction: (score: number) => void; // redundant alias
  updateArchetype: (name: ArchetypeName, speeds: { ground: number, climb: number, swim: number, fly: number }) => void;
  addPlotPoint: (point: PlotPoint) => void;
  deletePlotPoint: (id: string) => void;
  updatePlotPoint: (point: PlotPoint) => void;
  weaveNarrative: () => Promise<void>;
  integrateRefinedCharacter: (character: PlayerCharacter) => Promise<void>;
  integrateCharacter: (character: PlayerCharacter | Companion, isCompanion?: boolean) => Promise<void>;
  updateMapZone: (zone: MapZone) => void;
  movePlayerOnMap: (coordinates: string) => void;
  updateMapSettings: (settings: MapSettings) => void;
  generateAndAddSector: () => Promise<void>;
  updateSector: (sector: MapSector) => void;
  deleteSector: (id: string) => void;
  generateMapFromLore: () => Promise<void>;
  generateMapFromLoreAction: () => Promise<void>;
  fetchActionSuggestions: () => Promise<string[]>;
  investigateDiscovery: (entry: LoreEntry, locationName: string) => Promise<void>;
  addNPC: (npc: NPC) => void;
  updateNPC: (npc: NPC) => void;
  deleteNPC: (id: string) => void;
  refineNPC: (npc: NPC) => Promise<void>;
  /* Fix: Added performPickpocket to GameDataContextType to resolve compilation error in PickpocketModal */
  performPickpocket: (npc: NPC, intendedItem: string) => Promise<void>;
  lazyLoadPois: (zone: MapZone) => Promise<void>;
  // FIX: Added missing syncCurrentLocaleToPoi to the context interface
  syncCurrentLocaleToPoi: (zone: MapZone, localeName: string) => Promise<void>;
  // Gallery Actions
  addGalleryEntry: (entry: Omit<GalleryEntry, 'worldId'>) => Promise<void>;
  deleteGalleryEntry: (id: string) => Promise<void>;
  // Exposed logic
  weaveGrandDesign: () => Promise<void>;
  generateBriefFromContext: () => Promise<void>;
  inviteNpcToParty: (npc: NPC) => Promise<void>;
  // Fix: Added missing dispatch to GameDataContextType to resolve context usage errors in components
  dispatch: React.Dispatch<GameAction>;
}

// Create with default null to enforce Provider usage
export const GameDataContext = createContext<GameDataContextType>({} as GameDataContextType);

interface GameDataProviderProps {
  children?: ReactNode;
  worldId: string;
  onSwitchWorld: () => void;
}

export const GameDataProvider = ({ children, worldId, onSwitchWorld }: GameDataProviderProps) => {
  const ui = useUI();
  const gameDataState = useGameData(worldId, ui);

  // Fix: Explicitly return the contextValue as GameDataContextType to ensure all actions are exposed correctly
  const contextValue: GameDataContextType = {
    ...gameDataState,
    worldId,
    switchWorld: onSwitchWorld,
  };

  return (
    <GameDataContext.Provider value={contextValue}>
      {children}
    </GameDataContext.Provider>
  );
};

// services/mockSheetsService.ts

// FIX: Imported PlayerCharacter and Item to use their constructors.
import { GameData, NarrationTone, ImageGenerationStyle, SKILL_NAMES, SkillName, PlayerCharacter, Item, Difficulty } from '../types';
import { DEFAULT_TEMPLATES, DEFAULT_SIZE_MODIFIERS, DEFAULT_AFFINITIES, getHalfwayXP } from '../utils/mechanics';

const createDefaultSkills = (): Record<SkillName, { proficient: boolean }> => {
  return SKILL_NAMES.reduce((acc, skill) => {
    acc[skill] = { proficient: false };
    return acc;
  }, {} as Record<SkillName, { proficient: boolean }>);
};

const defaultGameData: GameData = {
  // FIX: Wrapped playerCharacter with its class constructor.
  playerCharacter: new PlayerCharacter({
    id: 'char1',
    name: 'Adventurer', // Set to trigger wizard on first load
    age: 28,
    gender: 'Unspecified',
    profession: 'Explorer',
    appearance: 'A journey just begun.',
    background: 'An explorer with a future yet to be written.',
    keywords: [],
    abilities: [],
    imageUrl: undefined,
    level: 1,
    proficiencyBonus: 2,
    armorClass: 14,
    speed: 30,
    maxHitPoints: 12,
    currentHitPoints: 12,
    temporaryHitPoints: 0,
    heroicPoints: 1, // UPDATED: 1 point baseline
    maxHeroicPoints: 1, // NEW: Standard maximum
    abilityScores: {
      strength: { score: 10 },
      dexterity: { score: 10 },
      constitution: { score: 10 },
      intelligence: { score: 10 },
      wisdom: { score: 10 },
      charisma: { score: 10 },
    },
    savingThrows: {
      strength: { proficient: false },
      dexterity: { proficient: false },
      constitution: { proficient: false },
      intelligence: { proficient: false },
      wisdom: { proficient: false },
      charisma: { proficient: false },
    },
    skills: createDefaultSkills(),
    numberOfAttacks: 1,
    statusEffects: [],
    activeBuffs: [],
    resistances: [],
    immunities: [],
    vulnerabilities: [],
  }),
  companions: [],
  npcs: [], // Initialize empty NPCs array
  playerInventory: {
    equipped: [],
    carried: [],
    storage: [],
    assets: [],
  },
  companionInventories: {},
  story: [],
  gallery: [], // NEW: Initialize gallery
  world: [
    { id: 'world1', title: 'The Whisperwood', content: 'A vast, ancient forest known for its unusual flora and fauna. The trees are unnaturally large, and sunlight struggles to pierce the canopy. Legends say the woods are sentient and can mislead unwary travelers. It is rumored to be home to ruins from a long-forgotten era.', tags: ['location', 'forest', 'magic', 'ancient'], keywords: ['whisperwood', 'forest', 'haunted', 'ruins'], isNew: false },
    { id: 'world2', title: 'The Sundered Kingdom', content: 'The game is set in the remnants of a once-great kingdom, shattered a century ago by a magical cataclysm. Now, small city-states and independent towns dot a landscape filled with ruins, monsters, and opportunities for adventure.', tags: ['history', 'kingdom', 'cataclysm'], keywords: ['sundered kingdom', 'history', 'cataclysm'], isNew: false },
  ],
  knowledge: [],
  objectives: [],
  nemeses: [],
  messages: [],
  gmSettings: "",
  gmNotes: "",
  grandDesign: "",
  connectedNpcIds: [], // NEW: Initialize ID list
  plotPoints: [],
  currentTime: 'January 1, 2024, 08:00',
  narrationVoice: "Classic Narrator (Male)",
  narrationTone: NarrationTone.ClassicFantasy,
  imageGenerationStyle: ImageGenerationStyle.DigitalPainting,
  isMature: false,
  isHandsFree: false,
  // Added useAiTts to defaultGameData to fix missing property error
  useAiTts: false,
  combatState: null,
  difficulty: Difficulty.Normal,
  combatConfiguration: {
      aiNarratesTurns: true,
      manualCompanionControl: false,
      aiGeneratesLoot: true,
      smarterGm: true,
      fasterGm: false,
      narrativeCombat: false,
      autoIncludeNearbyNpcs: true
  },
  templates: DEFAULT_TEMPLATES,
  affinities: DEFAULT_AFFINITIES,
  sizeModifiers: DEFAULT_SIZE_MODIFIERS,
  combatBaseScore: 8,
  playerCoordinates: '0-0',
  mapZones: [
      { id: 'zone-start', coordinates: '0-0', name: 'Silvercreek', hostility: -5, sectorId: 'sector-start', visited: true, keywords: ['silvercreek', 'town', 'safe'] }
  ],
  mapSectors: [
      { id: 'sector-start', name: 'The Borderlands', description: 'The edge of the civilized world, bordering the great unknown.', color: '#3ecf8e', coordinates: ['0-0'], keywords: ['borderlands', 'wilds'] }
  ],
  mapSettings: {
      style: 'fantasy',
      gridUnit: 'Miles',
      gridDistance: 24,
      zoneLabel: 'Region'
  },
  skillConfiguration: 'Fantasy',
};

// Returns a copy of the default game data for the first-run world
export const getDefaultGameData = (): GameData => {
  return JSON.parse(JSON.stringify(defaultGameData));
};

// FIX: Wrapped the returned plain object with the PlayerCharacter class constructor to create a proper instance.
export const getNewDndCharacter = (): PlayerCharacter => new PlayerCharacter({
    id: 'char-new',
    name: 'Adventurer',
    age: 25,
    gender: 'Unspecified',
    profession: 'Explorer',
    appearance: 'Ready for anything.',
    background: 'A mysterious past and an open future.',
    keywords: [],
    abilities: [],
    imageUrl: undefined,
    level: 1,
    proficiencyBonus: 2,
    armorClass: 10,
    speed: 30,
    maxHitPoints: 10,
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    heroicPoints: 1, // UPDATED: 1 point baseline
    maxHeroicPoints: 1, // NEW: Standard maximum
    abilityScores: {
        strength: { score: 10 }, dexterity: { score: 10 }, constitution: { score: 10 },
        intelligence: { score: 10 }, wisdom: { score: 10 }, charisma: { score: 10 },
    },
    savingThrows: {
        strength: { proficient: false }, dexterity: { proficient: false }, constitution: { proficient: false },
        intelligence: { proficient: false }, wisdom: { proficient: false }, charisma: { proficient: false },
    },
    skills: createDefaultSkills(),
    numberOfAttacks: 1,
    statusEffects: [],
    activeBuffs: [],
    resistances: [],
    immunities: [],
    vulnerabilities: [],
    experiencePoints: getHalfwayXP(1), // Set to halfway through level 1
});


// Returns a fresh, blank slate for a newly created world
export const getNewGameData = (): GameData => {
    return {
        playerCharacter: getNewDndCharacter(),
        companions: [],
        npcs: [],
        playerInventory: {
            equipped: [],
            carried: [],
            storage: [],
            assets: [],
        },
        companionInventories: {},
        story: [],
        gallery: [], // NEW: Initialize gallery
        world: [], // This will be populated with the generated context
        knowledge: [],
        objectives: [],
        nemeses: [],
        messages: [
            { id: `sys-${Date.now()}`, sender: 'system', content: 'Your new adventure begins!', type: 'neutral' }
        ],
        gmSettings: "",
        gmNotes: "",
        grandDesign: "",
        connectedNpcIds: [],
        plotPoints: [],
        currentTime: 'January 1, 2024, 08:00',
        narrationTone: NarrationTone.ClassicFantasy,
        imageGenerationStyle: ImageGenerationStyle.DigitalPainting,
        isMature: false,
        isHandsFree: false,
        // Added useAiTts to getNewGameData to fix missing property error
        useAiTts: false,
        combatState: null,
        difficulty: Difficulty.Normal,
        combatConfiguration: {
            aiNarratesTurns: true,
            manualCompanionControl: false,
            aiGeneratesLoot: true,
            smarterGm: true,
            fasterGm: false,
            narrativeCombat: false,
            autoIncludeNearbyNpcs: true
        },
        templates: DEFAULT_TEMPLATES,
        affinities: DEFAULT_AFFINITIES,
        sizeModifiers: DEFAULT_SIZE_MODIFIERS,
        combatBaseScore: 8,
        playerCoordinates: '0-0',
        mapZones: [],
        mapSectors: [],
        mapSettings: {
            style: 'fantasy',
            gridUnit: 'Miles',
            gridDistance: 24,
            zoneLabel: 'Region'
        },
        skillConfiguration: 'Fantasy'
    };
};
// utils/documentation.ts

export const DOCUMENTATION_FILES = [
    {
        title: "World Creation And Selection",
        content: `# World Creation and Selection: Technical Specification

## 1. Overview
The World System is the container for all persistent game state. Each "World" is an isolated campaign instance with its own lore, map, characters, and history. The system is designed to be multi-tenant, allowing the user to swap between a high-fantasy epic and a gritty cyberpunk thriller without data collision.

## 2. World Selection & Management
The WorldSelection.tsx component acts as the entry point.

### Data Retrieval
- Worlds are stored in IndexedDB using dbService.ts.
- worldService.getAllWorlds() handles the initial fetch and includes a Hydration Pipeline to restore class methods to serialized data.

### Global Actions
- Import/Export: Worlds are serialized to JSON. The hydrateWorldData function in worldService.ts ensures that imported files (potentially from older versions) are normalized to the current schema.
- API Key Selection: A mandatory guard condition via window.aistudio.hasSelectedApiKey() ensures users have a paid GCP key for Gemini 3 Pro features.

## 3. Procedural Creation Workflow
The creation process is a phased pipeline executed in WorldSelection.tsx utilizing aiWorldService.ts.

### Phase 1: The Seed (User Input)
The user defines the core pillars:
- World Name: Identifying string.
- Genre & Setting: (Fantasy, Sci-Fi, Modern, Magitech).
- Thematic Tags: Array of strings (e.g., "Horror", "Exploration").
- Temporal Anchor: Starting date and time.

### Phase 2: Architect's Blueprint (The Preview)
Function: generateWorldPreview
Constraints & Conditions:
- Mandatory Race: The AI must include "Humans" in the race list regardless of genre.
- Quantity: Generates exactly numRaces + 1 unique species.
- Faction Logic: Generates numFactions organizations with defined relationships and goals.
- Integration: These races become the source of truth for the CharacterCreationWizard and the NPCDetailsModal dropdowns.

### Phase 3: Deep Generation (Geography & Economy)
Functions: generateWorldEconomy, generateWorldSectors, generateInitialLocations
Mechanical Constraints:
- Economic Baseline: AI defines economyDescription which biases item pricing in the StoreView.
- The Sector Grid: 
    - The world is a 26x26 coordinate grid (A-A to Z-Z).
    - Sectors (5-8) are assigned center points (centerX, centerY).
    - Every grid coordinate is mapped to a sector using a Voronoi-style proximity check (closest center point wins).
- Zone Placement:
    - Seats of Power: Exactly one "Major Hub" per sector is designated.
    - Starting Point: Exactly one zone in the entire world is tagged isStarting: true.
    - POI Density: Each zone must contain 2 to 3 Points of Interest (POIs). This is a strict system-level invariant to prevent context bloat.

### Phase 4: Campaign Initialization
The system assembles the GameData object:
- Spatial Sync: playerCoordinates is set to the Starting Point.
- Narrative Bridge: AI generates a Starting Scenario (intro message + starting objective).
- Knowledge Registry: POIs are added to gameData.knowledge with visited: true if they are in the starting zone.`
    },
    {
        title: "Character And Npc Systems",
        content: `# Character and NPC Systems: Technical Specification

## 1. Player Character Lifecycle
The Player Character (PC) system transitions from a generative "conceptual" phase to a deterministic "mechanical" phase.

### Phase 1: The Creation Wizard
Component: CharacterCreationWizard.tsx
The wizard is a 5-step guided process that collects user intent before involving the AI:
1. Ancestry: Selection from the World Lore.
2. Origin: Selection of 2 background traits from traitLibrary.
3. Qualities: Selection of 2 general traits from traitLibrary.
4. Prowess: Selection of 1 combat trait blueprint.
5. Identity: Manual entry of name, gender, and starting level.

### Phase 2: The Weaving (Generative)
Function: weaveHero in aiCharacterService.ts
Once selections are made, the AI synthesizes these choices into a cohesive profile:
- Standard Array Logic: The AI distributes a standard array of scores (15, 14, 13, 12, 10, 8) across the primary attributes.
- Skill Allocation: Exactly 4 skill proficiencies and 2 saving throw proficiencies are assigned based on the character concept.
- Thematic Skinning: The generic "Combat Trait" is renamed and described with flavor text matching the character's background.

## 2. Combat Stat Summary (The Source of Truth)
Component: calculateCombatStats in types/Characters.ts
The character sheet's combat summary is the absolute source of truth for all engagement math. 

### Unified Strike Display
The UI provides a hand-specific (M: / O:) breakdown when dual-wielding, aggregating all base damage and passive magical dice into a single "Total Strike" string.

### Data Exposure
The CalculatedCombatStats object exposes raw numeric values to the engine, eliminating "formula drift" between the UI and the dice:
- mainHandToHitBonus: The finalized bonus for the primary weapon.
- offHandToHitBonus: The finalized bonus for the secondary weapon (includes dual-wielding penalties).
- numberOfAttacks: Total strikes allowed per hand.

## 3. Vehicles and Vessels
Characters can be flagged as isShip: true. This changes their fundamental interaction rules.

### Macro-Scale Properties
- Durability: Vehicles typically have significantly higher HP pools (scaling at x2 or higher per level).
- Firepower: numberOfAttacks is increased to represent batteries of weapons.
- Sentience: If isSentient is false, the vehicle is treated as a non-living tool. The AI will never generate dialogue for it and will focus on mechanical failures rather than biological reactions.

## 4. The NPC and Companion Registry
The system differentiates between Companions (Party Members) and Registry NPCs (World Actors), but maintains a unified data link.

### NPC Navigation and Filtering
Component: NPCsView.tsx
To manage a growing list of world actors, the Social panel includes high-speed filtering and a specific sorting hierarchy.
- Search Utility: Real-time filtering against npc.name and npc.description.
- The Unified Sorting Protocol:
    1. Companions (Party Members): Always prioritized at the absolute top.
    2. Local Acquaintances (Alive): NPCs whose currentPOI matches the currentLocale appear next.
    3. Local Acquaintances (Dead): Deceased NPCs at the current location are listed below the living ones.
    4. Global Registry: All other known NPCs sorted alphabetically by name.

### Bidirectional State Sync (Digital Twin Pattern)
Hooks: useGameData.tsx, useCombatLootHandler.ts
The system treats the NPC Registry as a "Lore Blueprint" and the Scene Manager as the "Mechanical Realization."
- Registry -> Scene: When entering a locale, the system uses npcToCombatActor to hydrate mechanical stats scaled to the player's level.
- Scene -> Registry: If a staged actor is defeated in combat (HP <= 0), the conclude-combat pipeline automatically triggers a state write back to the registry, marking that NPC as status: 'Dead'.`
    },
    {
        title: "Data Migration And Integrity",
        content: `# Data Migration and Integrity: Technical Specification

## 1. The Hydration Pipeline
Because game state is stored as flat JSON in IndexedDB, the "Hydration" phase is critical. Serialized data loses its prototype methods (e.g., Item.getDisplayName()), which must be restored every time a world is loaded or imported.

### Sequential Normalization
Function: hydrateWorldData in worldService.ts
Every world object passes through this pipeline before reaching the state reducer:
1. Collection Hardening: Ensures core arrays (npcs, plotPoints, mapZones, knowledge, objectives, story) are initialized as empty arrays if missing.
2. Class Restoration: 
    - The player is re-instantiated via new PlayerCharacter(data).
    - Every item in every inventory list (carried, equipped, storage, assets) for both the player and all companions is re-instantiated via new Item(data).
3. Tag Normalization: Maps "AI-Hallucinated" or legacy tags to the modern system enums.
4. System Defaults: Injects missing system-level configurations (Templates, Affinities, Archetypes) into older saves.

## 2. Persistence and Storage
### The Multi-Tenant Architecture
- World Isolation: Each adventure is a separate row in the worlds table of IndexedDB.
- Gallery Store (Performance Hardening): Binary image data is stored in a dedicated gallery object store in IndexedDB.

### Autosave Strategy
Hook: usePersistence.ts
- Debounced Commits: commits the state after 1 second of inactivity.
- Change Detection: stringifies and compares the current state with the lastSavedDataRef.

## 3. Import and Export System
### Serialization
- The World Bundle: Exporting creates a JSON file containing the complete GameData blob.
- Binary Inclusion: Exported JSON files include the base64 image data for portability.`
    },
    {
        title: "Inventory And Forge Systems",
        content: `# Inventory and Item Forge Systems: Technical Specification

## 1. The Item Data Model
Class: Item in types/Items.ts
Items are the primary mechanical bridge between narrative rewards and deterministic combat math. Every item object is an instance of the Item class.

### Inventory Collections
State is partitioned into four distinct lists per actor:
1. Equipped: Items contributing to stats.
2. Carried: Standard backpack items.
3. Storage: Global "bank" items.
4. Assets: Large-scale property (Ships, Mounts).

## 2. The Item Forge (Manual & Procedural)
Component: ItemForgeView.tsx
Utility: itemMechanics.ts / itemModifiers.ts
The Forge is a deterministic "Blueprint" engine that uses the Gemini API for "Thematic Skinning." It utilizes a Scale-Aware Pipeline for macro-assets.

### UI Architecture (2x2 Selection Grid)
The primary selection area is structured as a grid to maintain a compact and organized layout:
- Scale: Selection for Person, Mount, or Ship.
- Item Category: High-level groups (Weapons, Protection, Accessories, etc.).
- Base Variant: Specific chassis subtypes. For Weapons: Light, Medium, Heavy. For Protection: Light Armor, Medium Armor, Heavy Armor, Shield.
- Tier / Rarity: Standard rarity selection (Common to Artifact).

### The Generation Pipeline
1. Scale Detection: Checks if the category involves Ships or Mounts.
2. Chassis Randomization: Randomizes underlying technical chassis (Weapon, Armor, Accessory) for Ships and Mounts.
3. Blueprint Selection: From LOOT_TABLES.
4. Rarity Roll: Determined by rollWeightedRarity.
5. Modifier Allocation: Via MODIFIER_REGISTRY.
6. Mechanical Summary: Raw technical string generation including Scale indicators.
7. AI Skinning: AI returns a thematic Name and a Flavor Description using Scale Context.

## 3. Narrative Acquisition (The Auditor Loop)
Service: aiAuditorService.ts
Items mentioned in the narrative are automatically added to the system inventory through Dual-Pass Extraction.

## 4. Item Enrichment and Identification
Service: aiItemService.ts
Support for a "Loot -> Identify" loop to prevent AI stat hallucination.
- Identification Loop: Loot found starts as unidentified.
- Enrichment: AI analyze generic names and maps them to mechanical schemas.
- Tag Inference: Automatically applies system tags based on data objects.`
    },
    {
        title: "Chat And Narrative Pipeline",
        content: `# Chat and Narrative Pipeline: Technical Specification

## 1. The Execution Guardrail Framework
Every user message initiates a five-stage pipeline.

## 2. Phase 1: Librarian 3.0 (Tiered Injection)
Service: aiContextService.ts
The Librarian prunes the data points into a high-relevance prompt.

## 3. Phase 2: The Assessor & Verifier (Validation)
Service: aiSkillAssessorService.ts
Identifies risky actions and resolves them before the AI generates prose.
- Hidden Detection Logic: Checks if npcs spot a hiding party.
- Hazard Trigger Check: Natural 1s on checks engage the Hazard Engine.

## 4. Phase 3: The Narrator (Content Constraints)
Service: aiNarratorService.ts
Creates creative prose within strict mechanical boundaries. Adheres to npc death status and vehicle sentience.

## 5. Phase 4: The Auditor (Consequence Extraction)
Service: aiAuditorService.ts
Reconciles narrative outcomes with mechanical state (Inventory, Locales, Quests). Enforces Scale Context when skinning Ships/Mounts.

## 6. Phase 5: Locality Synchronization
Hook: useGameData.tsx
Ensures physical presence of NPCs in the scene manager matches the narrative location.`
    },
    {
        title: "Dice Rolls And Mechanics",
        content: `# Dice Rolls and Mechanics: Technical Specification

## 1. The "Dice Truth" Principle
The system is the absolute source of mechanical reality. The system rolls first, and the outcome is passed to the AI as an invariant.

## 2. Saving Throw Pivot Logic
The engine handles abilities via the Mechanical Hijack pipeline. If a saveAbility is detected, the engine swaps roles: Target rolls to save vs the Player's DC (8 + Prof + Mod).

## 3. Unified Strikes (Damage Aggregation)
Aggregator pattern for physical attacks:
1. Base Chassis: Weapon dmg dice.
2. Passive Extraction: Extra damage buffs.
3. Style Bonuses: Special combat styles like Dueling or Great Weapon Fighting.
4. Consolidation: All dice rolled in sequence as one strike.

## 4. Multi-Attack Logic
Number of strikes per hand is determined by character level and combat traits:
1. Base Attacks: Math.ceil(Level / 5).
2. Flurry Of Blows: Adds 1 additional main-hand strike while unarmed.
3. Two-Weapon Style: Adds 1 additional off-hand strike while dual-wielding.

## 5. Group Stealth and Detection
Hiding phase: Player and companions roll stealth. Success if >= 50% succeed.
Detection phase: Nearby npcs roll perception vs partyStealthScore every turn.

## 6. Consequence Branching for Skills
Success: Award XP.
Failure (Verified): Trigger combat sequence.
Failure (Peaceful): Narrator generates a narrative setback.

## 7. Environmental Hazard System (Crit Fails)
Natural 1 triggers a d100 severity roll:
1-70: Weak. 71-95: Potent. 96-100: Deadly.
Damage is resolved and HP updated before AI narration.`
    },
    {
        title: "Shop And Economy Systems",
        content: `# Shop and Economy Systems: Technical Specification

## 1. Overview
Economy is a hybrid system. Blueprints are determined by the System, while flavor is generated by the AI.

## 2. Market Sourcing & Generation
Shops are generated on-demand based on player location and level.
Stocking Pipeline: Category Select -> Rarity Distribution -> Mechanical Blueprinting -> AI Skinning.
Scale Context: AI is forced to use macro-scale terms (Hull, Batteries) for Ships/Mounts.

## 3. Transaction Logic
Buying: Item is instantiated in carried list.
Selling: Items sold back for exactly 50% of price.

## 4. The Identification & Appraisal Loop
Found loot starts as Unidentified. Appraisal loop in StoreView uses AI to analyze mechanical details and provide a lore-fitting name and value.`
    },
    {
        title: "World Lore And Knowledge Systems",
        content: `# World Lore and Knowledge Systems: Technical Specification

## 1. The Cortex of Truth
The world lore system acts as the persistent memory of the campaign, providing the ai with deterministic facts.

## 2. Librarian 3.0: Lore Retrieval (RAG)
Entries selected based on scoring: Exact Title (+20), Partial Title (+10), Keywords (+8), Content (+2).

## 3. Knowledge vs. Lore
Global Lore: World history.
Character Knowledge: Player discoveries anchored to coordinates. POI density limited to 2-3 per zone.

## 4. Social Persistence
NPCs as living lore. Death consequences are enforced. The Name Gallery Invariant prevents AI from reusing registered names.`
    },
    {
        title: "Story Log And History Systems",
        content: `# Story Log and History Systems: Technical Specification

## 1. Overview
Story Log is the campaign's "Long-Term Memory." Prevents narrative drift by chronicling significant events.

## 2. The Logging Pipeline
New logs created on AI response, significant events, or combat conclusion.

## 3. The Compression Engine
Manual "Compress Day" action uses AI to synthesize multiple logs into a single paragraph, saving context tokens while preserving "Truth."`
    },
    {
        title: "Quests And Objective Systems",
        content: `# Quests and Objectives System: Technical Specification

## 1. Overview
Quests provide the narrative "North Star."

## 2. The Quest Lifecycle
Discovery: Auditor scans narrative for goals/rewards.
Progression: Auditor adds milestones.
Completion: Strict logical verification via checkObjectiveCompletion service.

## 3. Smart Player Assistance (The Hint Engine)
"Help" button analyzes milestones and chat history to suggest the next logical progression step as a first-person action.`
    },
    {
        title: "Scene Manager And Staging",
        content: `# Scene Manager and Staging: Technical Specification

## 1. Overview
Operational bridge between map and combat. Stages actors and defines the tactical brief for the AI.

## 2. The Stat Scaling Engine
Deterministic scaling for Armor Class, HP, and attacks based on Challenge Rating.

## 3. Locality Sync
Active Scene Graph automatically populates manager based on current narrative locale using normalized string comparison.`
    },
    {
        title: "Encounters Travel And Time Systems",
        content: `# Encounters, Travel, and Time: Technical Specification

## 1. Overview
Manages the in-game clock and encounter pipeline.

## 2. The Danger Pipeline
d100 threat check: d100 + hostility >= 75 triggers threat.
Threat Detected: triggers reactive skill checks (Stealth for travel, Perception for rest).
Failure: invokes Verifier to determine combat vs setback.`
    },
    {
        title: "World Map And Geography",
        content: `# World Map and Geography: Technical Specification

## 1. Overview
World Space hierarchy: Sectors > Zones > Locales/POIs.

## 2. The Spatial Hierarchy
Map Sectors: macro-regions assigned via Voronoi logic.
Map Zones: 26x26 coordinate grid. Hostility affects threat rolls.
Locales/POIs: recursive anchoring and lore promotion ensure site persistence.`
    },
    {
        title: "Nemesis System",
        content: `# Nemesis System: Technical Specification

## 1. Overview
Persistent antagonists that track player friction via a "Heat" mechanic.

## 2. The Heat Engine
Each CHAR message increments heat. At threshold, a narrative pipeline hijack forces the Nemesis arrival.`
    },
    {
        title: "Gm Notes And Narrative Web",
        content: `# GM Notes and the Narrative Web: Technical Specification

## 1. Overview
Tactical briefs (GM Notes) and Strategic plans (Grand Design).
Current Encounter Plot: 3-sentence brief populated by Narrator. Protected from Auditor interference.`
    },
    {
        title: "Settings And System Configuration",
        content: `# Settings and System Configuration: Technical Specification

## 1. Overview
Central control hub for Gameplay and System settings.
Rule Engine Toggles: Hands-Free, Smarter GM, Gemini Neural TTS, AI Loot, Narrative Combat, Mature Content.`
    },
    {
        title: "Combat Engine And Lifecycle",
        content: `# Combat Engine and Lifecycle: Technical Specification

## 1. Overview
Deterministic system gated by mechanics. 5 triggers: Intent, Danger Threshold, Contextual Escalation, Nemesis, Spontaneous Auditor detection. Handles targeting prioritization for Ships vs Personnel.

## 2. The Intent Pivot (Mechanical Hijack)
When a player uses an ability, the engine performs a pre-processing step. If the ability requires a saving throw, the engine swaps roles: the Enemy rolls to save against the Player's calculated DC.`
    },
    {
        title: "Gallery And Visual Persistence",
        content: `# Gallery and Visual Persistence: Technical Specification

## 1. Overview
Visual record of journey moments using Gemini 3 Pro.
Decoupled Persistence: metadata in state, binary images in a separate gallery IndexedDB store.`
    },
    {
        title: "Ai Agent Roles And Logic",
        content: `# AI Agent Roles and Logic: Technical Specification

## 1. Agent Manifest
Librarian (Flash): Context selection, scale awareness.
Assessor (Flash): Intent classification.
Verifier (Flash): Combat gatekeeper.
Narrator (Pro): Creative prose, vehicle logic, gmNotes briefing.
Auditor (Flash): State extraction, spatial anchoring, scale-aware item skinning.`
    },
    {
        title: "Audio And Multimodal Interaction",
        content: `# Audio and Multimodal Interaction: Technical Specification

## 1. TTS and STT Pipelines
Neural TTS: gemini-2.5-flash-preview-tts returns raw PCM.
STT: MediaRecorder -> gemini-3-flash-preview (transcribe).`
    },
    {
        title: "Diagnostics And System Checks",
        content: `# Diagnostics and System Checks: Technical Specification

## 1. Overview
Centralized CHECKS registry performs deterministic tests against gameData to ensure hydration and logic health.`
    }
];

export const downloadAsTxt = () => {
    const text = DOCUMENTATION_FILES.map(f => `=== ${f.title.toUpperCase()} ===\n\n${f.content}\n\n`).join('---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "Game_Technical_Documentation.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
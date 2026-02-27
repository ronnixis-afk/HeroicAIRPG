
// types/Core.ts

export const ABILITY_SCORES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
export type AbilityScoreName = typeof ABILITY_SCORES[number];

export type SkillConfiguration = 'Fantasy' | 'Modern' | 'Sci-Fi' | 'Magitech';

export interface SkillDefinition {
    ability: AbilityScoreName;
    usedIn: SkillConfiguration[] | 'All';
    description: string;
    keywords: string[];
}

export const SKILL_DEFINITIONS: Record<string, SkillDefinition> = {
    'Acrobatics': {
        ability: 'dexterity',
        usedIn: 'All',
        description: 'Staying on your feet, diving, and balancing.',
        keywords: ['tumble', 'balance', 'flip', 'dodge', 'land', 'parkour', 'jump', 'gymnastics']
    },
    'Aether Sense': {
        ability: 'wisdom',
        usedIn: ['Magitech'],
        description: 'Detecting magical radiation, ley lines, or mana leaks.',
        keywords: ['sense magic', 'aura', 'detect', 'resonance', 'tune', 'feel mana', 'vibe']
    },
    'Animal Handling': {
        ability: 'wisdom',
        usedIn: ['Fantasy'],
        description: 'Calming, controlling, or understanding beasts.',
        keywords: ['ride', 'tame', 'calm', 'handle', 'train', 'mount', 'beast', 'pet']
    },
    'Arcana': {
        ability: 'intelligence',
        usedIn: ['Fantasy', 'Magitech'],
        description: 'Knowledge of spells, magical theory, and runes.',
        keywords: ['magic', 'spellcraft', 'runes', 'mystic', 'occult', 'mana', 'wizardry', 'theory']
    },
    'Artifice': {
        ability: 'intelligence',
        usedIn: ['Magitech'],
        description: 'Engineering magical devices, goggles, and constructs.',
        keywords: ['construct', 'infuse', 'tinker', 'magic item', 'golem', 'schematic', 'enchant']
    },
    'Astrography': {
        ability: 'intelligence',
        usedIn: ['Sci-Fi'],
        description: 'Knowledge of star charts, planets, and space physics.',
        keywords: ['star chart', 'navigation', 'vacuum', 'planet', 'orbit', 'space', 'coordinates']
    },
    'Athletics': {
        ability: 'strength',
        usedIn: 'All',
        description: 'Physical strength for climbing, swimming, or forcing.',
        keywords: ['run', 'climb', 'limit', 'smash', 'break', 'swim', 'force', 'push', 'grapple']
    },
    'Civics': {
        ability: 'intelligence',
        usedIn: ['Magitech'],
        description: 'Knowledge of bureaucracy, corporate law, and permits.',
        keywords: ['law', 'permit', 'bureaucracy', 'corporate', 'rights', 'legal', 'paperwork']
    },
    'Computing': {
        ability: 'intelligence',
        usedIn: ['Modern'],
        description: 'Using software, coding, or internet searches.',
        keywords: ['internet', 'search', 'email', 'login', 'type', 'browse', 'code', 'software']
    },
    'Data': {
        ability: 'intelligence',
        usedIn: ['Sci-Fi'],
        description: 'Hacking, encryption breaking, and AI logic.',
        keywords: ['hack', 'code', 'decrypt', 'program', 'computer', 'terminal', 'slice', 'override']
    },
    'Deception': {
        ability: 'charisma',
        usedIn: 'All',
        description: 'Lying, conning, or misleading others.',
        keywords: ['lie', 'bluff', 'trick', 'con', 'mislead', 'falsify', 'cheat', 'fake']
    },
    'Driving': {
        ability: 'dexterity',
        usedIn: ['Modern'],
        description: 'Operating wheeled land vehicles like cars or bikes.',
        keywords: ['drive', 'steer', 'accelerate', 'brake', 'drift', 'park', 'car', 'bike']
    },
    'Engineering': {
        ability: 'intelligence',
        usedIn: ['Sci-Fi'],
        description: 'Repairing or understanding ship structure and power.',
        keywords: ['structure', 'power core', 'engine', 'reactor', 'build', 'schematic', 'hull']
    },
    'History': {
        ability: 'intelligence',
        usedIn: ['Fantasy', 'Magitech'],
        description: 'Knowledge of past events, wars, and lineage.',
        keywords: ['lore', 'past', 'nobility', 'ancient', 'lineage', 'old', 'legend', 'myth']
    },
    'Humanities': {
        ability: 'intelligence',
        usedIn: ['Modern'],
        description: 'Knowledge of culture, politics, art, and sociology.',
        keywords: ['law', 'politics', 'art', 'sociology', 'culture', 'news', 'society', 'pop culture']
    },
    'Insight': {
        ability: 'wisdom',
        usedIn: 'All',
        description: 'Determining the true intentions or mood of a person.',
        keywords: ['read', 'sense motive', 'detect lie', 'gut feeling', 'judge', 'psychology']
    },
    'Intimidation': {
        ability: 'charisma',
        usedIn: 'All',
        description: 'Using fear or threats to get your way.',
        keywords: ['threaten', 'scare', 'bully', 'coerce', 'menace', 'interrogate', 'yell']
    },
    'Investigation': {
        ability: 'intelligence',
        usedIn: 'All',
        description: 'Deducing clues from searching an area or object.',
        keywords: ['search', 'examine', 'analyze', 'study', 'inspect', 'loot', 'find', 'clue']
    },
    'Mechanics': {
        ability: 'dexterity',
        usedIn: ['Sci-Fi'],
        description: 'Fine motor repair of hardware and robotics.',
        keywords: ['repair', 'fix', 'build', 'solder', 'rig', 'patch', 'hardware', 'robot']
    },
    'Medicine': {
        ability: 'wisdom',
        usedIn: 'All',
        description: 'Stabilizing the dying or diagnosing illness.',
        keywords: ['heal', 'treat', 'surgery', 'first aid', 'diagnose', 'stabilize', 'doctor']
    },
    'Nature': {
        ability: 'intelligence',
        usedIn: ['Fantasy'],
        description: 'Knowledge of flora, fauna, and natural cycles.',
        keywords: ['flora', 'fauna', 'biology', 'weather', 'plants', 'beasts', 'wild', 'forest']
    },
    'Operate Vehicle': {
        ability: 'dexterity',
        usedIn: ['Magitech'],
        description: 'Piloting maglevs, airships, or steam-tanks.',
        keywords: ['pilot', 'steer', 'drive', 'airship', 'train', 'control', 'throttle']
    },
    'Perception': {
        ability: 'wisdom',
        usedIn: 'All',
        description: 'Spotting, hearing, or noticing things in the environment.',
        keywords: ['spot', 'listen', 'hear', 'see', 'notice', 'detect', 'observe', 'look']
    },
    'Performance': {
        ability: 'charisma',
        usedIn: 'All',
        description: 'Delighting an audience with music, dance, or acting.',
        keywords: ['act', 'sing', 'dance', 'play', 'entertain', 'distract', 'speech', 'music']
    },
    'Persuasion': {
        ability: 'charisma',
        usedIn: 'All',
        description: 'Convincing others through logic or charm.',
        keywords: ['talk', 'convince', 'charm', 'negotiate', 'diplomat', 'haggle', 'reason']
    },
    'Piloting': {
        ability: 'dexterity',
        usedIn: ['Sci-Fi'],
        description: 'Flying starships or atmospheric crafts.',
        keywords: ['fly', 'launch', 'land', 'maneuver', 'dock', 'thrusters', 'pilot', 'cockpit']
    },
    'Religion': {
        ability: 'intelligence',
        usedIn: ['Fantasy'],
        description: 'Knowledge of gods, cults, and holy rituals.',
        keywords: ['god', 'cult', 'ritual', 'holy', 'unholy', 'prayer', 'divine', 'temp']
    },
    'Science': {
        ability: 'intelligence',
        usedIn: ['Modern'],
        description: 'Knowledge of physics, chemistry, and biology.',
        keywords: ['physics', 'chemistry', 'biology', 'lab', 'experiment', 'formula', 'research']
    },
    'Sleight of Hand': {
        ability: 'dexterity',
        usedIn: ['Fantasy', 'Modern'],
        description: 'Manual trickery, pickpocketing, or concealment.',
        keywords: ['pickpocket', 'steal', 'palm', 'conceal', 'trick', 'swipe', 'limit']
    },
    'Stealth': {
        ability: 'dexterity',
        usedIn: 'All',
        description: 'Hiding, moving silently, or blending in.',
        keywords: ['hide', 'sneak', 'creep', 'shadow', 'quiet', 'camouflage', 'prowl']
    },
    'Streetwise': {
        ability: 'wisdom',
        usedIn: ['Modern'],
        description: 'Navigating urban danger, gangs, and black markets.',
        keywords: ['contacts', 'black market', 'rumor', 'gang', 'city', 'urban', 'deal']
    },
    'Survival': {
        ability: 'wisdom',
        usedIn: ['Fantasy', 'Sci-Fi', 'Magitech'],
        description: 'Tracking and enduring in the wilderness.',
        keywords: ['track', 'hunt', 'forage', 'camp', 'pathfind', 'endure', 'navigate']
    },
    'Technology': {
        ability: 'intelligence',
        usedIn: ['Modern'],
        description: 'Utilizing gadgets, phones, and electronics.',
        keywords: ['phone', 'drone', 'electronics', 'gadget', 'use tech', 'device', 'tablet']
    },
    'Thievery': {
        ability: 'dexterity',
        usedIn: ['Magitech'],
        description: 'Disabling traps, picking locks, and stealing.',
        keywords: ['pick lock', 'disable trap', 'heist', 'steal', 'break in', 'burglar']
    },
    'Xenology': {
        ability: 'intelligence',
        usedIn: ['Sci-Fi'],
        description: 'Knowledge of alien customs, biology, and language.',
        keywords: ['alien', 'species', 'biology', 'custom', 'language', 'xeno', 'translate']
    }
};

export type SkillName = keyof typeof SKILL_DEFINITIONS;
export const SKILL_NAMES = Object.keys(SKILL_DEFINITIONS) as SkillName[];

export const DND_SKILLS: Record<string, AbilityScoreName> = {
    'Acrobatics': 'dexterity',
    'Animal Handling': 'wisdom',
    'Arcana': 'intelligence',
    'Athletics': 'strength',
    'Deception': 'charisma',
    'History': 'intelligence',
    'Insight': 'wisdom',
    'Intimidation': 'charisma',
    'Investigation': 'intelligence',
    'Medicine': 'wisdom',
    'Nature': 'intelligence',
    'Perception': 'wisdom',
    'Performance': 'charisma',
    'Persuasion': 'charisma',
    'Religion': 'intelligence',
    'Sleight of Hand': 'dexterity',
    'Stealth': 'dexterity',
    'Survival': 'wisdom',
};

export const DAMAGE_TYPES = [
    'Piercing', 'Slashing', 'Bludgeoning', 'Fire', 'Cold', 'Electric',
    'Acid', 'Necrotic', 'Radiant', 'Force', 'Poison', 'Psychic', 'Thunder'
] as const;
export type DamageType = typeof DAMAGE_TYPES[number];

export const ITEM_TAGS = [
    'Light Weapon', 'Medium Weapon', 'Heavy Weapon', 'Light Armor', 'Medium Armor', 'Heavy Armor',
    'shield', 'consumable', 'ammunition',
    'currency', 'asset', 'vehicle', 'material', 'note', 'buff', 'mechanical', 'quest',
    'ranged', 'melee'
] as const;
export type ItemTag = typeof ITEM_TAGS[number];

export const LORE_TAGS = [
    'location', 'npc', 'faction', 'history', 'magic', 'quest', 'race'
] as const;
export type LoreTag = typeof LORE_TAGS[number];

export const BODY_SLOTS = [
    'Head', 'Eyes', 'Neck', 'Shoulders',
    'Body', 'Vest', 'Bracers', 'Gloves',
    'Main Hand', 'Off Hand', 'Ring 1', 'Ring 2',
    'Waist', 'Legs', 'Feet', 'Accessory 1', 'Accessory 2'
] as const;
export type BodySlot = typeof BODY_SLOTS[number];

export const BODY_SLOT_TAGS = [
    'Head', 'Eyes', 'Neck', 'Shoulders',
    'Body', 'Vest', 'Bracers', 'Gloves',
    'Main Hand', 'Off Hand', 'Waist', 'Legs', 'Feet',
    'Ring', 'Accessory'
] as const;

export const STATUS_EFFECT_NAMES = ['Stunned', 'Paralyzed', 'Poisoned', 'Prone', 'Blinded', 'Deafened', 'Invisible', 'Hidden', 'Disappeared'] as const;

/**
 * Foundation for statuses that prevent an actor from being targeted.
 */
export const UNTARGETABLE_STATUS_NAMES = ['Invisible', 'Hidden', 'Disappeared'] as const;

export const ARCHETYPE_NAMES = ['Bipedal', 'Bestial', 'Aerial', 'Marine', 'Amphibian', 'Crawler', 'Hoverer', 'Sentry'] as const;
export type ArchetypeName = typeof ARCHETYPE_NAMES[number];

export const NARRATION_VOICES = [
    "Classic Narrator (Male)",
    "Mysterious Storyteller (Female)",
    "Grizzled Veteran (Male)",
    "Ethereal Oracle (Female)",
] as const;
export type NarrationVoice = (typeof NARRATION_VOICES)[number];

// --- SHARED FORGE DATA ---

export interface ForgeSubtype {
    id: string;
    label: string;
    slot?: BodySlot;
}

export interface ForgeGroup {
    id: string;
    label: string;
    subtypes?: ForgeSubtype[];
}

export const FORGE_GROUPS: ForgeGroup[] = [
    {
        id: 'Weapons', label: 'Weapons',
        subtypes: [
            { id: 'Light Weapon', label: 'Light' },
            { id: 'Medium Weapon', label: 'Medium' },
            { id: 'Heavy Weapon', label: 'Heavy' },
        ]
    },
    {
        id: 'Protection', label: 'Protection',
        subtypes: [
            { id: 'Light Armor', label: 'Light Armor', slot: 'Body' },
            { id: 'Medium Armor', label: 'Medium Armor', slot: 'Body' },
            { id: 'Heavy Armor', label: 'Heavy Armor', slot: 'Body' },
            { id: 'Shield', label: 'Shield', slot: 'Off Hand' }
        ]
    },
    {
        id: 'Accessories', label: 'Accessories',
        subtypes: [
            { id: 'Ring', label: 'Ring', slot: 'Ring 1' },
            { id: 'Amulet', label: 'Amulet', slot: 'Neck' },
            { id: 'Accessory', label: 'Accessory', slot: 'Accessory 1' }
        ]
    },
    {
        id: 'Wondrous', label: 'Wondrous',
        subtypes: [
            { id: 'Head Gear', label: 'Head', slot: 'Head' },
            { id: 'Eye Wear', label: 'Eyes', slot: 'Eyes' },
            { id: 'Neck Wear', label: 'Neck', slot: 'Neck' },
            { id: 'Shoulder Wear', label: 'Shoulders', slot: 'Shoulders' },
            { id: 'Body Wear', label: 'Body', slot: 'Body' },
            { id: 'Vest Wear', label: 'Vest', slot: 'Vest' },
            { id: 'Arm Wear', label: 'Bracers', slot: 'Bracers' },
            { id: 'Hand Wear', label: 'Gloves', slot: 'Gloves' },
            { id: 'Waist Wear', label: 'Waist', slot: 'Waist' },
            { id: 'Leg Wear', label: 'Legs', slot: 'Legs' },
            { id: 'Foot Wear', label: 'Feet', slot: 'Feet' },
        ]
    },
    { id: 'Utilities', label: 'Utilities' },
    { id: 'Throwables', label: 'Throwables' },
    { id: 'Consumables', label: 'Consumables' },
    { id: 'Mounts', label: 'Mounts' },
    { id: 'Ships', label: 'Ships' },
    { id: 'Quest', label: 'Quest' },
];

// --- ENUMS ---

export enum NarrationTone {
    ClassicFantasy = "Classic Fantasy",
    DarkAndGritty = "Dark & Gritty",
    Mythic = "Mythic",
    Horror = "Horror",
    Whimsical = "Whimsical",
    Comedic = "Comedic",
    Noir = "Noir",
    Suspenseful = "Suspenseful",
}

export enum ImageGenerationStyle {
    DigitalPainting = "Digital Painting",
    Realistic = "Realistic",
    ComicBook = "Comic Book",
    ThreeDRender = "3D Render",
    Anime = "Anime",
    PixelArt = "Pixel Art",
}

export enum Difficulty {
    Easy = "Easy",
    Normal = "Normal",
    Hard = "Hard",
}

// --- INTERFACES & TYPES ---

/**
 * Valid view types for navigation in the application.
 */
export type View = 'character' | 'inventory' | 'chat' | 'story' | 'world' | 'knowledge' | 'settings' | 'objectives' | 'store' | 'temp-stats' | 'nemesis' | 'gm-notes' | 'item-forge' | 'npcs' | 'gallery';

export type WorldStyle = 'fantasy' | 'modern' | 'sci-fi' | 'historical' | 'custom';

export type CombatActorSize = 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan' | 'Colossal';

// Core Size Modifiers (Shared by Player, Companions, and Enemies)
export const BASE_SIZE_MODIFIERS: Record<CombatActorSize, { str: number, dex: number, con: number, ac: number }> = {
    'Small': { str: -4, dex: 4, con: 0, ac: 0 },
    'Medium': { str: 0, dex: 0, con: 0, ac: 0 },
    'Large': { str: 4, dex: -4, con: 2, ac: 1 },
    'Huge': { str: 8, dex: -6, con: 4, ac: 2 },
    'Gargantuan': { str: 12, dex: -8, con: 6, ac: 3 },
    'Colossal': { str: 16, dex: -10, con: 8, ac: 4 },
};

export interface StatusEffect {
    name: typeof STATUS_EFFECT_NAMES[number];
    duration: number; // in rounds
}

export interface AbilityUsage {
    type: 'passive' | 'per_short_rest' | 'per_long_rest' | 'charges';
    maxUses: number;
    currentUses: number;
}

export type EffectType = 'Damage' | 'Status' | 'Heal';
export type TargetType = 'Single' | 'Multiple';

export interface AbilityEffect {
    type: EffectType;
    dc?: number;
    saveAbility?: AbilityScoreName;
    saveEffect?: 'half' | 'negate';
    targetType?: TargetType;
    damageDice?: string;
    damageType?: string;
    status?: StatusEffect['name'];
    duration?: number;
    healDice?: string;
    // Fix: Added resolutionMethod to AbilityEffect to support explicit resolution path overrides in the engine
    resolutionMethod?: 'attack' | 'save' | 'skill' | 'heal';
}

export type BuffDuration = 'Passive' | 'Active';

export interface Buff {
    // Added 'temp_hp' to support shield/temp hp buffs in the system
    // Added 'hero_points' to support hero point capacity modifiers
    /* Fix: Added 'hero_points' to the type union to resolve unintentional comparison errors in Characters.ts */
    type: 'ac' | 'attack' | 'damage' | 'save' | 'skill' | 'ability' | 'resistance' | 'immunity' | 'exdam' | 'temp_hp' | 'hero_points';
    bonus: number;
    skillName?: SkillName;
    abilityName?: AbilityScoreName;
    damageType?: DamageType;
    damageDice?: string;
    // Fix: Added duration to Buff interface to support activation logic
    duration?: BuffDuration;
}

// Added ActiveBuff interface to track buffs with a duration (e.g. from spells or temporary items)
// Fix: Use Omit to prevent type conflict with Buff.duration
export interface ActiveBuff extends Omit<Buff, 'duration'> {
    duration: number;
}

export interface AbilityScore {
    score: number;
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

// --- HELPER FUNCTIONS ---

export const calculateModifier = (score: number): number => Math.floor((score - 10) / 2);

export const formatModifier = (modifier: number): string => (modifier >= 0 ? `+${modifier}` : `${modifier}`);

export const getStatPenalties = (effects: StatusEffect[]) => {
    let attack = 0;
    let ac = 0;
    let check = 0;
    let save = 0;

    if (effects.some(e => e.name === 'Prone')) {
        attack -= 2;
    }
    if (effects.some(e => e.name === 'Poisoned')) {
        attack -= 2;
        check -= 2;
    }
    if (effects.some(e => e.name === 'Stunned') || effects.some(e => e.name === 'Paralyzed')) {
        ac -= 5;
    }

    return { attack, ac, check, save };
};

export const getItemRarityColor = (rarity: string | undefined): string => {
    switch (rarity) {
        case 'Basic': return 'text-brand-text-muted';
        case 'Common': return 'text-brand-text';
        case 'Uncommon': return 'text-green-400';
        case 'Rare': return 'text-blue-400';
        case 'Very Rare': return 'text-purple-400';
        case 'Legendary': return 'text-orange-400';
        case 'Unique': return 'text-yellow-300';
        case 'Artifact': return 'text-red-500 animate-pulse';
        default: return 'text-brand-text';
    }
};

export const getItemRarityBorder = (rarity: string | undefined): string => {
    switch (rarity) {
        case 'Basic': return 'border-brand-primary';
        case 'Common': return 'border-brand-text-muted';
        case 'Uncommon': return 'border-green-500';
        case 'Rare': return 'border-blue-500';
        case 'Very Rare': return 'border-purple-500';
        case 'Legendary': return 'border-orange-500';
        case 'Unique': return 'border-yellow-400';
        case 'Artifact': return 'border-red-500';
        default: return 'border-brand-primary';
    }
};

const SKILL_ADAPTATIONS: Partial<Record<SkillName, { modern?: string; 'sci-fi'?: string; historical?: string }>> = {
    'Arcana': { modern: 'Technology', 'sci-fi': 'Hacking', historical: 'Occult' },
    'Animal Handling': { modern: 'Drive', 'sci-fi': 'Piloting', historical: 'Ride' },
    'Nature': { modern: 'Science', 'sci-fi': 'Xenobiology', historical: 'Nature' },
    'Religion': { modern: 'Humanities', 'sci-fi': 'Xenology', historical: 'Theology' },
    'History': { modern: 'History', 'sci-fi': 'Galactic Lore', historical: 'History' },
    'Survival': { modern: 'Streetwise', 'sci-fi': 'Survival', historical: 'Survival' },
    'Medicine': { modern: 'Medicine', 'sci-fi': 'Bio-Tech', historical: 'Medicine' },
};

export const getSkillMap = (setting: string): Record<SkillName, string> => {
    const skillMap = {} as Record<SkillName, string>;
    const styleKey = setting.toLowerCase();

    for (const skill of SKILL_NAMES) {
        const adaptation = SKILL_ADAPTATIONS[skill];
        if (adaptation) {
            if (styleKey === 'modern' && adaptation.modern) {
                skillMap[skill] = adaptation.modern;
            } else if ((styleKey === 'sci-fi' || styleKey === 'futuristic') && adaptation['sci-fi']) {
                skillMap[skill] = adaptation['sci-fi'];
            } else if (styleKey === 'historical' && adaptation.historical) {
                skillMap[skill] = adaptation.historical;
            } else {
                skillMap[skill] = skill;
            }
        } else {
            skillMap[skill] = skill;
        }
    }
    return skillMap;
};

const futuristicKeywords = ['quantum', 'galactic', 'xeno', 'cyber', 'space', 'laser', 'starship', 'futuristic'];
const modernKeywords = ['technology', 'computer', 'gun', 'corporation', 'city', 'modern', 'internet', 'biology'];

export const determineWorldSetting = (worldLore: { title: string, content: string }[]): WorldStyle => {
    const loreText = worldLore.map(e => `${e.title.toLowerCase()} ${e.content.toLowerCase()}`).join(' ');

    if (futuristicKeywords.some(keyword => loreText.includes(keyword))) {
        return 'sci-fi';
    }
    if (modernKeywords.some(keyword => loreText.includes(keyword))) {
        return 'modern';
    }
    return 'fantasy';
};

export const resolveCanonicalSkillName = (input: string): SkillName | null => {
    if (!input || typeof input !== 'string') return null;

    // Normalize input: trim, lowercase, and take ONLY the first part if there's a slash or " or "
    let normalizedInput = input.trim().toLowerCase().split(/[\/]| or /)[0].trim();

    // 1. Direct match on Canonical Name
    const canonicalMatch = SKILL_NAMES.find(s => s.toLowerCase() === normalizedInput);
    if (canonicalMatch) return canonicalMatch;

    // 2. Check Adaptations (cross-genre mapping)
    for (const [key, adaptations] of Object.entries(SKILL_ADAPTATIONS)) {
        if (adaptations && Object.values(adaptations).some(val => val?.toLowerCase() === normalizedInput)) {
            return key as SkillName;
        }
    }

    // 3. Search via Keywords in Definitions
    for (const [skillName, def] of Object.entries(SKILL_DEFINITIONS)) {
        // If the input exactly matches a keyword
        if (def.keywords.some(k => k.toLowerCase() === normalizedInput)) {
            return skillName as SkillName;
        }
        // If the skill name is contained within the input (e.g., "Athletics check" -> "Athletics")
        if (normalizedInput.includes(skillName.toLowerCase())) {
            return skillName as SkillName;
        }
    }

    return null;
};

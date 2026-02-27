import { NarrationTone, ImageGenerationStyle, AbilityScoreName, Difficulty } from './types';

export const NARRATION_TONES: NarrationTone[] = [
    NarrationTone.ClassicFantasy,
    NarrationTone.DarkAndGritty,
    NarrationTone.Mythic,
    NarrationTone.Horror,
    NarrationTone.Whimsical,
    NarrationTone.Comedic,
    NarrationTone.Noir,
    NarrationTone.Suspenseful,
];

export const IMAGE_GENERATION_STYLES: ImageGenerationStyle[] = [
    ImageGenerationStyle.DigitalPainting,
    ImageGenerationStyle.Realistic,
    ImageGenerationStyle.ComicBook,
    ImageGenerationStyle.ThreeDRender,
    ImageGenerationStyle.Anime,
    ImageGenerationStyle.PixelArt,
];

export const DIFFICULTIES: Difficulty[] = [
    Difficulty.Easy,
    Difficulty.Normal,
    Difficulty.Hard,
];

export const STACKABLE_TAGS: string[] = [
  'consumable',
  'ammunition',
  'food',
  'material',
  'reagent',
  'currency',
  'ingredient',
  'potion',
  'scroll',
  'note',
];

export const ENCOUNTER_MATRIX = {
    encounterTypes: [
        "Kidnapping or Hostage situation",
        "Ambush or hidden trap",
        "Ritual or summoning in progress",
        "Heist or robbery in progress",
        "Escort or protection requested",
        "Stand-off or territory dispute",
        "Lost, wandering, or trapped entity",
        "Magical or natural disaster survival",
        "Information broker or riddle master",
        "Hunt or tracking a fugitive",
        "Quarantine of cursed/infected victims",
        "Smuggling or black market deal",
        "Ancient ruin or vault breach",
        "Duel or trial by combat",
        "Mutiny, rebellion, or riot",
        "Assassination attempt",
        "Magical anomaly or gateway opening",
        "Siege or blockade",
        "Trade, barter, or contract dispute",
        "Divine or otherworldly intervention"
    ],
    entityTypes: [
        "Dragon type or apex predator",
        "Giant type or towering brute",
        "Swarm or horde of small creatures",
        "Undead or resurrected entity",
        "Local law enforcement or military",
        "Crime syndicate or bandit group",
        "Cultists or fanatical zealots",
        "Elemental or nature spirit",
        "Construct, golem, or automated guard",
        "Shapeshifter, mimic, or infiltrator",
        "Feral beasts or corrupted wildlife",
        "Aquatic, amphibious, or swamp beings",
        "Ethereal, ghostly, or incorporeal beings",
        "Demonic, infernal, or abyssal fiend",
        "Celestial, angelic, or luminous being",
        "Nomadic tribe or outcast group",
        "Mercenary band or hired muscle",
        "Magical practitioner(s) or scholars",
        "Sentient plant or fungal life",
        "Eldritch, aberrant, or cosmic horror"
    ],
    conditions: [
        "Explodes or self-destructs in 1 minute.",
        "The environment is actively crumbling, burning, or sinking.",
        "The enemy is an illusion or decoy hiding the real threat.",
        "Complete magical darkness or blinding fog covers the area.",
        "The objective/VIP is highly fragile and easily destroyed.",
        "Magic use causes wild, unpredictable elemental surges.",
        "A third, highly hostile party suddenly enters the fray.",
        "Gravity in the area is reversed or wildly fluctuating.",
        "The enemy is immune to physical attacks; requires a puzzle to defeat.",
        "Time is flowing at different speeds for different combatants.",
        "The entities involved are under a powerful mind-control spell.",
        "The area is flooded with a toxic or hallucinogenic gas.",
        "The enemy splits into aggressive duplicates when struck.",
        "Communication is scrambled; no one can speak or be understood.",
        "Combatants are physically or magically tethered to one another.",
        "An artifact in the room is slowly draining everyone's life force.",
        "The \"enemy\" is desperately trying to surrender or beg for help.",
        "The floor is incredibly fragile (ice, rotten wood, glass) over a chasm.",
        "Completing the objective immediately triggers a massive trap.",
        "Victory requires healing/saving the enemy rather than killing them."
    ]
};
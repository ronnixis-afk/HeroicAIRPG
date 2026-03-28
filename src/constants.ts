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

export const POI_MATRIX = {
    fantasy: {
        baseTypes: [
            "Cave / Cavern",
            "Ancient Ruin",
            "Shrine / Altar",
            "Encampment",
            "Tower / Spire",
            "Excavation Site",
            "Tunnel / Shaft",
            "Bridge / Crossing",
            "Monolith / Obelisk",
            "Crossroads"
        ],
        modifiers: [
            "Bandit Hideout",
            "Haunted / Cursed",
            "Abandoned / Forgotten",
            "Heavily Trapped",
            "Monster Lair",
            "Secret Stash",
            "Guarded / Patrolled",
            "Illusionary / Shifting",
            "Sealed / Locked",
            "Smuggler's Den"
        ],
        flavors: [
            "A trail of fresh, glistening blood leads into the darkness.",
            "Strange, glowing runes are etched haphazardly around the perimeter.",
            "An eerie, resonant magical hum can be felt vibrating in the teeth.",
            "The bleached skeletons of previous adventurers are scattered nearby.",
            "A crude, blood-stained wooden sign reads \"Turn Back or Die.\"",
            "Unnatural flora grows here in vibrant, pulsing, unnatural colors.",
            "Faint, maddening whispers echo continuously from the depths.",
            "Rusted metallic scraps and shattered weapons litter the ground.",
            "The air surrounding the immediate area feels unnaturally freezing.",
            "A peculiar, sweet incense burns nearby, failing to mask a foul odor."
        ]
    },
    modern: {
        baseTypes: [
            "Industrial Warehouse",
            "Transit Station",
            "Corporate Office / Clinic",
            "Underground Network / Sewer",
            "Parking Structure",
            "Construction Site",
            "Recreation Area / Park",
            "Intersection / Overpass",
            "Disposal Site / Junkyard",
            "Rooftop / Helipad"
        ],
        modifiers: [
            "Quarantined / Biohazard",
            "Gang-Controlled",
            "Heavily Surveilled",
            "Abandoned / Condemned",
            "Secretly Fortified",
            "Black Market / Smuggler Den",
            "Pitch Black / Grid Failure",
            "Active Crime Scene",
            "Cultist Front",
            "Structurally Unstable"
        ],
        flavors: [
            "A discarded, blood-stained burner phone rings incessantly on the ground.",
            "Flickering neon lights cast long, erratic shadows across the walls.",
            "The constant, low hum of a heavy hidden generator vibrates through the floor.",
            "Thick, choking smog hangs heavy in the air, smelling sharply of ozone.",
            "Shattered safety glass crunches loudly underfoot with every step.",
            "A heavily modified, idling vehicle sits nearby with its doors wide open.",
            "Faint police sirens wail in the distance, slowly but surely growing closer.",
            "Fresh spray paint on the wall forms a strange, unsettling symbol.",
            "Stacks of redacted corporate documents are hastily burning in a rusted barrel.",
            "Distorted elevator muzak plays softly from a sparking, half-broken speaker."
        ]
    },
    scifi: {
        baseTypes: [
            "Derelict Vessel",
            "Research Outpost",
            "Mining Extraction Facility",
            "Spatial Anomaly",
            "Relay Station / Comm Buoy",
            "Orbital Habitat",
            "Debris Field / Wreckage",
            "Automated Drone Hive",
            "Smuggler's Cache",
            "Alien Monolith / Precursor Ruin"
        ],
        modifiers: [
            "Controlled by Rogue AI",
            "Quarantined / Locked Down",
            "Overrun by Bio-Horrors",
            "Heavily Irradiated",
            "Caught in a Gravity Well",
            "Stripped by Scavengers",
            "Broadcasting a Distress Signal",
            "Cloaked / Stealth-Activated",
            "Protected by Active Turrets",
            "Caught in a Temporal Distortion"
        ],
        flavors: [
            "Faint, bioluminescent spores cling suspiciously to the bulkheads.",
            "Holographic warning signs flicker rapidly in a dead, unknown language.",
            "A rhythmic, metallic banging echoes eerily over the open comms channel.",
            "The area is littered with frozen, perfectly preserved crew corpses.",
            "Artificial gravity fluctuates wildly, causing loose debris to float and crash.",
            "Strange, geometric shadows seem to move independently of the light sources.",
            "The local starlight is unnaturally warped and bent around the location.",
            "A looping audio log plays a terrifying, corrupted final testament.",
            "Unidentified, fibrous biological webbing covers the main access points.",
            "The unmistakable, deep hum of an overloading power core vibrates the teeth."
        ]
    },
    magitech: {
        baseTypes: [
            "Etheric Spire",
            "Synchronized Citadel",
            "Prime-Logic Depot",
            "Essence-Forge Precinct",
            "Crystal-Link Relay",
            "Arcane Factory",
            "Golemetric Lab",
            "Pneumatic Transit Hub",
            "Alchemical Refinery",
            "Levitation Platform"
        ],
        modifiers: [
            "Leaking Raw Resonance",
            "Overclocked / Unstable",
            "Abandoned / Corroded",
            "Highly Pressurized",
            "Automated / Guarded",
            "Flux-Corrupted",
            "Techno-Arcane Shielded",
            "Drained of Power",
            "Vibrating with Resonance",
            "Experimental / Top-Secret"
        ],
        flavors: [
            "Glowing blue fluid pulses through translucent pipes in the walls.",
            "The rhythmic hiss of escaping mana-vapor nearly drowns out the heavy clanking.",
            "Sparks of wild magic jump between copper coils and floating crystals.",
            "A faint scent of ozone and lavender oil hangs heavy in the air.",
            "Automated linkages turn overhead, casting shifting, complex shadows.",
            "A discarded schematic for a sentient machine lies charred on the floor.",
            "The air feels thick and static, making hair stand on end.",
            "Broken golem parts litter the entrance, their eyes flickering dimly.",
            "Small, floating maintenance drones buzz erratically around the area.",
            "Ancient runes and digital displays overlap in a confusing symbology."
        ]
    }
};
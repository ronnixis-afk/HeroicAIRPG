// constants/zoneProperties.ts

export const ZONE_PROPERTIES = {
    Fantasy: [
        "Mana Density: Dictates the strength of magic in the air. (Variants: Dead Zone, Normal, Highly Saturated, Wild/Unstable)",
        "Mythic Threat Level: The types of creatures roaming the area. (Variants: Mundane beasts, Goblinoid hordes, Undead infestation, Apex/Dragon territory)",
        "Leyline Connectivity: How the zone interacts with the world's magical grid. (Variants: Isolated, Nexus Point, Corrupted Leyline)",
        "Divine Alignment: The spiritual atmosphere of the zone. (Variants: Blessed by the Light, Forsaken, Cursed, Ancient Pagan)",
        "Dominant Terrain/Biome: The physical landscape, often magically altered. (Variants: Whispering Woods, Scorched Wasteland, Floating Archipelagos, Crystal Caverns)",
        "Socio-Political State: Who is in charge and how they rule. (Variants: Feudal Kingdom, Theocracy, Lawless Frontier, Elven Isolationists)",
        "Weather Anomaly: Magical or extreme weather patterns. (Variants: Eternal Twilight, Blood Rain, Chrono-storms, Ash-fall)",
        "Ruins & Relics: The state of ancient history in the area. (Variants: Untouched First-Age Ruins, Looted Tombs, Awakened Colossi)",
        "Resource Abundance: What the zone provides to travelers. (Variants: Teeming with rare herbs, Rich in mythril ore, Barren/Starving)",
        "Local Superstition/Law: A unique societal rule the AI can use for roleplay. (Variants: 'Magic is outlawed', 'Strangers are sacrificed', 'Always leave an offering at crossroads')"
    ],
    Modern: [
        "Urban Density: The physical crowding and infrastructure. (Variants: Sprawling Metropolis, Claustrophobic Slums, Abandoned Industrial, High-Rise Elite)",
        "Corporate Control: The level of monopoly a megacorp has over the zone. (Variants: Company Town, Contested Turf, Independent/Mom-and-Pop, Corporate Black Site)",
        "Underworld Activity: The criminal element. (Variants: Heavily Policed/Safe, Yakuza Territory, Petty Gang War, Hacker Haven)",
        "Technological Integration: The state of local tech. (Variants: Cutting-Edge/Smart City, Decaying/Analog, Heavy Surveillance)",
        "Socioeconomic Status: The wealth of the area. (Variants: One-Percenter Enclave, Working Class, Destitute/Homeless)",
        "Environmental Hazard: Modern ecological issues. (Variants: Smog/Pollution heavy, Bio-hazard quarantine, Pristine/Gated parkland)",
        "Law Enforcement Presence: How the rules are kept. (Variants: Militarized Riot Police, Private PMC Security, Corrupt Cops, Lawless)",
        "Media Influence: What information the locals consume. (Variants: Heavy Propaganda, Pirate Radio broadcasts, Complete Info-Blackout)",
        "Hidden Subculture: The secret heart of the zone. (Variants: Underground fight clubs, Doomsday prepper cult, Vigilante network)",
        "Infrastructure State: The physical condition of the zone. (Variants: Gentrified, Under Construction, Crumbling/Condemned)"
    ],
    'Sci-Fi': [
        "Stellar Proximity: Where the zone is located in space. (Variants: Deep Space/Rogue Planet, Binary Star Orbit, Black Hole Event Horizon, Nebula Core)",
        "Atmospheric & Biosphere State: The planetary conditions. (Variants: Toxic/Acidic, Fully Terraformed, Vacuum/Airless, Nanite-infested Biosphere)",
        "Dominant Species/Authority: Who controls the system. (Variants: Human Colony Alliance, Alien Hive Mind, Synthetic/AI Overlords, Multi-species Hub)",
        "Tech Level Rating: The technological advancement of the system. (Variants: Pre-FTL primitives, Post-Scarcity Utopia, Scavenger/Junker Fleet)",
        "Gravity & Physics Modifier: How the laws of physics apply. (Variants: Zero-G station, Crushing High Gravity, Variable/Flickering Gravity)",
        "Interstellar Trade Status: The system's economic importance. (Variants: Major Galactic Hub, Blockaded/Embargoed, Uncharted/Wild Space)",
        "Cosmic Hazard: Immediate space-faring dangers. (Variants: Lethal Solar Flares, Dense Asteroid Field, Subspace Rifts)",
        "Political Allegiance: The factional alignment. (Variants: Galactic Federation core, Rebel Outpost, Pirate Warlord Territory)",
        "Primary Output: Why people go there. (Variants: Rare Isotope Mining, Agrarian/Food Production, Antimatter Refineries, Shipyards)",
        "Anomalous Phenomenon: A sci-fi mystery for the AI to exploit. (Variants: Time dilation field, Psionic echo chamber, Derelict Dyson Sphere)"
    ],
    Magitech: [
        "Aetheric Resonance: The frequency of the magical field in the zone. (Variants: Harmonic/Empowering, Dissonant/Damaging, Null-Magic Void)",
        "Technomantic Infrastructure: The scale of magical engineering. (Variants: Clockwork Solar System, Rune-gate Hub, Continental Mana-forges)",
        "Power Source: What fuels the planets and space stations. (Variants: Captured Dying Star, Mass Soul Engines, Churned Ley-crystal Cores)",
        "Ruling Caste: Who holds the reigns of the magitech. (Variants: Arch-Mage Syndicate, Cyber-Lich Dynasty, Artificer Guilds, Inquisition of the Gear)",
        "Construct Population: The synthetic lifeforms present. (Variants: Sentient Brass Golems, Bound Stellar Elementals, Homunculi workforce)",
        "Astral Alignment: How the system touches other dimensions. (Variants: Planar Convergence, Void-touched/Eldritch, Celestially Shielded)",
        "Space-Time Stability: The side effects of combining magic and warp tech. (Variants: Temporal Echoes, Warped Gravity Wells, Stasis Fields)",
        "Travel Medium: How ships navigate the zone. (Variants: Aether-currents, Ancient Warp-gates, Spelljammer docks, Astral Rifts)",
        "Arcane Hazard: The 'pollution' of magitech. (Variants: Wild Magic Storms, Mana Fallout Zones, Ethereal Parasite Swarms)",
        "Planetary Biome (Magitech): The physical state of the planets. (Variants: Biomechanical Flora, Liquid Mercury Oceans, Crystalline Forests)"
    ]
};

/**
 * Returns 1 to 4 random properties from the given theme.
 * @param theme The current game theme (Fantasy, Modern, Sci-Fi, Magitech)
 * @returns Array of random property strings
 */
export const getRandomZoneProperties = (theme: string): string[] => {
    // Map the incoming theme string to one of our keys safely
    let mappedTheme: keyof typeof ZONE_PROPERTIES = 'Fantasy';

    const lowerTheme = theme.toLowerCase();
    if (lowerTheme.includes('modern')) mappedTheme = 'Modern';
    else if (lowerTheme.includes('sci-fi') || lowerTheme.includes('scifi')) mappedTheme = 'Sci-Fi';
    else if (lowerTheme.includes('magitech')) mappedTheme = 'Magitech';

    const properties = ZONE_PROPERTIES[mappedTheme];

    // Roll 1d4 for number of properties
    const numProperties = Math.floor(Math.random() * 4) + 1;

    // Shuffle and pick
    const shuffled = [...properties].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numProperties);
};

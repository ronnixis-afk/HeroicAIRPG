export const LANGUAGE_TECHNIQUES_MAP: Record<string, string> = {
    nordic: "Use Nordic names and double the internal vowels and swap standard consonants for v, y, or rr to create a resonant, ancient-sounding name.",
    germanic: "Use Germanic names and use heavy clusters like sch, tz, and kh with terminal x or z for a sharp, industrial, and utilitarian feel.",
    chinese: "Use Chinese names and focus on monosyllabic roots ending in -ng or -nn while swapping traditional pinyin for x, q, and zhy.",
    korean: "Use Korean names and utilize two-syllable blocks separated by a soft glide and double-up terminal consonants like -kk or -nn for a punchy finish.",
    arabic: "Use Arabic names and incorporate deep guttural sounds using kh, qh, and ' (apostrophes) to simulate a dry, desert-born ancient dialect.",
    mongolian: "Use Mongolian names and stack wide vowels and rolling rr sounds to give names a sense of vast, open-space scale and nomadic power.",
    georgian: "Use Georgian names and group three or more consonants together without vowels to create a mechanical, 'clicking gear' aesthetic for a robotic race.",
    xhosa: "Use Xhosa names and integrate non-alphabetical symbols like !, //, or || to represent non-human clicking phonemes and biological sounds.",
    dutch: "Use Dutch names and soften harsh percussive sounds by using gh instead of g and stretching out vowels like oo and ee.",
    finnish: "Use Finnish names and create an ethereal, melodic flow by doubling every vowel and avoiding most harsh consonants except for t and k.",
    japanese: "Use Japanese names and follow a strict 'Consonant + Vowel' pattern but replace standard letters with y, z, and x for a clean, digital look.",
    italian: "Use Italian names and use rhythmic, vowel-heavy endings like -io or -eo while replacing starting letters with v, ph, or z.",
    hawaiian: "Use Hawaiian names and minimize consonant use to almost zero and stack three or more different vowels together for a fluid, aquatic sound.",
    quechua: "Use Quechua names and prioritize the letters q and k in short, percussive bursts to create a 'high-altitude,' tribal mountain vibe.",
    hungarian: "Use Hungarian names and use rare visual combinations like zs, cs, and sz to make the name look visually distinct and culturally impenetrable.",
    turkish: "Use Turkish names and apply 'vowel harmony' where every vowel in the name belongs to the same sound family for a highly engineered, logical feel.",
    russian: "Use Russian names and lean into heavy sh, ch, and zh sounds combined with the letter v for an imposing, 'Heavy Command' tone.",
    vietnamese: "Use Vietnamese names and use apostrophes and varied vowel heights (yee, uua) to mimic a digital, staccato tonal code.",
    welsh: "Use Welsh names and replace standard vowels with w and y and use ll or dd clusters for a cryptic, Druidic, and ancient appearance.",
    nahuatl: "Use Nahuatl names and end names with the -tl or -xtl suffix to instantly evoke the feeling of a 'Precursor' or 'Elder God' species."
};

export const LANGUAGE_TECHNIQUES = Object.values(LANGUAGE_TECHNIQUES_MAP);

export const HUMAN_LANGUAGE_TECHNIQUE = "Use English naming techniques.";

/**
 * Maps common D&D race keywords to their best-fit naming styles.
 */
export const RACE_STYLE_MAPPING: Record<string, string> = {
    'elf': 'finnish',
    'elven': 'finnish',
    'dwarf': 'germanic',
    'dwarven': 'germanic',
    'halfling': 'dutch',
    'dragonborn': 'nahuatl',
    'dragon': 'nahuatl',
    'gnome': 'turkish',
    'orc': 'russian',
    'tiefling': 'arabic',
    'half-elf': 'welsh',
    'wood-elf': 'welsh',
    'robotic': 'georgian',
    'automaton': 'georgian',
    'mountain': 'quechua'
};

/**
 * Returns the recommended naming style for a race name based on keywords.
 */
export const getNamingStyleForRace = (raceName: string): string | null => {
    const lowerName = raceName.toLowerCase();
    for (const [keyword, styleKey] of Object.entries(RACE_STYLE_MAPPING)) {
        if (lowerName.includes(keyword)) {
            return LANGUAGE_TECHNIQUES_MAP[styleKey];
        }
    }
    return null;
};

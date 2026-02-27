
/**
 * Parses a damage string (e.g., "1d8+3", "2d6", "1d4-1") to extract the static bonus.
 * This is used by the client to ensure damage bonuses are always applied correctly.
 * @param damage The damage string to parse.
 * @returns The static bonus as a number.
 */
export const parseDamageString = (damage: string): number => {
    if (!damage) return 0;

    // This regex looks for a + or - sign, followed by optional whitespace, and then captures the digits.
    // It will find the first such bonus in a string like "1d6+2 piercing + 1d4 fire".
    const match = damage.match(/([+-])\s*(\d+)/);

    if (match && match[1] && match[2]) {
        const sign = match[1];
        const value = parseInt(match[2], 10);
        
        if (isNaN(value)) return 0;

        return sign === '-' ? -value : value;
    }
    return 0;
};

/**
 * Parses a dice string into its components (count, sides, bonus).
 * Robustly handles various formats like "1d6", "2d8 + 3", "d20", "4".
 */
export const parseDiceString = (diceString: string): { count: number; sides: number; bonus: number } => {
    const cleanStr = (diceString || '').toLowerCase().replace(/\s/g, '');
    
    // Match standard dice notation: XdY(+Z)
    const match = cleanStr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    
    if (match) {
        const count = match[1] ? parseInt(match[1], 10) : 1;
        const sides = parseInt(match[2], 10);
        const bonus = match[3] ? parseInt(match[3], 10) : 0;
        return { count, sides, bonus };
    }
    
    // Handle flat numbers (e.g. "1" for unarmed damage sometimes)
    const flat = parseInt(cleanStr, 10);
    if (!isNaN(flat)) {
        return { count: flat, sides: 0, bonus: 0 }; // effectively flat damage
    }

    return { count: 1, sides: 4, bonus: 0 }; // Fallback
};

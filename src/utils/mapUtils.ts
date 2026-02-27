export const getTravelSpeed = (method: string): number => {
    const m = method.toLowerCase();
    if (m.includes('teleport') || m.includes('portal')) return 9999; // Instant
    if (m.includes('flight') || m.includes('fly') || m.includes('airship')) return 40;
    if (m.includes('ship') || m.includes('boat') || m.includes('sail')) return 6;
    if (m.includes('horse') || m.includes('mount') || m.includes('ride')) return 6;
    if (m.includes('cart') || m.includes('wagon') || m.includes('carriage')) return 4;
    return 3; // Walking (Default)
};

export const parseCoords = (coords: string): { x: number, y: number } | null => {
    if (!coords) return null;
    
    // Use regex to capture integers that might include leading negative signs
    // This allows coordinates like "-1-2" or "0--5" to be parsed correctly.
    const match = coords.match(/^(-?\d+)-(-?\d+)$/);
    if (!match) return null;

    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    
    if (isNaN(x) || isNaN(y)) return null;
    return { x, y };
};

/**
 * Robustly parses hostility. AI sometimes returns strings like "High" or "Low".
 * This ensures the rest of the app receives a valid integer.
 */
export const parseHostility = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val !== 'string') return 0;

    const lower = val.toLowerCase();
    if (lower.includes('high') || lower.includes('deadly')) return 15;
    if (lower.includes('low') || lower.includes('safe')) return -10;
    if (lower.includes('med') || lower.includes('neutral')) return 0;
    if (lower === 'nan') return 0;
    
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Normalizes a locale name for comparison.
 * Strips common articles and removes sub-descriptors in parentheses or after colons.
 */
export const normalizeLocale = (name: string): string => {
    return (name || "")
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthesis and their content
        .split(':')[0]                 // Stop at colons
        .trim();
};

/**
 * Checks if two locale names refer to the same spatial container.
 * Supports parent-child relationships (e.g., "The Bar" matches "The Bar (Table)").
 */
export const isLocaleMatch = (poi1: string, poi2: string): boolean => {
    const n1 = normalizeLocale(poi1);
    const n2 = normalizeLocale(poi2);
    if (!n1 || !n2) return false;
    
    // Exact normalized match
    if (n1 === n2) return true;

    // Word-boundary aware prefix matching
    // Allows "The Bar" to match "The Bar Table" or "The Bar (Restroom)"
    const checkPrefix = (a: string, b: string) => a.startsWith(b) && (a.length === b.length || a[b.length] === ' ' || a[b.length] === '(');
    
    return checkPrefix(n1, n2) || checkPrefix(n2, n1);
};
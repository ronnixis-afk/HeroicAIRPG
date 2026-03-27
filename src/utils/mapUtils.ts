import { MapZone } from '../types';

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

export const normalizeCoords = (coords: string): string => {
    const parsed = parseCoords(coords);
    if (!parsed) return (coords || "").trim();
    return `${parsed.x}-${parsed.y}`;
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

/**
 * Calculates a basic Jaccard similarity between two strings based on character n-grams (3-grams).
 * Returns a score between 0 and 1.
 */
export const checkNameSimilarity = (name1: string, name2: string): number => {
    const s1 = normalizeLocale(name1);
    const s2 = normalizeLocale(name2);
    
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8; // High similarity if one contains the other

    const getGrams = (str: string) => {
        const grams = new Set<string>();
        for (let i = 0; i < str.length - 2; i++) {
            grams.add(str.substring(i, i + 3));
        }
        return grams;
    };

    const grams1 = getGrams(s1);
    const grams2 = getGrams(s2);
    
    if (grams1.size === 0 || grams2.size === 0) return 0;

    const intersection = new Set([...grams1].filter(x => grams2.has(x)));
    const union = new Set([...grams1, ...grams2]);

    return intersection.size / union.size;
};

/**
 * Checks if a name is too similar to any name in an array of existing names.
 * Threshold defaults to 0.5 (where 1.0 is identical).
 */
export const isNameTooSimilar = (newName: string, existingNames: string[], threshold: number = 0.5): boolean => {
    if (!newName || !existingNames.length) return false;
    return existingNames.some(existing => checkNameSimilarity(newName, existing) >= threshold);
};

/**
 * Detects the POI theme based on the world summary.
 * Priority: Sci-Fi > Magitech > Modern > Fantasy
 */
export const getPOITheme = (worldSummary: string): 'fantasy' | 'modern' | 'scifi' | 'magitech' => {
    const summaryLower = (worldSummary || '').toLowerCase();
    
    // 1. Sci-Fi (includes Cyberpunk)
    if (
        summaryLower.includes('sci-fi') || 
        summaryLower.includes('scifi') || 
        summaryLower.includes('spaceship') || 
        summaryLower.includes('futuristic') || 
        summaryLower.includes('galaxy') || 
        summaryLower.includes('space') || 
        summaryLower.includes('cyberpunk') || 
        summaryLower.includes('neon') || 
        summaryLower.includes('high-tech') || 
        summaryLower.includes('plasma') ||
        summaryLower.includes('void') ||
        summaryLower.includes('orbit')
    ) {
        return 'scifi';
    }

    // 2. Magitech (includes Steampunk/Clockwork)
    if (
        summaryLower.includes('magitech') || 
        summaryLower.includes('clockwork') || 
        summaryLower.includes('steampunk') || 
        summaryLower.includes('manapunk') || 
        summaryLower.includes('arcane techn') || 
        summaryLower.includes('aether') || 
        summaryLower.includes('alchemical engine') ||
        summaryLower.includes('steam engine')
    ) {
        return 'magitech';
    }

    // 3. Modern (Narrowed to prevent false positives from Sci-Fi/Magitech cities)
    if (
        summaryLower.includes('modern day') || 
        summaryLower.includes('contemporary') || 
        summaryLower.includes('today') || 
        summaryLower.includes('earth') || 
        summaryLower.includes('21st century') || 
        summaryLower.includes('urban fantasy') ||
        summaryLower.includes('noir') ||
        summaryLower.includes('smartphone') ||
        summaryLower.includes('internet')
    ) {
        return 'modern';
    }

    // 4. Fantasy (Default)
    return 'fantasy';
};

export const SETTLEMENT_TAG_MAP: Record<string, Record<string, string>> = {
    fantasy: {
        tavern: 'Tavern',
        stable: 'Stables',
        merchant: 'Marketplace',
        forge: 'Item Forge',
        shipyard: 'Shipyard'
    },
    modern: {
        tavern: 'Bar',
        stable: 'Garage',
        merchant: 'Store',
        forge: 'Workshop',
        shipyard: 'Harbor'
    },
    scifi: {
        tavern: 'Cantina',
        stable: 'Hangar',
        merchant: 'Trading Hub',
        forge: 'Nanofabricator',
        shipyard: 'Spaceport'
    },
    magitech: {
        tavern: 'Social Hub',
        stable: 'Mech Bay',
        merchant: 'Trade Depot',
        forge: 'Tech Forge',
        shipyard: 'Dock'
    }
};

export const resolveSettlementTags = (zone: MapZone | undefined, theme: string): string[] => {
    if (!zone) return [];
    const tags: string[] = [];
    const mapping = SETTLEMENT_TAG_MAP[theme.toLowerCase()] || SETTLEMENT_TAG_MAP.fantasy;
    const features = (zone.zoneFeatures || []).map(f => f.toLowerCase());
    const pop = (zone.populationLevel || 'Barren').toLowerCase();

    // 1. Tavern / Recruitment (Settlement+)
    if (['settlement', 'town', 'city', 'capital'].includes(pop) || features.includes('tavern')) {
        tags.push(mapping.tavern);
    }
    // 2. Stable / Mounts (Start at Town)
    if (['town', 'city', 'capital'].includes(pop) || features.includes('stable')) {
        tags.push(mapping.stable);
    }
    // 3. Merchant (Start at Town or via Market feature)
    if (['town', 'city', 'capital'].includes(pop) || features.includes('market') || features.includes('marketplace')) {
        tags.push(mapping.merchant);
    }
    // 4. Forge (Start at City or via Item Forge feature)
    if (['city', 'capital'].includes(pop) || features.includes('item forge')) {
        tags.push(mapping.forge);
    }
    // 5. Shipyard (Feature based)
    if (features.includes('shipyard')) {
        tags.push(mapping.shipyard);
    }

    return tags;
};

/**
 * systemRandom.ts
 * Provides a high-entropy, system-managed randomizer.
 */

/**
 * Returns a cryptographically strong random integer between min (inclusive) and max (inclusive).
 * This ensures "proper" randomization that is not subject to Math.random()'s potential biases
 * in specific browser environments.
 */
export const getSystemRandom = (min: number, max: number): number => {
    const range = max - min + 1;
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const result = min + (array[0] % range);
    console.log(`[SystemRandom] Generated hookIndex: ${result} (Range: ${min}-${max})`);
    return result;
};

/**
 * Ensures that the randomized result is different from the last N results stored in localStorage.
 * This satisfies the user's perception of "properly randomized" by preventing immediate repeats.
 */
export const getFairSystemRandom = (min: number, max: number, key: string, historySize: number = 5): number => {
    let history: number[] = [];
    try {
        const stored = localStorage.getItem(`fair_random_${key}`);
        if (stored) history = JSON.parse(stored);
    } catch (e) { }

    let result = getSystemRandom(min, max);
    let attempts = 0;

    // Try to find a value not in the recent history
    while (history.includes(result) && attempts < 20) {
        result = getSystemRandom(min, max);
        attempts++;
    }

    history.push(result);
    if (history.length > historySize) history.shift();

    try {
        localStorage.setItem(`fair_random_${key}`, JSON.stringify(history));
    } catch (e) { }

    return result;
};


const normalizeLocale = (name) => {
    return (name || "")
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/\s*\(.*?\)\s*/g, '')
        .split(':')[0]
        .trim();
};

const checkNameSimilarity = (name1, name2) => {
    const s1 = normalizeLocale(name1);
    const s2 = normalizeLocale(name2);
    
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    const getGrams = (str) => {
        const grams = new Set();
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

const testCases = [
    { n1: "The Iron Forge", n2: "Iron Forge", expected: 0.8 },
    { n1: "Dark Forest", n2: "Deep Woods", expected: 0 },
    { n1: "Whispering Woods", n2: "Whisper Wood", expected: 0.8 },
    { n1: "Dragon's Lair", n2: "The Dragon Lair", expected: 0.8 },
    { n1: "Silent Peak", n2: "Silent Peaks", expected: 0.8 },
];

console.log("Similarity Test Results:");
testCases.forEach(tc => {
    const score = checkNameSimilarity(tc.n1, tc.n2);
    console.log(`[${tc.n1}] vs [${tc.n2}] -> Score: ${score.toFixed(2)}`);
});


import { checkNameSimilarity, isNameTooSimilar } from '../src/utils/mapUtils';

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
    console.log(`[${tc.n1}] vs [${tc.n2}] -> Score: ${score.toFixed(2)} (Expected similarity: ${tc.expected > 0 ? 'High' : 'Low'})`);
});

const existing = ["The Iron Forge", "Dark Forest", "Whispering Woods"];
const testNames = ["Iron Forge", "Deep Woods", "Whisper Wood", "Hidden Valley"];

console.log("\nUniqueness Check (threshold 0.5):");
testNames.forEach(name => {
    const isTooSimilar = isNameTooSimilar(name, existing, 0.5);
    console.log(`Name: [${name}] -> Too Similar? ${isTooSimilar}`);
});

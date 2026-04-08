
import { isRangedItem } from '../src/services/ItemGeneratorService';

const testCases = [
    { name: 'Longbow', expected: true },
    { name: 'Crossbow', expected: true },
    { name: 'Laser Rifle', expected: true },
    { name: 'Plasma Pistol', expected: true },
    { name: 'Greatsword', expected: false },
    { name: 'Dagger', expected: false },
    { name: 'Handgun', expected: true },
    { name: 'Revolver', expected: true },
    { name: 'Railgun', expected: true },
    { name: 'Sling', expected: true },
    { name: 'Dart', expected: true },
    { name: 'Heavy Cannon', expected: true },
    { name: 'Blaster', expected: true },
    { name: 'Combat Knife', expected: false }
];

console.log('--- Testing isRangedItem ---');
testCases.forEach(tc => {
    const result = isRangedItem({ name: tc.name });
    console.log(`Name: ${tc.name.padEnd(15)} | Result: ${result} | Expected: ${tc.expected} | ${result === tc.expected ? '✅' : '❌'}`);
});

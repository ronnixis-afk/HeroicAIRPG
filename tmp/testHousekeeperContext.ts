import { performHousekeeping } from '../src/services/aiHousekeeperService';
import { GameData } from '../src/types';

// Mock GameData
const mockGameData = {
    playerInventory: {
        equipped: [{ name: 'Silver Rapier' }],
        carried: [{ name: 'Healing Potion', quantity: 1 }],
        storage: [],
        assets: []
    },
    companionInventories: {
        'comp-1': {
            equipped: [],
            carried: [{ name: 'Iron Shield' }],
            storage: [],
            assets: []
        }
    },
    companions: [{ id: 'comp-1', name: 'Althea' }],
    npcs: [],
    messages: [],
    currentLocale: 'Abandoned Mine'
} as unknown as GameData;

async function test() {
    process.env.GEMINI_API_KEY = "dummy"; // Prevent client failure if it checks env
    
    console.log("--- TEST 1: Duplicate Prevention ---");
    // Since we are mocking the fetch in aiClient, we need to be careful if we actually run it.
    // For now, let's just inspect the prompt generation logic by localizing it or mocking the AI call.
}

console.log("Mock data ready. Skipping actual AI call in CLI to avoid fetch errors.");

/* eslint-disable no-var */
import type { GameData, DiceRollRequest, DiceRoll } from './Core';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    /** Typed global cache for non-React services to access current game state */
    gameDataCache?: GameData;
    /** Typed global cache for dice roll processing function */
    processDiceRollsCache?: (requests: DiceRollRequest[]) => {
      rolls: DiceRoll[];
      summary: string;
    };
    /** Typed global cache for Gemini response function */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getGeminiResponse?: (userMessage: any, gameData: GameData) => Promise<any>;
  }
}

export {};

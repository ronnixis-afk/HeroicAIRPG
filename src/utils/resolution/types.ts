
import { GameData, DiceRollRequest, DiceRoll } from '../../types';

export interface ResolutionContext {
    gameData: GameData;
    request: DiceRollRequest;
}

export interface ResolutionResult {
    rolls: DiceRoll[];
    hpUpdates: Map<string, number>;
    statusUpdates: Map<string, any[]>;
    summaryLog: string[];
}

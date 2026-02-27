import { useCallback } from 'react';
import { GameData, ActorSuggestion } from '../../types';
import { generateSystemCombatants } from '../../utils/mechanics';
import { parseHostility } from '../../utils/mapUtils';

export const useWorldSelectors = (gameData: GameData | null) => {
    
    const getCurrentZoneHostility = useCallback((): number => {
        if (!gameData) return 0;
        const currentZone = gameData.mapZones?.find(z => z.coordinates === gameData.playerCoordinates);
        return currentZone ? parseHostility(currentZone.hostility) : 0;
    }, [gameData]);

    /**
     * Calculates a randomized set of reinforcement slots based on a "Power Deficit".
     * Costs: Boss (2.0), Elite (1.5), Normal (1.0), Weak (0.5).
     */
    const getCombatSlots = useCallback((): Partial<ActorSuggestion>[] => {
        if (!gameData) return [];
        
        const activeCompanions = gameData.companions.filter(c => c.isInParty !== false);
        const partySize = 1 + activeCompanions.length;
        
        // Define Slot Costs for different ranks
        const RANK_COSTS: Record<string, number> = {
            'weak': 0.5,
            'normal': 1.0,
            'elite': 1.5,
            'boss': 2.0
        };

        // 1. Calculate Target Capacity
        // We use the procedural generator to determine how many "slots" this party should handle
        const proceduralTarget = generateSystemCombatants(partySize);
        const targetCapacity = proceduralTarget.length;

        // 2. Calculate Current Scene Power
        const existingHostiles = (gameData.combatState?.enemies || []).filter(e => !e.isAlly);
        const currentPower = existingHostiles.reduce((sum, e) => {
            const rank = (e.rank || 'normal').toLowerCase();
            return sum + (RANK_COSTS[rank] || 1.0);
        }, 0);

        // 3. Determine the Deficit
        let deficit = targetCapacity - currentPower;

        // 4. Fill the deficit with randomized combinations
        const suggestions: Partial<ActorSuggestion>[] = [];
        const options = [
            { difficulty: 'Boss', cost: 2.0 },
            { difficulty: 'Elite', cost: 1.5 },
            { difficulty: 'Normal', cost: 1.0 },
            { difficulty: 'Weak', cost: 0.5 }
        ];

        // Safety cap to prevent infinite loops or over-spawning
        let iterations = 0;
        while (deficit >= 0.5 && iterations < 10) {
            iterations++;
            // Filter options that we can afford with the remaining deficit
            const affordable = options.filter(o => o.cost <= deficit);
            
            if (affordable.length === 0) break;

            // Randomly pick an affordable rank
            const pick = affordable[Math.floor(Math.random() * affordable.length)];
            
            suggestions.push({
                difficulty: pick.difficulty,
                // Pass some context to the AI that these are reinforcements
                description: "Joining the fray to reinforce their allies."
            });

            deficit -= pick.cost;
        }

        // Heroic Moment Logic: If the scene is already balanced but high-level, 
        // occasionally add one "Elite" guard if there isn't one already.
        if (suggestions.length === 0 && partySize >= 3) {
            const hasElite = existingHostiles.some(e => e.rank === 'elite' || e.rank === 'boss');
            if (!hasElite && Math.random() > 0.7) {
                return [{ difficulty: 'Elite', description: 'A powerful captain overseeing the area.' }];
            }
        }

        return suggestions;
    }, [gameData]);

    return {
        getCurrentZoneHostility,
        getCombatSlots
    };
};
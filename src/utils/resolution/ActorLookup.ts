
import { GameData, PlayerCharacter, Companion, CombatActor, Inventory, Ability, CombatActorSpecialAbility, AbilityEffect } from '../../types';

export const findActorAndInventory = (gameData: GameData, nameOrId: string): { actor: PlayerCharacter | Companion | CombatActor, inventory?: Inventory } | null => {
    const { playerCharacter, companions = [], playerInventory, companionInventories = {}, combatState } = gameData;
    
    if (!nameOrId || typeof nameOrId !== 'string') return null;

    const lowerTerm = nameOrId.toLowerCase().trim();
    
    if (!lowerTerm) return null;

    // 1. Exact/ID Matches & Self/Player aliases
    if (lowerTerm === 'player' || lowerTerm === 'self' || lowerTerm === 'me' || lowerTerm === 'you' || lowerTerm === 'party' || nameOrId === playerCharacter.id || playerCharacter.name.toLowerCase() === lowerTerm) {
        return { actor: playerCharacter, inventory: playerInventory };
    }
    
    const companion = companions.find(c => c.name.toLowerCase() === lowerTerm || c.id === nameOrId);
    if (companion) {
        return { actor: companion, inventory: companionInventories[companion.id] };
    }
    
    // Prioritize Exact Name Match for Enemies
    const enemyExact = combatState?.enemies?.find(e => e.name.toLowerCase() === lowerTerm || e.id === nameOrId);
    if (enemyExact) {
        return { actor: enemyExact };
    }

    // 2. Partial Matches
    if (playerCharacter.name.toLowerCase().includes(lowerTerm)) {
         return { actor: playerCharacter, inventory: playerInventory };
    }
    
    const partialCompanion = companions.find(c => c.name.toLowerCase().includes(lowerTerm));
    if (partialCompanion) {
        return { actor: partialCompanion, inventory: companionInventories[partialCompanion.id] };
    }

    const partialEnemy = combatState?.enemies?.find(e => e.name.toLowerCase().includes(lowerTerm));
    if (partialEnemy) {
        return { actor: partialEnemy };
    }

    // 3. Fuzzy/Profession Matches
    if (playerCharacter.profession.toLowerCase().includes(lowerTerm)) {
         return { actor: playerCharacter, inventory: playerInventory };
    }
    
    const compByClass = companions.find(c => c.profession.toLowerCase().includes(lowerTerm));
    if (compByClass) {
        return { actor: compByClass, inventory: companionInventories[compByClass.id] };
    }

    return null;
};

// Helper to find the ability OR ITEM EFFECT on the caster with fuzzy matching
export const lookupAbilityOrItemEffect = (actor: PlayerCharacter | Companion | CombatActor, abilityName: string, inventory?: Inventory): Ability | CombatActorSpecialAbility | AbilityEffect | null => {
    if (!abilityName || typeof abilityName !== 'string') return null;
    const search = abilityName.toLowerCase().trim();
    let abilities: (Ability | CombatActorSpecialAbility)[] = [];
    
    if ('abilities' in actor && actor.abilities) {
        abilities = (actor as PlayerCharacter | Companion).abilities;
    } else if ('specialAbilities' in actor && (actor as CombatActor).specialAbilities) {
        abilities = (actor as CombatActor).specialAbilities || [];
    }
    
    // Check Abilities
    // 1. Exact Match
    let found = abilities.find(a => a.name && a.name.toLowerCase() === search);
    if (found) return found;
    
    // 2. Starts With
    found = abilities.find(a => a.name && a.name.toLowerCase().startsWith(search));
    if (found) return found;
    
    // 3. Includes
    if (search.length >= 3) {
        found = abilities.find(a => a.name && a.name.toLowerCase().includes(search));
        if (found) return found;
    }

    // Check Inventory Items with effects
    if (inventory) {
        const allItems = [...(inventory.equipped || []), ...(inventory.carried || [])];
        
        // Exact
        let item = allItems.find(i => i.name && i.name.toLowerCase() === search && i.effect);
        if (item && item.effect) return item.effect;

        // Starts with
        item = allItems.find(i => i.name && i.name.toLowerCase().startsWith(search) && i.effect);
        if (item && item.effect) return item.effect;

        // Includes
        if (search.length >= 3) {
            item = allItems.find(i => i.name && i.name.toLowerCase().includes(search) && i.effect);
            if (item && item.effect) return item.effect;
        }
    }
    
    return null;
};

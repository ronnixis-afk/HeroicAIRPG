import React from 'react';
import { GameData, CombatState } from '../../types';
import { Icon } from '../Icon';
import Button from '../Button';

interface CombatControlsProps {
    gameData: GameData;
    isLoading: boolean;
    onManualAction: (actorId?: string) => void;
    onAutoResolve: () => void;
    onNpcTurn: (actorId: string) => void;
}

export const CombatControls: React.FC<CombatControlsProps> = ({ gameData, isLoading, onManualAction, onAutoResolve, onNpcTurn }) => {
    const combatState = gameData.combatState;
    if (!combatState?.isActive) return null;

    const { turnOrder, currentTurnIndex } = combatState;
    const currentId = turnOrder[currentTurnIndex];
    const isPlayerTurn = currentId === gameData.playerCharacter.id;
    const isCompanionTurn = gameData.companions.some(c => c.id === currentId);
    // Explicitly make the player and components capable of manual actions or auto-resolves.
    const isManualTurn = isPlayerTurn || isCompanionTurn;
    const isHandsFree = gameData.isHandsFree;

    let actorName = 'Unknown';
    if (isPlayerTurn) actorName = 'Your';
    else {
        const c = gameData.companions.find(c => c.id === currentId);
        if (c) actorName = c.name + "'s";
        else {
            const e = combatState.enemies.find(e => e.id === currentId);
            if (e) actorName = e.name + "'s";
        }
    }

    return (
        <div className="flex flex-col items-center gap-4 py-3 animate-fade-in w-full min-h-[100px]">
            <div className="flex items-center gap-4">
                <div className="h-[1px] w-12 bg-brand-primary/30"></div>
                <div className="text-body-sm font-bold text-brand-text">
                    {isPlayerTurn ? "It's Your Turn" : `${actorName} Turn`}
                </div>
                <div className="h-[1px] w-12 bg-brand-primary/30"></div>
            </div>
            <div className="flex items-center justify-center gap-4">
                {isManualTurn ? (
                    <>
                        <Button
                            onClick={() => onManualAction(isPlayerTurn ? undefined : currentId)}
                            variant="primary"
                            size="md"
                            className="rounded-full px-8"
                            icon="sword"
                        >
                            Take Action {isCompanionTurn ? `(${actorName.replace("'s", "")})` : ''}
                        </Button>
                        {!isHandsFree && (
                            <Button
                                onClick={() => isPlayerTurn ? onAutoResolve() : onNpcTurn(currentId)}
                                variant="secondary"
                                size="md"
                                className="rounded-full px-6"
                                icon="sparkles"
                                title={isPlayerTurn ? "Auto-Resolve Round" : "Auto-Resolve Companion Turn"}
                            >
                                Auto
                            </Button>
                        )}
                    </>
                ) : (
                    isLoading ? (
                        <div className="h-11 w-32 flex items-center justify-center bg-brand-surface/20 rounded-full border border-brand-primary/20 shadow-inner">
                            <div className="w-16 h-1 bg-brand-primary/50 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-accent animate-loading-bar rounded-full"></div>
                            </div>
                        </div>
                    ) : (
                        <Button
                            onClick={() => onNpcTurn(currentId)}
                            variant="secondary"
                            size="md"
                            className="rounded-full px-6"
                            icon="play"
                        >
                            Play Turn
                        </Button>
                    )
                )}
            </div>
        </div>
    );
};

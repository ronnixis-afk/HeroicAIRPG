import React from 'react';
import { GameData, CombatState } from '../../types';
import { Icon } from '../Icon';

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
    const allowManualControl = gameData.combatConfiguration?.manualCompanionControl;
    const isManualTurn = isPlayerTurn || (isCompanionTurn && allowManualControl);
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
        <div className="flex flex-col items-center gap-6 my-8 animate-fade-in w-full min-h-[50px]"> 
            <div className="flex items-center gap-4">
                <div className="h-[1px] w-16 bg-brand-primary/50"></div>
                <div className="text-body-sm font-medium text-brand-text-muted">
                    {isPlayerTurn ? "It's Your Turn" : `${actorName} Turn`}
                </div>
                <div className="h-[1px] w-16 bg-brand-primary/50"></div>
            </div>
            <div className="flex items-center justify-center gap-4">
                {isManualTurn ? (
                    <>
                      <button 
                        onClick={() => onManualAction(isPlayerTurn ? undefined : currentId)} 
                        className="btn-primary btn-md rounded-full px-8 gap-2 shadow-brand-accent/30 font-medium"
                      >
                          <Icon name="sword" className="w-5 h-5" />
                          Take Action {isCompanionTurn ? `(${actorName.replace("'s", "")})` : ''}
                      </button>
                      {isPlayerTurn && !isHandsFree && (
                          <button 
                              onClick={onAutoResolve} 
                              className="btn-secondary btn-md rounded-full px-6 gap-2 font-medium"
                              title="Auto-Resolve Round"
                          >
                              <Icon name="sparkles" className="w-4 h-4" />
                              Auto
                          </button>
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
                        <button 
                            onClick={() => onNpcTurn(currentId)} 
                            className="btn-secondary btn-md rounded-full px-6 gap-2 text-brand-text border-brand-primary/50 font-medium"
                        >
                            <Icon name="play" className="w-3 h-3 text-brand-accent group-hover:scale-110 transition-transform" />
                            <span>Play Turn</span>
                        </button>
                    )
                )}
            </div>
        </div>
    );
};
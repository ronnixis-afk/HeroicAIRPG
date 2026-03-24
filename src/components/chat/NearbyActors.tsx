import React, { useMemo, useState, useEffect, useRef, useContext } from 'react';
/* Fix: Import GameData and NPC from types, not context, to resolve export errors */
import type { GameData, NPC, DiceRollRequest } from '../../types';
import { GameDataContext, GameDataContextType } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { StatusAvatar } from './StatusAvatar';
import { Icon } from '../Icon';
import { isLocaleMatch } from '../../utils/mapUtils';
import { canBeTargeted } from '../../utils/resolution/StatusRules';

interface NearbyActorsProps {
    gameData: GameData;
    refineNPC: (npc: NPC) => Promise<void>;
}

export const NearbyActors: React.FC<NearbyActorsProps> = ({ gameData, refineNPC }) => {
    const { executeInitiationPipeline, processDiceRolls, dispatch } = useContext(GameDataContext) as GameDataContextType;
    const { setInspectedEntity, setSelectedCharacterId, setActiveView, setIsPickpocketModalOpen, setPickpocketTarget } = useUI();
    const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
    const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const lastNearbyIdsRef = useRef<Set<string>>(new Set());
    const menuRef = useRef<HTMLDivElement>(null);

    const activeCompanions = useMemo(() => {
        return gameData.companions.filter(c => c.isInParty !== false);
    }, [gameData.companions]);

    const nearbyNPCs = useMemo(() => {
        const { npcs, currentLocale } = gameData;
        const partyNames = new Set(activeCompanions.map(c => c.name.toLowerCase().trim()));

        return (npcs || []).filter(npc => {
            const npcPOI = npc.currentPOI || "";
            const isAtLocale = isLocaleMatch(npcPOI, currentLocale || "");
            const inParty = npc.companionId || partyNames.has(npc.name?.toLowerCase() || '');
            const isPresent = npc.status?.toLowerCase() !== 'dead' || !npc.isBodyCleared;
            return isAtLocale && !inParty && !npc.isShip && isPresent;
        });
    }, [gameData.npcs, gameData.currentLocale, activeCompanions]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle departure animations
    useEffect(() => {
        // Fix: Explicitly type iteration variable to avoid unknown type inference
        const currentIds = new Set<string>(nearbyNPCs.map((n: NPC) => n.id));
        // Fix: Explicitly type id as string for set compatibility check
        const departed = Array.from(lastNearbyIdsRef.current).filter((id: string) => !currentIds.has(id));

        if (departed.length > 0) {
            // Fix: Explicitly type prev state and use typed collection cloning to resolve assignment errors
            setLeavingIds((prev: Set<string>) => {
                const next = new Set<string>(Array.from(prev));
                departed.forEach((id: string) => next.add(id));
                return next;
            });
            setTimeout(() => {
                // Fix: Explicitly type prev state and use typed collection cloning to resolve assignment errors
                setLeavingIds((prev: Set<string>) => {
                    const next = new Set<string>(Array.from(prev));
                    departed.forEach((id: string) => next.delete(id));
                    return next;
                });
            }, 800);
        }
        // Fix: Assignment is now safe as currentIds is strictly Set<string>
        lastNearbyIdsRef.current = currentIds;
    }, [nearbyNPCs]);

    // Auto-enrichment logic for low-detail NPCs
    useEffect(() => {
        nearbyNPCs.forEach(async npc => {
            const isDefaultDesc = npc.description === 'Analyzing entity...' || !npc.description;
            const needsRefinement = !npc.appearance || isDefaultDesc || !npc.moralAlignment;

            if (needsRefinement && !enrichingIds.has(npc.id)) {
                setEnrichingIds(prev => new Set(prev).add(npc.id));
                try {
                    await refineNPC(npc);
                } catch (e) {
                    console.error("Auto NPC Refinement failed", e);
                } finally {
                    setEnrichingIds(prev => {
                        const next = new Set(prev);
                        next.delete(npc.id);
                        return next;
                    });
                }
            }
        });
    }, [nearbyNPCs, refineNPC, enrichingIds]);

    const displayList = useMemo(() => {
        const leaving = (gameData.npcs || []).filter(n => leavingIds.has(n.id));
        return [...nearbyNPCs, ...leaving];
    }, [nearbyNPCs, leavingIds, gameData.npcs]);

    const handleNpcClick = (npcId: string) => {
        setOpenMenuId(prev => prev === npcId ? null : npcId);
    };

    const handleAttack = (npc: NPC) => {
        // Resolve Surprise Attack if currently in stealth
        if (gameData.isPartyHidden) {
            const surpriseRequest: DiceRollRequest = {
                rollerName: gameData.playerCharacter.name,
                rollType: 'Attack Roll',
                checkName: 'Attack',
                targetName: npc.name
            };

            const result = processDiceRolls([surpriseRequest]);

            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `surprise-atk-${Date.now()}`,
                    sender: 'user',
                    content: `**Surprise Attack!** You strike ${npc.name} from the shadows before the fray officially begins.`,
                    rolls: result.rolls,
                    mode: 'CHAR',
                    type: 'positive'
                }
            });

            // Breaking stealth as the attack is executed
            dispatch({ type: 'SET_PARTY_HIDDEN', payload: { isHidden: false } });
        }

        executeInitiationPipeline(`You Initiate An Attack Against ${npc.name}!`, []);
        setOpenMenuId(null);
    };

    const NPCContextMenu = ({ npc }: { npc: NPC }) => (
        <div className="absolute right-full mr-3 top-0 flex flex-col gap-1 bg-brand-surface/90 backdrop-blur-2xl border border-brand-primary rounded-2xl p-1.5 shadow-2xl animate-fade-in z-[100] min-w-[180px] max-w-[75vw] w-max">
            <div className="px-4 py-3 border-b border-brand-primary/30 mb-1">
                <div className="text-body-sm font-bold text-brand-text whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1.5">
                    {npc.name}
                    {npc.gender?.toLowerCase() === 'male' && <Icon name="male" className="w-3 h-3 text-blue-400" />}
                    {npc.gender?.toLowerCase() === 'female' && <Icon name="female" className="w-3 h-3 text-pink-400" />}
                </div>
                <div className="text-body-sm font-normal text-brand-text-muted capitalize">
                    {npc.race}
                </div>
            </div>

            <button
                onClick={() => { setInspectedEntity({ type: 'npc', data: npc }); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2.5 hover:bg-brand-primary/50 rounded-xl transition-all text-body-sm font-normal text-brand-text flex items-center gap-3 active:bg-brand-accent active:text-black"
            >
                <img src="/icons/people.png" alt="Profile" className="w-8 h-8 object-contain" />
                <span>View Profile</span>
            </button>
            <button
                onClick={() => { setSelectedCharacterId(npc.id); setActiveView('temp-stats'); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2.5 hover:bg-brand-primary/50 rounded-xl transition-all text-body-sm font-normal text-brand-text flex items-center gap-3 active:bg-brand-accent active:text-black"
            >
                <img src="/icons/scene.png" alt="Stats" className="w-8 h-8 object-contain" />
                <span>View Stats</span>
            </button>
            <button
                onClick={() => handleAttack(npc)}
                className="w-full text-left px-4 py-2.5 hover:bg-brand-primary/50 rounded-xl transition-all text-body-sm font-normal text-brand-text flex items-center gap-3 active:bg-brand-accent active:text-black"
            >
                <img src="/icons/attack.png" alt="Attack" className="w-8 h-8 object-contain" />
                <span>Attack</span>
            </button>
            <button
                onClick={() => {
                    setPickpocketTarget(npc);
                    setIsPickpocketModalOpen(true);
                    setOpenMenuId(null);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-brand-primary/50 rounded-xl transition-all text-body-sm font-normal text-brand-text flex items-center gap-3 active:bg-brand-accent active:text-black"
            >
                <img src="/icons/pickpocket.png" alt="Pickpocket" className="w-8 h-8 object-contain" />
                <span>Pickpocket</span>
            </button>

        </div>
    );

    if (displayList.length === 0) return null;

    return (
        <div ref={menuRef} className="flex flex-col items-center mt-6 animate-fade-in">
            <label className="text-[10px] font-bold text-brand-text-muted mb-2 opacity-60">Nearby</label>
            <div className="flex flex-col items-center gap-2">
                {displayList.map(npc => {
                    const isLeaving = leavingIds.has(npc.id);
                    const isMenuOpen = openMenuId === npc.id;

                    return (
                        <div
                            key={npc.id}
                            className={`relative transition-all duration-300 ${npc.isNew ? 'animate-entrance' : ''} ${isLeaving ? 'animate-exit' : ''}`}
                        >
                            <StatusAvatar
                                char={npc}
                                size={30}
                                showName={false}
                                showBars={true}
                                tempHp={npc.temporaryHitPoints}
                                maxTempHp={npc.maxTemporaryHitPoints}
                                isEnriching={enrichingIds.has(npc.id)}
                                isStealthed={!canBeTargeted(npc)}
                                isTargeted={isMenuOpen}
                                onClick={() => !isLeaving && handleNpcClick(npc.id)}
                                className="cursor-pointer"
                            />
                            {isMenuOpen && <NPCContextMenu npc={npc} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

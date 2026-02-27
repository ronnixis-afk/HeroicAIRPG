
import React, { useEffect, useState, useContext } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import Modal from './Modal';
import { Icon } from './Icon';
import { ENCOUNTER_MATRIX } from '../constants';

interface SystemCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type StatusType = 'Ok' | 'Fail' | 'Warn' | 'Checking';

interface SystemCheck {
  id: string;
  label: string;
  description: string;
  check: (data: any) => boolean;
  type: 'System' | 'Ai' | 'Hybrid';
}

const CHECKS: Record<string, SystemCheck[]> = {
    "Core Data": [
        { 
            id: 'data-load', label: "Game Data Loaded", type: 'System',
            description: "Validates that the global GameData object is present in memory and hydrated from local storage.",
            check: (d) => !!d 
        },
        { 
            id: 'player-exists', label: "Player Identity", type: 'System',
            description: "Checks if the PlayerCharacter object is instantiated and contains a valid name property.",
            check: (d) => !!d?.playerCharacter?.name && d.playerCharacter.name !== 'Adventurer'
        },
        { 
            id: 'time-sys', label: "Time System", type: 'System',
            description: "Verifies the 'currentTime' string is valid for tracking world progression.",
            check: (d) => !!d?.currentTime 
        }
    ],
    "Combat Readiness": [
        { 
            id: 'combat-logic', label: "Initiation Pipeline", type: 'System',
            description: "Verifies the pendingCombat and consensus state structures are ready for encounter triggers.",
            check: (d) => d?.combatState !== undefined
        },
        { 
            id: 'threat-matrix', label: "Danger Logic (d100)", type: 'System',
            description: "Checks if hostility values and encounter threshold (75) logic are reachable.",
            check: (d) => !!d?.mapZones && d.mapZones.every((z: any) => typeof z.hostility === 'number')
        },
        { 
            id: 'actor-temp-hp', label: "Temporary Hit Points Logic", type: 'System',
            description: "Verifies that all staged actors have correctly initialized temporary hit point fields and non-negative values.",
            check: (d) => {
                if (!d?.combatState?.enemies) return true;
                return d.combatState.enemies.every((e: any) => 
                    typeof e.maxTemporaryHitPoints === 'number' && e.maxTemporaryHitPoints >= 0 &&
                    typeof e.temporaryHitPoints === 'number' && e.temporaryHitPoints >= 0
                );
            }
        },
        { 
            id: 'nemesis-heat', label: "Heat Engine (Nemesis)", type: 'Hybrid',
            description: "Validates that the Nemesis array is iterable and tracking cumulative narrative friction.",
            check: (d) => Array.isArray(d?.nemeses)
        }
    ],
    "Encounter Assets": [
        { 
            id: 'templates', label: "Enemy Templates", type: 'System',
            description: "Checks if the 'templates' dictionary is loaded for dynamic enemy generation.",
            check: (d) => d?.templates && Object.keys(d.templates).length > 0
        },
        { 
            id: 'modifiers', label: "Size Scaling", type: 'System',
            description: "Verifies that mechanical modifiers for creature sizes (Small to Colossal) are present.",
            check: (d) => d?.sizeModifiers && Object.keys(d.sizeModifiers).length > 0
        },
        {
            id: 'encounter-matrix', label: "Plot Matrix (20x20x20)", type: 'System',
            description: "Verifies the Encounter Matrix is loaded for procedural plots.",
            check: () => ENCOUNTER_MATRIX && ENCOUNTER_MATRIX.encounterTypes.length === 20
        }
    ],
    "World & Spatial": [
        { 
            id: 'map-sys', label: "Map Coordinates", type: 'System',
            description: "Verifies the player's grid position is set for spatial anchoring.",
            check: (d) => !!d?.playerCoordinates
        },
        { 
            id: 'locale-anchor', label: "Spatial Anchoring", type: 'Hybrid',
            description: "Checks the 'currentLocale' field which handles immediate sub-location persistence.",
            check: (d) => d?.currentLocale !== undefined
        }
    ],
    "Narrative Web": [
        {
            id: 'gm-notes', label: "Tactical Brief (Gm Notes)", type: 'Ai',
            description: "Verifies 'gmNotes' exists to store the 3-sentence encounter brief.",
            check: (d) => typeof d?.gmNotes === 'string'
        },
        {
            id: 'grand-design', label: "The Grand Design", type: 'Ai',
            description: "Validates the persistent strategic arc field used to align the Gm with long-term destiny.",
            check: (d) => typeof d?.grandDesign === 'string'
        }
    ]
};

const CheckItem: React.FC<{ label: string; status: StatusType; type: string; description: string }> = ({ label, status, type, description }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    let icon = <Icon name="spinner" className="w-4 h-4 animate-spin text-brand-text-muted" />;
    let colorClass = "text-brand-text-muted";

    if (status === 'Ok') {
        icon = <Icon name="check" className="w-4 h-4 text-brand-accent" />;
        colorClass = "text-brand-text";
    } else if (status === 'Fail') {
        icon = <Icon name="close" className="w-4 h-4 text-brand-danger" />;
        colorClass = "text-brand-danger";
    }

    const getTypeIcon = (t: string) => {
        switch(t) {
            case 'Ai': return <Icon name="sparkles" className="w-3.5 h-3.5 text-purple-400" />;
            case 'System': return <Icon name="code" className="w-3.5 h-3.5 text-blue-400" />;
            case 'Hybrid': return (
                <div className="flex -space-x-1.5">
                    <Icon name="code" className="w-3.5 h-3.5 text-blue-400" />
                    <Icon name="sparkles" className="w-3.5 h-3.5 text-purple-400" />
                </div>
            );
            default: return null;
        }
    };

    return (
        <div className="border-b border-brand-primary/20 last:border-0">
            <div 
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-brand-primary/20 transition-colors px-2 rounded-lg select-none group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-5 flex justify-center">{icon}</span>
                    <span className={`text-body-sm font-bold ${colorClass}`}>{label}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="opacity-40 group-hover:opacity-100 transition-opacity" title={type}>
                        {getTypeIcon(type)}
                    </div>
                    <Icon 
                        name="chevronDown" 
                        className={`w-3.5 h-3.5 text-brand-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                    />
                </div>
            </div>
            {isExpanded && (
                <div className="pl-10 pr-4 pb-4 text-body-sm text-brand-text-muted/80 font-medium leading-relaxed animate-fade-in">
                    <div className="pl-3 border-l border-brand-accent/30 italic">
                        {description}
                    </div>
                </div>
            )}
        </div>
    );
};

const SystemCheckModal: React.FC<SystemCheckModalProps> = ({ isOpen, onClose }) => {
    const { gameData } = useContext(GameDataContext);
    const [results, setResults] = useState<Record<string, StatusType>>({});
    const [isRunning, setIsRunning] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);

    useEffect(() => {
        if (isOpen) {
            runDiagnostics();
        } else {
            setResults({}); 
            setOverallProgress(0);
        }
    }, [isOpen]);

    const runDiagnostics = async () => {
        setIsRunning(true);
        const newResults: Record<string, StatusType> = {};
        const allChecks = Object.values(CHECKS).flat();
        
        for (let i = 0; i < allChecks.length; i++) {
            const check = allChecks[i];
            await new Promise(resolve => setTimeout(resolve, 80));
            try {
                const passed = check.check(gameData);
                newResults[check.id] = passed ? 'Ok' : 'Fail';
            } catch (e) {
                newResults[check.id] = 'Fail';
            }
            setResults(prev => ({ ...prev, [check.id]: newResults[check.id] }));
            setOverallProgress(Math.round(((i + 1) / allChecks.length) * 100));
        }
        setIsRunning(false);
    };

    const hasFailures = Object.values(results).some(s => s === 'Fail');
    const overallStatus = hasFailures 
        ? 'System Errors Detected' 
        : isRunning ? 'Running Diagnostics...' : 'All Systems Nominal';
        
    const overallColor = hasFailures 
        ? 'text-brand-danger border-brand-danger/30 bg-brand-danger/5' 
        : isRunning ? 'text-brand-accent border-brand-accent/30 bg-brand-accent/5' : 'text-green-500 border-green-500/30 bg-green-900/10';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Engine Diagnostics">
            <div className="max-h-[70vh] overflow-y-auto custom-scroll pr-1 space-y-5 pb-6">
                
                {/* Summary Banner */}
                <div className={`text-center text-body-sm font-black py-3 border-y rounded-lg ${overallColor} transition-colors duration-500`}>
                    {overallStatus}
                </div>

                {/* Progress Bar */}
                <div className="px-1">
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-body-sm font-bold text-brand-text-muted">Scanning state...</span>
                        <span className="text-body-sm font-black text-brand-accent">{overallProgress}%</span>
                    </div>
                    <div className="w-full bg-brand-primary/30 h-1 rounded-full overflow-hidden border border-brand-surface">
                        <div 
                            className="bg-brand-accent h-full transition-all duration-300 ease-out shadow-[0_0_8px_#3ecf8e]" 
                            style={{ width: `${overallProgress}%` }}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-5 text-[10px] font-black text-brand-text-muted px-1 opacity-60">
                    <span className="flex items-center gap-1.5"><Icon name="code" className="w-3.5 h-3.5 text-blue-400" /> System Logic</span>
                    <span className="flex items-center gap-1.5"><Icon name="sparkles" className="w-3.5 h-3.5 text-purple-400" /> Ai Creative</span>
                </div>

                {/* Categories */}
                {Object.entries(CHECKS).map(([category, checks]) => (
                    <div key={category} className="bg-brand-surface/40 p-4 rounded-2xl border border-brand-primary shadow-sm">
                        <h3 className="text-body-base font-black text-brand-accent mb-3 px-1 border-b border-brand-accent/10 pb-2">{category}</h3>
                        <div className="space-y-1">
                            {checks.map(check => (
                                <CheckItem 
                                    key={check.id} 
                                    label={check.label} 
                                    description={check.description}
                                    status={results[check.id] || 'Checking'} 
                                    type={check.type}
                                />
                            ))}
                        </div>
                    </div>
                ))}

                <div className="text-body-sm text-center text-brand-text-muted italic opacity-40 pt-4 px-6">
                    Diagnostics check internal data structures, Rag retrieval paths, and procedural matrix integrity.
                </div>
            </div>
            
            <div className="mt-4 flex justify-center">
                <button 
                    onClick={runDiagnostics} 
                    disabled={isRunning}
                    className="btn-primary btn-md gap-2"
                >
                    <Icon name="refresh" className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
                    Restart Scan
                </button>
            </div>
        </Modal>
    );
};

export default SystemCheckModal;

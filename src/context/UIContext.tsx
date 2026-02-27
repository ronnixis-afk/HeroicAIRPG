// context/UIContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { View, LootState, MapGenerationProgress, ActorSuggestion, NPC } from '../types';

export type CombatTriggerSource = 'Narrative' | 'Nemesis' | 'Travel' | 'Exploration' | 'Rest' | 'Ambush';

interface PendingCombat {
    narrative: string;
    suggestions: ActorSuggestion[];
    source: CombatTriggerSource;
}

interface CombatInitiationStatus {
    isActive: boolean;
    step: string;
    progress: number;
    narrative: string;
}

interface CreationProgress {
    isActive: boolean;
    step: string;
    progress: number;
}

export type EntityType = 'npc' | 'item' | 'location' | 'lore' | 'plot' | 'objective';

interface InspectedEntity {
    type: EntityType;
    data: any;
}

export interface UnsavedChanges {
    id: string;
    name: string;
    type: 'player' | 'companion';
    data: any;
}

interface UIContextType {
    // Navigation
    activeView: View;
    setActiveView: (view: View) => void;
    activePanel: 'menu' | 'abilities' | null;
    setActivePanel: (panel: 'menu' | 'abilities' | null) => void;
    selectedCharacterId: string;
    setSelectedCharacterId: (id: string) => void;
    navigateToCharacter: (id: string) => void;
    actingCharacterId: string;
    setActingCharacterId: (id: string) => void;

    // Navigation Guard
    unsavedChanges: UnsavedChanges | null;
    setUnsavedChanges: (changes: UnsavedChanges | null) => void;
    pendingNavigation: (() => void) | null;
    setPendingNavigation: (nav: (() => void) | null) => void;

    // Chat
    chatInput: string;
    setChatInput: React.Dispatch<React.SetStateAction<string>>;
    isHeroicModeActive: boolean;
    setIsHeroicModeActive: (active: boolean) => void;
    
    // Status & Loading
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    isAssessing: boolean;
    setIsAssessing: (assessing: boolean) => void;
    isAiGenerating: boolean;
    setIsAiGenerating: (generating: boolean) => void;
    isAuditing: boolean;
    setIsAuditing: (auditing: boolean) => void;
    isHousekeeping: boolean;
    setIsHousekeeping: (housekeeping: boolean) => void;
    isGeneratingScene: boolean;
    setIsGeneratingScene: (generating: boolean) => void;
    error: Error | null;
    setError: (error: Error | null) => void;

    // Complex UI States
    creationProgress: CreationProgress;
    setCreationProgress: (progress: CreationProgress) => void;
    mapGenerationProgress: MapGenerationProgress;
    setMapGenerationProgress: (progress: MapGenerationProgress) => void;
    combatInitiationStatus: CombatInitiationStatus;
    setCombatInitiationStatus: React.Dispatch<React.SetStateAction<CombatInitiationStatus>>;
    pendingCombat: PendingCombat | null;
    setPendingCombat: (pending: PendingCombat | null) => void;
    lootState: LootState;
    setLootState: React.Dispatch<React.SetStateAction<LootState>>;
    
    // Entity Inspection (Chat Links)
    inspectedEntity: InspectedEntity | null;
    setInspectedEntity: (entity: InspectedEntity | null) => void;

    // Modals
    isTimeModalOpen: boolean;
    setIsTimeModalOpen: (open: boolean) => void;
    isLocationModalOpen: boolean;
    setIsLocationModalOpen: (open: boolean) => void;
    isZonePanelOpen: boolean;
    setIsZonePanelOpen: (open: boolean) => void;
    isSpeechModalOpen: boolean;
    setIsSpeechModalOpen: (open: boolean) => void;

    // Pickpocket state
    isPickpocketModalOpen: boolean;
    setIsPickpocketModalOpen: (open: boolean) => void;
    pickpocketTarget: NPC | null;
    setPickpocketTarget: (npc: NPC | null) => void;
}

const UIContext = createContext<UIContextType | null>(null);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Navigation
    const [activeView, setActiveViewInternal] = useState<View>('chat');
    const [activePanel, setActivePanelInternal] = useState<'menu' | 'abilities' | null>(null);
    const [selectedCharacterId, setSelectedCharacterIdInternal] = useState<string>('player');
    const [actingCharacterId, setActingCharacterId] = useState<string>('player');

    // Navigation Guard
    const [unsavedChanges, setUnsavedChanges] = useState<UnsavedChanges | null>(null);
    const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

    // Guarded Navigation Handlers
    const setActiveView = (view: View) => {
        const navFunc = () => setActiveViewInternal(view);
        if (unsavedChanges) {
            setPendingNavigation(() => navFunc);
        } else {
            navFunc();
        }
    };

    const setActivePanel = (panel: 'menu' | 'abilities' | null) => {
        const navFunc = () => setActivePanelInternal(panel);
        // Only guard when opening a panel from the character sheet, not closing or within panels
        if (unsavedChanges && panel !== null) {
            setPendingNavigation(() => navFunc);
        } else {
            navFunc();
        }
    };

    const setSelectedCharacterId = (id: string) => {
        const navFunc = () => setSelectedCharacterIdInternal(id);
        // Guard if we are on character view switching tabs
        if (unsavedChanges && activeView === 'character' && unsavedChanges.id !== id) {
            setPendingNavigation(() => navFunc);
        } else {
            navFunc();
        }
    };

    const navigateToCharacter = (id: string) => {
        const navFunc = () => {
            setSelectedCharacterIdInternal(id);
            setActiveViewInternal('character');
            setActivePanelInternal(null);
        };
        // Only block if we are actually leaving the current state of a character
        if (unsavedChanges && (activeView !== 'character' || unsavedChanges.id !== id)) {
            setPendingNavigation(() => navFunc);
        } else {
            navFunc();
        }
    };

    // Chat
    const [chatInput, setChatInput] = useState('');
    const [isHeroicModeActive, setIsHeroicModeActive] = useState(false);

    // Status
    const [isLoading, setIsLoading] = useState(true);
    const [isAssessing, setIsAssessing] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [isAuditing, setIsAuditing] = useState(false);
    const [isHousekeeping, setIsHousekeeping] = useState(false);
    const [isGeneratingScene, setIsGeneratingScene] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Complex States
    const [creationProgress, setCreationProgress] = useState<CreationProgress>({ isActive: false, step: '', progress: 0 });
    const [mapGenerationProgress, setMapGenerationProgress] = useState<MapGenerationProgress>({ isActive: false, step: '', progress: 0 });
    const [combatInitiationStatus, setCombatInitiationStatus] = useState<CombatInitiationStatus>({ isActive: false, step: '', progress: 0, narrative: '' });
    const [pendingCombat, setPendingCombat] = useState<PendingCombat | null>(null);
    const [lootState, setLootState] = useState<LootState>({ isOpen: false, isLoading: false, items: [], defeatedEnemies: [] });
    const [inspectedEntity, setInspectedEntity] = useState<InspectedEntity | null>(null);

    // Modals
    const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [isZonePanelOpen, setIsZonePanelOpen] = useState(false);
    const [isSpeechModalOpen, setIsSpeechModalOpen] = useState(false);

    // Pickpocket
    const [isPickpocketModalOpen, setIsPickpocketModalOpen] = useState(false);
    const [pickpocketTarget, setPickpocketTarget] = useState<NPC | null>(null);

    const value = {
        activeView, setActiveView,
        activePanel, setActivePanel,
        selectedCharacterId, setSelectedCharacterId,
        navigateToCharacter,
        actingCharacterId, setActingCharacterId,
        unsavedChanges, setUnsavedChanges,
        pendingNavigation, setPendingNavigation,
        chatInput, setChatInput,
        isHeroicModeActive, setIsHeroicModeActive,
        isLoading, setIsLoading,
        isAssessing, setIsAssessing,
        isAiGenerating, setIsAiGenerating,
        isAuditing, setIsAuditing,
        isHousekeeping, setIsHousekeeping,
        isGeneratingScene, setIsGeneratingScene,
        error, setError,
        creationProgress, setCreationProgress,
        mapGenerationProgress, setMapGenerationProgress,
        combatInitiationStatus, setCombatInitiationStatus,
        pendingCombat, setPendingCombat,
        lootState, setLootState,
        inspectedEntity, setInspectedEntity,
        isTimeModalOpen, setIsTimeModalOpen,
        isLocationModalOpen, setIsLocationModalOpen,
        isZonePanelOpen, setIsZonePanelOpen,
        isSpeechModalOpen, setIsSpeechModalOpen,
        isPickpocketModalOpen, setIsPickpocketModalOpen,
        pickpocketTarget, setPickpocketTarget
    };

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error("useUI must be used within a UIProvider");
    }
    return context;
};
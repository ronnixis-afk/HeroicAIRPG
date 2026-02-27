// App.tsx

import { UserButton, SignedIn } from "@clerk/nextjs";
import React, { useState, useContext, useEffect, useMemo } from 'react';
import CharacterView from './components/CharacterView';
import InventoryView from './components/inventory/InventoryView';
import ChatView from './components/ChatView';
import StoryView from './components/StoryView';
import WorldView from './components/WorldView';
import MapView from './components/map/MapView';
import ObjectivesView from './components/ObjectivesView';
import StoreView from './components/inventory/StoreView';
import TempStatsView from './components/combat/TempStatsView';
import HeaderMenuPanel from './components/HeaderMenuPanel';
import NemesisView from './components/NemesisView';
import GmNotesView from './components/GmNotesView';
import SettingsView from './components/SettingsView';
import ItemForgeView from './components/inventory/ItemForgeView';
import NPCsView from './components/npcs/NPCsView';
import GalleryView from './components/GalleryView';
/* Fix: Import GameDataProvider alongside GameDataContext to resolve naming errors in the App root */
import { GameDataContext, GameDataProvider } from './context/GameDataContext';
import { UIProvider, useUI } from './context/UIContext';
import WorldSelection from './components/WorldSelection';
import type { View, Inventory, ChatMessage } from './types';
import PlayerAttackModal from './components/combat/PlayerAttackModal';
import CombatInitiationModal from './components/combat/CombatInitiationModal';
import Modal from './components/Modal';
import TimeManagementModalContent from './components/TimeManagementModalContent';
import TravelModalContent from './components/map/TravelModalContent';
import CombatStatusDisplay from './components/combat/CombatStatus';
// Fix: MapSector is a named export in types/World, not a default export.
import type { MapSector } from './types/World';
import LootPanel from './components/inventory/LootPanel';
import { Icon } from './components/Icon';
import ZoneDetailsPanel from './components/map/ZoneDetailsPanel';
import { UnsavedChangesModal } from './components/modals/UnsavedChangesModal';
import { ChatInputBar } from './components/chat/ChatInputBar';
import { SpeechToTextModal } from './components/SpeechToTextButton';
import { generateSceneVisuals } from './services/imageGenerationService';
import { useAudioPlayback } from './components/chat/useAudioPlayback';
import { PickpocketModal } from './components/modals/PickpocketModal';

interface HeaderProps {
  currentTime: string;
  currentLocale?: string;
  onTimeClick: () => void;
  onMenuClick: () => void;
  badgeCount?: number;
}

const Header: React.FC<HeaderProps> = ({ currentTime, currentLocale, onTimeClick, onMenuClick, badgeCount }) => {
  const formattedHeaderString = useMemo(() => {
    if (!currentTime) return '';

    const toTitleCase = (str: string) => {
      return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    let timeStr = '';
    try {
      const date = new Date(currentTime);
      if (!isNaN(date.getTime())) {
        timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
      } else {
        timeStr = currentTime;
      }
    } catch (e) {
      timeStr = currentTime;
    }

    const localeStr = currentLocale ? toTitleCase(currentLocale) : 'The Wilds';
    return `${timeStr}, ${localeStr}`;
  }, [currentTime, currentLocale]);

  return (
    <header className="h-[44px] bg-brand-bg flex-shrink-0 flex items-center justify-between px-4 border-b border-brand-primary/10">
      <button onClick={onTimeClick} className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity group text-left">
        <span className="text-brand-accent text-[6px] mb-0.5 animate-pulse">●</span>
        <span className="text-body-sm text-brand-text-muted font-bold group-hover:text-brand-text transition-colors">{formattedHeaderString}</span>
      </button>

      <div className="flex items-center gap-3">
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
        <button onClick={onMenuClick} className="btn-icon p-1 text-brand-text-muted hover:text-brand-accent transition-colors relative">
          <Icon name="menu" className="w-[24px] h-[24px]" />
          {badgeCount !== undefined && badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand-accent text-black text-[6px] font-black h-3.5 min-w-[14px] px-1 rounded-full flex items-center justify-center border border-brand-bg z-10 shadow-sm animate-pulse">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

const MemoizedCharacterView = React.memo(CharacterView);
const MemoizedInventoryView = React.memo(InventoryView);
const MemoizedChatView = React.memo(ChatView);
const MemoizedStoryView = React.memo(StoryView);
const MemoizedWorldView = React.memo(WorldView);
const MemoizedMapView = React.memo(MapView);
const MemoizedObjectivesView = React.memo(ObjectivesView);

const GameInterface: React.FC = () => {
  const {
    gameData,
    worldName,
    setMessages,
    submitUserMessage,
    markAllStoryLogsAsSeen,
    markAllNpcsAsSeen,
    markAllPlotPointsAsSeen,
    markAllMapZonesAsSeen,
    switchWorld,
    performAutomatedPlayerTurn,
    addGalleryEntry,
    useHeroicPoint
  } = useContext(GameDataContext);

  const {
    activeView, setActiveView,
    activePanel, setActivePanel,
    actingCharacterId,
    combatInitiationStatus,
    isTimeModalOpen, setIsTimeModalOpen,
    isLocationModalOpen, setIsLocationModalOpen,
    isZonePanelOpen, setIsZonePanelOpen,
    chatInput, setChatInput,
    isAiGenerating, isLoading,
    isAssessing, isAuditing, pendingCombat,
    isGeneratingScene, setIsGeneratingScene,
    isSpeechModalOpen, setIsSpeechModalOpen,
    isHeroicModeActive, setIsHeroicModeActive
  } = useUI();

  const [panelsAreMounted, setPanelsAreMounted] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [hasSavedGeneratedImage, setHasSavedGeneratedImage] = useState(false);

  // Audio Logic
  /* Fix: Use narrationTone for the third parameter to ensure correct TTS persona scaling */
  const { speak, stopAllSpeech } = useAudioPlayback(
    gameData?.useAiTts ?? false,
    gameData?.narrationVoice || "Classic Narrator (Male)",
    gameData?.narrationTone || "Classic Fantasy"
  );

  // Global Context Cache: Ensures non-React services can access current game settings (like Faster GM)
  useEffect(() => {
    if (gameData) {
      (window as any).gameDataCache = gameData;
    }
  }, [gameData]);

  useEffect(() => {
    const timer = setTimeout(() => setPanelsAreMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeView === 'story') markAllStoryLogsAsSeen();
    if (activeView === 'npcs') markAllNpcsAsSeen();
    if (activeView === 'gm-notes') markAllPlotPointsAsSeen();
    if (activeView === 'knowledge') markAllMapZonesAsSeen();
  }, [
    activeView,
    markAllStoryLogsAsSeen,
    markAllNpcsAsSeen,
    markAllPlotPointsAsSeen,
    markAllMapZonesAsSeen,
    gameData?.story.length,
    gameData?.npcs?.length,
    gameData?.plotPoints?.length,
    gameData?.mapZones?.length
  ]);

  const handlePanelClose = () => setActivePanel(null);
  const isCombatActive = gameData?.combatState?.isActive ?? false;

  const isPlayerTurn = useMemo(() => {
    if (!gameData?.combatState?.isActive) return false;
    const { turnOrder, currentTurnIndex } = gameData.combatState;
    return turnOrder[currentTurnIndex] === gameData.playerCharacter.id;
  }, [gameData]);

  const currentLocation = useMemo(() => {
    if (!gameData) return 'Unknown';
    const currentCoords = gameData.playerCoordinates;
    if (currentCoords) {
      const zone = gameData.mapZones?.find(z => z.coordinates === currentCoords);
      if (zone) return zone.name;
    }
    return 'Uncharted Lands';
  }, [gameData?.playerCoordinates, gameData?.mapZones]);

  const currentSectorName = useMemo(() => {
    if (!gameData || !gameData.playerCoordinates) return undefined;
    const sector = gameData.mapSectors?.find(s => s.coordinates.includes(gameData.playerCoordinates!));
    return sector?.name;
  }, [gameData?.playerCoordinates, gameData?.mapSectors]);

  const handleLocationSubmit = (prompt: string) => {
    submitUserMessage({
      id: `user-travel-${Date.now()}`,
      sender: 'user',
      mode: 'OOC',
      content: prompt,
    });
    setIsLocationModalOpen(false);
  };

  const inventoryBadgeCount = useMemo(() => {
    if (!gameData) return 0;
    const playerNew = [...gameData.playerInventory.carried, ...gameData.playerInventory.equipped].filter(i => i.isNew).length;
    // Fix: Added explicit casting to Inventory[] for Object.values result to ensure companionsNew is inferred as number.
    const companionsNew = (Object.values(gameData.companionInventories || {}) as Inventory[]).reduce((acc: number, inv: Inventory) => {
      return acc + [...inv.carried, ...inv.equipped].filter(i => i.isNew).length;
    }, 0);
    return playerNew + companionsNew;
  }, [gameData]);

  const menuBadges = useMemo<Record<string, number>>(() => {
    if (!gameData) return {} as Record<string, number>;
    return {
      inventory: inventoryBadgeCount,
      quests: gameData.objectives.filter(o => o.isNew).length,
      story: gameData.story.filter(l => l.isNew).length,
      world: gameData.world.filter(l => l.isNew).length,
      npcs: (gameData.npcs || []).filter(n => n.isNew).length,
      nemesis: gameData.nemeses.filter(n => n.isNew).length,
      gmNotes: (gameData.plotPoints || []).filter(p => p.isNew).length,
      map: (gameData.mapZones || []).filter(z => z.isNew).length
    };
  }, [gameData, inventoryBadgeCount]);

  const totalMenuBadgeCount = useMemo(() => {
    // Fix: Added explicit casting to number[] for Object.values result to resolve '+' operator errors on unknown types
    return (Object.values(menuBadges) as number[]).reduce((a: number, b: number) => a + b, 0);
  }, [menuBadges]);

  const handleSubmitChat = async () => {
    const content = chatInput.trim();
    if (!content || !gameData) return;
    stopAllSpeech();

    // Phase 3: Correct propagation of Heroic state to the async narrative pipeline
    const wasHeroic = isHeroicModeActive;

    setChatInput('');
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', mode: 'CHAR', content };
    await submitUserMessage(userMessage, wasHeroic);
  };

  const handleViewScene = async () => {
    if (!gameData || isGeneratingScene) return;
    setIsGeneratingScene(true);
    setHasSavedGeneratedImage(false);
    try {
      const currentEnemies = gameData.combatState?.isActive ? gameData.combatState.enemies : undefined;
      // PASS ENTIRE gameData TO THE SERVICE FOR LORE EXTRACTION
      const imageBase64 = await generateSceneVisuals(gameData, gameData.imageGenerationStyle, currentEnemies);
      if (imageBase64) {
        setGeneratedImage(imageBase64);
      }
    } finally { setIsGeneratingScene(false); }
  };

  const handleSaveSceneToGallery = async () => {
    if (!gameData || !generatedImage || hasSavedGeneratedImage) return;
    const lastAiMsg = [...gameData.messages].reverse().find(m => m.sender === 'ai');
    const entryDescription = lastAiMsg
      ? (lastAiMsg.content.length > 120 ? lastAiMsg.content.substring(0, 117) + '...' : lastAiMsg.content)
      : `A Glimpse Into ${gameData.currentLocale || 'Uncharted Lands'}.`;

    addGalleryEntry({
      id: `gallery-${Date.now()}`,
      imageUrl: generatedImage,
      description: entryDescription,
      timestamp: gameData.currentTime,
      realTimestamp: Date.now()
    });

    setMessages(prev => [...prev, {
      id: `sys-gallery-${Date.now()}`,
      sender: 'system',
      content: `Visual memory added to your gallery.`,
      type: 'positive'
    }]);
    setHasSavedGeneratedImage(true);
  };

  const handleRepeatLast = () => {
    if (!gameData) return;
    const lastAi = [...gameData.messages].reverse().find(m => m.sender === 'ai');
    if (lastAi && lastAi.content) speak(lastAi.content, lastAi.id);
  };

  const ensureChatView = () => {
    if (activeView !== 'chat') {
      setActiveView('chat');
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'character': return <MemoizedCharacterView />;
      case 'inventory': return <MemoizedInventoryView />;
      case 'chat': return <MemoizedChatView />;
      case 'story': return <MemoizedStoryView />;
      case 'world': return <MemoizedWorldView />;
      case 'knowledge': return <MemoizedMapView />;
      case 'objectives': return <MemoizedObjectivesView />;
      case 'settings': return <SettingsView />;
      case 'store': return <StoreView />;
      case 'temp-stats': return <TempStatsView />;
      case 'nemesis': return <NemesisView />;
      case 'gm-notes': return <GmNotesView />;
      case 'item-forge': return <ItemForgeView />;
      case 'npcs': return <NPCsView />;
      case 'gallery': return <GalleryView />;
      default: return <MemoizedChatView />;
    }
  };

  return (
    <div className="h-full w-full max-w-2xl mx-auto flex flex-col bg-brand-bg relative shadow-2xl overflow-hidden">
      <Header
        currentTime={gameData?.currentTime || ''}
        currentLocale={gameData?.currentLocale}
        onTimeClick={() => setIsTimeModalOpen(true)}
        onMenuClick={() => setIsHeaderMenuOpen(true)}
        badgeCount={totalMenuBadgeCount}
      />

      {isCombatActive && activeView === 'chat' && <CombatStatusDisplay />}

      <main className="flex-1 overflow-hidden relative">
        <div key={activeView} className={`h-full overflow-y-auto custom-scroll ${['knowledge', 'chat', 'inventory', 'character', 'gallery'].includes(activeView) ? '' : 'animate-page p-2'}`}>
          {renderView()}
        </div>
      </main>

      <div className="flex-shrink-0 bg-brand-bg/95 backdrop-blur-sm border-t border-brand-primary/10">
        <div className="max-w-3xl mx-auto p-2">
          <ChatInputBar
            value={chatInput}
            onChange={setChatInput}
            onSubmit={handleSubmitChat}
            onViewScene={handleViewScene}
            onMicClick={() => setIsSpeechModalOpen(true)}
            isGeneratingImage={isGeneratingScene}
            isHandsFree={gameData?.isHandsFree ?? false}
            onRepeatLast={handleRepeatLast}
            isCombatActive={isCombatActive}
            isPlayerTurn={isPlayerTurn}
            onAutoResolve={performAutomatedPlayerTurn}
            isLocked={isLoading || isAiGenerating || isAssessing || isAuditing || !!pendingCombat}
            onMenuClick={() => setIsHeaderMenuOpen(true)}
            onInteraction={ensureChatView}
            isChatViewActive={activeView === 'chat'}
          />
        </div>
      </div>

      {/* Fix: Rename CombatInitiationStatusModal to CombatInitiationModal to match the imported component name */}
      <CombatInitiationModal
        isOpen={combatInitiationStatus.isActive}
        step={combatInitiationStatus.step}
        progress={combatInitiationStatus.progress}
        narrative={combatInitiationStatus.narrative}
      />
      <LootPanel />

      {panelsAreMounted && (
        <>
          <HeaderMenuPanel
            isOpen={isHeaderMenuOpen}
            onClose={() => setIsHeaderMenuOpen(false)}
            worldName={worldName}
            sector={currentSectorName}
            location={currentLocation}
            locale={gameData?.currentLocale}
            onLocationClick={() => setIsZonePanelOpen(true)}
            onSettingsClick={() => setActiveView('settings')}
            onGalleryClick={() => setActiveView('gallery')}
            onSwitchWorldClick={switchWorld}
            onSceneClick={() => setActiveView('temp-stats')}
            onItemForgeClick={() => setActiveView('item-forge')}
            onGmNotesClick={() => setActiveView('gm-notes')}
            setActiveView={setActiveView}
            onTimeManagementClick={() => setIsTimeModalOpen(true)}
            isCombatActive={isCombatActive}
            badges={menuBadges}
          />
          <PlayerAttackModal
            isOpen={activePanel === 'abilities'}
            onClose={handlePanelClose}
            isQuickAction={true}
            sourceActorId={actingCharacterId}
          />
        </>
      )}

      {gameData && (
        <ZoneDetailsPanel isOpen={isZonePanelOpen} onClose={() => setIsZonePanelOpen(false)} coordinates={gameData.playerCoordinates || '0-0'} />
      )}
      <Modal isOpen={isTimeModalOpen} onClose={() => setIsTimeModalOpen(false)} title="Time Management">
        <TimeManagementModalContent onClose={() => setIsTimeModalOpen(false)} />
      </Modal>
      {gameData && (
        <Modal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} title="Location and Travel">
          <TravelModalContent gameData={gameData} onSubmit={handleLocationSubmit} currentLocation={currentLocation} />
        </Modal>
      )}
      <SpeechToTextModal
        isOpen={isSpeechModalOpen}
        onClose={() => setIsSpeechModalOpen(false)}
        onSendTranscript={(t) => { setIsSpeechModalOpen(false); setChatInput(t); handleSubmitChat(); }}
      />

      {generatedImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in">
          <img src={`data:image/png;base64,${generatedImage}`} alt="Scene" className="w-full h-full object-contain shadow-2xl" />
          <div className="absolute top-6 right-6 flex items-center gap-3">
            <button
              onClick={handleSaveSceneToGallery}
              disabled={hasSavedGeneratedImage}
              className={`btn-icon rounded-full w-12 h-12 transition-all backdrop-blur-md border shadow-lg ${hasSavedGeneratedImage ? 'bg-brand-accent text-black border-brand-accent/50 cursor-default opacity-100' : 'bg-brand-surface/60 text-brand-text hover:bg-brand-accent hover:text-black border-white/10'}`}
              title={hasSavedGeneratedImage ? "Saved to Gallery" : "Save to Gallery"}
            >
              <Icon name={hasSavedGeneratedImage ? "check" : "save"} className="w-6 h-6" />
            </button>
            <button
              onClick={() => setGeneratedImage(null)}
              className="btn-icon rounded-full w-12 h-12 bg-brand-surface/60 text-brand-text hover:bg-white hover:text-black transition-colors backdrop-blur-md border border-white/10 shadow-lg"
              title="Close"
            >
              <Icon name="close" className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
      <UnsavedChangesModal />
      <PickpocketModal />
    </div>
  );
}

const App: React.FC = () => {
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);

  const handleSwitchWorld = () => setSelectedWorldId(null);

  if (!selectedWorldId) {
    return <WorldSelection onWorldSelected={setSelectedWorldId} />;
  }

  return (
    <UIProvider>
      {/* Fix: Wrapped GameInterface with GameDataProvider to ensure proper state management and context resolution */}
      <GameDataProvider worldId={selectedWorldId} onSwitchWorld={handleSwitchWorld}>
        <GameInterface />
      </GameDataProvider>
    </UIProvider>
  );
};

export default App;
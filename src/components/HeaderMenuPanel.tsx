import React, { useMemo } from 'react';
import { Icon } from './Icon';
import { View } from '../types';

interface HeaderMenuPanelProps {
  isOpen: boolean;
  onClose: () => void;
  worldName?: string;
  sector?: string;
  location: string;
  locale?: string;
  siteDetail?: string;
  onLocationClick: () => void;
  onSettingsClick: () => void;
  onGalleryClick: () => void;
  onSwitchWorldClick: () => void;
  onSceneClick: () => void;
  onItemForgeClick: () => void;
  onGmNotesClick: () => void;
  // Consolidated props from MenuPanel
  setActiveView: (view: View) => void;
  onTimeManagementClick: () => void;
  isCombatActive?: boolean;
  badges?: Record<string, number>;
}

const MenuItem = ({ label, iconName, onClick, disabled = false, warning, isHighlighted, highlightColor, badgeCount }: {
  label: string;
  iconName: string;
  onClick: () => void;
  disabled?: boolean;
  warning?: string;
  isHighlighted?: boolean;
  highlightColor?: string;
  badgeCount?: number;
}) => (
  <button 
    onClick={disabled ? undefined : onClick} 
    className={`flex flex-col items-center justify-center transition-colors duration-200 group p-1 relative ${
      disabled ? 'opacity-30 cursor-not-allowed text-brand-text-muted' : 
      isHighlighted ? (highlightColor || 'text-brand-accent') : 
      'text-brand-text-muted hover:text-brand-text'
    }`}
    title={disabled ? warning : label}
  >
    <div className="relative">
        <Icon name={iconName} className={`w-6 h-6 mb-2 ${isHighlighted ? 'animate-pulse' : ''}`} />
        {badgeCount !== undefined && badgeCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-brand-accent text-black text-[8px] font-black h-3.5 min-w-[14px] px-1 rounded-full flex items-center justify-center border border-brand-surface z-10 shadow-sm animate-fade-in">
                {badgeCount > 9 ? '9+' : badgeCount}
            </span>
        )}
    </div>
    <span className={`text-[9px] font-normal tracking-tight text-center leading-tight ${isHighlighted ? 'opacity-100' : ''}`}>{label}</span>
  </button>
);

const HeaderMenuPanel: React.FC<HeaderMenuPanelProps> = ({ 
  isOpen, 
  onClose, 
  worldName,
  sector,
  location, 
  locale, 
  siteDetail,
  onLocationClick, 
  onSettingsClick,
  onSwitchWorldClick,
  setActiveView,
  onTimeManagementClick,
  isCombatActive = false,
  badges = {} as Record<string, number>
}) => {
  const formattedWorldName = useMemo(() => {
    if (!worldName) return 'Details';
    return worldName.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }, [worldName]);

  const handleAction = (view: View) => {
    setActiveView(view);
    onClose();
  };

  const handleTimeClick = () => {
    onTimeManagementClick();
    onClose();
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`fixed top-0 right-0 h-full w-[90%] sm:w-[400px] bg-brand-surface z-[70] transform transition-transform duration-300 ease-in-out border-l border-brand-primary shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-3 pb-5 border-b border-brand-primary/10">
            <div className="flex justify-end">
              <button onClick={onClose} className="btn-icon text-brand-text-muted hover:text-brand-text transition-colors">
                <Icon name="close" className="w-6 h-6" />
              </button>
            </div>
            <h3 className="text-brand-text line-clamp-2 pr-4 overflow-hidden mb-0 mt-2">{formattedWorldName}</h3>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll px-6 pb-6 pt-3">
            <div className="space-y-5">
              {/* Context Section */}
              <div className="space-y-6">
                {/* Location */}
                <div className="space-y-2">
                  <label className="text-body-sm font-bold text-brand-text-muted opacity-60">Current Location</label>
                  <button 
                    onClick={() => { onLocationClick(); onClose(); }}
                    className="w-full text-left transition-all group flex flex-row items-start gap-3 p-3 bg-transparent rounded-xl hover:bg-brand-primary/10"
                  >
                    <Icon name="location" className="w-5 h-5 text-brand-accent shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="flex flex-col gap-1">
                      <div className="text-body-sm font-normal leading-tight text-brand-text">
                        {/* Proper formatting for Narrative Detail, Zone, and Sector in white */}
                        {[siteDetail || locale, location, sector].filter(Boolean).join(', ') || 'The Wilds'}
                      </div>
                      <span className="text-[9px] text-brand-text-muted font-normal opacity-60">Tap to open details</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Action Grid - 3 Columns */}
              <div className="space-y-4 pt-4 border-t border-brand-primary/10">
                <label className="text-body-sm font-bold text-brand-text-muted opacity-60">Menu</label>
                <div className="grid grid-cols-3 gap-y-8 gap-x-2">
                  <MenuItem label="Characters" iconName="character" onClick={() => handleAction('character')} />
                  <MenuItem label="Inventory" iconName="inventory" onClick={() => handleAction('inventory')} badgeCount={badges.inventory} />
                  <MenuItem label="Story" iconName="story" onClick={() => handleAction('story')} badgeCount={badges.story} />
                  <MenuItem label="Quests" iconName="clipboardList" onClick={() => handleAction('objectives')} badgeCount={badges.quests} />
                  
                  <MenuItem label="World" iconName="world" onClick={() => handleAction('world')} badgeCount={badges.world} />
                  <MenuItem label="Npcs" iconName="users" onClick={() => handleAction('npcs')} badgeCount={badges.npcs} />
                  <MenuItem label="Map" iconName="map" onClick={() => handleAction('knowledge')} badgeCount={badges.map} />
                  <MenuItem 
                      label="Store" 
                      iconName="shoppingBag" 
                      onClick={() => handleAction('store')} 
                      disabled={isCombatActive}
                      warning="Store is unavailable during combat."
                  />

                  <MenuItem label="Gm Notes" iconName="rocket" onClick={() => handleAction('gm-notes')} badgeCount={badges.gmNotes} />
                  <MenuItem label="Item Forge" iconName="hammer" onClick={() => handleAction('item-forge')} />
                  <MenuItem label="Scene" iconName="skull" onClick={() => handleAction('temp-stats')} />
                  <MenuItem label="Gallery" iconName="photo" onClick={() => handleAction('gallery')} />

                  <MenuItem label="Nemesis" iconName="danger" onClick={() => handleAction('nemesis')} badgeCount={badges.nemesis} />
                  <MenuItem 
                      label="Wait/Rest" 
                      iconName="clock" 
                      onClick={handleTimeClick} 
                      disabled={isCombatActive}
                      warning="Cannot rest while in danger."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-brand-primary/10 border-t border-brand-primary/10 grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleAction('settings')}
              className="w-full flex flex-row items-center justify-center gap-3 p-3 bg-brand-surface rounded-xl border border-brand-primary transition-all group hover:border-brand-accent/30"
            >
              <Icon name="settings" className="w-5 h-5 text-brand-accent shrink-0 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-body-sm font-bold text-brand-text">Settings</span>
            </button>
            <button 
              onClick={() => { onSwitchWorldClick(); onClose(); }}
              className="w-full flex flex-row items-center justify-center gap-3 p-3 bg-brand-surface rounded-xl border border-brand-primary transition-all group hover:border-brand-accent/30"
            >
              <Icon name="refresh" className="w-5 h-5 text-brand-accent shrink-0 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-body-sm font-bold text-brand-text">Switch</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default HeaderMenuPanel;
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

const MenuItem = ({ label, iconName, imageUrl, onClick, disabled = false, warning, isHighlighted, highlightColor, badgeCount }: {
  label: string;
  iconName?: string;
  imageUrl?: string;
  onClick: () => void;
  disabled?: boolean;
  warning?: string;
  isHighlighted?: boolean;
  highlightColor?: string;
  badgeCount?: number;
}) => (
  <button
    onClick={disabled ? undefined : onClick}
    className={`flex flex-col items-center justify-center transition-all duration-200 group p-1 relative ${disabled ? 'opacity-20 cursor-not-allowed text-brand-text-muted' :
      isHighlighted ? (highlightColor || 'text-brand-accent') :
        'text-brand-text-muted hover:text-brand-text'
      }`}
    title={disabled ? warning : label}
  >
    <div className="relative">
      {imageUrl ? (
        <img src={imageUrl} alt={label} className={`w-10 h-10 mb-1 object-contain ${isHighlighted ? 'animate-pulse' : ''} ${disabled ? 'grayscale opacity-50' : ''}`} />
      ) : iconName ? (
        <Icon name={iconName} className={`w-6 h-6 mb-2 ${isHighlighted ? 'animate-pulse' : ''}`} />
      ) : null}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute -top-1 -right-2 bg-brand-accent text-black text-[8px] font-black h-3.5 min-w-[14px] px-1 rounded-full flex items-center justify-center border border-brand-surface z-10 shadow-sm animate-fade-in">
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </div>
    <span className={`text-[9px] font-bold tracking-tight text-center leading-tight ${isHighlighted ? 'opacity-100' : ''}`}>{label}</span>
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
          <div className="px-6 py-4 border-b border-brand-primary/10 flex items-center justify-between gap-4">
            <h3 className="text-brand-text line-clamp-1 overflow-hidden m-0 flex-1">{formattedWorldName}</h3>
            <button onClick={onClose} className="btn-icon text-brand-text-muted hover:text-brand-text transition-colors shrink-0">
              <Icon name="close" className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex flex-col px-6 pb-6 pt-4 min-h-0">
            <div className="flex-1 flex flex-col justify-between">
              {/* Context Section */}
              <div className="space-y-1">
                <label className="text-body-tiny font-bold text-brand-text-muted opacity-60">Current Location</label>
                <button
                  onClick={() => { onLocationClick(); onClose(); }}
                  className="w-full text-left transition-all group flex flex-row items-center gap-3 p-2 bg-transparent rounded-xl hover:bg-brand-primary/10"
                >
                  <Icon name="location" className="w-5 h-5 text-brand-accent shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col gap-0">
                    <div className="text-body-sm font-normal leading-tight text-brand-text">
                      {[siteDetail || locale, location, sector].filter(Boolean).join(', ') || 'The Wilds'}
                    </div>
                    <span className="text-[8px] text-brand-text-muted font-normal opacity-60">Tap to open details</span>
                  </div>
                </button>
              </div>

              {/* Action Grid - 3 Columns */}
              <div className="flex-1 flex flex-col justify-center gap-4 py-4 min-min-h-0">
                <label className="text-body-tiny font-bold text-brand-text-muted opacity-60 block mb-1">Menu</label>
                <div className="grid grid-cols-3 gap-y-4 sm:gap-y-6 md:gap-y-8 gap-x-2 pb-2">
                  <MenuItem label="Heroes" imageUrl="/icons/heroes.png" onClick={() => handleAction('character')} />
                  <MenuItem label="Backpack" imageUrl="/icons/backpack.png" onClick={() => handleAction('inventory')} badgeCount={badges.inventory} />
                  <MenuItem label="Chronicle" imageUrl="/icons/chronicle.png" onClick={() => handleAction('story')} badgeCount={badges.story} />
                  <MenuItem label="Quests" imageUrl="/icons/quests.png" onClick={() => handleAction('objectives')} badgeCount={badges.quests} />

                  <MenuItem label="Lore" imageUrl="/icons/lore.png" onClick={() => handleAction('world')} badgeCount={badges.world} />
                  <MenuItem label="People" imageUrl="/icons/people.png" onClick={() => handleAction('npcs')} badgeCount={badges.npcs} />
                  <MenuItem label="Map" imageUrl="/icons/map.png" onClick={() => handleAction('knowledge')} badgeCount={badges.map} />
                  <MenuItem
                    label="Merchant"
                    imageUrl="/icons/merchant.png"
                    onClick={() => handleAction('store')}
                    disabled={isCombatActive}
                    warning="The Merchant is hiding during combat."
                  />

                  <MenuItem label="GM Notes" imageUrl="/icons/gm-notes.png" onClick={() => handleAction('gm-notes')} badgeCount={badges.gmNotes} />
                  <MenuItem label="Forge" imageUrl="/icons/forge.png" onClick={() => handleAction('item-forge')} />
                  <MenuItem label="Scene" imageUrl="/icons/scene.png" onClick={() => handleAction('temp-stats')} />
                  <MenuItem label="Gallery" imageUrl="/icons/gallery.png" onClick={() => handleAction('gallery')} />

                  <MenuItem label="Rivals" imageUrl="/icons/rivals.png" onClick={() => handleAction('nemesis')} badgeCount={badges.nemesis} />
                  <MenuItem
                    label="Rest & Camp"
                    imageUrl="/icons/rest-camp.png"
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
              <span className="text-body-sm font-bold text-brand-text">Change Realm</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default HeaderMenuPanel;
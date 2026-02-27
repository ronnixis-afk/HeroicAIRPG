import React from 'react';
import { Icon } from './Icon';
import { View } from '../types';

interface BottomNavProps {
  onMenuClick: () => void;
  onInventoryClick: () => void;
  onChatClick: () => void;
  onMapClick: () => void;
  onCharacterClick: () => void;
  activeView: View;
  activePanel: 'menu' | 'abilities' | null;
  isCombatActive?: boolean;
  inventoryBadgeCount?: number;
  menuBadgeCount?: number;
}

const NavButton: React.FC<{
  label: string;
  iconName: string;
  onClick: () => void;
  isActive: boolean;
  colorClass?: string;
  iconClassName?: string;
  badgeCount?: number;
}> = ({ label, iconName, onClick, isActive, colorClass, iconClassName, badgeCount }) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center justify-center pt-2 pb-1 px-1 transition-all duration-200 relative min-w-[64px] ${isActive ? (colorClass || 'text-brand-accent') : 'text-brand-text-muted hover:text-brand-text'}`} 
    aria-label={label}
  >
    <div className="relative">
        <Icon name={iconName} className={`w-6 h-6 ${iconClassName || ''}`} />
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="absolute -top-1 -right-2 bg-brand-accent text-black text-[8px] font-black h-3.5 min-w-[14px] px-1 rounded-full flex items-center justify-center border border-brand-bg z-50 pointer-events-none shadow-sm animate-pulse">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
    </div>
    <span className={`text-[10px] font-normal mt-1 tracking-tight ${isActive ? '' : 'opacity-60'}`}>
        {label}
    </span>
  </button>
);

const BottomNav: React.FC<BottomNavProps> = ({ 
  onMenuClick, 
  onInventoryClick, 
  onChatClick, 
  onMapClick, 
  onCharacterClick,
  activeView,
  activePanel,
  isCombatActive = false,
  inventoryBadgeCount = 0,
  menuBadgeCount = 0
}) => {
  return (
    <nav className="h-[72px] bg-brand-bg/95 backdrop-blur-sm flex-shrink-0 flex items-center justify-around px-2 border-t border-brand-primary/10 shadow-[0_-4px_12px_rgba(0,0,0,0.2)]">
      <NavButton 
        label="Character" 
        iconName="character" 
        onClick={onCharacterClick} 
        isActive={activeView === 'character'} 
      />
      <NavButton 
        label="Inventory" 
        iconName="inventory" 
        onClick={onInventoryClick} 
        isActive={activeView === 'inventory'} 
        badgeCount={inventoryBadgeCount}
      />
      <NavButton 
        label="Play" 
        iconName={isCombatActive ? "sword" : "chat"} 
        onClick={onChatClick} 
        isActive={activeView === 'chat'} 
        colorClass={isCombatActive ? 'text-red-500' : 'text-brand-accent'}
        iconClassName={isCombatActive ? 'animate-clash' : ''}
      />
      <NavButton 
        label="Map" 
        iconName="map" 
        onClick={onMapClick} 
        isActive={activeView === 'knowledge'} 
      />
      <NavButton 
        label="More" 
        iconName="squaresPlus" 
        onClick={onMenuClick} 
        isActive={activePanel === 'menu'} 
        badgeCount={menuBadgeCount}
      />
    </nav>
  );
};

export default BottomNav;
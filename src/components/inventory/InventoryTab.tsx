import React from 'react';

interface InventoryTabProps {
    name: string;
    initials: string;
    imageUrl?: string;
    isActive: boolean;
    onClick: () => void;
    isShrunk?: boolean;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ name, initials, imageUrl, isActive, onClick, isShrunk = false }) => {
    // Custom truncation: use '..' if the name is too long to fit comfortably
    const displayName = name.length > 9 ? name.slice(0, 8) + '..' : name;

    return (
        <div className={`flex flex-col items-center group flex-shrink-0 transition-all duration-300 w-20 ${isShrunk ? 'gap-0.5' : 'gap-2'}`}>
            <button
                onClick={onClick}
                title={name}
                className={`relative flex flex-col items-center justify-center transition-all duration-300 ${
                    isActive ? 'scale-100 z-10' : 'opacity-80 hover:opacity-100 hover:scale-105'
                } ${isShrunk ? 'w-10 h-10' : 'w-20 h-20'}`}
            >
                <div className={`rounded-full overflow-hidden flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'border-brand-text' : 'border-brand-primary'} bg-brand-surface shadow-lg w-full h-full`}>
                        {imageUrl ? (
                        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                    ) : (
                        <span className={`font-bold text-brand-text-muted transition-all duration-300 ${isShrunk ? 'text-[10px]' : 'text-xl'}`}>{initials.slice(0, 2)}</span>
                    )}
                </div>
            </button>
            
            <span className={`font-bold transition-all duration-300 truncate w-full text-center ${isShrunk ? 'text-[8px] opacity-80' : 'text-body-sm opacity-100'} ${isActive ? 'text-brand-text' : 'text-brand-text-muted'}`}>
                {displayName}
            </span>
        </div>
    );
};
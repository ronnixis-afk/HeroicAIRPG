
import React from 'react';
import { ActorAvatar } from '../ActorAvatar';

/**
 * Compatibility wrapper for StatusAvatar.
 * Maps old prop names to the new unified ActorAvatar component.
 */
export const StatusAvatar: React.FC<any> = ({ 
    char, 
    actor, 
    size, 
    showBars, 
    showName, 
    isStealth, 
    isStealthed, 
    isEnriching, 
    isTargeted, 
    isActive,
    onClick, 
    className,
    tempHp,
    maxTempHp,
    hpOverride,
    maxHpOverride
}) => {
    return (
        <ActorAvatar 
            actor={char || actor}
            size={size}
            showBars={showBars}
            showName={showName}
            isStealthed={isStealth || isStealthed}
            isEnriching={isEnriching}
            isTargeted={isTargeted}
            isActive={isActive}
            onClick={onClick}
            className={className}
            hpOverride={hpOverride}
            maxHpOverride={maxHpOverride}
            tempHpOverride={tempHp}
            maxTempHpOverride={maxTempHp}
        />
    );
};

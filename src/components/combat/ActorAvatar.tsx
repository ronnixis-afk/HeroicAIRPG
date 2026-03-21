
import React from 'react';
import { ActorAvatar as UnifiedAvatar } from '../ActorAvatar';

/**
 * Compatibility wrapper for combat ActorAvatar.
 * Maps old prop names to the new unified ActorAvatar component.
 */
export const ActorAvatar: React.FC<any> = (props) => {
    // If props use 'char', map it to 'actor'
    const finalProps = {
        ...props,
        actor: props.actor || props.char,
        isStealthed: props.isStealthed || props.isStealth
    };
    return <UnifiedAvatar {...finalProps} />;
};

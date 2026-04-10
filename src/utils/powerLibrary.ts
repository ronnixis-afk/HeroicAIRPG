import { LibraryTrait } from './traitLibrary';
import { GENERIC_POWERS } from './traits/powerTraits';

/**
 * The unified Power Library.
 * Aggregates universal combat abilities (Powers).
 */
export const POWER_LIBRARY: LibraryTrait[] = [
    ...GENERIC_POWERS
];


import { Ability, SkillConfiguration, LibraryTrait } from '../types';
import { GENERIC_TRAITS } from './traits/genericTraits';
import { FANTASY_TRAITS } from './traits/fantasyTraits';
import { MODERN_TRAITS } from './traits/modernTraits';
import { SCIFI_TRAITS } from './traits/sciFiTraits';
import { MAGITECH_TRAITS } from './traits/magitechTraits';
import { COMBAT_TRAITS } from './traits/combatTraits';

/**
 * Fix: Re-exporting LibraryTrait from the central library to allow other modules to import it directly.
 */
export type { LibraryTrait };

/**
 * The unified Trait Library.
 * Aggregates universal generic traits with setting-specific specialized content.
 */
export const TRAIT_LIBRARY: LibraryTrait[] = [
    ...GENERIC_TRAITS,
    ...FANTASY_TRAITS,
    ...MODERN_TRAITS,
    ...SCIFI_TRAITS,
    ...MAGITECH_TRAITS,
    ...COMBAT_TRAITS
];

import { Ability, SkillConfiguration, LibraryTrait } from '../types';
export type { LibraryTrait };
import { GENERIC_TRAITS } from './traits/genericTraits';
import { FANTASY_TRAITS } from './traits/fantasyTraits';
import { MODERN_TRAITS } from './traits/modernTraits';
import { SCIFI_TRAITS } from './traits/sciFiTraits';
import { MAGITECH_TRAITS } from './traits/magitechTraits';
export const TRAIT_LIBRARY: LibraryTrait[] = [
    ...GENERIC_TRAITS,
    ...FANTASY_TRAITS,
    ...MODERN_TRAITS,
    ...SCIFI_TRAITS,
    ...MAGITECH_TRAITS
];

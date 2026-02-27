import { SkillConfiguration } from '../types';
import { FANTASY_TEMPLATES } from './templates/FantasyTemplateRegistry';
import { MODERN_TEMPLATES } from './templates/ModernTemplateRegistry';
import { SCIFI_TEMPLATES } from './templates/SciFiTemplateRegistry';
import { MAGITECH_TEMPLATES } from './templates/MagitechTemplateRegistry';

export interface CharacterTemplate {
    id: string;
    name: string;
    role: 'Tank' | 'DPS' | 'Healer' | 'Support' | 'Specialist' | 'Social' | 'Balanced' | 'Utility';
    backgroundTraitNames: string[];
    generalTraitNames: string[];
    combatTraitName: string;
    description: string;
    isShip: boolean;
}

/**
 * The unified Template Library.
 * Aggregates specialized archetypes for each setting.
 */
export const TEMPLATE_LIBRARY: Record<SkillConfiguration, CharacterTemplate[]> = {
    'Fantasy': FANTASY_TEMPLATES,
    'Modern': MODERN_TEMPLATES,
    'Sci-Fi': SCIFI_TEMPLATES,
    'Magitech': MAGITECH_TEMPLATES
};

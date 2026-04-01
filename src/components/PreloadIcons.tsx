'use client';

import { useEffect } from 'react';

const ICONS = [
  'attack.png',
  'backpack.png',
  'capital.png',
  'change-realm.png',
  'chaotic-alignment.png',
  'chronicle.png',
  'city.png',
  'evil-alignment.png',
  'experience-gained.png',
  'forge.png',
  'gallery.png',
  'gm-notes.png',
  'good-alignment.png',
  'heroes.png',
  'hostiles-detected.png',
  'lawful-alignment.png',
  'lore.png',
  'map.png',
  'merchant.png',
  'people.png',
  'persuade.png',
  'pickpocket.png',
  'quests.png',
  'recruit.png',
  'rest-camp.png',
  'rivals.png',
  'scene.png',
  'settings.png',
  'settlement.png',
  'sneak.png',
  'town.png'
];

/**
 * PreloadIcons component
 * This component silently fetches all critical PNG icons in the background
 * to ensure they are in the browser's memory/cache before they are needed.
 */
export default function PreloadIcons() {
  useEffect(() => {
    // Preload each icon by creating a new Image object
    ICONS.forEach((iconName) => {
      const img = new Image();
      img.src = `/icons/${iconName}`;
    });
  }, []);

  // This component doesn't render anything visible
  return null;
}

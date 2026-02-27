// types/Items.ts

import { AbilityScoreName, AbilityUsage, AbilityEffect, Buff, BodySlot, ItemTag } from './Core';

export interface DamageSource {
  dice: string;
  type: string;
}

export interface WeaponStats {
  enhancementBonus: number;
  ability: AbilityScoreName;
  damages: DamageSource[];
  critRange?: number;
}

export interface ArmorStats {
  baseAC: number;
  armorType: 'light' | 'medium' | 'heavy' | 'shield';
  plusAC: number;
  strengthRequirement: number;
}

export class Item {
  id: string;
  name: string;
  description: string;
  details: string;
  quantity?: number;
  tags: string[]; // Guaranteed array
  keywords: string[]; // Guaranteed array
  rarity?: 'Basic' | 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Unique' | 'Legendary' | 'Artifact';
  isNew?: boolean;
  weaponStats?: WeaponStats;
  armorStats?: ArmorStats;
  usage?: AbilityUsage;
  buffs?: Buff[];
  effect?: AbilityEffect;
  price?: number;
  equippedSlot?: BodySlot;
  bodySlotTag?: BodySlot; // NEW: The required slot for this item
  stackId?: string; // NEW: Prevents auto-merging of split stacks

  constructor(data: Partial<Item>) {
      this.id = data.id || `item-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      this.name = data.name || 'New Item';
      this.description = data.description || '';
      this.details = data.details || '';
      this.stackId = data.stackId;
      this.bodySlotTag = data.bodySlotTag;
      
      // Initialize with defaults
      this.tags = [];
      this.keywords = [];

      Object.assign(this, data);
      
      // Force tags and keywords to be arrays after Object.assign in case data contained strings
      const rawTags = (this as any).tags;
      if (Array.isArray(rawTags)) {
          this.tags = rawTags.filter(t => typeof t === 'string');
      } else if (typeof rawTags === 'string') {
          this.tags = [rawTags];
      } else {
          this.tags = [];
      }

      const rawKeywords = (this as any).keywords;
      if (Array.isArray(rawKeywords)) {
          this.keywords = rawKeywords.filter(k => typeof k === 'string');
      } else if (typeof rawKeywords === 'string') {
          this.keywords = [rawKeywords];
      } else {
          this.keywords = [];
      }
  }

  getDisplayName(): string {
    const quantity = this.quantity && this.quantity > 1 ? ` (x${this.quantity})` : '';
    return `${this.name}${quantity}`;
  }

  isUsable(): boolean {
    const hasUses = (this.quantity && this.quantity > 0) || (this.usage && this.usage.currentUses > 0);
    const isPassive = !this.quantity && !this.usage;
    
    // Defensive check for tags array
    const safeTags = Array.isArray(this.tags) ? this.tags : [];
    const isUnusableByTag = safeTags.some(tag => {
        if (typeof tag !== 'string') return false;
        return ['weapon', 'armor', 'shield', 'ammunition'].includes(tag.toLowerCase());
    });
    
    const hasEffect = !!this.effect;

    return (!isUnusableByTag && (hasUses || isPassive)) || hasEffect;
  }
  
  clone(): Item {
    return new Item(JSON.parse(JSON.stringify(this)));
  }
}

export interface StoreItem extends Item {
    price: number;
}

export interface Inventory {
  equipped: Item[];
  carried: Item[];
  storage: Item[];
  assets: Item[];
}

export interface InventoryUpdatePayload {
    ownerId: string;
    list: 'carried' | 'equipped' | 'storage' | 'assets';
    items: Partial<Item>[];
    action?: 'add' | 'remove';
}
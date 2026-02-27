import { BodySlot } from '../types';

/**
 * Maps standard anatomical slots to thematic synonyms based on item tags.
 * Generic terms used to support Fantasy, Modern, Sci-Fi and Magitech.
 */
export const getSlotSynonym = (slot: BodySlot | string | undefined, tags: string[] = []): string => {
    if (!slot) return 'Universal';
    
    const s = slot as BodySlot;
    const isShip = tags.includes('ship');
    const isMount = tags.includes('mount');

    if (isShip) {
        switch (s) {
            case 'Head': return 'Command Bridge';
            case 'Eyes': return 'Sensor Array';
            case 'Neck': return 'Fore / Prow';
            case 'Shoulders': return 'Reinforced Plating';
            case 'Body': return 'Main Hull';
            case 'Vest': return 'Internal Bay';
            case 'Bracers': return 'External Hardpoint';
            case 'Gloves': return 'Control Actuators';
            case 'Main Hand': return 'Primary Battery';
            case 'Off Hand': return 'Secondary Battery';
            case 'Ring 1': return 'Module Alpha';
            case 'Ring 2': return 'Module Beta';
            case 'Waist': return 'Power Core';
            case 'Legs': return 'Drive System';
            case 'Feet': return 'Thrusters / Landing Gear';
            case 'Accessory 1': return 'Auxiliary System';
            case 'Accessory 2': return 'Special Component';
            default: return slot;
        }
    }

    if (isMount) {
        switch (s) {
            case 'Head': return 'Headpiece';
            case 'Eyes': return 'Visor / Blinders';
            case 'Neck': return 'Collar / Gorget';
            case 'Shoulders': return 'Shoulder Barding';
            case 'Body': return 'Barding';
            case 'Vest': return 'Saddle Padding';
            case 'Bracers': return 'Fore-Leg Guards';
            case 'Gloves': return 'Lower Fetlocks';
            case 'Main Hand': return 'Primary Strike';
            case 'Off Hand': return 'Support Strike';
            case 'Ring 1': return 'Charm';
            case 'Ring 2': return 'Seal / Sigil';
            case 'Waist': return 'Harness / Girth';
            case 'Legs': return 'Hind-Leg Guards';
            case 'Feet': return 'Shoes / Talons';
            case 'Accessory 1': return 'Ornament';
            case 'Accessory 2': return 'Trimming';
            default: return slot;
        }
    }

    return slot;
};

/**
 * Retrieves a thematic background image URL for an item based on its assigned slot.
 */
export const getSlotBackgroundImageUrl = (slot: string | undefined, tags: string[] = []): string | null => {
    if (!slot && !tags.includes('shield')) return null;
    
    // Shield tag takes priority over generic slot
    if (tags.includes('shield')) return 'https://lh3.googleusercontent.com/d/1M4sIRxiwdOfcVLpP55w8_m2j4gCY0X1t';

    const s = slot?.toLowerCase();
    let id = '';
    switch (s) {
        case 'head': case 'eyes': id = '1h7t1v8ApcH9_sE7A1ongC0d7aHE0BrOg'; break;
        case 'neck': id = '1qeYV70W3PZGSw_kI1WBy5VUn--OwPAeT'; break;
        case 'shoulders': id = '1kSzzqCngN8S2Pc2pKuCh7ertSkTCtcy1'; break;
        case 'body': id = '1Ia_RueuZGQyJEpOdeDZqIWEIKcc7dfMB'; break;
        case 'vest': id = '1vFY_A1Lj8KN0A1yKwRgU1GpceZ3DTALY'; break;
        case 'bracers': id = '1UNZ01wbnpUBVxeVYqmLWKXAgHXS2ezH8'; break;
        case 'gloves': id = '1PXEqXp35-w-gaBMLftJ3_cW4xFihshVr'; break;
        case 'main hand': case 'off hand': id = '1A9Jdz9H3it5BTtaDQvqIf4sG63ibMNxG'; break;
        case 'ring': case 'ring 1': case 'ring 2': id = '15GFeKMPNcRtdt1i3a5SX89OCDlDW8rTF'; break;
        case 'waist': id = '1AVecFHatJAKgJ_SealnH83VfXq1pxn9M'; break;
        case 'legs': id = '1COhUQ9REMg6puvrTGwr722azNIupedsq'; break;
        case 'feet': id = '1n5WxXE8TbeFYxmN2DKDBe9vzmJ_LUlOX'; break;
        case 'accessory': case 'accessory 1': case 'accessory 2': id = '1YdKcuwSQHBD4rZd3y2GMUauBYMkPzKTE'; break;
        default: return null;
    }
    return `https://lh3.googleusercontent.com/d/${id}`;
};
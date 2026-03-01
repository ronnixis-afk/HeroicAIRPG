// types/Characters.ts

/* Fix: Added SkillConfiguration to imports for LibraryTrait support */
import { AbilityScoreName, StatusEffect, AbilityUsage, AbilityEffect, Buff, ActiveBuff, SkillName, AbilityScore, calculateModifier, formatModifier, getStatPenalties, resolveCanonicalSkillName, ABILITY_SCORES, SKILL_DEFINITIONS, CombatActorSize, BASE_SIZE_MODIFIERS, ArchetypeName, SkillConfiguration } from './Core';
import { Inventory, Item } from './Items';
import { calculateBaseHeroicPoints } from '../utils/mechanics';

export interface Ability {
    id: string;
    name: string;
    description: string;
    tags?: string[];
    usage?: AbilityUsage;
    effect?: AbilityEffect;
    buffs?: Buff[];
    isRefining?: boolean; // Track when AI is skinning the trait
    /* Fix: Added isLevelUpTrait to Ability interface to resolve property missing error in FeaturesList */
    isLevelUpTrait?: boolean;
}

/* Fix: Define LibraryTrait interface used in traitLibrary and creation wizard */
export interface LibraryTrait extends Omit<Ability, 'id'> {
    requiredConfig?: SkillConfiguration;
    category: 'general' | 'background' | 'combat' | 'ship_hull' | 'ship_module';
    isShipOnly?: boolean;
    requires?: string[];
}

export interface CompanionAbility extends Ability { }

export interface CalculatedCombatStats {
    totalAC: number;
    acBreakdown: string;
    toHitBonusString: string;
    mainHandToHitBonus: number; // Raw numeric for engine
    offHandToHitBonus: number;  // Raw numeric for engine
    attackBreakdown: string;
    damageValue: string;
    damageType: string;
    damageBreakdown: string;
    baseAttacksPerHand: number; // The un-multiplied attack count (e.g. 2 for Lvl 7)
    mainHandAttacks: number;    // Added for deterministic resolution
    offHandAttacks: number;     // Added for deterministic resolution
    numberOfAttacks: number;   // The total count for UI (e.g. 4 for Lvl 7 Dual Wield)
    isDualWielding: boolean;
    isDueling: boolean;
    isTwoHanding: boolean;
    isFlurryActive: boolean;
    // Style flag properties
    hasTwoWeaponFighting: boolean;
    hasGreatWeaponFighting: boolean;
    hasDuelingStyle: boolean;
    mainHandAbilityName?: string;
    offHandToHitBonusString?: string;
    offHandAttackBreakdown?: string;
    offHandDamageValue?: string;
    offHandDamageType?: string;
    offHandDamageBreakdown?: string;
    // Fix: Added missing buff indicators to the CalculatedCombatStats interface
    isAcBuffed: boolean;
    isAttackBuffed: boolean;
    isDamageBuffed: boolean;
    isOffHandAttackBuffed: boolean;
    isOffHandDamageBuffed: boolean;
}

export class PlayerCharacter {
    id: string;
    name: string;
    age: number;
    race: string;
    gender: string;
    profession: string;
    appearance: string;
    background: string;
    abilities: Ability[];
    imageUrl?: string;
    level: number;
    experiencePoints: number;
    proficiencyBonus: number;
    armorClass: number;
    speed: number;
    climbSpeed: number;
    swimSpeed: number;
    flySpeed: number;
    size: CombatActorSize;
    maxHitPoints: number;
    currentHitPoints: number;
    temporaryHitPoints: number;
    heroicPoints: number;
    maxHeroicPoints: number; // FOUNDATION: Support for traits increasing capacity
    abilityScores: Record<AbilityScoreName, AbilityScore>;
    savingThrows: Record<AbilityScoreName, { proficient: boolean }>;
    skills: Record<SkillName, { proficient: boolean }>;
    numberOfAttacks: number;
    statusEffects: StatusEffect[];
    activeBuffs: ActiveBuff[];
    keywords: string[];
    resistances: string[];
    immunities: string[];
    vulnerabilities: string[];
    isShip?: boolean;
    isMount?: boolean;
    isSentient?: boolean;
    alignment?: { lawChaos: number; goodEvil: number };
    combatLoadout?: {
        primaryAbilityId?: string;
        secondaryAbilityId?: string;
    };

    constructor(data: Partial<PlayerCharacter>) {
        Object.assign(this, data);
        this.age = Number(data.age) || 25;
        this.race = data.race || 'Unknown';
        this.level = Number(data.level) || 1;
        this.experiencePoints = Number(data.experiencePoints) || 0;
        this.proficiencyBonus = Number(data.proficiencyBonus) || 2;
        this.armorClass = Number(data.armorClass) || 10;
        this.speed = Number(data.speed) || 30;
        this.climbSpeed = Number(data.climbSpeed) || 0;
        this.swimSpeed = Number(data.swimSpeed) || 0;
        this.flySpeed = Number(data.flySpeed) || 0;
        this.size = data.size || 'Medium';

        this.statusEffects = data.statusEffects || [];
        this.activeBuffs = data.activeBuffs || [];
        this.abilities = (data.abilities || []).map(a => ({
            ...a,
            id: a.id || `ability-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));

        // CULPRIT FIX: The constructor now always derives maxHeroicPoints from its abilities/level.
        // This prevents "Value Lock" where stale data.maxHeroicPoints from the state would override new trait effects.
        this.maxHeroicPoints = this.getMaxHeroicPoints();
        this.heroicPoints = data.heroicPoints !== undefined ? Math.min(Number(data.heroicPoints), this.maxHeroicPoints) : this.maxHeroicPoints;

        // Derived Vitality
        this.maxHitPoints = Number(data.maxHitPoints) || 10;
        this.currentHitPoints = data.currentHitPoints !== undefined ? Number(data.currentHitPoints) : this.maxHitPoints;
        this.temporaryHitPoints = Number(data.temporaryHitPoints) || 0;

        // Standardized base attack count (1 attack/round up to lvl 4, 2 at lvl 5, etc.)
        this.numberOfAttacks = Math.ceil(this.level / 5);

        this.keywords = data.keywords || [];
        this.resistances = data.resistances || [];
        this.immunities = data.immunities || [];
        this.vulnerabilities = data.vulnerabilities || [];
        this.isShip = data.isShip;
        this.isMount = data.isMount;
        this.isSentient = data.isSentient;
        this.alignment = data.alignment || { lawChaos: 0, goodEvil: 0 };
        this.combatLoadout = data.combatLoadout || { primaryAbilityId: '', secondaryAbilityId: '' };
    }

    /**
     * Calculates the maximum heroic point capacity based on level and bonuses.
     * Formula: Math.floor((level - 1) / 5) + 1 + HeroicTraits.
     */
    getMaxHeroicPoints(inventory?: Inventory): number {
        const base = calculateBaseHeroicPoints(this.level);

        // Scan for bonuses in abilities and active buffs
        let extraBonus = 0;
        const allBuffs: (Buff | ActiveBuff)[] = [
            ...(this.activeBuffs || []),
            ...this.abilities.flatMap(a => a.buffs || [])
        ];

        if (inventory) {
            allBuffs.push(...inventory.equipped.flatMap(i => i.buffs || []));
        }

        allBuffs.forEach(buff => {
            if (buff.type === 'hero_points') {
                extraBonus += buff.bonus;
            }
        });

        return base + extraBonus;
    }

    getCombatStats(inventory: Inventory): CalculatedCombatStats {
        return calculateCombatStats(this, inventory);
    }

    getStandardAbilityDC(inventory?: Inventory): number {
        const mods = ABILITY_SCORES.map(s => {
            const score = inventory ? this.getBuffedScore(s, inventory) : (this.abilityScores[s]?.score || 10);
            return calculateModifier(score);
        });
        const maxMod = Math.max(...mods);
        return 8 + this.proficiencyBonus + maxMod;
    }

    getStandardEffectFormula(effect: AbilityEffect, inventory?: Inventory): string {
        const L = this.level || 1;
        const mods = ABILITY_SCORES.map(s => {
            const score = inventory ? this.getBuffedScore(s, inventory) : (this.abilityScores[s]?.score || 10);
            return calculateModifier(score);
        });
        const maxMod = Math.max(...mods);

        const isMulti = effect.targetType === 'Multiple';
        const isHeal = effect.type === 'Heal';

        if (isHeal) {
            if (isMulti) {
                const bonus = Math.max(1, Math.floor(maxMod / 2)) * L;
                return `${L}d4${bonus >= 0 ? '+' : ''}${bonus}`;
            } else {
                const bonus = maxMod * L;
                return `${L}d8${bonus >= 0 ? '+' : ''}${bonus}`;
            }
        } else {
            if (isMulti) {
                const bonus = Math.max(1, Math.floor(maxMod / 2)) * L;
                return `${L}d6${bonus >= 0 ? '+' : ''}${bonus}`;
            } else {
                const bonus = maxMod * L;
                return `${L}d10${bonus >= 0 ? '+' : ''}${bonus}`;
            }
        }
    }

    // Fix: Added missing getSneakAttackDice method to support UI displays in CombatStats
    getSneakAttackDice(): number {
        return Math.ceil(this.level / 2);
    }

    getBuffedScore(abilityName: AbilityScoreName, inventory: Inventory): number {
        const itemBuffs = inventory.equipped.flatMap(item => item.buffs || []);
        const abilityBuffs = this.abilities.flatMap(ability => ability.buffs || []);
        const activeBuffsList = this.activeBuffs || [];
        const allBuffs = [...itemBuffs, ...abilityBuffs, ...activeBuffsList];

        const normalizedAbilityName = (abilityName || '').toLowerCase() as AbilityScoreName;
        if (!this.abilityScores || !this.abilityScores[normalizedAbilityName]) {
            return 10;
        }
        const baseScore = this.abilityScores[normalizedAbilityName].score;
        const buff = allBuffs
            .filter(b => b.type === 'ability' && b.abilityName === normalizedAbilityName)
            .reduce((sum, b) => sum + b.bonus, 0);

        const sizeStats = BASE_SIZE_MODIFIERS[this.size] || BASE_SIZE_MODIFIERS['Medium'];
        let sizeMod = 0;
        if (normalizedAbilityName === 'strength') sizeMod = sizeStats.str;
        else if (normalizedAbilityName === 'dexterity') sizeMod = sizeStats.dex;
        else if (normalizedAbilityName === 'constitution') sizeMod = sizeStats.con;

        return baseScore + buff + sizeMod;
    }

    getSkillBonus(skill: string, inventory: Inventory, fallbackAbility?: string): number {
        const penalties = getStatPenalties(this.statusEffects || []);
        const itemBuffs = inventory.equipped.flatMap(item => item.buffs || []);
        const abilityBuffs = this.abilities.flatMap(ability => ability.buffs || []);
        const activeBuffsList = this.activeBuffs || [];
        const allBuffs = [...itemBuffs, ...abilityBuffs, ...activeBuffsList];

        const canonicalSkill = resolveCanonicalSkillName(skill);

        if (!canonicalSkill) {
            const normalizedInput = skill.trim().toLowerCase();
            const abilityName = ABILITY_SCORES.find(a => a === normalizedInput);
            if (abilityName) {
                const score = this.getBuffedScore(abilityName, inventory);
                return calculateModifier(score) + penalties.check;
            }
            return penalties.check;
        }

        const skillDef = SKILL_DEFINITIONS[canonicalSkill];
        const ability = skillDef.ability;
        const score = this.getBuffedScore(ability, inventory);
        const modifier = calculateModifier(score);

        const skillEntry = this.skills ? this.skills[canonicalSkill] : undefined;
        const isProficient = skillEntry?.proficient || false;

        const skillBuff = allBuffs
            .filter(b => b.type === 'skill' && b.skillName === canonicalSkill)
            .reduce((sum, b) => sum + b.bonus, 0);

        return modifier + (isProficient ? this.proficiencyBonus : 0) + skillBuff + penalties.check;
    }

    getSavingThrowBonus(abilityName: AbilityScoreName, inventory: Inventory): number {
        const normalizedAbilityName = (abilityName || '').toLowerCase() as AbilityScoreName;
        if (!this.savingThrows || !this.savingThrows[normalizedAbilityName]) {
            const score = this.getBuffedScore(normalizedAbilityName, inventory);
            return calculateModifier(score);
        }
        const penalties = getStatPenalties(this.statusEffects || []);
        const itemBuffs = inventory.equipped.flatMap(item => item.buffs || []);
        const abilityBuffs = this.abilities.flatMap(ability => ability.buffs || []);
        const activeBuffsList = this.activeBuffs || [];
        const allBuffs = [...itemBuffs, ...abilityBuffs, ...activeBuffsList];

        const score = this.getBuffedScore(normalizedAbilityName, inventory);
        const modifier = calculateModifier(score);
        const isProficient = this.savingThrows[normalizedAbilityName].proficient;
        const genericSaveBuff = allBuffs
            .filter(b => b.type === 'save')
            .reduce((sum, b) => {
                if (!b.abilityName || b.abilityName === normalizedAbilityName) {
                    return sum + b.bonus;
                }
                return sum;
            }, 0);
        return modifier + (isProficient ? this.proficiencyBonus : 0) + genericSaveBuff + penalties.save;
    }

    getMaxTemporaryHitPoints(inventory: Inventory): number {
        const itemBuffs = inventory.equipped.flatMap(item => item.buffs || []);
        const abilityBuffs = this.abilities.flatMap(ability => ability.buffs || []);
        const activeBuffsList = this.activeBuffs || [];
        const allBuffs = [...itemBuffs, ...abilityBuffs, ...activeBuffsList];

        const baseMax = allBuffs
            .filter(b => b.type === 'temp_hp')
            .reduce((sum, b) => sum + b.bonus, 0);

        return this.isShip ? baseMax * 2 : baseMax;
    }

    getTraitPointMetrics() {
        const total = Math.floor(this.level / 3);
        const usedTraits = (this.abilities || []).filter(a => a.isLevelUpTrait).length;
        return {
            total,
            used: usedTraits,
            available: Math.max(0, total - usedTraits)
        };
    }
}

export class Companion extends PlayerCharacter {
    personality: string;
    isInParty?: boolean;
    relationship: number;
    rank?: 'normal' | 'elite' | 'boss';
    template?: string;
    cr?: string;
    affinity?: string;
    archetype?: ArchetypeName | string;

    constructor(data: Partial<Companion>) {
        super(data);
        this.personality = data.personality || '';
        this.isInParty = data.isInParty !== undefined ? data.isInParty : true;
        this.relationship = Number(data.relationship || 0);
        this.rank = data.rank || 'normal';
        this.template = data.template || 'Brute';
        this.cr = data.cr || 'Normal';
        this.affinity = data.affinity || 'None';
        this.archetype = data.archetype || 'Bipedal';
    }
}

export function calculateCombatStats(character: PlayerCharacter | Companion, inventory: Inventory): CalculatedCombatStats {
    const itemBuffs = inventory.equipped.flatMap(item => item.buffs || []);
    // FIX: Simplified abilityBuffs extraction to use the buffs array on Ability objects, fixing property missing and type mismatch errors
    const abilityBuffs = character.abilities.flatMap(ability => ability.buffs || []);

    const activeBuffsList = character.activeBuffs || [];
    const allBuffs = [...itemBuffs, ...abilityBuffs, ...activeBuffsList];

    const penalties = getStatPenalties(character.statusEffects || []);
    const sizeStats = BASE_SIZE_MODIFIERS[character.size] || BASE_SIZE_MODIFIERS['Medium'];

    // Track buff indicators
    let isAcBuffed = false;
    let isAttackBuffed = false;
    let isDamageBuffed = false;
    let isOffHandAttackBuffed = false;
    let isOffHandDamageBuffed = false;

    // Combat Styles (Trait Guards)
    const hasTwoWeaponFighting = character.abilities.some(a => a.name === "Two-Weapon Style");
    const hasGreatWeaponFighting = character.abilities.some(a => a.name === "Great Weapon Fighting");
    const hasDuelingStyle = character.abilities.some(a => a.name === "Dueling Style");
    const hasUnarmedStyle = character.abilities.some(a => a.name === "Unarmed Style");
    const hasFlurryOfBlows = character.abilities.some(a => a.name === "Flurry of Blows");

    const getBuffedScore = (abilityName: AbilityScoreName): number => {
        if ('getBuffedScore' in character) {
            return (character as PlayerCharacter).getBuffedScore(abilityName, inventory);
        }

        const charData = character as any;
        const normalizedAbilityName = (abilityName || '').toLowerCase() as AbilityScoreName;
        if (!charData.abilityScores || !charData.abilityScores[normalizedAbilityName]) return 10;

        const baseScore = charData.abilityScores[normalizedAbilityName].score;
        const buff = allBuffs
            .filter(b => b.type === 'ability' && b.abilityName === normalizedAbilityName)
            .reduce((sum, b) => sum + b.bonus, 0);

        let sizeMod = 0;
        if (normalizedAbilityName === 'strength') sizeMod = sizeStats.str;
        else if (normalizedAbilityName === 'dexterity') sizeMod = sizeStats.dex;
        else if (normalizedAbilityName === 'constitution') sizeMod = sizeStats.con;

        return baseScore + buff + sizeMod;
    };

    const strMod = calculateModifier(getBuffedScore('strength'));
    const dexMod = calculateModifier(getBuffedScore('dexterity'));

    let totalAC = 10 + dexMod + sizeStats.ac;
    let acBreakdown = `10 (Base) + ${dexMod} (Dex)`;

    if (sizeStats.ac !== 0) {
        acBreakdown += ` + ${sizeStats.ac} (Size)`;
    }

    let equippedArmor: Item | undefined;
    let equippedShield: Item | undefined;
    let mainHandWeapon: Item | undefined;
    let offHandWeapon: Item | undefined;

    const isWeapon = (i: Item) => i.weaponStats || i.tags?.some(t => t.toLowerCase().includes('weapon'));

    inventory.equipped.forEach(item => {
        if (item.armorStats) {
            if (item.armorStats.armorType === 'shield') equippedShield = item;
            else equippedArmor = item;
        }
        if (isWeapon(item)) {
            if (item.equippedSlot === 'Main Hand') mainHandWeapon = item;
            else if (item.equippedSlot === 'Off Hand') offHandWeapon = item;
        }
    });

    if (equippedArmor && equippedArmor.armorStats) {
        const stats = equippedArmor.armorStats;
        let dexBonusForAC = dexMod;
        let dexDetail = `${dexMod} (Dex)`;

        if (stats.armorType === 'medium') {
            dexBonusForAC = Math.min(dexMod, 2);
            dexDetail = `${dexBonusForAC} (Dex, max 2)`;
        } else if (stats.armorType === 'heavy') {
            dexBonusForAC = 0;
            dexDetail = '0 (Dex)';
        }

        totalAC = stats.baseAC + dexBonusForAC + sizeStats.ac;
        acBreakdown = `${stats.baseAC} (${equippedArmor.name}) + ${dexDetail}`;

        if (sizeStats.ac !== 0) acBreakdown += ` + ${sizeStats.ac} (Size)`;
        if (stats.plusAC > 0) {
            totalAC += stats.plusAC;
            acBreakdown += ` + ${stats.plusAC} (Enhance)`;
            isAcBuffed = true;
        }
    }

    if (equippedShield && equippedShield.armorStats) {
        const sStats = equippedShield.armorStats;
        totalAC += sStats.baseAC;
        acBreakdown += ` + ${sStats.baseAC} (${equippedShield.name})`;
        if (sStats.plusAC > 0) {
            totalAC += sStats.plusAC;
            acBreakdown += ` + ${sStats.plusAC} (Enhance)`;
            isAcBuffed = true;
        }
    }

    const isTwoHanding = !!(mainHandWeapon && mainHandWeapon.tags?.some(t => t.toLowerCase().includes('heavy')));
    const isDualWielding = !isTwoHanding && !!(mainHandWeapon && offHandWeapon);
    const isDueling = !isTwoHanding && !equippedShield && ((!!mainHandWeapon && !offHandWeapon) || (!mainHandWeapon && !!offHandWeapon));

    // Core Logic: Flurry of Blows is only active when both weapon hand slots are free
    const isStrictlyUnarmed = !mainHandWeapon && !offHandWeapon;
    const isFlurryActive = hasFlurryOfBlows && isStrictlyUnarmed;

    if (isDueling && hasDuelingStyle) {
        totalAC += 1;
        acBreakdown += ` + 1 (Dueling Style)`;
        isAcBuffed = true;
    }

    const acBuffBonus = allBuffs.filter(b => b.type === 'ac').reduce((sum, b) => sum + b.bonus, 0);
    if (acBuffBonus > 0) {
        totalAC += acBuffBonus;
        acBreakdown += ` + ${acBuffBonus} (Buff)`;
        isAcBuffed = true;
    }

    if (penalties.ac !== 0) {
        totalAC += penalties.ac;
        acBreakdown += ` ${formatModifier(penalties.ac)} (Status)`;
    }

    // Number of Attacks Calculation
    const baseAttacksPerHand = Math.ceil(character.level / 5);

    let mainHandAttacks = baseAttacksPerHand;
    let offHandAttacks = 0;

    if (isFlurryActive) {
        mainHandAttacks += 1;
    }

    if (isDualWielding) {
        offHandAttacks = 1;
        if (hasTwoWeaponFighting) {
            offHandAttacks += 1;
        }
    }

    const finalAttackCountForUI = mainHandAttacks + offHandAttacks;

    const equippedWeapon = mainHandWeapon || offHandWeapon || inventory.equipped.find(item => isWeapon(item));

    // Best modifier logic for Unarmed Style
    const bestUnarmedMod = hasUnarmedStyle ? Math.max(strMod, dexMod) : dexMod;
    const bestUnarmedLabel = hasUnarmedStyle
        ? (strMod >= dexMod ? 'Str' : 'Dex')
        : 'Dex';

    // Initial Fallback Values
    let toHitBonusString = formatModifier(character.proficiencyBonus + bestUnarmedMod);
    let attackBreakdown = `Prof(${formatModifier(character.proficiencyBonus)}) + ${bestUnarmedLabel}(${formatModifier(bestUnarmedMod)})`;

    let damageValue = hasUnarmedStyle ? `1d6${formatModifier(bestUnarmedMod)}` : '1';
    let damageType = 'Bludgeoning';
    let damageBreakdown = hasUnarmedStyle
        ? `1d6 (Unarmed Style) + ${bestUnarmedLabel}(${formatModifier(bestUnarmedMod)})`
        : '1 (Unarmed)';
    let mainHandAbilityName = bestUnarmedLabel;

    let mainHandToHitBonus = character.proficiencyBonus + bestUnarmedMod;
    let offHandToHitBonus = character.proficiencyBonus + bestUnarmedMod;

    let offHandToHitBonusString: string | undefined;
    let offHandAttackBreakdown: string | undefined;
    let offHandDamageValue: string | undefined;
    let offHandDamageType: string | undefined;
    let offHandDamageBreakdown: string | undefined;

    const calculateWeaponMetrics = (weapon: Item) => {
        if (!weapon.weaponStats) return null;
        const stats = weapon.weaponStats;
        const abilityMod = calculateModifier(getBuffedScore(stats.ability));
        const attackBuffBonus = allBuffs.filter(b => b.type === 'attack').reduce((sum, b) => sum + b.bonus, 0);

        const dwPenalty = (isDualWielding && !hasTwoWeaponFighting) ? -2 : 0;
        const totalToHit = character.proficiencyBonus + abilityMod + stats.enhancementBonus + attackBuffBonus + penalties.attack + dwPenalty;

        const toHitStr = formatModifier(totalToHit);
        const abilityNameLabel = stats.ability.charAt(0).toUpperCase() + stats.ability.slice(1, 3).toLowerCase();
        let atkBrk = `Prof(${formatModifier(character.proficiencyBonus)}) + ${abilityNameLabel}(${formatModifier(abilityMod)}) + Enh(${formatModifier(stats.enhancementBonus)})`;
        if (attackBuffBonus > 0) atkBrk += ` + ${attackBuffBonus} (Buff)`;
        if (penalties.attack !== 0) atkBrk += ` ${formatModifier(penalties.attack)} (Status)`;
        if (isDualWielding && !hasTwoWeaponFighting) atkBrk += ` - 2 (Dual Wield)`;

        const damageBuffBonus = allBuffs.filter(b => b.type === 'damage').reduce((sum, b) => sum + b.bonus, 0);
        const effectiveDmgAbilityMod = (isTwoHanding && hasGreatWeaponFighting) ? abilityMod * 2 : abilityMod;
        const duelingBonus = (isDueling && hasDuelingStyle) ? 2 : 0;

        const primaryDamageBonus = effectiveDmgAbilityMod + stats.enhancementBonus + damageBuffBonus + duelingBonus;
        const primaryDamageSource = stats.damages[0];
        let dmgVal = `${primaryDamageSource.dice}${primaryDamageBonus !== 0 ? formatModifier(primaryDamageBonus) : ''}`;
        let dmgTyp = primaryDamageSource.type;

        const otherDamages = stats.damages.slice(1).map(d => `+ ${d.dice} ${d.type}`);
        if (otherDamages.length > 0) {
            dmgVal = `${dmgVal} ${dmgTyp}`;
            dmgVal = [dmgVal, ...otherDamages].join(' ');
            dmgTyp = "";
        }

        let dmgBrk = `Base + ${abilityNameLabel}(${formatModifier(abilityMod)})`;
        if (isTwoHanding && hasGreatWeaponFighting) dmgBrk += ` x 2 (Style)`;
        if (stats.enhancementBonus !== 0) dmgBrk += ` + Enh(${formatModifier(stats.enhancementBonus)})`;
        if (damageBuffBonus > 0) dmgBrk += ` + ${damageBuffBonus} (Buff)`;
        if (isDueling && hasDuelingStyle) dmgBrk += ` + 2 (Dueling Style)`;

        // Calculate per-weapon buff flags
        const isWeaponAttackBuffed = attackBuffBonus > 0 || stats.enhancementBonus > 0;
        const isWeaponDamageBuffed = damageBuffBonus > 0 || stats.enhancementBonus > 0 || (isTwoHanding && hasGreatWeaponFighting) || (isDueling && hasDuelingStyle);

        return {
            totalToHit, toHitStr, atkBrk, dmgVal, dmgTyp, dmgBrk, abilityNameLabel,
            isWeaponAttackBuffed, isWeaponDamageBuffed
        };
    };

    if (mainHandWeapon) {
        const metrics = calculateWeaponMetrics(mainHandWeapon);
        if (metrics) {
            mainHandToHitBonus = metrics.totalToHit;
            toHitBonusString = metrics.toHitStr;
            attackBreakdown = metrics.atkBrk;
            damageValue = metrics.dmgVal;
            damageType = metrics.dmgTyp;
            damageBreakdown = metrics.dmgBrk;
            mainHandAbilityName = metrics.abilityNameLabel;
            isAttackBuffed = metrics.isWeaponAttackBuffed;
            isDamageBuffed = metrics.isWeaponDamageBuffed;
        }
    } else if (offHandWeapon) {
        const metrics = calculateWeaponMetrics(offHandWeapon);
        if (metrics) {
            mainHandToHitBonus = metrics.totalToHit;
            toHitBonusString = metrics.toHitStr;
            attackBreakdown = metrics.atkBrk;
            damageValue = metrics.dmgVal;
            damageType = metrics.dmgTyp;
            damageBreakdown = metrics.dmgBrk;
            mainHandAbilityName = metrics.abilityNameLabel;
            isAttackBuffed = metrics.isWeaponAttackBuffed;
            isDamageBuffed = metrics.isWeaponDamageBuffed;
        }
    } else if (equippedWeapon) {
        const metrics = calculateWeaponMetrics(equippedWeapon);
        if (metrics) {
            mainHandToHitBonus = metrics.totalToHit;
            toHitBonusString = metrics.toHitStr;
            attackBreakdown = metrics.atkBrk;
            damageValue = metrics.dmgVal;
            damageType = metrics.dmgTyp;
            damageBreakdown = metrics.dmgBrk;
            mainHandAbilityName = metrics.abilityNameLabel;
            isAttackBuffed = metrics.isWeaponAttackBuffed;
            isDamageBuffed = metrics.isWeaponDamageBuffed;
        }
    }

    if (isDualWielding && offHandWeapon) {
        const metrics = calculateWeaponMetrics(offHandWeapon);
        if (metrics) {
            offHandToHitBonus = metrics.totalToHit;
            offHandToHitBonusString = metrics.toHitStr;
            offHandAttackBreakdown = metrics.atkBrk;
            offHandDamageValue = metrics.dmgVal;
            offHandDamageType = metrics.dmgTyp;
            offHandDamageBreakdown = metrics.dmgBrk;
            isOffHandAttackBuffed = metrics.isWeaponAttackBuffed;
            isOffHandDamageBuffed = metrics.isWeaponDamageBuffed;
        }
    }

    const extraDamageBuffs = allBuffs.filter(b => b.type === 'exdam' && b.damageDice);
    if (extraDamageBuffs.length > 0) {
        isDamageBuffed = true;
        if (isDualWielding) isOffHandDamageBuffed = true;
    }

    const applyExtraDamage = (val: string, brk: string) => {
        let newVal = val;
        let newBrk = brk;
        extraDamageBuffs.forEach(buff => {
            const typeLabel = buff.damageType || 'Force';
            const part = `+ ${buff.damageDice} ${typeLabel}`;
            if (!newVal.includes(part)) {
                newVal += ` ${part}`;
                newBrk += ` + ${typeLabel} Buff`;
            }
        });
        return { newVal, newBrk };
    };

    const mainRes = applyExtraDamage(damageValue, damageBreakdown);
    damageValue = mainRes.newVal;
    damageBreakdown = mainRes.newBrk;

    if (offHandDamageValue !== undefined && offHandDamageBreakdown !== undefined) {
        const offRes = applyExtraDamage(offHandDamageValue, offHandDamageBreakdown);
        offHandDamageValue = offRes.newVal;
        offHandDamageBreakdown = offRes.newBrk;
    }

    return {
        totalAC,
        acBreakdown,
        toHitBonusString,
        mainHandToHitBonus,
        offHandToHitBonus,
        attackBreakdown,
        damageValue,
        damageType,
        damageBreakdown,
        baseAttacksPerHand,
        mainHandAttacks,
        offHandAttacks,
        numberOfAttacks: finalAttackCountForUI,
        isDualWielding,
        isDueling,
        isTwoHanding,
        isFlurryActive,
        hasTwoWeaponFighting,
        hasGreatWeaponFighting,
        hasDuelingStyle,
        mainHandAbilityName,
        offHandToHitBonusString,
        offHandAttackBreakdown,
        offHandDamageValue,
        offHandDamageType,
        offHandDamageBreakdown,
        isAcBuffed,
        isAttackBuffed,
        isDamageBuffed,
        isOffHandAttackBuffed,
        isOffHandDamageBuffed
    };
}

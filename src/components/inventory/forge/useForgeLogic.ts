
// components/inventory/forge/useForgeLogic.ts

import { useState, useContext, useEffect, useMemo } from 'react';
import { GameDataContext } from '../../../context/GameDataContext';
import { Item, AbilityEffect, AbilityUsage, FORGE_GROUPS, WeaponStats, ArmorStats, BodySlot, SkillConfiguration, BuffDuration } from '../../../types';
import { generateForgeDetails, inferTagsFromStats } from '../../../services/aiItemService';
import { calculateItemPrice, forgeRandomItem, buildMechanicalSummary, isModifierCategoryAllowedForSlot, generateMechanicalEffect } from '../../../utils/itemMechanics';
import { MODIFIER_REGISTRY, ModifierCategory, applyModifierToItem, getTempHpLabel } from '../../../utils/itemModifiers';
import { ForgeModifier } from './ForgeModifiers';

export const useForgeLogic = () => {
    const { gameData, takeAllLoot } = useContext(GameDataContext);
    const skillConfig = gameData?.skillConfiguration;
    const thpLabel = getTempHpLabel(skillConfig);
    
    // UI State
    const [forgeScale, setForgeScale] = useState<string>('Person');
    const [baseGroup, setBaseGroup] = useState<string>(FORGE_GROUPS[0].id);
    const [baseSubtype, setBaseSubtype] = useState<string | null>(FORGE_GROUPS[0].subtypes ? FORGE_GROUPS[0].subtypes[0].id : null);
    const [selectedRarity, setSelectedRarity] = useState<string>('Common');
    const [itemName, setItemName] = useState('');
    const [lorePrompt, setLorePrompt] = useState('');
    const [selectedModifiers, setSelectedModifiers] = useState<ForgeModifier[]>([]);
    const [modCategory, setModCategory] = useState<ModifierCategory>('enhancement');
    const [modSubOption, setModSubOption] = useState<string>('');
    const [modValue, setModValue] = useState<string>('');
    const [modDuration, setModDuration] = useState<BuffDuration>('Passive');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [editModeId, setEditModeId] = useState<string | null>(null);
    const [randomizedSummary, setRandomizedSummary] = useState<string | null>(null);
    
    // Effects & Usage State
    const [effectType, setEffectType] = useState<'None' | 'Damage' | 'Status' | 'Heal'>('None');
    const [usageType, setUsageType] = useState<AbilityUsage['type']>('per_short_rest');
    const [usageCount, setUsageCount] = useState<number>(1);
    const [isEditingEffect, setIsEditingEffect] = useState(false); 
    const [effectConfig, setEffectConfig] = useState<AbilityEffect>({
        type: 'Damage', dc: 10, saveAbility: 'dexterity', saveEffect: 'half', targetType: 'Single', damageDice: '1d6', damageType: 'Fire', healDice: '1d8', status: 'Prone', duration: 1
    });

    // Chassis State
    const [isHeavy, setIsHeavy] = useState(false);
    const [baseDamageDice, setBaseDamageDice] = useState('1d6');
    const [baseDamageType, setBaseDamageType] = useState('Slashing');
    const [baseAC, setBaseAC] = useState(11);
    const [armorType, setArmorType] = useState<'light' | 'medium' | 'heavy' | 'shield'>('light');

    // Final Result State
    const [isForgeModalOpen, setIsForgeModalOpen] = useState(false);
    const [isForging, setIsForging] = useState(false);
    const [forgedItem, setForgedItem] = useState<Item | null>(null);

    const filteredGroups = useMemo(() => FORGE_GROUPS.filter(g => g.id !== 'Mounts' && g.id !== 'Ships'), []);
    const activeGroupData = useMemo(() => FORGE_GROUPS.find(g => g.id === baseGroup), [baseGroup]);
    const activeSubtypeData = useMemo(() => activeGroupData?.subtypes?.find(s => s.id === baseSubtype), [activeGroupData, baseSubtype]);
    const activeSlot = activeSubtypeData?.slot;

    const showModifiers = !['Consumables', 'Throwables', 'Quest'].includes(baseGroup);
    const isSingleUse = ['Consumables', 'Throwables'].includes(baseGroup);
    const canHaveEffect = !['Weapons', 'Protection'].includes(baseGroup);
    const showWeaponChassis = baseGroup === 'Weapons';
    const showArmorChassis = baseGroup === 'Protection';
    const showChassisSection = showWeaponChassis || showArmorChassis;

    const allowedEffectTypes = useMemo(() => {
        if (baseGroup === 'Consumables') return ['Heal'];
        if (baseGroup === 'Throwables') return ['Damage', 'Status'];
        return ['Damage', 'Status', 'Heal'];
    }, [baseGroup]);

    const filteredModifierCategories = useMemo(() => {
        return Object.values(MODIFIER_REGISTRY).filter(def => isModifierCategoryAllowedForSlot(def.id, activeSlot));
    }, [activeSlot]);

    const resetBuilderState = (category: ModifierCategory) => {
        setModCategory(category);
        setValidationError(null);
        const def = MODIFIER_REGISTRY[category];
        let initialSub = '';
        if (def && def.hasSubOption && def.subOptions) {
            initialSub = def.subOptions.find(opt => isModifierCategoryAllowedForSlot(category, activeSlot)) || '';
        }
        setModSubOption(initialSub);
        if (category === 'resist') setModValue('Resist');
        else if (category === 'exdam') setModValue('1d6');
        else if (category === 'temp_hp') setModValue('5');
        else setModValue('1');
        setModDuration('Passive');
    };

    const onCategorySelect = (id: string) => {
        const group = FORGE_GROUPS.find(g => g.id === id);
        if (!group) return;
        setBaseGroup(id);
        if (group.subtypes && group.subtypes.length > 0) setBaseSubtype(group.subtypes[0].id);
        else setBaseSubtype(null);
        setRandomizedSummary(null);
    };

    const handleEditModifier = (mod: ForgeModifier) => {
        setEditModeId(mod.id);
        setModCategory(mod.type);
        setModSubOption(mod.subOption);
        setModValue(mod.value);
        setModDuration(mod.duration);
        setValidationError(null);
    };

    const handleCancelEdit = () => {
        setEditModeId(null);
        resetBuilderState('enhancement');
    };

    const handleAddModifier = () => {
        const def = MODIFIER_REGISTRY[modCategory];
        if (!def) return;
        let tag = '';
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        const formatVal = (v: string) => parseInt(v) >= 0 ? `+${v}` : v;
        if (modCategory === 'enhancement') tag = `Enhancement ${formatVal(modValue)}`;
        else if (modCategory === 'ability') tag = `Ability ${cap(modSubOption)} ${formatVal(modValue)}`;
        else if (modCategory === 'skill') tag = `Skill ${modSubOption} ${formatVal(modValue)}`;
        else if (modCategory === 'combat') tag = `Combat ${modSubOption} ${formatVal(modValue)}`;
        else if (modCategory === 'defense') tag = `AC ${formatVal(modValue)}`;
        else if (modCategory === 'save') tag = `Save ${modSubOption.toLowerCase() === 'all' ? 'All' : cap(modSubOption)} ${formatVal(modValue)}`;
        else if (modCategory === 'resist') tag = `${modValue === 'Immu' ? 'Immunity' : 'Resist'} ${modSubOption}`;
        else if (modCategory === 'exdam') tag = `ExDam ${modSubOption} ${modValue}`;
        else if (modCategory === 'temp_hp') tag = `${thpLabel} ${formatVal(modValue)}`;

        if (def.hasSubOption && !modSubOption) { setValidationError('Please select a specific option.'); return; }
        if (tag && modValue) {
            if (selectedModifiers.some(m => m.type === modCategory && m.tag === tag && m.id !== editModeId)) { setValidationError('Duplicate modifier effect.'); return; }
            const newModifier: ForgeModifier = { id: editModeId || `mod-${Date.now()}`, type: modCategory, subOption: modSubOption, value: modValue, tag: tag, duration: modDuration };
            if (editModeId) { setSelectedModifiers(prev => prev.map(m => m.id === editModeId ? newModifier : m)); setEditModeId(null); resetBuilderState('enhancement'); }
            else setSelectedModifiers([...selectedModifiers, newModifier]);
            setValidationError(null);
        }
    };

    const handleRandomize = () => {
        setEditModeId(null);
        resetBuilderState('enhancement');
        setIsEditingEffect(false);
        setEffectType('None');
        setSelectedModifiers([]);
        
        const randomItem = forgeRandomItem(
            baseSubtype || baseGroup, 
            selectedRarity, 
            skillConfig || 'Fantasy', 
            activeSlot, 
            forgeScale === 'Person' ? undefined : forgeScale,
            baseGroup // Department Hint
        );
        
        setItemName('');
        setLorePrompt('');
        setIsHeavy(randomItem.tags?.includes('heavy weapon') || false);
        
        if (randomItem.weaponStats) {
            setBaseDamageDice(randomItem.weaponStats.damages[0].dice);
            setBaseDamageType(randomItem.weaponStats.damages[0].type);
        }
        
        if (randomItem.armorStats) {
            setBaseAC(randomItem.armorStats.baseAC);
            setArmorType(randomItem.armorStats.armorType);
        }

        setRandomizedSummary(buildMechanicalSummary(randomItem));
        
        // Extract modifiers for UI sync if applicable
        if (showModifiers) {
            const extractedModifiers: ForgeModifier[] = [];
            Object.values(MODIFIER_REGISTRY).forEach(def => {
                def.extract(randomItem).forEach((ex, idx) => {
                    let tag = '';
                    const formatV = (v: string) => parseInt(v) >= 0 ? `+${v}` : v;
                    const c = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
                    if (def.id === 'enhancement') tag = `Enhancement ${formatV(ex.value)}`;
                    else if (def.id === 'ability') tag = `Ability ${c(ex.subOption)} ${formatV(ex.value)}`;
                    else if (def.id === 'skill') tag = `Skill ${ex.subOption} ${formatV(ex.value)}`;
                    else if (def.id === 'combat') tag = `Combat ${ex.subOption} ${formatV(ex.value)}`;
                    else if (def.id === 'defense') tag = `AC ${formatV(ex.value)}`;
                    else if (def.id === 'save') tag = `Save ${ex.subOption.toLowerCase() === 'all' ? 'All' : c(ex.subOption)} ${formatV(ex.value)}`;
                    else if (def.id === 'resist') tag = `${ex.value === 'Immu' ? 'Immunity' : 'Resist'} ${ex.subOption}`;
                    else if (def.id === 'exdam') tag = `ExDam ${ex.subOption} ${ex.value}`;
                    else if (def.id === 'temp_hp') tag = `${thpLabel} ${formatV(ex.value)}`;
                    if (tag) {
                        extractedModifiers.push({ id: `mod-rand-${Date.now()}-${def.id}-${idx}`, type: def.id, subOption: ex.subOption, value: ex.value, tag: tag, duration: ex.duration || 'Passive' });
                    }
                });
            });
            setSelectedModifiers(extractedModifiers);
        }
        
        if (randomItem.effect && canHaveEffect) {
            if (allowedEffectTypes.includes(randomItem.effect.type)) {
                setEffectType(randomItem.effect.type as any);
                setEffectConfig(randomItem.effect);
            } else {
                const forced = allowedEffectTypes[0] as any;
                const mech = generateMechanicalEffect(selectedRarity, forced, isSingleUse);
                if (mech) { setEffectType(forced); setEffectConfig(mech.effect); }
            }
            if (randomItem.usage) {
                setUsageType(randomItem.usage.type);
                setUsageCount(randomItem.usage.maxUses);
            }
        } else if (isSingleUse) {
            const forced = allowedEffectTypes[0] as any;
            const mech = generateMechanicalEffect(selectedRarity, forced, true);
            if (mech) { 
                setEffectType(forced); 
                setEffectConfig(mech.effect); 
            }
        }
    };

    const buildItemFromState = (name: string, description: string): Item => {
        let tags = [baseGroup.toLowerCase()];
        if (forgeScale === 'Mount') tags.push('mount');
        if (forgeScale === 'Ship') tags.push('ship');
        let bodySlotTag: BodySlot | undefined = activeSlot;
        
        if (baseGroup === 'Weapons') { 
            tags.push('weapon'); 
            if (isHeavy) tags.push('heavy weapon'); 
        } else if (baseGroup === 'Protection') { 
            tags.push('armor'); 
            if (baseSubtype?.includes('Shield') || armorType === 'shield') tags.push('shield'); 
        } else if (forgeScale === 'Ship' || forgeScale === 'Mount') { 
            tags.push('asset'); 
        } else if (baseGroup === 'Accessories' || baseGroup === 'Wondrous') { 
            tags.push('accessory'); 
        }
        
        if (baseGroup === 'Consumables') tags.push('consumable');
        if (baseGroup === 'Throwables') { 
            tags.push('ammunition', 'throwable'); 
            if (!bodySlotTag) bodySlotTag = 'Main Hand'; 
        }
        if (baseGroup === 'Quest') tags.push('quest');

        let weaponStats: WeaponStats | undefined;
        let armorStats: ArmorStats | undefined;
        if (baseGroup === 'Weapons') weaponStats = { enhancementBonus: 0, ability: 'strength', damages: [{ dice: baseDamageDice, type: baseDamageType }], critRange: 20 };
        if (baseGroup === 'Protection') armorStats = { baseAC: baseAC, armorType: armorType, plusAC: 0, strengthRequirement: 0 };
        
        let usage: AbilityUsage | undefined;
        if (effectType !== 'None' && !isSingleUse && canHaveEffect) usage = { type: usageType, maxUses: usageCount, currentUses: usageCount };
        else if (isSingleUse) usage = { type: 'charges', maxUses: 1, currentUses: 1 };
        
        const tempItem = new Item({ name: name || 'Unnamed Item', description: description || 'A freshly forged creation.', tags: tags, rarity: selectedRarity as any, weaponStats, armorStats, buffs: [], effect: (effectType !== 'None' && canHaveEffect) ? { ...effectConfig, type: effectType as any } : undefined, usage, isNew: true, bodySlotTag });
        
        if (showModifiers) selectedModifiers.forEach(mod => applyModifierToItem(tempItem, mod.type, mod.value, mod.subOption, mod.duration));
        
        tempItem.tags = inferTagsFromStats(tempItem);
        tempItem.details = buildMechanicalSummary(tempItem);
        tempItem.price = calculateItemPrice(tempItem); 
        return tempItem;
    };

    const handleForge = async () => {
        setIsForging(true);
        setIsForgeModalOpen(true);
        setForgedItem(null);
        
        const blueprint = buildItemFromState('', '');
        let finalName = itemName;
        let finalFlavor = '';
        
        if ((!finalName.trim() || !finalFlavor.trim()) && gameData) {
            try {
                const details = await generateForgeDetails(blueprint, gameData.worldSummary || '', lorePrompt);
                if (!finalName.trim()) finalName = details.name; 
                finalFlavor = details.description; 
            } catch (e) { 
                if (!finalName.trim()) finalName = "Unknown Artifact"; 
                finalFlavor = "An item whose true name is lost."; 
            }
        }
        
        const newItem = buildItemFromState(finalName, ''); 
        newItem.description = finalFlavor; 
        setForgedItem(newItem); 
        setIsForging(false);
    };

    const handleConfirmAdd = () => {
        if (forgedItem) {
            takeAllLoot([forgedItem]);
            setItemName('');
            setLorePrompt('');
            setSelectedModifiers([]);
            setEffectType('None');
            setIsEditingEffect(false);
            setRandomizedSummary(null);
            setIsForgeModalOpen(false);
        }
    };

    return {
        state: {
            forgeScale, baseGroup, baseSubtype, selectedRarity, itemName, lorePrompt,
            selectedModifiers, modCategory, modSubOption, modValue, modDuration, validationError,
            editModeId, effectType, usageType, usageCount, isEditingEffect,
            effectConfig, isHeavy, baseDamageDice, baseDamageType, baseAC, armorType,
            isForgeModalOpen, isForging, forgedItem, activeGroupData, activeSubtypeData,
            activeSlot, showModifiers, isSingleUse, canHaveEffect, showChassisSection,
            showWeaponChassis, showArmorChassis, allowedEffectTypes, filteredModifierCategories,
            filteredGroups, randomizedSummary
        },
        actions: {
            setForgeScale, setBaseGroup, setBaseSubtype, setSelectedRarity, setItemName,
            setLorePrompt, setModSubOption, setModValue, setModDuration, setEffectType, setUsageType,
            setUsageCount, setIsEditingEffect, setEffectConfig, setIsHeavy, setBaseDamageDice,
            setBaseDamageType, setBaseAC, setArmorType, setIsForgeModalOpen,
            onCategorySelect, resetBuilderState, handleEditModifier, handleCancelEdit,
            handleAddModifier, handleRandomize, handleForge, handleConfirmAdd,
            onRemoveModifier: (id: string) => setSelectedModifiers(prev => prev.filter(m => m.id !== id))
        }
    };
};


// components/inventory/ItemForgeView.tsx

import React from 'react';
import { useForgeLogic } from './forge/useForgeLogic';

// Modular Components
import { ForgeHeader } from './forge/ForgeHeader';
import { ForgeIdentity } from './forge/ForgeIdentity';
import { ForgeChassis } from './forge/ForgeChassis';
import { ForgeModifiers } from './forge/ForgeModifiers';
import { ForgeEffects } from './forge/ForgeEffects';
import { ForgeResultModal } from './forge/ForgeResultModal';

const formatEffectLabel = (effect: any, usage: any, isSingleUse: boolean) => {
    const usageLabel = isSingleUse ? '' : (usage?.type === 'per_short_rest' ? 'Short' 
                        : usage?.type === 'per_long_rest' ? 'Long' 
                        : usage?.type === 'charges' ? 'Chg' : '');
    const uses = isSingleUse ? '' : (usage?.maxUses || 0);
    const usagePart = isSingleUse ? '' : `${usageLabel} ${uses}`;
    const target = effect.targetType === 'Multiple' ? 'Mul' : 'Sin';
    
    if (effect.type === 'Damage') {
        const save = effect.saveAbility ? effect.saveAbility.slice(0, 3).charAt(0).toUpperCase() + effect.saveAbility.slice(1, 3) : 'Dex';
        const eff = effect.saveEffect === 'half' ? 'Half' : 'Neg';
        const dc = effect.dc || 10;
        return `${effect.damageDice} ${effect.damageType || ''} ${target} ${save} ${eff} ${dc} ${usagePart}`.trim();
    }
    if (effect.type === 'Status') {
        const save = effect.saveAbility ? effect.saveAbility.slice(0, 3).charAt(0).toUpperCase() + effect.saveAbility.slice(1, 3) : 'Con';
        const dc = effect.dc || 10;
        return `${effect.status} ${target} ${save} ${dc} ${usagePart}`.trim();
    }
    if (effect.type === 'Heal') {
        const healDisplay = effect.healDice?.includes('d') ? effect.healDice : `${effect.healDice} HP`;
        return `${healDisplay} Heal ${target} ${usagePart}`.trim();
    }
    return `Effect: ${effect.type}`;
};

const ItemForgeView: React.FC = () => {
    const { state, actions } = useForgeLogic();

    return (
        <div className="p-2 pt-8 max-w-2xl mx-auto pb-24 h-full flex flex-col">
            <div className="text-center mb-10 pb-6 border-b border-brand-primary/20">
                <h1 className="text-brand-text mb-2">Item Forge</h1>
                <p className="text-body-base text-brand-text-muted font-medium italic">
                    Create custom equipment infused with system power.
                </p>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scroll pr-1 pb-20">
                <div className="space-y-12 animate-fade-in">
                    <ForgeHeader 
                        forgeScale={state.forgeScale} 
                        setForgeScale={actions.setForgeScale}
                        baseGroup={state.baseGroup} 
                        onCategorySelect={actions.onCategorySelect}
                        baseSubtype={state.baseSubtype} 
                        setBaseSubtype={actions.setBaseSubtype}
                        selectedRarity={state.selectedRarity} 
                        setSelectedRarity={actions.setSelectedRarity}
                        onRandomize={actions.handleRandomize} 
                        filteredGroups={state.filteredGroups} 
                        activeGroupData={state.activeGroupData}
                        randomizedSummary={state.randomizedSummary}
                    />

                    <div>
                        <h3 className="text-center mb-8 border-b border-brand-primary/10 pb-4">Configuration</h3>
                        
                        <div className="space-y-10">
                            <ForgeIdentity 
                                itemName={state.itemName} 
                                setItemName={actions.setItemName}
                                lorePrompt={state.lorePrompt} 
                                setLorePrompt={actions.setLorePrompt}
                                selectedRarity={state.selectedRarity} 
                                baseGroup={state.baseGroup}
                                baseSubtypeLabel={state.activeSubtypeData?.label} 
                                forgeScale={state.forgeScale} 
                                activeSlot={state.activeSlot}
                            />

                            {state.showChassisSection && (
                                <ForgeChassis 
                                    showWeaponChassis={state.showWeaponChassis} 
                                    showArmorChassis={state.showArmorChassis}
                                    forgeScale={state.forgeScale} 
                                    isHeavy={state.isHeavy} 
                                    setIsHeavy={actions.setIsHeavy}
                                    baseDamageDice={state.baseDamageDice} 
                                    setBaseDamageDice={actions.setBaseDamageDice}
                                    baseDamageType={state.baseDamageType} 
                                    setBaseDamageType={actions.setBaseDamageType}
                                    armorType={state.armorType} 
                                    setArmorType={actions.setArmorType}
                                    baseAC={state.baseAC} 
                                    setBaseAC={actions.setBaseAC}
                                />
                            )}

                            {state.showModifiers && (
                                <ForgeModifiers 
                                    selectedModifiers={state.selectedModifiers} 
                                    editModeId={state.editModeId}
                                    modCategory={state.modCategory} 
                                    modSubOption={state.modSubOption} 
                                    modValue={state.modValue}
                                    modDuration={state.modDuration}
                                    validationError={state.validationError} 
                                    activeSlot={state.activeSlot}
                                    onResetBuilderState={actions.resetBuilderState} 
                                    onEditModifier={actions.handleEditModifier}
                                    onCancelEdit={actions.handleCancelEdit} 
                                    onAddModifier={actions.handleAddModifier}
                                    onRemoveModifier={actions.onRemoveModifier}
                                    onSetModSubOption={actions.setModSubOption} 
                                    onSetModValue={actions.setModValue}
                                    onSetModDuration={actions.setModDuration}
                                    filteredModifierCategories={state.filteredModifierCategories}
                                />
                            )}

                            {state.canHaveEffect && (
                                <ForgeEffects 
                                    effectType={state.effectType} 
                                    setEffectType={actions.setEffectType}
                                    isEditingEffect={state.isEditingEffect} 
                                    setIsEditingEffect={actions.setIsEditingEffect}
                                    effectConfig={state.effectConfig} 
                                    setEffectConfig={actions.setEffectConfig}
                                    usageType={state.usageType} 
                                    setUsageType={actions.setUsageType}
                                    usageCount={state.usageCount} 
                                    setUsageCount={actions.setUsageCount}
                                    allowedEffectTypes={state.allowedEffectTypes} 
                                    isSingleUse={state.isSingleUse}
                                />
                            )}
                        </div>
                    </div>

                    <div className="mt-12 flex justify-center pb-20">
                        <button 
                            onClick={actions.handleForge} 
                            disabled={!state.baseGroup || (state.showModifiers && state.selectedModifiers.length === 0 && state.effectType === 'None' && !state.itemName.trim() && !state.lorePrompt.trim())} 
                            className="btn-primary btn-lg w-full max-w-sm rounded-full shadow-brand-accent/20"
                        >
                            Forge Item
                        </button>
                    </div>
                </div>
            </div>

            <ForgeResultModal 
                isOpen={state.isForgeModalOpen} 
                isForging={state.isForging}
                forgedItem={state.forgedItem}
                onClose={() => actions.setIsForgeModalOpen(false)} 
                onRetry={actions.handleForge} 
                onConfirm={actions.handleConfirmAdd}
                selectedModifiers={state.selectedModifiers} 
                showModifiers={state.showModifiers} 
                formatEffectLabel={formatEffectLabel}
            />
        </div>
    );
};

export default ItemForgeView;

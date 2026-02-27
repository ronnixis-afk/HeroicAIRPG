import React, { useContext } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import { Item, getItemRarityColor } from '../../types';

const LootItemDisplay: React.FC<{ item: Item }> = ({ item }) => (
    <div className="bg-brand-primary p-2 rounded-md flex justify-between items-center">
        <div>
            <div className="flex items-center">
                <span className={`text-[10px] mr-2 ${getItemRarityColor(item.rarity)}`}>●</span>
                <p className="text-body-base text-brand-text">{item.getDisplayName()}</p>
            </div>
            <p className="text-body-sm text-brand-text-muted italic">{item.description}</p>
        </div>
        {item.price && item.price > 0 && (
            <div className="text-body-sm font-bold text-brand-accent flex items-center gap-1 flex-shrink-0 ml-4">
                <span>💰</span>
                <span>{item.price}</span>
            </div>
        )}
    </div>
);


const LootPanel: React.FC = () => {
    const { takeAllLoot } = useContext(GameDataContext);
    const { lootState } = useUI();

    if (!lootState.isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-brand-surface rounded-xl shadow-xl w-full max-w-md p-6 border border-brand-primary flex flex-col animate-modal">
                <h3 className="text-brand-accent text-center mb-4">Combat victory!</h3>

                {lootState.isLoading ? (
                    <div className="flex flex-col items-center justify-center min-h-[200px]">
                        <Icon name="spinner" className="w-10 h-10 animate-spin text-brand-accent" />
                        <p className="text-body-sm text-brand-text-muted mt-3">Generating loot...</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-4">
                            <h5 className="text-brand-text-muted mb-2 tracking-normal uppercase-none">Defeated foes</h5>
                            <div className="flex flex-wrap gap-2">
                                {lootState.defeatedEnemies.map(enemy => (
                                    <span key={enemy.id} className="bg-brand-primary text-red-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-500/10">
                                        {enemy.name}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto max-h-64 custom-scroll pr-2 space-y-2">
                            {lootState.items.length > 0 ? (
                                lootState.items.map(item => <LootItemDisplay key={item.id} item={item} />)
                            ) : (
                                <p className="text-center text-body-sm text-brand-text-muted italic py-8">The enemies had nothing of value.</p>
                            )}
                        </div>

                        <div className="mt-6 text-center">
                            <button
                                onClick={() => takeAllLoot(lootState.items, lootState.defeatedEnemies.map(e => e.name), lootState.defeatedEnemies.map(e => e.id))}
                                className="btn-primary btn-md w-full shadow-brand-accent/20"
                            >
                                Take all items
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LootPanel;
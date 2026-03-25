import React, { useContext } from 'react';
import { GameDataContext } from '../../context/GameDataContext';
import { useUI } from '../../context/UIContext';
import { Icon } from '../Icon';
import { Item } from '../../types';
import Modal from '../Modal';
import { toTitleCase } from '../../utils/npcUtils';

const LootItemDisplay: React.FC<{ item: Item }> = ({ item }) => (
    <div className="bg-brand-primary/20 p-4 rounded-2xl flex justify-between items-center border border-brand-surface shadow-inner group hover:bg-brand-primary/40 transition-all">
        <div className="flex flex-col gap-1 overflow-hidden pr-3">
            <div className="flex items-center gap-2">
                <p className="text-body-base font-bold text-brand-text truncate tracking-tight">{toTitleCase(item.getDisplayName())}</p>
            </div>
            <p className="text-body-sm text-brand-text-muted italic line-clamp-1 opacity-70 group-hover:opacity-100 transition-opacity whitespace-normal">
                {item.description}
            </p>
        </div>
        {item.price !== undefined && item.price > 0 && (
            <div className="text-body-sm font-black text-brand-accent flex items-center gap-1.5 flex-shrink-0 bg-brand-accent/5 px-2.5 py-1 rounded-lg border border-brand-accent/20 shadow-sm leading-none">
                <span className="text-xs">💰</span>
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

    const footer = (
        <button
            onClick={() => takeAllLoot(lootState.items, lootState.defeatedEnemies.map(e => e.name), lootState.defeatedEnemies.map(e => e.id))}
            className="btn-primary btn-lg w-full gap-2 shadow-xl shadow-brand-accent/20 rounded-2xl"
        >
            <Icon name="sparkles" className="w-5 h-5" />
            Take All Items
        </button>
    );

    return (
        <Modal 
            isOpen={lootState.isOpen} 
            onClose={() => takeAllLoot([], [], [])} 
            title="Combat Victory!"
            footer={footer}
            maxWidth="md"
        >
            <div className="space-y-8 py-2 animate-fade-in">
                {lootState.isLoading ? (
                    <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-brand-accent/20 blur-2xl rounded-full scale-150 animate-pulse" />
                            <Icon name="spinner" className="w-12 h-12 animate-spin text-brand-accent relative z-10" />
                        </div>
                        <p className="text-body-base text-brand-text-muted font-bold tracking-normal">Generating Loot...</p>
                    </div>
                ) : (
                    <div className="space-y-8 pb-4">
                        <div className="bg-brand-primary/10 p-5 rounded-3xl border border-brand-surface shadow-inner">
                            <h5 className="text-[10px] font-black text-brand-text-muted tracking-normal mb-4 px-1 leading-none">Defeated Foes</h5>
                            <div className="flex flex-wrap gap-2">
                                {lootState.defeatedEnemies.map(enemy => (
                                    <span key={enemy.id} className="bg-brand-danger/10 text-brand-danger text-[10px] font-black px-4 py-1.5 rounded-lg border border-brand-danger/20 shadow-sm leading-none">
                                        {enemy.name}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-brand-text-muted tracking-normal mb-4 px-1 leading-none">Found Loot</label>
                            <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scroll pr-2">
                                {lootState.items.length > 0 ? (
                                    lootState.items.map(item => <LootItemDisplay key={item.id} item={item} />)
                                ) : (
                                    <div className="py-12 text-center border-2 border-dashed border-brand-primary/30 rounded-3xl bg-brand-primary/5">
                                        <p className="text-body-base text-brand-text-muted italic font-medium px-4 opacity-50">
                                            The enemies carried nothing of immediate value to you.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default LootPanel;

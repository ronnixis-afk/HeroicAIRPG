import React from 'react';
import { AlignmentOption } from '../../types';

interface AlignmentActionTrayProps {
    options: AlignmentOption[];
}

export const AlignmentActionTray: React.FC<AlignmentActionTrayProps> = ({ options }) => {
    if (!options || options.length === 0) return null;

    return (
        <div className="w-full flex justify-start pb-3 pt-2 animate-entrance px-4 relative z-[45]">
            <div className="flex flex-wrap justify-start gap-2 max-w-full">
                {options.map((opt, idx) => {
                    let iconFile = '';
                    if (opt.alignment === 'Good') iconFile = '/icons/good-alignment.png';
                    else if (opt.alignment === 'Evil') iconFile = '/icons/evil-alignment.png';
                    else if (opt.alignment === 'Lawful') iconFile = '/icons/lawful-alignment.png';
                    else if (opt.alignment === 'Chaotic') iconFile = '/icons/chaotic-alignment.png';

                    return (
                        <button
                            key={idx}
                            onClick={() => {
                                const event = new CustomEvent('alignment-action', {
                                    detail: { label: opt.label, alignment: opt.alignment }
                                });
                                window.dispatchEvent(event);
                            }}
                            className="px-4 h-9 text-xs font-bold rounded-xl transition-all flex items-center gap-2 text-white bg-brand-surface/90 hover:bg-brand-surface border border-white/5 active:scale-95 shadow-lg backdrop-blur-md"
                        >
                            {iconFile && (
                                <img src={iconFile} alt={opt.alignment} className="w-[20px] h-[20px] object-contain drop-shadow-md" />
                            )}
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

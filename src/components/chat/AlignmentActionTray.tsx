import React, { useRef, useState, useEffect } from 'react';
import { AlignmentOption } from '../../types';

interface AlignmentActionTrayProps {
    options: AlignmentOption[];
}

export const AlignmentActionTray: React.FC<AlignmentActionTrayProps> = ({ options }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScrollOverflow = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setCanScrollLeft(scrollLeft > 5);
            setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
        }
    };

    useEffect(() => {
        const timer = setTimeout(checkScrollOverflow, 100);
        window.addEventListener('resize', checkScrollOverflow);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkScrollOverflow);
        };
    }, [options]);

    if (!options || options.length === 0) return null;

    return (
        <div className="w-full relative px-1 pb-3 pt-2 animate-entrance z-10">
            {/* Left Edge Fade Indicator */}
            <div 
                className={`absolute left-0 top-0 bottom-3 w-12 bg-gradient-to-r from-brand-bg to-transparent z-10 pointer-events-none transition-opacity duration-300 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} 
            />

            {/* Scrollable Container */}
            <div 
                ref={scrollRef}
                onScroll={checkScrollOverflow}
                className="flex flex-nowrap justify-start gap-2 overflow-x-auto no-scrollbar scroll-smooth px-4"
            >
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
                            className="shrink-0 px-2 h-9 text-body-tiny font-bold rounded-xl transition-all flex items-center gap-2 text-white bg-brand-surface/90 hover:bg-brand-surface border border-white/5 active:scale-95 shadow-lg backdrop-blur-md"
                        >
                            {iconFile && (
                                <img src={iconFile} alt={opt.alignment} className="shrink-0 w-[20px] h-[20px] object-contain drop-shadow-md" />
                            )}
                            <span className="whitespace-nowrap">{opt.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Right Edge Fade Indicator */}
            <div 
                className={`absolute right-0 top-0 bottom-3 w-12 bg-gradient-to-l from-brand-bg to-transparent z-10 pointer-events-none transition-opacity duration-300 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} 
            />
        </div>
    );
};

import React from 'react';
import { useUI } from '../context/UIContext';
import { Icon } from './Icon';

/**
 * Reusable PageHeader component for consistent page titles and descriptions.
 * Update this single file to change header/subtitle styling globally.
 */

interface PageHeaderProps {
    /** The main title of the page (usually h3 size) */
    title: string;
    /** Optional descriptive text below the title (sub-header) */
    subtitle?: string;
    /** For additional buttons or icons relative to the header box */
    children?: React.ReactNode;
    /** Optional additional classes for the outer container */
    className?: string;
    /** Optional additional classes for the title (h3) */
    titleClassName?: string;
    /** Optional additional classes for the subtitle (p) */
    subtitleClassName?: string;
    /** The heading level to use for the title (default: h3) */
    titleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
    /** Whether to show a "Return to Story" button in the header */
    showReturnButton?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
    title,
    titleAs: TitleTag = 'h3',
    subtitle, 
    children, 
    className = "",
    titleClassName = "",
    subtitleClassName = "",
    showReturnButton = false
}) => {
    const { setActiveView } = useUI();

    return (
        <div className={`text-center mb-5 pb-3 border-b border-brand-primary/20 relative group ${className}`}>
            {showReturnButton && (
                <button 
                    onClick={() => setActiveView('chat')}
                    className="absolute left-0 top-0 h-9 px-3 flex items-center gap-2 text-brand-text-muted hover:text-brand-accent transition-all animate-fade-in bg-brand-primary/10 hover:bg-brand-primary/30 rounded-lg border border-brand-surface/50 group-hover:border-brand-accent/30 shadow-sm"
                    title="Return to Story"
                >
                    <Icon name="arrowLeft" className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Story</span>
                </button>
            )}
            
            <TitleTag className={`text-brand-text mb-2 ${titleClassName}`}>
                {title}
            </TitleTag>
            {subtitle && (
                <p className={`text-body-sm text-brand-text-muted font-normal italic ${subtitleClassName}`}>
                    {subtitle}
                </p>
            )}
            {children}
        </div>
    );
};

export default PageHeader;

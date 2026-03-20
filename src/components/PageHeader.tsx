import React from 'react';

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
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
    title,
    titleAs: TitleTag = 'h3',
    subtitle, 
    children, 
    className = "",
    titleClassName = "",
    subtitleClassName = ""
}) => {
    return (
        <div className={`text-center mb-5 pb-3 border-b border-brand-primary/20 relative ${className}`}>
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

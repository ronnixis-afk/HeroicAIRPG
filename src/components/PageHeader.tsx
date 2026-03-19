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
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
    title, 
    subtitle, 
    children, 
    className = "",
    titleClassName = "",
    subtitleClassName = ""
}) => {
    return (
        <div className={`text-center mb-10 pb-6 border-b border-brand-primary/20 relative ${className}`}>
            <h3 className={`text-brand-text mb-2 ${titleClassName}`}>
                {title}
            </h3>
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

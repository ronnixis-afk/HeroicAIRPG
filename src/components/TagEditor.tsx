import React from 'react';

interface TagEditorProps {
    tags: string[];
    onTagsChange: (newTags: string[]) => void;
    options?: readonly string[];
    label?: string;
}

export const TagEditor: React.FC<TagEditorProps> = ({ tags, onTagsChange, options = [], label = "Tags" }) => {

    const handleToggleTag = (tagToToggle: string) => {
        if (tags.includes(tagToToggle)) {
            onTagsChange(tags.filter(t => t !== tagToToggle));
        } else {
            onTagsChange([...tags, tagToToggle]);
        }
    };

    // Filter out any tags currently in data that are NOT in the options list (e.g. damage:5) so we don't lose them but don't show them in the picker
    const customTags = tags.filter(t => !options.includes(t));

    return (
        <div className="space-y-3">
            {label && <label className="block text-body-sm font-bold text-brand-text-muted mb-2 ml-1">{label}</label>}
            <div className="flex flex-wrap gap-2">
                {options.map(option => {
                    const isActive = tags.includes(option);
                    return (
                        <button
                            key={option}
                            onClick={() => handleToggleTag(option)}
                            className={`px-4 py-2 rounded-full text-body-sm font-bold transition-all border capitalize ${
                                isActive
                                    ? 'bg-brand-accent text-black border-brand-accent shadow-lg shadow-brand-accent/10'
                                    : 'bg-transparent text-brand-text-muted border-brand-primary hover:border-brand-secondary hover:text-brand-text'
                            }`}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>
            
            {/* Display preserved custom tags (like damage:5) that can't be edited via this UI */}
            {customTags.length > 0 && (
                <div className="mt-4 pt-3 border-t border-brand-primary/30">
                    <p className="text-body-sm font-bold text-brand-text-muted mb-2 ml-1">Special tags</p>
                    <div className="flex flex-wrap gap-2">
                        {customTags.map(tag => (
                            <span key={tag} className="px-3 py-1.5 rounded-xl bg-brand-primary/30 border border-brand-surface text-body-sm text-brand-text-muted">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
import React, { useState } from 'react';
import { Icon } from './Icon';

interface KeywordEditorProps {
    keywords: string[];
    onKeywordsChange: (newKeywords: string[]) => void;
}

export const KeywordEditor: React.FC<KeywordEditorProps> = ({ keywords, onKeywordsChange }) => {
    const [input, setInput] = useState('');

    const handleAdd = () => {
        const term = input.trim().toLowerCase();
        if (term && !keywords.includes(term)) {
            onKeywordsChange([...keywords, term]);
            setInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    const handleRemove = (keyword: string) => {
        onKeywordsChange(keywords.filter(k => k !== keyword));
    };

    return (
        <div>
            <label className="block text-body-sm font-bold text-brand-text-muted mb-1.5 ml-1">Keywords (Ai Context)</label>
            <div className="flex flex-wrap gap-2 mb-3">
                {keywords.map((keyword) => (
                    <div
                        key={keyword}
                        className="flex items-center bg-brand-surface border border-brand-primary rounded-full px-3 py-1 text-body-sm font-medium text-brand-text group hover:border-brand-accent transition-colors"
                    >
                        <span className="mr-1 opacity-50">#</span>
                        {keyword}
                        <button
                            onClick={() => handleRemove(keyword)}
                            className="ml-2 text-brand-text-muted hover:text-brand-danger focus:outline-none transition-colors"
                            aria-label={`Remove keyword ${keyword}`}
                        >
                            <Icon name="close" className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>
            <div className="relative">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleAdd} // Add on blur as well
                    placeholder="Add keyword (e.g. ancient, haunted)..."
                    className="w-full bg-brand-primary h-11 pl-8 pr-4 rounded-xl focus:ring-brand-accent focus:ring-1 focus:outline-none border border-brand-surface focus:border-brand-accent text-body-base transition-all shadow-inner"
                />
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <span className="text-brand-text-muted font-mono text-xs">#</span>
                </div>
            </div>
            <p className="text-body-sm text-brand-text-muted mt-2 italic px-1 opacity-70">
                Keywords help the Ai recall this entry when mentioned in chat or relevant to the location.
            </p>
        </div>
    );
};
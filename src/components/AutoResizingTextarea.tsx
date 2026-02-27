
import React, { useRef, useEffect } from 'react';

const AutoResizingTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { value } = props;

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height to allow shrinking
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            rows={1}
            {...props}
            className={`${props.className || ''} resize-none`}
            style={{ ...props.style, overflow: 'hidden' }}
        />
    );
};

export default AutoResizingTextarea;

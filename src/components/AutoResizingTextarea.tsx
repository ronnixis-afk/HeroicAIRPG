import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

const AutoResizingTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((props, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { value } = props;

    // Support both forwarded ref and internal ref
    useImperativeHandle(ref, () => textareaRef.current!);

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
});

AutoResizingTextarea.displayName = 'AutoResizingTextarea';

export default AutoResizingTextarea;

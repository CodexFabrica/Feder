import React, { useRef } from 'react';
import { Bold, Italic, Underline, Heading1, Heading2, Image, Link, List, Quote, Code, ImagePlus } from 'lucide-react';

export function Editor({ value, onChange, mode, onUploadImage }) {
    const textareaRef = useRef(null);

    const insertText = (before, after = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.focus();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        const replacement = before + selectedText + after;

        // Use execCommand to preserve undo history if possible (deprecated but widely supported)
        const success = document.execCommand('insertText', false, replacement);

        if (!success) {
            // Fallback for newer browsers if they drop support (unlikely for now) or edge cases
            const newText = text.substring(0, start) + replacement + text.substring(end);
            onChange(newText);

            // Manually restore cursor
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + before.length, end + before.length);
            }, 0);
        } else {
            // If success, the cursor is usually arguably placed at the end of insertion. 
            // We might want to select the 'middle' part if it was a wrapper.
            // But execCommand places cursor at end.
            // Let's try to adjust selection if wrapping
            setTimeout(() => {
                textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
            }, 0);
        }
    };

    const handleImageUpload = async () => {
        if (!onUploadImage) return;
        try {
            const result = await onUploadImage(); // Expects { alt, src }
            if (result) {
                insertText(`![${result.alt}](${result.src})`, '');
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="panel-editor">
            {/* Toolbar */}
            <div className="editor-toolbar">
                <ToolBtn icon={<Bold size={18} />} onClick={() => insertText('**', '**')} title="Bold" />
                <ToolBtn icon={<Italic size={18} />} onClick={() => insertText('*', '*')} title="Italic" />
                <ToolBtn icon={<Underline size={18} />} onClick={() => insertText('<u>', '</u>')} title="Underline" />
                <div className="divider"></div>
                <ToolBtn icon={<Heading1 size={18} />} onClick={() => insertText('# ')} title="H1" />
                <ToolBtn icon={<Heading2 size={18} />} onClick={() => insertText('## ')} title="H2" />
                <div className="divider"></div>
                <ToolBtn icon={<List size={18} />} onClick={() => insertText('- ')} title="List" />
                <ToolBtn icon={<Quote size={18} />} onClick={() => insertText('> ')} title="Quote" />
                <ToolBtn icon={<Code size={18} />} onClick={() => insertText('`', '`')} title="Inline Code" />
                <div className="divider"></div>
                <ToolBtn icon={<Link size={18} />} onClick={() => insertText('[', '](url)')} title="Link" />
                <ToolBtn icon={<Image size={18} />} onClick={() => insertText('![alt]', '(src)')} title="Image (Text)" />
                <ToolBtn icon={<ImagePlus size={18} />} onClick={handleImageUpload} title="Upload Image" />
                {/* Researcher Mode Tools */}
                {mode === 'researcher' && (
                    <ToolBtn label="Cite" onClick={() => insertText('[@', ']')} title="Insert Citation" />
                )}
            </div>

            {/* Text Area */}
            <div className="textarea-wrapper">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="main-textarea"
                    placeholder="# Start writing..."
                    spellCheck="false"
                />
            </div>
        </div>
    );
}

function ToolBtn({ icon, label, onClick, title }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="btn-icon"
        >
            {icon || <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '0 4px' }}>{label}</span>}
        </button>
    );
}

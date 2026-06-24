import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Bold, Italic, Underline, Heading1, Heading2, Image, Link, List, Quote, Code, ImagePlus, Sparkles, MessageSquare, BookMarked, Sigma, Table, ChevronDown, BookOpen, X } from 'lucide-react';
import { requestInlineSuggestion } from '../utils/aiSuggestions';

export function Editor({ value, onChange, mode, onUploadImage, onPasteImage, settings, projectMetadata, onAiThinking, onRegisterCancel, onRequestImprovement, onSelectionChange, comments, commentTags, onAddComment, onCommentPositionsChange, onEditorScrollChange }) {
    const textareaRef = useRef(null);
    const mirrorRef = useRef(null);
    const ghostRef = useRef(null);
    const positionMirrorRef = useRef(null);
    
    // Fallback default tags if not configured
    const DEFAULT_COMMENT_TAGS = {
      major: [
        { id: 'methodological', label: 'Methodological', color: '#ff4d4d' },
        { id: 'conceptual', label: 'Conceptual', color: '#ff944d' },
        { id: 'overreaching', label: 'Overreaching', color: '#ffcc4d' },
        { id: 'ethical', label: 'Ethical concerns', color: '#e60000' }
      ],
      minor: [
        { id: 'clarification', label: 'Clarification request', color: '#3399ff' },
        { id: 'data_presentation', label: 'Data presentation', color: '#33ccff' },
        { id: 'missing_reference', label: 'Missing reference', color: '#5c5cff' }
      ],
      minor_formal: [
        { id: 'journal_guidelines', label: 'Journal guidelines', color: '#2eb8b8' },
        { id: 'structure', label: 'Structure (move paragraph)', color: '#20c997' },
        { id: 'editorial', label: 'Editorial', color: '#f06595' }
      ]
    };
    
    const activeTags = commentTags || DEFAULT_COMMENT_TAGS;

    const debounceRef = useRef(null);
    const abortRef = useRef(null);
    const lastContextRef = useRef('');
    const cursorRef = useRef({ start: 0, end: 0 });

    const [suggestion, setSuggestion] = useState('');
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [cursorVersion, setCursorVersion] = useState(0);
    const [caretPos, setCaretPos] = useState({ top: 0, left: 0 });
    const [showCiteMenu, setShowCiteMenu] = useState(false);
    const citeMenuRef = useRef(null);

    const [showImageMenu, setShowImageMenu] = useState(false);
    const [showListMenu, setShowListMenu] = useState(false);
    const [showQuoteMenu, setShowQuoteMenu] = useState(false);
    const [showDocModal, setShowDocModal] = useState(false);

    const imageMenuRef = useRef(null);
    const listMenuRef = useRef(null);
    const quoteMenuRef = useRef(null);


    // Improvement/Comment Widget State
    const [showWidget, setShowWidget] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [selectionRange, setSelectionRange] = useState(null); // {start, end}
    const [widgetMenuOpen, setWidgetMenuOpen] = useState(false); // 'improve' | 'none'
    const [commentInputOpen, setCommentInputOpen] = useState(false);
    const [newCommentText, setNewCommentText] = useState('');
    const [selectedTagId, setSelectedTagId] = useState('');

    const findSelectedTagObj = () => {
        if (!selectedTagId) return null;
        const tagsList = [
            ...(activeTags.major || []),
            ...(activeTags.minor || []),
            ...(activeTags.minor_formal || [])
        ];
        return tagsList.find(t => t.id === selectedTagId) || null;
    };
    const activeSelectedTag = findSelectedTagObj();

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

    const updateCursor = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        cursorRef.current = {
            start: textarea.selectionStart || 0,
            end: textarea.selectionEnd || 0
        };

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = (start !== end) ? textarea.value.substring(start, end) : '';

        if (onSelectionChange) {
            // Debounce or just update? Update is fine, App handles state.
            // Actually, too many updates might be heavy if App re-renders.
            // But Editor is controlled by App state anyway.
            // Let's just call it.
            onSelectionChange(text);
        }

        // Check for selection (Improvement/Comment Widget)
        if (start !== end) {
            // Show button if selection is substantial
            if (text.trim().length > 1) {
                setSelectedText(text);
                setSelectionRange({ start, end });
                setShowWidget(true);
            } else {
                setShowWidget(false);
                setWidgetMenuOpen(false);
                setCommentInputOpen(false);
            }
        } else {
            setShowWidget(false);
            setWidgetMenuOpen(false);
            setCommentInputOpen(false);
        }

        setCursorVersion((v) => v + 1);
    }, [onSelectionChange]);

    const updateCaretPosition = useCallback(() => {
        if (!showWidget) return;
        const textarea = textareaRef.current;
        const mirror = mirrorRef.current;
        if (!textarea || !mirror) return;

        const computed = window.getComputedStyle(textarea);

        // Copy all font/text properties
        const properties = [
            'direction',
            'boxSizing',
            'width',
            'height',
            'overflowX',
            'overflowY',
            'borderTopWidth',
            'borderRightWidth',
            'borderBottomWidth',
            'borderLeftWidth',
            'borderStyle',
            'paddingTop',
            'paddingRight',
            'paddingBottom',
            'paddingLeft',
            'fontStyle',
            'fontVariant',
            'fontWeight',
            'fontStretch',
            'fontSize',
            'fontSizeAdjust',
            'lineHeight',
            'fontFamily',
            'textAlign',
            'textTransform',
            'textIndent',
            'textDecoration',
            'letterSpacing',
            'wordSpacing',
            'tabSize',
            'MozTabSize'
        ];

        properties.forEach(prop => {
            mirror.style[prop] = computed[prop];
        });

        // Specific overrides for the mirror to ensure it behaves as a measurement tool
        mirror.style.position = 'absolute';
        mirror.style.top = '0';
        mirror.style.left = '0';
        mirror.style.visibility = 'hidden';
        mirror.style.width = `${textarea.clientWidth}px`; // Match inner width (no scrollbar)
        mirror.style.border = 'none'; // Since we use clientWidth, we don't want borders on mirror
        mirror.style.boxSizing = 'border-box'; // Ensure padding is included in width

        const caret = cursorRef.current.start || 0;
        const prefix = textarea.value.substring(0, caret);

        mirror.textContent = prefix;
        const span = document.createElement('span');
        span.textContent = '\u200b'; // Zero-width space
        mirror.appendChild(span);

        // Sync scroll
        mirror.scrollTop = textarea.scrollTop;
        mirror.scrollLeft = textarea.scrollLeft;

        // Calculate coordinates relative to the textarea wrapper
        const top = span.offsetTop + parseInt(computed.borderTopWidth) - textarea.scrollTop;
        const left = span.offsetLeft + parseInt(computed.borderLeftWidth) - textarea.scrollLeft;

        setCaretPos({ top, left });
    }, [showWidget]);

    useEffect(() => {
        updateCursor();
    }, [updateCursor]);

    // Close dropdown menus on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showCiteMenu && citeMenuRef.current && !citeMenuRef.current.contains(e.target)) {
                setShowCiteMenu(false);
            }
            if (showImageMenu && imageMenuRef.current && !imageMenuRef.current.contains(e.target)) {
                setShowImageMenu(false);
            }
            if (showListMenu && listMenuRef.current && !listMenuRef.current.contains(e.target)) {
                setShowListMenu(false);
            }
            if (showQuoteMenu && quoteMenuRef.current && !quoteMenuRef.current.contains(e.target)) {
                setShowQuoteMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCiteMenu, showImageMenu, showListMenu, showQuoteMenu]);

    // --- Compute comment ranges in the text ---
    const commentRanges = useMemo(() => {
        if (!comments || comments.length === 0) return [];
        const ranges = [];
        comments.forEach(c => {
            if (c.status === 'resolved') return;
            let idx = -1;
            if (c.contextBefore && c.contextAfter) {
                const strictObj = c.contextBefore + c.selection + c.contextAfter;
                idx = value.indexOf(strictObj);
                if (idx !== -1) idx += c.contextBefore.length;
            }
            if (idx === -1) idx = value.indexOf(c.selection);
            if (idx !== -1) {
                ranges.push({ start: idx, end: idx + c.selection.length, id: c.id, comment: c });
            }
        });
        ranges.sort((a, b) => a.start - b.start);
        return ranges;
    }, [comments, value]);

    // --- Build ghost overlay content: full text with highlight spans + suggestion ---
    const renderGhostContent = () => {
        const cursorPos = cursorRef.current?.start || 0;

        if (commentRanges.length === 0 && !suggestion) {
            // Nothing to render in overlay
            return null;
        }

        // Merge comment ranges with suggestion insertion point
        // We need to render the FULL text so alignment is correct
        let segments = [];
        let lastIndex = 0;

        // Build highlight segments
        for (const r of commentRanges) {
            const rStart = Math.max(r.start, lastIndex);
            if (rStart > lastIndex) {
                segments.push({ text: value.substring(lastIndex, rStart), type: 'normal' });
            }
            const rEnd = Math.min(r.end, value.length);
            if (rEnd > rStart) {
                segments.push({ text: value.substring(rStart, rEnd), type: 'highlight', id: r.id });
                lastIndex = rEnd;
            }
        }
        if (lastIndex < value.length) {
            segments.push({ text: value.substring(lastIndex), type: 'normal' });
        }

        // Now inject suggestion at cursor position
        if (suggestion) {
            let charCount = 0;
            const newSegments = [];
            let inserted = false;
            for (const seg of segments) {
                const segStart = charCount;
                const segEnd = charCount + seg.text.length;
                if (!inserted && cursorPos >= segStart && cursorPos <= segEnd) {
                    const offset = cursorPos - segStart;
                    if (offset > 0) {
                        newSegments.push({ ...seg, text: seg.text.substring(0, offset) });
                    }
                    newSegments.push({ text: suggestion, type: 'suggestion' });
                    if (offset < seg.text.length) {
                        newSegments.push({ ...seg, text: seg.text.substring(offset) });
                    }
                    inserted = true;
                } else {
                    newSegments.push(seg);
                }
                charCount = segEnd;
            }
            if (!inserted) {
                newSegments.push({ text: suggestion, type: 'suggestion' });
            }
            segments = newSegments;
        }

        return segments.map((s, i) => {
            if (s.type === 'highlight') {
                const range = commentRanges.find(r => r.id === s.id);
                const tagColor = range?.comment?.tag?.color || '#ffb400';
                return <span key={i} style={{ backgroundColor: `${tagColor}33`, borderBottom: `2px solid ${tagColor}` }}>{s.text}</span>;
            }
            if (s.type === 'suggestion') {
                return <span key={i} className="suggestion">{s.text}</span>;
            }
            return <span key={i}>{s.text}</span>;
        });
    };

    // --- Compute Y positions of comments using a hidden mirror div ---
    const computeCommentPositions = useCallback(() => {
        const textarea = textareaRef.current;
        const mirror = positionMirrorRef.current;
        if (!textarea || !mirror || commentRanges.length === 0) {
            if (onCommentPositionsChange) onCommentPositionsChange([]);
            return;
        }

        const computed = window.getComputedStyle(textarea);
        const properties = [
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
            'lineHeight', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'whiteSpace', 'wordWrap', 'overflowWrap', 'wordBreak',
            'letterSpacing', 'wordSpacing', 'tabSize', 'MozTabSize',
            'textTransform', 'textIndent'
        ];
        properties.forEach(prop => { mirror.style[prop] = computed[prop]; });
        mirror.style.position = 'absolute';
        mirror.style.top = '0';
        mirror.style.left = '0';
        mirror.style.visibility = 'hidden';
        mirror.style.width = `${textarea.clientWidth}px`;
        mirror.style.border = 'none';
        mirror.style.boxSizing = 'border-box';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.wordWrap = 'break-word';
        mirror.style.overflow = 'hidden';

        const positions = [];
        for (const r of commentRanges) {
            mirror.textContent = value.substring(0, r.start);
            const marker = document.createElement('span');
            marker.textContent = '\u200b';
            mirror.appendChild(marker);
            const yTop = marker.offsetTop;
            positions.push({ id: r.id, y: yTop, comment: r.comment });
        }

        if (onCommentPositionsChange) onCommentPositionsChange(positions);
    }, [commentRanges, value, onCommentPositionsChange]);

    useEffect(() => {
        if (!comments || comments.length === 0) {
            if (onCommentPositionsChange) onCommentPositionsChange([]);
            return;
        }

        const handler = setTimeout(() => {
            computeCommentPositions();
        }, 400);

        return () => clearTimeout(handler);
    }, [computeCommentPositions, value, comments, onCommentPositionsChange]);

    // Recompute on resize        
    useEffect(() => {
        const handleResize = () => computeCommentPositions();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [computeCommentPositions]);

    const acceptSuggestion = useCallback(() => {
        if (!suggestion) return;
        // Strip leading ellipses if they still appear
        const cleaned = suggestion.replace(/^\s*\.\.\.\s*/, '');
        insertText(cleaned, '');
        setSuggestion('');
    }, [suggestion]);


    const handleImageUpload = async () => {
        if (!onUploadImage) return;
        try {
            const result = await onUploadImage(); // Expects { alt, src }
            if (result) {
                insertText(`![${result.alt}](${result.src}){width=100%}`, '');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handlePaste = useCallback(async (e) => {
        if (!onPasteImage) return;
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                e.stopPropagation();

                const pastedFile = items[i].getAsFile();
                if (!pastedFile) return;

                // Generate a descriptive filename with timestamp
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
                const ext = pastedFile.type.split('/')[1] || 'png';
                const name = `pasted_${timestamp}.${ext}`;
                const fileWithName = new File([pastedFile], name, { type: pastedFile.type });

                try {
                    const result = await onPasteImage(fileWithName);
                    if (result) {
                        const id = result.alt.replace(/[^a-zA-Z0-9_]/g, '_');
                        insertText(`![${result.alt}](${result.src}){#${id} width=100%}`, '');
                    }
                } catch (err) {
                    console.error('Paste image failed:', err);
                }
                return;
            }
        }
    }, [onPasteImage]);

    useEffect(() => {
        if (showWidget) {
            updateCaretPosition();
        }
    }, [value, cursorVersion, suggestion, showWidget, updateCaretPosition]);

    // AI Suggestion Logic
    const fetchSuggestion = useCallback(async () => {
        const aiConfig = settings?.ai || {};

        if (!aiConfig.enabled || aiConfig.inlineSuggestions?.enabled === false) {
            setSuggestion('');
            if (onAiThinking) onAiThinking(false);
            setIsSuggesting(false);
            return;
        }

        const textarea = textareaRef.current;
        if (!textarea) return;

        const { start, end } = cursorRef.current;
        if (start !== end) {
            setSuggestion('');
            if (onAiThinking) onAiThinking(false);
            setIsSuggesting(false);
            return;
        }

        const prefix = value.slice(0, start);
        const suffix = value.slice(end);

        if (!prefix.trim() || prefix.length < 5) {
            setSuggestion('');
            if (onAiThinking) onAiThinking(false);
            setIsSuggesting(false);
            return;
        }

        const contextKey = `${prefix.slice(-100)}|${mode}`;
        if (contextKey === lastContextRef.current) return;
        lastContextRef.current = contextKey;

        if (abortRef.current) abortRef.current.abort();

        setIsSuggesting(true);
        if (onAiThinking) onAiThinking(true);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const suggestionText = await requestInlineSuggestion({
                aiConfig,
                prefix: prefix.slice(-3000),
                suffix: suffix.slice(0, 1000),
                mode,
                signal: controller.signal
            });
            if (!controller.signal.aborted) {
                if (suggestionText) {
                    setSuggestion(suggestionText);
                } else {
                    setSuggestion('');
                }
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('AI Suggestion Error:', e);
            }
            if (!controller.signal.aborted) setSuggestion('');
        } finally {
            if (!controller.signal.aborted) {
                setIsSuggesting(false);
                if (onAiThinking) onAiThinking(false);
            }
        }
    }, [value, mode, settings, projectMetadata, onAiThinking]);


    // Automatic Trigger Effect
    useEffect(() => {
        const ai = settings?.ai || {};
        const enabled = ai.enabled && ai.inlineSuggestions?.enabled !== false;
        const triggerMode = ai.triggerMode || 'manual';

        if (!enabled || triggerMode === 'manual') {
            return;
        }

        const debounceMs = ai.debounceMs || 1500;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        // Only trigger if we have changes (cursorVersion or value)
        debounceRef.current = setTimeout(() => {
            fetchSuggestion();
        }, debounceMs);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [value, cursorVersion, fetchSuggestion, settings?.ai]);

    useEffect(() => {
        if (onRegisterCancel) {
            onRegisterCancel(() => {
                if (abortRef.current) abortRef.current.abort();
                setIsSuggesting(false);
                if (onAiThinking) onAiThinking(false);
                setSuggestion('');
                lastContextRef.current = ''; // Reset context so it can be re-triggered
            });
        }
    }, [onRegisterCancel, onAiThinking]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();
            if (onAiThinking) onAiThinking(false);
        };
    }, [onAiThinking]);


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
                
                {/* List Dropdown Menu */}
                <div className="relative-tool-container" ref={listMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                    <ToolBtn icon={<List size={18} />} onClick={() => setShowListMenu(prev => !prev)} title="List Options" />
                    {showListMenu && (
                        <div className="tool-dropdown-menu" style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            zIndex: 100,
                            minWidth: '160px',
                            padding: '4px 0'
                        }}>
                            <button className="dropdown-item" onClick={() => { insertText('- '); setShowListMenu(false); }}>
                                Bullet List (Dots)
                            </button>
                            <button className="dropdown-item" onClick={() => { insertText('1. '); setShowListMenu(false); }}>
                                Numbered List
                            </button>
                            <button className="dropdown-item" onClick={() => { insertText('- [ ] '); setShowListMenu(false); }}>
                                Checklist
                            </button>
                        </div>
                    )}
                </div>

                {/* Quote Dropdown Menu */}
                <div className="relative-tool-container" ref={quoteMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                    <ToolBtn icon={<Quote size={18} />} onClick={() => setShowQuoteMenu(prev => !prev)} title="Quote Options" />
                    {showQuoteMenu && (
                        <div className="tool-dropdown-menu" style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            zIndex: 100,
                            minWidth: '160px',
                            padding: '4px 0'
                        }}>
                            <button className="dropdown-item" onClick={() => { insertText('> '); setShowQuoteMenu(false); }}>
                                Standard Quote
                            </button>
                            <button className="dropdown-item" onClick={() => { insertText('>block '); setShowQuoteMenu(false); }}>
                                Highlighted Block
                            </button>
                        </div>
                    )}
                </div>
                <ToolBtn icon={<Code size={18} />} onClick={() => insertText('`', '`')} title="Inline Code" />
                <div className="divider"></div>
                <ToolBtn icon={<Link size={18} />} onClick={() => insertText('[', '](url)')} title="Link" />
                
                {/* Figure Dropdown Menu */}
                <div className="relative-tool-container" ref={imageMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                    <ToolBtn icon={<Image size={18} />} onClick={() => setShowImageMenu(prev => !prev)} title="Insert Figure" />
                    {showImageMenu && (
                        <div className="tool-dropdown-menu" style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            zIndex: 100,
                            minWidth: '185px',
                            padding: '4px 0'
                        }}>
                            <button className="dropdown-item" onClick={() => { insertText('![Caption of the figure]', '(path_to_figure){#label_figure width=100%}'); setShowImageMenu(false); }}>
                                Insert Image Template
                            </button>
                            <button className="dropdown-item" onClick={() => { handleImageUpload(); setShowImageMenu(false); }}>
                                Upload Image File
                            </button>
                        </div>
                    )}
                </div>

                <ToolBtn icon={<Sigma size={18} />} onClick={() => insertText('$$E = mc^2$${#eq_energy}', '')} title="Equation" />
                <ToolBtn icon={<Table size={18} />} onClick={() => insertText('\n| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |\n\n[Table Caption]{#tbl_label}\n', '')} title="Table" />
                
                <div className="divider"></div>
                {settings?.ai?.enabled && settings?.ai?.inlineSuggestions?.enabled !== false && (
                    <ToolBtn icon={<Sparkles size={18} />} onClick={() => {
                        lastContextRef.current = '';
                        fetchSuggestion();
                    }} title="Trigger AI (Ctrl+Space)" />
                )}
                {/* Citation Tools — available in researcher, engineer, scholar modes */}
                {(mode === 'researcher' || mode === 'engineer' || mode === 'scholar') && (
                    <div className="relative-tool-container" ref={citeMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                        <ToolBtn
                            icon={<BookMarked size={18} />}
                            onClick={() => setShowCiteMenu(prev => !prev)}
                            title="Insert Citation or Reference"
                        />
                        {showCiteMenu && (
                            <div className="tool-dropdown-menu" style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                background: 'var(--bg-panel)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                zIndex: 100,
                                minWidth: '200px',
                                padding: '4px 0'
                            }}>
                                <button className="dropdown-item" onClick={() => { insertText('[@paper_label]', ''); setShowCiteMenu(false); }}>
                                    Cite Paper
                                </button>
                                <button className="dropdown-item" onClick={() => { insertText('[text@paper_label]', ''); setShowCiteMenu(false); }}>
                                    Cite Paper as Text
                                </button>
                                <div className="divider-h"></div>
                                <button className="dropdown-item" onClick={() => { insertText('[figure@figure_label]', ''); setShowCiteMenu(false); }}>
                                    Cross Reference Figure
                                </button>
                                <button className="dropdown-item" onClick={() => { insertText('[equation@equation_label]', ''); setShowCiteMenu(false); }}>
                                    Cross Reference Equation
                                </button>
                                <button className="dropdown-item" onClick={() => { insertText('[table@table_label]', ''); setShowCiteMenu(false); }}>
                                    Cross Reference Table
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Documentation Button */}
                <button
                    onClick={() => setShowDocModal(true)}
                    title="Documentation & Format Guide"
                    className="btn-icon"
                    style={{ marginLeft: 'auto' }}
                >
                    <BookOpen size={18} />
                </button>
            </div>

            {/* Text Area */}
            <div className="textarea-wrapper">
                {/* Mirror for caret position logic */}
                <div ref={mirrorRef} className="textarea-mirror" aria-hidden="true" />
                {/* Hidden mirror for computing comment Y positions */}
                <div ref={positionMirrorRef} className="textarea-mirror" aria-hidden="true" />

                {/* Ghost Overlay for highlights + AI suggestions */}
                <div ref={ghostRef} className="ghost-overlay" aria-hidden="true">
                    {renderGhostContent()}
                </div>

                {/* Improve/Comment Button Widget */}
                {showWidget && (
                    <div className="improve-widget" style={{
                        position: 'absolute',
                        top: caretPos.top + 25,
                        left: Math.min(caretPos.left, 500),
                        zIndex: 100,
                        backgroundColor: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: '140px'
                    }} onMouseDown={(e) => e.stopPropagation()}>

                        {!widgetMenuOpen && !commentInputOpen ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {settings?.ai?.enabled && settings?.ai?.improvements?.enabled !== false && (
                                    <button
                                        onClick={() => setWidgetMenuOpen(true)}
                                        style={{
                                            border: 'none', background: 'transparent', padding: '6px 12px',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                            fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-color)',
                                            width: '100%', textAlign: 'left'
                                        }}
                                        className="widget-btn"
                                    >
                                        <Sparkles size={14} /> Improve
                                    </button>
                                )}
                                <button
                                    onClick={() => setCommentInputOpen(true)}
                                    style={{
                                        border: 'none', background: 'transparent', padding: '6px 12px',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
                                        width: '100%', textAlign: 'left'
                                    }}
                                    className="widget-btn"
                                >
                                    <MessageSquare size={14} /> Comment
                                </button>
                            </div>
                        ) : commentInputOpen ? (
                            <div style={{ padding: '8px', width: '220px' }}>
                                <textarea
                                    autoFocus
                                    placeholder="Write a comment..."
                                    value={newCommentText}
                                    onChange={(e) => setNewCommentText(e.target.value)}
                                    style={{
                                        width: '100%', minHeight: '60px', padding: '6px', fontSize: '0.85rem',
                                        border: '1px solid var(--border-color)', borderRadius: '4px',
                                        marginBottom: '6px', fontFamily: 'inherit'
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (newCommentText.trim()) {
                                                const start = selectionRange?.start || 0;
                                                const end = selectionRange?.end || 0;
                                                const startLine = value.substring(0, start).split('\n').length;
                                                // Capture context
                                                const contextBefore = value.substring(Math.max(0, start - 20), start);
                                                const contextAfter = value.substring(end, Math.min(value.length, end + 20));

                                                if (onAddComment) {
                                                    onAddComment(newCommentText, { text: selectedText, start, end, contextBefore, contextAfter, line: startLine, tag: activeSelectedTag });
                                                }
                                                setNewCommentText('');
                                                setSelectedTagId('');
                                                setCommentInputOpen(false);
                                                setShowWidget(false);
                                            }
                                        }
                                    }}
                                />
                                
                                <select
                                    value={selectedTagId}
                                    onChange={(e) => setSelectedTagId(e.target.value)}
                                    style={{
                                        width: '100%', padding: '6px 8px', fontSize: '0.8rem',
                                        border: '1px solid var(--border-color)', borderRadius: '4px',
                                        marginBottom: '8px', background: 'var(--bg-panel)', color: 'var(--text-primary)',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    <option value="">No Tag (General Comment)</option>
                                    {activeTags.major && activeTags.major.length > 0 && (
                                        <optgroup label="Major Comments">
                                            {activeTags.major.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </optgroup>
                                    )}
                                    {activeTags.minor && activeTags.minor.length > 0 && (
                                        <optgroup label="Minor Comments">
                                            {activeTags.minor.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </optgroup>
                                    )}
                                    {activeTags.minor_formal && activeTags.minor_formal.length > 0 && (
                                        <optgroup label="Minor Formal Comments">
                                            {activeTags.minor_formal.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </optgroup>
                                    )}
                                </select>

                                {activeSelectedTag && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '8px' }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: activeSelectedTag.color, display: 'inline-block', border: '1px solid rgba(0,0,0,0.1)' }} />
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Highlight Color: {activeSelectedTag.color}</span>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                                    <button onClick={() => { setCommentInputOpen(false); setSelectedTagId(''); }} style={{ fontSize: '0.75rem', padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                                    <button onClick={() => {
                                        if (newCommentText.trim()) {
                                            const start = selectionRange?.start || 0;
                                            const end = selectionRange?.end || 0;
                                            const startLine = value.substring(0, start).split('\n').length;
                                            const contextBefore = value.substring(Math.max(0, start - 20), start);
                                            const contextAfter = value.substring(end, Math.min(value.length, end + 20));

                                            if (onAddComment) {
                                                onAddComment(newCommentText, { text: selectedText, start, end, contextBefore, contextAfter, line: startLine, tag: activeSelectedTag });
                                            }
                                            setNewCommentText('');
                                            setSelectedTagId('');
                                            setCommentInputOpen(false);
                                            setShowWidget(false);
                                        }
                                    }} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>Add</button>
                                </div>
                            </div>
                        ) : (
                            <div className="improve-menu" style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{
                                    padding: '6px 12px',
                                    fontSize: '0.7rem',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 800,
                                    borderBottom: '1px solid var(--border-color)',
                                    marginBottom: 2
                                }}>
                                    REWRITE AS...
                                </div>
                                {['Formality', 'Coherence', 'Longer', 'Shorter'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            if (onRequestImprovement) {
                                                onRequestImprovement(selectedText, type.toLowerCase());
                                            }
                                            setWidgetMenuOpen(false);
                                            setShowWidget(false);
                                        }}
                                        style={{
                                            border: 'none', background: 'transparent', padding: '8px 12px',
                                            textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem',
                                            color: 'var(--text-primary)',
                                            display: 'block',
                                            width: '100%'
                                        }}
                                        className="dropdown-item"
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => {
                        setSuggestion(''); // Clear on type
                        onChange(e.target.value);
                    }}
                    className="main-textarea"
                    placeholder="# Start writing..."
                    spellCheck="false"
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                        if (suggestion && e.key === 'Tab') {
                            e.preventDefault();
                            acceptSuggestion();
                        }
                        if (suggestion && e.key === 'Escape') {
                            e.preventDefault();
                            setSuggestion('');
                        }
                        /* Allow Ctrl+RightArrow but maybe standard navigation handles it? 
                           If we want partial accept, that's complex. */
                        if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
                            e.preventDefault();
                            lastContextRef.current = '';
                            fetchSuggestion();
                        }
                    }}
                    onKeyUp={updateCursor}
                    onClick={updateCursor}
                    onSelect={updateCursor}
                    onScroll={(e) => {
                        updateCaretPosition();
                        const scrollTop = e.target.scrollTop;
                        if (ghostRef.current) {
                            ghostRef.current.scrollTop = scrollTop;
                            ghostRef.current.scrollLeft = e.target.scrollLeft;
                        }
                        if (onEditorScrollChange) onEditorScrollChange(scrollTop);
                    }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const data = e.dataTransfer.getData('application/json');
                        if (data) {
                            try {
                                const fileInfo = JSON.parse(data);
                                const { name, path } = fileInfo;
                                if (name.match(/\.(png|jpg|jpeg|svg|gif)$/i)) {
                                    const id = name.replace(/\.[^/.]+$/, "");
                                    insertText(`![Caption of the figure](${path}){#${id} width=100%}`, '');
                                } else if (name.endsWith('.md')) {
                                    insertText(`[${name}](${path})`, '');
                                } else {
                                    insertText(path, '');
                                }
                            } catch (err) {
                                console.error('Failed to parse dropped data', err);
                            }
                        } else {
                            const text = e.dataTransfer.getData('text/plain');
                            if (text) insertText(text, '');
                        }
                    }}
                />
            </div>

            {/* Documentation Modal */}
            {showDocModal && (
                <div className="doc-modal-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }} onClick={() => setShowDocModal(false)}>
                    <div className="doc-modal-content" style={{
                        width: '85%',
                        maxWidth: '900px',
                        maxHeight: '85vh',
                        backgroundColor: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
                        padding: '28px',
                        overflowY: 'auto',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column'
                    }} onClick={(e) => e.stopPropagation()}>
                        
                        {/* Close button */}
                        <button 
                            onClick={() => setShowDocModal(false)}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                border: 'none',
                                background: 'var(--hover-bg)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                            }}
                            className="btn-close-modal"
                        >
                            <X size={18} />
                        </button>

                        <h2 style={{ margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>
                            Writing Syntax & Reference Manual
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem', lineHeight: 1.6 }}>
                                This manual details the complete markdown syntax, formatting tools, equations, tables, figures, bibliography citations, and the interactive cross-referencing system. Everything you write in the editor will compile directly inside the Preview panel.
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                {/* Left Column: Basic Typography */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <h3 style={{ margin: '0', color: 'var(--accent-color)', fontSize: '1.1rem', fontWeight: 600 }}>Typography & Formatting</h3>
                                    
                                    <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>Inline Styling (Bold, Italic, Underline)</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>Format text decorations using standard markdown wraps or HTML spans.</div>
                                        <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code>**bold text**&#10;*italic text*&#10;&lt;u&gt;underlined text&lt;/u&gt;</code></pre>
                                    </div>

                                    <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>Headings (H1 & H2)</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>Organize document structure. Headings form the structural indices.</div>
                                        <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code># Primary Section Title&#10;## Secondary Subsection Title</code></pre>
                                    </div>

                                    <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>Lists & Tasks</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>Bullet points, numeric lists, and interactive checkbox checklists.</div>
                                        <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code>- Bullet list item&#10;1. First numeric item&#10;- [ ] Unfinished checklist task&#10;- [x] Completed checklist task</code></pre>
                                    </div>

                                    <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>Quotes & Blockquotes</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>Indent reference quotations or citations.</div>
                                        <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code>&gt; This is a blockquote indentation block&#10;&gt; for referencing external words.</code></pre>
                                    </div>
                                </div>

                                {/* Right Column: Equations, Tables & Figures */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <h3 style={{ margin: '0', color: 'var(--accent-color)', fontSize: '1.1rem', fontWeight: 600 }}>Scientific Elements</h3>

                                                                    <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>Equations (Labelable & Custom Alignment)</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>Write LaTeX block equations ($$ ... $$) or inline ($ ... $) appending a label. Equations are automatically numbered on the right. Support options: <code>align=center/left</code>.</div>
                                        <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code>{"$$ASD = 2$${#eq_lateral_foot align=left}\n\n$F = ma$${#eq_force align=center}"}</code></pre>
                                    </div>

                                    <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>Tables (Labelable & Custom Layouts)</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>Create standard markdown tables followed by an optional caption and label. Support options: <code>borders=true/false</code>, <code>center=true/false</code>, <code>center_text=true/false</code>.</div>
                                        <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code>{"| Param | Value |\n|---|---|\n| Force | 150 N |\n\n[Experimental Parameters]{#tbl_experimental borders=false center=false center_text=true}"}</code></pre>
                                    </div>

                                    <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>Figures & Images</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>Embed project figures with captions, width ratios, and labels.</div>
                                        <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code>{"![Pedestrian path](figures/pedestrian.png){#fig_path width=80%}"}</code></pre>
                                    </div>
                                </div>
                            </div>

                            {/* Reference System & Citations */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ margin: '8px 0 0 0', color: 'var(--accent-color)', fontSize: '1.1rem', fontWeight: 600 }}>Citations & Cross-References</h3>
                                
                                <div style={{ background: 'var(--bg-app)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>1. Cross-Referencing System</div>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                                                Link directly to equations, tables, or figures in your paragraphs. The system dynamically computes the element number (e.g. "1") and resolves the link.
                                            </div>
                                            <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code>{"In Eq. [equation@eq_lateral_foot], we calculate...\nSee Table [table@tbl_experimental] for values...\nRefer to Figure [figure@fig_path]..."}</code></pre>
                                        </div>

                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>2. Academic Bibliography Citations</div>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                                                Cite items from your BibTeX bibliography file (`references.bib`). Renders in APA narrative or parenthetical styling.
                                            </div>
                                            <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code>{"Parenthetical: [@einstein1905]\nNarrative: [text@einstein1905]"}</code></pre>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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

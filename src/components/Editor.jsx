import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Bold, Italic, Underline, Heading1, Heading2, Image, Link, List, Quote, Code, ImagePlus, Sparkles, MessageSquare, BookMarked, Sigma, Table, ChevronDown, ChevronRight, BookOpen, X } from 'lucide-react';
import { requestInlineSuggestion } from '../utils/aiSuggestions';

/**
 * Finds the best character index in full markdown text (value) corresponding to a clicked word in preview.
 * Returns the character index right at the END of the specific word in raw markdown text.
 */
export function findWordEndPositionInMarkdown(value, wordInfo) {
    if (!value || !wordInfo || !wordInfo.word) return -1;

    const { word, prefix = '', suffix = '', sectionOffset = null, tagName = '' } = wordInfo;
    const cleanWord = word.trim();
    if (!cleanWord) return -1;

    const lines = value.split('\n');
    let sectionStartChar = 0;
    if (sectionOffset !== null && sectionOffset >= 0) {
        for (let i = 0; i < Math.min(sectionOffset, lines.length); i++) {
            sectionStartChar += lines[i].length + 1;
        }
    }

    const cleanForTokens = (str) => {
        return (str || '')
            .replace(/[\\`*_{}\[\]()#+\-.!$>|~]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    };

    const prefixTokens = cleanForTokens(prefix).split(' ').filter(Boolean).slice(-8);
    const suffixTokens = cleanForTokens(suffix).split(' ').filter(Boolean).slice(0, 8);

    const candidates = [];
    const lowerValue = value.toLowerCase();
    const lowerWord = cleanWord.toLowerCase();

    // 1. Exact case-sensitive matches
    let pos = 0;
    while ((pos = value.indexOf(cleanWord, pos)) !== -1) {
        candidates.push({ start: pos, end: pos + cleanWord.length, exactCase: true });
        pos += cleanWord.length;
    }

    // 2. Case-insensitive matches if no exact match found
    if (candidates.length === 0) {
        let lpos = 0;
        while ((lpos = lowerValue.indexOf(lowerWord, lpos)) !== -1) {
            candidates.push({ start: lpos, end: lpos + cleanWord.length, exactCase: false });
            lpos += cleanWord.length;
        }
    }

    if (candidates.length === 0) {
        return -1;
    }

    if (candidates.length === 1) {
        return candidates[0].end;
    }

    let bestScore = -Infinity;
    let bestCandidate = candidates[0];

    const isWordChar = (ch) => {
        if (!ch) return false;
        return /[^\s\.,;:!?\(\)\[\]\{\}"'`~<>\/\\=+\-*&^%$#@!|«»“”‘’¿¡]/.test(ch);
    };

    for (const cand of candidates) {
        let score = 0;

        if (cand.exactCase) score += 20;

        const charBefore = cand.start > 0 ? value[cand.start - 1] : ' ';
        const charAfter = cand.end < value.length ? value[cand.end] : ' ';

        if (!isWordChar(charBefore)) score += 30;
        if (!isWordChar(charAfter)) score += 30;

        // Context before
        const rawBefore = value.substring(Math.max(0, cand.start - 150), cand.start);
        const cleanBeforeTokens = cleanForTokens(rawBefore).split(' ').filter(Boolean);

        for (let i = 0; i < prefixTokens.length; i++) {
            const token = prefixTokens[i];
            if (cleanBeforeTokens.includes(token)) {
                score += 25;
                const tokenIdx = cleanBeforeTokens.lastIndexOf(token);
                if (tokenIdx >= cleanBeforeTokens.length - (prefixTokens.length - i + 2)) {
                    score += 20;
                }
            }
        }

        // Context after
        const rawAfter = value.substring(cand.end, Math.min(value.length, cand.end + 150));
        const cleanAfterTokens = cleanForTokens(rawAfter).split(' ').filter(Boolean);

        for (let i = 0; i < suffixTokens.length; i++) {
            const token = suffixTokens[i];
            if (cleanAfterTokens.includes(token)) {
                score += 25;
                const tokenIdx = cleanAfterTokens.indexOf(token);
                if (tokenIdx !== -1 && tokenIdx <= i + 2) {
                    score += 20;
                }
            }
        }

        // Section proximity
        if (sectionOffset !== null) {
            if (cand.start >= sectionStartChar) {
                const dist = cand.start - sectionStartChar;
                score += Math.max(0, 100 - (dist / 20));
            } else {
                const dist = sectionStartChar - cand.start;
                score -= Math.min(50, dist / 20);
            }
        }

        // Tag matching
        if (/^h[1-6]$/i.test(tagName)) {
            const lineStart = value.lastIndexOf('\n', cand.start) + 1;
            const lineText = value.substring(lineStart, cand.start);
            if (/^\s*#{1,6}\s+/.test(lineText)) {
                score += 80;
            }
        } else if (/^li$/i.test(tagName)) {
            const lineStart = value.lastIndexOf('\n', cand.start) + 1;
            const lineText = value.substring(lineStart, cand.start);
            if (/^\s*([-*+]|\d+\.)\s+/.test(lineText)) {
                score += 50;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestCandidate = cand;
        }
    }

    return bestCandidate ? bestCandidate.end : -1;
}

function EditorComponent({ value, onChange, mode, onUploadImage, onPasteImage, settings, projectMetadata, onAiThinking, onRegisterCancel, onRequestImprovement, onSelectionChange, comments, commentTags, onAddComment, onCommentPositionsChange, onEditorScrollChange, onRegisterJumpTo }) {
    const textareaRef = useRef(null);
    const mirrorRef = useRef(null);
    const ghostRef = useRef(null);
    const positionMirrorRef = useRef(null);
    

    const pendingCursorRestoreRef = useRef(null);
    const pendingScrollRestoreRef = useRef(null);

    // Settings for highlighting & folding
    const editorColorizeHeadings = projectMetadata?.editorColorizeHeadings ?? true;
    const editorHeadingColorSource = projectMetadata?.editorHeadingColorSource ?? 'accent';
    const editorHeadingColor = projectMetadata?.editorHeadingColor;
    const editorColorizeCrossRefs = projectMetadata?.editorColorizeCrossRefs ?? true;
    const editorCrossRefColor = projectMetadata?.editorCrossRefColor;
    const editorColorizeFigures = projectMetadata?.editorColorizeFigures ?? true;
    const editorFigureColor = projectMetadata?.editorFigureColor;
    const editorColorizeEquations = projectMetadata?.editorColorizeEquations ?? true;
    const editorEquationColor = projectMetadata?.editorEquationColor;
    const editorEnableFolding = projectMetadata?.editorEnableFolding ?? true;
    const isColorizedActive = Boolean(editorColorizeHeadings || editorColorizeCrossRefs || editorColorizeFigures || editorColorizeEquations);

    const activeTheme = projectMetadata?.theme || 'light';

    const resolvedHeadingColor = useMemo(() => {
        if (editorHeadingColorSource === 'accent') {
            return projectMetadata?.accentColor || '#0984e3';
        }
        return editorHeadingColor || projectMetadata?.accentColor || '#0984e3';
    }, [editorHeadingColorSource, editorHeadingColor, projectMetadata?.accentColor]);

    const resolvedCrossRefColor = useMemo(() => {
        if (editorCrossRefColor) return editorCrossRefColor;
        switch (activeTheme) {
            case 'dark': return '#58a6ff';
            case 'semi-dark': return '#06b6d4';
            case 'semi-light': return '#3e2723';
            default: return '#0066cc';
        }
    }, [editorCrossRefColor, activeTheme]);

    const resolvedFigureColor = useMemo(() => {
        if (editorFigureColor) return editorFigureColor;
        switch (activeTheme) {
            case 'dark': return '#8b949e';
            case 'semi-dark': return '#94a3b8';
            case 'semi-light': return '#8d6e63';
            default: return '#7f8c8d';
        }
    }, [editorFigureColor, activeTheme]);

    const resolvedEquationColor = useMemo(() => {
        if (editorEquationColor) return editorEquationColor;
        switch (activeTheme) {
            case 'dark': return '#4fa8ff';
            case 'semi-dark': return '#22d3ee';
            case 'semi-light': return '#0f766e';
            default: return '#0b7285';
        }
    }, [editorEquationColor, activeTheme]);

    const getHeadingLevel = (line) => {
        const match = line.match(/^\s*(#{1,2})\s+/);
        return match ? match[1].length : 0;
    };

    // Folding states
    const [collapsedHeadingLines, setCollapsedHeadingLines] = useState(new Set());


    // Compute maps between full and visible text (Fast-path: no allocations when no headings are collapsed)
    const { visibleText, visibleToFullMap, fullToVisibleMap } = useMemo(() => {
        if (!collapsedHeadingLines || collapsedHeadingLines.size === 0) {
            return { visibleText: value, visibleToFullMap: null, fullToVisibleMap: null };
        }
        const lines = value.split('\n');
        let visibleStr = '';
        const v2f = [];
        const f2v = new Array(value.length + 1).fill(-1);

        let fullIdx = 0;
        let visibleIdx = 0;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const lvl = getHeadingLevel(line);
            
            if (lineIndex > 0) {
                visibleStr += '\n';
                v2f.push(fullIdx);
                f2v[fullIdx] = visibleIdx;
                fullIdx += 1;
                visibleIdx += 1;
            }
            
            const isCollapsed = lvl > 0 && collapsedHeadingLines.has(lineIndex);
            
            if (isCollapsed) {
                const startVisPos = visibleStr.length;
                const lineText = line + ' ⋯';
                visibleStr += lineText;
                
                for (let k = 0; k < lineText.length; k++) {
                    v2f.push(fullIdx + Math.min(k, line.length));
                }
                
                // Find next heading of same or higher level
                let j = lineIndex + 1;
                while (j < lines.length) {
                    const nextLvl = getHeadingLevel(lines[j]);
                    if (nextLvl > 0 && nextLvl <= lvl) {
                        break;
                    }
                    j++;
                }
                
                // Map the full text indices of the collapsed region to the placeholder's end
                const collapsedStartFull = fullIdx;
                let collapsedEndFull = fullIdx + line.length;
                for (let lIndex = lineIndex + 1; lIndex < j; lIndex++) {
                    collapsedEndFull += 1 + lines[lIndex].length;
                }
                
                for (let idx = collapsedStartFull; idx < collapsedEndFull; idx++) {
                    f2v[idx] = startVisPos + Math.min(idx - collapsedStartFull, line.length);
                }
                
                fullIdx = collapsedEndFull;
                visibleIdx += lineText.length;
                lineIndex = j - 1;
            } else {
                for (let k = 0; k < line.length; k++) {
                    v2f.push(fullIdx + k);
                    f2v[fullIdx + k] = visibleIdx + k;
                }
                visibleStr += line;
                fullIdx += line.length;
                visibleIdx += line.length;
            }
        }
        
        v2f.push(fullIdx);
        f2v[fullIdx] = visibleIdx;

        return { visibleText: visibleStr, visibleToFullMap: v2f, fullToVisibleMap: f2v };
    }, [value, collapsedHeadingLines]);

    const getFullIdx = useCallback((visIdx) => {
        if (!visibleToFullMap) return visIdx;
        return visibleToFullMap[Math.min(visIdx, visibleToFullMap.length - 1)] ?? visIdx;
    }, [visibleToFullMap]);

    const getVisIdx = useCallback((fullIdx) => {
        if (!fullToVisibleMap) return fullIdx;
        return fullToVisibleMap[Math.min(fullIdx, fullToVisibleMap.length - 1)] ?? fullIdx;
    }, [fullToVisibleMap]);

    // Find single edit helper
    function findSingleEdit(oldStr, newStr) {
        let start = 0;
        while (start < oldStr.length && start < newStr.length && oldStr[start] === newStr[start]) {
            start++;
        }
        let oldEnd = oldStr.length;
        let newEnd = newStr.length;
        while (oldEnd > start && newEnd > start && oldStr[oldEnd - 1] === newStr[newEnd - 1]) {
            oldEnd--;
            newEnd--;
        }
        return {
            start,
            deletedLength: oldEnd - start,
            insertedText: newStr.substring(start, newEnd)
        };
    }

    const handleTextareaChange = (e) => {
        setSuggestion(''); // Clear on type
        const newVisibleText = e.target.value;
        if (!visibleToFullMap) {
            onChange(newVisibleText);
            return;
        }
        const edit = findSingleEdit(visibleText, newVisibleText);
        const startFull = visibleToFullMap[edit.start] ?? 0;
        const endFull = visibleToFullMap[Math.min(edit.start + edit.deletedLength, visibleToFullMap.length - 1)] ?? value.length;
        const newFullText = value.substring(0, startFull) + edit.insertedText + value.substring(endFull);
        onChange(newFullText);
    };

    // Toggle collapse state
    const toggleSectionCollapse = (originalLineIndex) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        
        // Save scroll position so we can restore it after the re-render
        const savedScrollTop = textarea.scrollTop;
        
        // Save cursor in full-text coordinates
        const curStartVis = textarea.selectionStart;
        const curEndVis = textarea.selectionEnd;
        const curStartFull = getFullIdx(curStartVis);
        const curEndFull = getFullIdx(curEndVis);
        
        setCollapsedHeadingLines(prev => {
            const next = new Set(prev);
            if (next.has(originalLineIndex)) {
                next.delete(originalLineIndex);
            } else {
                next.add(originalLineIndex);
            }
            return next;
        });
        
        pendingCursorRestoreRef.current = { startFull: curStartFull, endFull: curEndFull };
        pendingScrollRestoreRef.current = savedScrollTop;
    };

    const scrollToVisiblePosition = useCallback((visPos) => {
        const textarea = textareaRef.current;
        const mirror = mirrorRef.current;
        if (!textarea || !mirror) return;

        const computed = window.getComputedStyle(textarea);
        const properties = [
            'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
            'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
            'borderStyle', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
            'fontSizeAdjust', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform',
            'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize', 'MozTabSize'
        ];
        properties.forEach(prop => {
            mirror.style[prop] = computed[prop];
        });
        mirror.style.position = 'absolute';
        mirror.style.top = '0';
        mirror.style.left = '0';
        mirror.style.visibility = 'hidden';
        mirror.style.width = `${textarea.clientWidth}px`;
        mirror.style.border = 'none';
        mirror.style.boxSizing = 'border-box';

        mirror.textContent = visibleText.substring(0, visPos);
        const span = document.createElement('span');
        span.textContent = '\u200b';
        mirror.appendChild(span);

        const spanTop = span.offsetTop;
        const targetScrollTop = Math.max(0, spanTop - textarea.clientHeight / 2 + 20);

        textarea.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
        if (ghostRef.current) {
            ghostRef.current.scrollTop = targetScrollTop;
        }
    }, [visibleText]);

    // Restore cursor position and scroll after collapse/expand or jump
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        
        if (pendingCursorRestoreRef.current) {
            const { startFull, endFull, scrollToCenter } = pendingCursorRestoreRef.current;
            pendingCursorRestoreRef.current = null;
            
            // Look up the visible position; if the index falls inside a collapsed region
            // (mapped to -1), clamp to the nearest valid position
            let nextStartVis = getVisIdx(startFull);
            let nextEndVis = getVisIdx(endFull);
            
            // If the cursor was inside a collapsed region, place it at the end of the heading line
            if (nextStartVis === undefined || nextStartVis === -1) nextStartVis = 0;
            if (nextEndVis === undefined || nextEndVis === -1) nextEndVis = nextStartVis;
            
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(nextStartVis, nextEndVis);
            updateCursor();

            if (scrollToCenter) {
                requestAnimationFrame(() => {
                    scrollToVisiblePosition(nextEndVis);
                });
            }
        }
        
        // Restore scroll position to prevent jump
        if (pendingScrollRestoreRef.current !== null) {
            const savedScroll = pendingScrollRestoreRef.current;
            pendingScrollRestoreRef.current = null;
            // Use requestAnimationFrame to apply after React's DOM update
            requestAnimationFrame(() => {
                textarea.scrollTop = savedScroll;
                if (ghostRef.current) ghostRef.current.scrollTop = savedScroll;

            });
        }
    }, [visibleText, getVisIdx, scrollToVisiblePosition]);

    // Parse and tokenize highlights in the editor
    const syntaxRanges = useMemo(() => {
        if (!isColorizedActive) return [];
        const list = [];

        // 1. Headings
        if (editorColorizeHeadings) {
            const lines = visibleText.split('\n');
            let charOffset = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lvl = getHeadingLevel(line);
                if (lvl === 1) {
                    list.push({ start: charOffset, end: charOffset + line.length, type: 'h1' });
                } else if (lvl === 2) {
                    list.push({ start: charOffset, end: charOffset + line.length, type: 'h2' });
                }
                charOffset += line.length + 1; // +1 for newline
            }
        }

        const addRange = (start, end, type) => {
            const hasOverlap = list.some(r => (start < r.end && end > r.start));
            if (!hasOverlap) {
                list.push({ start, end, type });
            }
        };

        // 2. Figures
        if (editorColorizeFigures) {
            const figRegex = /!\[[^\]]*\]\([^)]+\)(?:\{[^}]*\})?/g;
            let match;
            while ((match = figRegex.exec(visibleText)) !== null) {
                addRange(match.index, match.index + match[0].length, 'figure');
            }
        }

        // 3. Equations
        if (editorColorizeEquations) {
            const eqBlockRegex = /\$\$[\s\S]*?\$\$/g;
            let match;
            while ((match = eqBlockRegex.exec(visibleText)) !== null) {
                addRange(match.index, match.index + match[0].length, 'equation');
            }
            
            const eqInlineRegex = /\$[^$\n]+?\$/g;
            while ((match = eqInlineRegex.exec(visibleText)) !== null) {
                addRange(match.index, match.index + match[0].length, 'equation');
            }
        }

        // 4. Cross references
        if (editorColorizeCrossRefs) {
            const refRegex = /\[[^\]]*@[^\]]+\]/g;
            let match;
            while ((match = refRegex.exec(visibleText)) !== null) {
                addRange(match.index, match.index + match[0].length, 'cross-ref');
            }
        }

        list.sort((a, b) => a.start - b.start);
        return list;
    }, [visibleText, isColorizedActive, editorColorizeHeadings, editorColorizeCrossRefs, editorColorizeFigures, editorColorizeEquations]);

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
    const [, setIsSuggesting] = useState(false);
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
        const selText = text.substring(start, end);
        const replacement = before + selText + after;

        // Use execCommand to preserve undo history if possible (deprecated but widely supported)
        const success = document.execCommand('insertText', false, replacement);

        if (!success) {
            // Fallback: map visible coords to full-text coords
            const startFull = getFullIdx(start);
            const endFull = getFullIdx(end);
            const newFullText = value.substring(0, startFull) + replacement + value.substring(endFull);
            onChange(newFullText);

            // Manually restore cursor
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + before.length, end + before.length);
            }, 0);
        } else {
            setTimeout(() => {
                textarea.setSelectionRange(start + before.length, start + before.length + selText.length);
            }, 0);
        }
    };

    const insertLinePrefix = (prefix) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.focus();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selText = text.substring(start, end);
        const lines = selText.split('\n');
        const replacement = lines.map(line => prefix + line).join('\n');

        const success = document.execCommand('insertText', false, replacement);

        if (!success) {
            // Fallback: map visible coords to full-text coords
            const startFull = getFullIdx(start);
            const endFull = getFullIdx(end);
            const newFullText = value.substring(0, startFull) + replacement + value.substring(endFull);
            onChange(newFullText);

            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start, start + replacement.length);
            }, 0);
        } else {
            setTimeout(() => {
                textarea.setSelectionRange(start, start + replacement.length);
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

    const jumpToPosition = useCallback((targetFullIndex) => {
        if (targetFullIndex < 0 || targetFullIndex > value.length) return;

        const lines = value.split('\n');
        let charCount = 0;
        let targetLineIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            const lineLen = lines[i].length;
            if (charCount + lineLen >= targetFullIndex || i === lines.length - 1) {
                targetLineIndex = i;
                break;
            }
            charCount += lineLen + 1;
        }

        // Check if targetLineIndex is collapsed under any heading
        let needUncollapse = false;
        const headingToUncollapse = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lvl = getHeadingLevel(line);
            if (lvl > 0 && collapsedHeadingLines.has(i)) {
                let j = i + 1;
                while (j < lines.length) {
                    const nextLvl = getHeadingLevel(lines[j]);
                    if (nextLvl > 0 && nextLvl <= lvl) break;
                    j++;
                }
                if (targetLineIndex >= i && targetLineIndex < j) {
                    needUncollapse = true;
                    headingToUncollapse.push(i);
                }
            }
        }

        if (needUncollapse) {
            setCollapsedHeadingLines(prev => {
                const next = new Set(prev);
                headingToUncollapse.forEach(h => next.delete(h));
                return next;
            });
            pendingCursorRestoreRef.current = {
                startFull: targetFullIndex,
                endFull: targetFullIndex,
                scrollToCenter: true
            };
        } else {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const visPos = getVisIdx(targetFullIndex);
            if (visPos !== undefined && visPos !== -1) {
                textarea.focus({ preventScroll: true });
                textarea.setSelectionRange(visPos, visPos);
                updateCursor();

                requestAnimationFrame(() => {
                    scrollToVisiblePosition(visPos);
                });
            }
        }
    }, [value, getVisIdx, collapsedHeadingLines, updateCursor, scrollToVisiblePosition]);

    const handleJumpToWord = useCallback((wordInfo) => {
        const targetPos = findWordEndPositionInMarkdown(value, wordInfo);
        if (targetPos !== -1) {
            jumpToPosition(targetPos);
        }
    }, [value, jumpToPosition]);

    useEffect(() => {
        if (onRegisterJumpTo) {
            onRegisterJumpTo(handleJumpToWord);
        }
    }, [onRegisterJumpTo, handleJumpToWord]);

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

    // Compute collapsed index ranges in full text
    const collapsedRanges = useMemo(() => {
        const ranges = [];
        const lines = value.split('\n');
        let fullIdx = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lvl = getHeadingLevel(line);
            if (lvl > 0 && collapsedHeadingLines.has(i)) {
                const start = fullIdx + line.length;
                let j = i + 1;
                while (j < lines.length) {
                    const nextLvl = getHeadingLevel(lines[j]);
                    if (nextLvl > 0 && nextLvl <= lvl) {
                        break;
                    }
                    j++;
                }
                let end = fullIdx + line.length;
                for (let lIndex = i + 1; lIndex < j; lIndex++) {
                    end += 1 + lines[lIndex].length;
                }
                ranges.push({ start, end });
                i = j - 1;
                fullIdx = end;
            } else {
                fullIdx += line.length + 1;
            }
        }
        return ranges;
    }, [value, collapsedHeadingLines]);

    const isIndexCollapsed = useCallback((idx) => {
        return collapsedRanges.some(r => idx >= r.start && idx < r.end);
    }, [collapsedRanges]);

    // Mapped comment ranges in visibleText
    const visibleCommentRanges = useMemo(() => {
        if (!commentRanges || commentRanges.length === 0) return [];
        const list = [];
        for (const r of commentRanges) {
            if (isIndexCollapsed(r.start)) continue;
            const visStart = getVisIdx(r.start);
            const visEnd = getVisIdx(r.end);
            if (visStart !== -1 && visEnd !== -1 && visStart !== visEnd) {
                list.push({ start: visStart, end: visEnd, id: r.id, comment: r.comment });
            }
        }
        list.sort((a, b) => a.start - b.start);
        return list;
    }, [commentRanges, getVisIdx, isIndexCollapsed]);

    // --- Build ghost overlay content: full text with highlight spans + suggestion ---
    const renderGhostContent = () => {
        if (!isColorizedActive && !suggestion && visibleCommentRanges.length === 0) {
            return null;
        }
        const cursorPos = cursorRef.current?.start || 0;

        // Collect all boundary indices
        const boundariesSet = new Set([0, visibleText.length, cursorPos]);
        for (const r of visibleCommentRanges) {
            boundariesSet.add(r.start);
            boundariesSet.add(r.end);
        }
        for (const r of syntaxRanges) {
            boundariesSet.add(r.start);
            boundariesSet.add(r.end);
        }

        const boundaries = Array.from(boundariesSet).sort((a, b) => a - b);
        let segments = [];

        for (let idx = 0; idx < boundaries.length - 1; idx++) {
            const start = boundaries[idx];
            const end = boundaries[idx + 1];
            if (start === end) continue;

            const text = visibleText.substring(start, end);
            const comment = visibleCommentRanges.find(r => start >= r.start && end <= r.end);
            const syntax = syntaxRanges.find(r => start >= r.start && end <= r.end);

            segments.push({
                text,
                type: 'normal',
                commentId: comment ? comment.id : null,
                commentColor: comment ? (comment.comment?.tag?.color || '#ffb400') : null,
                syntaxType: syntax ? syntax.type : null
            });
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

        let charPos = 0;
        return segments.map((s, i) => {
            const segCharPos = charPos;
            if (s.type !== 'suggestion') {
                charPos += s.text.length;
            }

            if (s.type === 'suggestion') {
                return <span key={i} className="suggestion">{s.text}</span>;
            }

            let style = {};
            if (s.syntaxType === 'h1' || s.syntaxType === 'h2') {
                style.color = resolvedHeadingColor;
                style.fontWeight = 'bold';
            } else if (s.syntaxType === 'cross-ref') {
                style.color = resolvedCrossRefColor;
                style.fontWeight = '500';
            } else if (s.syntaxType === 'figure') {
                style.color = resolvedFigureColor;
            } else if (s.syntaxType === 'equation') {
                style.color = resolvedEquationColor;
            }

            if (s.commentId) {
                style.backgroundColor = `${s.commentColor}33`;
                style.borderBottom = `2px solid ${s.commentColor}`;
            }

            // Embed folding chevron directly inside the heading span
            let chevron = null;
            if (editorEnableFolding) {
                const isLineStart = segCharPos === 0 || visibleText[segCharPos - 1] === '\n';
                if (isLineStart) {
                    const nextNL = visibleText.indexOf('\n', segCharPos);
                    const fullLine = nextNL === -1 ? visibleText.substring(segCharPos) : visibleText.substring(segCharPos, nextNL);
                    const lvl = getHeadingLevel(fullLine);
                    if (lvl > 0) {
                        const fullCharIdx = getFullIdx(segCharPos);
                        const originalLineIndex = value.substring(0, fullCharIdx).split('\n').length - 1;
                        const isCollapsed = collapsedHeadingLines.has(originalLineIndex);
                        chevron = (
                            <button
                                key={`chev-${i}`}
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleSectionCollapse(originalLineIndex); }}
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                style={{
                                    position: 'absolute',
                                    left: '-30px',
                                    top: '2px',
                                    width: '18px',
                                    height: '18px',
                                    background: 'var(--bg-panel)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'auto',
                                    padding: 0,
                                    boxShadow: 'var(--shadow-sm)',
                                    zIndex: 20
                                }}
                                className="folding-chevron-btn"
                                title={isCollapsed ? 'Expand section' : 'Collapse section'}
                            >
                                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                            </button>
                        );
                    }
                }
            }

            if (chevron) {
                return (
                    <span key={i} style={{ ...style, position: 'relative' }}>
                        {chevron}
                        {s.text}
                    </span>
                );
            }

            return <span key={i} style={style}>{s.text}</span>;
        });
    };

    // --- Compute Y positions of comments using a hidden mirror div ---
    const computeCommentPositions = useCallback(() => {
        const textarea = textareaRef.current;
        const mirror = positionMirrorRef.current;
        if (!textarea || !mirror || visibleCommentRanges.length === 0) {
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
        for (const r of visibleCommentRanges) {
            mirror.textContent = visibleText.substring(0, r.start);
            const marker = document.createElement('span');
            marker.textContent = '\u200b';
            mirror.appendChild(marker);
            const yTop = marker.offsetTop;
            positions.push({ id: r.id, y: yTop, comment: r.comment });
        }

        if (onCommentPositionsChange) onCommentPositionsChange(positions);
    }, [visibleCommentRanges, visibleText, onCommentPositionsChange]);



    useEffect(() => {
        if (!comments || comments.length === 0) {
            if (onCommentPositionsChange) onCommentPositionsChange([]);
            return;
        }

        const handler = setTimeout(() => {
            computeCommentPositions();
        }, 400);

        return () => clearTimeout(handler);
    }, [computeCommentPositions, visibleText, comments, onCommentPositionsChange]);



    // Recompute on resize        
    useEffect(() => {
        const handleResize = () => {
            computeCommentPositions();
        };
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

    // Check if any headings exist in visible text for left padding
    const hasVisibleHeadings = useMemo(() => {
        if (!editorEnableFolding) return false;
        return visibleText.split('\n').some(line => getHeadingLevel(line) > 0);
    }, [visibleText, editorEnableFolding]);
    const activePaddingLeft = hasVisibleHeadings ? '45px' : '32px';

    const sharedEditorStyle = {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--editor-font-size, 14px)',
        lineHeight: '1.7',
        paddingTop: '32px',
        paddingRight: '32px',
        paddingBottom: '32px',
        paddingLeft: activePaddingLeft,
        tabSize: 4,
        MozTabSize: 4,
        boxSizing: 'border-box'
    };

    const handleScroll = (e) => {
        updateCaretPosition();
        const scrollTop = e.target.scrollTop;
        if (ghostRef.current) {
            ghostRef.current.scrollTop = scrollTop;
            ghostRef.current.scrollLeft = e.target.scrollLeft;
        }

        if (onEditorScrollChange) onEditorScrollChange(scrollTop);
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
                <div ref={mirrorRef} className="textarea-mirror" style={sharedEditorStyle} aria-hidden="true" />
                {/* Hidden mirror for computing comment Y positions */}
                <div ref={positionMirrorRef} className="textarea-mirror" style={sharedEditorStyle} aria-hidden="true" />

                {/* Ghost Overlay for highlights + AI suggestions */}
                <div ref={ghostRef} className="ghost-overlay" style={{
                    ...sharedEditorStyle,
                    color: isColorizedActive ? 'var(--text-primary)' : 'transparent'
                }} aria-hidden="true">
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
                                                const startFull = getFullIdx(start);
                                                const endFull = getFullIdx(end);
                                                const startLine = value.substring(0, startFull).split('\n').length;
                                                // Capture context
                                                const contextBefore = value.substring(Math.max(0, startFull - 20), startFull);
                                                const contextAfter = value.substring(endFull, Math.min(value.length, endFull + 20));

                                                if (onAddComment) {
                                                    onAddComment(newCommentText, { text: selectedText, start: startFull, end: endFull, contextBefore, contextAfter, line: startLine, tag: activeSelectedTag });
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
                                            const startFull = getFullIdx(start);
                                            const endFull = getFullIdx(end);
                                            const startLine = value.substring(0, startFull).split('\n').length;
                                            const contextBefore = value.substring(Math.max(0, startFull - 20), startFull);
                                            const contextAfter = value.substring(endFull, Math.min(value.length, endFull + 20));

                                            if (onAddComment) {
                                                onAddComment(newCommentText, { text: selectedText, start: startFull, end: endFull, contextBefore, contextAfter, line: startLine, tag: activeSelectedTag });
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
                    value={visibleText}
                    onChange={handleTextareaChange}
                    style={{
                        ...sharedEditorStyle,
                        color: isColorizedActive ? 'transparent' : 'var(--text-primary)',
                        caretColor: 'var(--text-primary)'
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
                        // Selection formatting shortcuts: wrap or line-prefix selected text
                        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                            const hasSelection = e.target.selectionStart !== e.target.selectionEnd;
                            if (hasSelection) {
                                if (e.key === '*') {
                                    e.preventDefault();
                                    insertText('*', '*');
                                } else if (e.key === '$') {
                                    e.preventDefault();
                                    insertText('$', '$');
                                } else if (e.key === '>') {
                                    e.preventDefault();
                                    insertLinePrefix('> ');
                                } else if (e.key === '#') {
                                    e.preventDefault();
                                    insertLinePrefix('# ');
                                }
                            }
                        }
                    }}
                    onKeyUp={updateCursor}
                    onClick={updateCursor}
                    onSelect={updateCursor}
                    onScroll={handleScroll}
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

                            {/* Keyboard Shortcuts */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ margin: '8px 0 0 0', color: 'var(--accent-color)', fontSize: '1.1rem', fontWeight: 600 }}>Keyboard Shortcuts</h3>
                                
                                <div style={{ background: 'var(--bg-app)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>Selection Formatting Shortcuts</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                                        Select text and press the shortcut key to format it instantly. Wrap shortcuts surround the selected text; line prefix shortcuts add a prefix to every selected line.
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Wrap Shortcuts</div>
                                            <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code>{"Select + * \u2192 *italic text*\nSelect + $ \u2192 $inline equation$"}</code></pre>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Line Prefix Shortcuts</div>
                                            <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid var(--border-color)', overflowX: 'auto', color: 'var(--text-primary)' }}><code>{"Select lines + > \u2192 > quoted lines\nSelect lines + # \u2192 # heading lines"}</code></pre>
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

export const Editor = React.memo(EditorComponent);

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

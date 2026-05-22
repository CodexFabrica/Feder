import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ChevronDown, ChevronRight, List, FileText, Sparkles, MessageSquare, Check, X as XIcon, RefreshCw, Send, Trash2, Network, Lightbulb } from 'lucide-react';
import { NotesGraph } from './NotesGraph';
import { IdeasGraph } from './IdeasGraph';


// Helper to split markdown by level 1 headers
const splitByH1 = (text) => {
    if (!text) return [];

    const lines = text.split('\n');
    const sections = [];
    let currentSection = { title: null, lines: [], startLine: 0 };
    let inCodeBlock = false;

    lines.forEach((line, index) => {
        // Toggle code block status
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
        }

        // Check for H1: only if not in code block
        // Matches start of line # followed by space
        const h1Match = !inCodeBlock && line.match(/^(\s*)#\s+(.+)$/);

        if (h1Match) {
            // Push previous section if it has content or was a titled section
            if (currentSection.lines.length > 0 || currentSection.title !== null) {
                sections.push(currentSection);
            }

            // Start new section
            // content starts at next line, so offset is index + 1
            currentSection = {
                title: h1Match[2].trim(),
                lines: [],
                startLine: index + 1
            };
        } else {
            currentSection.lines.push(line);
        }
    });

    // Push final section
    if (currentSection.lines.length > 0 || currentSection.title !== null) {
        sections.push(currentSection);
    }

    return sections;
};

// BibTeX, Citation, and Reference Helpers
const parseBibTex = (text) => {
    const entries = {};
    const blocks = text.split(/^@/m).slice(1);
    blocks.forEach(block => {
        const openBrace = block.indexOf('{');
        if (openBrace === -1) return;
        const type = block.substring(0, openBrace).trim().toLowerCase();
        if (type === 'comment' || type === 'preamble') return;

        // Extract key
        const afterType = block.substring(openBrace + 1);
        const comma = afterType.indexOf(',');
        if (comma === -1) return;
        const key = afterType.substring(0, comma).trim();

        // Parse fields
        const entry = { key, type };
        const body = afterType.substring(comma + 1);

        // Match field = {value}, "value", or unquoted number/string pattern
        const fieldRegex = /([a-zA-Z0-9_\-]+)\s*=\s*(?:{([^}]+)}|"([^"]+)"|([^\s,{}"]+))/g;
        let match;
        while ((match = fieldRegex.exec(body)) !== null) {
            const field = match[1].toLowerCase();
            const value = match[2] || match[3] || match[4] || '';
            entry[field] = value.trim();
        }
        entries[key] = entry;
    });
    return entries;
};

const formatCitation = (key, entry, type = 'parenthetical', useAPA = true) => {
    if (!useAPA) {
        return `[${key}]`;
    }
    if (!entry) return type === 'narrative' ? `${key}` : `(${key})`;
    const year = entry.year || 'n.d.';
    const authorsStr = entry.author;

    let label = key;
    if (authorsStr) {
        const authors = authorsStr.split(' and ').map(a => a.trim());
        const surnames = authors.map(a => {
            if (a.includes(',')) return a.split(',')[0].trim();
            const parts = a.split(' ');
            return parts[parts.length - 1];
        });

        if (surnames.length === 1) label = surnames[0];
        else if (surnames.length === 2) label = `${surnames[0]} & ${surnames[1]}`;
        else label = `${surnames[0]} et al.`;
    }

    if (type === 'narrative') {
        return `${label} (${year})`;
    }
    return `(${label}, ${year})`;
};

const ReferenceList = ({ bibData, citedKeys, useAPA = true }) => {
    if (!bibData || Object.keys(bibData).length === 0) return null;

    // Filter to show only cited keys? Or all? User said "add the references", usually implies all in bib or cited.
    // Let's show all for now as user might manage the .bib file to only include relevant ones, 
    // or we can filter if we had the list of cited keys. 
    // Let's filter by cited if possible, but for now showing all is safer to ensure nothing is missed if regex misses.
    // Actually, usually you only list what you cite.

    const sortedEntries = Object.values(bibData).sort((a, b) => {
        const authA = a.author || '';
        const authB = b.author || '';
        return authA.localeCompare(authB);
    });

    const itemStyle = useAPA
        ? { marginBottom: '1em', paddingLeft: '1.5em', textIndent: '-1.5em' }
        : { marginBottom: '1em' };

    return (
        <div className="references-section prose" style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #eee' }}>
            <h1>References</h1>
            <div className="references-list" style={{ fontSize: '0.9rem' }}>
                {sortedEntries.map(entry => {
                    if (citedKeys && !citedKeys.has(entry.key)) return null;

                    const authorsStr = entry.author ? entry.author.split(' and ').map((a, i, arr) => {
                        let formatted = a.trim();
                        if (!formatted.includes(',')) {
                            const parts = formatted.split(' ');
                            const surname = parts.pop();
                            const initials = parts.map(p => p[0] + '.').join(' ');
                            formatted = `${surname}, ${initials}`;
                        }
                        if (i === arr.length - 1 && arr.length > 1) return `& ${formatted}`;
                        return formatted;
                    }).join(', ') : 'Unknown Author';

                    return (
                        <div key={entry.key} style={itemStyle}>
                            {!useAPA && <strong style={{ marginRight: '8px' }}>[{entry.key}]</strong>}
                            {authorsStr} ({entry.year}). {entry.title}.
                            {entry.journal && <span> <i>{entry.journal}</i>, </span>}
                            {entry.volume && <span><i>{entry.volume}</i></span>}
                            {entry.issue ? `(${entry.issue})` : ''}
                            {entry.pages && <span>, {entry.pages}</span>}.
                            {entry.doi && <span> https://doi.org/{entry.doi}</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Helper to process internal references (Figures, Tables, Equations)
const processReferences = (text) => {
    if (!text) return { content: '', map: {} };

    // We process sequentially to build the map, then replace citations
    let content = text;
    const map = {};
    let figCount = 0;
    let tblCount = 0;
    let eqCount = 0;

    // 1. Figures: ![Alt](Src){attributes}
    // Support {width=100% #id} or {id=id width=100%} etc.
    // Regex matches ![...](...){...}
    content = content.replace(/!\[(.*?)\]\((.*?)\)\{(.*?)\}/g, (match, alt, src, attrs) => {
        let width = '';
        let id = '';
        let label = '';

        // Extract Width
        const wMatch = attrs.match(/width=([^}\s]+)/);
        if (wMatch) width = wMatch[1];

        // Extract ID (#id or id=...)
        const idMatch = attrs.match(/#([a-zA-Z0-9_\-]+)/) || attrs.match(/id=([a-zA-Z0-9_\-]+)/);

        if (idMatch) {
            id = idMatch[1];
            figCount++;
            label = `Figure ${figCount}`;
            map[id] = { label, type: 'figure', num: figCount };
        }

        // Pack metadata into alt for AsyncImage to retrieve
        const packedAlt = `${alt}|width=${width}|id=${id}|label=${label}`;
        return `![${packedAlt}](${src})`;
    });

    // 2. Tables:
    // Pattern A: Markdown tables followed by [caption]{#id} or {#id}
    const tableRegex = /((?:(?:\r?\n|^)[ \t]*\|[^\n]*\|[ \t]*)+)[\s\r\n]*(?:\[([^\]]+)\])?\s*\{([^}]+)\}/g;
    content = content.replace(tableRegex, (match, tableBlock, caption, attrs) => {
        const idMatch = attrs.match(/#([a-zA-Z0-9_\-]+)/) || attrs.match(/id=([a-zA-Z0-9_\-]+)/);
        let id = idMatch ? idMatch[1] : '';

        const bordersMatch = attrs.match(/borders=(true|false)/);
        const centerMatch = attrs.match(/center=(true|false)/);
        const centerTextMatch = attrs.match(/center_text=(true|false)/);

        const borders = bordersMatch ? (bordersMatch[1] === 'true') : true;
        const center = centerMatch ? (centerMatch[1] === 'true') : true;
        const centerText = centerTextMatch ? (centerTextMatch[1] === 'true') : false;

        tblCount++;
        const label = `Table ${tblCount}`;
        if (id) {
            map[id] = { label, type: 'table', num: tblCount };
        }

        let tableClasses = ['table-container'];
        if (!borders) tableClasses.push('no-borders');
        if (center) {
            tableClasses.push('center-table');
        } else {
            tableClasses.push('left-table');
        }
        if (centerText) tableClasses.push('center-text-table');

        const captionHtml = `<div ${id ? `id="${id}"` : ''} class="table-caption" style="text-align:center; margin: 1.5em 0 0.5em 0; font-weight:500;"><strong>${label}</strong>${caption ? `: ${caption}` : ''}</div>`;
        return `\n\n<div class="${tableClasses.join(' ')}">\n\n${captionHtml}\n\n${tableBlock}\n\n</div>\n\n`;
    });

    // Pattern B (Legacy): Table: Caption {#id}
    content = content.replace(/^Table:\s*(.*?)\s*\{([^}]+)\}/gm, (match, caption, attrs) => {
        const idMatch = attrs.match(/#([a-zA-Z0-9_\-]+)/) || attrs.match(/id=([a-zA-Z0-9_\-]+)/);
        let id = idMatch ? idMatch[1] : '';

        const bordersMatch = attrs.match(/borders=(true|false)/);
        const centerMatch = attrs.match(/center=(true|false)/);
        const centerTextMatch = attrs.match(/center_text=(true|false)/);

        const borders = bordersMatch ? (bordersMatch[1] === 'true') : true;
        const center = centerMatch ? (centerMatch[1] === 'true') : true;
        const centerText = centerTextMatch ? (centerTextMatch[1] === 'true') : false;

        tblCount++;
        const label = `Table ${tblCount}`;
        if (id) {
            map[id] = { label, type: 'table', num: tblCount };
        }

        let tableClasses = ['table-container'];
        if (!borders) tableClasses.push('no-borders');
        if (center) {
            tableClasses.push('center-table');
        } else {
            tableClasses.push('left-table');
        }
        if (centerText) tableClasses.push('center-text-table');

        const captionHtml = `<div ${id ? `id="${id}"` : ''} class="table-caption" style="text-align:center; margin: 1em 0; font-weight:500;"><strong>${label}</strong>: ${caption}</div>`;
        return `\n\n<div class="${tableClasses.join(' ')}">\n\n${captionHtml}\n\n</div>\n\n`;
    });

    // Helper to pre-render KaTeX to HTML so we bypass the markdown math pipeline
    const renderKatexBlock = (mathContent, id, eqNum, align = 'center') => {
        try {
            const rendered = katex.renderToString(mathContent.trim() + `\\tag{${eqNum}}`, {
                displayMode: true,
                throwOnError: false,
            });
            const alignClass = align === 'left' ? 'align-left' : 'align-center';
            return `\n<div id="${id}" class="labeled-equation katex-display ${alignClass}">${rendered}</div>\n`;
        } catch (e) {
            const alignClass = align === 'left' ? 'align-left' : 'align-center';
            return `\n<div id="${id}" class="labeled-equation katex-display ${alignClass}"><span class="katex-error">${mathContent}\\tag{${eqNum}}</span></div>\n`;
        }
    };

    // 3. Equations:
    // Style A: $$ ... $$ {#id} or $$ ... $${#id}
    content = content.replace(/\$\$([\s\S]*?)\$\$\s*\{([^}]+)\}/g, (match, math, attrs) => {
        const idMatch = attrs.match(/#([a-zA-Z0-9_\-]+)/) || attrs.match(/id=([a-zA-Z0-9_\-]+)/);
        if (!idMatch) return match;
        const id = idMatch[1];

        const alignMatch = attrs.match(/align=(center|left)/);
        const align = alignMatch ? alignMatch[1] : 'center';

        eqCount++;
        const label = `Equation ${eqCount}`;
        map[id] = { label, type: 'equation', num: eqCount };
        return renderKatexBlock(math, id, eqCount, align);
    });

    // Style B: $ ... $ {#id} or $ ... ${#id}
    content = content.replace(/\$([^$\n]+?)\$\s*\{([^}]+)\}/g, (match, math, attrs) => {
        const idMatch = attrs.match(/#([a-zA-Z0-9_\-]+)/) || attrs.match(/id=([a-zA-Z0-9_\-]+)/);
        if (!idMatch) return match;
        const id = idMatch[1];

        const alignMatch = attrs.match(/align=(center|left)/);
        const align = alignMatch ? alignMatch[1] : 'center';

        eqCount++;
        const label = `Equation ${eqCount}`;
        map[id] = { label, type: 'equation', num: eqCount };
        return renderKatexBlock(math, id, eqCount, align);
    });

    // Style C (Legacy): $$ ... \label{id} ... $$
    content = content.replace(/\$\$([\s\S]*?)\\label\{([a-zA-Z0-9_\-]+)\}([\s\S]*?)\$\$/g, (match, before, id, after) => {
        eqCount++;
        const label = `Equation ${eqCount}`;
        map[id] = { label, type: 'equation', num: eqCount };
        return renderKatexBlock(before + after, id, eqCount);
    });

    // 4. Resolve Citations: [type@id]
    // Renders ONLY the numeric ID for figures, tables, and equations
    content = content.replace(/\[(figure|table|equation)@([a-zA-Z0-9_\-]+)\]/g, (match, type, id) => {
        if (map[id]) {
            return `[${map[id].num}](#${id})`;
        }
        return `[?${type}@${id}?]`;
    });

    return { content, map };
};

const MarkdownSection = ({ title, content, offset, dirHandle, onUpdateContent, activeAccentColor, fullContent, metadata, projectMetadata }) => {
    const [isOpen, setIsOpen] = useState(true);

    // Custom components with offset-aware checkbox logic
    const components = {
        img: ({ node, ...props }) => <AsyncImage {...props} dirHandle={dirHandle} metadata={metadata} projectMetadata={projectMetadata} />,

        input: ({ node, ...props }) => {
            if (props.type === 'checkbox') {
                return (
                    <input
                        type="checkbox"
                        checked={props.checked}
                        disabled={!onUpdateContent}
                        onChange={(e) => {
                            if (onUpdateContent && node && node.position) {
                                // Adjust local line number to global line number
                                const localLineIndex = node.position.start.line - 1;
                                const globalLineIndex = localLineIndex + offset;

                                const lines = fullContent.split('\n');

                                // Robust finding mechanism using global index
                                let targetIndex = globalLineIndex;
                                let found = false;

                                // Check direct match
                                if (lines[targetIndex] && lines[targetIndex].match(/^(\s*[-*+]\s+)\[([ xX])\]/)) {
                                    found = true;
                                }
                                // Search window +/- 2 lines if position is slightly off
                                else {
                                    for (let searchOffset = -2; searchOffset <= 2; searchOffset++) {
                                        const idx = globalLineIndex + searchOffset;
                                        if (idx >= 0 && idx < lines.length && lines[idx].match(/^(\s*[-*+]\s+)\[([ xX])\]/)) {
                                            targetIndex = idx;
                                            found = true;
                                            break;
                                        }
                                    }
                                }

                                if (found) {
                                    const line = lines[targetIndex];
                                    const match = line.match(/^(\s*[-*+]\s+)\[([ xX])\]/);
                                    if (match) {
                                        const prefix = match[1];
                                        const current = match[2];
                                        const newStatus = current === ' ' ? 'x' : ' ';
                                        lines[targetIndex] = line.replace(/^(\s*[-*+]\s+)\[([ xX])\]/, `${prefix}[${newStatus}]`);
                                        onUpdateContent(lines.join('\n'));
                                    }
                                }
                            }
                        }}
                        style={{ cursor: onUpdateContent ? 'pointer' : 'default', margin: '0 0.2rem 0.2rem 0', verticalAlign: 'middle', accentColor: activeAccentColor }}
                    />
                );
            }
            return <input {...props} />;
        },
        del: ({ node, ...props }) => <span {...props} style={{ textDecoration: 'none' }} />
    };

    if (title === null) {
        // Preamble (no header)
        if (!content.trim()) return null;
        return (
            <div className="prose preamble">
                <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[[rehypeRaw, { passThrough: ['math', 'inlineMath'] }], rehypeKatex]}
                    components={components}
                >
                    {content}
                </ReactMarkdown>
            </div>
        );
    }

    const isCollapsible = projectMetadata?.collapsibleSections;

    if (!isCollapsible) {
        return (
            <div className="markdown-section-wrapper">
                <h1 className="section-h1-title" style={{ marginTop: '2rem' }}>{title}</h1>
                <div className="prose section-content">
                    <ReactMarkdown
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[[rehypeRaw, { passThrough: ['math', 'inlineMath'] }], rehypeKatex]}
                        components={components}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            </div>
        );
    }

    return (
        <div className="markdown-section-wrapper">
            <div
                className="section-collapsible-trigger"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    '--hover-accent': activeAccentColor
                }}
            >
                <div style={{ color: activeAccentColor }}>
                    {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
                <h1 className="section-h1-title" style={{ margin: 0 }}>{title}</h1>
            </div>
            {isOpen && (
                <div className="prose section-content">
                    <ReactMarkdown
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[[rehypeRaw, { passThrough: ['math', 'inlineMath'] }], rehypeKatex]}
                        components={components}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
};

function MarkdownPreview({ content, metadata, projectMetadata, dirHandle, mode, onUpdateContent, onUpdateMetadata, paperView, isEditingNote, isEditingIdea }) {
    const [coverOpen, setCoverOpen] = useState(true);
    const [tocOpen, setTocOpen] = useState(true);

    const { title, authors, author, abstract, subtitle, showToC } = metadata || {};

    let displayAuthors = null;
    if (authors && Array.isArray(authors)) {
        displayAuthors = authors.map(a => {
            if (typeof a === 'object' && a !== null) return a.name || JSON.stringify(a);
            return a;
        }).join(', ');
    } else if (author) {
        displayAuthors = typeof author === 'object' ? (author.name || JSON.stringify(author)) : author;
    }

    const projectFormatEnabled = !isEditingNote && !isEditingIdea && (metadata?.useProjectFormat !== false);

    const isResearch = projectFormatEnabled && mode === 'researcher';
    const isEngineer = projectFormatEnabled && mode === 'engineer';
    const isScript = projectFormatEnabled && mode === 'scriptwriter';
    const isScholar = projectFormatEnabled && mode === 'scholar';
    const isJournalist = projectFormatEnabled && mode === 'journalist';

    // Parse headers for Table of Contents
    const parseHeaders = (md) => {
        if (!md) return [];
        const lines = md.split('\n');
        const headers = [];
        lines.forEach(line => {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                headers.push({
                    level: match[1].length,
                    text: match[2].trim()
                });
            }
        });
        return headers;
    };

    const toc = parseHeaders(content);

    let renderedAuthors;
    if ((isResearch || isEngineer) && authors && Array.isArray(authors)) {
        renderedAuthors = (
            <div className={isEngineer ? "eng-authors-grid" : "paper-authors-block"}>
                {authors.map((a, i) => {
                    const name = typeof a === 'object' ? (a.name || 'Unknown') : a;
                    const aff = typeof a === 'object' ? (a.affiliation || a.company || '') : '';
                    const email = typeof a === 'object' ? a.email : '';

                    return (
                        <div key={i} className={isEngineer ? "eng-author-entry" : "paper-author-entry"}>
                            <span className={isEngineer ? "eng-author-name" : "paper-author-name"}>{name}</span>
                            {aff && <span className={isEngineer ? "eng-author-aff" : "paper-author-aff"}>{aff}</span>}
                            {email && <span className={isEngineer ? "eng-author-email" : "paper-author-email"}>{email}</span>}
                        </div>
                    );
                })}
            </div>
        );
    } else {
        renderedAuthors = displayAuthors && <div className="preview-authors">By {displayAuthors}</div>;
    }

    // Helper to safely render values as children (prevents crash on Date objects)
    const safeRender = (val) => {
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return val.toLocaleDateString();
        if (typeof val === 'object' && !Array.isArray(val)) return JSON.stringify(val);
        return val;
    };

    const safeDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val.toLocaleDateString();
        return val;
    };

    const { client, projectNumber, date, revision, checkedBy, approvedBy, basedOn, contact, profession, course, showCover, objectives, accentColor } = metadata || {};

    const activeAccentColor = accentColor || '#9747ff';

    const displayDate = safeDate(date) || new Date().toLocaleDateString();

    const toggleObjective = (index) => {
        if (!objectives || !onUpdateMetadata) return;

        const newObjectives = [...objectives];
        const current = newObjectives[index];
        // Check if starts with [x] or [X]
        const isChecked = /^\[[xX]\]\s+/.test(current);

        if (isChecked) {
            newObjectives[index] = current.replace(/^\[[xX]\]\s+/, '');
        } else {
            newObjectives[index] = `[x] ${current}`;
        }

        onUpdateMetadata({ ...metadata, objectives: newObjectives });
    };

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
            : '151, 71, 255'; // Default
    };

    // Load Bibliography
    const [bibData, setBibData] = useState({});

    useEffect(() => {
        const loadBib = async () => {
            if (!dirHandle) return;
            if (!metadata?.useReferences) {
                setBibData({});
                return;
            }
            try {
                // referencesFile is the document-specific file name (defaults to references.bib)
                const bibFilename = metadata?.referencesFile || 'references.bib';
                
                // We always look it up inside the "references" folder.
                let referencesDirHandle;
                try {
                    referencesDirHandle = await dirHandle.getDirectoryHandle('references');
                } catch (err) {
                    // Fallback to project root if directory doesn't exist
                    referencesDirHandle = dirHandle;
                }

                // If user entered e.g. "references/foo.bib", we resolve the subfolders.
                const parts = bibFilename.split('/');
                let currentHandle = referencesDirHandle;
                
                for (let i = 0; i < parts.length - 1; i++) {
                    if (parts[i] === 'references' && i === 0) {
                        // Skip redundant leading "references/" if they put it anyway
                        continue;
                    }
                    currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
                }
                
                const filename = parts[parts.length - 1];
                const fileHandle = await currentHandle.getFileHandle(filename);
                const file = await fileHandle.getFile();
                const text = await file.text();
                setBibData(parseBibTex(text));
            } catch (e) {
                console.warn('Failed to load bibliography file:', e);
                setBibData({});
            }
        };
        loadBib();
    }, [dirHandle, metadata?.useReferences, metadata?.referencesFile]);

    // Process citations in content
    // Replace [@Key] or [cite@Key] with citation
    const { contentWithCitations, citedKeys } = React.useMemo(() => {
        const enableReferences = metadata?.useReferences;
        if (!content || !enableReferences) {
            return { contentWithCitations: content || '', citedKeys: new Set() };
        }

        const useAPA = metadata?.useAPA !== false;
        const keys = new Set();
        const newContent = content
            .replace(/\[textcite@([a-zA-Z0-9_\-]+)\]/g, (match, key) => {
                keys.add(key);
                return formatCitation(key, bibData[key], 'narrative', useAPA);
            })
            .replace(/\[cite@([a-zA-Z0-9_\-]+)\]/g, (match, key) => {
                keys.add(key);
                return formatCitation(key, bibData[key], 'parenthetical', useAPA);
            })
            .replace(/\[text@([a-zA-Z0-9_\-]+)\]/g, (match, key) => {
                keys.add(key);
                return formatCitation(key, bibData[key], 'narrative', useAPA);
            })
            .replace(/\[@([a-zA-Z0-9_\-]+)\]/g, (match, key) => {
                keys.add(key);
                return formatCitation(key, bibData[key], 'parenthetical', useAPA);
            });

        return { contentWithCitations: newContent, citedKeys: keys };
    }, [content, bibData, metadata?.useReferences, metadata?.useAPA]);

    // Process Internal References (Figures, Tables, Equations)
    // Process Internal References (Figures, Tables, Equations)
    const { content: contentWithInternalRefs } = React.useMemo(() => {
        return processReferences(contentWithCitations);
    }, [contentWithCitations]);

    const sections = React.useMemo(() => splitByH1(contentWithInternalRefs), [contentWithInternalRefs]);

    return (
        <div
            className={`panel-preview ${paperView ? 'paper-view-active' : ''} ${isResearch ? 'research-mode' : ''} ${isEngineer ? 'engineer-mode' : ''} ${isScript ? 'script-mode' : ''} ${isScholar ? 'scholar-mode' : ''} ${isJournalist ? 'journalist-mode' : ''}`}
            style={{

                '--scholar-accent': activeAccentColor,
                '--scholar-accent-rgb': hexToRgb(activeAccentColor)
            }}
        >
            <div className={`preview-content ${isResearch ? 'paper-layout' : ''} ${isEngineer ? 'eng-report-layout' : ''} ${isScript ? 'script-layout' : ''} ${isScholar ? 'scholar-lecture-layout' : ''} ${isJournalist ? 'journal-layout' : ''}`} style={{
                ...(projectMetadata?.previewFont ? { fontFamily: projectMetadata.previewFont } : {}),
                ...(projectMetadata?.previewFontSize ? { fontSize: `${projectMetadata.previewFontSize}px` } : {}),
                ...(projectMetadata?.previewTextAlign ? { textAlign: projectMetadata.previewTextAlign } : {})
            }}>

                {/* Engineer Cover Page */}
                {isEngineer && (
                    <div className={`collapsible-section ${coverOpen ? 'open' : ''}`}>
                        <div className="section-header" onClick={() => setCoverOpen(!coverOpen)}>
                            {coverOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>COVER PAGE</span>
                        </div>
                        {coverOpen && (
                            <header className="eng-cover-page">
                                <div className="eng-client-block">
                                    <span className="label">CLIENT:</span>
                                    <span className="value">{client || '---'}</span>
                                </div>
                                <div className="eng-title-block">
                                    <h1 className="eng-report-title">{title || 'CALCULATION REPORT'}</h1>
                                </div>
                                <div className="eng-meta-grid">
                                    <div className="eng-meta-item">
                                        <span className="label">PROJECT NO:</span>
                                        <span className="value">{projectNumber || '---'}</span>
                                    </div>
                                    <div className="eng-meta-item">
                                        <span className="label">DATE:</span>
                                        <span className="value">{displayDate}</span>
                                    </div>
                                    <div className="eng-meta-item">
                                        <span className="label">REVISION:</span>
                                        <span className="value">{revision || 'Rev 0'}</span>
                                    </div>
                                </div>
                                <div className="eng-team-section">
                                    <h3>PREPARED BY:</h3>
                                    {renderedAuthors}
                                </div>
                                <div className="eng-approval-grid">
                                    <div className="approval-col">
                                        <span className="label">CHECKED BY</span>
                                        <span className="signature-line"></span>
                                        <span className="value">{checkedBy || '---'}</span>
                                    </div>
                                    <div className="approval-col">
                                        <span className="label">APPROVED BY</span>
                                        <span className="signature-line"></span>
                                        <span className="value">{approvedBy || '---'}</span>
                                    </div>
                                </div>
                                {abstract && (
                                    <div className="eng-summary-block">
                                        <h3>EXECUTIVE SUMMARY</h3>
                                        <p>{abstract}</p>
                                    </div>
                                )}

                            </header>
                        )}
                    </div>
                )}

                {/* Scriptwriter Cover Page */}
                {isScript && (
                    <div className={`collapsible-section ${coverOpen ? 'open' : ''}`}>
                        <div className="section-header" onClick={() => setCoverOpen(!coverOpen)}>
                            {coverOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>COVER PAGE</span>
                        </div>
                        {coverOpen && (
                            <header className="script-cover-page">
                                <div className="script-title-container">
                                    <h1 className="script-title">{title || 'UNTITLED SCRIPT'}</h1>
                                    {author && (
                                        <div className="script-author-block">
                                            <span>written by</span>
                                            <p className="script-author-name">{author}</p>
                                        </div>
                                    )}
                                    {basedOn && (
                                        <div className="script-based-block">
                                            <span>based on</span>
                                            <p>{basedOn}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="script-footer-info">
                                    {date && <div className="script-date">{safeDate(date)}</div>}
                                    {contact && <div className="script-contact">{contact}</div>}
                                </div>

                            </header>
                        )}
                    </div>
                )}

                {/* Scholar Cover Page */}
                {isScholar && showCover !== false && (
                    <div className={`collapsible-section ${coverOpen ? 'open' : ''}`}>
                        <div className="section-header" onClick={() => setCoverOpen(!coverOpen)}>
                            {coverOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>COURSE COVER</span>
                        </div>
                        {coverOpen && (
                            <header className="scholar-cover-page">
                                <div className="scholar-course-tag">{course || 'COURSE NAME'}</div>
                                <h1 className="scholar-lecture-title">{title || 'LECTURE NOTES'}</h1>
                                <div className="scholar-meta-info">
                                    <div className="meta-item">
                                        <span className="label">STUDENT</span>
                                        <span className="value">{displayAuthors || ''}</span>
                                    </div>
                                    <div className="meta-item">
                                        <span className="label">DATE</span>
                                        <span className="value">{displayDate}</span>
                                    </div>
                                </div>
                                {objectives && objectives.length > 0 && (
                                    <div className="scholar-objectives-preview">
                                        <span className="label" style={{ display: 'block', marginBottom: 15, fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>LECTURE OBJECTIVES</span>
                                        <div className="scholar-checklist">
                                            {objectives.map((obj, i) => {
                                                const isChecked = /^\[[xX]\]\s+/.test(obj);
                                                const displayText = obj.replace(/^\[[xX]\]\s+/, '');

                                                return (
                                                    <div
                                                        key={i}
                                                        className={`checklist-item ${isChecked ? 'checked' : ''}`}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: onUpdateMetadata ? 'pointer' : 'default' }}
                                                        onClick={() => toggleObjective(i)}
                                                    >
                                                        <div style={{
                                                            width: 18,
                                                            height: 18,
                                                            border: `2px solid ${activeAccentColor}`,
                                                            borderRadius: 4,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            background: isChecked ? activeAccentColor : 'transparent',
                                                            transition: 'all 0.2s'
                                                        }}>
                                                            {isChecked && <div style={{ width: 6, height: 10, borderBottom: '2px solid white', borderRight: '2px solid white', transform: 'rotate(45deg)', marginTop: -2 }}></div>}
                                                        </div>
                                                        <span style={{ fontSize: '1rem', textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.7 : 1 }}>
                                                            {displayText}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                            </header>
                        )}
                    </div>
                )}

                {/* Journalist Cover/Header */}
                {isJournalist && (
                    <div className={`collapsible-section ${coverOpen ? 'open' : ''}`}>
                        <div className="section-header" onClick={() => setCoverOpen(!coverOpen)}>
                            {coverOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>PRESS HEADER</span>
                        </div>
                        {coverOpen && (
                            <header className="journal-header">
                                <div className="journal-meta-top">
                                    <span className="journal-dateline">{date ? safeDate(date) : new Date().toLocaleDateString()}</span>
                                    <span className="journal-category">PRESS RELEASE / NEWS</span>
                                </div>
                                <h1 className="journal-title">{safeRender(title) || 'UNTITLED ARTICLE'}</h1>
                                {subtitle && <p className="journal-subtitle">{safeRender(subtitle)}</p>}
                                <div className="journal-byline">
                                    <div className="byline-info">
                                        <span className="by">By </span>
                                        <span className="journalist-name">{displayAuthors || 'Anonymous'}</span>
                                        {profession && <span className="journalist-profession">, {safeRender(profession)}</span>}
                                    </div>
                                </div>
                            </header>
                        )}
                    </div>
                )}

                {/* Table of Contents (Engineer Mode) */}
                {isEngineer && showToC !== false && toc.length > 0 && (
                    <div className={`collapsible-section ${tocOpen ? 'open' : ''}`} style={{ marginTop: coverOpen ? 0 : 20 }}>
                        <div className="section-header" onClick={() => setTocOpen(!tocOpen)}>
                            {tocOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <List size={14} style={{ marginLeft: 5 }} />
                            <span>CONTENTS</span>
                        </div>
                        {tocOpen && (
                            <div className="toc-block">
                                <h2 style={{ fontSize: '1.2rem', marginBottom: 20 }}>Table of Contents</h2>
                                <div className="toc-list">
                                    {toc.map((h, i) => (
                                        <div
                                            key={i}
                                            className={`toc-item level-${h.level}`}
                                            style={{
                                                marginLeft: (h.level - 1) * 20,
                                                fontSize: h.level === 1 ? '1rem' : '0.9rem',
                                                fontWeight: h.level === 1 ? 700 : 400,
                                                marginBottom: 8,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                borderBottom: '1px dotted #ccc',
                                                paddingBottom: 2
                                            }}
                                        >
                                            <span className="toc-text">{h.text}</span>
                                            <span className="toc-dots"></span>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        )}
                    </div>
                )}

                {!isEngineer && !isScript && !isScholar && !isJournalist && (title || displayAuthors || abstract || subtitle) && (
                    <header className="preview-header">
                        {title && <h1 className={`preview-title ${isResearch ? 'paper-title' : ''}`}>{safeRender(title)}</h1>}
                        {subtitle && <p className="preview-subtitle">{safeRender(subtitle)}</p>}
                        {renderedAuthors}
                        {profession && <div className="preview-profession">{safeRender(profession)}</div>}
                        {date && <div className="preview-date">{safeDate(date)}</div>}
                        {abstract && (
                            <div className="preview-abstract">
                                <span className="preview-abstract-label">Abstract</span>
                                {safeRender(abstract)}
                            </div>
                        )}
                    </header>
                )}

                <div className="preview-markdown-body">
                    {sections.map((section, idx) => (
                        <MarkdownSection
                            key={idx}
                            title={section.title}
                            content={section.lines.join('\n')}
                            offset={section.startLine}
                            dirHandle={dirHandle}
                            onUpdateContent={onUpdateContent}
                            activeAccentColor={activeAccentColor}
                            fullContent={content}
                            metadata={metadata}
                            projectMetadata={projectMetadata}
                        />
                    ))}

                    {/* References Section */}
                    {(metadata?.useReferences ?? metadata?.showReferences) && (
                        <ReferenceList bibData={bibData} citedKeys={citedKeys} useAPA={metadata?.useAPA !== false} />
                    )}
                </div>
            </div>
        </div>
    );
}

export function PreviewWrapper({ settings, content, metadata, projectMetadata, dirHandle, mode, paperView, onUpdateContent, onUpdateMetadata, activeTab, onTabChange, improvementData, onApplyImprovement, onRetryImprovement, editorSelection, onAddComment, onReplyComment, onResolveComment, onDeleteComment, commentPositions, editorScrollTop, hasNotesDir, notesList, onFileSelect, currentFilename, hasIdeasDir, isEditingNote, isEditingIdea, currentFileContent }) {

    // Default to visualization if no tab provided
    const currentTab = activeTab || 'visualization';

    // Auto-switch away from graph tabs when context changes
    React.useEffect(() => {
        if (currentTab === 'graph' && !isEditingNote) {
            onTabChange && onTabChange('visualization');
        }
        if (currentTab === 'ideas-graph' && !isEditingIdea) {
            onTabChange && onTabChange('visualization');
        }
        
        const aiGlobal = settings?.ai || {};
        const isAiEnabled = aiGlobal.enabled;
        const isImprovementsEnabled = aiGlobal.improvements?.enabled !== false;
        if (currentTab === 'improvements' && (!isAiEnabled || !isImprovementsEnabled)) {
            onTabChange && onTabChange('visualization');
        }
    }, [isEditingNote, isEditingIdea, currentTab, onTabChange, settings]);

    const aiGlobal = settings?.ai || {};
    const isAiEnabled = aiGlobal.enabled;
    const isImprovementsEnabled = aiGlobal.improvements?.enabled !== false;
    const showImprovements = isAiEnabled && isImprovementsEnabled;

    return (
        <div className="preview-container-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)' }}>
            {/* Tabs Header */}
            <div className="preview-tabs-header" style={{
                display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-app)', padding: '0 8px'
            }}>
                <TabButton
                    active={currentTab === 'visualization'}
                    onClick={() => onTabChange && onTabChange('visualization')}
                    icon={<FileText size={16} />}
                    label="Preview"
                />
                {hasNotesDir && isEditingNote && (
                    <TabButton
                        active={currentTab === 'graph'}
                        onClick={() => onTabChange && onTabChange('graph')}
                        icon={<Network size={16} />}
                        label="Notes Graph"
                    />
                )}
                {hasIdeasDir && isEditingIdea && (
                    <TabButton
                        active={currentTab === 'ideas-graph'}
                        onClick={() => onTabChange && onTabChange('ideas-graph')}
                        icon={<Lightbulb size={16} />}
                        label="Ideas Graph"
                    />
                )}
                {showImprovements && (
                    <TabButton
                        active={currentTab === 'improvements'}
                        onClick={() => onTabChange && onTabChange('improvements')}
                        icon={<Sparkles size={16} />}
                        label="Improvements"
                    />
                )}
                <TabButton
                    active={currentTab === 'comments'}
                    onClick={() => onTabChange && onTabChange('comments')}
                    icon={<MessageSquare size={16} />}
                    label="Comments"
                />
            </div>

            {/* Content Area */}
            <div className="preview-tab-content" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {/* Visualization Tab */}
                <div style={{
                    height: '100%', overflowY: 'auto',
                    display: currentTab === 'visualization' ? 'block' : 'none'
                }}>
                    <MarkdownPreview
                        content={content}
                        metadata={metadata}
                        projectMetadata={projectMetadata}
                        dirHandle={dirHandle}
                        mode={mode}
                        paperView={paperView}
                        onUpdateContent={onUpdateContent}
                        onUpdateMetadata={onUpdateMetadata}
                        isEditingNote={isEditingNote}
                        isEditingIdea={isEditingIdea}
                    />
                </div>

                {/* Notes Graph Tab */}
                {currentTab === 'graph' && hasNotesDir && isEditingNote && (
                    <NotesGraph
                        notesList={notesList || []}
                        onFileSelect={onFileSelect}
                        currentFilename={currentFilename}
                    />
                )}

                {/* Ideas Graph Tab */}
                {currentTab === 'ideas-graph' && hasIdeasDir && isEditingIdea && (
                    <IdeasGraph
                        content={currentFileContent || ''}
                    />
                )}

                {/* Improvements Tab */}
                {currentTab === 'improvements' && (
                    <ImprovementPanel
                        data={improvementData}
                        onAccept={() => onApplyImprovement && onApplyImprovement(improvementData.originalText, improvementData.improvedText)}
                        onRetry={(text, type) => onRetryImprovement && onRetryImprovement(text, type)}
                        onReject={() => onTabChange && onTabChange('visualization')}
                    />
                )}

                {/* Comments Tab */}
                {currentTab === 'comments' && (
                    <CommentsPanel
                        selection={editorSelection}
                        comments={projectMetadata?.comments || []}
                        onReply={onReplyComment}
                        onResolve={onResolveComment}
                        onDelete={onDeleteComment}
                        commentPositions={commentPositions}
                        editorScrollTop={editorScrollTop}
                    />
                )}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px',
                border: 'none', background: 'transparent',
                borderBottom: active ? '2px solid var(--accent-color)' : '2px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: active ? 1 : 0.7,
                fontSize: '0.85rem'
            }}
        >
            {icon} <span>{label}</span>
        </button>
    )
}

function ImprovementPanel({ data, onAccept, onRetry, onReject }) {
    const [retryType, setRetryType] = useState(null);

    if (!data) return null;

    if (data.status === 'loading') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-secondary)' }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: '0.9rem' }}>Rewriting as <strong>{data.type}</strong>...</div>
            </div>
        );
    }

    if (data.status === 'error') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-secondary)', padding: '0 24px', textAlign: 'center' }}>
                <XIcon size={32} style={{ color: '#ff4757', opacity: 0.7 }} />
                <div style={{ fontSize: '0.9rem' }}>Error: {data.error}</div>
                <button onClick={onRetry} style={{ marginTop: 8, padding: '6px 16px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>Try Again</button>
            </div>
        );
    }

    if (data.status === 'idle' && !data.originalText) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-secondary)', padding: '0 24px', textAlign: 'center' }}>
                <Sparkles size={32} style={{ opacity: 0.3 }} />
                <div style={{ fontSize: '0.9rem' }}>Select text in the editor, then click <strong>Improve</strong> to see AI suggestions here.</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.6 }}>You can choose from: Formality, Coherence, Longer, Shorter</div>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                Original Text
            </div>
            <div style={{
                padding: '12px', background: 'var(--bg-app)', borderRadius: '8px',
                border: '1px solid var(--border-color)', fontSize: '0.9rem', lineHeight: '1.6',
                color: 'var(--text-secondary)', marginBottom: 20, textDecoration: 'line-through', opacity: 0.7
            }}>
                {data.originalText}
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: 8, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Improved Version — {data.type}</span>
                <Sparkles size={14} />
            </div>
            <div style={{
                padding: '14px', background: 'var(--bg-panel)', borderRadius: '8px',
                border: '1.5px solid var(--accent-color)', fontSize: '0.9rem', lineHeight: '1.6',
                color: 'var(--text-primary)', marginBottom: 20
            }}>
                {data.improvedText}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={onAccept} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    height: 36, border: 'none', borderRadius: 8,
                    background: 'var(--accent-color)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
                }}>
                    <Check size={16} /> Accept
                </button>
                <button onClick={onReject} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    height: 36, border: '1px solid #ff4757', borderRadius: 8,
                    background: 'transparent', color: '#ff4757', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
                }}>
                    <XIcon size={16} /> Reject
                </button>
            </div>

            {/* Retry With Different Type */}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                Try Another Style
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Formality', 'Coherence', 'Longer', 'Shorter'].map(type => (
                    <button
                        key={type}
                        onClick={() => onRetry && onRetry(data.originalText, type.toLowerCase())}
                        style={{
                            padding: '5px 14px', borderRadius: 6, fontSize: '0.82rem',
                            border: type.toLowerCase() === data.type ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                            background: type.toLowerCase() === data.type ? 'var(--bg-app)' : 'transparent',
                            color: type.toLowerCase() === data.type ? 'var(--accent-color)' : 'var(--text-secondary)',
                            cursor: 'pointer', fontWeight: 500
                        }}
                    >
                        <RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {type}
                    </button>
                ))}
            </div>
        </div>
    )
}

function CommentsPanel({ selection, comments, onReply, onResolve, onDelete, commentPositions, editorScrollTop }) {
    const scrollContainerRef = useRef(null);

    // Sync scroll with editor
    useEffect(() => {
        if (scrollContainerRef.current && editorScrollTop !== undefined) {
            scrollContainerRef.current.scrollTop = editorScrollTop;
        }
    }, [editorScrollTop]);

    const openComments = (comments || []).filter(c => c.status !== 'resolved');
    const resolvedComments = (comments || []).filter(c => c.status === 'resolved');

    // Anti-overlap: position cards so they don't overlap
    const MIN_GAP = 8;
    const CARD_MIN_HEIGHT = 120;

    const positioned = useMemo(() => {
        if (!commentPositions || commentPositions.length === 0) return [];
        const result = [];
        let lastBottom = -Infinity;

        for (const cp of commentPositions) {
            let y = cp.y;
            if (y < lastBottom + MIN_GAP) {
                y = lastBottom + MIN_GAP;
            }
            result.push({ ...cp, renderY: y });
            lastBottom = y + CARD_MIN_HEIGHT;
        }
        return result;
    }, [commentPositions]);

    const totalHeight = positioned.length > 0
        ? Math.max(positioned[positioned.length - 1].renderY + CARD_MIN_HEIGHT + 200, 2000)
        : 0;

    const hasPositions = positioned.length > 0;

    return (
        <div className="comments-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {comments.length} Comment{comments.length !== 1 ? 's' : ''}
            </div>

            {comments.length === 0 && (
                <div className="empty-state" style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0 16px' }}>
                    <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <div>No comments yet</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Select text in editor to add one</div>
                </div>
            )}

            {/* Positioned comments - scroll-synced with editor */}
            {hasPositions && (
                <div
                    ref={scrollContainerRef}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        position: 'relative',
                    }}
                >
                    <div style={{ position: 'relative', height: totalHeight, padding: '0 10px' }}>
                        {positioned.map(p => (
                            <PositionedCommentCard
                                key={p.id}
                                comment={p.comment}
                                top={p.renderY}
                                anchorY={p.y}
                                onReply={onReply}
                                onResolve={onResolve}
                                onDelete={onDelete}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Fallback: flat list when no positions are available */}
            {!hasPositions && openComments.length > 0 && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {openComments.map(c => (
                        <CommentCard
                            key={c.id}
                            comment={c}
                            onReply={onReply}
                            onResolve={onResolve}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}

            {/* Resolved comments section - collapsible */}
            {resolvedComments.length > 0 && (
                <ResolvedSection
                    resolvedComments={resolvedComments}
                    onReply={onReply}
                    onResolve={onResolve}
                    onDelete={onDelete}
                />
            )}
        </div>
    )
}

function ResolvedSection({ resolvedComments, onReply, onResolve, onDelete }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700,
                    color: 'var(--text-secondary)', background: 'var(--bg-app)',
                    border: 'none', cursor: 'pointer', textAlign: 'left'
                }}
            >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {resolvedComments.length} Resolved
            </button>
            {isExpanded && (
                <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '8px 10px' }}>
                    {resolvedComments.map(c => (
                        <CommentCard
                            key={c.id}
                            comment={c}
                            onReply={onReply}
                            onResolve={onResolve}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PositionedCommentCard({ comment, top, anchorY, onReply, onResolve, onDelete }) {
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const showConnector = Math.abs(top - anchorY) > 4;

    return (
        <div style={{ position: 'absolute', top, left: 0, right: 0 }}>
            {/* Connector line from anchor Y to card Y */}
            {showConnector && (
                <div style={{
                    position: 'absolute',
                    left: 0,
                    top: anchorY < top ? -(top - anchorY) : 0,
                    width: 2,
                    height: Math.abs(top - anchorY),
                    background: 'rgba(255, 180, 0, 0.3)'
                }} />
            )}
            <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderLeft: '3px solid rgba(255, 180, 0, 0.8)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.85rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}>
                {/* Quoted selection */}
                <div style={{
                    fontSize: '0.78rem', color: 'var(--text-secondary)',
                    fontStyle: 'italic', marginBottom: 6,
                    borderLeft: '2px solid var(--border-color)', paddingLeft: 8,
                    maxHeight: 40, overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                    "{comment.selection && comment.selection.length > 50 ? comment.selection.substring(0, 50) + '...' : comment.selection}"
                </div>

                {/* Comment text */}
                <div style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: '0.9rem' }}>{comment.text}</div>

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                    <div style={{ paddingLeft: 10, borderLeft: '1px solid var(--border-color)', marginBottom: 8 }}>
                        {comment.replies.map(r => (
                            <div key={r.id} style={{ marginBottom: 6 }}>
                                <div style={{ fontSize: '0.85rem' }}>{r.text}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{new Date(r.date).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', opacity: 0.85 }}>
                    <button onClick={() => setIsReplying(!isReplying)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', fontWeight: 600, fontSize: '0.78rem', padding: 0 }}>
                        {isReplying ? 'Cancel' : 'Reply'}
                    </button>
                    <button onClick={() => onResolve && onResolve(comment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.78rem', padding: 0 }}>
                        Resolve
                    </button>
                    <button onClick={() => onDelete && onDelete(comment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.78rem', padding: 0, marginLeft: 'auto' }}>
                        <Trash2 size={12} />
                    </button>
                </div>

                {isReplying && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                        <input
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Reply..."
                            style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && replyText) {
                                    onReply && onReply(comment.id, replyText);
                                    setReplyText('');
                                    setIsReplying(false);
                                }
                            }}
                        />
                        <button onClick={() => { if (replyText) { onReply && onReply(comment.id, replyText); setReplyText(''); setIsReplying(false); } }} style={{ border: 'none', background: 'var(--accent-color)', color: 'white', borderRadius: 4, padding: '0 8px', cursor: 'pointer' }}>
                            <Send size={12} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function CommentCard({ comment, onReply, onResolve, onDelete }) {
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);

    const isResolved = comment.status === 'resolved';

    return (
        <div className="comment-card" style={{
            marginBottom: 12, padding: '10px 12px',
            background: isResolved ? 'var(--bg-app)' : 'var(--bg-panel)',
            borderRadius: '8px', border: '1px solid var(--border-color)',
            borderLeft: isResolved ? undefined : '3px solid rgba(255, 180, 0, 0.8)',
            opacity: isResolved ? 0.7 : 1
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isResolved ? 'var(--text-secondary)' : 'var(--accent-color)' }}>
                    {isResolved ? 'RESOLVED' : 'OPEN'}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{new Date(comment.date).toLocaleDateString()}</span>
                    <button onClick={() => onDelete && onDelete(comment.id)} title="Delete" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><Trash2 size={12} /></button>
                </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: 8, borderLeft: '2px solid var(--border-color)', marginBottom: 8, fontStyle: 'italic' }}>
                "{comment.selection && comment.selection.length > 50 ? comment.selection.substring(0, 50) + '...' : comment.selection}"
            </div>

            <div style={{ fontSize: '0.9rem', marginBottom: 10, color: 'var(--text-primary)' }}>{comment.text}</div>

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
                <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '1px solid var(--border-color)' }}>
                    {comment.replies.map(r => (
                        <div key={r.id} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: '0.85rem' }}>{r.text}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{new Date(r.date).toLocaleString()}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                {!isResolved && (
                    <button onClick={() => setIsReplying(!isReplying)} style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--accent-color)', fontWeight: 600 }}>
                        {isReplying ? 'Cancel' : 'Reply'}
                    </button>
                )}
                <button onClick={() => onResolve && onResolve(comment.id)} style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    {isResolved ? 'Re-open' : 'Resolve'}
                </button>
            </div>

            {isReplying && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Reply..."
                        style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && replyText) {
                                onReply(comment.id, replyText);
                                setReplyText('');
                                setIsReplying(false);
                            }
                        }}
                    />
                    <button onClick={() => {
                        if (replyText) {
                            onReply(comment.id, replyText);
                            setReplyText('');
                            setIsReplying(false);
                        }
                    }} style={{ border: 'none', background: 'var(--accent-color)', color: 'white', borderRadius: '4px', padding: '0 8px' }}><Send size={12} /></button>
                </div>
            )}
        </div>
    );
}



function AsyncImage({ src, alt, dirHandle, metadata, projectMetadata }) {
    const [imgSrc, setImgSrc] = useState(src);
    // Format: Alt Text|width=...|id=...|label=...
    let displayAlt = alt || '';
    let width = null;
    let id = null;
    let label = null;

    if (displayAlt) {
        // Simple parsing of pipe-separated key=value pairs
        if (displayAlt.includes('|')) {
            const parts = displayAlt.split('|');
            displayAlt = parts[0]; // First part is always clean alt

            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                if (part.startsWith('width=')) width = part.replace('width=', '');
                else if (part.startsWith('id=')) id = part.replace('id=', '');
                else if (part.startsWith('label=')) label = part.replace('label=', '');
            }
        }
    }

    // Caption Alignment: check metadata (file frontmatter) first, then projectMetadata
    const captionAlign = (metadata && metadata.captionAlignment) || (projectMetadata && projectMetadata.captionAlignment) || 'center';

    useEffect(() => {
        let objectUrl;
        const loadLocalImage = async () => {
            // Only attempt to load if we have a directory handle and it's not an external URL
            if (!dirHandle || !src || src.startsWith('http') || src.startsWith('blob:')) return;

            try {
                // Assume src is relative path like "figures/image.png"
                // We need to traverse the path relative to dirHandle
                const parts = src.split('/');
                let currentHandle = dirHandle;

                for (let i = 0; i < parts.length - 1; i++) {
                    currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
                }

                const fileHandle = await currentHandle.getFileHandle(parts[parts.length - 1]);
                const file = await fileHandle.getFile();
                objectUrl = URL.createObjectURL(file);
                setImgSrc(objectUrl);
            } catch (err) {
                console.warn('Failed to load local image:', src);
            }
        };

        loadLocalImage();

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [src, dirHandle]);

    return (
        <figure id={id} style={{ textAlign: 'center', width: '100%', margin: '1.5rem 0' }}>
            <img
                src={imgSrc}
                alt={displayAlt}
                className="rounded-lg shadow-md mx-auto"
                style={{
                    maxWidth: '100%',
                    width: width || 'auto'
                }}
            />
            {(displayAlt || label) && (
                <figcaption
                    className="text-sm text-gray-500 mt-2 italic"
                    style={{ textAlign: captionAlign }}
                >
                    {label && <strong>{label}: </strong>}
                    {displayAlt}
                </figcaption>
            )}
        </figure>
    );
}

export const Preview = React.memo(PreviewWrapper);

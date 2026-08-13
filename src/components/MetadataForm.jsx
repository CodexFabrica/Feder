import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Plus, X, Link2, Tag } from 'lucide-react';

function MetadataFormComponent({ metadata, onChange, mode, isNote, isIdea, notesList = [], bibFiles = [], currentFilename, projectMetadata }) {
    const enableReferences = projectMetadata?.enableReferences !== false;
    const [isExpanded, setIsExpanded] = useState(false);

    // States for notes features
    const [tagInput, setTagInput] = useState('');
    const [linkSearch, setLinkSearch] = useState('');
    const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        onChange({ ...metadata, [name]: value });
    };

    // Helper to safely render values or pass to inputs
    const safeStr = (val) => {
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return val.toLocaleDateString();
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    // Note tag handlers
    const handleAddTag = (e) => {
        if (e.key === 'Enter' || e.type === 'click') {
            e.preventDefault();
            const tag = tagInput.trim();
            if (tag) {
                const currentTags = metadata.tags || [];
                if (!currentTags.includes(tag)) {
                    onChange({ ...metadata, tags: [...currentTags, tag] });
                }
                setTagInput('');
            }
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        const currentTags = metadata.tags || [];
        onChange({ ...metadata, tags: currentTags.filter(t => t !== tagToRemove) });
    };

    const handleAddLink = (linkPath) => {
        const currentLinks = metadata.links || [];
        if (!currentLinks.includes(linkPath)) {
            onChange({ ...metadata, links: [...currentLinks, linkPath] });
        }
        setLinkSearch('');
        setLinkDropdownOpen(false);
    };

    const handleRemoveLink = (linkToRemove) => {
        const currentLinks = metadata.links || [];
        onChange({ ...metadata, links: currentLinks.filter(l => l !== linkToRemove) });
    };

    const handleAuthorChange = (index, field, value) => {
        const newAuthors = [...(metadata.authors || [])];
        if (!newAuthors[index]) newAuthors[index] = {};

        // Handle direct string authors if legacy
        if (typeof newAuthors[index] === 'string') {
            newAuthors[index] = { name: newAuthors[index] };
        }

        newAuthors[index][field] = value;
        onChange({ ...metadata, authors: newAuthors });
    };

    const addAuthor = () => {
        onChange({ ...metadata, authors: [...(metadata.authors || []), { name: '', affiliation: '', email: '' }] });
    };

    const removeAuthor = (index) => {
        const newAuthors = (metadata.authors || []).filter((_, i) => i !== index);
        onChange({ ...metadata, authors: newAuthors });
    };

    const handleObjectiveChange = (index, value) => {
        const newObjs = [...(metadata.objectives || [])];
        newObjs[index] = value;
        onChange({ ...metadata, objectives: newObjs });
    };

    const addObjective = () => {
        onChange({ ...metadata, objectives: [...(metadata.objectives || []), ''] });
    };

    const removeObjective = (index) => {
        const newObjs = (metadata.objectives || []).filter((_, i) => i !== index);
        onChange({ ...metadata, objectives: newObjs });
    };

    // Simplified form for ideas files
    if (isIdea) {
        return (
            <div className="metadata-panel compact note-metadata">
                <div className="metadata-header" onClick={() => setIsExpanded(!isExpanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '10px 14px' }}>
                    <span className="meta-summary" style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="note-indicator" style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '3px',
                            marginRight: 8,
                            background: 'var(--accent-color)',
                            boxShadow: '0 0 8px var(--accent-color)'
                        }} />
                        <strong>{safeStr(metadata.title) || 'Untitled Ideas'}</strong>
                        <span className="meta-pipe" style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                        <span className="meta-author" style={{ opacity: 0.7, fontSize: '0.8rem' }}>Ideas File</span>
                    </span>
                    <button className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>

                {isExpanded && (
                    <div className="form-grid compact-grid" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Title */}
                        <div className="form-group full-width" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ideas Title</label>
                            <input
                                type="text"
                                name="title"
                                value={safeStr(metadata.title)}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="Ideas Collection Title"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        {/* Tags */}
                        <div className="form-group full-width" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}><Tag size={12} /> Tags</label>
                            <div className="tags-container" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                {(metadata.tags || []).map(t => (
                                    <span key={t} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        background: 'rgba(150, 150, 150, 0.08)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px', padding: '2px 8px',
                                        fontSize: '0.75rem', color: 'var(--text-primary)'
                                    }}>
                                        #{t}
                                        <button onClick={() => handleRemoveTag(t)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                                {(metadata.tags || []).length === 0 && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No tags yet</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={handleAddTag}
                                    placeholder="Add new tag... (Press Enter)"
                                    className="form-input"
                                    style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                                />
                                <button onClick={handleAddTag} className="text-btn" style={{ padding: '0 10px', height: 32, background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                                    Add
                                </button>
                            </div>
                        </div>

                        {/* Info hint */}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', opacity: 0.7, lineHeight: 1.4 }}>
                            💡 Idea links are defined inline in your content using <code style={{ background: 'var(--bg-app)', padding: '1px 4px', borderRadius: 3 }}>[links: id1, id2]</code> notation. Switch to the Ideas Graph tab to see connections.
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (isNote) {
        // Strip "notes/" prefix to get relative path
        const currentRelPath = currentFilename ? currentFilename.replace(/^notes\//, '') : '';

        const filteredNotesToLink = notesList.filter(note => {
            const relPath = note.relPath;
            if (relPath.toLowerCase() === currentRelPath.toLowerCase()) return false;

            const query = linkSearch.toLowerCase();
            return note.title.toLowerCase().includes(query) || note.relPath.toLowerCase().includes(query);
        });

        const activeColor = metadata.color || null;

        return (
            <div className="metadata-panel compact note-metadata">
                <div className="metadata-header" onClick={() => setIsExpanded(!isExpanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '10px 14px' }}>
                    <span className="meta-summary" style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="note-indicator" style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            marginRight: 8,
                            background: activeColor || 'var(--accent-color)',
                            boxShadow: activeColor ? `0 0 10px ${activeColor}` : 'none'
                        }} />
                        <strong>{safeStr(metadata.title) || 'Untitled Note'}</strong>
                        <span className="meta-pipe" style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                        <span className="meta-author" style={{ opacity: 0.7, fontSize: '0.8rem' }}>Linked Note</span>
                    </span>
                    <button className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>

                {isExpanded && (
                    <div className="form-grid compact-grid" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Title */}
                        <div className="form-group full-width" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Note Title</label>
                            <input
                                type="text"
                                name="title"
                                value={safeStr(metadata.title)}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="Note Title"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        {/* Color Palette override */}
                        <div className="form-group full-width" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Note Color (Graph Highlight)</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                {[
                                    '#ff6b6b', // Coral Red
                                    '#fcc419', // Amber Yellow
                                    '#20c997', // Teal Green
                                    '#339af0', // Sky Blue
                                    '#f06595', // Pink Rose
                                    '#845ef7', // Violet
                                ].map(color => (
                                    <button
                                        key={color}
                                        onClick={() => onChange({ ...metadata, color })}
                                        style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            background: color,
                                            border: activeColor === color ? '2px solid var(--text-primary)' : '2px solid transparent',
                                            cursor: 'pointer',
                                            boxShadow: activeColor === color ? `0 0 8px ${color}` : 'var(--shadow-sm)',
                                            transition: 'all 0.15s'
                                        }}
                                        title={color}
                                    />
                                ))}
                                <button
                                    onClick={() => onChange({ ...metadata, color: null })}
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        background: 'var(--bg-app)',
                                        border: !activeColor ? '2px solid var(--text-primary)' : '2px solid var(--border-color)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                    title="Reset to default folder color"
                                >
                                    <span style={{
                                        position: 'absolute',
                                        width: '100%',
                                        height: 1.5,
                                        background: '#ff4757',
                                        transform: 'rotate(45deg)'
                                    }} />
                                </button>
                            </div>
                        </div>

                        {/* Tags list & editor */}
                        <div className="form-group full-width" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}><Tag size={12} /> Tags</label>

                            {/* Render Tag Pills */}
                            <div className="tags-container" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                {(metadata.tags || []).map(t => (
                                    <span key={t} style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        background: 'rgba(150, 150, 150, 0.08)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '2px 8px',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-primary)'
                                    }}>
                                        #{t}
                                        <button
                                            onClick={() => handleRemoveTag(t)}
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                cursor: 'pointer',
                                                padding: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                color: 'var(--text-secondary)'
                                            }}
                                        >
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                                {(metadata.tags || []).length === 0 && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No tags yet</span>
                                )}
                            </div>

                            {/* Tag Input */}
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={handleAddTag}
                                    placeholder="Add new tag... (Press Enter)"
                                    className="form-input"
                                    style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                                />
                                <button
                                    onClick={handleAddTag}
                                    className="text-btn"
                                    style={{ padding: '0 10px', height: 32, background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
                                >
                                    Add
                                </button>
                            </div>
                        </div>

                        {/* Linked Notes list & dropdown */}
                        <div className="form-group full-width" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}><Link2 size={12} /> Linked Notes (Obsidian Connections)</label>

                            {/* Render Link Cards */}
                            <div className="links-container" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
                                {(metadata.links || []).map(link => {
                                    const matchedNote = notesList.find(n => n.relPath.toLowerCase() === link.toLowerCase());
                                    const displayTitle = matchedNote ? matchedNote.title : link.split('/').pop().replace(/\.md$/, '');

                                    return (
                                        <div key={link} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: 'var(--bg-app)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            padding: '6px 10px',
                                            fontSize: '0.8rem'
                                        }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <Link2 size={12} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                                                <span style={{ fontWeight: 600 }}>{displayTitle}</span>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>({link})</span>
                                            </span>
                                            <button
                                                onClick={() => handleRemoveLink(link)}
                                                style={{
                                                    border: 'none',
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    color: '#ff4757',
                                                    marginLeft: 8
                                                }}
                                                title="Remove Connection"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                                {(metadata.links || []).length === 0 && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No links yet</span>
                                )}
                            </div>

                            {/* Link Notes Search dropdown */}
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    value={linkSearch}
                                    onChange={e => {
                                        setLinkSearch(e.target.value);
                                        setLinkDropdownOpen(true);
                                    }}
                                    onFocus={() => setLinkDropdownOpen(true)}
                                    placeholder="Search note to link..."
                                    className="form-input"
                                    style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                                />
                                {linkDropdownOpen && (
                                    <>
                                        <div
                                            style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 98 }}
                                            onClick={() => setLinkDropdownOpen(false)}
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            background: 'var(--bg-panel)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            boxShadow: 'var(--shadow-md)',
                                            maxHeight: '180px',
                                            overflowY: 'auto',
                                            zIndex: 99,
                                            marginTop: '4px'
                                        }}>
                                            {filteredNotesToLink.map(note => (
                                                <div
                                                    key={note.relPath}
                                                    onClick={() => handleAddLink(note.relPath)}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(150, 150, 150, 0.08)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    style={{
                                                        padding: '8px 12px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        borderBottom: '1px solid var(--border-color)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 2,
                                                        transition: 'background 0.15s'
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{note.title}</span>
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{note.relPath}</span>
                                                </div>
                                            ))}
                                            {filteredNotesToLink.length === 0 && (
                                                <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                    No match found
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="metadata-panel compact">
            <div className="metadata-header" onClick={() => setIsExpanded(!isExpanded)}>
                <span className="meta-summary">
                    <strong>{safeStr(metadata.title) || 'Untitled'}</strong>
                    <span className="meta-pipe"> | </span>
                    <span className="meta-author">
                        {(mode === 'researcher' || mode === 'engineer')
                            ? (metadata.authors ? metadata.authors.map(a => (typeof a === 'string' ? a : a.name)).join(', ') : 'No Authors')
                            : (mode === 'scholar' ? safeStr(metadata.author || 'Student') : safeStr(metadata.author || 'No Author'))
                        }
                    </span>
                </span>
                <button className="btn-icon">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {isExpanded && (
                <div className="form-grid compact-grid">
                    <div className="form-group full-width">
                        <label>Title</label>
                        <input
                            type="text"
                            name="title"
                            value={safeStr(metadata.title)}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="Document Title"
                        />
                    </div>

                    {mode === 'journalist' && (
                        <>
                            <div className="form-group full-width">
                                <label>Subtitle</label>
                                <input
                                    type="text"
                                    name="subtitle"
                                    value={safeStr(metadata.subtitle)}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Subtitle"
                                />
                            </div>
                            <div className="form-group">
                                <label>Author</label>
                                <input
                                    type="text"
                                    name="author"
                                    value={metadata.author || ''}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Author Name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Profession</label>
                                <input
                                    type="text"
                                    name="profession"
                                    value={metadata.profession || ''}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="e.g. Journalist, Reporter"
                                />
                            </div>
                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    type="text"
                                    name="date"
                                    value={safeStr(metadata.date)}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="YYYY-MM-DD"
                                />
                            </div>
                        </>
                    )}

                    {(mode === 'researcher' || mode === 'engineer') && (
                        <>
                            <div className="form-group full-width">
                                <label>{mode === 'engineer' ? 'Engineers / Authors' : 'Authors'}</label>
                                <div className="authors-list">
                                    {(metadata.authors || [{ name: '', affiliation: '', email: '' }]).map((author, idx) => {
                                        const authName = typeof author === 'string' ? author : author.name || '';
                                        const authAff = author.affiliation || '';
                                        const authEmail = author.email || '';
                                        return (
                                            <div key={idx} className="author-entry" style={{ marginBottom: 10, padding: 8, background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 4, position: 'relative' }}>
                                                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                                    <input
                                                        type="text"
                                                        value={authName}
                                                        onChange={(e) => handleAuthorChange(idx, 'name', e.target.value)}
                                                        className="form-input"
                                                        placeholder={`Author ${idx + 1}`}
                                                        style={{ flex: 1 }}
                                                    />
                                                    <button
                                                        onClick={() => removeAuthor(idx)}
                                                        className="btn-icon small remove-author-btn"
                                                        title="Remove Author"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                                    <input
                                                        type="text"
                                                        value={authAff}
                                                        onChange={(e) => handleAuthorChange(idx, 'affiliation', e.target.value)}
                                                        className="form-input small"
                                                        placeholder={mode === 'engineer' ? "Department" : "Affiliation"}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={authEmail}
                                                        onChange={(e) => handleAuthorChange(idx, 'email', e.target.value)}
                                                        className="form-input small"
                                                        placeholder="Email"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <button onClick={addAuthor} className="text-btn smaller">+ Add Author</button>
                                </div>
                            </div>

                            {mode === 'engineer' && (
                                <>
                                    <div className="form-group">
                                        <label>Client</label>
                                        <input
                                            type="text"
                                            name="client"
                                            value={metadata.client || ''}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="Client Name"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Project Number</label>
                                        <input
                                            type="text"
                                            name="projectNumber"
                                            value={metadata.projectNumber || ''}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="ENG-2024-001"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Date</label>
                                        <input
                                            type="text"
                                            name="date"
                                            value={safeStr(metadata.date)}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="YYYY-MM-DD"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Revision</label>
                                        <input
                                            type="text"
                                            name="revision"
                                            value={metadata.revision || ''}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="Rev 0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Table of Contents</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 35 }}>
                                            <label className="switch small">
                                                <input
                                                    type="checkbox"
                                                    name="showToC"
                                                    checked={metadata.showToC ?? true}
                                                    onChange={(e) => onChange({ ...metadata, showToC: e.target.checked })}
                                                />
                                                <span className="slider round"></span>
                                            </label>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Enable ToC</span>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Checked By</label>
                                        <input
                                            type="text"
                                            name="checkedBy"
                                            value={metadata.checkedBy || ''}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="Verifier Name"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Approved By</label>
                                        <input
                                            type="text"
                                            name="approvedBy"
                                            value={metadata.approvedBy || ''}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="Approver Name"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="form-group full-width">
                                <label>{mode === 'engineer' ? 'Summary' : 'Abstract'}</label>
                                <textarea
                                    name="abstract"
                                    value={safeStr(metadata.abstract)}
                                    onChange={handleChange}
                                    rows={2}
                                    className="form-input"
                                    placeholder={mode === 'engineer' ? "Executive summary of calculations..." : "Abstract..."}
                                />
                            </div>
                        </>
                    )}

                    {mode === 'scriptwriter' && (
                        <>
                            <div className="form-group full-width">
                                <label>Writer</label>
                                <input
                                    type="text"
                                    name="author"
                                    value={safeStr(metadata.author)}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Writer Name"
                                />
                            </div>
                            <div className="form-group full-width">
                                <label>Based On</label>
                                <input
                                    type="text"
                                    name="basedOn"
                                    value={metadata.basedOn || ''}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Based on the novel by..."
                                />
                            </div>
                            <div className="form-group">
                                <label>Draft Date</label>
                                <input
                                    type="text"
                                    name="date"
                                    value={safeStr(metadata.date)}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Draft Date"
                                />
                            </div>
                            <div className="form-group">
                                <label>Contact Info</label>
                                <textarea
                                    name="contact"
                                    value={metadata.contact || ''}
                                    onChange={handleChange}
                                    rows={3}
                                    className="form-input"
                                    placeholder="Agent / Contact Details"
                                />
                            </div>
                        </>
                    )}

                    {mode === 'scholar' && (
                        <>
                            <div className="form-group full-width">
                                <label>Course Name</label>
                                <input
                                    type="text"
                                    name="course"
                                    value={metadata.course || ''}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="e.g. Introduction to Physics"
                                />
                            </div>
                            <div className="form-group">
                                <label>Student Name</label>
                                <input
                                    type="text"
                                    name="author"
                                    value={metadata.author || ''}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Student Name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    type="text"
                                    name="date"
                                    value={safeStr(metadata.date)}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="YYYY-MM-DD"
                                />
                            </div>
                            <div className="form-group full-width">
                                <label>Lecture Objectives</label>
                                <div className="authors-list">
                                    {(metadata.objectives || ['']).map((obj, idx) => (
                                        <div key={idx} className="author-entry" style={{ marginBottom: 6, display: 'flex', gap: 6 }}>
                                            <input
                                                type="text"
                                                value={obj}
                                                onChange={(e) => handleObjectiveChange(idx, e.target.value)}
                                                className="form-input"
                                                placeholder={`Objective ${idx + 1}`}
                                                style={{ flex: 1 }}
                                            />
                                            <button
                                                onClick={() => removeObjective(idx)}
                                                className="btn-icon small remove-author-btn"
                                                title="Remove Objective"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={addObjective} className="text-btn smaller">+ Add Objective</button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Lecture Materials Cover</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 35 }}>
                                    <label className="switch small">
                                        <input
                                            type="checkbox"
                                            name="showCover"
                                            checked={metadata.showCover ?? true}
                                            onChange={(e) => onChange({ ...metadata, showCover: e.target.checked })}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Enable Cover</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Divider */}
                    <div style={{ gridColumn: 'span 2', borderBottom: '1px solid var(--border-color)', margin: '12px 0 6px 0' }} />

                    {/* Format Settings Section */}
                    <div className="form-group full-width" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px', background: 'rgba(150, 150, 150, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Format & Style</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 35 }}>
                            <label className="switch small">
                                <input
                                    type="checkbox"
                                    name="useProjectFormat"
                                    checked={metadata.useProjectFormat ?? true}
                                    onChange={(e) => onChange({ ...metadata, useProjectFormat: e.target.checked })}
                                />
                                <span className="slider round"></span>
                            </label>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>Enable Project Formatting Layout</span>
                        </div>
                    </div>

                    {/* References Section */}
                    <div className="form-group full-width" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', background: 'rgba(150, 150, 150, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: 6 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>References</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 35 }}>
                            <label className="switch small">
                                <input
                                    type="checkbox"
                                    name="useReferences"
                                    checked={metadata.useReferences ?? false}
                                    onChange={(e) => onChange({ ...metadata, useReferences: e.target.checked })}
                                />
                                <span className="slider round"></span>
                            </label>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>Enable References</span>
                        </div>

                        {(metadata.useReferences ?? false) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, borderLeft: '2px solid var(--accent-color)', paddingLeft: 10 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>References File Name (.bib)</label>
                                    <textarea
                                        name="referencesFile"
                                        value={metadata.referencesFile ?? 'references.bib'}
                                        onChange={handleChange}
                                        rows={1}
                                        placeholder="references.bib"
                                        className="form-input"
                                        style={{
                                            width: '100%',
                                            padding: '6px 10px',
                                            borderRadius: 4,
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-panel)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.82rem',
                                            resize: 'none',
                                            minHeight: '32px'
                                        }}
                                    />
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                                        Looked up in the <code>references/</code> directory.
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 35, marginTop: 4 }}>
                                    <label className="switch small">
                                        <input
                                            type="checkbox"
                                            name="useAPA"
                                            checked={metadata.useAPA ?? true}
                                            onChange={(e) => onChange({ ...metadata, useAPA: e.target.checked })}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>Add Reference Section</span>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
}

export const MetadataForm = React.memo(MetadataFormComponent);
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function MetadataForm({ metadata, onChange, mode }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        onChange({ ...metadata, [name]: value });
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

    return (
        <div className="metadata-panel compact">
            <div className="metadata-header" onClick={() => setIsExpanded(!isExpanded)}>
                <span className="meta-summary">
                    <strong>{metadata.title || 'Untitled'}</strong>
                    <span className="meta-pipe"> | </span>
                    <span className="meta-author">
                        {mode === 'researcher'
                            ? (metadata.authors ? metadata.authors.map(a => (typeof a === 'string' ? a : a.name)).join(', ') : 'No Authors')
                            : (metadata.author || 'No Author')
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
                            value={metadata.title || ''}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="Document Title"
                        />
                    </div>

                    {mode === 'journalist' && (
                        <>
                            <div className="form-group">
                                <label>Subtitle</label>
                                <input
                                    type="text"
                                    name="subtitle"
                                    value={metadata.subtitle || ''}
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
                        </>
                    )}

                    {mode === 'researcher' && (
                        <>
                            <div className="form-group full-width">
                                <label>Authors</label>
                                <div className="authors-list">
                                    {(metadata.authors || [{ name: '', affiliation: '', email: '' }]).map((author, idx) => {
                                        const authName = typeof author === 'string' ? author : author.name || '';
                                        const authAff = author.affiliation || '';
                                        const authEmail = author.email || '';
                                        return (
                                            <div key={idx} style={{ marginBottom: 10, padding: 8, background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 4 }}>
                                                <input
                                                    type="text"
                                                    value={authName}
                                                    onChange={(e) => handleAuthorChange(idx, 'name', e.target.value)}
                                                    className="form-input"
                                                    placeholder={`Author ${idx + 1}`}
                                                    style={{ marginBottom: 4, width: '100%' }}
                                                />
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                                    <input
                                                        type="text"
                                                        value={authAff}
                                                        onChange={(e) => handleAuthorChange(idx, 'affiliation', e.target.value)}
                                                        className="form-input small"
                                                        placeholder="Affiliation"
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
                            <div className="form-group full-width">
                                <label>Abstract</label>
                                <textarea
                                    name="abstract"
                                    value={metadata.abstract || ''}
                                    onChange={handleChange}
                                    rows={2}
                                    className="form-input"
                                    placeholder="Abstract..."
                                />
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

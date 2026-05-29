import React, { useState, useEffect } from 'react';
import { X, Monitor, AlignJustify, FolderOpen, MessageSquare, Trash2, Plus, User, Palette, Cpu, Layers } from 'lucide-react';

const PRESET_COLORS = [
  '#ff4d4d', // Coral Red
  '#ff944d', // Orange
  '#ffcc4d', // Gold
  '#e60000', // Deep Red
  '#33ccff', // Sky Blue
  '#3399ff', // Royal Blue
  '#5c5cff', // Indigo
  '#2eb8b8', // Deep Teal
  '#20c997', // Mint
  '#f06595', // Pink Rose
  '#845ef7', // Violet
  '#fcc419'  // Amber Yellow
];

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

export function SettingsModal({ onClose, metadata, onUpdate, mode, settings, onUpdateSettings }) {
    const [localMeta, setLocalMeta] = useState(metadata || {});
    const [localSettings, setLocalSettings] = useState(settings || {});
    const [activeCategory, setActiveCategory] = useState('project');

    // States for custom tags editor
    const [editingTagColorId, setEditingTagColorId] = useState(null);
    const [newTagNames, setNewTagNames] = useState({ major: '', minor: '', minor_formal: '' });
    const [newTagColors, setNewTagColors] = useState({ major: PRESET_COLORS[0], minor: PRESET_COLORS[4], minor_formal: PRESET_COLORS[8] });

    useEffect(() => {
        setLocalMeta(metadata || {});
    }, [metadata]);

    useEffect(() => {
        setLocalSettings(settings || {});
    }, [settings]);

    const handleChange = (key, value) => {
        const updated = { ...localMeta, [key]: value };
        setLocalMeta(updated);
        onUpdate(updated);
    };

    const handleAccountChange = (key, value) => {
        const updated = { ...localSettings, [key]: value };
        setLocalSettings(updated);
        if (onUpdateSettings) onUpdateSettings(updated);
    };

    const handlePluginToggle = (pluginKey, isEnabled) => {
        const currentPlugins = localMeta.plugins || { notes: true, ideas: true };
        const updatedPlugins = { ...currentPlugins, [pluginKey]: isEnabled };
        handleChange('plugins', updatedPlugins);
    };

    // Helper to read from settings.ai
    const getAIVal = (path, defaultValue) => {
        let source = localSettings.ai;
        if (!source) return defaultValue;

        let cursor = source;
        for (const key of path) {
            if (cursor == null || cursor[key] === undefined) return defaultValue;
            cursor = cursor[key];
        }
        return cursor ?? defaultValue;
    };

    const handleAIChange = (path, value) => {
        const updatedAI = { ...(localSettings.ai || {}) };
        let cursor = updatedAI;
        for (let i = 0; i < path.length - 1; i += 1) {
            const key = path[i];
            cursor[key] = { ...(cursor[key] || {}) };
            cursor = cursor[key];
        }
        cursor[path[path.length - 1]] = value;

        const updated = { ...localSettings, ai: updatedAI };
        setLocalSettings(updated);
        if (onUpdateSettings) onUpdateSettings(updated);
    };

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
            : '9, 132, 227';
    };

    const handleAccentColorChange = (color) => {
        handleChange('accentColor', color);
        document.documentElement.style.setProperty('--accent-color', color);
        document.documentElement.style.setProperty('--accent-color-rgb', hexToRgb(color));
    };

    const handleLinkColorChange = (color) => {
        handleChange('linkColor', color);
        document.documentElement.style.setProperty('--link-color', color);
    };

    const handleThemeChangeInSettings = (themeName) => {
        handleChange('theme', themeName);
        document.documentElement.classList.remove('dark', 'semi-dark', 'semi-light');
        if (themeName !== 'light') {
            document.documentElement.classList.add(themeName);
        }
    };

    // Tag Operations
    const handleAddTagInSettings = (groupKey) => {
        const name = (newTagNames[groupKey] || '').trim();
        if (!name) return;

        const currentTags = localMeta.commentTags || DEFAULT_COMMENT_TAGS;
        const newGroupTags = [
            ...(currentTags[groupKey] || []),
            {
                id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now().toString().slice(-4),
                label: name,
                color: newTagColors[groupKey] || PRESET_COLORS[0]
            }
        ];

        const updatedTags = {
            ...currentTags,
            [groupKey]: newGroupTags
        };

        handleChange('commentTags', updatedTags);
        setNewTagNames({ ...newTagNames, [groupKey]: '' });
    };

    const handleRemoveTagFromSettings = (groupKey, tagId) => {
        const currentTags = localMeta.commentTags || DEFAULT_COMMENT_TAGS;
        const newGroupTags = (currentTags[groupKey] || []).filter(t => t.id !== tagId);

        const updatedTags = {
            ...currentTags,
            [groupKey]: newGroupTags
        };

        handleChange('commentTags', updatedTags);
    };

    const handleUpdateTagColor = (groupKey, tagId, color) => {
        const currentTags = localMeta.commentTags || DEFAULT_COMMENT_TAGS;
        const newGroupTags = (currentTags[groupKey] || []).map(t => {
            if (t.id === tagId) {
                return { ...t, color };
            }
            return t;
        });

        const updatedTags = {
            ...currentTags,
            [groupKey]: newGroupTags
        };

        handleChange('commentTags', updatedTags);
    };

    // Sidebar Category Definition
    const categories = [
        { id: 'project', label: 'Project Settings', icon: <FolderOpen size={16} />, desc: 'Configure active workspace and files' },
        { id: 'account', label: 'Account Profile', icon: <User size={16} />, desc: 'Configure authoring and profile fields' },
        { id: 'appearance', label: 'Appearance', icon: <Palette size={16} />, desc: 'Customize visual accents, link colors, and modes' },
        { id: 'customizations', label: 'Peer Review Tags', icon: <MessageSquare size={16} />, desc: 'Manage annotations labels, colors, and groups' },
        { id: 'ai', label: 'AI Assistance', icon: <Cpu size={16} />, desc: 'Configure inline suggestions, key scopes, and prompts' },
        { id: 'plugins', label: 'Plugins & Performance', icon: <Layers size={16} />, desc: 'Enable modular graph indexes and optimize weight' }
    ];

    const currentCatObj = categories.find(c => c.id === activeCategory) || categories[0];
    const activeTitle = currentCatObj.label;
    const activeDesc = currentCatObj.desc;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content premium-modal sidebar-settings-layout" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <div className="header-title">
                        <h2>Settings</h2>
                        <span className="subtitle">Configure your global and project-specific preferences</span>
                    </div>
                    <button className="btn-close" onClick={onClose}><X size={20} /></button>
                </header>

                <div className="modal-body settings-flex-body">
                    {/* Left category navigation */}
                    <div className="settings-sidebar">
                        <div className="sidebar-group">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    className={`sidebar-nav-btn ${activeCategory === cat.id ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat.id)}
                                >
                                    {cat.icon}
                                    <span>{cat.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="sidebar-footer-version">
                            Feder Desktop v2.2.0
                        </div>
                    </div>

                    {/* Right settings content panel */}
                    <div className="settings-main-content">
                        <div className="settings-tab-header">
                            <h3>{activeTitle}</h3>
                            <p className="tab-desc-text">{activeDesc}</p>
                        </div>

                        {/* Category: Project Settings */}
                        {activeCategory === 'project' && (
                            <div className="settings-card-group">
                                <div className="settings-card">
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <span className="setting-name">Update Mode</span>
                                            <span className="setting-desc">Choose when the preview compiles</span>
                                        </div>
                                        <div className="segmented-control">
                                            <button
                                                className={localMeta.livePreview ? 'active' : ''}
                                                onClick={() => handleChange('livePreview', true)}
                                            > Live Update </button>
                                            <button
                                                className={!localMeta.livePreview ? 'active' : ''}
                                                onClick={() => handleChange('livePreview', false)}
                                            > On Save </button>
                                        </div>
                                    </div>
                                    <div className="setting-row" style={{ marginTop: 16 }}>
                                        <div className="setting-info">
                                            <span className="setting-name">Collapsible Sections</span>
                                            <span className="setting-desc">Allow folding section H1 tags in preview</span>
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={localMeta.collapsibleSections ?? false}
                                                onChange={(e) => handleChange('collapsibleSections', e.target.checked)}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                </div>

                                {mode === 'researcher' && (
                                    <div className="settings-card">
                                        <div className="setting-input-group">
                                            <label>Figures Subdirectory</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={localMeta.figuresFolder !== undefined ? localMeta.figuresFolder : 'figures'}
                                                onChange={e => handleChange('figuresFolder', e.target.value)}
                                                placeholder="figures"
                                            />
                                            <span className="setting-desc" style={{ marginTop: 4, display: 'block' }}>Directory where figures are automatically saved.</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Category: Account Profile */}
                        {activeCategory === 'account' && (
                            <div className="settings-card-group">
                                <div className="settings-card grid-two-cols">
                                    <div className="setting-input-group">
                                        <label>Full Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={localSettings.name || ''}
                                            onChange={e => handleAccountChange('name', e.target.value)}
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div className="setting-input-group">
                                        <label>Institutional Affiliation</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={localSettings.affiliation || ''}
                                            onChange={e => handleAccountChange('affiliation', e.target.value)}
                                            placeholder="Stanford University"
                                        />
                                    </div>
                                    <div className="setting-input-group">
                                        <label>Organization / Company</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={localSettings.company || ''}
                                            onChange={e => handleAccountChange('company', e.target.value)}
                                            placeholder="Stanford Lab"
                                        />
                                    </div>
                                    <div className="setting-input-group">
                                        <label>Role / Profession</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={localSettings.profession || ''}
                                            onChange={e => handleAccountChange('profession', e.target.value)}
                                            placeholder="Associate Professor"
                                        />
                                    </div>
                                    <div className="setting-input-group">
                                        <label>Professional Email</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={localSettings.email || ''}
                                            onChange={e => handleAccountChange('email', e.target.value)}
                                            placeholder="johndoe@university.edu"
                                        />
                                    </div>
                                    <div className="setting-input-group">
                                        <label>Phone Number</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={localSettings.phone || ''}
                                            onChange={e => handleAccountChange('phone', e.target.value)}
                                            placeholder="+1 (555) 019-2834"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Category: Appearance Customizer */}
                        {activeCategory === 'appearance' && (
                            <div className="settings-card-group">
                                <div className="settings-card">
                                    <h4 className="settings-card-title">Theme Mode</h4>
                                    <div className="theme-preset-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 8 }}>
                                        {[
                                            { id: 'light', label: 'Light App', bg: '#f4f5f7', color: '#2d3436' },
                                            { id: 'semi-light', label: 'Parchment', bg: '#f2eadf', color: '#3e2723' },
                                            { id: 'semi-dark', label: 'Twilight', bg: '#1e293b', color: '#f8fafc' },
                                            { id: 'dark', label: 'Deep Dark', bg: '#161b22', color: '#ecf0f1' }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => handleThemeChangeInSettings(t.id)}
                                                style={{
                                                    background: t.bg,
                                                    color: t.color,
                                                    border: (localMeta.theme || 'light') === t.id ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    padding: '12px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    boxShadow: 'var(--shadow-sm)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: 6
                                                }}
                                            >
                                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--accent-color)' }} />
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="settings-card">
                                    <div className="setting-input-group">
                                        <label>Active Accent Color</label>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                            {PRESET_COLORS.map(color => (
                                                <span
                                                    key={color}
                                                    onClick={() => handleAccentColorChange(color)}
                                                    style={{
                                                        width: 22, height: 22, borderRadius: '50%', background: color,
                                                        cursor: 'pointer', border: (localMeta.accentColor || '#0984e3') === color ? '2px solid var(--text-primary)' : '1px solid transparent',
                                                        boxShadow: '0 0 6px rgba(0,0,0,0.1)', display: 'inline-block'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="setting-input-group" style={{ marginTop: 16 }}>
                                        <label>Hyperlink Color</label>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                            {PRESET_COLORS.map(color => (
                                                <span
                                                    key={color}
                                                    onClick={() => handleLinkColorChange(color)}
                                                    style={{
                                                        width: 22, height: 22, borderRadius: '50%', background: color,
                                                        cursor: 'pointer', border: (localMeta.linkColor || '#0984e3') === color ? '2px solid var(--text-primary)' : '1px solid transparent',
                                                        boxShadow: '0 0 6px rgba(0,0,0,0.1)', display: 'inline-block'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="setting-input-group" style={{ marginTop: 16 }}>
                                        <label>Editor Font Size (px)</label>
                                        <input
                                            type="number"
                                            min="11"
                                            max="32"
                                            className="form-input"
                                            value={localMeta.editorFontSize || 14}
                                            onChange={e => handleChange('editorFontSize', Number(e.target.value))}
                                            style={{ width: '100px' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Category: Peer Review Tags */}
                        {activeCategory === 'customizations' && (
                            <div className="settings-card-group">
                                {['major', 'minor', 'minor_formal'].map(groupKey => {
                                    const groupTitle = groupKey === 'major' ? 'Major Comments' : groupKey === 'minor' ? 'Minor Comments' : 'Minor Formal Comments';
                                    const currentTags = localMeta.commentTags || DEFAULT_COMMENT_TAGS;
                                    const tagsInGroup = currentTags[groupKey] || [];

                                    return (
                                        <div className="settings-card" key={groupKey}>
                                            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase' }}>{groupTitle}</h4>
                                            
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                {tagsInGroup.map(tag => (
                                                    <div key={tag.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px', background: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                                                <span 
                                                                    style={{ width: 14, height: 14, borderRadius: '50%', background: tag.color, cursor: 'pointer', display: 'inline-block', border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }}
                                                                    onClick={() => setEditingTagColorId(editingTagColorId === tag.id ? null : tag.id)}
                                                                    title="Click to select a preset color"
                                                                />
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.label}</span>
                                                            </div>
                                                            <button 
                                                                onClick={() => handleRemoveTagFromSettings(groupKey, tag.id)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4757', display: 'flex', alignItems: 'center', padding: 0 }}
                                                                title="Delete Tag"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                        
                                                        {editingTagColorId === tag.id && (
                                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, padding: '6px', background: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                                                {PRESET_COLORS.map(color => (
                                                                    <span 
                                                                        key={color}
                                                                        onClick={() => {
                                                                            handleUpdateTagColor(groupKey, tag.id, color);
                                                                            setEditingTagColorId(null);
                                                                        }}
                                                                        style={{
                                                                            width: 15, height: 15, borderRadius: '50%', background: color,
                                                                            cursor: 'pointer', border: tag.color === color ? '1.5px solid var(--text-primary)' : '1px solid transparent',
                                                                            display: 'inline-block'
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {tagsInGroup.length === 0 && (
                                                    <div style={{ gridColumn: 'span 2', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '6px 0' }}>No tags defined in this category.</div>
                                                )}
                                            </div>

                                            {/* Add New Tag in Group */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, padding: '10px', background: 'rgba(150, 150, 150, 0.03)', borderRadius: '10px', border: '1px dashed var(--border-color)' }}>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <input 
                                                        type="text"
                                                        placeholder="New tag label..."
                                                        value={newTagNames[groupKey] || ''}
                                                        onChange={e => setNewTagNames({...newTagNames, [groupKey]: e.target.value})}
                                                        style={{ flex: 1, padding: '5px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleAddTagInSettings(groupKey); }}
                                                    />
                                                    <button 
                                                        onClick={() => handleAddTagInSettings(groupKey)}
                                                        style={{ padding: '0 12px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}
                                                    >
                                                        <Plus size={13} /> Add
                                                    </button>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tag Color:</span>
                                                    {PRESET_COLORS.map(color => (
                                                        <span 
                                                            key={color}
                                                            onClick={() => setNewTagColors({...newTagColors, [groupKey]: color})}
                                                            style={{
                                                                width: 14, height: 14, borderRadius: '50%', background: color,
                                                                cursor: 'pointer', border: (newTagColors[groupKey] || PRESET_COLORS[0]) === color ? '1.5px solid var(--text-primary)' : '1px solid transparent',
                                                                display: 'inline-block'
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Category: AI Assistance */}
                        {activeCategory === 'ai' && (
                            <div className="settings-card-group">
                                <div className="settings-card">
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <span className="setting-name">Enable AI Assistance</span>
                                            <span className="setting-desc">Toggles suggestions and text improvements</span>
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={getAIVal(['enabled'], false)}
                                                onChange={(e) => handleAIChange(['enabled'], e.target.checked)}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>

                                    {getAIVal(['enabled'], false) && (
                                        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                                            <div className="setting-row" style={{ marginBottom: 12 }}>
                                                <div className="setting-info">
                                                    <span className="setting-name" style={{ fontSize: '0.9rem' }}>Inline Suggestions</span>
                                                    <span className="setting-desc">Enables AI to write content dynamically as you type</span>
                                                </div>
                                                <label className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={getAIVal(['inlineSuggestions', 'enabled'], true)}
                                                        onChange={(e) => handleAIChange(['inlineSuggestions', 'enabled'], e.target.checked)}
                                                    />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row" style={{ marginBottom: 12 }}>
                                                <div className="setting-info">
                                                    <span className="setting-name" style={{ fontSize: '0.9rem' }}>Text Improvements</span>
                                                    <span className="setting-desc">Displays rewritten text tab recommendations in preview</span>
                                                </div>
                                                <label className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={getAIVal(['improvements', 'enabled'], true)}
                                                        onChange={(e) => handleAIChange(['improvements', 'enabled'], e.target.checked)}
                                                    />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {getAIVal(['enabled'], false) && (
                                    <div className="settings-card">
                                        <div className="setting-input-group">
                                            <label>Provider</label>
                                            <select
                                                value={getAIVal(['provider'], 'gemini')}
                                                onChange={(e) => handleAIChange(['provider'], e.target.value)}
                                                className="form-input"
                                            >
                                                <option value="gemini">Google Gemini</option>
                                                <option value="openai">OpenAI</option>
                                                <option value="ollama">Ollama (Local Host)</option>
                                            </select>
                                        </div>

                                        {getAIVal(['provider'], 'gemini') === 'gemini' && (
                                            <div style={{ marginTop: 12 }}>
                                                <div className="setting-input-group">
                                                    <label>Gemini API Key</label>
                                                    <input
                                                        type="password"
                                                        value={getAIVal(['gemini', 'apiKey'], '')}
                                                        onChange={(e) => handleAIChange(['gemini', 'apiKey'], e.target.value)}
                                                        placeholder="Enter your Gemini Key"
                                                        className="form-input"
                                                    />
                                                </div>
                                                <div className="setting-input-group" style={{ marginTop: 10 }}>
                                                    <label>AI Model</label>
                                                    <select
                                                        value={getAIVal(['gemini', 'model'], 'gemini-2.5-flash')}
                                                        onChange={(e) => handleAIChange(['gemini', 'model'], e.target.value)}
                                                        className="form-input"
                                                    >
                                                        <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                                                        <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                                                        <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {getAIVal(['provider'], 'gemini') === 'openai' && (
                                            <div style={{ marginTop: 12 }}>
                                                <div className="setting-input-group">
                                                    <label>OpenAI API Key</label>
                                                    <input
                                                        type="password"
                                                        value={getAIVal(['openai', 'apiKey'], '')}
                                                        onChange={(e) => handleAIChange(['openai', 'apiKey'], e.target.value)}
                                                        placeholder="Enter your OpenAI Key"
                                                        className="form-input"
                                                    />
                                                </div>
                                                <div className="setting-input-group" style={{ marginTop: 10 }}>
                                                    <label>AI Model</label>
                                                    <select
                                                        value={getAIVal(['openai', 'model'], 'gpt-4o-mini')}
                                                        onChange={(e) => handleAIChange(['openai', 'model'], e.target.value)}
                                                        className="form-input"
                                                    >
                                                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                                                        <option value="gpt-4o">gpt-4o</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {getAIVal(['provider'], 'gemini') === 'ollama' && (
                                            <div style={{ marginTop: 12 }}>
                                                <div className="setting-input-group">
                                                    <label>Server Base URL</label>
                                                    <input
                                                        type="text"
                                                        value={getAIVal(['ollama', 'baseUrl'], 'http://localhost:11434')}
                                                        onChange={(e) => handleAIChange(['ollama', 'baseUrl'], e.target.value)}
                                                        placeholder="http://localhost:11434"
                                                        className="form-input"
                                                    />
                                                </div>
                                                <div className="setting-input-group" style={{ marginTop: 10 }}>
                                                    <label>Local Model Name</label>
                                                    <input
                                                        type="text"
                                                        value={getAIVal(['ollama', 'model'], 'gemma3:4b')}
                                                        onChange={(e) => handleAIChange(['ollama', 'model'], e.target.value)}
                                                        placeholder="gemma3:4b"
                                                        className="form-input"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Category: Plug-and-Play Plugins */}
                        {activeCategory === 'plugins' && (
                            <div className="settings-card-group">
                                <div className="settings-card">
                                    <div className="setting-row">
                                        <div className="setting-info" style={{ flex: 1, paddingRight: 20 }}>
                                            <span className="setting-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                Linked Notes System
                                                <span style={{ fontSize: '0.65rem', background: 'rgba(32, 201, 151, 0.15)', color: '#20c997', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>MODULE</span>
                                            </span>
                                            <span className="setting-desc" style={{ marginTop: 4, display: 'block' }}>
                                                Recursively scans `/notes` directory to index tags, parse links, and map notes connections inside theverlet physics <strong>Notes Graph</strong> tab.
                                            </span>
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={(localMeta.plugins?.notes !== false)}
                                                onChange={(e) => handlePluginToggle('notes', e.target.checked)}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                </div>

                                <div className="settings-card">
                                    <div className="setting-row">
                                        <div className="setting-info" style={{ flex: 1, paddingRight: 20 }}>
                                            <span className="setting-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                Ideas connections
                                                <span style={{ fontSize: '0.65rem', background: 'rgba(32, 201, 151, 0.15)', color: '#20c997', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>MODULE</span>
                                            </span>
                                            <span className="setting-desc" style={{ marginTop: 4, display: 'block' }}>
                                                Bridges markdown files, parses inline `[links: id1, id2]` definitions, and renders dynamic connections in theverlet physics <strong>Ideas Graph</strong> tab.
                                            </span>
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={(localMeta.plugins?.ideas !== false)}
                                                onChange={(e) => handlePluginToggle('ideas', e.target.checked)}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                </div>

                                <div style={{
                                    background: 'rgba(9, 132, 227, 0.06)',
                                    border: '1px solid rgba(9, 132, 227, 0.15)',
                                    borderRadius: '12px',
                                    padding: '14px 18px',
                                    fontSize: '0.82rem',
                                    lineHeight: '1.5',
                                    color: 'var(--text-secondary)'
                                }}>
                                    💡 <strong>Performance Optimization:</strong> Disabling unused plugin systems immediately bypasses recursive file-system scanning, locks graph tab recalculations, and reduces CPU/Memory weight — significantly accelerating Feder's responsiveness on large workspaces.
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="modal-footer">
                    <button className="btn-primary" onClick={onClose}>Done</button>
                </footer>
            </div>

            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 3000;
                    animation: fadeIn 0.2s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .sidebar-settings-layout {
                    width: 780px !important;
                    height: 580px !important;
                    max-width: 95vw;
                    max-height: 90vh;
                    border-radius: 16px;
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-panel);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px var(--border-color);
                    overflow: hidden;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .modal-header {
                    padding: 16px 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--border-color);
                    flex-shrink: 0;
                }

                .header-title h2 {
                    margin: 0;
                    font-size: 1.2rem;
                    font-weight: 800;
                    color: var(--text-primary);
                }
                .header-title .subtitle {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .btn-close {
                    background: var(--hover-bg);
                    border: none;
                    color: var(--text-secondary);
                    padding: 6px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    transition: all 0.2s;
                }
                .btn-close:hover {
                    background: #ff4757;
                    color: white;
                }

                .settings-flex-body {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                    padding: 0 !important;
                }

                .settings-sidebar {
                    width: 210px;
                    background: var(--bg-app);
                    border-right: 1px solid var(--border-color);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: 16px 0;
                    flex-shrink: 0;
                }

                .sidebar-group {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }

                .sidebar-nav-btn {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 10px 18px;
                    background: transparent;
                    border: none;
                    border-left: 3px solid transparent;
                    color: var(--text-secondary);
                    font-weight: 500;
                    text-align: left;
                    cursor: pointer;
                    font-size: 0.82rem;
                    transition: all 0.15s ease;
                }

                .sidebar-nav-btn:hover {
                    background: var(--hover-bg);
                    color: var(--text-primary);
                }

                .sidebar-nav-btn.active {
                    background: var(--bg-panel);
                    color: var(--accent-color);
                    border-left: 3px solid var(--accent-color);
                    font-weight: 700;
                }

                .sidebar-footer-version {
                    padding: 0 18px;
                    font-size: 0.72rem;
                    color: var(--text-secondary);
                    opacity: 0.6;
                }

                .settings-main-content {
                    flex: 1;
                    padding: 24px 28px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    background: var(--bg-panel);
                }

                .settings-tab-header {
                    margin-bottom: 4px;
                }

                .settings-tab-header h3 {
                    margin: 0;
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: var(--text-primary);
                }

                .tab-desc-text {
                    margin: 2px 0 0 0;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .settings-card-group {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .settings-card {
                    background: var(--bg-app);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 16px;
                }

                .settings-card-title {
                    margin: 0 0 12px 0;
                    font-size: 0.85rem;
                    font-weight: 800;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .grid-two-cols {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }

                .setting-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 20px;
                }

                .setting-info {
                    display: flex;
                    flex-direction: column;
                }

                .setting-name {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .setting-desc {
                    font-size: 0.78rem;
                    color: var(--text-secondary);
                    line-height: 1.4;
                }

                .setting-input-group label {
                    display: block;
                    font-size: 0.82rem;
                    font-weight: 600;
                    margin-bottom: 6px;
                    color: var(--text-primary);
                }

                .form-input {
                    width: 100%;
                    padding: 8px 10px;
                    background: var(--bg-panel);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 0.85rem;
                    transition: border-color 0.2s;
                }

                .form-input:focus {
                    border-color: var(--accent-color);
                    outline: none;
                }

                .segmented-control {
                    display: flex;
                    background: var(--bg-panel);
                    padding: 3px;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                }

                .segmented-control button {
                    background: transparent;
                    border: none;
                    padding: 5px 12px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .segmented-control button.active {
                    background: var(--accent-color);
                    color: white;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
                }

                .modal-footer {
                    padding: 12px 24px;
                    display: flex;
                    justify-content: flex-end;
                    border-top: 1px solid var(--border-color);
                    flex-shrink: 0;
                    background: var(--bg-app);
                }

                .btn-primary {
                    background: var(--accent-color);
                    color: white;
                    border: none;
                    padding: 8px 24px;
                    border-radius: 8px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.85rem;
                }

                .btn-primary:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
                }

                /* Toggle switch styling */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 38px;
                    height: 20px;
                    flex-shrink: 0;
                }

                .switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: var(--border-color);
                    border: 1px solid rgba(0, 0, 0, 0.05);
                    transition: .3s;
                }

                .slider:before {
                    position: absolute;
                    content: "";
                    height: 14px;
                    width: 14px;
                    left: 2px;
                    bottom: 2px;
                    background-color: white;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                    transition: .3s;
                }

                input:checked + .slider {
                    background-color: var(--accent-color);
                    border-color: var(--accent-color);
                }

                input:checked + .slider:before {
                    transform: translateX(18px);
                }

                .slider.round {
                    border-radius: 20px;
                }

                .slider.round:before {
                    border-radius: 50%;
                }
            `}</style>
        </div>
    );
}

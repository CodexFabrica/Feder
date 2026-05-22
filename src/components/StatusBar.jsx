import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Zap, AlignCenter, AlignJustify, Save, Activity, Settings, X, Check, FileText, Square, HelpCircle, Palette, AlignLeft } from 'lucide-react';


export function StatusBar({
    settings,
    isAiThinking,
    projectMetadata,
    onOpenSettings, // Fallback to full settings
    onUpdateSettings, // New: Update global settings
    onUpdateProjectMetadata, // New: Update project metadata
    wordCount,
    paperView,
    onTogglePaperView,
    onCancelAi,
    previewFont,
    onFontChange
}) {

const FONT_OPTIONS = [
    { label: 'Crimson Pro', value: "'Crimson Pro', Georgia, serif" },
    { label: 'Inter', value: "'Inter', sans-serif" },
    { label: 'Lora', value: "'Lora', serif" },
    { label: 'Merriweather', value: "'Merriweather', serif" },
    { label: 'Source Serif 4', value: "'Source Serif 4', serif" },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Latin Modern Roman', value: '"Latin Modern Roman", serif' },
];

    const [showAiPanel, setShowAiPanel] = useState(false);
    const [showAppearanceMenu, setShowAppearanceMenu] = useState(false);
    const appearanceMenuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (appearanceMenuRef.current && !appearanceMenuRef.current.contains(event.target)) {
                setShowAppearanceMenu(false);
            }
        }
        if (showAppearanceMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showAppearanceMenu]);

    // Derived state
    const aiConfig = projectMetadata?.aiConfig || {};
    const aiGlobal = settings?.ai || {};

    const enabled = aiGlobal.enabled; // Toggle is still global for now (app feature)
    const provider = aiConfig.provider || 'gemini';
    const triggerMode = aiConfig.triggerMode || 'automatic';
    const debounceMs = aiConfig.debounceMs || 1000;

    // Config values from Project Meta
    const currentModel = aiConfig[provider]?.model || (provider === 'gemini' ? 'gemini-2.5-flash-lite (recommended)' : (provider === 'ollama' ? 'gemma3:4b (recommended)' : ''));
    const currentBaseUrl = aiConfig[provider]?.baseUrl || '';

    // Sensitive values from Global Settings
    const currentKey = aiGlobal[provider]?.apiKey || '';

    const handleTriggerModeChange = (val) => {
        onUpdateProjectMetadata({ ...projectMetadata, aiConfig: { ...aiConfig, triggerMode: val } });
    };

    const handleDebounceChange = (val) => {
        const ms = parseInt(val, 10);
        onUpdateProjectMetadata({ ...projectMetadata, aiConfig: { ...aiConfig, debounceMs: isNaN(ms) ? 1000 : ms } });
    };

    const handleProviderChange = (newProvider) => {
        onUpdateProjectMetadata({ ...projectMetadata, aiConfig: { ...aiConfig, provider: newProvider } });
    };

    const handleModelChange = (val) => {
        const updatedProviderConfig = { ...(aiConfig[provider] || {}), model: val };
        onUpdateProjectMetadata({ ...projectMetadata, aiConfig: { ...aiConfig, [provider]: updatedProviderConfig } });
    };

    const handleKeyChange = (val) => {
        const updatedAiGlobal = { ...aiGlobal, [provider]: { ...(aiGlobal[provider] || {}), apiKey: val } };
        onUpdateSettings({ ...settings, ai: updatedAiGlobal });
    };

    const handleUrlChange = (val) => {
        const updatedProviderConfig = { ...(aiConfig[provider] || {}), baseUrl: val };
        onUpdateProjectMetadata({ ...projectMetadata, aiConfig: { ...aiConfig, [provider]: updatedProviderConfig } });
    };

    const toggleAi = () => {
        onUpdateSettings({ ...settings, ai: { ...aiGlobal, enabled: !enabled } });
    };


    const toggleLivePreview = () => {
        if (!onUpdateProjectMetadata) return;
        onUpdateProjectMetadata({
            ...projectMetadata,
            livePreview: !projectMetadata.livePreview
        });
    };

    const toggleAlignment = () => {
        if (!onUpdateProjectMetadata) return;
        const current = projectMetadata.captionAlignment || 'center';
        const next = current === 'center' ? 'justify' : 'center';
        onUpdateProjectMetadata({
            ...projectMetadata,
            captionAlignment: next
        });
    };

    // Format provider name nicely
    const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

    const updateAppearance = (key, value) => {
        if (!onUpdateProjectMetadata) return;
        onUpdateProjectMetadata({
            ...projectMetadata,
            [key]: value
        });
    };

    const currentFontSize = projectMetadata?.previewFontSize || '16';
    const currentTextAlign = projectMetadata?.previewTextAlign || 'left';
    const currentCaptionAlign = projectMetadata?.captionAlignment || 'center';
    const currentAccentColor = projectMetadata?.accentColor || '#9747ff';

    const ACCENT_COLORS = [
        '#9747ff', // Default Purple
        '#ff6b6b', // Red
        '#20c997', // Green
        '#339af0', // Blue
        '#fcc419', // Yellow
        '#ff922b', // Orange
        '#f06595', // Pink
    ];
    const isLive = projectMetadata?.livePreview;
    const alignment = projectMetadata?.captionAlignment || 'center';

    return (
        <>
            {showAiPanel && (
                <div className="mini-panel-overlay" onClick={() => setShowAiPanel(false)} />
            )}
            <footer className="status-bar">
                <div className="status-group left">
                    <div className="status-item-container">
                        <div
                            className={`status-item ai-status ${isAiThinking ? 'thinking' : ''} ${!enabled ? 'disabled' : ''}`}
                            onClick={() => setShowAiPanel(!showAiPanel)}
                            title="Click to configure AI"
                        >
                            <div className="status-icon">
                                {isAiThinking ? (
                                    <Activity size={12} className="spin-slow" />
                                ) : (
                                    <Cpu size={12} />
                                )}
                            </div>
                            <span>
                                {isAiThinking ? 'Thinking...' :
                                    !enabled ? 'AI Off' :
                                        `AI: ${providerLabel}`}
                            </span>
                            {isAiThinking && (
                                <button
                                    className="cancel-ai-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCancelAi && onCancelAi();
                                    }}
                                    title="Stop Thinking"
                                >
                                    <Square size={6} fill="currentColor" />
                                </button>
                            )}
                        </div>

                        {showAiPanel && (
                            <div className="mini-panel-popup" onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <strong style={{ fontSize: '12px' }}>AI Configuration</strong>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button
                                            className="btn-icon-small"
                                            onClick={toggleAi}
                                            title={enabled ? "Disable AI" : "Enable AI"}
                                            style={{ color: enabled ? 'var(--accent-color)' : 'var(--text-secondary)' }}
                                        >
                                            <Zap size={14} fill={enabled ? "currentColor" : "none"} />
                                        </button>
                                        <button className="btn-icon-small" onClick={() => setShowAiPanel(false)}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                                    <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
                                        <label>Trigger Mode</label>
                                        <select value={triggerMode} onChange={e => handleTriggerModeChange(e.target.value)}>
                                            <option value="automatic">Automatic (On Stop)</option>
                                            <option value="manual">Manual (Ctrl+Space)</option>
                                        </select>

                                        {triggerMode === 'automatic' && (
                                            <div style={{ marginTop: 8 }}>
                                                <label>Wait Time (s)</label>
                                                <input
                                                    type="number"
                                                    value={(debounceMs || 1000) / 1000}
                                                    onChange={e => handleDebounceChange(Number(e.target.value) * 1000)}
                                                    step="0.1"
                                                    min="0.2"
                                                    max="5"
                                                    className="clean-number"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <label>Provider</label>
                                    <select value={provider} onChange={e => handleProviderChange(e.target.value)}>
                                        <option value="gemini">Google Gemini</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="ollama">Ollama (Local)</option>
                                    </select>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label>Model</label>
                                        {provider === 'ollama' && (
                                            <button
                                                className="btn-icon-small"
                                                onClick={() => {
                                                    const url = 'https://github.com/CodexFabrica/Feder/blob/main/docs/README_local_AI_assist.md';
                                                    if (window.electronAPI && window.electronAPI.openExternal) {
                                                        window.electronAPI.openExternal(url);
                                                    } else {
                                                        window.open(url, '_blank');
                                                    }
                                                }}
                                                title="Learn how to use local models"
                                                style={{ color: 'var(--accent-color)', padding: '0 4px' }}
                                            >
                                                <HelpCircle size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {provider === 'ollama' ? (
                                        <input
                                            type="text"
                                            value={currentModel}
                                            onChange={e => handleModelChange(e.target.value)}
                                            placeholder="e.g. gemma3:4b (recommended)"
                                        />
                                    ) : (
                                        <select
                                            value={currentModel}
                                            onChange={e => handleModelChange(e.target.value)}
                                        >
                                            {provider === 'gemini' && [
                                                'gemini-2.5-flash-lite (recommended)',
                                                'gemini-3-flash-preview',
                                                'gemini-3-pro-preview',
                                                'gemini-2.5-flash',
                                                'gemini-2.5-pro'
                                            ].map(m => <option key={m} value={m}>{m}</option>)}

                                            {provider === 'openai' && [
                                                'gpt-5.2-chat-latest',
                                                'gpt-5-1-chat-latest',
                                                'gpt-5-mini',
                                                'gpt-5-nano',
                                                'gpt-4.1-nano',
                                                'gpt-4o-mini',
                                                'gpt-4o'
                                            ].map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    )}

                                    {provider === 'ollama' ? (
                                        <>
                                            <label>Base URL</label>
                                            <input
                                                type="text"
                                                value={currentBaseUrl}
                                                onChange={e => handleUrlChange(e.target.value)}
                                                placeholder="http://localhost:11434"
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <label>API Key</label>
                                            <input
                                                type="password"
                                                value={currentKey}
                                                onChange={e => handleKeyChange(e.target.value)}
                                                placeholder="sk-..."
                                            />
                                        </>
                                    )}
                                </div>

                                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn-small" onClick={() => onOpenSettings && onOpenSettings()}>
                                        More Settings...
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>


                    <div
                        className="status-item clickable"
                        onClick={toggleLivePreview}
                        title="Click to toggle Live Preview"
                    >
                        {isLive ? <Zap size={12} color="var(--accent-color)" fill="currentColor" /> : <Save size={12} />}
                        <span>{isLive ? 'Live Preview' : 'Update on Save'}</span>
                    </div>
                </div>

                <div className="status-group right">
                    {onTogglePaperView && (
                        <div className="status-item clickable" onClick={onTogglePaperView} title="Toggle Paper View (White Background)">
                            <FileText size={12} color={paperView ? "var(--text-primary)" : "var(--text-secondary)"} />
                            <span>{paperView ? "Paper View ON" : "Paper View OFF"}</span>
                        </div>
                    )}

                    {/* Appearance Menu Dropdown */}
                    <div className="status-item file-menu-container" ref={appearanceMenuRef}>
                        <div className="status-item clickable" onClick={() => setShowAppearanceMenu(!showAppearanceMenu)} title="Appearance Settings" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Palette size={12} />
                            <span>Appearance</span>
                        </div>

                        {showAppearanceMenu && (
                            <div className="file-menu-dropdown appearance-dropdown" style={{ bottom: 'calc(100% + 10px)', top: 'auto', right: 0, padding: '16px', width: '280px', color: 'var(--text-primary)' }}>
                                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem' }}>Appearance Settings</div>
                                
                                {/* Font */}
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Preview Font</label>
                                    <select
                                        value={projectMetadata?.previewFont || "'Crimson Pro', Georgia, serif"}
                                        onChange={e => updateAppearance('previewFont', e.target.value)}
                                        className="form-input"
                                        style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
                                    >
                                        {FONT_OPTIONS.map(f => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Font Size */}
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Font Size ({currentFontSize}px)</label>
                                    <input 
                                        type="range" 
                                        min="12" 
                                        max="24" 
                                        value={currentFontSize} 
                                        onChange={e => updateAppearance('previewFontSize', e.target.value)}
                                        style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                                    />
                                </div>

                                {/* Text Alignment */}
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Text Alignment</label>
                                    <div className="segmented-control" style={{ display: 'flex', width: '100%' }}>
                                        <button 
                                            className={currentTextAlign === 'left' ? 'active' : ''} 
                                            onClick={() => updateAppearance('previewTextAlign', 'left')}
                                            style={{ flex: 1, display: 'flex', justifyContent: 'center' }}
                                            title="Left Align"
                                        >
                                            <AlignLeft size={14} />
                                        </button>
                                        <button 
                                            className={currentTextAlign === 'center' ? 'active' : ''} 
                                            onClick={() => updateAppearance('previewTextAlign', 'center')}
                                            style={{ flex: 1, display: 'flex', justifyContent: 'center' }}
                                            title="Center Align"
                                        >
                                            <AlignCenter size={14} />
                                        </button>
                                        <button 
                                            className={currentTextAlign === 'justify' ? 'active' : ''} 
                                            onClick={() => updateAppearance('previewTextAlign', 'justify')}
                                            style={{ flex: 1, display: 'flex', justifyContent: 'center' }}
                                            title="Justify"
                                        >
                                            <AlignJustify size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Caption Alignment */}
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Caption Alignment</label>
                                    <div className="segmented-control" style={{ display: 'flex', width: '100%' }}>
                                        <button 
                                            className={currentCaptionAlign === 'center' ? 'active' : ''} 
                                            onClick={() => updateAppearance('captionAlignment', 'center')}
                                            style={{ flex: 1 }}
                                        >
                                            Centered
                                        </button>
                                        <button 
                                            className={currentCaptionAlign === 'justify' ? 'active' : ''} 
                                            onClick={() => updateAppearance('captionAlignment', 'justify')}
                                            style={{ flex: 1 }}
                                        >
                                            Justified
                                        </button>
                                    </div>
                                </div>

                                {/* Accent Color */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Accent Color</label>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {ACCENT_COLORS.map(c => (
                                            <div
                                                key={c}
                                                onClick={() => updateAppearance('accentColor', c)}
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    backgroundColor: c,
                                                    cursor: 'pointer',
                                                    border: currentAccentColor === c ? '2px solid white' : '2px solid transparent',
                                                    boxShadow: currentAccentColor === c ? `0 0 0 2px ${c}` : 'none'
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {wordCount !== undefined && (
                        <div className="status-item">
                            <span>{wordCount} words</span>
                        </div>
                    )}

                    <div className="status-item" title="UTF-8">
                        <span>UTF-8</span>
                    </div>
                </div>
            </footer >
        </>
    );
}

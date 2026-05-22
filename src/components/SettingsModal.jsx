import React, { useState, useEffect } from 'react';
import { X, Monitor, AlignJustify, FolderOpen } from 'lucide-react';

export function SettingsModal({ onClose, metadata, onUpdate, mode, settings, onUpdateSettings }) {
    const [localMeta, setLocalMeta] = useState(metadata || {});
    const [localSettings, setLocalSettings] = useState(settings || {});

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

    // ALL AI settings go to global settings.ai (single source of truth)
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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content premium-modal" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <div className="header-title">
                        <h2>Project Settings</h2>
                        <span className="subtitle">Configure your workspace preferences</span>
                    </div>
                    <button className="btn-close" onClick={onClose}><X size={20} /></button>
                </header>

                <div className="modal-body">
                    {/* section: Visualization */}
                    <div className="settings-section">
                        <div className="section-label">
                            <Monitor size={16} />
                            <span>Visualization</span>
                        </div>
                        <div className="settings-card">
                            <div className="setting-row">
                                <div className="setting-info">
                                    <span className="setting-name">Update Mode</span>
                                    <span className="setting-desc">Choose when the preview refreshes</span>
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
                            {/* Collapsible Sections */}
                            <div className="setting-row" style={{ marginTop: 16 }}>
                                <div className="setting-info">
                                    <span className="setting-name">Collapsible Sections</span>
                                    <span className="setting-desc">Allow collapsing main sections (H1) in preview</span>
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
                    </div>

                    {/* section: AI Assist */}

                    <div className="settings-section">
                        <div className="section-label">
                            <AlignJustify size={16} />
                            <span>AI Assist</span>
                        </div>
                        <div className="settings-card">
                            {/* Enable/Disable */}
                            <div className="setting-row">
                                <div className="setting-info">
                                    <span className="setting-name">Enable AI Assistance</span>
                                    <span className="setting-desc">Inline suggestions and text improvements</span>
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
                                <div style={{ marginTop: 20 }}>
                                    <div className="setting-row" style={{ marginBottom: 16 }}>
                                        <div className="setting-info">
                                            <span className="setting-name" style={{ fontSize: '0.9rem' }}>Enable Text Improvements</span>
                                            <span className="setting-desc">Show improvements tab in preview panel</span>
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
                                    <div className="setting-row" style={{ marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
                                        <div className="setting-info">
                                            <span className="setting-name" style={{ fontSize: '0.9rem' }}>Enable Inline Suggestions</span>
                                            <span className="setting-desc">Allow AI to suggest text as you type</span>
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
                                    
                                    {/* Provider */}
                                    <div className="setting-input-group">
                                        <label>Provider</label>
                                        <select
                                            value={getAIVal(['provider'], 'gemini')}
                                            onChange={(e) => handleAIChange(['provider'], e.target.value)}
                                            className="form-input"
                                        >
                                            <option value="gemini">Google Gemini</option>
                                            <option value="openai">OpenAI</option>
                                            <option value="ollama">Ollama (Local)</option>
                                        </select>
                                    </div>

                                    {/* Gemini Config */}
                                    {getAIVal(['provider'], 'gemini') === 'gemini' && (
                                        <div style={{ marginTop: 12 }}>
                                            <div className="setting-input-group">
                                                <label>API Key</label>
                                                <input
                                                    type="password"
                                                    value={getAIVal(['gemini', 'apiKey'], '')}
                                                    onChange={(e) => handleAIChange(['gemini', 'apiKey'], e.target.value)}
                                                    placeholder="Enter your Gemini API Key"
                                                    className="form-input"
                                                />
                                            </div>
                                            <div className="setting-input-group" style={{ marginTop: 8 }}>
                                                <label>Model</label>
                                                <select
                                                    value={getAIVal(['gemini', 'model'], 'gemini-2.5-flash')}
                                                    onChange={(e) => handleAIChange(['gemini', 'model'], e.target.value)}
                                                    className="form-input"
                                                >
                                                    <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
                                                    <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Fast)</option>
                                                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* OpenAI Config */}
                                    {getAIVal(['provider'], 'gemini') === 'openai' && (
                                        <div style={{ marginTop: 12 }}>
                                            <div className="setting-input-group">
                                                <label>API Key</label>
                                                <input
                                                    type="password"
                                                    value={getAIVal(['openai', 'apiKey'], '')}
                                                    onChange={(e) => handleAIChange(['openai', 'apiKey'], e.target.value)}
                                                    placeholder="Enter your OpenAI API Key"
                                                    className="form-input"
                                                />
                                            </div>
                                            <div className="setting-input-group" style={{ marginTop: 8 }}>
                                                <label>Model</label>
                                                <select
                                                    value={getAIVal(['openai', 'model'], 'gpt-4o-mini')}
                                                    onChange={(e) => handleAIChange(['openai', 'model'], e.target.value)}
                                                    className="form-input"
                                                >
                                                    <option value="gpt-4o-mini">gpt-4o-mini (Recommended)</option>
                                                    <option value="gpt-4o">gpt-4o</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Ollama Config */}
                                    {getAIVal(['provider'], 'gemini') === 'ollama' && (
                                        <div style={{ marginTop: 12 }}>
                                            <div className="setting-input-group">
                                                <label>Server URL</label>
                                                <input
                                                    type="text"
                                                    value={getAIVal(['ollama', 'baseUrl'], 'http://localhost:11434')}
                                                    onChange={(e) => handleAIChange(['ollama', 'baseUrl'], e.target.value)}
                                                    placeholder="http://localhost:11434"
                                                    className="form-input"
                                                />
                                            </div>
                                            <div className="setting-input-group" style={{ marginTop: 8 }}>
                                                <label>Model</label>
                                                <input
                                                    type="text"
                                                    value={getAIVal(['ollama', 'model'], 'gemma3:4b')}
                                                    onChange={(e) => handleAIChange(['ollama', 'model'], e.target.value)}
                                                    placeholder="Model name (e.g., gemma3:4b)"
                                                    className="form-input"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Divider */}
                                    <div style={{ borderBottom: '1px solid var(--border-color)', margin: '20px 0' }}></div>

                                    {/* Inline Suggestion Parameters */}
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>
                                        Inline Suggestions
                                    </div>

                                    {/* Trigger Mode */}
                                    <div className="setting-input-group">
                                        <label>Trigger Mode</label>
                                        <div className="segmented-control" style={{ width: 'fit-content' }}>
                                            <button
                                                className={getAIVal(['triggerMode'], 'manual') === 'automatic' ? 'active' : ''}
                                                onClick={() => handleAIChange(['triggerMode'], 'automatic')}
                                            > Automatic </button>
                                            <button
                                                className={getAIVal(['triggerMode'], 'manual') === 'manual' ? 'active' : ''}
                                                onClick={() => handleAIChange(['triggerMode'], 'manual')}
                                            > Manual (Ctrl+Space) </button>
                                        </div>
                                        <span className="setting-desc" style={{ marginTop: 4, display: 'block' }}>
                                            {getAIVal(['triggerMode'], 'manual') === 'manual'
                                                ? "Press Ctrl+Space or click the ✨ button to trigger."
                                                : "Suggestions appear automatically when you pause typing."}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                                        <div className="setting-input-group" style={{ flex: 1 }}>
                                            <label>Max Words <span style={{ fontSize: '10px', opacity: 0.6 }}>(suggestion length)</span></label>
                                            <input
                                                type="number"
                                                min="3"
                                                max="80"
                                                value={getAIVal(['maxWords'], 12)}
                                                onChange={(e) => handleAIChange(['maxWords'], Number(e.target.value))}
                                                className="form-input clean-number"
                                            />
                                        </div>
                                        <div className="setting-input-group" style={{ flex: 1 }}>
                                            <label>Delay (s) <span style={{ fontSize: '10px', opacity: 0.6 }}>(auto mode)</span></label>
                                            <input
                                                type="number"
                                                min="0.3"
                                                max="5"
                                                step="0.1"
                                                value={getAIVal(['debounceMs'], 1500) / 1000}
                                                onChange={(e) => handleAIChange(['debounceMs'], Math.round(Number(e.target.value) * 1000))}
                                                className="form-input clean-number"
                                            />
                                        </div>
                                        <div className="setting-input-group" style={{ flex: 1 }}>
                                            <label>Temperature <span style={{ fontSize: '10px', opacity: 0.6 }}>(creativity)</span></label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="2"
                                                step="0.1"
                                                value={getAIVal(['temperature'], 0.7)}
                                                onChange={(e) => handleAIChange(['temperature'], Number(e.target.value))}
                                                className="form-input clean-number"
                                            />
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div style={{ borderBottom: '1px solid var(--border-color)', margin: '20px 0' }}></div>

                                    {/* Improvements - optional separate config */}
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>
                                        Text Improvements
                                    </div>

                                    <div className="setting-row" style={{ marginBottom: 12 }}>
                                        <div className="setting-info">
                                            <span className="setting-name" style={{ fontSize: '0.85rem' }}>Use separate model for improvements</span>
                                            <span className="setting-desc">By default, uses the same provider and model above</span>
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={getAIVal(['improvements', 'separate'], false)}
                                                onChange={(e) => handleAIChange(['improvements', 'separate'], e.target.checked)}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>

                                    {getAIVal(['improvements', 'separate'], false) && (
                                        <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--border-color)' }}>
                                            <div className="setting-input-group">
                                                <label>Improvement Provider</label>
                                                <select
                                                    value={getAIVal(['improvements', 'provider'], getAIVal(['provider'], 'gemini'))}
                                                    onChange={(e) => handleAIChange(['improvements', 'provider'], e.target.value)}
                                                    className="form-input"
                                                >
                                                    <option value="gemini">Google Gemini</option>
                                                    <option value="openai">OpenAI</option>
                                                    <option value="ollama">Ollama (Local)</option>
                                                </select>
                                            </div>

                                            {getAIVal(['improvements', 'provider'], getAIVal(['provider'], 'gemini')) === 'gemini' && (
                                                <div style={{ marginTop: 8 }}>
                                                    <div className="setting-input-group">
                                                        <label>API Key <span style={{ fontSize: '10px', opacity: 0.6 }}>(leave empty to use main)</span></label>
                                                        <input
                                                            type="password"
                                                            value={getAIVal(['improvements', 'gemini', 'apiKey'], '')}
                                                            onChange={(e) => handleAIChange(['improvements', 'gemini', 'apiKey'], e.target.value)}
                                                            placeholder="Override API Key (optional)"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="setting-input-group" style={{ marginTop: 8 }}>
                                                        <label>Model</label>
                                                        <select
                                                            value={getAIVal(['improvements', 'gemini', 'model'], 'gemini-2.5-flash')}
                                                            onChange={(e) => handleAIChange(['improvements', 'gemini', 'model'], e.target.value)}
                                                            className="form-input"
                                                        >
                                                            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                                                            <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                                                            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {getAIVal(['improvements', 'provider'], getAIVal(['provider'], 'gemini')) === 'openai' && (
                                                <div style={{ marginTop: 8 }}>
                                                    <div className="setting-input-group">
                                                        <label>API Key <span style={{ fontSize: '10px', opacity: 0.6 }}>(leave empty to use main)</span></label>
                                                        <input
                                                            type="password"
                                                            value={getAIVal(['improvements', 'openai', 'apiKey'], '')}
                                                            onChange={(e) => handleAIChange(['improvements', 'openai', 'apiKey'], e.target.value)}
                                                            placeholder="Override API Key (optional)"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="setting-input-group" style={{ marginTop: 8 }}>
                                                        <label>Model</label>
                                                        <select
                                                            value={getAIVal(['improvements', 'openai', 'model'], 'gpt-4o-mini')}
                                                            onChange={(e) => handleAIChange(['improvements', 'openai', 'model'], e.target.value)}
                                                            className="form-input"
                                                        >
                                                            <option value="gpt-4o-mini">gpt-4o-mini</option>
                                                            <option value="gpt-4o">gpt-4o</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {getAIVal(['improvements', 'provider'], getAIVal(['provider'], 'gemini')) === 'ollama' && (
                                                <div style={{ marginTop: 8 }}>
                                                    <div className="setting-input-group">
                                                        <label>Server URL</label>
                                                        <input
                                                            type="text"
                                                            value={getAIVal(['improvements', 'ollama', 'baseUrl'], getAIVal(['ollama', 'baseUrl'], 'http://localhost:11434'))}
                                                            onChange={(e) => handleAIChange(['improvements', 'ollama', 'baseUrl'], e.target.value)}
                                                            placeholder="http://localhost:11434"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="setting-input-group" style={{ marginTop: 8 }}>
                                                        <label>Model</label>
                                                        <input
                                                            type="text"
                                                            value={getAIVal(['improvements', 'ollama', 'model'], getAIVal(['ollama', 'model'], 'gemma3:4b'))}
                                                            onChange={(e) => handleAIChange(['improvements', 'ollama', 'model'], e.target.value)}
                                                            placeholder="Model name"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>

                    {mode === 'researcher' && (
                        <div className="settings-section">
                            <div className="section-label">
                                <FolderOpen size={16} />
                                <span>File Structures</span>
                            </div>
                            <div className="settings-card">
                                <div className="setting-input-group">
                                    <label>Figures Folder</label>
                                    <div className="input-with-icon">
                                        <FolderOpen size={14} className="input-icon" />
                                        <input
                                            type="text"
                                            value={localMeta.figuresFolder !== undefined ? localMeta.figuresFolder : 'figures'}
                                            onChange={e => handleChange('figuresFolder', e.target.value)}
                                            placeholder="figures"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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

                .premium-modal {
                    background: var(--bg-panel);
                    width: 480px;
                    max-width: 95vw;
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px var(--border-color);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .modal-header {
                    padding: 24px 32px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 1px solid var(--border-color);
                }
                .header-title h2 {
                    margin: 0;
                    font-size: 1.4rem;
                    font-weight: 800;
                    color: var(--text-primary);
                }
                .header-title .subtitle {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }

                .btn-close {
                    background: var(--hover-bg);
                    border: none;
                    color: var(--text-secondary);
                    padding: 8px;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-close:hover {
                    background: #ff4757;
                    color: white;
                }

                .modal-body {
                    padding: 24px 32px;
                    max-height: 70vh;
                    overflow-y: auto;
                }

                .settings-section {
                    margin-bottom: 24px;
                }
                .section-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 12px;
                }

                .settings-card {
                    background: var(--bg-app);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 16px;
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
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .setting-desc {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .segmented-control {
                    display: flex;
                    background: var(--bg-panel);
                    padding: 4px;
                    border-radius: 10px;
                    border: 1px solid var(--border-color);
                }
                .segmented-control button {
                    background: transparent;
                    border: none;
                    padding: 6px 12px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    border-radius: 7px;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .segmented-control button.active {
                    background: var(--accent-color);
                    color: white;
                    box-shadow: 0 2px 8px rgba(var(--accent-color-rgb), 0.3);
                }

                .setting-input-group label {
                    display: block;
                    font-size: 0.85rem;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: var(--text-primary);
                }
                .input-with-icon {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .input-icon {
                    position: absolute;
                    left: 12px;
                    color: var(--text-secondary);
                }
                .input-with-icon input {
                    width: 100%;
                    padding: 10px 12px 10px 36px;
                    background: var(--bg-panel);
                    border: 1px solid var(--border-color);
                    border-radius: 10px;
                    color: var(--text-primary);
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .input-with-icon input:focus {
                    border-color: var(--accent-color);
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(var(--accent-color-rgb), 0.1);
                }

                /* Remove arrows from number inputs */
                .clean-number::-webkit-inner-spin-button,
                .clean-number::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .clean-number {
                    -moz-appearance: textfield;
                }

                .modal-footer {
                    padding: 20px 32px 32px;
                    display: flex;
                    justify-content: flex-end;
                }
                .btn-primary {
                    background: var(--accent-color);
                    color: white;
                    border: none;
                    padding: 10px 32px;
                    border-radius: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-primary:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(var(--accent-color-rgb), 0.3);
                }

                /* Toggle switch */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
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
                    transition: .3s;
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .3s;
                }
                input:checked + .slider {
                    background-color: var(--accent-color);
                }
                input:checked + .slider:before {
                    transform: translateX(20px);
                }
                .slider.round {
                    border-radius: 24px;
                }
                .slider.round:before {
                    border-radius: 50%;
                }

                .form-input {
                    width: 100%;
                    padding: 8px 12px;
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
            `}</style>
        </div>
    );
}

import React from 'react';
import { Moon, Sun, Save, FolderOpen, FilePlus, Download, Sidebar } from 'lucide-react';

export function Layout({
    children,
    onOpen,
    onSave,
    onNew,
    onExport,
    isDark,
    toggleTheme,
    filename,
    projectName,
    mode,
    onModeChange,
    onProjectNameChange,
    showExplorer,
    toggleExplorer
}) {
    return (
        <div className={`app-layout ${isDark ? 'dark' : ''}`}>
            <header className="app-header">
                <div className="title-group">
                    <button
                        onClick={toggleExplorer}
                        className={`btn-icon ${showExplorer ? 'active' : ''}`}
                        title="Toggle Explorer"
                    >
                        <Sidebar size={20} />
                    </button>
                    <h1 className="app-title">Journal Editor</h1>

                    {/* Project Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 20 }}>
                        <div className="project-input-wrapper">
                            <input
                                value={projectName || ''}
                                onChange={(e) => onProjectNameChange && onProjectNameChange(e.target.value)}
                                className="header-project-input"
                                placeholder="Project Name"
                            />
                        </div>
                        {mode && onModeChange && (
                            <div className="header-mode-switch">
                                <button
                                    className={`mode-pill ${mode === 'journalist' ? 'active' : ''}`}
                                    onClick={() => onModeChange('journalist')}
                                >
                                    Journal
                                </button>
                                <button
                                    className={`mode-pill ${mode === 'researcher' ? 'active' : ''}`}
                                    onClick={() => onModeChange('researcher')}
                                >
                                    Research
                                </button>
                            </div>
                        )}
                        <span className="file-status" style={{ marginLeft: 10, opacity: 0.6 }}>
                            {filename ? `Editing: ${filename}` : ''}
                        </span>
                    </div>
                </div>

                <div className="actions-group">
                    <ActionButton onClick={onNew} icon={<FilePlus size={18} />} label="New" />
                    <ActionButton onClick={onOpen} icon={<FolderOpen size={18} />} label="Open" />
                    <ActionButton onClick={onSave} icon={<Save size={18} />} label="Save" />
                    {mode === 'researcher' && (
                        <ActionButton onClick={onExport} icon={<Download size={18} />} label="Export" />
                    )}

                    <div className="divider"></div>

                    <button onClick={toggleTheme} className="btn-icon">
                        {isDark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </header>

            <main className="layout-content" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {children}
            </main>
        </div>
    );
}

function ActionButton({ onClick, icon, label }) {
    return (
        <button onClick={onClick} className="btn-icon">
            {icon}
            <span>{label}</span>
        </button>
    );
}

import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Save, FolderOpen, FilePlus, Download, Sidebar, Feather, Settings, SunMoon, FileJson, ChevronDown } from 'lucide-react';

function LayoutComponent({
    children,
    onOpen,
    onSave,
    onNew,
    onExport,
    onImport,
    onOpenMetadata,
    isDark, // Kept for potential internal use but deprecated
    theme,
    toggleTheme,
    filename,
    projectName,
    mode,
    onModeChange,
    onProjectNameChange,
    showExplorer,
    toggleExplorer,
    onLogoClick,
    onOpenSettings,
    onRename,
    statusBar
}) {
    const [fileNameInput, setFileNameInput] = React.useState(filename || '');
    const [fileMenuOpen, setFileMenuOpen] = useState(false);
    const fileMenuRef = useRef(null);

    React.useEffect(() => {
        setFileNameInput(filename || '');
    }, [filename]);

    // Close file menu when clicking outside
    useEffect(() => {
        if (!fileMenuOpen) return;
        const handleClickOutside = (e) => {
            if (fileMenuRef.current && !fileMenuRef.current.contains(e.target)) {
                setFileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [fileMenuOpen]);

    return (
        <div className={`app-layout ${theme !== 'light' ? theme : ''}`}>
            <header className="app-header">
                <div className="title-group">
                    <button
                        onClick={toggleExplorer}
                        className={`btn-sidebar-toggle ${showExplorer ? 'active' : ''}`}
                        title="Toggle Explorer"
                    >
                        <Sidebar size={20} />
                    </button>
                    <div
                        onClick={onLogoClick}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                        title="Go to Welcome Screen"
                    >
                        <Feather size={24} color="var(--accent-color)" />
                        <h1 className="app-title">Feder</h1>
                    </div>

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
                        <div className="header-mode-display">
                            <div className={`mode-pill active ${mode}-badge`} style={{
                                cursor: 'default',
                                padding: '4px 16px',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {mode === 'journalist' ? 'Writer' :
                                    mode === 'researcher' ? 'Research' :
                                        mode === 'engineer' ? 'Engineer' :
                                            mode === 'scholar' ? 'Scholar' :
                                                mode === 'scriptwriter' ? 'Script' : mode}
                            </div>
                        </div>
                        <div className="file-status" style={{ marginLeft: 10, display: 'flex', alignItems: 'center' }}>
                            {filename ? (
                                <input
                                    value={fileNameInput}
                                    onChange={(e) => setFileNameInput(e.target.value)}
                                    onBlur={() => {
                                        if (onRename && fileNameInput && fileNameInput !== filename) {
                                            onRename(fileNameInput);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.target.blur();
                                        }
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid transparent',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.85rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        width: 'auto',
                                        minWidth: '150px',
                                        outline: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                    className="filename-input"
                                    title="Rename File"
                                />
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="actions-group">
                    {/* Unified File Menu Dropdown */}
                    <div className="file-menu-container" ref={fileMenuRef}>
                        <button
                            className={`btn-icon file-menu-trigger ${fileMenuOpen ? 'active' : ''}`}
                            onClick={() => setFileMenuOpen(prev => !prev)}
                            title="File Menu"
                        >
                            <FilePlus size={17} />
                            <span>File</span>
                            <ChevronDown
                                size={13}
                                style={{
                                    marginLeft: 2,
                                    opacity: 0.65,
                                    transition: 'transform 0.2s',
                                    transform: fileMenuOpen ? 'rotate(180deg)' : 'none'
                                }}
                            />
                        </button>

                        {fileMenuOpen && (
                            <div className="file-menu-dropdown">
                                <button
                                    className="file-menu-item"
                                    onClick={() => { onNew && onNew(); setFileMenuOpen(false); }}
                                >
                                    <FilePlus size={15} />
                                    <span>New Project</span>
                                </button>
                                <button
                                    className="file-menu-item"
                                    onClick={() => { onOpen && onOpen(); setFileMenuOpen(false); }}
                                >
                                    <FolderOpen size={15} />
                                    <span>Open Project</span>
                                </button>
                                <div className="file-menu-divider" />
                                <button
                                    className="file-menu-item"
                                    onClick={() => { onSave && onSave(); setFileMenuOpen(false); }}
                                >
                                    <Save size={15} />
                                    <span>Save</span>
                                    <span className="file-menu-shortcut">Ctrl+S</span>
                                </button>
                                <div className="file-menu-divider" />
                                <button
                                    className="file-menu-item"
                                    onClick={() => { onExport && onExport(); setFileMenuOpen(false); }}
                                >
                                    <Download size={15} />
                                    <span>Export PDF</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <ActionButton onClick={onOpenMetadata} icon={<FileJson size={18} />} label="Project" />
                    <ActionButton onClick={onOpenSettings} icon={<Settings size={18} />} label="Settings" />

                    <div className="divider"></div>

                    <button onClick={toggleTheme} className="btn-icon" title={`Theme: ${theme}`}>
                        {theme === 'light' ? <Sun size={20} /> :
                            theme === 'dark' ? <Moon size={20} /> : <SunMoon size={20} />}
                    </button>
                </div>
            </header>

            <main className="layout-content" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {children}
            </main>

            {statusBar}
        </div>
    );
}

export const Layout = React.memo(LayoutComponent);

function ActionButton({ onClick, icon, label }) {
    return (
        <button onClick={onClick} className="btn-icon">
            {icon}
            <span>{label}</span>
        </button>
    );
}

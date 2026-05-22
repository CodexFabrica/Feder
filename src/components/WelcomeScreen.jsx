import React, { useState } from 'react';
import { FolderOpen, FilePlus, BookOpen, PenTool, Feather, Settings, X, Sun, Moon, SunMoon, Trash2, CloudSun, Download, RefreshCw } from 'lucide-react';

export function WelcomeScreen({ onNewProject, onOpenProject, recentProjects, onOpenRecent, theme, toggleTheme, settings, onUpdateSettings, onRemoveRecent, isElectron }) {
    const [newItemName, setNewItemName] = useState('');
    const [newItemMode, setNewItemMode] = useState('journalist');
    const [initializeEmpty, setInitializeEmpty] = useState(false);
    const [showAllRecents, setShowAllRecents] = useState(false);
    const [showUserSettings, setShowUserSettings] = useState(false);

    const visibleRecents = recentProjects && recentProjects.length > 0
        ? (showAllRecents ? recentProjects.slice(0, 10) : recentProjects.slice(0, 2))
        : [];

    const hasRecents = recentProjects && recentProjects.length > 0;

    // Adjust for Desktop Drag Region
    const topOffset = isElectron ? 32 : 0;

    return (
        <div className={`welcome-screen app-layout ${theme !== 'light' ? theme : ''}`} style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100%',
            background: 'var(--bg-app)',
            color: 'var(--text-primary)',
            overflowY: 'auto',
            padding: `${20 + topOffset}px 20px 40px 20px`, // Added dynamic top padding
            alignItems: 'center',
            position: 'relative'
        }}>
            {/* Top Bar for Settings and Theme */}
            <div style={{
                position: 'fixed',
                top: topOffset, // Moved down for drag region

                left: 0,
                right: 0,
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                zIndex: 2500, // Higher than sidebar
                pointerEvents: 'none'
            }}>
                <button
                    onClick={() => setShowUserSettings(!showUserSettings)}
                    style={{
                        ...btnIconStyle,
                        pointerEvents: 'auto',
                        background: showUserSettings ? 'var(--accent-color)' : 'var(--bg-panel)',
                        color: showUserSettings ? 'white' : 'var(--text-primary)',
                        borderColor: showUserSettings ? 'var(--accent-color)' : 'var(--border-color)',
                    }}
                    title="Toggle Author Profile"
                >
                    <Settings size={22} />
                </button>
                <button
                    onClick={toggleTheme}
                    style={{ ...btnIconStyle, pointerEvents: 'auto' }}
                    title={`Theme: ${theme}`}
                >
                    {theme === 'light' ? <Sun size={22} /> :
                        theme === 'semi-light' ? <CloudSun size={22} /> :
                            theme === 'dark' ? <Moon size={22} /> : <SunMoon size={22} />}
                </button>
            </div>

            {/* Logo Section */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 20,
                marginTop: '35px',
                animation: 'fadeInDown 0.8s ease-out'
            }}>
                <Feather size={42} color="var(--accent-color)" />
                <h1 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>Feder</h1>
            </div>

            <div className="welcome-content-container" style={{
                maxWidth: 1000,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                animation: 'fadeInUp 0.6s ease-out'
            }}>
                {/* Upper Actions Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: hasRecents ? '1fr 1fr' : '1fr',
                    gap: 16
                }}>
                    {/* Recent Projects */}
                    {hasRecents && (
                        <div className="welcome-card" style={cardStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                                <div style={iconBoxStyle}><BookOpen size={20} /></div>
                                <h3 style={cardTitleStyle}>Recent Projects</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                                {visibleRecents.map((proj, idx) => (
                                    <div key={idx} className="recent-item-wrapper" style={{ position: 'relative', width: '100%' }}>
                                        <button
                                            onClick={() => onOpenRecent(proj)}
                                            className="btn-recent-premium"
                                            style={{ ...recentItemPremiumStyle, color: 'var(--text-primary)' }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'inherit' }}>{proj.name}</span>
                                                <span className="mode-tag" style={{
                                                    fontSize: '0.7rem',
                                                    textTransform: 'uppercase',
                                                    fontWeight: 800,
                                                    color: 'var(--accent-color)',
                                                    marginTop: 2
                                                }}>
                                                    {proj.mode}
                                                </span>
                                            </div>
                                        </button>
                                        <button
                                            className="remove-recent-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveRecent(proj);
                                            }}
                                            style={removeRecentBtnStyle}
                                            title="Remove"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}

                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    {recentProjects.length > 2 && (
                                        <button
                                            onClick={() => setShowAllRecents(!showAllRecents)}
                                            style={textBtnCenteredStyle}
                                        >
                                            {showAllRecents ? 'Show Less' : `View All (${recentProjects.length})`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Open Existing */}
                    <div className="welcome-card" style={{ ...cardStyle }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                            <div style={iconBoxStyle}><FolderOpen size={20} /></div>
                            <h3 style={cardTitleStyle}>Open Existing</h3>
                        </div>
                        <p style={cardDescStyle}>Resume work from a local folder or markdown file.</p>
                        <button onClick={onOpenProject} className="btn-secondary-premium" style={btnSecondaryPremiumStyle}>
                            Browse Folder
                        </button>
                    </div>
                </div>

                {/* Create New Block */}
                <div className="welcome-card" style={{ ...cardStyle }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                        <div style={iconBoxStyle}><FilePlus size={20} /></div>
                        <h3 style={cardTitleStyle}>Start a New Project</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Project Name</label>
                            <input
                                type="text"
                                placeholder="My New Project..."
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                style={inputPremiumStyle}
                            />
                        </div>

                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Project Concept</label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: 12
                            }}>
                                {[
                                    { id: 'journalist', label: 'Journalist', icon: PenTool, desc: 'Articles & Press Notes' },
                                    { id: 'researcher', label: 'Research', icon: BookOpen, desc: 'Academic Papers' },
                                    { id: 'engineer', label: 'Engineer', icon: PenTool, desc: 'Technical Reports' },
                                    { id: 'scholar', label: 'Scholar', icon: BookOpen, desc: 'Study & Courses' },
                                    { id: 'scriptwriter', label: 'Script', icon: Feather, desc: 'Screenplays' }
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setNewItemMode(m.id)}
                                        className={`mode-card-premium ${newItemMode === m.id ? 'active' : ''}`}
                                        style={{
                                            ...modeCardPremiumStyle,
                                            borderColor: newItemMode === m.id ? 'var(--accent-color)' : 'var(--border-color)',
                                            background: newItemMode === m.id ? 'rgba(var(--accent-color-rgb), 0.05)' : 'var(--bg-panel)'
                                        }}
                                    >
                                        <div className="icon-wrap" style={{
                                            color: newItemMode === m.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                                            marginBottom: 8
                                        }}>
                                            <m.icon size={24} />
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.label}</span>
                                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{m.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            background: 'var(--bg-app)',
                            borderRadius: 16,
                            border: '1px solid var(--border-color)'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>Initialize Empty</span>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={initializeEmpty}
                                            onChange={(e) => setInitializeEmpty(e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {initializeEmpty ? 'Create only project_metadata.json and main.md' : 'Standard folders, notes, and draft files will be generated'}
                                </span>
                            </div>

                            <button
                                onClick={() => onNewProject(newItemName, newItemMode, initializeEmpty)}
                                className="btn-primary-premium"
                                style={{
                                    ...btnPrimaryPremiumStyle,
                                    opacity: newItemName.trim() ? 1 : 0.4,
                                    cursor: newItemName.trim() ? 'pointer' : 'not-allowed',
                                    transform: newItemName.trim() ? 'none' : 'scale(0.98)'
                                }}
                                disabled={!newItemName.trim()}
                            >
                                <FilePlus size={18} style={{ marginRight: 8 }} />
                                Create Project
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* User Settings Sidebar / Left Panel */}
            <div className={`settings-sidebar ${showUserSettings ? 'open' : ''}`} style={{
                position: 'fixed',
                top: topOffset,
                left: showUserSettings ? 0 : -450,
                width: 440,
                height: `calc(100vh - ${topOffset}px)`,
                background: 'rgba(var(--bg-panel-rgb), 0.85)',
                boxShadow: showUserSettings ? '20px 0 50px rgba(0,0,0,0.15)' : 'none',
                zIndex: 2000,
                transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--border-color)',
                backdropFilter: 'blur(25px) saturate(180%)',
                paddingTop: '80px', // Space for top bar toggle
            }}>
                <div style={{ padding: '32px 40px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
                    <div className="header-title" style={{ marginBottom: 10 }}>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Author Profile</h2>
                        <span className="subtitle" style={{ opacity: 0.6, fontSize: '0.9rem' }}>Project Identity & Metadata</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Full Name</label>
                            <input
                                style={inputPremiumStyle}
                                value={settings.name || ''}
                                onChange={e => onUpdateSettings({ ...settings, name: e.target.value })}
                                placeholder="Enter Full Name"
                            />
                        </div>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Institution / Affiliation</label>
                            <input
                                style={inputPremiumStyle}
                                value={settings.affiliation || ''}
                                onChange={e => onUpdateSettings({ ...settings, affiliation: e.target.value })}
                                placeholder="University Name / Research Centre"
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Company</label>
                                <input
                                    style={inputPremiumStyle}
                                    value={settings.company || ''}
                                    onChange={e => onUpdateSettings({ ...settings, company: e.target.value })}
                                    placeholder="Enter Company Name"
                                />
                            </div>
                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Position</label>
                                <input
                                    style={inputPremiumStyle}
                                    value={settings.profession || ''}
                                    onChange={e => onUpdateSettings({ ...settings, profession: e.target.value })}
                                    placeholder="Enter Position"
                                />
                            </div>
                        </div>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Contact Email</label>
                            <input
                                style={inputPremiumStyle}
                                value={settings.email || ''}
                                onChange={e => onUpdateSettings({ ...settings, email: e.target.value })}
                                placeholder="email@example.com"
                            />
                        </div>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Phone Number</label>
                            <input
                                style={inputPremiumStyle}
                                value={settings.phone || ''}
                                onChange={e => onUpdateSettings({ ...settings, phone: e.target.value })}
                                placeholder="+569..."
                            />
                        </div>

                        {/* Updates Section */}
                        <div style={{ marginTop: 10, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
                            <UpdateChecker isElectron={isElectron} />
                        </div>
                    </div>
                    <div style={{ marginTop: 'auto', padding: '10px 0', opacity: 0.4, fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center' }}>
                        All changes are saved automatically.
                    </div>
                </div>
            </div>

            {/* Overlay for sidebar */}
            {showUserSettings && (
                <div
                    onClick={() => setShowUserSettings(false)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.1)', zIndex: 1999,
                        animation: 'fadeIn 0.3s'
                    }}
                />
            )}

            <style>{`
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .mode-card-premium {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 20px 10px;
                    border-radius: 16px;
                    border: 2px solid var(--border-color);
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .mode-card-premium:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 16px rgba(0,0,0,0.1);
                    border-color: var(--accent-color);
                }
                .mode-card-premium.active {
                    box-shadow: 0 4px 12px rgba(var(--accent-color-rgb), 0.15);
                }

                .btn-recent-premium {
                    width: 100%;
                    padding: 16px 48px 16px 20px;
                    background: var(--bg-panel);
                    border: 1px solid var(--border-color);
                    border-radius: 14px;
                    text-align: left;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: block;
                }
                .btn-recent-premium:hover {
                    background: var(--bg-app);
                    transform: scale(1.01);
                    border-color: var(--accent-color);
                }

                .recent-item-wrapper:hover .remove-recent-btn {
                    opacity: 1 !important;
                }
                .remove-recent-btn:hover {
                    background: rgba(255, 71, 87, 0.15) !important;
                    color: #ff4757 !important;
                    transform: translateY(-50%) scale(1.1) !important;
                }
            `}</style>
        </div>
    );
}

const btnIconStyle = {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
};

const cardStyle = {
    background: 'var(--bg-panel)',
    padding: '24px',
    borderRadius: '24px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 30px rgba(0,0,0,0.04)'
};

const iconBoxStyle = {
    width: '40px',
    height: '40px',
    background: 'rgba(var(--accent-color-rgb), 0.1)',
    color: 'var(--accent-color)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const cardTitleStyle = {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 800,
    color: 'var(--text-primary)'
};

const cardDescStyle = {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    marginBottom: 20
};

const formGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%'
};

const labelStyle = {
    fontSize: '0.75rem',
    fontWeight: 800,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '1px'
};

const inputPremiumStyle = {
    padding: '14px 18px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    width: '100%',
    transition: 'all 0.2s'
};

const btnPrimaryPremiumStyle = {
    padding: '14px 24px',
    background: 'var(--accent-color)',
    color: 'white',
    border: 'none',
    borderRadius: '14px',
    fontWeight: 700,
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
};

const btnSecondaryPremiumStyle = {
    padding: '14px 24px',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const removeRecentBtnStyle = {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    opacity: 0
};

const recentItemPremiumStyle = {
    cursor: 'pointer',
};

const textBtnCenteredStyle = {
    background: 'none',
    border: 'none',
    color: 'var(--accent-color)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 700,
    marginTop: 10,
    padding: '8px 16px',
    borderRadius: '8px',
    transition: 'all 0.2s'
};

const modeCardPremiumStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    borderRadius: '16px',
    border: '2px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: 'var(--text-primary)'
};

function UpdateChecker({ isElectron }) {
    const [updateStatus, setUpdateStatus] = useState({ state: 'idle', version: null, url: null }); // idle, checking, available, up-to-date, error
    const [currentAppVersion, setCurrentAppVersion] = useState('Unknown');

    React.useEffect(() => {
        const fetchVersion = async () => {
            if (isElectron && window.electronAPI && window.electronAPI.getVersion) {
                try {
                    const v = await window.electronAPI.getVersion();
                    setCurrentAppVersion(v);
                } catch (e) {
                    console.error("Failed to get version", e);
                }
            }
        };
        fetchVersion();
    }, [isElectron]);

    const checkForUpdates = async () => {
        setUpdateStatus({ ...updateStatus, state: 'checking' });
        try {
            // Fetch centralized registry from Everything Engineering
            const response = await fetch(`https://everythingengineering.github.io/api/registry.json?t=${new Date().getTime()}`, { cache: "no-store" });
            if (!response.ok) throw new Error('Network response was not ok');
            const registry = await response.json();

            // Get Feder specific data
            const data = registry['feder'];

            if (!data) {
                console.warn("Feder not found in registry");
                setUpdateStatus({ state: 'error' });
                return;
            }

            // Simple semantic version compare
            const isNewer = compareVersions(currentAppVersion, data.latestVersion);

            if (isNewer) {
                setUpdateStatus({ state: 'available', version: data.latestVersion, url: data.downloadUrl });
            } else {
                setUpdateStatus({ state: 'up-to-date', version: currentAppVersion, url: null });
            }
        } catch (e) {
            console.error(e);
            setUpdateStatus({ state: 'error' });
        }
    };

    const compareVersions = (v1, v2) => {
        if (!v1 || !v2 || v1 === 'Unknown') return false;
        // removing 'v' if present
        const cleanV1 = v1.replace(/^v/, '');
        const cleanV2 = v2.replace(/^v/, '');

        const p1 = cleanV1.split('.').map(Number);
        const p2 = cleanV2.split('.').map(Number);

        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n2 > n1) return true;
            if (n1 > n2) return false;
        }
        return false;
    };

    const handleUpdateClick = () => {
        if (updateStatus.url) {
            if (isElectron && window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal(updateStatus.url);
            } else {
                window.open(updateStatus.url, '_blank');
            }
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="section-label" style={labelStyle}>
                <span>Software Update</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Current Version</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.6, color: 'var(--text-secondary)' }}>v{currentAppVersion}</span>
                </div>
                <button
                    onClick={checkForUpdates}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        background: 'var(--bg-app)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        transition: 'all 0.2s'
                    }}
                >
                    <RefreshCw size={14} className={updateStatus.state === 'checking' ? 'spin' : ''} />
                    {updateStatus.state === 'checking' ? 'Checking...' : 'Check'}
                </button>
            </div>

            {updateStatus.state === 'available' && (
                <div style={{ marginTop: 8, padding: 12, background: 'rgba(var(--accent-color-rgb), 0.1)', borderRadius: 12, border: '1px solid var(--accent-color)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Download size={16} />
                        New Version: v{updateStatus.version}
                    </div>
                    <button
                        onClick={handleUpdateClick}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: 'var(--accent-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        Download Update
                    </button>
                </div>
            )}

            {updateStatus.state === 'up-to-date' && (
                <div style={{ padding: '8px 12px', background: 'rgba(46, 204, 113, 0.1)', borderRadius: 8, fontSize: '0.85rem', color: '#27ae60', fontWeight: 600, textAlign: 'center' }}>
                    You are up to date!
                </div>
            )}
            {updateStatus.state === 'error' && (
                <div style={{ padding: '8px 12px', background: 'rgba(255, 71, 87, 0.1)', borderRadius: 8, fontSize: '0.85rem', color: '#ff4757', fontWeight: 600, textAlign: 'center' }}>
                    Failed to check for updates.
                </div>
            )}

            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { 
                    100% { -webkit-transform: rotate(360deg); transform:rotate(360deg); } 
                }
            `}</style>
        </div>
    );
}

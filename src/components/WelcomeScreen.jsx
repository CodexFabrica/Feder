import React, { useState } from 'react';
import { FolderOpen, FilePlus, BookOpen, PenTool, Feather, Settings, X, Sun, Moon, SunMoon } from 'lucide-react';

export function WelcomeScreen({ onNewProject, onOpenProject, recentProjects, onOpenRecent, theme, toggleTheme, settings, onUpdateSettings, onRemoveRecent }) {
    const [newItemName, setNewItemName] = useState('');
    const [newItemMode, setNewItemMode] = useState('journalist');
    const [useTemplate, setUseTemplate] = useState(true);
    const [showAllRecents, setShowAllRecents] = useState(false);

    const visibleRecents = recentProjects && recentProjects.length > 0
        ? (showAllRecents ? recentProjects.slice(0, 10) : recentProjects.slice(0, 2))
        : [];

    return (
        <div className="welcome-screen" style={{
            display: 'flex',
            flexDirection: 'row',
            height: '100%',
            background: 'var(--bg-app)',
            color: 'var(--text-primary)',
            overflow: 'hidden'
        }}>
            {/* Left Sidebar: User Settings */}
            <div className="welcome-sidebar" style={{
                width: 350,
                borderRight: '1px solid var(--border-color)',
                background: 'var(--bg-panel)',
                padding: '40px 30px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                overflowY: 'auto',
                boxShadow: 'var(--shadow-sm)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Settings size={22} color="var(--accent-color)" />
                    <h3 style={{ ...cardTitleStyle, fontSize: '1.2rem' }}>User Settings</h3>
                </div>
                <p style={{ ...cardDescStyle, marginBottom: 10 }}>Personalize your professional identity for all generated documents.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={miniLabelStyle}>FULL NAME</label>
                        <input
                            style={miniInputStyle}
                            value={settings.name || ''}
                            onChange={e => onUpdateSettings({ ...settings, name: e.target.value })}
                            placeholder="Your Name"
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={miniLabelStyle}>AFFILIATION / UNIVERSITY</label>
                        <input
                            style={miniInputStyle}
                            value={settings.affiliation || ''}
                            onChange={e => onUpdateSettings({ ...settings, affiliation: e.target.value })}
                            placeholder="University"
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={miniLabelStyle}>COMPANY</label>
                        <input
                            style={miniInputStyle}
                            value={settings.company || ''}
                            onChange={e => onUpdateSettings({ ...settings, company: e.target.value })}
                            placeholder="Company"
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={miniLabelStyle}>PROFESSION</label>
                        <input
                            style={miniInputStyle}
                            value={settings.profession || ''}
                            onChange={e => onUpdateSettings({ ...settings, profession: e.target.value })}
                            placeholder="e.g. Structural Engineer"
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={miniLabelStyle}>E-MAIL</label>
                        <input
                            style={miniInputStyle}
                            value={settings.email || ''}
                            onChange={e => onUpdateSettings({ ...settings, email: e.target.value })}
                            placeholder="email@example.com"
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={miniLabelStyle}>PHONE</label>
                        <input
                            style={miniInputStyle}
                            value={settings.phone || ''}
                            onChange={e => onUpdateSettings({ ...settings, phone: e.target.value })}
                            placeholder="+1 234..."
                        />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="welcome-main" style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 40,
                overflowY: 'auto',
                position: 'relative'
            }}>
                <button
                    onClick={toggleTheme}
                    style={{
                        position: 'absolute',
                        top: 20,
                        right: 20,
                        padding: 10,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)'
                    }}
                    title={theme === 'light' ? "Switch to Semi-Dark Mode" :
                        theme === 'semi-dark' ? "Switch to Dark Mode" : "Switch to Light Mode"}
                >
                    {theme === 'light' ? <SunMoon size={24} /> :
                        theme === 'semi-dark' ? <Moon size={24} /> : <Sun size={24} />}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 40, marginTop: '5vh' }}>
                    <Feather size={56} color="var(--accent-color)" />
                    <h1 style={{ fontSize: '4rem', margin: 0, fontWeight: 800, letterSpacing: '-1px' }}>Feder</h1>
                </div>

                <div className="welcome-actions" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: 24,
                    maxWidth: 1000,
                    width: '100%'
                }}>
                    {/* Recent Projects */}
                    {recentProjects && recentProjects.length > 0 && (
                        <div className="welcome-card" style={cardStyle}>
                            <h3 style={cardTitleStyle}>Recent Projects</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                {visibleRecents.map((proj, idx) => (
                                    <div key={idx} className="recent-item-wrapper" style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => onOpenRecent(proj)}
                                            className="btn-recent"
                                            style={recentItemStyle}
                                        >
                                            <span style={{ fontWeight: 600 }}>{proj.name}</span>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {proj.mode}
                                            </span>
                                        </button>
                                        <button
                                            className="remove-recent-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveRecent(proj);
                                            }}
                                            style={{
                                                position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
                                                background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                                                borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', color: 'var(--text-secondary)', padding: 0
                                            }}
                                            title="Remove from recents"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                                {recentProjects.length > 2 && !showAllRecents && (
                                    <button
                                        onClick={() => setShowAllRecents(true)}
                                        style={{ ...textBtnStyle, padding: '5px', marginTop: 5 }}
                                    >
                                        View More ({recentProjects.length - 2})
                                    </button>
                                )}
                                {showAllRecents && (
                                    <button
                                        onClick={() => setShowAllRecents(false)}
                                        style={{ ...textBtnStyle, padding: '5px', marginTop: 5 }}
                                    >
                                        Show Less
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Open Existing */}
                    <div className="welcome-card" style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FolderOpen size={24} color="var(--accent-color)" />
                            <h3 style={cardTitleStyle}>Open Existing</h3>
                        </div>
                        <p style={cardDescStyle}>Open a local folder or file to start working.</p>
                        <button onClick={onOpenProject} className="btn-secondary" style={btnSecondaryStyle}>
                            Open Folder...
                        </button>
                    </div>

                    {/* Create New */}
                    <div className="welcome-card" style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FilePlus size={24} color="var(--accent-color)" />
                            <h3 style={cardTitleStyle}>Create New</h3>
                        </div>
                        <div style={{ marginTop: 25, display: 'flex', flexDirection: 'column', gap: 25, alignItems: 'center' }}>
                            <div style={{ width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>PROJECT NAME</label>
                                <input
                                    type="text"
                                    placeholder="Enter project name..."
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    style={{ ...inputStyle, width: '100%' }}
                                />
                            </div>

                            <div style={{ width: '100%', maxWidth: '700px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, display: 'block' }}>CHOOSE MODE</label>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(5, 1fr)',
                                    gap: 12
                                }}>
                                    {[
                                        { id: 'journalist', label: 'Writer', icon: PenTool },
                                        { id: 'researcher', label: 'Research', icon: BookOpen },
                                        { id: 'engineer', label: 'Engineer', icon: PenTool },
                                        { id: 'scholar', label: 'Scholar', icon: BookOpen },
                                        { id: 'scriptwriter', label: 'Script', icon: Feather }
                                    ].map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => setNewItemMode(m.id)}
                                            style={{ ...modeBtnStyle, ...(newItemMode === m.id ? activeModeStyle : {}), flexDirection: 'column', padding: '15px 5px' }}
                                        >
                                            <m.icon size={18} />
                                            <span style={{ fontSize: '0.75rem', marginTop: 5 }}>{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{
                                width: '100%',
                                maxWidth: '700px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '20px',
                                background: 'var(--bg-app)',
                                borderRadius: 12,
                                border: '1px solid var(--border-color)'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Initial Template</span>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={useTemplate}
                                                onChange={(e) => setUseTemplate(e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {useTemplate ? 'Includes recommended folder structure and boilerplate' : 'Creates empty folder'}
                                    </span>
                                </div>

                                <button
                                    onClick={() => onNewProject(newItemName, newItemMode, useTemplate)}
                                    className="btn-primary"
                                    style={{
                                        ...btnPrimaryStyle,
                                        width: 'auto',
                                        padding: '12px 30px',
                                        marginTop: 0,
                                        opacity: newItemName.trim() ? 1 : 0.5,
                                        cursor: newItemName.trim() ? 'pointer' : 'not-allowed'
                                    }}
                                    disabled={!newItemName.trim()}
                                    title={!newItemName.trim() ? "Write a project name first" : ""}
                                >
                                    Create & Save Project
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ height: 100, flexShrink: 0 }}></div>
            </div>
        </div>
    );
}

const miniLabelStyle = {
    fontSize: '0.65rem',
    fontWeight: 800,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase'
};

const miniInputStyle = {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    width: '100%'
};

const cardStyle = {
    background: 'var(--bg-panel)',
    padding: 25,
    borderRadius: 12,
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: 'var(--shadow-sm)'
};

const cardTitleStyle = {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)'
};

const cardDescStyle = {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    lineHeight: 1.5
};

const btnPrimaryStyle = {
    padding: '12px 16px',
    background: 'var(--accent-color)',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    marginTop: 'auto',
    width: '100%'
};

const btnSecondaryStyle = {
    padding: '12px 16px',
    background: 'var(--hover-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    marginTop: 'auto',
    width: '100%'
};

const inputStyle = {
    padding: '12px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    fontSize: '1rem'
};

const modeBtnStyle = {
    flex: 1,
    padding: '10px',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    background: 'var(--bg-panel)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.2s',
    outline: 'none'
};

const activeModeStyle = {
    background: 'var(--hover-bg)',
    color: 'var(--accent-color)',
    borderColor: 'var(--accent-color)'
};

const recentItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    paddingRight: 35
};

const textBtnStyle = {
    background: 'none',
    border: 'none',
    color: 'var(--accent-color)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    textAlign: 'left'
};

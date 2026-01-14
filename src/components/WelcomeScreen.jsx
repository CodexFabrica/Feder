import React, { useState } from 'react';
import { FolderOpen, FilePlus, BookOpen, PenTool } from 'lucide-react';

export function WelcomeScreen({ onNewProject, onOpenProject, recentProjects, onOpenRecent, isDark }) {
    const [newItemName, setNewItemName] = useState('');
    const [newItemMode, setNewItemMode] = useState('journalist');

    return (
        <div className="welcome-screen" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: 'var(--bg-app)',
            color: 'var(--text-primary)',
            padding: 20
        }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: 10, fontWeight: 800 }}>Journal Editor</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 40, fontSize: '1.2rem' }}>
                Your professional writing companion.
            </p>

            <div className="welcome-actions" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 20,
                maxWidth: 800,
                width: '100%'
            }}>
                {/* Recent Projects */}
                {recentProjects && recentProjects.length > 0 && (
                    <div className="welcome-card" style={cardStyle}>
                        <h3 style={cardTitleStyle}>Recent Projects</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                            {recentProjects.map((proj, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => onOpenRecent(proj)}
                                    className="btn-recent"
                                    style={recentItemStyle}
                                >
                                    <span style={{ fontWeight: 600 }}>{proj.name}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {proj.mode}
                                    </span>
                                </button>
                            ))}
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
                    <div style={{ marginTop: 15, display: 'flex', flexDirection: 'column', gap: 15 }}>
                        <input
                            type="text"
                            placeholder="Project Name / Filename"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            style={inputStyle}
                        />

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => setNewItemMode('journalist')}
                                style={{ ...modeBtnStyle, ...(newItemMode === 'journalist' ? activeModeStyle : {}) }}
                            >
                                <PenTool size={16} /> Journalist Mode
                            </button>
                            <button
                                onClick={() => setNewItemMode('researcher')}
                                style={{ ...modeBtnStyle, ...(newItemMode === 'researcher' ? activeModeStyle : {}) }}
                            >
                                <BookOpen size={16} /> Researcher Mode
                            </button>
                        </div>

                        <button
                            onClick={() => onNewProject(newItemName, newItemMode)}
                            className="btn-primary"
                            style={btnPrimaryStyle}
                            disabled={!newItemName.trim()}
                        >
                            Create & Save...
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

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
    fontWeight: 700
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
    transition: 'all 0.2s'
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
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%'
};

import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Search } from 'lucide-react';

// Folders to exclude from PDF export file picker
const EXCLUDED_FOLDERS = new Set(['notes', 'references', 'ideas', 'figures']);

/**
 * Modal that lets the user pick an eligible .md file to export as PDF.
 * Eligible: root-level .md files + files inside lectures/ (scholar mode).
 * Excluded: .md files inside notes/, references/, ideas/, figures/.
 */
export function PdfExportModal({ dirHandle, mode, onExport, onClose }) {
    const [files, setFiles] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const scan = async () => {
            if (!dirHandle) { setLoading(false); return; }
            const eligible = [];
            try {
                for await (const entry of dirHandle.values()) {
                    // Root-level .md files
                    if (entry.kind === 'file' && entry.name.endsWith('.md')) {
                        eligible.push({ name: entry.name, path: entry.name, handle: entry });
                    }
                    // Subfolders: include lectures/ for any mode; skip excluded folders
                    if (entry.kind === 'directory') {
                        const folderName = entry.name.toLowerCase();
                        if (EXCLUDED_FOLDERS.has(folderName)) continue;
                        // Include lectures/ directory (scholar, but harmless for others)
                        if (folderName === 'lectures') {
                            for await (const sub of entry.values()) {
                                if (sub.kind === 'file' && sub.name.endsWith('.md')) {
                                    eligible.push({
                                        name: sub.name,
                                        path: `lectures/${sub.name}`,
                                        handle: sub,
                                    });
                                }
                            }
                        }
                    }
                }
                setFiles(eligible);
                if (eligible.length > 0) setSelected(eligible[0].path);
            } catch (e) {
                console.error('PdfExportModal scan error', e);
            } finally {
                setLoading(false);
            }
        };
        scan();
    }, [dirHandle, mode]);

    const filtered = files.filter(
        f =>
            f.name.toLowerCase().includes(search.toLowerCase()) ||
            f.path.toLowerCase().includes(search.toLowerCase())
    );

    const handleExport = () => {
        const file = files.find(f => f.path === selected);
        if (file) onExport(file);
    };

    return (
        <>
            <style>{`
                .pdf-modal-overlay {
                    position: fixed; inset: 0;
                    background: rgba(0,0,0,0.55);
                    backdrop-filter: blur(6px);
                    z-index: 9000;
                    display: flex; align-items: center; justify-content: center;
                    animation: fadeInOverlay 0.2s ease;
                }
                @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }

                .pdf-export-modal-box {
                    background: var(--bg-panel);
                    border: 1px solid var(--border-color);
                    border-radius: 20px;
                    width: 480px;
                    max-width: 95vw;
                    box-shadow: 0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05);
                    overflow: hidden;
                    animation: slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes slideUpModal { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

                .pdf-modal-header {
                    padding: 28px 32px 0;
                    display: flex; justify-content: space-between; align-items: flex-start;
                }
                .pdf-modal-title { font-size: 1.25rem; font-weight: 800; margin: 0 0 4px; color: var(--text-primary); }
                .pdf-modal-subtitle { font-size: 0.85rem; color: var(--text-secondary); }

                .pdf-modal-close {
                    background: var(--bg-app); border: 1px solid var(--border-color);
                    color: var(--text-secondary); width: 34px; height: 34px;
                    border-radius: 10px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s; flex-shrink: 0;
                }
                .pdf-modal-close:hover { background: var(--hover-bg); color: var(--text-primary); }

                .pdf-modal-body { padding: 20px 32px; }

                .pdf-search-wrap { position: relative; margin-bottom: 14px; }
                .pdf-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); pointer-events: none; }
                .pdf-search-input {
                    width: 100%; padding: 9px 12px 9px 36px;
                    background: var(--bg-app); border: 1px solid var(--border-color);
                    border-radius: 10px; color: var(--text-primary); font-size: 0.875rem;
                    outline: none; transition: border-color 0.2s;
                }
                .pdf-search-input:focus { border-color: var(--accent-color); }

                .pdf-file-list { display: flex; flex-direction: column; gap: 6px; max-height: 270px; overflow-y: auto; }

                .pdf-file-btn {
                    display: flex; align-items: center; gap: 12;
                    padding: 11px 14px; border-radius: 12px; border: 1.5px solid var(--border-color);
                    background: var(--bg-app); cursor: pointer; text-align: left;
                    transition: all 0.15s; color: var(--text-primary); width: 100%;
                }
                .pdf-file-btn:hover { border-color: var(--accent-color); background: rgba(var(--accent-color-rgb),0.04); }
                .pdf-file-btn.selected { border-color: var(--accent-color); background: rgba(var(--accent-color-rgb),0.08); }

                .pdf-file-info { flex: 1; min-width: 0; }
                .pdf-file-name { font-weight: 600; font-size: 0.9rem; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .pdf-file-path { font-size: 0.73rem; color: var(--text-secondary); margin-top: 2px; }

                .pdf-empty { text-align: center; padding: 28px; color: var(--text-secondary); font-size: 0.9rem; }

                .pdf-modal-footer {
                    padding: 16px 32px 28px;
                    display: flex; justify-content: flex-end; gap: 10px;
                    border-top: 1px solid var(--border-color);
                }
                .pdf-btn-cancel {
                    background: transparent; border: 1px solid var(--border-color);
                    color: var(--text-secondary); padding: 9px 22px;
                    border-radius: 10px; font-weight: 600; cursor: pointer;
                    font-size: 0.875rem; transition: all 0.2s;
                }
                .pdf-btn-cancel:hover { background: var(--hover-bg); color: var(--text-primary); }
                .pdf-btn-export {
                    background: var(--accent-color); border: none; color: white;
                    padding: 9px 28px; border-radius: 10px; font-weight: 700;
                    cursor: pointer; font-size: 0.875rem; display: flex; align-items: center; gap: 7px;
                    transition: all 0.2s;
                }
                .pdf-btn-export:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(var(--accent-color-rgb),0.4); }
                .pdf-btn-export:disabled { opacity: 0.45; cursor: not-allowed; }
            `}</style>

            <div className="pdf-modal-overlay" onClick={onClose}>
                <div className="pdf-export-modal-box" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="pdf-modal-header">
                        <div>
                            <p className="pdf-modal-title">Export as PDF</p>
                            <p className="pdf-modal-subtitle">Select the document to export</p>
                        </div>
                        <button className="pdf-modal-close" onClick={onClose}>
                            <X size={17} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="pdf-modal-body">
                        <div className="pdf-search-wrap">
                            <Search size={14} className="pdf-search-icon" />
                            <input
                                type="text"
                                className="pdf-search-input"
                                placeholder="Search files..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {loading ? (
                            <div className="pdf-empty">Scanning project files…</div>
                        ) : filtered.length === 0 ? (
                            <div className="pdf-empty">No eligible files found</div>
                        ) : (
                            <div className="pdf-file-list">
                                {filtered.map(file => (
                                    <button
                                        key={file.path}
                                        className={`pdf-file-btn ${selected === file.path ? 'selected' : ''}`}
                                        onClick={() => setSelected(file.path)}
                                    >
                                        <FileText
                                            size={18}
                                            color={selected === file.path ? 'var(--accent-color)' : 'var(--text-secondary)'}
                                            style={{ flexShrink: 0 }}
                                        />
                                        <div className="pdf-file-info">
                                            <p className="pdf-file-name">{file.name}</p>
                                            {file.path !== file.name && (
                                                <p className="pdf-file-path">{file.path}</p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="pdf-modal-footer">
                        <button className="pdf-btn-cancel" onClick={onClose}>Cancel</button>
                        <button
                            className="pdf-btn-export"
                            onClick={handleExport}
                            disabled={!selected || loading}
                        >
                            <Download size={15} />
                            Export PDF
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

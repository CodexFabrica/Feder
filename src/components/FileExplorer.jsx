import React, { useState, useEffect } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, Image as ImageIcon, FileJson, ExternalLink } from 'lucide-react';

export function FileExplorer({ dirHandle, onFileSelect, currentFilename, mode, onOpenProject }) {
    const [files, setFiles] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState({});

    // Recursive function to scan directory
    const scanDirectory = async (handle) => {
        const entries = [];
        for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
                entries.push({
                    name: entry.name,
                    kind: 'file',
                    handle: entry
                });
            } else if (entry.kind === 'directory') {
                const children = await scanDirectory(entry);
                entries.push({
                    name: entry.name,
                    kind: 'directory',
                    handle: entry,
                    children: children
                });
            }
        }
        // Sort: Folders first, then files
        return entries.sort((a, b) => {
            if (a.kind === b.kind) return a.name.localeCompare(b.name);
            return a.kind === 'directory' ? -1 : 1;
        });
    };

    useEffect(() => {
        let mounted = true;

        const loadFiles = async () => {
            if (!dirHandle) {
                setFiles([]);
                return;
            }
            try {
                const tree = await scanDirectory(dirHandle);
                if (mounted) setFiles(tree);
            } catch (err) {
                console.error("Error scanning dir", err);
            }
        };

        loadFiles();

        return () => { mounted = false; };
    }, [dirHandle]);

    if (!dirHandle) {
        return (
            <div className="file-explorer-panel">
                <div className="panel-header">
                    <span className="panel-title">EXPLORER</span>
                </div>
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <p style={{ marginBottom: 4, fontWeight: 600 }}>No Project Open</p>
                        <p style={{ fontSize: '0.8rem' }}>Open a folder to see files, images, and bibliography together.</p>
                    </div>
                    {mode === 'researcher' && (
                        <button
                            onClick={onOpenProject}
                            style={{
                                padding: '6px 12px',
                                background: 'var(--accent-color)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            Open Project Folder
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const toggleFolder = (name) => {
        setExpandedFolders(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    };

    // Mock open in OS file explorer
    const openInExplorer = () => {
        if (!dirHandle) return;

        // Try to write to clipboard
        navigator.clipboard.writeText(dirHandle.name).then(() => {
            alert(`Copied path identifier to clipboard: "${dirHandle.name}"\n\n(Browser security prevents directly opening Windows Explorer. You can paste this in your file manager.)`);
        }, () => {
            alert(`Project: ${dirHandle.name}\n\n(Browser security prevents directly opening Windows Explorer.)`);
        });
    };

    const renderTree = (nodes, pathPrefix = '') => {
        return nodes.map(node => {
            if (node.kind === 'file' && node.name.endsWith('.bib') && mode !== 'researcher') {
                return null;
            }

            const path = `${pathPrefix}/${node.name}`;
            const isExpanded = expandedFolders[path];

            if (node.kind === 'directory') {
                return (
                    <div key={path} className="file-tree-node">
                        <div className="file-tree-item folder" onClick={() => toggleFolder(path)}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <Folder size={14} className="icon-folder" />
                            <span>{node.name}</span>
                        </div>
                        {isExpanded && (
                            <div className="file-tree-children">
                                {renderTree(node.children, path)}
                            </div>
                        )}
                    </div>
                );
            } else {
                let Icon = FileText;
                if (node.name.match(/\.(png|jpg|jpeg|svg|gif)$/i)) Icon = ImageIcon;
                if (node.name.endsWith('.bib')) Icon = FileJson;

                const isActive = currentFilename === node.name;

                return (
                    <div
                        key={path}
                        className={`file-tree-item file ${isActive ? 'active' : ''}`}
                        onClick={() => onFileSelect(node.handle)}
                    >
                        <span className="spacer" style={{ width: 14 }}></span>
                        <Icon size={14} />
                        <span>{node.name}</span>
                    </div>
                );
            }
        });
    };

    return (
        <div className="file-explorer-panel">
            <div className="panel-header">
                <span className="panel-title">EXPLORER</span>
                <button className="btn-icon small" title="Open in OS Explorer" onClick={openInExplorer}>
                    <ExternalLink size={14} />
                </button>
            </div>
            <div className="file-list">
                {renderTree(files)}
            </div>
        </div>
    );
}

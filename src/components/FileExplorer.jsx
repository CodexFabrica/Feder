import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, Image as ImageIcon, FileJson, ExternalLink, FilePlus, FolderPlus, Edit2, Check, X, Trash2, Plus } from 'lucide-react';
import { FiguresUploadModal } from './FiguresUploadModal';
import { ReferencesUploadModal } from './ReferencesUploadModal';

const SPECIAL_SECTIONS = [
    { key: 'notes', label: 'NOTES' },
    { key: 'ideas', label: 'IDEAS' },
    { key: 'figures', label: 'FIGURES' },
    { key: 'references', label: 'REFERENCES' }
];

function FileExplorerWrapper({
    dirHandle,
    onFileSelect,
    currentFilename,
    mode,
    onOpenProject,
    onRename,
    onDelete,
    onCreateFile,
    onCreateFolder,
    refreshTrigger,
    onRefresh,
    initialExpandedFolders = {},
    onExplorerStateChange,
    onMove,
    customOrder = {},
    onOrderChange,
    projectMetadata
}) {
    const activeSpecialSections = useMemo(() => {
        const enableReferences = projectMetadata?.enableReferences !== false;
        const isReferencesMode = mode === 'researcher' || mode === 'engineer' || mode === 'scholar';
        return SPECIAL_SECTIONS.filter(section => {
            if (section.key === 'references') {
                return enableReferences && isReferencesMode;
            }
            return true;
        });
    }, [mode, projectMetadata?.enableReferences]);

    const [files, setFiles] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState(initialExpandedFolders);
    const [editingPath, setEditingPath] = useState(null);
    const [tempName, setTempName] = useState('');
    const [draggedNode, setDraggedNode] = useState(null);
    const [draggedPath, setDraggedPath] = useState(null);
    const [dropTarget, setDropTarget] = useState(null); // { path, position: 'before' | 'after' | 'inside' }
    const [bottomSectionsOpen, setBottomSectionsOpen] = useState({
        notes: false,
        ideas: false,
        figures: false,
        references: false
    });
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFolderHandle, setUploadFolderHandle] = useState(null);
    const [showReferencesModal, setShowReferencesModal] = useState(false);
    const [referencesFolderHandle, setReferencesFolderHandle] = useState(null);

    // Sync expanded state when initial prop changes (usually on project open)
    useEffect(() => {
        if (initialExpandedFolders && Object.keys(initialExpandedFolders).length > 0) {
            setExpandedFolders(initialExpandedFolders);
        }
    }, [initialExpandedFolders]);

    // Sort nodes using custom order if available
    const sortNodes = useCallback((nodes, parentPath = '') => {
        const orderKey = parentPath || '/';
        const order = customOrder[orderKey] || [];

        // Create a map for quick lookup
        const orderMap = new Map();
        order.forEach((name, index) => orderMap.set(name, index));

        return [...nodes].sort((a, b) => {
            const aIndex = orderMap.has(a.name) ? orderMap.get(a.name) : Infinity;
            const bIndex = orderMap.has(b.name) ? orderMap.get(b.name) : Infinity;

            // If both have custom order, use it
            if (aIndex !== Infinity && bIndex !== Infinity) {
                return aIndex - bIndex;
            }

            // If only one has custom order, it comes first
            if (aIndex !== Infinity) return -1;
            if (bIndex !== Infinity) return 1;

            // Fallback: folders first, then alphabetical
            if (a.kind === b.kind) return a.name.localeCompare(b.name);
            return a.kind === 'directory' ? -1 : 1;
        });
    }, [customOrder]);

    // Recursive function to scan directory
    const scanDirectory = async (handle, parentPath = '') => {
        const entries = [];
        for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
                entries.push({
                    name: entry.name,
                    kind: 'file',
                    handle: entry
                });
            } else if (entry.kind === 'directory') {
                const childPath = parentPath ? `${parentPath}/${entry.name}` : `/${entry.name}`;
                const children = await scanDirectory(entry, childPath);
                entries.push({
                    name: entry.name,
                    kind: 'directory',
                    handle: entry,
                    children: children
                });
            }
        }
        return sortNodes(entries, parentPath);
    };

    useEffect(() => {
        let mounted = true;

        const loadFiles = async () => {
            if (!dirHandle) {
                setFiles([]);
                return;
            }
            try {
                const tree = await scanDirectory(dirHandle, '');
                if (mounted) setFiles(tree);
            } catch (err) {
                console.error("Error scanning dir", err);
            }
        };

        loadFiles();

        return () => { mounted = false; };
    }, [dirHandle, refreshTrigger, sortNodes]);

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
        const next = {
            ...expandedFolders,
            [name]: !expandedFolders[name]
        };
        setExpandedFolders(next);
        if (onExplorerStateChange) {
            onExplorerStateChange({ expandedFolders: next });
        }
    };

    // Open in OS file explorer
    const openInExplorer = async () => {
        if (!dirHandle) return;

        if (window.electronAPI && window.electronAPI.isElectron) {
            const targetPath = dirHandle.path;
            if (targetPath) {
                try {
                    await window.electronAPI.openPath(targetPath);
                    return;
                } catch (err) {
                    console.error("Failed to open path natively in OS explorer", err);
                }
            }
        }

        // Fallback for browser mode
        navigator.clipboard.writeText(dirHandle.name).then(() => {
            alert(`Copied path identifier to clipboard: "${dirHandle.name}"\n\n(Browser security prevents directly opening Windows Explorer. You can paste this in your file manager.)`);
        }, () => {
            alert(`Project: ${dirHandle.name}\n\n(Browser security prevents directly opening Windows Explorer.)`);
        });
    };

    const { mainFiles, specialFolders } = useMemo(() => {
        const sectionsByName = Object.fromEntries(activeSpecialSections.map(section => [section.key, null]));
        const regular = [];

        for (const node of files) {
            if (node.kind === 'directory' && Object.prototype.hasOwnProperty.call(sectionsByName, node.name.toLowerCase())) {
                sectionsByName[node.name.toLowerCase()] = node;
                continue;
            }
            regular.push(node);
        }

        return { mainFiles: regular, specialFolders: sectionsByName };
    }, [files, activeSpecialSections]);

    const toggleBottomSection = (section) => {
        setBottomSectionsOpen((prev) => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const handleCreateFileInFolder = async (folderHandle, folderPath, suggestedName = 'newfile.md') => {
        if (!onCreateFile) return;
        await onCreateFile(folderHandle, folderPath, suggestedName);
    };

    const handleCreateFolderInFolder = async (folderHandle, folderPath) => {
        if (!onCreateFolder) return;
        await onCreateFolder(folderHandle, folderPath);
    };

    const handleDragStart = (e, node, path, parentPath) => {
        e.stopPropagation();
        setDraggedNode(node);
        setDraggedPath({ path, parentPath });
        e.dataTransfer.effectAllowed = 'copyMove';
        e.dataTransfer.setData('application/json', JSON.stringify({
            name: node.name,
            path: path.startsWith('/') ? path.slice(1) : path
        }));
    };

    const handleDragEnd = () => {
        setDraggedNode(null);
        setDraggedPath(null);
        setDropTarget(null);
    };

    const handleDragOver = (e, path, parentPath, isFolder = false) => {
        e.preventDefault();
        e.stopPropagation();

        if (!draggedNode) return;

        // Calculate drop position based on mouse position within the element
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        let position;
        if (isFolder && y > height * 0.25 && y < height * 0.75) {
            position = 'inside';
        } else if (y < height / 2) {
            position = 'before';
        } else {
            position = 'after';
        }

        setDropTarget({ path, parentPath, position });
    };

    const handleDragLeave = (e) => {
        // Only clear if leaving the entire element
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDropTarget(null);
        }
    };

    const handleDrop = async (e, targetPath, targetParentPath, targetNode) => {
        e.preventDefault();
        e.stopPropagation();

        if (!draggedNode || !draggedPath) {
            setDropTarget(null);
            return;
        }

        const position = dropTarget?.position || 'after';

        // Prevent dropping on itself
        if (draggedPath.path === targetPath) {
            setDropTarget(null);
            handleDragEnd();
            return;
        }

        // If dropping inside a folder, move the item
        if (position === 'inside' && targetNode?.kind === 'directory') {
            if (onMove) {
                await onMove(draggedNode.handle, targetNode.handle);
            }
        } else {
            // Reordering within the same parent
            const sourceParent = draggedPath.parentPath || '/';
            const targetParent = targetParentPath || '/';

            if (sourceParent === targetParent && onOrderChange) {
                // Get current order for this parent
                const currentOrder = customOrder[sourceParent] || [];
                const siblings = files.filter(n => true); // Will be refined based on parent

                // Calculate new order
                const newOrder = reorderItems(
                    sourceParent,
                    draggedNode.name,
                    targetNode?.name || null,
                    position,
                    currentOrder,
                    getAllItemNamesInPath(sourceParent)
                );

                onOrderChange(sourceParent, newOrder);
            } else if (sourceParent !== targetParent) {
                // Moving to a different parent - need to both move and update order
                // First, determine the target directory handle
                let targetDirHandle = dirHandle;
                if (targetParent !== '/') {
                    // Navigate to target parent
                    const parts = targetParent.split('/').filter(Boolean);
                    for (const part of parts) {
                        targetDirHandle = await targetDirHandle.getDirectoryHandle(part);
                    }
                }

                if (onMove) {
                    await onMove(draggedNode.handle, targetDirHandle);
                }

                // Update order in target parent
                if (onOrderChange) {
                    const targetOrder = customOrder[targetParent] || [];
                    const insertIndex = position === 'before'
                        ? targetOrder.indexOf(targetNode?.name || '')
                        : targetOrder.indexOf(targetNode?.name || '') + 1;

                    const newOrder = [...targetOrder];
                    if (insertIndex >= 0 && insertIndex <= newOrder.length) {
                        newOrder.splice(insertIndex, 0, draggedNode.name);
                    } else {
                        newOrder.push(draggedNode.name);
                    }
                    onOrderChange(targetParent, newOrder);
                }
            }
        }

        setDropTarget(null);
        handleDragEnd();
    };

    // Helper to get all item names in a specific path
    const getAllItemNamesInPath = (parentPath) => {
        if (parentPath === '/' || parentPath === '') {
            return mainFiles.map(f => f.name);
        }

        // Navigate to the parent folder
        const parts = parentPath.split('/').filter(Boolean);
        let current = files;
        for (const part of parts) {
            const folder = current.find(n => n.kind === 'directory' && n.name === part);
            if (folder && folder.children) {
                current = folder.children;
            } else {
                return [];
            }
        }
        return current.map(f => f.name);
    };

    // Reorder logic
    const reorderItems = (parentPath, draggedName, targetName, position, currentOrder, allNames) => {
        // Build complete order list
        let orderedNames = [...allNames];

        // Sort by current custom order if exists
        if (currentOrder.length > 0) {
            orderedNames.sort((a, b) => {
                const aIdx = currentOrder.indexOf(a);
                const bIdx = currentOrder.indexOf(b);
                if (aIdx === -1 && bIdx === -1) return 0;
                if (aIdx === -1) return 1;
                if (bIdx === -1) return -1;
                return aIdx - bIdx;
            });
        }

        // Remove dragged item from its current position
        orderedNames = orderedNames.filter(n => n !== draggedName);

        // Find target index
        let targetIndex = targetName ? orderedNames.indexOf(targetName) : orderedNames.length;
        if (targetIndex === -1) targetIndex = orderedNames.length;

        // Insert at new position
        if (position === 'after') {
            targetIndex += 1;
        }

        orderedNames.splice(targetIndex, 0, draggedName);

        return orderedNames;
    };

    const renderDropIndicator = (position) => {
        if (position === 'inside') return null;
        return (
            <div
                className={`drop-indicator ${position}`}
                style={{
                    position: 'absolute',
                    left: 16,
                    right: 16,
                    height: 2,
                    background: 'var(--accent-color)',
                    borderRadius: 1,
                    [position === 'before' ? 'top' : 'bottom']: -1,
                    zIndex: 10
                }}
            />
        );
    };

    const renderTree = (nodes, pathPrefix = '') => {
        return nodes.map((node, index) => {
            const path = `${pathPrefix}/${node.name}`;

            if (node.kind === 'file') {
                if (node.name === 'project_metadata.json') return null;
                const enableReferences = projectMetadata?.enableReferences !== false;
                const isReferencesMode = mode === 'researcher' || mode === 'engineer' || mode === 'scholar';
                if (node.name.endsWith('.bib')) {
                    if (!enableReferences || !isReferencesMode) {
                        return null;
                    }
                }
            }

            const isExpanded = expandedFolders[path];
            const isDropTarget = dropTarget?.path === path;
            const dropPosition = isDropTarget ? dropTarget.position : null;

            if (node.kind === 'directory') {
                const isEditing = editingPath === path;
                return (
                    <div key={path} className="file-tree-node">
                        <div
                            className={`file-tree-item folder ${isDropTarget && dropPosition === 'inside' ? 'drop-target-inside' : ''}`}
                            onClick={() => !isEditing && toggleFolder(path)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, node, path, pathPrefix)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, path, pathPrefix, true)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, path, pathPrefix, node)}
                            style={{ position: 'relative' }}
                        >
                            {isDropTarget && dropPosition === 'before' && renderDropIndicator('before')}
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <Folder size={14} className="icon-folder" />
                            {isEditing ? (
                                <input
                                    autoFocus
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            onRename(node.handle, tempName, pathPrefix);
                                            setEditingPath(null);
                                        } else if (e.key === 'Escape') {
                                            setEditingPath(null);
                                        }
                                    }}
                                    onBlur={() => setEditingPath(null)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        background: 'var(--bg-app)',
                                        border: '1px solid var(--accent-color)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                        width: '100%',
                                        outline: 'none'
                                    }}
                                />
                            ) : (
                                <>
                                    <span style={{ flex: 1 }}>{node.name}</span>
                                    <div className="explorer-actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="btn-icon small"
                                            title="New File in Folder"
                                            onClick={() => handleCreateFileInFolder(node.handle, path, node.name.toLowerCase() === 'references' ? 'references.bib' : 'newfile.md')}
                                        >
                                            <FilePlus size={12} />
                                        </button>
                                        <button
                                            className="btn-icon small"
                                            title="New Subfolder"
                                            onClick={() => handleCreateFolderInFolder(node.handle, path)}
                                        >
                                            <FolderPlus size={12} />
                                        </button>
                                        <button className="btn-icon small" title="Rename" onClick={() => {
                                            setEditingPath(path);
                                            setTempName(node.name);
                                        }}>
                                            <Edit2 size={12} />
                                        </button>
                                        <button className="btn-icon small" title="Delete" onClick={() => {
                                            if (window.confirm(`Are you sure you want to delete the folder "${node.name}" and all its contents?`)) {
                                                onDelete(node.handle);
                                            }
                                        }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </>
                            )}
                            {isDropTarget && dropPosition === 'after' && renderDropIndicator('after')}
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

                const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
                const isActive = currentFilename === normalizedPath;
                const isEditing = editingPath === path;

                return (
                    <div
                        key={path}
                        className={`file-tree-item file ${isActive ? 'active' : ''}`}
                        onClick={() => !isEditing && onFileSelect(node.handle, path)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, node, path, pathPrefix)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, path, pathPrefix, false)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, path, pathPrefix, node)}
                        style={{ position: 'relative' }}
                    >
                        {isDropTarget && dropPosition === 'before' && renderDropIndicator('before')}
                        <Icon size={14} />
                        {isEditing ? (
                            <input
                                autoFocus
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        onRename(node.handle, tempName, pathPrefix);
                                        setEditingPath(null);
                                    } else if (e.key === 'Escape') {
                                        setEditingPath(null);
                                    }
                                }}
                                onBlur={() => setEditingPath(null)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <>
                                <span style={{ flex: 1 }}>{node.name}</span>
                                <div className="explorer-actions" onClick={(e) => e.stopPropagation()}>
                                    <button className="btn-icon small" title="Rename" onClick={() => {
                                        setEditingPath(path);
                                        setTempName(node.name);
                                    }}>
                                        <Edit2 size={12} />
                                    </button>
                                    <button className="btn-icon small" title="Delete" onClick={() => {
                                        if (window.confirm(`Are you sure you want to delete ${node.name}?`)) {
                                            onDelete(node.handle);
                                        }
                                    }}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </>
                        )}
                        {isDropTarget && dropPosition === 'after' && renderDropIndicator('after')}
                    </div>
                );
            }
        });
    };

    return (
        <div className="file-explorer-panel">
            <div className="panel-header">
                <span className="panel-title">EXPLORER</span>
                <div className="explorer-actions">
                    <button className="btn-icon small" title="New File" onClick={() => onCreateFile()}>
                        <FilePlus size={14} />
                    </button>
                    <button className="btn-icon small" title="New Folder" onClick={() => onCreateFolder()}>
                        <FolderPlus size={14} />
                    </button>
                    <button className="btn-icon small" title="Open in OS Explorer" onClick={openInExplorer}>
                        <ExternalLink size={14} />
                    </button>
                </div>
            </div>
            <div className="file-explorer-content">
                <div
                    className="file-list"
                    onDragOver={(e) => {
                        e.preventDefault();
                        // Allow dropping at the end of the main list
                        if (draggedNode && mainFiles.length > 0) {
                            const lastFile = mainFiles[mainFiles.length - 1];
                            setDropTarget({ path: `/${lastFile.name}`, parentPath: '', position: 'after' });
                        }
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        if (draggedNode && dropTarget) {
                            handleDrop(e, dropTarget.path, '', null);
                        } else if (draggedNode && onMove) {
                            // Fallback: move to root
                            onMove(draggedNode.handle, dirHandle);
                        }
                        handleDragEnd();
                    }}
                >
                    {renderTree(mainFiles)}
                </div>

                {activeSpecialSections.some((section) => !!specialFolders[section.key]) && (
                    <div className="explorer-bottom-sections">
                        {activeSpecialSections.map((section) => {
                            const folderNode = specialFolders[section.key];
                            if (!folderNode) return null;

                            return (
                                <div className="explorer-bottom-section" key={section.key}>
                                    <div className="explorer-bottom-header">
                                        <button
                                            className="explorer-bottom-toggle"
                                            onClick={() => toggleBottomSection(section.key)}
                                            type="button"
                                        >
                                            {bottomSectionsOpen[section.key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <span>{section.label}</span>
                                        </button>
                                        <div className="explorer-actions" onClick={(e) => e.stopPropagation()}>
                                            {section.key === 'figures' && (
                                                <button
                                                    className="btn-icon small"
                                                    title="Upload Image/File"
                                                    onClick={() => {
                                                        setUploadFolderHandle(folderNode.handle);
                                                        setShowUploadModal(true);
                                                    }}
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            )}
                                            {section.key === 'references' && (
                                                <button
                                                    className="btn-icon small"
                                                    title="Add BibTeX Reference(s)"
                                                    onClick={() => {
                                                        setReferencesFolderHandle(folderNode.handle);
                                                        setShowReferencesModal(true);
                                                    }}
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            )}
                                            {section.key !== 'figures' && (
                                                <button
                                                    className="btn-icon small"
                                                    title={`New File in ${folderNode.name}`}
                                                    onClick={() => handleCreateFileInFolder(folderNode.handle, `/${folderNode.name}`, section.key === 'references' ? 'references.bib' : 'newfile.md')}
                                                >
                                                    <FilePlus size={12} />
                                                </button>
                                            )}
                                            <button
                                                className="btn-icon small"
                                                title={`New Folder in ${folderNode.name}`}
                                                onClick={() => handleCreateFolderInFolder(folderNode.handle, `/${folderNode.name}`)}
                                            >
                                                <FolderPlus size={12} />
                                            </button>
                                        </div>
                                    </div>

                                    {bottomSectionsOpen[section.key] && (
                                        <div className="explorer-bottom-content file-list">
                                            {renderTree(folderNode.children || [], `/${folderNode.name}`)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {showUploadModal && (
                <FiguresUploadModal
                    dirHandle={uploadFolderHandle}
                    onClose={() => setShowUploadModal(false)}
                    onUploadSuccess={() => {
                        setShowUploadModal(false);
                        onRefresh?.();
                    }}
                />
            )}
            {showReferencesModal && (
                <ReferencesUploadModal
                    dirHandle={referencesFolderHandle}
                    onClose={() => setShowReferencesModal(false)}
                    onUploadSuccess={() => {
                        setShowReferencesModal(false);
                        onRefresh?.();
                    }}
                />
            )}
        </div>
    );
}

export const FileExplorer = React.memo(FileExplorerWrapper);

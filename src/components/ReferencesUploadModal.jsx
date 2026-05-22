import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, FileText, Check, Sparkles, Plus } from 'lucide-react';

/**
 * ReferencesUploadModal component allows pasting BibTeX entries and saving/appending
 * them to a .bib file inside the references/ folder.
 */
export function ReferencesUploadModal({ dirHandle, onClose, onUploadSuccess }) {
    const [pastedText, setPastedText] = useState('');
    const [bibFiles, setBibFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState('');
    const [newFileName, setNewFileName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const overlayRef = useRef(null);

    // Scan for existing .bib files inside references folder on mount
    useEffect(() => {
        const scanBibFiles = async () => {
            if (!dirHandle) return;
            try {
                const files = [];
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.bib')) {
                        files.push(entry.name);
                    }
                }
                files.sort((a, b) => a.localeCompare(b));
                setBibFiles(files);
                
                if (files.length > 0) {
                    setSelectedFile(files[0]);
                } else {
                    setSelectedFile('__new__');
                }
            } catch (err) {
                console.error("Error scanning references folder", err);
            }
        };

        scanBibFiles();
    }, [dirHandle]);

    const handleSave = async () => {
        if (!pastedText.trim()) {
            alert("Please paste one or multiple BibTeX entries first.");
            return;
        }
        if (!dirHandle) {
            alert("No references folder handle detected.");
            return;
        }

        setIsSaving(true);
        try {
            let targetName = selectedFile;
            let isNew = false;

            if (selectedFile === '__new__') {
                let name = newFileName.trim();
                if (!name) {
                    alert("Please enter a name for the new file.");
                    setIsSaving(false);
                    return;
                }
                if (!name.endsWith('.bib')) {
                    name += '.bib';
                }
                targetName = name;
                isNew = true;
            }

            // Get or create the file handle
            const fileHandle = await dirHandle.getFileHandle(targetName, { create: true });
            
            let existingText = '';
            if (!isNew) {
                try {
                    const fileObj = await fileHandle.getFile();
                    existingText = await fileObj.text();
                } catch (e) {
                    console.log("Could not read existing file, treating as new", e);
                }
            }

            // Cleanly construct the new content
            let finalContent = existingText;
            if (finalContent.trim()) {
                // Ensure a nice gap between entries
                if (!finalContent.endsWith('\n')) {
                    finalContent += '\n';
                }
                if (!finalContent.endsWith('\n\n')) {
                    finalContent += '\n';
                }
            }
            finalContent += pastedText.trim() + '\n';

            // Write the updated content
            const writable = await fileHandle.createWritable();
            await writable.write(finalContent);
            await writable.close();

            onUploadSuccess();
        } catch (err) {
            console.error("Failed to save reference(s)", err);
            alert("Failed to save reference(s): " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const placeholderExample = `@book{hawking1988,
    title = "A Brief History of Time: From the Big Bang to Black Holes",
    author = "Hawking, Stephen",
    year = 1988,
    publisher = "Bantam",
    address = "London"
}`;

    return (
        <>
            <style>{`
                .ref-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.45);
                    backdrop-filter: blur(8px);
                    z-index: 9500;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: refFadeIn 0.2s ease-out;
                }
                @keyframes refFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .ref-modal-box {
                    background: var(--bg-panel);
                    border: 1px solid var(--border-color);
                    border-radius: 24px;
                    width: 520px;
                    max-width: 90vw;
                    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    animation: refSlideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes refSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .ref-modal-header {
                    padding: 24px 28px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .ref-title {
                    font-size: 1.15rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .ref-close-btn {
                    background: var(--bg-app);
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                    width: 32px;
                    height: 32px;
                    border-radius: 10px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .ref-close-btn:hover {
                    background: var(--hover-bg);
                    color: var(--text-primary);
                }

                .ref-modal-body {
                    padding: 0 28px 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .form-label {
                    font-size: 0.76rem;
                    font-weight: 700;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                
                .ref-select, .ref-input {
                    background: var(--bg-app);
                    border: 1.5px solid var(--border-color);
                    border-radius: 10px;
                    padding: 10px 12px;
                    color: var(--text-primary);
                    font-size: 0.9rem;
                    outline: none;
                    transition: border-color 0.2s;
                    width: 100%;
                    box-sizing: border-box;
                }
                .ref-select:focus, .ref-input:focus {
                    border-color: var(--accent-color);
                }

                .ref-textarea {
                    background: var(--bg-app);
                    border: 1.5px solid var(--border-color);
                    border-radius: 12px;
                    padding: 12px;
                    color: var(--text-primary);
                    font-family: 'Fira Code', 'Courier New', Courier, monospace;
                    font-size: 0.82rem;
                    line-height: 1.5;
                    outline: none;
                    resize: vertical;
                    min-height: 160px;
                    max-height: 300px;
                    transition: border-color 0.2s;
                    width: 100%;
                    box-sizing: border-box;
                }
                .ref-textarea:focus {
                    border-color: var(--accent-color);
                }

                .ref-modal-footer {
                    display: flex;
                    gap: 12px;
                    margin-top: 4px;
                }
                .ref-btn {
                    flex: 1;
                    padding: 11px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .ref-btn.primary {
                    background: var(--accent-color);
                    border: none;
                    color: white;
                }
                .ref-btn.primary:hover:not(:disabled) {
                    opacity: 0.9;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(var(--accent-color-rgb), 0.35);
                }
                .ref-btn.primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .ref-btn.secondary {
                    background: transparent;
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                }
                .ref-btn.secondary:hover {
                    background: var(--hover-bg);
                    color: var(--text-primary);
                }
            `}</style>

            <div className="ref-modal-overlay" onClick={onClose} ref={overlayRef}>
                <div className="ref-modal-box" onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div className="ref-modal-header">
                        <p className="ref-title">
                            <Sparkles size={16} color="var(--accent-color)" />
                            Add BibTeX Reference(s)
                        </p>
                        <button className="ref-close-btn" onClick={onClose} title="Close">
                            <X size={15} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="ref-modal-body">
                        {/* Target Selection */}
                        <div className="form-group">
                            <label className="form-label">Save/Append to File</label>
                            <select 
                                className="ref-select" 
                                value={selectedFile}
                                onChange={(e) => setSelectedFile(e.target.value)}
                            >
                                {bibFiles.map(file => (
                                    <option key={file} value={file}>{file}</option>
                                ))}
                                <option value="__new__">+ Create new .bib file...</option>
                            </select>
                        </div>

                        {/* New File Name input */}
                        {selectedFile === '__new__' && (
                            <div className="form-group" style={{ animation: 'refFadeIn 0.2s ease-out' }}>
                                <label className="form-label">New BibTeX File Name</label>
                                <input
                                    type="text"
                                    className="ref-input"
                                    placeholder="e.g. books.bib"
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        )}

                        {/* Textarea Input */}
                        <div className="form-group">
                            <label className="form-label">Paste BibTeX Entry / Entries</label>
                            <textarea
                                className="ref-textarea"
                                placeholder={placeholderExample}
                                value={pastedText}
                                onChange={(e) => setPastedText(e.target.value)}
                                autoFocus={selectedFile !== '__new__'}
                            />
                        </div>

                        {/* Footer Controls */}
                        <div className="ref-modal-footer">
                            <button className="ref-btn secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className="ref-btn primary"
                                onClick={handleSave}
                                disabled={!pastedText.trim() || isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save & Import'}
                                {!isSaving && <Check size={15} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

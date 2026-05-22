import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image as ImageIcon, FileText, Check, Sparkles } from 'lucide-react';

/**
 * FiguresUploadModal component allows dragging and dropping, pasting, or picking
 * images to save inside the project's figures/ folder.
 */
export function FiguresUploadModal({ dirHandle, onClose, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [fileName, setFileName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const setLoadedFile = (newFile) => {
        setFile(newFile);
        setFileName(newFile.name);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(URL.createObjectURL(newFile));
    };

    // Clean up previewUrl on unmount
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    // Clipboard Paste Listener (Ctrl+V) when modal is open
    useEffect(() => {
        const handlePaste = (e) => {
            if (!e.clipboardData || !e.clipboardData.items) return;
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const pastedFile = items[i].getAsFile();
                    if (pastedFile) {
                        // Create a descriptive default name with timestamp
                        const now = new Date();
                        const pad = (n) => String(n).padStart(2, '0');
                        const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
                        const name = `pasted_${timestamp}.png`;
                        const fileWithName = new File([pastedFile], name, { type: pastedFile.type });
                        setLoadedFile(fileWithName);
                        e.preventDefault();
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [previewUrl]);

    // Drag-and-drop handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        // 1. Check for standard files dropped (local files)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type.startsWith('image/')) {
                setLoadedFile(droppedFile);
            } else {
                alert("Please drop an image file.");
            }
            return;
        }

        // 2. Extract dropped image URL (e.g. from another browser tab)
        const droppedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        const htmlData = e.dataTransfer.getData('text/html');

        let urlToFetch = droppedUrl;
        if (!urlToFetch && htmlData) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlData, 'text/html');
            const img = doc.querySelector('img');
            if (img && img.src) {
                urlToFetch = img.src;
            }
        }

        if (urlToFetch) {
            try {
                // If it is a base64 DataURL, load directly
                if (urlToFetch.startsWith('data:')) {
                    const response = await fetch(urlToFetch);
                    const blob = await response.blob();
                    const mime = blob.type;
                    const extension = mime.split('/')[1] || 'png';
                    const fetchedFile = new File([blob], `dragged_image.${extension}`, { type: mime });
                    setLoadedFile(fetchedFile);
                    return;
                }

                // Fetch the external image URL
                const response = await fetch(urlToFetch);
                const blob = await response.blob();
                const mime = blob.type;
                const extension = mime.split('/')[1] || 'png';
                const fetchedFile = new File([blob], `dragged_image.${extension}`, { type: mime });
                setLoadedFile(fetchedFile);
            } catch (err) {
                console.error("CORS or network error fetching dragged image URL:", err);
                alert("Could not fetch the image from that URL due to browser security restrictions.\n\nTip: You can right-click the image in your browser, select 'Copy Image', and then paste it directly (Ctrl+V) into this window!");
            }
        }
    };

    // Standard File Input Pick
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setLoadedFile(e.target.files[0]);
        }
    };

    // Final save/upload to folder Node handle
    const handleUpload = async () => {
        if (!file || !dirHandle) return;
        setIsUploading(true);

        try {
            // Validate name has an extension, if not, append original one
            let finalName = fileName.trim();
            if (!finalName) {
                alert("Please enter a valid file name.");
                setIsUploading(false);
                return;
            }

            const hasExtension = finalName.match(/\.[a-zA-Z0-9]+$/);
            if (!hasExtension) {
                const origExt = file.name.match(/\.[a-zA-Z0-9]+$/);
                finalName += origExt ? origExt[0] : '.png';
            }

            // Native browser File System access save
            const fileHandle = await dirHandle.getFileHandle(finalName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(file);
            await writable.close();

            onUploadSuccess();
        } catch (e) {
            console.error("Upload failed", e);
            alert("Upload failed: " + e.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <style>{`
                .upload-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.45);
                    backdrop-filter: blur(8px);
                    z-index: 9500;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: uploadFadeIn 0.2s ease-out;
                }
                @keyframes uploadFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .upload-modal-box {
                    background: var(--bg-panel);
                    border: 1px solid var(--border-color);
                    border-radius: 24px;
                    width: 440px;
                    max-width: 90vw;
                    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    animation: uploadSlideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes uploadSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .upload-modal-header {
                    padding: 24px 28px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .upload-title {
                    font-size: 1.15rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .upload-close-btn {
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
                .upload-close-btn:hover {
                    background: var(--hover-bg);
                    color: var(--text-primary);
                }

                .upload-modal-body {
                    padding: 0 28px 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .dropzone-container {
                    border: 2px dashed var(--border-color);
                    border-radius: 16px;
                    padding: 32px 20px;
                    text-align: center;
                    cursor: pointer;
                    background: rgba(var(--accent-color-rgb), 0.01);
                    transition: all 0.2s ease-in-out;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    outline: none;
                    position: relative;
                }
                .dropzone-container:hover {
                    border-color: var(--accent-color);
                    background: rgba(var(--accent-color-rgb), 0.03);
                }
                .dropzone-container.dragging {
                    border-color: var(--accent-color);
                    background: rgba(var(--accent-color-rgb), 0.08);
                    box-shadow: inset 0 0 12px rgba(var(--accent-color-rgb), 0.15);
                    transform: scale(0.985);
                }

                .dropzone-icon {
                    color: var(--text-secondary);
                    transition: color 0.2s;
                }
                .dropzone-container:hover .dropzone-icon,
                .dropzone-container.dragging .dropzone-icon {
                    color: var(--accent-color);
                }

                .dropzone-text-primary {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 0;
                }
                .dropzone-text-secondary {
                    font-size: 0.76rem;
                    color: var(--text-secondary);
                    margin: 0;
                    line-height: 1.4;
                }

                .upload-preview-area {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 16px;
                    background: var(--bg-app);
                }

                .preview-image-wrapper {
                    width: 100%;
                    max-height: 180px;
                    border-radius: 10px;
                    overflow: hidden;
                    background: #121212;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--border-color);
                    position: relative;
                }

                .preview-image {
                    max-width: 100%;
                    max-height: 180px;
                    object-fit: contain;
                }

                .preview-meta {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.72rem;
                    color: var(--text-secondary);
                    font-weight: 600;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 10px;
                }

                .rename-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .rename-label {
                    font-size: 0.76rem;
                    font-weight: 700;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .rename-input {
                    background: var(--bg-panel);
                    border: 1.5px solid var(--border-color);
                    border-radius: 10px;
                    padding: 9px 12px;
                    color: var(--text-primary);
                    font-size: 0.88rem;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .rename-input:focus {
                    border-color: var(--accent-color);
                }

                .upload-modal-footer {
                    display: flex;
                    gap: 12px;
                    margin-top: 4px;
                }
                .upload-btn {
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
                .upload-btn.primary {
                    background: var(--accent-color);
                    border: none;
                    color: white;
                }
                .upload-btn.primary:hover:not(:disabled) {
                    opacity: 0.9;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(var(--accent-color-rgb), 0.35);
                }
                .upload-btn.primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .upload-btn.secondary {
                    background: transparent;
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                }
                .upload-btn.secondary:hover {
                    background: var(--hover-bg);
                    color: var(--text-primary);
                }
            `}</style>

            <div className="upload-modal-overlay" onClick={onClose}>
                <div className="upload-modal-box" onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div className="upload-modal-header">
                        <p className="upload-title">
                            <Sparkles size={16} color="var(--accent-color)" />
                            Upload Asset
                        </p>
                        <button className="upload-close-btn" onClick={onClose} title="Close">
                            <X size={15} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="upload-modal-body">
                        {!file ? (
                            // Dropzone Area
                            <div
                                className={`dropzone-container ${isDragging ? 'dragging' : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                <Upload size={32} className="dropzone-icon" />
                                <p className="dropzone-text-primary">Drag & drop image here</p>
                                <p className="dropzone-text-secondary">
                                    or paste directly (Ctrl+V) from browser<br />
                                    or click to browse from device
                                </p>
                            </div>
                        ) : (
                            // Loaded Preview & Rename Area
                            <div className="upload-preview-area">
                                <div className="preview-image-wrapper">
                                    <img src={previewUrl} className="preview-image" alt="Upload preview" />
                                </div>
                                <div className="preview-meta">
                                    <span>Type: {file.type.split('/')[1]?.toUpperCase() || 'IMAGE'}</span>
                                    <span>Size: {Math.round(file.size / 1024)} KB</span>
                                </div>
                                <div className="rename-group">
                                    <label className="rename-label">Asset File Name</label>
                                    <input
                                        type="text"
                                        className="rename-input"
                                        value={fileName}
                                        onChange={(e) => setFileName(e.target.value)}
                                        placeholder="Enter name (e.g. diagram.png)"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        )}

                        {/* Footer Controls */}
                        <div className="upload-modal-footer">
                            <button className="upload-btn secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className="upload-btn primary"
                                onClick={handleUpload}
                                disabled={!file || isUploading}
                            >
                                {isUploading ? 'Uploading...' : 'Upload'}
                                {!isUploading && <Check size={15} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

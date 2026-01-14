import { useState, useCallback } from 'react';

export function useFileSystem() {
    const [fileHandle, setFileHandle] = useState(null);
    const [dirHandle, setDirHandle] = useState(null);
    const [isModified, setIsModified] = useState(false);

    // Helper to read content from a handle
    const readFile = async (handle) => {
        const file = await handle.getFile();
        const text = await file.text();
        return { text, name: file.name, lastModified: file.lastModified };
    };

    const openFile = useCallback(async () => {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Markdown Files',
                    accept: { 'text/markdown': ['.md'] },
                }],
                multiple: false,
            });
            const content = await readFile(handle);
            setFileHandle(handle);
            setDirHandle(null); // Reset directory if single file opened
            setIsModified(false);
            return content;
        } catch (err) {
            if (err.name !== 'AbortError') console.error(err);
            return null;
        }
    }, []);

    const saveFile = useCallback(async (content, handle = fileHandle) => {
        if (!handle) return saveFileAs(content);
        try {
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            setIsModified(false);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    }, [fileHandle]);

    const saveFileAs = useCallback(async (content) => {
        try {
            const handle = await window.showSaveFilePicker({
                types: [{
                    description: 'Markdown Files',
                    accept: { 'text/markdown': ['.md'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            setFileHandle(handle);
            setIsModified(false);
            return true;
        } catch (err) {
            if (err.name !== 'AbortError') console.error(err);
            return false;
        }
    }, []);

    // Directory handling for Researcher Mode
    const openDirectory = useCallback(async () => {
        try {
            const handle = await window.showDirectoryPicker();
            setDirHandle(handle);
            // Try to find index.md or main.md, or just leave it to user to select?
            // For now, return the handle so UI can decide.
            return handle;
        } catch (err) {
            if (err.name !== 'AbortError') console.error(err);
            return null;
        }
    }, []);

    // Read file from directory
    const readFileInDir = useCallback(async (dir, filename) => {
        try {
            const fileHandle = await dir.getFileHandle(filename);
            return await readFile(fileHandle);
        } catch (err) {
            // File might not exist
            return null;
        }
    }, []);

    // Write file to directory
    const writeFileInDir = useCallback(async (dir, filename, content) => {
        try {
            const fileHandle = await dir.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            return fileHandle;
        } catch (err) {
            console.error(err);
            return null;
        }
    }, []);

    // Create subdirectory
    const createSubDir = useCallback(async (dir, dirname) => {
        try {
            return await dir.getDirectoryHandle(dirname, { create: true });
        } catch (err) {
            console.error(err);
            return null;
        }
    }, []);

    return {
        fileHandle,
        dirHandle,
        isModified,
        setIsModified,
        openFile,
        saveFile,
        saveFileAs,
        openDirectory,
        readFileInDir,
        writeFileInDir,
        createSubDir,
        setFileHandle,
        setDirHandle,
        readFile // Expose internal helper
    };
}

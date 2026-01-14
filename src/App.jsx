import React, { useState, useEffect } from 'react';
import './App.css';
import yaml from 'js-yaml';
import { Layout } from './components/Layout';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { ModeSwitcher } from './components/ModeSwitcher';
import { MetadataForm } from './components/MetadataForm';
import { FileExplorer } from './components/FileExplorer';
import { ImageViewer } from './components/ImageViewer';
import { ResizablePanels } from './components/ResizablePanels';
import { useFileSystem } from './hooks/useFileSystem';
import { generateLatex } from './utils/latexExport';
import { saveProjectHandle, getProjectHandle, saveRecentProject, getRecentProjects } from './utils/db';
import { WelcomeScreen } from './components/WelcomeScreen';

function App() {
  const [isDark, setIsDark] = useState(false);
  const [mode, setMode] = useState('journalist');
  const [content, setContent] = useState(''); // Stores markdown or bib content
  const [metadata, setMetadata] = useState({});
  const [projectMetadata, setProjectMetadata] = useState({ name: 'Untitled Project' });
  const [currentFile, setCurrentFile] = useState({ name: '', kind: 'md', handle: null, src: null });
  const [showMetadata, setShowMetadata] = useState(true);
  const [showExplorer, setShowExplorer] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [viewState, setViewState] = useState('welcome'); // 'welcome' | 'editor'
  const [recentProjects, setRecentProjects] = useState([]);

  const {
    fileHandle,
    dirHandle,
    openFile,
    saveFile,
    saveFileAs,
    openDirectory,
    createSubDir,
    writeFileInDir,
    setFileHandle,
    setDirHandle,
    readFile
  } = useFileSystem();

  // Theme Toggle
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Load project metadata if dirHandle changes
  // Load project metadata if dirHandle changes
  useEffect(() => {
    const loadProjectMeta = async () => {
      if (!dirHandle) return;
      try {
        await saveProjectHandle(dirHandle); // Persist handle

        const handle = await dirHandle.getFileHandle('project_metadata.json');
        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        setProjectMetadata(data);
      } catch (e) {
        // No metadata file, maybe create default?
      }
    };
    loadProjectMeta();
  }, [dirHandle]);

  // Load recent projects
  useEffect(() => {
    const loadRecents = async () => {
      try {
        const recents = await getRecentProjects();
        setRecentProjects(recents);

        // Auto open last? User didn't explicitly asking for auto-open, but "show previously used folders"
        // So we just load the list.
      } catch (e) {
        console.error(e);
      }
    };
    loadRecents();
  }, [viewState]); // Reload when going back to welcome

  const handleOpenRecent = async (project) => {
    setIsLoading(true);
    try {
      // Verify permission
      if ((await project.handle.queryPermission({ mode: 'readwrite' })) === 'granted') {
        setMode(project.mode || 'researcher');
        setDirHandle(project.handle);
        setProjectMetadata({ name: project.name, mode: project.mode });
        setViewState('editor');
        await openDirectoryWithHandle(project.handle);
        // Update timestamp
        await saveRecentProject(project.handle, project.name, project.mode);
      } else {
        // Request permission
        if ((await project.handle.requestPermission({ mode: 'readwrite' })) === 'granted') {
          setMode(project.mode || 'researcher');
          setDirHandle(project.handle);
          setProjectMetadata({ name: project.name, mode: project.mode });
          setViewState('editor');
          await openDirectoryWithHandle(project.handle);
          await saveRecentProject(project.handle, project.name, project.mode);
        }
      }
    } catch (e) {
      console.error('Failed to open recent', e);
      alert('Could not open project. It may have been moved or deleted.');
    } finally {
      setIsLoading(false);
    }
  };


  // Handler for Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, metadata, projectMetadata, currentFile, dirHandle, fileHandle]);

  // Parsing logic
  const parseFileContent = (text, filename) => {
    if (filename.endsWith('.bib') || filename.endsWith('.json') || filename.endsWith('.txt')) {
      setContent(text);
      setMetadata({}); // clear metadata for these files
      return;
    }

    try {
      if (text.startsWith('---')) {
        const parts = text.split('---');
        if (parts.length >= 3) {
          const metaConfig = yaml.load(parts[1]);
          const body = parts.slice(2).join('---').trim();
          setMetadata(metaConfig || {});
          setContent(body);
          return;
        }
      }
      setContent(text);
      setMetadata({});
    } catch (e) {
      console.error('Error parsing frontmatter', e);
      setContent(text);
    }
  };

  const stringifyFileContent = () => {
    if (currentFile.kind !== 'md') return content;

    const metaString = Object.keys(metadata).length > 0 ? yaml.dump(metadata) : '';
    return metaString
      ? `---\n${metaString}---\n\n${content}`
      : content;
  };

  const handleOpen = async () => {
    setIsLoading(true);
    try {
      const openDirectoryWithHandle = async (dir) => {
        if (!dir) return; // Guard clause

        // Try to load metadata first
        let projName = dir.name;
        try {
          const h = await dir.getFileHandle('project_metadata.json');
          const f = await h.getFile();
          const d = JSON.parse(await f.text());
          if (d.name) projName = d.name;
          setProjectMetadata(d);
        } catch (e) {
          // Create default
          setProjectMetadata({ name: dir.name, mode: 'researcher' });
        }

        // Look for .md files
        let mdFile = null;
        for await (const entry of dir.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            mdFile = entry;
            break;
          }
        }

        if (mdFile) {
          const contentObj = await readFile(mdFile);
          setFileHandle(mdFile);
          parseFileContent(contentObj.text, mdFile.name);
          setCurrentFile({ name: mdFile.name, kind: 'md', handle: mdFile });
        } else {
          setContent('');
          setMetadata({});
          setCurrentFile({ name: 'Untitled', kind: 'md', handle: null });
        }
      };

      // This part was missing in the original code, assuming it should open a directory picker
      const dir = await window.showDirectoryPicker({
        id: 'journal-editor-projects',
        mode: 'readwrite'
      });
      setDirHandle(dir);
      setMode('researcher'); // Assuming opening a directory implies researcher mode
      setViewState('editor');

      // Save to recents
      await saveRecentProject(dir, dir.name, 'researcher');

      await handleOpenInternal(dir);
    } catch (error) {
      console.error("Open failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (currentFile.kind === 'image') return; // Cannot save image changes yet

    const fullContent = stringifyFileContent();

    if (mode === 'researcher') {
      if (dirHandle) {
        // Save project metadata first
        await writeFileInDir(dirHandle, 'project_metadata.json', JSON.stringify(projectMetadata, null, 2));

        if (currentFile.handle) {
          await saveFile(fullContent, currentFile.handle);
        } else {
          // Fallback / New File in Project
          const name = currentFile.name || 'main.md';
          const handle = await writeFileInDir(dirHandle, name, fullContent);
          setFileHandle(handle);
          setCurrentFile(prev => ({ ...prev, handle }));

          await saveRecentProject(dirHandle, projectMetadata.name, mode);
        }
      } else {
        // Saving a NEW Research Project
        try {
          const dir = await window.showDirectoryPicker({
            id: 'journal-editor-projects',
            mode: 'readwrite'
          });

          const safeTitle = projectMetadata.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

          await writeFileInDir(dir, 'project_metadata.json', JSON.stringify({ name: projectMetadata.name, mode: 'researcher' }, null, 2));

          const mainFileName = `main.md`; // Standardize main entry? or use safeTitle? User asked for structure.

          const mdHandle = await writeFileInDir(dir, mainFileName, fullContent);
          await createSubDir(dir, 'figures');
          await writeFileInDir(dir, 'references.bib', '');

          setDirHandle(dir);
          setFileHandle(mdHandle);
          setCurrentFile({ name: mainFileName, kind: 'md', handle: mdHandle });

        } catch (err) {
          if (err.name !== 'AbortError') console.error('Failed to create project', err);
        }
      }
    } else {
      await saveFile(fullContent);
    }
  };

  const handleNew = () => {
    // If called from Editor, acts as "Clear/Close Project" or "New Buffer"
    // User asked: "open or new document or continue... if new... create a subfolder"
    // This handleNew is for the button in the Layout.
    // If we are in welcome screen, we use createProject.
    // If we are in editor, maybe we want to go back to welcome screen?
    setViewState('welcome');
    setDirHandle(null);
    setFileHandle(null);
    setContent('');
    setCurrentFile({ name: '', kind: 'md', handle: null });
  };

  const createProject = async (name, newMode) => {
    setIsLoading(true);
    try {
      if (newMode === 'researcher') {
        // 1. Select Folder
        const parentDir = await window.showDirectoryPicker({
          id: 'journal-editor-projects-root',
          mode: 'readwrite'
        });

        // 2. Create Subfolder
        const safeName = name.trim() || 'Untitled Project';
        const projectDir = await parentDir.getDirectoryHandle(safeName, { create: true });

        setMode('researcher');
        setDirHandle(projectDir);

        await saveRecentProject(projectDir, safeName, 'researcher');

        // 3. Initialize Files
        const metadata = { name: safeName, mode: 'researcher' };
        await writeFileInDir(projectDir, 'project_metadata.json', JSON.stringify(metadata, null, 2));

        const mainFile = await writeFileInDir(projectDir, 'main.md', `# ${safeName}\n\nStart writing...`);
        await createSubDir(projectDir, 'figures');
        await writeFileInDir(projectDir, 'references.bib', '');

        // 4. Open
        await openDirectoryWithHandle(projectDir);
        setViewState('editor');
      } else {
        // Journalist Mode - Single File
        const handle = await window.showSaveFilePicker({
          suggestedName: `${name}.md`,
          types: [{
            description: 'Markdown File',
            accept: { 'text/markdown': ['.md'] },
          }],
        });

        setMode('journalist');
        const fileContent = `# ${name}\n\n`;
        const writable = await handle.createWritable();
        await writable.write(fileContent);
        await writable.close();

        setFileHandle(handle);
        // Read back
        const file = await handle.getFile();
        setContent(fileContent);
        setCurrentFile({ name: file.name, kind: 'md', handle: handle });
        setViewState('editor');
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Create Project Failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    const latex = generateLatex(content, metadata);
    const name = (currentFile.name || 'export').replace(/\.md$/, '') + '.tex';
    if (mode === 'researcher' && dirHandle) {
      try {
        const handle = await dirHandle.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(latex);
        await writable.close();
        alert('Exported to ' + name);
      } catch (e) {
        console.error(e);
        alert('Failed to export');
      }
    } else {
      await saveFileAs(latex);
    }
  };

  // Helper for FileExplorer selection
  const handleFileSelect = async (handle) => {
    // LOADING REMOVED as requested
    try {
      if (handle.kind === 'file') {
        const name = handle.name;
        if (name.endsWith('.md') || name.endsWith('.bib') || name.endsWith('.txt') || name.endsWith('.json')) {
          const data = await readFile(handle);
          setFileHandle(handle);

          let kind = 'md';
          if (name.endsWith('.bib')) kind = 'bib';
          if (name.endsWith('.json')) kind = 'json';
          if (name.endsWith('.txt')) kind = 'txt';

          parseFileContent(data.text, name);
          setCurrentFile({ name, kind, handle });
        } else if (name.match(/\.(png|jpg|jpeg|svg|gif)$/i)) {
          // Image visualization
          const file = await handle.getFile();
          const src = URL.createObjectURL(file);
          setCurrentFile({ name, kind: 'image', handle, src });
          // We don't change content/metadata, just the view.
        }
      }
    } finally {
      // No loading state to turn off
    }
  };

  const onUploadImage = async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Images',
          accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.gif'] }
        }]
      });
      const file = await handle.getFile();

      let src = '';
      if (mode === 'researcher' && dirHandle) {
        let figuresDir;
        try {
          figuresDir = await dirHandle.getDirectoryHandle('figures', { create: true });
        } catch (e) {
          figuresDir = dirHandle;
        }
        await writeFileInDir(figuresDir, file.name, file);
        src = `figures/${file.name}`;
      } else {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        await new Promise(resolve => reader.onload = resolve);
        src = reader.result;
      }
      return { alt: file.name, src };
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
      return null;
    }
  };

  // Render Logic
  const renderLeft = () => (
    <FileExplorer
      dirHandle={dirHandle}
      onFileSelect={handleFileSelect}
      currentFilename={currentFile.name}
      mode={mode}
      onOpenProject={handleOpen}
    />
  );

  const renderCenter = () => (
    <div className="center-panel-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="controls-bar" style={{ display: 'none' }}>
        {/* Controls moved to Layout header */}
      </div>

      {currentFile.kind === 'md' && showMetadata && (
        <MetadataForm mode={mode} metadata={metadata} onChange={setMetadata} />
      )}

      {currentFile.kind === 'image' ? (
        <ImageViewer src={currentFile.src} alt={currentFile.name} />
      ) : (
        <div className="editor-container" style={{ flex: 1, overflow: 'hidden' }}>
          <Editor
            value={content}
            onChange={setContent}
            mode={mode}
            onUploadImage={onUploadImage}
          />
        </div>
      )}
    </div>
  );

  const renderRight = () => (
    <Preview content={content} metadata={metadata} dirHandle={dirHandle} mode={mode} />
  );

  return (
    <>
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          Loading...
        </div>
      )}

      {viewState === 'welcome' ? (
        <WelcomeScreen
          onNewProject={createProject}
          onOpenProject={() => {
            setMode('researcher');
            handleOpen();
          }}
          recentProjects={recentProjects}
          onOpenRecent={handleOpenRecent}
          isDark={isDark}
        />
      ) : (
        <Layout
          isDark={isDark}
          toggleTheme={() => setIsDark(!isDark)}
          onOpen={handleOpen}
          onSave={handleSave}
          onNew={handleNew}
          onExport={handleExport}
          filename={currentFile.name}
          projectName={projectMetadata.name}
          mode={mode}
          onModeChange={setMode}
          onProjectNameChange={(name) => setProjectMetadata({ ...projectMetadata, name })}
          showExplorer={showExplorer}
          toggleExplorer={() => setShowExplorer(!showExplorer)}
        >
          <div className="workspace-container" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {isLoading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                Loading...
              </div>
            )}
            {/* Helper to decide layout */}
            {(() => {
              const isMD = currentFile.kind === 'md';
              const isImage = currentFile.kind === 'image';
              const isTextLike = ['bib', 'json', 'txt'].includes(currentFile.kind);

              if (isTextLike) {
                // "It's just the center and right panels that should switch to text editor. But not disappearing the left panel."
                return (
                  <ResizablePanels
                    left={showExplorer ? renderLeft() : null}
                    center={renderCenter()}
                    right={null}
                  />
                );
              }

              if (isImage) {
                // "just two panels (left panel with explorer and right-center panel with the image)"
                return (
                  <ResizablePanels
                    left={showExplorer ? renderLeft() : null}
                    center={renderCenter()}
                    right={null}
                  />
                );
              }

              // Case for .md or default
              if (mode === 'researcher' && dirHandle) {
                return (
                  <ResizablePanels
                    left={showExplorer ? renderLeft() : null}
                    center={renderCenter()}
                    right={isMD ? renderRight() : null}
                  />
                );
              } else {
                // Simple layout for Journalist / No Project
                return (
                  <div style={{ flex: 1, display: 'flex' }}>
                    {showExplorer && (
                      <div style={{ width: '250px', borderRight: '1px solid var(--border-color)' }}>
                        {renderLeft()}
                      </div>
                    )}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {renderCenter()}
                    </div>
                    {isMD && (
                      <div style={{ width: '50%', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                        {renderRight()}
                      </div>
                    )}
                  </div>
                );
              }
            })()}
          </div>
        </Layout>
      )}
    </>
  );
}

export default App;

# Known Issues & Roadmap

## Active Issues
### 1. Browser Compatibility
*   **Issue**: The application relies on the **File System Access API**.
*   **Impact**: Fully supported in Chrome, Edge, and Opera. Firefox and Safari have limited or no support for direct file modifications without user interaction steps.
*   **Workaround**: Use Chrome or Edge for the best experience.

### 2. File System Permissions
*   **Issue**: The browser may repeatedly ask for permission to view/edit files each session.
*   **Status**: Browser security feature (by design).

### 3. Large File Performance
*   **Issue**: Very large Markdown files (>1MB) might cause cursor lag or preview rendering delays.
*   **Status**: Optimization required (Debouncing rendering).

## Future Enhancements
- [ ] **Context Menu in Explorer**: Right-click to Rename, Delete, or Create files directly in the sidebar.
- [ ] **Tabs System**: Ability to open multiple files simultaneously in tabs.
- [ ] **Git Integration**: Basic status indicators or commit features.
- [ ] **Auto-Save**: Optional auto-save functionality.
- [ ] **Export to PDF**: Direct PDF generation using browser print API or `jspdf`.

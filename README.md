# Journal Editor

A professional, web-based Markdown editor designed for Journalistic and Academic writing. Built with React and Vite.

## Features

### 1. Dual Modes
*   **Journalist Mode**: A streamlined experience for single-file editing. Perfect for articles, blog posts, and quick notes.
*   **Researcher Mode**: A project-based workflow. manage complex projects with multiple files (`.md`, `.bib`, `.json`, `.txt`) and assets (images).
    *   **Project Metadata**: Automatically manages a `project_metadata.json` for your project name and settings.
    *   **File Explorer**: Integrated sidebar to navigate your project structure.

### 2. Intelligent Interface
*   **Dynamic Layout**: The interface adapts to the content.
    *   **Markdown**: 3-Panel view (Explorer, Editor, Live Preview).
    *   **Images**: 2-Panel view (Explorer, Image Viewer).
    *   **Code/Data (`.json`, `.bib`)**: Focused 2-Panel view (Explorer, Editor).
*   **Live Preview**: Real-time rendering of Markdown, LaTeX math ($E=mc^2$), and citations.
*   **Metadata Management**: User-friendly form to edit YAML frontmatter (Title, Author, Abstract, etc.) without touching raw code.

### 3. Professional Tools
*   **File Support**: Edit Markdown, BibTeX, JSON, and plain text files. View standard image formats.
*   **LaTeX Support**: Built-in support for mathematical equations.
*   **Export**: Export your work to LaTeX (`.tex`) for professional typesetting.
*   **Dark Mode**: easy-on-the-eyes dark theme for late-night writing.

## Getting Started

### Prerequisites
*   A modern web browser (Chrome, Edge, Firefox) supporting the **File System Access API**.

### Installation & Running
1.  **Clone/Download** the repository.
2.  **Install Dependencies** (if developing):
    ```bash
    npm install
    ```
3.  **Run the Application**:
    *   **Standard User**: Double-click `Abrir Editor.bat`.
    *   **Developer**: Run `npm run dev`.

### Usage Guide
1.  **Opening a Project**:
    *   Click the **Folder Icon** (Open).
    *   In **Journalist Mode**, select a single file.
    *   In **Researcher Mode**, select a directory (folder) to open as a project.
2.  **Creating New Files**:
    *   Click **New** to clear the current buffer.
    *   In Researcher Mode, use the Explorer context (not yet implemented) or just save a new file to add it to the project.
3.  **Saving**:
    *   Press `Ctrl + S` or click the **Save Icon**.
    *   First-time saves will prompt for a location (Journalist Mode) or save directly to the project (Researcher Mode).

## Technical Details
This application is a **Progressive Web App (PWA)** candidate built with:
*   **React 19**: Frontend framework.
*   **Vite**: Build tool and dev server.
*   **File System Access API**: For direct disk interactions (reading/writing files).
*   **Tailwind CSS (Concept)**: Custom CSS variables for theming.

**Note**: The application runs entirely in your browser. No data is sent to any server.
export function generateLatex(content, metadata) {
    const { title, author, date, abstract, authors } = metadata;

    let latex = `\\documentclass{article}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{hyperref}
\\usepackage[utf8]{inputenc}
\\usepackage{natbib}

\\title{${title || 'Untitled'}}
\\author{${authors ? authors.map(a => a.name).join(' \\and ') : (author || '')}}
\\date{${date || '\\today'}}

\\begin{document}

\\maketitle

${abstract ? `\\begin{abstract}
${abstract}
\\end{abstract}` : ''}

`;

    // Basic Markdown to LaTeX conversion
    // Note: This is a simplified converter. For robust conversion, a library like pandoc is recommended,
    // but here we implement basic regex replacements for the web tool.

    let body = content;

    // Sections
    body = body.replace(/^# (.*$)/gm, '\\section{$1}');
    body = body.replace(/^## (.*$)/gm, '\\subsection{$1}');
    body = body.replace(/^### (.*$)/gm, '\\subsubsection{$1}');

    // Bold / Italic
    body = body.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');
    body = body.replace(/__(.*?)__/g, '\\textbf{$1}');
    body = body.replace(/\*(.*?)\*/g, '\\textit{$1}');
    body = body.replace(/_(.*?)_/g, '\\textit{$1}');

    // Images: ![alt](src) -> figure
    // We assume separate figures folder for LaTeX export if in researcher mode
    body = body.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
        // If src is a local path or filename, usage depends on where the tex file is.
        // We'll trust the user has the file in figures/ or similar for now.
        return `
\\begin{figure}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{${src}}
    \\caption{${alt}}
\\end{figure}
`;
    });

    // Math: $...$ or $$...$$
    // LaTeX usually handles $$...$$ natively or with amsmath using \[ \]
    // We'll leave $$...$$ as is or convert to \[ \]
    // Inline math $...$ is also standard.
    // We need to ensure we don't escape content inside math.
    // But regex replacement above might affect math if it uses * or _.
    // Ideally we should parse, but purely regex is risky.
    // For this MVF (Minimum Viable Feature), we leave as is.

    latex += body;

    // Bibliography
    if (metadata.references) {
        latex += `
\\bibliographystyle{plain}
\\bibliography{references}
`;
    }

    latex += `
\\end{document}
`;

    return latex;
}

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export function Preview({ content, metadata, dirHandle, mode }) {
    const { title, authors, author, abstract, subtitle } = metadata || {};

    let displayAuthors = null;
    if (authors && Array.isArray(authors)) {
        displayAuthors = authors.map(a => {
            if (typeof a === 'object' && a !== null) return a.name || JSON.stringify(a);
            return a;
        }).join(', ');
    } else if (author) {
        displayAuthors = typeof author === 'object' ? (author.name || JSON.stringify(author)) : author;
    }

    // Advanced render for researchers
    const isResearch = mode === 'researcher';

    let renderedAuthors;
    if (isResearch && authors && Array.isArray(authors)) {
        renderedAuthors = (
            <div className="paper-authors-block">
                {authors.map((a, i) => {
                    const name = typeof a === 'object' ? (a.name || 'Unknown') : a;
                    const aff = typeof a === 'object' ? a.affiliation : '';
                    const email = typeof a === 'object' ? a.email : '';

                    return (
                        <div key={i} className="paper-author-entry">
                            <span className="paper-author-name">{name}</span>
                            {aff && <span className="paper-author-aff">{aff}</span>}
                            {email && <span className="paper-author-email">{email}</span>}
                        </div>
                    );
                })}
            </div>
        );
    } else {
        // Journalist or simple fallback
        renderedAuthors = displayAuthors && <div className="preview-authors">By {displayAuthors}</div>;
    }

    const displaySubtitle = subtitle;

    return (
        <div className={`panel-preview ${isResearch ? 'research-mode' : ''}`}>
            <div className={`preview-content ${isResearch ? 'paper-layout' : ''}`}>
                {(title || displayAuthors || abstract || displaySubtitle) && (
                    <header className="preview-header">
                        {title && <h1 className={`preview-title ${isResearch ? 'paper-title' : ''}`}>{title}</h1>}
                        {displaySubtitle && <p className="preview-subtitle">{displaySubtitle}</p>}
                        {renderedAuthors}
                        {abstract && (
                            <div className="preview-abstract">
                                <span className="preview-abstract-label">Abstract</span>
                                {abstract}
                            </div>
                        )}
                    </header>
                )}
                <div className="prose">
                    <ReactMarkdown
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                            img: ({ node, ...props }) => <AsyncImage {...props} dirHandle={dirHandle} />
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}

function AsyncImage({ src, alt, dirHandle }) {
    const [imgSrc, setImgSrc] = useState(src);

    useEffect(() => {
        let objectUrl;
        const loadLocalImage = async () => {
            // Only attempt to load if we have a directory handle and it's not an external URL
            if (!dirHandle || !src || src.startsWith('http') || src.startsWith('blob:')) return;

            try {
                // Assume src is relative path like "figures/image.png"
                // We need to traverse the path relative to dirHandle
                const parts = src.split('/');
                let currentHandle = dirHandle;

                for (let i = 0; i < parts.length - 1; i++) {
                    currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
                }

                const fileHandle = await currentHandle.getFileHandle(parts[parts.length - 1]);
                const file = await fileHandle.getFile();
                objectUrl = URL.createObjectURL(file);
                setImgSrc(objectUrl);
            } catch (err) {
                console.warn('Failed to load local image:', src);
            }
        };

        loadLocalImage();

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [src, dirHandle]);

    return (
        <figure>
            <img src={imgSrc} alt={alt} className="rounded-lg shadow-md mx-auto" />
            {alt && <figcaption className="text-center text-sm text-gray-500 mt-2 italic">{alt}</figcaption>}
        </figure>
    );
}

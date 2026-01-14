import React, { useState } from 'react';

export function ImageViewer({ src, alt }) {
    if (!src) return <div className="panel-empty">No image selected</div>;

    return (
        <div className="panel-image-viewer" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: 'var(--bg-panel)',
            padding: 20
        }}>
            <div style={{ textAlign: 'center' }}>
                <img
                    src={src}
                    alt={alt}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '80vh',
                        boxShadow: 'var(--shadow-md)',
                        borderRadius: 8
                    }}
                />
                <p style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{alt}</p>
            </div>
        </div>
    );
}

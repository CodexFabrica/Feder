import React from 'react';
import { BookOpen, FlaskConical } from 'lucide-react';

export function ModeSwitcher({ mode, onModeChange }) {
    return (
        <div className="mode-switcher">
            <button
                onClick={() => onModeChange('journalist')}
                className={`mode-btn ${mode === 'journalist' ? 'active' : ''}`}
            >
                <BookOpen size={16} />
                <span>Journalist</span>
            </button>
            <button
                onClick={() => onModeChange('researcher')}
                className={`mode-btn ${mode === 'researcher' ? 'active' : ''}`}
            >
                <FlaskConical size={16} />
                <span>Researcher</span>
            </button>
        </div>
    );
}

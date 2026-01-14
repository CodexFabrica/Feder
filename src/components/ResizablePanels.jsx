import React, { useState, useEffect, useCallback, useRef } from 'react';

export function ResizablePanels({ left, center, right }) {
    const [leftWidth, setLeftWidth] = useState(260);
    const [rightWidth, setRightWidth] = useState(400); // Initial preview width
    const containerRef = useRef(null);

    const startResizeLeft = (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = leftWidth;

        const doDrag = (moveEvent) => {
            setLeftWidth(Math.max(150, Math.min(600, startWidth + moveEvent.clientX - startX)));
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
        document.body.style.cursor = 'col-resize';
    };

    const startResizeRight = (e) => {
        e.preventDefault();
        const startX = e.clientX;

        // We resize from the right edge of the CENTER panel? No, the separator is between Center and Right.
        // If we drag left, rightWidth increases. If we drag right, rightWidth decreases.

        // Actually, usually 3 pane layout: 
        // [Left] | [Center] | [Right]
        // Widths: Left=Fixed/Resizable, Center=Flex(1), Right=Fixed/Resizable

        const startWidth = rightWidth;

        const doDrag = (moveEvent) => {
            // Delta X: Moving right (positive) reduces right panel width
            const delta = moveEvent.clientX - startX;
            setRightWidth(Math.max(200, Math.min(800, startWidth - delta)));
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
        document.body.style.cursor = 'col-resize';
    };

    return (
        <div className="resizable-container" ref={containerRef} style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>

            {/* Left Panel */}
            {left && (
                <>
                    <div style={{ width: leftWidth, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                        {left}
                    </div>
                    {/* Resizer 1 */}
                    <div
                        className="resizer vertical"
                        onMouseDown={startResizeLeft}
                    />
                </>
            )}

            {/* Center Panel */}
            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {center}
            </div>

            {/* Resizer 2 */}
            {right && (
                <>
                    <div
                        className="resizer vertical"
                        onMouseDown={startResizeRight}
                    />
                    {/* Right Panel */}
                    <div style={{ width: rightWidth, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                        {right}
                    </div>
                </>
            )}
        </div>
    );
}

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Search, ZoomIn, ZoomOut, Maximize2, RefreshCw, Folder, Tag, Layers } from 'lucide-react';

export function NotesGraph({ notesList, onFileSelect, currentFilename }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Filter, Search, Legend State
    const [searchQuery, setSearchQuery] = useState('');
    const [groupBy, setGroupBy] = useState('folder'); // 'folder' | 'tag' | 'none'
    const [hoveredNode, setHoveredNode] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [activeLegendItem, setActiveLegendItem] = useState(null);

    // Zoom/Pan State
    const transformRef = useRef({ x: 0, y: 0, scale: 1 });
    const isPanningRef = useRef(false);
    const startPanRef = useRef({ x: 0, y: 0 });

    // Physics Simulation State
    const simulationNodesRef = useRef([]);
    const simulationLinksRef = useRef([]);
    const draggedNodeRef = useRef(null);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef(null);
    const startSimulationRef = useRef(null);
    const drawCallbackRef = useRef(null);

    // Double-click detection helper
    const lastClickRef = useRef({ time: 0, nodeId: null });

    // Harmonious HSL Hashing for folders/tags
    const getHashColor = (name, lightness = 60) => {
        if (!name || name === 'root') return 'var(--accent-color)';
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash % 360);
        return `hsl(${h}, 75%, ${lightness}%)`;
    };

    // Construct Graph Nodes and Links from Notes List
    const { nodes, links, folders, tags } = useMemo(() => {
        const foldersSet = new Set();
        const tagsSet = new Set();

        // 1. Build Nodes
        const nodesMap = new Map();
        notesList.forEach(note => {
            const noteKey = note.relPath.toLowerCase(); // Rel path is key
            foldersSet.add(note.folder);
            if (note.tags && Array.isArray(note.tags)) {
                note.tags.forEach(t => tagsSet.add(t));
            }

            nodesMap.set(noteKey, {
                id: noteKey,
                name: note.name,
                title: note.title,
                relPath: note.relPath,
                handle: note.handle,
                folder: note.folder || 'root',
                tags: note.tags || [],
                customColor: note.color,
                // Visual attributes
                radius: 6 + Math.min((note.links?.length || 0) * 1.5, 12)
            });
        });

        // 2. Build Links
        const edges = [];
        notesList.forEach(note => {
            const sourceKey = note.relPath.toLowerCase();
            if (note.links && Array.isArray(note.links)) {
                note.links.forEach(targetLink => {
                    // Links are relative to notes/ e.g. "ideas/idea1.md" or "todo.md"
                    // Strip leading slash if any
                    const normalizedLink = targetLink.startsWith('/') ? targetLink.substring(1) : targetLink;
                    const targetKey = normalizedLink.toLowerCase();

                    // Connect even if target node doesn't exist in scan yet (dangling note, drawn in gray)
                    edges.push({
                        source: sourceKey,
                        target: targetKey
                    });

                    if (!nodesMap.has(targetKey)) {
                        // Create a placeholder dangling note
                        nodesMap.set(targetKey, {
                            id: targetKey,
                            name: normalizedLink.split('/').pop(),
                            title: normalizedLink.split('/').pop().replace(/\.md$/, ''),
                            relPath: normalizedLink,
                            handle: null,
                            folder: normalizedLink.includes('/') ? normalizedLink.split('/').shift() : 'root',
                            tags: [],
                            customColor: '#777777', // Dull gray for dangling/uncreated notes
                            radius: 4,
                            isDangling: true
                        });
                    }
                });
            }
        });

        return {
            nodes: Array.from(nodesMap.values()),
            links: edges,
            folders: Array.from(foldersSet),
            tags: Array.from(tagsSet)
        };
    }, [notesList]);

    // Initialize/Sync Simulation Nodes
    useEffect(() => {
        const prevNodes = new Map(simulationNodesRef.current.map(n => [n.id, n]));
        const width = containerRef.current ? containerRef.current.clientWidth : 500;
        const height = containerRef.current ? containerRef.current.clientHeight : 500;

        // Position nodes organically
        simulationNodesRef.current = nodes.map(n => {
            const existing = prevNodes.get(n.id);
            return {
                ...n,
                x: existing ? existing.x : width / 2 + (Math.random() - 0.5) * 150,
                y: existing ? existing.y : height / 2 + (Math.random() - 0.5) * 150,
                vx: existing ? existing.vx : 0,
                vy: existing ? existing.vy : 0
            };
        });

        simulationLinksRef.current = links.map(l => ({
            ...l,
            sourceNode: simulationNodesRef.current.find(n => n.id === l.source),
            targetNode: simulationNodesRef.current.find(n => n.id === l.target)
        })).filter(l => l.sourceNode && l.targetNode);

    }, [nodes, links]);

    // Centering Action (Fit to Canvas)
    const fitToCanvas = () => {
        if (simulationNodesRef.current.length === 0) return;
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        simulationNodesRef.current.forEach(n => {
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.y > maxY) maxY = n.y;
        });

        const graphWidth = maxX - minX || 100;
        const graphHeight = maxY - minY || 100;
        const centerX = minX + graphWidth / 2;
        const centerY = minY + graphHeight / 2;

        const pad = 40;
        const scaleX = (width - pad * 2) / graphWidth;
        const scaleY = (height - pad * 2) / graphHeight;
        const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.15), 1.5);

        transformRef.current = {
            x: width / 2 - centerX * newScale,
            y: height / 2 - centerY * newScale,
            scale: newScale
        };
        drawCallbackRef.current?.();
    };

    // Trigger centering on first load
    useEffect(() => {
        setTimeout(fitToCanvas, 100);
    }, [notesList.length]);

    // Node Color Resolver
    const getNodeColor = (node, opacity = 1) => {
        if (node.isDangling) return `rgba(100, 110, 120, ${opacity * 0.4})`;

        // Custom Override takes first priority
        if (node.customColor) {
            if (node.customColor.startsWith('#') || node.customColor.startsWith('rgb')) {
                return node.customColor;
            }
            return node.customColor; // CSS word
        }

        // Folder or Tag coloring
        if (groupBy === 'folder') {
            return getHashColor(node.folder);
        } else if (groupBy === 'tag' && node.tags && node.tags.length > 0) {
            // Use first tag
            return getHashColor(node.tags[0]);
        }

        return 'var(--accent-color)';
    };

    // Render & Physics Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const runPhysics = () => {
            const nodesArr = simulationNodesRef.current;
            const linksArr = simulationLinksRef.current;

            // Physics configurations
            const repulsionCoeff = 380;
            const springCoeff = 0.045;
            const centerCoeff = 0.015;
            const idealLength = 75;
            const damping = 0.90;

            const width = canvas.width;
            const height = canvas.height;

            // 1. Repulsion force between ALL node pairs (Coulomb's style)
            for (let i = 0; i < nodesArr.length; i++) {
                const nodeA = nodesArr[i];
                for (let j = i + 1; j < nodesArr.length; j++) {
                    const nodeB = nodesArr[j];
                    const dx = nodeB.x - nodeA.x;
                    const dy = nodeB.y - nodeA.y;
                    const distSq = dx * dx + dy * dy + 1; // avoid divide by zero
                    const dist = Math.sqrt(distSq);

                    if (dist < 280) {
                        const force = (repulsionCoeff * (nodeA.radius + nodeB.radius)) / distSq;
                        const fx = (dx / dist) * force;
                        const fy = (dy / dist) * force;

                        if (nodeA !== draggedNodeRef.current) {
                            nodeA.vx -= fx;
                            nodeA.vy -= fy;
                        }
                        if (nodeB !== draggedNodeRef.current) {
                            nodeB.vx += fx;
                            nodeB.vy += fy;
                        }
                    }
                }
            }

            // 2. Attraction force along connected edges (Hooke's spring style)
            linksArr.forEach(link => {
                const s = link.sourceNode;
                const t = link.targetNode;
                const dx = t.x - s.x;
                const dy = t.y - s.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - idealLength) * springCoeff;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (s !== draggedNodeRef.current) {
                    s.vx += fx;
                    s.vy += fy;
                }
                if (t !== draggedNodeRef.current) {
                    t.vx -= fx;
                    t.vy -= fy;
                }
            });

            // 3. Center gravity force (pull toward canvas center)
            const cx = width / 2;
            const cy = height / 2;
            nodesArr.forEach(n => {
                if (n === draggedNodeRef.current) return;
                n.vx += (cx - n.x) * centerCoeff;
                n.vy += (cy - n.y) * centerCoeff;
            });

            // 4. Update Positions with damping and measure total kinetic movement
            let totalMovement = 0;
            nodesArr.forEach(n => {
                if (n === draggedNodeRef.current) return;
                n.x += n.vx;
                n.y += n.vy;
                n.vx *= damping;
                n.vy *= damping;
                totalMovement += Math.abs(n.vx) + Math.abs(n.vy);
            });

            return totalMovement;
        };

        const drawCanvas = () => {
            const width = canvas.width;
            const height = canvas.height;

            // Premium background (support semi-dark and dark seamlessly)
            ctx.clearRect(0, 0, width, height);

            ctx.save();
            // Apply zoom & pan translation
            const trans = transformRef.current;
            ctx.translate(trans.x, trans.y);
            ctx.scale(trans.scale, trans.scale);

            const nodesArr = simulationNodesRef.current;
            const linksArr = simulationLinksRef.current;

            // Highlight calculations
            const searchLower = searchQuery.trim().toLowerCase();
            const hasSearch = searchLower.length > 0;

            const isNodeMatch = (n) => {
                if (hasSearch) {
                    return n.title.toLowerCase().includes(searchLower) ||
                           n.folder.toLowerCase().includes(searchLower) ||
                           n.tags.some(t => t.toLowerCase().includes(searchLower));
                }
                if (activeLegendItem) {
                    if (groupBy === 'folder') return n.folder === activeLegendItem;
                    if (groupBy === 'tag') return n.tags.includes(activeLegendItem);
                }
                return true;
            };

            const isConnectedToHovered = (n) => {
                if (!hoveredNode) return false;
                if (n.id === hoveredNode.id) return true;
                return linksArr.some(l =>
                    (l.source === hoveredNode.id && l.target === n.id) ||
                    (l.target === hoveredNode.id && l.source === n.id)
                );
            };

            // 1. Draw Links
            linksArr.forEach(link => {
                const s = link.sourceNode;
                const t = link.targetNode;

                const sMatch = isNodeMatch(s);
                const tMatch = isNodeMatch(t);
                const sHover = hoveredNode && s.id === hoveredNode.id;
                const tHover = hoveredNode && t.id === hoveredNode.id;
                const isHighlightedLink = sHover || tHover;

                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(t.x, t.y);

                // Aesthetic line properties
                if (isHighlightedLink) {
                    ctx.strokeStyle = 'var(--accent-color)';
                    ctx.lineWidth = 1.8;
                    ctx.shadowColor = 'var(--accent-color)';
                    ctx.shadowBlur = 6;
                } else if (hasSearch || activeLegendItem) {
                    ctx.strokeStyle = sMatch && tMatch ? 'rgba(150, 150, 150, 0.4)' : 'rgba(80, 80, 80, 0.08)';
                    ctx.lineWidth = sMatch && tMatch ? 1 : 0.5;
                    ctx.shadowBlur = 0;
                } else if (hoveredNode) {
                    // Dimm out non-connected lines
                    ctx.strokeStyle = 'rgba(80, 80, 80, 0.08)';
                    ctx.lineWidth = 0.5;
                    ctx.shadowBlur = 0;
                } else {
                    ctx.strokeStyle = 'var(--border-color)';
                    ctx.lineWidth = 1;
                    ctx.shadowBlur = 0;
                }

                ctx.stroke();
                ctx.shadowBlur = 0; // reset

                // Draw subtle directional arrows
                if (isHighlightedLink || (!hoveredNode && !hasSearch && !activeLegendItem)) {
                    const arrowLength = 5;
                    const angle = Math.atan2(t.y - s.y, t.x - s.x);
                    // Point slightly back from node center
                    const arrowDistX = t.x - Math.cos(angle) * (t.radius + 3);
                    const arrowDistY = t.y - Math.sin(angle) * (t.radius + 3);

                    ctx.beginPath();
                    ctx.moveTo(arrowDistX, arrowDistY);
                    ctx.lineTo(
                        arrowDistX - arrowLength * Math.cos(angle - Math.PI / 6),
                        arrowDistY - arrowLength * Math.sin(angle - Math.PI / 6)
                    );
                    ctx.lineTo(
                        arrowDistX - arrowLength * Math.cos(angle + Math.PI / 6),
                        arrowDistY - arrowLength * Math.sin(angle + Math.PI / 6)
                    );
                    ctx.closePath();
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.fill();
                }
            });

            // 2. Draw Nodes
            nodesArr.forEach(node => {
                const matchesSearch = isNodeMatch(node);
                const isHovered = hoveredNode && node.id === hoveredNode.id;
                const isConnected = isConnectedToHovered(node);
                const isActiveFile = currentFilename && ('notes/' + node.relPath).toLowerCase() === currentFilename.toLowerCase();

                let nodeOpacity = 1;
                if (hoveredNode) {
                    nodeOpacity = isHovered || isConnected ? 1 : 0.15;
                } else if (hasSearch || activeLegendItem) {
                    nodeOpacity = matchesSearch ? 1 : 0.12;
                }

                const baseColor = getNodeColor(node, nodeOpacity);

                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

                // Add glassmorphic visual outer glow
                if (isHovered || isActiveFile) {
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = baseColor;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.fillStyle = baseColor;
                ctx.fill();
                ctx.shadowBlur = 0; // reset

                // Draw outer ring for current active file or selected node
                if (isActiveFile || isHovered) {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
                    ctx.strokeStyle = baseColor;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }

                // 3. Draw Labels (Obsidian Style: Fades out at low zoom)
                const shouldDrawLabel = trans.scale > 0.45 || isHovered || isActiveFile || matchesSearch;

                if (shouldDrawLabel) {
                    ctx.font = isHovered || isActiveFile
                        ? 'bold 10px Outfit, Inter, sans-serif'
                        : '500 9px Outfit, Inter, sans-serif';

                    ctx.fillStyle = isHovered || isActiveFile
                        ? 'var(--text-primary)'
                        : `rgba(180, 185, 200, ${nodeOpacity * 0.85})`;

                    ctx.textAlign = 'center';
                    // Text offset based on node radius
                    ctx.fillText(node.title, node.x, node.y + node.radius + 12);
                }
            });

            ctx.restore();
        };

        drawCallbackRef.current = drawCanvas;

        let isRunning = true;
        const tick = () => {
            if (!isRunning) return;
            const movement = runPhysics();
            drawCanvas();

            // When nodes settle and nothing is dragged, stop animation loop to conserve CPU/RAM
            if (movement < 0.05 && !draggedNodeRef.current) {
                simulationNodesRef.current.forEach(n => { n.vx = 0; n.vy = 0; });
                drawCanvas();
                animationFrameRef.current = null;
                return;
            }

            animationFrameRef.current = requestAnimationFrame(tick);
        };

        const startSimulation = () => {
            if (!animationFrameRef.current) {
                animationFrameRef.current = requestAnimationFrame(tick);
            }
        };

        startSimulationRef.current = startSimulation;
        startSimulation();

        return () => {
            isRunning = false;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [groupBy, searchQuery, hoveredNode, activeLegendItem, currentFilename]);

    // Handle Canvas Resizing
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Get note coordinates in canvas space from mouse coordinates
    const getCanvasMousePos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Revert translations to check node clicks
        const trans = transformRef.current;
        return {
            x: (mouseX - trans.x) / trans.scale,
            y: (mouseY - trans.y) / trans.scale
        };
    };

    // Mouse Listeners: Drag, Pan, Zoom
    const handleMouseDown = (e) => {
        if (e.button === 2 || e.shiftKey) {
            // Right-click or Shift-drag: Pan canvas
            isPanningRef.current = true;
            startPanRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
            return;
        }

        const pos = getCanvasMousePos(e);
        // Find if clicked a node
        const clicked = simulationNodesRef.current.find(n => {
            const dx = n.x - pos.x;
            const dy = n.y - pos.y;
            return dx * dx + dy * dy < (n.radius + 8) * (n.radius + 8);
        });

        if (clicked) {
            draggedNodeRef.current = clicked;
            clicked.fx = clicked.x;
            clicked.fy = clicked.y;

            // Handle selection / clicks
            const now = Date.now();
            const doubleClickDelay = 260;
            const lastClick = lastClickRef.current;

            if (now - lastClick.time < doubleClickDelay && lastClick.nodeId === clicked.id) {
                // Double Click: Open Note in Editor
                if (!clicked.isDangling && onFileSelect) {
                    onFileSelect(clicked.handle, 'notes/' + clicked.relPath);
                }
            } else {
                // Single Click: Highlight
                setSelectedNode(clicked);
            }

            lastClickRef.current = { time: now, nodeId: clicked.id };

        } else {
            // Pan canvas
            isPanningRef.current = true;
            startPanRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
        }
    };

    const handleMouseMove = (e) => {
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        if (isPanningRef.current) {
            transformRef.current = {
                ...transformRef.current,
                x: e.clientX - startPanRef.current.x,
                y: e.clientY - startPanRef.current.y
            };
            drawCallbackRef.current?.();
            return;
        }

        if (draggedNodeRef.current) {
            const pos = getCanvasMousePos(e);
            const n = draggedNodeRef.current;
            n.x = pos.x;
            n.y = pos.y;
            n.fx = pos.x;
            n.fy = pos.y;
            n.vx = 0;
            n.vy = 0;
            startSimulationRef.current?.();
            return;
        }

        // Hover Checks
        const pos = getCanvasMousePos(e);
        const hovered = simulationNodesRef.current.find(n => {
            const dx = n.x - pos.x;
            const dy = n.y - pos.y;
            return dx * dx + dy * dy < (n.radius + 8) * (n.radius + 8);
        });

        if (hovered !== hoveredNode) {
            setHoveredNode(hovered || null);
        }
    };

    const handleMouseUp = () => {
        isPanningRef.current = false;
        if (draggedNodeRef.current) {
            draggedNodeRef.current.fx = null;
            draggedNodeRef.current.fy = null;
            draggedNodeRef.current = null;
            startSimulationRef.current?.();
        }
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomCoeff = 0.06;
        const scaleChange = e.deltaY < 0 ? (1 + zoomCoeff) : (1 - zoomCoeff);

        const oldScale = transformRef.current.scale;
        const newScale = Math.min(Math.max(oldScale * scaleChange, 0.15), 4);

        // Zoom to Mouse Cursor center
        const transX = mouseX - (mouseX - transformRef.current.x) * (newScale / oldScale);
        const transY = mouseY - (mouseY - transformRef.current.y) * (newScale / oldScale);

        transformRef.current = {
            x: transX,
            y: transY,
            scale: newScale
        };
        drawCallbackRef.current?.();
    };

    // Legends Map
    const legendItems = useMemo(() => {
        if (groupBy === 'folder') {
            return folders.map(f => ({ name: f, color: getHashColor(f) }));
        }
        if (groupBy === 'tag') {
            return tags.map(t => ({ name: t, color: getHashColor(t) }));
        }
        return [];
    }, [folders, tags, groupBy]);

    return (
        <div ref={containerRef} className="notes-graph-container" style={{
            position: 'relative', width: '100%', height: '100%',
            background: 'var(--bg-app)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Top Toolbar overlay */}
            <div className="graph-toolbar" style={{
                position: 'absolute', top: 12, left: 12, right: 12,
                display: 'flex', gap: 8, zIndex: 10, flexWrap: 'wrap',
                pointerEvents: 'none' // enable clicking canvas underneath
            }}>
                {/* Search bar inside glass panel */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--bg-panel)', backdropFilter: 'blur(10px)',
                    border: '1px solid var(--border-color)', borderRadius: '8px',
                    padding: '4px 10px', flex: 1, minWidth: 150, pointerEvents: 'auto',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <Search size={14} style={{ color: 'var(--text-secondary)' }} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search notes, tags, folders..."
                        style={{
                            border: 'none', background: 'transparent',
                            color: 'var(--text-primary)', fontSize: '0.82rem',
                            width: '100%', outline: 'none'
                        }}
                    />
                </div>

                {/* Switcher grouping buttons */}
                <div style={{
                    display: 'flex', background: 'var(--bg-panel)', backdropFilter: 'blur(10px)',
                    border: '1px solid var(--border-color)', borderRadius: '8px',
                    padding: 2, pointerEvents: 'auto', boxShadow: 'var(--shadow-sm)'
                }}>
                    <button
                        onClick={() => { setGroupBy('folder'); setActiveLegendItem(null); }}
                        title="Group by folders"
                        style={{
                            border: 'none', background: groupBy === 'folder' ? 'var(--accent-color)' : 'transparent',
                            color: groupBy === 'folder' ? 'white' : 'var(--text-secondary)',
                            borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Folder size={13} />
                    </button>
                    <button
                        onClick={() => { setGroupBy('tag'); setActiveLegendItem(null); }}
                        title="Group by tags"
                        style={{
                            border: 'none', background: groupBy === 'tag' ? 'var(--accent-color)' : 'transparent',
                            color: groupBy === 'tag' ? 'white' : 'var(--text-secondary)',
                            borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Tag size={13} />
                    </button>
                    <button
                        onClick={() => { setGroupBy('none'); setActiveLegendItem(null); }}
                        title="Plain View"
                        style={{
                            border: 'none', background: groupBy === 'none' ? 'var(--accent-color)' : 'transparent',
                            color: groupBy === 'none' ? 'white' : 'var(--text-secondary)',
                            borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Layers size={13} />
                    </button>
                </div>

                {/* Canvas Control Tools */}
                <div style={{
                    display: 'flex', background: 'var(--bg-panel)', backdropFilter: 'blur(10px)',
                    border: '1px solid var(--border-color)', borderRadius: '8px',
                    padding: 2, pointerEvents: 'auto', boxShadow: 'var(--shadow-sm)'
                }}>
                    <button
                        onClick={() => {
                            const center = transformRef.current;
                            transformRef.current = { ...center, scale: Math.min(center.scale + 0.15, 4) };
                        }}
                        title="Zoom In"
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', padding: '6px 8px', cursor: 'pointer' }}
                    >
                        <ZoomIn size={13} />
                    </button>
                    <button
                        onClick={() => {
                            const center = transformRef.current;
                            transformRef.current = { ...center, scale: Math.max(center.scale - 0.15, 0.15) };
                        }}
                        title="Zoom Out"
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', padding: '6px 8px', cursor: 'pointer' }}
                    >
                        <ZoomOut size={13} />
                    </button>
                    <button
                        onClick={fitToCanvas}
                        title="Fit to Screen"
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', padding: '6px 8px', cursor: 'pointer' }}
                    >
                        <Maximize2 size={13} />
                    </button>
                </div>
            </div>

            {/* Core HTML5 Canvas */}
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{ flex: 1, display: 'block', cursor: isPanningRef.current ? 'grabbing' : 'grab' }}
            />

            {/* Float HUD bottom helper instructions */}
            <div style={{
                position: 'absolute', bottom: 12, left: 12,
                fontSize: '0.68rem', color: 'var(--text-secondary)',
                background: 'rgba(20, 20, 25, 0.4)', backdropFilter: 'blur(4px)',
                padding: '4px 8px', borderRadius: 4, pointerEvents: 'none'
            }}>
                Double-click node to open note • Right-click/Shift-drag to pan
            </div>

            {/* Floating side Legend overlay */}
            {legendItems.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: 12, right: 12, top: 60,
                    width: 140, display: 'flex', flexDirection: 'column', gap: 6,
                    background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                    borderRadius: 8, padding: 10, overflowY: 'auto',
                    boxShadow: 'var(--shadow-md)', pointerEvents: 'auto'
                }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 4, marginBottom: 4 }}>
                        {groupBy === 'folder' ? 'Folders' : 'Tags'}
                    </div>
                    {legendItems.map(item => (
                        <div
                            key={item.name}
                            onClick={() => setActiveLegendItem(activeLegendItem === item.name ? null : item.name)}
                            onMouseEnter={() => setActiveLegendItem(item.name)}
                            onMouseLeave={() => setActiveLegendItem(null)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                fontSize: '0.72rem', color: activeLegendItem === item.name ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: activeLegendItem === item.name ? 600 : 500,
                                background: activeLegendItem === item.name ? 'rgba(150, 150, 150, 0.08)' : 'transparent',
                                borderRadius: 4, padding: '2px 4px', transition: 'all 0.15s'
                            }}
                        >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name}>
                                {item.name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

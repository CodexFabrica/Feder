import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Search, ZoomIn, ZoomOut, Maximize2, Layers } from 'lucide-react';

/**
 * Parses idea items from markdown content.
 * 
 * Format per line:
 *   - [id][links: id1, id2] Idea text
 *   - [id][links: none] Idea text
 *   - [id][links:] Idea text
 *   - [id] Idea text              (no links block = unlinked)
 *
 * Sections are delimited by # headings.
 */
function parseIdeasFromContent(content) {
    if (!content) return { sections: [], ideas: [], links: [] };

    const lines = content.split('\n');
    const sections = [];
    const ideas = [];
    const links = [];

    let currentSection = { title: '(Untitled)', ideas: [] };

    // Regex for idea lines:
    //   - [id]  optionally followed by  [links: ...]  then the text
    const ideaRegex = /^\s*[-*+]\s+\[([^\]]+)\](?:\s*\[links?:\s*([^\]]*)\])?\s*(.*)/;

    lines.forEach(line => {
        // Check for section heading
        const headingMatch = line.match(/^#+\s+(.+)/);
        if (headingMatch) {
            // Push previous section if it had ideas
            if (currentSection.ideas.length > 0) {
                sections.push(currentSection);
            }
            currentSection = { title: headingMatch[1].trim(), ideas: [] };
            return;
        }

        // Check for idea item
        const ideaMatch = line.match(ideaRegex);
        if (ideaMatch) {
            const id = ideaMatch[1].trim();
            const linksRaw = ideaMatch[2];
            const text = ideaMatch[3].trim();

            // Parse links
            let ideaLinks = [];
            if (linksRaw !== undefined && linksRaw !== null) {
                const cleaned = linksRaw.trim().toLowerCase();
                if (cleaned && cleaned !== 'none' && cleaned !== '') {
                    ideaLinks = linksRaw.split(',').map(l => l.trim()).filter(l => l && l.toLowerCase() !== 'none');
                }
            }

            const idea = {
                id,
                text: text || `Idea ${id}`,
                section: currentSection.title,
                links: ideaLinks
            };

            currentSection.ideas.push(idea);
            ideas.push(idea);

            // Build link edges
            ideaLinks.forEach(targetId => {
                links.push({ source: id, target: targetId });
            });
        }
    });

    // Push final section
    if (currentSection.ideas.length > 0) {
        sections.push(currentSection);
    }

    return { sections, ideas, links };
}

// HSL hash for section coloring
const getSectionColor = (name, lightness = 60) => {
    if (!name) return 'var(--accent-color)';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 70%, ${lightness}%)`;
};

export function IdeasGraph({ content }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Search & Legend State
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredNode, setHoveredNode] = useState(null);
    const [activeLegendItem, setActiveLegendItem] = useState(null);

    // Zoom/Pan State
    const transformRef = useRef({ x: 0, y: 0, scale: 1 });
    const isPanningRef = useRef(false);
    const startPanRef = useRef({ x: 0, y: 0 });

    // Physics Simulation State
    const simulationNodesRef = useRef([]);
    const simulationLinksRef = useRef([]);
    const draggedNodeRef = useRef(null);
    const animationFrameRef = useRef(null);
    const startSimulationRef = useRef(null);
    const drawCallbackRef = useRef(null);

    // Parse ideas from content
    const { sections, ideas, links: ideaLinks } = useMemo(() => {
        return parseIdeasFromContent(content);
    }, [content]);

    // Build graph nodes and links
    const { nodes, links, sectionNames } = useMemo(() => {
        const nodesMap = new Map();
        const sectionSet = new Set();

        ideas.forEach(idea => {
            sectionSet.add(idea.section);
            // Node radius scales with connection count
            const inboundCount = ideaLinks.filter(l => l.target === idea.id).length;
            const outboundCount = idea.links.length;
            const connectionCount = inboundCount + outboundCount;

            nodesMap.set(idea.id, {
                id: idea.id,
                text: idea.text,
                section: idea.section,
                radius: 5 + Math.min(connectionCount * 2, 14),
                // Depth hint: count dots in id (e.g. "2.1" = depth 2)
                depth: idea.id.split('.').length
            });
        });

        // Build edges (only if both source and target exist)
        const edges = [];
        ideaLinks.forEach(link => {
            if (nodesMap.has(link.source) && nodesMap.has(link.target)) {
                edges.push({
                    source: link.source,
                    target: link.target
                });
            }
        });

        return {
            nodes: Array.from(nodesMap.values()),
            links: edges,
            sectionNames: Array.from(sectionSet)
        };
    }, [ideas, ideaLinks]);

    // Initialize/Sync Simulation Nodes
    useEffect(() => {
        const prevNodes = new Map(simulationNodesRef.current.map(n => [n.id, n]));
        const width = containerRef.current ? containerRef.current.clientWidth : 500;
        const height = containerRef.current ? containerRef.current.clientHeight : 500;

        // Position by section cluster offset
        const sectionOffsets = {};
        sectionNames.forEach((s, i) => {
            const angle = (i / Math.max(sectionNames.length, 1)) * Math.PI * 2;
            const clusterRadius = Math.min(width, height) * 0.2;
            sectionOffsets[s] = {
                cx: width / 2 + Math.cos(angle) * clusterRadius,
                cy: height / 2 + Math.sin(angle) * clusterRadius
            };
        });

        simulationNodesRef.current = nodes.map(n => {
            const existing = prevNodes.get(n.id);
            const offset = sectionOffsets[n.section] || { cx: width / 2, cy: height / 2 };
            return {
                ...n,
                x: existing ? existing.x : offset.cx + (Math.random() - 0.5) * 120,
                y: existing ? existing.y : offset.cy + (Math.random() - 0.5) * 120,
                vx: existing ? existing.vx : 0,
                vy: existing ? existing.vy : 0
            };
        });

        simulationLinksRef.current = links.map(l => ({
            ...l,
            sourceNode: simulationNodesRef.current.find(n => n.id === l.source),
            targetNode: simulationNodesRef.current.find(n => n.id === l.target)
        })).filter(l => l.sourceNode && l.targetNode);

    }, [nodes, links, sectionNames]);

    // Fit to Canvas
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

        const pad = 50;
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

    // Auto-fit on ideas change
    useEffect(() => {
        setTimeout(fitToCanvas, 150);
    }, [ideas.length]);

    // Node Color Resolver
    const getNodeColor = (node) => {
        return getSectionColor(node.section);
    };

    // Render & Physics Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const runPhysics = () => {
            const nodesArr = simulationNodesRef.current;
            const linksArr = simulationLinksRef.current;

            const repulsionCoeff = 350;
            const springCoeff = 0.05;
            const centerCoeff = 0.012;
            const idealLength = 65;
            const damping = 0.88;

            const width = canvas.width;
            const height = canvas.height;

            // 1. Repulsion (Coulomb)
            for (let i = 0; i < nodesArr.length; i++) {
                const nodeA = nodesArr[i];
                for (let j = i + 1; j < nodesArr.length; j++) {
                    const nodeB = nodesArr[j];
                    const dx = nodeB.x - nodeA.x;
                    const dy = nodeB.y - nodeA.y;
                    const distSq = dx * dx + dy * dy + 1;
                    const dist = Math.sqrt(distSq);

                    if (dist < 250) {
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

            // 2. Attraction (Hooke spring)
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

            // 3. Center gravity
            const cx = width / 2;
            const cy = height / 2;
            nodesArr.forEach(n => {
                if (n === draggedNodeRef.current) return;
                n.vx += (cx - n.x) * centerCoeff;
                n.vy += (cy - n.y) * centerCoeff;
            });

            // 4. Update positions with damping and measure total kinetic movement
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
            ctx.clearRect(0, 0, width, height);

            ctx.save();
            const trans = transformRef.current;
            ctx.translate(trans.x, trans.y);
            ctx.scale(trans.scale, trans.scale);

            const nodesArr = simulationNodesRef.current;
            const linksArr = simulationLinksRef.current;

            const searchLower = searchQuery.trim().toLowerCase();
            const hasSearch = searchLower.length > 0;

            const isNodeMatch = (n) => {
                if (hasSearch) {
                    return n.text.toLowerCase().includes(searchLower) ||
                           n.id.toLowerCase().includes(searchLower) ||
                           n.section.toLowerCase().includes(searchLower);
                }
                if (activeLegendItem) {
                    return n.section === activeLegendItem;
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

            // Draw links with directional arrows
            linksArr.forEach(link => {
                const s = link.sourceNode;
                const t = link.targetNode;

                const sHover = hoveredNode && s.id === hoveredNode.id;
                const tHover = hoveredNode && t.id === hoveredNode.id;
                const isHighlightedLink = sHover || tHover;

                const sMatch = isNodeMatch(s);
                const tMatch = isNodeMatch(t);

                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(t.x, t.y);

                if (isHighlightedLink) {
                    ctx.strokeStyle = 'var(--accent-color)';
                    ctx.lineWidth = 2;
                    ctx.shadowColor = 'var(--accent-color)';
                    ctx.shadowBlur = 8;
                } else if (hasSearch || activeLegendItem) {
                    ctx.strokeStyle = sMatch && tMatch ? 'rgba(150, 150, 150, 0.4)' : 'rgba(80, 80, 80, 0.08)';
                    ctx.lineWidth = sMatch && tMatch ? 1 : 0.5;
                    ctx.shadowBlur = 0;
                } else if (hoveredNode) {
                    ctx.strokeStyle = 'rgba(80, 80, 80, 0.08)';
                    ctx.lineWidth = 0.5;
                    ctx.shadowBlur = 0;
                } else {
                    ctx.strokeStyle = 'var(--border-color)';
                    ctx.lineWidth = 1;
                    ctx.shadowBlur = 0;
                }

                ctx.stroke();
                ctx.shadowBlur = 0;

                // Draw directional arrow from source (child) pointing toward target (parent)
                const arrowLength = 6;
                const angle = Math.atan2(t.y - s.y, t.x - s.x);
                const arrowX = t.x - Math.cos(angle) * (t.radius + 4);
                const arrowY = t.y - Math.sin(angle) * (t.radius + 4);

                ctx.beginPath();
                ctx.moveTo(arrowX, arrowY);
                ctx.lineTo(
                    arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
                    arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                    arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
                    arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fillStyle = isHighlightedLink ? 'var(--accent-color)' : 'var(--border-color)';
                ctx.fill();
            });

            // Draw nodes
            nodesArr.forEach(node => {
                const matchesSearch = isNodeMatch(node);
                const isHovered = hoveredNode && node.id === hoveredNode.id;
                const isConnected = isConnectedToHovered(node);

                let nodeOpacity = 1;
                if (hoveredNode) {
                    nodeOpacity = isHovered || isConnected ? 1 : 0.15;
                } else if (hasSearch || activeLegendItem) {
                    nodeOpacity = matchesSearch ? 1 : 0.12;
                }

                const baseColor = getNodeColor(node);

                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

                if (isHovered) {
                    ctx.shadowBlur = 14;
                    ctx.shadowColor = baseColor;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.globalAlpha = nodeOpacity;
                ctx.fillStyle = baseColor;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;

                // Outer ring for hovered
                if (isHovered) {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
                    ctx.strokeStyle = baseColor;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }

                // ID badge inside/beside node
                const shouldDrawLabel = trans.scale > 0.35 || isHovered || matchesSearch;

                if (shouldDrawLabel) {
                    // Draw ID badge
                    ctx.font = isHovered
                        ? 'bold 8px Outfit, Inter, sans-serif'
                        : '600 7px Outfit, Inter, sans-serif';
                    ctx.fillStyle = isHovered
                        ? 'var(--text-primary)'
                        : `rgba(200, 205, 220, ${nodeOpacity * 0.9})`;
                    ctx.textAlign = 'center';
                    ctx.fillText(`[${node.id}]`, node.x, node.y - node.radius - 4);

                    // Draw idea text below
                    ctx.font = isHovered
                        ? 'bold 9px Outfit, Inter, sans-serif'
                        : '500 8px Outfit, Inter, sans-serif';
                    ctx.fillStyle = isHovered
                        ? 'var(--text-primary)'
                        : `rgba(180, 185, 200, ${nodeOpacity * 0.8})`;

                    // Truncate long text
                    const maxTextLen = isHovered ? 50 : 30;
                    const displayText = node.text.length > maxTextLen
                        ? node.text.substring(0, maxTextLen) + '…'
                        : node.text;
                    ctx.fillText(displayText, node.x, node.y + node.radius + 11);
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
    }, [searchQuery, hoveredNode, activeLegendItem]);

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

    // Mouse coordinate helper
    const getCanvasMousePos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const trans = transformRef.current;
        return {
            x: (mouseX - trans.x) / trans.scale,
            y: (mouseY - trans.y) / trans.scale
        };
    };

    // Mouse handlers
    const handleMouseDown = (e) => {
        if (e.button === 2 || e.shiftKey) {
            isPanningRef.current = true;
            startPanRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
            return;
        }

        const pos = getCanvasMousePos(e);
        const clicked = simulationNodesRef.current.find(n => {
            const dx = n.x - pos.x;
            const dy = n.y - pos.y;
            return dx * dx + dy * dy < (n.radius + 8) * (n.radius + 8);
        });

        if (clicked) {
            draggedNodeRef.current = clicked;
            clicked.fx = clicked.x;
            clicked.fy = clicked.y;
        } else {
            isPanningRef.current = true;
            startPanRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
        }
    };

    const handleMouseMove = (e) => {
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

        // Hover checks
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

        const transX = mouseX - (mouseX - transformRef.current.x) * (newScale / oldScale);
        const transY = mouseY - (mouseY - transformRef.current.y) * (newScale / oldScale);

        transformRef.current = { x: transX, y: transY, scale: newScale };
        drawCallbackRef.current?.();
    };

    // Legend items
    const legendItems = useMemo(() => {
        return sectionNames.map(s => ({ name: s, color: getSectionColor(s) }));
    }, [sectionNames]);

    // Empty state
    if (ideas.length === 0) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: 'var(--text-secondary)', padding: '0 24px', textAlign: 'center',
                gap: 12
            }}>
                <Layers size={36} style={{ opacity: 0.3 }} />
                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No ideas found</div>
                <div style={{ fontSize: '0.82rem', opacity: 0.7, lineHeight: 1.5 }}>
                    Add ideas to this file using the format:<br />
                    <code style={{ background: 'var(--bg-app)', padding: '2px 6px', borderRadius: 4, fontSize: '0.78rem' }}>
                        - [1][links: none] Your idea text
                    </code>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="ideas-graph-container" style={{
            position: 'relative', width: '100%', height: '100%',
            background: 'var(--bg-app)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Top Toolbar overlay */}
            <div className="graph-toolbar" style={{
                position: 'absolute', top: 12, left: 12, right: 12,
                display: 'flex', gap: 8, zIndex: 10, flexWrap: 'wrap',
                pointerEvents: 'none'
            }}>
                {/* Search bar */}
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
                        placeholder="Search ideas, sections..."
                        style={{
                            border: 'none', background: 'transparent',
                            color: 'var(--text-primary)', fontSize: '0.82rem',
                            width: '100%', outline: 'none'
                        }}
                    />
                </div>

                {/* Canvas Controls */}
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

            {/* HUD bottom helper */}
            <div style={{
                position: 'absolute', bottom: 12, left: 12,
                fontSize: '0.68rem', color: 'var(--text-secondary)',
                background: 'rgba(20, 20, 25, 0.4)', backdropFilter: 'blur(4px)',
                padding: '4px 8px', borderRadius: 4, pointerEvents: 'none'
            }}>
                {ideas.length} idea{ideas.length !== 1 ? 's' : ''} • {sectionNames.length} section{sectionNames.length !== 1 ? 's' : ''} • Right-click/Shift-drag to pan
            </div>

            {/* Floating section legend */}
            {legendItems.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: 12, right: 12, top: 60,
                    width: 140, display: 'flex', flexDirection: 'column', gap: 6,
                    background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                    borderRadius: 8, padding: 10, overflowY: 'auto',
                    boxShadow: 'var(--shadow-md)', pointerEvents: 'auto'
                }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 4, marginBottom: 4 }}>
                        Sections
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

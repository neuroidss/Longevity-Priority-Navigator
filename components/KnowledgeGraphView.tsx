
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { KnowledgeGraph, KnowledgeGraphNode, TrendAnalysis } from '../types';
import { GeneIcon, ProteinIcon, CompoundIcon, PathwayIcon, DiseaseIcon, HypothesisIcon, LightbulbIcon, MethodIcon, ResultIcon, ObservationIcon, BeakerIcon, GearIcon } from './icons';

interface KnowledgeGraphViewProps {
    graph: KnowledgeGraph;
    onNodeClick: (node: KnowledgeGraphNode) => void;
    selectedNodeId: string | null;
    highlightedNodeIds: string[] | null;
    trendAnalysis: TrendAnalysis | null;
}

const NODE_RADIUS = 30;
const FONT_SIZE = 10;

// --- Physics Parameters ---
const REPULSION_STRENGTH = 1200; // Increased to push nodes further apart
const ATTRACTION_STRENGTH = 0.02; // Decreased to allow for more spread
const IDEAL_LENGTH_DEFAULT = 320; // Increased for longer links
const DAMPING = 0.85; // Slightly increased for smoother settling
const CENTER_GRAVITY = 0.015; // Decreased to reduce central pull
const CLUSTER_GRAVITY = 0.06; // Significantly decreased to reduce clumping by type
const SIMULATION_STOP_THRESHOLD = 0.005;

// --- Trend-specific Physics ---
const TREND_GRAVITY = 0.08;


const NodeIcon: React.FC<{ type: KnowledgeGraphNode['type']; className?: string }> = ({ type, className="h-5 w-5" }) => {
    switch(type) {
        case 'Gene': return <GeneIcon className={className} />;
        case 'Protein': return <ProteinIcon className={className} />;
        case 'Compound': return <CompoundIcon className={className} />;
        case 'Pathway': return <PathwayIcon className={className} />;
        case 'Disease': return <DiseaseIcon className={className} />;
        case 'Hypothesis': return <HypothesisIcon className={className} />;
        case 'KnowledgeGap': return <LightbulbIcon className={className} />;
        case 'Method': return <MethodIcon className={className} />;
        case 'Result': return <ResultIcon className={className} />;
        case 'Observation': return <ObservationIcon className={className} />;
        case 'Biomarker': return <BeakerIcon className={className} />;
        case 'Tool': return <GearIcon className={className} />;
        case 'Topic': return <div className="text-yellow-300">
            <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.5 7a.5.5 0 00-1 0v6a.5.5 0 001 0V7zM11.5 7a.5.5 0 00-1 0v6a.5.5 0 001 0V7z" clipRule="evenodd" />
            </svg>
        </div>;
        default: return null;
    }
};

const getNodeColor = (type: KnowledgeGraphNode['type']) => {
    const colors: Record<string, { fill: string; stroke: string; text: string; }> = {
        Gene: { fill: 'rgba(16, 185, 129, 0.1)', stroke: '#10B981', text: '#D1FAE5' },
        Protein: { fill: 'rgba(59, 130, 246, 0.1)', stroke: '#3B82F6', text: '#DBEAFE' },
        Compound: { fill: 'rgba(245, 158, 11, 0.1)', stroke: '#F59E0B', text: '#FEF3C7' },
        Pathway: { fill: 'rgba(139, 92, 246, 0.1)', stroke: '#8B5CF6', text: '#E9D5FF' },
        Disease: { fill: 'rgba(239, 68, 68, 0.1)', stroke: '#EF4444', text: '#FEE2E2' },
        Hypothesis: { fill: 'rgba(217, 70, 239, 0.1)', stroke: '#D946EF', text: '#F5D0FE' },
        KnowledgeGap: { fill: 'rgba(20, 184, 166, 0.1)', stroke: '#14B8A6', text: '#CCFBF1' },
        Topic: { fill: 'rgba(252, 211, 77, 0.1)', stroke: '#FBBF24', text: '#FDE68A' },
        Method: { fill: 'rgba(100, 116, 139, 0.1)', stroke: '#64748B', text: '#CBD5E1' },
        Result: { fill: 'rgba(34, 211, 238, 0.1)', stroke: '#22D3EE', text: '#A5F3FC' },
        Observation: { fill: 'rgba(244, 114, 182, 0.1)', stroke: '#F472B6', text: '#FBCFE8' },
        Biomarker: { fill: 'rgba(45, 212, 191, 0.1)', stroke: '#14B8A6', text: '#A7F3D0' },
        Tool: { fill: 'rgba(100, 116, 139, 0.1)', stroke: '#64748B', text: '#E2E8F0' },
        default: { fill: 'rgba(100, 116, 139, 0.1)', stroke: '#64748B', text: '#CBD5E1' },
    };
    return colors[type] || colors.default;
};


const wrapText = (text: string, maxWidth: number) => {
    const words = text.split(/\s+/);
    if (words.length === 0) return [];
    
    let line = '';
    const lines: string[] = [];
    
    for (const word of words) {
        if ((line + word).length > maxWidth) {
            lines.push(line.trim());
            line = word + ' ';
        } else {
            line += word + ' ';
        }
    }
    lines.push(line.trim());
    return lines;
};

interface NodeModifier {
    scale: number;
    opacity: number;
    glow: boolean;
}

const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({ graph, onNodeClick, selectedNodeId, highlightedNodeIds, trendAnalysis }) => {
    const [simNodes, setSimNodes] = useState<any[]>([]);
    const [nodeModifiers, setNodeModifiers] = useState<Record<string, NodeModifier>>({});
    const containerRef = useRef<SVGSVGElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const isDraggingRef = useRef<string | null>(null);
    const simulationActive = useRef(false);

    const nodesMap = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph.nodes]);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    
    useEffect(() => {
        const svgElement = containerRef.current;
        if (!svgElement) return;

        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                if (width > 0 && height > 0) {
                    setDimensions({ width, height });
                }
            }
        });

        resizeObserver.observe(svgElement);
        return () => resizeObserver.unobserve(svgElement);
    }, []);

    useEffect(() => {
        const targetModifiers: Record<string, NodeModifier> = {};
        for (const node of graph.nodes) {
             if (trendAnalysis) {
                switch (node.zone) {
                    case 'emerging':
                        targetModifiers[node.id] = { scale: 1.5, opacity: 1, glow: true };
                        break;
                    case 'fading':
                        targetModifiers[node.id] = { scale: 0.7, opacity: 0.6, glow: false };
                        break;
                    case 'connecting':
                        targetModifiers[node.id] = { scale: 1, opacity: 0.8, glow: false };
                        break;
                    default:
                        // Fallback for nodes without a zone in a trend analysis
                        targetModifiers[node.id] = { scale: 0.9, opacity: 0.7, glow: false };
                }
            } else {
                targetModifiers[node.id] = { scale: 1, opacity: 1, glow: false };
            }
        }
    
        if (trendAnalysis) {
             // Reset to default sizes before transitioning
            const defaultModifiers: Record<string, NodeModifier> = {};
            graph.nodes.forEach(node => {
                defaultModifiers[node.id] = { scale: 1, opacity: 1, glow: false };
            });
            setNodeModifiers(defaultModifiers);
            
            // Apply new modifiers after a short delay to allow for CSS transition
            const timer = setTimeout(() => setNodeModifiers(targetModifiers), 100);
            return () => clearTimeout(timer);
        } else {
            setNodeModifiers(targetModifiers);
        }
    }, [trendAnalysis, graph.nodes]);


    useEffect(() => {
        if (!containerRef.current || dimensions.width === 0 || dimensions.height === 0) return;
        const { width, height } = dimensions;
        
        const initialNodes = graph.nodes.map(node => ({
            ...node,
            x: node.x ?? width / 2 + (Math.random() - 0.5) * 100,
            y: node.y ?? height / 2 + (Math.random() - 0.5) * 100,
            vx: 0,
            vy: 0,
        }));
        setSimNodes(initialNodes);
        
        simulationActive.current = true;

        const tick = () => {
            setSimNodes(currentNodes => {
                if (currentNodes.length === 0) {
                    simulationActive.current = false;
                    return [];
                }
                
                let totalMovement = 0;

                const clusterCenters: { [key: string]: { x: number; y: number; count: number } } = {};
                for (const node of currentNodes) {
                    const type = node.type || 'default';
                    if (!clusterCenters[type]) clusterCenters[type] = { x: 0, y: 0, count: 0 };
                    clusterCenters[type].x += node.x;
                    clusterCenters[type].y += node.y;
                    clusterCenters[type].count++;
                }
                for (const type in clusterCenters) {
                    clusterCenters[type].x /= clusterCenters[type].count;
                    clusterCenters[type].y /= clusterCenters[type].count;
                }

                const nextNodes = currentNodes.map(nodeA => {
                    let fx = 0, fy = 0;

                    for (const nodeB of currentNodes) {
                        if (nodeA.id === nodeB.id) continue;
                        const dx = nodeA.x - nodeB.x;
                        const dy = nodeA.y - nodeB.y;
                        let distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance < 1) distance = 1;
                        const force = REPULSION_STRENGTH / (distance * distance);
                        fx += (dx / distance) * force;
                        fy += (dy / distance) * force;
                    }
                    
                    if (trendAnalysis) {
                        let targetX = width / 2;
                        switch (nodeA.zone) {
                            case 'fading':
                                targetX = width * 0.2;
                                break;
                            case 'emerging':
                                targetX = width * 0.8;
                                break;
                            case 'connecting':
                                targetX = width * 0.5;
                                break;
                        }

                        const dtx = nodeA.x - targetX;
                        fx -= dtx * TREND_GRAVITY;
                        
                        const dcy = nodeA.y - height / 2;
                        fy -= dcy * (CENTER_GRAVITY * 0.5);

                    } else {
                        const dcx = nodeA.x - width / 2;
                        const dcy = nodeA.y - height / 2;
                        fx -= dcx * CENTER_GRAVITY;
                        fy -= dcy * CENTER_GRAVITY;

                        const type = nodeA.type || 'default';
                        if (clusterCenters[type]) {
                            const clusterCenter = clusterCenters[type];
                            const dccx = nodeA.x - clusterCenter.x;
                            const dccy = nodeA.y - clusterCenter.y;
                            fx -= dccx * CLUSTER_GRAVITY;
                            fy -= dccy * CLUSTER_GRAVITY;
                        }
                    }
                    
                    if (isDraggingRef.current === nodeA.id) {
                         return { ...nodeA, vx: 0, vy: 0 };
                    }

                    nodeA.vx = (nodeA.vx + fx) * DAMPING;
                    nodeA.vy = (nodeA.vy + fy) * DAMPING;
                    nodeA.x += nodeA.vx;
                    nodeA.y += nodeA.vy;

                    nodeA.x = Math.max(NODE_RADIUS, Math.min(width - NODE_RADIUS, nodeA.x));
                    nodeA.y = Math.max(NODE_RADIUS, Math.min(height - NODE_RADIUS, nodeA.y));

                    totalMovement += Math.abs(nodeA.vx) + Math.abs(nodeA.vy);
                    return nodeA;
                });

                for (const edge of graph.edges) {
                    const source = nextNodes.find(n => n.id === edge.source);
                    const target = nextNodes.find(n => n.id === edge.target);
                    if (!source || !target) continue;

                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    const displacement = distance - IDEAL_LENGTH_DEFAULT;
                    const force = ATTRACTION_STRENGTH * displacement;
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    if (isDraggingRef.current !== source.id) {
                        source.vx += fx;
                        source.vy += fy;
                    }
                    if (isDraggingRef.current !== target.id) {
                        target.vx -= fx;
                        target.vy -= fy;
                    }
                }
                
                if (totalMovement < SIMULATION_STOP_THRESHOLD && !isDraggingRef.current) {
                    simulationActive.current = false;
                }
                
                return nextNodes;
            });
            
            if (simulationActive.current) {
                animationFrameRef.current = requestAnimationFrame(tick);
            }
        };

        animationFrameRef.current = requestAnimationFrame(tick);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            simulationActive.current = false;
        };

    }, [graph, dimensions, trendAnalysis]);

    const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
        isDraggingRef.current = nodeId;
        simulationActive.current = true; 
        if (!animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(() => {});
        }
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current || !containerRef.current) return;
        
        const svgPoint = containerRef.current.createSVGPoint();
        svgPoint.x = e.clientX;
        svgPoint.y = e.clientY;
        const ctm = containerRef.current.getScreenCTM()?.inverse();
        if(!ctm) return;
        const { x, y } = svgPoint.matrixTransform(ctm);
        
        setSimNodes(nodes => nodes.map(n => n.id === isDraggingRef.current ? { ...n, x, y, vx: 0, vy: 0 } : n));
        
        if (!simulationActive.current) {
            simulationActive.current = true;
            animationFrameRef.current = requestAnimationFrame(() => {});
        }
    };
    
    const handleMouseUp = () => {
        isDraggingRef.current = null;
    };

    const renderedEdges = useMemo(() => {
        const nodePositions = new Map(simNodes.map(n => [n.id, { x: n.x, y: n.y }]));
        return graph.edges.map((edge, i) => {
            const sourcePos = nodePositions.get(edge.source);
            const targetPos = nodePositions.get(edge.target);
            if (!sourcePos || !targetPos) return null;

            const isHighlighted = (highlightedNodeIds?.includes(edge.source) && highlightedNodeIds?.includes(edge.target));
            
            return (
                <line
                    key={`${edge.source}-${edge.target}-${i}`}
                    x1={sourcePos.x} y1={sourcePos.y}
                    x2={targetPos.x} y2={targetPos.y}
                    className={`transition-all duration-300 ${isHighlighted ? 'stroke-purple-400 stroke-[2.5px]' : 'stroke-slate-600 stroke-[1.5px]'}`}
                />
            );
        });
    }, [simNodes, graph.edges, highlightedNodeIds]);

    return (
        <svg ref={containerRef} className="w-full h-full cursor-grab" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <defs>
                <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                 <linearGradient id="fadeGradient" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="rgba(239, 68, 68, 0.1)" />
                    <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
                </linearGradient>
                <linearGradient id="emergeGradient" x1="1" x2="0" y1="0" y2="0">
                    <stop offset="0%" stopColor="rgba(16, 185, 129, 0.1)" />
                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
                </linearGradient>
            </defs>

            {trendAnalysis && dimensions.width > 0 && (
                <g className="pointer-events-none">
                    <rect x="0" y="0" width={dimensions.width * 0.4} height={dimensions.height} fill="url(#fadeGradient)" />
                    <rect x={dimensions.width * 0.6} y="0" width={dimensions.width * 0.4} height={dimensions.height} fill="url(#emergeGradient)" />
                    <text x={dimensions.width * 0.15} y="40" textAnchor="middle" className="fill-red-400 font-bold text-base opacity-70 tracking-wider">THEN: Fading Concepts</text>
                    <text x={dimensions.width * 0.85} y="40" textAnchor="middle" className="fill-green-400 font-bold text-base opacity-70 tracking-wider">NOW: Emerging Concepts</text>
                </g>
            )}

            <g>{renderedEdges}</g>
            <g>
                {simNodes.map(node => {
                    const originalNode = nodesMap.get(node.id);
                    if (!originalNode) return null;

                    const colors = getNodeColor(originalNode.type);
                    const isSelected = selectedNodeId === node.id;
                    const isHighlighted = highlightedNodeIds?.includes(node.id);
                    const isDimmed = highlightedNodeIds && !isHighlighted;
                    
                    const modifier = nodeModifiers[node.id] || { scale: 1, opacity: 1, glow: false };

                    const labelLines = wrapText(originalNode.label, 14);

                    return (
                        <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y}) scale(${modifier.scale})`}
                            onClick={() => onNodeClick(originalNode)}
                            onMouseDown={(e) => handleMouseDown(e, node.id)}
                            className="cursor-pointer group transition-all duration-500 ease-out"
                            style={{ opacity: isDimmed ? 0.3 : modifier.opacity }}
                        >
                            <circle
                                r={NODE_RADIUS}
                                fill={colors.fill}
                                stroke={isSelected ? '#FBBF24' : isHighlighted ? '#A78BFA' : colors.stroke}
                                strokeWidth={isSelected || isHighlighted ? 3 / modifier.scale : 2 / modifier.scale}
                                className={`transition-all duration-300`}
                                filter={modifier.glow ? 'url(#nodeGlow)' : 'none'}
                            />
                             <text
                                textAnchor="middle"
                                y={- (FONT_SIZE / modifier.scale) * (labelLines.length - 1) * 0.6 + (FONT_SIZE / modifier.scale) / 2}
                                fontSize={FONT_SIZE / modifier.scale}
                                fill={colors.text}
                                className={`select-none font-semibold transition-opacity duration-300`}
                                style={{ pointerEvents: 'none' }}
                            >
                                {labelLines.map((line, index) => (
                                    <tspan key={index} x="0" dy={index > 0 ? `${(FONT_SIZE * 1.2) / modifier.scale}px` : '0'}>{line}</tspan>
                                ))}
                            </text>
                        </g>
                    );
                })}
            </g>
        </svg>
    );
};

export default KnowledgeGraphView;

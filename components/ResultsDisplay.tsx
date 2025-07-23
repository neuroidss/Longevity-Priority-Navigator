
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { type WorkspaceState, type KnowledgeGraphNode, type ResearchOpportunity, type AnalysisLens, type TrendAnalysis, Contradiction, Synergy, GroundingSource } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { LinkIcon, NetworkIcon, LightbulbIcon, HypothesisIcon, BrainIcon, ClockIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, BeakerIcon, ArrowsRightLeftIcon, BuildingLibraryIcon, ShieldCheckIcon, MethodIcon, SynergyIcon, ConflictIcon } from './icons';
import KnowledgeGraphView from './KnowledgeGraphView';
import AnalysisMeta from './AnalysisMeta';
import { LENS_DEFINITIONS } from '../constants';

const Citation: React.FC<{ citationText: string; allSources: GroundingSource[] }> = ({ citationText, allSources }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const indices = citationText.match(/\d+/g)?.map(n => parseInt(n, 10)) || [];
    const citationSources = indices.map(index => allSources[index - 1]).filter(Boolean);

    if (citationSources.length === 0) {
        return <span className="text-purple-300 font-bold">{citationText}</span>;
    }

    return (
        <span ref={wrapperRef} className="relative inline-block">
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="text-purple-300 font-bold cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-purple-400/50 rounded-sm"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                {citationText}
            </button>
            {isOpen && (
                <div 
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 max-w-xs bg-slate-950 text-xs text-slate-200 border border-slate-600 rounded-lg p-2 z-20 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={() => setIsOpen(false)} className="absolute top-1 right-1 p-1 text-slate-500 hover:text-white" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    {citationSources.map((source, idx) => (
                        <a 
                           key={idx} 
                           href={source.uri} 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           className="flex items-start gap-2 text-left p-2 rounded hover:bg-slate-800 transition-colors"
                        >
                           <span className="font-bold text-purple-400 flex-shrink-0">[{indices[idx]}]</span>
                           <span className="text-slate-300 whitespace-normal">{source.title}</span>
                        </a>
                    ))}
                </div>
            )}
        </span>
    );
};


const TextWithCitations: React.FC<{ text: string; sources: GroundingSource[]; className?: string; as?: 'p' | 'span' }> = ({ text, sources, className, as = 'p' }) => {
    const Component = as;
    const renderText = () => {
        if (!text) return '';

        // First, handle bolding
        const boldedParts = text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-bold text-slate-100">{part.slice(2, -2)}</strong>;
            }
            return part;
        });

        // Then, handle citations within each part
        return boldedParts.map((part, i) => {
            if (typeof part !== 'string') return part;

            const citationParts = part.split(/(\[\s*\d+(?:\s*,\s*\d+)*\s*\])/g);
            return citationParts.map((subPart, j) => {
                if (/^\[\s*\d/.test(subPart)) {
                    return <Citation key={`${i}-${j}`} citationText={subPart} allSources={sources} />;
                }
                return <React.Fragment key={`${i}-${j}`}>{subPart}</React.Fragment>;
            });
        });
    };
    
    return <Component className={className}>{renderText()}</Component>;
};


const TrendAnalysisCard: React.FC<{ analysis: TrendAnalysis, sources: GroundingSource[] }> = ({ analysis, sources }) => {
    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl shadow-slate-800/20 space-y-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center">
                <div className="p-3 mb-4 bg-gradient-to-br from-teal-500 to-blue-500 rounded-full">
                    <ClockIcon className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-teal-400 mb-2">Evolution of Research Focus</h2>
                 <TextWithCitations text={analysis.summary} sources={sources} className="text-xl font-medium text-slate-200 max-w-3xl" />
            </div>
            
            {/* Key Shifts - This is the core redesign */}
            {Array.isArray(analysis.keyShifts) && analysis.keyShifts.length > 0 && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-slate-100 text-center">Key Shifts in Focus</h3>
                    <div className="space-y-5">
                        {analysis.keyShifts.map((shift, index) => (
                            <div key={index} className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
                                <h4 className="text-lg font-bold text-center text-teal-300 mb-4">{shift.shiftTitle}</h4>
                                <div className="flex flex-col md:flex-row items-stretch justify-center gap-4">
                                    {/* From */}
                                    <div className="flex-1 text-center bg-slate-900/40 p-4 rounded-lg border-l-4 border-red-500">
                                        <p className="text-sm font-semibold uppercase text-red-400 tracking-wider">Then</p>
                                        <TextWithCitations text={shift.fromFocus} sources={sources} className="text-slate-300 mt-2 font-medium" />
                                    </div>
                                    
                                    {/* Arrow */}
                                    <div className="flex items-center justify-center">
                                        <ArrowsRightLeftIcon className="h-7 w-7 text-slate-500 rotate-90 md:rotate-0" />
                                    </div>
                                    
                                    {/* To */}
                                    <div className="flex-1 text-center bg-slate-900/40 p-4 rounded-lg border-r-4 border-green-500">
                                        <p className="text-sm font-semibold uppercase text-green-400 tracking-wider">Now</p>
                                        <TextWithCitations text={shift.toFocus} sources={sources} className="text-slate-300 mt-2 font-medium" />
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 text-center mt-4 pt-4 border-t border-slate-700/50">
                                    <span className="font-bold">Justification:</span> <TextWithCitations text={shift.justification} sources={sources} as="span" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Additional Concepts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-700/50">
                {Array.isArray(analysis.fadingConcepts) && analysis.fadingConcepts.length > 0 && (
                     <div className="bg-red-900/30 p-4 rounded-lg border-t-2 border-red-500/80 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-red-500/10 p-2 rounded-full flex-shrink-0">
                                <ArrowTrendingDownIcon className="h-6 w-6 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-red-300">Fading Focus</h3>
                                <p className="text-xs text-slate-400 mt-1">These concepts are becoming less central as the field evolves.</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {analysis.fadingConcepts.map((item, index) => (
                                 <div key={index} className="pl-3 border-l-2 border-red-500/50">
                                    <p className="font-semibold text-slate-200">{item.concept}</p>
                                    <TextWithCitations text={item.justification} sources={sources} className="text-sm text-slate-400 mt-1" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {Array.isArray(analysis.emergingConcepts) && analysis.emergingConcepts.length > 0 && (
                    <div className="bg-green-900/30 p-4 rounded-lg border-t-2 border-green-500/80 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-green-500/10 p-2 rounded-full flex-shrink-0">
                                 <ArrowTrendingUpIcon className="h-6 w-6 text-green-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-green-300">Gaining Momentum</h3>
                                <p className="text-xs text-slate-400 mt-1">These concepts are becoming more central to the research discussion.</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {analysis.emergingConcepts.map((item, index) => (
                                 <div key={index} className="pl-3 border-l-2 border-green-500/50">
                                    <p className="font-semibold text-slate-200">{item.concept}</p>
                                     <TextWithCitations text={item.justification} sources={sources} className="text-sm text-slate-400 mt-1" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


const KeyQuestionCard: React.FC<{ question: string, sources: GroundingSource[] }> = ({ question, sources }) => {
    return (
        <div className="bg-gradient-to-tr from-slate-900 to-purple-900/50 border-2 border-purple-500 rounded-2xl p-6 shadow-2xl shadow-purple-500/10">
            <div className="flex flex-col items-center text-center">
                 <BrainIcon className="h-12 w-12 text-purple-300 mb-4" />
                 <h2 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-2">Key Strategic Question</h2>
                 <div className="text-2xl md:text-3xl font-bold text-slate-100 leading-tight">
                    "<TextWithCitations text={question} sources={sources} as="span" />"
                 </div>
            </div>
        </div>
    )
};

const MaturityTag: React.FC<{ maturity: ResearchOpportunity['maturity'] }> = ({ maturity }) => {
    const maturityStyles = {
        'Basic Research': { icon: <BeakerIcon className="h-4 w-4" />, text: 'Basic Research', color: 'text-blue-300', bg: 'bg-blue-900/50' },
        'Translational': { icon: <ArrowsRightLeftIcon className="h-4 w-4" />, text: 'Translational', color: 'text-green-300', bg: 'bg-green-900/50' },
        'Clinical': { icon: <BuildingLibraryIcon className="h-4 w-4" />, text: 'Clinical', color: 'text-amber-300', bg: 'bg-amber-900/50' },
    };
    const style = maturityStyles[maturity] || maturityStyles['Basic Research'];
    return (
        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.color}`}>
            {style.icon}
            <span>{style.text}</span>
        </div>
    );
};

const ConfidenceMeter: React.FC<{ confidence: number }> = ({ confidence }) => {
    const percentage = Math.round(confidence * 100);
    const getConfidenceColor = (value: number) => {
        if (value > 0.75) return 'bg-green-500';
        if (value > 0.5) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div>
            <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-1">
                <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="h-4 w-4" />
                    <span>AI Confidence</span>
                </div>
                <span className="font-bold text-white">{percentage}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div className={`${getConfidenceColor(confidence)} h-1.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Reflects source consensus & data quality.</p>
        </div>
    );
};


const ResearchOpportunityCard: React.FC<{
    opportunity: ResearchOpportunity,
    onHighlight: (nodeIds: string[] | null) => void,
    sources: GroundingSource[],
}> = ({ opportunity, onHighlight, sources }) => {
    return (
        <div 
            className="bg-gradient-to-br from-slate-800/80 to-slate-900/30 border-2 border-slate-700 rounded-lg p-5 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-400"
            onMouseEnter={() => onHighlight(opportunity.relatedNodeIds)}
            onMouseLeave={() => onHighlight(null)}
        >
            <div className="flex flex-col md:flex-row gap-5">
                <div className="text-yellow-300 mt-1 flex-shrink-0">
                    <HypothesisIcon className="h-7 w-7" />
                </div>
                <div className="flex-1 space-y-4">
                    <h3 className="text-xl font-bold text-slate-100">{opportunity.title}</h3>
                    <TextWithCitations text={opportunity.justification} sources={sources} className="text-slate-300 text-sm"/>
                    
                    <div className="pt-4 border-t border-slate-700 space-y-4">
                        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 text-sm">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Maturity</p>
                                <MaturityTag maturity={opportunity.maturity} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Potential Impact</p>
                                <TextWithCitations text={opportunity.potentialImpact} sources={sources} className="text-slate-300 font-medium"/>
                            </div>
                        </div>
                        <ConfidenceMeter confidence={opportunity.confidence} />
                    </div>
                </div>
            </div>
        </div>
    )
};

const CriticalAnalysisCard: React.FC<{ contradictions: Contradiction[], synergies: Synergy[], sources: GroundingSource[] }> = ({ contradictions, synergies, sources }) => {
    if (contradictions.length === 0 && synergies.length === 0) {
        return null;
    }

    return (
        <div className="bg-gradient-to-b from-slate-900 to-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-slate-100 mb-2 text-center">Critical Analysis</h2>
            <p className="text-sm text-slate-400 mb-6 text-center max-w-2xl mx-auto">The AI's synthesis of where the literature disagrees or could be combined for novel insights. This goes beyond what a standard search can provide.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Contradictions */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <ConflictIcon className="h-7 w-7 text-amber-400" />
                        <h3 className="text-xl font-semibold text-amber-300">Contradictions & Gaps</h3>
                    </div>
                    {contradictions.length > 0 ? (
                        <ul className="space-y-4">
                            {contradictions.map(item => (
                                <li key={item.id} className="p-4 bg-amber-900/20 border-l-4 border-amber-500 rounded-r-lg">
                                    <TextWithCitations text={item.statement} sources={sources} className="text-slate-200" />
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-slate-500 text-sm">No significant contradictions identified.</p>}
                </div>

                {/* Synergies */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <SynergyIcon className="h-7 w-7 text-cyan-400" />
                        <h3 className="text-xl font-semibold text-cyan-300">Synergies & Connections</h3>
                    </div>
                    {synergies.length > 0 ? (
                        <ul className="space-y-4">
                            {synergies.map(item => (
                                <li key={item.id} className="p-4 bg-cyan-900/20 border-l-4 border-cyan-500 rounded-r-lg">
                                    <TextWithCitations text={item.statement} sources={sources} className="text-slate-200" />
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-slate-500 text-sm">No novel synergies identified.</p>}
                </div>
            </div>
        </div>
    );
};

const BriefingRenderer: React.FC<{ text: string, sources: GroundingSource[] }> = ({ text, sources }) => {
    if (!text) return null;
    const paragraphs = text.split('\n').filter(p => p.trim());
    return (
        <div className="text-slate-300 leading-relaxed space-y-4 text-sm">
            {paragraphs.map((paragraph, index) => {
                if (paragraph.startsWith('### ')) {
                    return <h3 key={index} className="text-lg font-semibold text-purple-300 mt-4 first:mt-0">{paragraph.substring(4)}</h3>;
                }
                 const isListItem = /^\s*[-*]\s*/.test(paragraph);
                 const content = paragraph.replace(/^\s*[-*]\s*/, '');

                 if(isListItem) {
                    return (
                        <div key={index} className="flex items-start gap-2 pl-4">
                            <span className="text-purple-300 mt-1">•</span>
                            <TextWithCitations text={content} sources={sources} />
                        </div>
                    );
                 }

                return <TextWithCitations key={index} text={content} sources={sources} />;
            })}
        </div>
    );
};

const TabButton = ({ label, icon, isActive, onClick, count }: { label: string, icon: React.ReactNode, isActive: boolean, onClick: () => void, count?: number }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-bold border-b-2 transition-colors duration-200
        ${isActive
            ? 'border-purple-400 text-purple-300'
            : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-t-lg'
        }`}
        role="tab"
        aria-selected={isActive}
    >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        {count !== undefined && (
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-purple-400/20 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                {count}
            </span>
        )}
    </button>
);

interface WorkspaceViewProps {
  workspace: WorkspaceState | null;
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
  loadingMessage: string;
  onNodeClick: (node: KnowledgeGraphNode) => void;
  selectedNodeId: string | null;
  activeTab: 'priorities' | 'knowledge_web' | 'sources';
  setActiveTab: React.Dispatch<React.SetStateAction<'priorities' | 'knowledge_web' | 'sources'>>;
}

const WorkspaceView: React.FC<WorkspaceViewProps> = ({ workspace, isLoading, error, hasSearched, loadingMessage, onNodeClick, selectedNodeId, activeTab, setActiveTab }) => {
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[] | null>(null);
  
  const isTrendAnalysis = !!workspace?.trendAnalysis;

  const hasTextCitations = useMemo(() => {
    if (!workspace) return false;
    const textCorpus = [
      workspace.synthesis,
      workspace.keyQuestion,
      ...(workspace.researchOpportunities || []).map(o => o.justification),
      ...(workspace.contradictions || []).map(c => c.statement),
      ...(workspace.synergies || []).map(s => s.statement),
      workspace.trendAnalysis?.summary,
      ...(Array.isArray(workspace.trendAnalysis?.emergingConcepts) ? workspace.trendAnalysis.emergingConcepts : []).map(c => c.justification),
      ...(Array.isArray(workspace.trendAnalysis?.fadingConcepts) ? workspace.trendAnalysis.fadingConcepts : []).map(c => c.justification),
      ...(Array.isArray(workspace.trendAnalysis?.keyShifts) ? workspace.trendAnalysis.keyShifts : []).map(s => s.justification),
    ].filter(Boolean).join(' ');
    
    // Regex to find citations like [1], [1, 2], [1,2, 16]
    return /\[\s*\d+(?:\s*,\s*\d+)*\s*\]/.test(textCorpus);
  }, [workspace]);

  const researchOpportunitiesByLens = useMemo(() => {
    if (!workspace?.researchOpportunities) {
      return {} as Record<AnalysisLens, ResearchOpportunity[]>;
    }
    return workspace.researchOpportunities.reduce((acc, op) => {
        const lens = op.lens || 'Balanced';
        if (!acc[lens]) {
            acc[lens] = [];
        }
        acc[lens].push(op);
        return acc;
    }, {} as Record<AnalysisLens, ResearchOpportunity[]>);
  }, [workspace?.researchOpportunities]);

  if (isLoading && !workspace) {
    return <LoadingSpinner message={loadingMessage} />;
  }
  
  return (
    <div className="w-full space-y-4">
      {isLoading && <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">Processing...</div>}
      
      {error && (
        <div className="text-center py-12 text-red-400 bg-red-900/20 border border-red-500 rounded-lg max-w-3xl mx-auto">
          <h3 className="text-xl font-bold">An Error Occurred</h3>
          <p className="mt-2">{error}</p>
        </div>
      )}
      
      {!hasSearched && !isLoading && !error && (
        <div className="text-center py-12 h-[50vh] flex flex-col justify-center items-center">
            <BrainIcon className="h-20 w-20 text-slate-600 mb-4" />
            <h2 className="text-2xl font-semibold text-slate-400">Genius is discerning what is truly important.</h2>
            <p className="text-slate-500 mt-2 max-w-xl">This tool helps you navigate longevity research to find the crucial questions and focus on what matters most.</p>
            <p className="text-slate-500 mt-1">Begin by entering a research area.</p>
        </div>
      )}
      
      {hasSearched && !workspace && !isLoading && !error &&(
        <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-slate-400">No results found.</h2>
            <p className="text-slate-500 mt-2">Try a different topic or check the agent logs for errors.</p>
        </div>
      )}

      {workspace && (
        <>
            <AnalysisMeta workspace={workspace} />

            <div className="flex gap-2 sm:gap-4 border-b border-slate-700">
                {!isTrendAnalysis && (
                    <TabButton
                        label="Priorities"
                        icon={<LightbulbIcon className="h-5 w-5" />}
                        isActive={activeTab === 'priorities'}
                        onClick={() => setActiveTab('priorities')}
                    />
                )}
                <TabButton
                    label={isTrendAnalysis ? "Evolution Analysis" : "Knowledge Web"}
                    icon={isTrendAnalysis ? <ClockIcon className="h-5 w-5" /> : <NetworkIcon className="h-5 w-5" />}
                    isActive={activeTab === 'knowledge_web'}
                    onClick={() => setActiveTab('knowledge_web')}
                />
                <TabButton
                    label="Grounding Sources"
                    icon={<MethodIcon className="h-5 w-5" />}
                    isActive={activeTab === 'sources'}
                    onClick={() => setActiveTab('sources')}
                    count={workspace.sources.length}
                />
            </div>

            <div className="py-4">
                {activeTab === 'priorities' && !isTrendAnalysis && (
                    <div className="space-y-8">
                      {workspace.keyQuestion && (
                        <KeyQuestionCard question={workspace.keyQuestion} sources={workspace.sources} />
                      )}

                      {(workspace.contradictions.length > 0 || workspace.synergies.length > 0) && (
                        <CriticalAnalysisCard contradictions={workspace.contradictions} synergies={workspace.synergies} sources={workspace.sources} />
                      )}
                      
                      {workspace.researchOpportunities.length > 0 ? (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <LightbulbIcon className="h-7 w-7 text-yellow-300 flex-shrink-0" />
                                <h2 className="text-2xl font-bold text-slate-100">AI-Proposed Research Directions</h2>
                            </div>
                            {Object.entries(researchOpportunitiesByLens).map(([lens, opportunities]) => (
                                <div key={lens} className="space-y-4">
                                    <h3 className="text-lg font-semibold text-purple-300 pl-1">
                                        From the <span className="font-bold">{LENS_DEFINITIONS.find(l => l.id === lens)?.name || lens}</span> Perspective
                                    </h3>
                                    {opportunities.map(op => (
                                        <ResearchOpportunityCard key={op.id} opportunity={op} onHighlight={setHighlightedNodeIds} sources={workspace.sources} />
                                    ))}
                                </div>
                            ))}
                        </div>
                      ) : (
                           !workspace.keyQuestion && <div className="text-center text-slate-500 py-12">The AI did not identify any priority research directions or a key question for this topic.</div>
                      )}
                    </div>
                )}

                {activeTab === 'knowledge_web' && (
                    <div className="space-y-8">
                      {isTrendAnalysis && workspace.trendAnalysis && (
                          <TrendAnalysisCard analysis={workspace.trendAnalysis} sources={workspace.sources} />
                      )}
                      {isTrendAnalysis && workspace.keyQuestion && (
                          <KeyQuestionCard question={workspace.keyQuestion} sources={workspace.sources} />
                      )}
                      
                      {isTrendAnalysis && workspace.researchOpportunities.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <LightbulbIcon className="h-7 w-7 text-yellow-300 flex-shrink-0" />
                                <h2 className="text-2xl font-bold text-slate-100">AI-Proposed Future Directions</h2>
                            </div>
                            {Object.entries(researchOpportunitiesByLens).map(([lens, opportunities]) => (
                                <div key={lens} className="space-y-4">
                                    <h3 className="text-lg font-semibold text-purple-300 pl-1">
                                        From the <span className="font-bold">{LENS_DEFINITIONS.find(l => l.id === lens)?.name || lens}</span> Perspective
                                    </h3>
                                    {opportunities.map(op => (
                                        <ResearchOpportunityCard key={op.id} opportunity={op} onHighlight={setHighlightedNodeIds} sources={workspace.sources} />
                                    ))}
                                </div>
                            ))}
                        </div>
                      )}

                      <div className="p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-700">
                          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mb-2">
                              {isTrendAnalysis ? <ClockIcon className="h-7 w-7 text-teal-300" /> : <NetworkIcon className="h-7 w-7 text-teal-300" />}
                              <h2 className="text-2xl font-bold text-slate-100 text-center sm:text-left">
                                  {isTrendAnalysis ? "Evolution Knowledge Web" : "Longevity Knowledge Web"}
                              </h2>
                          </div>
                          <p className="text-slate-400 text-center sm:text-left mb-4">
                              {workspace.trendAnalysis ? 
                                <span className="text-teal-300 font-semibold">Visualizing research trends:</span> :
                                <><span className="text-purple-300 font-semibold">Hover a direction card</span> to see its context, or </>
                              }
                               <span className="text-teal-300 font-semibold">click a node</span> to ask questions.
                          </p>
                          <div className="w-full h-[75vh] bg-slate-800/40 rounded-lg overflow-hidden relative border border-slate-700">
                              {workspace.knowledgeGraph && workspace.knowledgeGraph.nodes.length > 0 
                                ? <KnowledgeGraphView 
                                    graph={workspace.knowledgeGraph} 
                                    onNodeClick={onNodeClick} 
                                    selectedNodeId={selectedNodeId} 
                                    highlightedNodeIds={highlightedNodeIds}
                                    trendAnalysis={workspace.trendAnalysis}
                                  />
                                : <div className="flex items-center justify-center h-full text-slate-500">The agent did not generate a knowledge graph.</div>
                              }
                          </div>
                      </div>

                      {workspace.synthesis && (
                        <div className="p-4 sm:p-6 bg-gradient-to-br from-slate-800/80 to-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-700">
                            <h2 className="text-xl font-bold text-slate-100 mb-3">
                                Strategic Briefing
                            </h2>
                            <BriefingRenderer text={workspace.synthesis} sources={workspace.sources} />
                        </div>
                      )}
                    </div>
                )}

                {activeTab === 'sources' && (
                    <div className="space-y-8">
                        {workspace.sources.length > 0 ? (
                            <div>
                                <h2 className="text-2xl font-bold text-slate-100 mb-4">Grounding Sources ({workspace.sources.length})</h2>
                                <p className="text-sm text-slate-400 mb-6">The AI agent used the following web pages as its knowledge base to generate the analysis. These are the verifiable sources for the information presented.</p>
                                <ul className="space-y-2">
                                    {workspace.sources.map((source, index) => (
                                    <li key={`${source.uri}-${index}`} className="text-sm">
                                        <a
                                        href={source.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-blue-400 hover:text-blue-300 hover:underline transition-colors group"
                                        >
                                            <span className="text-xs font-mono bg-slate-700 text-slate-300 rounded px-1.5 py-0.5 mr-2">[{index + 1}]</span>
                                            <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                                            <span className="truncate group-hover:underline">{source.title || source.uri}</span>
                                        </a>
                                    </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                             <div className="text-center text-slate-400 py-12 px-6 bg-slate-800/50 rounded-lg">
                                <h3 className="text-xl font-bold text-slate-200">
                                    {hasTextCitations ? "Inline Citations Found" : "No Grounding Sources Provided"}
                                </h3>
                                <p className="mt-2 max-w-2xl mx-auto">
                                    {hasTextCitations 
                                        ? "The AI agent included citations in its analysis (e.g., [1], [2]), but did not provide corresponding web links in its structured output. This can occur if sources are from paywalled journals, academic papers not easily accessible online, or part of the model's pre-training data."
                                        : "The AI did not cite any verifiable grounding sources for this analysis."
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
      )}
    </div>
  );
};

export default WorkspaceView;

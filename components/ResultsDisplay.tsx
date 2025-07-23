

import React, { useState, useMemo, useEffect } from 'react';
import { type WorkspaceState, type WorkspaceItem, type KnowledgeGraphNode, type ResearchOpportunity, type AnalysisLens, type TrendAnalysis } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { LinkIcon, ArticleIcon, PatentIcon, NetworkIcon, LightbulbIcon, HypothesisIcon, BrainIcon, ClockIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, BeakerIcon, ArrowsRightLeftIcon, BuildingLibraryIcon, ShieldCheckIcon, MethodIcon } from './icons';
import KnowledgeGraphView from './KnowledgeGraphView';
import { LENS_DEFINITIONS } from '../constants';

interface WorkspaceViewProps {
  workspace: WorkspaceState | null;
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
  loadingMessage: string;
  onNodeClick: (node: KnowledgeGraphNode) => void;
  selectedNodeId: string | null;
  activeTab: 'priorities' | 'knowledge_web' | 'sources';
  setActiveTab: (tab: 'priorities' | 'knowledge_web' | 'sources') => void;
}

const TrendAnalysisCard: React.FC<{ analysis: TrendAnalysis }> = ({ analysis }) => {
    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl shadow-slate-800/20 space-y-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center">
                <div className="p-3 mb-4 bg-gradient-to-br from-teal-500 to-blue-500 rounded-full">
                    <ClockIcon className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-teal-400 mb-2">Evolution of Research Focus</h2>
                <p className="text-xl font-medium text-slate-200 max-w-3xl">{analysis.summary}</p>
            </div>
            
            {/* Key Shifts - This is the core redesign */}
            {analysis.keyShifts?.length > 0 && (
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
                                        <p className="text-slate-300 mt-2 font-medium">{shift.fromFocus}</p>
                                    </div>
                                    
                                    {/* Arrow */}
                                    <div className="flex items-center justify-center">
                                        <ArrowsRightLeftIcon className="h-7 w-7 text-slate-500 rotate-90 md:rotate-0" />
                                    </div>
                                    
                                    {/* To */}
                                    <div className="flex-1 text-center bg-slate-900/40 p-4 rounded-lg border-r-4 border-green-500">
                                        <p className="text-sm font-semibold uppercase text-green-400 tracking-wider">Now</p>
                                        <p className="text-slate-300 mt-2 font-medium">{shift.toFocus}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 text-center mt-4 pt-4 border-t border-slate-700/50">
                                    <span className="font-bold">Justification:</span> {shift.justification}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Additional Concepts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-700/50">
                {analysis.emergingConcepts?.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                            <ArrowTrendingUpIcon className="text-green-400" />
                            Other Emerging Concepts
                        </h3>
                        {analysis.emergingConcepts.map((item, index) => (
                             <div key={index} className="bg-slate-800/40 p-3 rounded-md border-l-2 border-green-600">
                                <p className="font-semibold text-green-300">{item.concept}</p>
                                <p className="text-xs text-slate-400 mt-1">{item.justification}</p>
                            </div>
                        ))}
                    </div>
                )}
                {analysis.fadingConcepts?.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                            <ArrowTrendingDownIcon className="text-red-400" />
                            De-emphasized/Solved Concepts
                        </h3>
                         {analysis.fadingConcepts.map((item, index) => (
                             <div key={index} className="bg-slate-800/40 p-3 rounded-md border-l-2 border-red-600">
                                <p className="font-semibold text-red-300">{item.concept}</p>
                                <p className="text-xs text-slate-400 mt-1">{item.justification}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};


const KeyQuestionCard: React.FC<{ question: string }> = ({ question }) => {
    return (
        <div className="bg-gradient-to-tr from-slate-900 to-purple-900/50 border-2 border-purple-500 rounded-2xl p-6 shadow-2xl shadow-purple-500/10">
            <div className="flex flex-col items-center text-center">
                 <BrainIcon className="h-12 w-12 text-purple-300 mb-4" />
                 <h2 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-2">Key Strategic Question</h2>
                 <p className="text-2xl md:text-3xl font-bold text-slate-100 leading-tight">
                    "{question}"
                 </p>
            </div>
        </div>
    )
};

const WorkspaceItemCard: React.FC<{ item: WorkspaceItem }> = ({ item }) => {
    const iconMap: Record<WorkspaceItem['type'], React.ReactNode> = {
        article: <ArticleIcon />,
        patent: <PatentIcon />,
    };
    const icon = iconMap[item.type];

    return (
         <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
            <div className="flex items-start gap-4">
                <div className="text-blue-400 mt-1">{icon}</div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-100 mb-1">{item.title}</h3>
                    <p className="text-slate-300 leading-relaxed text-sm">{item.summary}</p>
                    <p className="text-xs text-slate-500 font-mono mt-3 pt-3 border-t border-slate-700/50">{item.details}</p>
                </div>
            </div>
        </div>
    )
};

const MaturityTag: React.FC<{ maturity: ResearchOpportunity['maturity'] }> = ({ maturity }) => {
    const maturityStyles = {
        'Basic Research': { icon: <BeakerIcon />, text: 'Basic Research', color: 'text-blue-300', bg: 'bg-blue-900/50' },
        'Translational': { icon: <ArrowsRightLeftIcon />, text: 'Translational', color: 'text-green-300', bg: 'bg-green-900/50' },
        'Clinical': { icon: <BuildingLibraryIcon />, text: 'Clinical', color: 'text-amber-300', bg: 'bg-amber-900/50' },
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
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-1">
                <ShieldCheckIcon className="h-4 w-4" />
                <span>AI Confidence</span>
                <span className="font-bold text-white">{percentage}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div className={`${getConfidenceColor(confidence)} h-1.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};


const ResearchOpportunityCard: React.FC<{
    opportunity: ResearchOpportunity,
    onHighlight: (nodeIds: string[] | null) => void,
}> = ({ opportunity, onHighlight }) => {
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
                    <p className="text-slate-300 leading-relaxed text-sm">{opportunity.justification}</p>
                    
                    <div className="pt-4 border-t border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Maturity</p>
                            <MaturityTag maturity={opportunity.maturity} />
                        </div>
                         <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Potential Impact</p>
                            <p className="text-sm text-slate-300 font-medium">{opportunity.potentialImpact}</p>
                        </div>
                        <div className="md:col-span-2">
                             <ConfidenceMeter confidence={opportunity.confidence} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
};

const BriefingRenderer = ({ text }: { text: string }) => {
    const paragraphs = text.split('\n').filter(p => p.trim());
    return (
        <div className="text-slate-300 leading-relaxed space-y-2 text-sm">
            {paragraphs.map((paragraph, index) => {
                if (paragraph.startsWith('### ')) {
                    return <h3 key={index} className="text-lg font-semibold text-purple-300 mt-4 first:mt-0">{paragraph.substring(4)}</h3>;
                }
                
                const parts = paragraph.split(/(\*\*.*?\*\*)/g);
                
                return (
                    <p key={index}>
                        {parts.map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={i} className="font-bold text-slate-100">{part.slice(2, -2)}</strong>;
                            }
                            return <span key={i}>{part.replace(/^\s*[-*]\s*/, '• ')}</span>;
                        })}
                    </p>
                );
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
        {count !== undefined && count > 0 && (
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-purple-400/20 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                {count}
            </span>
        )}
    </button>
);


const WorkspaceView: React.FC<WorkspaceViewProps> = ({ workspace, isLoading, error, hasSearched, loadingMessage, onNodeClick, selectedNodeId, activeTab, setActiveTab }) => {
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[] | null>(null);
  
  useEffect(() => {
    if (workspace && !isLoading) {
      if (workspace.trendAnalysis) {
        setActiveTab('knowledge_web');
      } else if (activeTab === 'knowledge_web' && !workspace.knowledgeGraph) {
        // If KG tab is active but there's no graph, switch to priorities
        setActiveTab('priorities');
      }
    }
  }, [workspace, isLoading, activeTab, setActiveTab]);

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
            <div className="flex gap-2 sm:gap-4 border-b border-slate-700">
                <TabButton
                    label="Priorities"
                    icon={<LightbulbIcon className="h-5 w-5" />}
                    isActive={activeTab === 'priorities'}
                    onClick={() => setActiveTab('priorities')}
                />
                <TabButton
                    label="Knowledge Web"
                    icon={<NetworkIcon className="h-5 w-5" />}
                    isActive={activeTab === 'knowledge_web'}
                    onClick={() => setActiveTab('knowledge_web')}
                />
                {(workspace.items.length > 0 || workspace.sources.length > 0) && (
                    <TabButton
                        label="Sources"
                        icon={<MethodIcon className="h-5 w-5" />}
                        isActive={activeTab === 'sources'}
                        onClick={() => setActiveTab('sources')}
                        count={workspace.items.length + workspace.sources.length}
                    />
                )}
            </div>

            <div className="py-4">
                {activeTab === 'priorities' && (
                    <div className="space-y-8">
                      {workspace.researchOpportunities.length > 0 && (
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
                                        <ResearchOpportunityCard key={op.id} opportunity={op} onHighlight={setHighlightedNodeIds} />
                                    ))}
                                </div>
                            ))}
                        </div>
                      )}
                      {workspace.keyQuestion && (
                        <KeyQuestionCard question={workspace.keyQuestion} />
                      )}
                      {workspace.researchOpportunities.length === 0 && !workspace.keyQuestion && (
                            <div className="text-center text-slate-500 py-12">The AI did not identify any priority research directions or a key question for this topic.</div>
                      )}
                    </div>
                )}
                {activeTab === 'knowledge_web' && (
                    <div className="space-y-8">
                      {workspace.trendAnalysis && (
                          <TrendAnalysisCard analysis={workspace.trendAnalysis} />
                      )}
                      <div className="p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-700">
                          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mb-2">
                              <NetworkIcon className="h-7 w-7 text-teal-300" />
                              <h2 className="text-2xl font-bold text-slate-100 text-center sm:text-left">
                                  Longevity Knowledge Web
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
                            <BriefingRenderer text={workspace.synthesis} />
                        </div>
                      )}
                    </div>
                )}
                {activeTab === 'sources' && (
                    <div className="space-y-8">
                        {workspace.items.length > 0 && (
                            <div>
                            <h4 className="text-2xl font-bold text-slate-100 mb-4">Sourced Items ({workspace.items.length})</h4>
                            <div className="grid grid-cols-1 gap-4">
                                {workspace.items.map((item) => (
                                    <WorkspaceItemCard key={item.id} item={item} />
                                ))}
                            </div>
                            </div>
                        )}
                        
                        {workspace.sources.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-slate-700">
                            <h4 className="text-lg font-semibold text-slate-300 mb-3">Grounding Sources</h4>
                            <ul className="space-y-2">
                                {workspace.sources.map((source, index) => (
                                <li key={`${source.uri}-${index}`} className="text-sm">
                                    <a
                                    href={source.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                                    >
                                    <LinkIcon />
                                    <span className="truncate">{source.title || source.uri}</span>
                                    </a>
                                </li>
                                ))}
                            </ul>
                            </div>
                        )}

                        {workspace.items.length === 0 && workspace.sources.length === 0 && (
                             <div className="text-center text-slate-500 py-12">The AI did not cite any sources for this analysis.</div>
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
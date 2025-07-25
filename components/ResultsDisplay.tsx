
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { type WorkspaceState, type KnowledgeGraphNode, type ResearchOpportunity, type AnalysisLens, type TrendAnalysis, Contradiction, Synergy, GroundingSource, SourceStatus, SearchDataSource, MarketInnovationAnalysis } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { LinkIcon, NetworkIcon, LightbulbIcon, HypothesisIcon, BrainIcon, ClockIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, BeakerIcon, ArrowsRightLeftIcon, BuildingLibraryIcon, ShieldCheckIcon, MethodIcon, SynergyIcon, ConflictIcon, CheckCircleIcon, XCircleIcon, QuestionMarkCircleIcon, ExclamationTriangleIcon, GoogleIcon, ArticleIcon, PatentIcon, GeneIcon, UsersIcon, RocketLaunchIcon, ScaleIcon, BuildingStorefrontIcon } from './icons';
import KnowledgeGraphView from './KnowledgeGraphView';
import AnalysisMeta from './AnalysisMeta';
import { LENS_DEFINITIONS, DATA_SOURCE_DEFINITIONS } from '../constants';

const Citation: React.FC<{ sources: GroundingSource[]; citationText: string; }> = ({ sources, citationText }) => {
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
    const citationData = indices.map(index => ({
        source: sources[index - 1],
        index
    })).filter(data => data.source);

    if (citationData.length === 0) {
        return <span className="text-purple-300 font-bold">{citationText}</span>;
    }

    const isInvalid = citationData.some(d => d.source.status === 'invalid' || d.source.status === 'fetch-failed');

    return (
        <span ref={wrapperRef} className="relative inline-block">
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={`font-bold cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-purple-400/50 rounded-sm
                    ${isInvalid ? 'text-red-400/90 line-through decoration-red-400/80' : 'text-purple-300'}
                `}
                aria-haspopup="true"
                aria-expanded={isOpen}
                title={isInvalid ? "This citation refers to a source marked as invalid." : "View source details"}
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
                    {citationData.map(({ source, index }, idx) => (
                        <a 
                           key={idx} 
                           href={source.uri} 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           className="flex items-start gap-2 text-left p-2 rounded hover:bg-slate-800 transition-colors"
                        >
                           <span className={`font-bold flex-shrink-0 ${(source.status === 'invalid' || source.status === 'fetch-failed') ? 'text-red-400' : 'text-purple-400'}`}>[{index}]</span>
                           <span className={`text-slate-300 whitespace-normal ${(source.status === 'invalid' || source.status === 'fetch-failed') ? 'line-through text-slate-500' : ''}`}>{source.title}</span>
                        </a>
                    ))}
                </div>
            )}
        </span>
    );
};


export const TextWithCitations: React.FC<{ text: string; sources: GroundingSource[]; className?: string; as?: 'p' | 'span' }> = ({ text, sources, className, as = 'p' }) => {
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
                    return <Citation key={`${i}-${j}`} citationText={subPart} sources={sources} />;
                }
                return <React.Fragment key={`${i}-${j}`}>{subPart}</React.Fragment>;
            });
        });
    };
    
    return <Component className={className}>{renderText()}</Component>;
};


const MarketInnovationAnalysisCard: React.FC<{ analysis: MarketInnovationAnalysis, sources: GroundingSource[] }> = ({ analysis, sources }) => {
    const readinessStyles: Record<string, string> = {
        'Concept': 'bg-red-900/50 text-red-300 border-red-700/50',
        'Prototype': 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50',
        'MVP': 'bg-blue-900/50 text-blue-300 border-blue-700/50',
        'Market-Ready': 'bg-green-900/50 text-green-300 border-green-700/50',
    };

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl shadow-slate-800/20 space-y-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center">
                <div className="p-3 mb-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full">
                    <LightbulbIcon className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-amber-400 mb-2">Market & Innovation Analysis</h2>
                <TextWithCitations text={analysis.summary} sources={sources} className="text-xl font-medium text-slate-200 max-w-3xl" />
            </div>

            {/* Target Audience & Product Concepts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-700/50">
                {/* Target Audience Segments */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <UsersIcon className="h-7 w-7 text-sky-400" />
                        <h3 className="text-xl font-bold text-slate-100">Target Audience Segments</h3>
                    </div>
                    <div className="space-y-4">
                        {analysis.targetAudienceSegments.map((segment, index) => (
                            <div key={index} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-sky-300">{segment.segmentName}</h4>
                                    <span className="text-xs font-semibold px-2 py-1 bg-sky-900/50 text-sky-300 rounded-full border border-sky-700/50">{segment.marketSize}</span>
                                </div>
                                <TextWithCitations text={segment.description} sources={sources} className="text-sm text-slate-400 mt-1" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Product Concepts */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <RocketLaunchIcon className="h-7 w-7 text-fuchsia-400" />
                        <h3 className="text-xl font-bold text-slate-100">Product & Service Concepts</h3>
                    </div>
                     <div className="space-y-4">
                        {analysis.productConcepts.map((concept, index) => (
                            <div key={index} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                <div className="flex justify-between items-start gap-2">
                                    <h4 className="font-bold text-fuchsia-300">{concept.conceptName}</h4>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <span className="text-xs font-semibold px-2 py-1 bg-slate-700 text-slate-300 rounded-full border border-slate-600">{concept.type}</span>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${readinessStyles[concept.readinessLevel] || 'bg-gray-700'}`}>{concept.readinessLevel}</span>
                                    </div>
                                </div>
                                <TextWithCitations text={concept.description} sources={sources} className="text-sm text-slate-400 mt-1" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hurdles & Competitors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-700/50">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <ScaleIcon className="h-6 w-6 text-red-400" />
                        <h3 className="text-lg font-bold text-slate-200">Regulatory & Commercial Hurdles</h3>
                    </div>
                    <ul className="list-disc list-inside space-y-2 text-sm text-slate-400 pl-2">
                        {analysis.regulatoryHurdles.map((hurdle, index) => (
                            <li key={index}><TextWithCitations text={hurdle} sources={sources} as="span" /></li>
                        ))}
                    </ul>
                </div>
                 <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <BuildingStorefrontIcon className="h-6 w-6 text-green-400" />
                        <h3 className="text-lg font-bold text-slate-200">Key Competitors & Market Players</h3>
                    </div>
                    <ul className="list-disc list-inside space-y-2 text-sm text-slate-400 pl-2">
                        {analysis.keyCompetitors.map((competitor, index) => (
                            <li key={index}><TextWithCitations text={competitor} sources={sources} as="span" /></li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
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

const SourceReliabilityMeter: React.FC<{ reliability: number }> = ({ reliability }) => {
    const percentage = Math.round(reliability * 100);
    const getColor = (value: number) => {
        if (value > 0.75) return { bg: 'bg-green-500', text: 'text-green-300' };
        if (value > 0.5) return { bg: 'bg-yellow-500', text: 'text-yellow-300' };
        return { bg: 'bg-red-500', text: 'text-red-300' };
    };
    const { bg, text } = getColor(reliability);

    return (
        <div className="w-full">
            <div className="flex justify-between text-xs mb-1">
                <span className={`font-bold ${text}`}>Reliability</span>
                <span className={text}>{percentage}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-700 rounded-full">
                <div className={`h-1.5 ${bg} rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const SOURCE_BADGE_STYLES: Record<string, { color: string }> = {
    [SearchDataSource.GoogleSearch]: { color: 'text-blue-400 bg-blue-900/50 border border-blue-700/50' },
    [SearchDataSource.PubMed]: { color: 'text-green-400 bg-green-900/50 border border-green-700/50' },
    [SearchDataSource.BioRxivPmcArchive]: { color: 'text-amber-400 bg-amber-900/50 border border-amber-700/50' },
    [SearchDataSource.BioRxivFeed]: { color: 'text-amber-400 bg-amber-900/50 border border-amber-700/50' },
    [SearchDataSource.GooglePatents]: { color: 'text-cyan-400 bg-cyan-900/50 border border-cyan-700/50' },
    [SearchDataSource.OpenGenes]: { color: 'text-purple-400 bg-purple-900/50 border border-purple-700/50' },
    [SearchDataSource.WebSearch]: { color: 'text-slate-400 bg-slate-700 border border-slate-600' },
};

const SourceOriginBadge: React.FC<{ origin: SearchDataSource }> = ({ origin }) => {
    const info = DATA_SOURCE_DEFINITIONS[origin] || { label: 'Unknown', icon: <QuestionMarkCircleIcon className="h-4 w-4" />, description: '' };
    const style = SOURCE_BADGE_STYLES[origin] || { color: 'text-slate-400 bg-slate-700 border border-slate-600' };
    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${style.color}`}>
            {React.cloneElement(info.icon, { className: 'h-4 w-4' })}
            <span>{info.label}</span>
        </div>
    );
};

const SourceStats: React.FC<{ sources: GroundingSource[] }> = ({ sources }) => {
    const stats = useMemo(() => {
        const acc: Record<string, { valid: number, invalid: number }> = {};
        for (const source of sources) {
            const origin = source.origin || 'Unknown';
            if (!acc[origin]) {
                acc[origin] = { valid: 0, invalid: 0 };
            }
            if (source.status === 'valid' || source.status === 'unverified' || source.status === 'validating') {
                acc[origin].valid++;
            } else { // 'invalid' or 'fetch-failed'
                acc[origin].invalid++;
            }
        }
        return Object.entries(acc).sort((a, b) => (b[1].valid + b[1].invalid) - (a[1].valid + a[1].invalid));
    }, [sources]);

    if (stats.length === 0) return null;

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6">
            <h3 className="text-lg font-bold text-slate-200 mb-3">Source Acquisition Summary</h3>
            <p className="text-xs text-slate-400 mb-4">A statistical overview of where the validated knowledge for this workspace came from, based on your current review.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {stats.map(([origin, data]) => {
                    const info = DATA_SOURCE_DEFINITIONS[origin as SearchDataSource] || { label: 'Unknown', icon: <QuestionMarkCircleIcon className="h-6 w-6" />, description: '' };
                    const total = data.valid + data.invalid;
                    return (
                        <div key={origin} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                            <div className="text-slate-400">{React.cloneElement(info.icon, { className: 'h-6 w-6' })}</div>
                            <div>
                                <p className="font-bold text-slate-300">{info.label}</p>
                                <p className="text-xs text-slate-400">
                                    {total} source{total > 1 ? 's' : ''}
                                    {data.invalid > 0 && <span className="text-red-400 ml-1">({data.invalid} invalid)</span>}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


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
  onManualSourceUpdate: (uri: string, status: SourceStatus) => void;
}

const WorkspaceView: React.FC<WorkspaceViewProps> = ({ workspace, isLoading, error, hasSearched, loadingMessage, onNodeClick, selectedNodeId, activeTab, setActiveTab, onManualSourceUpdate }) => {
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[] | null>(null);

  const isTrendAnalysis = !!workspace?.trendAnalysis;

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
  
  const getStatusOpacity = (status: SourceStatus) => {
      switch(status) {
          case 'invalid':
          case 'fetch-failed':
              return 'opacity-50';
          default:
              return 'opacity-100';
      }
  };
  
  return (
    <div className="w-full space-y-4">
      {isLoading && <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">{loadingMessage}</div>}
      
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
      
      {hasSearched && !workspace?.knowledgeGraph && !workspace?.marketInnovationAnalysis && !isLoading && !error &&(
        <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-slate-400">Analysis Incomplete</h2>
            <p className="text-slate-500 mt-2">The analysis could not be completed. Check the sources tab and logs for errors.</p>
        </div>
      )}

      {workspace && (
        <>
            <AnalysisMeta workspace={workspace} />

            <div className="flex gap-2 sm:gap-4 border-b border-slate-700">
                {(!isTrendAnalysis || workspace.marketInnovationAnalysis) && workspace.knowledgeGraph && (
                    <TabButton
                        label="Priorities"
                        icon={<LightbulbIcon className="h-5 w-5" />}
                        isActive={activeTab === 'priorities'}
                        onClick={() => setActiveTab('priorities')}
                    />
                )}
                {workspace.knowledgeGraph && (
                    <TabButton
                        label={isTrendAnalysis ? "Evolution Analysis" : "Knowledge Web"}
                        icon={isTrendAnalysis ? <ClockIcon className="h-5 w-5" /> : <NetworkIcon className="h-5 w-5" />}
                        isActive={activeTab === 'knowledge_web'}
                        onClick={() => setActiveTab('knowledge_web')}
                    />
                )}
                <TabButton
                    label="Grounding Sources"
                    icon={<MethodIcon className="h-5 w-5" />}
                    isActive={activeTab === 'sources'}
                    onClick={() => setActiveTab('sources')}
                    count={workspace.sources.length}
                />
            </div>

            <div className="py-4">
                {activeTab === 'priorities' && (
                  <div className="space-y-8">
                    {workspace.marketInnovationAnalysis ? (
                       <MarketInnovationAnalysisCard analysis={workspace.marketInnovationAnalysis} sources={workspace.sources} />
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                )}


                {activeTab === 'knowledge_web' && workspace.knowledgeGraph && (
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
                    <div className="space-y-4">
                        {workspace.sources.length > 0 ? (
                            <div>
                                <h2 className="text-2xl font-bold text-slate-100 mb-4">Grounding Sources ({workspace.sources.length})</h2>
                                <SourceStats sources={workspace.sources} />
                                <ul className="space-y-3">
                                    {workspace.sources.map((source, index) => (
                                    <li key={`${source.uri}-${index}`} className={`bg-slate-800/50 p-4 rounded-lg border border-slate-700 transition-opacity duration-300 ${getStatusOpacity(source.status)}`}>
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                                            <div className="flex-grow min-w-0">
                                                <div className="flex items-center gap-4 mb-2">
                                                    <SourceOriginBadge origin={source.origin} />
                                                    <a
                                                    href={source.uri}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center text-blue-400 hover:text-blue-300 group font-medium"
                                                    >
                                                        <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                                                        <span className={`group-hover:underline ${source.status === 'invalid' || source.status === 'fetch-failed' ? 'line-through decoration-red-500/70' : ''}`}>{source.title || source.uri}</span>
                                                    </a>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 pl-1 break-all">{source.uri}</p>
                                                {source.status === 'fetch-failed' && (
                                                    <div className="flex items-center gap-2 text-xs text-amber-400 mt-2 pl-1">
                                                        <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                                                        <span>{source.reason}</span>
                                                    </div>
                                                )}
                                                {source.status === 'invalid' && source.reason && (
                                                    <div className="flex items-center gap-2 text-xs text-red-400 mt-2 pl-1">
                                                        <XCircleIcon className="h-4 w-4 flex-shrink-0" />
                                                        <span>AI Reason: {source.reason}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-shrink-0 flex items-center gap-1 bg-slate-700/50 p-1 rounded-full border border-slate-600">
                                                <button onClick={() => onManualSourceUpdate(source.uri, 'valid')} title="Mark as Valid" className="p-1 rounded-full transition-colors">
                                                    <CheckCircleIcon className={`h-6 w-6 ${source.status === 'valid' ? 'text-green-500' : 'text-slate-500 hover:text-green-400'}`} />
                                                </button>
                                                <button onClick={() => onManualSourceUpdate(source.uri, 'unverified')} title="Mark as Unverified" className="p-1 rounded-full transition-colors">
                                                    <QuestionMarkCircleIcon className={`h-6 w-6 ${source.status === 'unverified' ? 'text-yellow-500' : 'text-slate-500 hover:text-yellow-400'}`} />
                                                </button>
                                                <button onClick={() => onManualSourceUpdate(source.uri, 'invalid')} title="Mark as Invalid" className="p-1 rounded-full transition-colors">
                                                    <XCircleIcon className={`h-6 w-6 ${source.status === 'invalid' || source.status === 'fetch-failed' ? 'text-red-500' : 'text-slate-500 hover:text-red-400'}`} />
                                                </button>
                                            </div>
                                        </div>
                                         {typeof source.reliability === 'number' && (
                                            <div className="mt-4 pt-3 border-t border-slate-700/50 flex flex-col sm:flex-row gap-4 items-start">
                                                <div className="w-full sm:w-40 flex-shrink-0">
                                                    <SourceReliabilityMeter reliability={source.reliability} />
                                                </div>
                                                <p className="text-xs text-slate-400 flex-grow">
                                                   <span className="font-bold text-slate-300">AI Justification:</span> {source.reliabilityJustification}
                                                </p>
                                            </div>
                                        )}
                                    </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                             <div className="text-center text-slate-400 py-12 px-6 bg-slate-800/50 rounded-lg">
                                <h3 className="text-xl font-bold text-slate-200">
                                    No Grounding Sources Found
                                </h3>
                                <p className="mt-2 max-w-2xl mx-auto">
                                   The AI agent could not find any sources for this topic, or they could not be validated.
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
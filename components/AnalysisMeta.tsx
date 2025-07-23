
import React from 'react';
import { WorkspaceState } from '../types';
import { LinkIcon, NetworkIcon, LightbulbIcon } from './icons';

interface AnalysisMetaProps {
    workspace: WorkspaceState;
}

const StatCard: React.FC<{ icon: React.ReactNode; value: number; label: string; }> = ({ icon, value, label }) => (
    <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex-1 min-w-[180px]">
        <div className="text-purple-400">{icon}</div>
        <div>
            <p className="text-3xl font-bold text-slate-100">{value}</p>
            <p className="text-sm text-slate-400">{label}</p>
        </div>
    </div>
);


const AnalysisMeta: React.FC<AnalysisMetaProps> = ({ workspace }) => {
    const sourceCount = workspace.sources.length;
    const conceptCount = workspace.knowledgeGraph?.nodes.length ?? 0;
    const opportunityCount = workspace.researchOpportunities.length;

    if (sourceCount === 0 && conceptCount === 0 && opportunityCount === 0 && !workspace.trendAnalysis) {
        return null;
    }

    const opportunityLabel = workspace.trendAnalysis ? "Future Directions" : "Proposed Directions";

    return (
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5 mb-8">
            <h2 className="text-lg font-bold text-slate-200 mb-1">AI Analysis Summary</h2>
            <p className="text-sm text-slate-400 mb-4">
                This is more than a search. The AI agent analyzed various sources to synthesize knowledge, identify key concepts, and propose strategic research directions.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
                <StatCard icon={<LinkIcon className="h-8 w-8" />} value={sourceCount} label="Grounding Sources" />
                <StatCard icon={<NetworkIcon className="h-8 w-8" />} value={conceptCount} label="Mapped Concepts" />
                <StatCard icon={<LightbulbIcon className="h-8 w-8" />} value={opportunityCount} label={opportunityLabel} />
            </div>
        </div>
    );
};

export default AnalysisMeta;

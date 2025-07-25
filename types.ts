

export enum ModelProvider {
    GoogleAI = 'Google AI',
    Ollama = 'Ollama',
    OpenAI_API = 'OpenAI-Compatible API',
}

export interface ModelDefinition {
    id: string;
    name: string;
    provider: ModelProvider;
}

export enum AgentType {
    KnowledgeNavigator = "KnowledgeNavigator",
    TrendAnalyzer = "TrendAnalyzer",
    SourceFinder = "SourceFinder",
}

export type ContradictionTolerance = 'Low' | 'Medium' | 'High';
export type AnalysisLens = 'Balanced' | 'High-Risk/High-Reward' | 'Clinical Translation' | 'Biomarker Discovery' | 'Fundamental Mechanisms';

export type SourceStatus = 'unverified' | 'valid' | 'invalid' | 'validating' | 'fetch-failed';

export interface GroundingSource {
    uri: string;
    title: string;
    status: SourceStatus;
    origin: SearchDataSource;
    content?: string;
    reliability?: number; // 0.0 to 1.0, assessed by AI
    reliabilityJustification?: string; // AI's reason for the score
    reason?: string; // Reason for status (e.g., fetch failure, invalid)
}

export interface KnowledgeGraphNode {
    id: string;
    label: string;
    type: 'Gene' | 'Protein' | 'Compound' | 'Pathway' | 'Disease' | 'Process' | 'Topic' | 'Hypothesis' | 'KnowledgeGap' | 'Method' | 'Result' | 'Observation' | 'Tool' | 'Biomarker';
    status?: 'normal' | 'dysregulated' | 'intervention_target';
    x?: number;
    y?: number;
    zone?: 'emerging' | 'fading' | 'connecting';
}

export interface KnowledgeGraphEdge {
    source: string; // node id
    target: string; // node id
    label:string;
}

export interface KnowledgeGraph {
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
}

export interface ResearchOpportunity {
    id: string;
    title: string;
    justification: string;
    relatedNodeIds: string[];
    lens?: AnalysisLens;
    confidence: number;
    maturity: 'Basic Research' | 'Translational' | 'Clinical';
    potentialImpact: string;
}

export interface Contradiction {
    id: string;
    statement: string;
}

export interface Synergy {
    id: string;
    statement: string;
}

export interface TrendShift {
  shiftTitle: string;
  fromFocus: string;
  toFocus: string;
  justification: string;
}

export interface TrendConcept {
    concept: string;
    justification: string;
    relatedNodeIds?: string[];
}

export interface TrendAnalysis {
    summary: string;
    emergingConcepts: TrendConcept[];
    fadingConcepts: TrendConcept[];
    keyShifts: TrendShift[];
}

export interface WorkspaceState {
  topic: string;
  sources: GroundingSource[];
  knowledgeGraph: KnowledgeGraph | null;
  synthesis: string | null;
  researchOpportunities: ResearchOpportunity[];
  contradictions: Contradiction[];
  synergies: Synergy[];
  keyQuestion: string | null;
  trendAnalysis: TrendAnalysis | null;
  timestamp: number;
}

export interface AgentResponse {
  knowledgeGraph?: KnowledgeGraph;
  synthesis?: string;
  researchOpportunities?: ResearchOpportunity[];
  contradictions?: Contradiction[];
  synergies?: Synergy[];
  keyQuestion?: string;
  trendAnalysis?: TrendAnalysis;
}

export interface ChatMessage {
    id:string;
    sender: 'user' | 'ai';
    text: string;
    isLoading?: boolean;
}

export interface ValidatedSource {
    uri: string;
    status: 'valid' | 'invalid';
    reason: string;
}

export enum SearchDataSource {
    GoogleSearch = 'GoogleSearch',
    WebSearch = 'WebSearch',
    PubMed = 'PubMed',
    BioRxivFeed = 'BioRxivFeed',
    BioRxivPmcArchive = 'BioRxivPmcArchive',
    GooglePatents = 'GooglePatents',
    OpenGenes = 'OpenGenes',
}

export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    source: SearchDataSource;
}

export interface GeneSearchedRecord {
    id: number;
    symbol: string;
    name: string;
    researches?: {
        increaseLifespan?: {
            modelOrganism: string;
            interventionResultForLifespan: string;
            lifespanMeanChangePercent?: number;
            lifespanMinChangePercent?: number;
            lifespanMaxChangePercent?: number;
            interventions?: {
                controlAndExperiment: any[],
                experiment: {
                    interventionMethod: string;
                }[]
            };
        }[];
    };
    agingMechanisms?: { name: string; }[];
}

export interface OpenGeneSearchResponse {
    options: any;
    items: GeneSearchedRecord[];
}
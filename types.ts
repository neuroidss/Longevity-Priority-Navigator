

export interface ModelDefinition {
    id: string;
    name: string;
    provider: 'Google AI';
}

export enum AgentType {
    KnowledgeNavigator = "KnowledgeNavigator",
    TrendAnalyzer = "TrendAnalyzer",
}

export type AnalysisLens = 'Balanced' | 'High-Risk/High-Reward' | 'Clinical Translation' | 'Biomarker Discovery' | 'Fundamental Mechanisms';

export interface WorkspaceItem {
  id: string;
  type: 'article' | 'patent';
  title: string;
  summary: string;
  details: string; 
  sourceUri?: string;
}

export interface GroundingSource {
    uri: string;
    title: string;
}

export interface KnowledgeGraphNode {
    id: string;
    label: string;
    type: 'Gene' | 'Protein' | 'Compound' | 'Pathway' | 'Disease' | 'Process' | 'Topic' | 'Hypothesis' | 'KnowledgeGap' | 'Method' | 'Result' | 'Observation';
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
  items: WorkspaceItem[];
  sources: GroundingSource[];
  knowledgeGraph: KnowledgeGraph | null;
  synthesis: string | null;
  researchOpportunities: ResearchOpportunity[];
  keyQuestion: string | null;
  trendAnalysis: TrendAnalysis | null;
  timestamp: number;
}

export interface AgentResponse {
  items?: WorkspaceItem[];
  sources?: GroundingSource[];
  knowledgeGraph?: KnowledgeGraph;
  synthesis?: string;
  researchOpportunities?: ResearchOpportunity[];
  keyQuestion?: string;
  trendAnalysis?: TrendAnalysis;
}

export interface ChatMessage {
    id:string;
    sender: 'user' | 'ai';
    text: string;
    isLoading?: boolean;
}
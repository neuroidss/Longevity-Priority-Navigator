


import React, { useState, useEffect, useCallback } from 'react';
import { type WorkspaceState, AgentType, type ChatMessage, type AgentResponse, type KnowledgeGraph, type KnowledgeGraphNode, type AnalysisLens } from '../types';
import { dispatchAgent } from '../services/geminiService';
import { useAppSettings } from './useAppSettings'; 

const FEATURED_ANALYSIS: WorkspaceState = {
    topic: "AI-driven longevity research prioritization",
    sources: [
        { uri: '#', title: 'Presentation: Will AI help us defeat aging? - Andrei Tarkhov, Applied AI, Retro Biosciences' },
        { uri: '#', title: 'Presentation: Using AI to accelerate longevity research - Danil Salimov, NTU "Sirius", Blastim Graduate' }
    ],
    knowledgeGraph: {
        nodes: [
            { id: 'ai-system', label: 'AI Prioritization System', type: 'Topic', x: 460, y: 220 },
            { id: 'kg', label: 'Knowledge Graph', type: 'Method', x: 720, y: 280 },
            { id: 'biomarkers', label: 'Noisy Biomarkers', type: 'KnowledgeGap', x: 680, y: 180 },
            { id: 'interventions', label: 'Weak Interventions', type: 'KnowledgeGap', x: 620, y: 360 },
            { id: 'translation', label: 'Translational Gap', type: 'KnowledgeGap', x: 350, y: 450 },
            { id: 'sglt2-glp1', label: 'SGLT2/GLP1 Drugs', type: 'Compound', x: 250, y: 200 },
            { id: 'all-cause-mortality', label: 'Reduced Mortality', type: 'Result', x: 250, y: 380 },
            { id: 'senescence', label: 'Cellular Senescence', type: 'Process', x: 460, y: 500 },
            { id: 'invitro-screening', label: 'In-vitro Screening', type: 'Method', x: 600, y: 480 }
        ],
        edges: [
            { source: 'ai-system', target: 'kg', label: 'builds' },
            { source: 'ai-system', target: 'biomarkers', label: 'addresses' },
            { source: 'ai-system', target: 'interventions', label: 'evaluates' },
            { source: 'kg', target: 'translation', label: 'bridges' },
            { source: 'biomarkers', target: 'interventions', label: 'limits validation of' },
            { source: 'sglt2-glp1', target: 'all-cause-mortality', label: 'leads to' },
            { source: 'ai-system', target: 'sglt2-glp1', label: 'analyzes' },
            { source: 'invitro-screening', target: 'translation', label: 'suffers from' },
            { source: 'senescence', target: 'interventions', label: 'is target for' },
        ]
    },
    synthesis: `### Current Landscape
The longevity field faces a "chicken-and-egg" dilemma: we need better biomarkers to validate interventions, but we need effective interventions to discover sensitive biomarkers. Current strategies range from high-throughput in-vitro screens to analyzing existing FDA-approved drugs like SGLT2 inhibitors which have shown promising signals in reducing all-cause mortality.

### Key Challenges (Translational Gaps & Biomarker Noise)
The primary hurdles are translating findings from model organisms to humans and the high noise-to-signal ratio in aging biomarkers. This makes it difficult to assess the true impact of any intervention.

### Strategic Implications
An AI-driven system can break this deadlock by creating a dynamic knowledge graph that integrates multi-modal data (genomics, clinical, patents). This allows for the identification of conserved pathways, robust biomarker candidates, and the prioritization of research directions that have the highest probability of translating to humans.`,
    researchOpportunities: [
        {
            id: 'ro-1',
            title: 'Develop a "Chicken-and-Egg Breaker": Co-develop interventions with biomarkers',
            justification: 'Instead of sequential development, this approach uses AI to simultaneously screen for compounds that induce a rejuvenation signal in-vitro AND identify the most sensitive transcriptomic or proteomic features that report on that signal. This creates a paired intervention-biomarker system from the start.',
            relatedNodeIds: ['biomarkers', 'interventions', 'invitro-screening'],
            lens: 'High-Risk/High-Reward',
            confidence: 0.85,
            maturity: 'Basic Research',
            potentialImpact: 'Establishes a new paradigm for drug discovery in aging, bypassing the traditional biomarker bottleneck.'
        },
        {
            id: 'ro-2',
            title: 'Validate SGLT2/GLP1 as Anti-Aging Drugs via Novel Biomarker Discovery',
            justification: "Current data shows these drugs reduce all-cause mortality, but the 'pro-longevity' mechanisms are unclear. This research would use multi-omics data from patients on these drugs to identify novel, upstream biomarkers of their effects, moving beyond standard clinical markers to find true signatures of slowed aging.",
            relatedNodeIds: ['sglt2-glp1', 'all-cause-mortality', 'biomarkers'],
            lens: 'Clinical Translation',
            confidence: 0.9,
            maturity: 'Translational',
            potentialImpact: 'Could provide the first clinically-validated, molecular biomarkers of a human anti-aging intervention.'
        }
    ],
    contradictions: [
        { id: 'con-1', statement: "High-throughput in-vitro screens often identify compounds with high toxicity or off-target effects (e.g., PAINS) that fail in subsequent in-vivo validation." },
    ],
    synergies: [
        { id: 'syn-1', statement: "The observed all-cause mortality reduction from SGLT2 inhibitors (a clinical result) could be mechanistically linked to fundamental processes like cellular senescence, providing a bridge between clinical outcomes and basic science." }
    ],
    keyQuestion: "How can we systematically distinguish genuine anti-aging effects from disease-specific treatments in human data?",
    trendAnalysis: null,
    timestamp: 0 // Will be updated on load
};

// Logic from workspaceUtils.ts and App.tsx moved here
const createWorkspaceState = (
    currentTopic: string,
    agentResponse: AgentResponse | null
): WorkspaceState => {
    if (!agentResponse) {
        return { 
            topic: currentTopic, 
            sources: [], 
            knowledgeGraph: null, 
            synthesis: null,
            researchOpportunities: [],
            contradictions: [],
            synergies: [],
            keyQuestion: null,
            trendAnalysis: null,
            timestamp: Date.now() 
        };
    }
    
    const newGraph: KnowledgeGraph | null = agentResponse.knowledgeGraph || null;

    return {
        topic: currentTopic,
        sources: agentResponse.sources || [],
        knowledgeGraph: newGraph,
        synthesis: agentResponse.synthesis || null,
        researchOpportunities: agentResponse.researchOpportunities || [],
        contradictions: agentResponse.contradictions || [],
        synergies: agentResponse.synergies || [],
        keyQuestion: agentResponse.keyQuestion || null,
        trendAnalysis: agentResponse.trendAnalysis || null,
        timestamp: Date.now()
    };
};


interface WorkspaceManagerProps {
    settings: ReturnType<typeof useAppSettings>;
    addLog: (msg: string) => void;
    storageKey: string;
}

export const useWorkspaceManager = ({ settings, addLog, storageKey }: WorkspaceManagerProps) => {
    const [topic, setTopic] = useState<string>('');
    const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState<boolean>(false);

    useEffect(() => {
        try {
            const savedStateJSON = localStorage.getItem(storageKey);
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON);
                if (savedState.topic) setTopic(savedState.topic);
                if (savedState.workspace) {
                    setWorkspace(savedState.workspace);
                }
                if (savedState.hasSearched) setHasSearched(savedState.hasSearched);
                addLog("Successfully restored workspace state from previous session.");
            } else {
                // Load featured analysis if no state is saved
                addLog("No saved state found. Loading featured analysis showcase.");
                const initialWorkspace = { ...FEATURED_ANALYSIS, timestamp: Date.now() };
                setTopic(initialWorkspace.topic);
                setWorkspace(initialWorkspace);
                setHasSearched(true);
                // Also save this initial state so it persists on reload until a new search is made
                localStorage.setItem(storageKey, JSON.stringify({
                    topic: initialWorkspace.topic,
                    workspace: initialWorkspace,
                    hasSearched: true,
                    chatHistory: [],
                    model: settings.model
                }));
            }
        } catch (e) {
            addLog(`Failed to load workspace state from localStorage: ${e instanceof Error ? e.message : String(e)}.`);
            // Fallback to empty in case of parsing error
            setWorkspace(null);
            setHasSearched(false);
        }
    }, [addLog, storageKey, settings.model]);

    const handleDispatchAgent = useCallback(async (
        lens: AnalysisLens, 
        agentType: AgentType, 
        setActiveTab: React.Dispatch<React.SetStateAction<'priorities' | 'knowledge_web' | 'sources'>>,
        setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>, 
        setSelectedNode: React.Dispatch<React.SetStateAction<KnowledgeGraphNode | null>>
    ) => {
        if (!topic) {
            setError("Please enter a research topic first.");
            return;
        }
        if (settings.model.provider === 'Google AI' && !settings.apiKey && !process.env.API_KEY) {
            setError("Please enter your Google AI API Key in the settings to use this model.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setWorkspace(null);
        setChatHistory([]); // Clear previous chat
        setSelectedNode(null); // Clear selected node
        setLoadingMessage(`Dispatching ${agentType} with ${lens} lens...`);
        addLog(`Dispatching agent '${agentType}' for topic: "${topic}" with lens: "${lens}"`);

        try {
            const response = await dispatchAgent(
                topic, agentType, settings.model, addLog, settings.apiKey, setLoadingMessage, lens
            );
            addLog(`Agent '${agentType}' finished.`);

            const newWorkspace = createWorkspaceState(topic, response);
            setWorkspace(newWorkspace);
            setHasSearched(true);
            
            if (agentType === AgentType.TrendAnalyzer) {
                setActiveTab('knowledge_web');
            } else {
                setActiveTab('priorities');
            }
            
            const initialChatHistory: ChatMessage[] = [];
            setChatHistory(initialChatHistory);

            // Save state after successful operation
            localStorage.setItem(storageKey, JSON.stringify({
                topic,
                workspace: newWorkspace,
                hasSearched: true,
                chatHistory: initialChatHistory,
                model: settings.model
            }));

        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(message);
            addLog(`ERROR during agent dispatch: ${message}`);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [topic, settings, addLog, storageKey]);


    return {
        topic,
        setTopic,
        workspace,
        setWorkspace,
        isLoading,
        loadingMessage,
        error,
        setError,
        hasSearched,
        setHasSearched,
        handleDispatchAgent,
    };
};
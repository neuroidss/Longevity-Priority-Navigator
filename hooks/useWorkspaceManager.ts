

import React, { useState, useEffect, useCallback } from 'react';
import { type WorkspaceState, AgentType, type ChatMessage, type AgentResponse, type KnowledgeGraph, type KnowledgeGraphNode, type AnalysisLens, GroundingSource, SourceStatus, ContradictionTolerance, ModelProvider } from '../types';
import { ApiClient } from '../services/geminiService';
import { useAppSettings } from './useAppSettings'; 

const createWorkspaceState = (
    currentTopic: string,
    validatedSources: GroundingSource[],
    agentResponse: AgentResponse | null
): WorkspaceState => {
    if (!agentResponse) {
        return { 
            topic: currentTopic, 
            sources: validatedSources, 
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
    
    return {
        topic: currentTopic,
        sources: validatedSources,
        knowledgeGraph: agentResponse.knowledgeGraph || null,
        synthesis: agentResponse.synthesis || null,
        researchOpportunities: agentResponse.researchOpportunities || [],
        contradictions: agentResponse.contradictions || [],
        synergies: agentResponse.synergies || [],
        keyQuestion: agentResponse.keyQuestion || null,
        trendAnalysis: agentResponse.trendAnalysis || null,
        timestamp: Date.now()
    };
};

const sanitizeWorkspaceState = (loadedWorkspace: any): WorkspaceState | null => {
    if (!loadedWorkspace || typeof loadedWorkspace !== 'object' || !loadedWorkspace.topic) {
        return null;
    }
    
    return {
        topic: loadedWorkspace.topic,
        sources: Array.isArray(loadedWorkspace.sources) 
            ? loadedWorkspace.sources.map((s: any) => ({
                uri: s.uri,
                title: s.title,
                status: s.status || 'unverified',
                origin: s.origin,
                reason: s.reason,
                content: s.content,
                reliability: s.reliability,
                reliabilityJustification: s.reliabilityJustification,
            })) 
            : [],
        knowledgeGraph: loadedWorkspace.knowledgeGraph || null,
        synthesis: loadedWorkspace.synthesis || null,
        researchOpportunities: Array.isArray(loadedWorkspace.researchOpportunities) ? loadedWorkspace.researchOpportunities : [],
        contradictions: Array.isArray(loadedWorkspace.contradictions) ? loadedWorkspace.contradictions : [],
        synergies: Array.isArray(loadedWorkspace.synergies) ? loadedWorkspace.synergies : [],
        keyQuestion: loadedWorkspace.keyQuestion || null,
        trendAnalysis: loadedWorkspace.trendAnalysis || null,
        timestamp: loadedWorkspace.timestamp || Date.now(),
    };
};


interface WorkspaceManagerProps {
    settings: ReturnType<typeof useAppSettings>;
    apiClient: ApiClient;
    addLog: (msg: string) => void;
    storageKey: string;
}

export const useWorkspaceManager = ({ settings, apiClient, addLog, storageKey }: WorkspaceManagerProps) => {
    const [topic, setTopic] = useState<string>('');
    const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState<boolean>(false);

    useEffect(() => {
        const loadInitialState = () => {
            addLog("No valid state found. Starting with a clean slate.");
            setTopic('');
            setWorkspace(null);
            setHasSearched(false);
        };

        try {
            const savedStateJSON = localStorage.getItem(storageKey);
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON);
                const sanitizedWorkspace = sanitizeWorkspaceState(savedState.workspace);
                
                if (sanitizedWorkspace) {
                    setTopic(sanitizedWorkspace.topic);
                    setWorkspace(sanitizedWorkspace);
                    setHasSearched(!!savedState.hasSearched);
                    addLog("Successfully restored and validated workspace state from previous session.");
                } else {
                    loadInitialState();
                }
            } else {
                loadInitialState();
            }
        } catch (e) {
            addLog(`WARN: Loading from localStorage failed (${e instanceof Error ? e.message : 'Unknown error'}). Clearing old data and starting fresh.`);
            localStorage.removeItem(storageKey);
            loadInitialState();
        }
    }, [addLog, storageKey]);

    const handleDispatchAgent = useCallback(async (
        lens: AnalysisLens, 
        agentType: AgentType,
        tolerance: ContradictionTolerance,
        setActiveTab: React.Dispatch<React.SetStateAction<'priorities' | 'knowledge_web' | 'sources'>>,
        setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>, 
        setSelectedNode: React.Dispatch<React.SetStateAction<KnowledgeGraphNode | null>>
    ) => {
        if (!topic) {
            setError("Please enter a research topic first.");
            return;
        }
        if (settings.model.provider === ModelProvider.GoogleAI && !settings.apiKey && !process.env.API_KEY) {
            setError("Please enter your Google AI API Key in the settings to use this model.");
            return;
        }
        if (Object.values(settings.dataSourceLimits).every(limit => limit === 0)) {
            setError("Please enable at least one data source by setting its result limit greater than 0 in the Advanced Settings.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setChatHistory([]);
        setSelectedNode(null);
        setActiveTab('sources');
        setHasSearched(true); // Indicate that a search has been initiated

        let tempWorkspace: WorkspaceState = {
            topic, sources: [], knowledgeGraph: null, synthesis: null, researchOpportunities: [],
            contradictions: [], synergies: [], keyQuestion: null, trendAnalysis: null, timestamp: Date.now()
        };
        setWorkspace({ ...tempWorkspace });
        
        try {
            const validatedSources = await apiClient.discoverAndValidateSources(
                topic, 
                settings.model, 
                setLoadingMessage,
                settings.dataSourceLimits
            );
            tempWorkspace.sources = validatedSources;
            setWorkspace({ ...tempWorkspace });
            
            if (validatedSources.length === 0) {
                throw new Error("The AI agent could not find and validate any sources for the topic.");
            }

            // --- Stage 2: Generate Analysis ---
            setLoadingMessage("Synthesizing analysis from primary sources...");
            const agentResponse = await apiClient.generateAnalysisFromContext(
                topic, agentType, settings.model, validatedSources, lens, tolerance
            );
            
            // --- Finalize Workspace ---
            const finalWorkspace = createWorkspaceState(topic, validatedSources, agentResponse);
            setWorkspace(finalWorkspace);
            setActiveTab(agentType === AgentType.TrendAnalyzer ? 'knowledge_web' : 'priorities');
            
            const stateToSave = {
                topic,
                workspace: finalWorkspace,
                hasSearched: true,
                chatHistory: [],
                model: settings.model,
                contradictionTolerance: tolerance,
                dataSourceLimits: settings.dataSourceLimits,
            };

            localStorage.setItem(storageKey, JSON.stringify(stateToSave));

        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(message);
            addLog(`ERROR during agent dispatch: ${message}`);
            setWorkspace(tempWorkspace); // Show the partially completed workspace on error
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [topic, settings, addLog, storageKey, apiClient]);

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
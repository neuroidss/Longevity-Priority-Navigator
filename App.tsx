
import React, { useState, useEffect, useMemo } from 'react';
import { AgentType, type AnalysisLens, type ChatMessage, type KnowledgeGraphNode, type GroundingSource, type WorkspaceState, SourceStatus, ContradictionTolerance, ModelProvider, SearchDataSource } from './types';
import { ApiClient } from './services/geminiService';
import { useAppSettings } from './hooks/useAppSettings';
import { useWorkspaceManager } from './hooks/useWorkspaceManager';
import { useDebugLog } from './hooks/useDebugLog';
import { useApiUsageManager } from './hooks/useApiUsageManager';

import Header from './components/Header';
import AgentControlPanel from './components/SearchBar';
import WorkspaceView from './components/ResultsDisplay';
import DebugLogView from './components/DebugLogView';
import ChatView from './components/ChatView';
import Footer from './components/Footer';

const APP_STATE_STORAGE_KEY = 'longevityKnowledgeGraphState';

type ActiveTab = 'priorities' | 'knowledge_web' | 'action_plan' | 'sources';

interface DashboardProps {
    activeTab: ActiveTab;
    setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;
    workspace: WorkspaceState | null;
    isLoading: boolean;
    error: string | null;
    hasSearched: boolean;
    loadingMessage: string;
    onNodeClick: (node: KnowledgeGraphNode) => void;
    selectedNode: KnowledgeGraphNode | null;
    onClearSelectedNode: () => void;
    chatHistory: ChatMessage[];
    isChatting: boolean;
    onSendMessage: (message: string) => void;
    onManualSourceUpdate: (uri: string, status: SourceStatus) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
    activeTab,
    setActiveTab,
    workspace,
    isLoading,
    error,
    hasSearched,
    loadingMessage,
    onNodeClick,
    selectedNode,
    onClearSelectedNode,
    chatHistory,
    isChatting,
    onSendMessage,
    onManualSourceUpdate,
}) => {
    const isGraphFocused = activeTab === 'knowledge_web';
    const isActionPlanFocused = activeTab === 'action_plan';
    const isWorkspaceReady = !!workspace && (!!workspace.knowledgeGraph || !!workspace.appliedLongevityAnalysis);
    const sources = workspace?.sources || [];
    
    const mainContentSpan = isGraphFocused ? 'lg:col-span-2' : 'lg:col-span-1';

    return (
        <div className={`grid grid-cols-1 ${isActionPlanFocused ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-8 mt-8 items-start`}>
            <div className={`${isActionPlanFocused ? 'lg:col-span-1' : 'lg:col-span-2'} flex flex-col gap-8`}>
                <WorkspaceView
                    workspace={workspace}
                    isLoading={isLoading}
                    error={error}
                    hasSearched={hasSearched}
                    loadingMessage={loadingMessage}
                    onNodeClick={onNodeClick}
                    selectedNodeId={selectedNode?.id || null}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    onManualSourceUpdate={onManualSourceUpdate}
                />
            </div>
             {!isActionPlanFocused && (
                <div className="lg:col-span-1 lg:sticky lg:top-8">
                     <ChatView
                        chatHistory={chatHistory}
                        isChatting={isChatting}
                        onSendMessage={onSendMessage}
                        isWorkspaceReady={isWorkspaceReady}
                        selectedNode={selectedNode}
                        onClearSelectedNode={onClearSelectedNode}
                        sources={sources}
                    />
                </div>
            )}
        </div>
    );
};


const App: React.FC = () => {
    // --- State Management using Hooks ---
    const { logs, addLog, handleResetProgress } = useDebugLog(APP_STATE_STORAGE_KEY);
    const settings = useAppSettings(addLog, APP_STATE_STORAGE_KEY);
    const { 
      model, setModel, apiKey, setApiKey, contradictionTolerance, 
      setContradictionTolerance, dataSourceLimits, setDataSourceLimits,
      openAIBaseUrl, setOpenAIBaseUrl, openAIModelName, setOpenAIModelName,
      openAIApiKey, setOpenAIApiKey, preprocessQuery, setPreprocessQuery,
    } = settings;
    const { usageState, setApiCallLimit, checkAndIncrement } = useApiUsageManager(addLog);

    const apiClient = useMemo(() => 
        new ApiClient(apiKey, addLog, checkAndIncrement, {
            baseUrl: openAIBaseUrl,
            modelName: openAIModelName,
            apiKey: openAIApiKey,
        }),
        [apiKey, addLog, checkAndIncrement, openAIBaseUrl, openAIModelName, openAIApiKey]
    );

    const { 
      topic, setTopic, workspace, setWorkspace, isLoading, loadingMessage, 
      error, hasSearched, handleDispatchAgent 
    } = useWorkspaceManager({ settings, apiClient, addLog, storageKey: APP_STATE_STORAGE_KEY });
    
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isChatting, setIsChatting] = useState(false);
    const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('priorities');
    
    // --- Effects ---
    useEffect(() => {
        addLog("Initializing application...");
        try {
            const savedStateJSON = localStorage.getItem(APP_STATE_STORAGE_KEY);
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON);
                if (savedState.chatHistory) {
                    setChatHistory(savedState.chatHistory);
                    addLog("Restored chat history.");
                }
                 if(workspace?.trendAnalysis) {
                    setActiveTab('knowledge_web');
                }
            }
        } catch (e) {
             addLog(`Could not restore chat history: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [addLog, workspace?.trendAnalysis]);

    const saveStateToLocalStorage = (ws: WorkspaceState | null, ch: ChatMessage[], ct: ContradictionTolerance) => {
        const currentState = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY) || '{}');
        const stateToSave = {
            ...currentState,
            workspace: ws,
            chatHistory: ch,
            contradictionTolerance: ct,
            dataSourceLimits,
            preprocessQuery,
        };
        localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(stateToSave));
    };

    // --- Handlers ---
    const handleSendMessage = async (message: string) => {
        if (!message.trim() || !workspace) return;
        
        setSelectedNode(null);

        const newUserMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text: message };
        const aiLoadingMessage: ChatMessage = { id: `ai-${Date.now()}`, sender: 'ai', text: '', isLoading: true };

        const newHistory = [...chatHistory, newUserMessage, aiLoadingMessage];
        setChatHistory(newHistory);
        setIsChatting(true);

        try {
            const aiResponseText = await apiClient.chatWithWorkspace(message, workspace, model);
            const finalAiMessage: ChatMessage = { ...aiLoadingMessage, text: aiResponseText, isLoading: false };
            
            const finalHistory = newHistory.map(msg => msg.id === aiLoadingMessage.id ? finalAiMessage : msg);
            setChatHistory(finalHistory);
            saveStateToLocalStorage(workspace, finalHistory, contradictionTolerance);

        } catch (e) {
            const errorText = e instanceof Error ? e.message : "An unknown error occurred.";
            const errorAiMessage: ChatMessage = { ...aiLoadingMessage, text: `Sorry, I encountered an error: ${errorText}`, isLoading: false };
            setChatHistory(prev => prev.map(msg => msg.id === aiLoadingMessage.id ? errorAiMessage : msg));
            addLog(`Chat Error: ${errorText}`);
        } finally {
            setIsChatting(false);
        }
    };
    
    const handleManualSourceUpdate = (sourceUri: string, newStatus: SourceStatus) => {
        if (!workspace) return;
        const newSources = workspace.sources.map(s => 
            s.uri === sourceUri ? { ...s, status: newStatus, reason: newStatus === 'unverified' ? undefined : s.reason } : s
        );
        const newWorkspace = { ...workspace, sources: newSources };
        setWorkspace(newWorkspace);
        saveStateToLocalStorage(newWorkspace, chatHistory, contradictionTolerance);
    };
    
    const handleDispatchWrapper = (lens: AnalysisLens, agentType: AgentType, tolerance: ContradictionTolerance) => {
        handleDispatchAgent(lens, agentType, tolerance, setActiveTab, chatHistory, setChatHistory, setSelectedNode);
    }

    const isAnalysisComplete = !!workspace?.knowledgeGraph;

    return (
        <main className="min-h-screen text-slate-200">
            <div className="container mx-auto px-4 py-8">
                <Header />
                <AgentControlPanel
                    topic={topic}
                    setTopic={setTopic}
                    onDispatchAgent={handleDispatchWrapper}
                    isLoading={isLoading || isChatting}
                    model={model}
                    setModel={setModel}
                    apiKey={apiKey}
                    onApiKeyChange={setApiKey}
                    contradictionTolerance={contradictionTolerance}
                    setContradictionTolerance={setContradictionTolerance}
                    dataSourceLimits={dataSourceLimits}
                    onDataSourceLimitChange={setDataSourceLimits}
                    apiCallLimit={usageState.limit}
                    onApiCallLimitChange={setApiCallLimit}
                    openAIBaseUrl={openAIBaseUrl}
                    onOpenAIBaseUrlChange={setOpenAIBaseUrl}
                    openAIModelName={openAIModelName}
                    onOpenAIModelNameChange={setOpenAIModelName}
                    openAIApiKey={openAIApiKey}
                    onOpenAIApiKeyChange={setOpenAIApiKey}
                    isAnalysisComplete={isAnalysisComplete}
                    preprocessQuery={preprocessQuery}
                    onPreprocessQueryChange={setPreprocessQuery}
                />
                <Dashboard
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    workspace={workspace}
                    isLoading={isLoading}
                    error={error}
                    hasSearched={hasSearched}
                    loadingMessage={loadingMessage}
                    onNodeClick={(node) => setSelectedNode(node)}
                    selectedNode={selectedNode}
                    onClearSelectedNode={() => setSelectedNode(null)}
                    chatHistory={chatHistory}
                    isChatting={isChatting}
                    onSendMessage={handleSendMessage}
                    onManualSourceUpdate={handleManualSourceUpdate}
                />
                <Footer />
            </div>
            <DebugLogView 
                logs={logs} 
                onReset={handleResetProgress} 
                apiCallCount={usageState.count}
                apiCallLimit={usageState.limit}
            />
        </main>
    );
};

export default App;

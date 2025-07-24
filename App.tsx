

import React, { useState, useEffect } from 'react';
import { AgentType, type AnalysisLens, type ChatMessage, type KnowledgeGraphNode, type GroundingSource, type WorkspaceState } from './types';
import { chatWithWorkspace } from './services/geminiService';
import { useAppSettings } from './hooks/useAppSettings';
import { useWorkspaceManager } from './hooks/useWorkspaceManager';
import { useDebugLog } from './hooks/useDebugLog';

import Header from './components/Header';
import AgentControlPanel from './components/SearchBar';
import WorkspaceView from './components/ResultsDisplay';
import DebugLogView from './components/DebugLogView';
import ChatView from './components/ChatView';
import Footer from './components/Footer';

const APP_STATE_STORAGE_KEY = 'longevityKnowledgeGraphState';

interface DashboardProps {
    activeTab: 'priorities' | 'knowledge_web' | 'sources';
    setActiveTab: React.Dispatch<React.SetStateAction<'priorities' | 'knowledge_web' | 'sources'>>;
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
}) => {
    const isGraphFocused = activeTab === 'knowledge_web';
    const isWorkspaceReady = !!workspace && !!workspace.knowledgeGraph;
    const sources = workspace?.sources || [];

    return (
        <div className={`grid grid-cols-1 ${isGraphFocused ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-8 mt-8 items-start`}>
            <div className={`${isGraphFocused ? 'lg:col-span-2' : 'lg:col-span-1'} flex flex-col gap-8`}>
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
                />
            </div>
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
        </div>
    );
};


const App: React.FC = () => {
    // --- State Management using Hooks ---
    const { logs, addLog, handleResetProgress } = useDebugLog(APP_STATE_STORAGE_KEY);
    const settings = useAppSettings(addLog, APP_STATE_STORAGE_KEY);
    const { model, setModel, apiKey, setApiKey } = settings;
    const { 
      topic, setTopic, workspace, isLoading, loadingMessage, 
      error, hasSearched, handleDispatchAgent 
    } = useWorkspaceManager({ settings, addLog, storageKey: APP_STATE_STORAGE_KEY });
    
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isChatting, setIsChatting] = useState(false);
    const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
    const [activeTab, setActiveTab] = useState<'priorities' | 'knowledge_web' | 'sources'>('priorities');

    // --- Effects ---
    useEffect(() => {
        addLog("Initializing application...");
        // Restore chat history from local storage
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

    // --- Handlers ---
    const handleSendMessage = async (message: string) => {
        if (!message.trim() || !workspace) return;
        
        setSelectedNode(null); // Clear selected node on send

        const newUserMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text: message };
        const aiLoadingMessage: ChatMessage = { id: `ai-${Date.now()}`, sender: 'ai', text: '', isLoading: true };

        const newHistory = [...chatHistory, newUserMessage, aiLoadingMessage];
        setChatHistory(newHistory);
        setIsChatting(true);

        try {
            const aiResponseText = await chatWithWorkspace(message, workspace, model, apiKey, addLog);
            const finalAiMessage: ChatMessage = { ...aiLoadingMessage, text: aiResponseText, isLoading: false };
            
            const finalHistory = newHistory.map(msg => msg.id === aiLoadingMessage.id ? finalAiMessage : msg);
            setChatHistory(finalHistory);
            
            const currentState = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY) || '{}');
            localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify({
                ...currentState,
                chatHistory: finalHistory,
            }));

        } catch (e) {
            const errorText = e instanceof Error ? e.message : "An unknown error occurred.";
            const errorAiMessage: ChatMessage = { ...aiLoadingMessage, text: `Sorry, I encountered an error: ${errorText}`, isLoading: false };
            setChatHistory(prev => prev.map(msg => msg.id === aiLoadingMessage.id ? errorAiMessage : msg));
            addLog(`Chat Error: ${errorText}`);
        } finally {
            setIsChatting(false);
        }
    };
    
    return (
        <main className="min-h-screen text-slate-200">
            <div className="container mx-auto px-4 py-8">
                <Header />
                <AgentControlPanel
                    topic={topic}
                    setTopic={setTopic}
                    onDispatchAgent={(lens, agentType) => handleDispatchAgent(lens, agentType, setActiveTab, setChatHistory, setSelectedNode)}
                    isLoading={isLoading || isChatting}
                    model={model}
                    setModel={setModel}
                    apiKey={apiKey}
                    onApiKeyChange={setApiKey}
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
                />
                <Footer />
            </div>
            <DebugLogView 
                logs={logs} 
                onReset={handleResetProgress} 
            />
        </main>
    );
};

export default App;

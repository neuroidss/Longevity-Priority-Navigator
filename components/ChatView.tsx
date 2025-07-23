



import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, KnowledgeGraphNode } from '../types';
import { LightbulbIcon, NetworkIcon } from './icons';

const generateContextualQuestions = (node: KnowledgeGraphNode): string[] => {
    const questions: string[] = [];
    questions.push(`Tell me more about ${node.label}.`);
    questions.push(`What is the significance of the "${node.label}" (${node.type}) node in the context of aging?`);
    questions.push(`Which scientific articles in the workspace are related to ${node.label}?`);
    if (node.type === 'Hypothesis' || node.type === 'KnowledgeGap') {
        questions.push(`How could one test the hypothesis: "${node.label}"?`);
    }
    if (node.type === 'Gene' || node.type === 'Protein' || node.type === 'Compound') {
        questions.push(`What are the known connections between ${node.label} and other entities in the graph?`);
    }
    return questions.slice(0, 3);
};

const formatMessage = (text: string) => {
    let html = text.replace(/\n/g, '<br />');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?:^|\n)(?:\* |- )([^\n<]+)/g, '<ul><li style="margin-left: 20px; padding-left: 5px;">$1</li></ul>');
    html = html.replace(/<\/ul><br \/><ul>/g, '');
    return html;
};


interface ChatViewProps {
    chatHistory: ChatMessage[];
    isChatting: boolean;
    onSendMessage: (message: string) => void;
    isWorkspaceReady: boolean;
    selectedNode: KnowledgeGraphNode | null;
    onClearSelectedNode: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ 
    chatHistory, isChatting, onSendMessage, isWorkspaceReady, selectedNode, onClearSelectedNode 
}) => {
    const [input, setInput] = useState('');
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleSend = () => {
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    };

    const handleContextualSend = (question: string) => {
        onSendMessage(question);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const DefaultChatInput = () => (
        <div className="p-4 border-t border-slate-700">
            <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-2 border border-slate-600 focus-within:ring-2 focus-within:ring-purple-500">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isWorkspaceReady ? "Ask a follow-up question..." : "Analyze a topic first..."}
                    className="flex-grow bg-transparent focus:outline-none text-sm text-slate-200 placeholder-slate-500 resize-none"
                    rows={2}
                    disabled={isChatting || !isWorkspaceReady}
                />
                <button
                    onClick={handleSend}
                    disabled={isChatting || !input.trim() || !isWorkspaceReady}
                    className="self-end bg-purple-600 text-white rounded-md p-2 hover:bg-purple-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    aria-label="Send message"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                </button>
            </div>
        </div>
    );

    const ContextualChatInput = ({ node }: { node: KnowledgeGraphNode }) => {
        const questions = generateContextualQuestions(node);
        return (
             <div className="p-4 border-t border-slate-700 bg-slate-800/70">
                <div className="text-center mb-3">
                    <p className="text-sm text-slate-400">Ask about node:</p>
                    <p className="font-bold text-lg text-teal-300">{node.label} <span className="text-xs font-normal text-slate-500">({node.type})</span></p>
                </div>
                <div className="space-y-2">
                    {questions.map((q, i) => (
                        <button 
                            key={i}
                            onClick={() => handleContextualSend(q)}
                            disabled={isChatting}
                            className="w-full text-left text-sm p-2 bg-slate-700/50 rounded-md hover:bg-slate-600/50 text-slate-300 disabled:opacity-50 transition-colors"
                        >
                           {`"${q}"`}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={onClearSelectedNode}
                    className="w-full text-center text-xs mt-3 text-slate-500 hover:text-slate-300"
                >
                    or ask something else...
                </button>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-[85vh] bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                <LightbulbIcon className="h-6 w-6 text-yellow-300" />
                <h2 className="text-xl font-bold text-slate-100">AI Research Assistant</h2>
            </div>
            
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {!isWorkspaceReady && (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
                         <NetworkIcon className="h-12 w-12 mb-4" />
                         <p className="font-semibold">Your workspace is empty.</p>
                         <p className="text-sm">First, analyze a topic to build a knowledge graph. Then you can ask questions about it here.</p>
                    </div>
                )}
                {isWorkspaceReady && chatHistory.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
                         <LightbulbIcon className="h-12 w-12 mb-4 text-yellow-300" />
                         <p className="font-semibold">Explore the Knowledge Graph.</p>
                         <p className="text-sm">Review the AI's briefing, click nodes on the graph for contextual questions, or ask your own questions here.</p>
                    </div>
                )}

                {chatHistory.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center"><LightbulbIcon className="h-5 w-5 text-yellow-300"/></div>}
                        <div className={`max-w-md rounded-lg px-4 py-3 ${msg.sender === 'user' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                            {msg.isLoading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-0"></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150"></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-300"></div>
                                </div>
                            ) : (
                                <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
                            )}
                        </div>
                    </div>
                ))}
                <div ref={endOfMessagesRef} />
            </div>
            {selectedNode ? <ContextualChatInput node={selectedNode} /> : <DefaultChatInput />}
        </div>
    );
};

export default ChatView;
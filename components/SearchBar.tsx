
import React, { useState } from 'react';
import { AgentType, type ModelDefinition, type AnalysisLens, ContradictionTolerance, SearchDataSource, ModelProvider } from '../types';
import { EXAMPLE_TOPICS, SUPPORTED_MODELS, LENS_DEFINITIONS, DATA_SOURCE_DEFINITIONS } from '../constants';
import { GearIcon, ChevronDownIcon, NetworkIcon, ClockIcon, LightbulbIcon, ShoppingCartIcon } from './icons';

interface AgentControlPanelProps {
  topic: string;
  setTopic: (topic: string) => void;
  onDispatchAgent: (lens: AnalysisLens, agentType: AgentType, tolerance: ContradictionTolerance) => void;
  isLoading: boolean;
  model: ModelDefinition;
  setModel: (model: ModelDefinition) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  contradictionTolerance: ContradictionTolerance;
  setContradictionTolerance: (tolerance: ContradictionTolerance) => void;
  dataSourceLimits: Record<SearchDataSource, number>;
  onDataSourceLimitChange: (source: SearchDataSource, limit: number) => void;
  apiCallLimit: number;
  onApiCallLimitChange: (limit: number) => void;
  openAIBaseUrl: string;
  onOpenAIBaseUrlChange: (url: string) => void;
  openAIModelName: string;
  onOpenAIModelNameChange: (name: string) => void;
  openAIApiKey: string;
  onOpenAIApiKeyChange: (key: string) => void;
  isAnalysisComplete: boolean;
  preprocessQuery: boolean;
  onPreprocessQueryChange: (enabled: boolean) => void;
}

const AgentControlPanel: React.FC<AgentControlPanelProps> = ({ 
  topic, setTopic, onDispatchAgent, isLoading, model, setModel, 
  apiKey, onApiKeyChange, contradictionTolerance, setContradictionTolerance,
  dataSourceLimits, onDataSourceLimitChange, apiCallLimit, onApiCallLimitChange,
  openAIBaseUrl, onOpenAIBaseUrlChange, openAIModelName, onOpenAIModelNameChange,
  openAIApiKey, onOpenAIApiKeyChange, isAnalysisComplete,
  preprocessQuery, onPreprocessQueryChange
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedLens, setSelectedLens] = useState<AnalysisLens>('Balanced');

  const needsGoogleApiKey = model.provider === ModelProvider.GoogleAI && !process.env.API_KEY;
  const isOllamaProvider = model.provider === ModelProvider.Ollama;
  const isOpenAIProvider = model.provider === ModelProvider.OpenAI_API;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading && topic && !(needsGoogleApiKey && !apiKey)) {
        onDispatchAgent(selectedLens, AgentType.KnowledgeNavigator, contradictionTolerance);
      }
    }
  };

  const toleranceLevels: { id: ContradictionTolerance; name: string; description: string }[] = [
    { id: 'Low', name: 'Strict Consensus', description: 'Focus on corroborated findings and minimize contradictions.' },
    { id: 'Medium', name: 'Balanced View', description: 'Acknowledge and analyze contradictions as research gaps.' },
    { id: 'High', name: 'Exploratory', description: 'Actively explore novel, outlier, and contradictory findings.' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
      {/* Main Search Input */}
      <div className="flex w-full items-center">
        <div className="flex-grow bg-slate-800 border-2 border-slate-600 rounded-full focus-within:ring-4 focus-within:ring-purple-500/50 focus-within:border-purple-500 transition-all duration-300">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a research area (e.g., 'senolytics')..."
            className="w-full pl-5 pr-4 py-4 text-lg bg-transparent focus:outline-none text-white placeholder-slate-400"
            disabled={isLoading}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      {/* Example Topics */}
      <div className="flex justify-center flex-wrap gap-2">
        <span className="text-slate-400 self-center mr-2 text-sm">Or try:</span>
        {EXAMPLE_TOPICS.slice(0, 3).map(example => (
          <button key={example} onClick={() => setTopic(example)} className="px-3 py-1 bg-slate-700/50 text-slate-300 text-sm rounded-full hover:bg-slate-600 transition-colors">
            {example}
          </button>
        ))}
      </div>
      
      {/* Settings Sections */}
      <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Lens Selection */}
        <div className="space-y-3">
            <h3 className="text-center text-sm font-semibold text-slate-400 uppercase tracking-wider">Analysis Lens</h3>
            <div className="flex justify-center flex-wrap gap-2">
                {LENS_DEFINITIONS.map(lens => (
                <button
                    key={lens.id}
                    onClick={() => setSelectedLens(lens.id)}
                    disabled={isLoading}
                    title={lens.description}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-full border-2 transition-all duration-200 disabled:opacity-50
                    ${selectedLens === lens.id 
                        ? 'bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-500/20' 
                        : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/50 hover:border-slate-500'
                    }`}
                >
                    {lens.name}
                </button>
                ))}
            </div>
        </div>
        {/* Contradiction Tolerance */}
        <div className="space-y-3">
            <h3 className="text-center text-sm font-semibold text-slate-400 uppercase tracking-wider">Contradiction Tolerance</h3>
            <div className="flex justify-center flex-wrap gap-2">
                {toleranceLevels.map(level => (
                <button
                    key={level.id}
                    onClick={() => setContradictionTolerance(level.id)}
                    disabled={isLoading}
                    title={level.description}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-full border-2 transition-all duration-200 disabled:opacity-50
                    ${contradictionTolerance === level.id 
                        ? 'bg-sky-600 border-sky-500 text-white shadow-sm shadow-sky-500/20' 
                        : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/50 hover:border-slate-500'
                    }`}
                >
                    {level.name}
                </button>
                ))}
            </div>
        </div>
      </div>


      {/* Action Buttons */}
       <div className="space-y-4 pt-6 border-t border-slate-700/50">
          <h3 className="text-center text-sm font-semibold text-slate-400 uppercase tracking-wider -mt-2 mb-2">Dispatch Agents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => onDispatchAgent(selectedLens, AgentType.KnowledgeNavigator, contradictionTolerance)}
                disabled={isLoading || !topic || (needsGoogleApiKey && !apiKey)}
                className="lg:col-span-1 flex items-center justify-center gap-3 px-4 py-4 rounded-xl font-bold transition-all duration-300 bg-purple-600 text-white text-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-purple-500 shadow-lg shadow-purple-500/20"
                aria-label="Analyze topic and build knowledge graph"
              >
                <NetworkIcon className="h-6 w-6" />
                <span>Analyze State</span>
              </button>
              <button
                onClick={() => onDispatchAgent(selectedLens, AgentType.TrendAnalyzer, contradictionTolerance)}
                disabled={isLoading || !topic || (needsGoogleApiKey && !apiKey)}
                className="lg:col-span-1 flex items-center justify-center gap-3 px-4 py-4 rounded-xl font-bold transition-all duration-300 bg-teal-600 text-white text-lg hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-teal-500 shadow-lg shadow-teal-500/20"
                aria-label="Analyze historical trends for the topic"
              >
                <ClockIcon className="h-6 w-6" />
                <span>Analyze Trends</span>
              </button>
              <button
                onClick={() => onDispatchAgent(selectedLens, AgentType.InnovationAgent, contradictionTolerance)}
                disabled={isLoading || !isAnalysisComplete}
                title={!isAnalysisComplete ? "First, run 'Analyze State' or 'Analyze Trends' to build a knowledge base." : "Analyze market and innovation potential"}
                className="lg:col-span-1 flex items-center justify-center gap-3 px-4 py-4 rounded-xl font-bold transition-all duration-300 bg-amber-600 text-white text-lg hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-amber-500 shadow-lg shadow-amber-500/20"
                aria-label="Analyze market and innovation potential"
              >
                <LightbulbIcon className="h-6 w-6" />
                <span>Analyze Innovation</span>
              </button>
               <button
                onClick={() => onDispatchAgent(selectedLens, AgentType.AppliedLongevityAgent, contradictionTolerance)}
                disabled={isLoading || !isAnalysisComplete}
                title={!isAnalysisComplete ? "First, run 'Analyze State' or 'Analyze Trends' to build a knowledge base." : "Generate an actionable plan for products and investments"}
                className="lg:col-span-1 flex items-center justify-center gap-3 px-4 py-4 rounded-xl font-bold transition-all duration-300 bg-green-600 text-white text-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-green-500 shadow-lg shadow-green-500/20"
                aria-label="Create an action plan with products and investments"
              >
                <ShoppingCartIcon className="h-6 w-6" />
                <span>Create Action Plan</span>
              </button>
          </div>
      </div>


      {/* Settings Toggle */}
      <div className="text-center pt-2">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/50 transition-colors"
          aria-expanded={settingsOpen}
        >
          <GearIcon />
          <span>Advanced Settings</span>
          <ChevronDownIcon className={`transition-transform duration-300 ${settingsOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Collapsible Settings Panel */}
      {settingsOpen && (
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label htmlFor="model-select" className="block text-sm font-medium text-slate-300 mb-1">AI Model</label>
              <div className="relative">
                <select
                  id="model-select"
                  value={model.id}
                  onChange={(e) => {
                    const selectedModel = SUPPORTED_MODELS.find(m => m.id === e.target.value);
                    if (selectedModel) setModel(selectedModel);
                  }}
                  disabled={isLoading}
                  aria-label="Select AI Model"
                  className="appearance-none w-full bg-slate-700 text-slate-200 font-semibold pl-3 pr-8 py-2 rounded-lg hover:bg-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all duration-300"
                >
                  {SUPPORTED_MODELS.map(m => (
                    <option key={m.id} value={m.id} className="font-sans">{m.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                </div>
              </div>
            </div>
            <div>
                <label htmlFor="api-limit-input" className="block text-sm font-medium text-slate-300 mb-1">Daily API Call Limit</label>
                 <input
                    id="api-limit-input"
                    type="number"
                    value={apiCallLimit}
                    onChange={(e) => onApiCallLimitChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="e.g., 50"
                    className="w-full px-4 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-white placeholder-slate-400"
                    disabled={model.provider !== ModelProvider.GoogleAI}
                />
            </div>
            <div className="md:col-span-2 flex items-center justify-between p-3 bg-slate-700/40 rounded-lg">
                <div className="flex-grow">
                    <label htmlFor="query-preprocess-toggle" className="font-medium text-slate-200">AI Query Pre-processing</label>
                    <p className="text-xs text-slate-400">Auto-translates & refines topic for better scientific search results.</p>
                </div>
                <button
                    type="button"
                    id="query-preprocess-toggle"
                    onClick={() => onPreprocessQueryChange(!preprocessQuery)}
                    className={`${
                    preprocessQuery ? 'bg-purple-600' : 'bg-slate-600'
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-800`}
                    role="switch"
                    aria-checked={preprocessQuery}
                >
                    <span
                    aria-hidden="true"
                    className={`${
                        preprocessQuery ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                </button>
            </div>
            {needsGoogleApiKey && (
                <div className="md:col-span-2">
                <label htmlFor="api-key-input" className="block text-sm font-medium text-slate-300 mb-1">Google AI API Key</label>
                <input
                    id="api-key-input"
                    type="password"
                    value={apiKey}
                    onChange={(e) => onApiKeyChange(e.target.value)}
                    placeholder="Enter your Google AI API Key"
                    className="w-full px-4 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-white placeholder-slate-400"
                />
                </div>
            )}
             {isOpenAIProvider && (
                <div className="md:col-span-2 space-y-4 p-4 bg-slate-900/40 rounded-lg border border-slate-700">
                    <h4 className="text-md font-semibold text-slate-300 text-center">OpenAI-Compatible API Settings</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="openai-base-url" className="block text-sm font-medium text-slate-300 mb-1">Base URL</label>
                            <input
                                id="openai-base-url"
                                type="text"
                                value={openAIBaseUrl}
                                onChange={(e) => onOpenAIBaseUrlChange(e.target.value)}
                                placeholder="e.g., http://localhost:11434/v1"
                                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-white placeholder-slate-400"
                            />
                        </div>
                        <div>
                            <label htmlFor="openai-model-name" className="block text-sm font-medium text-slate-300 mb-1">Model Name</label>
                            <input
                                id="openai-model-name"
                                type="text"
                                value={openAIModelName}
                                onChange={(e) => onOpenAIModelNameChange(e.target.value)}
                                placeholder="e.g., gemma3n:e4b"
                                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-white placeholder-slate-400"
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="openai-api-key" className="block text-sm font-medium text-slate-300 mb-1">API Key (Optional)</label>
                        <input
                            id="openai-api-key"
                            type="password"
                            value={openAIApiKey}
                            onChange={(e) => onOpenAIApiKeyChange(e.target.value)}
                            placeholder="Enter if required by your endpoint"
                            className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-white placeholder-slate-400"
                        />
                    </div>
                </div>
            )}
          </div>
            <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">Data Sources (Max Results)</label>
                <p className="text-xs text-slate-400 -mt-2">Set to 0 to disable a source. Different models handle different context sizes, so adjust accordingly.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(DATA_SOURCE_DEFINITIONS).map(([sourceKey, sourceInfo]) => {
                        const source = sourceKey as SearchDataSource;
                        const limit = dataSourceLimits[source] ?? 0;
                        return (
                            <label key={sourceKey} title={sourceInfo.description} className="flex items-center gap-3 p-2 pr-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 flex-grow">
                                   {React.cloneElement(sourceInfo.icon, {className: 'h-5 w-5 flex-shrink-0'})}
                                   <span className="flex-grow">{sourceInfo.label}</span>
                                </div>
                                <input
                                    type="number"
                                    value={limit}
                                    onChange={(e) => onDataSourceLimitChange(source, parseInt(e.target.value, 10) || 0)}
                                    min="0"
                                    max="50"
                                    disabled={isLoading}
                                    className="w-16 text-center bg-slate-700 border-slate-600 text-slate-200 font-semibold rounded-md p-1 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    aria-label={`Max results for ${sourceInfo.label}`}
                                />
                            </label>
                        );
                    })}
                </div>
            </div>

            {needsGoogleApiKey && (
                <p className="text-xs text-slate-500 text-center -mt-4">Your key is stored in session storage and is only used to communicate with the Google AI API.</p>
            )}
            {isOllamaProvider && (
                <p className="text-xs text-slate-500 text-center -mt-4">
                    To use Ollama models, ensure the Ollama server is running locally and you have downloaded the model (e.g., `ollama pull llama3`).
                </p>
            )}
             {isOpenAIProvider && (
                <p className="text-xs text-slate-500 text-center -mt-4">
                    For use with any OpenAI-compatible API, including local models via Ollama (use e.g., <code className="bg-slate-900 px-1 py-0.5 rounded">http://localhost:11434/v1</code>) or vLLM.
                </p>
            )}
        </div>
      )}
    </div>
  );
};

export default AgentControlPanel;

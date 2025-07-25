


import { type ModelDefinition, type AnalysisLens, SearchDataSource, ModelProvider } from './types';
import { ArticleIcon, PatentIcon, GoogleIcon, GeneIcon, WebIcon } from './components/icons';
import React from 'react';

export const LENS_DEFINITIONS: { id: AnalysisLens, name: string, description: string }[] = [
    { id: 'Balanced', name: 'Balanced Approach', description: 'A mix of near-term applicability and foundational research.' },
    { id: 'High-Risk/High-Reward', name: 'High-Risk / High-Reward', description: 'Focus on novel, unconventional hypotheses for breakthrough potential.' },
    { id: 'Clinical Translation', name: 'Clinical Translation', description: 'Prioritize research with a clear path to human application.' },
    { id: 'Biomarker Discovery', name: 'Biomarker Discovery', description: 'Focus on discovering and validating new biomarkers for aging.' },
    { id: 'Fundamental Mechanisms', name: 'Fundamental Mechanisms', description: 'Explore the basic science and core mechanisms of aging.' }
];

export const EXAMPLE_TOPICS = [
    "epigenetic clocks and aging",
    "Cellular senescence in aging",
    "immunosenescence",
    "genomic instability in aging",
    "mTOR pathway and rapamycin"
];

export const SUPPORTED_MODELS: ModelDefinition[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: ModelProvider.GoogleAI },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', provider: ModelProvider.GoogleAI },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: ModelProvider.GoogleAI },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', provider: ModelProvider.GoogleAI },
    { id: 'custom-openai', name: 'Custom (OpenAI-Compatible)', provider: ModelProvider.OpenAI_API },
    { id: 'gemma3n:e4b', name: 'Gemma 3N E4B (Ollama)', provider: ModelProvider.Ollama },
    { id: 'gemma3n:e2b', name: 'Gemma 3N E2B (Ollama)', provider: ModelProvider.Ollama },
    { id: 'qwen3:14b', name: 'Qwen3 14B (Ollama)', provider: ModelProvider.Ollama },
    { id: 'qwen3:8b', name: 'Qwen3 8B (Ollama)', provider: ModelProvider.Ollama },
    { id: 'qwen3:4b', name: 'Qwen3 4B (Ollama)', provider: ModelProvider.Ollama },
    { id: 'qwen3:1.7b', name: 'Qwen3 1.7B (Ollama)', provider: ModelProvider.Ollama },
    { id: 'qwen3:0.6b', name: 'Qwen3 0.6B (Ollama)', provider: ModelProvider.Ollama }
];

export const DATA_SOURCE_DEFINITIONS: Record<SearchDataSource, { label: string; icon: JSX.Element; description: string }> = {
    [SearchDataSource.GoogleSearch]: { label: 'Google Search', icon: React.createElement(GoogleIcon), description: 'AI-powered search via Gemini for grounding. Good for finding very recent or specific information.' },
    [SearchDataSource.WebSearch]: { label: 'Web Search (DuckDuckGo)', icon: React.createElement(WebIcon), description: 'General web search via DuckDuckGo for broader coverage.' },
    [SearchDataSource.PubMed]: { label: 'PubMed', icon: React.createElement(ArticleIcon), description: 'Official database of biomedical literature from NCBI.' },
    [SearchDataSource.BioRxivFeed]: { label: 'bioRxiv Feed', icon: React.createElement(ArticleIcon), description: 'Monitor the live feed of new preprints for very recent papers.' },
    [SearchDataSource.BioRxivPmcArchive]: { label: 'bioRxiv (PMC Archive)', icon: React.createElement(ArticleIcon), description: 'Search the PubMed Central archive for bioRxiv preprints. A good fallback.' },
    [SearchDataSource.GooglePatents]: { label: 'Google Patents', icon: React.createElement(PatentIcon), description: 'Search for relevant patents and intellectual property.' },
    [SearchDataSource.OpenGenes]: { label: 'OpenGenes', icon: React.createElement(GeneIcon), description: 'Query the OpenGenes database for curated gene-longevity associations.' },
};
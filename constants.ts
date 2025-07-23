


import { type ModelDefinition, type AnalysisLens } from './types';

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
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google AI' },
];
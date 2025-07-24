
import { GoogleGenAI, Type } from "@google/genai";
import { 
    type AgentResponse, type GroundingSource, 
    type ModelDefinition, AgentType, WorkspaceState, ResearchOpportunity, AnalysisLens, SourceStatus,
    SearchDataSource, type SearchResult, ContradictionTolerance
} from '../types';
import { buildAgentPrompts, buildChatPrompt, buildDiscoverAndValidatePrompt, buildFilterBioRxivFeedPrompt } from './agentPrompts';
import { performFederatedSearch, excavatePrimarySources, isPrimarySourceDomain } from './searchService';

// --- Parser functions ---

const parseJsonFromText = (text: string, addLog: (msg: string) => void): string => {
    // Priority 1: Find a JSON markdown block.
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        addLog('[Parser] Extracted JSON from markdown code block.');
        return jsonMatch[1].trim();
    }

    // Priority 2: Find the first '{' or '[' and assume the rest of the string is the object.
    addLog('[Parser] No markdown block found. Searching for raw JSON object.');
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');

    let startIndex = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
        startIndex = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
        startIndex = firstBrace;
    } else {
        startIndex = firstBracket;
    }

    if (startIndex === -1) {
        addLog('[Parser] WARN: No JSON object or array found in text. Returning raw text.');
        return text;
    }

    const jsonText = text.substring(startIndex);
    addLog(`[Parser] Found potential JSON starting at index ${startIndex}. Parsing from there.`);
    return jsonText.trim();
};

const parseAgentResponse = (jsonText: string, agentType: AgentType, addLog: (msg: string) => void): AgentResponse => {
    try {
        const data = JSON.parse(jsonText);
        addLog(`[Parser] Successfully parsed JSON for ${agentType}.`);
        const response: AgentResponse = {};

        if (data.keyQuestion) response.keyQuestion = data.keyQuestion;
        if (data.knowledgeGraph) response.knowledgeGraph = data.knowledgeGraph;
        if (data.synthesis) response.synthesis = data.synthesis;
        if (data.researchOpportunities) {
            response.researchOpportunities = data.researchOpportunities.map((r: any, index: number) => ({
                id: `ro-${index}-${Math.random()}`,
                title: r.title,
                justification: r.justification,
                relatedNodeIds: r.relatedNodeIds || [],
                lens: r.lens,
                confidence: typeof r.confidence === 'number' ? Math.min(1, Math.max(0, r.confidence)) : 0.5,
                maturity: r.maturity && ['Basic Research', 'Translational', 'Clinical'].includes(r.maturity) ? r.maturity : 'Basic Research',
                potentialImpact: r.potentialImpact || 'Not specified by AI.',
            }));
        }
        if (data.trendAnalysis) response.trendAnalysis = data.trendAnalysis;
        if (data.contradictions) {
            response.contradictions = data.contradictions.map((c: any, index: number) => ({ id: `con-${index}-${Math.random()}`, statement: c.statement }));
        }
        if (data.synergies) {
            response.synergies = data.synergies.map((s: any, index: number) => ({ id: `syn-${index}-${Math.random()}`, statement: s.statement }));
        }
        
        return response;

    } catch (error) {
        addLog(`[Parser] ERROR: Error parsing response for ${agentType}: ${error}\nRaw text: ${jsonText}`);
        const fallbackSummary = `Could not parse the AI's structured response. The raw text received was: ${jsonText}`;
        return { synthesis: fallbackSummary };
    }
};

const callGoogleAI = async (model: string, systemInstruction: string, userPrompt: string, useSearch: boolean, addLog: (msg: string) => void, apiKey?: string) => {
    addLog(`[GoogleAI] Calling model '${model}'...`);
    const key = (apiKey || process.env.API_KEY)?.trim();
    if (!key) {
        addLog(`[GoogleAI] ERROR: API_KEY is not set.`);
        throw new Error("API Key for Google AI is not provided. Please enter your key in the settings panel.");
    }
    const ai = new GoogleGenAI({ apiKey: key });

    const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
            systemInstruction,
            ...(useSearch && { tools: [{ googleSearch: {} }] }),
        },
    });

    if (!response || (!response.text && !response.candidates?.[0]?.groundingMetadata?.groundingChunks)) {
        const candidate = response?.candidates?.[0];
        const finishReason = candidate?.finishReason;
        let errorMessage = `Google AI response was empty or invalid. Finish Reason: ${finishReason || 'N/A'}.`;
        if (finishReason === 'SAFETY') {
            errorMessage = `The response was blocked due to safety concerns. Please modify your query. Safety Ratings: ${JSON.stringify(candidate?.safetyRatings, null, 2)}`;
        }
        addLog(`[GoogleAI] ERROR: ${errorMessage}`);
        throw new Error(errorMessage);
    }
    
    addLog(`[GoogleAI] Received valid response.`);
    return response;
}

// --- Main Service Functions ---

export const performGoogleSearch = async (
    query: string,
    model: ModelDefinition,
    addLog: (msg: string) => void,
    apiKey?: string
): Promise<SearchResult[]> => {
    addLog(`[performGoogleSearch] Starting AI-powered web search...`);
    try {
        const systemInstruction = "You are a helpful research assistant.";
        const userPrompt = `Find the most relevant and reliable scientific sources about "${query}"`;
        
        const response = await callGoogleAI(model.id, systemInstruction, userPrompt, true, addLog, apiKey);

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        
        if (!groundingChunks || !Array.isArray(groundingChunks)) {
            addLog(`[performGoogleSearch] WARN: AI did not return valid grounding chunks from Google Search.`);
             if (response.text && response.text.length > 10) {
                 addLog(`[performGoogleSearch] Grounding chunks absent, but text is present. AI might have summarized instead of grounding. This text will be ignored as it cannot be verified.`);
             }
            return [];
        }

        const searchResults: SearchResult[] = groundingChunks
            .map((chunk: any) => {
                if (chunk.web && chunk.web.uri && chunk.web.title) {
                    return {
                        link: chunk.web.uri,
                        title: chunk.web.title,
                        snippet: `Source from Google Search for: "${query}".`, 
                        source: SearchDataSource.GoogleSearch
                    };
                }
                return null;
            })
            .filter((r): r is SearchResult => r !== null);

        addLog(`[performGoogleSearch] Found ${searchResults.length} sources from Google Search grounding.`);
        const uniqueResults = Array.from(new Map(searchResults.map(item => [item.link, item])).values());
        return uniqueResults;

    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error during Google Search';
        addLog(`[performGoogleSearch] ERROR: ${message}`);
        return [];
    }
};

const filterBioRxivFeedWithAI = async (
    query: string,
    feedItems: SearchResult[],
    model: ModelDefinition,
    addLog: (msg: string) => void,
    apiKey?: string
): Promise<SearchResult[]> => {
    if (feedItems.length === 0) return [];
    addLog(`[BioRxivFeedFilter] Asking AI to filter ${feedItems.length} raw feed items for relevance to "${query}"...`);
    
    try {
        const { systemInstruction, userPrompt } = buildFilterBioRxivFeedPrompt(query, feedItems);
        const response = await callGoogleAI(model.id, systemInstruction, userPrompt, false, addLog, apiKey);
        const jsonText = parseJsonFromText(response.text, addLog);
        const data = JSON.parse(jsonText);

        if (!data.relevantArticleUrls || !Array.isArray(data.relevantArticleUrls)) {
            addLog(`[BioRxivFeedFilter] WARN: AI filter did not return a valid 'relevantArticleUrls' array. Discarding all feed items.`);
            return [];
        }

        const relevantUrls = new Set(data.relevantArticleUrls as string[]);
        const relevantItems = feedItems.filter(item => relevantUrls.has(item.link));

        addLog(`[BioRxivFeedFilter] AI identified ${relevantItems.length} relevant items from the feed.`);
        return relevantItems;

    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error during AI feed filtering';
        addLog(`[BioRxivFeedFilter] ERROR: ${message}. Discarding all feed items.`);
        return [];
    }
};


export const discoverAndValidateSources = async (
    query: string,
    model: ModelDefinition,
    addLog: (msg: string) => void,
    setLoadingMessage: (message: string) => void,
    apiKey: string | undefined,
    enabledSources: SearchDataSource[]
): Promise<GroundingSource[]> => {
    addLog(`[discoverAndValidateSources] Starting with enabled sources: ${enabledSources.join(', ')}`);

    setLoadingMessage("Step 1/3: Searching scientific databases & web...");
    
    const specialistSearchSources = enabledSources.filter(s => s !== SearchDataSource.GoogleSearch);
    const useGoogleSearch = enabledSources.includes(SearchDataSource.GoogleSearch);
    
    addLog(`[discoverAndValidateSources] Starting concurrent searches...`);
    const searchPromises = [];
    if (specialistSearchSources.length > 0) {
        searchPromises.push(performFederatedSearch(query, specialistSearchSources, addLog));
    }
    if (useGoogleSearch) {
        searchPromises.push(performGoogleSearch(query, model, addLog, apiKey));
    }

    const results = await Promise.allSettled(searchPromises);

    let allSearchResults: SearchResult[] = [];
    results.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            allSearchResults.push(...result.value);
        } else if (result.status === 'rejected') {
            addLog(`[discoverAndValidateSources] WARN: A search provider failed: ${result.reason}`);
        }
    });
    
    // AI-powered filtering for the BioRxiv Feed
    const rawFeedResults = allSearchResults.filter(r => r.source === SearchDataSource.BioRxivFeed);
    if (rawFeedResults.length > 0) {
        const filteredFeedResults = await filterBioRxivFeedWithAI(query, rawFeedResults, model, addLog, apiKey);
        // Replace raw feed results with AI-filtered results
        allSearchResults = allSearchResults.filter(r => r.source !== SearchDataSource.BioRxivFeed);
        allSearchResults.push(...filteredFeedResults);
    }

    const uniqueSearchResults = Array.from(new Map(allSearchResults.map(item => [item.link, item])).values());
    addLog(`[discoverAndValidateSources] Found ${uniqueSearchResults.length} total unique potential sources.`);

    if (uniqueSearchResults.length === 0) {
        addLog("[discoverAndValidateSources] All searches returned no results.");
        return [];
    }

    setLoadingMessage("Step 2/3: Excavating primary links from articles...");
    const directPrimaryResults = uniqueSearchResults.filter(res => isPrimarySourceDomain(res.link));
    const secondaryResults = uniqueSearchResults.filter(res => !isPrimarySourceDomain(res.link));
    addLog(`[discoverAndValidateSources] Triage complete: ${directPrimaryResults.length} direct primary sources, ${secondaryResults.length} secondary sources to excavate.`);
    
    const excavatedResults = await excavatePrimarySources(secondaryResults, addLog);

    const finalPrimaryResults = Array.from(new Map([...directPrimaryResults, ...excavatedResults].map(item => [item.link, item])).values());
    
    if (finalPrimaryResults.length === 0) {
        addLog("[discoverAndValidateSources] No primary sources found after excavation.");
        throw new Error("Could not find any primary scientific sources for the topic.");
    }
    addLog(`[discoverAndValidateSources] Total primary sources for summarization and assessment: ${finalPrimaryResults.length}.`);

    setLoadingMessage("Step 3/3: AI assessing source reliability...");
    addLog(`[discoverAndValidateSources] Sending ${finalPrimaryResults.length} curated primary sources to AI for assessment.`);
    const { systemInstruction, userPrompt } = buildDiscoverAndValidatePrompt(query, finalPrimaryResults);

    try {
        const response = await callGoogleAI(model.id, systemInstruction, userPrompt, false, addLog, apiKey);
        const jsonText = parseJsonFromText(response.text, addLog);
        const data = JSON.parse(jsonText);

        if (!data.sources || !Array.isArray(data.sources)) {
            addLog(`[discoverAndValidateSources] ERROR: AI validator did not return a valid 'sources' array.`);
            return [];
        }

        const finalPrimaryResultsMap = new Map(finalPrimaryResults.map(res => [res.link, res]));

        const assessedSources: GroundingSource[] = data.sources.map((s: any) => {
            const originalSource = finalPrimaryResultsMap.get(s.uri);
            return {
                uri: s.uri,
                title: s.title || s.uri,
                status: 'valid' as SourceStatus,
                origin: originalSource?.source || SearchDataSource.GoogleSearch,
                content: s.summary,
                reliability: typeof s.reliability === 'number' ? s.reliability : 0.5,
                reliabilityJustification: s.reliabilityJustification || 'AI did not provide a justification.',
                reason: 'Assessed for reliability by AI from a curated primary source.'
            };
        });
        
        const RELIABILITY_THRESHOLD = 0.2;
        const highQualitySources = assessedSources.filter(s => s.reliability !== undefined && s.reliability >= RELIABILITY_THRESHOLD);

        const lowQualityCount = assessedSources.length - highQualitySources.length;
        if (lowQualityCount > 0) {
            addLog(`[discoverAndValidateSources] Discarding ${lowQualityCount} sources with reliability below ${RELIABILITY_THRESHOLD}.`);
        }
        
        addLog(`[discoverAndValidateSources] AI assessed and filtered ${highQualitySources.length} high-quality scientific sources.`);
        return highQualitySources;

    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error in discoverAndValidateSources';
        addLog(`[discoverAndValidateSources] FATAL ERROR: ${message}`);
        throw new Error(message);
    }
};


export const generateAnalysisFromContext = async (
    query: string, 
    agentType: AgentType, 
    model: ModelDefinition,
    validatedSources: GroundingSource[],
    addLog: (msg: string) => void, 
    apiKey?: string,
    lens?: AnalysisLens,
    tolerance?: ContradictionTolerance,
): Promise<AgentResponse> => {
    addLog(`[generateAnalysis] Starting... Agent: ${agentType}, Model: ${model.name}, Query: "${query}"`);

    try {
        const { systemInstruction, userPrompt } = buildAgentPrompts(query, agentType, validatedSources, lens, tolerance);

        const response = await callGoogleAI(model.id, systemInstruction, userPrompt, false, addLog, apiKey);
        
        const jsonText = parseJsonFromText(response.text, addLog);
        const finalAgentResponse = parseAgentResponse(jsonText, agentType, addLog);
        
        addLog(`[generateAnalysis] Finished successfully.`);
        return finalAgentResponse;

    } catch (e) {
        let finalErrorMessage = 'An unknown error occurred during analysis generation.';
        if (e instanceof Error) finalErrorMessage = e.message;
        
        addLog(`[generateAnalysis] FATAL ERROR: ${finalErrorMessage}`);
        throw new Error(finalErrorMessage);
    }
};


export const chatWithWorkspace = async (
    message: string,
    workspace: WorkspaceState,
    model: ModelDefinition,
    apiKey: string | undefined,
    addLog: (msg: string) => void
): Promise<string> => {
    addLog(`[Chat] Starting chat for question: "${message}"`);
    const key = (apiKey || process.env.API_KEY)?.trim();
    if (!key) throw new Error("API Key for Google AI is not provided.");

    const { systemInstruction, userPrompt } = buildChatPrompt(message, workspace);

    try {
        const ai = new GoogleGenAI({ apiKey: key });
        const response = await ai.models.generateContent({
            model: model.id,
            contents: userPrompt,
            config: { systemInstruction },
        });

        if (!response.text) throw new Error("Chat failed: Google AI returned an empty response.");
        
        addLog(`[Chat] Received response of length ${response.text.length}.`);
        return response.text;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        addLog(`[Chat] FATAL ERROR: ${errorMessage}`);
        throw new Error(errorMessage);
    }
};
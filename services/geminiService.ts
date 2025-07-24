
import { GoogleGenAI } from "@google/genai";
import { 
    type AgentResponse, type GroundingSource, 
    type ModelDefinition, AgentType, WorkspaceState, AnalysisLens, SourceStatus,
    SearchDataSource, type SearchResult, ContradictionTolerance, ModelProvider
} from '../types';
import { buildAgentPrompts, buildChatPrompt, buildDiscoverAndValidatePrompt, buildFilterBioRxivFeedPrompt, buildRelevanceFilterPrompt } from './agentPrompts';
import { performFederatedSearch, excavatePrimarySources, isPrimarySourceDomain, enrichSearchResults, performGoogleSearch } from './searchService';

const MAX_SOURCES_FOR_ANALYSIS = 60; // A safer limit to avoid context overflows

// --- Parser functions (kept as local helpers) ---

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
        addLog(`[Parser] !!! JSON PARSE FAILED !!! For agent ${agentType}. Error: ${error}\n--- Start of Raw AI Response ---\n${jsonText}\n--- End of Raw AI Response ---`);
        const fallbackSummary = `Could not parse the AI's structured response. The raw text received was: ${jsonText}`;
        return { synthesis: fallbackSummary };
    }
};

export class ApiClient {
    private apiKey?: string;
    private addLog: (msg: string) => void;
    private checkAndIncrement: () => Promise<void>;
    private aiInstance: GoogleGenAI | null = null;

    constructor(apiKey: string | undefined, addLog: (msg: string) => void, checkAndIncrement: () => Promise<void>) {
        this.apiKey = (apiKey || process.env.API_KEY)?.trim();
        this.addLog = addLog;
        this.checkAndIncrement = checkAndIncrement;
        this.initializeAI();
    }
    
    private initializeAI() {
        if (this.apiKey) {
            this.aiInstance = new GoogleGenAI({ apiKey: this.apiKey });
            this.addLog("[ApiClient] Gemini API Client initialized.");
        } else {
             this.addLog("[ApiClient] WARN: Gemini API Client not initialized due to missing API key.");
        }
    }

    public updateApiKey(apiKey?: string) {
        this.apiKey = (apiKey || process.env.API_KEY)?.trim();
        this.initializeAI();
    }

    private async callOllamaAPI(model: string, systemInstruction: string, userPrompt: string, isJson: boolean): Promise<string> {
        const OLLAMA_BASE_URL = 'http://localhost:11434/api/generate';
        this.addLog(`[Ollama] Calling model '${model}'...`);
        const fullPrompt = `${systemInstruction}\n\n${userPrompt}`; // Ollama doesn't have a separate system prompt API
        
        try {
            const response = await fetch(OLLAMA_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt: fullPrompt,
                    stream: false,
                    ...(isJson && { format: 'json' }),
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Ollama API request failed with status ${response.status}: ${errorBody}`);
            }

            const data = await response.json();
            if (!data.response) throw new Error("Ollama response was empty.");
            
            this.addLog(`[Ollama] Received response from '${model}'.`);
            return data.response;

        } catch (error) {
            this.addLog(`[Ollama] ERROR: Failed to connect to Ollama server. ${error}`);
            const friendlyError = "Failed to connect to the local Ollama server. Please ensure it's running at http://localhost:11434 and that the required model is downloaded (e.g., `ollama pull gemma`).";
            throw new Error(friendlyError);
        }
    }

    private async callGoogleAI(model: string, systemInstruction: string, userPrompt: string, useSearch: boolean) {
        if (!this.aiInstance) {
            this.addLog(`[GoogleAI] ERROR: API_KEY is not set.`);
            throw new Error("API Key for Google AI is not provided. Please enter your key in the settings panel.");
        }

        await this.checkAndIncrement();
        
        this.addLog(`[GoogleAI] Calling model '${model}'...`);
        const response = await this.aiInstance.models.generateContent({
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
            this.addLog(`[GoogleAI] ERROR: ${errorMessage}`);
            throw new Error(errorMessage);
        }
        
        this.addLog(`[GoogleAI] Received valid response.`);
        return response;
    }

    private async filterBioRxivFeedWithAI(query: string, feedItems: SearchResult[], model: ModelDefinition): Promise<SearchResult[]> {
        if (feedItems.length === 0) return [];
        this.addLog(`[BioRxivFeedFilter] Asking AI to filter ${feedItems.length} raw feed items for relevance to "${query}"...`);
        
        try {
            const { systemInstruction, userPrompt } = buildFilterBioRxivFeedPrompt(query, feedItems);
            const response = await this.callGoogleAI(model.id, systemInstruction, userPrompt, false);
            const jsonText = parseJsonFromText(response.text, this.addLog);
            const data = JSON.parse(jsonText);

            if (!data.relevantArticleUrls || !Array.isArray(data.relevantArticleUrls)) {
                this.addLog(`[BioRxivFeedFilter] WARN: AI filter did not return a valid 'relevantArticleUrls' array. Discarding all feed items.`);
                return [];
            }

            const relevantUrls = new Set(data.relevantArticleUrls as string[]);
            const relevantItems = feedItems.filter(item => relevantUrls.has(item.link));

            this.addLog(`[BioRxivFeedFilter] AI identified ${relevantItems.length} relevant items from the feed.`);
            return relevantItems;

        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error during AI feed filtering';
            this.addLog(`[BioRxivFeedFilter] ERROR: ${message}. Discarding all feed items.`);
            return [];
        }
    };

    public async discoverAndValidateSources(
        query: string,
        model: ModelDefinition,
        setLoadingMessage: (message: string) => void,
        enabledSources: SearchDataSource[]
    ): Promise<GroundingSource[]> {
        this.addLog(`[discoverAndValidateSources] Starting with enabled sources: ${enabledSources.join(', ')}`);

        if (model.provider === ModelProvider.Ollama) {
            setLoadingMessage("Step 1/3: Searching for context...");
            this.addLog('[discoverAndValidateSources] Ollama model detected. Performing federated search.');
            const searchResults = await performFederatedSearch(query, enabledSources, this.addLog);
            const uniqueSearchResults = Array.from(new Map(searchResults.map(item => [item.link, item])).values());
            
            if (uniqueSearchResults.length === 0) {
              throw new Error("Federated search returned no results for the topic.");
            }

            setLoadingMessage("Step 2/3: Filtering relevant sources...");
            this.addLog(`[discoverAndValidateSources] Asking Ollama to filter ${uniqueSearchResults.length} results for relevance.`);
            const { systemInstruction, userPrompt } = buildRelevanceFilterPrompt(query, uniqueSearchResults);
            
            let relevantResults: SearchResult[];
            try {
                const responseText = await this.callOllamaAPI(model.id, systemInstruction, userPrompt, true);
                const jsonText = parseJsonFromText(responseText, this.addLog);
                const parsed = JSON.parse(jsonText);
                const relevantUrls = new Set(parsed.relevantArticleUrls as string[]);
                relevantResults = uniqueSearchResults.filter(res => relevantUrls.has(res.link));
                this.addLog(`[discoverAndValidateSources] Ollama filtered down to ${relevantResults.length} relevant sources.`);
            } catch (e) {
                this.addLog(`[discoverAndValidateSources] WARN: Ollama relevance filtering failed. Proceeding with all ${uniqueSearchResults.length} sources. Error: ${e}`);
                relevantResults = uniqueSearchResults;
            }
            
            if (relevantResults.length === 0) {
              throw new Error("Ollama model filtered out all search results as irrelevant.");
            }

            setLoadingMessage("Step 3/3: Excavating primary sources...");
            const enrichedResults = await enrichSearchResults(relevantResults, this.addLog);
            const directPrimaryResults = enrichedResults.filter(res => isPrimarySourceDomain(res.link));
            const secondaryResults = enrichedResults.filter(res => !isPrimarySourceDomain(res.link));
            const excavatedResults = await excavatePrimarySources(secondaryResults, this.addLog);
            
            const finalPrimaryResults = Array.from(new Map([...directPrimaryResults, ...excavatedResults].map(item => [item.link, item])).values());
    
            if (finalPrimaryResults.length === 0) {
                throw new Error("Could not find any primary scientific sources for the topic after filtering and excavation.");
            }
            
            const limitedResults = finalPrimaryResults.slice(0, MAX_SOURCES_FOR_ANALYSIS);
            if(finalPrimaryResults.length > MAX_SOURCES_FOR_ANALYSIS) {
                this.addLog(`[discoverAndValidateSources] Limiting sources for Ollama context from ${finalPrimaryResults.length} to ${MAX_SOURCES_FOR_ANALYSIS}.`);
            }
    
            const groundingSources: GroundingSource[] = limitedResults.map(res => ({
                uri: res.link,
                title: res.title,
                status: 'unverified', // Ollama path doesn't do deep validation
                origin: res.source,
                content: res.snippet,
                reliability: 0.5, // Assign a neutral reliability for Ollama path
                reliabilityJustification: "Source relevance assessed by local AI; reliability not deeply analyzed."
            }));
    
            this.addLog(`[discoverAndValidateSources] Found ${groundingSources.length} sources for Ollama context.`);
            return groundingSources;
        }

        // --- Google AI Path ---
        setLoadingMessage("Step 1/4: Searching databases & web...");
        
        const specialistSearchSources = enabledSources.filter(s => s !== SearchDataSource.GoogleSearch);
        const useGoogleSearch = enabledSources.includes(SearchDataSource.GoogleSearch);
        
        this.addLog(`[discoverAndValidateSources] Starting concurrent searches...`);
        const searchPromises = [];
        if (specialistSearchSources.length > 0) {
            searchPromises.push(performFederatedSearch(query, specialistSearchSources, this.addLog));
        }
        if (useGoogleSearch) {
            searchPromises.push(performGoogleSearch(query, this.addLog, async () => {
                const systemInstruction = "You are a helpful research assistant.";
                const userPrompt = `Find the most relevant and reliable scientific sources about "${query}"`;
                return this.callGoogleAI(model.id, systemInstruction, userPrompt, true);
            }));
        }

        const results = await Promise.allSettled(searchPromises);

        let allSearchResults: SearchResult[] = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                allSearchResults.push(...result.value);
            } else if (result.status === 'rejected') {
                this.addLog(`[discoverAndValidateSources] WARN: A search provider failed: ${result.reason}`);
            }
        });
        
        // AI-powered filtering for the BioRxiv Feed
        const rawFeedResults = allSearchResults.filter(r => r.source === SearchDataSource.BioRxivFeed);
        if (rawFeedResults.length > 0) {
            const filteredFeedResults = await this.filterBioRxivFeedWithAI(query, rawFeedResults, model);
            // Replace raw feed results with AI-filtered results
            allSearchResults = allSearchResults.filter(r => r.source !== SearchDataSource.BioRxivFeed);
            allSearchResults.push(...filteredFeedResults);
        }

        const uniqueSearchResults = Array.from(new Map(allSearchResults.map(item => [item.link, item])).values());
        this.addLog(`[discoverAndValidateSources] Found ${uniqueSearchResults.length} total unique potential sources.`);

        if (uniqueSearchResults.length === 0) {
            this.addLog("[discoverAndValidateSources] All searches returned no results.");
            return [];
        }
        
        setLoadingMessage("Step 2/4: Enriching source metadata...");
        const enrichedResults = await enrichSearchResults(uniqueSearchResults, this.addLog);

        setLoadingMessage("Step 3/4: Excavating primary links...");
        const directPrimaryResults = enrichedResults.filter(res => isPrimarySourceDomain(res.link));
        const secondaryResults = enrichedResults.filter(res => !isPrimarySourceDomain(res.link));
        this.addLog(`[discoverAndValidateSources] Triage: ${directPrimaryResults.length} direct primary sources, ${secondaryResults.length} secondary to excavate.`);
        
        const excavatedResults = await excavatePrimarySources(secondaryResults, this.addLog);

        const finalPrimaryResults = Array.from(new Map([...directPrimaryResults, ...excavatedResults].map(item => [item.link, item])).values());
        
        if (finalPrimaryResults.length === 0) {
            this.addLog("[discoverAndValidateSources] No primary sources found after enrichment and excavation.");
            throw new Error("Could not find any primary scientific sources for the topic.");
        }
        this.addLog(`[discoverAndValidateSources] Total primary sources for assessment: ${finalPrimaryResults.length}.`);

        setLoadingMessage("Step 4/4: AI assessing source reliability...");
        this.addLog(`[discoverAndValidateSources] Sending ${finalPrimaryResults.length} curated primary sources to AI for assessment.`);
        const { systemInstruction, userPrompt } = buildDiscoverAndValidatePrompt(query, finalPrimaryResults);

        try {
            const response = await this.callGoogleAI(model.id, systemInstruction, userPrompt, false);
            const jsonText = parseJsonFromText(response.text, this.addLog);
            const data = JSON.parse(jsonText);

            if (!data.sources || !Array.isArray(data.sources)) {
                this.addLog(`[discoverAndValidateSources] ERROR: AI validator did not return a valid 'sources' array.`);
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
                this.addLog(`[discoverAndValidateSources] Discarding ${lowQualityCount} sources with reliability below ${RELIABILITY_THRESHOLD}.`);
            }

            const sortedSources = highQualitySources.sort((a, b) => (b.reliability ?? 0) - (a.reliability ?? 0));
            const limitedSources = sortedSources.slice(0, MAX_SOURCES_FOR_ANALYSIS);

            if (sortedSources.length > MAX_SOURCES_FOR_ANALYSIS) {
                const lastReliability = limitedSources.length > 0 ? limitedSources[limitedSources.length - 1].reliability?.toFixed(2) : 'N/A';
                this.addLog(`[discoverAndValidateSources] Limiting sources for Gemini analysis from ${sortedSources.length} to ${MAX_SOURCES_FOR_ANALYSIS}. Discarding sources with reliability < ${lastReliability}.`);
            }
            
            this.addLog(`[discoverAndValidateSources] AI assessed and filtered ${limitedSources.length} high-quality scientific sources.`);
            return limitedSources;

        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error in discoverAndValidateSources';
            this.addLog(`[discoverAndValidateSources] FATAL ERROR: ${message}`);
            throw new Error(message);
        }
    };

    public async generateAnalysisFromContext(
        query: string, 
        agentType: AgentType, 
        model: ModelDefinition,
        validatedSources: GroundingSource[],
        lens?: AnalysisLens,
        tolerance?: ContradictionTolerance,
    ): Promise<AgentResponse> {
        this.addLog(`[generateAnalysis] Starting... Agent: ${agentType}, Model: ${model.name}, Query: "${query}"`);

        try {
            const { systemInstruction, userPrompt } = buildAgentPrompts(query, agentType, validatedSources, lens, tolerance);
            let jsonText: string;

            if (model.provider === ModelProvider.Ollama) {
                const responseText = await this.callOllamaAPI(model.id, systemInstruction, userPrompt, true);
                jsonText = parseJsonFromText(responseText, this.addLog);
            } else { // Google AI
                const response = await this.callGoogleAI(model.id, systemInstruction, userPrompt, false);
                jsonText = parseJsonFromText(response.text, this.addLog);
            }
            
            const finalAgentResponse = parseAgentResponse(jsonText, agentType, this.addLog);
            
            this.addLog(`[generateAnalysis] Finished successfully.`);
            return finalAgentResponse;

        } catch (e) {
            let finalErrorMessage = 'An unknown error occurred during analysis generation.';
            if (e instanceof Error) finalErrorMessage = e.message;
            
            this.addLog(`[generateAnalysis] FATAL ERROR: ${finalErrorMessage}`);
            throw new Error(finalErrorMessage);
        }
    };

    public async chatWithWorkspace(
        message: string,
        workspace: WorkspaceState,
        model: ModelDefinition,
    ): Promise<string> {
        this.addLog(`[Chat] Starting chat for question: "${message}"`);
        const { systemInstruction, userPrompt } = buildChatPrompt(message, workspace);

        try {
            if (model.provider === ModelProvider.Ollama) {
                return await this.callOllamaAPI(model.id, systemInstruction, userPrompt, false);
            }
            
            // Google AI Path
            if (!this.aiInstance) throw new Error("API Client not initialized.");
            
            await this.checkAndIncrement();
            this.addLog(`[GoogleAI] Calling model '${model.id}' for chat...`);
            
            const response = await this.aiInstance.models.generateContent({
                model: model.id,
                contents: userPrompt,
                config: { systemInstruction },
            });

            if (!response.text) throw new Error("Chat failed: Google AI returned an empty response.");
            
            this.addLog(`[Chat] Received response of length ${response.text.length}.`);
            return response.text;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            this.addLog(`[Chat] FATAL ERROR: ${errorMessage}`);
            throw new Error(errorMessage);
        }
    };
}


import { GoogleGenAI } from "@google/genai";
import { 
    type AgentResponse, type GroundingSource, 
    type ModelDefinition, AgentType, WorkspaceState, AnalysisLens, SourceStatus,
    SearchDataSource, type SearchResult, ContradictionTolerance, ModelProvider
} from '../types';
import { buildAgentPrompts, buildChatPrompt, buildDiscoverAndValidatePrompt, buildFilterBioRxivFeedPrompt, buildQueryEnhancementPrompt, buildRelevanceFilterPrompt } from './agentPrompts';
import { performFederatedSearch, isPrimarySourceDomain, performGoogleSearch, enrichSources } from './searchService';

const MAX_SOURCES_FOR_ANALYSIS = 40; // A safer limit to avoid context overflows

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
        if (data.marketInnovationAnalysis) response.marketInnovationAnalysis = data.marketInnovationAnalysis;
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
    
    private openAIBaseUrl?: string;
    private openAIModelName?: string;
    private openAIApiKey?: string;

    constructor(
        apiKey: string | undefined, 
        addLog: (msg: string) => void, 
        checkAndIncrement: () => Promise<void>,
        openAISettings: { baseUrl?: string, modelName?: string, apiKey?: string }
    ) {
        this.apiKey = (apiKey || process.env.API_KEY)?.trim();
        this.addLog = addLog;
        this.checkAndIncrement = checkAndIncrement;
        this.initializeAI();
        
        this.openAIBaseUrl = openAISettings.baseUrl;
        this.openAIModelName = openAISettings.modelName;
        this.openAIApiKey = openAISettings.apiKey;
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

    private async callOpenAICompatibleAPI(systemInstruction: string, userPrompt: string, isJson: boolean): Promise<string> {
        if (!this.openAIBaseUrl || !this.openAIModelName) {
            throw new Error("OpenAI-compatible API Base URL or Model Name is not configured.");
        }
        
        const endpoint = `${this.openAIBaseUrl.replace(/\/$/, '')}/chat/completions`;
        this.addLog(`[OpenAI_API] Calling model '${this.openAIModelName}' at '${endpoint}'...`);
    
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };
        if (this.openAIApiKey) {
            headers['Authorization'] = `Bearer ${this.openAIApiKey}`;
        }
    
        const body = {
            model: this.openAIModelName,
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userPrompt }
            ],
            stream: false,
            ...(isJson && { response_format: { type: 'json_object' } })
        };
    
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
    
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`OpenAI-compatible API request failed with status ${response.status}: ${errorBody}`);
            }
    
            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;
    
            if (!content) {
                throw new Error("OpenAI-compatible API response was empty or in an unexpected format.");
            }
            
            this.addLog(`[OpenAI_API] Received response from '${this.openAIModelName}'.`);
            return content;
    
        } catch (error) {
            this.addLog(`[OpenAI_API] ERROR: Failed to connect to the server. ${error}`);
            const friendlyError = `Failed to connect to the OpenAI-compatible server at ${this.openAIBaseUrl}. Please ensure it's running and the settings are correct.`;
            throw new Error(friendlyError);
        }
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

    public async enhanceQuery(rawQuery: string, model: ModelDefinition): Promise<string> {
        this.addLog(`[enhanceQuery] Starting for query: "${rawQuery}"`);
        try {
            const { systemInstruction, userPrompt } = buildQueryEnhancementPrompt(rawQuery);
            let responseText: string;

            if (model.provider === ModelProvider.Ollama || model.provider === ModelProvider.OpenAI_API) {
                responseText = model.provider === ModelProvider.Ollama
                    ? await this.callOllamaAPI(model.id, systemInstruction, userPrompt, true)
                    : await this.callOpenAICompatibleAPI(systemInstruction, userPrompt, true);
            } else { // Google AI
                const response = await this.callGoogleAI(model.id, systemInstruction, userPrompt, false);
                responseText = response.text;
            }

            const jsonText = parseJsonFromText(responseText, this.addLog);
            const data = JSON.parse(jsonText);

            if (data.enhancedQuery && typeof data.enhancedQuery === 'string') {
                return data.enhancedQuery;
            } else {
                throw new Error("AI response did not contain a valid 'enhancedQuery' string.");
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error during query enhancement';
            this.addLog(`[enhanceQuery] ERROR: ${message}. Returning original query.`);
            return rawQuery;
        }
    }

    private async filterBioRxivFeedWithAI(query: string, feedItems: SearchResult[], model: ModelDefinition, limit: number): Promise<SearchResult[]> {
        if (feedItems.length === 0) return [];
        this.addLog(`[BioRxivFeedFilter] Asking AI to filter ${feedItems.length} raw feed items for relevance to "${query}"...`);
        
        try {
            const { systemInstruction, userPrompt } = buildFilterBioRxivFeedPrompt(query, feedItems, limit);
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
    
    private async filterResultsWithLocalAI(
        query: string,
        resultsToFilter: SearchResult[],
        model: ModelDefinition,
        providerName: 'Ollama' | 'OpenAI_API'
    ): Promise<SearchResult[]> {
        if (resultsToFilter.length === 0) return [];
        
        const { systemInstruction, userPrompt } = buildRelevanceFilterPrompt(query, resultsToFilter);
        
        try {
            const responseText = model.provider === ModelProvider.OpenAI_API
                ? await this.callOpenAICompatibleAPI(systemInstruction, userPrompt, true)
                : await this.callOllamaAPI(model.id, systemInstruction, userPrompt, true);
    
            this.addLog(`[${providerName}] Raw relevance filter response: ${responseText}`);
            const jsonText = parseJsonFromText(responseText, this.addLog);
            const parsed = JSON.parse(jsonText);
            
            let indices: number[] = [];
    
            if (parsed.relevantArticleIndices && Array.isArray(parsed.relevantArticleIndices)) {
                this.addLog(`[${providerName}] Found "relevantArticleIndices" key in response.`);
                indices = parsed.relevantArticleIndices.filter((i: any) => typeof i === 'number');
            } else if (parsed.articles && Array.isArray(parsed.articles)) {
                this.addLog(`[${providerName}] WARN: "relevantArticleIndices" not found. Falling back to "articles" key.`);
                
                const urlToIndexMap = new Map<string, number>();
                resultsToFilter.forEach((res, i) => {
                    urlToIndexMap.set(res.link, i + 1); // Use 1-based index from the prompt
                });
    
                const returnedUrls = parsed.articles
                    .map((article: any) => article.url)
                    .filter((url: any) => typeof url === 'string');
    
                this.addLog(`[${providerName}] AI returned ${returnedUrls.length} articles by URL. Attempting to match them to original indices.`);
    
                indices = returnedUrls
                    .map((url: string) => {
                        const index = urlToIndexMap.get(url);
                        if (index === undefined) {
                            this.addLog(`[${providerName}] WARN: AI returned a URL not present in the original list: ${url}`);
                        }
                        return index;
                    })
                    .filter((index): index is number => index !== undefined);
            } else if (parsed.data?.results && Array.isArray(parsed.data.results)) {
                this.addLog(`[${providerName}] WARN: "relevantArticleIndices" not found. Falling back to "data.results" key (Qwen model pattern).`);
    
                const titleToIndexMap = new Map<string, number>();
                resultsToFilter.forEach((res, i) => {
                    titleToIndexMap.set(res.title.toLowerCase().trim(), i + 1); // Use 1-based index from prompt
                });
    
                const returnedTitles = parsed.data.results
                    .map((article: any) => article.title)
                    .filter((title: any) => typeof title === 'string');
    
                this.addLog(`[${providerName}] AI returned ${returnedTitles.length} articles by title. Attempting to match them to original indices.`);
    
                indices = returnedTitles
                    .map((title: string) => {
                        const index = titleToIndexMap.get(title.toLowerCase().trim());
                        if (index === undefined) {
                            this.addLog(`[${providerName}] WARN: AI returned a title not present in the original list: ${title}`);
                        }
                        return index;
                    })
                    .filter((index): index is number => index !== undefined);
            } else {
                 this.addLog(`[${providerName}] WARN: Could not find "relevantArticleIndices", "articles", or other known fallback keys in AI response.`);
            }
    
            if (indices.length > 0) {
                 const relevantResults = indices
                    .map(index => {
                        const res = resultsToFilter[index - 1]; // 1-based index from prompt
                        if (!res) {
                            this.addLog(`[filterResultsWithLocalAI] WARN: AI returned an out-of-bounds index: ${index}`);
                        }
                        return res;
                    })
                    .filter((res): res is SearchResult => !!res);
                 return relevantResults;
            } else {
                 this.addLog(`[filterResultsWithLocalAI] WARN: AI did not return any valid indices for this batch.`);
                 return [];
            }
        } catch (e) {
            this.addLog(`[filterResultsWithLocalAI] WARN: ${providerName} relevance filtering for this batch failed. Error: ${e}`);
            return []; // Return empty on error to not pollute results
        }
    }

    public async discoverAndValidateSources(
        query: string,
        model: ModelDefinition,
        setLoadingMessage: (message: string) => void,
        dataSourceLimits: Record<SearchDataSource, number>
    ): Promise<GroundingSource[]> {
        this.addLog(`[discoverAndValidateSources] Starting with data source limits: ${JSON.stringify(dataSourceLimits)}`);

        if (model.provider === ModelProvider.Ollama || model.provider === ModelProvider.OpenAI_API) {
            setLoadingMessage("Step 1/3: Searching for context...");
            const providerName = model.provider === ModelProvider.Ollama ? 'Ollama' : 'OpenAI_API';
            this.addLog(`[discoverAndValidateSources] ${providerName} model detected. Using federated search.`);
            
            // Step 1: Federated Search
            const searchResults = await performFederatedSearch(query, dataSourceLimits, this.addLog, true);
            const uniqueSearchResults = Array.from(new Map(searchResults.map(item => [item.link, item])).values());
            
            if (uniqueSearchResults.length === 0) {
              throw new Error("Federated search returned no results for the topic.");
            }
            
            // Step 2: Separate Primary and Secondary sources
            const primaryResults = uniqueSearchResults.filter(res => isPrimarySourceDomain(res.link));
            const secondaryResults = uniqueSearchResults.filter(res => !isPrimarySourceDomain(res.link));
            this.addLog(`[discoverAndValidateSources] Separated sources: ${primaryResults.length} primary, ${secondaryResults.length} secondary.`);

            setLoadingMessage("Step 2/3: AI filtering relevant sources...");
            let relevantResults: SearchResult[] = [];

            // Step 3: Prioritize and filter Primary sources
            if (primaryResults.length > 0) {
                const primaryToFilter = primaryResults.slice(0, MAX_SOURCES_FOR_ANALYSIS);
                this.addLog(`[discoverAndValidateSources] Asking ${providerName} to filter ${primaryToFilter.length} primary results for relevance.`);
                const relevantPrimary = await this.filterResultsWithLocalAI(query, primaryToFilter, model, providerName);
                this.addLog(`[discoverAndValidateSources] ${providerName} filtered down to ${relevantPrimary.length} relevant primary sources.`);
                relevantResults.push(...relevantPrimary);
            }
        
            // Step 4: If needed, filter Secondary sources
            const remainingCapacity = MAX_SOURCES_FOR_ANALYSIS - relevantResults.length;
            if (remainingCapacity > 0 && secondaryResults.length > 0) {
                if (relevantResults.length === 0) {
                     this.addLog(`[discoverAndValidateSources] No relevant primary sources found. Asking ${providerName} to filter secondary results.`);
                } else {
                     this.addLog(`[discoverAndValidateSources] Supplementing with secondary sources. Asking ${providerName} to filter secondary results.`);
                }
                
                const secondaryToFilter = secondaryResults.slice(0, remainingCapacity);
                const relevantSecondary = await this.filterResultsWithLocalAI(query, secondaryToFilter, model, providerName);
                this.addLog(`[discoverAndValidateSources] ${providerName} filtered down to ${relevantSecondary.length} relevant secondary sources.`);
                relevantResults.push(...relevantSecondary);
            }
            
            if (relevantResults.length === 0) {
              throw new Error(`The ${providerName} model filtered out all search results as irrelevant.`);
            }

            // Step 5: Enrich and finalize
            setLoadingMessage("Step 3/3: Enriching relevant sources...");
            const enrichedResults = await enrichSources(relevantResults, this.addLog);

            if (enrichedResults.length === 0) {
                throw new Error("Could not find or enrich any sources for the topic after AI filtering.");
            }

            const limitedResults = enrichedResults.slice(0, MAX_SOURCES_FOR_ANALYSIS);
            if(enrichedResults.length > MAX_SOURCES_FOR_ANALYSIS) {
                this.addLog(`[discoverAndValidateSources] Limiting total sources for ${providerName} context from ${enrichedResults.length} to ${MAX_SOURCES_FOR_ANALYSIS}.`);
            }

            const groundingSources: GroundingSource[] = limitedResults.map(res => {
                const isPrimary = isPrimarySourceDomain(res.link);
                return {
                    uri: res.link,
                    title: res.title,
                    status: 'unverified',
                    origin: res.source,
                    content: res.snippet,
                    reliability: isPrimary ? 0.6 : 0.2, // Assign different base reliability
                    reliabilityJustification: isPrimary 
                        ? "Source relevance assessed by local AI from a primary scientific domain."
                        : "This is not from a primary scientific source and should be treated with caution. Relevance assessed by local AI."
                };
            });
    
            this.addLog(`[discoverAndValidateSources] Found ${groundingSources.length} total relevant sources for ${providerName} context.`);
            return groundingSources;
        }

        // --- Google AI Path ---
        setLoadingMessage("Step 1/3: Searching databases & web...");
        
        const googleSearchLimit = dataSourceLimits[SearchDataSource.GoogleSearch] || 0;
        const useGoogleSearch = googleSearchLimit > 0;

        const specialistSearchLimits: Partial<Record<SearchDataSource, number>> = {};
        for (const key in dataSourceLimits) {
            const source = key as SearchDataSource;
            if (source !== SearchDataSource.GoogleSearch && dataSourceLimits[source] > 0) {
                specialistSearchLimits[source] = dataSourceLimits[source];
            }
        }
        
        this.addLog(`[discoverAndValidateSources] Starting concurrent searches...`);
        const searchPromises = [];
        if (Object.keys(specialistSearchLimits).length > 0) {
            searchPromises.push(performFederatedSearch(query, specialistSearchLimits, this.addLog, false));
        }
        if (useGoogleSearch) {
            searchPromises.push(performGoogleSearch(query, this.addLog, async () => {
                const systemInstruction = "You are a helpful research assistant.";
                const userPrompt = `Find the most relevant and reliable scientific sources about "${query}"`;
                return this.callGoogleAI(model.id, systemInstruction, userPrompt, true);
            }, googleSearchLimit));
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
            const bioRxivLimit = dataSourceLimits[SearchDataSource.BioRxivFeed] || 5;
            this.addLog(`[BioRxivFeedFilter] AI will select the top ${bioRxivLimit} most relevant items from the full feed.`);
            const filteredFeedResults = await this.filterBioRxivFeedWithAI(query, rawFeedResults, model, bioRxivLimit);
            // Replace raw feed results with AI-filtered results
            allSearchResults = allSearchResults.filter(r => r.source !== SearchDataSource.BioRxivFeed);
            allSearchResults.push(...filteredFeedResults);
        }

        // Deterministic de-duplication that prioritizes GoogleSearch as the origin for any link.
        // This ensures data provenance is accurately reflected if Google finds a link also found by another source.
        const uniqueSearchResultsMap = new Map<string, SearchResult>();
        for (const item of allSearchResults) {
            const existing = uniqueSearchResultsMap.get(item.link);
            // If no entry exists, add it.
            // If an entry exists, but the new one is from Google Search, overwrite it.
            // This ensures Google Search is the final attributed source.
            if (!existing || item.source === SearchDataSource.GoogleSearch) {
                uniqueSearchResultsMap.set(item.link, item);
            }
        }
        const uniqueSearchResults = Array.from(uniqueSearchResultsMap.values());
        
        this.addLog(`[discoverAndValidateSources] Found ${uniqueSearchResults.length} total unique potential sources after de-duplication.`);

        if (uniqueSearchResults.length === 0) {
            this.addLog("[discoverAndValidateSources] All searches returned no results.");
            return [];
        }
        
        this.addLog(`[discoverAndValidateSources] Filtering for primary scientific domains...`);
        const finalPrimaryResults = uniqueSearchResults.filter(res => isPrimarySourceDomain(res.link));
        this.addLog(`[discoverAndValidateSources] Identified ${finalPrimaryResults.length} potential primary sources from search results.`);

        if (finalPrimaryResults.length === 0) {
            this.addLog("[discoverAndValidateSources] No primary sources found after filtering for known scientific domains.");
            throw new Error("Could not find any primary scientific sources for the topic from the enabled search providers.");
        }
        
        setLoadingMessage("Step 2/3: Enriching primary source content...");
        const enrichedPrimaryResults = await enrichSources(finalPrimaryResults, this.addLog);
        this.addLog(`[discoverAndValidateSources] Finished enriching sources. Total primary sources for assessment: ${enrichedPrimaryResults.length}.`);

        setLoadingMessage("Step 3/3: AI assessing source reliability...");
        this.addLog(`[discoverAndValidateSources] Sending ${enrichedPrimaryResults.length} curated primary sources to AI for assessment.`);
        const { systemInstruction, userPrompt } = buildDiscoverAndValidatePrompt(query, enrichedPrimaryResults);

        try {
            const response = await this.callGoogleAI(model.id, systemInstruction, userPrompt, false);
            const jsonText = parseJsonFromText(response.text, this.addLog);
            const data = JSON.parse(jsonText);

            if (!data.sources || !Array.isArray(data.sources)) {
                this.addLog(`[discoverAndValidateSources] ERROR: AI validator did not return a valid 'sources' array.`);
                return [];
            }

            const finalPrimaryResultsMap = new Map(enrichedPrimaryResults.map(res => [res.link, res]));

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
        agentType: AgentType, 
        model: ModelDefinition,
        workspaceState: WorkspaceState,
        lens?: AnalysisLens,
        tolerance?: ContradictionTolerance,
    ): Promise<AgentResponse> {
        this.addLog(`[generateAnalysis] Starting... Agent: ${agentType}, Model: ${model.name}, Query: "${workspaceState.topic}"`);

        try {
            const { systemInstruction, userPrompt } = buildAgentPrompts(agentType, workspaceState, lens, tolerance);
            let jsonText: string;

            if (model.provider === ModelProvider.Ollama || model.provider === ModelProvider.OpenAI_API) {
                const responseText = model.provider === ModelProvider.Ollama
                    ? await this.callOllamaAPI(model.id, systemInstruction, userPrompt, true)
                    : await this.callOpenAICompatibleAPI(systemInstruction, userPrompt, true);
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
            if (model.provider === ModelProvider.Ollama || model.provider === ModelProvider.OpenAI_API) {
                return model.provider === ModelProvider.Ollama
                    ? await this.callOllamaAPI(model.id, systemInstruction, userPrompt, false)
                    : await this.callOpenAICompatibleAPI(systemInstruction, userPrompt, false);
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

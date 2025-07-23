




import { GoogleGenAI, Type } from "@google/genai";
import { 
    type AgentResponse, type GroundingSource, 
    type ModelDefinition, AgentType, WorkspaceState, ResearchOpportunity, AnalysisLens
} from '../types';
import { buildAgentPrompts, buildChatPrompt } from './agentPrompts';

// --- Parser functions ---

const parseJsonFromText = (text: string, addLog: (msg: string) => void): string => {
    let cleanedText = text;
    
    const jsonMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        addLog('[Parser] Extracted JSON from markdown code block.');
        return jsonMatch[1];
    }
    
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        addLog('[Parser] Extracted JSON by finding curly braces.');
        return cleanedText.substring(firstBrace, lastBrace + 1);
    }
    
    addLog(`[Parser] WARN: Could not find any JSON-like structures in the response. Using raw text, which will likely fail parsing.`);
    return cleanedText;
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
        if (data.trendAnalysis) {
            response.trendAnalysis = data.trendAnalysis;
        }
        if (data.contradictions) {
            response.contradictions = data.contradictions.map((c: any, index: number) => ({
                id: `con-${index}-${Math.random()}`,
                statement: c.statement,
            }));
        }
        if (data.synergies) {
            response.synergies = data.synergies.map((s: any, index: number) => ({
                id: `syn-${index}-${Math.random()}`,
                statement: s.statement,
            }));
        }
        if (data.sources) {
            response.sources = data.sources.map((s: any) => ({
                uri: s.uri,
                title: s.title || s.uri,
            }));
        }
        
        return response;

    } catch (error) {
        addLog(`[Parser] ERROR: Error parsing response for ${agentType}: ${error}\nRaw text: ${jsonText}`);
        const fallbackSummary = `Could not parse the AI's structured response. The raw text received was: ${jsonText}`;
        return { synthesis: fallbackSummary };
    }
};

// --- Main Service Functions ---

export const dispatchAgent = async (
    query: string, 
    agentType: AgentType, 
    model: ModelDefinition, 
    addLog: (msg: string) => void, 
    apiKey?: string,
    setProgress?: (msg: string) => void,
    lens?: AnalysisLens
): Promise<AgentResponse> => {
    
    addLog(`[dispatchAgent] Starting... Agent: ${agentType}, Model: ${model.name}, Query: "${query}"`);

    try {
        let sourcesFromGrounding: GroundingSource[] = [];
        let { systemInstruction, userPrompt } = buildAgentPrompts(query, agentType, lens);

        addLog(`[GoogleAI] Using Google AI model '${model.id}'...`);
        if (setProgress) setProgress('Querying Google AI with Search grounding...');
        
        const key = (apiKey || process.env.API_KEY)?.trim();
        if (!key) {
            addLog(`[GoogleAI] ERROR: API_KEY is not set.`);
            throw new Error("API Key for Google AI is not provided. Please enter your key in the settings panel.");
        }
        
        const ai = new GoogleGenAI({ apiKey: key });
        addLog(`[GoogleAI] Calling model '${model.id}'...`);
        
        const response = await ai.models.generateContent({
            model: model.id,
            contents: userPrompt,
            config: {
                systemInstruction,
                tools: [{ googleSearch: {} }],
            },
        });
        
        if (!response || !response.text || typeof response.text !== 'string' || response.text.trim() === '') {
            const candidate = response?.candidates?.[0];
            const finishReason = candidate?.finishReason;
            const safetyRatings = candidate?.safetyRatings;
            let errorMessage = `Google AI response was empty or invalid. Finish Reason: ${finishReason || 'N/A'}.`;

            if (finishReason === 'SAFETY') {
                errorMessage = `The response was blocked due to safety concerns. Please modify your query. Safety Ratings: ${JSON.stringify(safetyRatings, null, 2)}`;
            }
            
            addLog(`[GoogleAI] ERROR: ${errorMessage}`);
            addLog(`[GoogleAI] Full response object: ${JSON.stringify(response, null, 2)}`);
            throw new Error(errorMessage);
        }

        const rawText = response.text;
        addLog(`[GoogleAI] Received valid response. Length: ${rawText.length}. Attempting to parse JSON.`);
        const jsonText = parseJsonFromText(rawText, addLog);
        
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
            const webSources: GroundingSource[] = groundingMetadata.groundingChunks
                .map(chunk => chunk.web)
                .filter((web): web is { uri: string; title?: string } => !!web?.uri)
                .map(web => ({
                    uri: web.uri,
                    title: web.title || web.uri,
                }));
            sourcesFromGrounding.push(...webSources);
            addLog(`[GoogleAI] Extracted ${webSources.length} web sources from grounding metadata.`);
        }

        const finalAgentResponse = parseAgentResponse(jsonText, agentType, addLog);
        
        // Merge sources from agent response and grounding metadata, then de-duplicate
        const sourcesFromAgent = finalAgentResponse.sources || [];
        const combinedSources = [...sourcesFromAgent, ...sourcesFromGrounding];
        
        const seenUris = new Set<string>();
        const uniqueSources = combinedSources.filter(source => {
            if (source.uri && !seenUris.has(source.uri)) {
                seenUris.add(source.uri);
                return true;
            }
            return false;
        });

        finalAgentResponse.sources = uniqueSources;
        addLog(`[dispatchAgent] Finished successfully with ${uniqueSources.length} unique sources.`);
        return finalAgentResponse;

    } catch (e) {
        let finalErrorMessage = 'An unknown error occurred during agent dispatch.';
        if (e instanceof Error) {
            finalErrorMessage = e.message;
        } else if (typeof e === 'object' && e !== null && 'toString' in e) {
            finalErrorMessage = `Google AI API Error: ${e.toString()}`;
        }
        
        addLog(`[dispatchAgent] FATAL ERROR: ${finalErrorMessage}`);
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
            config: {
                systemInstruction,
            },
        });

        if (!response.text) {
            throw new Error("Chat failed: Google AI returned an empty response.");
        }
        addLog(`[Chat] Received response of length ${response.text.length}.`);
        return response.text;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        addLog(`[Chat] FATAL ERROR: ${errorMessage}`);
        throw new Error(errorMessage);
    }
};
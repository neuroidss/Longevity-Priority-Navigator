
import { AgentType, type WorkspaceState, type AnalysisLens, type GroundingSource, type SearchResult, ContradictionTolerance } from '../types';
import { LENS_DEFINITIONS } from "../constants";

const LENS_INSTRUCTIONS: Record<AnalysisLens, string> = {
    'Balanced': "Provide a balanced perspective, mixing near-term applicability with foundational research. Your proposed research opportunities should reflect this balance.",
    'High-Risk/High-Reward': "Focus exclusively on high-risk, high-reward strategies. Prioritize unconventional, paradigm-shifting hypotheses that could lead to major breakthroughs, even if they challenge existing dogma. Avoid incremental improvements.",
    'Clinical Translation': "Prioritize research with a clear and direct path to human clinical application. Focus on bridging the 'translational gap' from model organisms to humans, and on research that could lead to therapies or interventions within a 5-10 year timeline.",
    'Biomarker Discovery': "Focus intently on the 'biomarker problem'. Propose research directions aimed at discovering, validating, and standardizing robust biomarkers of aging. This is your primary objective.",
    'Fundamental Mechanisms': "Focus on deep, basic science to understand the core, fundamental mechanisms of aging. The goal is to expand our foundational knowledge, even if immediate therapeutic application is not obvious."
};

const TOLERANCE_INSTRUCTIONS: Record<ContradictionTolerance, string> = {
    'Low': `**Contradiction Strategy: Strict Consensus.** Your primary goal is to find the most stable, corroborated facts. Heavily down-weight or even ignore findings that are contradicted by other high-reliability sources. Your analysis must reflect a high degree of consensus. A research opportunity should NOT be proposed if its central premise is contested in the source material.`,
    'Medium': `**Contradiction Strategy: Balanced View.** Acknowledge and detail contradictions. Use the 'contradictions' section to highlight where the literature agrees and disagrees. Conflicting results are valuable signals for research gaps and should be presented as such. Your analysis should reflect the complexity and debate within the field.`,
    'High': `**Contradiction Strategy: Exploratory.** Actively seek out and explore contradictions, even from lower-reliability sources if they are provocative. Treat outlier and controversial findings as potentially high-impact areas for future research. Your 'researchOpportunities' should include proposals to resolve these very contradictions. Be more speculative and hypothesis-driven in your 'synergies' section.`
};


export const buildDiscoverAndValidatePrompt = (
    query: string,
    primarySources: SearchResult[]
): { systemInstruction: string; userPrompt: string } => {

    const searchContext = primarySources.map((res, i) => 
        `<PRIMARY_SOURCE ${i + 1}>\n<TITLE>${res.title}</TITLE>\n<URL>${res.link}</URL>\n<SNIPPET>\n${res.snippet}\n</SNIPPET>\n</PRIMARY_SOURCE>`
    ).join('\n\n');

    const userPrompt = `For the research query "${query}", please assess and summarize the following primary scientific sources.\n\n${searchContext}`;
    
    const systemInstruction = `You are an expert research analyst and critical appraisal specialist. Your task is to take a provided list of pre-filtered, primary scientific sources (papers, patents) and perform two tasks for each:
1.  **Summarize:** Create a concise, accurate summary of its core scientific claims, methods, or results based on the provided content.
2.  **Assess Reliability:** Evaluate the likely reliability of the source based *only* on the provided information and assign a numerical score.

Your output MUST be a single, valid JSON object enclosed in a markdown code block (\`\`\`json ... \`\`\`).

The JSON object must have the following structure:
{
  "sources": [{
    "uri": "string (The full URL of the source.)",
    "title": "string (The title of the source document.)",
    "summary": "string (A 2-4 sentence summary of the source's key scientific information. This summary is vital as it will be the ONLY content used for the final analysis.)",
    "reliability": "float (A score from 0.0 to 1.0 representing the source's likely reliability.)",
    "reliabilityJustification": "string (A brief explanation for your reliability score.)"
  }]
}

**CRITICAL INSTRUCTIONS FOR RELIABILITY ASSESSMENT:**
- **Base your assessment ONLY on the provided <TITLE> and <SNIPPET>.** Do not use external knowledge.
- **Title/Content Mismatch:** If the title and the snippet appear to describe completely different topics, you MUST assign a reliability score of 0.1 and explicitly state "Title/content mismatch" in the justification. This is a critical check for data corruption.
- **High Score (0.8-1.0):** Title/snippet suggests a peer-reviewed publication in a reputable journal (e.g., Nature, Cell, Science), a systematic review, a meta-analysis, or a large randomized controlled trial (RCT). Claims are specific and quantitative.
- **Medium Score (0.5-0.7):** Title/snippet suggests a standard research article, a preprint (e.g., from bioRxiv), or a detailed patent. Claims are plausible but may lack detail on sample size or statistical power in the snippet.
- **Low Score (0.2-0.4):** Title/snippet is vague, from a less common source, or lacks specific data. The claim might be very preliminary (e.g., 'in vitro' study with no clear translational path mentioned).
- **Very Low Score (0.0-0.1):** The snippet is uninformative, appears to be an error, or suggests non-scientific content that slipped through the initial filter.

**GENERAL INSTRUCTIONS:**
- Create a summary and reliability assessment for EVERY source provided. Do not omit any.
- Your entire response MUST consist of ONLY the JSON object within a markdown code block. Do not include any other text or explanations.`;

    return { systemInstruction, userPrompt };
};


const buildKnowledgeNavigatorPrompts = (
    query: string,
    lens: AnalysisLens,
    tolerance: ContradictionTolerance,
    sources: GroundingSource[]
): { systemInstruction: string; userPrompt: string } => {
    
    const context = sources.map((source, index) => 
        `<SOURCE ${index + 1}>\n<TITLE>${source.title}</TITLE>\n<URL>${source.uri}</URL>\n<RELIABILITY_SCORE>${source.reliability?.toFixed(2) || 'N/A'}</RELIABILITY_SCORE>\n<CONTENT>\n${source.content}\n</CONTENT>\n</SOURCE>`
    ).join('\n\n');

    const userPrompt = `Based on the provided sources, analyze the research topic: "${query}".\n\n${context}`;
    
    const lensInstruction = LENS_INSTRUCTIONS[lens] || LENS_INSTRUCTIONS['Balanced'];
    const toleranceInstruction = TOLERANCE_INSTRUCTIONS[tolerance] || TOLERANCE_INSTRUCTIONS['Medium'];
    const lensName = LENS_DEFINITIONS.find(l => l.id === lens)?.name || 'Balanced';

    const systemInstruction = `You are a world-class bioinformatics research strategist specializing in aging and longevity. Your analysis is sharp, critical, and goes far beyond simple search results. You understand the 'problem of chicken and egg': weak interventions are hard to measure with noisy biomarkers, and without good biomarkers, it's hard to develop strong interventions.

Your analysis is guided by TWO main directives:
1.  **Analysis Lens: ${lensName}**. Directive: ${lensInstruction}
2.  **Contradiction Tolerance: ${tolerance}**. Directive: ${toleranceInstruction}

Your primary task is to analyze the provided scientific source content to identify and prioritize the most critical research directions. You MUST factor in the provided **RELIABILITY_SCORE** for each source and follow your Contradiction Strategy. High-reliability sources should form the foundation of your analysis, but your tolerance level dictates how you handle disagreement.

When you use information from a source, you MUST cite it by including a citation in your text, for example: "This is supported by evidence [1]". The number corresponds to the 1-based index of the source provided in the prompt (e.g., <SOURCE 1> is [1]).

Your output MUST be a single, valid JSON object enclosed in a markdown code block (\`\`\`json ... \`\`\`). Do not include any other text or explanation outside of this JSON block.

The JSON object must have the following structure:
{
  "keyQuestion": "string (A profound question that encapsulates the core challenge or opportunity based on the provided sources.)",
  "knowledgeGraph": {
    "nodes": [ { "id": "string", "label": "string", "type": "string (Must be one of: 'Gene', 'Protein', 'Compound', 'Pathway', 'Disease', 'Process', 'Topic', 'Hypothesis', 'KnowledgeGap', 'Method', 'Result', 'Observation', 'Tool', 'Biomarker')" } ],
    "edges": [ { "source": "string (node id)", "target": "string (node id)", "label": "string" } ]
  },
  "researchOpportunities": [
    {
      "title": "string (A concise, compelling title for a research direction or hypothesis to test.)",
      "justification": "string (A detailed explanation of WHY this is critical. Explicitly mention the reliability of the supporting sources. How does it address a core challenge? Why now? Remember to add citations like [1], [2].)",
      "relatedNodeIds": ["string (A list of node IDs from your knowledgeGraph that are central to this opportunity.)"],
      "lens": "string (The analysis lens used. MUST be '${lens}')",
      "confidence": "float (A score from 0.0 to 1.0. This MUST be an aggregate of the reliability scores of the sources you cite in the justification. Your Contradiction Tolerance should influence this score.)",
      "maturity": "string (Current stage. Must be one of: 'Basic Research', 'Translational', 'Clinical'.)",
      "potentialImpact": "string (e.g., 'Could validate a new class of aging biomarkers'.)"
    }
  ],
  "contradictions": [{
    "statement": "string (A clear statement of the conflict, e.g., 'Source [1] (Reliability: 0.8) finds X is beneficial, while Source [2] (Reliability: 0.5) finds it is neutral.')"
  }],
  "synergies": [{
    "statement": "string (A novel connection, e.g., 'The mechanism from Source [3] (Reliability: 0.9) could explain the unexplained observation in Source [4] (Reliability: 0.6).')"
  }],
  "synthesis": "string (A 'Strategic Briefing' markdown string. Use these exact headers: '### Current Landscape', '### Key Challenges (Translational Gaps & Biomarker Noise)', '### Strategic Implications'. Remember to add citations like [5], [6].)"
}

**CRITICAL INSTRUCTIONS:**
- You MUST base your entire analysis **exclusively** on the text content provided in the <SOURCE> blocks in the user prompt. Do not invent information or use external knowledge.
- Your analysis and the **'confidence'** scores you assign MUST be heavily influenced by both the **RELIABILITY_SCORE** of each source and your assigned **Contradiction Tolerance**.
- DO NOT include a "sources" array in your JSON output.
- Every node in the knowledge graph must connect to at least one other node.
- For each research opportunity, you MUST specify the 'lens' property with the value '${lens}'.
- Ensure the final output is a single, valid JSON object. Pay close attention to commas, brackets, and quotes. All string values containing special characters must be properly escaped.
- Your entire response MUST consist of ONLY the JSON object within a markdown code block.`;

    return { systemInstruction, userPrompt };
};


const buildTrendAgentPrompts = (
    query: string,
    lens: AnalysisLens,
    tolerance: ContradictionTolerance,
    sources: GroundingSource[]
): { systemInstruction: string; userPrompt:string } => {
    const context = sources.map((source, index) => 
        `<SOURCE ${index + 1}>\n<TITLE>${source.title}</TITLE>\n<URL>${source.uri}</URL>\n<RELIABILITY_SCORE>${source.reliability?.toFixed(2) || 'N/A'}</RELIABILITY_SCORE>\n<CONTENT>\n${source.content}\n</CONTENT>\n</SOURCE>`
    ).join('\n\n');
    
    const userPrompt = `Based on the provided sources, analyze the research topic for trends: "${query}".\n\n${context}`;
    
    const lensInstruction = LENS_INSTRUCTIONS[lens] || LENS_INSTRUCTIONS['Balanced'];
    const toleranceInstruction = TOLERANCE_INSTRUCTIONS[tolerance] || TOLERANCE_INSTRUCTIONS['Medium'];
    const lensName = LENS_DEFINITIONS.find(l => l.id === lens)?.name || 'Balanced';

    const systemInstruction = `You are a world-class bioinformatics research analyst specializing in longitudinal trends in scientific discovery. Your unique skill is to analyze the evolution of a research field over time based on a provided set of documents.

Your analysis is guided by TWO main directives:
1.  **Analysis Lens: ${lensName}**. Directive: ${lensInstruction}
2.  **Contradiction Tolerance: ${tolerance}**. Directive: ${toleranceInstruction}

Your primary task is to simulate a "temporal snapshot" analysis to identify key shifts, emerging concepts, and changes in scientific focus based on the provided sources. You MUST factor in the provided **RELIABILITY_SCORE** for each source and follow your Contradiction Strategy.

When you use information from a source, you MUST cite it by including a citation in your text, for example: "This trend is evident in recent work [1]". The number corresponds to the 1-based index of the source provided in the prompt.

Your output MUST be a single, valid JSON object enclosed in a markdown code block (\`\`\`json ... \`\`\`). Do not include any other text or explanation outside of this JSON block.

The JSON object must have the following structure:
{
  "keyQuestion": "string (The most important strategic question about this topic NOW, specifically informed by its recent evolution from the sources.)",
  "knowledgeGraph": {
    "nodes": [ { "id": "string", "label": "string", "type": "string (See valid types below)", "zone": "string (MUST be 'fading', 'connecting', or 'emerging')" } ],
    "edges": [ { "source": "string", "target": "string", "label": "string" } ]
  },
  "researchOpportunities": [
    {
      "title": "string (A forward-looking opportunity that capitalizes on a recent trend)",
      "justification": "string (Explain why this is an opportunity NOW, referencing specific shifts from your trend analysis. Mention source reliability and add citations like [1].)",
      "relatedNodeIds": ["string"],
      "lens": "string (MUST be '${lens}')",
      "confidence": "float (This MUST be an aggregate of the reliability scores of the supporting sources and your Contradiction Tolerance.)",
      "maturity": "string ('Basic Research', 'Translational', or 'Clinical')",
      "potentialImpact": "string"
    }
  ],
  "trendAnalysis": {
    "summary": "string (A high-level overview of how the field has evolved. What is the main story of the last 2 years? Add citations like [2].)",
    "emergingConcepts": [{ "concept": "string", "justification": "string (Why is this concept gaining traction now? Add citations like [3].)", "relatedNodeIds": ["string"] }],
    "fadingConcepts": [{ "concept": "string", "justification": "string (Why is this concept becoming less central? Add citations like [4].)", "relatedNodeIds": ["string"] }],
    "keyShifts": [{ "shiftTitle": "string", "fromFocus": "string", "toFocus": "string", "justification": "string (Add citations like [5].)" }]
  },
  "synthesis": "string (A 'Strategic Briefing' markdown string. Use these exact headers: '### How We Got Here (Recent History)', '### The Landscape Today', '### Future Outlook'. Remember to add citations like [6], [7].)"
}

**CRITICAL INSTRUCTIONS:**
- You MUST base your entire analysis **exclusively** on the text content provided in the <SOURCE> blocks in the user prompt. Do not use external search.
- Your analysis and the **'confidence'** scores you assign MUST be heavily influenced by both the **RELIABILITY_SCORE** of each source and your assigned **Contradiction Tolerance**.
- DO NOT include a "sources" array in your JSON output.
- Valid node types are: 'Gene', 'Protein', 'Compound', 'Pathway', 'Disease', 'Process', 'Topic', 'Hypothesis', 'KnowledgeGap', 'Method', 'Result', 'Observation', 'Tool', 'Biomarker'.
- For each node in the \`knowledgeGraph\`, you MUST assign a \`zone\` property: 'fading', 'emerging', or 'connecting'. This is vital for the visual output.
- The **trendAnalysis** section is CRITICAL and must be thoroughly populated. For each concept in \`emergingConcepts\` and \`fadingConcepts\`, you MUST provide the \`relatedNodeIds\` from the \`knowledgeGraph\`.
- For each research opportunity, you MUST specify the 'lens' property with the value '${lens}'.
- Ensure the final output is a single, valid JSON object.
- Your entire response MUST consist of ONLY the JSON object within a markdown code block.`;

    return { systemInstruction, userPrompt };
};

export const buildAgentPrompts = (
    query: string,
    agentType: AgentType,
    sources: GroundingSource[],
    lens: AnalysisLens = 'Balanced',
    tolerance: ContradictionTolerance = 'Medium'
): { systemInstruction: string; userPrompt: string } => {
    switch (agentType) {
        case AgentType.TrendAnalyzer:
            return buildTrendAgentPrompts(query, lens, tolerance, sources);
        case AgentType.KnowledgeNavigator:
        default:
            return buildKnowledgeNavigatorPrompts(query, lens, tolerance, sources);
    }
};

export const buildChatPrompt = (
    question: string,
    workspace: WorkspaceState
): { systemInstruction: string; userPrompt: string } => {

    const articlesContext = workspace.sources
        .filter(s => s.status === 'valid')
        .map(s => `- ${s.title} (Reliability: ${s.reliability?.toFixed(2) || 'N/A'})`)
        .join('\n');

    const context = `
    <WORKSPACE_CONTEXT>
        <TOPIC>${workspace.topic}</TOPIC>
        <KEY_STRATEGIC_QUESTION>${workspace.keyQuestion || 'No key question was identified.'}</KEY_STRATEGIC_QUESTION>
        <INITIAL_SYNTHESIS>${workspace.synthesis || 'No synthesis provided.'}</INITIAL_SYNTHESIS>
        <GRAPH_NODES>
        ${workspace.knowledgeGraph?.nodes.map(n => `- ${n.label} (${n.type})`).join('\n') || 'No nodes in graph.'}
        </GRAPH_NODES>
        <VALID_ARTICLES>
        ${articlesContext || 'No valid articles found.'}
        </VALID_ARTICLES>
    </WORKSPACE_CONTEXT>
    `;

    const systemInstruction = `You are a brilliant scientific research assistant. You are having a conversation with a user about a knowledge graph and research articles you have previously compiled. Your task is to answer the user's questions based ONLY on the provided workspace context. Be concise, insightful, and helpful. If the context doesn't contain the answer, say that you don't have enough information from the current workspace. Refer to specific nodes or articles when relevant, and mention their reliability score if applicable. Do NOT output JSON.`;

    const userPrompt = `${context}\n\nBased on the workspace context above, please answer the following question:\n\n<QUESTION>${question}</QUESTION>`;

    return { systemInstruction, userPrompt };
};

export const buildFilterBioRxivFeedPrompt = (
    query: string,
    feedItems: SearchResult[]
): { systemInstruction: string; userPrompt: string } => {

    const feedContext = feedItems.map((item, i) =>
        `<ARTICLE ${i + 1}>\n<URL>${item.link}</URL>\n<TITLE>${item.title}</TITLE>\n<SNIPPET>${item.snippet}</SNIPPET>\n</ARTICLE>`
    ).join('\n\n');

    const userPrompt = `I am researching the topic "${query}". From the following list of recent preprint articles, please identify which ones are directly relevant to my topic.\n\n${feedContext}`;

    const systemInstruction = `You are a highly skilled research assistant specializing in biomedical science. Your task is to act as a relevance filter. You will be given a user's research topic and a list of article titles and snippets from a live preprint feed.
- You must carefully evaluate each article to determine if it is **directly relevant** to the user's query.
- Your output MUST be a single, valid JSON object enclosed in a markdown code block (\`\`\`json ... \`\`\`).
- The JSON object must contain a single key, "relevantArticleUrls", which is an array of strings.
- Each string in the array must be the exact URL of a relevant article from the provided list.
- If no articles are relevant, return an empty array: { "relevantArticleUrls": [] }.
- Do not include any articles that are only tangentially related. Focus on direct relevance.
- Do not add any explanation or text outside the JSON block.

Example response:
\`\`\`json
{
  "relevantArticleUrls": [
    "https://www.biorxiv.org/content/10.1101/2023.10.26.123456v1",
    "https://www.biorxiv.org/content/10.1101/2023.10.25.789012v2"
  ]
}
\`\`\``;

    return { systemInstruction, userPrompt };
};

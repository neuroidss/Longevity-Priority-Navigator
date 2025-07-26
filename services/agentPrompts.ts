

import { AgentType, type WorkspaceState, type AnalysisLens, type GroundingSource, type SearchResult, ContradictionTolerance } from '../types';
import { LENS_DEFINITIONS } from "../constants";

const JSON_IN_MARKDOWN_FORMATTING_INSTRUCTIONS = `
**JSON FORMATTING RULES:**
- Your entire response MUST consist of ONLY a single, valid JSON object enclosed in a markdown code block (\`\`\`json ... \`\`\`).
- The JSON object must be parseable by a standard JSON parser.
- Ensure all string values are properly escaped (e.g., use \\" for a double quote character within a string).
- **CRITICAL**: For any string value that contains newlines (like the 'synthesis' or 'justification' fields), you MUST escape them as \\n. The JSON parser will fail otherwise.
- Do NOT use trailing commas.
- Do not include any other text, explanations, or apologies outside the markdown code block.
`;

const RAW_JSON_FORMATTING_INSTRUCTIONS = `
**JSON FORMATTING RULES:**
- Your entire response MUST consist of ONLY a single, valid JSON object.
- Do NOT use markdown code blocks or any other formatting.
- The JSON object must be parseable by a standard JSON parser.
- Ensure all string values are properly escaped (e.g., use \\" for a double quote character within a string).
- **CRITICAL**: For any string value that contains newlines, you MUST escape them as \\n.
- Do NOT use trailing commas.
- Do not include any other text, explanations, or apologies.
`;

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


export const buildQueryEnhancementPrompt = (
    rawQuery: string
): { systemInstruction: string; userPrompt: string } => {
    const systemInstruction = `You are an expert multilingual research assistant. Your task is to take a user's query, which may be in any language or be a simple keyword, and transform it into a high-quality, specific search query suitable for scientific databases like PubMed.

**Your process:**
1.  **Detect Language:** Identify the language of the user's query.
2.  **Translate to English:** If the query is not in English, accurately translate it to technical English.
3.  **Enhance for Scientific Search:** Refine the English query. Make it more specific, use precise scientific terminology, and formulate it to maximize relevance from academic search engines. For example, "aging cure" should become "therapeutic interventions for cellular senescence and aging".
4.  **Output JSON:** Your output MUST be a JSON object with a single key: "enhancedQuery".

**Example Input:** "лекарство от старости"
**Example Output:**
{
  "enhancedQuery": "Therapeutic interventions and drug discovery for aging and age-related diseases"
}

**Example Input:** "senolytics"
**Example Output:**
{
  "enhancedQuery": "Senolytic compounds for the clearance of senescent cells in aging"
}

${RAW_JSON_FORMATTING_INSTRUCTIONS}`;

    const userPrompt = `Please process the following user query: "${rawQuery}"`;
    return { systemInstruction, userPrompt };
};

export const buildRelevanceFilterPrompt = (
    query: string,
    searchResults: SearchResult[]
): { systemInstruction: string; userPrompt: string } => {
    const context = searchResults.map((item, i) =>
        `<ARTICLE index="${i + 1}">\n<URL>${item.link}</URL>\n<TITLE>${item.title}</TITLE>\n<SNIPPET>${item.snippet}</SNIPPET>\n</ARTICLE>`
    ).join('\n\n');

    const userPrompt = `Research Topic: "${query}"\n\nArticle List:\n\n${context}`;

    const systemInstruction = `You are a JSON-generating relevance filter.

**Your Task:**
1. You are given a research topic and a list of articles, each with a unique "index".
2. Identify which articles are relevant. An article is relevant if its title or snippet directly discusses the topic.
3. Your output MUST be a JSON object with a single key: "relevantArticleIndices".
4. The value of "relevantArticleIndices" MUST be an array of numbers.
5. Each number in the array must be the exact index of a relevant article from the provided list.

**Example:**
{
  "relevantArticleIndices": [1, 5, 8]
}

${RAW_JSON_FORMATTING_INSTRUCTIONS}`;
    return { systemInstruction, userPrompt };
};


export const buildDiscoverAndValidatePrompt = (
    query: string,
    primarySources: SearchResult[]
): { systemInstruction: string; userPrompt: string } => {

    const searchContext = primarySources.map((res, i) => 
        `<PRIMARY_SOURCE ${i + 1}>\n<TITLE>${res.title}</TITLE>\n<URL>${res.link}</URL>\n<SNIPPET>\n${res.snippet}\n</SNIPPET>\n</PRIMARY_SOURCE>`
    ).join('\n\n');

    const userPrompt = `For the research query "${query}", please assess and summarize the following primary scientific sources.\n\n${searchContext}`;
    
    const systemInstruction = `You are an expert research analyst and critical appraisal specialist. Your task is to take a provided list of primary scientific sources (papers, patents) and perform two tasks for each:
1.  **Summarize:** Create a concise, accurate summary of its core scientific claims, methods, or results. Since the provided <SNIPPET> may be minimal or a placeholder, you MUST infer the summary from the <TITLE> and the context of the <URL>.
2.  **Assess Reliability:** Evaluate the likely reliability of the source based on all provided information and assign a numerical score.

The JSON object must have the following structure:
{
  "sources": [{
    "uri": "string (The full URL of the source.)",
    "title": "string (The title of the source document.)",
    "summary": "string (A 2-4 sentence summary of the source's key scientific information. This summary is vital as it will be the ONLY content used for the final analysis. **You must generate this summary from the title and URL.**)",
    "reliability": "float (A score from 0.0 to 1.0 representing the source's likely reliability.)",
    "reliabilityJustification": "string (A brief explanation for your reliability score.)"
  }]
}

**CRITICAL INSTRUCTIONS FOR RELIABILITY ASSESSMENT:**
- **Base your assessment on the <TITLE>, <URL>, and <SNIPPET>.** Do not use external knowledge.
- **The URL domain is a STRONG signal.** A URL from 'nature.com', 'cell.com', 'science.org', 'pubmed.ncbi.nlm.nih.gov', 'biorxiv.org', or other known scientific publishers indicates a primary source.
- **The tag '[DOI Found]' at the start of a <SNIPPET> is a VERY STRONG positive signal.** It confirms the source is a canonical scientific article. You should significantly increase the reliability score if you see this tag.
- **High Score (0.8-1.0):** URL is from a top-tier peer-reviewed journal (e.g., Nature, Cell, Science) AND/OR the snippet contains '[DOI Found]'. Title is specific and scientific.
- **Medium Score (0.5-0.7):** URL is from a known preprint server (e.g., bioRxiv) or a mid-tier journal. Title is relevant and plausible.
- **Low Score (0.2-0.4):** URL is from a less common source, or the title is vague. The claim might be very preliminary.
- **Very Low Score (0.0-0.1):** The title and URL suggest non-scientific content, a 404 page, or an obvious error.

**GENERAL INSTRUCTIONS:**
- Create a summary and reliability assessment for EVERY source provided. Do not omit any.
- When creating the 'summary' in your JSON output, you MUST OMIT the '[DOI Found]' tag. Do not include it in the final summary text.

${JSON_IN_MARKDOWN_FORMATTING_INSTRUCTIONS}`;

    return { systemInstruction, userPrompt };
};

const buildInnovationAgentPrompts = (
    query: string,
    lens: AnalysisLens,
    workspaceState: WorkspaceState
): { systemInstruction: string; userPrompt: string } => {
    const context = `
<TOPIC>${workspaceState.topic}</TOPIC>
<KEY_QUESTION>${workspaceState.keyQuestion || 'Not available'}</KEY_QUESTION>
<SYNTHESIS>${workspaceState.synthesis || 'Not available'}</SYNTHESIS>
<KNOWLEDGE_GRAPH>
Nodes:
${workspaceState.knowledgeGraph?.nodes.map(n => `- ${n.label} (${n.type})`).join('\n') || 'No nodes'}
Edges:
${workspaceState.knowledgeGraph?.edges.map(e => `- ${e.source} -> ${e.target} (${e.label})`).join('\n') || 'No edges'}
</KNOWLEDGE_GRAPH>
    `;
    const userPrompt = `Based on the provided research summary for "${query}", analyze the market and innovation potential.\n\n${context}`;

    const lensInstruction = LENS_INSTRUCTIONS[lens] || LENS_INSTRUCTIONS['Balanced'];
    const lensName = LENS_DEFINITIONS.find(l => l.id === lens)?.name || 'Balanced';

    const systemInstruction = `You are a visionary biotech strategist and venture analyst. You are given a deep scientific analysis of a research area and your task is to identify concrete, marketable product concepts and commercialization strategies.

Your analysis is guided by **Analysis Lens: ${lensName}**. Directive: ${lensInstruction}

The JSON object must have the following structure:
{
  "marketInnovationAnalysis": {
    "summary": "string (High-level summary of the market landscape, key opportunities, and strategic recommendations. DO NOT use citations.)",
    "targetAudienceSegments": [
      {
        "segmentName": "string (e.g., 'Proactive Health Consumers', 'Clinicians Treating Frailty')",
        "description": "string (Detailed description of this audience and their needs.)",
        "marketSize": "string (e.g., 'Niche', 'Growing', 'Large')"
      }
    ],
    "productConcepts": [
      {
        "conceptName": "string (A catchy, descriptive name for the product.)",
        "description": "string (What the product is, what it does, and its value proposition.)",
        "type": "string (Must be one of: 'Diagnostic', 'Therapeutic', 'Platform', 'Consumer')",
        "readinessLevel": "string (Must be one of: 'Concept', 'Prototype', 'MVP', 'Market-Ready')"
      }
    ],
    "regulatoryHurdles": ["string (List of potential regulatory challenges, e.g., 'FDA approval for novel biomarker'.)"],
    "keyCompetitors": ["string (List of potential companies or research groups in this space.)"]
  }
}

**CRITICAL INSTRUCTIONS:**
- Base your analysis **exclusively** on the provided context. Do NOT use external knowledge or search.
- Be creative and concrete. The product concepts should be plausible and linked to the scientific context.
- The 'summary' should be a strategic overview, not a rehash of the scientific synthesis.

${JSON_IN_MARKDOWN_FORMATTING_INSTRUCTIONS}`;
    return { systemInstruction, userPrompt };
};

const buildAppliedLongevityAgentPrompts = (
    query: string,
    workspaceState: WorkspaceState
): { systemInstruction: string; userPrompt: string } => {
    const context = `
<TOPIC>${workspaceState.topic}</TOPIC>
<SOURCES>
${workspaceState.sources.map((s, i) => `<SOURCE ${i+1}>${s.title}: ${s.content}</SOURCE>`).join('\n')}
</SOURCES>
<KNOWLEDGE_GRAPH>
Nodes:
${workspaceState.knowledgeGraph?.nodes.map(n => `- ${n.label} (${n.type})`).join('\n') || 'No nodes'}
</KNOWLEDGE_GRAPH>
<RESEARCH_OPPORTUNITIES>
${workspaceState.researchOpportunities.map(ro => `- ${ro.title}: ${ro.justification}`).join('\n') || 'No opportunities'}
</RESEARCH_OPPORTUNITIES>
    `;
    const userPrompt = `Based on the provided research context for "${query}", generate an applied longevity analysis.\n\n${context}`;

    const systemInstruction = `You are a pragmatic longevity advisor, bridging the gap between cutting-edge research and actionable steps for health-conscious individuals and investors. You are given a deep scientific analysis of a research area. Your task is to identify:
1.  **Consumer Products**: Supplements, foods, or compounds mentioned in the research that have some evidence for impacting longevity pathways.
2.  **Investable Entities**: Publicly traded companies whose work is directly related to the research opportunities identified.

**RESPONSIBILITY & ACCURACY ARE PARAMOUNT:**
- **DO NOT PROVIDE MEDICAL ADVICE.** Frame all health-related suggestions as informational and for discussion with a qualified healthcare professional. Start your summary with a disclaimer.
- **BE HONEST ABOUT EVIDENCE.** You MUST classify the evidence for each consumer product into one of four categories. Base this on the provided sources.
- **CITE EVERYTHING.** All claims in \`evidenceSummary\`, \`risks\`, and \`investmentThesis\` must be backed by citations from the provided sources [1], [2], etc.
- **Use your latent knowledge** to identify company tickers and specific product names, but **ground the justification for their inclusion** in the provided context and citations.

The JSON object must have the following structure:
{
  "appliedLongevityAnalysis": {
    "summary": "string (High-level summary of the actionable takeaways. Start with 'This information is for educational purposes and is not medical advice. Consult a healthcare professional before making any health decisions.')",
    "consumerProducts": [{
      "name": "string (e.g., 'Metformin', 'Fisetin', 'Omega-3 Fatty Acids')",
      "mechanism": "string (Briefly explain how it is thought to work based on the sources. Add citations.)",
      "evidenceLevel": "string (MUST be one of: 'Human Clinical Trials', 'Animal Models', 'In Vitro / In Silico', 'Correlational / Observational')",
      "evidenceSummary": "string (Summarize the evidence from the sources that supports its inclusion. Add citations.)",
      "risks": "string (Mention known risks or side effects based on the sources, or state that they were not discussed. Add citations.)"
    }],
    "investableEntities": [{
      "companyName": "string (Full name of the publicly traded company.)",
      "ticker": "string (The stock market ticker symbol, e.g., 'LLY')",
      "investmentThesis": "string (Why this company is relevant to the research topic. Add citations.)"
    }]
  }
}

${JSON_IN_MARKDOWN_FORMATTING_INSTRUCTIONS}`;
    return { systemInstruction, userPrompt };
};

const buildGenerativeMoleculeAgentPrompts = (
    query: string,
    workspaceState: WorkspaceState
): { systemInstruction: string; userPrompt: string } => {
    const seedMolecules = workspaceState.appliedLongevityAnalysis?.consumerProducts
        .map(p => `- ${p.name} (Mechanism: ${p.mechanism})`)
        .join('\n') || 'No seed molecules available.';
    
    const context = `
<TOPIC>${workspaceState.topic}</TOPIC>
<SEED_COMPOUNDS>
${seedMolecules}
</SEED_COMPOUNDS>
<RESEARCH_CONTEXT>
${workspaceState.synthesis || 'No synthesis available.'}
</RESEARCH_CONTEXT>
    `;

    const userPrompt = `Based on the provided research context and seed compounds for "${query}", generate a novel molecule.\n\n${context}`;

    const systemInstruction = `You are an expert computational chemist AI, specializing in generative models for drug discovery. Your task is to propose a novel, hypothetical small molecule based on a given set of 'seed' compounds and research context.

**Your process:**
1.  **Analyze Seeds**: Analyze the provided seed compounds and their mechanisms.
2.  **Generate Novel Molecule**: Generate a novel molecule that is structurally related to the seeds but is not identical. Provide its structure in SMILES format and a plausible IUPAC name.
3.  **Predict Properties**: Predict key drug-like properties for your new molecule (Lipinski's rule of five).
4.  **Create Abstract**: Write a short, hypothetical paper abstract announcing the discovery of this molecule, its potential mechanism of action, and its relevance to the research topic.

**CRITICAL INSTRUCTIONS:**
- The generated SMILES string MUST be syntactically valid.
- The IUPAC name should be plausible for the given SMILES structure.
- The predictions for properties should be reasonable estimations.
- The abstract should be creative, scientific, and grounded in the provided research context.
- Your entire response MUST be a single, valid JSON object.

The JSON object must have the following structure:
{
  "generativeMoleculeAnalysis": {
    "summary": "string (A brief summary of your generative process and the rationale for the new molecule.)",
    "predictedMolecule": {
      "smiles": "string (The novel molecule in SMILES format. e.g., 'CC(=O)Oc1ccccc1C(=O)O')",
      "iupacName": "string (The predicted IUPAC name for the molecule.)",
      "predictedProperties": {
        "molecularWeight": "number",
        "logP": "number (Octanol-water partition coefficient)",
        "tpsa": "number (Topological Polar Surface Area)",
        "lipinskiViolations": "number (Count of violations of Lipinski's Rule of Five)"
      },
      "paperAbstract": "string (A hypothetical scientific abstract for a paper discovering this molecule.)"
    }
  }
}

${JSON_IN_MARKDOWN_FORMATTING_INSTRUCTIONS}`;

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

${JSON_IN_MARKDOWN_FORMATTING_INSTRUCTIONS}`;

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

${JSON_IN_MARKDOWN_FORMATTING_INSTRUCTIONS}`;

    return { systemInstruction, userPrompt };
};

export const buildAgentPrompts = (
    agentType: AgentType,
    workspaceState: WorkspaceState,
    lens: AnalysisLens = 'Balanced',
    tolerance: ContradictionTolerance = 'Medium'
): { systemInstruction: string; userPrompt: string } => {
    const query = workspaceState.topic; // Use the (potentially enhanced) topic from the workspace state
    switch (agentType) {
        case AgentType.InnovationAgent:
            return buildInnovationAgentPrompts(query, lens, workspaceState);
        case AgentType.AppliedLongevityAgent:
             return buildAppliedLongevityAgentPrompts(query, workspaceState);
        case AgentType.GenerativeMoleculeAgent:
            return buildGenerativeMoleculeAgentPrompts(query, workspaceState);
        case AgentType.TrendAnalyzer:
            return buildTrendAgentPrompts(query, lens, tolerance, workspaceState.sources);
        case AgentType.KnowledgeNavigator:
        default:
            return buildKnowledgeNavigatorPrompts(query, lens, tolerance, workspaceState.sources);
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
    feedItems: SearchResult[],
    limit: number
): { systemInstruction: string; userPrompt: string } => {

    const feedContext = feedItems.map((item, i) =>
        `<ARTICLE ${i + 1}>\n<URL>${item.link}</URL>\n<TITLE>${item.title}</TITLE>\n<SNIPPET>${item.snippet}</SNIPPET>\n</ARTICLE>`
    ).join('\n\n');

    const userPrompt = `I am researching the topic "${query}". From the following list of recent preprint articles, please identify which ones are directly relevant to my topic.\n\n${feedContext}`;

    const systemInstruction = `You are a highly skilled research assistant specializing in biomedical science. Your task is to act as a relevance filter. You will be given a user's research topic and a list of article titles and snippets from a live preprint feed.
- You must carefully evaluate each article to determine if it is **directly relevant** to the user's query.
- From the relevant articles, you must select the **top ${limit} most relevant ones**.
- Your output MUST be a single, valid JSON object enclosed in a markdown code block (\`\`\`json ... \`\`\`).
- The JSON object must contain a single key, "relevantArticleUrls", which is an array of strings.
- Each string in the array must be the exact URL of one of the top ${limit} relevant articles from the provided list. The array should contain at most ${limit} items.
- If no articles are relevant, return an empty array: { "relevantArticleUrls": [] }.
- Do not include any articles that are only tangentially related. Focus on direct relevance and rank them.

Example response (for a limit of 2):
\`\`\`json
{
  "relevantArticleUrls": [
    "https://www.biorxiv.org/content/10.1101/2023.10.26.123456v1",
    "https://www.biorxiv.org/content/10.1101/2023.10.25.789012v2"
  ]
}
\`\`\`

${JSON_IN_MARKDOWN_FORMATTING_INSTRUCTIONS}`;

    return { systemInstruction, userPrompt };
};
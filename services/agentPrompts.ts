import { AgentType, type WorkspaceState, type AnalysisLens } from '../types';
import { LENS_DEFINITIONS } from "../constants";

const LENS_INSTRUCTIONS: Record<AnalysisLens, string> = {
    'Balanced': "Provide a balanced perspective, mixing near-term applicability with foundational research. Your proposed research opportunities should reflect this balance.",
    'High-Risk/High-Reward': "Focus exclusively on high-risk, high-reward strategies. Prioritize unconventional, paradigm-shifting hypotheses that could lead to major breakthroughs, even if they challenge existing dogma. Avoid incremental improvements.",
    'Clinical Translation': "Prioritize research with a clear and direct path to human clinical application. Focus on bridging the 'translational gap' from model organisms to humans, and on research that could lead to therapies or interventions within a 5-10 year timeline.",
    'Biomarker Discovery': "Focus intently on the 'biomarker problem'. Propose research directions aimed at discovering, validating, and standardizing robust biomarkers of aging. This is your primary objective.",
    'Fundamental Mechanisms': "Focus on deep, basic science to understand the core, fundamental mechanisms of aging. The goal is to expand our foundational knowledge, even if immediate therapeutic application is not obvious."
};

const buildKnowledgeNavigatorPrompts = (
    query: string,
    lens: AnalysisLens
): { systemInstruction: string; userPrompt: string } => {
    const userPrompt = `Analyze the research topic: "${query}".`;
    
    const lensInstruction = LENS_INSTRUCTIONS[lens] || LENS_INSTRUCTIONS['Balanced'];
    const lensName = LENS_DEFINITIONS.find(l => l.id === lens)?.name || 'Balanced';

    const systemInstruction = `You are a world-class bioinformatics research strategist specializing in aging and longevity. Your analysis is sharp, critical, and grounded in the field's core challenges. You understand the 'problem of chicken and egg': weak interventions are hard to measure with noisy biomarkers, and without good biomarkers, it's hard to develop strong interventions.

Your analysis is guided by the following lens: **${lensName}**.
**Lens Directive:** ${lensInstruction}

Your primary task is to analyze scientific search results to identify and prioritize the most critical research directions for a team aiming to develop real-world longevity therapies. 

Your output MUST be a single, valid JSON object enclosed in a markdown code block (\`\`\`json ... \`\`\`). Do not include any other text or explanation outside of this JSON block.

The JSON object must have the following structure:
{
  "keyQuestion": "string (A profound question that encapsulates the core challenge or opportunity, often related to breaking the 'chicken-and-egg' cycle.)",
  "articles": [{ "title": "string", "summary": "string", "details": "string (e.g., 'Author, Year, Journal' or 'Inventor, Patent ID')" }],
  "knowledgeGraph": {
    "nodes": [ { "id": "string", "label": "string", "type": "string (Must be one of: 'Gene', 'Protein', 'Compound', 'Pathway', 'Disease', 'Process', 'Topic', 'Hypothesis', 'KnowledgeGap', 'Method', 'Result', 'Observation')" } ],
    "edges": [ { "source": "string (node id)", "target": "string (node id)", "label": "string" } ]
  },
  "researchOpportunities": [
    {
      "title": "string (A concise, compelling title for a research direction or hypothesis to test.)",
      "justification": "string (A detailed explanation of WHY this is critical. How does it address the biomarker problem, the translational gap, or other core challenges? Why now?)",
      "relatedNodeIds": ["string (A list of node IDs from your knowledgeGraph that are central to this opportunity.)"],
      "lens": "string (The analysis lens used. MUST be '${lens}')",
      "confidence": "float (A score from 0.0 to 1.0 representing your confidence in this opportunity's potential impact.)",
      "maturity": "string (Current stage. Must be one of: 'Basic Research', 'Translational', 'Clinical'.)",
      "potentialImpact": "string (e.g., 'Could validate a new class of aging biomarkers', 'Provides a human-relevant model for senolytic screening'.)"
    }
  ],
  "synthesis": "string (A 'Strategic Briefing' markdown string. Use these exact headers: '### Current Landscape', '### Key Challenges (Translational Gaps & Biomarker Noise)', '### Strategic Implications'.)"
}

The most important fields are 'keyQuestion' and 'researchOpportunities'.
- **keyQuestion**: Formulate a single, profound 'Key Strategic Question'. It should be a question that, if answered, would most efficiently advance the field.
- **researchOpportunities**: Distill your analysis into 2-3 concrete, high-priority actions or experiments. These should be the most leveraged things a research team could do next.

Every node in the knowledge graph must connect to at least one other node. For each research opportunity, you MUST specify the 'lens' property with the value '${lens}'.`;

    return { systemInstruction, userPrompt };
};


const buildTrendAgentPrompts = (
    query: string,
    lens: AnalysisLens
): { systemInstruction: string; userPrompt:string } => {
    const userPrompt = `Analyze the research topic for trends: "${query}".`;
    
    const lensInstruction = LENS_INSTRUCTIONS[lens] || LENS_INSTRUCTIONS['Balanced'];
    const lensName = LENS_DEFINITIONS.find(l => l.id === lens)?.name || 'Balanced';

    const systemInstruction = `You are a world-class bioinformatics research analyst specializing in longitudinal trends in scientific discovery. Your unique skill is to analyze the evolution of a research field over time.

Your analysis is guided by the following lens: **${lensName}**.
**Lens Directive:** ${lensInstruction}

Your primary task is to simulate a "temporal snapshot" analysis to identify key shifts, emerging concepts, and changes in scientific focus. 

Your output MUST be a single, valid JSON object enclosed in a markdown code block (\`\`\`json ... \`\`\`). Do not include any other text or explanation outside of this JSON block.

The JSON object must have the following structure:
{
  "keyQuestion": "string (The most important strategic question about this topic NOW, specifically informed by its recent evolution.)",
  "articles": [{ "title": "string", "summary": "string (Focus on recent, pivotal articles that represent the current state-of-the-art)", "details": "string" }],
  "knowledgeGraph": {
    "nodes": [ { "id": "string", "label": "string", "type": "string (See valid types below)", "zone": "string (MUST be 'fading', 'connecting', or 'emerging')" } ],
    "edges": [ { "source": "string", "target": "string", "label": "string" } ]
  },
  "researchOpportunities": [
    {
      "title": "string (A forward-looking opportunity that capitalizes on a recent trend)",
      "justification": "string (Explain why this is an opportunity NOW, referencing specific shifts from your trend analysis.)",
      "relatedNodeIds": ["string"],
      "lens": "string (MUST be '${lens}')",
      "confidence": "float",
      "maturity": "string ('Basic Research', 'Translational', or 'Clinical')",
      "potentialImpact": "string"
    }
  ],
  "trendAnalysis": {
    "summary": "string (A high-level overview of how the field has evolved. What is the main story of the last 2 years?)",
    "emergingConcepts": [{ "concept": "string", "justification": "string (Why is this concept gaining traction now?)", "relatedNodeIds": ["string"] }],
    "fadingConcepts": [{ "concept": "string", "justification": "string (Why is this concept becoming less central?)", "relatedNodeIds": ["string"] }],
    "keyShifts": [{ "shiftTitle": "string", "fromFocus": "string", "toFocus": "string", "justification": "string" }]
  },
  "synthesis": "string (A 'Strategic Briefing' markdown string. Use these exact headers: '### How We Got Here (Recent History)', '### The Landscape Today', '### Future Outlook'.)"
}

**CRITICAL INSTRUCTIONS for \`knowledgeGraph.nodes\`:**
Valid node types are: 'Gene', 'Protein', 'Compound', 'Pathway', 'Disease', 'Process', 'Topic', 'Hypothesis', 'KnowledgeGap', 'Method', 'Result', 'Observation'.

For each node in the \`knowledgeGraph\`, you MUST assign a \`zone\` property. This \`zone\` is for visually laying out the graph to tell a story of evolution.
- **'fading'**: For concepts that were central in the past but are now de-emphasized or considered solved. These will be positioned on the left.
- **'emerging'**: For new, cutting-edge concepts that represent the current and future focus. These will be positioned on the right.
- **'connecting'**: For foundational concepts that bridge the past and present, or are continuously relevant. These will be positioned in the center.
This \`zone\` classification is vital for the visual output.

The **trendAnalysis** section is CRITICAL and must be thoroughly populated. For each concept in \`emergingConcepts\` and \`fadingConcepts\`, you MUST provide the \`relatedNodeIds\` from the \`knowledgeGraph\` that correspond to that concept. The other sections ('keyQuestion', 'researchOpportunities') must be framed from the perspective of the *present day* but deeply informed by your trend analysis. For each research opportunity, you MUST specify the 'lens' property with the value '${lens}'.`;

    return { systemInstruction, userPrompt };
};

export const buildAgentPrompts = (
    query: string,
    agentType: AgentType,
    lens: AnalysisLens = 'Balanced'
): { systemInstruction: string; userPrompt: string } => {
    switch (agentType) {
        case AgentType.TrendAnalyzer:
            return buildTrendAgentPrompts(query, lens);
        case AgentType.KnowledgeNavigator:
        default:
            return buildKnowledgeNavigatorPrompts(query, lens);
    }
};

export const buildChatPrompt = (
    question: string,
    workspace: WorkspaceState
): { systemInstruction: string; userPrompt: string } => {

    const context = `
    <WORKSPACE_CONTEXT>
        <TOPIC>${workspace.topic}</TOPIC>
        <KEY_STRATEGIC_QUESTION>${workspace.keyQuestion || 'No key question was identified.'}</KEY_STRATEGIC_QUESTION>
        <INITIAL_SYNTHESIS>${workspace.synthesis || 'No synthesis provided.'}</INITIAL_SYNTHESIS>
        <GRAPH_NODES>
        ${workspace.knowledgeGraph?.nodes.map(n => `- ${n.label} (${n.type})`).join('\n') || 'No nodes in graph.'}
        </GRAPH_NODES>
        <ARTICLES>
        ${workspace.items.map(i => `- ${i.title}: ${i.summary}`).join('\n') || 'No articles found.'}
        </ARTICLES>
    </WORKSPACE_CONTEXT>
    `;

    const systemInstruction = `You are a brilliant scientific research assistant. You are having a conversation with a user about a knowledge graph and research articles you have previously compiled. Your task is to answer the user's questions based ONLY on the provided workspace context. Be concise, insightful, and helpful. If the context doesn't contain the answer, say that you don't have enough information from the current workspace. Refer to specific nodes or articles when relevant. Do NOT output JSON.`;

    const userPrompt = `${context}\n\nBased on the workspace context above, please answer the following question:\n\n<QUESTION>${question}</QUESTION>`;

    return { systemInstruction, userPrompt };
}
# Longevity Priority Navigator

**Live Demo:** [https://neuroidss.github.io/Longevity-Priority-Navigator/](https://neuroidss.github.io/Longevity-Priority-Navigator/)

This project is a prototype for an AI-powered system designed to navigate and prioritize research in the science of longevity. Its mission is to move beyond simple data retrieval and create a tool for **knowledge synthesis and strategic insight**.

---

## Core Philosophy: From Noise to Signal

The guiding principle of this project is to perfectly execute the most valuable function for a longevity researcher: **cutting through the noise to find the signal**. Instead of just presenting data, this tool uses AI agents to generate high-priority, justifiable research directions based on the latest scientific context. The entire user experience is built to serve this singular goal.

## Philosophical Underpinnings

This tool is built on the belief that genius is the ability to discern what is important and dedicate one's time to it. In the complex field of longevity, identifying the most critical questions is the biggest challenge. The field faces a "chicken-and-egg" problem: we need effective interventions to find good biomarkers, but we need good biomarkers to validate new interventions.

This app aims to be a tool to break that cycle. It is inspired by a desire to augment our own intelligence and overcome cognitive limitations, guided by ideas from thinkers like Neil deGrasse Tyson and Aldous Huxley.

> *"I often wonder about the questions we don't yet know how to ask... because the questions we know how to ask, I'm not so interested in them."* - Neil deGrasse Tyson

> *"The victim of mind-manipulation does not know that he is a victim. To him the walls of his prison are invisible, and he believes himself to be free."* - Aldous Huxley

Our goal is to create a tool that helps break free from existing paradigms and see the "invisible walls" of our current knowledge, enabling us to ask new, more powerful questions.

## How It Works: A User's Journey

1.  **Define Focus**: The user enters a broad research area (e.g., "senolytics," "epigenetic clocks").
2.  **Select Lens & Dispatch**: They choose an analytical perspective (e.g., "High-Risk/High-Reward", "Clinical Translation") and dispatch one of two specialized AI agents.
3.  **Receive Briefing**: In seconds, the user receives an AI-generated strategic briefing. This isn't a list of links; it's a synthesis that includes:
    *   A single, profound **Key Strategic Question**.
    *   A handful of **prioritized research opportunities**, complete with justifications, potential impact, and confidence scores.
    *   An analysis of **contradictions and synergies** found in the source material.
4.  **Explore Visually**: An interactive **Knowledge Graph** is automatically generated, visually mapping the concepts and relationships discussed in the briefing. Hovering over a research opportunity highlights its context in the graph.
5.  **Converse for Depth**: The user can then "chat" with an AI assistant that uses the entire workspace (briefing, graph, sources) as its context to answer follow-up questions, elaborate on connections, and help refine new hypotheses.

## Key Features

*   **AI-Driven Prioritization**: The core of the app. Agents don't just summarize; they analyze, critique, and propose concrete, high-impact research directions.
*   **Dual-Agent System**:
    *   **Knowledge Navigator**: Analyzes the current state of a field.
    *   **Trend Analyzer**: Analyzes the evolution of a field over time, identifying emerging and fading concepts.
*   **Insight-First UI**: The AI's proposed research opportunities and key questions are the primary output, not an afterthought. The graph and sources provide interactive, explorable context.
*   **Interactive Knowledge Graph**: A custom-built SVG physics simulation visualizes the conceptual landscape, making complex relationships intuitive.
*   **Context-Aware Chat**: The chat assistant maintains the context of the entire analysis, allowing for deep, meaningful exploration of the generated insights.
*   **Persistent Workspaces**: All generated analyses and chats are saved in the browser, allowing researchers to pick up where they left off.

## The Agentic Engine: How AI Delivers Insight

The "brain" of the application is a set of carefully engineered system prompts that define two distinct AI agent roles, powered by the Google Gemini API.

*   **System Prompts (`services/agentPrompts.ts`)**: This is where the agent's "personality," goals, and constraints are defined. We instruct the model to act as a world-class research strategist, to identify the "chicken-and-egg" problem, and to structure its output in a specific, detailed JSON format.
*   **Dynamic Agents (`AgentType`)**:
    *   `KnowledgeNavigator`: Scans the current landscape to identify the state-of-the-art, key players, and immediate opportunities.
    *   `TrendAnalyzer`: Takes a historical view, identifying which concepts are gaining momentum and which are fading, providing a strategic "where-to-next" perspective.
*   **Search Grounding**: We leverage Google Search grounding (`tools: [{ googleSearch: {} }]`) to provide the agents with up-to-date, real-world context from the latest scientific literature, pre-prints, and patents, ensuring the analysis is current and relevant.

## Technical Architecture

The application is a modern, client-side web app built with React and TypeScript.

*   **Frontend**: Built with **React** and **Vite**. The UI is crafted with **Tailwind CSS** for a clean, responsive, and professional design.
*   **AI Service Layer (`services/geminiService.ts`)**: This is the core communication hub. It uses the `@google/genai` SDK to interact with the Gemini API, handle responses, parse structured JSON, and manage grounding sources.
*   **State Management**: Application state is managed through a set of cohesive custom React hooks (`useWorkspaceManager`, `useAppSettings`, `useDebugLog`) and persisted in `localStorage` for seamless session continuity. This keeps component logic clean and state management predictable.
*   **Visualization (`components/KnowledgeGraphView.tsx`)**: The knowledge graph is rendered using **SVG** and a custom, lightweight physics simulation engine. This provides a dynamic, interactive visualization without heavy library dependencies, offering full control over node behavior and styling.

## Future Directions

*   **Agent Collaboration**: Introduce a "Critic" agent that reviews the output of the primary agent, challenging its assumptions and improving the robustness of the final recommendations.
*   **Deeper Integration**: Directly integrate with APIs from PubMed, bioRxiv, and patent offices for more structured and reliable data sourcing.
*   **Long-Term Memory**: Implement vector-based memory for the chat assistant, allowing it to recall information across different research sessions.
*   **User Accounts**: Allow users to create accounts to save, organize, and compare multiple research workspaces.

## How to Run Locally

**Prerequisites:** [Node.js](https://nodejs.org/)

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Set up your environment (Optional, but recommended):**
    To use the Google Gemini API without entering the key in the browser, provide an `API_KEY` environment variable. If this is not set, you will be prompted to enter your API key in the application's settings panel.

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
This will start the development server, and you can view the application in your browser at the local URL provided in your terminal (usually `http://localhost:5173` or similar).
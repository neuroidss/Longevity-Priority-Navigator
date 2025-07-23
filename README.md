
# Longevity Priority Navigator

Live Demo: https://neuroidss.github.io/Longevity-Priority-Navigator/

This project is a focused prototype for an AI-powered system designed to navigate and prioritize research in the science of longevity. It directly addresses the **"Longevity Priority"** and **"Longevity Knowledge Graph"** challenges from the Agentic AI x Longevity hackathon.

> **Hackathon Goal:** "Create an AI system that... forms priority research directions in the field of aging... build a living knowledge graph... justify why a particular task is important right now... [and] allow the user to chat with the graph as an intelligent assistant."

This application is a direct implementation of that vision, with a laser focus on delivering the most critical feature: **actionable, AI-driven research priorities.**

---

## Core Philosophy: The One Perfect Feature

The guiding principle of this project is to perfectly execute the most valuable function for a longevity researcher: cutting through the noise to find the signal. Instead of just presenting data, this tool uses AI to generate high-priority, justifiable research directions based on the latest scientific context. The entire user experience is built to serve this singular goal.

## Philosophical Underpinnings

This tool is built on the belief that genius is the ability to understand what is important and dedicate time to it. In the complex field of longevity, identifying the most critical questions is the biggest challenge. The lectures from the hackathon, particularly from Andrei Tarkhov, highlight the "chicken-and-egg" problem: we need effective interventions to find good biomarkers, but we need good biomarkers to validate new interventions.

This app aims to be a tool to break that cycle. It is inspired by a desire to augment our own intelligence and overcome cognitive limitations, guided by ideas from thinkers like Neil deGrasse Tyson and Aldous Huxley.

> *"I often wonder about the questions we don't yet know how to ask... because the questions we know how to ask, I'm not so interested in them, because we have the capacity to ask them."* - Neil deGrasse Tyson

> *"The victim of mind-manipulation does not know that he is a victim. To him the walls of his prison are invisible, and he believes himself to be free."* - Aldous Huxley

The goal is to create a tool that helps break free from existing paradigms and see the "invisible walls" of our current knowledge, enabling us to ask new, more powerful questions.

## Key Features

*   **AI-Powered Prioritization:** The user provides a research topic (e.g., "senolytics," "epigenetic clocks"). An AI agent, powered by the Google Gemini API, is dispatched to:
    1.  **Analyze the Landscape:** It uses Google Search to ground its knowledge in the latest scientific literature and patents.
    2.  **Identify Critical Opportunities:** The agent's primary goal is to propose **2-3 high-priority research directions**, justifying each one by addressing core challenges in the field, such as the biomarker problem or translational gaps from model organisms to humans.
    3.  **Build a Supporting Knowledge Graph:** It extracts key entities (Genes, Compounds, Hypotheses) and constructs an interconnected graph that visually contextualizes the proposed research directions.

*   **Insight-First User Experience:** The AI-proposed research opportunities are the hero of the application. They are presented first, as the main output. The knowledge graph and sourced articles serve as an interactive appendix, allowing for deeper exploration of these core insights.

*   **Interactive & Conversational Exploration:**
    *   **Graph Interactivity:** Hovering over a research opportunity highlights the relevant nodes in the knowledge graph, instantly showing its scientific context. Clicking a node allows for focused questioning.
    *   **AI Research Assistant:** Once the analysis is complete, the user can "chat" with an AI assistant. The AI uses the entire workspace (graph, articles, proposed directions) as its context to answer follow-up questions, elaborate on connections, and help refine new hypotheses.

*   **Persistent Workspace:** The user's research topic, generated graph, and chat history are saved in the browser's local storage, allowing them to resume their work at any time.

---

## Technical Architecture

The application is a modern, client-side web app built with React and TypeScript.

*   **Frontend:** Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/). UI is crafted with [Tailwind CSS](https://tailwindcss.com/) for a responsive and clean design.
*   **AI Service Layer (`services/geminiService.ts`):** This is the core communication hub. It uses the `@google/genai` SDK to interact with the Gemini API.
    *   **Search Grounding:** It leverages Google Search grounding (`tools: [{ googleSearch: {} }]`) to provide the AI with up-to-date, real-world context from scientific literature and patents.
    *   **Agent Logic (`services/agentPrompts.ts`):** The "brain" of the application is a set of carefully engineered system prompts that instruct the Gemini model how to behave as a research strategist. It defines the required JSON output structure, the analytical goals, and the constraints for the AI agents.
*   **State Management:** Application state (current topic, workspace, chat history) is managed through React hooks and persisted in the browser's `localStorage` for session continuity.
*   **Knowledge Graph Visualization:** The graph is rendered using SVG and a custom physics simulation engine implemented within a React component (`components/KnowledgeGraphView.tsx`). This provides a dynamic, interactive visualization without heavy library dependencies.

---

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
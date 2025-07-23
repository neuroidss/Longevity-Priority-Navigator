# Presentation: Using AI to Accelerate Longevity Research
## Danil Salimov, Sirius University, Blastim Alumnus

---

### Slide 2: Key Stages of an AI System for Longevity
1.  **Data Collection**: Automated collection of relevant information from various scientific sources.
2.  **NLP Pipeline**: Extraction of key entities: hypotheses, methods, results, and observations.
3.  **Knowledge Graph**: Construction of a dynamic structure with typed nodes to represent relationships between entities.
4.  **Task Prioritization**: Identification of the most relevant daily tasks based on current trends.
5.  **Explanation Generation**: Use of LLMs for transparent justification of priority task selection.

---

### Slide 3: Core Components: Data Collection
- **Data Sources**:
  - API NCBI (PubMed)
  - bioRxiv RSS feed
  - Patent databases
  - X API
- **Problems and Solutions**:
  - Huge data volumes
  - Filtering
  - Update queue
  - Integration of heterogeneous data

---

### Slide 4: Core Components: NLP Entity Extraction
- **Entity and Relationship Recognition**: LLM for automatic extraction of key terms (e.g., genes, proteins, diseases, methods) and the relationships between them.
- **Classification**: Classification of sources by type (e.g., peer-reviewed article, preprint, patent, tweet) and reliability, which allows for assessing information quality. Context classification (hypothesis, method, result, observation) to improve accuracy.
- **Disambiguation**: Normalization of entities (e.g., unification of gene names).

---

### Slide 5: Knowledge Graph
- Structures heterogeneous scientific facts.
- Ensures transparency and explainability of conclusions.
- Allows tracking trends through the dynamics of connections.
- Considers the types of entities and sources.
- Integrates biomedical and general concepts.

---

### Slide 6: Knowledge Graph Construction
- **Tools**: We use `igraph` for algorithmic graph analysis and `Neo4j` as a database for storing the knowledge graph.
- **Dynamic Graph**: We form a graph with type and time labels, allowing us to track the evolution of knowledge.
- **Graph Updates**: Development of an effective graph update strategy, including entity merging and adaptation of edge weights based on new data.
- **Validation**: Filtering of routine information, consensus assessment from different sources, and validation against historical data to improve accuracy.
- **Trend Analysis**: Graph updates and calculation of novelty and reliability metrics.

---

### Slide 7: Interaction Agent
- **Example**: Today's priority task is the knockout of gene X. New data has appeared: [list of facts and sources]. A new article [Salimov et al., 2025] reports that knocking out gene X increased mouse lifespan by 15%. A patent has been issued for combating aging in rhesus monkeys using the knockout of gene X. Another study [Ivanov, 2025] shows a correlation between the activity of gene X and the number of senescent cells in the human immune system.
- **Conclusion Generation**: The agent identifies entities and relationships from the user's query and generates an answer based on the corresponding subgraph.
- **Fine-tuning**: Direct fine-tuning is not an option. Further training can be done through prompts.

---

### Slide 8: User Interaction
- **Minimal Approach**:
  - A chatbot for sending messages and receiving reports.
  - Daily reports with key updates and insights.
- **Advanced Approach**:
  - An interactive web interface with the ability to work with the knowledge graph.
  - User settings for focusing on fundamental or applied discoveries.
  - Visualization of the graph for a deep analysis of connections.

---

### Slide 9: Alternative Approach: Latent Space of Sources
- **Idea**: Clustering information in an embedding space to identify hidden patterns and relationships.
- **Dynamics Tracking**: Monitoring changes in cluster volumes to identify emerging trends and research directions.
- **Tools**:
  - OpenAI embeddings for creating vector representations of text.
  - FAISS for efficient similarity search in large vector sets.

---

### Slide 10: Metrics and System Quality Assurance
- **Accuracy and Completeness**: Assessing the quality of entity and relationship extraction from text data.
- **Task Novelty**: Measuring the growth of activity and relevance around the proposed nodes in the graph.
- **Reliability Assessment**: Analyzing the quantity and diversity of sources to confirm facts.
- **Expert Agreement**: Comparing the system's top-k daily tasks with the opinions of independent specialists.
- **UX Evaluation**: Usability and clarity of the generated output for the end-user.

---

### Slide 11: Team Composition
- **ML Engineer**: Entity and relationship extraction, generating explanations with LLMs.
- **Knowledge Graph Architect**: Schema development, queries for entity construction, updates.
- **Data Engineer**: Data collection via API, cleaning, filtering, and storage.
- **Backend Developer**: Component integration, API development.
- **Frontend/UX Developer**: Web interface, graph visualization.
- **Domain Expert**: Quality control, task prioritization, research focus.
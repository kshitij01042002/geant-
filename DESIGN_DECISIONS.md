# GÉANT RAG System - Design Decisions

This document outlines all the technical decisions made for the GÉANT Knowledge Assistant proof-of-concept.

---

## Project Structure

```
Kshitij/
├── embedding-pipeline/     # Creates embeddings and uploads to Qdrant
│   ├── ingest.py          # Main ingestion script
│   ├── requirements.txt    # Python dependencies
│   └── .env.example       # Environment variables template
│
├── chatbot-app/           # Next.js chatbot interface
│   ├── src/app/           # App router pages and API
│   ├── package.json       # Node dependencies
│   └── .env.example       # Environment variables template
│
└── DESIGN_DECISIONS.md    # This file
```

---

## 1. Embedding Model Selection

**Choice: `sentence-transformers/all-MiniLM-L6-v2`**

| Aspect | Decision |
|--------|----------|
| **Dimensions** | 384 |
| **Speed** | ~14,000 sentences/sec on GPU |
| **Model Size** | ~80MB |

**Reasons:**
- Excellent balance between speed and quality for RAG applications
- Trained on 1B+ sentence pairs, good semantic understanding
- Small model size = fast inference, no GPU required
- Well-documented and widely used in production RAG systems
- Free to use (MIT license)

**Alternatives Considered:**
- `all-mpnet-base-v2` (768 dim): Better quality but slower, larger
- `text-embedding-3-small` (OpenAI): Paid API, vendor lock-in
- `e5-small-v2`: Similar performance, less community adoption

---

## 2. Vector Database Selection

**Choice: Qdrant Cloud**

**Reasons:**
- Open-source with free cloud tier (1GB storage free)
- No local Docker setup required
- Native support for payload filtering and metadata storage
- Simple REST API and good Python/JS clients
- Excellent performance for semantic search
- Supports HNSW algorithm for fast approximate nearest neighbor search
- Managed infrastructure = no maintenance

**Setup:**
1. Create free account at https://cloud.qdrant.io
2. Create a cluster
3. Copy the cluster URL and API key to your `.env` files

**Alternatives Considered:**
- ChromaDB: Simpler but less scalable, already used in main project
- Pinecone: Great but paid, vendor lock-in
- Weaviate: More complex setup for this PoC scope
- pgvector: Requires PostgreSQL setup

---

## 3. LLM Selection

**Choice: Groq API with `llama-3.1-8b-instant`**

**Reasons:**
- **Extremely fast inference** (~500 tokens/sec) - best-in-class latency
- Free tier available for development and testing
- Llama 3.1 8B is highly capable for Q&A tasks
- Open model weights (no proprietary concerns)
- Simple API, compatible with OpenAI SDK patterns

**Configuration:**
- Temperature: 0.3 (lower for factual, grounded responses)
- Max tokens: 1024 (sufficient for detailed answers with citations)

**Alternatives Considered:**
- OpenAI GPT-4: Better quality but expensive, slower
- Claude: Good but more expensive
- Ollama (local): Requires GPU, complex setup
- Mistral API: Good but Groq is faster

---

## 4. Frontend Framework

**Choice: Next.js 14 (App Router)**

**Reasons:**
- Built-in API routes (no separate backend needed)
- Server components for better performance
- Simple deployment to Vercel
- React ecosystem familiarity
- Tailwind CSS integration out of the box

**UI Decisions:**
- Single page chat interface (no routing complexity)
- No authentication (as per requirements)
- No chat history persistence (session only)
- 5 question limit per session (prevents abuse)
- Source citations displayed with each response

---

## 5. Metadata Strategy

**Stored with each embedding:**

| Field | Purpose |
|-------|---------|
| `record_id` | Zenodo record identifier |
| `chunk_id` | Unique chunk identifier |
| `content` | The actual text content |
| `chunk_type` | metadata or document_content |
| `source` | Origin (zenodo_metadata, file_content) |
| `file_name` | Original filename |
| `title` | Document title for citations |
| `authors` | Document authors for citations |
| `publication_date` | Publication date |
| `doi` | Digital Object Identifier |
| `zenodo_url` | Direct link to Zenodo record |
| `keywords` | Document keywords |

**This enables:**
- Proper source attribution in responses
- Clickable links to original documents
- Author credits
- Filtering by document type if needed

---

## 6. RAG Pipeline Design

```
User Query
    │
    ▼
┌─────────────────┐
│ Generate Query  │ (HuggingFace Inference API)
│ Embedding       │ (same model as ingestion)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Qdrant Vector   │ (top 5 results, similarity > 0.3)
│ Search          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Context         │ (format chunks with source numbers)
│ Assembly        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ LLM Generation  │ (Groq Llama 3.1)
│ with Sources    │
└────────┬────────┘
         │
         ▼
Response with Citations
```

---

## 7. Safety & Guardrails

**Knowledge Grounding:**
- Similarity threshold of 0.3 ensures only relevant chunks are used
- System prompt instructs LLM to ONLY use provided context
- If no relevant context found, system refuses to answer
- Clear messaging about knowledge boundaries

**Rate Limiting:**
- 5 questions per session (frontend enforced)
- No persistent storage = natural session limits

**Response Quality:**
- Low temperature (0.3) for factual responses
- Sources always provided when answer is given
- Clear indication when information is not available

---

## 8. Running the System

### Prerequisites
- Python 3.9+
- Node.js 18+
- Qdrant Cloud account (free tier)
- Groq API key (free tier)

### Step 1: Setup Qdrant Cloud
1. Go to https://cloud.qdrant.io and create a free account
2. Create a new cluster (free tier available)
3. Copy your cluster URL (e.g., `https://xxx-xxx.aws.cloud.qdrant.io`)
4. Generate an API key from the cluster dashboard

### Step 2: Run Embedding Pipeline
```bash
cd Kshitij/embedding-pipeline
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Qdrant Cloud URL and API key
python ingest.py
```

### Step 3: Start Chatbot
```bash
cd Kshitij/chatbot-app
npm install
cp .env.example .env.local
# Edit .env.local with:
#   - QDRANT_URL (your cluster URL)
#   - QDRANT_API_KEY (your Qdrant API key)
#   - GROQ_API_KEY (get from https://console.groq.com)
npm run dev
```

Visit `http://localhost:3000`

---

## 9. Future Improvements

If extending this PoC:

1. **Better Embeddings**: Use local sentence-transformers instead of HuggingFace API
2. **Hybrid Search**: Combine vector search with keyword matching
3. **Reranking**: Add a cross-encoder reranker for better relevance
4. **Caching**: Cache common queries and embeddings
5. **Streaming**: Stream LLM responses for better UX
6. **Evaluation**: Add automated evaluation with test questions
7. **Multi-turn**: Support follow-up questions with context

---

## 10. Dependencies Summary

### Embedding Pipeline (Python)
- `qdrant-client`: Vector database client
- `sentence-transformers`: Embedding model
- `pandas`: Data processing
- `python-dotenv`: Environment management
- `tqdm`: Progress bars

### Chatbot App (Node.js)
- `next`: React framework
- `groq-sdk`: LLM API client
- `@qdrant/js-client-rest`: Vector database client
- `@xenova/transformers`: Local embedding generation (same model as ingestion)
- `tailwindcss`: Styling

---

*Last updated: January 2026*

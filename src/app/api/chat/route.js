import { QdrantClient } from '@qdrant/js-client-rest'
import Groq from 'groq-sdk'

const QDRANT_URL = process.env.QDRANT_URL
const QDRANT_API_KEY = process.env.QDRANT_API_KEY
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'geant_documents'
const GROQ_API_KEY = process.env.GROQ_API_KEY
const HF_API_KEY = process.env.HF_API_KEY // Optional: for higher rate limits

// Similarity threshold - if below this, consider no relevant results found
const SIMILARITY_THRESHOLD = 0.3

// Initialize clients
const qdrant = new QdrantClient({ 
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY 
})
const groq = new Groq({ apiKey: GROQ_API_KEY })

async function getQueryEmbedding(query) {
  // HF API key is required for the new router endpoint
  if (!HF_API_KEY) {
    throw new Error('HF_API_KEY is required. Get a free key at https://huggingface.co/settings/tokens')
  }

  const response = await fetch(
    'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_API_KEY}`
      },
      body: JSON.stringify({ inputs: query }),
    }
  )
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('HuggingFace API error:', response.status, errorText)
    throw new Error(`Embedding API error: ${response.status}`)
  }
  
  const result = await response.json()
  
  // The API returns the embedding as a 2D array [[...embedding...]]
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return result[0]
  }
  
  return result
}

async function searchDocuments(query, topK = 5) {
  try {
    const embedding = await getQueryEmbedding(query)
    
    const results = await qdrant.search(QDRANT_COLLECTION, {
      vector: embedding,
      limit: topK,
      with_payload: true,
      score_threshold: SIMILARITY_THRESHOLD
    })
    
    return results
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

function formatContext(searchResults) {
  if (!searchResults || searchResults.length === 0) {
    return null
  }
  
  return searchResults.map((result, idx) => {
    const payload = result.payload
    return `[Source ${idx + 1}] Title: ${payload.title}
Content: ${payload.content}
---`
  }).join('\n\n')
}

function extractSources(searchResults) {
  if (!searchResults || searchResults.length === 0) {
    return []
  }
  
  // Deduplicate by record_id
  const seen = new Set()
  const sources = []
  
  for (const result of searchResults) {
    const payload = result.payload
    if (!seen.has(payload.record_id)) {
      seen.add(payload.record_id)
      sources.push({
        title: payload.title || payload.file_name,
        authors: payload.authors,
        url: payload.zenodo_url,
        doi: payload.doi
      })
    }
  }
  
  return sources.slice(0, 3) // Return top 3 unique sources
}

async function generateAnswer(query, context, sources) {
  const systemPrompt = `You are the GÉANT Knowledge Assistant, a helpful AI that answers questions about GÉANT - the pan-European research and education network.

IMPORTANT RULES:
1. If context from GÉANT documents is provided, ONLY use that information to answer
2. If NO context is provided or the context is empty, you must politely explain that you couldn't find relevant information in the GÉANT knowledge base for this specific question
3. When you cannot find relevant information, suggest the user try rephrasing their question or mention some general topics you can help with (like network services, eduGAIN, eduroam, security initiatives, NREN collaborations, project deliverables)
4. Always be accurate and factual - NEVER make up information
5. Reference the sources when providing information from context
6. Keep answers concise but informative
7. Be conversational and helpful in your tone`

  let userPrompt
  
  if (context) {
    userPrompt = `Context from GÉANT documents:
${context}

User Question: ${query}

Please answer the question based ONLY on the context provided above. If the context doesn't fully address the question, acknowledge what you found and note what's missing.`
  } else {
    userPrompt = `User Question: ${query}

IMPORTANT: No relevant documents were found in the GÉANT knowledge base for this question. Please politely inform the user that you couldn't find relevant information to answer their specific question, and suggest they try rephrasing or ask about topics typically covered in GÉANT documents (network technologies, eduGAIN, eduroam, cybersecurity, NREN services, project reports, etc.). Be helpful and conversational.`
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 1024
    })
    
    return {
      answer: completion.choices[0].message.content,
      sources: context ? sources : []
    }
  } catch (error) {
    console.error('Groq API error:', error)
    throw new Error('Failed to generate response')
  }
}

export async function POST(request) {
  try {
    const { message } = await request.json()
    
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Invalid message' }, { status: 400 })
    }
    
    // Search for relevant documents
    const searchResults = await searchDocuments(message)
    
    // Format context and extract sources
    const context = formatContext(searchResults)
    const sources = extractSources(searchResults)
    
    // Generate answer
    const response = await generateAnswer(message, context, sources)
    
    return Response.json(response)
  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    )
  }
}

'use client'

import { useState } from 'react'

const MAX_QUESTIONS = 5

export default function Home() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading) return
    
    if (questionCount >= MAX_QUESTIONS) {
      alert('You have reached the maximum limit of 5 questions. Please refresh the page to start a new session.')
      return
    }

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })

      const data = await response.json()
      
      const assistantMessage = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources || []
      }
      
      setMessages(prev => [...prev, assistantMessage])
      setQuestionCount(prev => prev + 1)
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again.',
        sources: []
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-700 text-white p-4 shadow-md">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold">GÉANT Knowledge Assistant</h1>
          <p className="text-blue-200 text-sm">Ask questions about GÉANT documents and reports</p>
        </div>
      </header>

      {/* Chat Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col">
        {/* Question Counter */}
        <div className="text-right text-sm text-gray-500 mb-2">
          Questions: {questionCount} / {MAX_QUESTIONS}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">👋 Welcome!</p>
              <p>Ask me anything about GÉANT projects, services, or documents.</p>
              <p className="text-sm mt-2">You can ask up to {MAX_QUESTIONS} questions per session.</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-4 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border border-gray-200 shadow-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                
                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm font-semibold text-gray-600 mb-2">📚 Sources:</p>
                    <ul className="space-y-2">
                      {msg.sources.map((source, sIdx) => (
                        <li key={sIdx} className="text-sm bg-gray-50 p-2 rounded">
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {source.title}
                          </a>
                          {source.authors && (
                            <p className="text-gray-500 text-xs mt-1">By: {source.authors}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={questionCount >= MAX_QUESTIONS ? "Question limit reached" : "Ask a question about GÉANT..."}
            disabled={questionCount >= MAX_QUESTIONS || isLoading}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={questionCount >= MAX_QUESTIONS || isLoading || !input.trim()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="text-center text-gray-500 text-sm p-4 border-t">
        Powered by GÉANT Zenodo documents • RAG system with source citations
      </footer>
    </div>
  )
}

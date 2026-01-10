'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  question: string;
  answer: string;
  timestamp: Date;
}

interface AIAssistantProps {
  sessionToken: string;
}

export default function AIAssistant({ sessionToken }: AIAssistantProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuestion(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const askQuestion = async (questionText: string) => {
    if (!questionText.trim()) return;

    setLoading(true);
    setCurrentAnswer('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AGENT_URL}?action=ask_assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            question: questionText,
            conversation_history: conversationHistory,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get answer from AI assistant');
      }

      const data = await response.json();
      const newMessage: Message = {
        question: questionText,
        answer: data.answer,
        timestamp: new Date(),
      };

      setConversationHistory((prev) => [...prev, newMessage]);
      setCurrentAnswer(data.answer);
      setQuestion('');
    } catch (error) {
      console.error('Error asking AI assistant:', error);
      setCurrentAnswer('Sorry, I encountered an error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askQuestion(question);
  };

  const quickQuestions = [
    "Who's my next appointment?",
    "What's tomorrow's schedule?",
    "Show me this week's bookings",
    "Do I have any unsynced appointments?",
    "Who are my most frequent clients?",
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">AI Assistant</h2>
        {conversationHistory.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        )}
      </div>

      {/* Conversation History */}
      {showHistory && conversationHistory.length > 0 && (
        <div className="mb-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Conversation History</h3>
          {conversationHistory.map((msg, idx) => (
            <div key={idx} className="mb-3 pb-3 border-b border-gray-100 last:border-0">
              <p className="text-sm text-gray-600 mb-1">
                <strong>You:</strong> {msg.question}
              </p>
              <p className="text-sm text-gray-800">
                <strong>AI:</strong> {msg.answer}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Current Answer */}
      {currentAnswer && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{currentAnswer}</p>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Quick Questions:</p>
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => askQuestion(q)}
              disabled={loading}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-[#cdf545] rounded-full transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask me anything about your bookings..."
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#cdf545] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={loading}
            className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              isListening
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={isListening ? 'Stop listening' : 'Start voice input'}
          >
            {isListening ? '⏹️' : '🎤'}
          </button>
        </div>
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="w-full bg-[#cdf545] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#b8e030] transition-colors disabled:opacity-50"
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>

      {isListening && (
        <p className="text-sm text-center text-gray-600 mt-2 animate-pulse">
          🎤 Listening...
        </p>
      )}
    </div>
  );
}

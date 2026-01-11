'use client';

import { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';

interface Message {
  question: string;
  answer: string;
  timestamp: Date;
}

interface AIAssistantVAPIProps {
  sessionToken: string;
  userId: string;
  userEmail: string;
}

export default function AIAssistantVAPI({ sessionToken, userId, userEmail }: AIAssistantVAPIProps) {
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  const vapiRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Function to load fresh calendar events from Google Calendar
  const loadCalendarEvents = async () => {
    try {
      setIsLoadingCalendar(true);
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);

      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      const mcpServerUrl = process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'https://salon-mcp-server-9yzw.onrender.com';

      console.log('📅 Loading fresh calendar events from Google Calendar...');
      const response = await fetch(`${mcpServerUrl}/api/get-calendar-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          user_id: userId,
          start_time: sevenDaysAgo.toISOString(),
          end_time: thirtyDaysFromNow.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch calendar events');
      }

      const data = await response.json();
      console.log('✅ Calendar events loaded:', data.events?.length || 0);
      setCalendarEvents(data.events || []);
      return data.events || [];
    } catch (error) {
      console.error('Error loading calendar events:', error);
      setCalendarEvents([]);
      return [];
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  // Initialize VAPI
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

      if (!publicKey) {
        console.error('VAPI public key not configured');
        return;
      }

      // Initialize VAPI client
      vapiRef.current = new Vapi(publicKey);

      // Event listeners
      vapiRef.current.on('call-start', () => {
        console.log('VAPI: Call started');
        setIsConnecting(false);
        setIsActive(true);
      });

      vapiRef.current.on('call-end', () => {
        console.log('VAPI: Call ended');
        setIsActive(false);
        setIsConnecting(false);
        setIsSpeaking(false);
        stopVisualization();
      });

      vapiRef.current.on('speech-start', () => {
        console.log('VAPI: User started speaking');
        setIsSpeaking(false); // User speaking, AI not speaking
      });

      vapiRef.current.on('speech-end', () => {
        console.log('VAPI: User stopped speaking');
      });

      vapiRef.current.on('message', (message: any) => {
        console.log('VAPI message:', message);

        // Handle transcripts
        if (message.type === 'transcript' && message.role === 'user') {
          setCurrentTranscript(message.transcript || '');
        }

        // Handle AI responses
        if (message.type === 'transcript' && message.role === 'assistant') {
          setIsSpeaking(true);

          // Add to conversation history
          if (currentTranscript && message.transcript) {
            const newMessage: Message = {
              question: currentTranscript,
              answer: message.transcript,
              timestamp: new Date(),
            };
            setConversationHistory((prev) => [...prev, newMessage]);
            setCurrentTranscript('');
          }
        }

        // Handle function calls
        if (message.type === 'function-call') {
          console.log('VAPI: Function called:', message.functionCall);
        }
      });

      vapiRef.current.on('volume-level', (level: number) => {
        setAudioLevel(level);
      });

      vapiRef.current.on('error', (error: any) => {
        console.error('VAPI error:', error);
        setIsConnecting(false);
        setIsActive(false);
      });
    }

    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const stopVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
  };

  const activateAssistant = async () => {
    if (!vapiRef.current) {
      alert('Voice assistant not initialized. Check console for errors.');
      return;
    }

    if (isActive || isConnecting) {
      // End the call
      vapiRef.current.stop();
      setIsActive(false);
      setIsConnecting(false);
      setIsSpeaking(false);
      stopVisualization();
    } else {
      // Start the call - ALWAYS load fresh calendar data first
      setIsConnecting(true);
      setCurrentTranscript('');

      try {
        // Get assistant ID from environment
        const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

        if (!assistantId) {
          throw new Error('VAPI assistant ID not configured');
        }

        // Load FRESH calendar events from Google Calendar
        console.log('🔄 Refreshing calendar from Google...');
        const freshEvents = await loadCalendarEvents();

        // Format calendar events for Diana's context
        const formattedEvents = freshEvents.map((event: any) => ({
          summary: event.summary,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          description: event.description,
          attendees: event.attendees?.map((a: any) => a.email),
        }));

        // Start call with assistant
        await vapiRef.current.start(assistantId, {
          // Pass session token and FRESH calendar events to Diana
          metadata: {
            sessionToken: sessionToken,
            userId: userId,
            userEmail: userEmail,
            calendarEvents: JSON.stringify(formattedEvents),
            totalEvents: formattedEvents.length,
          },
        });
      } catch (error) {
        console.error('Failed to start VAPI call:', error);
        alert('Failed to start voice assistant. Please try again.');
        setIsConnecting(false);
      }
    }
  };

  const quickQuestions = [
    "Who's my next appointment?",
    "What's tomorrow's schedule?",
    "Show me this week's bookings",
    "When did Sarah last come in?",
    "Do I have any conflicts?",
  ];

  const sendMessage = async (message: string) => {
    if (!vapiRef.current || !isActive) {
      // If not active, start the call first
      await activateAssistant();
      // Wait a bit for connection
      setTimeout(() => {
        vapiRef.current?.send({
          type: 'add-message',
          message: {
            role: 'user',
            content: message,
          },
        });
      }, 1000);
    } else {
      vapiRef.current.send({
        type: 'add-message',
        message: {
          role: 'user',
          content: message,
        },
      });
    }
  };

  const generateWaveBars = () => {
    const bars = [];
    const barCount = 5;
    for (let i = 0; i < barCount; i++) {
      const height = isActive
        ? Math.max(20, audioLevel * 100 + Math.random() * 30)
        : 20;
      bars.push(
        <div
          key={i}
          className="wave-bar"
          style={{
            height: `${height}px`,
            backgroundColor: isSpeaking ? '#000000' : isActive ? '#cdf545' : '#999999',
            width: '6px',
            borderRadius: '3px',
            margin: '0 3px',
            transition: 'height 0.1s ease',
          }}
        />
      );
    }
    return bars;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">AI Voice Assistant - Diana</h2>
        {conversationHistory.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        )}
      </div>

      {showHistory && conversationHistory.length > 0 && (
        <div className="mb-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Conversation History</h3>
          {conversationHistory.map((msg, idx) => (
            <div key={idx} className="mb-3 pb-3 border-b border-gray-100 last:border-0">
              <p className="text-sm text-gray-600 mb-1">
                <strong>You:</strong> {msg.question}
              </p>
              <p className="text-sm text-gray-800">
                <strong>Diana:</strong> {msg.answer}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center justify-center mb-6">
        <div className="relative mb-4">
          <button
            onClick={activateAssistant}
            disabled={isConnecting}
            className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
              isConnecting
                ? 'bg-gray-300 shadow-md cursor-wait'
                : isActive && !isSpeaking
                ? 'bg-[#cdf545] shadow-lg shadow-[#cdf545]/50 scale-110'
                : isActive && isSpeaking
                ? 'bg-black shadow-lg shadow-black/50 scale-110'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
            style={{
              boxShadow: isActive
                ? `0 0 ${30 + audioLevel * 50}px ${isSpeaking ? '#000000' : '#cdf545'}`
                : 'none',
            }}
          >
            <div className="flex items-center justify-center gap-1">
              {generateWaveBars()}
            </div>
          </button>
        </div>

        {isConnecting && (
          <p className="text-lg font-semibold text-gray-700 mb-2">
            Connecting...
          </p>
        )}
        {isActive && !isSpeaking && !isConnecting && (
          <p className="text-lg font-semibold text-gray-700 mb-2">
            Listening...
          </p>
        )}
        {isSpeaking && (
          <p className="text-lg font-semibold text-gray-700 mb-2">
            Diana is speaking...
          </p>
        )}
        {!isActive && !isConnecting && (
          <p className="text-sm text-gray-500 mb-2">
            Tap to start conversation with Diana
          </p>
        )}

        {currentTranscript && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg max-w-md">
            <p className="text-sm text-gray-700">{currentTranscript}</p>
          </div>
        )}
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Quick Questions:</p>
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(q)}
              disabled={isConnecting}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-[#cdf545] rounded-full transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <p className="text-xs text-purple-700">
          <strong>Powered by VAPI</strong> - Natural voice AI with ElevenLabs voice synthesis
        </p>
      </div>
    </div>
  );
}

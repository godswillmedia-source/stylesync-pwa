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
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Speech Recognition and Text-to-Speech
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Speech Recognition Setup
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setCurrentTranscript(transcript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            // Automatically restart if no speech detected
            if (isListening) {
              recognitionRef.current.start();
            }
          }
        };

        recognitionRef.current.onend = () => {
          // Auto-restart if still in listening mode
          if (isListening) {
            recognitionRef.current.start();
          }
        };
      }

      // Audio Context for visualization
      if ('AudioContext' in window || 'webkitAudioContext' in window) {
        const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Microphone visualization
  useEffect(() => {
    if (isListening && !isSpeaking) {
      startMicrophoneVisualization();
    } else {
      stopVisualization();
    }
  }, [isListening, isSpeaking]);

  const startMicrophoneVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (audioContextRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);

        const updateLevel = () => {
          if (analyserRef.current && isListening && !isSpeaking) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setAudioLevel(average / 255);
            animationFrameRef.current = requestAnimationFrame(updateLevel);
          }
        };
        updateLevel();
      }
    } catch (error) {
      console.error('Microphone access error:', error);
    }
  };

  const stopVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
  };

  const toggleVoiceMode = async () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      // Stop listening
      recognitionRef.current.stop();
      setIsListening(false);

      // Process the transcript if there's any
      if (currentTranscript.trim()) {
        await askQuestion(currentTranscript);
        setCurrentTranscript('');
      }
    } else {
      // Start listening
      setIsListening(true);
      setCurrentTranscript('');
      recognitionRef.current.start();
    }
  };

  const askQuestion = async (questionText: string) => {
    if (!questionText.trim()) return;

    setIsSpeaking(true);

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

      // Play OpenAI TTS audio if available, otherwise fallback to browser speech
      if (data.audio) {
        playAudio(data.audio);
      } else {
        speakAnswer(data.answer);
      }
    } catch (error) {
      console.error('Error asking AI assistant:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setCurrentAnswer(errorMsg);
      speakAnswer(errorMsg);
    }
  };

  const playAudio = (audioBase64: string) => {
    try {
      // Convert base64 to audio blob
      const audioData = atob(audioBase64);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and play audio element
      audioElementRef.current = new Audio(audioUrl);

      audioElementRef.current.onplay = () => {
        setIsSpeaking(true);
        simulateSpeakingAnimation();
      };

      audioElementRef.current.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      audioElementRef.current.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      audioElementRef.current.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsSpeaking(false);
    }
  };

  const speakAnswer = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
        simulateSpeakingAnimation();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  };

  const simulateSpeakingAnimation = () => {
    const animate = () => {
      if (isSpeaking) {
        setAudioLevel(Math.random() * 0.7 + 0.3);
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animate();
  };

  const quickQuestions = [
    "Who's my next appointment?",
    "What's tomorrow's schedule?",
    "Show me this week's bookings",
    "Do I have any unsynced appointments?",
    "Who are my most frequent clients?",
  ];

  // Generate wave bars based on audio level
  const generateWaveBars = () => {
    const bars = [];
    const barCount = 5;
    for (let i = 0; i < barCount; i++) {
      const height = isListening || isSpeaking
        ? Math.max(20, audioLevel * 100 + Math.random() * 30)
        : 20;
      bars.push(
        <div
          key={i}
          className="wave-bar"
          style={{
            height: `${height}px`,
            backgroundColor: isListening ? '#cdf545' : '#000000',
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
        <h2 className="text-2xl font-bold">AI Voice Assistant</h2>
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

      {/* Voice Orb with Animated Waves */}
      <div className="flex flex-col items-center justify-center mb-6">
        {/* Voice Orb */}
        <div className="relative mb-4">
          <button
            onClick={toggleVoiceMode}
            className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-[#cdf545] shadow-lg shadow-[#cdf545]/50 scale-110'
                : isSpeaking
                ? 'bg-black shadow-lg shadow-black/50 scale-110'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
            style={{
              boxShadow: (isListening || isSpeaking)
                ? `0 0 ${30 + audioLevel * 50}px ${isListening ? '#cdf545' : '#000000'}`
                : 'none',
            }}
          >
            <div className="flex items-center justify-center gap-1">
              {generateWaveBars()}
            </div>
          </button>
        </div>

        {/* Status Text */}
        {isListening && (
          <p className="text-lg font-semibold text-gray-700 mb-2">
            Listening...
          </p>
        )}
        {isSpeaking && (
          <p className="text-lg font-semibold text-gray-700 mb-2">
            Speaking...
          </p>
        )}
        {!isListening && !isSpeaking && (
          <p className="text-sm text-gray-500 mb-2">
            Tap to talk with AI assistant
          </p>
        )}

        {/* Current Transcript */}
        {currentTranscript && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg max-w-md">
            <p className="text-sm text-gray-700">{currentTranscript}</p>
          </div>
        )}

        {/* Current Answer */}
        {currentAnswer && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg max-w-md">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{currentAnswer}</p>
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Quick Questions:</p>
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => askQuestion(q)}
              disabled={isListening || isSpeaking}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-[#cdf545] rounded-full transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

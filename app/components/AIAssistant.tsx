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
  const [isActive, setIsActive] = useState(false);
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
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const greetingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            finalTranscriptRef.current = finalTranscript;
            setCurrentTranscript(finalTranscript);
            // Reset silence timer when user speaks
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            silenceTimerRef.current = setTimeout(() => {
              if (finalTranscriptRef.current.trim()) {
                const transcriptToProcess = finalTranscriptRef.current;
                finalTranscriptRef.current = '';
                setCurrentTranscript('');
                askQuestion(transcriptToProcess);
              }
            }, 2000);
          } else {
            setCurrentTranscript(interimTranscript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
        };

        recognitionRef.current.onend = () => {
          // Auto-restart is handled in askQuestion after AI finishes
        };
      }

      if ('AudioContext' in window || 'webkitAudioContext' in window) {
        const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (greetingTimerRef.current) {
        clearTimeout(greetingTimerRef.current);
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

  const activateAssistant = async () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isActive) {
      // Deactivate
      setIsActive(false);
      setIsListening(false);
      recognitionRef.current.stop();
      if (greetingTimerRef.current) {
        clearTimeout(greetingTimerRef.current);
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    } else {
      // Activate
      setIsActive(true);
      setIsListening(true);
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
      recognitionRef.current.start();

      // If user doesn't say anything in 3 seconds, greet them
      greetingTimerRef.current = setTimeout(() => {
        if (!finalTranscriptRef.current.trim()) {
          askQuestion('__greeting__');
        }
      }, 3000);
    }
  };

  const askQuestion = async (questionText: string) => {
    if (!questionText.trim() && questionText !== '__greeting__') return;

    // Clear any pending silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Cancel greeting timer if it's still running
    if (greetingTimerRef.current) {
      clearTimeout(greetingTimerRef.current);
      greetingTimerRef.current = null;
    }

    // Stop listening while processing
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }

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
            is_greeting: questionText === '__greeting__',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get answer from AI assistant');
      }

      const data = await response.json();

      if (questionText !== '__greeting__') {
        const newMessage: Message = {
          question: questionText,
          answer: data.answer,
          timestamp: new Date(),
        };
        setConversationHistory((prev) => [...prev, newMessage]);
      }

      setCurrentAnswer(data.answer);

      console.log('AI Response:', {
        hasAnswer: !!data.answer,
        hasAudio: !!data.audio,
        answerLength: data.answer?.length || 0,
      });

      // Try OpenAI TTS first, fallback to browser TTS
      if (data.audio) {
        console.log('Playing OpenAI TTS audio...');
        try {
          await playAudio(data.audio);
          console.log('OpenAI TTS playback completed');
        } catch (audioError) {
          console.error('OpenAI TTS failed, falling back to browser TTS:', audioError);
          await speakAnswer(data.answer);
        }
      } else {
        // No OpenAI audio - use browser TTS
        console.log('No OpenAI audio, using browser TTS...');
        await speakAnswer(data.answer);
      }
    } catch (error) {
      console.error('Error asking AI assistant:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setCurrentAnswer(errorMsg);
      await speakAnswer(errorMsg);
    } finally {
      // After AI finishes speaking, resume listening if still active
      setIsSpeaking(false);
      setCurrentAnswer('');
      if (isActive && recognitionRef.current) {
        try {
          setIsListening(true);
          finalTranscriptRef.current = '';
          setCurrentTranscript('');
          recognitionRef.current.start();
        } catch (e) {
          console.error('Error restarting recognition:', e);
        }
      }
    }
  };

  const playAudio = (audioBase64: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const audioData = atob(audioBase64);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);

        audioElementRef.current = new Audio(audioUrl);

        audioElementRef.current.onplay = () => {
          simulateSpeakingAnimation();
        };

        audioElementRef.current.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audioElementRef.current.onerror = (e) => {
          console.error('Audio element error:', e);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        // Play with error handling
        audioElementRef.current.play().catch((playError) => {
          console.error('Audio play error:', playError);
          // Fallback to browser TTS if audio fails
          resolve();
        });
      } catch (error) {
        console.error('Audio playback error:', error);
        resolve();
      }
    });
  };

  const speakAnswer = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; // Professional, clear pace
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => {
          simulateSpeakingAnimation();
        };

        utterance.onend = () => {
          resolve();
        };

        utterance.onerror = () => {
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
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

      <div className="flex flex-col items-center justify-center mb-6">
        <div className="relative mb-4">
          <button
            onClick={activateAssistant}
            className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-[#cdf545] shadow-lg shadow-[#cdf545]/50 scale-110'
                : isSpeaking
                ? 'bg-black shadow-lg shadow-black/50 scale-110'
                : isActive
                ? 'bg-gray-300 shadow-md'
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
        {!isActive && !isListening && !isSpeaking && (
          <p className="text-sm text-gray-500 mb-2">
            Tap to start conversation
          </p>
        )}

        {currentTranscript && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg max-w-md">
            <p className="text-sm text-gray-700">{currentTranscript}</p>
          </div>
        )}

        {/* Temporary debug display - shows response is received */}
        {currentAnswer && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg max-w-md">
            <p className="text-xs text-blue-600">Speaking: {currentAnswer}</p>
          </div>
        )}
      </div>

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

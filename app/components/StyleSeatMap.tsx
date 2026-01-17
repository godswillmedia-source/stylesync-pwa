'use client';

import { useEffect, useState } from 'react';

interface RawMessage {
  id: string;
  raw_content: string;
  sender: string;
  message_type: string | null;
  ai_confidence: number | null;
  action_taken: string | null;
  processed: boolean;
  created_at: string;
}

interface MessageStats {
  total: number;
  processed: number;
  pending: number;
  byType: Record<string, number>;
}

interface StyleSeatMapProps {
  userEmail: string;
}

export default function StyleSeatMap({ userEmail }: StyleSeatMapProps) {
  const [messages, setMessages] = useState<RawMessage[]>([]);
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
  }, [userEmail]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/messages?user=${encodeURIComponent(userEmail)}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case 'new_booking': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancellation': return 'bg-red-100 text-red-800 border-red-200';
      case 'reschedule': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'reminder': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmation': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'other': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getTypeIcon = (type: string | null) => {
    switch (type) {
      case 'new_booking': return '📅';
      case 'cancellation': return '❌';
      case 'reschedule': return '🔄';
      case 'reminder': return '⏰';
      case 'confirmation': return '✓';
      case 'other': return '📝';
      default: return '⏳';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredMessages = selectedType
    ? messages.filter(m => m.message_type === selectedType)
    : messages;

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>📊</span> StyleSeat Activity
        </h2>
        <button
          onClick={fetchMessages}
          className="text-sm text-primary hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-gray-600">Total Messages</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.byType?.new_booking || 0}</div>
            <div className="text-xs text-gray-600">Bookings</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{stats.byType?.cancellation || 0}</div>
            <div className="text-xs text-gray-600">Cancellations</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-700">{stats.byType?.reschedule || 0}</div>
            <div className="text-xs text-gray-600">Reschedules</div>
          </div>
        </div>
      )}

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedType(null)}
          className={`px-3 py-1 text-sm rounded-full border transition-colors ${
            selectedType === null
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        {['new_booking', 'cancellation', 'reschedule', 'reminder', 'confirmation', 'other'].map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              selectedType === type
                ? 'bg-primary text-white border-primary'
                : `${getTypeColor(type)} hover:opacity-80`
            }`}
          >
            {getTypeIcon(type)} {type.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Message Timeline */}
      {filteredMessages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No messages yet</p>
          <p className="text-sm mt-1">SMS messages will appear here once received</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg border ${getTypeColor(msg.message_type)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getTypeIcon(msg.message_type)}</span>
                    <span className="font-medium capitalize">
                      {msg.message_type?.replace('_', ' ') || 'Processing...'}
                    </span>
                    {msg.ai_confidence && (
                      <span className="text-xs opacity-70">
                        {Math.round(msg.ai_confidence * 100)}% confident
                      </span>
                    )}
                  </div>
                  <p className="text-sm truncate opacity-80">{msg.raw_content}</p>
                </div>
                <div className="text-xs text-right whitespace-nowrap">
                  <div>{formatTime(msg.created_at)}</div>
                  {msg.action_taken && (
                    <div className="mt-1 opacity-70">{msg.action_taken.replace('_', ' ')}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Indicator */}
      {stats && stats.pending > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <span className="animate-pulse">⏳</span>
          <span className="text-sm text-yellow-800">
            {stats.pending} message{stats.pending > 1 ? 's' : ''} pending AI classification
          </span>
        </div>
      )}
    </div>
  );
}

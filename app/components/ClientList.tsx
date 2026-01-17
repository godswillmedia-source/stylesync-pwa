'use client';

import { useEffect, useState } from 'react';

interface Client {
  id: string;
  canonical_name: string;
  aliases: string[];
  booking_count: number;
  cancellation_count: number;
  no_show_count: number;
  total_spend: number;
  first_seen: string;
  last_seen: string;
}

interface ClientListProps {
  userEmail: string;
}

export default function ClientList({ userEmail }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'recent' | 'bookings' | 'cancellations'>('recent');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchClients();
  }, [userEmail]);

  const fetchClients = async () => {
    try {
      const response = await fetch(`/api/clients?user=${encodeURIComponent(userEmail)}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCancellationRate = (client: Client) => {
    const total = client.booking_count + client.cancellation_count;
    if (total === 0) return 0;
    return (client.cancellation_count / total) * 100;
  };

  const getClientStatus = (client: Client) => {
    const cancellationRate = getCancellationRate(client);
    if (cancellationRate > 30) return { label: 'High Risk', color: 'text-red-600 bg-red-50' };
    if (client.booking_count >= 5) return { label: 'Loyal', color: 'text-green-600 bg-green-50' };
    if (client.booking_count >= 2) return { label: 'Regular', color: 'text-blue-600 bg-blue-50' };
    return { label: 'New', color: 'text-gray-600 bg-gray-50' };
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const sortedClients = [...clients].sort((a, b) => {
    switch (sortBy) {
      case 'bookings':
        return b.booking_count - a.booking_count;
      case 'cancellations':
        return getCancellationRate(b) - getCancellationRate(a);
      case 'recent':
      default:
        return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
    }
  });

  const filteredClients = sortedClients.filter(client =>
    client.canonical_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.aliases?.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Stats summary
  const totalClients = clients.length;
  const loyalClients = clients.filter(c => c.booking_count >= 5).length;
  const riskClients = clients.filter(c => getCancellationRate(c) > 30).length;

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
          <span>👥</span> Clients
        </h2>
        <button
          onClick={fetchClients}
          className="text-sm text-primary hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{totalClients}</div>
          <div className="text-xs text-gray-600">Total Clients</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{loyalClients}</div>
          <div className="text-xs text-gray-600">Loyal (5+ bookings)</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-700">{riskClients}</div>
          <div className="text-xs text-gray-600">High Risk</div>
        </div>
      </div>

      {/* Search and Sort */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="recent">Most Recent</option>
          <option value="bookings">Most Bookings</option>
          <option value="cancellations">Cancellation Rate</option>
        </select>
      </div>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No clients found</p>
          <p className="text-sm mt-1">Clients will appear here as bookings are processed</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredClients.map((client) => {
            const status = getClientStatus(client);
            const cancellationRate = getCancellationRate(client);

            return (
              <div
                key={client.id}
                className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{client.canonical_name}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    {client.aliases && client.aliases.length > 0 && (
                      <p className="text-xs text-gray-500 mb-1">
                        Also: {client.aliases.join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span title="Bookings">📅 {client.booking_count}</span>
                      <span title="Cancellations">❌ {client.cancellation_count}</span>
                      {client.no_show_count > 0 && (
                        <span title="No-shows" className="text-red-600">⚠️ {client.no_show_count}</span>
                      )}
                      {cancellationRate > 0 && (
                        <span title="Cancellation rate" className={cancellationRate > 30 ? 'text-red-600' : ''}>
                          ({Math.round(cancellationRate)}% cancel rate)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>Last: {formatDate(client.last_seen)}</div>
                    <div className="opacity-70">Since: {formatDate(client.first_seen)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <p className="text-xs text-purple-800">
          <strong>Tip:</strong> Clients are automatically tracked from your StyleSeat messages.
          Ask Diana about any client: "Tell me about Sarah Johnson"
        </p>
      </div>
    </div>
  );
}

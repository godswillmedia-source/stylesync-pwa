'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Booking {
  id: string;
  customer_name: string;
  service: string;
  appointment_time: string;
  synced: boolean;
  sync_method?: string;
  review_required?: boolean;
}

export default function Dashboard() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    const sessionToken = localStorage.getItem('session_token');
    const email = localStorage.getItem('user_email');

    if (!sessionToken) {
      router.push('/');
      return;
    }

    setUserEmail(email || '');

    // Check for successful payment
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setShowSuccessMessage(true);
      // Clean up URL
      window.history.replaceState({}, document.title, '/dashboard');
      // Hide message after 5 seconds
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }

    fetchBookings();
  }, [router]);

  const fetchBookings = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AGENT_URL}?action=bookings`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const { bookings } = await response.json();
      setBookings(bookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);

    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AGENT_URL}?action=sync`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const { synced_count, total_processed } = await response.json();

      alert(`Synced ${synced_count} of ${total_processed} bookings!`);
      await fetchBookings(); // Refresh list
    } catch (error) {
      console.error('Sync error:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-primary">StyleSync</h1>
            <p className="text-sm text-gray-600">{userEmail}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/settings')}
              className="btn-secondary text-sm py-2"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <h3 className="font-bold text-green-800">Subscription Activated!</h3>
                <p className="text-sm text-green-700">
                  Welcome to StyleSync Pro! Your subscription is now active.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSuccessMessage(false)}
              className="text-green-600 hover:text-green-800 text-xl"
            >
              ×
            </button>
          </div>
        )}

        {/* Sync Button */}
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Your Bookings</h2>
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="btn-primary flex items-center gap-2"
          >
            {isSyncing ? (
              <>
                <div className="spinner w-5 h-5 border-2"></div>
                Syncing...
              </>
            ) : (
              <>
                <span>🔄</span>
                Sync Now
              </>
            )}
          </button>
        </div>

        {/* Bookings List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-600 mb-4">
              No bookings yet. Click "Sync Now" to fetch your bookings!
            </p>
            <p className="text-sm text-gray-500">
              Make sure you have booking emails in your Gmail inbox.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="card flex justify-between items-start hover:shadow-lg transition-shadow"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold">
                      {booking.customer_name}
                    </h3>
                    {booking.synced ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        ✓ Synced
                      </span>
                    ) : booking.review_required ? (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                        ⚠ Review Needed
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-1">{booking.service}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(booking.appointment_time)}
                  </p>
                </div>
                <div className="text-right">
                  {booking.sync_method === 'auto' && (
                    <span className="text-xs text-green-600">Auto-synced</span>
                  )}
                  {booking.review_required && (
                    <button className="text-sm text-primary hover:underline">
                      Review →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 card bg-purple-50 border border-purple-200">
          <h3 className="font-semibold mb-2">💡 How it works</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• StyleSync monitors your email automatically</li>
            <li>• New bookings are parsed and synced to your calendar</li>
            <li>• High-confidence bookings are auto-synced instantly</li>
            <li>• Unclear bookings are flagged for your review</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

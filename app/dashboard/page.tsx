'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AIAssistantVAPI from '../components/AIAssistantVAPI';

interface Booking {
  id: string;
  customer_name: string;
  service: string;
  appointment_time: string;
  synced: boolean;
  sync_method?: string;
  review_required?: boolean;
  review_reason?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [editedBooking, setEditedBooking] = useState<Booking | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    const email = localStorage.getItem('user_email');
    const storedUserId = localStorage.getItem('user_id');

    if (!token) {
      router.push('/');
      return;
    }

    setSessionToken(token);
    setUserEmail(email || '');
    setUserId(storedUserId || '');

    // Check for successful payment
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setShowSuccessMessage(true);
      // Clean up URL
      window.history.replaceState({}, document.title, '/dashboard');
      // Hide message after 5 seconds
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }

    // Verify payment status before loading dashboard
    verifyPaymentStatus();
  }, [router]);

  const verifyPaymentStatus = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AGENT_URL}?action=check_subscription`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check subscription');
      }

      const { subscription_status, trial_active } = await response.json();

      // Redirect to payment if not subscribed and no trial
      if (subscription_status !== 'active' && !trial_active) {
        router.push('/payment');
        return;
      }

      // Load bookings if payment verified
      fetchBookings();
    } catch (error) {
      console.error('Error verifying payment:', error);
      // On error, redirect to payment page to be safe
      router.push('/payment');
    }
  };

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
      const mcpServerUrl = process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'https://salon-mcp-server-9yzw.onrender.com';

      // Step 1: Sync bookings from email
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Sync error response:', errorData);
        throw new Error(errorData.error || 'Sync failed');
      }

      const { synced_count, total_processed } = await response.json();

      // Step 2: Force refresh calendar cache from Google Calendar
      console.log('🔄 Refreshing calendar cache...');
      const cacheResponse = await fetch(`${mcpServerUrl}/api/refresh-calendar-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: userEmail,
        }),
      });

      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        console.log(`✅ Calendar cache refreshed: ${cacheData.event_count} events`);
      }

      if (total_processed === 0) {
        alert('No new booking emails found. Calendar cache refreshed!');
      } else {
        alert(`Synced ${synced_count} of ${total_processed} bookings and refreshed calendar!`);
      }
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

  const handleReviewClick = (booking: Booking) => {
    setReviewingBooking(booking);
    setEditedBooking({ ...booking });
  };

  const handleApproveBooking = async () => {
    if (!editedBooking) return;

    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AGENT_URL}?action=approve_booking`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            booking_id: editedBooking.id,
            customer_name: editedBooking.customer_name,
            service: editedBooking.service,
            appointment_time: editedBooking.appointment_time,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to approve booking');
      }

      alert('Booking approved and synced to calendar!');
      setReviewingBooking(null);
      await fetchBookings();
    } catch (error) {
      console.error('Error approving booking:', error);
      alert('Failed to approve booking. Please try again.');
    }
  };

  const handleRejectBooking = async () => {
    if (!reviewingBooking) return;

    if (!confirm('Are you sure you want to reject this booking?')) {
      return;
    }

    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AGENT_URL}?action=reject_booking`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            booking_id: reviewingBooking.id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reject booking');
      }

      alert('Booking rejected and removed.');
      setReviewingBooking(null);
      await fetchBookings();
    } catch (error) {
      console.error('Error rejecting booking:', error);
      alert('Failed to reject booking. Please try again.');
    }
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

        {/* AI Assistant */}
        <div className="mb-8">
          <AIAssistantVAPI sessionToken={sessionToken} userId={userId} userEmail={userEmail} />
        </div>

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
                    <button
                      onClick={() => handleReviewClick(booking)}
                      className="text-sm text-primary hover:underline"
                    >
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

      {/* Review Modal */}
      {reviewingBooking && editedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Review Booking</h2>

            {/* Conflict Warning */}
            {reviewingBooking.review_reason && (
              <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="font-bold text-yellow-800 mb-1">Review Required</h3>
                    <p className="text-sm text-yellow-700">{reviewingBooking.review_reason}</p>
                    {reviewingBooking.review_reason.toLowerCase().includes('conflict') && (
                      <p className="text-xs text-yellow-600 mt-2">
                        If you approve this booking, it will create an overlapping calendar event. Make sure this is intentional!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={editedBooking.customer_name}
                  onChange={(e) =>
                    setEditedBooking({ ...editedBooking, customer_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service
                </label>
                <input
                  type="text"
                  value={editedBooking.service}
                  onChange={(e) =>
                    setEditedBooking({ ...editedBooking, service: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Time
                </label>
                <input
                  type="datetime-local"
                  value={editedBooking.appointment_time.slice(0, 16)}
                  onChange={(e) =>
                    setEditedBooking({
                      ...editedBooking,
                      appointment_time: new Date(e.target.value).toISOString(),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApproveBooking}
                className="flex-1 btn-primary"
              >
                ✓ Approve & Sync
              </button>
              <button
                onClick={handleRejectBooking}
                className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
              >
                ✗ Reject
              </button>
              <button
                onClick={() => setReviewingBooking(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

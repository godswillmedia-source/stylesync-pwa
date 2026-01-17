'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || '');

export default function Settings() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('trial');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (!response.ok) {
          router.push('/');
          return;
        }

        const { authenticated, user_email } = await response.json();
        if (!authenticated) {
          router.push('/');
          return;
        }

        setUserEmail(user_email || '');

        // Fetch subscription status from agent
        fetchSubscriptionStatus();
      } catch {
        router.push('/');
      }
    };

    checkSession();
  }, [router]);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/proxy?action=subscription');

      if (response.ok) {
        const data = await response.json();
        setSubscriptionStatus(data.subscription_status || 'trial');
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    }
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect your account?')) {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-primary hover:underline"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Account Section */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Account</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600">Email</label>
              <p className="font-semibold">{userEmail}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Status</label>
              <p className="font-semibold capitalize">{subscriptionStatus}</p>
            </div>
          </div>
        </div>

        {/* Subscription Section */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Subscription</h2>

          {subscriptionStatus === 'trial' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-amber-800 font-semibold mb-2">
                7-Day Free Trial
              </p>
              <p className="text-sm text-amber-700">
                Your trial is active. Subscribe now for $9.99/month to continue after the trial ends.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">StyleSync Pro</h3>
                <p className="text-sm text-gray-600">
                  Unlimited bookings, automatic sync
                </p>
              </div>
              <p className="text-2xl font-bold text-primary">
                $9.99<span className="text-sm text-gray-600">/mo</span>
              </p>
            </div>

            {subscriptionStatus === 'trial' && (
              <button
                onClick={handleSubscribe}
                disabled={isProcessing}
                className="btn-primary w-full"
              >
                {isProcessing ? 'Processing...' : 'Subscribe Now'}
              </button>
            )}

            {subscriptionStatus === 'active' && (
              <div className="text-center py-4">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full">
                  <span>✓</span>
                  Active Subscription
                </span>
                <p className="text-sm text-gray-600 mt-2">
                  Next billing date: {/* TODO: Add date */}
                </p>
                <button className="text-sm text-red-600 hover:underline mt-2">
                  Cancel subscription
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Preferences Section */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Preferences</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">Auto-sync confidence threshold</h3>
                <p className="text-sm text-gray-600">
                  Minimum confidence for automatic syncing
                </p>
              </div>
              <select className="border rounded px-3 py-2">
                <option value="0.95">95% (Recommended)</option>
                <option value="0.90">90%</option>
                <option value="0.85">85%</option>
              </select>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">Email notifications</h3>
                <p className="text-sm text-gray-600">
                  Get notified when bookings need review
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card border border-red-200">
          <h2 className="text-xl font-bold mb-4 text-red-600">Danger Zone</h2>
          <div className="space-y-3">
            <button
              onClick={handleDisconnect}
              className="w-full text-left px-4 py-3 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              <h3 className="font-semibold text-red-600">Disconnect Account</h3>
              <p className="text-sm text-gray-600">
                Remove access to your email and calendar
              </p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

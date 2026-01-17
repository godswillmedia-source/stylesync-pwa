'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function Payment() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        // Check session via cookie
        const sessionResponse = await fetch('/api/auth/session');
        if (!sessionResponse.ok) {
          router.push('/');
          return;
        }

        const { authenticated, user_email } = await sessionResponse.json();
        if (!authenticated) {
          router.push('/');
          return;
        }

        setUserEmail(user_email || '');

        // Check if user already has active subscription
        const mcpServerUrl = process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'https://salon-mcp-server.onrender.com';
        const response = await fetch(
          `${mcpServerUrl}/api/get-user-subscription`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_email }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          // If user has active or trialing subscription, redirect to dashboard
          if (data.subscription_status === 'active' || data.subscription_status === 'trialing') {
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        // Continue to payment page if check fails
      }
    };

    checkSubscription();
  }, [router]);

  const handlePayment = async () => {
    setIsLoading(true);

    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      // Create checkout session via proxy (token in httpOnly cookie)
      const response = await fetch('/api/proxy?action=create_checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const result = await stripe.redirectToCheckout({ sessionId });

      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Complete Your Setup
          </h1>
          <p className="text-gray-600">
            Start your 7-day free trial
          </p>
        </div>

        {/* Pricing Card */}
        <div className="card">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold mb-2">
              $10
              <span className="text-2xl text-gray-600 font-normal">/month</span>
            </div>
            <p className="text-sm text-gray-600">
              7-day free trial • Cancel anytime
            </p>
          </div>

          {/* What's Included */}
          <div className="mb-8 space-y-3">
            <h3 className="font-semibold text-lg mb-4">What's included:</h3>
            <div className="flex items-center gap-3">
              <span className="text-xl">✓</span>
              <span>Unlimited booking syncs</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">✓</span>
              <span>AI-powered email parsing</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">✓</span>
              <span>Automatic calendar updates</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">✓</span>
              <span>Manual review for uncertain bookings</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">✓</span>
              <span>Email and calendar support</span>
            </div>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={isLoading}
            className="w-full btn-primary py-4 text-lg"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="spinner w-5 h-5 border-2"></div>
                Processing...
              </div>
            ) : (
              'Start Free Trial'
            )}
          </button>

          {/* Fine Print */}
          <div className="mt-6 text-center text-xs text-gray-500 space-y-1">
            <p>You won't be charged during your 7-day trial.</p>
            <p>After the trial, you'll be charged $10/month.</p>
            <p>Cancel anytime from your dashboard settings.</p>
          </div>
        </div>

        {/* Account Info */}
        {userEmail && (
          <p className="text-center text-sm text-gray-600 mt-4">
            Signing up as: <span className="font-semibold">{userEmail}</span>
          </p>
        )}
      </div>
    </div>
  );
}

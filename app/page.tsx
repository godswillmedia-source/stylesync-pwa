'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      router.push('/dashboard');
    }

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      handleOAuthCallback(code);
    }
  }, [router]);

  const handleGoogleLogin = () => {
    setIsLoading(true);

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    // Redirect to Google OAuth
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const handleOAuthCallback = async (code: string) => {
    setIsLoading(true);

    try {
      // Exchange code for tokens via agent
      const agentResponse = await fetch(
        `${process.env.NEXT_PUBLIC_AGENT_URL}?action=register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/`,
          }),
        }
      );

      if (!agentResponse.ok) {
        const error = await agentResponse.json();
        throw new Error(error.error || 'Registration failed');
      }

      const { user_id, session_token, is_new_user, email } = await agentResponse.json();

      // Store session
      localStorage.setItem('session_token', session_token);
      localStorage.setItem('user_id', user_id);
      localStorage.setItem('user_email', email);

      // Clean URL and redirect
      window.history.replaceState({}, document.title, '/');
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      alert(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again.`);
      // Clean URL
      window.history.replaceState({}, document.title, '/');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-primary mb-2">
            StyleSync
          </h1>
          <p className="text-gray-600 text-lg">
            Automatic salon booking sync
          </p>
        </div>

        {/* Main Card */}
        <div className="card text-center">
          <h2 className="text-2xl font-bold mb-4">
            Never Miss an Appointment
          </h2>
          <p className="text-gray-600 mb-6">
            Automatically sync your salon bookings from email to Google Calendar.
            <br />
            <span className="text-sm font-semibold text-primary">
              $10/month after 7-day trial
            </span>
          </p>

          {/* Features */}
          <div className="text-left mb-8 space-y-3">
            <div className="flex items-start">
              <span className="text-2xl mr-3">📧</span>
              <div>
                <h3 className="font-semibold">Auto Email Monitoring</h3>
                <p className="text-sm text-gray-600">
                  Watches your email for new bookings
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-2xl mr-3">🤖</span>
              <div>
                <h3 className="font-semibold">Smart AI Parsing</h3>
                <p className="text-sm text-gray-600">
                  Adapts to any email format
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-2xl mr-3">📅</span>
              <div>
                <h3 className="font-semibold">Instant Calendar Sync</h3>
                <p className="text-sm text-gray-600">
                  Creates calendar events automatically
                </p>
              </div>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <div className="flex flex-col items-center">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="spinner"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <>
                <button
                  onClick={handleGoogleLogin}
                  className="flex items-center gap-3 bg-white border-2 border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm mb-4"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </button>
                <p className="text-xs text-gray-500">
                  By signing in, you agree to our Terms and Privacy Policy
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Built for stylists, by stylists
        </p>
      </div>
    </div>
  );
}

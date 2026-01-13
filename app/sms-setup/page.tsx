'use client';

import IOSShortcutSetup from '../components/IOSShortcutSetup';

export default function SMSSetupPage() {
  // For testing, use hardcoded values
  // In production, get from session/auth
  const userId = 'test-123';
  const userEmail = 'test@example.com';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            iOS SMS Auto-Sync Setup
          </h1>
          <p className="text-gray-600">
            Automatically forward StyleSeat booking SMS to your calendar
          </p>
        </div>

        <IOSShortcutSetup userId={userId} userEmail={userEmail} />

        <div className="mt-8 text-center">
          <a
            href="/dashboard"
            className="text-primary hover:underline"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

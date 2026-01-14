'use client';

import { useState } from 'react';

interface IOSShortcutSetupProps {
  userId: string;
  userEmail: string;
}

export default function IOSShortcutSetup({ userId, userEmail }: IOSShortcutSetupProps) {
  const [copied, setCopied] = useState(false);
  const [showDetailedGuide, setShowDetailedGuide] = useState(false);

  // Generate unique webhook URL for this user (batch endpoint)
  const webhookURL = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms-webhook/batch?user=${userId}`;

  // iCloud share link for the master shortcut (you'll replace this after creating it)
  const iCloudShareLink = 'https://www.icloud.com/shortcuts/YOUR-SHORTCUT-ID'; // TODO: Replace with actual iCloud link

  const copyWebhookURL = () => {
    navigator.clipboard.writeText(webhookURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            📱 iOS Booking Sync
          </h2>
          <p className="text-gray-600">
            Tap one button to sync all your StyleSeat bookings to your calendar
          </p>
        </div>

        {/* Quick Setup Section */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            ⚡ Quick Setup (30 seconds)
          </h3>

          {/* Step 1: Add Shortcut */}
          <div className="mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Add Shortcut to Your iPhone
                </h4>
                <a
                  href={iCloudShareLink}
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  📥 Add iOS Shortcut
                </a>
                <p className="text-sm text-gray-600 mt-2">
                  Opens in Shortcuts app → Tap "Add Shortcut"
                </p>
              </div>
            </div>
          </div>

          {/* Step 2: Copy Your Webhook URL */}
          <div className="mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Copy Your Personal Webhook URL
                </h4>
                <div className="flex items-center gap-2 mb-2">
                  <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-xs font-mono text-gray-800 overflow-x-auto">
                    {webhookURL}
                  </code>
                  <button
                    onClick={copyWebhookURL}
                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors whitespace-nowrap text-sm"
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  You'll paste this into the shortcut in the next step
                </p>
              </div>
            </div>
          </div>

          {/* Step 3: Edit URL in Shortcut */}
          <div className="mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Edit the URL in Your Shortcut
                </h4>
                <ol className="text-sm text-gray-700 space-y-1 list-inside">
                  <li>1. Open the Shortcuts app</li>
                  <li>2. Find "Sync StyleSeat Bookings"</li>
                  <li>3. Tap the "..." menu → Edit</li>
                  <li>4. Find the "Get Contents of URL" action</li>
                  <li>5. Replace the placeholder URL with YOUR URL (paste)</li>
                  <li>6. Tap Done</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Step 4: Done */}
          <div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                ✓
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Done! Go Sync Your Bookings
                </h4>
                <p className="text-sm text-gray-600">
                  Head to your Dashboard and tap "Sync SMS" to sync all StyleSeat messages
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Your Webhook URL */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Your Unique Webhook URL:
          </h4>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono text-gray-800 overflow-x-auto">
              {webhookURL}
            </code>
            <button
              onClick={copyWebhookURL}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Keep this URL private - it's unique to your account
          </p>
        </div>

        {/* Troubleshooting */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-yellow-900 mb-2">
            ⚠️ Important Notes:
          </h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• The shortcut syncs all StyleSeat messages from the last 90 days</li>
            <li>• Already-synced bookings are automatically skipped (no duplicates)</li>
            <li>• Your iPhone must have internet connection for sync to work</li>
            <li>• First time may ask for permission - tap "Allow"</li>
            <li>• Sync manually whenever you receive a new booking SMS</li>
          </ul>
        </div>

        {/* Detailed Guide Toggle */}
        <button
          onClick={() => setShowDetailedGuide(!showDetailedGuide)}
          className="text-blue-600 hover:text-blue-700 font-medium mb-4"
        >
          {showDetailedGuide ? '▼ Hide' : '▶'} Detailed Manual Setup Instructions
        </button>

        {/* Detailed Guide (Collapsible) */}
        {showDetailedGuide && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-6">
            <h3 className="font-semibold text-gray-900">How It Works</h3>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">What Happens When You Sync</h4>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2">
                <li>You tap <strong>"Sync Bookings"</strong> in your Dashboard</li>
                <li>iOS opens the Shortcuts app and runs your shortcut</li>
                <li>The shortcut <strong>finds all messages containing "StyleSeat:"</strong> from the last 90 days</li>
                <li>It <strong>extracts the text</strong> from each message</li>
                <li>It <strong>sends them all</strong> to your personal webhook in one batch</li>
                <li>Our server <strong>parses each booking</strong> (customer name, service, date, time)</li>
                <li>Already-synced bookings are <strong>automatically skipped</strong> (no duplicates)</li>
                <li>New bookings are <strong>saved to your calendar</strong></li>
                <li>You see a <strong>confirmation:</strong> "5 new bookings synced, 3 already existed"</li>
              </ol>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Why Manual Sync?</h4>
              <p className="text-sm text-blue-800 mb-2">
                iOS doesn't allow background network requests from automated shortcuts. By making it manual:
              </p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>✅ Full network permissions (no silent failures)</li>
                <li>✅ You control when sync happens</li>
                <li>✅ Batch syncs all messages at once (faster)</li>
                <li>✅ See immediate confirmation</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Deduplication</h4>
              <p className="text-sm text-gray-700 mb-2">
                Each message gets a unique fingerprint (hash). Even if you sync 100 times, each booking only gets saved once.
              </p>
              <p className="text-sm text-gray-600">
                So tap "Sync Bookings" as often as you want - daily, after each booking SMS, or whenever you remember. It's safe.
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded p-4">
              <p className="text-sm font-semibold text-green-900">💡 Pro Tip</p>
              <p className="text-sm text-green-700">
                Sync once a day in the morning. Takes 3 seconds, ensures all bookings are in your calendar.
              </p>
            </div>
          </div>
        )}

        {/* Video Guide */}
        <div className="mt-6 text-center">
          <a
            href="#"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            📺 Watch Video Tutorial (Coming Soon)
          </a>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

interface IOSShortcutSetupProps {
  userId: string;
  userEmail: string;
}

export default function IOSShortcutSetup({ userId, userEmail }: IOSShortcutSetupProps) {
  const [copied, setCopied] = useState(false);
  const [showDetailedGuide, setShowDetailedGuide] = useState(false);

  // Generate unique webhook URL for this user
  const webhookURL = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms-webhook?user=${userId}`;

  // Shortcut download URL (we'll create this file)
  const shortcutURL = `${process.env.NEXT_PUBLIC_APP_URL}/shortcuts/stylesync-sms-forwarder.shortcut`;

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
            📱 iOS Automatic SMS Sync
          </h2>
          <p className="text-gray-600">
            Set up automatic booking sync from StyleSeat SMS messages
          </p>
        </div>

        {/* Quick Setup Section */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            ⚡ Quick Setup (2 minutes)
          </h3>

          {/* Step 1: Download Shortcut */}
          <div className="mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Download Pre-Configured Shortcut
                </h4>
                <a
                  href={shortcutURL}
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  📥 Download iOS Shortcut
                </a>
                <p className="text-sm text-gray-600 mt-2">
                  This will open the Shortcuts app with everything pre-filled
                </p>
              </div>
            </div>
          </div>

          {/* Step 2: Add Shortcut */}
          <div className="mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Tap "Add Untrusted Shortcut"
                </h4>
                <p className="text-sm text-gray-600">
                  When prompted, tap "Add Untrusted Shortcut" to install
                </p>
              </div>
            </div>
          </div>

          {/* Step 3: Done */}
          <div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                ✓
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Done! Test It
                </h4>
                <p className="text-sm text-gray-600">
                  Send yourself a test SMS with the word "booking" to verify it works
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
            <li>• Make sure "Ask Before Running" is turned OFF in the automation settings</li>
            <li>• The keyword trigger is set to "booking" - all SMS containing this word will sync</li>
            <li>• Your iPhone must have internet connection for sync to work</li>
            <li>• First time may ask for permission - tap "Allow"</li>
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
            <h3 className="font-semibold text-gray-900">Manual Setup (if download doesn't work)</h3>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Step 1: Create Automation</h4>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                <li>Open the <strong>Shortcuts</strong> app</li>
                <li>Tap the <strong>Automation</strong> tab (bottom of screen)</li>
                <li>Tap <strong>+</strong> (top right corner)</li>
                <li>Tap <strong>Create Personal Automation</strong></li>
                <li>Scroll down and select <strong>Message</strong></li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Step 2: Configure Trigger</h4>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                <li>Leave "Sender" as <strong>Anybody</strong></li>
                <li>Tap <strong>Message Contains</strong></li>
                <li>Enter: <code className="bg-gray-200 px-2 py-1 rounded">booking</code></li>
                <li>Tap <strong>Next</strong></li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Step 3: Add Webhook Action</h4>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                <li>Search for and add <strong>Get Contents of URL</strong></li>
                <li>Paste your webhook URL (from above)</li>
                <li>Tap <strong>Show More</strong></li>
                <li>Change <strong>Method</strong> to <strong>POST</strong></li>
                <li>Change <strong>Request Body</strong> to <strong>JSON</strong></li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Step 4: Configure JSON</h4>
              <p className="text-sm text-gray-700 mb-2">Enter this JSON structure:</p>
              <pre className="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`{
  "sender": "Shortcut Input > Sender",
  "message": "Shortcut Input > Body",
  "timestamp": "Current Date"
}`}
              </pre>
              <p className="text-sm text-gray-600 mt-2">
                Tap in each value field and select variables from the menu
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Step 5: Enable Auto-Run</h4>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                <li>Tap <strong>Next</strong></li>
                <li><strong>Turn OFF</strong> "Ask Before Running"</li>
                <li>Tap <strong>Done</strong></li>
              </ol>
            </div>

            <div className="bg-green-50 border border-green-200 rounded p-4">
              <p className="text-sm font-semibold text-green-900">✅ All done!</p>
              <p className="text-sm text-green-700">Test by sending yourself a text with "booking" in it</p>
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

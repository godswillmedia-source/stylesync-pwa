'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface IOSSetupButtonProps {
  userEmail: string;
}

export default function IOSSetupButton({ userEmail }: IOSSetupButtonProps) {
  const [iCloudLink, setICloudLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null);

  useEffect(() => {
    const fetchShortcutLink = async () => {
      try {
        const { data, error } = await supabase
          .from('shortcut_config')
          .select('shortcut_url')
          .eq('platform', 'ios')
          .single();

        if (error) throw error;
        setICloudLink(data?.shortcut_url || null);
      } catch (error) {
        console.error('Error fetching shortcut link:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShortcutLink();
  }, []);

  const handleGetShortcut = async () => {
    try {
      await supabase
        .from('shortcut_downloads')
        .insert({
          user_email: userEmail,
          platform: 'ios',
          clicked_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error tracking shortcut click:', error);
    }

    if (iCloudLink) {
      window.open(iCloudLink, '_blank');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="text-center py-6">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p className="text-sm text-gray-600 mt-2">Loading setup...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Screenshot Modal */}
      {activeScreenshot && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveScreenshot(null)}
        >
          <div className="relative max-w-sm w-full">
            <button
              onClick={() => setActiveScreenshot(null)}
              className="absolute -top-10 right-0 text-white text-lg font-bold"
            >
              ✕ Close
            </button>
            <Image
              src={activeScreenshot}
              alt="Setup screenshot"
              width={400}
              height={800}
              className="rounded-lg w-full h-auto"
            />
          </div>
        </div>
      )}
      {/* Big iCloud link button */}
      {iCloudLink && (
        <button
          onClick={handleGetShortcut}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-bold text-lg shadow-lg"
        >
          📲 Get iOS Shortcut (60 Second Setup!)
        </button>
      )}

      {/* Step-by-step instructions */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Step 1 */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">1</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Import the Shortcut</p>
              <p className="text-sm text-gray-600 mt-1">Tap the button above, then tap <strong>"Add Shortcut"</strong></p>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="p-4 border-b border-gray-100 bg-yellow-50">
          <div className="flex items-start gap-3">
            <span className="bg-yellow-500 text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">2</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Update YOUR Email</p>
              <p className="text-sm text-gray-600 mt-1">
                Long-press the shortcut → <strong>Edit</strong> → Change the <code className="bg-gray-200 px-1 rounded">user</code> field to:
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="bg-white border border-gray-300 px-3 py-2 rounded flex-1 text-sm font-mono break-all">
                  {userEmail}
                </code>
                <button
                  onClick={() => copyToClipboard(userEmail, 'email')}
                  className={`px-3 py-2 rounded text-sm font-semibold whitespace-nowrap transition-colors ${
                    copied === 'email' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copied === 'email' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">3</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Create Automation</p>
              <p className="text-sm text-gray-600 mt-1">Open <strong>Shortcuts</strong> app → <strong>Automation</strong> tab → Tap <strong>+</strong></p>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="p-4 border-b border-gray-100 bg-blue-50">
          <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">4</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Set Trigger: Message Contains</p>
              <p className="text-sm text-gray-600 mt-1">
                Select <strong>Message</strong> → Tap <strong>"Message Contains"</strong> → Enter:
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="bg-white border border-blue-300 px-3 py-2 rounded flex-1 text-sm font-mono font-bold text-blue-700">
                  StyleSeat:
                </code>
                <button
                  onClick={() => copyToClipboard('StyleSeat:', 'trigger')}
                  className={`px-3 py-2 rounded text-sm font-semibold whitespace-nowrap transition-colors ${
                    copied === 'trigger' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copied === 'trigger' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                ⚠️ Include the colon! This ensures only StyleSeat booking messages trigger.
              </p>
              <button
                onClick={() => setActiveScreenshot('/setup-guide/automation-trigger.jpeg')}
                className="mt-2 text-sm text-blue-600 underline hover:text-blue-800 flex items-center gap-1"
              >
                📷 See Example
              </button>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">5</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Select Your Shortcut</p>
              <p className="text-sm text-gray-600 mt-1">
                Tap <strong>Next</strong> → Choose <strong>&quot;StyleSync SMS Forwarder&quot;</strong>
              </p>
              <button
                onClick={() => setActiveScreenshot('/setup-guide/shortcut-config.jpeg')}
                className="mt-2 text-sm text-blue-600 underline hover:text-blue-800 flex items-center gap-1"
              >
                📷 See Example
              </button>
            </div>
          </div>
        </div>

        {/* Step 6 */}
        <div className="p-4 bg-green-50">
          <div className="flex items-start gap-3">
            <span className="bg-green-600 text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">6</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Enable "Run Immediately"</p>
              <p className="text-sm text-gray-600 mt-1">
                Select <strong>"Run Immediately"</strong> (not "Run After Confirmation") → Tap <strong>Done</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p className="text-green-900 font-semibold">
          ✅ Done! Bookings will auto-sync instantly.
        </p>
        <p className="text-sm text-gray-600 mt-1">
          When you receive a StyleSeat SMS, it will automatically appear in your calendar.
        </p>
      </div>
    </div>
  );
}

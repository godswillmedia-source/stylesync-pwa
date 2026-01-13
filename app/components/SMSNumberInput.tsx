'use client';

import { useState } from 'react';

interface SMSNumberInputProps {
  onNumberSaved: (number: string) => void;
  userEmail: string;
}

export default function SMSNumberInput({
  onNumberSaved,
  userEmail
}: SMSNumberInputProps) {
  const [senderNumber, setSenderNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!senderNumber.trim()) {
      setError('Please enter a sender number');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/save-sms-sender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          senderNumber: senderNumber.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save sender number');
      }

      console.log('✅ Sender number saved successfully');
      onNumberSaved(senderNumber.trim());

    } catch (err: any) {
      console.error('❌ Error saving sender number:', err);
      setError(err.message || 'Failed to save sender number');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-blue-300 rounded-lg p-6">
      <p className="text-sm text-gray-700 mb-2 font-medium">
        Enter your booking SMS sender number
      </p>
      <p className="text-xs text-gray-600 mb-4">
        Open a booking SMS from StyleSeat and find the sender number (usually a short code like 789537)
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={senderNumber}
          onChange={(e) => setSenderNumber(e.target.value)}
          placeholder="e.g., 789537"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSaving}
        />
        <button
          onClick={handleSave}
          disabled={isSaving || !senderNumber.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-left">
        <p className="text-xs text-gray-700 font-semibold mb-2">
          Common booking SMS sender numbers:
        </p>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• <strong>789537</strong> - StyleSeat</li>
          <li>• <strong>22395</strong> - Schedulicity</li>
          <li>• <strong>467328</strong> - Square Appointments</li>
        </ul>
        <p className="text-xs text-gray-500 mt-2 italic">
          Tip: Open a booking SMS and look at the top to find the sender
        </p>
      </div>
    </div>
  );
}

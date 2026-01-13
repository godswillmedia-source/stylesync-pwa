'use client';

import { useState } from 'react';

interface AnalysisResult {
  senderNumber: string;
  isStyleSeat: boolean;
  confidence: number;
  messageFormat: string;
}

export default function SMSScreenshotAnalyzer({
  onNumberDetected,
  userEmail
}: {
  onNumberDetected: (number: string) => void;
  userEmail: string;
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Convert to base64
      const base64 = await fileToBase64(file);

      // Call API
      const response = await fetch('/api/analyze-sms-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Analysis failed');
      }

      const data: AnalysisResult = await response.json();

      if (!data.isStyleSeat) {
        throw new Error('Not a booking notification SMS');
      }

      if (data.confidence < 0.8) {
        throw new Error('Could not clearly read sender number');
      }

      setResult(data);

      // Save sender number to database
      try {
        await fetch('/api/save-sms-sender', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail,
            senderNumber: data.senderNumber
          }),
        });
        console.log('✅ Sender number saved to database');
      } catch (saveError) {
        console.error('⚠️ Failed to save sender number:', saveError);
        // Don't fail the whole flow if saving fails
      }

      onNumberDetected(data.senderNumber);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center">
      <p className="text-sm text-gray-700 mb-2 font-medium">
        Step 1: Upload a screenshot of a booking SMS
      </p>
      <p className="text-xs text-gray-600 mb-4">
        We'll detect where your booking notifications come from
      </p>

      <input
        type="file"
        accept="image/*"
        onChange={handleScreenshotUpload}
        className="hidden"
        id="sms-screenshot"
        disabled={isAnalyzing}
      />

      <label
        htmlFor="sms-screenshot"
        className="cursor-pointer inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        {isAnalyzing ? 'Analyzing...' : 'Upload Screenshot'}
      </label>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded text-left">
          <p className="text-sm font-semibold text-green-900 mb-2">
            ✅ Booking notification detected!
          </p>
          <p className="text-sm text-gray-700">
            SMS Sender: <strong>{result.senderNumber}</strong>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Confidence: {(result.confidence * 100).toFixed(0)}%
          </p>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-left">
        <p className="text-xs text-gray-700 font-semibold mb-2">
          Examples of booking SMS:
        </p>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• "You just got booked! Sarah scheduled a Haircut..."</li>
          <li>• "New appointment: John Doe for Color on Jan 15..."</li>
        </ul>
      </div>
    </div>
  );
}

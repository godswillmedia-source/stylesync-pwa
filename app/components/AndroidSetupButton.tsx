'use client';

interface AndroidSetupButtonProps {
  userEmail: string;
}

export default function AndroidSetupButton({ userEmail }: AndroidSetupButtonProps) {
  const webhookUrl = `https://stylesync-pwa.vercel.app/api/sms-webhook?user=${encodeURIComponent(userEmail)}`;

  const handleSetup = () => {
    window.location.href = 'https://play.google.com/store/apps/details?id=com.httpsms';
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleSetup}
        className="w-full bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition-colors font-bold text-lg shadow-lg"
      >
        📲 Download SMS Forwarder App
      </button>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="font-semibold text-gray-900 mb-2">After installing:</p>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>Open the app and grant SMS permissions</li>
          <li>Set filter to messages containing: <code className="bg-blue-50 px-2 py-1 rounded font-bold text-blue-700">StyleSeat:</code></li>
          <li>Configure webhook URL:</li>
        </ol>
        <code className="block mt-2 text-xs bg-gray-100 p-2 rounded break-all">
          {webhookUrl}
        </code>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p className="text-green-900 font-semibold">
          ✅ Done! Bookings will auto-sync instantly.
        </p>
      </div>
    </div>
  );
}

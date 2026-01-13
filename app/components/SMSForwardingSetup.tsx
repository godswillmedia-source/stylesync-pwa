'use client';

import { useState, useEffect } from 'react';
import IOSSetupButton from './IOSSetupButton';
import AndroidSetupButton from './AndroidSetupButton';

export default function SMSForwardingSetup({ userEmail }: { userEmail: string }) {
  const [os, setOS] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setOS('ios');
    else if (/android/.test(ua)) setOS('android');
  }, []);

  if (os === 'desktop') {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-6 mb-4">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
          <span className="text-2xl mr-2">📱</span>
          Automatic Booking Capture
        </h3>
        <p className="text-sm text-gray-700 mb-2">
          Never miss a booking! Automatically capture StyleSeat notifications via SMS.
        </p>
        <p className="text-sm text-blue-600 font-medium">
          Open this app on your iPhone or Android to set up SMS forwarding.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
        <span className="text-2xl mr-2">📱</span>
        Automatic Booking Capture
      </h3>

      {os === 'ios' ? (
        <IOSSetupButton userEmail={userEmail} />
      ) : (
        <AndroidSetupButton userEmail={userEmail} />
      )}
    </div>
  );
}

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

// Match the encryption service
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const keyString = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
const key = crypto.scryptSync(keyString, 'salt', KEY_LENGTH);

function decrypt(encrypted) {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const email = 'godswillphotographyllc@gmail.com';

  const { data: user } = await supabase
    .from('user_tokens')
    .select('access_token, refresh_token')
    .eq('user_email', email)
    .single();

  if (!user) {
    console.log('User not found');
    return;
  }

  const accessToken = decrypt(user.access_token);
  const refreshToken = decrypt(user.refresh_token);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Get today's events
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  console.log('\n📅 Google Calendar Events for Today (Jan 17, 2026):');
  console.log('Account:', email);
  console.log('-------------------------------------------');
  if (response.data.items.length === 0) {
    console.log('No events found for today');
  } else {
    response.data.items.forEach(event => {
      const start = event.start.dateTime || event.start.date;
      console.log('- ' + start + ' | ' + event.summary);
    });
  }
  console.log('-------------------------------------------');
})();

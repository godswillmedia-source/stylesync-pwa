/**
 * Calendar Events API
 * GET /api/calendar-events?email=user@example.com&date=2026-01-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { getEncryptionService } from '@/app/lib/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  const dateStr = request.nextUrl.searchParams.get('date');

  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 });
  }

  // Get user tokens
  const { data: user, error: userError } = await supabase
    .from('user_tokens')
    .select('access_token, refresh_token')
    .eq('user_email', email)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    // Decrypt tokens
    const encryptionService = getEncryptionService();
    const accessToken = encryptionService.decrypt(user.access_token);
    const refreshToken = user.refresh_token ? encryptionService.decrypt(user.refresh_token) : undefined;

    // Setup OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Parse date or use today
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    return NextResponse.json({
      date: targetDate.toISOString().split('T')[0],
      events: response.data.items?.map(event => ({
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        description: event.description
      })) || []
    });

  } catch (error: any) {
    console.error('Calendar fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

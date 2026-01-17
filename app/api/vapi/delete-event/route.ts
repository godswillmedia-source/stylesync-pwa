/**
 * VAPI Webhook: Delete Event
 *
 * Called by Diana (VAPI assistant) to delete/cancel an appointment.
 * Deletes from both Supabase and Google Calendar.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { getEncryptionService } from '@/app/lib/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // VAPI sends function call parameters in message.functionCall.parameters
    const functionCall = body.message?.functionCall;
    const metadata = body.message?.call?.metadata || body.message?.metadata || {};

    const userEmail = metadata.userEmail || metadata.user_email;
    const params = functionCall?.parameters || {};

    console.log('VAPI delete_event called:', { userEmail, params });

    if (!userEmail) {
      return NextResponse.json({
        result: "I couldn't identify your account. Please make sure you're logged in."
      });
    }

    const { event_id } = params;

    if (!event_id) {
      return NextResponse.json({
        result: "I need to know which appointment to cancel. Can you tell me the client name or time of the appointment?"
      });
    }

    // Get user with tokens
    const { data: user, error: userError } = await supabase
      .from('user_tokens')
      .select('user_id, access_token, refresh_token')
      .eq('user_email', userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        result: "I couldn't find your account. Please sign in first."
      });
    }

    // Check if event_id is a database ID (numeric) or Google Calendar ID
    let booking = null;
    let googleEventId = event_id;

    // Try to find booking by ID (could be database ID or google_event_id)
    const { data: foundBooking } = await supabase
      .from('salon_bookings')
      .select('*')
      .eq('user_id', user.user_id)
      .or(`id.eq.${event_id},google_event_id.eq.${event_id}`)
      .single();

    if (foundBooking) {
      booking = foundBooking;
      googleEventId = foundBooking.google_event_id;
    }

    let deletedFromCalendar = false;
    let deletedFromDatabase = false;

    // Delete from Google Calendar if we have a Google event ID and valid tokens
    if (googleEventId && user.access_token && user.access_token !== 'pending_ios_oauth') {
      try {
        const encryptionService = getEncryptionService();
        const accessToken = encryptionService.decrypt(user.access_token);
        const refreshToken = user.refresh_token
          ? encryptionService.decrypt(user.refresh_token)
          : undefined;

        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        await calendar.events.delete({
          calendarId: 'primary',
          eventId: googleEventId
        });

        deletedFromCalendar = true;
        console.log('Deleted from Google Calendar:', googleEventId);
      } catch (calError: any) {
        console.error('Failed to delete from calendar:', calError.message);
        // Continue - we'll still try to delete from database
      }
    }

    // Delete from database
    if (booking) {
      const { error: deleteError } = await supabase
        .from('salon_bookings')
        .delete()
        .eq('id', booking.id);

      if (!deleteError) {
        deletedFromDatabase = true;
        console.log('Deleted from database:', booking.id);
      } else {
        console.error('Failed to delete from database:', deleteError);
      }
    }

    // Build response message
    if (deletedFromCalendar || deletedFromDatabase) {
      let details = '';
      if (booking) {
        const time = new Date(booking.appointment_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        const date = new Date(booking.appointment_time).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });
        details = ` ${booking.customer_name}'s ${booking.service} appointment on ${date} at ${time}`;
      }

      const calendarNote = deletedFromCalendar ? ' and removed it from your calendar' : '';

      return NextResponse.json({
        result: `Done! I've cancelled${details}${calendarNote}.`,
        success: true,
        deleted_from_calendar: deletedFromCalendar,
        deleted_from_database: deletedFromDatabase
      });
    } else {
      return NextResponse.json({
        result: "I couldn't find that appointment. Can you tell me more details like the client name or date?"
      });
    }

  } catch (error) {
    console.error('VAPI delete_event error:', error);
    return NextResponse.json({
      result: "Sorry, something went wrong while cancelling. Please try again."
    });
  }
}

// Also support GET for testing
export async function GET() {
  return NextResponse.json({
    endpoint: 'VAPI Delete Event',
    status: 'active',
    usage: 'POST with VAPI webhook payload containing event_id'
  });
}

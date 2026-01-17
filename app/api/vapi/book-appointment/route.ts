/**
 * VAPI Webhook: Book Appointment
 *
 * Called by Diana (VAPI assistant) to create a new booking.
 * Creates the booking in Supabase and syncs to Google Calendar.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CalendarService } from '@/app/lib/calendar';
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

    console.log('VAPI book_appointment called:', { userEmail, params });

    if (!userEmail) {
      return NextResponse.json({
        result: "I couldn't identify your account. Please make sure you're logged in."
      });
    }

    const { client_name, service, date_time } = params;

    if (!client_name || !service || !date_time) {
      return NextResponse.json({
        result: "I need the client name, service, and date/time to book an appointment. Please provide all details."
      });
    }

    // Get user with tokens
    const { data: user, error: userError } = await supabase
      .from('user_tokens')
      .select('user_id, access_token, refresh_token, auth_method')
      .eq('user_email', userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        result: "I couldn't find your account. Please sign in first."
      });
    }

    // Parse the date_time - it might come as ISO string or need parsing
    let appointmentTime: Date;
    try {
      appointmentTime = new Date(date_time);
      if (isNaN(appointmentTime.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (e) {
      return NextResponse.json({
        result: "I couldn't understand that date and time. Please try saying it differently, like 'tomorrow at 2pm' or 'January 20th at 3 PM'."
      });
    }

    // Check if appointment is in the past
    if (appointmentTime < new Date()) {
      return NextResponse.json({
        result: "That time has already passed. Please choose a future date and time."
      });
    }

    // Create the booking in salon_bookings table
    const { data: booking, error: bookingError } = await supabase
      .from('salon_bookings')
      .insert({
        user_id: user.user_id,
        customer_name: client_name,
        service: service,
        appointment_time: appointmentTime.toISOString(),
        duration_minutes: 60,
        is_synced: false,
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Booking error:', bookingError);
      return NextResponse.json({
        result: "Sorry, I couldn't create the booking. Please try again."
      });
    }

    // Sync to Google Calendar if user has valid tokens
    let calendarSynced = false;
    let googleEventId: string | null = null;

    const hasValidTokens = user.access_token &&
                           user.access_token !== 'pending_ios_oauth' &&
                           user.refresh_token &&
                           user.refresh_token !== 'pending_ios_oauth';

    if (hasValidTokens) {
      try {
        const encryptionService = getEncryptionService();
        const decryptedAccessToken = encryptionService.decrypt(user.access_token);
        const decryptedRefreshToken = user.refresh_token
          ? encryptionService.decrypt(user.refresh_token)
          : undefined;

        const calendarService = new CalendarService({
          accessToken: decryptedAccessToken,
          refreshToken: decryptedRefreshToken,
          authMethod: user.auth_method || 'web',
          onTokenRefresh: async (tokens) => {
            const newEncryptedAccess = encryptionService.encrypt(tokens.accessToken);
            const newEncryptedRefresh = tokens.refreshToken
              ? encryptionService.encrypt(tokens.refreshToken)
              : user.refresh_token;

            await supabase
              .from('user_tokens')
              .update({
                access_token: newEncryptedAccess,
                refresh_token: newEncryptedRefresh,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user.user_id);
          },
        });

        const endTime = new Date(appointmentTime.getTime() + 60 * 60 * 1000);

        const event = await calendarService.createEvent({
          summary: `${service} - ${client_name}`,
          description: `StyleSync booking\nService: ${service}\nClient: ${client_name}\nBooked via Diana voice assistant`,
          start: {
            dateTime: appointmentTime.toISOString(),
            timeZone: 'America/New_York',
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: 'America/New_York',
          },
        });

        googleEventId = event.eventId;
        calendarSynced = true;

        // Update booking with calendar event ID
        await supabase
          .from('salon_bookings')
          .update({
            google_event_id: googleEventId,
            is_synced: true,
          })
          .eq('id', booking.id);

        console.log('Calendar event created:', googleEventId);
      } catch (calError: any) {
        console.error('Calendar sync failed:', calError.message);
        // Booking still created, just not synced to calendar
      }
    }

    // Format confirmation message
    const timeStr = appointmentTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const dateStr = appointmentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    const calendarNote = calendarSynced
      ? ' and added it to your calendar'
      : '';

    return NextResponse.json({
      result: `Done! I've booked ${client_name} for ${service} on ${dateStr} at ${timeStr}${calendarNote}.`,
      success: true,
      booking_id: booking.id,
      google_event_id: googleEventId,
      calendar_synced: calendarSynced
    });

  } catch (error) {
    console.error('VAPI book_appointment error:', error);
    return NextResponse.json({
      result: "Sorry, something went wrong while booking. Please try again."
    });
  }
}

// Also support GET for testing
export async function GET() {
  return NextResponse.json({
    endpoint: 'VAPI Book Appointment',
    status: 'active',
    usage: 'POST with VAPI webhook payload containing client_name, service, date_time'
  });
}
